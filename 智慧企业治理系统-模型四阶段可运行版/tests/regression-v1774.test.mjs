import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')
const dashboardRules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')
const smartRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')

assert.match(server, /\/api\/model-runs\/\(\[\^\/\]\+\)\\\/detail|modelRunDetailMatch/, '后端必须提供按 runId 查询模型真实详情的接口')
assert.match(server, /m\.name='智选模型'/, '详情接口必须限定读取真实智选模型运行')
assert.match(server, /digital_library_records WHERE run_id=\$1/, '详情接口必须读取智选和原业务数字化库记录')
assert.match(server, /sourceApproval:normalizeRun\(approval\)/, '详情接口必须返回来源审批运行')
assert.match(server, /businessRun:normalizeRun\(business\)/, '详情接口必须返回原业务运行')

assert.match(app, /function SmartRunDetail\(/, '前端必须使用统一智选详情组件')
assert.match(app, /apiFetch<\{detail:SmartRunDetailPayload\}>\(`\/api\/model-runs\/\$\{encodeURIComponent\(runId\)\}\/detail`\)/, '智选详情必须按 runId 实时读取后端真实运行')
assert.match(app, /if \(run\?\.runKind === "smart"\) return <SmartRunDetail/, '已办/办结智选查看必须统一进入 SmartRunDetail')
assert.match(app, /runId:String\(raw\.runId \?\? ""\)/, '关联模型入口必须传递真实 smart_run_id')
for (const title of ['模型信息','业务内容','审批结果','统计分析','智选判断','关联模型启动明细']) assert.match(app, new RegExp(`section-title">${title}`), `智选详情必须包含${title}`)
assert.match(app, /未找到本次智选模型运行记录/, '运行记录缺失时必须有明确提示而不是空白页')
assert.match(app, /本次智选没有形成后续关联模型启动明细；这仍是一条完整、有效的智选模型运行记录/, '无后续关联模型时必须正常展示完整智选结果')

assert.match(dashboardRules, /当前有效版本：V17\.7\.4/, '驾驶舱规则必须升级为 V17.7.4')
assert.match(dashboardRules, /smart_run_id → model_runs/, '驾驶舱规则必须以 smart_run_id 读取真实运行')
assert.match(dashboardRules, /禁止继续以 `todo\.content`/, '驾驶舱规则必须禁止以待办快照作为智选详情主数据源')
assert.match(smartRules, /当前有效版本：V17\.7\.4/, '审批智选规则必须升级为 V17.7.4')
assert.match(smartRules, /`model_runs\.id` 是本次智选查看的唯一运行主键/, '智选规则必须明确运行主键')

console.log('V17.7.4 smart run detail source-of-truth regression passed')
