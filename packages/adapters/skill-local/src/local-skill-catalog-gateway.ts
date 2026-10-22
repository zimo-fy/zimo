import { lstat, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

import {
  AppError,
  type InstructionSkillPackage,
  type RemoteSkillCatalogEntry,
  type SkillCatalogGateway,
  type SkillPackageReader,
} from "@zimo/domain";

const SOURCE = "本地 Skill 目录";

export interface SkillDirectoryIdentity {
  packageId: string;
  name: string;
  version: string;
  description: string;
  category: string;
}

export class LocalSkillCatalogGateway implements SkillCatalogGateway {
  constructor(
    private readonly root: string,
    private readonly reader: SkillPackageReader,
    private readonly readIdentity: (directory: string) => Promise<SkillDirectoryIdentity>,
  ) {}

  async list(signal: AbortSignal): Promise<readonly RemoteSkillCatalogEntry[]> {
    throwIfAborted(signal);
    const root = await this.resolveRoot();
    const entries: RemoteSkillCatalogEntry[] = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      throwIfAborted(signal);
      if (!entry.isDirectory() || entry.isSymbolicLink() || !isDirectoryName(entry.name)) continue;
      const directory = join(root, entry.name);
      const skillFile = await lstat(join(directory, "SKILL.md")).catch(() => null);
      if (!skillFile?.isFile() || skillFile.isSymbolicLink()) continue;
      const identity = await this.readIdentity(directory);
      entries.push({
        catalogId: entry.name,
        packageId: identity.packageId,
        name: identity.name,
        description: identity.description,
        category: identity.category || "本地",
        version: identity.version,
        source: SOURCE,
        downloadUrl: "",
      });
    }
    return entries.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));
  }

  async download(
    entry: RemoteSkillCatalogEntry,
    signal: AbortSignal,
  ): Promise<InstructionSkillPackage> {
    throwIfAborted(signal);
    if (!isDirectoryName(entry.catalogId)) throw missingSkill();
    const root = await this.resolveRoot();
    const directory = await realpath(join(root, entry.catalogId)).catch(() => {
      throw missingSkill();
    });
    if (!isInside(root, directory) || !samePath(dirname(directory), root)) throw missingSkill();
    return this.reader.readFromDirectory(directory);
  }

  private async resolveRoot(): Promise<string> {
    const root = await realpath(this.root).catch(() => {
      throw catalogError("找不到本地 Skill 目录。");
    });
    const stat = await lstat(root).catch(() => {
      throw catalogError("找不到本地 Skill 目录。");
    });
    if (!stat.isDirectory()) throw catalogError("本地 Skill 目录不可用。");
    return root.endsWith(sep) ? root.slice(0, -1) : root;
  }
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
      code: "SKILL_OPERATION_CANCELLED",
      category: "user",
      userMessage: "Skill 操作已取消。",
    });
  }
}

function missingSkill(): AppError {
  return catalogError("没有找到该 Skill。");
}

function catalogError(userMessage: string): AppError {
  return new AppError({
    code: "SKILL_CATALOG_UNAVAILABLE",
    category: "configuration",
    userMessage,
  });
}
