import type {
  ConversationDetailView,
  DocumentArtifactView,
  McpConnectionView,
  PrototypeDetailView,
  PrototypeSummaryView,
  RouteTargetView,
  WorkspaceGrantView,
  PendingApprovalView,
  PendingUserQuestionView,
  UserQuestionAnswer,
} from "@zimo/contracts";
import { Button } from "@zimo/ui";
import { Cpu, RefreshCw, Send, Square } from "lucide-react";
import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";

import { SelectControl } from "../../components/select-control";
import { CapabilitySummary, ChatCapabilityMenu } from "./chat-capability-menu";
import { DraftAttachmentStrip } from "./document-attachments";
import { isMcpServerSelected } from "./mcp-server-selection";
import { WorkspaceGrantStrip } from "./workspace-grants";
import { WorkspaceApprovalMode } from "./workspace-approval-mode";
import { ActionApprovalCard } from "./action-approval-card";
import { UserQuestionCard } from "./user-question-card";
import type { ChatModelOption } from "./chat-model-options";

export function ChatComposer({
  detail,
  modelOptions,
  modelValue,
  routeTargets,
  knowledgeBases,
  selectedAgent,
  mcpConnections,
  content,
  sending,
  savingCapabilities,
  error,
  draftArtifacts,
  importingFiles,
  workspaces,
  workspaceBusy,
  pendingApproval,
  pendingQuestion,
  approvalBusy,
  questionBusy,
  onContentChange,
  onSelectAgent,
  onChangeKnowledgeBase,
  onToggleSkill,
  onSelectWorkflow,
  onToggleMcpServer,
  onChangeModel,
  onSend,
  onStop,
  onRegenerate,
  onAddFiles,
  onAddWorkspace,
  onRemoveWorkspace,
  onChangeWorkspaceMode,
  onResolveApproval,
  onAnswerQuestion,
  onRemoveArtifact,
  onPreviewArtifact,
}: {
  detail: ConversationDetailView;
  modelOptions: readonly ChatModelOption[];
  modelValue: string;
  routeTargets: readonly RouteTargetView[];
  knowledgeBases: readonly PrototypeSummaryView[];
  selectedAgent: PrototypeDetailView | null;
  mcpConnections: readonly McpConnectionView[];
  content: string;
  sending: boolean;
  savingCapabilities: boolean;
  error: string | null;
  draftArtifacts: readonly DocumentArtifactView[];
  importingFiles: boolean;
  workspaces: readonly WorkspaceGrantView[];
  workspaceBusy: boolean;
  pendingApproval?: PendingApprovalView;
  pendingQuestion?: PendingUserQuestionView;
  approvalBusy: boolean;
  questionBusy: boolean;
  onContentChange(value: string): void;
  onSelectAgent(agentId: string): void;
  onChangeKnowledgeBase(knowledgeBaseId: string): void;
  onToggleSkill(skillId: string): void;
  onSelectWorkflow(workflowId: string): void;
  onToggleMcpServer(connection: McpConnectionView): void;
  onChangeModel(modelId: string): void;
  onSend(event?: FormEvent): void;
  onStop(): void;
  onRegenerate(): void;
  onAddFiles(): void;
  onAddWorkspace(): void;
  onRemoveWorkspace(id: string): void;
  onChangeWorkspaceMode(mode: "ask" | "auto_approve"): void;
  onResolveApproval(decision: "allowed_once" | "denied"): void;
  onAnswerQuestion(answers: readonly UserQuestionAnswer[]): void;
  onRemoveArtifact(id: string): void;
  onPreviewArtifact(id: string, revisionId: string): void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRunning = sending || Boolean(detail.activeRunId);
  const agentTargets = routeTargets.filter((target) => target.type === "agent");
  const skillTargets = routeTargets.filter((target) => target.type === "skill");
  const workflowTargets = routeTargets.filter((target) => target.type === "workflow");
  const boundSkills = skillTargets.filter(
    (skill) =>
      detail.skillIds.includes(skill.id) || Boolean(selectedAgent?.skillIds?.includes(skill.id)),
  );
  const directlySelectedSkills = skillTargets.filter((skill) => detail.skillIds.includes(skill.id));
  const selectedKnowledgeBase = knowledgeBases.find(
    (item) => item.id === detail.knowledgeBaseIds[0],
  );
  const selectedMcpConnections = mcpConnections.filter((connection) =>
    isMcpServerSelected(connection, detail.mcpToolIds),
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 72), 180)}px`;
  }, [content]);

  return (
    <div className="shrink-0 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent px-5 pb-5 pt-2">
      <div className="relative mx-auto max-w-3xl">
        {pendingQuestion && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+0.625rem)] z-20 px-1">
            <div className="pointer-events-auto max-h-[min(32rem,calc(100vh-12rem))] overflow-y-auto rounded-2xl">
              <UserQuestionCard
                key={pendingQuestion.questionId}
                question={pendingQuestion}
                busy={questionBusy}
                onAnswer={onAnswerQuestion}
              />
            </div>
          </div>
        )}
        <form
          aria-label="消息输入"
          onSubmit={(event) => onSend(event)}
          className="overflow-hidden rounded-[22px] border border-neutral-200/80 bg-white shadow-[0_16px_48px_-24px_rgba(0,0,0,0.35)] transition focus-within:border-neutral-300 focus-within:shadow-[0_20px_56px_-24px_rgba(0,0,0,0.4)]"
        >
          {error && (
            <p
              className="mx-3 mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}
          {pendingApproval && (
            <ActionApprovalCard
              approval={pendingApproval}
              busy={approvalBusy}
              onResolve={onResolveApproval}
            />
          )}
          <textarea
            ref={textareaRef}
            aria-label="消息"
            rows={1}
            className="block min-h-[72px] max-h-[180px] w-full resize-none overflow-y-auto bg-transparent px-4 pb-2 pt-4 text-[15px] leading-6 text-neutral-900 outline-none placeholder:text-neutral-400"
            placeholder="描述你想完成的任务…"
            autoFocus
            value={content}
            disabled={isRunning}
            onChange={(event) => onContentChange(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <DraftAttachmentStrip
            artifacts={draftArtifacts}
            disabled={isRunning}
            busy={importingFiles}
            onRemove={onRemoveArtifact}
            onPreview={onPreviewArtifact}
          />
          <WorkspaceGrantStrip
            workspaces={workspaces}
            disabled={isRunning}
            busy={workspaceBusy}
            onRemove={onRemoveWorkspace}
          />
          <div className="flex flex-wrap items-center gap-1.5 border-t border-neutral-100 bg-neutral-50/70 px-2.5 py-2">
            <ChatCapabilityMenu
              agents={agentTargets}
              skills={skillTargets}
              workflows={workflowTargets}
              knowledgeBases={knowledgeBases}
              selectedAgent={selectedAgent}
              selectedKnowledgeBaseId={detail.knowledgeBaseIds[0] ?? ""}
              boundSkills={boundSkills}
              selectedSkillIds={detail.skillIds}
              selectedWorkflowId={detail.workflowId ?? ""}
              mcpConnections={mcpConnections}
              selectedMcpToolIds={detail.mcpToolIds}
              disabled={isRunning || savingCapabilities}
              onSelectAgent={onSelectAgent}
              onSelectKnowledgeBase={onChangeKnowledgeBase}
              onToggleSkill={onToggleSkill}
              onSelectWorkflow={onSelectWorkflow}
              onToggleMcpServer={onToggleMcpServer}
              onAddFiles={onAddFiles}
              onAddWorkspace={onAddWorkspace}
            />
            <CapabilitySummary
              agentName={selectedAgent?.name}
              skills={directlySelectedSkills}
              knowledgeBaseName={selectedKnowledgeBase?.name}
              workflowName={workflowTargets.find((item) => item.id === detail.workflowId)?.name}
              mcpServers={selectedMcpConnections}
              disabled={isRunning || savingCapabilities}
              onRemoveAgent={() => onSelectAgent("")}
              onRemoveSkill={onToggleSkill}
              onRemoveKnowledgeBase={() => onChangeKnowledgeBase("")}
              onRemoveWorkflow={() => onSelectWorkflow("")}
              onRemoveMcpServer={onToggleMcpServer}
            />
            <span className="min-w-2 flex-1" />
            <WorkspaceApprovalMode
              workspaces={workspaces}
              disabled={isRunning}
              busy={workspaceBusy}
              onChange={onChangeWorkspaceMode}
            />
            <SelectControl
              ariaLabel="当前模型"
              leadingIcon={<Cpu size={14} className="text-blue-600" />}
              className="h-9 min-h-9 w-auto max-w-48 rounded-lg border-0 bg-white px-2.5 text-xs shadow-sm ring-1 ring-neutral-200"
              value={modelValue}
              disabled={isRunning}
              options={modelOptions}
              onValueChange={onChangeModel}
            />
            {detail.messages.some((message) => message.role === "assistant") && !isRunning && (
              <Button
                variant="ghost"
                className="size-9 min-h-9 rounded-lg px-0"
                aria-label="重新生成"
                title="重新生成"
                onClick={onRegenerate}
              >
                <RefreshCw size={14} />
              </Button>
            )}
            {isRunning ? (
              <Button variant="secondary" className="h-9 min-h-9 rounded-lg px-3" onClick={onStop}>
                <Square size={12} fill="currentColor" />
                停止
              </Button>
            ) : (
              <Button
                type="submit"
                className="size-9 min-h-9 rounded-xl px-0"
                aria-label="发送"
                disabled={!content.trim()}
              >
                <Send size={15} />
              </Button>
            )}
          </div>
        </form>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-neutral-400">
        Enter 发送 · Shift + Enter 换行 · Zimo 可能会出错，请核对重要信息
      </p>
    </div>
  );
}
