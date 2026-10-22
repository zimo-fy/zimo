import { describe, expect, it } from "vitest";

import { isLoopbackAuthBaseUrl, resolveOnboardingLogin } from "./auth-onboarding";

describe("resolveOnboardingLogin", () => {
  it("uses the e2e credentials for loopback auth servers", () => {
    expect(
      resolveOnboardingLogin({
        authBaseUrl: "http://127.0.0.1:4321/dev-api/",
        packaged: false,
        rendererUrl: "http://localhost:5173",
      }),
    ).toEqual({ username: "staff-01", password: "test-password" });
  });

  it("uses local onboarding credentials in the development desktop shell", () => {
    expect(
      resolveOnboardingLogin({
        authBaseUrl: null,
        packaged: false,
        rendererUrl: "http://localhost:5173",
      }),
    ).toEqual({ username: "zimo-local-onboarding", password: "zimo-local-onboarding" });
  });

  it("rejects onboarding in packaged production builds", () => {
    expect(() =>
      resolveOnboardingLogin({
        authBaseUrl: null,
        packaged: true,
      }),
    ).toThrowError(expect.objectContaining({ code: "AUTH_ONBOARDING_UNAVAILABLE" }));
  });
});

describe("isLoopbackAuthBaseUrl", () => {
  it("detects localhost auth endpoints", () => {
    expect(isLoopbackAuthBaseUrl("http://127.0.0.1:8080/dev-api/")).toBe(true);
    expect(isLoopbackAuthBaseUrl("https://zimo.example.com/dev-api/")).toBe(false);
  });
});
