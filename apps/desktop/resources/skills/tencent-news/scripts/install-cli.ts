import {
  detectPlatform, downloadAndInstallCli, fail,
} from "./_common.ts";

if (process.argv[2] === "help") {
  console.log(
    "Usage: bun scripts/install-cli.ts [--url DOWNLOAD_URL]\n\n" +
    "Download the current-platform CLI into the skill directory and verify it with version.",
  );
  process.exit(0);
}

let customUrl = "";
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url") {
    if (i + 1 >= args.length) fail("--url requires a value");
    customUrl = args[++i];
  } else {
    fail(`unknown argument: ${args[i]}`);
  }
}

const p = detectPlatform();
const downloadUrl = customUrl || p.cliDownloadUrl;

const { rawVersionOutput, versionInfo } = await downloadAndInstallCli(downloadUrl, p.cliPath);
const currentVersion = versionInfo.current_version ?? null;
const latestVersion = versionInfo.latest_version ?? null;

console.log(JSON.stringify({
  installed: true,
  platform: { os: p.os, arch: p.arch, cliPath: p.cliPath },
  downloadUrl,
  currentVersion,
  latestVersion,
  rawVersionOutput,
}, null, 2));
