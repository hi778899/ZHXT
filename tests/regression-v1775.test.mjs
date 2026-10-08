import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const dataRules = fs.readFileSync(new URL('../.ai/rules/06_DIGITAL_LIBRARY_DATASOURCE_RULES.md', import.meta.url), 'utf8')
const smartRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const internalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')
const dashboardRules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')

assert.ok(!app.includes('这仍是一条完整、有效的智选模型运行记录'), '智选详情不得显示解释性有效性结论')
assert.match(app, /sourceApprovalDigitalRecord:RunDigitalRecordView\|null/, '智选详情必须读取来源审批数字化库记录')
assert.match(app, /const approvalDigital=object\(detail\.sourceApprovalDigitalRecord\?\.data\)/, '审批结果必须从审批数字化库数据读取')
assert.match(app, /const businessData=libraryBusinessData\(detail\.businessDigitalRecord\)/, '业务内容必须从原业务数字化库读取')
assert.match(app, /const decision=text\(smartDigital\["智选结果"\]/, '智选结果必须从智选数字化库读取')
assert.ok(!/const output=object\(run\.output\)/.test(app), '智选详情不得从 model_runs.output 恢复业务字段')
assert.ok(!/const input=object\(run\.input\)/.test(app), '智选详情不得从 model_runs.input 恢复业务字段')
assert.match(server, /sourceApprovalDigitalRecord:normalizeLibrary\(approvalLibraryResult\.rows\[0\] \?\? null\)/, '后端必须返回来源审批数字化库记录')
assert.match(server, /model_runs 仅用于运行定位、文件名、状态和关联追溯；业务字段的正式展示值必须来自对应数字化库/, '后端必须固化运行记录与业务数据源边界')
assert.match(builder, /currentTimeoutSourceLibraryName:"模型时限数字化库"/, '规定时限必须标记模型时限数字化库来源')
assert.match(builder, /"统计分析模型文件名":output\["统计分析模型文件名"\]/, '智选数字化库必须归档统计分析模型文件名')

assert.match(dataRules, /模型业务数据的唯一正式来源是其归属数字化库/, '总数据源规则必须明确数字化库唯一正式来源')
assert.match(smartRules, /当前有效版本：V17\.7\.(?:[5-9]|\d{2,})/, '审批智选规则不得回退到 V17.7.5 之前')
assert.match(internalRules, /当前有效版本：V17\.7\.(?:[5-9]|\d{2,})/, '审批内部规则不得回退到 V17.7.5 之前')
assert.match(dashboardRules, /当前有效版本：V17\.7\.(?:[5-9]|\d{2,})/, '驾驶舱规则不得回退到 V17.7.5 之前')
assert.match(dashboardRules, /不得增加“这仍是一条完整、有效的智选模型运行记录”等解释性结论/, '驾驶舱规则必须禁止解释性有效性结论')

console.log('V17.7.5 digital-library source-of-truth regression passed')
