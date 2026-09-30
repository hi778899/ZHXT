import assert from "node:assert/strict"
import fs from "node:fs"

const employee=fs.readFileSync(new URL("../server/src/employee-digital-config.ts",import.meta.url),"utf8")
const runtime=fs.readFileSync(new URL("../server/src/runtime-0622.ts",import.meta.url),"utf8")
const seed=fs.readFileSync(new URL("../server/src/seed.ts",import.meta.url),"utf8")
const migration=fs.readFileSync(new URL("../server/migrations/023_leave_employee_digital_config_and_attendance_assignment.sql",import.meta.url),"utf8")
const rules=fs.readFileSync(new URL("../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md",import.meta.url),"utf8")

assert.match(employee,/ensureCurrentEmployeeCode/,'员工审批配置必须确保当前11位员工数字化编码')
assert.match(employee,/data->>'数据版本'='0622'/,'员工信息正式记录必须使用0622版本')
assert.match(employee,/lib-standard-person/,'员工审批配置必须写入员工信息数字化库')
assert.match(employee,/SPECIAL_ORGS/,'治理类组织不得被普通账号自动伪造岗位')
assert.match(employee,/department_manager[\s\S]*ATTENDANCE_DOMAIN/,'部门负责人必须取得考勤管理业务域')
assert.match(runtime,/ensureEmployeeApprovalDigitalConfig\(params\.originatorId\)/,'审批计算前必须确保申请人员工数字化配置已形成')
assert.match(seed,/syncActiveEmployeeApprovalDigitalConfigs\(\)/,'启动 seed 必须同步现有启用账号的员工数字化配置')
assert.match(migration,/501200302041/,'四级机构负责人审批分管配置必须补齐')
assert.match(migration,/5012001005001000000/,'考勤管理业务属性必须进入审批分管配置')
assert.match(migration,/501200402003-501200402006/,'默认设备管理部必须形成可计算的组织上级关系')
assert.match(rules,/系统账号是员工数字化配置的初始化\/同步来源/,'规则必须明确账号只是同步来源')
assert.match(rules,/系统管理员权限与组织岗位分离/,'规则必须禁止用管理员权限替代组织职级')

console.log("V17.7.9 employee digital approval config regression checks passed")
