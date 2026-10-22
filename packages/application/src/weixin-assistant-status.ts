export type WeixinAssistantRuntimeStatus =
  | "stopped"
  | "starting"
  | "listening"
  | "awaiting_activation"
  | "replying"
  | "degraded"
  | "reauthentication_required";

export interface WeixinAssistantStatus {
  status: WeixinAssistantRuntimeStatus;
  canSendTestMessage: boolean;
  lastInboundAt?: Date;
  errorCode?: string;
}
