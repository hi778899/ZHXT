import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const seed=readFileSync(new URL('../server/src/seed.ts',import.meta.url),'utf8')
const builder=readFileSync(new URL('../server/src/model-builder.ts',import.meta.url),'utf8')
const rule=readFileSync(new URL('../.ai/rules/22_MODEL_DIGITAL_CONFIG_COMPLETENESS_RULES.md',import.meta.url),'utf8')

assert.match(seed,/5012001008000000000/,'会议管理必须有独立业务分类数字化属性')
assert.match(seed,/"会议管理":APPROVAL_CONFIG_DOMAIN\.meetingManagement/)
assert.match(seed,/"会议标准":APPROVAL_CONFIG_DOMAIN\.meetingManagement/)
assert.match(seed,/v17724-business-meeting-management/,'会议管理业务分类必须通过真实system_sync运行形成')
assert.match(seed,/501200402002','501200402003/,'会议管理业务归属必须落到既有公司治理组织')
assert.match(seed,/system_meeting_management_config_sync/,'会议业务归属/人员补齐必须通过模型运行归档')
assert.match(seed,/501200302023','501200302031','501200302032/,'公司治理层审批分管必须覆盖会议管理')
assert.match(builder,/category==="会议管理" \|\| category==="会议标准"/,'模型发布也必须识别会议分类')
assert.match(builder,/5012001008000000000/)
assert.match(seed,/console\.warn\(`全系统模型数字化配置完整性存在待处理项/,'配置异常不得让整个服务启动失败')
assert.doesNotMatch(seed,/throw new Error\(`全系统模型数字化配置完整性校验未通过/)
assert.match(rule,/会议管理/)
assert.match(rule,/不得因为单个模型存在缺失配置而阻断整个应用服务启动/)
console.log('V17.7.24 regression checks passed')
