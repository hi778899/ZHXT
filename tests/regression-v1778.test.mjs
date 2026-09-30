import assert from "node:assert/strict"
import fs from "node:fs"

const builder=fs.readFileSync(new URL("../server/src/model-builder.ts",import.meta.url),"utf8")
const workbench=fs.readFileSync(new URL("../src/ModelBuilderWorkbench.tsx",import.meta.url),"utf8")
const seed=fs.readFileSync(new URL("../server/src/seed.ts",import.meta.url),"utf8")
const migration=fs.readFileSync(new URL("../server/migrations/022_business_approval_hard_link_and_trigger_failures.sql",import.meta.url),"utf8")
const clusterRules=fs.readFileSync(new URL("../.ai/rules/19_MODEL_CLUSTER_TRIGGER_RULES.md",import.meta.url),"utf8")
const runtimeRules=fs.readFileSync(new URL("../.ai/rules/08_RUNTIME_ENGINE_RULES.md",import.meta.url),"utf8")

assert.match(builder,/function mandatoryBusinessApprovalRelation\(\)/,"运行引擎必须具有业务→审批系统固定关系")
assert.match(builder,/return \[mandatoryBusinessApprovalRelation\(\), \.\.\.otherRelations\]/,"业务模型归档关系必须强制注入审批模型")
assert.match(builder,/type === "business" && targetName === "审批模型"[\s\S]*systemLink = "business_to_approval"/,"业务→审批触发必须使用系统链路标识")
assert.match(builder,/['\"]启动中['\"]/,"审批模型必须先形成启动中运行实例")
assert.match(builder,/status='运行异常'/,"审批内部计算失败必须保留异常运行实例")
assert.match(builder,/model_trigger_failures/,"跨模型触发失败必须持久化记录")
assert.match(builder,/业务模型已归档，但审批模型未成功启动/,"业务归档但审批未启动不得返回普通成功")
assert.match(workbench,/id: "system-business-approval"[\s\S]*targetModelName: "审批模型"/,"业务模型配置界面必须显示业务→审批系统固定关系")
assert.match(workbench,/isSystemFixedRelation/,"业务→审批系统关系必须在界面不可删除或禁用")
assert.match(seed,/system-business-approval/,"seed 必须修复历史业务模型的审批硬性关系")
assert.match(migration,/CREATE TABLE IF NOT EXISTS model_trigger_failures/,"迁移必须建立触发失败记录表")
assert.match(migration,/业务模型数字化库正式入库后必须启动通用审批模型/,"迁移必须补齐历史业务→审批固定关系")
assert.match(clusterRules,/业务模型 → 业务模型数字化库 → 审批模型 → 审批模型数字化库 → 智选模型/,"模型簇规则必须固定业务审批智选主链")
assert.match(clusterRules,/先形成审批模型运行实例/,"规则必须要求先启动审批再计算")
assert.match(runtimeRules,/状态为“启动中”/,"运行引擎规则必须明确审批启动状态")

console.log("V17.7.8 business-to-approval hard-link regression checks passed")
