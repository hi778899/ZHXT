import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const runtime=readFileSync(new URL('../server/src/runtime-0622.ts',import.meta.url),'utf8')
const builder=readFileSync(new URL('../server/src/model-builder.ts',import.meta.url),'utf8')
const migration=readFileSync(new URL('../server/migrations/030_model_timeout_effective_configuration.sql',import.meta.url),'utf8')
const rule=readFileSync(new URL('../.ai/rules/23_MODEL_TIMEOUT_EFFECTIVE_RULES.md',import.meta.url),'utf8')

assert.match(runtime,/5013001001110171/,'规定时限必须读取模型时限数字化标识')
assert.match(runtime,/5013001001110172/,'适用业务范围必须读取业务领域数字化标识')
assert.match(runtime,/timeoutRecordEffective/,'模型时限记录必须有正式生效判定')
assert.match(runtime,/approvedResult\(row\.approvalResult \?\? ""\)/,'人工模型时限配置必须经过审批同意后生效')
assert.match(runtime,/originPriority=row\.recordOrigin==="model_run" \? 3/,'审批生效人工配置必须优先于系统基线')
assert.match(runtime,/b\.effectiveAt-a\.effectiveAt/,'同类配置必须按最新审批生效时间确定当前值')

assert.match(builder,/synchronizeApprovedSourceConfiguration/,'审批归档后必须同步源模型时限配置生效状态')
assert.match(builder,/"配置状态":approved \? "生效" : "未生效"/)
assert.match(builder,/"生效时间":completedAt/)
assert.match(builder,/await synchronizeApprovedSourceConfiguration\(input,resultName,completedAt\)/)

assert.match(migration,/030_model_timeout_effective_configuration/)
assert.match(migration,/配置状态/)
assert.match(migration,/5013001001110171/)
assert.match(migration,/5013001001110172/)
assert.match(rule,/系统初始化的 `8` 仅是基线配置/)
assert.match(rule,/审批结果为不同意、退回修改或其他终止结果时，该时限配置不得生效/)

console.log('V17.7.22 regression checks passed')
