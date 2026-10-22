import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";

export function resolvePnpmInvocation({
  env = process.env,
  platform = process.platform,
  nodeExecPath = process.execPath,
  fileExists = existsSync,
} = {}) {
  const fromEnv = env.npm_execpath;
  if (typeof fromEnv === "string" && fromEnv.length > 0 && fileExists(fromEnv)) {
    return { command: nodeExecPath, argsPrefix: [fromEnv], shell: false };
  }

  const bundledCli = join(dirname(nodeExecPath), "node_modules", "pnpm", "bin", "pnpm.cjs");
  if (fileExists(bundledCli)) {
    return { command: nodeExecPath, argsPrefix: [bundledCli], shell: false };
  }

  if (platform === "win32") {
    return { command: "pnpm.cmd", argsPrefix: [], shell: true };
  }

  return { command: "pnpm", argsPrefix: [], shell: false };
}
