import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalWorkspaceDirectoryReader } from "./workspace-directory-reader";
import { LocalWorkspaceFileWriter } from "./workspace-file-writer";

describe("LocalWorkspaceDirectoryReader", () => {
  let root: string | null = null;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("lists, searches and pages ordinary project files", async () => {
    root = await mkdtemp(join(tmpdir(), "zimo-workspace-"));
    await mkdir(join(root, "src"));
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "src", "app.ts"), "export const greeting = '你好';\n");
    await writeFile(join(root, ".env"), "TOKEN=must-not-read\n");
    await writeFile(join(root, "node_modules", "hidden.js"), "secret\n");
    const reader = new LocalWorkspaceDirectoryReader();
    const inspected = await reader.inspectRoot(root);

    const listing = await reader.list(
      inspected.rootRef,
      { path: "", cursor: 0, limit: 10 },
      new AbortController().signal,
    );
    expect(listing.entries).toEqual([{ path: "src", name: "src", kind: "directory" }]);

    const search = await reader.search(
      inspected.rootRef,
      { query: "greeting", pattern: "**/*.ts", limit: 10 },
      new AbortController().signal,
    );
    expect(search.matches).toEqual(
      expect.arrayContaining([
        { path: "src/app.ts" },
        { path: "src/app.ts", lineNumber: 1, preview: "export const greeting = '你好';" },
      ]),
    );

    const first = await reader.read(
      inspected.rootRef,
      { path: "src/app.ts", cursor: 0, maxCharacters: 10 },
      new AbortController().signal,
    );
    expect(first.content).toHaveLength(10);
    expect(first.nextCursor).toBe(10);
    expect(first.truncated).toBe(true);
  });

  it("rejects traversal, protected files and symlink escape", async () => {
    root = await mkdtemp(join(tmpdir(), "zimo-workspace-"));
    const outside = await mkdtemp(join(tmpdir(), "zimo-workspace-outside-"));
    await writeFile(join(root, ".env"), "TOKEN=must-not-read\n");
    await writeFile(join(outside, "outside.txt"), "outside\n");
    await symlink(join(outside, "outside.txt"), join(root, "link.txt"));
    const reader = new LocalWorkspaceDirectoryReader();
    const inspected = await reader.inspectRoot(root);
    const signal = new AbortController().signal;

    await expect(
      reader.read(
        inspected.rootRef,
        { path: "../outside.txt", cursor: 0, maxCharacters: 500 },
        signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    await expect(
      reader.read(inspected.rootRef, { path: ".env", cursor: 0, maxCharacters: 500 }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_SENSITIVE_FILE_DENIED" });
    await expect(
      reader.read(inspected.rootRef, { path: "link.txt", cursor: 0, maxCharacters: 500 }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });

    await rm(outside, { recursive: true, force: true });
  });

  it("rejects a granted root replaced by a symlink", async () => {
    root = await mkdtemp(join(tmpdir(), "zimo-workspace-"));
    const outside = await mkdtemp(join(tmpdir(), "zimo-workspace-outside-"));
    await writeFile(join(outside, "outside.txt"), "outside\n");
    const reader = new LocalWorkspaceDirectoryReader();
    const inspected = await reader.inspectRoot(root);
    await rm(root, { recursive: true, force: true });
    await symlink(outside, root, "dir");

    await expect(
      reader.search(
        inspected.rootRef,
        { query: "outside", limit: 10 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_UNAVAILABLE" });

    await rm(outside, { recursive: true, force: true });
  });

  it("reads an unbound absolute path but rejects Zimo internal roots", async () => {
    root = await mkdtemp(join(tmpdir(), "zimo-workspace-"));
    const internal = await mkdtemp(join(tmpdir(), "zimo-internal-"));
    await writeFile(join(root, "notes.txt"), "outside workspace\n");
    await writeFile(join(internal, "zimo.sqlite"), "private\n");
    const reader = new LocalWorkspaceDirectoryReader([internal]);
    const expectedPath = await realpath(join(root, "notes.txt"));

    await expect(
      reader.readAbsolute(
        join(root, "notes.txt"),
        { cursor: 0, maxCharacters: 500 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ content: "outside workspace\n", path: expectedPath });
    await expect(
      reader.readAbsolute(
        join(internal, "zimo.sqlite"),
        { cursor: 0, maxCharacters: 500 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "ZIMO_INTERNAL_PATH_DENIED" });

    await rm(internal, { recursive: true, force: true });
  });

  it("resolves an absolute directory creation before creating its first file", async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), "zimo-workspace-")));
    const reader = new LocalWorkspaceDirectoryReader();
    const writer = new LocalWorkspaceFileWriter(root);
    const signal = new AbortController().signal;
    await expect(
      reader.resolveAbsoluteWriteTarget(join(root, "demo", "index.html"), [root]),
    ).rejects.toMatchObject({
      code: "WORKSPACE_PATH_INVALID",
      userMessage: "目标父目录不存在或是符号链接；请先逐级创建目录。",
    });
    const directory = await reader.resolveAbsoluteWriteTarget(join(root, "demo"), [root]);
    expect(directory).toMatchObject({ rootRef: root, relativePath: "demo" });
    await writer.createDirectory(root, { path: directory.relativePath }, signal);
    const file = await reader.resolveAbsoluteWriteTarget(join(root, "demo", "index.html"), [root]);
    await writer.create(root, { path: file.relativePath, content: "<h1>OK</h1>" }, signal);
    expect(await readFile(join(root, "demo", "index.html"), "utf8")).toBe("<h1>OK</h1>");
  });
});
