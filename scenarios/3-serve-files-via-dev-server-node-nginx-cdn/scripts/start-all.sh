#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

PIDS=()

cleanup() {
  echo ""
  echo "正在停止所有服务..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait || true
  echo "全部服务已停止。"
}

trap cleanup INT TERM EXIT

echo "启动 app instance A (5311, ap-northeast-1)..."
node servers/app-instance-server.js a 5311 ap-northeast-1 &
PIDS+=("$!")

echo "启动 app instance B (5312, ap-northeast-1)..."
node servers/app-instance-server.js b 5312 ap-northeast-1 &
PIDS+=("$!")

echo "启动 origin nginx server (5313, upstream: 5311,5312)..."
node servers/origin-nginx-server.js demo-dist 5313 5311,5312 &
PIDS+=("$!")

echo "启动 cdn edge server (5314 -> 5313)..."
node servers/cdn-edge-server.js 5314 5313 &
PIDS+=("$!")

echo ""
echo "服务已启动："
echo "  - app a:  http://127.0.0.1:5311"
echo "  - app b:  http://127.0.0.1:5312"
echo "  - origin: http://127.0.0.1:5313"
echo "  - cdn:    http://127.0.0.1:5314"
echo ""
echo "按 Ctrl+C 停止全部服务。"

wait
