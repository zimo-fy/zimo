import {
  InstructionSkillInstallationService,
  type PrototypeCatalogService,
  SkillMarketplaceService,
} from "@zimo/application";
import type { Clock, IdGenerator, SkillRepository } from "@zimo/domain";
import {
  LocalGeneratedSkillPackageReader,
  LocalInstructionSkillPackageReader,
  LocalSkillCatalogGateway,
  LocalSkillPackageRuntime,
  readInstructionSkillIdentity,
} from "@zimo/skill-local";

export function createSkillMarketplaceServices(options: {
  skills: SkillRepository;
  prototypes: PrototypeCatalogService;
  clock: Clock;
  ids: IdGenerator;
  storageRoot: string;
  skillsDirectory: string;
}) {
  const packageRuntime = new LocalSkillPackageRuntime(options.storageRoot);
  const installation = new InstructionSkillInstallationService(
    options.skills,
    options.clock,
    options.ids,
    packageRuntime,
  );
  const packageReader = new LocalInstructionSkillPackageReader();
  const marketplace = new SkillMarketplaceService(
    new LocalSkillCatalogGateway(
      options.skillsDirectory,
      packageReader,
      readInstructionSkillIdentity,
    ),
    options.skills,
    installation,
    options.prototypes,
  );
  return {
    installation,
    marketplace,
    packageReader,
    generatedPackageReader: new LocalGeneratedSkillPackageReader(
      options.storageRoot,
      packageReader,
    ),
    packageRuntime,
  };
}
