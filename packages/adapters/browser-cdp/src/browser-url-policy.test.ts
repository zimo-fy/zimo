import { describe, expect, it } from "vitest";

import { requirePublicBrowserUrl } from "./browser-url-policy";

describe("requirePublicBrowserUrl", () => {
  it("allows public HTTP and HTTPS IP addresses", async () => {
    await expect(requirePublicBrowserUrl("https://8.8.8.8/path")).resolves.toBe(
      "https://8.8.8.8/path",
    );
  });

  it.each([
    "file:///tmp/data",
    "http://127.0.0.1/",
    "http://192.168.1.2/",
    "https://user:pass@8.8.8.8/",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(requirePublicBrowserUrl(url)).rejects.toThrow("not allowed");
  });
});
