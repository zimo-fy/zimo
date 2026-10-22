import {
  access,
  chmod,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalWorkspaceDirectoryReader } from "./workspace-directory-reader";
import { LocalWorkspaceFileWriter } from "./workspace-file-writer";

describe("LocalWorkspaceFileWriter", () => {
  let root: string | null = null;
  let recoveryRoot: string | null = null;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    if (recoveryRoot) await rm(recoveryRoot, { recursive: true, force: true });
  });

  it("creates, patches and recoverably deletes an ordinary text file", async () => {
    ({ root, recoveryRoot } = await fixture());
    const writer = new LocalWorkspaceFileWriter(recoveryRoot);
    const signal = new AbortController().signal;
    const created = await writer.create(
      root,
      { path: "src/app.ts", content: "export const value = 'old';\n" },
      signal,
    );
    expect(created).toMatchObject({ path: "src/app.ts", operation: "created", changeCount: 1 });

    const patched = await writer.patch(
      root,
      {
        path: "src/app.ts",
        expectedChecksum: created.checksum!,
        operations: [{ search: "'old'", replacement: "'new'", replaceAll: false }],
      },
      signal,
    );
    expect(await readFile(join(root, "src/app.ts"), "utf8")).toBe("export const value = 'new';\n");
    expect(await readFile(join(recoveryRoot, patched.recoveryId!, "content.bin"), "utf8")).toBe(
      "export const value = 'old';\n",
    );

    const deleted = await writer.delete(
      root,
      { path: "src/app.ts", expectedChecksum: patched.checksum! },
      signal,
    );
    await expect(access(join(root, "src/app.ts"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(recoveryRoot, deleted.recoveryId!, "content.bin"), "utf8")).toBe(
      "export const value = 'new';\n",
    );
  });

  it("creates one directory level before a file, without following links or creating parents", async () => {
    ({ root, recoveryRoot } = await fixture());
    const writer = new LocalWorkspaceFileWriter(recoveryRoot);
    const signal = new AbortController().signal;
    await expect(
      writer.create(root, { path: "src/demo/index.html", content: "ok" }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    await expect(writer.createDirectory(root, { path: "src/demo" }, signal)).resolves.toEqual({
      path: "src/demo",
      operation: "directory_created",
    });
    await writer.create(root, { path: "src/demo/index.html", content: "ok" }, signal);
    expect(await readFile(join(root, "src/demo/index.html"), "utf8")).toBe("ok");
    await expect(writer.createDirectory(root, { path: "src/demo" }, signal)).rejects.toMatchObject({
      code: "WORKSPACE_PATH_INVALID",
    });
    await expect(
      writer.createDirectory(root, { path: "src/missing/deep" }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    const outside = await mkdtemp(join(tmpdir(), "zimo-writer-outside-"));
    try {
      await symlink(outside, join(root, "src/linked"));
      await expect(
        writer.createDirectory(root, { path: "src/linked/child" }, signal),
      ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
    const controller = new AbortController();
    controller.abort();
    await expect(
      writer.createDirectory(root, { path: "src/cancelled" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("rejects stale, ambiguous, protected and linked targets without changing content", async () => {
    ({ root, recoveryRoot } = await fixture());
    const target = join(root, "src/app.ts");
    await writeFile(target, "same same\n", "utf8");
    const reader = new LocalWorkspaceDirectoryReader();
    const read = await reader.read(
      root,
      { path: "src/app.ts", cursor: 0, maxCharacters: 500 },
      new AbortController().signal,
    );
    const writer = new LocalWorkspaceFileWriter(recoveryRoot);
    const signal = new AbortController().signal;

    await expect(
      writer.patch(
        root,
        {
          path: "src/app.ts",
          expectedChecksum: "b".repeat(64),
          operations: [{ search: "same", replacement: "new", replaceAll: false }],
        },
        signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_FILE_STALE" });
    await expect(
      writer.patch(
        root,
        {
          path: "src/app.ts",
          expectedChecksum: read.checksum,
          operations: [{ search: "same", replacement: "new", replaceAll: false }],
        },
        signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATCH_MISMATCH" });
    expect(await readFile(target, "utf8")).toBe("same same\n");

    await expect(
      writer.create(root, { path: ".env", content: "SECRET=value" }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_SENSITIVE_FILE_DENIED" });
    await link(target, join(root, "src/hardlink.ts"));
    await expect(
      writer.delete(root, { path: "src/app.ts", expectedChecksum: read.checksum }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
  });

  it("rejects symlinks, executable files and mutation budgets", async () => {
    ({ root, recoveryRoot } = await fixture());
    const outside = await mkdtemp(join(tmpdir(), "zimo-writer-outside-"));
    const outsideFile = join(outside, "outside.ts");
    await writeFile(outsideFile, "outside\n", "utf8");
    await symlink(outsideFile, join(root, "src/link.ts"));
    const executable = join(root, "src/run.sh");
    await writeFile(executable, "echo safe\n", "utf8");
    await chmod(executable, 0o700);
    const writer = new LocalWorkspaceFileWriter(recoveryRoot);
    const signal = new AbortController().signal;

    await expect(
      writer.patch(
        root,
        {
          path: "src/link.ts",
          expectedChecksum: "a".repeat(64),
          operations: [{ search: "outside", replacement: "inside", replaceAll: false }],
        },
        signal,
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    await expect(
      writer.delete(root, { path: "src/run.sh", expectedChecksum: "a".repeat(64) }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_PATH_INVALID" });
    await expect(
      writer.create(root, { path: "src/large.txt", content: "line\n".repeat(1_001) }, signal),
    ).rejects.toMatchObject({ code: "WORKSPACE_MUTATION_LIMIT" });
    await rm(outside, { recursive: true, force: true });
  });

  it("does not create a file when the operation is already cancelled", async () => {
    ({ root, recoveryRoot } = await fixture());
    const writer = new LocalWorkspaceFileWriter(recoveryRoot);
    const controller = new AbortController();
    controller.abort();

    await expect(
      writer.create(root, { path: "src/cancelled.ts", content: "cancelled\n" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(access(join(root, "src/cancelled.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function fixture(): Promise<{ root: string; recoveryRoot: string }> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "zimo-writer-")));
  const recoveryRoot = await realpath(await mkdtemp(join(tmpdir(), "zimo-writer-recovery-")));
  await mkdir(join(root, "src"));
  return { root, recoveryRoot };
}
