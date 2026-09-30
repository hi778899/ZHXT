import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const internalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')

assert.match(app, /approval\.approverCalculation\[approval\.currentStepIndex\]\?\.\["规定时限"\]\s*\?\?\s*approval\.currentTimeoutValue/, '当前办理页必须优先显示当前节点审批人计算中的规定时限')
assert.match(builder, /const computedTimeoutValue = String\(approverCalculation\[stepIndex\]\?\.\["规定时限"\]/, '待办生成必须读取当前节点审批人计算时限')
assert.match(builder, /const currentTimeoutValue = computedTimeoutValue \|\|/, '审批人计算规定时限必须具有最高展示优先级')

const handledMarker = '<h4 className="section-title">办理记录</h4>'
const handledStart = app.indexOf(handledMarker)
const handledTail = handledStart >= 0 ? app.slice(handledStart, handledStart + 1000) : ''
assert.ok(handledStart >= 0, '必须保留普通已办办理记录区')
assert.match(handledTail, /<span>耗时<\/span>/, '普通已办办理记录必须显示耗时')
assert.ok(!handledTail.includes('<span>规定时限</span>'), '普通已办办理记录不得显示规定时限')
assert.match(handledTail, /approvalElapsedDisplay\(content\.approvalArrivedAt, item\.handled_at \?\? item\.handled\)/, '普通已办耗时必须按到达时间与办理时间计算')

assert.match(approvalRules, /当前有效版本：V17\.7\.[23]/, '审批智选规则不得低于 V17.7.2')
assert.match(approvalRules, /如果“审批人计算”当前节点已经计算出 `4`[\s\S]*必须显示 `4`/, '规则必须覆盖当前节点已算出4却显示未配置的问题')
assert.match(internalRules, /两处展示必须来自同一次审批运算快照/, '内部规则必须禁止两套时限口径')
assert.match(templates, /本环节办理信息的规定时限优先取当前节点审批人计算结果/, '审批模型模板必须固化当前节点时限取值优先级')

console.log('V17.7.2 current approval timeout consistency regression passed')
