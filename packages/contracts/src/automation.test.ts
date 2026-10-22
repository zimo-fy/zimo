import { describe, expect, it } from "vitest";

import { automationTaskListChangedSchema } from "./automation";

describe("automationTaskListChangedSchema", () => {
  it("accepts a content-free notification and rejects additional fields", () => {
    expect(automationTaskListChangedSchema.safeParse({}).success).toBe(true);
    expect(automationTaskListChangedSchema.safeParse({ prompt: "private" }).success).toBe(false);
  });
});
