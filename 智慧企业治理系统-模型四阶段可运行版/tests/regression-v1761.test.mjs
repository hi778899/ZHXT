import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const approvalSmartRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')
const dashboardRules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')

for (const rules of [approvalSmartRules, approvalRules]) {
  assert.match(rules, /当前有效版本：V17\.(?:6\.1|7(?:\.\d+)?)/, '审批与智选当前有效规则不得回退到 V17.6.1 之前')
  assert.match(rules, /耗时\s*=\s*办理时间\s*-\s*到达时间/, '审批规则必须明确耗时=办理时间-到达时间')
}
assert.match(dashboardRules, /当前有效版本：V17\.7/, '驾驶舱规则已由后续 V17.7 工作台规则接管')
assert.match(dashboardRules, /耗时\s*=\s*办理时间\s*-\s*到达时间/, '驾驶舱规则仍必须继承审批办理耗时规则')

const processLine = app.split('\n').find(line => line.includes('>审批办理记录</h4>')) ?? ''
assert.ok(processLine, '必须存在审批办理记录区域')
assert.ok(processLine.includes('<span>耗时</span>'), '审批办理记录必须显示耗时')
assert.ok(!processLine.includes('<span>规定时限</span>'), '审批办理记录不得显示规定时限')
assert.ok(!processLine.includes('<span>本环节审批/审查要求</span>'), '审批办理记录不得显示本环节审批/审查要求')
assert.match(app, /handledMs-arrivedMs/, '前端耗时必须直接由办理时间减去到达时间')
assert.match(builder, /elapsedMilliseconds: arrived && handled \? Math\.max\(0, handled\.getTime\(\) - arrived\.getTime\(\)\) : null/, '后端必须保存可核验的真实耗时差值')
assert.match(templates, /办理记录耗时=办理时间-到达时间/, '审批模型模板必须固化新耗时规则')
assert.match(templates, /普通用户记录不展示审批\/审查要求和规定时限，改为展示实际耗时/, '审批模型模板必须固化新的办理记录展示边界')

console.log('V17.6.1 approval process elapsed-time contract passed')
