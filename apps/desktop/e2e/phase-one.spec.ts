import { mkdtemp, rm } from "node:fs/promises";
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

import { startAuthTestServer, type AuthTestServer } from "./auth-test-server";
import { completeModelOnboarding } from "./onboarding";

let application: ElectronApplication;
let page: Page;
let userDataDirectory: string;
let authServer: AuthTestServer;

test.beforeAll(async () => {
  authServer = await startAuthTestServer();
});

test.afterAll(async () => {
  await authServer.close();
});

test.beforeEach(async () => {
  userDataDirectory = await mkdtemp(join(tmpdir(), "zimo-e2e-"));
  application = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [resolve("apps/desktop"), `--user-data-dir=${userDataDirectory}`],
    env: { ...process.env, ZIMO_AUTH_BASE_URL: authServer.baseUrl },
  });
  page = await application.firstWindow();
  await page.setViewportSize({ width: 1280, height: 840 });
  await page.waitForLoadState("domcontentloaded");
});

test.afterEach(async () => {
  await application.close();
  await rm(userDataDirectory, { recursive: true, force: true });
});

test("model onboarding persists and logout returns to welcome", async () => {
  await completeModelOnboarding(page, {
    name: "deepseek-flash",
    baseUrl: "https://example.com/v1",
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "今天想聊些什么？" })).toBeVisible();

  await expect(page.getByRole("button", { name: "设置", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByText("Zimo 本地数据目录")).toBeVisible();
  await expect(page.getByRole("heading", { name: "联网搜索" })).toBeVisible();

  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();
  await expect(page.getByRole("heading", { name: "欢迎使用 Zimo" })).toBeVisible();
});

test("renderer exposes only the typed bridge and no Node globals", async () => {
  const surface = await page.evaluate(() => ({
    processType: typeof (globalThis as { process?: unknown }).process,
    requireType: typeof (globalThis as { require?: unknown }).require,
    apiKeys: Object.keys(window.zimo).sort(),
  }));

  expect(surface.processType).toBe("undefined");
  expect(surface.requireType).toBe("undefined");
  expect(surface.apiKeys).toEqual([
    "agents",
    "app",
    "approvals",
    "artifacts",
    "auth",
    "automations",
    "communicationChannels",
    "conversations",
    "knowledge",
    "mcp",
    "models",
    "prototypes",
    "router",
    "security",
    "securityAudit",
    "settings",
    "skills",
    "tools",
    "updates",
    "userMemories",
    "userQuestions",
    "webAccess",
    "workflows",
    "workspaces",
  ]);

  const applicationMenu = await application.evaluate(({ Menu }) => {
    const menu = Menu.getApplicationMenu();
    const viewMenu = menu?.items.find((item) => item.label === "视图");
    return {
      labels: menu?.items.map((item) => item.label) ?? [],
      viewRoles: viewMenu?.submenu?.items.map((item) => item.role) ?? [],
    };
  });
  expect(applicationMenu.labels).toContain("文件");
  expect(applicationMenu.labels).toContain("编辑");
  expect(applicationMenu.labels).toContain("视图");
  expect(applicationMenu.labels).toContain("窗口");
  expect(applicationMenu.viewRoles).not.toContain("toggleDevTools");
});
