## V17.7.20 / 18.3.6.24 审批前置数字化配置补齐

- 补齐考勤主管“组织人事部 + 业务审核岗 + 考勤管理”员工信息数字化配置及审批分管配置。
- 请假类型标准模型 `5011001001100003001` 补齐“考勤管理”模型数字化配置。
- 模型时限模型 `5011001001100022001` 补齐“数字化管理”模型数字化配置，并补齐数字化管理业务分类、设备管理部业务归属和负责人行政审批分管。
- 所有配置通过对应数据产生模型的 `system_sync` 真实运行写入数字化库，继续遵守方案A。

## V17.7.19 / 18.3.6.23 审批完整 Path_final 代码落地

- 审批正常归档只允许发生在完整 `Path_final` 全部必经节点完成之后。
- 员工请休假标准链路：员工 → 部门经理 → 考勤主管 → 审批归档 → 智选。
- 业务审核岗对考勤管理的技术/业务审查分管由数字化库配置形成，不在审批代码中写死具体人员。

# 智慧企业治理系统

当前规则基线：**18.3.6.24 / V17.7.20**。

本版已同步更新规则、seed/系统同步逻辑、默认考勤主管组织配置和数据库 migration，运行代码与 V17.7.20 规则一致。

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
## V17.7.14 方案A

数字化库正式记录统一改为由对应数据产生模型的真实运行形成。历史 `std-*`、`src0622-*`、`auto0622-*` 记录在升级时转换为 `system_initialization` 运行；系统源数据后续变化通过 `system_sync` 运行归档。正式数字化库记录必须具有 `run_id`，文件名与对应 `model_runs.file_name` 一致。



### V17.7.16 规则更新
普通审批界面仅展示最终审批路径，组织数字化属性和相对审批/审查级次保留为内部运算与审计数据。
### V17.7.17 代码更新

相对审批/审查级次已落地到审批运行内核；普通审批待办、已办、办结只展示最终审批路径，节点格式统一为“岗位/角色名称（员工数字化编码）”。内部组织路径、阈值、审批人计算等继续写入审批模型运行和数字化库用于审计。

