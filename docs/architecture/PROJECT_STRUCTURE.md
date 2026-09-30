# 项目标准目录结构

```text
智慧企业治理系统/
├─ AGENTS.md                  # AI/Agent 根入口
├─ README.md                  # 项目入口说明
├─ package.json               # Node/pnpm 构建入口
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ vite.config.ts
├─ index.html
├─ Dockerfile                 # 镜像构建入口
├─ docker-compose.yml         # 生产编排入口
├─ .dockerignore
├─ .env.example
├─ src/                       # 前端源码
├─ server/                    # 后端源码、数据库迁移
├─ scripts/                   # 生产启停脚本
├─ tests/                     # 项目验收与回归测试
├─ docs/                      # 架构、开发、部署、版本文档
└─ .ai/rules/                 # AI/Codex/Agent 专项规则
```

## 路径原则

1. 根目录只保留项目入口、构建入口和 `AGENTS.md`，不平铺专项规则和历史版本文档。
2. `src/` 与 `server/` 是可运行代码路径，不因文档整理改变业务代码引用。
3. `.ai/rules/` 是 AI 专项规则的唯一归档位置；AI 先读 `AGENTS.md`，再按任务读取专项规则。
4. `docs/` 只存人类可读的项目文档和历史版本资料，不作为运行依赖。
5. `scripts/` 中的生产脚本无论从何处调用，都会切换到仓库根目录后执行 Docker Compose。
6. `tests/` 保存可重复执行的验收与回归测试，不与运行时代码混放。
7. `package.json`、`Dockerfile`、`docker-compose.yml`、`vite.config.ts` 保持在根目录，避免破坏 pnpm、Vite、Docker 的默认构建上下文。
