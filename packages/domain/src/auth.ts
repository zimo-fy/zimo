export type AuthSessionId = string & { readonly __entity: "AuthSession" };

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthSession {
  id: AuthSessionId;
  provider: "zimo-cloud";
  externalUserId: string;
  account: string;
  email?: string | undefined;
  displayName: string;
  tokenSecretRef: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AuthLoginResult {
  session: AuthSession;
  modelApiKey: string;
}

export interface AuthProvider {
  login(input: LoginInput): Promise<AuthLoginResult>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession>;
}

export interface SessionStore {
  get(): Promise<AuthSession | null>;
  save(session: AuthSession): Promise<void>;
  clear(): Promise<void>;
}
