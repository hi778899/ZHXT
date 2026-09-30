import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
const server=readFileSync(new URL('../server/src/index.ts',import.meta.url),'utf8')
const rule=readFileSync(new URL('../.ai/rules/25_MODEL_LIBRARY_UI_RULES.md',import.meta.url),'utf8')

assert.match(app,/\["驾驶舱", "dashboard"\], \["模型库", "query"\]/,'顶部导航必须显示模型库')
assert.match(app,/query: "模型库"/,'工作区标题必须显示模型库')
assert.match(app,/>全部模型 <span>\{models\.length\}<\/span>/,'模型库必须提供全部模型入口')
assert.match(app,/>全部库 <span>\{libraries\.length\}<\/span>/,'模型库必须提供全部库入口')
assert.doesNotMatch(app,/模型分类查看|库分类查看|模型库关联查看/,'不得新增分类/关联一级入口')
assert.match(app,/api\/model-library\/models/,'前端必须直接读取全模型目录')
assert.match(server,/url\.pathname === "\/api\/model-library\/models"/,'后端必须提供模型库全模型目录接口')
assert.match(server,/FROM models m[\s\S]*LEFT JOIN digital_libraries l ON l\.model_id=m\.id/,'全模型目录必须从 models 主表读取并关联数字化库')
assert.doesNotMatch(server,/\/api\/model-library\/models[\s\S]{0,1500}m\.can_start=true/,'模型库全部模型接口不得按可发起模型过滤')
assert.match(rule,/只保留两个一级入口[\s\S]*`全部模型`[\s\S]*`全部库`/)
assert.match(rule,/“全部模型”不得通过当前数字化库列表反向推导/)
assert.match(rule,/不改变底层“一模型一数字化库”架构/)
console.log('V17.7.25 regression checks passed')
