import { query } from "./db.js"
import { ensureEmployeeApprovalDigitalConfig } from "./employee-digital-config.js"

const plainObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

export type Runtime0622Step = {
  id: string
  title: string
  approvalType: "administrative" | "technical"
  assigneeScope: "named_user"
  userName: string
  roleLabel: string
  departmentField: string
  organizationName: string
  organizationRank: string
  requirement: string
  timeoutHours: number
  timeoutValue: string
  reminderRule: string
  outputField: string
  evidence: Record<string, unknown>
}

export type Runtime0622ApprovalPlan = {
  steps: Runtime0622Step[]
  actions: string[]
  opinionRules: Array<{name:string;terminal:boolean}>
  source: string
  businessCandidates: string[]
  identifierValues: Record<string, unknown>
  thresholdVariables: Array<Record<string, unknown>>
  administrativeLevel: string
  technicalLevel: string
  approvalTimeoutHours: number
  approvalTimeoutValue: string
  assignment: Record<string, unknown>
  organizationPath: string[]
  approverCalculation: Array<Record<string, unknown>>
  pathCalculation: Record<string, unknown>
  thresholdCalculation: Array<Record<string, unknown>>
  businessContent: Record<string, unknown>
  approvalComputationEvidence: Record<string, unknown>
  modelDesignSource: string
  modelDesignIdentifierValues: Record<string, unknown>
}

export type Runtime0622SmartInstance = {
  targetModelName: string
  sourceIdentifier: string
  relatedIdentifier: string
  sourceData: unknown
  dataIndex: number
  special: boolean
}

export type Runtime0622SmartPlan = {
  current: boolean
  approvalResult: string
  businessSourceModelName: string
  businessFileName: string
  businessDisplayFileName: string
  businessDigitalId: string
  pendingIdentifiers: string[]
  associatedIdentifiers: string[]
  identifierCounts: Array<Record<string, unknown>>
  specialResult: string
  normalResult: string
  associatedModels: string[]
  instances: Runtime0622SmartInstance[]
  smartDecision: string
}

type RecordRow = { values: Record<string, unknown>; data: Record<string, unknown> }

async function records(libraryId: string): Promise<RecordRow[]> {
  const result = await query<any>("SELECT identifier_values,data FROM digital_library_records WHERE library_id=$1 ORDER BY created_at,id", [libraryId])
  return result.rows.map((row:any)=>({values:plainObject(row.identifier_values),data:plainObject(row.data)}))
}

function text(value: unknown) { return String(value ?? "").trim() }
function dataText(record: RecordRow | undefined, ...keys: string[]) {
  if (!record) return ""
  for (const key of keys) {
    const value = record.data[key]
    if (value !== undefined && value !== null && text(value)) return text(value)
  }
  return ""
}
function list(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  let raw=text(value)
  if (!raw || raw === "—" || raw === "无") return []
  if (raw.startsWith("[") && raw.endsWith("]")) raw=raw.slice(1,-1)
  return raw.split(/[,，、;；\n]/).map(item=>item.replace(/^['"]|['"]$/g,"").trim()).filter(Boolean)
}
function unique<T>(items:T[]) { return [...new Set(items)] }

function businessHierarchy(attribute: string) {
  if (!/^5012001\d{12}$/.test(attribute)) return attribute ? [attribute] : []
  const tail=attribute.slice(7)
  const parts=[tail.slice(0,3),tail.slice(3,6),tail.slice(6,9),tail.slice(9,12)]
  const result=[attribute]
  result.push(`5012001${parts[0]}${parts[1]}${parts[2]}000`)
  result.push(`5012001${parts[0]}${parts[1]}000000`)
  result.push(`5012001${parts[0]}000000000`)
  return unique(result)
}
function businessMatches(configured: string[], hierarchy: string[]) { return configured.some(item=>hierarchy.includes(item)) }
function orgInfo(code: string) {
  if (!/^5012003\d{5}$/.test(code)) return {nature:"",level:0,rank:99}
  return {nature:code.slice(7,9),level:Number(code.slice(9,11)),rank:Number(code.slice(11,12))}
}
function normalizeNumeric(value: unknown) {
  const raw=text(value).replace(/,/g,"")
  const match=raw.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : Number.NaN
}
function identifierValue(values:Record<string,unknown>, identifier:string) {
  const value=values[identifier]
  if (value !== undefined && value !== null && text(value)) return value
  return undefined
}
function evaluateThresholdClause(rawClause:string, values:Record<string,unknown>) {
  const clause=rawClause.replace(/\s+/g,"")
  if (!clause || clause === "无" || clause === "—") return true
  const range=clause.match(/(\d+(?:\.\d+)?)[^≤>=<]*≤(5013\d{15})≤?(\d+(?:\.\d+)?)/)
  if (range) {
    const actual=normalizeNumeric(identifierValue(values,range[2]))
    return Number.isFinite(actual) && actual >= Number(range[1]) && actual <= Number(range[3])
  }
  const rangeAnd=clause.match(/(\d+(?:\.\d+)?)[^≤>=<]*≤(5013\d{15})且≤(\d+(?:\.\d+)?)/)
  if (rangeAnd) {
    const actual=normalizeNumeric(identifierValue(values,rangeAnd[2]))
    return Number.isFinite(actual) && actual >= Number(rangeAnd[1]) && actual <= Number(rangeAnd[3])
  }
  const direct=clause.match(/(5013\d{15})(>=|<=|>|<|=|≥|≤)([^；;]+)/)
  if (!direct) return false
  const actualRaw=identifierValue(values,direct[1])
  if (actualRaw === undefined) return false
  const expectedRaw=direct[3].replace(/元|天|人/g,"").trim()
  const op=direct[2]
  if (op === "=") return text(actualRaw) === expectedRaw
  const actual=normalizeNumeric(actualRaw)
  const expected=normalizeNumeric(expectedRaw)
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false
  if (op === ">" ) return actual > expected
  if (op === "<" ) return actual < expected
  if (op === ">=" || op === "≥") return actual >= expected
  if (op === "<=" || op === "≤") return actual <= expected
  return false
}
function evaluateThresholdRule(raw:string, values:Record<string,unknown>) {
  const rule=text(raw)
  if (!rule || rule === "无" || rule === "—") return {matched:true,conditional:false,details:[] as string[]}
  const alternatives=rule.split(/[；;\n]/).map(item=>item.trim()).filter(Boolean)
  const details=alternatives.filter(item=>evaluateThresholdClause(item,values))
  return {matched:details.length>0,conditional:true,details}
}

type Placement={employeeCode:string;name:string;identity:string;roleName:string;orgAttr:string;orgNameAttr:string;domains:string[];nature:string;level:number;rank:number}
function placementsFromEmployee(record:RecordRow):Placement[] {
  const employeeCode=dataText(record,"员工数字化编码")
  const name=dataText(record,"员工姓名")
  const identity=dataText(record,"身份")
  const roleName=dataText(record,"岗位/角色","岗位名称","角色名称")
  const attrs=list(record.data["组织数字化属性"])
  const orgNames=list(record.data["组织名称数字化属性"])
  const domains=list(record.data["业务领域"])
  return attrs.map((orgAttr,index)=>{
    const info=orgInfo(orgAttr)
    return {employeeCode,name,identity,roleName,orgAttr,orgNameAttr:orgNames[index] ?? orgNames[0] ?? "",domains,nature:info.nature,level:info.level,rank:info.rank}
  })
}

function chooseApplicantPlacement(placements:Placement[], hierarchy:string[]) {
  const scored=placements.map(item=>({item,score:(item.nature==="02"?100:0)+(businessMatches(item.domains,hierarchy)?20:0)+item.level}))
  scored.sort((a,b)=>b.score-a.score)
  return scored[0]?.item
}

function finalDedup(steps:Runtime0622Step[]) {
  const seen=new Set<string>(); const result:Runtime0622Step[]=[]
  for (let index=steps.length-1; index>=0; index-=1) {
    const step=steps[index]; const key=step.userName || `${step.organizationName}:${step.organizationRank}:${step.title}`
    if (seen.has(key)) continue
    seen.add(key); result.unshift(step)
  }
  return result
}

function timeoutForBusiness(rows:RecordRow[], hierarchy:string[]) {
  const matches=rows.map(row=>{
    const domains=list(row.data["业务领域集合"])
    if (!businessMatches(domains,hierarchy)) return null
    const value=dataText(row,"模型时限").trim()
    if (!value) return null
    // 0622没有单独的“优先级”字段：适用业务集合越窄，配置越具体、优先级越高。
    // 同一优先级若仍出现多个不同值，则不擅自取最大/最小，返回“未配置”等待正式配置收敛。
    const matchedDepth=Math.max(0,...domains.map(domain=>{
      const index=hierarchy.indexOf(domain)
      return index < 0 ? 0 : hierarchy.length-index
    }))
    return {value,scopeSize:domains.length || Number.MAX_SAFE_INTEGER,matchedDepth}
  }).filter((item):item is {value:string;scopeSize:number;matchedDepth:number}=>Boolean(item))
  if (!matches.length) return "未配置"
  matches.sort((a,b)=>a.scopeSize-b.scopeSize || b.matchedDepth-a.matchedDepth)
  const best=matches[0]
  const samePriority=matches.filter(item=>item.scopeSize===best.scopeSize && item.matchedDepth===best.matchedDepth)
  const values=unique(samePriority.map(item=>item.value))
  return values.length===1 ? values[0] : "未配置"
}

export async function resolveApprovalPlan0622(params:{
  sourceModelCode:string; sourceModelName:string; sourceRunId:string; sourceProjectId:string; sourceFileName:string; sourceDisplayFileName:string; sourceDigitalId:string;
  originatorId:string; originatorName:string; businessFields:Array<Record<string,unknown>>; businessData:Record<string,unknown>; identifierValues:Record<string,unknown>; modelDesignSource:string; modelDesignIdentifierValues:Record<string,unknown>
}):Promise<Runtime0622ApprovalPlan|null> {
  if (!/^5011001\d{12}$/.test(params.sourceModelCode)) return null
  const employeeSync=await ensureEmployeeApprovalDigitalConfig(params.originatorId)
  if (!employeeSync.configured && employeeSync.reason) throw new Error(employeeSync.reason)
  const [configRows,assignmentRows,employeeRows,orgNameRows,relationRows,timeoutRows,opinionRows]=await Promise.all([
    records("lib-standard-digital-config"),records("lib-standard-approval-assignment"),records("lib-standard-person"),records("lib-standard-dept"),records("lib-digital-org-relationship-0622"),records("lib-standard-model-timeout"),records("lib-standard-approval-opinion"),
  ])
  const config=configRows.find(row=>dataText(row,"模型数字化编码")===params.sourceModelCode && dataText(row,"数据版本")==="0622")
  if (!config) throw new Error("未匹配到模型数字化配置")
  const businessAttributes=list(config.data["数字化属性集合"])
  const hierarchy=unique(businessAttributes.flatMap(businessHierarchy))
  const businessIdentifiers=list(config.data["数字化标识集合"])
  const originator=await query<{employee_code:string;display_name:string}>("SELECT employee_code,display_name FROM users WHERE id=$1 LIMIT 1",[params.originatorId])
  const employeeCode=text(originator.rows[0]?.employee_code ?? params.businessData["员工数字化编码"] ?? params.businessData["申请人员工数字化编码"])
  const originatorName=text(originator.rows[0]?.display_name ?? params.originatorName ?? params.businessData["申请人"])
  const currentEmployeeRows=employeeRows.filter(row=>dataText(row,"数据版本")==="0622")
  const allPlacements=currentEmployeeRows.flatMap(placementsFromEmployee)
  const applicantRecord=currentEmployeeRows.find(row=>dataText(row,"员工数字化编码")===employeeCode) ?? currentEmployeeRows.find(row=>dataText(row,"员工姓名")===originatorName)
  const applicantPlacements=applicantRecord ? placementsFromEmployee(applicantRecord) : []
  const applicant=chooseApplicantPlacement(applicantPlacements,hierarchy)
  if (!applicant) throw new Error("未匹配到申请人员工数字化配置")
  const orgNames=new Map(orgNameRows.filter(row=>dataText(row,"数据版本")==="0622").map(row=>[dataText(row,"组织名称数字化属性"),dataText(row,"组织名称")]))
  const rels=relationRows.map(row=>({child:dataText(row,"下级组织名称数字化属性"),parent:dataText(row,"上级组织名称数字化属性"),type:dataText(row,"关系类型")})).filter(row=>row.child&&row.parent)
  const organizationPath:string[]=[]; const seenOrg=new Set<string>(); let current=applicant.orgNameAttr
  while (current && !seenOrg.has(current) && organizationPath.length<12) { organizationPath.push(current); seenOrg.add(current); current=rels.find(row=>row.child===current)?.parent ?? "" }

  const sourceValues={...params.identifierValues}
  for (const identifier of businessIdentifiers) if (sourceValues[identifier]===undefined && params.businessData[identifier]!==undefined) sourceValues[identifier]=params.businessData[identifier]
  const activeAssignments=assignmentRows.filter(row=>dataText(row,"数据版本")==="0622").map(row=>{
    const adminDomains=list(row.data["行政审批分管业务属性集合"])
    const techDomains=list(row.data["技术复核分管业务属性集合"])
    const adminThreshold=evaluateThresholdRule(dataText(row,"行政审批阈值调整设置"),sourceValues)
    const techThreshold=evaluateThresholdRule(dataText(row,"技术复核阈值调整设置"),sourceValues)
    return {row,orgAttr:dataText(row,"组织职级"),orgLevelName:dataText(row,"组织层级"),rankName:dataText(row,"职级含义"),adminDomains,techDomains,adminBusiness:businessMatches(adminDomains,hierarchy),techBusiness:businessMatches(techDomains,hierarchy),adminThreshold,techThreshold}
  })
  const baseAdministrativeCandidates=activeAssignments
    .filter(item=>item.adminBusiness && !item.adminThreshold.conditional && item.orgAttr)
    .sort((a,b)=>{ const ai=orgInfo(a.orgAttr); const bi=orgInfo(b.orgAttr); return bi.level-ai.level || ai.rank-bi.rank })
  const baseAdministrativeAssignment=baseAdministrativeCandidates[0]
  if (!baseAdministrativeAssignment) throw new Error("未匹配到基础审批级次配置")
  const targetDisplay=(orgAttr:string)=>{
    const item=activeAssignments.find(value=>value.orgAttr===orgAttr)
    if (!item) return orgAttr
    const level=item.orgLevelName || (orgInfo(orgAttr).level ? `${orgInfo(orgAttr).level}级机构` : "")
    return [level,item.rankName].filter(Boolean).join("·") || orgAttr
  }
  const activeAdmin=activeAssignments.filter(item=>item.adminBusiness && item.adminThreshold.matched)
  const activeTech=activeAssignments.filter(item=>item.techBusiness && item.techThreshold.matched)
  const thresholdCalculation=activeAssignments.filter(item=>(item.adminBusiness&&item.adminThreshold.conditional)||(item.techBusiness&&item.techThreshold.conditional)).map(item=>({
    "组织职级":item.orgAttr,"职级含义":item.rankName,
    "行政审批阈值设置":dataText(item.row,"行政审批阈值调整设置"),"行政阈值命中":item.adminThreshold.matched,"行政命中条件":item.adminThreshold.details,
    "技术复核阈值设置":dataText(item.row,"技术复核阈值调整设置"),"技术阈值命中":item.techThreshold.matched,"技术命中条件":item.techThreshold.details,
  }))
  const rawTimeout=timeoutForBusiness(timeoutRows.filter(row=>dataText(row,"数据版本")==="0622"),hierarchy)
  const steps:Runtime0622Step[]=[]
  const addStep=(placement:Placement,type:"administrative"|"technical",prefix:string,extra:Record<string,unknown>={})=>{
    if (!placement.name || placement.employeeCode===applicant.employeeCode) return
    const assignment=(type==="administrative"?activeAdmin:activeTech).find(item=>item.orgAttr===placement.orgAttr)
    if (!assignment) return
    const orgName=orgNames.get(placement.orgNameAttr) ?? placement.orgNameAttr
    const roleLabel=placement.roleName || placement.identity || assignment.rankName || (type==="technical"?"技术/业务审查人":"审批人")
    steps.push({
      id:`0622-${type}-${steps.length+1}`,title:`${prefix} · ${orgName} · ${roleLabel}`,approvalType:type,assigneeScope:"named_user",userName:placement.name,roleLabel,
      departmentField:"department",organizationName:orgName,organizationRank:placement.orgAttr,
      requirement:type==="administrative" ? `按审批分管配置核验“${params.sourceModelName}”业务内容、数字化属性和数字化标识` : `按技术复核分管配置复核“${params.sourceModelName}”的专业业务内容和数字化依据`,
      timeoutHours:0,timeoutValue:rawTimeout,reminderRule:"按模型时限数字化库及后续提醒配置执行",outputField:type==="administrative"?"审批意见":"技术复核意见",
      evidence:{"员工数字化编码":placement.employeeCode,"组织数字化属性":placement.orgAttr,"组织名称数字化属性":placement.orgNameAttr,"业务属性命中":hierarchy,"阈值计算":type==="administrative"?assignment.adminThreshold:assignment.techThreshold,"规定时限来源":"模型时限数字化库","规定时限原值":rawTimeout,...extra},
    })
  }

  // 行政审批：从申请人所在组织逐级向上；每进入新组织重新按该组织职级配置匹配审批人。
  for (let orgIndex=0;orgIndex<organizationPath.length;orgIndex+=1) {
    const orgNameAttr=organizationPath[orgIndex]
    let candidates=allPlacements.filter(item=>item.orgNameAttr===orgNameAttr && activeAdmin.some(rule=>rule.orgAttr===item.orgAttr) && businessMatches(item.domains,hierarchy))
    if (orgIndex===0) candidates=candidates.filter(item=>item.rank<applicant.rank)
    candidates.sort((a,b)=>b.rank-a.rank)
    for (const candidate of candidates) addStep(candidate,"administrative","行政审批",{"组织路径序号":orgIndex+1,"组织关系":orgIndex===0?"申请人所在组织":"进入上级/分管组织后重新计算"})
  }

  // 技术/业务审查：只把“审批分管配置数字化库”中明确配置为技术/业务审查职责、
  // 且员工信息数字化库实际存在的人员形成 Path_review 节点。
  // 不再从一个审查人员自动追加其本组织负责人/上级负责人；若需要二级、三级审查，
  // 必须由对应组织数字化属性在技术复核分管配置中分别形成真实审查人员。
  // 这样行政审批 Path_admin 完成后不会被误判为整条 Path_final 完成，也不会把行政负责人重复拼入审查路径。
  const reviewRolePattern=/审核|审查|复核|业务审核|专业审核|专业审查|副职/
  const orgOrder=new Map(organizationPath.map((code,index)=>[code,index]))
  const technicalSeeds=allPlacements.filter(item=>{
    const assignment=activeTech.find(rule=>rule.orgAttr===item.orgAttr)
    if (!assignment || item.employeeCode===applicant.employeeCode || !businessMatches(item.domains,hierarchy)) return false
    return reviewRolePattern.test(`${assignment.rankName} ${item.roleName} ${item.identity}`)
  }).sort((a,b)=>{
    const ao=orgOrder.get(a.orgNameAttr) ?? Number.MAX_SAFE_INTEGER
    const bo=orgOrder.get(b.orgNameAttr) ?? Number.MAX_SAFE_INTEGER
    return ao-bo || b.rank-a.rank || a.employeeCode.localeCompare(b.employeeCode)
  })
  const techBranches:Array<Record<string,unknown>>=[]
  for (const seed of technicalSeeds) {
    const before=steps.length
    addStep(seed,"technical",technicalSeeds.length>1?"技术/业务审查":"技术/业务审查",{"复核发起人":seed.name,"复核分支":technicalSeeds.length>1?seed.name:"单一技术/业务审查","路径规则":"技术/业务审查人员必须由审批分管配置与员工信息数字化库直接形成，不自动追加行政负责人"})
    const branchSteps=steps.length>before ? [steps[steps.length-1]] : []
    techBranches.push({"复核发起人":seed.name,"复核路径":branchSteps.map(item=>`${item.organizationName}·${item.userName}`)})
  }

  const dedupedSteps=finalDedup(steps)
  if (!dedupedSteps.length) return null

  // V17.7.17：审批/审查级次均以本次发起人为起点，分别按实际有效节点顺序编号；
  // 组织数字化属性仅用于组织、岗位和人员匹配，不再直接作为“审批级次”。
  const numberText=(value:number)=>{
    const map=["零","一","二","三","四","五","六","七","八","九","十"]
    if (value<=10) return map[value]
    if (value<20) return `十${map[value-10]}`
    const tens=Math.floor(value/10),ones=value%10
    return `${map[tens]}十${ones?map[ones]:""}`
  }
  let administrativeIndex=0
  let reviewIndex=0
  const finalSteps=dedupedSteps.map(step=>{
    const relativeLevel=step.approvalType==="technical" ? `${numberText(++reviewIndex)}级技术/业务审查` : `${numberText(++administrativeIndex)}级审批`
    const employeeDigitalCode=text(plainObject(step.evidence)["员工数字化编码"])
    const role=step.roleLabel || step.userName || (step.approvalType==="technical"?"技术/业务审查人":"审批人")
    const finalPathLabel=`${role}${employeeDigitalCode ? `（${employeeDigitalCode}）` : ""}`
    return {...step,title:finalPathLabel,evidence:{...step.evidence,"相对审批/审查级次":relativeLevel,"最终路径显示":finalPathLabel}}
  })

  administrativeIndex=0
  reviewIndex=0
  const approverCalculation=finalSteps.map((step,index)=>{
    const relativeLevel=step.approvalType==="technical" ? `${numberText(++reviewIndex)}级技术/业务审查` : `${numberText(++administrativeIndex)}级审批`
    return {"环节序号":index+1,"相对级次":relativeLevel,"环节名称":step.title,"环节类型":step.approvalType==="technical"?"技术/业务审查":"行政审批","审批组织":step.organizationName,"组织数字化属性":step.organizationRank,"审批层级岗位":step.roleLabel,"审批人":step.userName,"员工数字化编码":plainObject(step.evidence)["员工数字化编码"],"审批人计算依据":step.evidence,"审批要求":step.requirement,"规定时限":step.timeoutValue}
  })
  const pathLabel=(step:Runtime0622Step)=>{
    const code=text(plainObject(step.evidence)["员工数字化编码"])
    return `${step.roleLabel || step.userName}${code ? `（${code}）` : ""}`
  }
  const adminPath=finalSteps.filter(step=>step.approvalType==="administrative").map(pathLabel)
  const techPath=finalSteps.filter(step=>step.approvalType==="technical").map(pathLabel)
  const formalPath=finalSteps.map(pathLabel)
  const baseAdministrativeLevel=adminPath.length ? "一级审批" : "无"
  const finalAdministrativeLevel=adminPath.length ? `${numberText(adminPath.length)}级审批` : "无"
  const finalReviewLevel=techPath.length ? `${numberText(techPath.length)}级技术/业务审查` : "无"
  const pathCalculation={
    "申请人":applicant.name,"申请人员工数字化编码":applicant.employeeCode,"申请人所在部门":orgNames.get(applicant.orgNameAttr) ?? applicant.orgNameAttr,"申请人组织数字化属性":applicant.orgAttr,"申请人组织名称数字化属性":applicant.orgNameAttr,
    "业务分类数字化属性":businessAttributes,"数字化标识集合":businessIdentifiers,"基础行政审批级次":baseAdministrativeLevel,"最终行政审批级次":finalAdministrativeLevel,"技术/业务审查级次":finalReviewLevel,
    "组织逐级路径":organizationPath.map(code=>`${orgNames.get(code) ?? code}（${code}）`),"行政审批路径":adminPath,"技术/业务审查路径":techPath,"技术复核分支":techBranches,"正式审批路径":formalPath,
    "审批路径计算依据":"组织数字化属性仅用于组织、岗位、人员匹配；审批与技术/业务审查分别以发起人为起点按有效节点形成相对级次，阈值仅影响需要形成的有效节点，最终路径按实际人员去重并保留靠后的有效环节。",
  }
  return {
    steps:finalSteps,actions:["同意","不同意","退回修改"],opinionRules:opinionRows.map(row=>({name:dataText(row,"审批意见","意见名称")||text(row.values["5013001001110102"]),terminal:false})).filter(item=>item.name),
    source:"0622数字化库",businessCandidates:[params.sourceModelName,...businessAttributes],identifierValues:sourceValues,thresholdVariables:thresholdCalculation,administrativeLevel:finalAdministrativeLevel,technicalLevel:finalReviewLevel,approvalTimeoutHours:0,approvalTimeoutValue:rawTimeout,
    assignment:{"行政审批分管配置":activeAdmin.map(item=>({"组织职级":item.orgAttr,"职级含义":item.rankName})),"技术/业务审查分管配置":activeTech.map(item=>({"组织职级":item.orgAttr,"职级含义":item.rankName}))},organizationPath:organizationPath.map(code=>orgNames.get(code) ?? code),approverCalculation,pathCalculation,thresholdCalculation,
    businessContent:{sourceRunId:params.sourceRunId,sourceProjectId:params.sourceProjectId,sourceModelName:params.sourceModelName,sourceModelCode:params.sourceModelCode,sourceFileName:params.sourceFileName,sourceDisplayFileName:params.sourceDisplayFileName,sourceDigitalId:params.sourceDigitalId,businessFields:params.businessFields,businessData:params.businessData,identifierValues:sourceValues,"业务分类数字化属性":businessAttributes,"数字化标识集合":businessIdentifiers},
    approvalComputationEvidence:{"模型数字化编码":params.sourceModelCode,"模型数字化配置":config.data,"业务分类数字化属性":businessAttributes,"数字化标识集合":businessIdentifiers,"申请人员工数字化编码":applicant.employeeCode,"申请人组织起点":applicant,"组织逐级路径":organizationPath,"基础行政审批级次":baseAdministrativeLevel,"最终行政审批级次":finalAdministrativeLevel,"技术/业务审查级次":finalReviewLevel,"命中阈值":thresholdCalculation,"审批人计算":approverCalculation,"审批路径计算":pathCalculation,"模型时限":rawTimeout},
    modelDesignSource:params.modelDesignSource,modelDesignIdentifierValues:params.modelDesignIdentifierValues,
  }
}

function approvalPassed(value:string) { const normalized=value.trim(); return ["同意","通过","审批通过","已通过","允许生效"].some(item=>normalized.includes(item)) }
function valueItems(value:unknown) {
  if (Array.isArray(value)) return value.filter(item=>item!==undefined&&item!==null&&text(item))
  if (value && typeof value==="object") return Object.values(value as Record<string,unknown>).filter(item=>item!==undefined&&item!==null&&text(item))
  return value===undefined||value===null||!text(value) ? [] : [value]
}

export async function resolveSmartPlan0622(input:Record<string,unknown>,output:Record<string,unknown>):Promise<Runtime0622SmartPlan> {
  const sourceOutput=plainObject(input.sourceOutput)
  const approvalBusinessContent=plainObject(output.approvalBusinessContent ?? input.approvalBusinessContent ?? sourceOutput.approvalBusinessContent)
  const sourceModelCode=text(approvalBusinessContent.sourceModelCode ?? approvalBusinessContent["业务模型数字化编码"])
  const current=/^5011001\d{12}$/.test(sourceModelCode)
  const businessSourceModelName=text(approvalBusinessContent.sourceModelName ?? input.businessSourceModelName ?? input["业务模型"])
  const businessFileName=text(approvalBusinessContent.sourceFileName ?? input.businessFileName ?? input["业务模型文件名"])
  const businessDisplayFileName=text(approvalBusinessContent.sourceDisplayFileName ?? input.businessDisplayFileName ?? input["业务中文显示名称"])
  const businessDigitalId=text(approvalBusinessContent.sourceDigitalId ?? input.businessDigitalId ?? input["业务数字化标识"])
  const identifierValues=plainObject(approvalBusinessContent.identifierValues ?? input["业务数字化标识值"])
  const approvalResult=text(input["审批结果"] ?? input.approvalResult ?? sourceOutput["审批结果"] ?? sourceOutput.approvalResult ?? output["审批结果"] ?? output.approvalResult)
  const pendingIdentifiers=Object.entries(identifierValues).filter(([,value])=>valueItems(value).length>0).map(([key])=>key)
  if (!current) return {current:false,approvalResult,businessSourceModelName,businessFileName,businessDisplayFileName,businessDigitalId,pendingIdentifiers,associatedIdentifiers:[],identifierCounts:[],specialResult:"历史兼容",normalResult:"历史兼容",associatedModels:[],instances:[],smartDecision:"历史数据按原智选配置兼容处理"}
  if (!approvalPassed(approvalResult)) return {current:true,approvalResult,businessSourceModelName,businessFileName,businessDisplayFileName,businessDigitalId,pendingIdentifiers,associatedIdentifiers:[],identifierCounts:pendingIdentifiers.map(id=>({"数字化标识":id,"有效数据条数":valueItems(identifierValues[id]).length})),specialResult:"审批未通过，不执行正常关联",normalResult:"未执行",associatedModels:[],instances:[],smartDecision:`审批结果“${approvalResult || "未形成"}”，智选终止正常关联触发`}
  const [associationRows,configRows]=await Promise.all([records("lib-standard-identifier-trigger"),records("lib-standard-digital-config")])
  const associations=associationRows.map(row=>({source:dataText(row,"数字化标识")||text(row.values["5013001001210401"]),related:dataText(row,"关联数字化标识")||text(row.values["5013001001210402"])})).filter(item=>item.source&&item.related)
  const configCurrent=configRows.filter(row=>dataText(row,"数据版本")==="0622")
  const instances:Runtime0622SmartInstance[]=[]; const associatedIdentifiers:string[]=[]
  for (const sourceIdentifier of pendingIdentifiers) {
    const rows=associations.filter(item=>item.source===sourceIdentifier)
    for (const relation of rows) {
      associatedIdentifiers.push(sourceIdentifier)
      const targets=configCurrent.filter(row=>list(row.data["数字化标识集合"]).includes(relation.related))
      for (const target of targets) {
        const targetModelName=dataText(target,"模型名称")
        if (!targetModelName) continue
        const meta=await query<{category:string}>("SELECT category FROM models WHERE name=$1 LIMIT 1",[targetModelName])
        const special=/会议/.test(text(meta.rows[0]?.category))
        const items=valueItems(identifierValues[sourceIdentifier])
        items.forEach((sourceData,index)=>instances.push({targetModelName,sourceIdentifier,relatedIdentifier:relation.related,sourceData,dataIndex:index+1,special}))
      }
    }
  }
  instances.sort((a,b)=>Number(b.special)-Number(a.special))
  const associatedModels=unique(instances.map(item=>item.targetModelName))
  const identifierCounts=pendingIdentifiers.map(id=>({"数字化标识":id,"有效数据条数":valueItems(identifierValues[id]).length,"存在关联配置":associations.some(row=>row.source===id)}))
  const specialCount=instances.filter(item=>item.special).length; const normalCount=instances.length-specialCount
  const smartDecision=instances.length ? `先特殊后正常，共形成${instances.length}个关联模型启动实例` : "标识关联配置数字化库未形成可执行关联，本次不触发后续模型"
  return {current:true,approvalResult,businessSourceModelName,businessFileName,businessDisplayFileName,businessDigitalId,pendingIdentifiers,associatedIdentifiers:unique(associatedIdentifiers),identifierCounts,specialResult:specialCount?`特殊关联${specialCount}个实例优先执行`:"无特殊关联",normalResult:normalCount?`正常关联${normalCount}个实例`:"无正常关联",associatedModels,instances,smartDecision}
}
