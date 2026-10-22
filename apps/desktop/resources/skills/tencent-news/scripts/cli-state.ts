import {
  detectPlatform, getPlatformJson, getApiKeyState,
  readLastCheckEpoch, DEFAULT_UPDATE_WINDOW_SECONDS, fail,
} from "./_common.ts";

if (process.argv[2] === "help") {
  console.log(
    "Usage: bun scripts/cli-state.ts [--update-window-seconds SECONDS]\n\n" +
    "Print install state, update-check window status, and API key status.",
  );
  process.exit(0);
}

let updateWindowSeconds = DEFAULT_UPDATE_WINDOW_SECONDS;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--update-window-seconds") {
    if (i + 1 >= args.length) fail("--update-window-seconds requires a value");
    const val = parseInt(args[++i], 10);
    if (isNaN(val) || val < 0) fail("--update-window-seconds must be a non-negative integer");
    updateWindowSeconds = val;
  } else {
    fail(`unknown argument: ${args[i]}`);
  }
}

const p = detectPlatform();
const cliExists = await Bun.file(p.cliPath).exists();
const lastCheckEpoch = await readLastCheckEpoch(p.lastCheckFile);
const nowEpoch = Math.floor(Date.now() / 1000);

console.log(JSON.stringify({
  platform: getPlatformJson(p),
  cliExists,
  lastCheckEpoch,
  nowEpoch,
  updateWindowSeconds,
  needsUpdateCheck: (nowEpoch - lastCheckEpoch) > updateWindowSeconds,
  apiKey: await getApiKeyState(p),
}, null, 2));
