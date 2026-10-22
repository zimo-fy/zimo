import {
  detectPlatform, getApiKeyState, setApiKeyEnv,
  API_KEY_ENV, CONFIG_FILE, fail, normalizeApiKey,
} from "./_common.ts";

if (process.argv[2] === "help") {
  console.log(
    `Usage: bun scripts/api-key.ts [--set KEY]\n\n` +
    `Inspect or persist the ${API_KEY_ENV} value.`,
  );
  process.exit(0);
}

let apiKey = "";
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--set") {
    if (i + 1 >= args.length) fail("--set requires a value");
    apiKey = normalizeApiKey(args[++i]);
  } else {
    fail(`unknown argument: ${args[i]}`);
  }
}

const p = detectPlatform();

if (!apiKey) {
  console.log(JSON.stringify(await getApiKeyState(p), null, 2));
  process.exit(0);
}

const result = await setApiKeyEnv(p, apiKey);

console.log(JSON.stringify({
  envVar: API_KEY_ENV,
  present: true,
  detectedShell: p.detectedShell,
  preferredShell: p.detectedShell,
  profilePath: result.profilePath,
  canAutoConfigure: true,
  configured: true,
  storage: result.storage,
  configFile: CONFIG_FILE,
  sessionCommand: result.sessionCommand,
  verificationCommand: p.isWindows
    ? "$env:TENCENT_NEWS_APIKEY"
    : 'printf \'%s\\n\' "$TENCENT_NEWS_APIKEY"',
  requiresNewTerminal: false,
  note: "Run sessionCommand in the current terminal if you need the key immediately.",
}, null, 2));
