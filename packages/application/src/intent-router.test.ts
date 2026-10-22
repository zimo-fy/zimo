import { describe, expect, it } from "vitest";
import type {
  ConversationId,
  IntentClassificationRequest,
  IntentClassifier,
  IntentRouteRecord,
  IntentRouteRepository,
  ModelConnection,
  RouteTarget,
  RunId,
  TokenUsage,
} from "@zimo/domain";
import { IntentRouterService } from "./index";
import { RoutingAbortedError } from "./intent-router-service";

const agentId = "00000000-0000-4000-8000-000000000101";
const skillId = "00000000-0000-4000-8000-000000000102";
const targets: readonly RouteTarget[] = [
  { id: agentId, type: "agent", name: "研究助手", description: "研究任务", enabled: true },
  { id: skillId, type: "skill", name: "网页摘要", description: "摘要内容", enabled: false },
];
const input = {
  text: "你好",
  conversationId: "00000000-0000-4000-8000-000000000201" as ConversationId,
  runId: "00000000-0000-4000-8000-000000000202" as RunId,
  connection: { baseUrl: "https://example.test/v1", apiKey: "test-key", modelName: "test-model" },
  targets,
};

describe("IntentRouterService", () => {
  it.each(["请使用研究助手整理资料", "use 研究助手 for this task", "@研究助手 帮我研究"])(
    "uses the deterministic rule for explicit bilingual target: %s",
    async (text) => {
      const classifier = new FakeClassifier(() => {
        throw new Error("classifier should not run");
      });
      const { service, records } = createService(classifier);
      const outcome = await service.route({ ...input, text }, new AbortController().signal);
      expect(outcome).toMatchObject({
        route: { intent: "agent", targetId: agentId, confidence: 0.98, shouldExecute: false },
        didFallback: false,
      });
      expect(classifier.calls).toBe(0);
      expect(records.values[0]).not.toHaveProperty("text");
      expect(records.values[0]).toMatchObject({ inputLength: text.length, didFallback: false });
    },
  );

  it("accepts the 0.7 confidence boundary for an enabled target", async () => {
    const { service } = createService(
      new FakeClassifier(() => ({
        intent: "agent",
        targetId: agentId,
        confidence: 0.7,
        parameters: {},
        shouldExecute: false,
      })),
    );
    const outcome = await service.route(input, new AbortController().signal);
    expect(outcome.route).toMatchObject({ intent: "agent", confidence: 0.7 });
    expect(outcome.didFallback).toBe(false);
  });

  it.each([
    [
      "low_confidence",
      {
        intent: "agent",
        targetId: agentId,
        confidence: 0.699,
        parameters: {},
        shouldExecute: false,
      },
    ],
    [
      "invalid_target",
      {
        intent: "skill",
        targetId: skillId,
        confidence: 0.99,
        parameters: {},
        shouldExecute: false,
      },
    ],
    [
      "invalid_target",
      {
        intent: "workflow",
        targetId: agentId,
        confidence: 0.99,
        parameters: {},
        shouldExecute: false,
      },
    ],
    [
      "invalid_target",
      {
        intent: "agent",
        targetId: "00000000-0000-4000-8000-000000000999",
        confidence: 0.99,
        parameters: {},
        shouldExecute: false,
      },
    ],
    [
      "invalid_schema",
      { intent: "agent", targetId: agentId, confidence: 0.99, parameters: {}, shouldExecute: true },
    ],
    [
      "invalid_schema",
      { intent: "chat", confidence: 0.99, parameters: {}, shouldExecute: false, extra: "rejected" },
    ],
  ] as const)("falls back for %s", async (reason, classification) => {
    const { service } = createService(new FakeClassifier(() => classification));
    const outcome = await service.route(input, new AbortController().signal);
    expect(outcome).toMatchObject({
      route: { intent: "chat", shouldExecute: false },
      didFallback: true,
      fallbackReason: reason,
    });
  });

  it("falls back when the classifier throws", async () => {
    const { service } = createService(
      new FakeClassifier(() => {
        throw new Error("provider failed");
      }),
    );
    await expect(service.route(input, new AbortController().signal)).resolves.toMatchObject({
      fallbackReason: "classifier_error",
      route: { intent: "chat" },
    });
  });

  it("maps malformed classifier JSON to invalid schema fallback", async () => {
    const { service } = createService(
      new FakeClassifier(() => {
        throw new SyntaxError("invalid JSON");
      }),
    );
    await expect(service.route(input, new AbortController().signal)).resolves.toMatchObject({
      fallbackReason: "invalid_schema",
      route: { intent: "chat" },
    });
  });

  it("enforces the timeout even when a classifier ignores cancellation", async () => {
    const { service } = createService(
      new FakeClassifier(() => new Promise<never>(() => undefined)),
      5,
    );
    await expect(service.route(input, new AbortController().signal)).resolves.toMatchObject({
      fallbackReason: "timeout",
      route: { intent: "chat" },
    });
  });

  it("does not abort classification after routing timeout so usage can be harvested", async () => {
    let resolveClassify: ((value: unknown) => void) | undefined;
    const classifier = new FakeClassifier(
      () =>
        new Promise((resolve) => {
          resolveClassify = resolve;
        }),
    );
    const { service } = createService(classifier, 5);
    const outcome = await service.route(input, new AbortController().signal);
    expect(outcome.fallbackReason).toBe("timeout");
    expect(classifier.lastSignal?.aborted).toBe(false);
    expect(outcome.pendingUsage).toBeDefined();
    resolveClassify?.({
      intent: "chat",
      confidence: 0.9,
      parameters: {},
      shouldExecute: false,
    });
    await expect(outcome.pendingUsage).resolves.toBeUndefined();
  });

  it("returns classifier usage from a late classification after timeout", async () => {
    let resolveClassify: ((result: { value: unknown; usage?: TokenUsage }) => void) | undefined;
    const classifier: IntentClassifier = {
      classify: async () =>
        new Promise((resolve) => {
          resolveClassify = resolve;
        }),
    };
    const { service } = createService(classifier, 5);
    const outcome = await service.route(input, new AbortController().signal);
    expect(outcome.fallbackReason).toBe("timeout");
    resolveClassify?.({
      value: { intent: "chat", confidence: 0.9, parameters: {}, shouldExecute: false },
      usage: { totalTokens: 1055 },
    });
    await expect(outcome.pendingUsage).resolves.toEqual({ totalTokens: 1055 });
  });

  it("returns classifier usage when classification finishes in time", async () => {
    const classifier: IntentClassifier = {
      classify: async () => ({
        value: {
          intent: "chat",
          confidence: 0.9,
          parameters: {},
          shouldExecute: false,
        },
        usage: { totalTokens: 12, inputTokens: 8, outputTokens: 4 },
      }),
    };
    const { service } = createService(classifier);
    const outcome = await service.route(input, new AbortController().signal);
    expect(outcome.usage).toEqual({ totalTokens: 12, inputTokens: 8, outputTokens: 4 });
    expect(outcome.pendingUsage).toBeUndefined();
  });

  it("propagates user cancellation without aborting the in-flight classifier", async () => {
    const controller = new AbortController();
    const classifier = new FakeClassifier(() => new Promise<never>(() => undefined));
    const { service } = createService(classifier, 1_000);
    const routing = service.route(input, controller.signal);
    controller.abort();
    await expect(routing).rejects.toMatchObject({ name: "AbortError" });
    expect(classifier.calls).toBe(1);
    expect(classifier.lastSignal?.aborted).toBe(false);
  });

  it("harvests classifier usage after the user cancels routing", async () => {
    let resolveClassify: ((result: { value: unknown; usage?: TokenUsage }) => void) | undefined;
    const classifier: IntentClassifier = {
      classify: async () =>
        new Promise((resolve) => {
          resolveClassify = resolve;
        }),
    };
    const controller = new AbortController();
    const { service } = createService(classifier, 1_000);
    const routing = service.route(input, controller.signal);
    controller.abort();
    const error = await routing.then(
      () => undefined,
      (reason: unknown) => reason,
    );
    expect(error).toBeInstanceOf(RoutingAbortedError);
    resolveClassify?.({
      value: { intent: "chat", confidence: 0.9, parameters: {}, shouldExecute: false },
      usage: { totalTokens: 42 },
    });
    await expect((error as RoutingAbortedError).pendingUsage).resolves.toEqual({ totalTokens: 42 });
  });
});

class FakeClassifier implements IntentClassifier {
  calls = 0;
  lastSignal: AbortSignal | undefined;
  constructor(
    private readonly respond: (
      request: IntentClassificationRequest,
      signal: AbortSignal,
    ) => unknown | Promise<unknown>,
  ) {}
  async classify(
    _connection: ModelConnection,
    request: IntentClassificationRequest,
    signal: AbortSignal,
  ) {
    this.calls += 1;
    this.lastSignal = signal;
    return { value: await this.respond(request, signal) };
  }
}

class MemoryRouteRecords implements IntentRouteRepository {
  readonly values: IntentRouteRecord[] = [];
  async save(record: IntentRouteRecord): Promise<void> {
    this.values.push(record);
  }
}

function createService(classifier: IntentClassifier, timeoutMs = 800) {
  const records = new MemoryRouteRecords();
  const service = new IntentRouterService(
    classifier,
    records,
    { now: () => new Date("2026-09-03T00:00:00.000Z") },
    { create: () => "00000000-0000-4000-8000-000000000301" },
    { fingerprint: (value) => `sha256:${value.length}` },
    timeoutMs,
  );
  return { service, records };
}
