import type {
  InstructionSkillInstallationService,
  SkillMarketplaceService,
} from "@zimo/application";
import {
  emptyRequestSchema,
  IPC_CHANNELS,
  prototypeDetailViewSchema,
  skillCatalogInstallRequestSchema,
  skillCatalogItemViewSchema,
  skillCatalogListRequestSchema,
  skillCatalogUninstallRequestSchema,
  successViewSchema,
} from "@zimo/contracts";
import type { SkillCatalogItem } from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import type { LocalInstructionSkillPackageReader } from "@zimo/skill-local";
import { BrowserWindow, dialog } from "electron";

import { toPrototypeView } from "./catalog-view-mappers";
import type { RegisterIpcHandler } from "./ipc-handler";

export function registerSkillIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    installation: InstructionSkillInstallationService;
    marketplace: SkillMarketplaceService;
    packageReader: LocalInstructionSkillPackageReader;
    logger: StructuredLogger | null;
  },
): void {
  register({
    channel: IPC_CHANNELS.skillCatalogList,
    input: skillCatalogListRequestSchema,
    output: skillCatalogItemViewSchema.array(),
    handle: async () => (await options.marketplace.list()).map(toCatalogView),
  });
  register({
    channel: IPC_CHANNELS.skillCatalogInstall,
    input: skillCatalogInstallRequestSchema,
    output: skillCatalogItemViewSchema,
    handle: async ({ payload }) => {
      const installed = await options.marketplace.install(payload.catalogId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "skill.install.marketplace",
        message: "Marketplace instruction Skill installed",
        context: {
          skillId: installed.installedSkillId,
          packageId: installed.packageId,
          outcome: "success",
        },
      });
      return toCatalogView(installed);
    },
  });
  register({
    channel: IPC_CHANNELS.skillCatalogUninstall,
    input: skillCatalogUninstallRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await options.marketplace.uninstall(payload.skillId);
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "skill.uninstall",
        message: "Instruction Skill uninstalled",
        context: { skillId: payload.skillId, outcome: "success" },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.skillInstallLocal,
    input: emptyRequestSchema,
    output: prototypeDetailViewSchema.nullable(),
    handle: async (_request, event) => {
      const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const selection = parent
        ? await dialog.showOpenDialog(parent, {
            title: "选择 instruction Skill 文件夹",
            properties: ["openDirectory"],
          })
        : await dialog.showOpenDialog({
            title: "选择 instruction Skill 文件夹",
            properties: ["openDirectory"],
          });
      const directory = selection.filePaths[0];
      if (selection.canceled || !directory) return null;
      const installed = await options.installation.installFromDirectory(
        options.packageReader,
        directory,
      );
      options.logger?.log({
        level: "info",
        category: "audit",
        event: "skill.install.local",
        message: "Local instruction Skill installed",
        context: { skillId: installed.id, packageId: installed.skillPackageId, outcome: "success" },
      });
      return toPrototypeView(installed);
    },
  });
}

function toCatalogView(item: SkillCatalogItem) {
  return {
    catalogId: item.catalogId,
    packageId: item.packageId,
    name: item.name,
    description: item.description,
    category: item.category,
    version: item.version,
    source: item.source,
    installationStatus: item.installationStatus,
    ...(item.installedSkillId ? { installedSkillId: item.installedSkillId } : {}),
  };
}
