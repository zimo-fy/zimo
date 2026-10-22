import { z } from "zod";

import type { IpcResult } from "./index";

const ipcRequest = <T extends z.ZodType>(payload: T) =>
  z.object({ requestId: z.uuid(), payload }).strict();

export const communicationChannelKindSchema = z.enum(["weixin", "email"]);
export type CommunicationChannelKindDto = z.infer<typeof communicationChannelKindSchema>;

export const communicationChannelViewSchema = z
  .object({
    kind: communicationChannelKindSchema,
    name: z.string().min(1).max(40),
    description: z.string().min(1).max(300),
    status: z.enum(["unbound", "bound"]),
    accountLabel: z.string().max(254).optional(),
    boundAt: z.iso.datetime().optional(),
    capabilities: z.array(z.string().min(1).max(80)).max(10),
    runtimeStatus: z
      .enum([
        "stopped",
        "starting",
        "listening",
        "awaiting_activation",
        "replying",
        "degraded",
        "reauthentication_required",
      ])
      .optional(),
    canSendTestMessage: z.boolean().optional(),
    lastInboundAt: z.iso.datetime().optional(),
  })
  .strict();
export type CommunicationChannelView = z.infer<typeof communicationChannelViewSchema>;

export const bindEmailChannelInputSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  })
  .strict();
export type BindEmailChannelInput = z.infer<typeof bindEmailChannelInputSchema>;

export const weixinLoginStartViewSchema = z
  .object({
    sessionId: z.uuid(),
    qrCodeDataUrl: z.string().startsWith("data:image/png;base64,").max(200_000),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type WeixinLoginStartView = z.infer<typeof weixinLoginStartViewSchema>;

export const pollWeixinLoginInputSchema = z
  .object({
    sessionId: z.uuid(),
    verifyCode: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/)
      .optional(),
  })
  .strict();

export const weixinLoginStatusViewSchema = z
  .object({
    status: z.enum(["waiting", "scanned", "verification_required", "expired", "confirmed"]),
    expiresAt: z.iso.datetime().optional(),
    accountLabel: z.string().max(254).optional(),
  })
  .strict();
export type WeixinLoginStatusView = z.infer<typeof weixinLoginStatusViewSchema>;

export const unbindCommunicationChannelInputSchema = z
  .object({ kind: communicationChannelKindSchema })
  .strict();
export const cancelWeixinLoginInputSchema = z.object({ sessionId: z.uuid() }).strict();

export const bindEmailChannelRequestSchema = ipcRequest(bindEmailChannelInputSchema);
export const pollWeixinLoginRequestSchema = ipcRequest(pollWeixinLoginInputSchema);
export const unbindCommunicationChannelRequestSchema = ipcRequest(
  unbindCommunicationChannelInputSchema,
);
export const cancelWeixinLoginRequestSchema = ipcRequest(cancelWeixinLoginInputSchema);

export interface CommunicationChannelsDesktopApi {
  list(requestId: string): Promise<IpcResult<CommunicationChannelView[]>>;
  bindEmail(
    requestId: string,
    input: BindEmailChannelInput,
  ): Promise<IpcResult<CommunicationChannelView>>;
  startWeixin(requestId: string): Promise<IpcResult<WeixinLoginStartView>>;
  pollWeixin(
    requestId: string,
    sessionId: string,
    verifyCode?: string,
  ): Promise<IpcResult<WeixinLoginStatusView>>;
  cancelWeixin(requestId: string, sessionId: string): Promise<IpcResult<{ success: true }>>;
  unbind(
    requestId: string,
    kind: CommunicationChannelKindDto,
  ): Promise<IpcResult<{ success: true }>>;
  sendWeixinTest(requestId: string): Promise<IpcResult<{ success: true }>>;
}
