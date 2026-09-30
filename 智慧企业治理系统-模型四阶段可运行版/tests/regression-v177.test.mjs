import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const rules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')

for (const label of ['工作台', '快捷入口', '我的事项', '工作概览', '常用服务']) {
  assert.match(app, new RegExp(label), `工作台源码必须包含“${label}”`)
  assert.match(rules, new RegExp(label), `驾驶舱规则必须包含“${label}”`)
}
assert.doesNotMatch(app, /人与系统的交互|系统对人的反馈|系统对个人的约束/, '用户界面不得保留旧概念标题')
assert.match(app, /发起业务/, '工作台主操作必须为发起业务')
assert.match(app, /dashboard-workbench/, '工作台必须使用新的工作台布局容器')
assert.match(css, /V17\.7 工作台布局/, '样式必须标记为 V17.7 工作台布局')
assert.match(rules, /当前有效版本：V17\.7/, '驾驶舱规则版本必须升级到 V17.7')

console.log('V17.7 dashboard workbench regression passed')
