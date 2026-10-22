import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page,
} from "@playwright/test";
import electronPath from "electron";

import { acceptAppDialog, acceptAppDialogIfShown } from "./app-dialog";
import { loginTestUser, startAuthTestServer, type AuthTestServer } from "./auth-test-server";
import { createPhaseTwoProviderHandler, minimalDocx, typoDocx } from "./phase-two-provider-fixture";

let server: Server;
let providerBaseUrl: string;
let application: ElectronApplication;
let page: Page;
let userDataDirectory: string;
let knowledgeFilePath: string;
let chatDocumentPath: string;
let workspaceDirectoryPath: string;
let lastGenerationMessages: Array<{ role?: string; content?: string }> = [];
let authServer: AuthTestServer;

test.beforeAll(async () => {
  authServer = await startAuthTestServer();
  server = createServer(
    createPhaseTwoProviderHandler((messages) => {
      lastGenerationMessages = messages;
    }),
  );
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fake provider did not start");
  providerBaseUrl = `http://127.0.0.1:${address.port}/v1`;
});

test.afterAll(async () => {
  await new Promise<void>((resolveClose) => {
    server.close(() => resolveClose());
  });
  await authServer.close();
});

test.beforeEach(async () => {
  userDataDirectory = await mkdtemp(join(tmpdir(), "zimo-phase-two-e2e-"));
  knowledgeFilePath = join(userDataDirectory, "退款规则.md");
  chatDocumentPath = join(userDataDirectory, "会议材料.docx");
  workspaceDirectoryPath = await mkdtemp(join(tmpdir(), "zimo-workspace-e2e-"));
  await writeFile(join(workspaceDirectoryPath, "README.md"), "# E2E workspace\n", "utf8");
  await writeFile(knowledgeFilePath, "# 退款规则\n\n企业版支持七天退款政策。\n", "utf8");
  await writeFile(chatDocumentPath, await minimalDocx());
  application = await electron.launch({
    executablePath: electronPath as unknown as string,
    args: [resolve("apps/desktop"), `--user-data-dir=${userDataDirectory}`],
    env: {
      ...process.env,
      ZIMO_ALLOW_INSECURE_LOCAL_PROVIDER: "1",
      ZIMO_AUTH_BASE_URL: authServer.baseUrl,
      ZIMO_MANAGED_MODEL_BASE_URL: providerBaseUrl,
    },
  });
  page = await application.firstWindow();
  await loginTestUser(page, {
    name: "deepseek-flash",
    baseUrl: providerBaseUrl,
  });
});

test.afterEach(async () => {
  await application.close();
  await rm(userDataDirectory, { recursive: true, force: true });
  await rm(workspaceDirectoryPath, { recursive: true, force: true });
});

test("binds and restores a controlled conversation workspace", async () => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  const composer = page.getByRole("form", { name: "消息输入" });
  await application.evaluate(({ dialog }, directoryPath) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [directoryPath],
    });
  }, workspaceDirectoryPath);

  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: "添加工作目录 受控读写" }).click();
  await expect(composer.getByLabel("已添加工作目录")).toContainText("zimo-workspace-e2e-");
  await expect(composer.getByLabel("已添加工作目录")).not.toContainText("Zimo Workspace");
  await expect(composer.getByLabel("已添加工作目录")).toContainText("已授权");
  await expect(composer.getByLabel("操作审批模式")).toContainText("请求审批");
  await composer.getByLabel("操作审批模式").click();
  await page.getByRole("menuitem", { name: /帮我批准/ }).click();
  await expect(composer.getByLabel("操作审批模式")).toContainText("帮我批准");

  await page.reload();
  await expect(page.getByLabel("已添加工作目录")).toContainText("zimo-workspace-e2e-");
  await expect(page.getByLabel("操作审批模式")).toContainText("帮我批准");
  await page.getByRole("button", { name: /移除工作目录 zimo-workspace-e2e-/ }).click();
  await expect(page.getByLabel("已添加工作目录")).toHaveCount(0);
});

test("shows the read-only security audit center", async () => {
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();

  await expect(page.getByRole("heading", { name: "审计中心" })).toBeVisible();
  await expect(page.getByText("暂无符合条件的安全记录")).toBeVisible();
  await expect(page.getByLabel("风险")).toBeVisible();
  await expect(page.getByLabel("结果")).toBeVisible();
  await expect(page.getByText(/不保存文件正文/)).toBeVisible();
});

test("saves account memory and includes it in a new conversation's first model request", async () => {
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByRole("heading", { name: "用户偏好与记忆" })).toBeVisible();
  await page.getByLabel("记忆内容").fill("请用简体中文回答测试账号");
  await page.getByRole("button", { name: "添加记忆" }).click();
  await expect(page.getByRole("list", { name: "已保存的记忆" })).toContainText(
    "请用简体中文回答测试账号",
  );
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  lastGenerationMessages = [];
  await page.getByLabel("消息", { exact: true }).fill("你好");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  expect(
    lastGenerationMessages.some((message) => message.content?.includes("请用简体中文回答测试账号")),
  ).toBe(true);
  await page.getByRole("button", { name: "回复操作" }).click();
  await expect(page.getByRole("menuitem", { name: "复制当前内容" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "压缩当前会话" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await page.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("记忆内容").fill("修改后的偏好");
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByRole("list", { name: "已保存的记忆" })).toContainText("修改后的偏好");
  await page.getByRole("button", { name: "停用" }).click();
  await expect(page.getByRole("list", { name: "已保存的记忆" })).toContainText("已停用");
  await page.getByRole("button", { name: "删除" }).click();
  await acceptAppDialog(page);
  await expect(page.getByText("还没有保存记忆。")).toBeVisible();
});

test("manually compacts a conversation without adding a chat reply", async () => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  for (let turn = 0; turn < 7; turn += 1) {
    await page
      .getByLabel("消息", { exact: true })
      .fill(turn === 0 ? "以后请始终用简体中文回复我" : `第 ${turn + 1} 轮测试`);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.locator("article").getByText("你好，Zimo", { exact: true })).toHaveCount(
      turn + 1,
    );
  }
  await page.getByRole("button", { name: "回复操作" }).last().click();
  await page.getByRole("menuitem", { name: "压缩当前会话" }).click();
  await expect(page.getByText("已完成上下文压缩")).toBeVisible();
  await expect(page.locator("article").getByText("你好，Zimo", { exact: true })).toHaveCount(7);
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByText("还没有保存记忆。")).toBeVisible();
});

test("saves a model-proposed memory and uses it in the next conversation", async () => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await page.getByLabel("消息", { exact: true }).fill("记住我叫大力");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByRole("list", { name: "已保存的记忆" })).toContainText("请称呼我为大力");
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  lastGenerationMessages = [];
  await page.getByLabel("消息", { exact: true }).fill("验证新会话记忆");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  expect(
    lastGenerationMessages.some((message) => message.content?.includes("请称呼我为大力")),
  ).toBe(true);
});

test("keeps a manual compaction error in the conversation that triggered it", async () => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await page.getByLabel("消息", { exact: true }).fill("用于测试压缩提示的会话");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "回复操作" }).click();
  await page.getByRole("menuitem", { name: "压缩当前会话" }).click();
  await expect(page.getByRole("alert")).toContainText("较早的完整消息不足");

  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await expect(page.getByLabel("新建任务空白会话")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "打开任务：退款政策咨询" }).click();
  await expect(page.getByRole("alert")).toContainText("较早的完整消息不足");
});

test("configures models and completes the persistent conversation lifecycle", async () => {
  await page.getByRole("button", { name: "打开 Zimo 账户菜单" }).click();
  await page.getByRole("menuitem", { name: "设置" }).click();
  await expect(page.getByText("deepseek-flash", { exact: true })).toBeVisible();
  await expect(page.getByText("API Key：由登录账号安全下发")).toBeVisible();
  await expect(page.getByRole("button", { name: "添加提供商" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存配置" })).toHaveCount(0);
  await expect(page.getByLabel("新 API Key（可选）")).toHaveCount(0);
  await page.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByText(/连接成功/)).toBeVisible();
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
  await expect(page.getByText("退款规则.md", { exact: true })).toBeVisible();
  const rendererProviders = await page.evaluate(() => window.zimo.models.list(crypto.randomUUID()));
  expect(JSON.stringify(rendererProviders)).not.toContain("sk-phase-two-e2e-canary");
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  await expect(page.getByLabel("新建任务空白会话")).toBeVisible();
  await expect(page.getByRole("heading", { name: "今天想聊些什么？" })).toBeVisible();
  await expect(page.getByText("选择下方的模型、Agent 与资料，再描述你的任务。")).toBeVisible();
  await expect(page.getByRole("button", { name: /^打开任务：/ })).toHaveCount(0);
  const composer = page.getByRole("form", { name: "消息输入" });
  await expect(composer.getByLabel("添加对话能力")).toBeVisible();
  await expect(composer.getByLabel("已选能力")).toContainText("添加能力");
  await expect(composer.getByLabel("当前模型")).toBeVisible();
  await application.evaluate(({ dialog }, filePath) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, chatDocumentPath);
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: "添加文件 文档附件" }).click();
  await expect(composer.getByLabel("待发送文件")).toContainText("会议材料.docx");
  await composer.getByTitle("预览 会议材料.docx").click();
  await expect(page.getByRole("dialog", { name: "预览 会议材料.docx" })).toContainText(
    "附件中的季度会议安排与改进建议",
  );
  await page.getByRole("button", { name: "关闭文档预览" }).click();
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: /Skills/ }).hover();
  await page.getByRole("menuitemcheckbox", { name: /网页摘要/ }).click();
  await page.keyboard.press("Escape");
  await expect(composer.getByLabel("已选能力")).toContainText("网页摘要");
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: /Workflow/ }).hover();
  await expect(page.getByRole("menuitem", { name: "研究审核流" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("当前模型")).toContainText("deepseek-flash");
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: /知识库/ }).hover();
  await page.getByRole("menuitem", { name: "产品资料库" }).click();
  await expect(composer.getByLabel("已选能力")).toContainText("产品资料库");

  await page.getByLabel("消息", { exact: true }).fill("退款政策");
  const sendButton = page.getByRole("button", { name: "发送" });
  await expectHorizontalButton(sendButton);
  await sendButton.click();
  await expect(page.getByLabel("意图识别结果")).toContainText("继续普通对话");
  await expect(page.getByLabel("意图识别结果")).toContainText("识别结果无效");
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出 会议材料.docx" })).toBeVisible();
  await expect(page.getByText(/退款规则\.md/)).toBeVisible();
  await expect(page.getByRole("button", { name: "重命名会话" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "删除会话" })).toHaveCount(0);
  const generatedTask = page.getByRole("button", { name: "打开任务：退款政策咨询" });
  await expect(generatedTask).toBeVisible();
  await expect(generatedTask.locator("time")).toBeVisible();
  await generatedTask.hover();
  await expect(page.getByRole("button", { name: "管理任务：退款政策咨询" })).toBeVisible();
  await expect(generatedTask.locator("time")).toHaveCSS("opacity", "0");
  await page.getByRole("button", { name: "管理任务：退款政策咨询" }).click();
  await page.getByRole("menuitem", { name: "置顶" }).click();
  expect(lastGenerationMessages.some((message) => message.content?.includes("七天退款"))).toBe(
    true,
  );
  expect(
    lastGenerationMessages.some((message) =>
      message.content?.includes("附件中的季度会议安排与改进建议"),
    ),
  ).toBe(true);
  expect(
    lastGenerationMessages.some((message) => message.content?.includes("核心摘要、关键信息")),
  ).toBe(true);
  expect(
    lastGenerationMessages
      .filter((message) => message.role === "tool")
      .map((message) => message.content),
  ).toEqual([
    expect.stringContaining('"documentRef":"doc_1"'),
    expect.stringContaining('"documentRef":"doc_1"'),
  ]);
  expect(JSON.stringify(lastGenerationMessages)).not.toContain('"artifactId"');
  expect(JSON.stringify(lastGenerationMessages)).not.toContain('"revisionId"');

  await page.reload();
  await expect(page.getByLabel("已置顶")).toBeVisible();
  await page.getByRole("button", { name: "打开任务：退款政策咨询" }).click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "导出 会议材料.docx" })).toBeVisible();
  await expect(page.getByText(/退款规则\.md/)).toBeVisible();
  await expect(page.getByLabel("当前模型")).toContainText("deepseek-flash");
  await expect(page.getByLabel("已选能力")).toContainText("网页摘要");

  await composer.getByLabel("已选能力").getByText("网页摘要").hover();
  await composer.getByRole("button", { name: "移除能力 网页摘要" }).click();
  await expect(composer.getByLabel("已选能力")).not.toContainText("网页摘要");

  await page.getByRole("button", { name: "打开任务：退款政策咨询" }).hover();
  await page.getByRole("button", { name: "管理任务：退款政策咨询" }).click();
  await expect(page.getByRole("menuitem", { name: "取消置顶" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "管理任务：退款政策咨询" }).click();
  await page.getByRole("menuitem", { name: "修改名称" }).click();
  await page.getByLabel("任务名称", { exact: true }).fill("持续会话");
  await page.getByRole("button", { name: "保存任务名称" }).click();
  await expect(page.getByRole("heading", { name: "持续会话" })).toBeVisible();

  const regenerateButton = composer.getByRole("button", { name: "重新生成" });
  await expectHorizontalButton(regenerateButton);
  await expect(page.getByLabel("回复内容").getByRole("button", { name: "重新生成" })).toBeVisible();
  await regenerateButton.click();
  await expect(page.getByText("你好，Zimo", { exact: true })).toHaveCount(2);

  await page.getByLabel("消息", { exact: true }).fill("请使用研究助手整理这份资料");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByLabel("意图识别结果")).toContainText("识别到 研究助手");
  await expect(page.getByLabel("意图识别结果")).toContainText("Router 只提出目标建议");
  await page.getByRole("button", { name: "下条消息使用此 Agent" }).click();
  await expect(composer.getByLabel("已选能力")).toContainText("研究助手");
  await page.getByLabel("消息", { exact: true }).fill("使用 Agent 回答");
  await expect(page.getByRole("button", { name: "发送" })).toBeEnabled();
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByLabel("意图识别结果")).toContainText("已使用会话选择的 Agent");

  await page.getByRole("button", { name: "新建任务" }).click();
  await expect(page.getByLabel("新建任务空白会话")).toBeVisible();
  await page.locator("aside button", { hasText: "持续会话" }).click();
  await expect(composer.getByLabel("已选能力")).toContainText("研究助手");
  await expect(page.getByRole("button", { name: "确认使用 Agent" })).toHaveCount(0);

  const messageList = page.getByLabel("消息列表");
  await expect(messageList).toHaveCSS("scroll-behavior", "auto");
  await expect
    .poll(() => messageList.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await expect
    .poll(() =>
      messageList.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 3,
      ),
    )
    .toBe(true);
  await messageList.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await page.getByRole("button", { name: "回到最新消息" }).click();
  await expect
    .poll(() =>
      messageList.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 3,
      ),
    )
    .toBe(true);

  await messageList.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByRole("button", { name: "回到最新消息" })).toBeVisible();
  await page.getByLabel("消息", { exact: true }).fill("slow response");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "停止" })).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(() =>
      messageList.evaluate(
        (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 3,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "停止" }).click();
  await expect(page.getByText("已停止", { exact: true })).toBeVisible();

  const configuredWorkflow = await page.evaluate(async () => {
    const [agents, knowledgeBases, workflows] = await Promise.all([
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "agent", status: "enabled" }),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "knowledge", status: "enabled" }),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "workflow" }),
    ]);
    if (!agents.ok || !knowledgeBases.ok || !workflows.ok) throw new Error("Catalog unavailable");
    const agent = agents.data.find((item) => item.name === "研究助手");
    const knowledge = knowledgeBases.data.find((item) => item.name === "产品资料库");
    const workflow = workflows.data.find((item) => item.name === "研究审核流");
    if (!agent || !knowledge || !workflow) throw new Error("Workflow fixture unavailable");
    return window.zimo.prototypes.mutate(crypto.randomUUID(), {
      action: "save-workflow",
      kind: "workflow",
      id: workflow.id,
      nodes: [
        { id: "start", type: "start", label: "开始", position: { x: 40, y: 120 } },
        {
          id: "tool",
          type: "tool",
          label: "知识库只读 Tool",
          position: { x: 280, y: 120 },
          config: {
            toolId: "zimo.knowledge.search",
            knowledgeBaseId: knowledge.id,
            topK: 3,
          },
        },
        {
          id: "agent",
          type: "agent",
          label: "研究助手",
          position: { x: 520, y: 120 },
          config: { agentId: agent.id },
        },
        { id: "end", type: "end", label: "结束", position: { x: 760, y: 120 } },
      ],
      edges: [
        { id: "e1", source: "start", target: "tool" },
        { id: "e2", source: "tool", target: "agent" },
        { id: "e3", source: "agent", target: "end" },
      ],
    });
  });
  expect(configuredWorkflow.ok).toBe(true);
  await openToolsNavigation();
  await page.getByRole("menuitem", { name: "工作流", exact: true }).click();
  await page
    .locator("article", { hasText: "研究审核流" })
    .getByRole("button", { name: "编排" })
    .click();
  await page.getByRole("button", { name: "打开工作流编辑器" }).click();
  await page.getByRole("button", { name: "测试", exact: true }).click();
  await page.getByLabel("测试输入").fill("退款政策是什么？");
  await expect(page.getByRole("complementary", { name: "工作流测试" })).toContainText(
    "读取本地知识库索引",
  );
  await page.getByRole("button", { name: "确认权限并运行" }).click();
  await expect(page.getByRole("complementary", { name: "工作流测试" })).toContainText("最终输出");
  await expect(page.getByRole("complementary", { name: "工作流测试" })).toContainText("你好");
  await expect(page.getByRole("complementary", { name: "工作流测试" })).toContainText(
    "知识库只读 Tool · 运行中",
  );

  await page.getByRole("button", { name: "返回工作流详情" }).click();
  await acceptAppDialogIfShown(page);
  await page.getByRole("button", { name: "打开任务：持续会话" }).click();
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: /Workflow/ }).hover();
  await page.getByRole("menuitem", { name: "研究审核流" }).click();
  await expect(composer.getByLabel("已选能力")).toContainText("研究审核流");
  await page.getByLabel("消息", { exact: true }).fill("通过会话执行工作流");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByLabel("意图识别结果")).toContainText("已执行会话选择的 Workflow");
  await expect(page.getByText("你好，Zimo", { exact: true })).toHaveCount(5);

  await page.getByRole("button", { name: "打开任务：持续会话" }).hover();
  await page.getByRole("button", { name: "管理任务：持续会话" }).click();
  await page.getByRole("menuitem", { name: "删除" }).click();
  await acceptAppDialog(page);
  await expect(page.getByLabel("新建任务空白会话")).toBeVisible();

  const logPath = await application.evaluate(({ app }) => `${app.getPath("logs")}/zimo.log`);
  await expect
    .poll(async () =>
      readFile(logPath, "latin1")
        .then(
          (value) =>
            value.includes("model.provider.managed") &&
            value.includes("model.request.prepared") &&
            value.includes("tool.execution.completed"),
        )
        .catch(() => false),
    )
    .toBe(true);
  const logs = await readFile(logPath, "latin1");
  expect(logs).not.toContain("sk-phase-two-e2e-canary");
  expect(logs).not.toContain("退款政策是什么");
  expect(logs).not.toContain("企业版支持七天退款政策");
  expect(logs).not.toContain("使用 Agent 回答");
  expect(
    await readFile(join(userDataDirectory, "accounts", "local", "zimo.sqlite"), "latin1"),
  ).not.toContain("sk-phase-two-e2e-canary");
  expect(await readFile(join(userDataDirectory, "system", "secrets.enc"), "latin1")).not.toContain(
    "sk-phase-two-e2e-canary",
  );
});

test("creates DOCX, XLSX, PPTX and Chinese PDF as controlled output artifacts", async () => {
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  const composer = page.getByRole("form", { name: "消息输入" });
  await page
    .getByLabel("消息", { exact: true })
    .fill("创建四个测试文档：Word 报告、Excel 表格、PPT 和 PDF");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByText("你好，Zimo", { exact: true })).toBeVisible({ timeout: 20_000 });
  for (const name of ["测试报告.docx", "测试数据.xlsx", "测试演示.pptx", "测试文档.pdf"]) {
    await expect(page.getByRole("button", { name: `导出 ${name}` })).toBeVisible();
  }
  await page.getByRole("button", { name: "预览 测试文档.pdf" }).click();
  await expect(page.getByRole("dialog", { name: "预览 测试文档.pdf" })).toContainText(
    "由 Chromium 生成的中文内容",
  );
  await page.getByRole("button", { name: "关闭文档预览" }).click();
  await expect(composer.getByLabel("待发送文件")).toHaveCount(0);
});

test("returns one corrected DOCX revision as an assistant attachment", async () => {
  await writeFile(chatDocumentPath, await typoDocx());
  await page.getByRole("button", { name: "新建任务", exact: true }).click();
  const composer = page.getByRole("form", { name: "消息输入" });
  await application.evaluate(({ dialog }, filePath) => {
    const mutableDialog = dialog as unknown as {
      showOpenDialog(): Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    mutableDialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] });
  }, chatDocumentPath);
  await composer.getByLabel("添加对话能力").click();
  await page.getByRole("menuitem", { name: "添加文件 文档附件" }).click();
  await page.getByLabel("消息", { exact: true }).fill("修改错别字");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("button", { name: "导出 会议材料.docx" })).toHaveCount(2);
  await page.getByRole("button", { name: "预览 会议材料.docx" }).last().click();
  const preview = page.getByRole("dialog", { name: "预览 会议材料.docx" });
  await expect(preview).toContainText("OpenClaw 技术分享文档");
  await expect(preview).toContainText("模型推理层");
  await expect(preview).not.toContainText("模型推理屁");
  expect((await preview.textContent())?.match(/OpenClaw 技术分享/g)).toHaveLength(1);
});

async function openToolsNavigation() {
  const trigger = page.getByRole("button", { name: "工具", exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
}

async function expectHorizontalButton(locator: Locator) {
  await expect
    .poll(() => locator.evaluate((element) => getComputedStyle(element).display.endsWith("flex")))
    .toBe(true);
  await expect(locator).toHaveCSS("align-items", "center");
}
