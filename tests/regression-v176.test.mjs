import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')
const runtime = fs.readFileSync(new URL('../server/src/runtime-0622.ts', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const clusterRules = fs.readFileSync(new URL('../.ai/rules/03_MODEL_CLUSTER_RULES.md', import.meta.url), 'utf8')
const approvalSmartRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')
const dashboardRules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')

// 1. 规则必须是V17.6，且智选未启动只能在不存在真实运行事实时出现。
for (const rules of [clusterRules, approvalSmartRules, approvalRules, dashboardRules]) assert.match(rules, /V17\.6/)
assert.match(clusterRules, /待办.*不得显示“未启动”/s)
assert.match(dashboardRules, /同一模型.*我的待办.*我的已办.*我的办结/s)

// 2. 已办/办结的智选关联查询必须兼容真实source_run_id、来源运行字段和来源审批模型文件名，不能只看旧快照。
assert.match(server, /sr0\.source_run_id=ar\.id/)
assert.match(server, /sr0\.input_data->>'sourceRunId'=ar\.id/)
assert.match(server, /sr0\.input_data->>'sourceFileName'=ar\.file_name/)
assert.match(server, /sr0\.input_data->>'前序模型文件名'=ar\.file_name/)
assert.match(server, /todos[\s\S]*智选模型/, '关联状态查询必须能以智选待办/运行事实做兜底')
assert.match(app, /await refreshDashboard\(\)/, '办理完成后必须立即以服务端真实状态刷新待办、已办和办结，不能保留旧模型簇快照')

// 3. 审批计算依据继续在后端保存，但普通用户界面不得直接展示指定技术字段。
for (const text of ['审批路径计算依据','正式审批路径节点','审批人计算依据']) assert.ok(builder.includes(text), `后台必须保留：${text}`)
for (const text of ['审批路径计算依据','正式审批路径节点','审批人计算依据']) assert.ok(!app.includes(`<span>${text}</span>`), `普通界面不得显示：${text}`)
const requirementLabelCount = (app.match(/<span>本环节审批\/审查要求<\/span>/g) || []).length
assert.equal(requirementLabelCount, 0, '普通用户界面不得展示本环节审批/审查要求，包括审批办理记录')

// 4. 0622模型时限必须收敛为单一数值，不能带说明文字或单位占位。
assert.match(runtime, /function timeoutForBusiness/)
assert.ok(!runtime.includes('（源资料未定义单位）'), '0622时限值不得拼接说明文字')
assert.match(runtime, /模型时限/)
assert.match(builder, /currentTimeoutValue/, '审批待办必须携带模型时限实际值')
assert.ok(!app.includes('按数字化库配置</b>'), '审批详情不得把规定时限显示为按数字化库配置')
assert.ok(!app.includes(' 小时</b>'), '0622当前源数据未定义单位，审批详情不得自行追加小时')

// 5. 审批办理记录展示实际耗时，不展示规定时限；耗时必须由办理时间减去到达时间。
assert.match(app, /function approvalElapsedDisplay\(arrivedAt: unknown, handledAt: unknown\)/, '前端必须提供审批实际耗时计算')
assert.match(app, /handledMs-arrivedMs/, '耗时必须由办理时间减去到达时间')
assert.match(app, /<span>耗时<\/span><b>\{approvalElapsedDisplay\(step\.arrivedAt,step\.handledAt\)\}<\/b>/, '审批办理记录必须展示真实耗时')
assert.ok(!app.includes('<span>本环节审批/审查要求</span>'), '审批办理记录不得展示本环节审批/审查要求')
assert.match(builder, /elapsedMilliseconds: arrived && handled \? Math\.max\(0, handled\.getTime\(\) - arrived\.getTime\(\)\) : null/, '后端办理记录必须保留可核验的真实耗时差值')

console.log('V17.6 realtime smart status, approval visibility and timeout contract passed')
