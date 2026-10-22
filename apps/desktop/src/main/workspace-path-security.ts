import { lstat, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { AppError } from "@zimo/domain";

export const MAX_WORKSPACE_FILE_BYTES = 1_048_576;
export const EXCLUDED_WORKSPACE_DIRECTORIES = new Set([
  ".git",
  ".zimo",
  "node_modules",
  "dist",
  "build",
  "coverage",
]);

const BLOCKED_BINARY_EXTENSIONS = new Set([
  ".app",
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".dylib",
  ".exe",
  ".msi",
  ".node",
  ".ps1",
  ".so",
]);

export async function resolveExistingWorkspacePath(rootRef: string, path: string): Promise<string> {
  const root = await resolveWorkspaceRoot(rootRef);
  let current = root;
  for (const segment of path ? path.split("/") : []) {
    current = join(current, segment);
    const metadata = await lstat(current).catch(() => {
      throw invalidWorkspaceTarget("文件或目录不存在。");
    });
    if (metadata.isSymbolicLink()) {
      throw invalidWorkspaceTarget("不允许通过符号链接访问工作目录。");
    }
  }
  const target = await realpath(current).catch(() => {
    throw invalidWorkspaceTarget("文件或目录不存在。");
  });
  assertInsideRoot(root, target);
  return target;
}

export async function resolveCreatableWorkspacePath(
  rootRef: string,
  path: string,
): Promise<{ root: string; parent: string; target: string }> {
  const root = await resolveWorkspaceRoot(rootRef);
  const segments = path.split("/");
  const fileName = segments.pop();
  if (!fileName) throw invalidWorkspaceTarget("文件名无效。");
  let parent = root;
  for (const segment of segments) {
    parent = join(parent, segment);
    const metadata = await lstat(parent).catch(() => {
      throw invalidWorkspaceTarget("目标父目录不存在。");
    });
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw invalidWorkspaceTarget("目标父目录不是可写普通目录。");
    }
  }
  parent = await realpath(parent).catch(() => {
    throw invalidWorkspaceTarget("目标父目录不存在。");
  });
  assertInsideRoot(root, parent);
  const target = join(parent, fileName);
  const existing = await lstat(target).catch((error: unknown) => {
    if (isMissing(error)) return null;
    throw error;
  });
  if (existing) throw invalidWorkspaceTarget("目标文件已经存在，不能通过创建操作覆盖。");
  return { root, parent, target };
}

export async function resolveWorkspaceRoot(rootRef: string): Promise<string> {
  const metadata = await lstat(rootRef).catch(() => null);
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) throw workspaceUnavailable();
  const resolved = await realpath(rootRef).catch(() => {
    throw workspaceUnavailable();
  });
  if (relative(rootRef, resolved) !== "") throw workspaceUnavailable();
  return resolved;
}

export async function resolveReadableHostPath(
  value: string,
  deniedRoots: readonly string[],
): Promise<string> {
  if (!value.trim() || value.length > 4_096 || value.includes("\0") || !isAbsolute(value)) {
    throw invalidWorkspaceTarget("需要提供有效的绝对路径。");
  }
  const candidate = resolve(value);
  const metadata = await lstat(candidate).catch(() => null);
  if (!metadata || metadata.isSymbolicLink()) {
    throw invalidWorkspaceTarget("文件或目录不存在，或目标是符号链接。");
  }
  const target = await realpath(candidate).catch(() => {
    throw invalidWorkspaceTarget("文件或目录不存在。");
  });
  for (const deniedRoot of deniedRoots) {
    const denied = await realpath(deniedRoot).catch(() => resolve(deniedRoot));
    if (isSameOrInside(denied, target)) {
      throw new AppError({
        code: "ZIMO_INTERNAL_PATH_DENIED",
        category: "security",
        userMessage: "Zimo 内部数据库、密钥、日志、审计或安装文件不能通过通用文件工具访问。",
      });
    }
  }
  for (const segment of target.split(sep)) {
    if (isSensitiveWorkspaceName(segment)) throw sensitiveWorkspaceFile();
    if (EXCLUDED_WORKSPACE_DIRECTORIES.has(segment)) {
      throw invalidWorkspaceTarget("不读取依赖、构建产物、版本库或 Zimo 内部目录。");
    }
  }
  return target;
}

export function normalizeWorkspaceRelativePath(value: string, allowEmpty: boolean): string {
  const normalized = value.trim().replaceAll("\\", "/").replace(/^\.\//u, "");
  if ((!allowEmpty && !normalized) || normalized.length > 1_000 || normalized.includes("\0")) {
    throw invalidWorkspaceTarget("相对路径无效。");
  }
  if (!normalized && allowEmpty) return "";
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/u.test(normalized) ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw invalidWorkspaceTarget("只能访问工作目录内的相对路径。");
  }
  return normalized;
}

export function assertAllowedWorkspacePath(path: string, write = false): void {
  for (const segment of path.split("/")) {
    if (isSensitiveWorkspaceName(segment)) throw sensitiveWorkspaceFile();
    if (EXCLUDED_WORKSPACE_DIRECTORIES.has(segment)) {
      throw invalidWorkspaceTarget("不允许访问依赖、构建产物、版本库或 Zimo 内部目录。");
    }
  }
  if (write) {
    const lower = path.toLocaleLowerCase();
    const extension = lower.includes(".") ? `.${lower.split(".").at(-1)}` : "";
    if (BLOCKED_BINARY_EXTENSIONS.has(extension) || lower === "zimo.config.json") {
      throw invalidWorkspaceTarget("该文件类型或 Zimo 配置不允许修改。");
    }
  }
}

export function isSensitiveWorkspaceName(value: string): boolean {
  const name = value.toLocaleLowerCase();
  return (
    name === ".env" ||
    name.startsWith(".env.") ||
    name === ".npmrc" ||
    name === ".pypirc" ||
    name === "id_rsa" ||
    name === "id_ed25519" ||
    name === "credentials.json" ||
    name.endsWith(".pem") ||
    name.endsWith(".key")
  );
}

export function isBinaryWorkspaceContent(buffer: Uint8Array): boolean {
  return buffer.subarray(0, Math.min(buffer.length, 8_192)).includes(0);
}

export function invalidWorkspaceTarget(message: string): AppError {
  return new AppError({
    code: "WORKSPACE_PATH_INVALID",
    category: "security",
    userMessage: message,
  });
}

export function sensitiveWorkspaceFile(): AppError {
  return new AppError({
    code: "WORKSPACE_SENSITIVE_FILE_DENIED",
    category: "security",
    userMessage: "该文件可能包含凭据，不允许通过工作目录 Tool 访问。",
  });
}

function assertInsideRoot(root: string, target: string): void {
  const fromRoot = relative(root, target);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw invalidWorkspaceTarget("目标超出当前工作目录。");
  }
}

function isSameOrInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target);
  return (
    fromRoot === "" ||
    (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))
  );
}

function workspaceUnavailable(): AppError {
  return new AppError({
    code: "WORKSPACE_UNAVAILABLE",
    category: "storage",
    userMessage: "工作目录目前不可访问，请重新添加。",
  });
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
