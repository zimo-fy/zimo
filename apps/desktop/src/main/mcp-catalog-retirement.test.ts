import { describe, expect, it, vi } from "vitest";

import { removeRetiredMcpConnections } from "./mcp-catalog-retirement";

describe("retired MCP catalog cleanup", () => {
  it("removes only retired connections that still exist", async () => {
    const disconnect = vi.fn(async () => undefined);
    const log = vi.fn();
    await removeRetiredMcpConnections(
      {
        list: async () => [
          { serverId: "notion" },
          { serverId: "github" },
          { serverId: "atlassian" },
        ],
        disconnect,
      },
      { log },
    );

    expect(disconnect.mock.calls).toEqual([["notion"], ["atlassian"]]);
    expect(log).toHaveBeenCalledTimes(2);
  });
});
