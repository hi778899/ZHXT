import assert from "node:assert/strict"
import fs from "node:fs"

const app=fs.readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8")
const runtime=fs.readFileSync(new URL("../server/src/runtime-0622.ts",import.meta.url),"utf8")
const builder=fs.readFileSync(new URL("../server/src/model-builder.ts",import.meta.url),"utf8")
const template=fs.readFileSync(new URL("../server/src/model-templates.ts",import.meta.url),"utf8")
const migration=fs.readFileSync(new URL("../server/migrations/021_leave_current_digital_approval_target.sql",import.meta.url),"utf8")

assert.match(template,/请休假模型\", \"5011001005001000001/,"请休假模型应进入当前19位模型编码")
assert.match(runtime,/未匹配到基础审批目标配置/,"0622审批必须在基础审批目标缺失时明确停止")
assert.match(runtime,/基础审批目标数字化属性/,"基础审批目标必须保留数字化属性追溯")
assert.match(runtime,/基础审批目标\":baseTargetDisplay/,"基础审批目标必须展示完整对象含义")
assert.match(builder,/businessContext\.modelName === \"请休假模型\"/,"请休假不得回退历史固定层级链路")
assert.match(app,/>基础审批目标<\/span>/,"审批详情应使用基础审批目标口径")
assert.doesNotMatch(app,/>基础审批目标层级<\/span>/,"当前UI不得继续显示基础审批目标层级标题")
assert.match(migration,/历史兼容，不参与当前审批目标计算/,"历史考勤四级配置必须退出当前计算")
console.log("V17.7.7 regression checks passed")
