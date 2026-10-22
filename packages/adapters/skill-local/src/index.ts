import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";

import { AppError, type InstructionSkillPackage, type SkillPackageReader } from "@zimo/domain";

export { LocalGeneratedSkillPackageReader } from "./generated-skill-package-reader";
export { LocalSkillCatalogGateway } from "./local-skill-catalog-gateway";
export { LocalSkillPackageRuntime } from "./skill-package-runtime";

const MANIFEST_LIMIT = 64 * 1024;
const INSTRUCTIONS_LIMIT = 256 * 1024;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 20 * 1024 * 1024;
const MAX_PACKAGE_FILES = 500;
const PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const ALLOWED_PERMISSIONS = new Set([
  "context:user-input",
  "context:conversation",
  "skill:local-install",
]);

interface SkillMetadata {
  packageId: string;
  name: string;
  version: string;
  description: string;
  category: string;
  permissions: string[];
}

export class LocalInstructionSkillPackageReader implements SkillPackageReader {
  async readFromDirectory(directory: string): Promise<InstructionSkillPackage> {
    try {
      return await readPackage(directory);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw invalidPackage("无法安全读取所选 Skill 文件夹。");
    }
  }
}

export async function readInstructionSkillIdentity(directory: string): Promise<{
  packageId: string;
  name: string;
  version: string;
  description: string;
  category: string;
}> {
  try {
    const root = await realpath(directory);
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory()) throw invalidPackage("请选择一个 Skill 文件夹。");
    const instructionsPath = await safeRegularFile(root, "SKILL.md", INSTRUCTIONS_LIMIT);
    const instructions = (await readFile(instructionsPath, "utf8")).trim();
    if (!instructions) throw invalidPackage("SKILL.md 不能为空。");
    const metadata = await resolveMetadata(root, instructions);
    return {
      packageId: metadata.packageId,
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      category: metadata.category,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw invalidPackage("无法安全读取所选 Skill 文件夹。");
  }
}

async function readPackage(directory: string): Promise<InstructionSkillPackage> {
  const root = await realpath(directory);
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) throw invalidPackage("请选择一个 Skill 文件夹。");

  const instructionsPath = await safeRegularFile(root, "SKILL.md", INSTRUCTIONS_LIMIT);
  const instructions = (await readFile(instructionsPath, "utf8")).trim();
  if (!instructions) throw invalidPackage("SKILL.md 不能为空。");
  const metadata = await resolveMetadata(root, instructions);
  const files = await readPackageFiles(root);
  const digest = createHash("sha256").update(metadata.packageId).update("\0");
  for (const file of files) {
    digest.update(file.path).update("\0").update(file.content).update("\0");
  }
  return {
    ...metadata,
    tags: [],
    instructions,
    checksum: digest.digest("hex"),
    files,
  };
}

async function resolveMetadata(root: string, instructions: string): Promise<SkillMetadata> {
  const manifest = await readOptionalManifest(root);
  const frontmatter = readFrontmatter(instructions);
  const fallbackPackageId = `local.skill.${createHash("sha256").update(root).digest("hex").slice(0, 24)}`;
  const packageId =
    safePattern(manifest.packageId, PACKAGE_ID_PATTERN) ??
    safePattern(frontmatter.packageId, PACKAGE_ID_PATTERN) ??
    fallbackPackageId;
  const heading = instructions.match(/^#\s+(.+)$/m)?.[1];
  return {
    packageId,
    name:
      safeText(manifest.name, 120) ??
      safeText(frontmatter.name, 120) ??
      safeText(heading, 120) ??
      safeText(basename(root), 120) ??
      "本地 Skill",
    version:
      safePattern(manifest.version, VERSION_PATTERN) ??
      safePattern(frontmatter.version, VERSION_PATTERN) ??
      "1.0.0",
    description:
      safeText(manifest.description, 500) ?? safeText(frontmatter.description, 500) ?? "",
    category: safeText(manifest.category, 80) ?? safeText(frontmatter.category, 80) ?? "本地",
    permissions: safePermissions(manifest.permissions),
  };
}

async function readOptionalManifest(root: string): Promise<Record<string, unknown>> {
  const path = join(root, "manifest.json");
  const stat = await lstat(path).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > MANIFEST_LIMIT) return {};
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function readFrontmatter(instructions: string): Record<string, unknown> {
  if (!instructions.startsWith("---\n")) return {};
  const end = instructions.indexOf("\n---", 4);
  if (end < 0) return {};
  const values: Record<string, unknown> = {};
  for (const line of instructions.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!["packageId", "name", "version", "description", "category"].includes(key)) continue;
    values[key] = line
      .slice(separator + 1)
      .trim()
      .replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

function safeText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= limit ? normalized : undefined;
}

function safePattern(value: unknown, pattern: RegExp): string | undefined {
  const normalized = safeText(value, 80);
  return normalized && pattern.test(normalized) ? normalized : undefined;
}

function safePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return ["context:user-input"];
  return value
    .filter((permission): permission is string => typeof permission === "string")
    .filter((permission) => ALLOWED_PERMISSIONS.has(permission))
    .slice(0, 2);
}

async function readPackageFiles(root: string): Promise<InstructionSkillPackage["files"]> {
  const files: { path: string; content: Uint8Array }[] = [];
  let totalBytes = 0;
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".DS_Store" || entry.name === "__MACOSX") continue;
      const absolute = join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw invalidPackage("Skill 包不能包含符号链接。");
      if (stat.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if (!stat.isFile()) throw invalidPackage("Skill 包只能包含普通文件和文件夹。");
      if (stat.size > MAX_FILE_BYTES) throw invalidPackage("Skill 包包含过大的单个文件。");
      totalBytes += stat.size;
      if (totalBytes > MAX_PACKAGE_BYTES) throw invalidPackage("Skill 包总大小超过限制。");
      files.push({
        path: relative(root, absolute).split(sep).join("/"),
        content: new Uint8Array(await readFile(absolute)),
      });
      if (files.length > MAX_PACKAGE_FILES) throw invalidPackage("Skill 包文件数量超过限制。");
    }
  };
  await visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function safeRegularFile(root: string, name: string, limit: number): Promise<string> {
  const candidate = resolve(root, name);
  const resolved = await realpath(candidate).catch(() => {
    throw invalidPackage(`Skill 包缺少 ${name}。`);
  });
  if (!resolved.startsWith(`${root}${sep}`)) throw invalidPackage(`${name} 不能指向包外文件。`);
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isFile()) throw invalidPackage(`${name} 必须是普通文件。`);
  if (stat.size > limit) throw invalidPackage(`${name} 超过大小限制。`);
  return resolved;
}

function invalidPackage(message: string): AppError {
  return new AppError({
    code: "SKILL_PACKAGE_INVALID",
    category: "user",
    userMessage: message,
  });
}
