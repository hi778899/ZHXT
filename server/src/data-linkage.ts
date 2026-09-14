import { randomUUID } from "node:crypto"
import { query } from "./db.js"
import { ModelBuilderError } from "./errors.js"

export type DigitalLibraryColumn = {
  digitalId: string
  displayName: string
  fieldKey?: string
  dataType: string
  required: boolean
  position: number
  sourceRole: "data" | "system" | "result"
}

export type DigitalLibrarySummary = {
  id: string
  name: string
  kind: "standard" | "model"
  isStandard: boolean
  allowAsSource: boolean
  recordCount: number
  columns: DigitalLibraryColumn[]
  fields: string[]
  modelName?: string
  modelCode?: string
  digitalId?: string
  projectStatus?: string
}

export type DigitalLibraryRecord = {
  recordId: string
  modelId: string
  projectId: string
  runId: string
  ownerId: string
  ownerName: string
  ownerCode: string
  libraryId: string
  libraryName: string
  modelName: string
  modelCode: string
  digitalId: string
  fileName: string
  displayFileName: string
  status: string
  createdAt: string
  values: Record<string, unknown>
  data: Record<string, unknown>
}

export type DigitalIdentifierItem = {
  id: string
  code: string
  displayName: string
  dataType: string
  description: string
}

type LookupInput = {
  library?: string
  libraryId?: string
  sourceField?: string
  sourceDigitalId?: string
  matchField?: string
  matchDigitalId?: string
  triggerValue?: unknown
  mode?: "fill" | "options"
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const str = (value: unknown) => value === undefined || value === null ? "" : String(value)

export async function listDigitalIdentifiers(): Promise<DigitalIdentifierItem[]> {
  const result = await query<any>(`SELECT id,code,display_name,data_type,description FROM digital_identifiers WHERE status='active' ORDER BY display_name,code`)
  return result.rows.map((row:any) => ({ id: row.id, code: row.code, displayName: row.display_name, dataType: row.data_type, description: row.description }))
}

async function resolveLibrary(libraryId?: string, libraryName?: string) {
  const id = String(libraryId ?? "").trim()
  const name = String(libraryName ?? "").trim()
  if (!id && !name) throw new ModelBuilderError(400, "缺少数字化库")
  const result = id
    ? await query<any>("SELECT * FROM digital_libraries WHERE id=$1 AND status='active'", [id])
    : await query<any>("SELECT * FROM digital_libraries WHERE name=$1 AND status='active'", [name])
  if (!result.rows[0]) throw new ModelBuilderError(404, "数字化库不存在")
  return result.rows[0]
}

async function libraryColumns(libraryId: string): Promise<DigitalLibraryColumn[]> {
  const result = await query<any>(`
    SELECT di.code,di.display_name,di.data_type,c.required,c.position,c.source_role
    FROM digital_library_columns c
    JOIN digital_identifiers di ON di.id=c.digital_identifier_id
    WHERE c.library_id=$1 AND c.visible=true AND di.status='active'
    ORDER BY c.position,di.code
  `, [libraryId])
  const project = await query<any>(`
    SELECT p.design
    FROM digital_libraries l
    LEFT JOIN model_projects p ON p.model_id=l.model_id
    WHERE l.id=$1
    ORDER BY CASE WHEN p.status='published' THEN 0 ELSE 1 END,p.updated_at DESC
    LIMIT 1
  `, [libraryId])
  const design = isRecord(project.rows[0]?.design) ? project.rows[0].design : {}
  const fields = Array.isArray(design.fields) ? design.fields : []
  const fieldKeyByDigitalId = new Map<string,string>()
  for (const raw of fields) {
    if (!isRecord(raw)) continue
    const digitalId = str(raw.digitalId).trim()
    const key = str(raw.key).trim()
    if (/^\d{16}$/.test(digitalId) && key) fieldKeyByDigitalId.set(digitalId,key)
  }
  const outputMap = isRecord(design.outputDigitalMap) ? design.outputDigitalMap : {}
  for (const [key,digitalIdRaw] of Object.entries(outputMap)) {
    const digitalId = str(digitalIdRaw).trim()
    if (/^\d{16}$/.test(digitalId) && key) fieldKeyByDigitalId.set(digitalId,key)
  }
  return result.rows.map((row:any) => ({
    digitalId: String(row.code), displayName: String(row.display_name), fieldKey: fieldKeyByDigitalId.get(String(row.code)) || undefined, dataType: String(row.data_type), required: Boolean(row.required),
    position: Number(row.position ?? 0), sourceRole: (row.source_role ?? "data") as "data" | "system" | "result",
  }))
}

export async function syncSystemStandardLibraryRecords() {
  // 系统账号、部门和系统元数据作为初始化/系统同步来源进入对应标准数字化库；业务模型仍只从数字化库取值。后续人工维护标准值应运行对应标准模型形成记录。
  const users = await query<any>("SELECT id,username,display_name,department,employee_code,role,status,created_at FROM users ORDER BY created_at")
  for (const row of users.rows) {
    const roleLabels:Record<string,string>={admin:"系统管理员",department_manager:"部门经理",attendance_supervisor:"考勤主管",user:"普通用户"}
    const rankByRole:Record<string,string>={department_manager:"正职/负责人",attendance_supervisor:"业务审核岗"}
    const values = {
      "5013001001002001": row.employee_code,
      "5013001001002002": row.display_name,
      "5013001001002003": row.username,
      "5013001001002004": row.department,
      "5013001001002005": row.role,
      "5013001001002006": row.status === "active" ? "启用" : "停用",
      "5013001001002007": rankByRole[String(row.role ?? "")] ?? "",
      "5013001001002008": [],
      "5013001001002009": roleLabels[String(row.role ?? "")] ?? String(row.role ?? ""),
      "5013001001002010": [],
    }
    const id = `std-person-${row.id}`
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data,created_at)
      VALUES($1,NULL,NULL,NULL,$2,'人员信息标准库','5013001001002001','lib-standard-person',$3,$4,COALESCE($5,now()))
      ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,
      [id,row.id,JSON.stringify(values),JSON.stringify({人员数字化编码:row.employee_code,人员姓名:row.display_name,人员账号:row.username,所属部门:row.department,人员角色:row.role,人员状态:row.status,组织职级:values["5013001001002007"],身份说明:values["5013001001002009"]}),row.created_at])
  }
  const departments = await query<any>(`SELECT d.id,d.name,d.status,d.created_at,p.name AS parent_name FROM departments d LEFT JOIN departments p ON p.id=d.parent_id ORDER BY d.created_at`)
  for (const row of departments.rows) {
    const values = {
      "5013001001003001": row.name,
      "5013001001003002": row.parent_name ?? "",
      "5013001001003003": row.status === "active" ? "启用" : "停用",
    }
    const id = `std-dept-${row.id}`
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data,created_at)
      VALUES($1,NULL,NULL,NULL,NULL,'部门信息标准库','5013001001003001','lib-standard-dept',$2,$3,COALESCE($4,now()))
      ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,
      [id,JSON.stringify(values),JSON.stringify({部门名称:row.name,上级部门:row.parent_name ?? "",部门状态:row.status}),row.created_at])
  }

  const models = await query<any>(`SELECT m.id,m.name,m.category,m.can_start,p.status AS project_status,p.configuration FROM models m LEFT JOIN model_projects p ON p.model_id=m.id ORDER BY m.name`)
  for (const row of models.rows) {
    const config = isRecord(row.configuration) ? row.configuration : {}
    const values = {
      "5013001001005001": row.name,
      "5013001001005002": row.category,
      "5013001001005003": String(config.modelCode ?? ""),
      "5013001001005004": row.project_status === "published" ? "已发布" : row.project_status || (row.can_start ? "可用" : "建设中"),
    }
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data)
      VALUES($1,NULL,NULL,NULL,NULL,'模型信息标准库','5013001001005001','lib-standard-model',$2,$3)
      ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,
      [`std-model-${row.id}`,JSON.stringify(values),JSON.stringify({模型名称:row.name,模型类别:row.category,模型数字化编码:String(config.modelCode ?? ""),模型状态:values["5013001001005004"]})])
  }

  const business = await query<any>(`SELECT id,code,name,parent_id,level_no,description FROM business_definitions WHERE status='active' ORDER BY level_no,code`)
  for (const row of business.rows) {
    const parent = row.parent_id ? business.rows.find((x:any)=>x.id===row.parent_id)?.name ?? "" : ""
    const values={"5013001001006001":row.code,"5013001001006002":row.name,"5013001001006003":parent,"5013001001006004":row.level_no,"5013001001006005":row.description}
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data) VALUES($1,NULL,NULL,NULL,NULL,'业务定义标准库','5013001001006002','lib-standard-business-definition',$2,$3) ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,[`std-biz-${row.id}`,JSON.stringify(values),JSON.stringify({业务编码:row.code,业务名称:row.name,上级业务:parent,业务层级:row.level_no,业务定义:row.description})])
  }
  const definitions = await query<any>(`SELECT id,code,name,definition_type,definition_text FROM digital_definitions WHERE status='active' ORDER BY code`)
  for (const row of definitions.rows) {
    const values={"5013001001007001":row.code,"5013001001007002":row.name,"5013001001007003":row.definition_type,"5013001001007004":row.definition_text}
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data) VALUES($1,NULL,NULL,NULL,NULL,'数字化定义标准库','5013001001007002','lib-standard-digital-definition',$2,$3) ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,[`std-def-${row.id}`,JSON.stringify(values),JSON.stringify({定义编码:row.code,定义名称:row.name,定义类型:row.definition_type,定义内容:row.definition_text})])
  }
  const identifiers = await query<any>(`SELECT id,code,display_name,data_type,description FROM digital_identifiers WHERE status='active' ORDER BY code`)
  for (const row of identifiers.rows) {
    const values={"5013001001008001":row.code,"5013001001008002":row.display_name,"5013001001008003":row.data_type,"5013001001008004":row.description}
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data) VALUES($1,NULL,NULL,NULL,NULL,'数字化标识标准库','5013001001008001','lib-standard-identifier',$2,$3) ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,[`std-did-${row.id}`,JSON.stringify(values),JSON.stringify({数字化标识:row.code,中文名称:row.display_name,数据类型:row.data_type,标识说明:row.description})])
  }
  const libraries = await query<any>(`SELECT id,name,library_type,is_standard,allow_as_source FROM digital_libraries WHERE status='active' ORDER BY name`)
  for (const row of libraries.rows) {
    if (row.id==='lib-standard-library-catalog') continue
    const values={"5013001001009001":row.name,"5013001001009002":row.library_type === 'standard' ? '标准库' : '模型库',"5013001001009003":row.is_standard ? '是' : '否',"5013001001009004":row.allow_as_source ? '是' : '否'}
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data) VALUES($1,NULL,NULL,NULL,NULL,'数字化库目录标准库','5013001001009001','lib-standard-library-catalog',$2,$3) ON CONFLICT(id) DO UPDATE SET identifier_values=EXCLUDED.identifier_values,data=EXCLUDED.data`,[`std-lib-${row.id}`,JSON.stringify(values),JSON.stringify({数字化库名称:row.name,数字化库类型:values["5013001001009002"],标准库功能:values["5013001001009003"],允许作为数据源:values["5013001001009004"]})])
  }
  // 标准库现在都有“数据产生模型”。系统初始化/同步产生的基线记录也挂到该模型，避免数字化库出现无来源记录。
  // run_id 为空表示系统基线/同步；用户后续新增或修改的标准值通过对应模型运行，run_id 会指向真实模型运行实例。
  await query(`UPDATE digital_library_records d SET model_id=l.model_id,project_id=COALESCE(d.project_id,p.id)
    FROM digital_libraries l LEFT JOIN model_projects p ON p.model_id=l.model_id AND p.status='published'
    WHERE d.library_id=l.id AND l.model_id IS NOT NULL AND (d.model_id IS NULL OR d.project_id IS NULL)`)
}

function hasBusinessValue(value: unknown) {
  return value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "")
}

function archiveSource(data: unknown, key: "input" | "output") {
  if (!isRecord(data)) return {} as Record<string,unknown>
  return isRecord(data[key]) ? data[key] as Record<string,unknown> : {}
}

function utcDateOnly(value: unknown) {
  const text = str(value).trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return Number.NaN
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const stamp = Date.UTC(year,month-1,day)
  const check = new Date(stamp)
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? stamp : Number.NaN
}

function legacyNumber(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function derivedCalculation(raw: Record<string,unknown>, values: Record<string,unknown>) {
  const operation = str(raw.operation)
  const sourceKeys = Array.isArray(raw.sourceKeys) ? raw.sourceKeys.map(str) : []
  const sources = sourceKeys.map(key => values[key])
  if (operation === "dateDiffInclusive") {
    const start = utcDateOnly(sources[0]); const end = utcDateOnly(sources[1])
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end-start)/86400000)+1 : undefined
  }
  if (operation === "sum") return sources.reduce<number>((total,value) => total + legacyNumber(value),0)
  if (operation === "difference") return legacyNumber(sources[0]) - legacyNumber(sources[1])
  if (operation === "concat") return sources.map(value => str(value)).join(str(raw.separator ?? ""))
  if (operation === "copy") return sources[0]
  return undefined
}

function recoverDerivedValues(design: Record<string,unknown>, source: Record<string,unknown>) {
  const values: Record<string,unknown> = { ...source }
  const calculations = Array.isArray(design.calculations) ? design.calculations : []
  for (const raw of calculations) {
    if (!isRecord(raw)) continue
    const targetKey = str(raw.targetKey).trim()
    if (!targetKey || hasBusinessValue(values[targetKey])) continue
    const calculated = derivedCalculation(raw,values)
    if (!hasBusinessValue(calculated)) continue
    values[targetKey] = calculated
    const label = str(raw.label).trim()
    if (label && !hasBusinessValue(values[label])) values[label] = calculated
  }
  return values
}

function compactName(value: string) { return value.replace(/[\s：:]/g,"") }
function findByLooseName(source: Record<string,unknown>, label: string) {
  if (!label) return undefined
  if (hasBusinessValue(source[label])) return source[label]
  const compact = compactName(label)
  return Object.entries(source).find(([key,value]) => compactName(key) === compact && hasBusinessValue(value))?.[1]
}

async function repairLegacyLibraryIdentifierValues(userId: string, libraryId: string, viewAll = false) {
  const libraryMeta = await query<any>(`SELECT COALESCE(m.name,'') AS model_name FROM digital_libraries l LEFT JOIN models m ON m.id=l.model_id WHERE l.id=$1`,[libraryId])
  const libraryModelName = str(libraryMeta.rows[0]?.model_name).trim()
  const rows = await query<any>(`
    SELECT d.id,d.project_id,d.run_id,d.identifier_values,d.data,r.project_id AS run_project_id,r.input_data,r.output_data,
           COALESCE(u.display_name,'') AS owner_name,COALESCE(u.department,'') AS owner_department,COALESCE(u.employee_code,'') AS owner_code
    FROM digital_library_records d
    LEFT JOIN model_runs r ON r.id=d.run_id
    LEFT JOIN users u ON u.id=d.owner_id
    WHERE d.library_id=$2 AND ($3::boolean OR d.owner_id=$1 OR d.owner_id IS NULL)
    ORDER BY d.created_at DESC
    LIMIT 1000
  `,[userId,libraryId,viewAll])
  const columnRows = await query<any>(`
    SELECT di.code AS digital_id,di.display_name
    FROM digital_library_columns c JOIN digital_identifiers di ON di.id=c.digital_identifier_id
    WHERE c.library_id=$1 AND c.visible=true AND di.status='active'
    ORDER BY c.position,di.code
  `,[libraryId])
  const libraryColumns = columnRows.rows.map((row:any)=>({digitalId:str(row.digital_id),displayName:str(row.display_name)}))
  const designCache = new Map<string,Record<string,unknown>>()
  for (const row of rows.rows) {
    const projectId = str(row.project_id || row.run_project_id).trim()
    if (!projectId) continue
    let design: Record<string,unknown>
    const cachedDesign = designCache.get(projectId)
    if (cachedDesign) {
      design = cachedDesign
    } else {
      const project = await query<any>("SELECT design FROM model_projects WHERE id=$1",[projectId])
      const loadedDesign: Record<string,unknown> = isRecord(project.rows[0]?.design) ? project.rows[0].design : {}
      designCache.set(projectId,loadedDesign)
      design = loadedDesign
    }
    const data = isRecord(row.data) ? row.data : {}
    const dataInput = archiveSource(data,"input")
    const dataOutput = archiveSource(data,"output")
    const runInput = isRecord(row.input_data) ? row.input_data : {}
    const runOutput = isRecord(row.output_data) ? row.output_data : {}
    const base: Record<string,unknown> = { ...data, ...dataInput, ...runInput, ...dataOutput, ...runOutput }
    // 早期业务记录偶尔没有把自动读取的人员/部门写入 input_data，优先从记录归属人恢复。
    if (!hasBusinessValue(base.applicant) && hasBusinessValue(row.owner_name)) base.applicant = row.owner_name
    if (!hasBusinessValue(base.department) && hasBusinessValue(row.owner_department)) base.department = row.owner_department
    if (!hasBusinessValue(base.employeeCode) && hasBusinessValue(row.owner_code)) base.employeeCode = row.owner_code
    const merged = recoverDerivedValues(design,base)
    // 兼容早期已发布且后来被用户编辑过的请休假模型：旧项目可能没有 calculations/outputDigitalMap 元数据，
    // 但数字化库已经存在固定的“请假天数”结果标识。这里仅作为历史兼容兜底，正式新运行仍以四阶段模型配置为准。
    if (libraryModelName === "请休假模型" && !hasBusinessValue(merged.days)) {
      const start = utcDateOnly(merged.startDate)
      const end = utcDateOnly(merged.endDate)
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        const days = Math.floor((end-start)/86400000)+1
        merged.days = days
        if (!hasBusinessValue(merged["请假天数"])) merged["请假天数"] = days
      }
    }
    const current: Record<string,unknown> = isRecord(row.identifier_values) ? { ...row.identifier_values } : {}
    let changed = false
    const fields = Array.isArray(design.fields) ? design.fields : []
    for (const raw of fields) {
      if (!isRecord(raw) || raw.type === "section") continue
      const digitalId = str(raw.digitalId).trim()
      const key = str(raw.key).trim()
      const label = str(raw.label).trim()
      if (!/^\d{16}$/.test(digitalId) || !key || hasBusinessValue(current[digitalId])) continue
      const candidate = hasBusinessValue(merged[key]) ? merged[key] : findByLooseName(merged,label)
      if (hasBusinessValue(candidate)) { current[digitalId] = candidate; changed = true }
    }
    const outputMap: Record<string,unknown> = isRecord(design.outputDigitalMap) ? { ...design.outputDigitalMap } : {}
    // 早期请休假项目如果缺少结果映射，也要把已存在的标准结果列补回 canonical identifier_values。
    if (libraryModelName === "请休假模型" && !hasBusinessValue(outputMap.days)) outputMap.days = "5013001005001106"
    const outputPatch: Record<string,unknown> = {}
    for (const [key,didRaw] of Object.entries(outputMap)) {
      const digitalId = str(didRaw).trim()
      const candidate = hasBusinessValue(runOutput[key]) ? runOutput[key] : (hasBusinessValue(dataOutput[key]) ? dataOutput[key] : merged[key])
      if (/^\d{16}$/.test(digitalId) && !hasBusinessValue(current[digitalId]) && hasBusinessValue(candidate)) {
        current[digitalId] = candidate; changed = true
      }
      if (!hasBusinessValue(runOutput[key]) && hasBusinessValue(candidate)) outputPatch[key] = candidate
    }
    // 最后一层按数字化库中文列名兜底，兼容旧记录曾经直接以中文字段名存储的情况。
    for (const column of libraryColumns) {
      if (hasBusinessValue(current[column.digitalId])) continue
      const candidate = findByLooseName(merged,column.displayName)
      if (hasBusinessValue(candidate)) { current[column.digitalId] = candidate; changed = true }
    }
    if (changed) await query("UPDATE digital_library_records SET identifier_values=$1 WHERE id=$2",[JSON.stringify(current),row.id])
    // 将可重新计算出的历史输出同步回 model_runs，避免数字化库、审批和后续模型读取到不同版本的数据。
    if (row.run_id && Object.keys(outputPatch).length) {
      await query("UPDATE model_runs SET output_data=COALESCE(output_data,'{}'::jsonb) || $1::jsonb WHERE id=$2",[JSON.stringify(outputPatch),row.run_id])
    }
  }
}

export async function listDataLibraries(userId: string, viewAll = false): Promise<DigitalLibrarySummary[]> {
  await syncSystemStandardLibraryRecords()
  const result = await query<any>(`
    SELECT l.id,l.name,l.library_type,l.is_standard,l.allow_as_source,l.model_id,l.description,
           COALESCE(m.name,'') AS model_name,
           COALESCE(p.configuration->>'modelCode','') AS model_code,
           COALESCE(p.configuration->'digitalIdentities'->>0,'') AS digital_id,
           COALESCE(p.status,'system') AS project_status,
           COALESCE(COUNT(r.id) FILTER (WHERE ($2::boolean OR r.owner_id=$1 OR r.owner_id IS NULL)),0)::int AS record_count
    FROM digital_libraries l
    LEFT JOIN models m ON m.id=l.model_id
    LEFT JOIN model_projects p ON p.model_id=l.model_id
    LEFT JOIN digital_library_records r ON r.library_id=l.id
    WHERE l.status='active'
    GROUP BY l.id,l.name,l.library_type,l.is_standard,l.allow_as_source,l.model_id,l.description,m.name,p.configuration,p.status
    ORDER BY l.is_standard DESC,CASE m.name WHEN '请休假模型' THEN 0 WHEN '审批模型' THEN 1 WHEN '智选模型' THEN 2 ELSE 10 END,l.name
  `, [userId, viewAll])
  const items: DigitalLibrarySummary[] = []
  for (const row of result.rows) {
    const columns = await libraryColumns(row.id)
    items.push({
      id: String(row.id), name: String(row.name), kind: row.library_type === "standard" ? "standard" : "model", isStandard: Boolean(row.is_standard), allowAsSource: Boolean(row.allow_as_source),
      recordCount: Number(row.record_count ?? 0), columns, fields: columns.map(item => item.digitalId), modelName: String(row.model_name || "") || undefined,
      modelCode: String(row.model_code || "") || undefined, digitalId: String(row.digital_id || "") || undefined, projectStatus: String(row.project_status || "") || undefined,
    })
  }
  return items
}

export async function listDataLibraryRecords(userId: string, libraryRef: string, limit = 200, viewAll = false): Promise<DigitalLibraryRecord[]> {
  const library = await resolveLibrary(libraryRef, libraryRef)
  await repairLegacyLibraryIdentifierValues(userId, String(library.id), viewAll)
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200))
  const result = await query<any>(`
    SELECT d.id AS record_id,d.model_id,d.project_id,d.run_id,d.owner_id,d.library_id,d.library_name,d.digital_id,d.identifier_values,d.data,
           to_char(d.created_at,'YYYY-MM-DD HH24:MI:SS') AS created_at,
           COALESCE(m.name,'') AS model_name,COALESCE(p.configuration->>'modelCode','') AS model_code,
           COALESCE(u.display_name,'') AS owner_name,COALESCE(u.employee_code,'') AS owner_code,
           COALESCE(r.file_name,'') AS file_name,COALESCE(r.display_file_name,'') AS display_file_name,COALESCE(r.status,'已入库') AS run_status
    FROM digital_library_records d
    LEFT JOIN models m ON m.id=d.model_id
    LEFT JOIN model_projects p ON p.id=d.project_id
    LEFT JOIN model_runs r ON r.id=d.run_id
    LEFT JOIN users u ON u.id=d.owner_id
    WHERE d.library_id=$2 AND ($4::boolean OR d.owner_id=$1 OR d.owner_id IS NULL)
    ORDER BY d.created_at DESC LIMIT $3
  `, [userId, library.id, safeLimit, viewAll])
  return result.rows.map((row:any) => ({
    recordId: str(row.record_id), modelId: str(row.model_id), projectId: str(row.project_id), runId: str(row.run_id), ownerId: str(row.owner_id), ownerName: str(row.owner_name), ownerCode: str(row.owner_code),
    libraryId: str(row.library_id), libraryName: str(row.library_name), modelName: str(row.model_name), modelCode: str(row.model_code), digitalId: str(row.digital_id), fileName: str(row.file_name), displayFileName: str(row.display_file_name),
    status: str(row.run_status), createdAt: str(row.created_at), values: isRecord(row.identifier_values) ? row.identifier_values : {}, data: isRecord(row.data) ? row.data : {},
  }))
}

function pickValue(row: Record<string, unknown>, digitalId: string) {
  return row[digitalId]
}

export async function lookupDataLibrary(userId: string, input: LookupInput) {
  const library = await resolveLibrary(input.libraryId, input.library)
  await repairLegacyLibraryIdentifierValues(userId, String(library.id), Boolean(library.is_standard))
  if (!library.allow_as_source) throw new ModelBuilderError(409, "该数字化库未开放为模型数据源")
  const sourceDigitalId = String(input.sourceDigitalId ?? input.sourceField ?? "").trim()
  const matchDigitalId = String(input.matchDigitalId ?? input.matchField ?? "").trim()
  if (!/^\d{16}$/.test(sourceDigitalId)) throw new ModelBuilderError(400, "请选择数据源数字化标识")
  if (matchDigitalId && !/^\d{16}$/.test(matchDigitalId)) throw new ModelBuilderError(400, "匹配字段必须是16位数字化标识")
  const column = await query("SELECT 1 FROM digital_library_columns c JOIN digital_identifiers i ON i.id=c.digital_identifier_id WHERE c.library_id=$1 AND i.code=$2", [library.id, sourceDigitalId])
  if (!column.rowCount) throw new ModelBuilderError(400, "所选数字化标识不属于该数字化库")
  const rowsResult = await query<any>(`SELECT identifier_values FROM digital_library_records WHERE library_id=$1 AND ($3::boolean OR owner_id=$2 OR owner_id IS NULL) ORDER BY created_at DESC LIMIT 1000`, [library.id,userId,Boolean(library.is_standard)])
  let rows = rowsResult.rows.map((row:any) => isRecord(row.identifier_values) ? row.identifier_values : {})
  if (matchDigitalId && input.triggerValue !== undefined && input.triggerValue !== null && String(input.triggerValue).trim() !== "") {
    rows = rows.filter(row => str(pickValue(row, matchDigitalId)) === str(input.triggerValue))
  }
  const values = rows.map(row => pickValue(row, sourceDigitalId)).filter(value => value !== undefined && value !== null && String(value).trim() !== "")
  const unique = [...new Map(values.map(value => [typeof value === "object" ? JSON.stringify(value) : String(value), value])).values()]
  if (input.mode === "options") return { options: unique.map(value => String(value)), matched: rows.length, libraryId: library.id, sourceDigitalId }
  return { value: unique[0], values: unique, matched: rows.length, libraryId: library.id, sourceDigitalId }
}

export async function ensureModelDigitalLibrary(projectId: string) {
  const result = await query<any>(`SELECT p.id,p.model_id,p.design,p.configuration,m.name FROM model_projects p JOIN models m ON m.id=p.model_id WHERE p.id=$1`, [projectId])
  const row = result.rows[0]
  if (!row) throw new ModelBuilderError(404, "模型建设项目不存在")
  const config = isRecord(row.configuration) ? row.configuration : {}
  const libraryName = String(config.storageName ?? `${row.name}数字化库`).trim()
  let lib = await query<any>("SELECT id FROM digital_libraries WHERE model_id=$1", [row.model_id])
  let libraryId = lib.rows[0]?.id as string | undefined
  if (!libraryId) {
    libraryId = `lib-model-${row.model_id}`
    await query("INSERT INTO digital_libraries(id,name,model_id,library_type,is_standard,allow_as_source,description) VALUES($1,$2,$3,'model',$4,$5,$6)", [libraryId,libraryName,row.model_id,Boolean(config.isStandardLibrary),config.allowAsSource !== false,`${row.name}模型运行数字化库`])
  } else {
    await query("UPDATE digital_libraries SET name=$1,is_standard=$2,allow_as_source=$3,updated_at=now() WHERE id=$4", [libraryName,Boolean(config.isStandardLibrary),config.allowAsSource !== false,libraryId])
  }
  const design = isRecord(row.design) ? row.design : {}
  const fields = Array.isArray(design.fields) ? design.fields : []
  let pos = 1
  for (const raw of fields) {
    if (!isRecord(raw) || raw.type === "section") continue
    const digitalId = String(raw.digitalId ?? "").trim()
    if (!/^\d{16}$/.test(digitalId)) continue
    const dataType = ["text","textarea","number","date","boolean","user","department","select","radio"].includes(String(raw.type)) ? String(raw.type) : raw.type === "dataSelect" ? "select" : ["checkbox","dataMultiSelect"].includes(String(raw.type)) ? "multiselect" : "json"
    let did = await query<any>("SELECT id FROM digital_identifiers WHERE code=$1", [digitalId])
    let didId = did.rows[0]?.id as string | undefined
    if (!didId) {
      didId = `did-${randomUUID()}`
      await query("INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES($1,$2,$3,$4,$5)", [didId,digitalId,String(raw.label ?? raw.key ?? digitalId),dataType,`${row.name}字段数字化标识`])
    } else {
      await query("UPDATE digital_identifiers SET display_name=$1,data_type=$2,updated_at=now() WHERE id=$3", [String(raw.label ?? raw.key ?? digitalId),dataType,didId])
    }
    await query(`INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position,required=EXCLUDED.required,source_role=EXCLUDED.source_role`,
      [`col-${row.model_id}-${digitalId}`,libraryId,didId,pos++,Boolean(raw.required),Boolean(raw.readonly) ? "result" : "data"])
  }
  // 四阶段中配置的计算/表达式输出即使不是表单字段，也必须作为数字化库结果列存在。
  const outputMap = isRecord(design.outputDigitalMap) ? design.outputDigitalMap : {}
  const calculations: Record<string, unknown>[] = Array.isArray(design.calculations)
    ? design.calculations.filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    : []
  const expressions: Record<string, unknown>[] = Array.isArray(design.expressions)
    ? design.expressions.filter((item: unknown): item is Record<string, unknown> => isRecord(item))
    : []
  for (const [key,didRaw] of Object.entries(outputMap)) {
    const digitalId = str(didRaw).trim()
    if (!/^\d{16}$/.test(digitalId)) continue
    const calc = calculations.find(item => str(item.targetKey) === key)
    const expr = expressions.find(item => str(item.targetKey) === key)
    const displayName = str(calc?.label || expr?.label || key).trim() || key
    const operation = str(calc?.operation)
    const dataType = ["dateDiffInclusive","sum","difference"].includes(operation) ? "number" : "text"
    let did = await query<any>("SELECT id FROM digital_identifiers WHERE code=$1", [digitalId])
    let didId = did.rows[0]?.id as string | undefined
    if (!didId) {
      didId = `did-${randomUUID()}`
      await query("INSERT INTO digital_identifiers(id,code,display_name,data_type,description) VALUES($1,$2,$3,$4,$5)", [didId,digitalId,displayName,dataType,`${row.name}结果数字化标识`])
    } else {
      await query("UPDATE digital_identifiers SET display_name=CASE WHEN display_name=code OR display_name='' THEN $1 ELSE display_name END,data_type=$2,updated_at=now() WHERE id=$3", [displayName,dataType,didId])
    }
    await query(`INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role) VALUES($1,$2,$3,$4,false,'result')
      ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET source_role='result'`,
      [`col-${row.model_id}-${digitalId}`,libraryId,didId,pos++])
  }
  return libraryId
}

export async function buildIdentifierValues(projectId: string, input: Record<string, unknown>, output: Record<string, unknown>) {
  const result = await query<any>("SELECT design FROM model_projects WHERE id=$1", [projectId])
  const design = isRecord(result.rows[0]?.design) ? result.rows[0].design : {}
  const fields = Array.isArray(design.fields) ? design.fields : []
  const values: Record<string, unknown> = {}
  // 这里再按设计重算一次计算字段，保证用户在四阶段里配置了 outputDigitalMap 后，即使忘记把目标加入 outputKeys，也能正确入库。
  const merged = recoverDerivedValues(design,{ ...input, ...output })
  for (const raw of fields) {
    if (!isRecord(raw) || raw.type === "section") continue
    const digitalId = String(raw.digitalId ?? "").trim()
    const key = String(raw.key ?? "").trim()
    const label = String(raw.label ?? "").trim()
    if (!/^\d{16}$/.test(digitalId) || !key) continue
    const candidate = hasBusinessValue(merged[key]) ? merged[key] : findByLooseName(merged,label)
    if (hasBusinessValue(candidate)) values[digitalId] = candidate
  }
  // 计算/表达式结果可以没有直接表单字段，但只要配置了 outputDigitalMap 就必须进入数字化库。
  const map = isRecord(design.outputDigitalMap) ? design.outputDigitalMap : {}
  for (const [key,did] of Object.entries(map)) {
    const digitalId = String(did).trim()
    if (/^\d{16}$/.test(digitalId) && hasBusinessValue(merged[key])) values[digitalId] = merged[key]
  }
  return values
}
