#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="23888"
PID_FILE="$ROOT_DIR/data/memory-one.pid"
LOG_FILE="$ROOT_DIR/data/memory-one.log"

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

echo "Installing dependencies..."
npm ci
echo "Building Memory One..."
npm run build

clear_port
rm -f "$PID_FILE"

echo "Starting Memory One in the background on port $PORT..."
PID="$(node scripts/start-background.mjs "$PORT" "$LOG_FILE" "$PID_FILE")"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    echo "Memory One is running at http://127.0.0.1:$PORT/"
    echo "MCP endpoint: http://127.0.0.1:$PORT/mcp/"
    echo "PID: $PID"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Memory One failed to start. See $LOG_FILE" >&2
    exit 1
  fi
  sleep 0.2
done

echo "Memory One did not become ready. See $LOG_FILE" >&2
exit 1
