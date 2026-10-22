import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import electronPath from "electron";

import { loginTestUser, startAuthTestServer, type AuthTestServer } from "./auth-test-server";

const shotDirectory = resolve("apps/website/public/screenshots/features");

let application: ElectronApplication;
let page: Page;
let userDataDirectory: string;
let skillPackageDirectory: string;
let knowledgeFilePath: string;
let authServer: AuthTestServer;

test.describe.configure({ timeout: 180_000 });

test.beforeAll(async () => {
  authServer = await startAuthTestServer();
  await mkdir(shotDirectory, { recursive: true });
});

test.afterAll(async () => {
  await authServer.close();
});

test.beforeEach(async () => {
  userDataDirectory = await mkdtemp(join(tmpdir(), "zimo-website-shots-"));
  skillPackageDirectory = await mkdtemp(join(tmpdir(), "zimo-skill-shots-"));
  await writeFile(
    join(skillPackageDirectory, "SKILL.md"),
    "---\nname: E2E 本地摘要\ndescription: 端到端安装验证\ncategory: 测试\n---\n\n# E2E 摘要\n\n只总结输入。\n",
  );
  knowledgeFilePath = join(skillPackageDirectory, "产品说明.md");
  await writeFile(
    knowledgeFilePath,
    "# 产品编号\n\nZimo 企业版支持本地知识检索。产品编号 ZIMO-KB-2026，默认采用全文检索。\n",
  );
  application = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [resolve("apps/desktop"), `--user-data-dir=${userDataDirectory}`],
    env: {
      ...process.env,
      ZIMO_DISABLE_LOCAL_EMBEDDINGS: "1",
      ZIMO_AUTH_BASE_URL: authServer.baseUrl,
    },
  });
  page = await application.firstWindow();
  const browserWindow = await application.browserWindow(page);
  await browserWindow.evaluate((win) => {
    win.setContentSize(1440, 900);
  });
  await loginTestUser(page);
  await expect(page.getByRole("heading", { name: "今天想聊些什么？" })).toBeVisible();
});

test.afterEach(async () => {
  await application?.close();
  await rm(userDataDirectory, { recursive: true, force: true });
  await rm(skillPackageDirectory, { recursive: true, force: true });
});

test("captures isolated desktop screenshots for website feature steps", async () => {
  await capture("tasks-01");
  await page.getByLabel("消息", { exact: true }).fill("整理本周工作进展");
  await capture("tasks-02");
  await page.getByRole("button", { name: "添加对话能力" }).click();
  await expect(page.getByText("添加到当前对话", { exact: true })).toBeVisible();
  await capture("tasks-03");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible();
  await capture("agents-01");
  await page.getByRole("button", { name: "新建 Agent" }).click();
  await expect(page.getByLabel("名称")).toBeVisible();
  await capture("agents-02");
  await page.getByRole("button", { name: /返回Agents列表/ }).click();
  await page
    .locator("article", { hasText: "研究助手" })
    .getByRole("button", { name: "编辑" })
    .click();
  await capture("agents-03");
  await page.getByRole("button", { name: /返回Agents列表/ }).click();

  await page.getByRole("button", { name: "Skill", exact: true }).click();
  await expect(page.getByText("云端招聘助手", { exact: true })).toBeVisible();
  await capture("skills-01");
  await page.getByRole("button", { name: "从本地文件夹安装" }).scrollIntoViewIfNeeded();
  await capture("skills-02");
  await application.evaluate(({ dialog }, directory) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, skillPackageDirectory);
  await page.getByRole("button", { name: "从本地文件夹安装" }).click();
  await expect(page.getByText("E2E 本地摘要", { exact: true }).first()).toBeVisible();
  await capture("skills-03");

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "知识库", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await capture("knowledge-01");
  await page
    .locator("article", { hasText: "产品资料库" })
    .getByRole("button", { name: "文档" })
    .click();
  await application.evaluate(({ dialog }, filePath) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, knowledgeFilePath);
  await page.getByRole("button", { name: "选择文件" }).click();
  await expect(page.getByText("产品说明.md", { exact: true })).toBeVisible();
  await capture("knowledge-02");
  await page.getByLabel("检索问题").fill("产品编号");
  await page.getByRole("button", { name: "检索", exact: true }).click();
  await expect(page.getByText(/ZIMO-KB-2026/)).toBeVisible();
  await capture("knowledge-03");

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "工作流", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await capture("workflow-01");
  await page
    .locator("article", { hasText: "研究审核流" })
    .getByRole("button", { name: "编排" })
    .click();
  await page.getByRole("button", { name: "打开工作流编辑器" }).click();
  await expect(page.getByRole("dialog", { name: /研究审核流工作流编辑器/ })).toBeVisible();
  await capture("workflow-02");
  await page.getByRole("button", { name: "返回工作流详情" }).click();
  await capture("workflow-03");

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "通信渠道", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await capture("channels-01");
  await page.getByRole("button", { name: "扫码绑定", exact: true }).click();
  await expect(page.getByRole("heading", { name: "绑定个人微信 Clawbot" })).toBeVisible();
  await capture("channels-02");
  await page.getByRole("button", { name: "返回通信渠道" }).click();
  await page.getByRole("button", { name: "添加邮箱", exact: true }).click();
  await expect(page.getByLabel("邮箱地址")).toBeVisible();
  await capture("channels-03");

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "MCP", exact: true }).click();
  await expect(page.getByRole("heading", { name: "MCP 服务" })).toBeVisible();
  await capture("mcp-01");
  await page.getByRole("button", { name: "新增 MCP" }).click();
  await expect(page.getByRole("heading", { name: "新增 MCP" })).toBeVisible();
  await capture("mcp-02");
  await page.getByRole("button", { name: "返回 MCP 服务" }).click();
  await page.getByRole("button", { name: "编辑GitHub" }).click();
  await expect(page.getByRole("button", { name: "连接并授权" })).toBeVisible();
  await capture("mcp-03");

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "自动化", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await capture("automation-01");
  await page.getByRole("button", { name: "新建 Automation" }).click();
  await expect(page.getByLabel("名称")).toBeVisible();
  await capture("automation-02");
  await page.getByLabel("自动化计划类型").click();
  await page.getByRole("menuitem", { name: "固定间隔" }).click();
  await capture("automation-03");

  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await expect(page.getByRole("menuitem", { name: "设置" })).toBeVisible();
  await capture("settings-01");
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await capture("settings-02");
  await page.getByRole("button", { name: "测试连接" }).first().scrollIntoViewIfNeeded();
  await capture("settings-03");
});

async function capture(name: string): Promise<void> {
  await page.waitForTimeout(350);
  await page.screenshot({
    path: join(shotDirectory, `${name}.png`),
    type: "png",
    animations: "disabled",
  });
}

async function openToolsNavigation(): Promise<void> {
  const trigger = page.getByRole("button", { name: "工具", exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}
