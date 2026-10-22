import { chmod, mkdir, rename, unlink, writeFile } from "node:fs/promises";

export const API_KEY_ENV = "TENCENT_NEWS_APIKEY";
export const BASE_DOWNLOAD_URL = "https://mat1.gtimg.com/qqcdn/qqnews/cli/hub";
export const DEFAULT_UPDATE_WINDOW_SECONDS = 43200;

const SCRIPT_DIR = import.meta.dir.replaceAll("\\", "/");
export const SKILL_DIR = SCRIPT_DIR.replace(/\/[^/]+$/, "");

const home = (process.env.HOME || process.env.USERPROFILE || "").replaceAll("\\", "/");
export const CONFIG_DIR = `${home}/.config/tencent-news-cli`;
export const CONFIG_FILE = `${CONFIG_DIR}/config.json`;

export function fail(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

export function normalizeApiKey(raw: string): string {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  key = key.replace(/^api[\s_-]*key\s*[:=]\s*/i, "");
  return key.trim();
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapePosixSingleQuoted(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function quotePosix(value: string): string {
  return `'${escapePosixSingleQuoted(value)}'`;
}

function quotePowerShell(value: string): string {
  return `'${escapePowerShellSingleQuoted(value)}'`;
}

function parentDir(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const idx = normalized.lastIndexOf("/");
  if (idx === -1) return ".";
  if (idx === 0) return "/";
  return normalized.slice(0, idx);
}

function createTempSiblingPath(path: string, label: string): string {
  return `${path}.${label}.${process.pid}.${Date.now()}`;
}

async function cleanupFile(path: string) {
  await unlink(path).catch(() => {});
}

async function replaceFile(sourcePath: string, targetPath: string) {
  if (process.platform !== "win32") {
    await rename(sourcePath, targetPath);
    return;
  }

  if (!(await Bun.file(targetPath).exists())) {
    await rename(sourcePath, targetPath);
    return;
  }

  const backupPath = createTempSiblingPath(targetPath, "bak");
  await rename(targetPath, backupPath);
  try {
    await rename(sourcePath, targetPath);
  } catch (error) {
    await rename(backupPath, targetPath).catch(() => {});
    throw error;
  }
  await cleanupFile(backupPath);
}

async function writeTextFileAtomic(path: string, content: string) {
  await mkdir(parentDir(path), { recursive: true });
  const tempPath = createTempSiblingPath(path, "tmp");
  try {
    await writeFile(tempPath, content, "utf8");
    await replaceFile(tempPath, path);
  } finally {
    await cleanupFile(tempPath);
  }
}

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  output: string;
}

async function runCommand(args: string[], description: string): Promise<CommandResult> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  } catch (error) {
    fail(`${description} failed to start: ${formatError(error)}`);
  }

  const stdoutPromise = new Response(proc.stdout).text();
  const stderrPromise = new Response(proc.stderr).text();
  const [stdout, stderr, exitCode] = await Promise.all([stdoutPromise, stderrPromise, proc.exited]);
  const output = (stdout + stderr).trim();
  return { stdout, stderr, exitCode, output };
}

async function runCommandOrFail(args: string[], description: string): Promise<string> {
  const { exitCode, output } = await runCommand(args, description);
  if (exitCode !== 0) {
    fail(`${description} failed with exit code ${exitCode}${output ? `: ${output}` : ""}`);
  }
  return output;
}

export interface PlatformInfo {
  os: string;
  arch: string;
  isWindows: boolean;
  detectedShell: string;
  profilePath: string | null;
  cliFilename: string;
  cliPath: string;
  cliDownloadUrl: string;
  lastCheckFile: string;
  helpCommand: string;
  versionCommand: string;
}

export function detectPlatform(): PlatformInfo {
  let os: string;
  switch (process.platform) {
    case "win32":  os = "windows"; break;
    case "darwin": os = "darwin";  break;
    case "linux":  os = "linux";   break;
    default: fail(`unsupported os: ${process.platform}`);
  }

  let arch: string;
  switch (process.arch) {
    case "arm64": arch = "arm64"; break;
    case "x64":   arch = "amd64"; break;
    default: fail(`unsupported architecture: ${process.arch}`);
  }

  const isWindows = os === "windows";
  const cliFilename = isWindows ? "tencent-news-cli.exe" : "tencent-news-cli";
  const cliPath = `${SKILL_DIR}/${cliFilename}`;
  const cliDownloadUrl = `${BASE_DOWNLOAD_URL}/${os}-${arch}/${cliFilename}`;
  const lastCheckFile = `${SKILL_DIR}/.last-update-check-${os}-${arch}`;

  let detectedShell: string;
  let profilePath: string | null;

  if (isWindows) {
    detectedShell = "powershell";
    profilePath = `${home}/Documents/WindowsPowerShell/Microsoft.PowerShell_profile.ps1`;
  } else {
    const shell = process.env.SHELL || "/bin/sh";
    detectedShell = shell.split("/").pop() || "sh";
    switch (detectedShell) {
      case "zsh":  profilePath = `${home}/.zshrc`;  break;
      case "bash": profilePath = `${home}/.bashrc`; break;
      default:     profilePath = null;
    }
  }

  const helpCommand = isWindows
    ? `& ${quotePowerShell(cliPath)} help`
    : `${quotePosix(cliPath)} help`;
  const versionCommand = isWindows
    ? `& ${quotePowerShell(cliPath)} version`
    : `${quotePosix(cliPath)} version`;

  return {
    os, arch, isWindows, detectedShell, profilePath,
    cliFilename, cliPath, cliDownloadUrl, lastCheckFile,
    helpCommand, versionCommand,
  };
}

export function getPlatformJson(p: PlatformInfo) {
  return {
    os: p.os,
    arch: p.arch,
    detectedShell: p.detectedShell,
    preferredShell: p.detectedShell,
    profilePath: p.profilePath,
    cliFilename: p.cliFilename,
    cliPath: p.cliPath,
    cliDownloadUrl: p.cliDownloadUrl,
    lastCheckFile: p.lastCheckFile,
    helpCommand: p.helpCommand,
    versionCommand: p.versionCommand,
  };
}

export async function downloadFile(url: string, outputPath: string) {
  const resp = await fetch(url);
  if (!resp.ok) fail(`download failed: ${resp.status} ${resp.statusText} from ${url}`);
  await mkdir(parentDir(outputPath), { recursive: true });
  await Bun.write(outputPath, resp);
}

export async function readLastCheckEpoch(file: string): Promise<number> {
  const f = Bun.file(file);
  if (!(await f.exists())) return 0;
  const raw = (await f.text()).trim();
  const val = parseInt(raw, 10);
  return isNaN(val) ? 0 : val;
}

export async function writeLastCheckEpoch(file: string, epoch?: number): Promise<number> {
  const ts = epoch ?? Math.floor(Date.now() / 1000);
  await Bun.write(file, `${ts}\n`);
  return ts;
}

export async function runCliVersion(cliPath: string): Promise<string> {
  if (!(await Bun.file(cliPath).exists())) fail(`cli not found at ${cliPath}`);
  if (process.platform !== "win32") {
    await chmod(cliPath, 0o755).catch(() => {});
  }
  return runCommandOrFail([cliPath, "version"], `${cliPath} version`);
}

export interface CliVersionInfo {
  current_version?: string;
  latest_version?: string;
  need_update?: boolean;
  release_notes?: string;
  download_urls?: Record<string, string>;
}

export function parseCliVersionJson(raw: string, context: string): CliVersionInfo {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`${context} did not return valid JSON: ${raw || "(empty output)"}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${context} did not return a JSON object: ${raw || "(empty output)"}`);
  }

  return parsed as CliVersionInfo;
}

export interface InstallCliResult {
  rawVersionOutput: string;
  versionInfo: CliVersionInfo;
}

export async function downloadAndInstallCli(downloadUrl: string, cliPath: string): Promise<InstallCliResult> {
  const tempPath = createTempSiblingPath(cliPath, "download");
  try {
    await downloadFile(downloadUrl, tempPath);
    const rawVersionOutput = await runCliVersion(tempPath);
    const versionInfo = parseCliVersionJson(rawVersionOutput, `${tempPath} version`);
    await replaceFile(tempPath, cliPath);
    if (process.platform !== "win32") {
      await chmod(cliPath, 0o755).catch(() => {});
    }
    return { rawVersionOutput, versionInfo };
  } finally {
    await cleanupFile(tempPath);
  }
}

// ── Config-file helpers ──

export async function readConfigApiKey(): Promise<string> {
  const f = Bun.file(CONFIG_FILE);
  if (!(await f.exists())) return "";
  try {
    const cfg = await f.json();
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return "";
    const value = (cfg as Record<string, unknown>)[API_KEY_ENV];
    return typeof value === "string" ? normalizeApiKey(value) : "";
  } catch {
    return "";
  }
}

export async function writeConfigApiKey(key: string) {
  const normalizedKey = normalizeApiKey(key);
  let nextConfig: Record<string, unknown> = {};
  const f = Bun.file(CONFIG_FILE);
  if (await f.exists()) {
    try {
      const existing = await f.json();
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) {
        fail(`existing config file is not a JSON object: ${CONFIG_FILE}`);
      }
      nextConfig = { ...(existing as Record<string, unknown>) };
    } catch {
      fail(`existing config file is not valid JSON: ${CONFIG_FILE}`);
    }
  }

  nextConfig[API_KEY_ENV] = normalizedKey;
  await writeTextFileAtomic(CONFIG_FILE, JSON.stringify(nextConfig, null, 2) + "\n");
  if (process.platform !== "win32") {
    await chmod(CONFIG_FILE, 0o600).catch(() => {});
  }
}

// ── API-key state ──

export async function getApiKeyState(p: PlatformInfo) {
  const present = !!process.env[API_KEY_ENV];
  const result: Record<string, any> = {
    envVar: API_KEY_ENV,
    present,
    configFile: CONFIG_FILE,
    detectedShell: p.detectedShell,
    preferredShell: p.detectedShell,
    profilePath: p.profilePath,
    canAutoConfigure: true,
    verificationCommand: p.isWindows
      ? "$env:TENCENT_NEWS_APIKEY"
      : 'printf \'%s\\n\' "$TENCENT_NEWS_APIKEY"',
  };

  if (!present) {
    const cfgVal = await readConfigApiKey();
    if (cfgVal) {
      result.configFileHasKey = true;
      result.restoreCommand = p.isWindows
        ? `$env:${API_KEY_ENV} = ${quotePowerShell(cfgVal)}`
        : `export ${API_KEY_ENV}=${quotePosix(cfgVal)}`;
    } else {
      result.configFileHasKey = false;
    }
  }

  return result;
}

// ── Set API key ──

export interface SetApiKeyResult {
  storage: string;
  profilePath: string | null;
  sessionCommand: string;
}

export async function setApiKeyEnv(p: PlatformInfo, key: string): Promise<SetApiKeyResult> {
  const normalizedKey = normalizeApiKey(key);
  if (!normalizedKey) fail("API key is empty after normalization");

  let storage: string;
  let profilePath = p.profilePath;

  if (p.isWindows) {
    await runCommandOrFail([
      "powershell", "-NoProfile", "-Command",
      `[Environment]::SetEnvironmentVariable('${API_KEY_ENV}', ${quotePowerShell(normalizedKey)}, 'User')`,
    ], "persist API key to the Windows user environment");
    storage = "windows-user-env";
  } else if (p.os === "darwin") {
    const target = profilePath || `${home}/.profile`;
    await updateShellProfile(target, normalizedKey);
    profilePath = target;
    try {
      await runCommand(["launchctl", "setenv", API_KEY_ENV, normalizedKey], "launchctl setenv");
    } catch {}
    storage = "macos-env";
  } else {
    const target = profilePath || `${home}/.profile`;
    await updateShellProfile(target, normalizedKey);
    profilePath = target;
    storage = "linux-shell-profile";
  }

  await writeConfigApiKey(normalizedKey);

  const sessionCommand = p.isWindows
    ? `$env:${API_KEY_ENV} = ${quotePowerShell(normalizedKey)}`
    : `export ${API_KEY_ENV}=${quotePosix(normalizedKey)}`;

  return { storage, profilePath, sessionCommand };
}

async function updateShellProfile(profilePath: string, key: string) {
  let content = "";
  const f = Bun.file(profilePath);
  if (await f.exists()) {
    content = await f.text();
  }
  const regex = new RegExp(`^\\s*export\\s+${API_KEY_ENV}=.*$`, "gm");
  content = content.replace(regex, "").replace(/\n{3,}/g, "\n\n");
  content = content.trimEnd() + `\nexport ${API_KEY_ENV}=${quotePosix(key)}\n`;
  await writeTextFileAtomic(profilePath, content);
}
