import type {
  AuthService,
  ConversationService,
  AutomationService,
  ModelConfigurationService,
  SettingsService,
  WeixinAssistantService,
} from "@zimo/application";
import type { LoginInput } from "@zimo/domain";
import {
  appInfoViewSchema,
  appSettingsViewSchema,
  authSessionViewSchema,
  emptyRequestSchema,
  IPC_CHANNELS,
  loginRequestSchema,
  secretStoreStatusViewSchema,
  successViewSchema,
  updateSettingsRequestSchema,
} from "@zimo/contracts";
import type { EncryptedFileSecretStore } from "@zimo/secret-store";
import type { StructuredLogger } from "@zimo/logging";
import { AppError } from "@zimo/domain";
import { app } from "electron";

import { mapPlatform, toAuthView } from "./app-view-mappers";
import type { RegisterIpcHandler } from "./ipc-handler";

async function loginAndProvisionManagedModel(
  options: {
    auth: AuthService;
    models: ModelConfigurationService;
    weixinAssistant: WeixinAssistantService;
    automations: AutomationService;
    conversations: ConversationService;
  },
  input: LoginInput,
  logger?: StructuredLogger | null,
) {
  options.automations.cancelAll();
  options.conversations.cancelAll();
  await options.weixinAssistant.stop();
  const result = await options.auth.login(input);
  try {
    const provider = await options.models.provisionManagedZimoModel(result.modelApiKey);
    logger?.log({
      level: "info",
      category: "audit",
      event: "model.provider.managed",
      message: "Login-managed model provider synchronized",
      context: { providerId: provider.provider.id, outcome: "success" },
    });
  } catch (error) {
    await options.auth.logout().catch(() => undefined);
    await options.models.deactivateManagedZimoModel().catch(() => undefined);
    throw error;
  }
  await options.weixinAssistant.start().catch(() => undefined);
  return toAuthView(result.session);
}

export function registerAppIpcHandlers(
  register: RegisterIpcHandler,
  options: {
    auth: AuthService;
    models: ModelConfigurationService;
    settings: SettingsService;
    secrets: EncryptedFileSecretStore;
    weixinAssistant: WeixinAssistantService;
    automations: AutomationService;
    conversations: ConversationService;
    resolveOnboardingLogin: () => LoginInput;
  },
  logger?: StructuredLogger | null,
): void {
  register({
    channel: IPC_CHANNELS.appGetInfo,
    input: emptyRequestSchema,
    output: appInfoViewSchema,
    handle: () => ({
      name: "Zimo",
      version: app.getVersion(),
      platform: mapPlatform(),
      dataLocationLabel: "Zimo 本地数据目录",
      phase: "Phase 10",
    }),
  });
  register({
    channel: IPC_CHANNELS.authGetSession,
    input: emptyRequestSchema,
    output: authSessionViewSchema.nullable(),
    handle: async () => {
      const current = await options.auth.getSession();
      if (current && !(await options.models.hasManagedZimoModel())) {
        options.automations.cancelAll();
        options.conversations.cancelAll();
        await options.weixinAssistant.stop();
        await options.auth.logout();
        return null;
      }
      return current ? toAuthView(current) : null;
    },
  });
  register({
    channel: IPC_CHANNELS.authLogin,
    input: loginRequestSchema,
    output: authSessionViewSchema,
    handle: async ({ payload }) => {
      try {
        const session = await loginAndProvisionManagedModel(options, payload, logger);
        logger?.log({
          level: "info",
          category: "auth",
          event: "auth.login.succeeded",
          message: "Remote account login succeeded",
          context: { outcome: "success" },
        });
        return session;
      } catch (error) {
        await options.weixinAssistant.start().catch(() => undefined);
        logger?.log({
          level: "warn",
          category: "auth",
          event: "auth.login.failed",
          message: "Remote account login failed",
          context: {
            outcome: "failure",
            errorCode: error instanceof AppError ? error.code : "INTERNAL_UNEXPECTED",
          },
        });
        throw error;
      }
    },
  });
  register({
    channel: IPC_CHANNELS.authStartOnboarding,
    input: emptyRequestSchema,
    output: authSessionViewSchema,
    handle: async () => {
      try {
        const session = await loginAndProvisionManagedModel(
          options,
          options.resolveOnboardingLogin(),
          logger,
        );
        logger?.log({
          level: "info",
          category: "auth",
          event: "auth.onboarding.started",
          message: "Desktop onboarding session started",
          context: { outcome: "success" },
        });
        return session;
      } catch (error) {
        await options.weixinAssistant.start().catch(() => undefined);
        logger?.log({
          level: "warn",
          category: "auth",
          event: "auth.onboarding.failed",
          message: "Desktop onboarding session failed",
          context: {
            outcome: "failure",
            errorCode: error instanceof AppError ? error.code : "INTERNAL_UNEXPECTED",
          },
        });
        throw error;
      }
    },
  });
  register({
    channel: IPC_CHANNELS.authLogout,
    input: emptyRequestSchema,
    output: successViewSchema,
    handle: async () => {
      options.automations.cancelAll();
      options.conversations.cancelAll();
      await options.weixinAssistant.stop();
      await options.auth.logout();
      await options.models.deactivateManagedZimoModel();
      logger?.log({
        level: "info",
        category: "auth",
        event: "auth.logout.succeeded",
        message: "Account logout succeeded",
        context: { outcome: "success" },
      });
      return { success: true as const };
    },
  });
  register({
    channel: IPC_CHANNELS.settingsGet,
    input: emptyRequestSchema,
    output: appSettingsViewSchema,
    handle: () => options.settings.get(),
  });
  register({
    channel: IPC_CHANNELS.settingsUpdate,
    input: updateSettingsRequestSchema,
    output: appSettingsViewSchema,
    handle: ({ payload }) => options.settings.update(payload),
  });
  register({
    channel: IPC_CHANNELS.securityGetSecretStatus,
    input: emptyRequestSchema,
    output: secretStoreStatusViewSchema,
    handle: () => options.secrets.getStatus(),
  });
}
