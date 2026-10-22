import { mkdir, realpath } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import type { ConversationWorkspaceRootProvider, WorkspaceRootInspection } from "@zimo/domain";

export class LocalConversationWorkspaceRootProvider implements ConversationWorkspaceRootProvider {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async ensure(conversationId: string): Promise<WorkspaceRootInspection> {
    const directory = join(this.root, conversationId, "files");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const rootRef = await realpath(directory);
    return { rootRef, displayName: basename(rootRef) === "files" ? "Zimo Workspace" : "Workspace" };
  }
}
