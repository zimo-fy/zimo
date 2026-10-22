import { describe, expect, it } from "vitest";

import {
  agentStreamEnvelopeSchema,
  bindEmailChannelRequestSchema,
  changeConversationAgentRequestSchema,
  changeConversationCapabilitiesRequestSchema,
  conversationDetailViewSchema,
  intentRouteSchema,
  knowledgeDocumentViewSchema,
  knowledgeSearchHitViewSchema,
  loginRequestSchema,
  MAX_CONVERSATION_MCP_TOOLS,
  modelProviderViewSchema,
  prototypeDetailViewSchema,
  prototypeMutationRequestSchema,
  sendMessageRequestSchema,
  saveUserMemoryRequestSchema,
  compactConversationRequestSchema,
  toolCapabilityViewSchema,
  updateSettingsRequestSchema,
  workflowRunRequestSchema,
  workspaceGrantViewSchema,
  workspaceAttachDroppedRequestSchema,
  workspaceChangeModeRequestSchema,
} from "./index";

describe("IPC schemas", () => {
  it("accepts bounded memory input and rejects renderer-supplied account IDs", () => {
    const requestId = "00000000-0000-4000-8000-000000000001";
    expect(
      saveUserMemoryRequestSchema.safeParse({
        requestId,
        payload: { kind: "preference", content: "简体中文", enabled: true },
      }).success,
    ).toBe(true);
    expect(
      saveUserMemoryRequestSchema.safeParse({
        requestId,
        payload: {
          kind: "preference",
          content: "简体中文",
          enabled: true,
          ownerUserId: "another-account",
        },
      }).success,
    ).toBe(false);
    expect(
      compactConversationRequestSchema.safeParse({
        requestId,
        payload: { conversationId: requestId, messageId: requestId },
      }).success,
    ).toBe(false);
  });
  it("rejects unknown input keys", () => {
    const result = loginRequestSchema.safeParse({
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: {
        username: "employee-001",
        password: "secret-value",
        unexpected: "value",
      },
    });
    expect(result.success).toBe(false);
  });

  it("accepts only known application settings", () => {
    const result = updateSettingsRequestSchema.parse({
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: { logLevel: "warn", reduceMotion: true },
    });
    expect(result.payload).toEqual({ logLevel: "warn", reduceMotion: true });
  });

  it("accepts only a normalized address when binding email", () => {
    const requestId = "00000000-0000-4000-8000-000000000001";
    expect(
      bindEmailChannelRequestSchema.parse({
        requestId,
        payload: { email: " User@Gmail.com " },
      }).payload,
    ).toEqual({ email: "user@gmail.com" });
    expect(
      bindEmailChannelRequestSchema.safeParse({
        requestId,
        payload: { email: "user@gmail.com", password: "must-not-be-accepted" },
      }).success,
    ).toBe(false);
  });

  it("accepts an empty managed model shell in provider responses", () => {
    const result = modelProviderViewSchema.safeParse({
      id: "6d21df20-fac5-4fd6-b7a1-29f86d86d8d3",
      name: "登录模型",
      baseUrl: "",
      keyHint: "••••1234",
      kind: "openai-compatible",
      enabled: true,
      models: [
        {
          id: "3aab4a95-0e5e-40c4-a09e-f59cc27d4fbc",
          providerId: "6d21df20-fac5-4fd6-b7a1-29f86d86d8d3",
          name: "",
          displayName: "",
          capabilities: {
            streaming: true,
            toolCalling: true,
            structuredOutput: false,
            vision: false,
            reasoning: false,
            promptCaching: false,
          },
          enabled: false,
        },
      ],
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects secret fields in provider responses", () => {
    const result = modelProviderViewSchema.safeParse({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Provider",
      baseUrl: "https://example.test/v1",
      keyHint: "••••1234",
      kind: "openai-compatible",
      enabled: true,
      models: [],
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
      apiKey: "sk-must-not-cross-ipc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts known stream events and rejects unknown event types", () => {
    const envelope = {
      runId: "00000000-0000-4000-8000-000000000001",
      sequence: 0,
      emittedAt: "2026-09-03T00:00:00.000Z",
      event: {
        type: "message.delta",
        messageId: "00000000-0000-4000-8000-000000000002",
        text: "你",
      },
    };
    expect(agentStreamEnvelopeSchema.safeParse(envelope).success).toBe(true);
    expect(
      agentStreamEnvelopeSchema.safeParse({ ...envelope, event: { type: "provider.raw" } }).success,
    ).toBe(false);
  });

  it("requires non-executing strict intent routes", () => {
    const route = {
      intent: "agent",
      targetId: "00000000-0000-4000-8000-000000000002",
      confidence: 0.7,
      parameters: {},
      shouldExecute: false,
    };
    expect(intentRouteSchema.safeParse(route).success).toBe(true);
    expect(intentRouteSchema.safeParse({ ...route, shouldExecute: true }).success).toBe(false);
    expect(intentRouteSchema.safeParse({ ...route, confidence: 1.01 }).success).toBe(false);
    expect(intentRouteSchema.safeParse({ ...route, rawPrompt: "reject" }).success).toBe(false);
  });

  it("keeps Agent selection out of the send-message contract", () => {
    const request = {
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: {
        conversationId: "00000000-0000-4000-8000-000000000002",
        content: "执行任务",
      },
    };
    expect(sendMessageRequestSchema.safeParse(request).success).toBe(true);
    expect(
      sendMessageRequestSchema.safeParse({
        ...request,
        payload: {
          ...request.payload,
          agentId: "00000000-0000-4000-8000-000000000003",
        },
      }).success,
    ).toBe(false);
  });

  it("validates persisted conversation Agent bindings", () => {
    const agentId = "00000000-0000-4000-8000-000000000003";
    const conversationId = "00000000-0000-4000-8000-000000000002";
    expect(
      changeConversationAgentRequestSchema.parse({
        requestId: "00000000-0000-4000-8000-000000000001",
        payload: { conversationId, agentId },
      }).payload,
    ).toEqual({ conversationId, agentId });
    expect(
      changeConversationAgentRequestSchema.safeParse({
        requestId: "00000000-0000-4000-8000-000000000001",
        payload: { conversationId, agentId, unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      conversationDetailViewSchema.safeParse({
        id: conversationId,
        title: "会话",
        modelId: "00000000-0000-4000-8000-000000000004",
        agentId,
        skillIds: [],
        knowledgeBaseIds: [],
        mcpToolIds: [],
        browserEnabled: false,
        messages: [],
        contextCompactions: [],
        createdAt: "2026-09-07T00:00:00.000Z",
        updatedAt: "2026-09-07T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("accepts strict conversation Skill, Workflow and MCP Tool bindings", () => {
    const result = changeConversationCapabilitiesRequestSchema.parse({
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: {
        conversationId: "00000000-0000-4000-8000-000000000002",
        agentId: null,
        skillIds: ["00000000-0000-4000-8000-000000000003"],
        knowledgeBaseIds: [],
        workflowId: "00000000-0000-4000-8000-000000000004",
        mcpToolIds: ["mcp.github.search_repositories"],
        browserEnabled: true,
      },
    });
    expect(result.payload.skillIds).toHaveLength(1);
    expect(result.payload.mcpToolIds).toEqual(["mcp.github.search_repositories"]);
    expect(
      changeConversationCapabilitiesRequestSchema.safeParse({
        ...result,
        payload: { ...result.payload, mcpToolIds: ["zimo.knowledge.search"] },
      }).success,
    ).toBe(false);
  });

  it("accepts up to 300 conversation MCP Tools and rejects the 301st", () => {
    const baseRequest = {
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: {
        conversationId: "00000000-0000-4000-8000-000000000002",
        agentId: null,
        skillIds: [],
        knowledgeBaseIds: [],
        workflowId: null,
        browserEnabled: false,
      },
    };
    const toolIds = Array.from(
      { length: MAX_CONVERSATION_MCP_TOOLS + 1 },
      (_, index) => `mcp.tencent-docs.tool_${index}`,
    );

    expect(
      changeConversationCapabilitiesRequestSchema.safeParse({
        ...baseRequest,
        payload: { ...baseRequest.payload, mcpToolIds: toolIds.slice(0, -1) },
      }).success,
    ).toBe(true);
    expect(
      changeConversationCapabilitiesRequestSchema.safeParse({
        ...baseRequest,
        payload: { ...baseRequest.payload, mcpToolIds: toolIds },
      }).success,
    ).toBe(false);
  });

  it("keeps prototype mutations strict and excludes executable configuration", () => {
    const request = {
      requestId: "00000000-0000-4000-8000-000000000001",
      payload: {
        action: "preview",
        kind: "mcp",
        id: "00000000-0000-4000-8000-000000000002",
        command: "node server.js",
      },
    };
    expect(prototypeMutationRequestSchema.safeParse(request).success).toBe(false);
    expect(
      prototypeDetailViewSchema.safeParse({
        id: request.payload.id,
        kind: "mcp",
        name: "Server",
        description: "",
        status: "disabled",
        category: "stdio",
        tags: [],
        icon: "M",
        version: "1",
        updatedAt: "2026-09-03T00:00:00.000Z",
        source: "Mock",
        permissions: [],
        capabilities: [],
        associations: [],
        workflowNodes: [],
        workflowEdges: [],
        documents: [],
        createdAt: "2026-09-03T00:00:00.000Z",
        rawSecret: "must-not-cross",
      }).success,
    ).toBe(false);
  });

  it("keeps managed file paths and vectors out of knowledge responses", () => {
    const document = {
      id: "00000000-0000-4000-8000-000000000010",
      knowledgeBaseId: "00000000-0000-4000-8000-000000000011",
      name: "产品说明.txt",
      mediaType: "text/plain",
      sizeBytes: 100,
      status: "ready",
      chunkCount: 1,
      createdAt: "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    expect(knowledgeDocumentViewSchema.safeParse(document).success).toBe(true);
    expect(
      knowledgeDocumentViewSchema.safeParse({ ...document, storageKey: "/private/managed.txt" })
        .success,
    ).toBe(false);
    expect(
      knowledgeSearchHitViewSchema.safeParse({
        chunkId: "00000000-0000-4000-8000-000000000012",
        documentId: document.id,
        documentName: document.name,
        text: "产品内容",
        score: 0.9,
        matchType: "hybrid",
        metadata: {},
        embedding: [0.1, 0.2],
      }).success,
    ).toBe(false);
  });

  it("keeps workspace paths out of Renderer views", () => {
    const grant = {
      id: "00000000-0000-4000-8000-000000000001",
      conversationId: "00000000-0000-4000-8000-000000000002",
      displayName: "project",
      kind: "external",
      mode: "ask",
      status: "active",
      createdAt: "2026-09-15T00:00:00.000Z",
      updatedAt: "2026-09-15T00:00:00.000Z",
    };
    expect(workspaceGrantViewSchema.safeParse(grant).success).toBe(true);
    expect(
      workspaceGrantViewSchema.safeParse({ ...grant, rootRef: "/private/project" }).success,
    ).toBe(false);
    expect(
      workspaceAttachDroppedRequestSchema.safeParse({
        requestId: grant.id,
        payload: { conversationId: grant.conversationId, sourcePath: "/private/project" },
      }).success,
    ).toBe(true);
    expect(
      workspaceChangeModeRequestSchema.safeParse({
        requestId: grant.id,
        payload: { conversationId: grant.conversationId, mode: "auto_approve" },
      }).success,
    ).toBe(true);
    expect(
      workspaceChangeModeRequestSchema.safeParse({
        requestId: grant.id,
        payload: { conversationId: grant.conversationId, mode: "auto_low_risk" },
      }).success,
    ).toBe(false);
  });

  it("keeps Tool capabilities declarative and scopes confirmations to a Workflow run", () => {
    const capability = {
      id: "zimo.knowledge.search",
      title: "本地知识库检索",
      description: "只读检索",
      source: "builtin",
      permissions: [
        {
          id: "knowledge:read",
          title: "读取知识库",
          description: "读取已启用索引",
          risk: "low",
        },
      ],
      inputSchema: { type: "object", additionalProperties: false },
      annotations: {
        readOnly: true,
        destructive: false,
        idempotent: true,
        openWorld: false,
      },
      confirmation: "per_run",
      timeoutMs: 10_000,
    };
    expect(toolCapabilityViewSchema.safeParse(capability).success).toBe(true);
    expect(
      toolCapabilityViewSchema.safeParse({ ...capability, execute: "renderer-function" }).success,
    ).toBe(false);
    expect(
      workflowRunRequestSchema.safeParse({
        requestId: "00000000-0000-4000-8000-000000000001",
        payload: {
          workflowId: "00000000-0000-4000-8000-000000000002",
          input: "查询退款",
          confirmedToolIds: [capability.id],
        },
      }).success,
    ).toBe(true);
  });
});
