import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type {
  McpConnectionView,
  PrototypeDetailView,
  PrototypeSummaryView,
  ToolCapabilityView,
  WorkflowStreamEnvelopeView,
} from "@zimo/contracts";
import { Badge, Button, useAppDialog } from "@zimo/ui";
import { Check, ChevronLeft, GitBranch, Play, Redo2, Save, Undo2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cleanWorkflowNodeConfig,
  cloneWorkflowSnapshot,
  defaultWorkflowNodeConfig,
  isWorkflowConnectionAllowed,
  mapWorkflowEdges,
  mapWorkflowNodes,
  type NodeKind,
  toWorkflowEdgeDefinitions,
  toWorkflowNodeDefinitions,
  type WorkflowFlowEdge,
  type WorkflowFlowNode,
  type WorkflowNodeConfig,
  type WorkflowNodeData,
  type WorkflowSnapshot,
  workflowNodeCatalog,
} from "./workflow-canvas-model";
import { WorkflowNodeCard, WorkflowNodeLibrary } from "./workflow-node-components";
import { WorkflowNodeInspector } from "./workflow-node-inspector";
import { WorkflowTestPanel } from "./workflow-test-panel";

const nodeTypes = { zimoWorkflow: WorkflowNodeCard };

export function WorkflowCanvas({
  detail,
  availableMcpServers,
  onSave,
}: {
  detail: PrototypeDetailView;
  availableMcpServers: readonly McpConnectionView[];
  onSave(
    nodes: PrototypeDetailView["workflowNodes"],
    edges: PrototypeDetailView["workflowEdges"],
    mcpServerIds: readonly string[],
  ): Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen) {
    return (
      <section
        className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
        aria-labelledby="workflow-canvas-title"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 id="workflow-canvas-title" className="font-semibold text-neutral-900">
              工作流编排
            </h3>
            <p className="mt-1 text-sm text-neutral-500">
              {detail.workflowNodes.length} 个节点 · {detail.workflowEdges.length} 条连接 ·
              配置保存在本机
            </p>
          </div>
          <Button onClick={() => setIsOpen(true)}>
            <GitBranch size={16} /> 打开工作流编辑器
          </Button>
        </div>
      </section>
    );
  }
  return (
    <ReactFlowProvider>
      <WorkflowEditor
        detail={detail}
        availableMcpServers={availableMcpServers}
        onSave={onSave}
        onClose={() => setIsOpen(false)}
      />
    </ReactFlowProvider>
  );
}

function WorkflowEditor({
  detail,
  availableMcpServers,
  onSave,
  onClose,
}: {
  detail: PrototypeDetailView;
  availableMcpServers: readonly McpConnectionView[];
  onSave(
    nodes: PrototypeDetailView["workflowNodes"],
    edges: PrototypeDetailView["workflowEdges"],
    mcpServerIds: readonly string[],
  ): Promise<void>;
  onClose(): void;
}) {
  const { confirm } = useAppDialog();
  const [nodes, setNodes] = useState<WorkflowFlowNode[]>(() => mapWorkflowNodes(detail));
  const [edges, setEdges] = useState<WorkflowFlowEdge[]>(() => mapWorkflowEdges(detail));
  const [mcpServerIds, setMcpServerIds] = useState<string[]>(detail.mcpServerIds ?? []);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [past, setPast] = useState<WorkflowSnapshot[]>([]);
  const [future, setFuture] = useState<WorkflowSnapshot[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [agents, setAgents] = useState<PrototypeSummaryView[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<PrototypeSummaryView[]>([]);
  const [skills, setSkills] = useState<PrototypeSummaryView[]>([]);
  const [tools, setTools] = useState<ToolCapabilityView[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testRunId, setTestRunId] = useState<string>();
  const [testStarting, setTestStarting] = useState(false);
  const [testEvents, setTestEvents] = useState<WorkflowStreamEnvelopeView["event"][]>([]);
  const [testOutput, setTestOutput] = useState("");
  const [testError, setTestError] = useState<string>();
  const [runtimeStatuses, setRuntimeStatuses] = useState<
    Record<string, WorkflowNodeData["runtimeStatus"]>
  >({});
  const stateRef = useRef<WorkflowSnapshot>({ nodes, edges });
  const activeWorkflowRunRef = useRef<string | undefined>(undefined);
  const pendingWorkflowRunRef = useRef(false);
  const terminalWorkflowRunsRef = useRef(new Set<string>());

  useEffect(() => {
    stateRef.current = { nodes, edges };
  }, [edges, nodes]);
  useEffect(() => {
    void Promise.all([
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "agent", status: "enabled" }),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "knowledge", status: "enabled" }),
      window.zimo.prototypes.list(crypto.randomUUID(), { kind: "skill", status: "enabled" }),
      window.zimo.tools.list(crypto.randomUUID()),
    ]).then(([agentResult, knowledgeResult, skillResult, toolResult]) => {
      if (agentResult.ok) setAgents(agentResult.data);
      if (knowledgeResult.ok) setKnowledgeBases(knowledgeResult.data);
      if (skillResult.ok) setSkills(skillResult.data);
      if (toolResult.ok) setTools(toolResult.data);
    });
  }, []);
  useEffect(
    () =>
      window.zimo.workflows.onStream((envelope) => {
        if (!activeWorkflowRunRef.current && pendingWorkflowRunRef.current) {
          activeWorkflowRunRef.current = envelope.runId;
          setTestRunId(envelope.runId);
        }
        if (envelope.runId !== activeWorkflowRunRef.current) return;
        setTestEvents((current) => [...current, envelope.event]);
        const event = envelope.event;
        if (event.type === "node.started") {
          setRuntimeStatuses((current) => ({ ...current, [event.nodeId]: "running" }));
        } else if (event.type === "node.completed") {
          setRuntimeStatuses((current) => ({ ...current, [event.nodeId]: "completed" }));
        } else if (event.type === "node.skipped") {
          setRuntimeStatuses((current) => ({ ...current, [event.nodeId]: "skipped" }));
        } else if (event.type === "node.failed") {
          setRuntimeStatuses((current) => ({ ...current, [event.nodeId]: "failed" }));
        } else if (event.type === "run.completed") {
          terminalWorkflowRunsRef.current.add(envelope.runId);
          setTestOutput(event.output);
          setTestRunId(undefined);
          activeWorkflowRunRef.current = undefined;
        } else if (event.type === "run.failed") {
          terminalWorkflowRunsRef.current.add(envelope.runId);
          setTestError(event.error.message);
          setTestRunId(undefined);
          activeWorkflowRunRef.current = undefined;
        } else if (event.type === "run.cancelled") {
          terminalWorkflowRunsRef.current.add(envelope.runId);
          setTestError("运行已取消。");
          setTestRunId(undefined);
          activeWorkflowRunRef.current = undefined;
        }
      }),
    [],
  );

  const remember = useCallback(() => {
    setPast((current) => [...current.slice(-49), cloneWorkflowSnapshot(stateRef.current)]);
    setFuture([]);
  }, []);
  const undo = useCallback(() => {
    setPast((current) => {
      const previous = current.at(-1);
      if (!previous) return current;
      setFuture((next) => [cloneWorkflowSnapshot(stateRef.current), ...next].slice(0, 50));
      setNodes(previous.nodes);
      setEdges(previous.edges);
      setDirty(true);
      return current.slice(0, -1);
    });
  }, []);
  const redo = useCallback(() => {
    setFuture((current) => {
      const next = current[0];
      if (!next) return current;
      setPast((previous) => [...previous.slice(-49), cloneWorkflowSnapshot(stateRef.current)]);
      setNodes(next.nodes);
      setEdges(next.edges);
      setDirty(true);
      return current.slice(1);
    });
  }, []);
  const save = useCallback(async () => {
    setSaveState("saving");
    try {
      await onSave(
        toWorkflowNodeDefinitions(stateRef.current.nodes),
        toWorkflowEdgeDefinitions(stateRef.current.edges),
        mcpServerIds,
      );
      setDirty(false);
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [mcpServerIds, onSave]);

  async function runTest() {
    if (!testInput.trim() || testRunId || testStarting) return;
    if (dirty && !(await save())) return;
    setTestEvents([]);
    setTestOutput("");
    setTestError(undefined);
    setRuntimeStatuses({});
    setTestStarting(true);
    pendingWorkflowRunRef.current = true;
    try {
      const result = await window.zimo.workflows.run(
        crypto.randomUUID(),
        detail.id,
        testInput,
        configuredTools.map((tool) => tool.id),
      );
      if (!result.ok) {
        setTestError(result.error.message);
        activeWorkflowRunRef.current = undefined;
        return;
      }
      if (!terminalWorkflowRunsRef.current.has(result.data.runId)) {
        activeWorkflowRunRef.current = result.data.runId;
        setTestRunId(result.data.runId);
      }
    } catch {
      setTestError("测试请求未能完成，请重试。");
      activeWorkflowRunRef.current = undefined;
    } finally {
      pendingWorkflowRunRef.current = false;
      setTestStarting(false);
    }
  }

  async function cancelTest() {
    const runId = activeWorkflowRunRef.current;
    if (runId) await window.zimo.workflows.cancel(crypto.randomUUID(), runId);
  }
  const deleteSelected = useCallback(() => {
    const selected = stateRef.current.nodes.find((node) => node.id === selectedId);
    if (!selected || selected.data.zimoType === "start") return;
    if (
      selected.data.zimoType === "end" &&
      stateRef.current.nodes.filter((node) => node.data.zimoType === "end").length === 1
    )
      return;
    remember();
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) =>
      current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id),
    );
    setSelectedId(undefined);
    setDirty(true);
  }, [remember, selectedId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isFormField = target?.matches("input, textarea, select, [contenteditable='true']");
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      } else if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (
        (modifier && event.key.toLowerCase() === "y") ||
        (modifier && event.shiftKey && event.key.toLowerCase() === "z")
      ) {
        event.preventDefault();
        redo();
      } else if (!isFormField && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        setSelectedId(undefined);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, redo, save, undo]);

  const selected = nodes.find((node) => node.id === selectedId);
  const configuredTools = tools.filter((tool) =>
    nodes.some((node) => node.data.zimoType === "tool" && node.data.config.toolId === tool.id),
  );
  const visibleCatalog = workflowNodeCatalog.filter((item) =>
    `${item.label}${item.description}${item.category}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  function addNode(type: NodeKind) {
    if (type === "start" && nodes.some((node) => node.data.zimoType === "start")) return;
    remember();
    const metadata = workflowNodeCatalog.find((item) => item.type === type);
    const id = `${type}-${crypto.randomUUID()}`;
    setNodes((current) => [
      ...current,
      {
        id,
        type: "zimoWorkflow",
        position: { x: 180 + current.length * 44, y: 120 + (current.length % 4) * 100 },
        data: {
          label: metadata?.label ?? type,
          zimoType: type,
          config: defaultWorkflowNodeConfig(type),
        },
      },
    ]);
    setSelectedId(id);
    setDirty(true);
  }
  function updateSelected(patch: Partial<WorkflowNodeData>) {
    if (!selected) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selected.id ? { ...node, data: { ...node.data, ...patch } } : node,
      ),
    );
    setDirty(true);
  }
  function updateConfig(patch: Partial<WorkflowNodeConfig>) {
    if (!selected) return;
    updateSelected({
      config: cleanWorkflowNodeConfig({ ...selected.data.config, ...patch }),
    });
  }
  async function requestClose() {
    if (!dirty || (await confirm("当前工作流还有未保存的修改，确定退出编辑器吗？"))) {
      if (activeWorkflowRunRef.current) void cancelTest();
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-neutral-100"
      role="dialog"
      aria-modal="true"
      aria-label={`${detail.name}工作流编辑器`}
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            className="size-10 px-0"
            aria-label="返回工作流详情"
            onClick={requestClose}
          >
            <ChevronLeft size={19} />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-neutral-900">{detail.name}</h2>
              <Badge>
                {saveState === "error"
                  ? "保存失败"
                  : dirty
                    ? "未保存"
                    : saveState === "saved"
                      ? "已保存"
                      : "本地工作流"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">
              从左向右连接节点，选择节点后在右侧完成配置
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium">
              MCP · {mcpServerIds.length}
            </summary>
            <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-neutral-200 bg-white p-3 shadow-xl">
              <p className="text-xs font-medium">工作流 Agent 可使用的 MCP</p>
              <div className="mt-2 grid gap-2">
                {availableMcpServers.length === 0 ? (
                  <p className="text-xs text-neutral-400">请先在 MCP 页面连接服务。</p>
                ) : (
                  availableMcpServers.map((server) => (
                    <label key={server.serverId} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={mcpServerIds.includes(server.serverId)}
                        onChange={(event) => {
                          setMcpServerIds((current) =>
                            event.target.checked
                              ? [...current, server.serverId]
                              : current.filter((id) => id !== server.serverId),
                          );
                          setDirty(true);
                        }}
                      />
                      <span>{server.name}</span>
                      <span className="ml-auto text-neutral-400">{server.tools.length}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </details>
          <Button
            variant="ghost"
            className="size-9 min-h-9 px-0"
            aria-label="撤销"
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            className="size-9 min-h-9 px-0"
            aria-label="重做"
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2 size={16} />
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSelectedId(undefined);
              setTestOpen(true);
            }}
          >
            <Play size={15} /> 测试
          </Button>
          <Button disabled={!dirty || saveState === "saving"} onClick={() => void save()}>
            {saveState === "saving" ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : saveState === "saved" && !dirty ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {saveState === "saving" ? "保存中" : "保存"}
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)_300px]">
        <WorkflowNodeLibrary
          items={visibleCatalog}
          query={query}
          hasStart={nodes.some((node) => node.data.zimoType === "start")}
          onQueryChange={setQuery}
          onAdd={addNode}
        />
        <main className="relative min-w-0 bg-[#f7f8fa]" aria-label="工作流画布">
          <ReactFlow<WorkflowFlowNode, WorkflowFlowEdge>
            nodes={nodes.map((node) => {
              const runtimeStatus = runtimeStatuses[node.id];
              return {
                ...node,
                data: { ...node.data, ...(runtimeStatus ? { runtimeStatus } : {}) },
              };
            })}
            edges={edges.map((edge) => {
              const targetStatus = runtimeStatuses[edge.target];
              return {
                ...edge,
                animated: targetStatus === "running",
                style: {
                  stroke:
                    targetStatus === "failed"
                      ? "#dc2626"
                      : targetStatus === "running" || targetStatus === "completed"
                        ? "#16a34a"
                        : "#a3a3a3",
                  strokeWidth: targetStatus ? 2 : 1.5,
                },
              };
            })}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: "smoothstep",
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: "#a3a3a3", strokeWidth: 1.5 },
            }}
            onNodesChange={(changes: NodeChange<WorkflowFlowNode>[]) => {
              setNodes((current) => applyNodeChanges(changes, current));
              if (changes.some((change) => change.type === "position" || change.type === "remove"))
                setDirty(true);
            }}
            onNodeDragStart={remember}
            onEdgesChange={(changes: EdgeChange<WorkflowFlowEdge>[]) => {
              if (changes.some((change) => change.type === "remove")) remember();
              setEdges((current) => applyEdgeChanges(changes, current));
              if (changes.some((change) => change.type === "remove")) setDirty(true);
            }}
            onConnect={(connection: Connection) => {
              if (!isWorkflowConnectionAllowed(connection, nodes)) return;
              remember();
              setEdges((current) =>
                addEdge({ ...connection, id: `edge-${crypto.randomUUID()}` }, current),
              );
              setDirty(true);
            }}
            isValidConnection={(connection) => isWorkflowConnectionAllowed(connection, nodes)}
            onNodeClick={(_event, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(undefined)}
            fitView
            minZoom={0.3}
            maxZoom={1.8}
            snapToGrid
            snapGrid={[16, 16]}
            deleteKeyCode={null}
          >
            <Background gap={24} size={1} color="#dedede" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor="#d4d4d4"
              maskColor="rgb(245 245 245 / 72%)"
            />
          </ReactFlow>
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-white/90 px-3 py-2 text-xs text-neutral-400 shadow-sm ring-1 ring-black/5">
            拖动画布 · 滚轮缩放 · ⌘S 保存 · Delete 删除 · ⌘Z 撤销
          </div>
        </main>
        {testOpen ? (
          <WorkflowTestPanel
            input={testInput}
            running={Boolean(testRunId) || testStarting}
            events={testEvents}
            tools={configuredTools}
            output={testOutput}
            error={testError}
            onInputChange={setTestInput}
            onRun={() => void runTest()}
            onCancel={() => void cancelTest()}
            onClose={() => setTestOpen(false)}
          />
        ) : (
          <WorkflowNodeInspector
            selected={selected}
            nodes={nodes}
            agents={agents}
            knowledgeBases={knowledgeBases}
            skills={skills}
            tools={tools}
            onRemember={remember}
            onClose={() => setSelectedId(undefined)}
            onUpdate={updateSelected}
            onUpdateConfig={updateConfig}
            onDelete={deleteSelected}
          />
        )}
      </div>
    </div>
  );
}
