import type { McpConnectionView } from "@zimo/contracts";

export function isMcpServerSelected(
  connection: McpConnectionView,
  selectedToolIds: readonly string[],
): boolean {
  return (
    connection.tools.length > 0 &&
    connection.tools.every((tool) => selectedToolIds.includes(tool.id))
  );
}

export function toggleMcpServerTools(
  connection: McpConnectionView,
  selectedToolIds: readonly string[],
): string[] {
  const serverToolIds = new Set(connection.tools.map((tool) => tool.id));
  if (isMcpServerSelected(connection, selectedToolIds)) {
    return selectedToolIds.filter((toolId) => !serverToolIds.has(toolId));
  }
  return [...new Set([...selectedToolIds, ...serverToolIds])];
}
