import { expect, type Page } from "@playwright/test";

export async function completeModelOnboarding(
  page: Page,
  model: { name: string; baseUrl: string },
): Promise<void> {
  await expect(page.getByRole("heading", { name: "欢迎使用 Zimo" })).toBeVisible();
  await expect(page.getByText("让想法自然抵达行动。")).toBeVisible();
  await page.getByRole("button", { name: "开始使用 Zimo" }).click();
  await expect(page.getByRole("heading", { name: "配置模型" })).toBeVisible();
  await page.getByLabel("模型标识").fill(model.name);
  await page.getByLabel("API 地址").fill(model.baseUrl);
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("开发模型配置已保存")).toBeVisible();
  await page.getByRole("button", { name: "下一步" }).click();
  await expect(page.getByRole("heading", { name: "今天想聊些什么？" })).toBeVisible();
}
