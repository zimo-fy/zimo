import type {
  AppSettings,
  AppSettingsStore,
  AuthLoginResult,
  AuthProvider,
  AuthSession,
  LoginInput,
} from "@zimo/domain";

export class AuthService {
  constructor(private readonly provider: AuthProvider) {}

  login(input: LoginInput): Promise<AuthLoginResult> {
    return this.provider.login(input);
  }

  logout(): Promise<void> {
    return this.provider.logout();
  }

  getSession(): Promise<AuthSession | null> {
    return this.provider.getSession();
  }
}

export class SettingsService {
  constructor(private readonly store: AppSettingsStore) {}

  get(): Promise<AppSettings> {
    return this.store.get();
  }

  async update(patch: {
    appearance?: AppSettings["appearance"] | undefined;
    logLevel?: AppSettings["logLevel"] | undefined;
    reduceMotion?: boolean | undefined;
  }): Promise<AppSettings> {
    const current = await this.store.get();
    const next: AppSettings = {
      appearance: "light",
      logLevel: patch.logLevel ?? current.logLevel,
      reduceMotion: patch.reduceMotion ?? current.reduceMotion,
    };
    await this.store.save(next);
    return next;
  }
}
