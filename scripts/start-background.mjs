import { openSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [port, logFile, pidFile] = process.argv.slice(2);
if (!port || !logFile || !pidFile) throw new Error("usage: start-background.mjs <port> <log-file> <pid-file>");

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const logFd = openSync(logFile, "a");
const child = spawn(process.execPath, ["dist/server.js"], {
  cwd: rootDir,
  detached: true,
  env: { ...process.env, MEMORY_PORT: port },
  stdio: ["ignore", logFd, logFd],
});
child.unref();
writeFileSync(pidFile, `${child.pid}\n`);
process.stdout.write(`${child.pid}\n`);
