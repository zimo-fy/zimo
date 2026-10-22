import type { ToolCapabilityView, WorkflowStreamEnvelopeView } from "@zimo/contracts";
import { Button, cn } from "@zimo/ui";
import { LoaderCircle, Play, Square, X } from "lucide-react";

export function WorkflowTestPanel({
  input,
  running,
  events,
  tools,
  output,
  error,
  onInputChange,
  onRun,
  onCancel,
  onClose,
}: {
  input: string;
  running: boolean;
  events: readonly WorkflowStreamEnvelopeView["event"][];
  tools: readonly ToolCapabilityView[];
  output: string;
  error: string | undefined;
  onInputChange(value: string): void;
  onRun(): void;
  onCancel(): void;
  onClose(): void;
}) {
  const nodeEvents = events.filter((event) => event.type.startsWith("node."));
  return (
    <aside className="overflow-y-auto border-l border-neutral-200 bg-white" aria-label="工作流测试">
      <div className="flex h-14 items-center justify-between border-b border-neutral-100 px-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">测试运行</h3>
          <p className="mt-0.5 text-[11px] text-neutral-400">节点状态与执行结果</p>
        </div>
        <Button
          variant="ghost"
          className="size-8 min-h-8 px-0"
          aria-label="关闭测试面板"
          onClick={onClose}
        >
          <X size={16} />
        </Button>
      </div>
      <div className="p-4">
        <label className="block text-xs font-medium text-neutral-600">
          测试输入
          <textarea
            className="field mt-2 min-h-28 py-3 text-sm"
            value={input}
            disabled={running}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="输入一条真实问题，例如：公司的退款政策是什么？"
          />
        </label>
        {tools.length > 0 && (
          <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <h4 className="text-xs font-semibold text-amber-900">本次运行需要确认</h4>
            {tools.map((tool) => (
              <div key={tool.id} className="mt-2 text-xs leading-5 text-amber-800">
                <p className="font-medium">{tool.title}</p>
                <p>
                  {tool.annotations.readOnly ? "只读" : "可能写入"} ·
                  {tool.annotations.openWorld ? " 可访问外部系统" : " 仅本地封闭数据"} · 超时
                  {tool.timeoutMs}ms
                </p>
                <p>权限：{tool.permissions.map((permission) => permission.title).join("、")}</p>
              </div>
            ))}
          </section>
        )}
        <div className="mt-3 flex gap-2">
          {running ? (
            <Button variant="secondary" className="w-full" onClick={onCancel}>
              <Square size={14} /> 停止运行
            </Button>
          ) : (
            <Button className="w-full" disabled={!input.trim()} onClick={onRun}>
              <Play size={15} /> {tools.length ? "确认权限并运行" : "开始测试"}
            </Button>
          )}
        </div>
        {(running || nodeEvents.length > 0) && (
          <section className="mt-5 border-t border-neutral-100 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-700">执行步骤</h4>
              {running && <LoaderCircle className="animate-spin text-neutral-400" size={15} />}
            </div>
            <ol className="mt-3 space-y-2">
              {nodeEvents.map((event, index) => (
                <li
                  key={`${event.type}-${"nodeId" in event ? event.nodeId : index}-${index}`}
                  className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        event.type === "node.failed"
                          ? "bg-red-500"
                          : event.type === "node.started"
                            ? "bg-amber-500"
                            : event.type === "node.skipped"
                              ? "bg-neutral-300"
                              : "bg-emerald-500",
                      )}
                    />
                    <span className="font-medium text-neutral-700">
                      {workflowEventLabel(event)}
                    </span>
                  </div>
                  {event.type === "node.completed" && (
                    <p className="mt-1 truncate pl-4 text-[11px] text-neutral-400">
                      {event.durationMs} ms{event.outputPreview ? ` · ${event.outputPreview}` : ""}
                    </p>
                  )}
                  {event.type === "node.skipped" && (
                    <p className="mt-1 pl-4 text-[11px] text-neutral-400">{event.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">
            {error}
          </div>
        )}
        {output && (
          <section className="mt-5 border-t border-neutral-100 pt-4">
            <h4 className="text-xs font-semibold text-neutral-700">最终输出</h4>
            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm leading-6 text-neutral-700">
              {output}
            </div>
          </section>
        )}
        <p className="mt-5 text-[11px] leading-5 text-neutral-400">
          测试会先保存当前定义。本地知识检索与 GitHub 仓库搜索已按逐次确认开放；条件、人工确认、写入
          Tool 与其他远程 MCP 仍保持关闭。
        </p>
      </div>
    </aside>
  );
}

function workflowEventLabel(event: WorkflowStreamEnvelopeView["event"]): string {
  if (event.type === "node.started") return `${event.label} · 运行中`;
  if (event.type === "node.completed") return `${event.nodeId} · 已完成`;
  if (event.type === "node.skipped") return `${event.nodeId} · 已跳过`;
  if (event.type === "node.failed") return `${event.nodeId} · 失败`;
  return event.type;
}
