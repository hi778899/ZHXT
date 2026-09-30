import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

assert.ok(!app.includes('模型簇进度'), '不得恢复独立“模型簇进度”界面')
assert.ok(!app.includes('审批模型进度'), '不得恢复独立“审批模型进度”面板')
assert.match(app, /function HandledTable/, '已办必须使用人的办理记录列表')
assert.match(app, /function CompletedTable/, '办结必须使用模型文件列表')
assert.match(app, /function CompletedDetail/, '办结模型必须有模型自身详情')
assert.match(app, /查看审批模型/, '业务模型办结详情必须可直接查看关联审批模型')
assert.match(app, /查看智选模型/, '业务模型办结详情必须可直接查看关联智选模型')
assert.match(app, /completedRelatedRecord/, '关联模型点击后必须转换为该模型自身运行记录')
assert.ok(!app.includes('cluster-approval-progress-panel'), '不得保留历史审批进度面板')

console.log('completed model direct-view contract passed')
