import { useCallback, useEffect, useState } from "react";
import type { AuthSessionView } from "@zimo/contracts";
import { AppDialogProvider, Spinner, useAppDialog } from "@zimo/ui";

import { AppShell, type AppPage } from "./components/app-shell";
import { useConversationTasks } from "./components/use-conversation-tasks";
import { LoginScreen } from "./features/auth/login-screen";
import { ChatPage } from "./features/chat/chat-page";
import { CommunicationChannelsPage } from "./features/communication-channels/communication-channels-page";
import { McpPage } from "./features/mcp/mcp-page";
import { ProductPrototypePage } from "./features/prototypes/product-prototype-page";
import { MODEL_SETUP_MESSAGE } from "./features/settings/model-configuration-status";
import { SettingsPage } from "./features/settings/settings-page";
import { AppUpdateNotice } from "./features/updates/app-update-notice";

type BootState =
  | { status: "loading" }
  | { status: "ready"; session: AuthSessionView | null }
  | { status: "error"; message: string };

export function App() {
  return (
    <AppDialogProvider>
      <AppContent />
      <AppUpdateNotice />
    </AppDialogProvider>
  );
}

function AppContent() {
  const { alert } = useAppDialog();
  const [boot, setBoot] = useState<BootState>({ status: "loading" });
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [page, setPage] = useState<AppPage>("chat");
  const [creatingTask, setCreatingTask] = useState(true);
  const [pendingAgentId, setPendingAgentId] = useState<string>();
  const [modelSetupMessage, setModelSetupMessage] = useState<string>();
  const restoredSession = boot.status === "ready" ? boot.session : null;
  const inAppShell = onboardingComplete && Boolean(restoredSession);
  const taskState = useConversationTasks(inAppShell);
  const refreshTasks = taskState.refresh;
  const showingDraft = creatingTask || !taskState.activeTaskId;

  useEffect(() => {
    if (boot.status !== "ready" || !boot.session) return;
    return window.zimo.automations.onTaskListChanged(() => {
      void refreshTasks();
    });
  }, [boot, refreshTasks]);

  useEffect(() => {
    let active = true;
    void window.zimo.auth
      .getSession(crypto.randomUUID())
      .then((result) => {
        if (!active) return;
        if (result.ok) setBoot({ status: "ready", session: result.data });
        else setBoot({ status: "error", message: result.error.message });
      })
      .catch(() => {
        if (active) setBoot({ status: "error", message: "Zimo 启动失败，请重新打开应用。" });
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    const result = await window.zimo.auth.logout(crypto.randomUUID());
    if (result.ok) {
      setPage("chat");
      setOnboardingComplete(false);
      setModelSetupMessage(undefined);
      setBoot({ status: "ready", session: null });
    }
  }

  function completeOnboarding(session: AuthSessionView) {
    setBoot({ status: "ready", session });
    setOnboardingComplete(true);
    setPage("chat");
    setModelSetupMessage(undefined);
  }

  async function openNewTask(agentId?: string) {
    setCreatingTask(true);
    setPendingAgentId(agentId);
    setPage("chat");
    const result = await taskState.createDraft();
    if (!result.ok) {
      await alert(result.message);
    }
  }

  function openTask(id: string) {
    setCreatingTask(false);
    taskState.setActiveTaskId(id);
    setPendingAgentId(undefined);
    setPage("chat");
  }

  async function deleteTask(id: string) {
    const wasActive = !creatingTask && taskState.activeTaskId === id;
    const result = await taskState.remove(id);
    if (result.ok && wasActive) await openNewTask();
    return result;
  }

  const consumePendingAgent = useCallback(() => setPendingAgentId(undefined), []);

  function navigate(nextPage: AppPage) {
    if (nextPage === "chat") {
      void openNewTask();
      return;
    }
    setPage(nextPage);
  }

  if (boot.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50">
        <Spinner label="正在启动 Zimo" />
      </main>
    );
  }

  if (boot.status === "error") {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-50 p-8 text-sm text-red-700">
        {boot.message}
      </main>
    );
  }

  if (!inAppShell) {
    return (
      <LoginScreen
        restoredSession={restoredSession ?? undefined}
        onAuthenticated={completeOnboarding}
      />
    );
  }

  return (
    <AppShell
      page={page}
      session={restoredSession!}
      tasks={taskState.tasks}
      activeTaskId={showingDraft ? undefined : taskState.activeTaskId}
      newTaskActive={showingDraft && page === "chat"}
      taskError={taskState.error}
      onNavigate={navigate}
      onCreateTask={() => void openNewTask()}
      onSelectTask={openTask}
      onRenameTask={taskState.rename}
      onSetTaskPinned={taskState.setPinned}
      onDeleteTask={deleteTask}
      onLogout={() => void logout()}
    >
      {page === "chat" && (
        <ChatPage
          conversationId={showingDraft ? taskState.draftTaskId : taskState.activeTaskId}
          draft={showingDraft}
          taskRevision={taskState.revision}
          initialAgentId={pendingAgentId}
          onInitialAgentConsumed={consumePendingAgent}
          onTasksChanged={taskState.refresh}
          onDraftCommitted={(id) => {
            taskState.commitDraft(id);
            setCreatingTask(false);
          }}
          onCreateConversation={() => void openNewTask()}
          onOpenSettings={() => {
            setModelSetupMessage(MODEL_SETUP_MESSAGE);
            setPage("settings");
          }}
        />
      )}
      {page === "settings" && (
        <SettingsPage
          session={restoredSession!}
          setupMessage={modelSetupMessage}
          onConfigured={() => setModelSetupMessage(undefined)}
        />
      )}
      {page === "plugin" && <CommunicationChannelsPage />}
      {page === "mcp" && <McpPage />}
      {["agent", "skill", "knowledge", "workflow", "automation"].includes(page) && (
        <ProductPrototypePage
          key={page}
          kind={page as "agent" | "skill" | "knowledge" | "workflow" | "mcp" | "automation"}
          onUseAgent={(agentId) => {
            void openNewTask(agentId);
          }}
        />
      )}
    </AppShell>
  );
}
