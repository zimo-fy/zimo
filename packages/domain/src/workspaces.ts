import type { ConversationId } from "./index";

export type WorkspaceGrantMode = "ask" | "auto_approve";
export type WorkspaceGrantStatus = "active" | "unavailable";
export type WorkspaceGrantKind = "managed" | "external";

export interface WorkspaceGrant {
  id: string;
  conversationId: ConversationId;
  rootRef: string;
  displayName: string;
  kind: WorkspaceGrantKind;
  mode: WorkspaceGrantMode;
  status: WorkspaceGrantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWorkspaceRootProvider {
  ensure(conversationId: ConversationId): Promise<WorkspaceRootInspection>;
}

export interface WorkspaceGrantRepository {
  listByConversation(conversationId: ConversationId): Promise<readonly WorkspaceGrant[]>;
  getById(id: string): Promise<WorkspaceGrant | null>;
  save(grant: WorkspaceGrant): Promise<void>;
  updateMode(conversationId: ConversationId, mode: WorkspaceGrantMode, at: Date): Promise<number>;
  remove(conversationId: ConversationId, id: string): Promise<boolean>;
  removeExternalByRoot(rootRef: string): Promise<number>;
}

export interface WorkspaceDirectoryAuthorization {
  id: string;
  ownerUserId: string;
  rootRef: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceDirectoryAuthorizationRepository {
  listByOwner(ownerUserId: string): Promise<readonly WorkspaceDirectoryAuthorization[]>;
  save(value: WorkspaceDirectoryAuthorization): Promise<void>;
  removeByOwnerAndRoot(ownerUserId: string, rootRef: string): Promise<boolean>;
}

export interface WorkspaceApprovalModePreferenceRepository {
  getByOwner(ownerUserId: string): Promise<WorkspaceGrantMode | null>;
  save(ownerUserId: string, mode: WorkspaceGrantMode, updatedAt: Date): Promise<void>;
}

export interface WorkspaceRootInspection {
  rootRef: string;
  displayName: string;
}

export interface WorkspaceWriteTarget {
  rootRef: string;
  displayName: string;
  relativePath: string;
  displayTarget: string;
}

export interface WorkspaceListEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  sizeBytes?: number;
}

export interface WorkspaceListResult {
  path: string;
  entries: readonly WorkspaceListEntry[];
  nextCursor?: number;
}

export interface WorkspaceSearchMatch {
  path: string;
  lineNumber?: number;
  preview?: string;
}

export interface WorkspaceSearchResult {
  matches: readonly WorkspaceSearchMatch[];
  truncated: boolean;
}

export interface WorkspaceReadResult {
  path: string;
  content: string;
  checksum: string;
  sizeBytes: number;
  nextCursor?: number;
  truncated: boolean;
}

export interface WorkspaceTextPatchOperation {
  search: string;
  replacement: string;
  replaceAll: boolean;
}

export interface WorkspaceMutationResult {
  path: string;
  operation: "created" | "patched" | "deleted";
  previousChecksum?: string;
  checksum?: string;
  sizeBytes: number;
  lineCount: number;
  changeCount: number;
  recoveryId?: string;
}

export interface WorkspaceDirectoryCreateResult {
  path: string;
  operation: "directory_created";
}

export interface WorkspaceCommandRequest {
  rootRef: string;
  cwd: string;
  command: string;
  timeoutMs: number;
}

export interface WorkspaceCommandResult {
  cwd: string;
  exitCode: number | null;
  signal?: string;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

/**
 * Runs a workspace command through the configured execution boundary. The
 * initial host adapter can later be replaced without changing the Tool API.
 */
export interface WorkspaceCommandExecutor {
  execute(input: WorkspaceCommandRequest, signal: AbortSignal): Promise<WorkspaceCommandResult>;
}

export interface WorkspaceDirectoryReader {
  inspectRoot(sourcePath: string): Promise<WorkspaceRootInspection>;
  list(
    rootRef: string,
    input: { path: string; cursor: number; limit: number },
    signal: AbortSignal,
  ): Promise<WorkspaceListResult>;
  search(
    rootRef: string,
    input: { query?: string; pattern?: string; limit: number },
    signal: AbortSignal,
  ): Promise<WorkspaceSearchResult>;
  read(
    rootRef: string,
    input: { path: string; cursor: number; maxCharacters: number },
    signal: AbortSignal,
  ): Promise<WorkspaceReadResult>;
  listAbsolute(
    absolutePath: string,
    input: { cursor: number; limit: number },
    signal: AbortSignal,
  ): Promise<WorkspaceListResult>;
  searchAbsolute(
    absolutePath: string,
    input: { query?: string; pattern?: string; limit: number },
    signal: AbortSignal,
  ): Promise<WorkspaceSearchResult>;
  readAbsolute(
    absolutePath: string,
    input: { cursor: number; maxCharacters: number },
    signal: AbortSignal,
  ): Promise<WorkspaceReadResult>;
  resolveAbsoluteWriteTarget(
    absolutePath: string,
    authorizedRoots: readonly string[],
  ): Promise<WorkspaceWriteTarget>;
}

export interface WorkspaceDirectoryWriter {
  createDirectory(
    rootRef: string,
    input: { path: string },
    signal: AbortSignal,
  ): Promise<WorkspaceDirectoryCreateResult>;
  create(
    rootRef: string,
    input: { path: string; content: string },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult>;
  patch(
    rootRef: string,
    input: {
      path: string;
      expectedChecksum: string;
      operations: readonly WorkspaceTextPatchOperation[];
    },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult>;
  delete(
    rootRef: string,
    input: { path: string; expectedChecksum: string },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult>;
}
