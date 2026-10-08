import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const foundationPath=new URL('../server/src/foundation-model-libraries.ts',import.meta.url)
const migrationPath=new URL('../server/migrations/032_approval_smart_foundation_readiness.sql',import.meta.url)
assert.ok(existsSync(foundationPath),'必须建立审批/智选基础模型库注册模块')
assert.ok(existsSync(migrationPath),'必须建立基础模型库就绪审计迁移')

const foundation=readFileSync(foundationPath,'utf8')
const migration=readFileSync(migrationPath,'utf8')
const linkage=readFileSync(new URL('../server/src/data-linkage.ts',import.meta.url),'utf8')
const seed=readFileSync(new URL('../server/src/seed.ts',import.meta.url),'utf8')
const employee=readFileSync(new URL('../server/src/employee-digital-config.ts',import.meta.url),'utf8')
const runtime=readFileSync(new URL('../server/src/runtime-0622.ts',import.meta.url),'utf8')
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))

for (const [modelName,libraryId] of [
  ['模型数字化配置模型','lib-standard-digital-config'],
  ['审批分管配置模型','lib-standard-approval-assignment'],
  ['员工信息模型','lib-standard-person'],
  ['组织名称数字化模型','lib-standard-dept'],
  ['组织关系模型','lib-digital-org-relationship-0622'],
  ['模型时限模型','lib-standard-model-timeout'],
  ['审批意见标准模型','lib-standard-approval-opinion'],
]) {
  assert.match(foundation,new RegExp(modelName),'审批基础依赖必须注册生产模型 '+modelName)
  assert.match(foundation,new RegExp(libraryId),'审批基础依赖必须注册数字化库 '+libraryId)
}
for (const [modelName,libraryId] of [
  ['标识关联配置模型','lib-standard-identifier-trigger'],
  ['数字化标识建设模型','lib-standard-identifier'],
  ['模型信息标准模型','lib-standard-model'],
]) {
  assert.match(foundation,new RegExp(modelName),'智选基础依赖必须注册生产模型 '+modelName)
  assert.match(foundation,new RegExp(libraryId),'智选基础依赖必须注册数字化库 '+libraryId)
}
assert.match(foundation,/lib-standard-identifier-trigger[\s\S]{0,300}allowEmpty:\s*true/,'标识关联配置库允许0条关联数据，但结构必须就绪')
assert.match(foundation,/run_id IS NULL|run_id\s+IS\s+NULL/,'基础库就绪检查必须检查正式记录是否有真实run_id')
assert.match(foundation,/export async function foundationReadiness/)
assert.match(foundation,/export async function assertFoundationReady/)
assert.match(foundation,/export async function auditFoundationReadiness/)
assert.match(migration,/foundation_model_library_readiness_issues/)
assert.match(migration,/library_id text/,'审计表业务ID使用text，不得再次误设uuid')

assert.match(linkage,/export async function runModelBackedDigitalLibraryRecord/,'系统基础数据必须经过统一模型运行入库函数')
assert.match(linkage,/expectedProducerModelName/,'运行入库必须验证数字化库的数据产生模型')
assert.match(linkage,/system_initialization[\s\S]*system_sync|system_sync[\s\S]*system_initialization/,'模型运行入库必须显式支持初始化/同步启动方式')
assert.match(seed,/runModelBackedDigitalLibraryRecord/,'seed基础数据完善必须使用模型运行入库通道')
assert.doesNotMatch(seed,/upsertSystemDigitalLibraryRecord/,'seed不得继续使用旧的直接补库语义入口')
assert.match(employee,/runModelBackedDigitalLibraryRecord/,'员工基础配置同步必须使用模型运行入库通道')
assert.doesNotMatch(employee,/upsertSystemDigitalLibraryRecord/,'员工同步不得继续使用旧的直接补库语义入口')

assert.match(seed,/syncSystemStandardLibraryRecords\(\)[\s\S]*ensureApprovalFoundationDigitalConfigs/,'先物化/同步历史基础模型运行，再执行可确定基础配置补齐')
assert.match(seed,/syncActiveEmployeeApprovalDigitalConfigs\(\)[\s\S]*auditFoundationReadiness/,'员工信息补齐后必须执行审批智选基础库就绪审计')
assert.match(seed,/基础模型库完整性存在待处理项|审批\/智选基础模型库完整性存在待处理项/,'基础库不完整只记录告警，不得使整个应用退出')

assert.match(runtime,/assertFoundationReady\("approval"\)/,'审批当前结构计算前必须校验基础模型库')
assert.match(runtime,/assertFoundationReady\("smart"\)/,'智选当前结构计算前必须校验基础模型库')
assert.match(foundation,/审批模型基础模型库未就绪|智选模型基础模型库未就绪/,'错误必须明确指出基础模型库未就绪')

const rulePath=new URL('../.ai/rules/26_APPROVAL_SMART_BASE_MODEL_LIBRARY_RULES.md',import.meta.url)
assert.ok(existsSync(rulePath),'必须新增规则26')
const rule=readFileSync(rulePath,'utf8')
assert.match(rule,/基础数据完善[\s\S]*运行模型[\s\S]*数据入库/)
assert.match(rule,/system_initialization[\s\S]*最小.*闭环/)
assert.match(rule,/不得.*直接.*INSERT[\s\S]*digital_library_records|不得.*直接.*写.*digital_library_records/)
assert.match(rule,/标识关联配置数字化库[\s\S]*允许.*0条/)
assert.match(rule,/无法.*唯一.*确定[\s\S]*不得.*猜/)
assert.ok(pkg.scripts['test:v17726'],'package.json必须提供V17.7.26回归命令')
assert.match(pkg.scripts['test:contracts'],/regression-v17726\.test\.mjs/,'全量合同测试必须纳入V17.7.26')

console.log('V17.7.26 regression checks passed')
