import { describe, expect, it } from "vitest";

import { parseBrowserEndpoint } from "./browser-process";

describe("parseBrowserEndpoint", () => {
  it("accepts the endpoint emitted by the launched browser on the selected port", () => {
    expect(
      parseBrowserEndpoint(
        "DevTools listening on ws://127.0.0.1:49152/devtools/browser/abc-123\n",
        49152,
      ),
    ).toBe("ws://127.0.0.1:49152/devtools/browser/abc-123");
  });

  it("rejects an endpoint on a different port or address", () => {
    expect(
      parseBrowserEndpoint("DevTools listening on ws://127.0.0.1:9222/devtools/browser/abc", 49152),
    ).toBeUndefined();
    expect(
      parseBrowserEndpoint(
        "DevTools listening on ws://192.0.2.1:49152/devtools/browser/abc",
        49152,
      ),
    ).toBeUndefined();
  });
});
