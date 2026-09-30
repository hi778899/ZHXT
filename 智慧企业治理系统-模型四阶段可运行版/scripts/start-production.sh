#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "错误：未检测到 Docker。请先安装 Docker Engine / Docker Desktop。"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "错误：未检测到 docker compose 插件。"
  exit 1
fi

random_token() {
  local prefix="$1"
  if command -v openssl >/dev/null 2>&1; then
    printf '%s%s!\n' "$prefix" "$(openssl rand -hex 10)"
  else
    printf '%s%s!\n' "$prefix" "$(date +%s%N | sha256sum | cut -c1-20)"
  fi
}

env_get() {
  local key="$1"
  grep -E "^${key}=" .env 2>/dev/null | tail -n1 | cut -d= -f2- || true
}
env_set_if_missing() {
  local key="$1" value="$2"
  if ! grep -qE "^${key}=" .env 2>/dev/null; then
    printf '%s=%s\n' "$key" "$value" >> .env
  fi
}

if [ ! -f .env ]; then
  cp .env.example .env
  DB_TOKEN="$(random_token Db | tr -d '!')"
  ADMIN_PASS="$(random_token Adm)"
  DEPT_PASS="$(random_token Dept)"
  ATT_PASS="$(random_token Attend)"
  CASE_PASS="$(random_token Case)"
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${DB_TOKEN}/" .env
  sed -i "s#^DATABASE_URL=.*#DATABASE_URL=postgres://cockpit:${DB_TOKEN}@db:5432/cockpit#" .env
  sed -i "s/^INITIAL_ADMIN_PASSWORD=.*/INITIAL_ADMIN_PASSWORD=${ADMIN_PASS}/" .env
  sed -i "s/^DEPARTMENT_MANAGER_PASSWORD=.*/DEPARTMENT_MANAGER_PASSWORD=${DEPT_PASS}/" .env
  sed -i "s/^ATTENDANCE_SUPERVISOR_PASSWORD=.*/ATTENDANCE_SUPERVISOR_PASSWORD=${ATT_PASS}/" .env
  sed -i "s/^CASE_USER_INITIAL_PASSWORD=.*/CASE_USER_INITIAL_PASSWORD=${CASE_PASS}/" .env
  echo "已自动生成 .env"
else
  env_set_if_missing DEPARTMENT_MANAGER_USERNAME deptmanager
  env_set_if_missing DEPARTMENT_MANAGER_NAME 部门经理
  env_set_if_missing DEPARTMENT_MANAGER_DEPARTMENT "$(env_get INITIAL_ADMIN_DEPARTMENT)"
  env_set_if_missing DEPARTMENT_MANAGER_PASSWORD "$(random_token Dept)"
  env_set_if_missing ATTENDANCE_SUPERVISOR_USERNAME attendance
  env_set_if_missing ATTENDANCE_SUPERVISOR_NAME 考勤主管
  env_set_if_missing ATTENDANCE_SUPERVISOR_DEPARTMENT 综合管理部
  env_set_if_missing ATTENDANCE_SUPERVISOR_PASSWORD "$(random_token Attend)"
  env_set_if_missing CASE_USER_INITIAL_PASSWORD "$(random_token Case)"
fi

ADMIN_USER="$(env_get INITIAL_ADMIN_USERNAME)"; ADMIN_USER="${ADMIN_USER:-zhangshan}"
ADMIN_PASS="$(env_get INITIAL_ADMIN_PASSWORD)"
DEPT_USER="$(env_get DEPARTMENT_MANAGER_USERNAME)"; DEPT_USER="${DEPT_USER:-deptmanager}"
DEPT_PASS="$(env_get DEPARTMENT_MANAGER_PASSWORD)"
DEPT_NAME="$(env_get DEPARTMENT_MANAGER_NAME)"; DEPT_NAME="${DEPT_NAME:-部门经理}"
DEPT_DEPARTMENT="$(env_get DEPARTMENT_MANAGER_DEPARTMENT)"; DEPT_DEPARTMENT="${DEPT_DEPARTMENT:-设备管理部}"
ATT_USER="$(env_get ATTENDANCE_SUPERVISOR_USERNAME)"; ATT_USER="${ATT_USER:-attendance}"
ATT_PASS="$(env_get ATTENDANCE_SUPERVISOR_PASSWORD)"
ATT_NAME="$(env_get ATTENDANCE_SUPERVISOR_NAME)"; ATT_NAME="${ATT_NAME:-考勤主管}"
ATT_DEPARTMENT="$(env_get ATTENDANCE_SUPERVISOR_DEPARTMENT)"; ATT_DEPARTMENT="${ATT_DEPARTMENT:-综合管理部}"
CASE_PASS="$(env_get CASE_USER_INITIAL_PASSWORD)"; CASE_PASS="${CASE_PASS:-$ADMIN_PASS}"

cat > 首次启动账号.txt <<EOF2
系统地址：http://服务器IP:8787

管理员账号：${ADMIN_USER}
管理员密码：${ADMIN_PASS}

部门经理账号：${DEPT_USER}
显示姓名：${DEPT_NAME}
所属部门：${DEPT_DEPARTMENT}
角色：部门经理（请休假行政审批）
密码：${DEPT_PASS}

考勤主管账号：${ATT_USER}
显示姓名：${ATT_NAME}
所属部门：${ATT_DEPARTMENT}
角色：考勤主管（请休假业务审批）
密码：${ATT_PASS}

0622案例人员账号（用户名即员工数字化编码）：
50110020001 苗士勇
50110020002 高胜军
50110020003 李天宇
50110020004 刘思琛
50110020005 张会强
50110020006 于俊清
50110020007 周敏
50110020008 王琳
50110020009 陈明
50110020010 总经理
50110020012 董事长
50110020013 孙磊
50110020014 何宁
案例账号统一初始密码：${CASE_PASS}
EOF2
chmod 600 .env 首次启动账号.txt 2>/dev/null || true

echo "开始构建并启动智慧企业治理系统……"
docker compose up -d --build

echo
echo "启动完成。"
echo "访问地址：http://服务器IP:${APP_PORT:-8787}"
echo "管理员、部门经理、考勤主管账号信息：$(pwd)/首次启动账号.txt"
echo "查看日志：docker compose logs -f app"
