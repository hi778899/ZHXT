import { randomUUID } from "node:crypto"
import { query } from "./db.js"
import { ModelBuilderError } from "./errors.js"
import { buildDisplayFileName, buildRuntimeFileName, isCurrentEmployeeDigitalCode, isCurrentModelDigitalCode, isDigitalIdentifier, timeCode } from "./digital-codes.js"

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
    if (isDigitalIdentifier(digitalId) && key) fieldKeyByDigitalId.set(digitalId,key)
  }
  const outputMap = isRecord(design.outputDigitalMap) ? design.outputDigitalMap : {}
  for (const [key,digitalIdRaw] of Object.entries(outputMap)) {
    const digitalId = str(digitalIdRaw).trim()
    if (isDigitalIdentifier(digitalId) && key) fieldKeyByDigitalId.set(digitalId,key)
  }
  return result.rows.map((row:any) => ({
    digitalId: String(row.code), displayName: String(row.display_name), fieldKey: fieldKeyByDigitalId.get(String(row.code)) || undefined, dataType: String(row.data_type), required: Boolean(row.required),
    position: Number(row.position ?? 0), sourceRole: (row.source_role ?? "data") as "data" | "system" | "result",
  }))
}


type SystemDigitalLibraryRecordInput = {
  recordId: string
  libraryId: string
  ownerId?: string | null
  digitalId: string
  identifierValues?: Record<string, unknown>
  data: Record<string, unknown>
  createdAt?: string | Date | null
  source?: string
}

type ProducerRuntime = {
  libraryId: string
  libraryName: string
  modelId: string
  modelName: string
  projectId: string
  modelCode: string
}

type RuntimeActor = { id: string; employeeCode: string; displayName: string }

async function resolveRuntimeActor(preferredOwnerId?: string | null): Promise<RuntimeActor> {
  if (preferredOwnerId) {
    const preferred = await query<any>("SELECT id,employee_code,display_name FROM users WHERE id=$1", [preferredOwnerId])
    const row = preferred.rows[0]
    if (row && isCurrentEmployeeDigitalCode(row.employee_code)) return { id:String(row.id), employeeCode:String(row.employee_code), displayName:String(row.display_name ?? "") }
  }
  const fallback = await query<any>(`SELECT id,employee_code,display_name FROM users
    WHERE status='active' AND employee_code ~ '^5011002[0-9]{4}$'
    ORDER BY CASE WHEN role='admin' THEN 0 ELSE 1 END,created_at,id LIMIT 1`)
  const row = fallback.rows[0]
  if (!row) throw new ModelBuilderError(409,"系统初始化/同步模型运行缺少当前11位员工数字化编码的运行人员")
  return { id:String(row.id), employeeCode:String(row.employee_code), displayName:String(row.display_name ?? "系统运行人员") }
}

async function resolveProducerRuntime(libraryId: string): Promise<ProducerRuntime> {
  const result = await query<any>(`SELECT l.id AS library_id,l.name AS library_name,l.model_id,m.name AS model_name,
      p.id AS project_id,COALESCE(dc.code,p.configuration->>'modelCode','') AS model_code
    FROM digital_libraries l
    LEFT JOIN models m ON m.id=l.model_id
    LEFT JOIN LATERAL (
      SELECT mp.id,mp.configuration FROM model_projects mp WHERE mp.model_id=l.model_id
      ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=l.model_id AND dc.code ~ '^5011001[0-9]{12}$'
    WHERE l.id=$1 AND l.status='active'`,[libraryId])
  const row=result.rows[0]
  if(!row?.model_id) throw new ModelBuilderError(409,`数字化库“${libraryId}”未配置数据产生模型`)
  const modelCode=String(row.model_code ?? "").trim()
  if(!isCurrentModelDigitalCode(modelCode)) throw new ModelBuilderError(409,`数字化库“${row.library_name ?? libraryId}”的数据产生模型未配置当前19位模型数字化编码`)
  return { libraryId:String(row.library_id), libraryName:String(row.library_name), modelId:String(row.model_id), modelName:String(row.model_name ?? "数字化模型"), projectId:String(row.project_id ?? ""), modelCode }
}

async function allocateSystemRunNames(producer: ProducerRuntime, actor: RuntimeActor, at: Date) {
  const base=timeCode(at)
  const candidates=[base,`${base}${String(at.getMilliseconds()).padStart(3,"0")}`,...Array.from({length:999},(_,i)=>`${base}${String(at.getMilliseconds()).padStart(3,"0")}${String(i+1).padStart(3,"0")}`)]
  for(const stamp of candidates){
    const fileName=buildRuntimeFileName(producer.modelCode,actor.employeeCode,stamp)
    const exists=await query<{exists:boolean}>("SELECT EXISTS(SELECT 1 FROM model_runs WHERE file_name=$1) AS exists",[fileName])
    if(!exists.rows[0]?.exists) return {fileName,displayFileName:buildDisplayFileName(producer.modelName,actor.displayName,stamp)}
  }
  throw new ModelBuilderError(409,`数字化库“${producer.libraryName}”系统运行文件名冲突次数超过允许范围`)
}

/**
 * V17.7.14 方案A：系统初始化/系统同步也必须先形成对应数据产生模型的真实运行，再写入数字化库。
 * 禁止 seed/sync 直接制造 run_id=NULL 的正式数字化库记录。
 */
export async function upsertSystemDigitalLibraryRecord(input: SystemDigitalLibraryRecordInput) {
  const identifierValues=isRecord(input.identifierValues) ? input.identifierValues : {}
  const existing=await query<any>(`SELECT id,run_id,owner_id,created_at,identifier_values,data,file_name,display_file_name,legacy_record_id
    FROM digital_library_records WHERE id=$1 LIMIT 1`,[input.recordId])
  const previous=existing.rows[0]
  if(previous?.run_id){
    const same=await query<{same:boolean}>(`SELECT ($1::jsonb=$2::jsonb AND $3::jsonb=$4::jsonb) AS same`,[
      JSON.stringify(previous.identifier_values ?? {}),JSON.stringify(identifierValues),JSON.stringify(previous.data ?? {}),JSON.stringify(input.data ?? {})])
    const run=await query<any>("SELECT file_name,display_file_name,trigger_mode FROM model_runs WHERE id=$1 LIMIT 1",[previous.run_id])
    if(same.rows[0]?.same && run.rows[0]?.file_name){
      if(String(previous.file_name ?? "")!==String(run.rows[0].file_name) || String(previous.display_file_name ?? "")!==String(run.rows[0].display_file_name ?? "")) await query(`UPDATE digital_library_records SET file_name=$1,display_file_name=$2,record_origin=CASE WHEN $3 IN ('system_initialization','system_sync') THEN $3 ELSE 'model_run' END WHERE id=$4`,[String(run.rows[0].file_name),String(run.rows[0].display_file_name ?? ""),String(run.rows[0].trigger_mode ?? ""),input.recordId])
      return {recordId:input.recordId,runId:String(previous.run_id),fileName:String(run.rows[0].file_name),changed:false}
    }
  }

  const producer=await resolveProducerRuntime(input.libraryId)
  const actor=await resolveRuntimeActor(input.ownerId ?? previous?.owner_id ?? null)
  const useHistoricalTime=Boolean(previous && !previous.run_id)
  const runAt=useHistoricalTime ? new Date(previous.created_at) : input.createdAt ? new Date(input.createdAt) : new Date()
  const safeRunAt=Number.isFinite(runAt.getTime()) ? runAt : new Date()
  const names=await allocateSystemRunNames(producer,actor,safeRunAt)
  const runId=randomUUID()
  const triggerMode=useHistoricalTime ? "system_initialization" : "system_sync"
  const runInput={systemManaged:true,systemSource:input.source ?? triggerMode,legacyRecordId:input.recordId,libraryId:producer.libraryId}
  const runOutput={identifierValues,data:input.data,libraryId:producer.libraryId,libraryName:producer.libraryName}
  await query(`INSERT INTO model_runs(id,model_id,project_id,owner_id,file_name,display_file_name,digital_id,input_data,output_data,status,created_at,completed_at,trigger_mode,source_run_id)
    VALUES($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,'已归档',$10,$10,$11,NULL)`,[
      runId,producer.modelId,producer.projectId,actor.id,names.fileName,names.displayFileName,input.digitalId,JSON.stringify(runInput),JSON.stringify(runOutput),safeRunAt,triggerMode])

  if(previous){
    await query(`UPDATE digital_library_records SET model_id=$1,project_id=NULLIF($2,''),run_id=$3,owner_id=$4,library_name=$5,digital_id=$6,library_id=$7,
      identifier_values=$8,data=$9,file_name=$10,display_file_name=$11,legacy_record_id=COALESCE(legacy_record_id,id),record_origin=$12,created_at=$13 WHERE id=$14`,[
      producer.modelId,producer.projectId,runId,actor.id,producer.libraryName,input.digitalId,producer.libraryId,JSON.stringify(identifierValues),JSON.stringify(input.data),names.fileName,names.displayFileName,triggerMode,safeRunAt,input.recordId])
  }else{
    await query(`INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data,file_name,display_file_name,legacy_record_id,record_origin,created_at)
      VALUES($1,$2,NULLIF($3,''),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,[
      input.recordId,producer.modelId,producer.projectId,runId,actor.id,producer.libraryName,input.digitalId,producer.libraryId,JSON.stringify(identifierValues),JSON.stringify(input.data),names.fileName,names.displayFileName,input.recordId,triggerMode,safeRunAt])
  }
  return {recordId:input.recordId,runId,fileName:names.fileName,changed:true}
}

export async function materializeLegacyDigitalLibraryRuns() {
  // migration 026 建立此数据库函数；seed 在所有数据产生模型发布完成后再次执行，以覆盖新库首次安装时迁移阶段尚无项目/编码的情况。
  try { await query("SELECT v17714_materialize_digital_library_runs()") } catch (error) {
    const message=error instanceof Error ? error.message : String(error)
    if(!message.includes("v17714_materialize_digital_library_runs")) throw error
  }
}

async function ensureCanonicalDigitalLibraryFileNames() {
  await materializeLegacyDigitalLibraryRuns()
  await query(`UPDATE digital_library_records d SET file_name=r.file_name,display_file_name=r.display_file_name,model_id=r.model_id,project_id=COALESCE(d.project_id,r.project_id),owner_id=COALESCE(d.owner_id,r.owner_id)
    FROM model_runs r WHERE d.run_id=r.id AND r.file_name ~ '^5011001[0-9]{12}-5011002[0-9]{4}-[0-9]{14}([0-9]{3})?([0-9]{3})?$'
      AND (COALESCE(d.file_name,'') IS DISTINCT FROM COALESCE(r.file_name,'') OR COALESCE(d.display_file_name,'') IS DISTINCT FROM COALESCE(r.display_file_name,''))`)
}

export async function syncSystemStandardLibraryRecords() {
  // 所有数据产生模型已发布后先把历史原始 data 按原 created_at 物化为 system_initialization；随后再比较当前系统源，只有发生变化才形成 system_sync。
  await materializeLegacyDigitalLibraryRuns()
  await ensureCanonicalDigitalLibraryFileNames()
  // 所有系统源数据也通过其“数据产生模型”的系统运行归档；不得再直接插入 run_id=NULL 的正式数字化库记录。
  const users = await query<any>("SELECT id,username,display_name,department,employee_code,role,status,created_at FROM users ORDER BY created_at")
  for (const row of users.rows) {
    const roleLabels:Record<string,string>={admin:"系统管理员",department_manager:"部门经理",attendance_supervisor:"考勤主管",user:"普通用户"}
    const rankByRole:Record<string,string>={department_manager:"正职/负责人",attendance_supervisor:"业务审核岗"}
    const values = {
      "5013001001002001": row.employee_code,"5013001001002002": row.display_name,"5013001001002003": row.username,"5013001001002004": row.department,
      "5013001001002005": row.role,"5013001001002006": row.status === "active" ? "启用" : "停用","5013001001002007": rankByRole[String(row.role ?? "")] ?? "",
      "5013001001002008": [],"5013001001002009": roleLabels[String(row.role ?? "")] ?? String(row.role ?? ""),"5013001001002010": [],
    }
    await upsertSystemDigitalLibraryRecord({recordId:`std-person-${row.id}`,libraryId:"lib-standard-person",ownerId:row.id,digitalId:"5013001001002001",identifierValues:values,
      data:{人员数字化编码:row.employee_code,人员姓名:row.display_name,人员账号:row.username,所属部门:row.department,人员角色:row.role,人员状态:row.status,组织职级:values["5013001001002007"],身份说明:values["5013001001002009"]},createdAt:row.created_at,source:"system_user_sync"})
  }

  const departments = await query<any>(`SELECT d.id,d.name,d.status,d.created_at,p.name AS parent_name FROM departments d LEFT JOIN departments p ON p.id=d.parent_id ORDER BY d.created_at`)
  for (const row of departments.rows) {
    const values={"5013001001003001":row.name,"5013001001003002":row.parent_name ?? "","5013001001003003":row.status === "active" ? "启用" : "停用"}
    await upsertSystemDigitalLibraryRecord({recordId:`std-dept-${row.id}`,libraryId:"lib-standard-dept",digitalId:"5013001001003001",identifierValues:values,
      data:{部门名称:row.name,上级部门:row.parent_name ?? "",部门状态:row.status},createdAt:row.created_at,source:"system_department_sync"})
  }

  const models = await query<any>(`SELECT m.id,m.name,m.category,m.can_start,m.created_at,p.status AS project_status,p.configuration FROM models m LEFT JOIN model_projects p ON p.model_id=m.id ORDER BY m.name`)
  for (const row of models.rows) {
    const config=isRecord(row.configuration) ? row.configuration : {}
    const values={"5013001001005001":row.name,"5013001001005002":row.category,"5013001001005003":String(config.modelCode ?? ""),"5013001001005004":row.project_status === "published" ? "已发布" : row.project_status || (row.can_start ? "可用" : "建设中")}
    await upsertSystemDigitalLibraryRecord({recordId:`std-model-${row.id}`,libraryId:"lib-standard-model",digitalId:"5013001001005001",identifierValues:values,
      data:{模型名称:row.name,模型类别:row.category,模型数字化编码:String(config.modelCode ?? ""),模型状态:values["5013001001005004"]},createdAt:row.created_at,source:"system_model_sync"})
  }

  const business = await query<any>(`SELECT id,code,name,parent_id,level_no,description,created_at FROM business_definitions WHERE status='active' ORDER BY level_no,code`)
  for (const row of business.rows) {
    const parent=row.parent_id ? business.rows.find((x:any)=>x.id===row.parent_id)?.name ?? "" : ""
    const values={"5013001001006001":row.code,"5013001001006002":row.name,"5013001001006003":parent,"5013001001006004":row.level_no,"5013001001006005":row.description}
    await upsertSystemDigitalLibraryRecord({recordId:`std-biz-${row.id}`,libraryId:"lib-standard-business-definition",digitalId:"5013001001006002",identifierValues:values,
      data:{业务编码:row.code,业务名称:row.name,上级业务:parent,业务层级:row.level_no,业务定义:row.description},createdAt:row.created_at,source:"system_business_definition_sync"})
  }

  const definitions = await query<any>(`SELECT id,code,name,definition_type,definition_text,created_at FROM digital_definitions WHERE status='active' ORDER BY code`)
  for (const row of definitions.rows) {
    const values={"5013001001007001":row.code,"5013001001007002":row.name,"5013001001007003":row.definition_type,"5013001001007004":row.definition_text}
    await upsertSystemDigitalLibraryRecord({recordId:`std-def-${row.id}`,libraryId:"lib-standard-digital-definition",digitalId:"5013001001007002",identifierValues:values,
      data:{定义编码:row.code,定义名称:row.name,定义类型:row.definition_type,定义内容:row.definition_text},createdAt:row.created_at,source:"system_digital_definition_sync"})
  }

  const identifiers = await query<any>(`SELECT id,code,display_name,data_type,description,created_at FROM digital_identifiers WHERE status='active' ORDER BY code`)
  for (const row of identifiers.rows) {
    const values={"5013001001008001":row.code,"5013001001008002":row.display_name,"5013001001008003":row.data_type,"5013001001008004":row.description}
    await upsertSystemDigitalLibraryRecord({recordId:`std-did-${row.id}`,libraryId:"lib-standard-identifier",digitalId:"5013001001008001",identifierValues:values,
      data:{数字化标识:row.code,中文名称:row.display_name,数据类型:row.data_type,标识说明:row.description},createdAt:row.created_at,source:"system_identifier_sync"})
  }

  const libraries = await query<any>(`SELECT id,name,library_type,is_standard,allow_as_source,created_at FROM digital_libraries WHERE status='active' ORDER BY name`)
  for (const row of libraries.rows) {
    if(row.id==='lib-standard-library-catalog') continue
    const values={"5013001001009001":row.name,"5013001001009002":'数字化库',"5013001001009003":row.is_standard ? '是' : '否',"5013001001009004":row.allow_as_source ? '是' : '否'}
    await upsertSystemDigitalLibraryRecord({recordId:`std-lib-${row.id}`,libraryId:"lib-standard-library-catalog",digitalId:"5013001001009001",identifierValues:values,
      data:{数字化库名称:row.name,数字化库类型:values["5013001001009002"],数字化库功能:values["5013001001009003"],允许作为数据源:values["5013001001009004"]},createdAt:row.created_at,source:"system_library_catalog_sync"})
  }
  await materializeLegacyDigitalLibraryRuns()
  await ensureCanonicalDigitalLibraryFileNames()
  const unresolved=await query<any>(`SELECT d.id,l.name AS library_name,COALESCE(i.reason,'尚未形成真实模型运行') AS reason
    FROM digital_library_records d JOIN digital_libraries l ON l.id=d.library_id
    LEFT JOIN digital_library_run_materialization_issues i ON i.record_id=d.id AND i.resolved_at IS NULL
    WHERE l.status='active' AND d.run_id IS NULL ORDER BY l.name,d.created_at LIMIT 20`)
  if(unresolved.rowCount){
    const examples=unresolved.rows.map((row:any)=>`${row.library_name}/${row.id}：${row.reason}`).join("；")
    throw new ModelBuilderError(409,`数字化库方案A物化未完成：仍有正式记录未形成真实模型运行。${examples}`)
  }
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
    SELECT d.id,d.project_id,d.run_id,d.owner_id,d.digital_id,d.identifier_values,d.data,r.project_id AS run_project_id,r.input_data,r.output_data,
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
      if (!isDigitalIdentifier(digitalId) || !key || hasBusinessValue(current[digitalId])) continue
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
      if (isDigitalIdentifier(digitalId) && !hasBusinessValue(current[digitalId]) && hasBusinessValue(candidate)) {
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
    if (changed) {
      // V17.7.14：历史数据修复同样必须形成新的 system_sync 模型运行，禁止列表读取过程直接改正式数字化库或篡改原 model_runs。
      await upsertSystemDigitalLibraryRecord({recordId:String(row.id),libraryId,ownerId:row.owner_id ? String(row.owner_id) : null,digitalId:String(row.digital_id ?? ""),identifierValues:current,data,source:"legacy_identifier_repair"})
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
  await ensureCanonicalDigitalLibraryFileNames()
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200))
  const result = await query<any>(`
    SELECT d.id AS record_id,d.model_id,d.project_id,d.run_id,d.owner_id,d.library_id,d.library_name,d.digital_id,d.identifier_values,d.data,
           to_char(d.created_at,'YYYY-MM-DD HH24:MI:SS') AS created_at,
           COALESCE(m.name,'') AS model_name,COALESCE(p.configuration->>'modelCode','') AS model_code,
           COALESCE(u.display_name,'') AS owner_name,COALESCE(u.employee_code,'') AS owner_code,
           COALESCE(NULLIF(d.file_name,''),NULLIF(r.file_name,''),'') AS file_name,COALESCE(NULLIF(d.display_file_name,''),NULLIF(r.display_file_name,''),'') AS display_file_name,COALESCE(r.status,'已入库') AS run_status
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
  if (!isDigitalIdentifier(sourceDigitalId)) throw new ModelBuilderError(400, "请选择数据源数字化标识")
  if (matchDigitalId && !isDigitalIdentifier(matchDigitalId)) throw new ModelBuilderError(400, "匹配字段必须是有效数字化标识")
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
    if (!isDigitalIdentifier(digitalId)) continue
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
    if (!isDigitalIdentifier(digitalId)) continue
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
    if (!isDigitalIdentifier(digitalId) || !key) continue
    const candidate = hasBusinessValue(merged[key]) ? merged[key] : findByLooseName(merged,label)
    if (hasBusinessValue(candidate)) values[digitalId] = candidate
  }
  // 计算/表达式结果可以没有直接表单字段，但只要配置了 outputDigitalMap 就必须进入数字化库。
  const map = isRecord(design.outputDigitalMap) ? design.outputDigitalMap : {}
  for (const [key,did] of Object.entries(map)) {
    const digitalId = String(did).trim()
    if (isDigitalIdentifier(digitalId) && hasBusinessValue(merged[key])) values[digitalId] = merged[key]
  }
  return values
}
