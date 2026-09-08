#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const runtimeDir = join(homedir(), ".local", "share", "memory-one");
const dataDir = join(runtimeDir, "data");
const pidFile = join(runtimeDir, "memory-one.pid");
const logFile = join(runtimeDir, "memory-one.log");
const port = 23888;
const url = `http://127.0.0.1:${port}/`;

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

async function start() {
  const runningPid = currentPid();
  if (runningPid) {
    console.log(`Memory One 已在运行（PID ${runningPid}）：${url}`);
    return;
  }
  mkdirSync(dataDir, { recursive: true });
  const logFd = openSync(logFile, "a");
  const child = spawn(process.execPath, [join(packageRoot, "dist", "server.js")], {
    cwd: runtimeDir,
    detached: true,
    env: { ...process.env, MEMORY_PORT: String(port), MEMORY_DB_PATH: join(dataDir, "memory.db") },
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  closeSync(logFd);
  writeFileSync(pidFile, `${child.pid}\n`);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await wait(200);
    if (!isRunning(child.pid)) {
      rmSync(pidFile, { force: true });
      throw new Error(`Memory One 启动失败，请查看日志：${logFile}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`Memory One 已启动：${url}`);
        console.log(`MCP：${url}mcp/`);
        return;
      }
    } catch {}
  }
  throw new Error(`Memory One 启动超时，请查看日志：${logFile}`);
}

async function stop() {
  const pid = currentPid();
  if (!pid) {
    console.log("Memory One 未运行。");
    return;
  }
  process.kill(pid, "SIGTERM");
  for (let attempt = 0; attempt < 25 && isRunning(pid); attempt += 1) await wait(200);
  rmSync(pidFile, { force: true });
  console.log("Memory One 已停止。");
}

async function update() {
  const wasRunning = Boolean(currentPid());
  if (wasRunning) await stop();
  const npmCommand = platform() === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, ["install", "--global", "@ccjr1120/memory-one@latest"], { stdio: "inherit" });
  if (result.status !== 0) {
    if (wasRunning) await start();
    throw new Error("Memory One 更新失败。");
  }
  console.log("Memory One 已更新到最新版本。");
  if (wasRunning) await start();
}

function status() {
  const pid = currentPid();
  if (!pid) {
    console.log("Memory One 未运行。");
    process.exitCode = 1;
    return;
  }
  console.log(`Memory One 正在运行（PID ${pid}）：${url}`);
}

function openApp() {
  const command = platform() === "darwin" ? "open" : platform() === "win32" ? "cmd" : "xdg-open";
  const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
  console.log(`正在打开 ${url}`);
}

function help() {
  console.log(`Memory One\n\n用法：\n  memory-one start   启动本地服务\n  memory-one stop    停止本地服务\n  memory-one status  查看运行状态\n  memory-one open    打开工作台\n  memory-one update  更新到最新版本`);
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
