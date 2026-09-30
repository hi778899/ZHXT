import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const internalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')

assert.match(app, /approvalTimeoutDisplay\(approval\.currentTimeoutValue\)/, '当前办理页必须显示后端按模型时限数字化库解析的当前规定时限')
assert.match(builder, /const currentTimeoutValue = String\(currentDef\?\.timeoutValue \?\? ""\)\.trim\(\) \|\| "未配置"/, '待办生成必须直接使用当前节点数字化库时限值')
assert.match(builder, /currentTimeoutSourceLibraryId:"lib-standard-model-timeout"/, '待办必须记录时限来源数字化库')

const handledMarker = '<h4 className="section-title">办理记录</h4>'
const handledStart = app.indexOf(handledMarker)
const handledTail = handledStart >= 0 ? app.slice(handledStart, handledStart + 1000) : ''
assert.ok(handledStart >= 0, '必须保留普通已办办理记录区')
assert.match(handledTail, /<span>耗时<\/span>/, '普通已办办理记录必须显示耗时')
assert.ok(!handledTail.includes('<span>规定时限</span>'), '普通已办办理记录不得显示规定时限')
assert.match(handledTail, /approvalElapsedDisplay\(content\.approvalArrivedAt, item\.handled_at \?\? item\.handled\)/, '普通已办耗时必须按到达时间与办理时间计算')

assert.match(approvalRules, /规定时限的唯一正式来源是\*\*模型时限数字化库\*\*/, '审批智选规则必须明确规定时限唯一正式来源')
assert.match(internalRules, /模型时限数字化库为当前节点匹配得到的正式值/, '内部规则必须直接读取模型时限数字化库')
assert.match(templates, /规定时限直接读取模型时限数字化库形成的当前节点正式值/, '审批模型模板必须固化数字化库时限来源')

console.log('V17.7.2 timeout consistency non-regression with digital-library source passed')
