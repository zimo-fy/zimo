import type { AuthSessionView } from "@zimo/contracts";
import type { AuthSession } from "@zimo/domain";

export function mapPlatform(): "darwin" | "win32" | "linux" {
  if (process.platform === "darwin" || process.platform === "win32") return process.platform;
  return "linux";
}

export function toAuthView(session: AuthSession): AuthSessionView {
  return {
    id: session.id,
    externalUserId: session.externalUserId,
    account: session.account,
    ...(session.email ? { email: session.email } : {}),
    displayName: session.displayName,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}
