import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

import { acceptAppDialog } from "./app-dialog";
import { loginTestUser, startAuthTestServer, type AuthTestServer } from "./auth-test-server";

let application: ElectronApplication;
let page: Page;
let userDataDirectory: string;
let skillPackageDirectory: string;
let knowledgeFilePath: string;
let authServer: AuthTestServer;

test.setTimeout(90_000);

test.beforeAll(async () => {
  authServer = await startAuthTestServer();
});

test.afterAll(async () => {
  await authServer.close();
});

test.beforeEach(async () => {
  userDataDirectory = await mkdtemp(join(tmpdir(), "zimo-phase-three-e2e-"));
  skillPackageDirectory = await mkdtemp(join(tmpdir(), "zimo-skill-e2e-"));
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
  await loginTestUser(page);
});
test.afterEach(async () => {
  await application?.close();
  await rm(userDataDirectory, { recursive: true, force: true });
  await rm(skillPackageDirectory, { recursive: true, force: true });
});

test("navigates product modules and indexes a local knowledge document", async () => {
  await expect(page.getByRole("button", { name: "概览", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "新建任务", exact: true })).toBeVisible();
  for (const name of ["Agent", "Skill", "知识库", "工作流", "通信渠道", "MCP", "自动化"]) {
    if (["知识库", "工作流", "通信渠道", "MCP", "自动化"].includes(name)) {
      await openToolsNavigation();
    }
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.getByRole("button", { name: "新建 Automation" }).click();
  await page.getByLabel("名称").fill("间隔运营简报");
  await page.getByLabel("每次执行的指令").fill("整理今天的运营进展");
  await page.getByLabel("自动化计划类型").click();
  await page.getByRole("menuitem", { name: "固定间隔" }).click();
  await expect(page.getByLabel("首次执行")).toHaveCount(0);
  await page.getByLabel("间隔分钟数（5—43200）").fill("30");
  await page.getByLabel("开始时间").fill("09:00");
  await page.getByLabel("结束时间").fill("18:00");
  await page.getByRole("button", { name: "保存自动化" }).click();
  await expect(page.getByText("自动化配置已保存")).toBeVisible();
  await expect(page.getByRole("heading", { name: "间隔运营简报" })).toBeVisible();
  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await expect(page.getByRole("button", { name: "Agent", exact: true })).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(page.getByRole("button", { name: "Agent", exact: true })).toHaveClass(/bg-blue-50/);
  await page.getByRole("menuitem", { name: "通信渠道", exact: true }).click();
  await page.getByRole("button", { name: "添加邮箱", exact: true }).click();
  await page.getByLabel("邮箱地址").fill("Inbox@Example.com");
  await page.getByRole("button", { name: "添加邮箱", exact: true }).click();
  await expect(page.getByText("邮箱地址添加成功")).toBeVisible();
  await expect(page.getByText("inbox@example.com", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Agent", exact: true }).click();
  const agentGrid = page.getByLabel("Agents列表");
  await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible();
  await expect(agentGrid).toHaveCount(1);
  await expect(page.getByText("招聘协调助手", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "人力资源", exact: true })).toBeVisible();
  await page
    .locator("article", { hasText: "招聘协调助手" })
    .getByRole("button", { name: "安装", exact: true })
    .click();
  await expect(page.getByText("“招聘协调助手”已安装，可用于会话和工作流。")).toBeVisible();
  await expect(agentGrid.getByText("招聘协调助手", { exact: true })).toBeVisible();
  expect(
    await readFile(join(userDataDirectory, "accounts", "local", "zimo.sqlite"), "latin1"),
  ).not.toContain("secret-e2e-agent-canary");
  await expect(page.getByPlaceholder("搜索 Agent 名称、描述或分类")).toHaveCSS(
    "padding-left",
    "42px",
  );
  await expect(agentGrid).toBeVisible();
  expect(
    await agentGrid.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
    ),
  ).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "新建 Agent" }).click();
  await expect(page.getByLabel("标签", { exact: true })).toHaveCount(0);
  await page.getByLabel("Agent 分类").click();
  await page.getByRole("menuitem", { name: "人力资源", exact: true }).click();
  await page.getByLabel("名称").fill("写作助手");
  await page.getByLabel("描述").fill("负责写作原型");
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await expect(page.getByText("写作助手", { exact: true }).first()).toBeVisible();
  await expect(page.locator("article", { hasText: "写作助手" })).toContainText("人力资源");

  await page.getByRole("button", { name: "Skill", exact: true }).click();
  await expect(page.getByText("Boss直聘 HR 自动化助手", { exact: true })).toBeVisible();
  const skillCategory = page.getByRole("button", { name: "招聘平台能力", exact: true });
  await expect(skillCategory).toBeVisible();
  await expect(skillCategory).toHaveCSS("font-size", "13px");
  await expect(page.locator(".scrollbar-hidden")).toHaveCSS("scrollbar-width", "none");
  await expect(page.locator("article", { hasText: "Boss直聘 HR 自动化助手" })).not.toContainText(
    "来源：",
  );
  await expect(
    page
      .locator("article", { hasText: "Boss直聘 HR 自动化助手" })
      .getByRole("button", { name: "安装", exact: true }),
  ).toBeVisible();
  await application.evaluate(({ dialog }, directory) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [directory] });
  }, skillPackageDirectory);
  await page.getByRole("button", { name: "从本地文件夹安装" }).click();
  await expect(page.getByText("E2E 本地摘要", { exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Skill", exact: true }).click();
  await expect(page.getByText("E2E 本地摘要", { exact: true }).first()).toBeVisible();
  const skillStatuses = await page
    .locator("article")
    .evaluateAll((cards) =>
      cards.map((card) => (card.textContent?.includes("未安装") ? "not_installed" : "installed")),
    );
  expect(skillStatuses).toEqual(
    [...skillStatuses].sort((left, right) => {
      if (left === right) return 0;
      return left === "installed" ? -1 : 1;
    }),
  );

  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "知识库", exact: true }).click();
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
  const searchInput = page.getByLabel("检索问题");
  const searchButton = page.getByRole("button", { name: "检索", exact: true });
  const inputBox = await searchInput.boundingBox();
  const buttonBox = await searchButton.boundingBox();
  expect(inputBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(Math.abs((inputBox?.height ?? 0) - (buttonBox?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(buttonBox?.width ?? 0).toBeGreaterThanOrEqual(68);
  await searchInput.fill("产品编号");
  await searchButton.click();
  await expect(page.getByText(/ZIMO-KB-2026/)).toBeVisible();
  await page.reload();
  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "知识库", exact: true }).click();
  await page
    .locator("article", { hasText: "产品资料库" })
    .getByRole("button", { name: "文档" })
    .click();
  await expect(page.getByText("产品说明.md", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Agent", exact: true }).click();
  await page
    .locator("article", { hasText: "研究助手" })
    .getByRole("button", { name: "编辑" })
    .click();
  await page.getByLabel("产品资料库").check();
  await page.getByRole("button", { name: "保存配置", exact: true }).click();
  await page
    .locator("article", { hasText: "研究助手" })
    .getByRole("button", { name: "编辑" })
    .click();
  await expect(page.getByLabel("产品资料库")).toBeChecked();
  await page.getByRole("button", { name: /返回Agents列表/ }).click();

  await page.getByRole("menuitem", { name: "工作流", exact: true }).click();
  await page
    .locator("article", { hasText: "研究审核流" })
    .getByRole("button", { name: "编排" })
    .click();
  await page.getByRole("button", { name: "打开工作流编辑器" }).click();
  await expect(page.getByRole("dialog", { name: /研究审核流工作流编辑器/ })).toBeVisible();
  const nodeLibrary = page.getByRole("complementary", { name: "节点库" });
  await expect(nodeLibrary).toBeVisible();
  const nodeSearch = nodeLibrary.getByLabel("搜索节点");
  await expect
    .poll(() =>
      nodeSearch.evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingLeft)),
    )
    .toBeGreaterThanOrEqual(40);
  await expect
    .poll(() =>
      nodeLibrary
        .getByRole("button", { name: /知识检索/ })
        .evaluate((element) => getComputedStyle(element).cursor),
    )
    .toBe("pointer");
  await page.getByRole("button", { name: /知识检索/ }).click();
  await page.getByLabel("选择知识库").click();
  await page.getByRole("menuitem", { name: "产品资料库" }).click();
  await page
    .getByRole("complementary", { name: "节点库" })
    .getByRole("button")
    .filter({ hasText: "Tool" })
    .click();
  await page.getByLabel("选择受控 Tool").click();
  await page.getByRole("menuitem", { name: "本地知识库检索" }).click();
  await page.getByLabel("允许检索的知识库").click();
  await page.getByRole("menuitem", { name: "产品资料库" }).click();
  await expect(page.getByText("最大返回条数", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "返回工作流详情" }).click();
  await page.reload();
  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "工作流", exact: true }).click();
  await page
    .locator("article", { hasText: "研究审核流" })
    .getByRole("button", { name: "编排" })
    .click();
  await expect(page.getByText(/6 个节点/)).toBeVisible();

  await page.getByRole("menuitem", { name: "MCP", exact: true }).click();
  await expect(page.getByRole("heading", { name: "MCP 服务" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新增 MCP" })).toBeVisible();
  await page.getByLabel("搜索 MCP 服务").fill("滴滴");
  await expect(page.getByText("滴滴出行", { exact: true })).toBeVisible();
  await expect(page.getByText("企查查", { exact: true })).toHaveCount(0);
  await page.getByLabel("搜索 MCP 服务").fill("");
  await expect(page.getByText("企查查", { exact: true })).toBeVisible();
  await expect(page.getByText("腾讯会议", { exact: true })).toBeVisible();
  for (const service of [
    "GitHub",
    "Sentry",
    "Hugging Face",
    "Context7",
    "Microsoft Learn",
    "腾讯文档",
    "高德地图",
    "千图 AI",
    "EdgeOne Pages",
    "有活招工",
    "盈米基金",
    "滴滴出行",
    "今日投资",
    "麦当劳中国",
    "UAPI",
  ]) {
    await expect(page.getByText(service, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("企业微信", { exact: true })).toHaveCount(0);
  for (const retired of ["Notion", "Linear", "Stripe", "Canva", "Atlassian"]) {
    await expect(page.getByText(retired, { exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "编辑企查查" }).click();
  await expect(page.getByRole("heading", { name: "配置企查查" })).toBeVisible();
  await expect(page.getByLabel("API Key")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("MCP 服务地址")).not.toBeEditable();
  await expect(page.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "返回 MCP 服务" }).click();
  await page.getByRole("button", { name: "编辑GitHub" }).click();
  await expect(page.getByRole("button", { name: "连接并授权" })).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "返回 MCP 服务" }).click();
  await page.getByRole("button", { name: "编辑麦当劳中国" }).click();
  await expect(page.getByText("Authorization: Bearer <MCP Token>", { exact: true })).toBeVisible();
  await expect(page.getByLabel("MCP Token")).toBeEditable();
  await page.getByLabel("MCP Token").fill("e2e-mcd-token");
  await expect(page.getByLabel("MCP Token")).toHaveValue("e2e-mcd-token");
  await expect(page.getByText(/不要包含“Bearer ”前缀/)).toBeVisible();
  await page.getByRole("button", { name: "返回 MCP 服务" }).click();
  await page.getByRole("button", { name: "新增 MCP" }).click();
  await expect(page.getByRole("heading", { name: "新增 MCP" })).toBeVisible();
  await expect(page.getByLabel("MCP 名称")).toBeEditable();
  await expect(page.getByLabel("MCP 服务地址")).toBeEditable();
  await expect(page.getByRole("button", { name: "认证方式" })).toBeVisible();
  await page.getByRole("button", { name: "返回 MCP 服务" }).click();

  await page.getByRole("button", { name: "Skill", exact: true }).click();
  const localSkill = page.locator("article", { hasText: "E2E 本地摘要" });
  await expect(localSkill.getByText("已安装", { exact: true })).toBeVisible();
  await localSkill.getByRole("button", { name: "卸载", exact: true }).click();
  await acceptAppDialog(page);
  await expect(page.getByText("“E2E 本地摘要”已卸载。", { exact: true })).toBeVisible();
});

async function openToolsNavigation() {
  const trigger = page.getByRole("button", { name: "工具", exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}
