import {
  appUpdateStateViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  successViewSchema,
} from "@zimo/contracts";

import type { DesktopUpdateService } from "./desktop-update-service";
import type { RegisterIpcHandler } from "./ipc-handler";

export function registerUpdateIpcHandlers(
  register: RegisterIpcHandler,
  updates: DesktopUpdateService,
): void {
  register({
    channel: IPC_CHANNELS.updatesGetState,
    input: emptyRequestSchema,
    output: appUpdateStateViewSchema,
    handle: () => updates.getState(),
  });
  register({
    channel: IPC_CHANNELS.updatesCheck,
    input: emptyRequestSchema,
    output: appUpdateStateViewSchema,
    handle: () => updates.check(true),
  });
  register({
    channel: IPC_CHANNELS.updatesInstall,
    input: emptyRequestSchema,
    output: successViewSchema,
    handle: () => {
      updates.install();
      return { success: true as const };
    },
  });
}
