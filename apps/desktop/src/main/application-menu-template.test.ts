import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

import { createApplicationMenuTemplate } from "./application-menu-template";

describe("createApplicationMenuTemplate", () => {
  it("uses Chinese labels and includes developer tools in development", () => {
    const onCheckForUpdates = vi.fn();
    const template = createApplicationMenuTemplate({
      platform: "darwin",
      productName: "Zimo",
      isDevelopment: true,
      onCheckForUpdates,
    });

    expect(template.map((item) => item.label)).toEqual([
      "Zimo",
      "文件",
      "编辑",
      "视图",
      "窗口",
      "帮助",
    ]);
    expect(getSubmenu(template, "视图")).toContainEqual({
      label: "开发者工具",
      role: "toggleDevTools",
    });
    expect(
      getSubmenu(template, "编辑")
        .map((item) => item.label)
        .filter(Boolean),
    ).toEqual(["撤销", "重做", "剪切", "复制", "粘贴", "粘贴并匹配样式", "删除", "全选"]);
    const updateItem = getSubmenu(template, "Zimo").find((item) => item.label === "检查更新…");
    updateItem?.click?.({} as never, undefined as never, {} as never);
    expect(onCheckForUpdates).toHaveBeenCalledOnce();
  });

  it("omits developer tools outside development mode", () => {
    const template = createApplicationMenuTemplate({
      platform: "win32",
      productName: "Zimo",
      isDevelopment: false,
      onCheckForUpdates: vi.fn(),
    });

    expect(template.map((item) => item.label)).toEqual(["文件", "编辑", "视图", "窗口", "帮助"]);
    expect(getSubmenu(template, "视图").some((item) => item.role === "toggleDevTools")).toBe(false);
    expect(getSubmenu(template, "帮助").map((item) => item.label)).toContain("检查更新…");
  });
});

function getSubmenu(
  template: readonly MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] {
  const submenu = template.find((item) => item.label === label)?.submenu;
  if (!Array.isArray(submenu)) throw new Error(`Missing submenu: ${label}`);
  return submenu;
}
