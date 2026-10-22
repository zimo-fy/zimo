import type { UserMemoryService } from "@zimo/application";
import {
  deleteUserMemoryRequestSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  saveUserMemoryRequestSchema,
  successViewSchema,
  userMemoryViewSchema,
} from "@zimo/contracts";
import type { UserMemory } from "@zimo/domain";

import type { RegisterIpcHandler } from "./ipc-handler";

export function registerUserMemoryIpcHandlers(
  register: RegisterIpcHandler,
  service: UserMemoryService,
): void {
  register({
    channel: IPC_CHANNELS.userMemoriesList,
    input: emptyRequestSchema,
    output: userMemoryViewSchema.array().max(100),
    handle: async () => (await service.list()).map(toView),
  });
  register({
    channel: IPC_CHANNELS.userMemoriesSave,
    input: saveUserMemoryRequestSchema,
    output: userMemoryViewSchema,
    handle: async ({ payload }) => toView(await service.save(payload)),
  });
  register({
    channel: IPC_CHANNELS.userMemoriesDelete,
    input: deleteUserMemoryRequestSchema,
    output: successViewSchema,
    handle: async ({ payload }) => {
      await service.delete(payload.id);
      return { success: true as const };
    },
  });
}

function toView(memory: UserMemory) {
  return {
    id: memory.id,
    kind: memory.kind,
    content: memory.content,
    enabled: memory.enabled,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}
