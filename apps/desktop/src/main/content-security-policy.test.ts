import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "./content-security-policy";

describe("buildContentSecurityPolicy", () => {
  it("allows the Vite React refresh preamble only during development", () => {
    const policy = buildContentSecurityPolicy(true);

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self' ws: http://localhost:*");
  });

  it("keeps production scripts restricted to packaged resources", () => {
    const policy = buildContentSecurityPolicy(false);

    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self';");
    expect(policy).toContain("img-src 'self' data: zimo-doc:");
  });
});
