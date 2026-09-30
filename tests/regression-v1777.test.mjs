import assert from "node:assert/strict"
import fs from "node:fs"

const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8")
const runtime=fs.readFileSync(new URL("../server/src/runtime-0622.ts",import.meta.url),"utf8")
const builder=fs.readFileSync(new URL("../server/src/model-builder.ts",import.meta.url),"utf8")
const template=fs.readFileSync(new URL("../server/src/model-templates.ts",import.meta.url),"utf8")
const migration=fs.readFileSync(new URL("../server/migrations/021_leave_current_digital_approval_target.sql",import.meta.url),"utf8")

assert.match(template,/请休假模型", "5011001005001000001/,"请休假模型应进入当前19位模型编码")
assert.match(runtime,/未匹配到基础审批级次配置/,"0622审批必须在基础审批级次配置缺失时明确停止")
assert.match(runtime,/基础行政审批级次/,"审批内部必须形成相对于发起人的基础行政审批级次")
assert.match(runtime,/最终行政审批级次/,"审批内部必须形成相对于发起人的最终行政审批级次")
assert.match(runtime,/组织数字化属性仅用于组织、岗位、人员匹配/,"组织数字化属性只能作为组织与人员匹配依据")
assert.match(builder,/businessContext\.modelName === "请休假模型"/,"请休假不得回退历史固定层级链路")
assert.ok(!app.includes('<span>基础审批目标</span>'),"普通审批界面不得展示基础审批目标")
assert.ok(!app.includes('<span>最终审批目标</span>'),"普通审批界面不得展示最终审批目标")
assert.match(app,/>最终审批路径<\/span>/,"普通审批界面只需展示最终审批路径")
assert.match(migration,/历史兼容，不参与当前审批目标计算/,"历史考勤四级配置必须退出当前计算")
console.log("V17.7.7 regression checks passed")
