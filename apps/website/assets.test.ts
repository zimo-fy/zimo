import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { menuFeatureSteps } from "./src/menu-feature-steps";

function readPngSize(content: Buffer): { readonly width: number; readonly height: number } {
  expect(content.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: content.readUInt32BE(16),
    height: content.readUInt32BE(20),
  };
}

describe("website product assets", () => {
  it("uses the desktop application logo", async () => {
    const [desktopLogo, websiteLogo] = await Promise.all([
      readFile(resolve("apps/desktop/resources/icon.png")),
      readFile(resolve("apps/website/public/zimo-icon.png")),
    ]);

    expect(websiteLogo.equals(desktopLogo)).toBe(true);
  });

  it("ships real product screenshots for desktop and narrow layouts", async () => {
    const [desktopScreenshot, mobileScreenshot] = await Promise.all([
      readFile(resolve("apps/website/public/screenshots/zimo-conversation.png")),
      readFile(resolve("apps/website/public/screenshots/zimo-conversation-mobile.png")),
    ]);

    expect(readPngSize(desktopScreenshot)).toEqual({ width: 1440, height: 900 });
    expect(readPngSize(mobileScreenshot)).toEqual({ width: 480, height: 800 });
  });

  it("keeps a screenshot file for every user-feature step", async () => {
    const files = Object.values(menuFeatureSteps).flatMap((steps) =>
      steps.map((step) => resolve("apps/website/public", step.src.replace(/^\//, ""))),
    );
    await Promise.all(files.map((file) => access(file)));
  });
});
