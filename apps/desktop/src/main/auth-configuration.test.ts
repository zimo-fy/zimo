import { describe, expect, it } from "vitest";

import { resolveAuthBaseUrl } from "./auth-configuration";

describe("resolveAuthBaseUrl", () => {
  it("does not configure remote auth in packaged builds", () => {
    expect(resolveAuthBaseUrl({ packaged: true, override: "http://127.0.0.1:9000/" })).toBeNull();
  });

  it("returns null when development has no override", () => {
    expect(resolveAuthBaseUrl({ packaged: false })).toBeNull();
  });

  it("allows only loopback overrides during development", () => {
    expect(
      resolveAuthBaseUrl({ packaged: false, override: "http://127.0.0.1:9000/dev-api/" }),
    ).toBe("http://127.0.0.1:9000/dev-api/");
    expect(() =>
      resolveAuthBaseUrl({ packaged: false, override: "https://attacker.example/dev-api/" }),
    ).toThrow(/loopback/u);
  });
});
