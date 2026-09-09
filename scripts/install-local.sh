#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="23888"
PID_FILE="$ROOT_DIR/data/memory-one.pid"
LOG_FILE="$ROOT_DIR/data/memory-one.log"
DEPENDENCY_MARKER="$ROOT_DIR/node_modules/.memory-one-deps-hash"
DEPLOY_DIR="${HOME}/.local/share/memory-one"

if [[ -z "$DEPLOY_DIR" || "$DEPLOY_DIR" == "/" || "$DEPLOY_DIR" == "$ROOT_DIR" ]]; then
  echo "Invalid deployment directory: $DEPLOY_DIR" >&2
  exit 1
fi

cd "$ROOT_DIR"
mkdir -p "$ROOT_DIR/data"

clear_port() {
  local pids pid
  pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
  if [[ -n "$pids" ]]; then
    sleep 0.2
    pids="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
    for pid in $pids; do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

dependency_hash() {
  node --input-type=module -e '
    import { createHash } from "node:crypto";
    import { readFileSync } from "node:fs";
    const hash = createHash("sha256");
    for (const file of process.argv.slice(1)) hash.update(readFileSync(file));
    process.stdout.write(hash.digest("hex"));
  ' "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json"
}

dependency_hash_value="$(dependency_hash)"
if [[ "${FORCE_INSTALL:-0}" == "1" || ! -d "$ROOT_DIR/node_modules" || ! -x "$ROOT_DIR/node_modules/.bin/vite" || ! -x "$ROOT_DIR/node_modules/.bin/tsx" || ! -f "$DEPENDENCY_MARKER" || "$(<"$DEPENDENCY_MARKER")" != "$dependency_hash_value" ]]; then
  echo "Installing dependencies..."
  npm ci --prefer-offline
  printf '%s\n' "$dependency_hash_value" > "$DEPENDENCY_MARKER"
else
  echo "Dependencies unchanged; reusing node_modules."
fi
echo "Building Memory One..."
BUILD_DIR="$(mktemp -d "${TMPDIR:-/tmp}/memory-one-build.XXXXXX")"
trap 'rm -rf "$BUILD_DIR"' EXIT
npm run build:web -- --outDir "$BUILD_DIR/public"
npm run build:server -- --outDir "$BUILD_DIR/dist"

echo "Copying build to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
rm -rf "$DEPLOY_DIR/public" "$DEPLOY_DIR/dist" "$DEPLOY_DIR/node_modules"
cp -R "$BUILD_DIR/public" "$DEPLOY_DIR/public"
cp -R "$BUILD_DIR/dist" "$DEPLOY_DIR/dist"
ln -s "$ROOT_DIR/node_modules" "$DEPLOY_DIR/node_modules"

clear_port
rm -f "$PID_FILE"

if [[ -L "$DEPLOY_DIR/data" ]]; then
  [[ "$(readlink "$DEPLOY_DIR/data")" == "$ROOT_DIR/data" ]] || { echo "Deployment data path is occupied: $DEPLOY_DIR/data" >&2; exit 1; }
  rm "$DEPLOY_DIR/data"
fi
mkdir -p "$DEPLOY_DIR/data"
LANGUAGE_FILE="$DEPLOY_DIR/data/language"
if [[ ! -f "$LANGUAGE_FILE" ]]; then
  language="zh"
  if [[ -t 0 ]]; then
    printf '选择界面语言 / Choose interface language\n  1. 中文\n  2. English\n请输入 1 或 2 [1]：'
    read -r answer
    [[ "$answer" == "2" || "$answer" == "en" || "$answer" == "EN" ]] && language="en"
  fi
  printf '%s\n' "$language" > "$LANGUAGE_FILE"
fi
export MEMORY_LANGUAGE="$(<"$LANGUAGE_FILE")"
if [[ ! -f "$DEPLOY_DIR/data/memory.db" ]]; then
  for db_file in "$ROOT_DIR/data/memory.db" "$ROOT_DIR/data/memory.db-wal" "$ROOT_DIR/data/memory.db-shm"; do
    [[ -f "$db_file" ]] && cp -p "$db_file" "$DEPLOY_DIR/data/$(basename "$db_file")"
  done
fi

if [[ "$(<"$LANGUAGE_FILE")" == "en" ]]; then
  echo "Starting Memory One in the background on port $PORT..."
else
  echo "正在后台启动 Memory One（端口 $PORT）..."
fi
PID="$(node scripts/start-background.mjs "$DEPLOY_DIR" "$PORT" "$LOG_FILE" "$PID_FILE")"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    if [[ "$(<"$LANGUAGE_FILE")" == "en" ]]; then
      echo "Memory One is running at http://127.0.0.1:$PORT/"
      echo "MCP endpoint: http://127.0.0.1:$PORT/mcp/"
    else
      echo "Memory One 已启动：http://127.0.0.1:$PORT/"
      echo "MCP 地址：http://127.0.0.1:$PORT/mcp/"
    fi
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "$( [[ "$(<"$LANGUAGE_FILE")" == "en" ]] && echo "Memory One failed to start." || echo "Memory One 启动失败。" )" >&2
    exit 1
  fi
  sleep 0.2
done

echo "$( [[ "$(<"$LANGUAGE_FILE")" == "en" ]] && echo "Memory One did not become ready." || echo "Memory One 启动超时。" )" >&2
exit 1
