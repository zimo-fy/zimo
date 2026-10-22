import type { McpConnectionView } from "@zimo/contracts";
import { describe, expect, it } from "vitest";

import type { McpCatalogEntry } from "./mcp-catalog";
import { buildMcpListItems } from "./mcp-list-model";

const catalog: McpCatalogEntry[] = [
  entry("alpha", "Alpha 文档", "文档检索"),
  entry("beta", "Beta 地图", "路线规划"),
  entry("gamma", "Gamma 会议", "会议管理"),
];

describe("MCP list model", () => {
  it("places connected services before unconnected catalog entries", () => {
    const items = buildMcpListItems(catalog, [connection("beta", "Beta 地图")], "", "all");

    expect(items.map(({ entry: item }) => item.input.serverId)).toEqual(["beta", "alpha", "gamma"]);
  });

  it("searches names, descriptions, endpoints and custom servers", () => {
    const custom = connection("custom-reports", "经营报表", "custom");

    expect(buildMcpListItems(catalog, [custom], "报表", "all")).toHaveLength(1);
    expect(buildMcpListItems(catalog, [custom], "route.beta", "all")[0]?.entry.input.name).toBe(
      "Beta 地图",
    );
    expect(buildMcpListItems(catalog, [custom], "会议管理", "all")[0]?.entry.input.name).toBe(
      "Gamma 会议",
    );
  });

  it("filters by connection state", () => {
    const connections = [connection("alpha", "Alpha 文档")];

    expect(
      buildMcpListItems(catalog, connections, "", "connected").map(
        ({ entry: item }) => item.input.serverId,
      ),
    ).toEqual(["alpha"]);
    expect(
      buildMcpListItems(catalog, connections, "", "not_connected").map(
        ({ entry: item }) => item.input.serverId,
      ),
    ).toEqual(["beta", "gamma"]);
  });
});

function entry(serverId: string, name: string, description: string): McpCatalogEntry {
  return {
    input: {
      serverId,
      name,
      endpoint: `https://route.${serverId}.example/mcp`,
      source: "catalog",
      authentication: "none",
    },
    description,
    icon: "docs",
  };
}

function connection(
  serverId: string,
  name: string,
  source: McpConnectionView["source"] = "catalog",
): McpConnectionView {
  return {
    serverId,
    name,
    endpoint: `https://${serverId}.example/mcp`,
    source,
    authentication: "none",
    serverName: name,
    tools: [],
    connectedAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}
