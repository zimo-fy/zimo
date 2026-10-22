import {
  AppError,
  type PrototypeId,
  type RemoteSkillCatalogEntry,
  type SkillCatalogGateway,
  type SkillCatalogItem,
  type SkillRepository,
} from "@zimo/domain";

import type { InstructionSkillInstallationService } from "./instruction-skill-installation-service";
import type { PrototypeCatalogService } from "./prototype-catalog-service";

const LIST_TIMEOUT_MS = 20_000;
const INSTALL_TIMEOUT_MS = 60_000;
const STORE_INSTALL_RESTRICTED_PACKAGE_IDS = new Set([
  "zimo.boss-zhipin",
  "zimo.liepin-hr",
  "zimo.recruitment-hub",
  "zimo.yupao",
]);
const STORE_INSTALL_RESTRICTED_MESSAGE = "请联系zimo官方获取完整技能";

export class SkillMarketplaceService {
  private readonly activeOperations = new Set<AbortController>();
  private readonly installing = new Set<string>();

  constructor(
    private readonly gateway: SkillCatalogGateway,
    private readonly skills: SkillRepository,
    private readonly installation: InstructionSkillInstallationService,
    private readonly prototypes: PrototypeCatalogService,
  ) {}

  async list(signal?: AbortSignal): Promise<readonly SkillCatalogItem[]> {
    const remote = await this.runWithTimeout(
      (signal) => this.gateway.list(signal),
      LIST_TIMEOUT_MS,
      "SKILL_CATALOG_TIMEOUT",
      "获取 Skill 目录超时，请稍后重试。",
      signal,
    );
    return mergeCatalog(remote, await this.skills.list());
  }

  async install(catalogId: string): Promise<SkillCatalogItem> {
    if (this.installing.has(catalogId)) {
      throw marketplaceError("SKILL_INSTALL_IN_PROGRESS", "该 Skill 正在安装中。");
    }
    this.installing.add(catalogId);
    try {
      const installed = await this.runWithTimeout(
        async (signal) => {
          const entry = (await this.gateway.list(signal)).find(
            (item) => item.catalogId === catalogId,
          );
          if (!entry) throw marketplaceError("SKILL_CATALOG_ITEM_NOT_FOUND", "没有找到该 Skill。");
          if (STORE_INSTALL_RESTRICTED_PACKAGE_IDS.has(entry.packageId)) {
            throw marketplaceError("SKILL_INSTALL_RESTRICTED", STORE_INSTALL_RESTRICTED_MESSAGE);
          }
          const skillPackage = await this.gateway.download(entry, signal);
          if (skillPackage.packageId !== entry.packageId) {
            throw marketplaceError("SKILL_PACKAGE_INVALID", "Skill 安装包身份与目录不一致。");
          }
          return {
            entry,
            skill: await this.installation.install(skillPackage, "Zimo Skill Store"),
          };
        },
        INSTALL_TIMEOUT_MS,
        "SKILL_INSTALL_TIMEOUT",
        "Skill 安装超时，请稍后重试。",
      );
      return toCatalogItem(installed.entry, installed.skill.id);
    } finally {
      this.installing.delete(catalogId);
    }
  }

  async uninstall(skillId: string): Promise<void> {
    const skill = await this.skills.getById(skillId as PrototypeId);
    if (!skill || skill.kind !== "skill" || skill.installationStatus !== "installed") {
      throw marketplaceError("SKILL_NOT_INSTALLED", "该 Skill 尚未安装或已经卸载。");
    }
    await this.prototypes.mutate({ action: "delete", kind: "skill", id: skill.id });
    await this.installation.uninstallArtifacts(skill.id);
  }

  async normalizeInstalledSkills(): Promise<void> {
    for (const skill of await this.skills.list()) {
      if (skill.installationStatus === "installed" && skill.status !== "enabled") {
        await this.skills.save({ ...skill, status: "enabled" });
      }
    }
  }

  cancelAll(): void {
    for (const controller of this.activeOperations) controller.abort();
  }

  private async runWithTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
    timeoutCode: string,
    timeoutMessage: string,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    else externalSignal?.addEventListener("abort", abortFromParent, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    this.activeOperations.add(controller);
    try {
      return await operation(controller.signal);
    } catch (cause) {
      if (!controller.signal.aborted) throw cause;
      throw new AppError({
        code: timedOut ? timeoutCode : "SKILL_OPERATION_CANCELLED",
        category: timedOut ? "network" : "user",
        userMessage: timedOut ? timeoutMessage : "Skill 操作已取消。",
        retryable: timedOut,
        cause,
      });
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", abortFromParent);
      this.activeOperations.delete(controller);
    }
  }
}

function mergeCatalog(
  remote: readonly RemoteSkillCatalogEntry[],
  local: Awaited<ReturnType<SkillRepository["list"]>>,
): SkillCatalogItem[] {
  const installed = local.filter(
    (skill) => skill.kind === "skill" && skill.installationStatus === "installed",
  );
  const installedByPackage = new Map(
    installed.flatMap((skill) =>
      skill.skillPackageId ? [[skill.skillPackageId, skill] as const] : [],
    ),
  );
  const remotePackages = new Set<string>();
  const items = remote.flatMap((entry) => {
    if (remotePackages.has(entry.packageId)) return [];
    remotePackages.add(entry.packageId);
    return [toCatalogItem(entry, installedByPackage.get(entry.packageId)?.id)];
  });
  for (const skill of installed) {
    if (!skill.skillPackageId || remotePackages.has(skill.skillPackageId)) continue;
    items.push({
      catalogId: `local:${skill.id}`,
      packageId: skill.skillPackageId,
      name: skill.name,
      description: skill.description,
      category: skill.category || "本地",
      version: skill.version,
      source: skill.source,
      installationStatus: "installed",
      installedSkillId: skill.id,
    });
  }
  return items.sort((left, right) =>
    left.category === right.category
      ? left.name.localeCompare(right.name, "zh-CN")
      : left.category.localeCompare(right.category, "zh-CN"),
  );
}

function toCatalogItem(
  entry: RemoteSkillCatalogEntry,
  installedSkillId?: string,
): SkillCatalogItem {
  return {
    catalogId: entry.catalogId,
    packageId: entry.packageId,
    name: entry.name,
    description: entry.description,
    category: entry.category || "其他",
    version: entry.version,
    source: entry.source,
    installationStatus: installedSkillId ? "installed" : "not_installed",
    ...(installedSkillId ? { installedSkillId } : {}),
  };
}

function marketplaceError(code: string, userMessage: string): AppError {
  return new AppError({ code, category: "configuration", userMessage });
}
