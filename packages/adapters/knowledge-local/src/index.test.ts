import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { BundledBgeEmbeddingProvider, LocalKnowledgeFileImporter } from "./index";

describe("LocalKnowledgeFileImporter", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("copies and extracts an explicitly selected UTF-8 text file", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-file-"));
    const source = join(directory, "产品说明.txt");
    const storage = join(directory, "managed");
    await writeFile(source, "产品编号 ZIMO-2026，支持本地知识检索。\n", "utf8");

    const imported = await new LocalKnowledgeFileImporter().importFile(source, storage);

    expect(imported).toMatchObject({
      name: "产品说明.txt",
      mediaType: "text/plain",
      segments: [{ text: expect.stringContaining("ZIMO-2026"), metadata: {} }],
    });
    expect(imported.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(join(storage, imported.storageKey), "utf8")).toContain("本地知识检索");
  });

  it("parses Markdown locally and preserves heading metadata", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-file-"));
    const source = join(directory, "业务手册.md");
    await writeFile(source, "# 退款规则\n\n订单创建后七天内可以申请退款。", "utf8");

    const imported = await new LocalKnowledgeFileImporter().importFile(
      source,
      join(directory, "managed"),
    );

    expect(imported.mediaType).toBe("text/markdown");
    expect(imported.segments.map((segment) => segment.text).join("\n")).toContain("七天内");
    expect(imported.segments).toContainEqual(
      expect.objectContaining({ metadata: expect.objectContaining({ heading: "退款规则" }) }),
    );
  });

  it("rejects symbolic links and unsupported executable formats", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-knowledge-file-"));
    const target = join(directory, "target.txt");
    const link = join(directory, "linked.txt");
    await writeFile(target, "secret", "utf8");
    await symlink(target, link);
    const importer = new LocalKnowledgeFileImporter();

    await expect(importer.importFile(link, join(directory, "managed"))).rejects.toMatchObject({
      code: "KNOWLEDGE_FILE_UNSAFE",
    });

    const executable = join(directory, "run.js");
    await writeFile(executable, "process.exit(0)", "utf8");
    await expect(importer.importFile(executable, join(directory, "managed"))).rejects.toMatchObject(
      { code: "KNOWLEDGE_FILE_TYPE_UNSUPPORTED" },
    );
  });
});

describe("BundledBgeEmbeddingProvider", () => {
  it("verifies and runs the packaged model without network access", async () => {
    const modelDirectory = fileURLToPath(
      new URL("../../../../apps/desktop/resources/models/bge-small-zh-v1.5/", import.meta.url),
    );
    const provider = new BundledBgeEmbeddingProvider(modelDirectory);

    await expect(provider.getStatus()).resolves.toMatchObject({
      status: "ready",
      localOnly: true,
      dimensions: 512,
    });
    const [vector] = await provider.embed(["本地知识检索"]);
    expect(vector).toHaveLength(512);
    expect(vector?.every(Number.isFinite)).toBe(true);
  });
});
