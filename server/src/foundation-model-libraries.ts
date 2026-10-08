import { randomUUID } from "node:crypto"
import { query } from "./db.js"
import { ModelBuilderError } from "./errors.js"
import { isCurrentModelDigitalCode } from "./digital-codes.js"

export type FoundationScope = "approval" | "smart"
export type FoundationRequirement = "hard" | "supporting"

export type FoundationDependency = {
  key: string
  producerModelName: string
  libraryId: string
  scopes: FoundationScope[]
  requirement: FoundationRequirement
  allowEmpty: boolean
}

/**
 * V17.7.26：审批/智选基础模型库注册表。
 * 数字化库必须由这里声明的数据产生模型运行形成；注册表只描述依赖，不直接制造业务数据。
 */
export const FOUNDATION_MODEL_LIBRARIES: FoundationDependency[] = [
  { key:"model-digital-config", producerModelName:"模型数字化配置模型", libraryId:"lib-standard-digital-config", scopes:["approval","smart"], requirement:"hard", allowEmpty:false },
  { key:"approval-assignment", producerModelName:"审批分管配置模型", libraryId:"lib-standard-approval-assignment", scopes:["approval"], requirement:"hard", allowEmpty:false },
  { key:"employee-info", producerModelName:"员工信息模型", libraryId:"lib-standard-person", scopes:["approval"], requirement:"hard", allowEmpty:false },
  { key:"organization-name", producerModelName:"组织名称数字化模型", libraryId:"lib-standard-dept", scopes:["approval"], requirement:"hard", allowEmpty:false },
  { key:"organization-relationship", producerModelName:"组织关系模型", libraryId:"lib-digital-org-relationship-0622", scopes:["approval"], requirement:"hard", allowEmpty:false },
  { key:"model-timeout", producerModelName:"模型时限模型", libraryId:"lib-standard-model-timeout", scopes:["approval"], requirement:"hard", allowEmpty:false },
  { key:"approval-opinion", producerModelName:"审批意见标准模型", libraryId:"lib-standard-approval-opinion", scopes:["approval"], requirement:"hard", allowEmpty:false },

  { key:"business-classification", producerModelName:"业务分类模型", libraryId:"lib-digital-business-classification-0622", scopes:["approval"], requirement:"supporting", allowEmpty:false },
  { key:"organization-digital", producerModelName:"组织数字化模型", libraryId:"lib-standard-org-rank", scopes:["approval"], requirement:"supporting", allowEmpty:false },
  { key:"business-ownership", producerModelName:"业务归属模型", libraryId:"lib-standard-business-ownership", scopes:["approval"], requirement:"supporting", allowEmpty:false },
  { key:"employee-code", producerModelName:"员工数字化模型", libraryId:"lib-digital-employee-code-0622", scopes:["approval"], requirement:"supporting", allowEmpty:false },
  { key:"threshold-type", producerModelName:"阈值类属模型", libraryId:"lib-standard-threshold-type", scopes:["approval"], requirement:"supporting", allowEmpty:false },
  { key:"threshold-config", producerModelName:"审批阈值配置模型", libraryId:"lib-standard-threshold-config", scopes:["approval"], requirement:"supporting", allowEmpty:false },

  // 标识关联配置数字化库允许0条数据：0条代表当前没有后续关联，而不是配置错误。
  { key:"identifier-trigger", producerModelName:"标识关联配置模型", libraryId:"lib-standard-identifier-trigger", scopes:["smart"], requirement:"hard", allowEmpty:true },
  { key:"identifier-catalog", producerModelName:"数字化标识建设模型", libraryId:"lib-standard-identifier", scopes:["smart"], requirement:"supporting", allowEmpty:false },
  { key:"model-catalog", producerModelName:"模型信息标准模型", libraryId:"lib-standard-model", scopes:["smart"], requirement:"supporting", allowEmpty:false },
]

export type FoundationReadinessItem = {
  scope: FoundationScope
  key: string
  producerModelName: string
  libraryId: string
  requirement: FoundationRequirement
  ready: boolean
  reason: string
  recordCount: number
  orphanRecordCount: number
  modelCode: string
}

export type FoundationReadinessResult = {
  scope: FoundationScope
  ready: boolean
  items: FoundationReadinessItem[]
  issues: FoundationReadinessItem[]
}

async function inspectDependency(scope:FoundationScope, dependency:FoundationDependency):Promise<FoundationReadinessItem> {
  const meta=await query<any>(`SELECT l.id AS library_id,l.status AS library_status,m.name AS model_name,
      p.id AS project_id,p.status AS project_status,COALESCE(dc.code,p.configuration->>'modelCode','') AS model_code,
      COALESCE(r.record_count,0)::int AS record_count,COALESCE(r.orphan_count,0)::int AS orphan_count
    FROM digital_libraries l
    LEFT JOIN models m ON m.id=l.model_id
    LEFT JOIN LATERAL (
      SELECT mp.id,mp.status,mp.configuration FROM model_projects mp
      WHERE mp.model_id=l.model_id
      ORDER BY CASE WHEN mp.status='published' THEN 0 ELSE 1 END,mp.updated_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN digital_codes dc ON dc.object_type='model' AND dc.object_id=l.model_id AND dc.code ~ '^5011001[0-9]{12}$'
    LEFT JOIN LATERAL (
      SELECT count(*) AS record_count,
             count(*) FILTER (WHERE run_id IS NULL) AS orphan_count
      FROM digital_library_records dr WHERE dr.library_id=l.id
    ) r ON true
    WHERE l.id=$1 LIMIT 1`,[dependency.libraryId])
  const row=meta.rows[0]
  const base={scope,key:dependency.key,producerModelName:dependency.producerModelName,libraryId:dependency.libraryId,requirement:dependency.requirement,recordCount:Number(row?.record_count ?? 0),orphanRecordCount:Number(row?.orphan_count ?? 0),modelCode:String(row?.model_code ?? "").trim()}
  if(!row) return {...base,ready:false,reason:"数字化库不存在"}
  if(String(row.library_status)!=="active") return {...base,ready:false,reason:"数字化库未启用"}
  if(String(row.model_name ?? "")!==dependency.producerModelName) return {...base,ready:false,reason:`数据产生模型应为“${dependency.producerModelName}”，当前为“${String(row.model_name ?? "未配置")}”`}
  if(!row.project_id || String(row.project_status ?? "")!=="published") return {...base,ready:false,reason:`数据产生模型“${dependency.producerModelName}”没有已发布项目`}
  if(!isCurrentModelDigitalCode(base.modelCode)) return {...base,ready:false,reason:`数据产生模型“${dependency.producerModelName}”缺少当前19位模型数字化编码`}
  if(base.orphanRecordCount>0) return {...base,ready:false,reason:`存在${base.orphanRecordCount}条正式记录 run_id IS NULL，必须先通过模型运行物化`}
  if(!dependency.allowEmpty && base.recordCount<1) return {...base,ready:false,reason:"数字化库尚无正式模型运行数据"}
  return {...base,ready:true,reason:dependency.allowEmpty && base.recordCount===0 ? "结构就绪；允许0条关联数据" : "就绪"}
}

export async function foundationReadiness(scope:FoundationScope):Promise<FoundationReadinessResult> {
  const dependencies=FOUNDATION_MODEL_LIBRARIES.filter(item=>item.scopes.includes(scope))
  const items:FoundationReadinessItem[]=[]
  for(const dependency of dependencies) items.push(await inspectDependency(scope,dependency))
  const issues=items.filter(item=>!item.ready)
  return {scope,ready:!issues.some(item=>item.requirement==="hard"),items,issues}
}

export async function assertFoundationReady(scope:FoundationScope) {
  const result=await foundationReadiness(scope)
  if(result.ready) return result
  const prefix=scope==="approval" ? "审批模型基础模型库未就绪" : "智选模型基础模型库未就绪"
  const hardIssues=result.issues.filter(item=>item.requirement==="hard")
  const detail=hardIssues.map(item=>`${item.producerModelName} → ${item.libraryId}：${item.reason}`).join("；")
  throw new ModelBuilderError(409,`${prefix}：${detail}`)
}

export async function auditFoundationReadiness() {
  const results=[await foundationReadiness("approval"),await foundationReadiness("smart")]
  const currentKeys=new Set<string>()
  for(const result of results) {
    for(const item of result.issues) {
      const issueKey=`${item.scope}|${item.libraryId}|${item.reason}`
      currentKeys.add(issueKey)
      await query(`INSERT INTO foundation_model_library_readiness_issues(id,issue_key,scope,library_id,producer_model_name,requirement,reason,detected_at,resolved_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,now(),NULL)
        ON CONFLICT(issue_key) DO UPDATE SET producer_model_name=EXCLUDED.producer_model_name,requirement=EXCLUDED.requirement,reason=EXCLUDED.reason,resolved_at=NULL`,[
        randomUUID(),issueKey,item.scope,item.libraryId,item.producerModelName,item.requirement,item.reason,
      ])
    }
  }
  const unresolved=await query<{issue_key:string}>("SELECT issue_key FROM foundation_model_library_readiness_issues WHERE resolved_at IS NULL")
  for(const row of unresolved.rows) if(!currentKeys.has(row.issue_key)) await query("UPDATE foundation_model_library_readiness_issues SET resolved_at=now() WHERE issue_key=$1 AND resolved_at IS NULL",[row.issue_key])
  return results
}
