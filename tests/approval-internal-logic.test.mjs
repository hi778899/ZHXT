import fs from 'node:fs'
import assert from 'node:assert/strict'

const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const runtime = fs.readFileSync(new URL('../server/src/runtime-0622.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')

for (const token of ['approvalAssignment','personnel','timeout']) {
  assert.ok(builder.includes(token), `审批运行逻辑必须读取 ${token} 数字化库`)
}
assert.match(builder, /sourceIdentifierValues/, '审批模型必须按前序业务数字化标识值参与判断运算')
assert.match(builder, /thresholdVariables/, '审批模型必须形成阈值变量集合并作为内部运算依据')
assert.match(builder, /relativeLevelLabel/, '兼容审批路径必须按发起人为起点形成相对审批/审查级次')
assert.match(runtime, /相对审批\/审查级次/, '0622审批内核必须按相对审批/审查级次计算')
assert.match(runtime, /最终行政审批级次/, '0622审批内核必须形成最终行政审批级次')
assert.match(runtime, /技术\/业务审查级次/, '0622审批内核必须形成独立技术/业务审查级次')
assert.match(runtime, /员工数字化编码/, '最终路径必须能追溯实际人员员工数字化编码')
assert.match(builder, /approvalTimeoutHours/, '审批模型必须计算审批时限')
assert.match(builder, /modelDesignLibrarySnapshot/, '审批模型必须读取模型设计模型数字化库快照作为判断依据')
assert.match(builder, /approvalResultPdf/, '审批模型必须形成审批结果PDF引用')
assert.match(templates, /技术\/业务审查/, '审批模型模板必须体现技术/业务审查路径')
assert.match(templates, /最终审批路径/, '审批模型模板必须以最终审批路径作为普通办理界面路径结果')

console.log('approval internal logic contract passed')
