#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
docker compose down
echo "系统已停止；数据库卷 cockpit_db 保留。"
