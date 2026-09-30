# 智慧企业治理系统——AI规则说明

`.ai/rules/` 目录中的 Markdown 文件是本项目的软件架构、模型建设、数字化、数据库、测试、发布及 AI 辅助开发的最高级项目约束。

## 使用原则

1. 所有开发人员、AI 编程工具、自动化 Agent 在修改项目代码前，必须先阅读 `AGENTS.md` 与 `.ai/rules/00_PROJECT_RULES.md`。
2. 涉及模型建设、数字化库、审批、智选、模型运行引擎时，必须继续阅读对应专项规则。
3. 任何代码实现不得绕过本文档体系中的核心业务规则。
4. 若代码现状与规则冲突，应优先按规则整改，不得以“现有代码如此”为理由延续错误设计。
5. 新增规则时，应更新 `.ai/rules/00_PROJECT_RULES.md` 的规则索引。

## 核心业务口径

- 一模型一数字化库。
- 模型唯一性由数字化编码确定，系统不另设模型 ID。
- 模型每次运行完成生成模型文件名；模型文件名是一条运行记录的识别和模型簇上下游传递依据。
- 数字化编码、模型文件名、数字化标识三者含义不同，不得混用。
- 模型是功能执行单元，数字化库是该模型有效运行结果的唯一对应存储单元。
- 模型可以读取其他模型的数字化库，但只能向本模型数字化库写入运行结果。
- 业务运行采用模型簇：`业务模型 → 审批模型 → 智选模型 → 关联后续模型`。
- 硬性链接的触发主体是数字化库：业务模型结果正式写入其对应数字化库后，由该数字化库触发审批模型；审批结果正式写入审批模型对应数字化库后，由该数字化库触发智选模型。
- 系统所有库统一称为“数字化库”，不另设其他库分类。下拉、单选、多选、人员、部门及其他需要引用既有数据的字段不得前端硬编码，应读取相应模型运行形成的数字化库。
- 模型建设由四个建设模型组成：`业务定义模型 → 数字化定义模型 → 模型设计模型 → 模型发布模型`；每个建设模型自身按“建设模型 → 审批 → 智选”模型簇运行。
- 四阶段必须是系统内可操作、可保存、可回改的建设模型；完成四阶段后必须生成可运行模型、对应数字化库及必要的审批/智选关联配置。

## 文件索引

| 文件 | 作用 |
|---|---|
| `AGENTS.md` | AI/Agent/开发人员进入仓库后的第一入口 |
| `.ai/rules/00_PROJECT_RULES.md` | 项目最高级总规则 |
| `.ai/rules/01_ARCHITECTURE_RULES.md` | 系统架构边界与分层 |
| `.ai/rules/02_ONE_MODEL_ONE_LIBRARY_RULES.md` | 一模型一数字化库规则 |
| `.ai/rules/03_MODEL_CLUSTER_RULES.md` | 模型簇：业务模型-审批-智选 |
| `.ai/rules/04_DIGITALIZATION_RULES.md` | 数字化编码、属性、标识、规则、配置 |
| `.ai/rules/05_FOUR_STAGE_MODEL_BUILD_RULES.md` | 四阶段模型建设规则 |
| `.ai/rules/06_DIGITAL_LIBRARY_DATASOURCE_RULES.md` | 数字化库与动态数据源规则 |
| `.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md` | 通用审批与智选规则 |
| `.ai/rules/08_RUNTIME_ENGINE_RULES.md` | 模型运行引擎规则 |
| `.ai/rules/09_DATABASE_MIGRATION_RULES.md` | 数据库与迁移规则 |
| `.ai/rules/10_AI_DEVELOPMENT_RULES.md` | AI 辅助开发约束 |
| `.ai/rules/11_GIT_BRANCH_RELEASE_RULES.md` | Git 分支、PR、版本规则 |
| `.ai/rules/12_TESTING_ACCEPTANCE_RULES.md` | 测试与验收规则 |
| `.ai/rules/13_SECURITY_AUDIT_RULES.md` | 权限、安全、审计规则 |
| `.ai/rules/14_DEPLOYMENT_OPERATIONS_RULES.md` | 构建、部署、运维、回滚规则 |
| `.ai/rules/15_CODING_API_RULES.md` | 编码、API、前后端实现规范 |
| `.ai/rules/16_MODEL_DIGITAL_CODE_FILENAME_RULES.md` | 模型数字化编码唯一性、模型文件名运行记录及模型簇传递规则 |

| `.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md` | 审批模型内部判断、数字化库、阈值、路径、人员、时限与归档规则 |
| `.ai/rules/18_DASHBOARD_RULES.md` | 工作台布局、快捷入口、我的事项、工作概览、常用服务及待办/已办/办结规则 |
