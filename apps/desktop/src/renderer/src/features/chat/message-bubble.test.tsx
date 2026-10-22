// @vitest-environment jsdom
import type { DocumentArtifactView, MessageView } from "@zimo/contracts";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as copyMessageTextModule from "./copy-message-text";
import { MessageBubble, shouldShowReplyBubble } from "./message-bubble";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const conversationId = "22222222-2222-4222-8222-222222222222";
const createdAt = "2026-09-22T03:00:00.000Z";

function assistantMessage(overrides: Partial<MessageView> = {}): MessageView {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    conversationId,
    role: "assistant",
    content: "",
    status: "streaming",
    position: 1,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

const artifact: DocumentArtifactView = {
  id: "11111111-1111-4111-8111-111111111111",
  conversationId,
  messageId: "33333333-3333-4333-8333-333333333333",
  displayName: "季度报告.docx",
  mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  format: "docx",
  sizeBytes: 2048,
  status: "ready",
  currentRevisionId: "44444444-4444-4444-8444-444444444444",
  revisionId: "44444444-4444-4444-8444-444444444444",
  createdAt,
  updatedAt: createdAt,
};

function renderBubble(
  message: MessageView,
  artifacts: readonly DocumentArtifactView[] = [],
  extra: { onRegenerate?: () => void } = {},
) {
  return render(
    <Tooltip.Provider delayDuration={0}>
      <MessageBubble
        message={message}
        artifacts={artifacts}
        onExportArtifact={() => undefined}
        onPreviewArtifact={() => undefined}
        {...(extra.onRegenerate ? { onRegenerate: extra.onRegenerate } : {})}
      />
    </Tooltip.Provider>,
  );
}

describe("shouldShowReplyBubble", () => {
  it("hides the assistant bubble while thinking with no reply body", () => {
    expect(
      shouldShowReplyBubble({
        role: "assistant",
        status: "pending",
        content: "   ",
        hasArtifacts: false,
        hasCitations: false,
      }),
    ).toBe(false);
    expect(
      shouldShowReplyBubble({
        role: "assistant",
        status: "streaming",
        content: "",
        hasArtifacts: false,
        hasCitations: false,
      }),
    ).toBe(false);
  });

  it("shows the bubble once reply text, attachments, or a finished status exists", () => {
    expect(
      shouldShowReplyBubble({
        role: "assistant",
        status: "streaming",
        content: "今天多云。",
        hasArtifacts: false,
        hasCitations: false,
      }),
    ).toBe(true);
    expect(
      shouldShowReplyBubble({
        role: "assistant",
        status: "streaming",
        content: "",
        hasArtifacts: true,
        hasCitations: false,
      }),
    ).toBe(true);
    expect(
      shouldShowReplyBubble({
        role: "assistant",
        status: "completed",
        content: "",
        hasArtifacts: false,
        hasCitations: false,
      }),
    ).toBe(true);
    expect(
      shouldShowReplyBubble({
        role: "user",
        status: "completed",
        content: "深圳天气",
        hasArtifacts: false,
        hasCitations: false,
      }),
    ).toBe(true);
  });
});

describe("MessageBubble", () => {
  it("keeps thinking elapsed time and hides the empty reply pill", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-22T03:00:08.000Z"));
    renderBubble(assistantMessage());
    expect(screen.getByLabelText("思考过程").textContent).toContain("思考中 8s");
    expect(screen.queryByLabelText("回复内容")).toBeNull();
  });

  it("shows the reply bubble after streamed text arrives", () => {
    renderBubble(assistantMessage({ content: "今天多云。" }));
    expect(screen.getByLabelText("回复内容").textContent).toContain("今天多云。");
    expect(screen.getByText("11:00").closest("time")?.getAttribute("datetime")).toBe(createdAt);
  });

  it("shows the generating model snapshot on a finished reply", () => {
    renderBubble(
      assistantMessage({
        status: "completed",
        content: "今天多云。",
        modelDisplayName: "DeepSeek V4 Flash",
      }),
    );
    expect(screen.getByText("DeepSeek V4 Flash")).toBeTruthy();
  });

  it("omits the model name when the message has no generation snapshot", () => {
    renderBubble(assistantMessage({ status: "completed", content: "今天多云。" }));
    expect(screen.queryByText("DeepSeek V4 Flash")).toBeNull();
  });

  it("shows a finished reply time below its bubble without repeating it inside metadata", () => {
    renderBubble(
      assistantMessage({
        status: "completed",
        content: "今天多云。",
        updatedAt: "2026-09-22T03:05:00.000Z",
      }),
    );
    const bubble = screen.getByLabelText("回复内容");
    const time = screen.getByText("11:05").closest("time");
    expect(time?.getAttribute("datetime")).toBe("2026-09-22T03:05:00.000Z");
    expect(bubble.contains(time)).toBe(false);
    expect(bubble.classList.contains("rounded-[14px]")).toBe(true);
    expect(bubble.classList.contains("rounded-tl-none")).toBe(true);
    expect(bubble.querySelector("[class*='clip-path']")).toBeNull();
  });

  it("shows the reply bubble when only an attachment is ready", () => {
    renderBubble(assistantMessage(), [artifact]);
    expect(screen.getByLabelText("回复内容").textContent).toContain("季度报告.docx");
  });

  it("offers regenerate on a finished assistant reply", async () => {
    const onRegenerate = vi.fn();
    const user = userEvent.setup();
    renderBubble(assistantMessage({ status: "completed", content: "今天多云。" }), [], {
      onRegenerate,
    });
    const button = screen.getByRole("button", { name: "重新生成" });
    await user.click(button);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    await user.hover(button);
    expect(
      screen.getByText("点击将重新生成内容，此会话后的内容都将被覆盖，请谨慎操作"),
    ).toBeTruthy();
  });

  it("offers regenerate after a cancelled or failed reply", () => {
    renderBubble(assistantMessage({ status: "cancelled", content: "半段回答" }), [], {
      onRegenerate: () => undefined,
    });
    expect(screen.getByRole("button", { name: "重新生成" })).toBeTruthy();
  });

  it("hides regenerate when the parent does not enable it", () => {
    renderBubble(assistantMessage({ status: "completed", content: "今天多云。" }));
    expect(screen.queryByRole("button", { name: "重新生成" })).toBeNull();
  });

  it("always shows user message time and reveals copy on hover", async () => {
    const copyMessageText = vi.spyOn(copyMessageTextModule, "copyMessageText").mockResolvedValue();
    const user = userEvent.setup();
    renderBubble({
      id: "55555555-5555-4555-8555-555555555555",
      conversationId,
      role: "user",
      content: "你好",
      status: "completed",
      position: 0,
      createdAt: "2026-09-22T07:11:00.000Z",
      updatedAt: "2026-09-22T07:11:00.000Z",
    });
    expect(screen.getByText("15:11")).toBeTruthy();
    expect(screen.getByText("15:11").closest(".opacity-0")).toBeNull();
    expect(screen.getByLabelText("用户消息").classList.contains("rounded-[14px]")).toBe(true);
    expect(screen.getByLabelText("用户消息").classList.contains("rounded-tr-none")).toBe(true);
    const copyButton = screen.getByRole("button", { name: "复制" });
    expect(copyButton.closest(".opacity-0")).toBeTruthy();
    await user.hover(screen.getByLabelText("用户消息"));
    await user.click(copyButton);
    expect(copyMessageText).toHaveBeenCalledWith("你好");
    expect(screen.getByRole("button", { name: "已复制" })).toBeTruthy();
  });

  it("shows copy failure for user messages", async () => {
    vi.spyOn(copyMessageTextModule, "copyMessageText").mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    renderBubble({
      id: "55555555-5555-4555-8555-555555555555",
      conversationId,
      role: "user",
      content: "你好",
      status: "completed",
      position: 0,
      createdAt: "2026-09-22T07:11:00.000Z",
      updatedAt: "2026-09-22T07:11:00.000Z",
    });
    await user.click(screen.getByRole("button", { name: "复制" }));
    expect(screen.getByRole("alert").textContent).toBe("复制失败");
  });
});
