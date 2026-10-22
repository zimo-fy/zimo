import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SensitiveModelPayloadLogger,
  shouldEnableModelPayloadLogging,
} from "./model-payload-logger";

let temporaryDirectory: string | undefined;

afterEach(async () => {
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe("SensitiveModelPayloadLogger", () => {
  it("writes the complete message payload to its dedicated owner-only file", async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "zimo-model-payload-"));
    const path = join(temporaryDirectory, "llm-payloads.jsonl");
    const logger = new SensitiveModelPayloadLogger(path);

    logger.logRequest({
      schemaVersion: 1,
      conversationId: "conversation-id",
      runId: "run-id",
      providerId: "provider-id",
      modelId: "model-id",
      agentId: "agent-id",
      skillIds: ["skill-id"],
      knowledgeBaseIds: ["knowledge-id"],
      request: {
        model: "test-model",
        temperature: 0.7,
        stream: true,
        messages: [
          { role: "system", content: "完整 Skill 指令" },
          { role: "user", content: "完整用户消息" },
        ],
      },
    });
    logger.logRequest({
      schemaVersion: 1,
      purpose: "conversation_tool_round",
      conversationId: "conversation-id",
      runId: "run-id",
      providerId: "provider-id",
      modelId: "model-id",
      agentId: null,
      skillIds: [],
      knowledgeBaseIds: [],
      round: 1,
      request: {
        model: "test-model",
        temperature: 0.7,
        stream: true,
        messages: [{ role: "user", content: "调用企查查" }],
        tools: [
          {
            name: "mcp_0_company_profile",
            description: "查询企业信息",
            inputSchema: { type: "object", properties: { searchKey: { type: "string" } } },
          },
        ],
      },
      response: {
        toolCalls: [
          {
            id: "call-1",
            name: "mcp_0_company_profile",
            arguments: { searchKey: "测试企业" },
          },
        ],
      },
    });
    logger.logRequest({
      schemaVersion: 1,
      workflowId: "workflow-id",
      runId: "workflow-run-id",
      nodeId: "agent-node-id",
      providerId: "provider-id",
      modelId: "model-id",
      agentId: "agent-id",
      skillIds: ["skill-id"],
      knowledgeBaseIds: ["knowledge-id"],
      request: {
        model: "test-model",
        temperature: 0.7,
        stream: true,
        messages: [{ role: "user", content: "Workflow 完整输入" }],
      },
    });
    await logger.flush();

    const value = await readFile(path, "utf8");
    expect(value).toContain("完整 Skill 指令");
    expect(value).toContain("完整用户消息");
    expect(value).toContain('"workflowId":"workflow-id"');
    expect(value).toContain("Workflow 完整输入");
    expect(value).toContain('"purpose":"conversation_tool_round"');
    expect(value).toContain('"tools":[{"name":"mcp_0_company_profile"');
    expect(value).toContain('"toolCalls":[{"id":"call-1"');
    expect(value).not.toContain("apiKey");
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("only enables payload capture for an explicitly opted-in development run", () => {
    expect(
      shouldEnableModelPayloadLogging({
        ELECTRON_RENDERER_URL: "http://localhost:5173",
        ZIMO_LOG_LLM_PAYLOADS: "1",
      }),
    ).toBe(true);
    expect(shouldEnableModelPayloadLogging({ ZIMO_LOG_LLM_PAYLOADS: "1" })).toBe(false);
    expect(
      shouldEnableModelPayloadLogging({ ELECTRON_RENDERER_URL: "http://localhost:5173" }),
    ).toBe(false);
  });
});
