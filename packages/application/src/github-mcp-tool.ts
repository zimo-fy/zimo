import type { McpJsonValue } from "@zimo/domain";

import type { RegisteredTool } from "./tool-runtime";

export interface GithubRepositorySearch {
  callTool?(
    serverId: string,
    toolName: string,
    input: Readonly<Record<string, McpJsonValue>>,
    signal: AbortSignal,
  ): Promise<McpJsonValue>;
  searchRepositories?(query: string, limit: number, signal: AbortSignal): Promise<McpJsonValue>;
}

export function createGithubMcpReadOnlyTools(
  github: GithubRepositorySearch,
): readonly RegisteredTool[] {
  return [
    {
      definition: {
        id: "mcp.github.search_repositories",
        title: "GitHub 仓库搜索",
        description: "通过已连接的 GitHub 官方 MCP 只读搜索仓库。",
        source: "mcp",
        permissions: [
          {
            id: "github:repositories:read",
            title: "读取 GitHub 仓库信息",
            description: "可将搜索条件发送给 GitHub，并读取当前 Token 有权访问的仓库信息。",
            risk: "medium",
          },
        ],
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            query: { type: "string", minLength: 1, maxLength: 256 },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
          },
          required: ["query"],
        },
        annotations: {
          readOnly: true,
          destructive: false,
          idempotent: true,
          openWorld: true,
        },
        confirmation: "per_run",
        timeoutMs: 15_000,
      },
      parse: parseGithubRepositorySearchInput,
      execute: async (value, context) => {
        const parsed = parseGithubRepositorySearchInput(value);
        if (github.callTool) {
          return github.callTool(
            "github",
            "search_repositories",
            { query: parsed.query, page: 1, perPage: parsed.limit, minimal_output: true },
            context.signal,
          );
        }
        if (github.searchRepositories) {
          return github.searchRepositories(parsed.query, parsed.limit, context.signal);
        }
        throw new Error("GitHub MCP repository search unavailable");
      },
    },
  ];
}

function parseGithubRepositorySearchInput(value: Readonly<Record<string, unknown>>): {
  query: string;
  limit: number;
} {
  if (Object.keys(value).some((key) => !["query", "limit"].includes(key))) {
    throw new Error("Unknown GitHub repository search argument");
  }
  const query = typeof value.query === "string" ? value.query.trim() : "";
  const limit = value.limit ?? 5;
  if (
    !query ||
    query.length > 256 ||
    typeof limit !== "number" ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 10
  ) {
    throw new Error("Invalid GitHub repository search arguments");
  }
  return { query, limit };
}
