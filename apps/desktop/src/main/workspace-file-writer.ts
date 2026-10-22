import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  WorkspaceDirectoryCreateResult,
  WorkspaceDirectoryWriter,
  WorkspaceMutationResult,
  WorkspaceTextPatchOperation,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";

import {
  MAX_WORKSPACE_FILE_BYTES,
  assertAllowedWorkspacePath,
  invalidWorkspaceTarget,
  isBinaryWorkspaceContent,
  normalizeWorkspaceRelativePath,
  resolveCreatableWorkspacePath,
  resolveExistingWorkspacePath,
} from "./workspace-path-security";

const MAX_PATCH_OPERATIONS = 100;
const MAX_CHANGED_LINES = 1_000;
const MAX_CHANGED_BYTES = 524_288;

export class LocalWorkspaceFileWriter implements WorkspaceDirectoryWriter {
  constructor(private readonly recoveryRoot: string) {}

  async createDirectory(
    rootRef: string,
    input: { path: string },
    signal: AbortSignal,
  ): Promise<WorkspaceDirectoryCreateResult> {
    signal.throwIfAborted();
    const path = writablePath(input.path);
    const target = await resolveCreatableWorkspacePath(rootRef, path);
    signal.throwIfAborted();
    await resolveCreatableWorkspacePath(rootRef, path);
    await mkdir(target.target, { mode: 0o700 }).catch((error: unknown) => {
      if (hasCode(error, "EEXIST")) {
        throw invalidWorkspaceTarget("目标目录已经存在，不能通过创建操作覆盖。");
      }
      throw error;
    });
    return { path, operation: "directory_created" };
  }

  async create(
    rootRef: string,
    input: { path: string; content: string },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult> {
    signal.throwIfAborted();
    const path = writablePath(input.path);
    const content = validateText(input.content);
    if (Buffer.byteLength(content) > MAX_CHANGED_BYTES || lineCount(content) > MAX_CHANGED_LINES) {
      throw mutationBudgetExceeded("单次创建不能超过 512 KB 或 1000 行。");
    }
    const target = await resolveCreatableWorkspacePath(rootRef, path);
    const temporary = join(target.parent, `.zimo-${randomUUID()}.tmp`);
    try {
      await writeTemporary(temporary, content, 0o600);
      signal.throwIfAborted();
      await resolveCreatableWorkspacePath(rootRef, path);
      await link(temporary, target.target).catch((error: unknown) => {
        if (hasCode(error, "EEXIST")) {
          throw staleWorkspaceFile("创建过程中目标文件已经出现，未覆盖现有内容。");
        }
        throw error;
      });
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    return mutationResult(path, "created", content, 1);
  }

  async patch(
    rootRef: string,
    input: {
      path: string;
      expectedChecksum: string;
      operations: readonly WorkspaceTextPatchOperation[];
    },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult> {
    signal.throwIfAborted();
    const path = writablePath(input.path);
    validateChecksum(input.expectedChecksum);
    validateOperations(input.operations);
    const current = await readWritableFile(rootRef, path);
    assertChecksum(current.checksum, input.expectedChecksum);
    const patched = applyOperations(current.text, input.operations);
    const content = validateText(patched.content);
    if (Buffer.byteLength(content) - Buffer.byteLength(current.text) > MAX_CHANGED_BYTES) {
      throw mutationBudgetExceeded("单次修改新增内容不能超过 512 KB。");
    }
    if (changedLineCount(current.text, content) > MAX_CHANGED_LINES) {
      throw mutationBudgetExceeded(`单次修改不能超过 ${MAX_CHANGED_LINES} 行。`);
    }
    const recoveryId = await this.saveRecovery(path, current.buffer, current.checksum);
    const temporary = join(current.parent, `.zimo-${randomUUID()}.tmp`);
    try {
      await writeTemporary(temporary, content, current.mode & 0o666);
      signal.throwIfAborted();
      await verifyUnchanged(rootRef, path, current);
      await rename(temporary, current.target);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    return {
      ...mutationResult(path, "patched", content, patched.changeCount),
      previousChecksum: current.checksum,
      recoveryId,
    };
  }

  async delete(
    rootRef: string,
    input: { path: string; expectedChecksum: string },
    signal: AbortSignal,
  ): Promise<WorkspaceMutationResult> {
    signal.throwIfAborted();
    const path = writablePath(input.path);
    validateChecksum(input.expectedChecksum);
    const current = await readWritableFile(rootRef, path);
    assertChecksum(current.checksum, input.expectedChecksum);
    const recoveryId = await this.saveRecovery(path, current.buffer, current.checksum);
    signal.throwIfAborted();
    await verifyUnchanged(rootRef, path, current);
    await unlink(current.target);
    return {
      path,
      operation: "deleted",
      previousChecksum: current.checksum,
      sizeBytes: current.buffer.byteLength,
      lineCount: lineCount(current.text),
      changeCount: 1,
      recoveryId,
    };
  }

  private async saveRecovery(path: string, content: Uint8Array, checksum: string): Promise<string> {
    const recoveryId = randomUUID();
    const directory = join(this.recoveryRoot, recoveryId);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await Promise.all([
        writeFile(join(directory, "content.bin"), content, { flag: "wx", mode: 0o600 }),
        writeFile(
          join(directory, "metadata.json"),
          JSON.stringify({ path, checksum, createdAt: new Date().toISOString() }),
          { flag: "wx", mode: 0o600 },
        ),
      ]);
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
    return recoveryId;
  }
}

type WritableFile = {
  target: string;
  parent: string;
  buffer: Buffer;
  text: string;
  checksum: string;
  size: number;
  modifiedMs: number;
  device: number;
  inode: number;
  mode: number;
};

async function readWritableFile(rootRef: string, path: string): Promise<WritableFile> {
  const target = await resolveExistingWorkspacePath(rootRef, path);
  const metadata = await lstat(target);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw invalidWorkspaceTarget("目标不是可修改的普通文件。");
  }
  if (metadata.nlink > 1) throw invalidWorkspaceTarget("不修改存在硬链接的文件。");
  if ((metadata.mode & 0o111) !== 0) throw invalidWorkspaceTarget("不修改可执行文件。");
  if ((metadata.mode & 0o222) === 0) throw invalidWorkspaceTarget("不修改只读文件。");
  if (metadata.size > MAX_WORKSPACE_FILE_BYTES) {
    throw mutationBudgetExceeded("文件超过 1 MB，不能通过工作目录 Tool 修改。");
  }
  const buffer = await readFile(target);
  if (isBinaryWorkspaceContent(buffer)) throw invalidWorkspaceTarget("不修改二进制文件。");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw invalidWorkspaceTarget("文件不是有效的 UTF-8 文本。");
  }
  return {
    target,
    parent: dirname(target),
    buffer,
    text,
    checksum: digest(buffer),
    size: metadata.size,
    modifiedMs: metadata.mtimeMs,
    device: metadata.dev,
    inode: metadata.ino,
    mode: metadata.mode,
  };
}

async function verifyUnchanged(
  rootRef: string,
  path: string,
  expected: WritableFile,
): Promise<void> {
  const current = await readWritableFile(rootRef, path);
  if (
    current.checksum !== expected.checksum ||
    current.size !== expected.size ||
    current.modifiedMs !== expected.modifiedMs ||
    current.device !== expected.device ||
    current.inode !== expected.inode
  ) {
    throw staleWorkspaceFile("文件在审批或修改期间发生变化，请重新读取后再试。");
  }
}

async function writeTemporary(path: string, content: string, mode: number): Promise<void> {
  const handle = await open(path, "wx", mode || 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await chmod(path, mode || 0o600);
  } finally {
    await handle.close();
  }
}

function applyOperations(
  source: string,
  operations: readonly WorkspaceTextPatchOperation[],
): { content: string; changeCount: number } {
  let content = source;
  let changeCount = 0;
  for (const operation of operations) {
    const occurrences = content.split(operation.search).length - 1;
    if (occurrences === 0) throw patchMismatch("待替换文本不存在，请重新读取文件。");
    if (!operation.replaceAll && occurrences !== 1) {
      throw patchMismatch("待替换文本不唯一，请提供更多上下文或显式 replaceAll。");
    }
    content = operation.replaceAll
      ? content.replaceAll(operation.search, operation.replacement)
      : content.replace(operation.search, operation.replacement);
    changeCount += operation.replaceAll ? occurrences : 1;
  }
  return { content, changeCount };
}

function validateOperations(operations: readonly WorkspaceTextPatchOperation[]): void {
  if (operations.length === 0 || operations.length > MAX_PATCH_OPERATIONS) {
    throw mutationBudgetExceeded(`每次需要 1-${MAX_PATCH_OPERATIONS} 个精确文本操作。`);
  }
  let changedBytes = 0;
  for (const operation of operations) {
    if (
      !operation.search ||
      operation.search.length > 100_000 ||
      operation.replacement.length > 100_000
    ) {
      throw mutationBudgetExceeded("单个查找或替换文本超过限制。");
    }
    changedBytes += Buffer.byteLength(operation.search) + Buffer.byteLength(operation.replacement);
  }
  if (changedBytes > MAX_CHANGED_BYTES) {
    throw mutationBudgetExceeded("单次查找和替换文本总量不能超过 512 KB。");
  }
}

function validateText(value: string): string {
  const bytes = Buffer.byteLength(value);
  if (value.includes("\0") || bytes > MAX_WORKSPACE_FILE_BYTES) {
    throw mutationBudgetExceeded("文本文件不能包含 NUL，且不能超过 1 MB。");
  }
  return value;
}

function writablePath(value: string): string {
  const path = normalizeWorkspaceRelativePath(value, false);
  assertAllowedWorkspacePath(path, true);
  return path;
}

function validateChecksum(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw patchMismatch("文件 checksum 无效。");
}

function assertChecksum(actual: string, expected: string): void {
  if (actual !== expected) throw staleWorkspaceFile("文件已发生变化，请重新读取后再修改。");
}

function mutationResult(
  path: string,
  operation: "created" | "patched",
  content: string,
  changeCount: number,
): WorkspaceMutationResult {
  const buffer = Buffer.from(content, "utf8");
  return {
    path,
    operation,
    checksum: digest(buffer),
    sizeBytes: buffer.byteLength,
    lineCount: lineCount(content),
    changeCount,
  };
}

function changedLineCount(before: string, after: string): number {
  const left = before.split(/\r?\n/u);
  const right = after.split(/\r?\n/u);
  const length = Math.max(left.length, right.length);
  let changes = 0;
  for (let index = 0; index < length; index += 1) if (left[index] !== right[index]) changes += 1;
  return changes;
}

function lineCount(value: string): number {
  return value ? value.split(/\r?\n/u).length : 0;
}

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function staleWorkspaceFile(message: string): AppError {
  return new AppError({ code: "WORKSPACE_FILE_STALE", category: "user", userMessage: message });
}

function patchMismatch(message: string): AppError {
  return new AppError({ code: "WORKSPACE_PATCH_MISMATCH", category: "user", userMessage: message });
}

function mutationBudgetExceeded(message: string): AppError {
  return new AppError({
    code: "WORKSPACE_MUTATION_LIMIT",
    category: "security",
    userMessage: message,
  });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
