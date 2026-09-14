import { randomUUID } from "node:crypto"
import { closePool, query } from "./db.js"
import { hashPassword } from "./security.js"
import { getTemplateCatalog, getTemplatePreset, type TemplatePreset } from "./model-templates.js"

const initialPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!"

async function ensurePublishedProject(modelName: string, userId: string, template: TemplatePreset) {
  const model = await query<{ id: string }>("SELECT id FROM models WHERE name=$1", [modelName])
  if (!model.rows[0]?.id) return
  const project = await query<{ id: string; version: number }>("SELECT id,version FROM model_projects WHERE model_id=$1", [model.rows[0].id])
  const totalTests = template.testData.cases.length
  const report = { passed: true, executedAt: new Date().toISOString(), total: totalTests, passedCount: totalTests, results: [] }
  if (!project.rowCount) {
    await query(
      "INSERT INTO model_projects(id,model_id,owner_id,stage,status,suggestion,design,test_data,test_report,configuration,test_passed,published_at) VALUES($1,$2,$3,'config','published',$4,$5,$6,$7,$8,true,now())",
      [randomUUID(), model.rows[0].id, userId, JSON.stringify(template.suggestion), JSON.stringify(template.design), JSON.stringify(template.testData), JSON.stringify(report), JSON.stringify(template.configuration)],
    )
  } else if (project.rows[0].version === 1) {
    // 仅刷新系统首次生成、尚未被用户编辑的基准模板；一旦四阶段被编辑，version 会递增，不再覆盖。
    await query("UPDATE model_projects SET stage='config',status='published',suggestion=$1,design=$2,test_data=$3,test_report=$4,configuration=$5,test_passed=true,published_at=COALESCE(published_at,now()),updated_at=now() WHERE id=$6", [JSON.stringify(template.suggestion), JSON.stringify(template.design), JSON.stringify(template.testData), JSON.stringify(report), JSON.stringify(template.configuration), project.rows[0].id])
  }
  await query("UPDATE models SET can_start=true WHERE id=$1", [model.rows[0].id])
}

async function ensureDraftProject(modelName: string, userId: string, template: TemplatePreset) {
  const model = await query<{ id: string }>("SELECT id FROM models WHERE name=$1", [modelName])
  if (!model.rows[0]?.id) return
  const project = await query("SELECT 1 FROM model_projects WHERE model_id=$1", [model.rows[0].id])
  if (project.rowCount) return
  await query("INSERT INTO model_projects(id,model_id,owner_id,stage,status,suggestion,design,test_data,configuration,test_passed) VALUES($1,$2,$3,'suggestion','draft',$4,$5,$6,$7,false)", [randomUUID(), model.rows[0].id, userId, JSON.stringify(template.suggestion), JSON.stringify(template.design), JSON.stringify(template.testData), JSON.stringify(template.configuration)])
  await query("UPDATE models SET can_start=false WHERE id=$1", [model.rows[0].id])
}


async function ensureRoleAccount(options: { username: string; displayName: string; department: string; password: string; employeeCode: string; role: "department_manager" | "attendance_supervisor" }) {
  await query("INSERT INTO departments(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING", [randomUUID(), options.department])
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE lower(username)=lower($1)", [options.username])
  if (!existing.rows[0]?.id) {
    const id = randomUUID()
    await query("INSERT INTO users(id,username,display_name,department,department_id,employee_code,password_hash,role,status) VALUES($1,$2,$3,$4,(SELECT id FROM departments WHERE name=$4),$5,$6,$7,'active')", [id, options.username, options.displayName, options.department, options.employeeCode, await hashPassword(options.password), options.role])
    console.log(`Created ${options.role} account ${options.username}`)
    return id
  }
  // 已存在的人员账号保留管理员后续维护的姓名、部门和密码，仅确保角色与启用状态正确。
  await query("UPDATE users SET role=$1,employee_code=COALESCE(NULLIF(employee_code,''),$2),status='active',updated_at=now() WHERE id=$3", [options.role, options.employeeCode, existing.rows[0].id])
  return existing.rows[0].id
}

async function seed() {
  const user = await query<{ id: string }>("SELECT id FROM users WHERE username = $1", [process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan"])
  let userId = user.rows[0]?.id
  if (!userId) {
    userId = randomUUID()
    await query("INSERT INTO users(id, username, display_name, department, employee_code, password_hash, role) VALUES($1,$2,$3,$4,$5,$6,$7)", [userId, process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan", process.env.INITIAL_ADMIN_NAME ?? "张珊", process.env.INITIAL_ADMIN_DEPARTMENT ?? "设备管理部", "5011002000000001", await hashPassword(initialPassword), "admin"])
    console.log(`Created initial user ${process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan"}`)
  }

  const defaultDepartment = process.env.DEPARTMENT_MANAGER_DEPARTMENT ?? process.env.INITIAL_ADMIN_DEPARTMENT ?? "设备管理部"
  await ensureRoleAccount({
    username: process.env.DEPARTMENT_MANAGER_USERNAME ?? "deptmanager",
    displayName: process.env.DEPARTMENT_MANAGER_NAME ?? "部门经理",
    department: defaultDepartment,
    password: process.env.DEPARTMENT_MANAGER_PASSWORD ?? "ChangeDeptManager123!",
    employeeCode: "5011002000000002",
    role: "department_manager",
  })
  await ensureRoleAccount({
    username: process.env.ATTENDANCE_SUPERVISOR_USERNAME ?? "attendance",
    displayName: process.env.ATTENDANCE_SUPERVISOR_NAME ?? "考勤主管",
    department: process.env.ATTENDANCE_SUPERVISOR_DEPARTMENT ?? "综合管理部",
    password: process.env.ATTENDANCE_SUPERVISOR_PASSWORD ?? "ChangeAttendance123!",
    employeeCode: "5011002000000003",
    role: "attendance_supervisor",
  })

  const models = [
    ["请休假模型", "考勤管理", "采集请休假申请、计算业务结果并归档；归档后按模型关系触发独立审批模型"],
    ["会议议题提报", "会议管理", "根据会议类型匹配议题模板并生成提报结果"],
    ["会议收集", "会议管理", "读取议题名称、会议类型和审议事项形成收集结果"],
    ["会议议题编组", "会议管理", "按会议类型和议题数量形成待上会议题编组"],
    ["会议议题审定", "会议管理", "对编组中的议题逐项进行一对一审定并输出结果"],
    ["会议组织", "会议管理", "汇总审定通过议题并选择会议时间、会议室和参会人员"],
    ["会议通知", "会议管理", "根据会议组织数据形成会议通知内容和通知范围"],
    ["参会反馈", "会议管理", "读取会议通知并收集是否参会反馈"],
    ["会议", "会议管理", "展示会议整体信息并逐项展示审议事项"],
    ["会议纪要", "会议管理", "根据标准内容、议案结果和会议记录逐项生成会议纪要"],
    ["审批模型", "审批管理", "独立承接前序模型归档数据，按审批标准和组织关系形成审批过程与审批结论"],
    ["智选模型", "智能关联", "读取已确认业务/审批数据与数字化标识，按关联规则选择并触发后续模型"],
    ["模型建议模型", "模型建设", "独立形成目标模型的功能目标、边界、适用范围与启动约束"],
    ["模型设计模型", "模型建设", "独立形成目标模型的表单、数据源、数字化标识、运算与运行结构"],
    ["模型测试模型", "模型建设", "独立验证目标模型输入、数据源、运算、输出与存储映射"],
    ["模型配置模型", "模型建设", "独立配置目标模型数字化库、启动方式、模型关系并形成发布结果"],
    ["业务定义模型", "数字化管理", "建立业务领域、业务层级、业务颗粒和业务边界定义"],
    ["数字化定义模型", "数字化管理", "建立数字化编码、数字化属性、数字化标识和数字化库的系统定义"],
    ["模型数字化编码模型", "数字化管理", "为模型分配16位模型数字化编码"],
    ["人员数字化编码模型", "数字化管理", "为人员分配16位人员数字化编码"],
    ["数字化属性配置模型", "数字化管理", "在模型、人员等数字化编码对象下配置数字化属性"],
    ["数字化标识建设模型", "数字化管理", "建立16位数字化标识、中文显示名称、数据类型和业务归属"],
    ["数字化库配置模型", "数字化管理", "将数字化标识组合成数字化库并配置标准库能力"],
  ]
  for (const [name, category, description] of models) {
    await query("INSERT INTO models(id,name,category,description) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category,description=EXCLUDED.description", [randomUUID(), name, category, description])
  }

  await query("UPDATE models SET can_start=false WHERE name='请休假审批模型'")

  const leave = getTemplatePreset("leave")!
  const approval = getTemplatePreset("approval")!
  const smart = getTemplatePreset("smart")!
  await ensurePublishedProject("智选模型", userId, smart)
  await ensurePublishedProject("审批模型", userId, approval)
  await ensurePublishedProject("请休假模型", userId, leave)

  // 四个建设阶段、数字化建设、基础标准库和审批/智选配置均通过独立模型运行。它们和普通业务模型一样归档后进入通用审批→智选。
  for (const item of getTemplateCatalog().filter(item => ["模型建设","数字化建设","基础标准库","审批智选配置"].includes(item.group))) {
    const template = getTemplatePreset(item.key)
    if (template) await ensurePublishedProject(item.name, userId, template)
  }

  // 会议模型簇不是“写死流程”。这里仅建立可编辑的四阶段建设项目，默认保持草稿，用户可逐阶段校核、测试后发布。
  for (const item of getTemplateCatalog().filter(item => item.group === "会议模型簇")) {
    const template = getTemplatePreset(item.key)
    if (template) await ensureDraftProject(item.name, userId, template)
  }

  const notices = [["关于驾驶舱要素调整的通知", "通知", "2026-09-01"], ["模型建设阶段说明更新", "说明", "2026-08-30"], ["数字化库使用指引发布", "指引", "2026-08-28"], ["系统维护安排", "通知", "2026-08-24"], ["公共信息阅读提醒", "提醒", "2026-08-22"], ["驾驶舱功能优化公告", "公告", "2026-08-20"], ["本月模型运行情况汇总", "汇总", "2026-08-18"]]
  for (const [title, type, publishedAt] of notices) await query("INSERT INTO notices(id,title,type,published_at,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT (lower(trim(title)), lower(trim(type)), published_at) DO NOTHING", [randomUUID(), title, type, publishedAt, `${title}正文内容。请各部门结合实际使用情况及时反馈问题，持续优化驾驶舱的操作体验。`])

  const todoCount = await query<{ count: string }>("SELECT count(*)::text AS count FROM todos WHERE owner_id=$1", [userId])
  if (todoCount.rows[0]?.count === "0") {
    const todos = [["模型建设标准更新待确认", "模型建设", "设备管理部", "待确认"], ["运行记录补充填报", "设备运转统计", "船机管理组", "待处理"], ["驾驶舱要素配置审核", "配置审批", "数字化工作组", "处理中"]]
    for (const [title, model, sender, status] of todos) await query("INSERT INTO todos(id,title,model,sender,owner_id,status,content) VALUES($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), title, model, sender, userId, status, "请核对本事项相关内容及附件，根据实际情况填写办理意见。"])
  }

}

seed().then(closePool).catch(error => { console.error(error); process.exitCode = 1 })
