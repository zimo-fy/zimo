import { Menu } from "electron";

import { createApplicationMenuTemplate } from "./application-menu-template";

export function configureApplicationMenu(options: {
  isDevelopment: boolean;
  onCheckForUpdates: () => void;
}): void {
  const template = createApplicationMenuTemplate({
    platform: process.platform,
    productName: "Zimo",
    isDevelopment: options.isDevelopment,
    onCheckForUpdates: options.onCheckForUpdates,
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
