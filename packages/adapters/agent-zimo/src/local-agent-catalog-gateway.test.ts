import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { LocalAgentCatalogGateway } from "./local-agent-catalog-gateway";

describe("LocalAgentCatalogGateway", () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("lists direct agent folders and installs the same instructions", async () => {
    const root = await createRoot();
    await writeAgent(root, "recruiting", "招聘协调助手", "人力资源");
    await writeAgent(root, "writing", "文稿编辑", "写作");
    await mkdir(join(root, "notes"));
    const gateway = new LocalAgentCatalogGateway(root);

    const listed = await gateway.list(new AbortController().signal);

    expect(listed.map((item) => item.catalogId).sort()).toEqual(["recruiting", "writing"]);
    const recruiting = listed.find((item) => item.catalogId === "recruiting")!;
    const installed = await gateway.provision(recruiting, "local-id", new AbortController().signal);
    expect(installed.remoteAgentId).toBe("recruiting");
    expect(installed.systemPrompt).toContain("只依据用户提供的材料");
  });

  it("rejects a catalog id that leaves the agent directory", async () => {
    const gateway = new LocalAgentCatalogGateway(await createRoot());
    await expect(
      gateway.provision(
        {
          catalogId: "../outside",
          name: "外部",
          description: "",
          category: "本地",
          icon: "外",
          version: "1.0.0",
        },
        "local-id",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "AGENT_CATALOG_UNAVAILABLE" });
  });

  it("does not follow a symlinked agent folder", async () => {
    const root = await createRoot();
    const outside = await createRoot();
    await writeAgent(outside, "secret", "外部助手", "本地");
    await symlink(
      join(outside, "secret"),
      join(root, "secret"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      new LocalAgentCatalogGateway(root).list(new AbortController().signal),
    ).resolves.toEqual([]);
  });

  it("stops when the operation is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new LocalAgentCatalogGateway(await createRoot()).list(controller.signal),
    ).rejects.toMatchObject({ code: "AGENT_OPERATION_CANCELLED" });
  });

  it("reads the repository agent directory", async () => {
    const root = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../apps/desktop/resources/agents",
    );
    const listed = await new LocalAgentCatalogGateway(root).list(new AbortController().signal);
    expect(listed.map((item) => item.name)).toEqual(
      ["招聘协调助手", "文稿编辑", "资料研究助手"].sort((left, right) =>
        left.localeCompare(right, "zh-CN"),
      ),
    );
  });

  it("reports a missing directory without exposing its path", async () => {
    const missing = join(await createRoot(), "missing");
    await expect(
      new LocalAgentCatalogGateway(missing).list(new AbortController().signal),
    ).rejects.toMatchObject({
      code: "AGENT_CATALOG_UNAVAILABLE",
      userMessage: "找不到本地 Agent 目录。",
    });
  });

  async function createRoot(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "zimo-agent-catalog-"));
    directories.push(directory);
    return directory;
  }
});

async function writeAgent(
  root: string,
  name: string,
  title: string,
  category: string,
): Promise<void> {
  const directory = join(root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "AGENT.md"),
    `---\nname: ${title}\ncategory: ${category}\nversion: 1.0.0\ndescription: ${title}\nicon: 助\n---\n\n只依据用户提供的材料。\n`,
  );
}
