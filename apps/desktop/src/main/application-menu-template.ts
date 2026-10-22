import type { MenuItemConstructorOptions } from "electron";

export function createApplicationMenuTemplate(options: {
  platform: NodeJS.Platform;
  productName: string;
  isDevelopment: boolean;
  onCheckForUpdates: () => void;
}): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];

  if (options.platform === "darwin") {
    template.push(createMacApplicationMenu(options.productName, options.onCheckForUpdates));
  }

  template.push(
    createFileMenu(options.platform, options.productName),
    createEditMenu(),
    createViewMenu(options.isDevelopment),
    createWindowMenu(options.platform),
    {
      label: "帮助",
      submenu: [
        ...(options.platform === "darwin"
          ? []
          : [{ label: "检查更新…", click: options.onCheckForUpdates }]),
        { label: `关于 ${options.productName}`, role: "about" },
      ],
    },
  );

  return template;
}

function createMacApplicationMenu(
  productName: string,
  onCheckForUpdates: () => void,
): MenuItemConstructorOptions {
  return {
    label: productName,
    submenu: [
      { label: `关于 ${productName}`, role: "about" },
      { label: "检查更新…", click: onCheckForUpdates },
      { type: "separator" },
      { label: "服务", role: "services" },
      { type: "separator" },
      { label: `隐藏 ${productName}`, role: "hide" },
      { label: "隐藏其他应用", role: "hideOthers" },
      { label: "全部显示", role: "unhide" },
      { type: "separator" },
      { label: `退出 ${productName}`, role: "quit" },
    ],
  };
}

function createFileMenu(
  platform: NodeJS.Platform,
  productName: string,
): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [{ label: "关闭窗口", role: "close" }];
  if (platform !== "darwin") {
    submenu.push({ type: "separator" }, { label: `退出 ${productName}`, role: "quit" });
  }
  return { label: "文件", submenu };
}

function createEditMenu(): MenuItemConstructorOptions {
  return {
    label: "编辑",
    submenu: [
      { label: "撤销", role: "undo" },
      { label: "重做", role: "redo" },
      { type: "separator" },
      { label: "剪切", role: "cut" },
      { label: "复制", role: "copy" },
      { label: "粘贴", role: "paste" },
      { label: "粘贴并匹配样式", role: "pasteAndMatchStyle" },
      { label: "删除", role: "delete" },
      { label: "全选", role: "selectAll" },
    ],
  };
}

function createViewMenu(isDevelopment: boolean): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [
    { label: "重新加载", role: "reload" },
    { label: "强制重新加载", role: "forceReload" },
  ];
  if (isDevelopment) {
    submenu.push({ type: "separator" }, { label: "开发者工具", role: "toggleDevTools" });
  }
  submenu.push(
    { type: "separator" },
    { label: "恢复默认缩放", role: "resetZoom" },
    { label: "放大", role: "zoomIn" },
    { label: "缩小", role: "zoomOut" },
    { type: "separator" },
    { label: "切换全屏", role: "togglefullscreen" },
  );
  return { label: "视图", submenu };
}

function createWindowMenu(platform: NodeJS.Platform): MenuItemConstructorOptions {
  const submenu: MenuItemConstructorOptions[] = [{ label: "最小化", role: "minimize" }];
  if (platform === "darwin") {
    submenu.push(
      { label: "缩放窗口", role: "zoom" },
      { type: "separator" },
      { label: "全部置于顶层", role: "front" },
    );
  } else {
    submenu.push({ label: "关闭窗口", role: "close" });
  }
  return { label: "窗口", submenu };
}
