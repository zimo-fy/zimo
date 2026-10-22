import { describe, expect, it } from "vitest";

import { redact } from "./index";

describe("redact", () => {
  it("removes nested credentials and URL query values", () => {
    const result = redact({
      apiKey: "sk-canary",
      nested: {
        authorization: "Bearer canary",
        endpoint: "https://example.com/path?token=canary#fragment",
      },
    });

    expect(result).toEqual({
      apiKey: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
        endpoint: "https://example.com/path",
      },
    });
    expect(JSON.stringify(result)).not.toContain("canary");
  });

  it("redacts in-memory image data URLs", () => {
    const result = redact({
      image_url: { url: "data:image/jpeg;base64,QUJD" },
      nested: "data:image/png;base64,QUJD",
    });
    expect(JSON.stringify(result)).not.toContain("QUJD");
    expect(result).toMatchObject({
      image_url: "[REDACTED]",
      nested: "[REDACTED_IMAGE]",
    });
  });

  it("handles circular objects safely", () => {
    const value: Record<string, unknown> = {};
    value.self = value;
    expect(redact(value)).toEqual({ self: "[CIRCULAR]" });
  });
});
