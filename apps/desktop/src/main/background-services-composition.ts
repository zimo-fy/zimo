import {
  AutomationService,
  WeixinAssistantService,
  type ConversationService,
} from "@zimo/application";
import {
  SQLiteAutomationRepository,
  SQLiteWeixinAssistantRepository,
  type ZimoDatabase,
} from "@zimo/database-sqlite";
import type {
  Clock,
  CommunicationChannelRepository,
  IdGenerator,
  SecretStore,
  SessionStore,
} from "@zimo/domain";
import type { StructuredLogger } from "@zimo/logging";
import { automationTaskListChangedSchema, IPC_CHANNELS } from "@zimo/contracts";
import { BrowserWindow } from "electron";

import { DesktopAutomationScheduler } from "./automation-scheduler";
import { TencentWeixinMessagingGateway } from "./weixin-messaging-gateway";

export async function createBackgroundServices(options: {
  database: ZimoDatabase;
  communicationChannels: CommunicationChannelRepository;
  sessions: SessionStore;
  secrets: SecretStore;
  conversations: ConversationService;
  clock: Clock;
  ids: IdGenerator;
  logger: StructuredLogger;
}) {
  const automationRepository = new SQLiteAutomationRepository(options.database);
  await automationRepository.repairInterruptedRuns(options.clock.now());
  const automations = new AutomationService(
    automationRepository,
    options.sessions,
    options.conversations,
    options.clock,
    options.ids,
    (diagnostic) =>
      options.logger.log({
        level: diagnostic.outcome === "failure" ? "warn" : "info",
        category: "automation",
        event: diagnostic.event,
        message: "Automation run state changed",
        context: {
          event: diagnostic.event,
          automationId: diagnostic.automationId,
          runId: diagnostic.runId,
          outcome: diagnostic.outcome,
          ...(diagnostic.errorCode ? { errorCode: diagnostic.errorCode } : {}),
        },
      }),
    () => {
      const payload = automationTaskListChangedSchema.parse({});
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed() || window.webContents.isDestroyed()) continue;
        try {
          window.webContents.send(IPC_CHANNELS.automationsTaskListChanged, payload);
        } catch {
          options.logger.log({
            level: "warn",
            category: "automation",
            event: "automation.task_list_notification.failed",
            message: "Automation task list notification failed",
          });
        }
      }
    },
  );
  const automationScheduler = new DesktopAutomationScheduler(automations, options.logger);
  const weixinAssistant = new WeixinAssistantService(
    options.communicationChannels,
    new SQLiteWeixinAssistantRepository(options.database),
    options.sessions,
    options.secrets,
    new TencentWeixinMessagingGateway(),
    options.conversations,
    options.clock,
    (diagnostic) =>
      options.logger.log({
        level: diagnostic.errorCode ? "warn" : "info",
        category: "connector",
        event: String(diagnostic.event),
        message: "Weixin assistant runtime state changed",
        context: { ...diagnostic },
      }),
  );

  return {
    automations,
    weixinAssistant,
    async start(): Promise<void> {
      await weixinAssistant.start();
      automationScheduler.start();
    },
    async stop(): Promise<void> {
      automationScheduler.dispose();
      await weixinAssistant.stop();
    },
  };
}
