import { describe, expect, it } from "vitest";

import { createFailureDiagnostic } from "./provider-failure-diagnostic";

describe("createFailureDiagnostic", () => {
  it("records bounded cause and request sizes without logging sensitive values", () => {
    const cause = Object.assign(new Error("secret socket details"), {
      code: "ECONNRESET",
      cause: new Error("secret nested details"),
    });
    const error = Object.assign(new Error("secret provider response"), { cause });
    const diagnostic = createFailureDiagnostic("tool_followup", Date.now() - 10, error, {
      messages: [
        { role: "user", content: "secret user" },
        { role: "tool", content: "secret tool", name: "inspect", toolCallId: "call-1" },
      ],
      tools: [{ name: "inspect", description: "secret schema", inputSchema: { type: "object" } }],
    });

    expect(diagnostic).toMatchObject({
      operation: "tool_followup",
      errorName: "Error",
      transportKind: "connection_reset",
      causes: [{ name: "Error", code: "ECONNRESET" }, { name: "Error" }],
      requestMessageCount: 2,
      requestToolCount: 1,
      requestMessageCharacters: 22,
      requestToolResultCharacters: 11,
    });
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  it("does not expose arbitrary error names or codes and stops on cyclic causes", () => {
    const error = Object.assign(new Error("private-url"), {
      name: "secret-name",
      code: "secret-code",
      cause: undefined as unknown,
    });
    error.cause = error;

    const diagnostic = createFailureDiagnostic("stream", Date.now(), error);

    expect(diagnostic.errorName).toBe("OtherError");
    expect(diagnostic.errorCode).toBeUndefined();
    expect(diagnostic.causes).toEqual([{ name: "OtherError" }]);
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  it("classifies a nested connection close without logging its message", () => {
    const error = Object.assign(new Error("private provider details"), {
      cause: new Error("other side closed: private-host"),
    });

    const diagnostic = createFailureDiagnostic("tool_followup", Date.now(), error);

    expect(diagnostic.transportKind).toBe("connection_closed");
    expect(JSON.stringify(diagnostic)).not.toContain("private");
  });
});
