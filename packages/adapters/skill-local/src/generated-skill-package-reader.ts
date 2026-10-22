import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import {
  AppError,
  type GeneratedSkillPackageReader,
  type InstructionSkillPackage,
  type SkillPackageReader,
} from "@zimo/domain";

const DIRECTORY_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKILL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const RUNTIME_MANIFEST = ".zimo-package.json";

export class LocalGeneratedSkillPackageReader implements GeneratedSkillPackageReader {
  constructor(
    private readonly storageRoot: string,
    private readonly packageReader: SkillPackageReader,
  ) {}

  async readFromWorkspace(input: {
    ownerSkillId: string;
    ownerChecksum: string;
    directoryName: string;
  }): Promise<InstructionSkillPackage> {
    validateInput(input);
    await this.assertInstalledOwner(input.ownerSkillId, input.ownerChecksum);

    const workspace = await realpath(
      join(this.storageRoot, "data", input.ownerSkillId, "workspace"),
    ).catch(() => {
      throw invalidGeneratedSkill("Creator 工作区尚未初始化，请先运行创建脚本。");
    });
    const candidate = resolve(workspace, input.directoryName);
    if (!candidate.startsWith(`${workspace}${sep}`)) {
      throw invalidGeneratedSkill("只能安装 Creator 工作区中的 Skill 目录。");
    }
    const stat = await lstat(candidate).catch(() => null);
    if (!stat?.isDirectory() || stat.isSymbolicLink()) {
      throw invalidGeneratedSkill("生成的 Skill 目录不存在或不安全。");
    }
    const generatedRoot = await realpath(candidate);
    if (generatedRoot !== candidate || !generatedRoot.startsWith(`${workspace}${sep}`)) {
      throw invalidGeneratedSkill("生成的 Skill 目录不能通过符号链接跳出工作区。");
    }
    return this.packageReader.readFromDirectory(generatedRoot);
  }

  private async assertInstalledOwner(skillId: string, checksum: string): Promise<void> {
    const manifestPath = join(this.storageRoot, "packages", skillId, checksum, RUNTIME_MANIFEST);
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
      if (
        !manifest ||
        typeof manifest !== "object" ||
        !("checksum" in manifest) ||
        manifest.checksum !== checksum
      ) {
        throw new Error("checksum mismatch");
      }
    } catch (error) {
      throw new AppError({
        code: "SKILL_PACKAGE_STORAGE_FAILED",
        category: "storage",
        userMessage: "Creator 安装包状态无效，请重新安装后再试。",
        cause: error,
      });
    }
  }
}

function validateInput(input: {
  ownerSkillId: string;
  ownerChecksum: string;
  directoryName: string;
}): void {
  if (
    !SKILL_ID_PATTERN.test(input.ownerSkillId) ||
    !CHECKSUM_PATTERN.test(input.ownerChecksum) ||
    !DIRECTORY_NAME_PATTERN.test(input.directoryName) ||
    input.directoryName.length > 64
  ) {
    throw invalidGeneratedSkill("生成的 Skill 目录参数无效。");
  }
}

function invalidGeneratedSkill(message: string): AppError {
  return new AppError({
    code: "GENERATED_SKILL_INVALID",
    category: "security",
    userMessage: message,
  });
}
