import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const designer = fs.readFileSync(new URL('../src/ModelFormDesigner.tsx', import.meta.url), 'utf8')
const workbench = fs.readFileSync(new URL('../src/ModelBuilderWorkbench.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')

// 1. 我的办结中审批模型必须直接打开模型自身详情，不能再执行已经废止/不存在的模型簇解析函数。
assert.ok(!app.includes('parseModelClusterContent(item)'), '办结详情仍调用废止的模型簇解析函数，会导致审批模型详情运行时空白')
assert.ok(!app.includes('clusterStage(cluster)'), '办结详情仍依赖废止的模型簇阶段函数')
assert.match(server, /WHEN m\.name='审批模型' THEN 'approval'/, '办结 API 必须按模型名称识别审批模型运行类型')
assert.match(server, /WHEN m\.name='智选模型' THEN 'smart'/, '办结 API 必须按模型名称识别智选模型运行类型')

// 2. 请休假模型发起页必须把当前人员所在部门带入所属部门字段，并仍保留数字化库联动覆盖能力。
assert.match(app, /requesterDepartment/, '模型发起组件必须接收当前人员所属部门')
assert.match(app, /field\.key === "department"/, '模型发起默认值必须处理所属部门字段')
assert.match(app, /sourceMode === "library_fill"/, '所属部门仍必须支持数字化库自动带入')

// 3. 前端不再向用户暴露“标准库/非标准库”分类概念，统一称数字化库。
assert.ok(!/标准库|非标准库/.test(app), 'App 前端仍显示标准库/非标准库概念')
assert.ok(!/标准库|非标准库/.test(designer), '模型设计器仍显示标准库/非标准库概念')
assert.ok(!/标准库|非标准库/.test(workbench), '模型建设工作台仍显示标准库/非标准库概念')


const migrationPath = new URL('../server/migrations/018_unify_digital_library_naming_and_leave_department.sql', import.meta.url)
assert.ok(fs.existsSync(migrationPath), '必须有增量迁移修复既有生产库中的数字化库显示名称和请休假部门联动')
const migration = fs.readFileSync(migrationPath, 'utf8')
assert.match(migration, /人员信息数字化库/, '迁移必须把人员信息库统一为数字化库命名')
assert.match(migration, /leave-department|department/, '迁移必须修复既有请休假模型所属部门联动')
assert.match(migration, /library_fill/, '请休假所属部门必须按数字化库自动带入')

console.log('V17.3.1 regression contract passed')
