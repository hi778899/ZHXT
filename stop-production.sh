#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
docker compose down
echo "系统已停止；数据库卷 cockpit_db 保留。"
