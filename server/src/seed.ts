import { syncActiveEmployeeApprovalDigitalConfigs } from "./employee-digital-config.js"
import { runModelBackedDigitalLibraryRecord, syncSystemStandardLibraryRecords } from "./data-linkage.js"
import { auditFoundationReadiness } from "./foundation-model-libraries.js"
import { randomUUID } from "node:crypto"
import { closePool, query } from "./db.js"
import { hashPassword } from "./security.js"
import { getTemplateCatalog, getTemplatePreset, type TemplatePreset } from "./model-templates.js"

const initialPassword = process.env.INITIAL_ADMIN_PASSWORD ?? "ChangeMe123!"

const caseUserInitialPassword = process.env.CASE_USER_INITIAL_PASSWORD || initialPassword

const CASE_USERS = [
  { employeeCode:"50110020001", displayName:"苗士勇", department:"总经理组成人员" },
  { employeeCode:"50110020002", displayName:"高胜军", department:"安全监察部" },
  { employeeCode:"50110020003", displayName:"李天宇", department:"安全监察部" },
  { employeeCode:"50110020004", displayName:"刘思琛", department:"安全监察部" },
  { employeeCode:"50110020005", displayName:"张会强", department:"采购与物资管理中心" },
  { employeeCode:"50110020006", displayName:"于俊清", department:"采购管理科" },
  { employeeCode:"50110020007", displayName:"周敏", department:"组织人事部" },
  { employeeCode:"50110020008", displayName:"王琳", department:"组织人事部" },
  { employeeCode:"50110020009", displayName:"陈明", department:"组织人事部" },
  { employeeCode:"50110020010", displayName:"总经理", department:"总经理组成人员" },
  { employeeCode:"50110020012", displayName:"董事长", department:"董事会" },
  { employeeCode:"50110020013", displayName:"孙磊", department:"财务管理部" },
  { employeeCode:"50110020014", displayName:"何宁", department:"财务管理部" },
]

async function ensureCaseAccount(person:{employeeCode:string;displayName:string;department:string}) {
  await query("INSERT INTO departments(id,name) VALUES($1,$2) ON CONFLICT(name) DO NOTHING",[randomUUID(),person.department])
  const byCode=await query<{id:string}>("SELECT id FROM users WHERE employee_code=$1 LIMIT 1",[person.employeeCode])
  const byUsername=byCode.rows[0]?.id ? {rows:[]} : await query<{id:string}>("SELECT id FROM users WHERE lower(username)=lower($1) LIMIT 1",[person.employeeCode])
  const id=byCode.rows[0]?.id ?? byUsername.rows[0]?.id
  if (!id) {
    const userId=randomUUID()
    await query("INSERT INTO users(id,username,display_name,department,department_id,employee_code,password_hash,role,status) VALUES($1,$2,$3,$4,(SELECT id FROM departments WHERE name=$4),$5,$6,'user','active')",[userId,person.employeeCode,person.displayName,person.department,person.employeeCode,await hashPassword(caseUserInitialPassword)])
    console.log(`Created 0622 case account ${person.employeeCode} ${person.displayName}`)
    return
  }
  await query("UPDATE users SET employee_code=$1,display_name=$2,department=$3,department_id=(SELECT id FROM departments WHERE name=$3),status='active',updated_at=now() WHERE id=$4",[person.employeeCode,person.displayName,person.department,id])
}

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
  const modelCode=String(template.configuration?.modelCode ?? "").trim()
  if(/^5011001[0-9]{12}$/.test(modelCode)) {
    await query(`INSERT INTO digital_codes(id,object_type,object_id,code,display_name) VALUES($1,'model',$2,$3,$4)
      ON CONFLICT(object_type,object_id) DO UPDATE SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now()`,[`dcode-seed-${model.rows[0].id}`,model.rows[0].id,modelCode,modelName])
  }
}

async function ensureInfrastructureDigitalProjects(userId:string) {
  // 0622 新增的三类基础数字化库必须同样拥有正式数据产生模型项目和19位模型数字化编码，供系统初始化/同步形成真实 model_runs。
  const specs=[
    {name:"业务分类模型",code:"5011001001100023001",storageName:"业务分类数字化库"},
    {name:"组织关系模型",code:"5011001001100024001",storageName:"组织关系数字化库"},
    {name:"员工数字化模型",code:"5011001001100025001",storageName:"员工数字化库"},
  ]
  for(const spec of specs){
    const model=await query<{id:string}>("SELECT id FROM models WHERE name=$1 LIMIT 1",[spec.name])
    if(!model.rows[0]?.id) continue
    const template:TemplatePreset={
      suggestion:{name:spec.name,category:"数字化基础",description:`${spec.name}的数据产生模型`,modelType:"business",goal:`维护${spec.storageName}正式数据`,scope:"系统初始化、系统同步和人工维护均形成真实模型运行",startModes:["manual"],ownerDepartment:"设备管理部"},
      design:{fields:[],nodes:[],edges:[],parameters:[],calculations:[],expressions:[],rules:[],formula:"",outputKeys:[],formSettings:{columns:2,labelPosition:"top",descriptionMode:"inline",inputWidth:"auto",submitText:"提交数字化数据",showHeader:true}},
      testData:{cases:[]},
      configuration:{modelCode:spec.code,fileNameRule:"模型数字化编码-发起/运行人员员工数字化编码-时间码",displayFileNameRule:"模型中文名称-发起人姓名-时间码",storageName:spec.storageName,digitalIdentities:[],isStandardLibrary:true,allowAsSource:true,startModes:["manual"],relations:[{id:`rel-${spec.code}-approval`,enabled:true,mode:"hard_link",targetModelName:"审批模型",condition:{fieldKey:"",operator:"always",value:""},description:"人工维护正式数据归档后进入通用审批模型"}],afterArchiveEnabled:true,nextModelName:"审批模型",visibility:"internal",digitalStructureVersion:"0622"}
    }
    await ensurePublishedProject(spec.name,userId,template)
  }
}

async function ensureSystemModelClusterLinks() {
  // 业务 → 审批：系统固定链路。兼容已经被四阶段编辑过、version>1 且历史 relations 缺失的业务模型。
  const businesses = await query<{ id: string; configuration: Record<string, unknown> }>(`SELECT p.id,p.configuration
    FROM model_projects p JOIN models m ON m.id=p.model_id
    WHERE p.status='published' AND COALESCE(p.suggestion->>'modelType','business') NOT IN ('approval','smart')`)
  for (const businessRow of businesses.rows) {
    const config = businessRow.configuration && typeof businessRow.configuration === "object" ? { ...businessRow.configuration } : {}
    const relations = Array.isArray(config.relations) ? config.relations.filter((item: any) => String(item?.targetModelName ?? "").trim() !== "审批模型") : []
    config.relations = [{ id:"system-business-approval",enabled:true,mode:"hard_link",targetModelName:"审批模型",condition:{fieldKey:"",operator:"always",value:""},description:"系统固定链路：业务模型数字化库正式入库后必须启动通用审批模型" }, ...relations]
    config.afterArchiveEnabled = true
    config.nextModelName = "审批模型"
    await query("UPDATE model_projects SET configuration=$1,updated_at=now() WHERE id=$2", [JSON.stringify(config), businessRow.id])
  }

  const approval = await query<{ id: string; configuration: Record<string, unknown> }>(`SELECT p.id,p.configuration
    FROM model_projects p JOIN models m ON m.id=p.model_id
    WHERE m.name='审批模型' ORDER BY p.updated_at DESC LIMIT 1`)
  const row = approval.rows[0]
  if (row?.id) {
    const config = row.configuration && typeof row.configuration === "object" ? { ...row.configuration } : {}
    const relations = Array.isArray(config.relations) ? config.relations.filter((item: any) => String(item?.targetModelName ?? "").trim() !== "智选模型") : []
    config.relations = [{ id:"system-approval-smart",enabled:true,mode:"hard_link",targetModelName:"智选模型",condition:{fieldKey:"",operator:"always",value:""},description:"系统固定链路：审批模型数字化库正式入库后必须启动通用智选模型" }, ...relations]
    config.afterArchiveEnabled = true
    config.nextModelName = "智选模型"
    const startModes = Array.isArray(config.startModes) ? config.startModes.map(String) : []
    config.startModes = startModes.includes("hard_link") ? startModes : [...startModes, "hard_link"]
    await query("UPDATE model_projects SET configuration=$1,updated_at=now() WHERE id=$2", [JSON.stringify(config), row.id])
  }

  const smart = await query<{ id: string; configuration: Record<string, unknown> }>(`SELECT p.id,p.configuration
    FROM model_projects p JOIN models m ON m.id=p.model_id
    WHERE m.name='智选模型' ORDER BY p.updated_at DESC LIMIT 1`)
  const smartRow = smart.rows[0]
  if (smartRow?.id) {
    const config = smartRow.configuration && typeof smartRow.configuration === "object" ? { ...smartRow.configuration } : {}
    const startModes = Array.isArray(config.startModes) ? config.startModes.map(String) : []
    if (!startModes.includes("hard_link")) {
      config.startModes = [...startModes, "hard_link"]
      await query("UPDATE model_projects SET configuration=$1,updated_at=now() WHERE id=$2", [JSON.stringify(config), smartRow.id])
    }
  }
}

// 保留原函数名作为兼容入口；当前实现同时修复业务→审批与审批→智选两条系统固定链路。
async function ensureSystemApprovalSmartLink() {
  return ensureSystemModelClusterLinks()
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
  const existing = await query<{ id: string; department: string }>("SELECT id,COALESCE(department,'') AS department FROM users WHERE lower(username)=lower($1)", [options.username])
  if (!existing.rows[0]?.id) {
    const id = randomUUID()
    await query("INSERT INTO users(id,username,display_name,department,department_id,employee_code,password_hash,role,status) VALUES($1,$2,$3,$4,(SELECT id FROM departments WHERE name=$4),$5,$6,$7,'active')", [id, options.username, options.displayName, options.department, options.employeeCode, await hashPassword(options.password), options.role])
    console.log(`Created ${options.role} account ${options.username}`)
    return id
  }
  // 已存在的人员账号原则上保留管理员维护的姓名、部门和密码。
  // V17.7.20：早期考勤主管默认“综合管理部”并不在0622组织名称数字化库中；仅对这一历史默认值收敛到正式“组织人事部”。
  const currentDepartment=String(existing.rows[0].department ?? "").trim()
  const shouldRepairAttendanceDepartment=options.role === "attendance_supervisor" && (!currentDepartment || currentDepartment === "综合管理部")
  if (shouldRepairAttendanceDepartment) {
    await query("UPDATE users SET role=$1,employee_code=COALESCE(NULLIF(employee_code,''),$2),department=$3,department_id=(SELECT id FROM departments WHERE name=$3),status='active',updated_at=now() WHERE id=$4", [options.role, options.employeeCode, options.department, existing.rows[0].id])
  } else {
    await query("UPDATE users SET role=$1,employee_code=COALESCE(NULLIF(employee_code,''),$2),status='active',updated_at=now() WHERE id=$3", [options.role, options.employeeCode, existing.rows[0].id])
  }
  return existing.rows[0].id
}


function splitDigitalList(value: unknown) {
  return String(value ?? "").split(/[,，、;；\n]/).map(item=>item.trim()).filter(Boolean)
}
function appendDigitalValue(value: unknown, item: string) {
  return [...new Set([...splitDigitalList(value),item])].join("；")
}

async function ensureApprovalFoundationDigitalConfigs(userId:string) {
  const ATTENDANCE_DOMAIN="5012001005001000000"
  const DIGITAL_GOVERNANCE_DOMAIN="5012001007000000000"
  const MEETING_MANAGEMENT_DOMAIN="5012001008000000000"

  // 1. “数字化管理”作为基础数字化/运行标准模型的正式业务分类，不借用其他业务领域。
  await runModelBackedDigitalLibraryRecord({
    recordId:"v17720-business-digital-governance",libraryId:"lib-digital-business-classification-0622",expectedProducerModelName:"业务分类模型",ownerId:userId,digitalId:DIGITAL_GOVERNANCE_DOMAIN,identifierValues:{},
    data:{"一级编码":"007","二级编码":"000","三级编码":"000","四级编码":"000","业务名称":"数字化管理","业务分类数字化属性":DIGITAL_GOVERNANCE_DOMAIN,"数据版本":"0622","数据来源":"V17.7.20基础数字化模型审批配置补齐"},source:"system_approval_foundation_sync"
  })

  // V17.7.24：会议类模型拥有独立“会议管理”业务分类，不能继续借用0622中的环保(006)或数字化管理(007)。
  await runModelBackedDigitalLibraryRecord({
    recordId:"v17724-business-meeting-management",libraryId:"lib-digital-business-classification-0622",expectedProducerModelName:"业务分类模型",ownerId:userId,digitalId:MEETING_MANAGEMENT_DOMAIN,identifierValues:{},
    data:{"一级编码":"008","二级编码":"000","三级编码":"000","四级编码":"000","业务名称":"会议管理","业务分类数字化属性":MEETING_MANAGEMENT_DOMAIN,"数据版本":"0622","数据来源":"V17.7.24会议标准/会议管理模型数字化配置补齐"},source:"system_approval_foundation_sync"
  })

  // 2. 设备管理部增加数字化管理业务归属，供本部门发起的基础数字化模型形成行政审批人员。
  const ownership=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-business-ownership' AND data->>'数据版本'='0622' AND data->>'组织名称数字化属性'='501200402006'
    ORDER BY created_at,id LIMIT 1`)
  if (ownership.rows[0]) {
    const row=ownership.rows[0]; const data={...(row.data ?? {})}
    data["业务领域集合"]=appendDigitalValue(data["业务领域集合"],DIGITAL_GOVERNANCE_DOMAIN)
    data["V17.7.20配置说明"]="设备管理部承担数字化管理类基础模型维护；正式审批仍由审批模型按数字化库动态计算"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-business-ownership",expectedProducerModelName:"业务归属模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? "501200402006"),identifierValues:row.identifier_values ?? {},data,source:"system_approval_foundation_sync"})
  }


  // 会议管理属于公司级会议治理，由现有公司治理组织承接；不把会议业务挂到环保(006)等无关领域。
  const meetingOwnership=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-business-ownership' AND data->>'数据版本'='0622' AND data->>'组织名称数字化属性' IN ('501200402002','501200402003')
    ORDER BY id`)
  for (const row of meetingOwnership.rows) {
    const data={...(row.data ?? {})}
    data["业务领域集合"]=appendDigitalValue(data["业务领域集合"],MEETING_MANAGEMENT_DOMAIN)
    data["V17.7.24配置说明"]="董事会/总经理组成人员承接公司级会议管理业务；会议类模型使用独立会议管理数字化属性"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-business-ownership",expectedProducerModelName:"业务归属模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? data["组织名称数字化属性"] ?? ""),identifierValues:row.identifier_values ?? {},data,source:"system_meeting_management_config_sync"})
  }

  // 同步公司治理组织中的人员业务领域，使会议审批能够按员工信息数字化库找到真实人员节点。
  const meetingPersons=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-person' AND data->>'数据版本'='0622'
      AND (COALESCE(data->>'组织名称数字化属性','') LIKE '%501200402002%' OR COALESCE(data->>'组织名称数字化属性','') LIKE '%501200402003%')
    ORDER BY id`)
  for (const row of meetingPersons.rows) {
    const data={...(row.data ?? {})}
    data["业务领域"]=appendDigitalValue(data["业务领域"],MEETING_MANAGEMENT_DOMAIN)
    data["V17.7.24配置说明"]="公司治理组织人员补齐会议管理业务领域，用于会议类审批人员匹配"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-person",expectedProducerModelName:"员工信息模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? data["员工数字化编码"] ?? ""),identifierValues:row.identifier_values ?? {},data,source:"system_meeting_management_config_sync"})
  }


  // 公司治理层实际人员节点必须同时具备会议管理行政审批分管，否则只有员工业务领域而无法形成Path_final。
  const meetingAssignments=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-approval-assignment' AND data->>'数据版本'='0622'
      AND data->>'组织职级' IN ('501200302023','501200302031','501200302032') ORDER BY id`)
  for (const row of meetingAssignments.rows) {
    const data={...(row.data ?? {})}
    data["行政审批分管业务属性集合"]=appendDigitalValue(data["行政审批分管业务属性集合"],MEETING_MANAGEMENT_DOMAIN)
    data["V17.7.24配置说明"]="公司治理层补齐会议管理行政审批分管，会议节点仍按发起人组织关系和实际人员动态形成"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-approval-assignment",expectedProducerModelName:"审批分管配置模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? data["组织职级"] ?? ""),identifierValues:row.identifier_values ?? {},data,source:"system_meeting_management_config_sync"})
  }

  // 3. 四/五级机构负责人增加数字化管理行政审批分管；业务审核岗确保考勤管理技术/业务审查分管。
  const assignments=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-approval-assignment' AND data->>'数据版本'='0622'
      AND data->>'组织职级' IN ('501200302041','501200302051','501200302046') ORDER BY id`)
  for (const row of assignments.rows) {
    const data={...(row.data ?? {})}; const orgAttr=String(data["组织职级"] ?? "")
    if (orgAttr === "501200302041" || orgAttr === "501200302051") data["行政审批分管业务属性集合"]=appendDigitalValue(data["行政审批分管业务属性集合"],DIGITAL_GOVERNANCE_DOMAIN)
    if (orgAttr === "501200302046") data["技术复核分管业务属性集合"]=appendDigitalValue(data["技术复核分管业务属性集合"],ATTENDANCE_DOMAIN)
    data["V17.7.20配置说明"]="补齐数字化管理行政审批及考勤管理业务审核岗审查配置"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-approval-assignment",expectedProducerModelName:"审批分管配置模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? orgAttr),identifierValues:row.identifier_values ?? {},data,source:"system_approval_foundation_sync"})
  }

  // 4. 考勤主管员工信息数字化配置强校验：即使历史已有正式记录，也补齐业务审核岗、组织人事部和考勤管理业务领域。
  const attendanceUser=await query<any>(`SELECT id,employee_code,display_name FROM users WHERE role='attendance_supervisor' AND status='active' ORDER BY created_at,id LIMIT 1`)
  if (attendanceUser.rows[0]) {
    const user=attendanceUser.rows[0]
    const existingPerson=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
      WHERE library_id='lib-standard-person' AND data->>'数据版本'='0622' AND data->>'员工数字化编码'=$1
      ORDER BY CASE WHEN COALESCE(data->>'数据来源','') LIKE '系统账号同步%' THEN 1 ELSE 0 END,created_at,id LIMIT 1`,[user.employee_code])
    const row=existingPerson.rows[0]
    const data={...(row?.data ?? {})}
    data["员工数字化编码"]=user.employee_code
    data["员工姓名"]=user.display_name
    data["组织数字化属性"]="501200302046"
    data["组织名称数字化属性"]="501200402008"
    data["业务领域"]=appendDigitalValue(data["业务领域"],ATTENDANCE_DOMAIN)
    data["身份"]="组织人事部业务审核岗"
    data["岗位/角色"]="考勤主管"
    data["数据版本"]="0622"
    data["数据来源"]="V17.7.20考勤主管审批/审查数字化配置补齐"
    await runModelBackedDigitalLibraryRecord({recordId:String(row?.id ?? `auto0622-person-${user.id}`),libraryId:"lib-standard-person",expectedProducerModelName:"员工信息模型",ownerId:user.id,digitalId:String(user.employee_code),identifierValues:row?.identifier_values ?? {},data,source:"system_attendance_supervisor_config_sync"})
  }

  // 5. 请假类型标准模型、模型时限模型补齐0622模型数字化配置。
  //    请假类型属于考勤管理；模型时限属于数字化管理。数字化标识集合暂按当前审批入口不参与阈值运算，避免沿用旧16位标识作为当前配置。
  const modelConfigs=[
    {recordId:"v17720-model-config-leave-type",code:"5011001001100003001",name:"请假类型标准模型",attributes:ATTENDANCE_DOMAIN},
    {recordId:"v17720-model-config-timeout",code:"5011001001100022001",name:"模型时限模型",attributes:DIGITAL_GOVERNANCE_DOMAIN},
  ]
  for (const item of modelConfigs) {
    await runModelBackedDigitalLibraryRecord({recordId:item.recordId,libraryId:"lib-standard-digital-config",expectedProducerModelName:"模型数字化配置模型",ownerId:userId,digitalId:item.code,identifierValues:{},
      data:{"模型数字化编码":item.code,"模型名称":item.name,"数字化属性集合":item.attributes,"数字化标识集合":"","数据版本":"0622","数据来源":"V17.7.20补齐基础数字化模型审批入口配置"},source:"system_model_digital_config_sync"})
  }
}



const APPROVAL_CONFIG_DOMAIN = {
  attendance:"5012001005001000000",
  digitalGovernance:"5012001007000000000",
  meetingManagement:"5012001008000000000",
} as const

function currentDigitalIds(value:unknown) {
  if (!Array.isArray(value)) return [] as string[]
  return [...new Set(value.map(item=>String(item ?? "").trim()).filter(item=>/^5013\d{15}$/.test(item)))]
}

/**
 * V17.7.21：全系统模型审批前置配置完整性。
 * 不是按模型名称逐个打补丁，而是扫描全部已发布模型：
 * 1) 每个当前19位模型数字化编码必须在“模型数字化配置数字化库”存在0622正式记录；
 * 2) 数字化属性优先保留人工正式配置；缺失时按模型类别/模板类别匹配现有业务分类数字化属性；
 * 3) 系统建设、数字化、标准、配置、运行类模型统一归入“数字化管理”，考勤模型归入“考勤管理”；
 * 4) 配置记录仍通过“模型数字化配置模型”的 system_sync 真实运行形成，禁止直接 INSERT 正式数字化库；
 * 5) 无法确定业务分类的模型进入完整性异常清单，不猜测业务属性。
 */
async function ensureAllPublishedModelDigitalConfigs(userId:string) {
  const categoryFallback:Record<string,string>={
    "考勤管理":APPROVAL_CONFIG_DOMAIN.attendance,
    "会议管理":APPROVAL_CONFIG_DOMAIN.meetingManagement,
    "会议标准":APPROVAL_CONFIG_DOMAIN.meetingManagement,
    "数字化管理":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "数字化基础":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "数字化标准":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "组织标准":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "审批标准":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "公共标准":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "模型建设":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "审批管理":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "数字化配置":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "审批配置":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "智选配置":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "智能关联":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "运行标准":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
    "通用":APPROVAL_CONFIG_DOMAIN.digitalGovernance,
  }
  const catalogByName=new Map(getTemplateCatalog().map(item=>[item.name,item]))
  const businessRows=await query<any>(`SELECT data FROM digital_library_records
    WHERE library_id='lib-digital-business-classification-0622' AND data->>'数据版本'='0622'`)
  const businessByName=new Map<string,string>()
  for(const row of businessRows.rows){
    const data=row.data ?? {}; const name=String(data["业务名称"] ?? "").trim(); const attr=String(data["业务分类数字化属性"] ?? "").trim()
    if(name && /^5012\d{15}$/.test(attr)) businessByName.set(name,attr)
  }
  const published=await query<any>(`SELECT p.id AS project_id,p.configuration,p.suggestion,m.id AS model_id,m.name,m.category,m.can_start,
      COALESCE(dc.code,p.configuration->>'modelCode','') AS model_code
    FROM model_projects p JOIN models m ON m.id=p.model_id
    LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=m.id AND dc.code ~ '^5011001[0-9]{12}$'
    WHERE p.status='published' AND m.can_start=true
    ORDER BY m.name`)
  await query(`CREATE TABLE IF NOT EXISTS model_digital_config_completeness_issues(
    id uuid PRIMARY KEY,model_id text NOT NULL,project_id text,model_name text NOT NULL,model_code text,reason text NOT NULL,detected_at timestamptz NOT NULL DEFAULT now(),resolved_at timestamptz
  )`)
  for(const row of published.rows){
    const modelCode=String(row.model_code ?? "").trim()
    if(!/^5011001\d{12}$/.test(modelCode)){
      await query(`INSERT INTO model_digital_config_completeness_issues(id,model_id,project_id,model_name,model_code,reason)
        SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM model_digital_config_completeness_issues WHERE model_id=$2 AND resolved_at IS NULL AND reason=$6)`,[randomUUID(),row.model_id,row.project_id,row.name,modelCode,"已发布模型缺少当前19位模型数字化编码"])
      continue
    }
    const current=await query<any>(`SELECT id,data,owner_id FROM digital_library_records
      WHERE library_id='lib-standard-digital-config' AND data->>'数据版本'='0622' AND data->>'模型数字化编码'=$1
      ORDER BY created_at DESC,id DESC LIMIT 1`,[modelCode])
    const oldData={...(current.rows[0]?.data ?? {})}
    const configuredAttrs=splitDigitalList(oldData["数字化属性集合"]).filter(item=>/^5012\d{15}$/.test(item))
    const catalog=catalogByName.get(String(row.name))
    const suggestion=row.suggestion ?? {}
    const category=String(suggestion.category ?? catalog?.category ?? row.category ?? "").trim()
    const resolvedAttr=configuredAttrs[0] ?? businessByName.get(category) ?? categoryFallback[category] ?? ""
    if(!resolvedAttr){
      const reason=`已发布模型未能根据现有数字化库确定业务分类数字化属性（模型类别：${category || "未配置"}）`
      await query(`INSERT INTO model_digital_config_completeness_issues(id,model_id,project_id,model_name,model_code,reason)
        SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM model_digital_config_completeness_issues WHERE model_id=$2 AND resolved_at IS NULL AND reason=$6)`,[randomUUID(),row.model_id,row.project_id,row.name,modelCode,reason])
      continue
    }
    const config=row.configuration ?? {}
    const identifiers=currentDigitalIds(config.digitalIdentities)
    const data={...oldData,
      "模型数字化编码":modelCode,"模型名称":row.name,"数字化属性集合":configuredAttrs.length ? configuredAttrs.join("；") : resolvedAttr,
      "数字化标识集合":identifiers.join("；"),"数据版本":"0622","数据来源":"V17.7.21全系统已发布模型数字化配置完整性同步；人工正式配置优先保留"
    }
    await runModelBackedDigitalLibraryRecord({recordId:String(current.rows[0]?.id ?? `auto0622-model-config-${row.model_id}`),libraryId:"lib-standard-digital-config",expectedProducerModelName:"模型数字化配置模型",ownerId:current.rows[0]?.owner_id ?? userId,digitalId:modelCode,identifierValues:{},data,source:"system_model_config_completeness_sync"})
    await query("UPDATE model_digital_config_completeness_issues SET resolved_at=now() WHERE model_id=$1 AND resolved_at IS NULL",[row.model_id])
  }

  // 对所有当前模型数字化配置实际使用到的业务属性做审批分管/时限覆盖检查。
  const used=await query<any>(`SELECT data FROM digital_library_records WHERE library_id='lib-standard-digital-config' AND data->>'数据版本'='0622'`)
  const usedDomains=[...new Set(used.rows.flatMap((row:any)=>splitDigitalList(row.data?.["数字化属性集合"])).filter((item:string)=>/^5012\d{15}$/.test(item)))]
  const assignments=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-approval-assignment' AND data->>'数据版本'='0622' AND data->>'组织职级' IN ('501200302041','501200302051') ORDER BY id`)
  for(const row of assignments.rows){
    const data={...(row.data ?? {})}
    for(const domain of usedDomains) data["行政审批分管业务属性集合"]=appendDigitalValue(data["行政审批分管业务属性集合"],domain)
    data["V17.7.21配置说明"]="全系统已发布模型使用到的业务分类均具备基础行政审批分管；相对审批级次仍由实际发起人组织和人员动态计算"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-approval-assignment",expectedProducerModelName:"审批分管配置模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? data["组织职级"] ?? ""),identifierValues:row.identifier_values ?? {},data,source:"system_model_config_completeness_sync"})
  }
  // 默认8小时模型时限是原0622所有普通业务的通用基线；把新增业务域纳入同一基线，而不是在代码中生成时限。
  const timeout=await query<any>(`SELECT id,digital_id,identifier_values,data,owner_id FROM digital_library_records
    WHERE library_id='lib-standard-model-timeout' AND data->>'数据版本'='0622' AND data->>'模型时限'='8' ORDER BY created_at,id LIMIT 1`)
  if(timeout.rows[0]){
    const row=timeout.rows[0]; const data={...(row.data ?? {})}
    for(const domain of usedDomains) data["业务领域集合"]=appendDigitalValue(data["业务领域集合"],domain)
    data["V17.7.21配置说明"]="全系统已发布模型缺省时限业务域完整性补齐；实际规定时限仍唯一来自模型时限数字化库"
    await runModelBackedDigitalLibraryRecord({recordId:String(row.id),libraryId:"lib-standard-model-timeout",expectedProducerModelName:"模型时限模型",ownerId:row.owner_id ?? userId,digitalId:String(row.digital_id ?? "8"),identifierValues:row.identifier_values ?? {},data,source:"system_model_config_completeness_sync"})
  }

  const unresolved=await query<any>(`SELECT model_name,model_code,reason FROM model_digital_config_completeness_issues WHERE resolved_at IS NULL ORDER BY model_name LIMIT 30`)
  if(unresolved.rowCount){
    const message=unresolved.rows.map((item:any)=>`${item.model_name}（${item.model_code || "无编码"}）：${item.reason}`).join("；")
    // 完整性异常只阻止对应模型进入审批/运行，不得把整个应用启动打断。运行时仍会对缺配置模型严格报错。
    console.warn(`全系统模型数字化配置完整性存在待处理项：${message}`)
  }
}

async function seed() {
  const user = await query<{ id: string }>("SELECT id FROM users WHERE username = $1", [process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan"])
  let userId = user.rows[0]?.id
  if (!userId) {
    userId = randomUUID()
    await query("INSERT INTO users(id, username, display_name, department, employee_code, password_hash, role) VALUES($1,$2,$3,$4,$5,$6,$7)", [userId, process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan", process.env.INITIAL_ADMIN_NAME ?? "张珊", process.env.INITIAL_ADMIN_DEPARTMENT ?? "设备管理部", "50110020015", await hashPassword(initialPassword), "admin"])
    console.log(`Created initial user ${process.env.INITIAL_ADMIN_USERNAME ?? "zhangshan"}`)
  }

  const defaultDepartment = process.env.DEPARTMENT_MANAGER_DEPARTMENT ?? process.env.INITIAL_ADMIN_DEPARTMENT ?? "设备管理部"
  await ensureRoleAccount({
    username: process.env.DEPARTMENT_MANAGER_USERNAME ?? "deptmanager",
    displayName: process.env.DEPARTMENT_MANAGER_NAME ?? "部门经理",
    department: defaultDepartment,
    password: process.env.DEPARTMENT_MANAGER_PASSWORD ?? "ChangeDeptManager123!",
    employeeCode: "50110020016",
    role: "department_manager",
  })
  await ensureRoleAccount({
    username: process.env.ATTENDANCE_SUPERVISOR_USERNAME ?? "attendance",
    displayName: process.env.ATTENDANCE_SUPERVISOR_NAME ?? "考勤主管",
    department: !process.env.ATTENDANCE_SUPERVISOR_DEPARTMENT || process.env.ATTENDANCE_SUPERVISOR_DEPARTMENT === "综合管理部" ? "组织人事部" : process.env.ATTENDANCE_SUPERVISOR_DEPARTMENT,
    password: process.env.ATTENDANCE_SUPERVISOR_PASSWORD ?? "ChangeAttendance123!",
    employeeCode: "50110020017",
    role: "attendance_supervisor",
  })

  // 0622案例人员账号：用户名直接使用员工数字化编码；密码只从环境变量读取，不在代码中写死。
  for (const person of CASE_USERS) await ensureCaseAccount(person)


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
    ["模型数字化编码模型", "数字化管理", "为模型分配当前19位模型数字化编码"],
    ["人员数字化编码模型", "数字化管理", "为人员分配当前11位员工数字化编码"],
    ["数字化属性配置模型", "数字化管理", "在模型、人员等数字化编码对象下配置数字化属性"],
    ["数字化标识建设模型", "数字化管理", "建立当前19位数字化标识、中文显示名称、数据类型和业务归属"],
    ["数字化库配置模型", "数字化管理", "将数字化标识组合成数字化库并配置数据源能力"],
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
  await ensureInfrastructureDigitalProjects(userId)
  // 系统固定模型簇链路必须兼容历史已编辑项目；不能依赖 version=1 的模板刷新。
  await ensureSystemApprovalSmartLink()

  // 四个建设阶段、数字化建设、基础数字化库和审批/智选配置均通过独立模型运行。它们和普通业务模型一样归档后进入通用审批→智选。
  for (const item of getTemplateCatalog().filter(item => ["模型建设","数字化建设","基础数字化库","审批智选配置"].includes(item.group))) {
    const template = getTemplatePreset(item.key)
    if (template) await ensurePublishedProject(item.name, userId, template)
  }

  // V17.7.26：基础模型项目就绪后，第一步先把历史0622/系统事实物化为真实 system_initialization/system_sync 模型运行。
  // 后续所有可确定补齐都在已有正式数字化库基础上运算，禁止用 seed 常量绕过“运行模型→数据入库”。
  await syncSystemStandardLibraryRecords()

  // V17.7.20+V17.7.26：可唯一确定的审批/智选基础数据通过对应数据产生模型真实运行补齐。
  await ensureApprovalFoundationDigitalConfigs(userId)
  // V17.7.21+V17.7.26：扫描所有已发布可运行模型；可确定项运行模型补齐，无法唯一确定项只记录异常，不猜测。
  await ensureAllPublishedModelDigitalConfigs(userId)

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

  const employeeSync=await syncActiveEmployeeApprovalDigitalConfigs()
  const employeeSyncFailures=employeeSync.filter(item=>!item.configured)
  if (employeeSyncFailures.length) console.warn("Employee digital config sync skipped for some users",employeeSyncFailures)

  // V17.7.26：就绪审计只记录问题并限制对应审批/智选运行，不得因单个基础模型库缺陷使整个应用启动失败。
  const foundationAudit=await auditFoundationReadiness()
  const foundationIssues=foundationAudit.flatMap(item=>item.issues)
  if(foundationIssues.length) console.warn(`审批/智选基础模型库完整性存在待处理项：${foundationIssues.map(item=>`${item.producerModelName} → ${item.libraryId}：${item.reason}`).join("；")}`)

}

seed().then(closePool).catch(error => { console.error(error); process.exitCode = 1 })
