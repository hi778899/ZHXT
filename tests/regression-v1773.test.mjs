import fs from 'node:fs'
import assert from 'node:assert/strict'

const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const seed = fs.readFileSync(new URL('../server/src/seed.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const workbench = fs.readFileSync(new URL('../src/ModelBuilderWorkbench.tsx', import.meta.url), 'utf8')
const clusterRules = fs.readFileSync(new URL('../.ai/rules/03_MODEL_CLUSTER_RULES.md', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const internalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')

assert.match(builder, /function mandatoryApprovalSmartRelation\(\)/, '运行引擎必须定义审批→智选系统固定关系')
assert.match(builder, /if \(type !== "approval"\) return configured[\s\S]*return \[mandatoryApprovalSmartRelation\(\), \.\.\.otherRelations\]/, '审批归档关系不能只依赖配置，必须注入系统智选关系')
assert.match(builder, /systemLink = type === "approval" && targetName === "智选模型" \? "approval_to_smart"/, '审批→智选触发必须标识为系统硬性链路')
assert.match(builder, /mandatoryApprovalSmartStart = options\.systemLink === "approval_to_smart"[\s\S]*!mandatoryApprovalSmartStart/, '系统固定审批→智选不得因智选历史启动方式配置缺失而被拒绝')
assert.match(builder, /input\.businessRunId = source\.runId[\s\S]*normalizeSmartInputAliases\(input\)[\s\S]*execution = executeDesign/, '智选追溯原业务后必须再次回填中文必填字段再进入模型设计执行')
assert.match(builder, /if \(modelTypeOf\(row\) === "approval"\)[\s\S]*config\.relations = \[mandatoryApprovalSmartRelation\(\), \.\.\.existingRelations\]/, '审批模型重新发布时必须自动补齐系统固定关系')
assert.match(builder, /const smartTodo = await createSmartResultTodo\(row, runId, user\.id/, '智选模型完成运行后必须形成智选结果待办')

assert.match(seed, /async function ensureSystemApprovalSmartLink\(\)/, '启动时必须兼容修复历史审批项目固定关系')
assert.match(seed, /await ensureSystemApprovalSmartLink\(\)/, '数据库初始化必须执行历史固定关系补齐')
assert.match(seed, /targetModelName:"智选模型"/, '历史审批关系补齐目标必须是智选模型')
assert.match(seed, /if \(!startModes\.includes\("hard_link"\)\)/, '历史智选模型必须补齐 hard_link 启动方式')

assert.match(templates, /id:"system-approval-smart"[\s\S]*targetModelName:"智选模型"/, '新审批模板必须直接包含系统固定智选关系')
assert.match(workbench, /id: "system-approval-smart"[\s\S]*targetModelName: "智选模型"/, '审批模型配置界面必须显示系统固定关系')
assert.match(workbench, /isSystemFixedRelation\(relation\)/, '系统固定关系不能在界面禁用或修改')
assert.match(workbench, />系统固定<\/em>/, '审批→智选关系必须明确标识为系统固定')

assert.match(clusterRules, /当前有效版本：V17\.7\.(?:[3-9]|[1-9]\d+)/, '模型簇规则不得低于 V17.7.3')
assert.match(clusterRules, /不得依赖以下可变配置才能成立/, '模型簇规则必须明确硬性链路不依赖历史配置')
assert.match(clusterRules, /原业务发起人生成智选结果待办/, '模型簇规则必须要求原业务发起人收到智选待办')
assert.match(approvalRules, /当前有效版本：V17\.7\.(?:[3-9]|[1-9]\d+)/, '审批智选规则不得低于 V17.7.3')
assert.match(approvalRules, /历史配置缺失、被删除或被禁用时，系统仍必须执行审批→智选/, '审批智选规则必须覆盖历史配置断链问题')
assert.match(approvalRules, /无后续关联模型不等于“不启动智选”/, '没有后续业务模型时仍必须运行智选')
assert.match(internalRules, /运行引擎系统关系/, '审批内部规则必须把审批→智选定义为运行引擎关系')
assert.match(internalRules, /系统固定/, '审批内部规则必须禁止删除固定关系')

console.log('V17.7.3 approval archive hard-link smart-select regression passed')
