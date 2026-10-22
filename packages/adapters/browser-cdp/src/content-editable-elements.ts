import type { SnapshotElement } from "./accessibility-snapshot";

const MAX_CONTENT_EDITABLE_ELEMENTS = 20;

export async function discoverContentEditableElements(
  send: (method: string, params: Readonly<Record<string, unknown>>) => Promise<unknown>,
  existing: ReadonlyMap<string, SnapshotElement>,
  maxAdditionalElements = MAX_CONTENT_EDITABLE_ELEMENTS,
): Promise<{
  elements: ReadonlyMap<string, SnapshotElement>;
  lines: readonly string[];
  existingEditableRefs: ReadonlySet<string>;
}> {
  const elements = new Map(existing);
  const refsByBackendNodeId = new Map(
    [...elements].map(([ref, element]) => [element.backendNodeId, ref]),
  );
  const document = record(await send("DOM.getDocument", { depth: 1, pierce: false }));
  const rootNodeId = positiveInteger(record(document.root).nodeId);
  if (!rootNodeId) return { elements, lines: [], existingEditableRefs: new Set<string>() };
  const queried = record(
    await send("DOM.querySelectorAll", {
      nodeId: rootNodeId,
      selector: '[contenteditable="true"]',
    }),
  );
  const nodeIds = Array.isArray(queried.nodeIds)
    ? queried.nodeIds.map(positiveInteger).filter((value): value is number => Boolean(value))
    : [];
  const lines: string[] = [];
  const existingEditableRefs = new Set<string>();
  for (const nodeId of nodeIds.slice(0, MAX_CONTENT_EDITABLE_ELEMENTS)) {
    const described = record(await send("DOM.describeNode", { nodeId }));
    const backendNodeId = positiveInteger(record(described.node).backendNodeId);
    if (!backendNodeId) continue;
    const existingRef = refsByBackendNodeId.get(backendNodeId);
    if (existingRef) {
      existingEditableRefs.add(existingRef);
      continue;
    }
    if (lines.length >= maxAdditionalElements) continue;
    const ref = `ref_${elements.size + 1}`;
    elements.set(ref, { backendNodeId, isProtected: false });
    refsByBackendNodeId.set(backendNodeId, ref);
    lines.push(`[${ref}] textbox "可编辑文本区域"`);
  }
  return { elements, lines, existingEditableRefs };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
