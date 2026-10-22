import {
  detectPlatform, downloadAndInstallCli, parseCliVersionJson, runCliVersion, writeLastCheckEpoch, fail,
} from "./_common.ts";

if (process.argv[2] === "help") {
  console.log(
    "Usage: bun scripts/check-update.ts [--apply]\n\n" +
    "Inspect the CLI version JSON and optionally download the newer binary.",
  );
  process.exit(0);
}

let applyUpdate = false;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--apply") {
    applyUpdate = true;
  } else {
    fail(`unknown argument: ${args[i]}`);
  }
}

const p = detectPlatform();
if (!(await Bun.file(p.cliPath).exists())) {
  fail(`cli not found at ${p.cliPath}. Run bun scripts/install-cli.ts first.`);
}

const rawBefore = await runCliVersion(p.cliPath);
const before = parseCliVersionJson(rawBefore, `${p.cliPath} version`);

const platformKey = `${p.os}_${p.arch}`;
const selectedDownloadUrl = before.download_urls?.[platformKey] || p.cliDownloadUrl;
const needUpdate = !!before.need_update;

let applied = false;
let rawAfter = rawBefore;
let afterCurrentVersion = before.current_version ?? null;

if (applyUpdate && needUpdate) {
  const installResult = await downloadAndInstallCli(selectedDownloadUrl, p.cliPath);
  rawAfter = installResult.rawVersionOutput;
  afterCurrentVersion = installResult.versionInfo.current_version ?? null;
  applied = true;
}

const checkedAt = await writeLastCheckEpoch(p.lastCheckFile);

console.log(JSON.stringify({
  platform: { os: p.os, arch: p.arch, cliPath: p.cliPath },
  checkedAt,
  needUpdate,
  applied,
  selectedDownloadUrl,
  currentVersion: afterCurrentVersion,
  latestVersion: before.latest_version ?? null,
  releaseNotes: before.release_notes ?? null,
  rawBefore,
  rawAfter,
}, null, 2));
