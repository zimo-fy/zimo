import type { MessageView } from "@zimo/contracts";

export function consumedTokens(usage: MessageView["usage"]): number | undefined {
  if (!usage) return undefined;
  if (usage.totalTokens !== undefined) return usage.totalTokens;
  if (usage.inputTokens === undefined && usage.outputTokens === undefined) return undefined;
  return (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
}

export function formatTokenCount(value: number): string {
  return value.toLocaleString("zh-CN");
}

export function formatReplyTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  });
}

export function elapsedSeconds(startedAt: string, endedAt: string | number): number {
  const start = Date.parse(startedAt);
  const end = typeof endedAt === "number" ? endedAt : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatElapsedDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m${remainder}s`;
}

export function formatThinkingElapsed(status: MessageView["status"], seconds: number): string {
  const duration = formatElapsedDuration(seconds);
  if (status === "streaming" || status === "pending") return `思考中 ${duration}`;
  if (status === "completed") return `已完成 ${duration}`;
  return `已停止 ${duration}`;
}
