import { query } from "./db.js"
import { isCurrentEmployeeDigitalCode, nextEmployeeDigitalCode } from "./digital-codes.js"
import { runModelBackedDigitalLibraryRecord } from "./data-linkage.js"

type UserRow={id:string;username:string;display_name:string;department:string;employee_code:string;role:string;status:string}
type RecordRow={id:string;digital_id:string;data:Record<string,unknown>}

function text(value:unknown){return String(value ?? "").trim()}
function object(value:unknown):Record<string,unknown>{return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}}
function list(value:unknown){const raw=text(value); if(!raw || raw==="—" || raw==="无") return []; return raw.split(/[,，、;；\n]/).map(item=>item.trim()).filter(Boolean)}
function unique(items:string[]){return [...new Set(items.filter(Boolean))]}

const SPECIAL_ORGS=new Set(["公司党委","股东会","董事会","总经理组成人员"])
const ATTENDANCE_DOMAIN="5012001005001000000"

function rankFor(role:string, level:4|5){
  const rank=role==="department_manager" ? "1" : role==="attendance_supervisor" ? "6" : "7"
  return `5012003020${level}${rank}`
}
function identityFor(role:string,department:string){
  if(role==="department_manager") return `${department}正职/负责人`
  if(role==="attendance_supervisor") return `${department}业务审核岗`
  return `${department}办事员`
}
function roleNameFor(role:string){
  if(role==="department_manager") return "部门经理"
  if(role==="attendance_supervisor") return "考勤主管"
  if(role==="admin") return "普通员工"
  return "普通员工"
}

async function ensureCurrentEmployeeCode(user:UserRow){
  if(isCurrentEmployeeDigitalCode(user.employee_code)) return user.employee_code
  const code=await nextEmployeeDigitalCode()
  await query("UPDATE users SET employee_code=$1,updated_at=now() WHERE id=$2",[code,user.id])
  return code
}

async function hasFormal0622EmployeeRecord(employeeCode:string,displayName:string){
  const result=await query<{id:string}>(`SELECT id FROM digital_library_records
    WHERE library_id='lib-standard-person' AND data->>'数据版本'='0622'
      AND COALESCE(data->>'数据来源','') NOT LIKE '系统账号同步%'
      AND ((data->>'员工数字化编码')=$1 OR (data->>'员工姓名')=$2)
    ORDER BY created_at,id LIMIT 1`,[employeeCode,displayName])
  return Boolean(result.rows[0]?.id)
}

export async function ensureEmployeeApprovalDigitalConfig(userId:string){
  const userResult=await query<UserRow>("SELECT id,username,display_name,COALESCE(department,'') AS department,COALESCE(employee_code,'') AS employee_code,COALESCE(role,'user') AS role,status FROM users WHERE id=$1 LIMIT 1",[userId])
  const user=userResult.rows[0]
  if(!user || user.status!=="active") return {configured:false,reason:"用户不存在或未启用"}
  const employeeCode=await ensureCurrentEmployeeCode(user)
  if(await hasFormal0622EmployeeRecord(employeeCode,user.display_name)) return {configured:true,employeeCode,source:"existing"}

  const orgResult=await query<RecordRow>(`SELECT id,digital_id,data FROM digital_library_records
    WHERE library_id='lib-standard-dept' AND data->>'数据版本'='0622' AND data->>'组织名称'=$1
    ORDER BY created_at,id LIMIT 1`,[user.department])
  const org=orgResult.rows[0]
  if(!org) return {configured:false,employeeCode,reason:"申请人所属部门未匹配到组织名称数字化配置"}
  if(SPECIAL_ORGS.has(user.department)) return {configured:false,employeeCode,reason:"治理类组织人员必须在员工信息数字化库中正式维护组织职级"}

  const orgData=object(org.data)
  const orgNameAttr=text(orgData["组织名称数字化属性"] || org.digital_id)
  const relation=await query<{parent_attr:string}>(`SELECT data->>'上级组织名称数字化属性' AS parent_attr FROM digital_library_records
    WHERE library_id='lib-digital-org-relationship-0622' AND data->>'下级组织名称数字化属性'=$1
    ORDER BY created_at,id LIMIT 1`,[orgNameAttr])
  const parentAttr=text(relation.rows[0]?.parent_attr)
  const level:4|5=parentAttr && parentAttr!=="501200402003" ? 5 : 4
  const orgAttr=rankFor(user.role,level)

  const ownership=await query<RecordRow>(`SELECT id,digital_id,data FROM digital_library_records
    WHERE library_id='lib-standard-business-ownership' AND data->>'数据版本'='0622' AND data->>'组织名称数字化属性'=$1
    ORDER BY created_at,id LIMIT 1`,[orgNameAttr])
  const domains=list(object(ownership.rows[0]?.data)["业务领域集合"])
  if(user.role==="department_manager" || user.role==="attendance_supervisor") domains.push(ATTENDANCE_DOMAIN)
  const businessDomains=unique(domains)
  const identity=identityFor(user.role,user.department)
  const data={
    "员工数字化编码":employeeCode,"员工姓名":user.display_name,"组织数字化属性":orgAttr,"组织名称数字化属性":orgNameAttr,
    "业务领域":businessDomains.join("；"),"身份":identity,"岗位/角色":roleNameFor(user.role),"数据版本":"0622","数据来源":"系统账号同步形成员工信息数字化配置；审批模型正式读取员工信息数字化库"
  }
  await runModelBackedDigitalLibraryRecord({recordId:`auto0622-person-${user.id}`,libraryId:'lib-standard-person',expectedProducerModelName:'员工信息模型',triggerMode:'system_sync',ownerId:user.id,digitalId:employeeCode,identifierValues:{},data,source:'system_employee_approval_config_sync'})
  await runModelBackedDigitalLibraryRecord({recordId:`auto0622-employee-${user.id}`,libraryId:'lib-digital-employee-code-0622',expectedProducerModelName:'员工数字化模型',triggerMode:'system_sync',ownerId:user.id,digitalId:employeeCode,identifierValues:{},
    data:{"员工数字化编码":employeeCode,"员工姓名":user.display_name,"数据版本":"0622","数据来源":"系统账号同步形成员工数字化编码记录"},source:'system_employee_code_sync'})
  return {configured:true,employeeCode,source:"synchronized",organizationDigitalAttribute:orgAttr,organizationNameDigitalAttribute:orgNameAttr}
}

export async function syncActiveEmployeeApprovalDigitalConfigs(){
  const users=await query<{id:string}>("SELECT id FROM users WHERE status='active' ORDER BY created_at,id")
  const results=[]
  for(const row of users.rows){
    try{results.push({userId:row.id,...await ensureEmployeeApprovalDigitalConfig(row.id)})}
    catch(error){results.push({userId:row.id,configured:false,reason:error instanceof Error?error.message:String(error)})}
  }
  return results
}
