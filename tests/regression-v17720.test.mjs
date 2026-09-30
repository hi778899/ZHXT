import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const seed=readFileSync(new URL('../server/src/seed.ts',import.meta.url),'utf8')
const compose=readFileSync(new URL('../docker-compose.yml',import.meta.url),'utf8')
const migration=readFileSync(new URL('../server/migrations/028_attendance_and_core_model_digital_config_prerequisites.sql',import.meta.url),'utf8')
const rule=readFileSync(new URL('../.ai/rules/22_MODEL_DIGITAL_CONFIG_COMPLETENESS_RULES.md',import.meta.url),'utf8')

assert.match(seed,/ensureApprovalFoundationDigitalConfigs/)
assert.match(seed,/5011001001100003001/,'请假类型标准模型必须有当前19位模型数字化编码配置')
assert.match(seed,/5011001001100022001/,'模型时限模型必须有当前19位模型数字化编码配置')
assert.match(seed,/5012001005001000000/,'请假类型标准模型必须归属考勤管理')
assert.match(seed,/5012001007000000000/,'模型时限模型必须归属数字化管理')
assert.match(seed,/lib-standard-digital-config/,'模型数字化配置必须写入模型数字化配置数字化库')
assert.match(seed,/lib-standard-approval-assignment/,'考勤主管审查必须补齐审批分管配置')
assert.match(seed,/组织人事部业务审核岗/,'考勤主管员工信息数字化配置必须明确业务审核岗')
assert.match(seed,/system_attendance_supervisor_config_sync/,'考勤主管配置变更必须通过真实系统同步模型运行归档')
assert.match(seed,/system_model_digital_config_sync/,'模型数字化配置补齐必须通过真实模型运行归档')
assert.match(compose,/ATTENDANCE_SUPERVISOR_DEPARTMENT: \$\{ATTENDANCE_SUPERVISOR_DEPARTMENT:-组织人事部\}/)
assert.match(migration,/role='attendance_supervisor'/)
assert.match(migration,/综合管理部/)
assert.match(rule,/请假类型标准模型/)
assert.match(rule,/模型时限模型/)
assert.match(rule,/run_id/)

console.log('V17.7.20 regression checks passed')
