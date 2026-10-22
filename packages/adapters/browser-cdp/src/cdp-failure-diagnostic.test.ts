import { describe, expect, it } from "vitest";

import { classifyCdpFailure, safeCdpMethod } from "./cdp-failure-diagnostic";

describe("CDP failure diagnostics", () => {
  it("classifies known transport failures without exposing the raw message", () => {
    expect(classifyCdpFailure(new Error("CDP command timed out"))).toBe("timeout");
    expect(classifyCdpFailure(new Error("CDP connection closed"))).toBe("connection_closed");
    expect(classifyCdpFailure(new Error("CDP connection failed"))).toBe("connection_failed");
    expect(classifyCdpFailure(new Error("CDP connection is not open"))).toBe(
      "connection_unavailable",
    );
    expect(classifyCdpFailure(new Error("secret=https://example.com/?token=value"))).toBe(
      "protocol_error",
    );
  });

  it("only accepts CDP command names as loggable methods", () => {
    expect(safeCdpMethod("DOM.scrollIntoViewIfNeeded")).toBe("DOM.scrollIntoViewIfNeeded");
    expect(safeCdpMethod("Page.navigate https://example.com/?token=value")).toBe("unknown");
  });
});
