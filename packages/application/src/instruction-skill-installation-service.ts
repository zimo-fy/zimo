import type {
  Clock,
  IdGenerator,
  InstructionSkillPackage,
  PrototypeDefinition,
  PrototypeId,
  SkillPackageReader,
  SkillPackageStore,
  SkillRepository,
} from "@zimo/domain";

export class InstructionSkillInstallationService {
  constructor(
    private readonly skills: SkillRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly packageStore?: SkillPackageStore,
  ) {}

  async install(
    skillPackage: InstructionSkillPackage,
    source = "本地 instruction Skill",
  ): Promise<PrototypeDefinition> {
    const existing = (await this.skills.list()).find(
      (candidate) => candidate.skillPackageId === skillPackage.packageId,
    );
    const now = this.clock.now();
    const skillId = existing?.id ?? (this.ids.create() as PrototypeId);
    const scriptPaths = this.packageStore
      ? await this.packageStore.install(skillId, skillPackage)
      : skillPackage.files
          .map((file) => file.path)
          .filter((path) => /\.(?:py|[cm]?js)$/i.test(path));
    const installed: PrototypeDefinition = {
      id: skillId,
      kind: "skill",
      name: skillPackage.name,
      description: skillPackage.description,
      status: "enabled",
      category: skillPackage.category,
      tags: skillPackage.tags,
      icon: existing?.icon ?? skillPackage.name.slice(0, 1).toUpperCase(),
      version: skillPackage.version,
      source,
      skillPackageId: skillPackage.packageId,
      skillInstructions: skillPackage.instructions,
      skillChecksum: skillPackage.checksum,
      permissions: skillPackage.permissions,
      capabilities: scriptPaths.length > 0 ? ["指令型 Skill", "脚本型 Skill"] : ["指令型 Skill"],
      associations: existing?.associations ?? [],
      installationStatus: "installed",
      workflowNodes: [],
      workflowEdges: [],
      documents: [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await this.skills.save(installed);
    return installed;
  }

  async installFromDirectory(reader: SkillPackageReader, directory: string) {
    return this.install(await reader.readFromDirectory(directory));
  }

  async uninstallArtifacts(skillId: string): Promise<void> {
    await this.packageStore?.remove(skillId);
  }
}
