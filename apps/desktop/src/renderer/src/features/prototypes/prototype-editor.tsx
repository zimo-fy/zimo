import type {
  ModelProviderView,
  McpConnectionView,
  PrototypeDetailView,
  PrototypeEditableInput,
  PrototypeKindDto,
  PrototypeSummaryView,
} from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { useState, type FormEvent } from "react";

import { SelectControl } from "../../components/select-control";

const kindTitles: Record<PrototypeKindDto, string> = {
  agent: "Agent",
  skill: "Skill",
  knowledge: "知识库",
  workflow: "工作流",
  plugin: "Plugin",
  mcp: "MCP Server",
  automation: "Automation",
};

export function PrototypeEditor({
  kind,
  detail,
  models,
  availableSkills,
  availableKnowledgeBases,
  availableMcpServers,
  categoryOptions,
  onCancel,
  onSubmit,
}: {
  kind: PrototypeKindDto;
  detail?: PrototypeDetailView | undefined;
  models: ModelProviderView["models"];
  availableSkills: PrototypeSummaryView[];
  availableKnowledgeBases: PrototypeSummaryView[];
  availableMcpServers: readonly McpConnectionView[];
  categoryOptions?: readonly string[] | undefined;
  onCancel(): void;
  onSubmit(value: PrototypeEditableInput): void;
}) {
  const [name, setName] = useState(detail?.name ?? "");
  const [description, setDescription] = useState(detail?.description ?? "");
  const selectableCategories = normalizeCategoryOptions(categoryOptions, detail?.category);
  const [category, setCategory] = useState(
    detail?.category || (kind === "agent" || kind === "skill" ? selectableCategories[0] : "") || "",
  );
  const [prompt, setPrompt] = useState(detail?.systemPrompt ?? "");
  const [modelId, setModelId] = useState(detail?.modelId ?? "");
  const [skillIds, setSkillIds] = useState<string[]>(detail?.skillIds ?? []);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(
    detail?.knowledgeBaseIds ?? [],
  );
  const [mcpServerIds, setMcpServerIds] = useState<string[]>(detail?.mcpServerIds ?? []);
  const [tags, setTags] = useState(detail?.tags.join(", ") ?? "");
  const [triggerType, setTriggerType] = useState<PrototypeEditableInput["triggerType"]>(
    detail?.triggerType ?? "manual",
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name,
      description,
      category,
      tags:
        kind === "agent" || kind === "skill"
          ? [...(detail?.tags ?? [])]
          : tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
      status: detail?.status ?? "draft",
      ...(kind === "agent" && prompt ? { systemPrompt: prompt } : {}),
      ...(kind === "agent" && modelId ? { modelId } : {}),
      ...(kind === "agent" ? { skillIds, knowledgeBaseIds, mcpServerIds } : {}),
      ...(kind === "workflow" ? { mcpServerIds } : {}),
      permissions: detail?.permissions ?? [],
      associations: detail?.associations ?? [],
      ...(kind === "automation" && triggerType ? { triggerType } : {}),
    });
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-xl font-semibold">
        {detail ? "编辑" : "新建"}
        {kindTitles[kind]}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">完成配置后保存，返回列表继续管理。</p>
      <div className="mt-7 grid gap-5">
        <label className="text-sm font-medium">
          名称
          <input
            className="field mt-2"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          描述
          <textarea
            className="field mt-2 min-h-24 py-3"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "agent" || kind === "skill" ? (
            <FieldLabel text="分类">
              <SelectControl
                ariaLabel={`${kindTitles[kind]} 分类`}
                value={category}
                options={selectableCategories.map((value) => ({ value, label: value }))}
                onValueChange={setCategory}
              />
            </FieldLabel>
          ) : (
            <label className="text-sm font-medium">
              分类 / 类型
              <input
                className="field mt-2"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder={kind === "mcp" ? "stdio 或 HTTP" : "分类"}
              />
            </label>
          )}
          {kind !== "agent" && kind !== "skill" && (
            <label className="text-sm font-medium">
              标签
              <input
                className="field mt-2"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="用逗号分隔"
              />
            </label>
          )}
        </div>
        {kind === "agent" && (
          <label className="text-sm font-medium">
            System Prompt
            <textarea
              className="field mt-2 min-h-40 py-3 font-mono text-sm"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
        )}
        {(kind === "agent" || kind === "workflow") && (
          <McpBindingFieldset
            items={availableMcpServers}
            selectedIds={mcpServerIds}
            onChange={setMcpServerIds}
          />
        )}
        {kind === "agent" && (
          <FieldLabel text="模型选择">
            <SelectControl
              ariaLabel="模型选择"
              value={modelId}
              options={[
                { value: "", label: "跟随当前对话模型" },
                ...models.map((model) => ({ value: model.id, label: model.displayName })),
              ]}
              onValueChange={setModelId}
            />
          </FieldLabel>
        )}
        {kind === "agent" && (
          <BindingFieldset
            title="绑定已安装 Skills"
            emptyText="请先在 Skill 页面安装并启用能力包。"
            items={availableSkills}
            selectedIds={skillIds}
            onChange={setSkillIds}
          />
        )}
        {kind === "agent" && (
          <BindingFieldset
            title="绑定知识库"
            emptyText="请先创建并启用知识库。"
            items={availableKnowledgeBases}
            selectedIds={knowledgeBaseIds}
            onChange={setKnowledgeBaseIds}
          />
        )}
        {kind === "automation" && (
          <FieldLabel text="Trigger 类型">
            <SelectControl
              ariaLabel="Trigger 类型"
              value={triggerType ?? "manual"}
              options={[
                { value: "manual", label: "手动" },
                { value: "schedule", label: "定时" },
                { value: "webhook", label: "Webhook" },
                { value: "message", label: "消息" },
                { value: "file_change", label: "文件变化" },
              ]}
              onValueChange={(value) => setTriggerType(value as NonNullable<typeof triggerType>)}
            />
          </FieldLabel>
        )}
        {kind === "automation" && (
          <FieldLabel text="执行目标">
            <SelectControl
              ariaLabel="执行目标"
              value="target"
              disabled
              options={[{ value: "target", label: "Agent / Skill / Workflow（原型选择）" }]}
              onValueChange={() => undefined}
            />
          </FieldLabel>
        )}
        <div className="flex justify-end gap-2 border-t border-neutral-100 pt-5">
          <Button variant="secondary" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit">
            {kind === "agent" || kind === "skill" ? "保存配置" : "保存 Mock 配置"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function normalizeCategoryOptions(
  options: readonly string[] | undefined,
  current: string | undefined,
): string[] {
  const values = [current, ...(options ?? [])]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value && value !== "全部" && value !== "未分类");
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : ["其他"];
}

function McpBindingFieldset({
  items,
  selectedIds,
  onChange,
}: {
  items: readonly McpConnectionView[];
  selectedIds: string[];
  onChange(value: string[]): void;
}) {
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">绑定 MCP Servers</legend>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">请先在 MCP 页面连接服务。</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label key={item.serverId} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.serverId)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selectedIds, item.serverId]
                      : selectedIds.filter((id) => id !== item.serverId),
                  )
                }
              />
              <span>{item.name}</span>
              <span className="text-xs text-neutral-400">{item.tools.length} tools</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function FieldLabel({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 text-sm font-medium">
      {text}
      {children}
    </div>
  );
}

function BindingFieldset({
  title,
  emptyText,
  items,
  selectedIds,
  onChange,
}: {
  title: string;
  emptyText: string;
  items: PrototypeSummaryView[];
  selectedIds: string[];
  onChange(value: string[]): void;
}) {
  return (
    <fieldset className="rounded-xl border border-neutral-200 p-4">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">{emptyText}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selectedIds, item.id]
                      : selectedIds.filter((id) => id !== item.id),
                  )
                }
              />
              {item.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
