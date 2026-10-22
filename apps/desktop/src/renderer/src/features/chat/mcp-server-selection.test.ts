import type { McpConnectionView } from "@zimo/contracts";
import { describe, expect, it } from "vitest";

import { isMcpServerSelected, toggleMcpServerTools } from "./mcp-server-selection";

const connection = {
  serverId: "qcc-company",
  name: "企查查·企业数据",
  endpoint: "https://agent.qcc.com/mcp/company/stream",
  source: "custom",
  authentication: "bearer",
  serverName: "qcc-company",
  tools: [
    { id: "mcp.qcc-company.search", name: "search", enabled: true },
    { id: "mcp.qcc-company.detail", name: "detail", enabled: true },
  ],
  connectedAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
} satisfies McpConnectionView;

describe("MCP server selection", () => {
  it("selects every tool exposed by the server while preserving other selections", () => {
    expect(toggleMcpServerTools(connection, ["mcp.github.search"])).toEqual([
      "mcp.github.search",
      "mcp.qcc-company.search",
      "mcp.qcc-company.detail",
    ]);
  });

  it("removes only the selected server tools when toggled off", () => {
    const selected = ["mcp.github.search", "mcp.qcc-company.search", "mcp.qcc-company.detail"];
    expect(isMcpServerSelected(connection, selected)).toBe(true);
    expect(toggleMcpServerTools(connection, selected)).toEqual(["mcp.github.search"]);
  });

  it("does not treat a partially selected legacy snapshot as server authorization", () => {
    expect(isMcpServerSelected(connection, ["mcp.qcc-company.search"])).toBe(false);
  });
});
