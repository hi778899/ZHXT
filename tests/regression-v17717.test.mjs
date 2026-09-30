import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const runtime = fs.readFileSync(new URL('../server/src/runtime-0622.ts', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const relativeRules = fs.readFileSync(new URL('../.ai/rules/20_APPROVAL_RELATIVE_LEVEL_RULES.md', import.meta.url), 'utf8')

assert.match(relativeRules, /当前有效版本：V17\.7\.17/, '相对审批规则必须升级到 V17.7.17')
assert.match(runtime, /相对审批\/审查级次/, '0622审批运行必须按相对级次计算')
assert.match(runtime, /基础行政审批级次/, '审批内部必须形成基础行政审批级次')
assert.match(runtime, /最终行政审批级次/, '审批内部必须形成最终行政审批级次')
assert.match(runtime, /技术\/业务审查级次/, '技术/业务审查必须独立形成相对级次')
assert.match(runtime, /员工数字化编码/, '审批路径必须携带实际人员员工数字化编码')
assert.match(runtime, /finalPathLabel/, '最终审批路径必须由岗位/角色与员工数字化编码形成')
assert.match(builder, /基础行政审批级次/, '审批模型运行输出必须使用相对行政审批级次')
assert.match(builder, /最终行政审批级次/, '审批模型运行输出必须使用最终行政审批级次')
assert.match(builder, /技术业务审查级次/, '审批模型运行输出必须使用技术/业务审查级次')
assert.match(builder, /delete execution\.output\["基础审批目标"\]/, '当前运行不得继续输出旧基础审批目标作为现行字段')
assert.ok(!app.includes('<h4 className="section-title">审批路径计算</h4>'), '普通审批界面不得展示审批路径计算区块')
assert.ok(!app.includes('<h4 className="section-title">审批人计算</h4>'), '普通审批界面不得展示审批人计算区块')
for (const label of ['基础审批目标','最终审批目标','技术/业务审查目标层级','组织逐级路径','命中数字化标识阈值']) {
  assert.ok(!app.includes(`<span>${label}</span>`), `普通审批界面不得展示：${label}`)
}
assert.match(app, />最终审批路径<\/span>/, '普通审批界面必须展示最终审批路径')
assert.match(templates, /普通审批界面只展示最终审批路径/, '审批模板必须固化最终路径唯一展示口径')

console.log('V17.7.17 relative approval levels and final-path-only UI regression passed')
