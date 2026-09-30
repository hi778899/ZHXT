import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')

// 审批模型查看必须使用中文业务字段名称，不把 T/T′/Path 等英文变量作为用户字段。
assert.ok(!app.includes('基础行政审批目标 T'), '审批模型详情不得把 T 作为用户字段名称')
assert.ok(!app.includes('调整后行政审批目标 T′'), '审批模型详情不得把 T′ 作为用户字段名称')
assert.match(app, /基础审批目标层级/, '审批模型详情必须使用中文字段名称展示基础审批目标')
assert.match(app, /最终审批目标层级/, '审批模型详情必须使用中文字段名称展示最终审批目标')

// 审批模型必须保留真实的审批人计算和审批路径计算内容。
assert.match(builder, /审批人计算/, '审批运行结果必须保存审批人计算内容')
assert.match(builder, /审批路径计算/, '审批运行结果必须保存审批路径计算内容')
assert.match(builder, /正式审批路径/, '审批运行结果必须保存正式审批路径')
assert.match(app, /审批人计算/, '审批模型详情必须展示审批人计算内容')
assert.match(app, /审批路径计算/, '审批模型详情必须展示审批路径计算内容')
// V17.6 起：计算依据继续由后台保存，但普通用户界面不再直接展示技术依据字段。
assert.ok(!app.includes('<span>审批人计算依据</span>'), 'V17.6 普通界面不得展示审批人计算依据')
assert.ok(!app.includes('<span>审批路径计算依据</span>'), 'V17.6 普通界面不得展示审批路径计算依据')

// 新建审批模型模板的业务字段名称/内部字段口径使用中文，英文兼容键只允许留在运行引擎内部。
assert.match(templates, /f\("ap-source","前序业务模型","前序业务模型"/, '审批模型模板前序业务模型字段必须使用中文字段名')
assert.match(templates, /routeOutputKey:"正式审批路径"/, '审批模型模板正式路径输出字段必须使用中文名称')
assert.match(templates, /resultOutputKey:"审批结果"/, '审批模型模板审批结果输出字段必须使用中文名称')


// 审批模型在模型定义、历史迁移和查看界面中都不得把英文键作为新的可见/可配置字段。
assert.match(app, /label: "前序业务模型", key: "前序业务模型"/, '内置审批模型字段必须使用中文字段键')
assert.ok(!app.includes('label: "前序业务模型", key: "sourceModelName"'), '审批模型不得继续设置英文业务字段键')
const workbench = fs.readFileSync(new URL('../src/ModelBuilderWorkbench.tsx', import.meta.url), 'utf8')
assert.ok(!workbench.includes('例如：approvalRoute,approvalStatus'), '审批模型输出字段示例不得继续使用英文字段')
const migration = fs.readFileSync(new URL('../server/migrations/019_approval_chinese_fields_and_path_snapshot.sql', import.meta.url), 'utf8')
assert.match(migration, /前序业务模型/, '生产库既有审批模型设计必须迁移到中文字段名')
assert.match(migration, /正式审批路径/, '生产库既有审批模型正式路径字段必须迁移为中文')

// 正式审批路径不能只存抽象环节标题，必须同时保存每个节点的审批人和路径计算明细。
assert.match(builder, /审批路径明细/, '审批路径计算必须保存逐节点明细')
assert.match(builder, /正式审批路径节点/, '审批运行结果必须保存包含审批人的正式路径节点')
assert.ok(!app.includes('<span>正式审批路径节点</span>'), 'V17.6 普通界面不得直接展示正式审批路径节点技术字段')

console.log('V17.4.1 approval Chinese fields and calculation contract passed')
