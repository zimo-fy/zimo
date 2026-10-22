import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalGeneratedSkillPackageReader, LocalInstructionSkillPackageReader } from "./index";

describe("LocalGeneratedSkillPackageReader", () => {
  const roots: string[] = [];
  const creatorId = "creator-1";
  const checksum = "a".repeat(64);

  afterEach(async () => {
    await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
    roots.length = 0;
  });

  it("reads a generated Skill from the installed Creator workspace", async () => {
    const root = await createRuntimeRoot();
    const generated = join(root, "data", creatorId, "workspace", "demo-skill");
    await mkdir(generated);
    await writeFile(
      join(generated, "SKILL.md"),
      "---\nname: demo-skill\ndescription: Demo\n---\n\n# Demo\n",
    );
    await writeFile(
      join(generated, "manifest.json"),
      JSON.stringify({
        packageId: "local.skill.demo-skill",
        name: "Demo Skill",
        version: "1.0.0",
      }),
    );

    const value = await reader(root).readFromWorkspace({
      ownerSkillId: creatorId,
      ownerChecksum: checksum,
      directoryName: "demo-skill",
    });

    expect(value).toMatchObject({
      packageId: "local.skill.demo-skill",
      name: "Demo Skill",
      version: "1.0.0",
    });
  });

  it("rejects traversal and linked generated directories", async () => {
    const root = await createRuntimeRoot();
    const workspace = join(root, "data", creatorId, "workspace");
    const outside = await mkdtemp(join(tmpdir(), "zimo-generated-skill-outside-"));
    roots.push(outside);
    await symlink(outside, join(workspace, "linked-skill"));

    await expect(
      reader(root).readFromWorkspace({
        ownerSkillId: creatorId,
        ownerChecksum: checksum,
        directoryName: "../outside",
      }),
    ).rejects.toMatchObject({ code: "GENERATED_SKILL_INVALID" });
    await expect(
      reader(root).readFromWorkspace({
        ownerSkillId: creatorId,
        ownerChecksum: checksum,
        directoryName: "linked-skill",
      }),
    ).rejects.toMatchObject({ code: "GENERATED_SKILL_INVALID" });
  });

  async function createRuntimeRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "zimo-generated-skill-"));
    roots.push(root);
    await mkdir(join(root, "packages", creatorId, checksum), { recursive: true });
    await mkdir(join(root, "data", creatorId, "workspace"), { recursive: true });
    await writeFile(
      join(root, "packages", creatorId, checksum, ".zimo-package.json"),
      JSON.stringify({ checksum, files: [], scripts: [] }),
    );
    return root;
  }

  function reader(root: string): LocalGeneratedSkillPackageReader {
    return new LocalGeneratedSkillPackageReader(root, new LocalInstructionSkillPackageReader());
  }
});
