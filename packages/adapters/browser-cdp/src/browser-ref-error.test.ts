import { describe, expect, it } from "vitest";

import { LocalCdpBrowserGateway } from "./index";

describe("browser snapshot references", () => {
  it("distinguishes a missing ref from an expired snapshot", async () => {
    const gateway = new LocalCdpBrowserGateway("unused-profile", "unused-workspace");
    Object.assign(gateway, {
      snapshots: new Map([["target", { snapshotId: "current", elements: new Map() }]]),
    });
    const signal = new AbortController().signal;

    await expect(
      gateway.type("target", "current", "[contenteditable]", "", signal),
    ).rejects.toMatchObject({ code: "BROWSER_REF_NOT_FOUND" });
    await expect(gateway.type("target", "expired", "ref_1", "", signal)).rejects.toMatchObject({
      code: "BROWSER_SNAPSHOT_STALE",
    });
  });
});
