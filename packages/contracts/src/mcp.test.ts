import { describe, expect, it } from "vitest";

import { connectGithubMcpRequestSchema, githubMcpConnectionViewSchema } from "./mcp";

const requestId = "00000000-0000-4000-8000-000000000012";

describe("MCP registry contracts", () => {
  it("accepts a bounded connection definition and rejects unknown fields", () => {
    expect(
      connectGithubMcpRequestSchema.safeParse({
        requestId,
        payload: {
          serverId: "github",
          name: "GitHub MCP",
          endpoint: "https://api.githubcopilot.com/mcp/readonly",
          source: "catalog",
          authentication: "bearer",
          credential: "github_pat_test",
          unknown: true,
        },
      }).success,
    ).toBe(false);
    expect(
      connectGithubMcpRequestSchema.safeParse({
        requestId,
        payload: {
          serverId: "github",
          name: "GitHub MCP",
          endpoint: "https://api.githubcopilot.com/mcp/readonly",
          source: "catalog",
          authentication: "bearer",
          credential: "x".repeat(4_097),
        },
      }).success,
    ).toBe(false);
  });

  it("never exposes a credential field in the connection view", () => {
    const parsed = githubMcpConnectionViewSchema.parse({
      serverId: "github",
      name: "GitHub MCP",
      endpoint: "https://api.githubcopilot.com/mcp/readonly",
      source: "catalog",
      authentication: "bearer",
      serverName: "github-mcp-server",
      tools: [],
      connectedAt: "2026-09-07T10:00:00.000Z",
      updatedAt: "2026-09-07T10:00:00.000Z",
    });
    expect(JSON.stringify(parsed)).not.toContain("token");
    expect(JSON.stringify(parsed)).not.toContain("secretRef");
  });

  it("accepts browser OAuth without accepting a credential from Renderer", () => {
    const input = {
      requestId,
      payload: {
        serverId: "official-service",
        name: "Official Service",
        endpoint: "https://mcp.example.com/",
        source: "catalog",
        authentication: "oauth",
      },
    };
    expect(connectGithubMcpRequestSchema.safeParse(input).success).toBe(true);
    expect(
      connectGithubMcpRequestSchema.safeParse({
        ...input,
        payload: { ...input.payload, credential: "must-not-cross-renderer" },
      }).success,
    ).toBe(false);
  });

  it("accepts the fixed Tencent Meeting header token and rejects it for custom servers", () => {
    const payload = {
      serverId: "tencent-meeting",
      name: "腾讯会议",
      endpoint: "https://mcp.meeting.tencent.com/mcp/wemeet-open/v1",
      source: "catalog" as const,
      authentication: "header_token" as const,
      credential: "test-token",
    };
    expect(connectGithubMcpRequestSchema.safeParse({ requestId, payload }).success).toBe(true);
    expect(
      connectGithubMcpRequestSchema.safeParse({
        requestId,
        payload: { ...payload, serverId: "custom", source: "custom" },
      }).success,
    ).toBe(false);
  });

  it("accepts fixed catalog API Key placements and rejects custom use", () => {
    for (const authentication of ["api_key", "query_token"] as const) {
      const payload = {
        serverId: authentication === "api_key" ? "tencent-docs" : "amap",
        name: "Catalog service",
        endpoint: "https://mcp.example.com/mcp",
        source: "catalog" as const,
        authentication,
        credential: "test-key",
      };
      expect(connectGithubMcpRequestSchema.safeParse({ requestId, payload }).success).toBe(true);
      expect(
        connectGithubMcpRequestSchema.safeParse({
          requestId,
          payload: { ...payload, source: "custom" },
        }).success,
      ).toBe(false);
    }
  });
});
