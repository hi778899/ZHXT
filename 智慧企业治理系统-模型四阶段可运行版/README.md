# 智慧企业治理系统

当前基线：**18.3.6.1 / V17.6**。

本仓库采用“可运行代码、项目文档、AI 规则分离”的标准目录：

- `src/`：React + TypeScript 前端源码。
- `server/`：Node.js + TypeScript 后端源码及 PostgreSQL migrations。
- `scripts/`：生产环境启动、停止脚本。
- `tests/`：无需额外运行时依赖的项目验收与回归测试。
- `docs/`：架构、开发、部署、版本文档。
- `.ai/rules/`：AI/Codex/Agent 开发规则。
- `AGENTS.md`：AI/Agent 进入仓库后的唯一根级规则入口。

## AI / Codex 使用

任何 AI 或 Agent 修改代码前，先阅读根目录 `AGENTS.md`，再按其索引读取 `.ai/rules/` 中对应规则。

## 构建

```bash
corepack enable
pnpm install --no-frozen-lockfile
pnpm run build:all
```

## Docker 生产部署

```bash
cp .env.example .env
# 设置 .env 中生产密码等配置
./scripts/启动生产环境.sh
```

手工构建启动：

```bash
docker compose up -d --build
```

停止：

```bash
./scripts/stop-production.sh
```

目录规范见 `docs/architecture/PROJECT_STRUCTURE.md`；详细部署说明见 `docs/deployment/README.md`；模型建设与系统能力说明见 `docs/development/README-模型四阶段版.md`；版本演进见 `docs/versions/`。
