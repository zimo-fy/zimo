export interface BrowserTarget {
  id: string;
  title: string;
  url: string;
  active: boolean;
}

export interface BrowserSnapshot {
  targetId: string;
  snapshotId: string;
  title: string;
  url: string;
  content: string;
  elementCount: number;
  truncated: boolean;
}

export interface BrowserScreenshot {
  targetId: string;
  fileName: string;
  mediaType: "image/png";
  width?: number;
  height?: number;
}

export type BrowserKey = "Enter" | "Escape" | "Tab" | "ArrowUp" | "ArrowDown" | "Space";

export interface BrowserAutomationGateway {
  listTabs(signal: AbortSignal): Promise<readonly BrowserTarget[]>;
  open(url: string, signal: AbortSignal): Promise<BrowserTarget>;
  focus(targetId: string, signal: AbortSignal): Promise<void>;
  snapshot(targetId: string, signal: AbortSignal): Promise<BrowserSnapshot>;
  screenshot(
    conversationId: string,
    targetId: string,
    signal: AbortSignal,
  ): Promise<BrowserScreenshot>;
  navigate(targetId: string, url: string, signal: AbortSignal): Promise<void>;
  click(targetId: string, snapshotId: string, ref: string, signal: AbortSignal): Promise<void>;
  type(
    targetId: string,
    snapshotId: string,
    ref: string,
    text: string,
    signal: AbortSignal,
  ): Promise<void>;
  press(
    targetId: string,
    snapshotId: string | undefined,
    ref: string | undefined,
    key: BrowserKey,
    signal: AbortSignal,
  ): Promise<void>;
  scroll(
    targetId: string,
    snapshotId: string,
    ref: string | undefined,
    deltaX: number,
    deltaY: number,
    signal: AbortSignal,
  ): Promise<void>;
  wait(targetId: string, timeoutMs: number, signal: AbortSignal): Promise<BrowserSnapshot>;
  close(): Promise<void>;
}
