import {
  AppError,
  type Clock,
  type CommunicationChannelBinding,
  type CommunicationChannelKind,
  type CommunicationChannelRepository,
  type IdGenerator,
  type SecretStore,
  type SessionStore,
  type WeixinBindingGateway,
  type WeixinLoginStart,
  type WeixinLoginStatus,
} from "@zimo/domain";

const OPERATION_TIMEOUT_MS = 15_000;

export class CommunicationChannelService {
  constructor(
    private readonly repository: CommunicationChannelRepository,
    private readonly secrets: SecretStore,
    private readonly weixin: WeixinBindingGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly sessions: SessionStore,
  ) {}

  private readonly loginOwners = new Map<string, string>();

  async list(): Promise<readonly CommunicationChannelBinding[]> {
    const ownerUserId = await this.requireOwnerUserId();
    const existing = await this.repository.list(ownerUserId);
    return (["weixin", "email"] as const).map(
      (kind) =>
        existing.find((item) => item.kind === kind) ?? {
          kind,
          ownerUserId,
          status: "unbound" as const,
          config: {},
          updatedAt: this.clock.now(),
        },
    );
  }

  async bindEmail(email: string): Promise<CommunicationChannelBinding> {
    const ownerUserId = await this.requireOwnerUserId();
    const old = await this.repository.get(ownerUserId, "email");
    const now = this.clock.now();
    const binding: CommunicationChannelBinding = {
      kind: "email",
      ownerUserId,
      status: "bound",
      accountLabel: email,
      config: {},
      boundAt: now,
      updatedAt: now,
    };
    await this.repository.save(binding);
    if (old?.secretRef) await this.secrets.delete(old.secretRef).catch(() => undefined);
    return binding;
  }

  async startWeixin(): Promise<WeixinLoginStart> {
    await this.assertPersistentSecrets();
    const ownerUserId = await this.requireOwnerUserId();
    const result = await withTimeout((signal) => this.weixin.start(signal));
    this.loginOwners.set(result.sessionId, ownerUserId);
    return result;
  }

  async pollWeixin(sessionId: string, verifyCode?: string): Promise<WeixinLoginStatus> {
    const ownerUserId = await this.requireOwnerUserId();
    if (this.loginOwners.get(sessionId) !== ownerUserId) {
      throw new AppError({
        code: "CHANNEL_LOGIN_SESSION_INVALID",
        category: "security",
        userMessage: "微信绑定会话已失效，请重新生成二维码。",
      });
    }
    const result = await withTimeout(
      (signal) => this.weixin.poll(sessionId, verifyCode, signal),
      40_000,
    );
    if (result.status !== "confirmed") return result;
    await this.replaceBinding(
      ownerUserId,
      "weixin",
      result.accountId,
      {
        accountId: result.accountId,
        ...(result.userId ? { userId: result.userId } : {}),
        baseUrl: result.baseUrl,
      },
      JSON.stringify({ botToken: result.botToken }),
    );
    this.loginOwners.delete(sessionId);
    return result;
  }

  async unbind(kind: CommunicationChannelKind): Promise<void> {
    const ownerUserId = await this.requireOwnerUserId();
    const existing = await this.repository.get(ownerUserId, kind);
    await this.repository.clear(ownerUserId, kind, this.clock.now());
    if (existing?.secretRef) await this.secrets.delete(existing.secretRef).catch(() => undefined);
  }

  cancelWeixin(sessionId: string): void {
    this.loginOwners.delete(sessionId);
    this.weixin.cancel(sessionId);
  }

  private async replaceBinding(
    ownerUserId: string,
    kind: CommunicationChannelKind,
    accountLabel: string,
    config: Readonly<Record<string, string | number | boolean>>,
    secret: string,
  ): Promise<CommunicationChannelBinding> {
    const old = await this.repository.get(ownerUserId, kind);
    const secretRef = this.ids.create();
    await this.secrets.set(secretRef, secret);
    const now = this.clock.now();
    const binding: CommunicationChannelBinding = {
      kind,
      ownerUserId,
      status: "bound",
      accountLabel,
      secretRef,
      config,
      boundAt: now,
      updatedAt: now,
    };
    try {
      await this.repository.save(binding);
    } catch (error) {
      await this.secrets.delete(secretRef).catch(() => undefined);
      throw error;
    }
    if (old?.secretRef) await this.secrets.delete(old.secretRef).catch(() => undefined);
    return binding;
  }

  private async assertPersistentSecrets(): Promise<void> {
    const status = await this.secrets.getStatus();
    if (!status.available || !status.persistent) {
      throw new AppError({
        code: "SECRET_STORE_UNAVAILABLE",
        category: "security",
        userMessage: "系统安全存储当前不可用，无法保存通信渠道凭据。",
      });
    }
  }

  private async requireOwnerUserId(): Promise<string> {
    const session = await this.sessions.get();
    if (!session?.externalUserId) {
      throw new AppError({
        code: "AUTHENTICATION_REQUIRED",
        category: "user",
        userMessage: "请先登录后再管理通信渠道。",
      });
    }
    return session.externalUserId;
  }
}

async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = OPERATION_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError({
        code: "CHANNEL_OPERATION_TIMEOUT",
        category: "network",
        userMessage: "连接通信渠道超时，请检查网络后重试。",
        retryable: true,
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
