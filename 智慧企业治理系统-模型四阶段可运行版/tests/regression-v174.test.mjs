import fs from 'node:fs'
import assert from 'node:assert/strict'

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const server = fs.readFileSync(new URL('../server/src/index.ts', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')

// 1. 已办/办结均保留业务模型阶段，并能直接打开真正的审批模型运行记录。
assert.match(server, /business_model_activity_v2/, '已办 API 必须返回业务模型活动记录用于模型簇追溯')
assert.match(server, /申请阶段/, '服务端必须计算申请阶段')
assert.match(server, /有效阶段/, '服务端必须计算有效阶段')
assert.match(server, /审批终止\/未生效/, '审批不通过必须显示未生效而不是有效阶段')
assert.match(app, /当前阶段/, '已办或办结列表必须显示当前阶段')
assert.match(app, /查看审批模型/, '业务模型必须可直接打开审批模型本身')
assert.match(app, /查看智选模型/, '业务模型必须可直接打开智选模型本身')
assert.match(app, /function HandledDetail\(\{ item, onOpenModel \}/, '已办业务模型详情必须保留关联模型直接打开能力')
assert.ok(!app.includes('模型簇进度'), '不得恢复独立模型簇进度页面')

// 2. 审批模型必须承载任意业务模型，业务内容由来源模型设计+数字化库数据动态解析。
assert.match(builder, /sourceBusinessContext/, '审批模型必须读取来源业务模型上下文')
assert.match(builder, /approvalBusinessContent/, '审批模型必须形成动态业务内容快照')
assert.ok(!builder.includes('title.includes("考勤主管") || title.includes("业务审批")'), '通用业务审批不得默认映射到请假考勤角色')
assert.match(builder, /businessFields/, '审批模型必须传递来源模型字段定义')
assert.match(builder, /sourceProjectId/, '审批模型设计快照必须读取来源业务模型，而不是审批模型自身')
assert.match(app, /businessFields/, '审批前端必须按来源模型字段元数据展示业务内容')

// 3. 路径、节点内容、规定时限必须是数字化属性/标识运算结果；计算依据后台保留，V17.6.1 起普通界面进一步隐藏审批/审查要求。
assert.match(builder, /approvalComputationEvidence/, '审批模型必须保存路径和时限计算依据')
assert.match(builder, /organizationPath/, '审批模型必须形成组织逐级路径')
assert.match(builder, /parentDepartment/, '进入上级组织必须按部门/组织关系重新计算')
assert.match(builder, /timeoutHours/, '每个审批节点必须携带规定时限')
assert.match(builder, /requirement/, '每个审批节点必须携带本环节审批/审查要求')
assert.match(builder, /reminderRule/, '每个审批节点必须携带提醒规则')
assert.match(builder, /approvalNodeEvidence/, '待办必须携带本环节路径/时限计算依据')
assert.ok(!app.includes('<span>本环节审批/审查要求</span>'), 'V17.6.1 普通用户界面不得展示本环节审批/审查要求')
assert.ok(!app.includes('<span>审批路径计算依据</span>'), 'V17.6 普通界面不再直接展示路径计算依据')
assert.ok(!app.includes('<span>审批人计算依据</span>'), 'V17.6 普通界面不再直接展示审批人计算依据')

console.log('V17.4 regression contract passed')
