import { join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { net, protocol, session } from "electron";

import { buildContentSecurityPolicy } from "./content-security-policy";

export function configureSessionSecurity(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          buildContentSecurityPolicy(Boolean(process.env.ELECTRON_RENDERER_URL)),
        ],
      },
    });
  });
}

export function registerAppProtocol(moduleDirectory: string): void {
  const rendererRoot = resolve(join(moduleDirectory, "../renderer"));
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const relativePath =
      normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, "") || "index.html";
    const target = resolve(rendererRoot, relativePath);
    if (target !== rendererRoot && !target.startsWith(`${rendererRoot}${sep}`)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}
