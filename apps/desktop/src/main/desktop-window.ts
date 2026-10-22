import { join } from "node:path";

import { app, BrowserWindow } from "electron";

export async function createDesktopWindow(options: {
  moduleDirectory: string;
  onClosed: () => void;
}): Promise<void> {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 760,
    minHeight: 640,
    show: false,
    title: "Zimo",
    backgroundColor: "#fafafa",
    icon: app.isPackaged
      ? join(process.resourcesPath, "icon.png")
      : join(app.getAppPath(), "resources/icon.png"),
    webPreferences: {
      preload: join(options.moduleDirectory, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    const allowed = process.env.ELECTRON_RENDERER_URL
      ? url.startsWith(process.env.ELECTRON_RENDERER_URL)
      : url.startsWith("app://zimo/");
    if (!allowed) event.preventDefault();
  });
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.once("ready-to-show", () => window.show());
  window.on("closed", options.onClosed);

  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await window.loadURL("app://zimo/index.html");
  }
}
