import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')

assert.match(app, /"completed"/, '导航视图必须包含办结')
assert.match(app, />工作台</, '驾驶舱首页必须使用成熟工作台名称')
assert.match(app, /快捷入口/, '工作台必须包含快捷入口')
assert.match(app, /我的事项/, '工作台必须包含我的事项')
assert.match(app, /工作概览/, '工作台必须包含工作概览')
assert.match(app, /常用服务/, '工作台必须包含常用服务')
assert.doesNotMatch(app, /人与系统的交互|系统对人的反馈|系统对个人的约束/, '工作台不得继续使用概念性三级分类标题')
assert.match(app, /模型建设/, '快捷入口必须包含模型建设')
assert.match(app, /业务定义 → 数字化定义 → 模型设计 → 模型发布/, '模型建设入口必须展示当前有效四阶段口径')
assert.match(app, /发起业务/, '工作台必须提供发起业务入口')
assert.match(app, /我的待办/, '我的事项必须提供我的待办')
assert.match(app, /我的已办/, '我的事项必须提供我的已办')
assert.match(app, /我的办结/, '我的事项必须提供我的办结')
assert.match(server, /completed:/, 'dashboard API 必须返回办结模型集合')
assert.match(server, /metrics:/, 'dashboard API 必须返回工作概览统计')
assert.match(server, /digital_library_records/, '工作概览统计必须使用数字化库记录作为数据源')

console.log('dashboard workbench contract passed')
