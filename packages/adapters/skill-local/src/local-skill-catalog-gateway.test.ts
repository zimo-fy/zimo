import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { LocalSkillCatalogGateway } from "./local-skill-catalog-gateway";
import { LocalInstructionSkillPackageReader, readInstructionSkillIdentity } from "./index";

describe("LocalSkillCatalogGateway", () => {
  const directories: string[] = [];
  const reader = new LocalInstructionSkillPackageReader();

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("lists direct skill folders and reads the same folder on install", async () => {
    const root = await createRoot();
    await writeSkill(root, "recruiting", "招聘助手", "人力资源");
    await writeSkill(root, "notes", "笔记整理", "效率");
    await mkdir(join(root, "recruiting", "references", "extra"), { recursive: true });
    await writeFile(join(root, "recruiting", "references", "extra", "SKILL.md"), "# 嵌套\n");
    await mkdir(join(root, "ignored"));
    const gateway = createGateway(root);

    const listed = await gateway.list(new AbortController().signal);

    expect(listed.map((item) => item.name)).toEqual(
      ["笔记整理", "招聘助手"].sort((left, right) => left.localeCompare(right, "zh-CN")),
    );
    const recruiting = listed.find((item) => item.catalogId === "recruiting");
    expect(recruiting).toMatchObject({
      name: "招聘助手",
      category: "人力资源",
      packageId: "local.recruiting",
      downloadUrl: "",
    });
    const installed = await gateway.download(recruiting!, new AbortController().signal);
    expect(installed).toMatchObject({
      packageId: "local.recruiting",
      name: "招聘助手",
    });
    expect(installed.instructions).toContain("# 招聘助手");
    expect(installed.files.map((file) => file.path)).toContain("SKILL.md");
  });

  it("rejects a catalog id that leaves the skill directory", async () => {
    const gateway = createGateway(await createRoot());
    await expect(
      gateway.download(
        {
          catalogId: "../outside",
          packageId: "local.outside",
          name: "外部",
          description: "",
          category: "本地",
          version: "1.0.0",
          source: "本地 Skill 目录",
          downloadUrl: "",
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "SKILL_CATALOG_UNAVAILABLE" });
  });

  it("does not follow a symlinked skill folder", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    await writeSkill(outside, "secret", "外部技能", "本地");
    await symlink(
      join(outside, "secret"),
      join(root, "secret"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const listed = await createGateway(root).list(new AbortController().signal);
    expect(listed).toEqual([]);
  });

  it("stops when the list operation is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(createGateway(await createRoot()).list(controller.signal)).rejects.toMatchObject({
      code: "SKILL_OPERATION_CANCELLED",
    });
  });

  it("reads the repository skill directory without calling a catalog service", async () => {
    const root = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../apps/desktop/resources/skills",
    );
    const listed = await createGateway(root).list(new AbortController().signal);
    expect(listed.some((item) => item.catalogId === "boss-zhipin")).toBe(true);
    expect(listed.every((item) => item.downloadUrl === "")).toBe(true);
  });

  it("reports a missing skill directory without exposing its path", async () => {
    const missing = join(await createRoot(), "missing");
    await expect(createGateway(missing).list(new AbortController().signal)).rejects.toMatchObject({
      code: "SKILL_CATALOG_UNAVAILABLE",
      userMessage: "找不到本地 Skill 目录。",
    });
  });

  function createGateway(root: string): LocalSkillCatalogGateway {
    return new LocalSkillCatalogGateway(root, reader, readInstructionSkillIdentity);
  }

  async function createRoot(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "zimo-skill-catalog-"));
    directories.push(directory);
    return directory;
  }
});

async function writeSkill(
  root: string,
  name: string,
  title: string,
  category: string,
): Promise<void> {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "SKILL.md"),
    `---\npackageId: local.${name}\nname: ${title}\nversion: 1.2.0\ndescription: ${title}\ncategory: ${category}\n---\n\n# ${title}\n\n筛选候选人。\n`,
  );
}
