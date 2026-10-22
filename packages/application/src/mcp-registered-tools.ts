import type { McpConnection, McpJsonValue } from "@zimo/domain";

import type { McpRegistryService } from "./mcp-registry-service";
import type { RegisteredTool } from "./tool-runtime";

export function createMcpRegisteredTools(
  connection: McpConnection,
  registry: McpRegistryService,
): readonly RegisteredTool[] {
  return connection.tools.map((tool) => {
    const readOnly = tool.annotations?.readOnly === true;
    const destructive = tool.annotations?.destructive !== false && !readOnly;
    return {
      definition: {
        id: tool.id,
        title: tool.title ?? tool.name,
        description: tool.description ?? `${connection.name} 提供的 MCP 工具。`,
        source: "mcp" as const,
        permissions: [
          {
            id: `mcp:${connection.serverId}:execute`,
            title: `调用 ${connection.name}`,
            description: `向 ${connection.name} 发送工具参数并接收返回结果。`,
            risk: readOnly ? ("medium" as const) : ("high" as const),
          },
        ],
        inputSchema: tool.inputSchema,
        annotations: {
          readOnly,
          destructive,
          idempotent: tool.annotations?.idempotent === true,
          openWorld: tool.annotations?.openWorld !== false,
        },
        confirmation: "per_run" as const,
        timeoutMs: 20_000,
      },
      parse: (input: Readonly<Record<string, unknown>>) =>
        parseMcpArguments(input, tool.inputSchema),
      execute: (input: Readonly<Record<string, unknown>>, context) =>
        registry.callTool(
          connection.serverId,
          tool.name,
          input as Readonly<Record<string, McpJsonValue>>,
          context.runId,
          context.signal,
        ),
    };
  });
}

function parseMcpArguments(
  input: Readonly<Record<string, unknown>>,
  schema: Readonly<Record<string, McpJsonValue>>,
): Readonly<Record<string, unknown>> {
  const properties = isRecord(schema.properties) ? schema.properties : undefined;
  const required = Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === "string")
    : [];
  for (const key of required) {
    if (!(key in input)) throw new Error(`Missing required MCP argument: ${key}`);
  }
  if (schema.additionalProperties === false && properties) {
    for (const key of Object.keys(input)) {
      if (!(key in properties)) throw new Error(`Unknown MCP argument: ${key}`);
    }
  }
  for (const [key, value] of Object.entries(input)) {
    const property = properties?.[key];
    if (property && isRecord(property)) assertPrimitiveType(key, value, property.type);
    assertJsonValue(value, 0);
  }
  return input;
}

function assertPrimitiveType(key: string, value: unknown, type: McpJsonValue | undefined): void {
  if (typeof type !== "string") return;
  const valid =
    (type === "string" && typeof value === "string") ||
    (type === "number" && typeof value === "number" && Number.isFinite(value)) ||
    (type === "integer" && typeof value === "number" && Number.isInteger(value)) ||
    (type === "boolean" && typeof value === "boolean") ||
    (type === "array" && Array.isArray(value)) ||
    (type === "object" && isRecord(value)) ||
    (type === "null" && value === null);
  if (!valid) throw new Error(`Invalid MCP argument type: ${key}`);
}

function assertJsonValue(value: unknown, depth: number): void {
  if (depth > 12) throw new Error("MCP argument nesting exceeds limit");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("MCP argument array exceeds limit");
    value.forEach((item) => assertJsonValue(item, depth + 1));
    return;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length > 500) throw new Error("MCP argument object exceeds limit");
    entries.forEach(([, item]) => assertJsonValue(item, depth + 1));
    return;
  }
  throw new Error("MCP argument is not JSON serializable");
}

function isRecord(value: unknown): value is Record<string, McpJsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
