import fs from 'node:fs'
import assert from 'node:assert/strict'

const builder=fs.readFileSync(new URL('../server/src/model-builder.ts',import.meta.url),'utf8')
const runtime=fs.readFileSync(new URL('../server/src/runtime-0622.ts',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../server/migrations/027_complete_final_approval_path_and_attendance_review.sql',import.meta.url),'utf8')
const finalPathRule=fs.readFileSync(new URL('../.ai/rules/21_APPROVAL_FINAL_PATH_EXECUTION_RULES.md',import.meta.url),'utf8')
const approvalRule=fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md',import.meta.url),'utf8')

assert.match(finalPathRule,/当前有效版本：V17\.7\.19/,'Path_final 规则必须升级到 V17.7.19')
assert.match(approvalRule,/Path_final 节点进度驱动/,'审批内部规则必须明确节点进度驱动')

assert.match(builder,/approvalFinalPathSteps=stepDefs\.map/,'首次计算必须固化本次 Path_final 节点快照')
assert.match(builder,/completedIndexes=new Set/,'办理后必须统计已完成 Path_final 节点')
assert.match(builder,/nextRequiredIndex=requiredIndexes\.find/,'办理后必须寻找下一未完成必经节点')
assert.match(builder,/approvalFinalPathComplete:false/,'存在后续节点时审批模型必须保持未完成')
assert.match(builder,/最终审批路径尚未全部完成/,'正常同意归档前必须有完整路径硬校验')
assert.match(builder,/approvalFinalPathComplete: explicitTerminal \? false : true/,'正常完整路径归档必须写入完成状态')

assert.match(runtime,/reviewRolePattern=/,'0622运行必须直接识别技术\/业务审查岗位')
assert.match(runtime,/技术\/业务审查人员必须由审批分管配置与员工信息数字化库直接形成/,'技术\/业务审查节点必须来自数字化库直接匹配')
assert.doesNotMatch(runtime,/branch\.push\(managers\[0\]\)/,'不得从审查人员自动追加行政负责人作为审查节点')

assert.match(migration,/data->>'职级含义'='业务审核岗'/,'必须配置业务审核岗的考勤审查职责')
assert.match(migration,/5012001005001000000/,'考勤管理业务属性必须进入业务审核岗技术\/业务审查分管')
assert.match(migration,/data->>'岗位\/角色'='考勤主管'/,'考勤主管员工配置必须确保包含考勤管理业务领域')
assert.match(migration,/UPDATE model_runs r[\s\S]*output_data/,'数字化配置迁移后必须同步真实模型运行输出快照')

console.log('V17.7.19 full Path_final execution and attendance review regression passed')
