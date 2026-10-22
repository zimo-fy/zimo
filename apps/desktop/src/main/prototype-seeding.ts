import type { ZimoDatabase } from "@zimo/database-sqlite";
import type { PrototypeRepository } from "@zimo/domain";

export async function seedRepositoriesOnce(
  targetDatabase: ZimoDatabase,
  repositories: readonly (readonly [PrototypeRepository, PrototypeRepository])[],
  seedKey: string,
): Promise<void> {
  const seeded = targetDatabase.sqlite
    .prepare("SELECT 1 FROM prototype_catalog_meta WHERE key = ?")
    .get(seedKey);
  if (seeded) return;
  for (const [target, seed] of repositories) {
    for (const definition of await seed.list()) await target.save(definition);
  }
  targetDatabase.sqlite
    .prepare("INSERT INTO prototype_catalog_meta(key, value) VALUES (?, ?)")
    .run(seedKey, new Date().toISOString());
}

export async function repairBuiltInInstructionSkills(
  target: PrototypeRepository,
  seed: PrototypeRepository,
): Promise<void> {
  for (const definition of await seed.list()) {
    const { skillPackageId, skillInstructions, skillChecksum } = definition;
    if (!skillPackageId || !skillInstructions || !skillChecksum) continue;
    const existing = await target.getById(definition.id);
    if (!existing || existing.skillInstructions) continue;
    await target.save({
      ...existing,
      skillPackageId,
      skillInstructions,
      skillChecksum,
      capabilities: definition.capabilities,
      updatedAt: definition.updatedAt,
    });
  }
}
