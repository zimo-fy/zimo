import { AuthService, SettingsService } from "@zimo/application";
import { ZimoAuthProvider, ZimoHttpAuthGateway } from "@zimo/auth-zimo";
import {
  SQLiteAppSettingsStore,
  SQLiteSessionStore,
  type ZimoDatabase,
} from "@zimo/database-sqlite";
import type { Clock, IdGenerator } from "@zimo/domain";
import { EncryptedFileSecretStore } from "@zimo/secret-store";
import { join } from "node:path";

import { resolveAuthBaseUrl } from "./auth-configuration";
import { DesktopOnboardingAuthGateway } from "./desktop-onboarding-auth-gateway";
import { UnconfiguredRemoteAuthGateway } from "./unconfigured-remote-auth-gateway";
import { ElectronEncryptionBackend } from "./electron-encryption-backend";
import { canEditManagedModel } from "./model-configuration";

export function createAppFoundationServices(options: {
  database: ZimoDatabase;
  userDataPath: string;
  clock: Clock;
  ids: IdGenerator;
  packaged: boolean;
  authEndpointOverride?: string | undefined;
  devModelApiKey?: string | undefined;
}) {
  const secrets = new EncryptedFileSecretStore(
    join(options.userDataPath, "secrets.enc"),
    new ElectronEncryptionBackend(),
  );
  const sessions = new SQLiteSessionStore(options.database);
  const authBaseUrl = resolveAuthBaseUrl({
    packaged: options.packaged,
    override: options.authEndpointOverride,
  });
  const allowLocalOnboarding = canEditManagedModel({
    packaged: options.packaged,
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
  });
  const remoteAuthGateway = authBaseUrl
    ? new ZimoHttpAuthGateway(authBaseUrl)
    : new UnconfiguredRemoteAuthGateway();
  const authGateway = new DesktopOnboardingAuthGateway(
    remoteAuthGateway,
    allowLocalOnboarding,
    options.devModelApiKey?.trim() || "local-dev-model-key-canary",
    () => options.clock.now(),
  );
  const auth = new AuthService(
    new ZimoAuthProvider(sessions, secrets, authGateway, options.clock, options.ids),
  );
  return {
    auth,
    authBaseUrl,
    secrets,
    sessions,
    settings: new SettingsService(new SQLiteAppSettingsStore(options.database)),
  };
}
