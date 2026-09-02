import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";

const ports = [8765, 5173];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let stopping = false;

function listeningPids(port) {
  if (process.platform === "win32") return [];
  try {
    const output = execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

async function clearPort(port) {
  const pids = listeningPids(port);
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  if (!pids.length) return;
  await new Promise((resolve) => setTimeout(resolve, 200));
  for (const pid of listeningPids(port)) {
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
}

async function main() {
  for (const port of ports) await clearPort(port);
  const children = [
    spawn(npmCommand, ["run", "dev:server"], { stdio: "inherit", env: process.env }),
    spawn(npmCommand, ["run", "dev:web"], { stdio: "inherit", env: process.env }),
  ];

  const stop = async (exitCode = 0) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    await Promise.all(children.map((child) => new Promise((resolve) => child.once("exit", resolve))));
    process.exit(exitCode);
  };
  process.on("SIGINT", () => void stop(0));
  process.on("SIGTERM", () => void stop(0));
  children.forEach((child) => child.once("exit", (code) => { if (!stopping && code !== 0) void stop(code ?? 1); }));
}

void main();
