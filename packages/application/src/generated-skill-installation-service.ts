import { AppError, type GeneratedSkillPackageReader, type PrototypeDefinition } from "@zimo/domain";

import type { InstructionSkillInstallationService } from "./instruction-skill-installation-service";

export const SKILL_CREATOR_PACKAGE_ID = "zimo.skill-creator";
export const SKILL_CREATOR_MARKETPLACE_PACKAGE_ID = "zimo.market.2abaca4911e68fa9bfbf3482";
export const SKILL_CREATOR_INSTALL_PERMISSION = "skill:local-install";
const SKILL_MARKETPLACE_SOURCE = "Zimo Skill Store";

type SkillInstaller = Pick<InstructionSkillInstallationService, "install">;

export class GeneratedSkillInstallationService {
  constructor(
    private readonly reader: GeneratedSkillPackageReader,
    private readonly installation: SkillInstaller,
  ) {}

  async install(
    creator: PrototypeDefinition,
    directoryName: string,
    signal: AbortSignal,
  ): Promise<PrototypeDefinition> {
    assertAuthorizedCreator(creator);
    if (signal.aborted) throw abortError();
    const skillPackage = await this.reader.readFromWorkspace({
      ownerSkillId: creator.id,
      ownerChecksum: creator.skillChecksum!,
      directoryName,
    });
    if (signal.aborted) throw abortError();
    if (
      skillPackage.packageId === SKILL_CREATOR_PACKAGE_ID ||
      skillPackage.packageId === SKILL_CREATOR_MARKETPLACE_PACKAGE_ID
    ) {
      throw generatedSkillError("Creator 不能通过生成目录覆盖自身安装包。");
    }
    return this.installation.install(skillPackage, "Skill Creator 本地创建");
  }
}

export function isAuthorizedSkillCreator(skill: PrototypeDefinition): boolean {
  if (!skill.skillChecksum) return false;
  const isProjectCreator =
    skill.skillPackageId === SKILL_CREATOR_PACKAGE_ID &&
    skill.permissions.includes(SKILL_CREATOR_INSTALL_PERMISSION);
  const isReviewedMarketplaceCreator =
    skill.skillPackageId === SKILL_CREATOR_MARKETPLACE_PACKAGE_ID &&
    skill.source === SKILL_MARKETPLACE_SOURCE;
  return isProjectCreator || isReviewedMarketplaceCreator;
}

function assertAuthorizedCreator(skill: PrototypeDefinition): void {
  if (!isAuthorizedSkillCreator(skill)) {
    throw new AppError({
      code: "SKILL_CREATOR_INSTALL_NOT_AUTHORIZED",
      category: "security",
      userMessage: "当前 Skill 没有安装本地 Skill 的权限。",
    });
  }
}

function generatedSkillError(userMessage: string): AppError {
  return new AppError({
    code: "GENERATED_SKILL_INSTALL_REJECTED",
    category: "security",
    userMessage,
  });
}

function abortError(): AppError {
  return new AppError({
    code: "TOOL_CANCELLED",
    category: "user",
    userMessage: "已取消安装生成的 Skill。",
  });
}
