#!/usr/bin/env node

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeDir = join(homedir(), ".local", "share", "memory-one");
const dataDir = join(runtimeDir, "data");
const pidFile = join(runtimeDir, "memory-one.pid");
const logFile = join(runtimeDir, "memory-one.log");
const languageFile = join(dataDir, "language");
const port = 23888;
const url = `http://127.0.0.1:${port}/`;

function readLanguage() {
  try {
    const value = readFileSync(languageFile, "utf8").trim();
    return value === "en" ? "en" : value === "zh" ? "zh" : null;
  } catch {
    return null;
  }
}

const messages = {
  zh: {
    choose: "选择界面语言 / Choose interface language\n  1. 中文\n  2. English\n请输入 1 或 2 [1]：",
    started: (value) => `Memory One 已启动：${value}`,
    running: (pid, value) => `Memory One 已在运行（PID ${pid}）：${value}`,
    mcp: (value) => `MCP：${value}mcp/`,
    startFailed: "Memory One 启动失败。",
    startTimeout: "Memory One 启动超时。",
    occupied: (pids) => `端口 ${port} 已被进程 ${pids.join(", ")} 占用，是否终止？[y/N] `,
    cancelled: "已取消。",
    notRunning: "Memory One 未运行。",
    stopped: "Memory One 已停止。",
    updateFailed: "Memory One 更新失败，已保留当前版本。",
    updateWaiting: (version) => `新版本 ${version} 尚未在 npm 全部同步，请稍后重试。`,
    updated: "Memory One 已更新。",
    status: (pid, value) => `Memory One 正在运行（PID ${pid}）：${value}`,
    opening: "正在打开 Memory One。",
    help: `Memory One\n\n用法：\n  memoryone start   启动\n  memoryone stop    停止\n  memoryone status  查看状态\n  memoryone open    打开工作台\n  memoryone update  更新`,
  },
  en: {
    choose: "Choose interface language / 选择界面语言\n  1. 中文\n  2. English\nEnter 1 or 2 [1]: ",
    started: (value) => `Memory One started: ${value}`,
    running: (pid, value) => `Memory One is already running (PID ${pid}): ${value}`,
    mcp: (value) => `MCP: ${value}mcp/`,
    startFailed: "Memory One failed to start.",
    startTimeout: "Memory One took too long to start.",
    occupied: (pids) => `Port ${port} is used by process ${pids.join(", ")}. Stop it? [y/N] `,
    cancelled: "Cancelled.",
    notRunning: "Memory One is not running.",
    stopped: "Memory One stopped.",
    updateFailed: "Memory One update failed; the current version was preserved.",
    updateWaiting: (version) => `Version ${version} is not fully available from npm yet. Try again later.`,
    updated: "Memory One updated.",
    status: (pid, value) => `Memory One is running (PID ${pid}): ${value}`,
    opening: "Opening Memory One.",
    help: `Memory One\n\nUsage:\n  memoryone start   Start\n  memoryone stop    Stop\n  memoryone status  Show status\n  memoryone open    Open workspace\n  memoryone update  Update`,
  },
};

async function ensureLanguage() {
  const current = readLanguage();
  if (current) return current;
  mkdirSync(dataDir, { recursive: true });
  let language = "zh";
  if (process.stdin.isTTY && process.stdout.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await prompt.question(messages.zh.choose);
    prompt.close();
    language = answer.trim() === "2" || answer.trim().toLowerCase() === "en" ? "en" : "zh";
  }
  writeFileSync(languageFile, `${language}\n`);
  return language;
}

function copy() {
  return messages[readLanguage() ?? "zh"];
}

function readPid() {
  if (!existsSync(pidFile)) return null;
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function currentPid() {
  const pid = readPid();
  if (isRunning(pid)) return pid;
  if (existsSync(pidFile)) rmSync(pidFile);
  return null;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function listeningPids() {
  if (platform() === "win32") return [];
  try {
    return execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\s+/).filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

async function releaseOccupiedPort() {
  const pids = listeningPids();
  if (!pids.length) return true;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(copy().occupied(pids));
  prompt.close();
  if (!/^(y|yes|是)$/i.test(answer.trim())) {
    console.log(copy().cancelled);
    return false;
  }
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch {}
  }
  await wait(500);
  for (const pid of listeningPids()) {
    try { process.kill(pid, "SIGKILL"); } catch {}
  }
  return true;
}

async function start() {
  const language = await ensureLanguage();
  const text = messages[language];
  const runningPid = currentPid();
  if (runningPid) {
    console.log(text.running(runningPid, url));
    return;
  }
  if (!await releaseOccupiedPort()) return;
  mkdirSync(dataDir, { recursive: true });
  const logFd = openSync(logFile, "a");
  const child = spawn(process.execPath, [join(packageRoot, "dist", "server.js")], {
    cwd: runtimeDir,
    detached: true,
    env: { ...process.env, MEMORY_PORT: String(port), MEMORY_DB_PATH: join(dataDir, "memory.db"), MEMORY_LANGUAGE: language },
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  closeSync(logFd);
  writeFileSync(pidFile, `${child.pid}\n`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(200);
    if (!isRunning(child.pid)) {
      rmSync(pidFile, { force: true });
      throw new Error(text.startFailed);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(text.started(url));
        console.log(text.mcp(url));
        return;
      }
    } catch {}
  }
  throw new Error(text.startTimeout);
}

async function stop() {
  const pid = currentPid();
  if (!pid) {
    console.log(copy().notRunning);
    return;
  }
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 25 && isRunning(pid); attempt += 1) await wait(200);
  rmSync(pidFile, { force: true });
  console.log(copy().stopped);
}

async function update() {
  const npmCommand = platform() === "win32" ? "npm.cmd" : "npm";
  const versionResult = spawnSync(npmCommand, ["view", "@ccjr1120/memory-one@latest", "version", "--json"], { encoding: "utf8" });
  if (versionResult.status !== 0) throw new Error(copy().updateFailed);
  let latestVersion = "";
  try { latestVersion = String(JSON.parse(versionResult.stdout || '""')).trim(); } catch {}
  if (!latestVersion) throw new Error(copy().updateFailed);
  const packageResult = spawnSync(npmCommand, ["view", `@ccjr1120/memory-one@${latestVersion}`, "dist.tarball", "--json"], { encoding: "utf8" });
  if (packageResult.status !== 0 || !String(packageResult.stdout).trim()) throw new Error(copy().updateWaiting(latestVersion));

  const wasRunning = Boolean(currentPid());
  const result = spawnSync(npmCommand, ["install", "--global", `@ccjr1120/memory-one@${latestVersion}`], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(copy().updateFailed);
  if (wasRunning) {
    await stop();
    await start();
  }
  console.log(copy().updated);
}

function status() {
  const pid = currentPid();
  if (!pid) {
    console.log(copy().notRunning);
    process.exitCode = 1;
    return;
  }
  console.log(copy().status(pid, url));
}

function openApp() {
  const command = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
  console.log(copy().opening);
}

function help() {
  console.log(copy().help);
}

const command = process.argv[2];
try {
  if (command === "start") await start();
  else if (command === "stop") await stop();
  else if (command === "update") await update();
  else if (command === "status") status();
  else if (command === "open") openApp();
  else if (!command || command === "help" || command === "--help" || command === "-h") help();
  else {
    help();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
