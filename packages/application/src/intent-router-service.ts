import type {
  Clock,
  ConversationId,
  Fingerprinter,
  IdGenerator,
  IntentClassifier,
  IntentClassificationResult,
  IntentRoute,
  IntentRouteRepository,
  RouteFallbackReason,
  RouteTarget,
  RunId,
  TokenUsage,
} from "@zimo/domain";
import { intentRouteSchema } from "@zimo/contracts";

import * as ConversationRun from "./conversation-run";

const ROUTER_USAGE_WAIT_MS = 60_000;

export interface RoutingOutcome {
  route: IntentRoute;
  durationMs: number;
  didFallback: boolean;
  fallbackReason?: RouteFallbackReason | undefined;
  usage?: TokenUsage | undefined;
  pendingUsage?: Promise<TokenUsage | undefined> | undefined;
}

export class RoutingAbortedError extends Error {
  override readonly name = "AbortError";
  constructor(readonly pendingUsage?: Promise<TokenUsage | undefined>) {
    super("Generation aborted");
  }
}

export function pendingUsageFromError(error: unknown): Promise<TokenUsage | undefined> | undefined {
  return error instanceof RoutingAbortedError ? error.pendingUsage : undefined;
}

export class IntentRouterService {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly records: IntentRouteRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly fingerprinter: Fingerprinter,
    private readonly timeoutMs = 800,
    private readonly onCompleted?: ((outcome: RoutingOutcome) => void) | undefined,
  ) {}

  async route(
    input: {
      text: string;
      conversationId: ConversationId;
      runId: RunId;
      connection: { baseUrl: string; apiKey: string; modelName: string };
      targets: readonly RouteTarget[];
    },
    signal: AbortSignal,
  ): Promise<RoutingOutcome> {
    const startedAt = this.clock.now().getTime();
    const ruleRoute = matchExplicitTarget(input.text, input.targets);
    let outcome: Omit<RoutingOutcome, "durationMs">;
    if (ruleRoute) {
      outcome = { route: ruleRoute, didFallback: false };
    } else {
      outcome = await this.classify(input.text, input.targets, input.connection, signal);
    }
    const durationMs = Math.max(0, this.clock.now().getTime() - startedAt);
    const result: RoutingOutcome = { ...outcome, durationMs };
    await this.records
      .save({
        id: this.ids.create(),
        conversationId: input.conversationId,
        runId: input.runId,
        inputFingerprint: this.fingerprinter.fingerprint(input.text),
        inputLength: input.text.length,
        intent: result.route.intent,
        ...(result.route.targetId ? { targetId: result.route.targetId } : {}),
        confidence: result.route.confidence,
        durationMs,
        didFallback: result.didFallback,
        ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
        createdAt: this.clock.now(),
      })
      .catch(() => undefined);
    this.onCompleted?.(result);
    return result;
  }

  private async classify(
    text: string,
    targets: readonly RouteTarget[],
    connection: { baseUrl: string; apiKey: string; modelName: string },
    signal: AbortSignal,
  ): Promise<Omit<RoutingOutcome, "durationMs">> {
    if (signal.aborted) throw ConversationRun.abortError();
    const classifyPromise = this.classifier.classify(
      connection,
      { text, targets },
      new AbortController().signal,
    );
    const pendingUsage = withUsageDeadline(
      classifyPromise.then((result) => result.usage).catch(() => undefined),
      ROUTER_USAGE_WAIT_MS,
    );
    let classified: IntentClassificationResult;
    try {
      const raced = await raceClassification(classifyPromise, signal, this.timeoutMs);
      if (raced.status === "timeout") return { ...fallback("timeout", 0), pendingUsage };
      if (raced.status === "aborted") throw new RoutingAbortedError(pendingUsage);
      classified = raced.result;
    } catch (error) {
      if (error instanceof RoutingAbortedError) throw error;
      if (signal.aborted) throw new RoutingAbortedError(pendingUsage);
      return fallback(error instanceof SyntaxError ? "invalid_schema" : "classifier_error", 0);
    }
    return interpretClassification(classified, targets);
  }
}

function matchExplicitTarget(text: string, targets: readonly RouteTarget[]): IntentRoute | null {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  const hasInvocation = /(?:使用|调用|让|交给|运行|执行|use|run|ask|with|@|\/)/iu.test(normalized);
  if (!hasInvocation) return null;
  const matches = targets.filter(
    (target) =>
      target.enabled && normalized.includes(target.name.normalize("NFKC").toLocaleLowerCase()),
  );
  if (matches.length !== 1) return null;
  const target = matches[0];
  if (!target) return null;
  return {
    intent: target.type,
    targetId: target.id,
    confidence: 0.98,
    parameters: {},
    reason: `明确提及“${target.name}”`,
    shouldExecute: false,
  };
}

export function fallback(
  reason: RouteFallbackReason,
  confidence: number,
): Omit<RoutingOutcome, "durationMs"> {
  const messages: Record<RouteFallbackReason, string> = {
    timeout: "识别超时，已继续普通对话。",
    classifier_error: "识别服务不可用，已继续普通对话。",
    invalid_schema: "识别结果无效，已继续普通对话。",
    low_confidence: "未发现足够明确的自动化意图。",
    invalid_target: "识别目标不存在或未启用，已继续普通对话。",
    no_classifier: "未配置识别模型，已继续普通对话。",
  };
  return {
    route: {
      intent: "chat",
      confidence,
      parameters: {},
      reason: messages[reason],
      shouldExecute: false,
    },
    didFallback: true,
    fallbackReason: reason,
  };
}

function interpretClassification(
  classified: IntentClassificationResult,
  targets: readonly RouteTarget[],
): Omit<RoutingOutcome, "durationMs"> {
  const parsed = intentRouteSchema.safeParse(classified.value);
  const usage = classified.usage;
  if (!parsed.success) return withUsage(fallback("invalid_schema", 0), usage);
  const route: IntentRoute = {
    intent: parsed.data.intent,
    ...(parsed.data.targetId ? { targetId: parsed.data.targetId } : {}),
    confidence: parsed.data.confidence,
    parameters: parsed.data.parameters,
    ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
    shouldExecute: false,
  };
  if (route.intent === "unknown")
    return withUsage(fallback("low_confidence", route.confidence), usage);
  if (route.confidence < 0.7) return withUsage(fallback("low_confidence", route.confidence), usage);
  if (route.intent === "chat") {
    return withUsage(
      {
        route: {
          intent: "chat",
          confidence: route.confidence,
          parameters: route.parameters,
          ...(route.reason ? { reason: route.reason } : {}),
          shouldExecute: false,
        },
        didFallback: false,
      },
      usage,
    );
  }
  const target = targets.find((candidate) => candidate.id === route.targetId);
  if (!target || !target.enabled || target.type !== route.intent) {
    return withUsage(fallback("invalid_target", route.confidence), usage);
  }
  return withUsage({ route, didFallback: false }, usage);
}

function withUsage(
  outcome: Omit<RoutingOutcome, "durationMs">,
  usage: TokenUsage | undefined,
): Omit<RoutingOutcome, "durationMs"> {
  return usage ? { ...outcome, usage } : outcome;
}

function withUsageDeadline(
  promise: Promise<TokenUsage | undefined>,
  timeoutMs: number,
): Promise<TokenUsage | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs);
    timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
    );
  });
}

async function raceClassification(
  classifyPromise: Promise<IntentClassificationResult>,
  parentSignal: AbortSignal,
  timeoutMs: number,
): Promise<
  | { status: "ok"; result: IntentClassificationResult }
  | { status: "timeout" }
  | { status: "aborted" }
> {
  if (parentSignal.aborted) return { status: "aborted" };
  return await new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish({ status: "timeout" }), timeoutMs);
    const onAbort = () => finish({ status: "aborted" });
    parentSignal.addEventListener("abort", onAbort, { once: true });
    classifyPromise.then(
      (result) => finish({ status: "ok", result }),
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        parentSignal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
    function finish(
      value:
        | { status: "ok"; result: IntentClassificationResult }
        | { status: "timeout" }
        | { status: "aborted" },
    ) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      parentSignal.removeEventListener("abort", onAbort);
      resolve(value);
    }
  });
}
