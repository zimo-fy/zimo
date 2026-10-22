// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyMessageText } from "./copy-message-text";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copyMessageText", () => {
  it("falls back to execCommand when clipboard.writeText rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { clipboard: { writeText } });
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);

    await copyMessageText("你好");

    expect(writeText).toHaveBeenCalledWith("你好");
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("uses clipboard.writeText when it succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const execCommand = vi.spyOn(document, "execCommand");

    await copyMessageText("你好");

    expect(writeText).toHaveBeenCalledWith("你好");
    expect(execCommand).not.toHaveBeenCalled();
  });
});
