import { describe, expect, it } from "vitest";

import { websiteServerOptions } from "./vite.config";

describe("website development server", () => {
  it("listens on the configured LAN port", () => {
    expect(websiteServerOptions).toEqual({
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
    });
  });
});
