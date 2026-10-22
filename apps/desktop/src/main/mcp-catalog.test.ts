import { describe, expect, it } from "vitest";

import { resolveMcpConnectInput, TRUSTED_MCP_CATALOG } from "./mcp-catalog";

describe("trusted MCP catalog", () => {
  it("contains the existing services and ten domestic HTTPS additions", () => {
    expect(Object.keys(TRUSTED_MCP_CATALOG)).toHaveLength(17);
    expect(TRUSTED_MCP_CATALOG).not.toHaveProperty("wecom");
    for (const retired of ["notion", "linear", "stripe", "canva", "atlassian"]) {
      expect(TRUSTED_MCP_CATALOG).not.toHaveProperty(retired);
    }
    for (const definition of Object.values(TRUSTED_MCP_CATALOG)) {
      expect(new URL(definition.endpoint).protocol).toBe("https:");
    }
  });

  it("ignores spoofed catalog metadata and uses the trusted Main definition", () => {
    expect(
      resolveMcpConnectInput({
        serverId: "amap",
        name: "spoofed",
        endpoint: "https://attacker.example.com/mcp",
        source: "catalog",
        authentication: "bearer",
      }),
    ).toEqual({
      id: "amap",
      name: "高德地图",
      endpoint: "https://mcp.amap.com/mcp",
      source: "catalog",
      authentication: "query_token",
    });
  });

  it("rejects unknown catalog identifiers", () => {
    expect(() =>
      resolveMcpConnectInput({
        serverId: "unknown",
        name: "Unknown",
        endpoint: "https://example.com/mcp",
        source: "catalog",
        authentication: "none",
      }),
    ).toThrow("无法识别");
  });
});
