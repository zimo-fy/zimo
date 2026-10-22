import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";

import type {
  WorkspaceDirectoryReader,
  WorkspaceListEntry,
  WorkspaceSearchMatch,
} from "@zimo/domain";
import { AppError } from "@zimo/domain";
import {
  EXCLUDED_WORKSPACE_DIRECTORIES,
  assertAllowedWorkspacePath,
  invalidWorkspaceTarget,
  isBinaryWorkspaceContent,
  isSensitiveWorkspaceName,
  normalizeWorkspaceRelativePath,
  resolveExistingWorkspacePath,
  resolveReadableHostPath,
  resolveWorkspaceRoot,
} from "./workspace-path-security";

const MAX_READ_FILE_BYTES = 1 * 1_048_576;
const MAX_SEARCH_FILE_BYTES = 524_288;
const MAX_SEARCH_TOTAL_BYTES = 16_777_216;
const MAX_SEARCH_FILES = 2_000;

export class LocalWorkspaceDirectoryReader implements WorkspaceDirectoryReader {
  constructor(private readonly deniedRoots: readonly string[] = []) {}

  async inspectRoot(sourcePath: string) {
    const source = await lstat(sourcePath).catch(() => null);
    if (!source?.isDirectory() || source.isSymbolicLink()) throw directoryRequired();
    const rootRef = await realpath(sourcePath);
    await resolveReadableHostPath(rootRef, this.deniedRoots);
    const userHome = await realpath(homedir()).catch(() => homedir());
    if (rootRef === userHome || dirname(rootRef) === rootRef) throw rootTooBroad();
    return { rootRef, displayName: basename(rootRef).slice(0, 180) || "工作目录" };
  }

  async listAbsolute(
    absolutePath: string,
    input: { cursor: number; limit: number },
    signal: AbortSignal,
  ) {
    const root = await resolveReadableHostPath(absolutePath, this.deniedRoots);
    const result = await this.list(root, { path: "", ...input }, signal);
    return {
      ...result,
      path: root,
      entries: result.entries.map((entry) => ({ ...entry, path: join(root, entry.path) })),
    };
  }

  async searchAbsolute(
    absolutePath: string,
    input: { query?: string; pattern?: string; limit: number },
    signal: AbortSignal,
  ) {
    const root = await resolveReadableHostPath(absolutePath, this.deniedRoots);
    const result = await this.search(root, input, signal);
    return {
      ...result,
      matches: result.matches.map((match) => ({ ...match, path: join(root, match.path) })),
    };
  }

  async readAbsolute(
    absolutePath: string,
    input: { cursor: number; maxCharacters: number },
    signal: AbortSignal,
  ) {
    const target = await resolveReadableHostPath(absolutePath, this.deniedRoots);
    const result = await this.read(dirname(target), { path: basename(target), ...input }, signal);
    return { ...result, path: target };
  }

  async resolveAbsoluteWriteTarget(absolutePath: string, authorizedRoots: readonly string[]) {
    if (!absolutePath.trim() || absolutePath.length > 4_096 || !isAbsolute(absolutePath)) {
      throw invalidWorkspaceTarget("需要提供有效的绝对文件路径。");
    }
    const parentPath = dirname(absolutePath);
    const parentMetadata = await lstat(parentPath).catch(() => null);
    if (!parentMetadata?.isDirectory() || parentMetadata.isSymbolicLink()) {
      throw invalidWorkspaceTarget("目标父目录不存在或是符号链接；请先逐级创建目录。");
    }
    const parent = await resolveReadableHostPath(parentPath, this.deniedRoots);
    const fileName = basename(absolutePath);
    if (!fileName || fileName === "." || fileName === "..") {
      throw invalidWorkspaceTarget("目标文件名无效。");
    }
    assertAllowedWorkspacePath(fileName, true);
    const roots = await Promise.all(
      authorizedRoots.map(async (rootRef) => ({
        rootRef,
        resolved: await realpath(rootRef).catch(() => ""),
      })),
    );
    const authorized = roots
      .filter((entry) => entry.resolved && isSameOrInside(entry.resolved, parent))
      .sort((left, right) => right.resolved.length - left.resolved.length)[0];
    const rootRef = authorized?.resolved ?? parent;
    const relativeParent = relative(rootRef, parent).split(sep).join("/");
    const relativePath = relativeParent ? `${relativeParent}/${fileName}` : fileName;
    assertAllowedWorkspacePath(relativePath, true);
    return {
      rootRef,
      displayName: basename(rootRef).slice(0, 180) || "已授权目录",
      relativePath,
      displayTarget: absolutePath,
    };
  }

  async list(
    rootRef: string,
    input: { path: string; cursor: number; limit: number },
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const path = normalizeWorkspaceRelativePath(input.path, true);
    assertAllowedWorkspacePath(path);
    const target = await resolveExistingWorkspacePath(rootRef, path);
    const targetStat = await stat(target);
    if (!targetStat.isDirectory()) throw invalidWorkspaceTarget("目标不是目录。");
    const entries = await readdir(target, { withFileTypes: true });
    signal.throwIfAborted();
    const safeEntries: WorkspaceListEntry[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink() || isSensitiveWorkspaceName(entry.name)) continue;
      if (entry.isDirectory() && EXCLUDED_WORKSPACE_DIRECTORIES.has(entry.name)) continue;
      if (!entry.isDirectory() && !entry.isFile()) continue;
      const childPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        safeEntries.push({ path: childPath, name: entry.name, kind: "directory" });
      } else {
        const metadata = await stat(join(target, entry.name));
        safeEntries.push({
          path: childPath,
          name: entry.name,
          kind: "file",
          sizeBytes: metadata.size,
        });
      }
    }
    const page = safeEntries.slice(input.cursor, input.cursor + input.limit);
    const nextCursor = input.cursor + page.length;
    return {
      path,
      entries: page,
      ...(nextCursor < safeEntries.length ? { nextCursor } : {}),
    };
  }

  async search(
    rootRef: string,
    input: { query?: string; pattern?: string; limit: number },
    signal: AbortSignal,
  ) {
    const root = await resolveWorkspaceRoot(rootRef);
    const query = input.query?.toLocaleLowerCase();
    const matches: WorkspaceSearchMatch[] = [];
    const pattern = input.pattern ? globPattern(input.pattern) : undefined;
    let visitedFiles = 0;
    let readBytes = 0;
    let truncated = false;

    const visit = async (directory: string, prefix: string): Promise<void> => {
      signal.throwIfAborted();
      if (matches.length >= input.limit || visitedFiles >= MAX_SEARCH_FILES) {
        truncated = true;
        return;
      }
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        signal.throwIfAborted();
        if (visitedFiles >= MAX_SEARCH_FILES) {
          truncated = true;
          return;
        }
        if (entry.isSymbolicLink() || isSensitiveWorkspaceName(entry.name)) continue;
        const itemPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (!EXCLUDED_WORKSPACE_DIRECTORIES.has(entry.name))
            await visit(join(directory, entry.name), itemPath);
          if (truncated && matches.length >= input.limit) return;
          continue;
        }
        if (!entry.isFile()) continue;
        visitedFiles += 1;
        if (pattern && pattern.test(itemPath)) matches.push({ path: itemPath });
        if (matches.length >= input.limit) {
          truncated = true;
          return;
        }
        if (!query) continue;
        const metadata = await stat(join(directory, entry.name));
        if (
          metadata.size > MAX_SEARCH_FILE_BYTES ||
          readBytes + metadata.size > MAX_SEARCH_TOTAL_BYTES
        ) {
          continue;
        }
        readBytes += metadata.size;
        const buffer = await readFile(join(directory, entry.name));
        if (isBinaryWorkspaceContent(buffer)) continue;
        const lines = buffer.toString("utf8").split(/\r?\n/u);
        for (const [index, line] of lines.entries()) {
          if (!line.toLocaleLowerCase().includes(query)) continue;
          matches.push({ path: itemPath, lineNumber: index + 1, preview: line.slice(0, 300) });
          if (matches.length >= input.limit) {
            truncated = true;
            return;
          }
        }
      }
    };

    await visit(root, "");
    if (visitedFiles >= MAX_SEARCH_FILES) truncated = true;
    return { matches, truncated };
  }

  async read(
    rootRef: string,
    input: { path: string; cursor: number; maxCharacters: number },
    signal: AbortSignal,
  ) {
    signal.throwIfAborted();
    const path = normalizeWorkspaceRelativePath(input.path, false);
    assertAllowedWorkspacePath(path);
    const target = await resolveExistingWorkspacePath(rootRef, path);
    const metadata = await stat(target);
    if (!metadata.isFile()) throw invalidWorkspaceTarget("目标不是普通文件。");
    if (metadata.size > MAX_READ_FILE_BYTES) {
      throw invalidWorkspaceTarget("文件超过 1 MB，工作目录暂不读取该文件。");
    }
    const buffer = await readFile(target);
    signal.throwIfAborted();
    if (isBinaryWorkspaceContent(buffer)) {
      throw invalidWorkspaceTarget("工作目录暂不读取二进制文件。");
    }
    const text = buffer.toString("utf8");
    const content = text.slice(input.cursor, input.cursor + input.maxCharacters);
    const nextCursor = input.cursor + content.length;
    return {
      path,
      content,
      checksum: createHash("sha256").update(buffer).digest("hex"),
      sizeBytes: buffer.byteLength,
      ...(nextCursor < text.length ? { nextCursor } : {}),
      truncated: nextCursor < text.length,
    };
  }
}

function isSameOrInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return (
    fromRoot === "" ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))
  );
}

function globPattern(value: string): RegExp {
  if (!value || value.length > 200 || value.includes("\0")) {
    throw invalidWorkspaceTarget("搜索模式无效。");
  }
  let expression = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === "*" && value[index + 1] === "*") {
      expression += ".*";
      index += 1;
    } else if (character === "*") expression += "[^/]*";
    else if (character === "?") expression += ".";
    else expression += character.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`^${expression}$`, "iu");
}

function directoryRequired(): AppError {
  return new AppError({
    code: "WORKSPACE_DIRECTORY_REQUIRED",
    category: "user",
    userMessage: "请选择一个可访问的普通文件夹。",
  });
}

function rootTooBroad(): AppError {
  return new AppError({
    code: "WORKSPACE_ROOT_TOO_BROAD",
    category: "security",
    userMessage: "不能把主目录或磁盘根目录作为工作目录，请选择具体项目文件夹。",
  });
}
