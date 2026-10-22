import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalInstructionSkillPackageReader, LocalSkillPackageRuntime } from "./index";

describe("LocalInstructionSkillPackageReader", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    directories.length = 0;
  });

  it("uses supported metadata from a manifest when present", async () => {
    const directory = await packageDirectory({});
    const value = await new LocalInstructionSkillPackageReader().readFromDirectory(directory);
    expect(value).toMatchObject({
      packageId: "local.example.summary",
      name: "本地摘要",
      version: "1.0.0",
      permissions: ["context:user-input"],
      instructions: "# 摘要\n\n仅总结用户提供的内容。",
    });
    expect(value.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(value.files.map((file) => file.path)).toEqual(["manifest.json", "SKILL.md"]);
  });

  it("installs a SKILL.md-only folder with generated local metadata", async () => {
    const directory = await packageDirectory({});
    await rm(join(directory, "manifest.json"));
    await writeFile(
      join(directory, "SKILL.md"),
      "---\nname: 日程管理\ndescription: 管理本地日程\ncategory: 效率\n---\n\n# 日程\n\n记录安排。\n",
    );

    const value = await new LocalInstructionSkillPackageReader().readFromDirectory(directory);

    expect(value).toMatchObject({
      packageId: expect.stringMatching(/^local\.skill\.[a-f0-9]{24}$/),
      name: "日程管理",
      version: "1.0.0",
      description: "管理本地日程",
      category: "效率",
      tags: [],
      permissions: ["context:user-input"],
    });
    expect(value.files.map((file) => file.path)).toEqual(["SKILL.md"]);
  });

  it("ignores malformed and unknown manifest fields instead of rejecting installation", async () => {
    const directory = await packageDirectory({ command: "node install.js" });
    const reader = new LocalInstructionSkillPackageReader();
    await expect(reader.readFromDirectory(directory)).resolves.toMatchObject({
      packageId: "local.example.summary",
      name: "本地摘要",
    });

    await writeFile(join(directory, "manifest.json"), "not json");
    await expect(reader.readFromDirectory(directory)).resolves.toMatchObject({
      packageId: expect.stringMatching(/^local\.skill\.[a-f0-9]{24}$/),
      name: "摘要",
      category: "本地",
    });
  });

  it("preserves the explicit local-install permission only for runtime authorization", async () => {
    const directory = await packageDirectory({
      permissions: ["context:user-input", "skill:local-install", "unknown:permission"],
    });

    const value = await new LocalInstructionSkillPackageReader().readFromDirectory(directory);

    expect(value.permissions).toEqual(["context:user-input", "skill:local-install"]);
  });

  it("rejects an entry symlink that escapes the selected directory", async () => {
    const directory = await packageDirectory({});
    const outside = await mkdtemp(join(tmpdir(), "zimo-skill-outside-"));
    directories.push(outside);
    await writeFile(join(outside, "outside.md"), "outside");
    await rm(join(directory, "SKILL.md"));
    await symlink(join(outside, "outside.md"), join(directory, "SKILL.md"));
    await expect(
      new LocalInstructionSkillPackageReader().readFromDirectory(directory),
    ).rejects.toMatchObject({ code: "SKILL_PACKAGE_INVALID" });
  });

  async function packageDirectory(extraManifest: Record<string, unknown>) {
    const directory = await mkdtemp(join(tmpdir(), "zimo-skill-package-"));
    directories.push(directory);
    await mkdir(join(directory, "resources"));
    await writeFile(
      join(directory, "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        kind: "instruction",
        packageId: "local.example.summary",
        name: "本地摘要",
        version: "1.0.0",
        description: "安全的本地指令 Skill",
        category: "写作",
        tags: ["摘要"],
        permissions: ["context:user-input"],
        entry: "SKILL.md",
        ...extraManifest,
      }),
    );
    await writeFile(join(directory, "SKILL.md"), "# 摘要\n\n仅总结用户提供的内容。\n");
    return directory;
  }
});

describe("LocalSkillPackageRuntime", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
    directories.length = 0;
  });

  it("installs and executes a declared Node script without a shell", async () => {
    const root = await mkdtemp(join(tmpdir(), "zimo-skill-runtime-"));
    directories.push(root);
    const runtime = new LocalSkillPackageRuntime(root);
    const checksum = "a".repeat(64);
    const scripts = await runtime.install("skill-1", {
      packageId: "local.example.runtime",
      name: "运行测试",
      version: "1.0.0",
      description: "",
      category: "测试",
      tags: [],
      permissions: [],
      instructions: "运行脚本。",
      checksum,
      files: [
        { path: "SKILL.md", content: new TextEncoder().encode("运行脚本。") },
        {
          path: "scripts/run.cjs",
          content: new TextEncoder().encode("console.log(JSON.stringify(process.argv.slice(2)))"),
        },
      ],
    });

    const result = await runtime.execute(
      {
        skillId: "skill-1",
        checksum,
        scriptPath: "scripts/run.cjs",
        arguments: ["create", "下午 5:30 开会"],
      },
      new AbortController().signal,
    );

    expect(scripts).toEqual(["scripts/run.cjs"]);
    expect(JSON.parse(result.stdout)).toEqual(["create", "下午 5:30 开会"]);
  });

  it("rejects a script path that is not in the installed manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "zimo-skill-runtime-"));
    directories.push(root);
    const runtime = new LocalSkillPackageRuntime(root);
    await expect(
      runtime.execute(
        {
          skillId: "skill-1",
          checksum: "b".repeat(64),
          scriptPath: "../../outside.py",
          arguments: [],
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "SKILL_PACKAGE_STORAGE_FAILED" });
  });

  it("reads only allowlisted text resources from the installed package", async () => {
    const root = await mkdtemp(join(tmpdir(), "zimo-skill-runtime-"));
    directories.push(root);
    const runtime = new LocalSkillPackageRuntime(root);
    const checksum = "c".repeat(64);
    await runtime.install("skill-1", {
      packageId: "local.example.resources",
      name: "资源测试",
      version: "1.0.0",
      description: "",
      category: "测试",
      tags: [],
      permissions: [],
      instructions: "读取任务规范。",
      checksum,
      files: [
        { path: "SKILL.md", content: new TextEncoder().encode("读取任务规范。") },
        {
          path: "tasks/recommend.md",
          content: new TextEncoder().encode("# 推荐候选人\n"),
        },
        {
          path: "scripts/run.mjs",
          content: new TextEncoder().encode("console.log('ok')"),
        },
      ],
    });

    await expect(runtime.listResources("skill-1", checksum)).resolves.toEqual([
      "tasks/recommend.md",
    ]);
    await expect(runtime.readResource("skill-1", checksum, "tasks/recommend.md")).resolves.toBe(
      "# 推荐候选人\n",
    );
    await expect(runtime.readResource("skill-1", checksum, "../SKILL.md")).rejects.toMatchObject({
      code: "SKILL_PACKAGE_INVALID",
    });
    await expect(
      runtime.readResource("skill-1", checksum, "scripts/run.mjs"),
    ).rejects.toMatchObject({ code: "SKILL_RESOURCE_NOT_ALLOWED" });
  });
});
