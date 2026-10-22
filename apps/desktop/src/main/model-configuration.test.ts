import { describe, expect, it } from "vitest";

import { canEditManagedModel } from "./model-configuration";

describe("canEditManagedModel", () => {
  it("enables managed editing only for an unpackaged development server", () => {
    expect(canEditManagedModel({ packaged: false, rendererUrl: "http://localhost:5173" })).toBe(
      true,
    );
    expect(canEditManagedModel({ packaged: false })).toBe(false);
    expect(canEditManagedModel({ packaged: true, rendererUrl: "http://localhost:5173" })).toBe(
      false,
    );
  });
});
