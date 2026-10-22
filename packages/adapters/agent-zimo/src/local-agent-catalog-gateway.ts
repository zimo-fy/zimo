import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import {
  AppError,
  type AgentCatalogGateway,
  type ProvisionedAgentDefinition,
  type RemoteAgentCatalogEntry,
} from "@zimo/domain";

const FILE_NAME = "AGENT.md";
const FILE_LIMIT = 64 * 1024;
const PROMPT_LIMIT = 20_000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export class LocalAgentCatalogGateway implements AgentCatalogGateway {
  constructor(private readonly root: string) {}

  async list(signal: AbortSignal): Promise<readonly RemoteAgentCatalogEntry[]> {
    throwIfAborted(signal);
    const root = await this.resolveRoot();
    const entries: RemoteAgentCatalogEntry[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      throwIfAborted(signal);
      if (!entry.isDirectory() || entry.isSymbolicLink() || !isDirectoryName(entry.name)) continue;
      const agentFile = await lstat(join(root, entry.name, FILE_NAME)).catch(() => null);
      if (!agentFile?.isFile() || agentFile.isSymbolicLink()) continue;
      entries.push(await readCatalogEntry(join(root, entry.name)));
    }
    return entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  async provision(
    entry: RemoteAgentCatalogEntry,
    _localAgentId: string,
    signal: AbortSignal,
  ): Promise<ProvisionedAgentDefinition> {
    throwIfAborted(signal);
    const directory = await this.resolveChild(entry.catalogId);
    const agent = await readCatalogEntry(directory);
    return { remoteAgentId: entry.catalogId, systemPrompt: agent.systemPrompt };
  }

  uninstall(_remoteAgentId: string, signal: AbortSignal): Promise<void> {
    throwIfAborted(signal);
    return Promise.resolve();
  }

  private async resolveRoot(): Promise<string> {
    const root = await realpath(this.root).catch(() => {
      throw catalogError("找不到本地 Agent 目录。");
    });
    const stat = await lstat(root).catch(() => {
      throw catalogError("找不到本地 Agent 目录。");
    });
    if (!stat.isDirectory()) throw catalogError("本地 Agent 目录不可用。");
    return root.endsWith(sep) ? root.slice(0, -1) : root;
  }

  private async resolveChild(catalogId: string): Promise<string> {
    if (!isDirectoryName(catalogId)) throw catalogError("没有找到该 Agent。");
    const root = await this.resolveRoot();
    const directory = await realpath(join(root, catalogId)).catch(() => {
      throw catalogError("没有找到该 Agent。");
    });
    if (!isInside(root, directory) || !samePath(dirname(directory), root)) {
      throw catalogError("没有找到该 Agent。");
    }
    return directory;
  }
}

async function readCatalogEntry(
  directory: string,
): Promise<RemoteAgentCatalogEntry & { systemPrompt: string }> {
  const filePath = join(directory, FILE_NAME);
  const stat = await lstat(filePath).catch(() => {
    throw catalogError("没有找到该 Agent。");
  });
  if (stat.isSymbolicLink() || !stat.isFile()) throw catalogError("Agent 定义必须是普通文件。");
  if (stat.size > FILE_LIMIT) throw catalogError("Agent 定义超过大小限制。");
  const content = (await readFile(filePath, "utf8")).replace(/\r\n/g, "\n").trim();
  if (!content) throw catalogError("Agent 定义不能为空。");
  const parsed = parseAgentDocument(content, directoryName(directory));
  return { ...parsed, catalogId: directoryName(directory) };
}

function parseAgentDocument(
  content: string,
  directoryName: string,
): Omit<RemoteAgentCatalogEntry, "catalogId"> & { systemPrompt: string } {
  const frontmatter = readFrontmatter(content);
  const systemPrompt = stripFrontmatter(content).slice(0, PROMPT_LIMIT).trim();
  const name = text(frontmatter.name, 120) || text(directoryName, 120) || "本地 Agent";
  const description = text(frontmatter.description, 500);
  return {
    name,
    description,
    category: text(frontmatter.category, 80) || "本地",
    icon: text(frontmatter.icon, 8) || name.slice(0, 1),
    version: VERSION_PATTERN.test(frontmatter.version ?? "") ? frontmatter.version! : "1.0.0",
    systemPrompt: systemPrompt || description || `请以「${name}」的职责回答用户。`,
  };
}

function readFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith("---\n")) return {};
  const end = content.indexOf("\n---", 4);
  if (end < 0) return {};
  const values: Record<string, string> = {};
  for (const line of content.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) values[key] = value;
  }
  return values;
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---", 4);
  return end < 0 ? content : content.slice(end + 4).trim();
}

function directoryName(directory: string): string {
  const parts = directory.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? directory;
}

function text(value: string | undefined, limit: number): string {
  return (value ?? "").trim().slice(0, limit);
}

function isDirectoryName(name: string): boolean {
  return (
    name.length > 0 &&
    name.length <= 80 &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !name.includes("\0")
  );
}

function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new AppError({
      code: "AGENT_OPERATION_CANCELLED",
      category: "user",
      userMessage: "Agent 操作已取消。",
    });
  }
}

function catalogError(userMessage: string): AppError {
  return new AppError({
    code: "AGENT_CATALOG_UNAVAILABLE",
    category: "configuration",
    userMessage,
  });
}
