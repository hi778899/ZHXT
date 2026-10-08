# README 顶部导航区块模板

> 用途：每次导入新版本交付包后，官方 `README.md` 会覆盖仓库 README，
> 需要把下面这段导航区块重新贴回 `README.md` 最开头（在版本变更日志之前）。
> 只需修改「当前正式版本」一行的版本号。

---

<!-- ↓↓↓ 复制以下内容到 README.md 开头 ↓↓↓ -->

# 智慧企业治理系统 · 模型四阶段可运行版（ZHXT）

> 当前正式版本：**V17.7.27 / 18.3.6.31** · 完整版本历史见 [Tags](https://github.com/hi778899/ZHXT/tags)

## 仓库导航

| 目录 | 说明 |
|---|---|
| `src/` | 前端源码（驾驶舱、模型建设工作台、表单设计器等） |
| `server/src/` | 服务端运行引擎、模型建设、数字化编码 |
| `server/migrations/` | 数据库迁移脚本（按序自动执行） |
| `docs/versions/` | 各版本变更说明 |
| `docs/development/` | 开发文档、部署文档、[仓库管理规范](docs/development/仓库管理规范.md) |
| `tests/` | 回归测试用例 |
| `.ai/rules/` | 项目开发规则（AI 协作与人工开发共同遵循） |
| `AGENTS.md` | AI 协作者指引 |

**分支与版本规范**：`main` 只存放正式稳定代码；开发走 `feature/` `fix/` `hotfix/` 分支 + PR；正式发布在 `main` 对应 commit 打 Tag。详见 [仓库管理规范](docs/development/仓库管理规范.md)。

---

## 版本变更记录

<!-- ↑↑↑ 复制以上内容到 README.md 开头 ↑↑↑ -->
