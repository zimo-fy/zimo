import type { LoginInput } from "@zimo/domain";
import type { ZimoAuthGateway, ZimoLoginResult } from "@zimo/auth-zimo";

import {
  isLocalOnboardingLogin,
  LOCAL_ONBOARDING_TOKEN,
  LOCAL_ONBOARDING_USERNAME,
} from "./auth-onboarding";

const LOCAL_SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export class DesktopOnboardingAuthGateway implements ZimoAuthGateway {
  constructor(
    private readonly inner: ZimoAuthGateway,
    private readonly enabled: boolean,
    private readonly modelApiKey: string,
    private readonly now: () => Date,
  ) {}

  login(input: LoginInput): Promise<ZimoLoginResult> {
    if (this.enabled && isLocalOnboardingLogin(input)) {
      const expiresAt = new Date(this.now().getTime() + LOCAL_SESSION_DURATION_MS);
      return Promise.resolve({
        token: LOCAL_ONBOARDING_TOKEN,
        modelApiKey: this.modelApiKey,
        externalUserId: "local-onboarding-user",
        account: LOCAL_ONBOARDING_USERNAME,
        displayName: "Zimo 用户",
        expiresAt,
      });
    }
    return this.inner.login(input);
  }

  verify(token: string): Promise<{ valid: boolean; externalUserId?: string }> {
    if (this.enabled && token === LOCAL_ONBOARDING_TOKEN) {
      return Promise.resolve({ valid: true, externalUserId: "local-onboarding-user" });
    }
    return this.inner.verify(token);
  }
}
