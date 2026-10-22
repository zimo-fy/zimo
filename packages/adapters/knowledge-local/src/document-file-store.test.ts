import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalDocumentContentAdapter } from "./document-content-adapter";
import { LocalDocumentFileStore } from "./document-file-store";

const IDS = {
  conversationId: "11111111-1111-4111-8111-111111111111",
  artifactId: "22222222-2222-4222-8222-222222222222",
  revisionId: "33333333-3333-4333-8333-333333333333",
};

describe("LocalDocumentFileStore", () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("imports an OOXML document into the managed workspace and exports a copy", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const source = join(directory, "季度报告.docx");
    const bytes = minimalOoxmlArchive("word/document.xml");
    await writeFile(source, bytes);
    const store = new LocalDocumentFileStore(join(directory, "managed"));

    const imported = await store.importFile({ sourcePath: source, ...IDS });
    const exported = join(directory, "exported.docx");
    await store.exportFile(imported.storageKey, exported);

    expect(imported).toMatchObject({ displayName: "季度报告.docx", format: "docx" });
    expect(imported.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(exported)).toEqual(bytes);
  });

  it("rejects extension spoofing and symbolic links", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const fakePdf = join(directory, "fake.pdf");
    await writeFile(fakePdf, "not a pdf");
    const link = join(directory, "linked.pdf");
    await symlink(fakePdf, link);
    const store = new LocalDocumentFileStore(join(directory, "managed"));

    await expect(store.importFile({ sourcePath: fakePdf, ...IDS })).rejects.toMatchObject({
      code: "DOCUMENT_INVALID",
    });
    await expect(store.importFile({ sourcePath: link, ...IDS })).rejects.toMatchObject({
      code: "DOCUMENT_INVALID",
    });
  });

  it("imports utf-8 text and json attachments", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const store = new LocalDocumentFileStore(join(directory, "managed"));
    const notes = join(directory, "notes.md");
    const payload = join(directory, "payload.json");
    await writeFile(notes, "# 纪要\n正文");
    await writeFile(payload, '{"ok":true}');

    await expect(store.importFile({ sourcePath: notes, ...IDS })).resolves.toMatchObject({
      format: "md",
      displayName: "notes.md",
    });
    await expect(
      store.importFile({
        sourcePath: payload,
        ...IDS,
        artifactId: "44444444-4444-4444-8444-444444444444",
        revisionId: "55555555-5555-4555-8555-555555555555",
      }),
    ).resolves.toMatchObject({ format: "json" });
  });

  it("imports png and jpeg images after signature checks", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const store = new LocalDocumentFileStore(join(directory, "managed"));
    const png = join(directory, "dot.png");
    const jpeg = join(directory, "dot.jpg");
    const spoofed = join(directory, "fake.png");
    await writeFile(png, MINIMAL_PNG);
    await writeFile(jpeg, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
    await writeFile(spoofed, "not an image");

    await expect(store.importFile({ sourcePath: png, ...IDS })).resolves.toMatchObject({
      format: "png",
      mediaType: "image/png",
    });
    await expect(
      store.importFile({
        sourcePath: jpeg,
        ...IDS,
        artifactId: "44444444-4444-4444-8444-444444444444",
        revisionId: "55555555-5555-4555-8555-555555555555",
      }),
    ).resolves.toMatchObject({ format: "jpeg", mediaType: "image/jpeg" });
    await expect(
      store.importFile({
        sourcePath: spoofed,
        ...IDS,
        artifactId: "66666666-6666-4666-8666-666666666666",
        revisionId: "77777777-7777-4777-8777-777777777777",
      }),
    ).rejects.toMatchObject({ code: "DOCUMENT_INVALID" });
  });

  it("rejects executables and generic zip archives", async () => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const store = new LocalDocumentFileStore(join(directory, "managed"));
    const executable = join(directory, "setup.exe");
    const archive = join(directory, "bundle.zip");
    await writeFile(executable, Buffer.from([0x4d, 0x5a, 0x90, 0x00]));
    await writeFile(archive, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));

    await expect(store.importFile({ sourcePath: executable, ...IDS })).rejects.toMatchObject({
      code: "DOCUMENT_FORMAT_UNSUPPORTED",
    });
    await expect(store.importFile({ sourcePath: archive, ...IDS })).rejects.toMatchObject({
      code: "DOCUMENT_FORMAT_UNSUPPORTED",
    });
  });

  it.each(["docx", "xlsx", "pptx"] as const)("accepts a generated %s archive", async (format) => {
    directory = await mkdtemp(join(tmpdir(), "zimo-document-"));
    const store = new LocalDocumentFileStore(join(directory, "managed"));
    const bytes = await new LocalDocumentContentAdapter().create(
      format,
      {
        title: "测试文档",
        paragraphs: ["中文内容"],
        rows: [["项目", "值"]],
        slides: [{ title: "首页", body: "中文内容" }],
      },
      new AbortController().signal,
    );

    await expect(store.writeFile({ bytes, format, ...IDS })).resolves.toMatchObject({ format });
  });
});

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function minimalOoxmlArchive(documentEntry: string): Buffer {
  const prefix = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const entries = [centralEntry("[Content_Types].xml"), centralEntry(documentEntry)];
  const centralSize = entries.reduce((size, entry) => size + entry.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(prefix.length, 16);
  return Buffer.concat([prefix, ...entries, end]);
}

function centralEntry(name: string): Buffer {
  const encoded = Buffer.from(name);
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt32LE(1, 20);
  header.writeUInt32LE(1, 24);
  header.writeUInt16LE(encoded.length, 28);
  return Buffer.concat([header, encoded]);
}
