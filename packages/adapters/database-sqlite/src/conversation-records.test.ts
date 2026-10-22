import { describe, expect, it } from "vitest";

import { parseMessageSteps, serializeMessageSteps } from "./conversation-records";

describe("message steps persistence", () => {
  it("round-trips schema version 1 steps and ignores malformed items", () => {
    const steps = [
      {
        id: "call-1",
        kind: "file_read" as const,
        title: "读取 notes.md",
        status: "completed" as const,
        resultTitle: "已读取 notes.md",
        relativeTarget: "notes.md",
      },
    ];
    expect(parseMessageSteps(serializeMessageSteps(steps))).toEqual(steps);
    expect(parseMessageSteps(null)).toBeUndefined();
    expect(
      parseMessageSteps(
        JSON.stringify({
          schemaVersion: 1,
          steps: [steps[0], { id: "bad" }, "nope"],
        }),
      ),
    ).toEqual(steps);
  });
});
