import type { LoginInput } from "@zimo/domain";
import { AppError } from "@zimo/domain";

import { canEditManagedModel } from "./model-configuration";

export const LOCAL_ONBOARDING_USERNAME = "zimo-local-onboarding";
export const LOCAL_ONBOARDING_PASSWORD = "zimo-local-onboarding";
export const LOCAL_ONBOARDING_TOKEN = "zimo-local-onboarding-token";

export function isLoopbackAuthBaseUrl(authBaseUrl: string): boolean {
  try {
    const url = new URL(authBaseUrl);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

export function resolveOnboardingLogin(options: {
  authBaseUrl: string | null;
  packaged: boolean;
  rendererUrl?: string | undefined;
}): LoginInput {
  if (options.authBaseUrl && isLoopbackAuthBaseUrl(options.authBaseUrl)) {
    return { username: "staff-01", password: "test-password" };
  }
  if (canEditManagedModel({ packaged: options.packaged, rendererUrl: options.rendererUrl })) {
    return { username: LOCAL_ONBOARDING_USERNAME, password: LOCAL_ONBOARDING_PASSWORD };
  }
  throw new AppError({
    code: "AUTH_ONBOARDING_UNAVAILABLE",
    category: "configuration",
    userMessage: "当前环境无法开始使用，请联系管理员。",
  });
}

export function isLocalOnboardingLogin(input: LoginInput): boolean {
  return (
    input.username === LOCAL_ONBOARDING_USERNAME && input.password === LOCAL_ONBOARDING_PASSWORD
  );
}
