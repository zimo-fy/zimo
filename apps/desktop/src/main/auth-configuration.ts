/** Loopback placeholder when optional cloud catalog gateways need a base URL. */
export const UNCONFIGURED_REMOTE_DEV_API_BASE_URL = "http://127.0.0.1:65534/unconfigured-dev-api/";

function normalizeDevApiBaseUrl(raw: string): string {
  const url = new URL(raw);
  return url.toString().endsWith("/") ? url.toString() : `${url.toString()}/`;
}

export function resolveAuthBaseUrl(options: {
  packaged: boolean;
  override?: string | undefined;
}): string | null {
  if (options.packaged) return null;
  const trimmed = options.override?.trim();
  if (!trimmed) return null;
  const url = new URL(trimmed);
  const loopback =
    url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (!loopback || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error("ZIMO_AUTH_BASE_URL is limited to a loopback HTTP(S) endpoint in development");
  }
  return normalizeDevApiBaseUrl(trimmed);
}

export function resolveOptionalCloudDevApiBaseUrl(authBaseUrl: string | null): string {
  return authBaseUrl ?? UNCONFIGURED_REMOTE_DEV_API_BASE_URL;
}
