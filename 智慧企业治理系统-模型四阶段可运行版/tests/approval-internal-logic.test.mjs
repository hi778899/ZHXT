import fs from 'node:fs'
import assert from 'node:assert/strict'

const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')

for (const token of ['approvalAssignment','thresholds','personnel','organizationRanks','timeout']) {
  assert.ok(builder.includes(token), `审批运行逻辑必须读取 ${token} 标准数字化库`)
}
assert.match(builder, /sourceIdentifierValues/, '审批模型必须按前序业务数字化标识值参与判断运算')
assert.match(builder, /thresholdVariables/, '审批模型必须形成阈值变量集合')
assert.match(builder, /technicalLevel/, '审批模型必须计算技术审查层级')
assert.match(builder, /approvalTimeoutHours/, '审批模型必须计算审批时限')
assert.match(builder, /modelDesignLibrarySnapshot/, '审批模型必须读取模型设计模型数字化库快照作为判断依据')
assert.match(builder, /organizationRankWeights/, '审批模型必须使用组织职级数字化库支撑层级比较')
assert.match(builder, /approvalResultPdf/, '审批模型必须形成审批结果PDF引用')
assert.match(templates, /技术审查/, '审批模型模板必须体现技术审查路径')
assert.match(templates, /审批阈值配置数字化库/, '审批模型模板必须声明阈值数字化库来源')

console.log('approval internal logic contract passed')
