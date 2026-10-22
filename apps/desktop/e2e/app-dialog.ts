import type { Page } from "@playwright/test";

export async function acceptAppDialog(page: Page): Promise<void> {
  await page.getByRole("alertdialog").getByRole("button", { name: "确定", exact: true }).click();
}

export async function acceptAppDialogIfShown(page: Page, timeoutMs = 1_000): Promise<void> {
  const action = page.getByRole("alertdialog").getByRole("button", { name: "确定", exact: true });
  try {
    await action.waitFor({ state: "visible", timeout: timeoutMs });
  } catch {
    return;
  }
  await action.click();
}
