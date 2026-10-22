export const WORKSPACE_TOOL_IDS = {
  list: "zimo.workspace.list",
  search: "zimo.workspace.search",
  read: "zimo.workspace.read",
  create: "zimo.workspace.create",
  mkdir: "zimo.workspace.mkdir",
  patch: "zimo.workspace.patch",
  delete: "zimo.workspace.delete",
  runCommand: "zimo.workspace.run_command",
} as const;

export const WORKSPACE_TOOL_ID_LIST: readonly string[] = Object.freeze(
  Object.values(WORKSPACE_TOOL_IDS),
);
