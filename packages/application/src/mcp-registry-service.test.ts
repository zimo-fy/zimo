import { describe, expect, it, vi } from "vitest";
import type { McpConnection, McpConnectionRepository, McpGateway, SecretStore } from "@zimo/domain";

import { McpRegistryService } from "./mcp-registry-service";

describe("McpRegistryService", () => {
  it("persists every tool returned by tools/list without persisting the credential", async () => {
    const repository = new MemoryMcpRepository();
    const secrets = new MemorySecrets();
    const gateway: McpGateway = {
      discover: vi.fn(async () => ({
        serverName: "test-server",
        tools: [
          { name: "read_item", inputSchema: { type: "object" } },
          { name: "write_item", inputSchema: { type: "object" } },
        ],
      })),
      callTool: vi.fn(async () => ({ value: { ok: true } })),
    };
    const service = new McpRegistryService(
      repository,
      secrets,
      gateway,
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { create: () => "secret-ref" },
    );

    const connection = await service.connect({
      id: "example",
      name: "Example",
      endpoint: "https://mcp.example.com/",
      source: "custom",
      authentication: "bearer",
      credential: "test-secret",
    });

    expect(connection.tools.map((tool) => tool.name)).toEqual(["read_item", "write_item"]);
    expect(JSON.stringify(repository.value)).not.toContain("test-secret");
    expect(await secrets.get("secret-ref")).toBe("test-secret");
  });

  it("persists MCP-standard namespaced tool names containing dots", async () => {
    const repository = new MemoryMcpRepository();
    const gateway: McpGateway = {
      discover: vi.fn(async () => ({
        serverName: "tencent-docs-mcp",
        tools: [
          { name: "doc.ai_format_pure_text", inputSchema: { type: "object" } },
          { name: "smartcanvas.list_blocks", inputSchema: { type: "object" } },
        ],
      })),
      callTool: vi.fn(async () => ({ value: { ok: true } })),
    };
    const service = new McpRegistryService(
      repository,
      new MemorySecrets(),
      gateway,
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { create: () => "secret-ref" },
    );

    const connection = await service.connect({
      id: "tencent-docs",
      name: "腾讯文档",
      endpoint: "https://docs.qq.com/openapi/mcp",
      source: "catalog",
      authentication: "api_key",
      credential: "test-token",
    });

    expect(connection.tools.map((tool) => tool.name)).toEqual([
      "doc.ai_format_pure_text",
      "smartcanvas.list_blocks",
    ]);
  });

  it("calls only a tool present in the latest snapshot", async () => {
    const { service, gateway } = createConnectedHarness();
    await service.connect({
      id: "example",
      name: "Example",
      endpoint: "https://mcp.example.com/",
      source: "custom",
      authentication: "none",
    });

    await expect(
      service.callTool("example", "read_item", { id: "1" }, "run-1", new AbortController().signal),
    ).resolves.toEqual({ ok: true });
    await expect(
      service.callTool("example", "missing", {}, "run-1", new AbortController().signal),
    ).rejects.toMatchObject({ code: "MCP_TOOL_UNAVAILABLE" });
    expect(gateway.callTool).toHaveBeenCalledOnce();
    expect(gateway.callTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "example" }),
      undefined,
      "read_item",
      { id: "1" },
      expect.any(AbortSignal),
      "run-1",
    );
    await service.closeRun("run-1");
  });

  it("stores opaque OAuth state returned after browser authorization", async () => {
    const repository = new MemoryMcpRepository();
    const secrets = new MemorySecrets();
    const gateway: McpGateway = {
      discover: vi.fn(async () => ({
        serverName: "oauth-server",
        tools: [{ name: "read_item", inputSchema: { type: "object" } }],
        credential: '{"version":1,"tokens":{"access_token":"opaque"},"clients":{}}',
      })),
      callTool: vi.fn(async () => ({ value: { ok: true } })),
    };
    const service = new McpRegistryService(
      repository,
      secrets,
      gateway,
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { create: () => "oauth-secret-ref" },
    );

    const connection = await service.connect({
      id: "official-service",
      name: "Official Service",
      endpoint: "https://mcp.example.com/",
      source: "catalog",
      authentication: "oauth",
    });

    expect(connection.secretRef).toBe("oauth-secret-ref");
    expect(await secrets.get("oauth-secret-ref")).toContain('"access_token":"opaque"');
    expect(JSON.stringify(connection)).not.toContain("access_token");
  });

  it("probes without saving and retains every Tencent Meeting tool", async () => {
    const repository = new MemoryMcpRepository();
    const secrets = new MemorySecrets();
    const gateway: McpGateway = {
      discover: vi.fn(async () => ({
        serverName: "tencent-meeting",
        tools: [
          { name: "get_user_meetings", inputSchema: { type: "object" } },
          { name: "schedule_meeting", inputSchema: { type: "object" } },
          { name: "cancel_meeting", inputSchema: { type: "object" } },
        ],
      })),
      callTool: vi.fn(async () => ({ value: { ok: true } })),
    };
    const service = new McpRegistryService(
      repository,
      secrets,
      gateway,
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { create: () => "secret-ref" },
    );

    const result = await service.probe({
      id: "tencent-meeting",
      name: "腾讯会议",
      endpoint: "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
      source: "catalog",
      authentication: "header_token",
      credential: "test-token",
    });

    expect(result.tools.map((tool) => tool.name)).toEqual([
      "get_user_meetings",
      "schedule_meeting",
      "cancel_meeting",
    ]);
    expect(repository.value).toBeNull();
    expect(await secrets.get("secret-ref")).toBeNull();
  });
});

function createConnectedHarness() {
  const gateway: McpGateway = {
    discover: vi.fn(async () => ({
      serverName: "test-server",
      tools: [{ name: "read_item", inputSchema: { type: "object" } }],
    })),
    callTool: vi.fn(async () => ({ value: { ok: true } })),
  };
  return {
    gateway,
    service: new McpRegistryService(
      new MemoryMcpRepository(),
      new MemorySecrets(),
      gateway,
      { now: () => new Date("2026-09-08T00:00:00.000Z") },
      { create: () => "secret-ref" },
    ),
  };
}

class MemoryMcpRepository implements McpConnectionRepository {
  value: McpConnection | null = null;
  async list() {
    return this.value ? [this.value] : [];
  }
  async get(serverId: string) {
    return this.value?.serverId === serverId ? this.value : null;
  }
  async save(value: McpConnection) {
    this.value = value;
  }
  async clear(serverId: string) {
    if (this.value?.serverId === serverId) this.value = null;
  }
}

class MemorySecrets implements SecretStore {
  private readonly values = new Map<string, string>();
  async getStatus() {
    return { available: true, backend: "test", persistent: true };
  }
  async set(ref: string, secret: string) {
    this.values.set(ref, secret);
  }
  async get(ref: string) {
    return this.values.get(ref) ?? null;
  }
  async delete(ref: string) {
    this.values.delete(ref);
  }
}
