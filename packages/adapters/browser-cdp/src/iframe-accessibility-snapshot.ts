import {
  MAX_SNAPSHOT_CHARACTERS,
  MAX_SNAPSHOT_NODES,
  parseAccessibilitySnapshot,
  type SnapshotElement,
} from "./accessibility-snapshot";
import { discoverContentEditableElements } from "./content-editable-elements";

type CdpSend = (method: string, params: Readonly<Record<string, unknown>>) => Promise<unknown>;

export type BrowserAccessibilitySnapshot = {
  snapshotId: string;
  content: string;
  elements: ReadonlyMap<string, SnapshotElement>;
  truncated: boolean;
};

const MAX_IFRAMES = 16;

export async function readBrowserAccessibilitySnapshot(
  send: CdpSend,
  signal: AbortSignal,
): Promise<BrowserAccessibilitySnapshot> {
  await send("Page.enable", {});
  await send("Accessibility.enable", {});
  await send("DOM.enable", {});
  const frameTree = await send("Page.getFrameTree", {});
  const { frameIds, truncated: frameListTruncated } = collectFrameIds(frameTree);
  const hasIframes = frameIds.length > 0;
  // Reserve space for iframe nodes so a large navigation shell cannot hide them.
  const main = parseAccessibilitySnapshot(await send("Accessibility.getFullAXTree", {}), {
    maxNodes: hasIframes ? Math.floor(MAX_SNAPSHOT_NODES / 2) : MAX_SNAPSHOT_NODES,
    maxCharacters: hasIframes ? Math.floor(MAX_SNAPSHOT_CHARACTERS / 2) : MAX_SNAPSHOT_CHARACTERS,
  });
  const supplemented = await discoverContentEditableElements(
    send,
    main.elements,
    MAX_SNAPSHOT_NODES - main.nodeCount,
  );
  const elements = new Map(main.elements);
  const markedMainContent = main.content
    .split("\n")
    .map((line) => {
      const ref = /^\s*\[(ref_\d+)\] generic(?:\s|$)/u.exec(line)?.[1];
      return ref && supplemented.existingEditableRefs.has(ref)
        ? line.replace(/^(\s*)\[(ref_\d+)\] generic/u, `$1[$2] textbox`)
        : line;
    })
    .join("\n");
  const lines = markedMainContent ? [markedMainContent] : [];
  let characters = markedMainContent.length;
  let addedContentEditable = 0;
  let truncated = main.truncated || frameListTruncated;
  for (const line of supplemented.lines) {
    if (characters + line.length + 1 > MAX_SNAPSHOT_CHARACTERS) {
      truncated = true;
      break;
    }
    const ref = /^\[(ref_\d+)\]/.exec(line)?.[1];
    const element = ref ? supplemented.elements.get(ref) : undefined;
    if (!ref || !element) continue;
    lines.push(line);
    elements.set(ref, element);
    characters += line.length + 1;
    addedContentEditable += 1;
  }
  let remainingNodes = MAX_SNAPSHOT_NODES - main.nodeCount - addedContentEditable;

  for (const [index, frameId] of frameIds.entries()) {
    const label = `[iframe ${index + 1}]`;
    if (remainingNodes <= 0 || characters + label.length + 2 >= MAX_SNAPSHOT_CHARACTERS) {
      truncated = true;
      break;
    }
    let frame;
    try {
      frame = parseAccessibilitySnapshot(await send("Accessibility.getFullAXTree", { frameId }), {
        refPrefix: `iframe_${index + 1}_ref_`,
        maxNodes: remainingNodes,
        maxCharacters: MAX_SNAPSHOT_CHARACTERS - characters - label.length - 2,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      // A detached or out-of-process frame must not erase the usable main-frame snapshot.
      lines.push(`${label} 内容暂不可读取，请稍后重新读取网页结构。`);
      truncated = true;
      break;
    }
    remainingNodes -= frame.nodeCount;
    truncated ||= frame.truncated;
    lines.push(label, frame.content);
    characters = lines.join("\n").length;
    for (const [ref, element] of frame.elements) elements.set(ref, element);
  }
  return {
    snapshotId: main.snapshotId,
    content: lines.filter(Boolean).join("\n"),
    elements,
    truncated,
  };
}

function collectFrameIds(value: unknown): { frameIds: readonly string[]; truncated: boolean } {
  const root = record(record(value).frameTree);
  const frameIds: string[] = [];
  const stack = childFrames(root).reverse();
  let truncated = false;
  while (stack.length > 0) {
    const entry = record(stack.pop());
    const id = record(entry.frame).id;
    if (typeof id === "string" && id.length > 0 && id.length <= 160) {
      if (frameIds.length === MAX_IFRAMES) {
        truncated = true;
        break;
      }
      frameIds.push(id);
    }
    stack.push(...childFrames(entry).reverse());
  }
  return { frameIds, truncated };
}

function childFrames(value: Record<string, unknown>): unknown[] {
  return Array.isArray(value.childFrames) ? value.childFrames.slice(0, MAX_IFRAMES + 1) : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
