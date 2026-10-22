import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

import { _electron as electron } from "@playwright/test";

const executablePath = resolve(
  process.argv[2] ?? "apps/desktop/release/mac/Zimo.app/Contents/MacOS/Zimo",
);
const userDataDirectory = await mkdtemp(join(tmpdir(), "zimo-packaged-smoke-"));
const fixturePath = join(userDataDirectory, "embedding-smoke.md");
let application;

try {
  await writeFile(
    fixturePath,
    "# 打包验证\n\nZimo 打包态本地向量模型验证编号 PACKAGED-EMBEDDING-512。\n",
  );
  application = await electron.launch({
    executablePath,
    args: [`--user-data-dir=${userDataDirectory}`],
  });
  const page = await application.firstWindow();
  const smokeUsername = process.env.ZIMO_SMOKE_USERNAME;
  const smokePassword = process.env.ZIMO_SMOKE_PASSWORD;
  if (!smokeUsername || !smokePassword) {
    await page.getByLabel("员工账号 ID / 手机号").waitFor();
    process.stdout.write(
      "PACKAGED_AUTH_READY=1\nPACKAGED_EMBEDDING_SKIPPED=missing-smoke-credentials\n",
    );
  } else {
    await page.getByLabel("员工账号 ID / 手机号").fill(smokeUsername);
    await page.getByLabel("登录密码").fill(smokePassword);
    await page.getByRole("button", { name: "进入 Zimo" }).click();
    await page.getByRole("button", { name: "知识库", exact: true }).click();
    await page.getByRole("button", { name: /产品资料库/ }).click();
    await application.evaluate(({ dialog }, filePath) => {
      const mutableDialog = dialog;
      mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
    }, fixturePath);
    await page.getByRole("button", { name: "选择文件" }).click();
    await page.getByText("embedding-smoke.md", { exact: true }).waitFor();
    await application.close();
    application = undefined;

    const database = new DatabaseSync(join(userDataDirectory, "accounts", "local", "zimo.sqlite"), {
      readOnly: true,
    });
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM knowledge_chunks WHERE embedding_blob IS NOT NULL")
      .get();
    database.close();
    if (!row || Number(row.count) < 1) {
      throw new Error("Packaged application did not persist a knowledge embedding.");
    }
    process.stdout.write(`PACKAGED_EMBEDDING_ROWS=${row.count}\n`);
  }
} finally {
  await application?.close();
  await rm(userDataDirectory, { recursive: true, force: true });
}
