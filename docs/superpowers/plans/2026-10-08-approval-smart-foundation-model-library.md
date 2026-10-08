# 审批/智选基础模型库运行入库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 建立审批/智选基础模型库注册、真实模型运行入库、就绪审计与运行前校验机制，消除按个例直接补库。

**Architecture:** 以独立基础模型库注册模块定义审批/智选硬依赖和支撑依赖；系统同步数据通过统一 model-run-backed 入库函数形成真实 `model_runs`；seed 只编排可确定数据补齐；runtime 在审批/智选计算前进行硬依赖就绪校验。历史 0622 数据保留并物化，不新增 migration 直接业务数据补丁。

**Tech Stack:** TypeScript, Node.js 22, PostgreSQL 16, pg, Node assert regression tests

**Spec:** `docs/superpowers/specs/2026-10-08-approval-smart-foundation-model-library-design.md`

## Global Constraints

- 一模型一数字化库；正式数字化库记录必须有真实 `run_id`。
- 当前模型编码 19 位、员工编码 11 位，模型文件名沿用现行规则。
- `system_initialization` 仅建最小闭环；人工配置仍进入审批→智选。
- 不猜测无法唯一确定的业务配置。
- 不改变相对审批/审查级次与完整 `Path_final` 规则。

## Review Focus

- 标识关联配置库为空必须被视为“结构就绪、无关联数据”，不能阻断智选。
- 已有历史 0622 记录必须能被物化并通过 `run_id` 校验。
- 已发布模型缺业务分类时只形成问题，不自动编造。
- 基础库生产模型未发布或编码非法时错误必须指出具体模型/库。
- 自动同步重复执行且数据未变化时不得重复生成模型运行。

---

### Task 1: 基础模型库注册与就绪审计

**Files:**
- Create: `server/src/foundation-model-libraries.ts`
- Create: `server/migrations/032_approval_smart_foundation_readiness.sql`
- Test: `tests/regression-v17726.test.mjs`

**Interfaces:**
- Produces: `foundationReadiness(scope)`, `assertFoundationReady(scope)`, `auditFoundationReadiness()` and registry constants.

- [x] Write regression assertions for approval/smart registries, allow-empty smart association, run-backed checks and audit table.
- [x] Run `node tests/regression-v17726.test.mjs` and verify RED.
- [x] Implement registry/readiness/audit and migration.
- [x] Re-run test and verify GREEN.

### Task 2: 统一真实模型运行入库通道

**Files:**
- Modify: `server/src/data-linkage.ts`
- Modify: `server/src/seed.ts`
- Modify: `server/src/employee-digital-config.ts`
- Test: `tests/regression-v17726.test.mjs`

**Interfaces:**
- Produces: `runModelBackedDigitalLibraryRecord(input)`; compatibility wrapper retained for older callers.
- Consumes: Task 1 registry metadata only for validation at call sites.

- [x] Extend regression test to require new function, producer validation, explicit system trigger mode and seed/employee usage.
- [x] Verify RED.
- [x] Implement model-run-backed function and convert foundation seed/employee synchronization callers.
- [x] Verify GREEN and run existing V17.7.14/V17.7.20/V17.7.21 regressions.

### Task 3: Seed 编排和基础数据完善闭环

**Files:**
- Modify: `server/src/seed.ts`
- Modify: `server/src/foundation-model-libraries.ts`
- Test: `tests/regression-v17726.test.mjs`

**Interfaces:**
- Consumes: model-run-backed record writer and audit.
- Produces: startup ordering `projects → historical materialization → deterministic completion → employee sync → foundation audit`.

- [x] Add failing assertions for startup order and prohibition on new direct foundation record inserts.
- [x] Implement ordering and audit call; unresolved items warn only.
- [x] Verify GREEN and existing full regression suite.

### Task 4: 审批/智选运行前就绪校验

**Files:**
- Modify: `server/src/runtime-0622.ts`
- Test: `tests/regression-v17726.test.mjs`

**Interfaces:**
- Consumes: `assertFoundationReady("approval"|"smart")`.
- Produces: explicit foundation errors before approval/smart computation.

- [x] Add failing assertions for approval/smart readiness calls and specific error prefix.
- [x] Implement calls at current-structure entry points; historical compatibility path remains unchanged.
- [x] Verify GREEN and run approval/smart regressions.

### Task 5: Rules, versioning and complete verification

**Files:**
- Create: `.ai/rules/26_APPROVAL_SMART_BASE_MODEL_LIBRARY_RULES.md`
- Modify: `.ai/rules/00_PROJECT_RULES.md`
- Modify: `.ai/rules/02_ONE_MODEL_ONE_LIBRARY_RULES.md`
- Modify: `.ai/rules/06_DIGITAL_LIBRARY_DATASOURCE_RULES.md`
- Modify: `.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md`
- Modify: `.ai/rules/08_RUNTIME_ENGINE_RULES.md`
- Modify: `.ai/rules/12_TESTING_ACCEPTANCE_RULES.md`
- Modify: `.ai/rules/22_MODEL_DIGITAL_CONFIG_COMPLETENESS_RULES.md`
- Modify: `.ai/rules/README.md`
- Modify: `AGENTS.md`
- Modify: `package.json`
- Create: `18.3.6.30-V17.7.26-审批智选基础模型库运行入库说明.txt`

**Interfaces:** none.

- [x] Extend regression test for rule wording/version/test script.
- [x] Verify RED.
- [x] Update rules/version/test scripts/release note.
- [x] Run `npm/pnpm test:contracts` if dependencies exist; otherwise run every Node regression directly.
- [x] Run TypeScript build if dependencies exist; otherwise run syntax transpilation check with available TypeScript and report limitation.
- [x] ZIP package and run archive integrity test.
