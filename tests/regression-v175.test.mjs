import fs from 'node:fs'
import assert from 'node:assert/strict'

const digitalRules = fs.readFileSync(new URL('../.ai/rules/04_DIGITALIZATION_RULES.md', import.meta.url), 'utf8')
const codeRules = fs.readFileSync(new URL('../.ai/rules/16_MODEL_DIGITAL_CODE_FILENAME_RULES.md', import.meta.url), 'utf8')
const approvalSmartRules = fs.readFileSync(new URL('../.ai/rules/07_APPROVAL_SMART_SELECT_RULES.md', import.meta.url), 'utf8')
const approvalRules = fs.readFileSync(new URL('../.ai/rules/17_APPROVAL_MODEL_INTERNAL_LOGIC_RULES.md', import.meta.url), 'utf8')
const codes = fs.readFileSync(new URL('../server/src/digital-codes.ts', import.meta.url), 'utf8')
const templates = fs.readFileSync(new URL('../server/src/model-templates.ts', import.meta.url), 'utf8')
const builder = fs.readFileSync(new URL('../server/src/model-builder.ts', import.meta.url), 'utf8')
const runtime0622 = fs.readFileSync(new URL('../server/src/runtime-0622.ts', import.meta.url), 'utf8')
const seed = fs.readFileSync(new URL('../server/src/seed.ts', import.meta.url), 'utf8')
const migration = fs.readFileSync(new URL('../server/migrations/020_digital_structure_0622_and_control_data.sql', import.meta.url), 'utf8')

// 1. 数字化结构必须按0622对象结构，不再把所有编码强制成16位。
assert.match(digitalRules, /单位代码.*501/s)
assert.match(digitalRules, /模型数字化编码.*19位/s)
assert.match(digitalRules, /员工数字化编码.*11位/s)
assert.match(digitalRules, /组织数字化属性.*12位/s)
assert.match(digitalRules, /数字化标识.*19位/s)
assert.match(digitalRules, /历史.*16位.*作废/s)
assert.match(codeRules, /5011001/)
assert.match(codeRules, /5011002/)
assert.ok(!codes.includes('模型数字化编码必须为16位数字'))
assert.match(codes, /isModelDigitalCode/)
assert.match(codes, /isEmployeeDigitalCode/)
assert.match(codes, /isDigitalIdentifier/)

// 2. 0622提供的模型/库/人员案例必须进入迁移基线，且不伪造空白标识关联数据。
for (const text of ['业务分类数字化库','模型数字化配置数字化库','阈值类属数字化库','组织数字化库','组织名称数字化库','业务归属数字化库','审批分管配置数字化库','员工数字化库','员工信息数字化库','模型时限数字化库','标识关联配置数字化库']) {
  assert.ok(migration.includes(text), `缺少数字化库：${text}`)
}
for (const text of ['50110020001','苗士勇','50110020002','高胜军','50110020006','于俊清','50110020012','董事长','50110020014','何宁']) {
  assert.ok(migration.includes(text), `缺少0622案例数据：${text}`)
}
assert.match(migration, /标识关联配置数字化库[^]*源文档未给出关联行/)

// 3. 审批/智选模型代码必须使用0622正式模型数字化编码。
assert.match(templates, /5011001099001001001/)
assert.match(templates, /5011001099001001002/)

// 4. 智选现行规则：统计先启动、审批结果后判断、先特殊后正常、多标识多数据展开。
assert.match(approvalSmartRules, /先启动统计分析模型/)
assert.match(approvalSmartRules, /先特殊.*后正常/s)
assert.match(approvalSmartRules, /多标识.*多数据.*多次触发/s)
assert.match(builder, /待处理数字化标识集合/)
assert.match(builder, /有关联数字化标识集合/)
assert.match(builder, /关联模型启动次数/)
assert.match(builder, /统计分析模型未配置/)

// 5. 审批运算必须读取0622对应数字化库并保存人员/路径/时限计算。
assert.match(approvalRules, /审批分管配置数字化库/)
assert.match(approvalRules, /员工信息数字化库/)
assert.match(approvalRules, /模型时限数字化库/)
assert.match(runtime0622, /lib-standard-approval-assignment/)
assert.match(runtime0622, /lib-standard-person/)
assert.match(runtime0622, /lib-standard-model-timeout/)
assert.match(builder, /审批人计算/)
assert.match(builder, /审批路径计算/)
assert.match(runtime0622, /组织数字化属性仅用于/)

// 6. 案例人员必须创建可登录账号，账号直接采用员工数字化编码，不新增硬编码密码。
assert.match(seed, /CASE_USER_INITIAL_PASSWORD/)
assert.match(seed, /person\.employeeCode,person\.displayName/)
assert.match(seed, /50110020001/)
assert.ok(!seed.includes('CaseUser123'), '不得写死案例人员密码')


// 7. 用户最终确认：5011001006001001001 唯一对应会议收集模型，不再作为环保整改审批模型当前配置。
assert.match(migration, /5011001006001001001[^\n]*会议收集模型/)
assert.ok(!migration.includes('\"模型名称\":\"环保整改审批模型\"'), '当前模型数字化配置不得再注册同码环保整改审批模型')

console.log('V17.5 digital structure, approval and smart-selection contract passed')

// 8. 前端不得继续把当前结构写成16位；V17.7.16后普通审批界面只展示最终审批路径，中间计算仅后台留痕。
const workbench = fs.readFileSync(new URL('../src/ModelBuilderWorkbench.tsx', import.meta.url), 'utf8')
const formDesigner = fs.readFileSync(new URL('../src/ModelFormDesigner.tsx', import.meta.url), 'utf8')
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
assert.ok(!workbench.includes('模型数字化编码（16位）'))
assert.ok(!workbench.includes('模型数字化编码必须为16位数字'))
assert.ok(!formDesigner.includes('请选择16位数字化标识'))
assert.ok(!app.includes('<h4 className="section-title">审批路径计算</h4>'))
assert.ok(!app.includes('<h4 className="section-title">审批人计算</h4>'))
assert.match(app, /最终审批路径/)
assert.match(app, /待处理数字化标识集合/)
assert.match(app, /有关联数字化标识集合/)
assert.match(app, /关联模型启动明细/)
assert.match(runtime0622, /"申请人所在部门"/)
