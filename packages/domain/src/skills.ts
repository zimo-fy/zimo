export interface InstructionSkillPackage {
  packageId: string;
  name: string;
  version: string;
  description: string;
  category: string;
  tags: readonly string[];
  permissions: readonly string[];
  instructions: string;
  checksum: string;
  files: readonly SkillPackageFile[];
}

const SKILL_PACKAGE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/;

export function readDeclaredSkillPackageId(instructions: string): string | undefined {
  const normalized = instructions.replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) return undefined;
  const end = normalized.indexOf("\n---", 4);
  if (end < 0 || end > 4_096) return undefined;
  for (const line of normalized.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0 || line.slice(0, separator).trim() !== "packageId") continue;
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^(?:"(.*)"|'(.*)')$/u, "$1$2");
    return SKILL_PACKAGE_ID_PATTERN.test(value) ? value : undefined;
  }
  return undefined;
}

export interface SkillPackageFile {
  /** POSIX-style path relative to the package root. */
  path: string;
  content: Uint8Array;
}

export interface SkillPackageStore {
  install(skillId: string, skillPackage: InstructionSkillPackage): Promise<readonly string[]>;
  remove(skillId: string): Promise<void>;
  listScripts(skillId: string, checksum: string): Promise<readonly string[]>;
  listResources(skillId: string, checksum: string): Promise<readonly string[]>;
  readResource(skillId: string, checksum: string, path: string): Promise<string>;
}

export interface SkillScriptExecutionRequest {
  skillId: string;
  checksum: string;
  scriptPath: string;
  arguments: readonly string[];
}

export interface SkillScriptExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SkillScriptExecutor {
  execute(
    request: SkillScriptExecutionRequest,
    signal: AbortSignal,
  ): Promise<SkillScriptExecutionResult>;
}

export interface SkillPackageReader {
  readFromDirectory(directory: string): Promise<InstructionSkillPackage>;
}

export interface GeneratedSkillPackageReader {
  readFromWorkspace(input: {
    ownerSkillId: string;
    ownerChecksum: string;
    directoryName: string;
  }): Promise<InstructionSkillPackage>;
}

export interface RemoteSkillCatalogEntry {
  catalogId: string;
  packageId: string;
  name: string;
  description: string;
  category: string;
  version: string;
  source: string;
  downloadUrl: string;
}

export interface SkillCatalogGateway {
  list(signal: AbortSignal): Promise<readonly RemoteSkillCatalogEntry[]>;
  download(entry: RemoteSkillCatalogEntry, signal: AbortSignal): Promise<InstructionSkillPackage>;
}

export interface SkillCatalogItem {
  catalogId: string;
  packageId: string;
  name: string;
  description: string;
  category: string;
  version: string;
  source: string;
  installationStatus: "installed" | "not_installed";
  installedSkillId?: string | undefined;
}
