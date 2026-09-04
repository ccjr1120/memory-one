import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const playwrightVersion = "1.55.0";
const defaultBaseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:8765";
const defaultOutputDir = process.env.SCREENSHOT_OUTPUT_DIR ?? "docs/screenshots";
const defaultViewport = process.env.SCREENSHOT_VIEWPORT ?? "1440,1000";
const defaultWait = Number(process.env.SCREENSHOT_WAIT_MS ?? 1500);

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const baseUrl = option("--base-url", defaultBaseUrl).replace(/\/$/, "");
const outputDir = resolve(option("--output-dir", defaultOutputDir));
const viewport = option("--viewport", defaultViewport);
const waitMs = Number(option("--wait-ms", defaultWait));
const fullPage = !process.argv.includes("--no-full-page");

if (!/^\d+,\d+$/.test(viewport)) {
  throw new Error(`Invalid --viewport value: ${viewport}. Use WIDTH,HEIGHT, for example 1440,1000.`);
}
if (!Number.isFinite(waitMs) || waitMs < 0) {
  throw new Error(`Invalid --wait-ms value: ${waitMs}.`);
}

mkdirSync(outputDir, { recursive: true });

const screenshots = [
  { path: "memory-overview.png", url: `${baseUrl}/` },
  { path: "mcp-codex.png", url: `${baseUrl}/mcp-service` },
];
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

for (const screenshot of screenshots) {
  const outputPath = resolve(outputDir, screenshot.path);
  console.log(`Capturing ${screenshot.url} -> ${outputPath}`);
  const result = spawnSync(
    npxCommand,
    [
      "--yes",
      `playwright@${playwrightVersion}`,
      "screenshot",
      "--browser",
      "chromium",
      "--viewport-size",
      viewport,
      "--wait-for-timeout",
      String(waitMs),
      ...(fullPage ? ["--full-page"] : []),
      screenshot.url,
      outputPath,
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Saved ${screenshots.length} screenshots in ${outputDir}`);
