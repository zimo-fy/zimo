import { randomBytes } from "node:crypto";
import { createServer, type Server, type ServerResponse } from "node:http";

import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { AppError } from "@zimo/domain";

const CALLBACK_PATH = "/oauth/callback";
const AUTHORIZATION_TIMEOUT_MS = 5 * 60_000;
const MAX_CREDENTIAL_CHARACTERS = 128_000;

interface StoredOAuthCredential {
  version: 1;
  tokens?: StoredOAuthTokens;
  clients: Readonly<Record<string, StoredOAuthClientInformation>>;
  discovery?: OAuthDiscoveryState;
}

export type OpenAuthorizationPage = (url: string) => Promise<void>;

export interface OAuthCompletingTransport {
  finishAuth(callbackParams: URLSearchParams): Promise<void>;
}

export class McpOAuthSession {
  private readonly callback = new LoopbackOAuthCallback();
  private readonly provider: DesktopOAuthProvider;

  constructor(
    credential: string | undefined,
    private readonly openAuthorizationPage: OpenAuthorizationPage,
  ) {
    this.provider = new DesktopOAuthProvider(parseCredential(credential), (url) =>
      this.openAuthorization(url),
    );
  }

  get authProvider(): OAuthClientProvider {
    return this.provider;
  }

  async connect(
    connect: () => Promise<void>,
    transport: OAuthCompletingTransport,
    signal: AbortSignal,
  ): Promise<void> {
    await this.callback.start(signal);
    this.provider.setRedirectUrl(this.callback.redirectUrl);
    try {
      await connect();
    } catch (error) {
      if (!this.provider.didRedirect) throw error;
      const callbackUrl = await this.callback.wait(signal);
      this.provider.validateState(callbackUrl.searchParams.get("state"));
      await transport.finishAuth(callbackUrl.searchParams);
      await connect();
    } finally {
      await this.callback.close();
    }
  }

  serializeCredential(): string {
    return this.provider.serialize();
  }

  async close(): Promise<void> {
    await this.callback.close();
  }

  private async openAuthorization(url: URL): Promise<void> {
    if (url.protocol !== "https:") throw oauthError("授权页面不是安全的 HTTPS 地址。");
    await this.openAuthorizationPage(url.toString());
  }
}

class DesktopOAuthProvider implements OAuthClientProvider {
  private redirect: URL | undefined;
  private verifier: string | undefined;
  private expectedState = randomBytes(32).toString("base64url");
  private currentTokens: StoredOAuthTokens | undefined;
  private readonly clients = new Map<string, StoredOAuthClientInformation>();
  private currentDiscovery: OAuthDiscoveryState | undefined;
  didRedirect = false;

  constructor(
    credential: StoredOAuthCredential,
    private readonly redirectAuthorization: (url: URL) => Promise<void>,
  ) {
    this.currentTokens = credential.tokens;
    this.currentDiscovery = credential.discovery;
    for (const [issuer, client] of Object.entries(credential.clients)) {
      this.clients.set(issuer, client);
    }
  }

  get redirectUrl(): URL | undefined {
    return this.redirect;
  }

  get clientMetadata(): OAuthClientMetadata {
    if (!this.redirect) throw oauthError("OAuth 回调地址尚未准备完成。");
    return {
      redirect_uris: [this.redirect.toString()],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      application_type: "native",
      client_name: "Zimo Desktop",
      software_id: "com.zimo.desktop",
      software_version: "0.1.0",
    };
  }

  setRedirectUrl(value: URL): void {
    this.redirect = value;
  }

  state(): string {
    return this.expectedState;
  }

  clientInformation(
    context?: OAuthClientInformationContext,
  ): StoredOAuthClientInformation | undefined {
    return context ? this.clients.get(context.issuer) : this.clients.values().next().value;
  }

  saveClientInformation(
    value: StoredOAuthClientInformation,
    context?: OAuthClientInformationContext,
  ): void {
    this.clients.set(context?.issuer ?? value.issuer ?? "default", value);
  }

  tokens(): StoredOAuthTokens | undefined {
    return this.currentTokens;
  }

  saveTokens(value: StoredOAuthTokens): void {
    this.currentTokens = value;
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    this.didRedirect = true;
    await this.redirectAuthorization(url);
  }

  saveCodeVerifier(value: string): void {
    this.verifier = value;
  }

  codeVerifier(): string {
    if (!this.verifier) throw oauthError("OAuth PKCE 校验信息已丢失，请重新绑定。");
    return this.verifier;
  }

  saveDiscoveryState(value: OAuthDiscoveryState): void {
    this.currentDiscovery = value;
  }

  discoveryState(): OAuthDiscoveryState | undefined {
    return this.currentDiscovery;
  }

  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): void {
    if (scope === "all" || scope === "tokens") this.currentTokens = undefined;
    if (scope === "all" || scope === "client") this.clients.clear();
    if (scope === "all" || scope === "verifier") this.verifier = undefined;
    if (scope === "all" || scope === "discovery") this.currentDiscovery = undefined;
  }

  validateState(actual: string | null): void {
    if (!actual || actual !== this.expectedState) {
      throw oauthError("OAuth 回调校验失败，请重新绑定。");
    }
  }

  serialize(): string {
    const value: StoredOAuthCredential = {
      version: 1,
      ...(this.currentTokens ? { tokens: this.currentTokens } : {}),
      clients: Object.fromEntries(this.clients),
      ...(this.currentDiscovery ? { discovery: this.currentDiscovery } : {}),
    };
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_CREDENTIAL_CHARACTERS) {
      throw oauthError("OAuth 凭据超过本地安全存储上限。");
    }
    return serialized;
  }
}

class LoopbackOAuthCallback {
  private server: Server | undefined;
  private callbackUrl: URL | undefined;
  private resolveCallback: ((value: URL) => void) | undefined;
  private rejectCallback: ((reason: Error) => void) | undefined;
  private callbackPromise: Promise<URL> | undefined;

  get redirectUrl(): URL {
    if (!this.callbackUrl) throw oauthError("OAuth 回调监听器尚未启动。");
    return this.callbackUrl;
  }

  async start(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    this.callbackPromise = new Promise<URL>((resolve, reject) => {
      this.resolveCallback = resolve;
      this.rejectCallback = reject;
    });
    this.server = createServer((request, response) => {
      const base = this.callbackUrl;
      if (!base || !request.url) return respond(response, 400, "授权回调无效");
      const url = new URL(request.url, base);
      if (request.method !== "GET" || url.pathname !== CALLBACK_PATH) {
        return respond(response, 404, "页面不存在");
      }
      respond(response, 200, "授权结果已返回 Zimo，可以关闭此页面。");
      this.resolveCallback?.(url);
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw oauthError("无法建立 OAuth 回调监听器。");
    this.callbackUrl = new URL(`http://127.0.0.1:${address.port}${CALLBACK_PATH}`);
  }

  async wait(signal: AbortSignal): Promise<URL> {
    if (!this.callbackPromise) throw oauthError("OAuth 回调监听器尚未启动。");
    const timeout = setTimeout(
      () => this.rejectCallback?.(oauthError("OAuth 授权已超时，请重新绑定。")),
      AUTHORIZATION_TIMEOUT_MS,
    );
    const onAbort = () => this.rejectCallback?.(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    try {
      return await this.callbackPromise;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
    }
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function parseCredential(value: string | undefined): StoredOAuthCredential {
  if (!value) return { version: 1, clients: {} };
  if (value.length > MAX_CREDENTIAL_CHARACTERS) throw oauthError("OAuth 凭据格式无效。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw oauthError("OAuth 凭据格式无效。");
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.clients)) {
    throw oauthError("OAuth 凭据格式无效。");
  }
  // The SDK originally produced these objects. Re-check the secret-bearing minimum fields
  // before restoring them across a process restart.
  if (parsed.tokens !== undefined && !isRecord(parsed.tokens))
    throw oauthError("OAuth 凭据格式无效。");
  for (const client of Object.values(parsed.clients)) {
    if (!isRecord(client) || typeof client.client_id !== "string") {
      throw oauthError("OAuth 客户端注册信息无效。");
    }
  }
  return parsed as unknown as StoredOAuthCredential;
}

function respond(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(`<!doctype html><meta charset="utf-8"><title>Zimo MCP</title><p>${message}</p>`);
}

function oauthError(userMessage: string): AppError {
  return new AppError({ code: "MCP_OAUTH_FAILED", category: "configuration", userMessage });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
