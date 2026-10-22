import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { hashBundledModelAsset } from "./bundled-model-integrity";
import { BundledBgeEmbeddingProvider } from "./index";

const bundledModelDirectory = fileURLToPath(
  new URL("../../../../apps/desktop/resources/models/bge-small-zh-v1.5/", import.meta.url),
);

describe("bundled model integrity hashing", () => {
  it("treats JSON CRLF and LF as the same checksum", () => {
    const lf = Buffer.from('{"ok":true}\n', "utf8");
    const crlf = Buffer.from('{"ok":true}\r\n', "utf8");
    const bomCrlf = Buffer.from('\uFEFF{"ok":true}\r\n', "utf8");

    expect(hashBundledModelAsset("config.json", crlf)).toBe(
      hashBundledModelAsset("config.json", lf),
    );
    expect(hashBundledModelAsset("config.json", bomCrlf)).toBe(
      hashBundledModelAsset("config.json", lf),
    );
    expect(hashBundledModelAsset("onnx/model_quantized.onnx", crlf)).not.toBe(
      hashBundledModelAsset("onnx/model_quantized.onnx", lf),
    );
  });

  it("still rejects JSON whose canonical content changed", () => {
    const original = Buffer.from('{"ok":true}\n', "utf8");
    const tampered = Buffer.from('{"ok":false}\n', "utf8");
    expect(hashBundledModelAsset("tokenizer.json", tampered)).not.toBe(
      hashBundledModelAsset("tokenizer.json", original),
    );
  });
});

describe("BundledBgeEmbeddingProvider Windows JSON checkout", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it("accepts the bundled model after JSON files are stored as CRLF", async () => {
    const directory = await mirrorModelWithJsonNewlines("\r\n");
    const status = await new BundledBgeEmbeddingProvider(directory).getStatus();
    expect(status.status).toBe("ready");
    expect(status.errorCode).toBeUndefined();
  });

  it("rejects a JSON asset whose canonical bytes do not match", async () => {
    const directory = await mirrorModelWithJsonNewlines("\n");
    await writeFile(
      join(
        directory,
        "Xenova",
        "bge-small-zh-v1.5",
        "75c43b069aac4d136ba6bc1122f995fedcfd2781",
        "config.json",
      ),
      '{"changed":true}\n',
      "utf8",
    );
    await expect(new BundledBgeEmbeddingProvider(directory).getStatus()).resolves.toMatchObject({
      status: "failed",
      errorCode: "BUNDLED_EMBEDDING_MODEL_INVALID",
    });
  });

  async function mirrorModelWithJsonNewlines(newline: "\n" | "\r\n"): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), "zimo-bge-eol-"));
    temporaryDirectories.push(root);
    const files = [
      "zimo-model.json",
      "Xenova/bge-small-zh-v1.5/75c43b069aac4d136ba6bc1122f995fedcfd2781/config.json",
      "Xenova/bge-small-zh-v1.5/75c43b069aac4d136ba6bc1122f995fedcfd2781/tokenizer.json",
      "Xenova/bge-small-zh-v1.5/75c43b069aac4d136ba6bc1122f995fedcfd2781/tokenizer_config.json",
      "Xenova/bge-small-zh-v1.5/75c43b069aac4d136ba6bc1122f995fedcfd2781/onnx/model_quantized.onnx",
    ];
    for (const relative of files) {
      const bytes = await readFile(join(bundledModelDirectory, ...relative.split("/")));
      const payload = relative.endsWith(".json")
        ? Buffer.from(
            bytes.toString("utf8").replace(/\r\n?/g, "\n").replace(/\n/g, newline),
            "utf8",
          )
        : bytes;
      const target = join(root, ...relative.split("/"));
      await mkdir(join(target, ".."), { recursive: true });
      await writeFile(target, payload);
    }
    return root;
  }
});
