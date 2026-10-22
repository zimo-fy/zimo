import { describe, expect, it } from "vitest";

import { BrowserRunLease } from "./browser-run-lease";

describe("BrowserRunLease", () => {
  it("keeps one run in control until its tool loop closes", () => {
    const lease = new BrowserRunLease();
    lease.claim("first");
    lease.claim("first");
    expect(() => lease.claim("second")).toThrowError(
      expect.objectContaining({ code: "BROWSER_RUN_BUSY" }),
    );
    lease.release("second");
    expect(() => lease.claim("second")).toThrow();
    lease.release("first");
    expect(() => lease.claim("second")).not.toThrow();
  });
});
