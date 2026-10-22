import type { WorkspaceGrantView } from "@zimo/contracts";
import { ShieldCheck } from "lucide-react";

import { SelectControl } from "../../components/select-control";

export function WorkspaceApprovalMode({
  workspaces,
  disabled,
  busy,
  onChange,
}: {
  workspaces: readonly WorkspaceGrantView[];
  disabled: boolean;
  busy: boolean;
  onChange(mode: "ask" | "auto_approve"): void;
}) {
  const mode = workspaces[0]?.mode ?? "ask";
  return (
    <SelectControl
      ariaLabel="操作审批模式"
      leadingIcon={<ShieldCheck size={13} className="text-amber-600" aria-hidden="true" />}
      className="h-9 min-h-9 w-auto rounded-lg border-0 bg-white px-2.5 text-xs shadow-sm ring-1 ring-neutral-200"
      value={mode}
      disabled={disabled || busy || workspaces.length === 0}
      options={[
        { value: "ask", label: "请求审批", description: "新目录或高风险写入前由你确认" },
        {
          value: "auto_approve",
          label: "帮我批准",
          description: "自动执行所有可执行操作，包括命令和删除",
        },
      ]}
      onValueChange={(value) => onChange(value as "ask" | "auto_approve")}
    />
  );
}
