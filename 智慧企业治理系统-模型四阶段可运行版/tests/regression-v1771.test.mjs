import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const rules = fs.readFileSync(new URL('../.ai/rules/18_DASHBOARD_RULES.md', import.meta.url), 'utf8')

for (const phrase of [
  '常用业务功能快速进入，减少多层菜单查找。',
  '统一查看当前待处理、已处理以及已经办结的个人事项。',
  '展示本人当日工作统计，数据来源于真实模型运行、数字化库和办理记录。',
  '进入与本人权限匹配的常用数据和信息服务。',
]) {
  assert.doesNotMatch(app, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `驾驶舱不得显示说明文字：${phrase}`)
}
assert.match(rules, /当前有效版本：V17\.7\.(?:[1-9]|[1-9]\d+)/, '驾驶舱规则版本不得低于 V17.7.1')
assert.match(rules, /只显示区域名称/, '规则必须明确区域标题仅显示名称')
assert.match(rules, /不得再增加.*说明性副标题/s, '规则必须禁止区域说明性副标题')

console.log('V17.7.1 dashboard title-copy regression passed')
