import { openSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [runtimeDir, port, logFile, pidFile] = process.argv.slice(2);
if (!runtimeDir || !port || !logFile || !pidFile) throw new Error("usage: start-background.mjs <runtime-dir> <port> <log-file> <pid-file>");

const logFd = openSync(logFile, "a");
const child = spawn(process.execPath, [`${runtimeDir}/dist/server.js`], {
  cwd: runtimeDir,
  detached: true,
  env: { ...process.env, MEMORY_PORT: port },
  stdio: ["ignore", logFd, logFd],
});
child.unref();
writeFileSync(pidFile, `${child.pid}\n`);
process.stdout.write(`${child.pid}\n`);
