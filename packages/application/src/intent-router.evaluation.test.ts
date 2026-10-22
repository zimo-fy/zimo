import { describe, expect, it } from "vitest";
import type {
  ConversationId,
  IntentClassifier,
  IntentRouteRecord,
  RouteTarget,
  RunId,
} from "@zimo/domain";
import { IntentRouterService } from "./index";

const routeTargets: readonly RouteTarget[] = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    type: "agent",
    name: "研究助手",
    description: "",
    enabled: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    type: "agent",
    name: "Research Assistant",
    description: "",
    enabled: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    type: "skill",
    name: "网页摘要",
    description: "",
    enabled: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    type: "workflow",
    name: "研究审核流",
    description: "",
    enabled: true,
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    type: "skill",
    name: "禁用摘要",
    description: "",
    enabled: false,
  },
];

const evaluationCases = [
  ["请使用研究助手整理资料", "agent", false],
  ["Use Research Assistant for this", "agent", false],
  ["调用网页摘要处理这篇文章", "skill", false],
  ["运行研究审核流", "workflow", false],
  ["你好，今天怎么样？", "chat", false],
  ["Explain TypeScript generics", "chat", false],
  ["low confidence request", "chat", true],
  ["missing target request", "chat", true],
  ["invalid schema request", "chat", true],
  ["调用禁用摘要", "chat", true],
] as const;

describe("Intent Router bilingual evaluation", () => {
  it("meets the fixture accuracy and records latency distribution", async () => {
    const classifier: IntentClassifier = {
      classify: async (_connection, request) => {
        if (request.text.startsWith("low"))
          return {
            value: {
              intent: "agent",
              targetId: routeTargets[0]!.id,
              confidence: 0.5,
              parameters: {},
              shouldExecute: false,
            },
          };
        if (request.text.startsWith("missing"))
          return {
            value: {
              intent: "agent",
              targetId: "00000000-0000-4000-8000-000000000999",
              confidence: 0.9,
              parameters: {},
              shouldExecute: false,
            },
          };
        if (request.text.startsWith("invalid"))
          return {
            value: { intent: "agent", confidence: 0.9, parameters: {}, shouldExecute: true },
          };
        if (request.text.includes("禁用摘要"))
          return {
            value: {
              intent: "skill",
              targetId: routeTargets[4]!.id,
              confidence: 0.95,
              parameters: {},
              shouldExecute: false,
            },
          };
        return {
          value: { intent: "chat", confidence: 0.92, parameters: {}, shouldExecute: false },
        };
      },
    };
    const records: IntentRouteRecord[] = [];
    const service = new IntentRouterService(
      classifier,
      {
        save: async (record) => {
          records.push(record);
        },
      },
      { now: () => new Date() },
      { create: () => crypto.randomUUID() },
      { fingerprint: (value) => `length:${value.length}` },
    );
    const timings: number[] = [];
    let correct = 0;
    let fallbacks = 0;
    for (const [text, expectedIntent, expectedFallback] of evaluationCases) {
      const startedAt = performance.now();
      const result = await service.route(
        {
          text,
          conversationId: crypto.randomUUID() as ConversationId,
          runId: crypto.randomUUID() as RunId,
          connection: { baseUrl: "https://example.test", apiKey: "fixture", modelName: "fixture" },
          targets: routeTargets,
        },
        new AbortController().signal,
      );
      timings.push(performance.now() - startedAt);
      if (result.route.intent === expectedIntent && result.didFallback === expectedFallback)
        correct += 1;
      if (result.didFallback) fallbacks += 1;
      expect(result.route.shouldExecute).toBe(false);
    }
    timings.sort((left, right) => left - right);
    const metrics = {
      samples: evaluationCases.length,
      accuracy: correct / evaluationCases.length,
      fallbackRate: fallbacks / evaluationCases.length,
      p50Ms: percentile(timings, 0.5),
      p95Ms: percentile(timings, 0.95),
    };
    console.info("ROUTER_EVALUATION", JSON.stringify(metrics));
    expect(metrics).toMatchObject({ accuracy: 1, fallbackRate: 0.4 });
    expect(records).toHaveLength(evaluationCases.length);
  });
});

function percentile(values: readonly number[], fraction: number): number {
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return Number((values[index] ?? 0).toFixed(3));
}
