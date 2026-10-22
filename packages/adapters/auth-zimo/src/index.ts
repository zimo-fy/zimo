import {
  AppError,
  type AuthProvider,
  type AuthSession,
  type Clock,
  type IdGenerator,
  type LoginInput,
  type SecretStore,
  type SessionStore,
} from "@zimo/domain";
import { z } from "zod";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const FALLBACK_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const loginResponseSchema = z
  .object({
    success: z.boolean().optional(),
    code: z.union([z.string(), z.number()]).optional(),
    msg: z.string().max(500).optional(),
    token: z.string().min(1).max(16_384).optional(),
    modelApiKey: z.string().trim().min(1).max(16_384).optional(),
    userId: z.union([z.string(), z.number()]).optional(),
    phonenumber: z.union([z.string(), z.number()]).nullish(),
    email: z.string().nullish(),
    userName: z.string().nullish(),
    nickName: z.string().nullish(),
  })
  .passthrough();

const verifyResponseSchema = z
  .object({
    success: z.boolean().optional(),
    code: z.union([z.string(), z.number()]).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    user: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export interface ZimoLoginResult {
  token: string;
  modelApiKey: string;
  externalUserId: string;
  account: string;
  email?: string | undefined;
  displayName: string;
  expiresAt?: Date | undefined;
}

export interface ZimoAuthGateway {
  login(input: LoginInput): Promise<ZimoLoginResult>;
  verify(token: string): Promise<{ valid: boolean; externalUserId?: string }>;
}

export class ZimoHttpAuthGateway implements ZimoAuthGateway {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  async login(input: LoginInput): Promise<ZimoLoginResult> {
    const body = new URLSearchParams({ username: input.username, password: input.password });
    const response = await this.request("zimoLogin", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const parsed = loginResponseSchema.safeParse(response.body);
    if (!parsed.success) throw invalidResponse();
    const value = parsed.data;
    if (response.status === 401 || response.status === 403 || value.success === false) {
      throw invalidCredentials(value.msg);
    }
    if (response.status < 200 || response.status >= 300) throw serviceUnavailable(response.status);
    const externalUserId = normalizeIdentifier(value.userId);
    if (!value.token || !value.modelApiKey || !externalUserId) throw invalidResponse();
    const account = normalizeIdentifier(value.phonenumber) ?? input.username;
    const displayName = truncateName(value.nickName ?? value.userName ?? account);
    const email = validEmail(value.email);
    const expiresAt = jwtExpiration(value.token);
    return {
      token: value.token,
      modelApiKey: value.modelApiKey,
      externalUserId,
      account,
      displayName,
      ...(email ? { email } : {}),
      ...(expiresAt ? { expiresAt } : {}),
    };
  }

  async verify(token: string): Promise<{ valid: boolean; externalUserId?: string }> {
    const response = await this.request("verify-token", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 401 || response.status === 403) return { valid: false };
    if (response.status < 200 || response.status >= 300) throw serviceUnavailable(response.status);
    const parsed = verifyResponseSchema.safeParse(response.body);
    if (!parsed.success) throw invalidResponse();
    const value = parsed.data;
    const accepted = value.success === true || String(value.code) === "200";
    if (!accepted) return { valid: false };
    const user = value.data ?? value.user ?? {};
    const externalUserId = normalizeIdentifier(user.userId ?? user.id);
    return externalUserId ? { valid: true, externalUserId } : { valid: false };
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<{ status: number; body: unknown }> {
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl), {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw new AppError({
        code: "AUTH_SERVICE_UNAVAILABLE",
        category: "network",
        userMessage: "暂时无法连接登录服务，请检查网络后重试。",
        retryable: true,
        cause,
      });
    }
    if (response.status >= 300 && response.status < 400) throw serviceUnavailable(response.status);
    const text = await readLimitedText(response);
    try {
      return { status: response.status, body: JSON.parse(text) as unknown };
    } catch (cause) {
      throw invalidResponse(cause);
    }
  }
}

export class ZimoAuthProvider implements AuthProvider {
  constructor(
    private readonly store: SessionStore,
    private readonly secrets: SecretStore,
    private readonly gateway: ZimoAuthGateway,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async login(input: LoginInput) {
    await this.requireSecureStorage();
    const previous = await this.store.get();
    const result = await this.gateway.login(input);
    const now = this.clock.now();
    if (result.expiresAt && result.expiresAt.getTime() <= now.getTime()) throw invalidResponse();
    const tokenSecretRef = this.ids.create();
    const session: AuthSession = {
      id: this.ids.create() as AuthSession["id"],
      provider: "zimo-cloud",
      externalUserId: result.externalUserId,
      account: result.account,
      ...(result.email ? { email: result.email } : {}),
      displayName: result.displayName,
      tokenSecretRef,
      createdAt: now,
      expiresAt: result.expiresAt ?? new Date(now.getTime() + FALLBACK_SESSION_DURATION_MS),
    };
    await this.secrets.set(tokenSecretRef, result.token);
    try {
      await this.store.save(session);
    } catch (cause) {
      await this.secrets.delete(tokenSecretRef).catch(() => undefined);
      throw cause;
    }
    if (previous?.tokenSecretRef && previous.tokenSecretRef !== tokenSecretRef) {
      await this.secrets.delete(previous.tokenSecretRef).catch(() => undefined);
    }
    return { session, modelApiKey: result.modelApiKey };
  }

  async logout(): Promise<void> {
    const current = await this.store.get();
    if (current?.tokenSecretRef) await this.secrets.delete(current.tokenSecretRef);
    await this.store.clear();
  }

  async getSession(): Promise<AuthSession | null> {
    const session = await this.store.get();
    if (!session) return null;
    if (session.expiresAt.getTime() <= this.clock.now().getTime()) {
      await this.clearSession(session);
      return null;
    }
    const token = await this.secrets.get(session.tokenSecretRef);
    if (!token) {
      await this.store.clear();
      return null;
    }
    const verified = await this.gateway.verify(token);
    if (!verified.valid || verified.externalUserId !== session.externalUserId) {
      await this.clearSession(session);
      return null;
    }
    return session;
  }

  async refreshSession(): Promise<AuthSession> {
    const session = await this.getSession();
    if (session) return session;
    throw new AppError({
      code: "AUTH_SESSION_MISSING",
      category: "user",
      userMessage: "登录状态已失效，请重新登录。",
    });
  }

  private async requireSecureStorage(): Promise<void> {
    const status = await this.secrets.getStatus();
    if (status.available && status.persistent) return;
    throw new AppError({
      code: "AUTH_SECURE_STORAGE_UNAVAILABLE",
      category: "security",
      userMessage: "系统安全存储不可用，无法安全保存登录状态。",
    });
  }

  private async clearSession(session: AuthSession): Promise<void> {
    await this.store.clear();
    await this.secrets.delete(session.tokenSecretRef).catch(() => undefined);
  }
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) return result + decoder.decode();
    bytes += chunk.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw invalidResponse();
    }
    result += decoder.decode(chunk.value, { stream: true });
  }
}

function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized && normalized.length <= 128 ? normalized : undefined;
}

function truncateName(value: string | number): string {
  return String(value).trim().slice(0, 80) || "Zimo 用户";
}

function validEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  return z.email().max(254).safeParse(normalized).success ? normalized : undefined;
}

function jwtExpiration(token: string): Date | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) return undefined;
    const date = new Date(decoded.exp * 1000);
    return Number.isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

function invalidCredentials(message?: string): AppError {
  return new AppError({
    code: "AUTH_INVALID_CREDENTIALS",
    category: "user",
    userMessage: message?.trim().slice(0, 200) || "账号或密码不正确。",
  });
}

function serviceUnavailable(status: number): AppError {
  return new AppError({
    code: "AUTH_SERVICE_UNAVAILABLE",
    category: "network",
    userMessage: "登录服务暂时不可用，请稍后重试。",
    retryable: true,
    safeDetails: { status },
  });
}

function invalidResponse(cause?: unknown): AppError {
  return new AppError({
    code: "AUTH_INVALID_RESPONSE",
    category: "internal",
    userMessage: "登录服务返回了无法识别的数据，请稍后重试。",
    retryable: true,
    cause,
  });
}
