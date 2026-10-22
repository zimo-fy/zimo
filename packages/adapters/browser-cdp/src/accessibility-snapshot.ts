import { randomUUID } from "node:crypto";

export const MAX_SNAPSHOT_NODES = 2_000;
export const MAX_SNAPSHOT_CHARACTERS = 150_000;

export type SnapshotParseOptions = {
  refPrefix?: string;
  maxNodes?: number;
  maxCharacters?: number;
};

export type SnapshotElement = {
  backendNodeId: number;
  isProtected: boolean;
};

export type ParsedSnapshot = {
  snapshotId: string;
  content: string;
  elements: ReadonlyMap<string, SnapshotElement>;
  elementCount: number;
  nodeCount: number;
  truncated: boolean;
};

export function parseAccessibilitySnapshot(
  value: unknown,
  options: SnapshotParseOptions = {},
): ParsedSnapshot {
  const nodes = readRecord(value).nodes;
  if (!Array.isArray(nodes)) throw new Error("Invalid accessibility snapshot");
  const maxNodes = options.maxNodes ?? MAX_SNAPSHOT_NODES;
  const maxCharacters = options.maxCharacters ?? MAX_SNAPSHOT_CHARACTERS;
  const refPrefix = options.refPrefix ?? "ref_";
  const elements = new Map<string, SnapshotElement>();
  const lines: string[] = [];
  const nodesById = new Map<string, Record<string, unknown>>();
  const parentsById = new Map<string, Record<string, unknown>>();
  for (const entry of nodes) {
    const node = readRecord(entry);
    if (typeof node.nodeId === "string") nodesById.set(node.nodeId, node);
  }
  for (const node of nodesById.values()) {
    if (!Array.isArray(node.childIds)) continue;
    for (const childId of node.childIds) {
      if (typeof childId === "string") parentsById.set(childId, node);
    }
  }
  let characters = 0;
  let nodeCount = 0;
  let truncated = false;
  for (const { node, depth } of accessibilityNodesInTreeOrder(nodes)) {
    if (node.ignored === true || isRedundantNode(node, parentsById)) continue;
    if (nodeCount === maxNodes) {
      truncated = true;
      break;
    }
    nodeCount += 1;
    const role = propertyValue(node.role) || "generic";
    const name = propertyValue(node.name);
    const backendNodeId = positiveInteger(node.backendDOMNodeId);
    const isProtected = hasProtectedProperty(node.properties);
    const ref = backendNodeId ? `${refPrefix}${elements.size + 1}` : undefined;
    const valueText = isProtected ? "" : propertyValue(node.value);
    const detail = [
      name ? JSON.stringify(name) : "",
      valueText ? `value=${JSON.stringify(valueText)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const line = `${"  ".repeat(Math.min(depth, 32))}${ref ? `[${ref}] ` : ""}${role}${detail ? ` ${detail}` : ""}`;
    if (characters + line.length + 1 > maxCharacters) {
      truncated = true;
      break;
    }
    if (ref && backendNodeId) elements.set(ref, { backendNodeId, isProtected });
    lines.push(line);
    characters += line.length + 1;
  }
  return {
    snapshotId: randomUUID(),
    content: lines.join("\n"),
    elements,
    elementCount: elements.size,
    nodeCount,
    truncated,
  };
}

function* accessibilityNodesInTreeOrder(
  nodes: readonly unknown[],
): Generator<{ node: Record<string, unknown>; depth: number }> {
  const indicesById = new Map<string, number>();
  const childIndices = new Map<number, number[]>();
  const referenced = new Set<number>();
  for (const [index, entry] of nodes.entries()) {
    const id = readRecord(entry).nodeId;
    if (typeof id === "string" && !indicesById.has(id)) indicesById.set(id, index);
  }
  for (const [index, entry] of nodes.entries()) {
    const ids = readRecord(entry).childIds;
    if (!Array.isArray(ids)) continue;
    const children = ids
      .map((id) => (typeof id === "string" ? indicesById.get(id) : undefined))
      .filter((child): child is number => child !== undefined);
    childIndices.set(index, children);
    for (const child of children) referenced.add(child);
  }

  const visited = new Set<number>();
  const stack: Array<{ index: number; depth: number }> = [];
  function* visit(): Generator<{ node: Record<string, unknown>; depth: number }> {
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current.index)) continue;
      visited.add(current.index);
      yield { node: readRecord(nodes[current.index]), depth: current.depth };
      const children = childIndices.get(current.index) ?? [];
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) stack.push({ index: child, depth: current.depth + 1 });
      }
    }
  }

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    if (!referenced.has(index)) stack.push({ index, depth: 0 });
  }
  yield* visit();
  // Malformed or detached CDP subtrees must remain visible, but cannot borrow another ref.
  for (let index = 0; index < nodes.length; index += 1) {
    if (visited.has(index)) continue;
    stack.push({ index, depth: 0 });
    yield* visit();
  }
}

function isRedundantNode(
  node: Record<string, unknown>,
  nodesById: ReadonlyMap<string, Record<string, unknown>>,
): boolean {
  const role = propertyValue(node.role).toLowerCase();
  const name = propertyValue(node.name);
  if (role === "inlinetextbox" || role === "linebreak") return true;
  if (role !== "statictext" && role !== "emphasis") return false;
  if (!name.trim() || /^[·丨—/|\s]+$/u.test(name)) return true;
  const parent = typeof node.nodeId === "string" ? nodesById.get(node.nodeId) : undefined;
  return Boolean(parent && parent.ignored !== true && propertyValue(parent.name).includes(name));
}

function propertyValue(value: unknown): string {
  const raw = readRecord(value).value;
  return typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
    ? String(raw).slice(0, 1_000)
    : "";
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function hasProtectedProperty(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) => {
    const property = readRecord(entry);
    return property.name === "protected" && propertyValue(property.value) === "true";
  });
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
