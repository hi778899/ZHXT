import { randomUUID } from "node:crypto"
import { query } from "./db.js"
import { evaluateExpression, ExpressionError } from "./expression.js"
import { blankTemplate, getTemplatePreset } from "./model-templates.js"
import { buildDisplayFileName, buildRuntimeFileName, getEmployeeDigitalCode, isCurrentEmployeeDigitalCode, isCurrentModelDigitalCode, isCurrentRuntimeFileName, isDigital16, isDigitalIdentifier, isEmployeeDigitalCode, isModelDigitalCode, timeCode } from "./digital-codes.js"
import { buildIdentifierValues, ensureModelDigitalLibrary } from "./data-linkage.js"
import { ModelBuilderError } from "./errors.js"
import { resolveApprovalPlan0622, resolveSmartPlan0622 } from "./runtime-0622.js"
export { ModelBuilderError } from "./errors.js"

export type BuilderUser = { id: string; display_name: string; employee_code?: string; department?: string; role?: string }

type BuilderSubField = { id: string; label: string; key: string; type: string; required?: boolean; options?: string[]; digitalId?: string }
type BuilderField = {
  id: string; label: string; key: string; type: string; required?: boolean; options?: string[]; source?: string; sourceMode?: string; digitalId?: string; placeholder?: string; description?: string; defaultValue?: unknown;
  width?: number; readonly?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string;
  visibleWhen?: { fieldKey?: string; operator?: "eq" | "neq" | "contains" | "notEmpty"; value?: string };
  linkage?: { sourceLibrary?: string; sourceLibraryId?: string; triggerFieldKey?: string; matchField?: string; matchDigitalId?: string; sourceField?: string; sourceDigitalId?: string; mode?: "fill" | "options" };
  permissions?: { visible?: boolean; editable?: boolean }; subFields?: BuilderSubField[]
}
type Calculation = { id: string; targetKey: string; label?: string; operation: "dateDiffInclusive" | "sum" | "difference" | "concat" | "copy"; sourceKeys: string[]; separator?: string }
type Expression = { id: string; targetKey: string; label?: string; expression: string }
type FlowEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null; label?: string }
type RuleAction = { type: "setOutput"; key: string; value: string }
type Rule = { id: string; fieldKey: string; operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "contains" | "notEmpty"; value?: string | number; then: RuleAction; else?: RuleAction }
type TestCase = { id: string; name: string; input: Record<string, unknown>; expectValid?: boolean; expectedOutput?: Record<string, unknown> }

type ProjectRow = {
  id: string; model_id: string; owner_id: string | null; stage: string; status: string; suggestion: any; design: any; test_data: any; test_report: any; configuration: any; test_passed: boolean; version: number; published_at: Date | null; created_at: Date; updated_at: Date;
  name: string; category: string; description: string; can_start: boolean
}

const plainObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const asArray = <T>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []
const numeric = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0 }
const dateOnlyUtc = (value: unknown) => {
  const text = String(value ?? "").trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return Number.NaN
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  const stamp = Date.UTC(year, month - 1, day)
  const check = new Date(stamp)
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day ? stamp : Number.NaN
}
const isEmpty = (value: unknown) => value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0)

export { getTemplateCatalog } from "./model-templates.js"

function projectView(row: ProjectRow) {
  return {
    id: row.id, modelId: row.model_id, name: row.name, category: row.category, description: row.description, canStart: row.can_start,
    ownerId: row.owner_id, stage: row.stage, status: row.status, suggestion: row.suggestion ?? {}, design: row.design ?? {}, testData: row.test_data ?? { cases: [] }, testReport: row.test_report ?? {}, configuration: row.configuration ?? {}, testPassed: row.test_passed, version: row.version,
    publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at,
  }
}

async function fetchProject(where: string, value: string) {
  const result = await query<ProjectRow>(`SELECT p.*,m.name,m.category,m.description,m.can_start FROM model_projects p JOIN models m ON m.id=p.model_id WHERE ${where}`, [value])
  return result.rows[0] ?? null
}

export async function listProjects() {
  const result = await query<ProjectRow>("SELECT p.*,m.name,m.category,m.description,m.can_start FROM model_projects p JOIN models m ON m.id=p.model_id ORDER BY p.updated_at DESC,m.name")
  return result.rows.map(projectView)
}
export async function getProject(id: string) {
  const row = await fetchProject("p.id=$1", id)
  if (!row) throw new ModelBuilderError(404, "模型建设项目不存在")
  return projectView(row)
}
export async function getPublishedByName(name: string) {
  const row = await fetchProject("m.name=$1 AND p.status='published'", name)
  return row ? projectView(row) : null
}

export async function createProject(userId: string, input: Record<string, unknown>) {
  const template = String(input.template ?? "blank")
  const source = getTemplatePreset(template)
  if (!source) throw new ModelBuilderError(400, "未知的模型模板")
  const suffix = Date.now().toString().slice(-5)
  const baseName = String(source.suggestion?.name ?? "新建业务模型")
  let name = String(input.name ?? `${baseName}-${suffix}`).trim()
  if (!name) name = "新建业务模型"
  if (name.length > 100) throw new ModelBuilderError(400, "模型名称不能超过100个字符")
  const duplicate = await query("SELECT 1 FROM models WHERE lower(name)=lower($1)", [name])
  if (duplicate.rowCount) throw new ModelBuilderError(409, "模型名称已存在，请更换名称")
  const templateData = template === "blank" ? blankTemplate(name) : source
  const suggestion = { ...templateData.suggestion, name, category: String(input.category ?? templateData.suggestion.category ?? "业务管理"), description: String(input.description ?? templateData.suggestion.description ?? "") }
  const design = templateData.design
  const testData = templateData.testData
  const configuration = { ...templateData.configuration }
  const modelId = randomUUID(); const projectId = randomUUID()
  await query("INSERT INTO models(id,name,category,description,can_start) VALUES($1,$2,$3,$4,false)", [modelId, name, suggestion.category, suggestion.description])
  await query("INSERT INTO model_projects(id,model_id,owner_id,stage,status,suggestion,design,test_data,configuration) VALUES($1,$2,$3,'suggestion','draft',$4,$5,$6,$7)", [projectId, modelId, userId, JSON.stringify(suggestion), JSON.stringify(design), JSON.stringify(testData), JSON.stringify(configuration)])
  return getProject(projectId)
}

export async function saveStage(userId: string, projectId: string, stage: string, data: unknown) {
  if (!['suggestion','design','test','config'].includes(stage)) throw new ModelBuilderError(400, "无效的建设阶段")
  const current = await fetchProject("p.id=$1", projectId)
  if (!current) throw new ModelBuilderError(404, "模型建设项目不存在")
  const submittedStage = await query<{ stage_run_id: string | null }>("SELECT stage_run_id FROM model_build_stage_runs WHERE target_project_id=$1 AND stage_key=$2", [projectId, stage])
  if (submittedStage.rows[0]?.stage_run_id) throw new ModelBuilderError(409, `${BUILD_STAGE_MODELS[stage] ?? "当前建设模型"}已经归档，不能继续修改该次建设数据；请按新版本重新建设。`)
  const payload = plainObject(data)
  if (stage === "suggestion") {
    const name = String(payload.name ?? current.name).trim()
    const category = String(payload.category ?? current.category).trim() || "业务管理"
    const description = String(payload.description ?? current.description).trim()
    if (!name) throw new ModelBuilderError(400, "请填写模型名称")
    const duplicate = await query("SELECT 1 FROM models WHERE lower(name)=lower($1) AND id<>$2", [name, current.model_id])
    if (duplicate.rowCount) throw new ModelBuilderError(409, "模型名称已存在")
    await query("UPDATE models SET name=$1,category=$2,description=$3 WHERE id=$4", [name, category, description, current.model_id])
    await query("UPDATE model_projects SET suggestion=$1,stage='suggestion',test_passed=false,status=CASE WHEN status='published' THEN 'draft' ELSE status END,updated_at=now() WHERE id=$2", [JSON.stringify({ ...payload, name, category, description }), projectId])
    await query("UPDATE models SET can_start=false WHERE id=$1", [current.model_id])
  } else if (stage === "design") {
    const nodes = asArray<any>(payload.nodes)
    if (nodes.some(node => node?.type === "approval")) throw new ModelBuilderError(400, "审批不是运行节点。请删除审批节点，并在配置阶段设置“归档后触发独立审批模型”")
    const fields = asArray<BuilderField>(payload.fields)
    const approvalDesign = String(current.suggestion?.modelType ?? "business") === "approval"
    const identifierPattern = /^[\p{L}_][\p{L}\p{N}_]*$/u
    const keys = new Set<string>()
    for (const field of fields) {
      if (!field.label?.trim()) throw new ModelBuilderError(400, "表单字段名称不能为空")
      if (field.type === "section") continue
      if (!field.key?.trim()) throw new ModelBuilderError(400, `字段 ${field.label} 的字段标识不能为空`)
      if (!identifierPattern.test(field.key)) throw new ModelBuilderError(400, `字段标识 ${field.key} 格式不正确`)
      if (approvalDesign && /[A-Za-z]/.test(field.key)) throw new ModelBuilderError(400, `审批模型字段“${field.label}”必须使用中文字段名称，不得设置英文字段标识`)
      if (keys.has(field.key)) throw new ModelBuilderError(400, `字段标识 ${field.key} 重复`)
      keys.add(field.key)
      if (!isDigitalIdentifier(field.digitalId)) throw new ModelBuilderError(400, `字段“${field.label}”必须配置有效数字化标识（当前19位；历史16位兼容）。数字化库的列由数字化标识定义。`)
      if (["library_select","library_multi_select","library_fill"].includes(String(field.sourceMode ?? ""))) {
        if (!String(field.linkage?.sourceLibraryId ?? field.linkage?.sourceLibrary ?? "").trim()) throw new ModelBuilderError(400, `字段“${field.label}”尚未选择数据源数字化库`)
        if (!isDigitalIdentifier(field.linkage?.sourceDigitalId ?? field.linkage?.sourceField)) throw new ModelBuilderError(400, `字段“${field.label}”尚未选择有效数据源数字化标识`)
      }
      const libraryChoiceTypes = new Set(["select","radio","checkbox","dataSelect","dataMultiSelect"])
      if (libraryChoiceTypes.has(String(field.type))) {
        const expectedMode = ["checkbox","dataMultiSelect"].includes(String(field.type)) ? "library_multi_select" : "library_select"
        if (String(field.sourceMode ?? "") !== expectedMode) throw new ModelBuilderError(400, `字段“${field.label}”属于选择类字段，选项必须来自数字化库对应模型的运行记录`)
        if (!String(field.linkage?.sourceLibraryId ?? field.linkage?.sourceLibrary ?? "").trim() || !isDigitalIdentifier(field.linkage?.sourceDigitalId ?? field.linkage?.sourceField)) throw new ModelBuilderError(400, `字段“${field.label}”必须配置“数字化库 → 数字化标识”作为选项来源`)
      }
      if (["user","department"].includes(String(field.type)) && !["current_user","library_select","library_multi_select","library_fill"].includes(String(field.sourceMode ?? ""))) {
        throw new ModelBuilderError(400, `字段“${field.label}”属于人员/组织选择字段，应从人员或部门数字化库选择，或由当前登录人员/联动自动带入`)
      }
      if (field.type === "subform") {
        const subKeys = new Set<string>()
        for (const sub of asArray<BuilderSubField>(field.subFields)) {
          if (!sub.label?.trim() || !sub.key?.trim()) throw new ModelBuilderError(400, `子表单 ${field.label} 的明细字段名称和标识不能为空`)
          if (!identifierPattern.test(sub.key)) throw new ModelBuilderError(400, `子表单字段标识 ${sub.key} 格式不正确`)
          if (approvalDesign && /[A-Za-z]/.test(sub.key)) throw new ModelBuilderError(400, `审批模型子表单字段“${sub.label}”必须使用中文字段名称`)
          if (subKeys.has(sub.key)) throw new ModelBuilderError(400, `子表单字段标识 ${sub.key} 重复`)
          subKeys.add(sub.key)
        }
      }
    }
    if (approvalDesign) {
      const approvalConfig = plainObject(payload.approvalSettings)
      const approvalSteps = asArray<any>(approvalConfig.steps)
      if (!approvalSteps.length) throw new ModelBuilderError(400, "审批模型至少需要配置一个审批步骤")
      for (const [index, step] of approvalSteps.entries()) {
        const title = String(step?.title ?? "").trim()
        const scope = String(step?.assigneeScope ?? "")
        const role = String(step?.role ?? "").trim()
        const userName = String(step?.userName ?? "").trim()
        if (!title) throw new ModelBuilderError(400, `第 ${index + 1} 个审批步骤名称不能为空`)
        if (!["global_role", "department_role", "named_user"].includes(scope)) throw new ModelBuilderError(400, `${title} 的负责人范围配置无效`)
        if (scope === "named_user" ? !userName : !role) throw new ModelBuilderError(400, `${title} 尚未配置审批负责人`)
      }
    }
    const parameterNames = new Set<string>()
    for (const raw of asArray<any>(payload.parameters)) {
      const name = String(raw?.name ?? "").trim()
      if (!name || !identifierPattern.test(name)) throw new ModelBuilderError(400, `参数名称 ${name || "(空)"} 格式不正确`)
      if (approvalDesign && /[A-Za-z]/.test(name)) throw new ModelBuilderError(400, `审批模型参数“${name}”必须使用中文名称`)
      if (parameterNames.has(name)) throw new ModelBuilderError(400, `参数名称 ${name} 重复`)
      parameterNames.add(name)
    }
    const expressionTargets = new Set<string>()
    for (const item of asArray<Expression>(payload.expressions)) {
      const target = String(item?.targetKey ?? "").trim()
      if (!target || !identifierPattern.test(target)) throw new ModelBuilderError(400, `公式结果标识 ${target || "(空)"} 格式不正确`)
      if (approvalDesign && /[A-Za-z]/.test(target)) throw new ModelBuilderError(400, `审批模型公式结果“${target}”必须使用中文名称`)
      if (expressionTargets.has(target)) throw new ModelBuilderError(400, `公式结果标识 ${target} 重复`)
      if (!String(item?.expression ?? "").trim()) throw new ModelBuilderError(400, `公式结果 ${target} 缺少表达式`)
      expressionTargets.add(target)
    }
    for (const item of asArray<Calculation>(payload.calculations)) {
      const target=String(item?.targetKey ?? "").trim()
      if (!target || !identifierPattern.test(target)) throw new ModelBuilderError(400, `运算结果名称 ${target || "(空)"} 格式不正确`)
      if (approvalDesign && /[A-Za-z]/.test(target)) throw new ModelBuilderError(400, `审批模型运算结果“${target}”必须使用中文名称`)
    }
    for (const rawKey of asArray<string>(payload.outputKeys)) {
      const key=String(rawKey ?? "").trim()
      if (!key || !identifierPattern.test(key)) throw new ModelBuilderError(400, `输出字段名称 ${key || "(空)"} 格式不正确`)
      if (approvalDesign && /[A-Za-z]/.test(key)) throw new ModelBuilderError(400, `审批模型输出字段“${key}”必须使用中文名称`)
    }
    await query("UPDATE model_projects SET design=$1,stage='design',test_passed=false,test_report='{}'::jsonb,status=CASE WHEN status='published' THEN 'draft' ELSE status END,updated_at=now() WHERE id=$2", [JSON.stringify(payload), projectId])
    // 数据源关系独立结构化保存。设计 JSON 负责界面恢复；model_field_sources 负责运行时和治理查询。
    await query("DELETE FROM model_field_sources WHERE project_id=$1", [projectId])
    for (const field of fields.filter(item => item.type !== "section")) {
      const targetDid = isDigitalIdentifier(field.digitalId) ? await query<{ id: string }>("SELECT id FROM digital_identifiers WHERE code=$1 LIMIT 1", [field.digitalId]) : null
      const sourceCode = String(field.linkage?.sourceDigitalId ?? field.linkage?.sourceField ?? "").trim()
      const matchCode = String(field.linkage?.matchDigitalId ?? field.linkage?.matchField ?? "").trim()
      const sourceDid = isDigitalIdentifier(sourceCode) ? await query<{ id: string }>("SELECT id FROM digital_identifiers WHERE code=$1 LIMIT 1", [sourceCode]) : null
      const matchDid = isDigitalIdentifier(matchCode) ? await query<{ id: string }>("SELECT id FROM digital_identifiers WHERE code=$1 LIMIT 1", [matchCode]) : null
      const sourceLibraryId = String(field.linkage?.sourceLibraryId ?? "").trim() || null
      await query(`INSERT INTO model_field_sources(id,project_id,field_id,field_key,target_digital_identifier_id,source_library_id,source_digital_identifier_id,match_digital_identifier_id,source_mode)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [randomUUID(), projectId, field.id, field.key, targetDid?.rows[0]?.id ?? null, sourceLibraryId, sourceDid?.rows[0]?.id ?? null, matchDid?.rows[0]?.id ?? null, String(field.sourceMode ?? "manual")])
    }
    await query("UPDATE models SET can_start=false WHERE id=$1", [current.model_id])
  } else if (stage === "test") {
    const cases = asArray<TestCase>(payload.cases)
    await query("UPDATE model_projects SET test_data=$1,stage='test',test_passed=false,status='testing',updated_at=now() WHERE id=$2", [JSON.stringify({ cases }), projectId])
    await query("UPDATE models SET can_start=false WHERE id=$1", [current.model_id])
  } else {
    await query("UPDATE model_projects SET configuration=$1,stage='config',status=CASE WHEN test_passed THEN 'ready' ELSE status END,updated_at=now() WHERE id=$2", [JSON.stringify(payload), projectId])
    await query("UPDATE models SET can_start=false WHERE id=$1", [current.model_id])
  }
  return getProject(projectId)
}

function fieldVisible(field: BuilderField, input: Record<string, unknown>) {
  if (field.permissions?.visible === false) return false
  const rule = field.visibleWhen
  if (!rule?.fieldKey) return true
  const actual = input[rule.fieldKey]
  if (rule.operator === "notEmpty") return !isEmpty(actual)
  if (rule.operator === "contains") return String(actual ?? "").includes(String(rule.value ?? ""))
  if (rule.operator === "neq") return String(actual ?? "") !== String(rule.value ?? "")
  return String(actual ?? "") === String(rule.value ?? "")
}

function validateSimpleField(field: Pick<BuilderField, "label" | "type" | "required" | "options" | "minLength" | "maxLength" | "min" | "max" | "pattern" | "linkage">, value: unknown) {
  const errors: string[] = []
  if (field.required && isEmpty(value)) errors.push(`${field.label}不能为空`)
  if (isEmpty(value)) return errors
  if (field.type === "number") {
    const numberValue = Number(value)
    if (!Number.isFinite(numberValue)) errors.push(`${field.label}必须为数字`)
    else {
      if (field.min !== undefined && numberValue < field.min) errors.push(`${field.label}不能小于${field.min}`)
      if (field.max !== undefined && numberValue > field.max) errors.push(`${field.label}不能大于${field.max}`)
    }
  }
  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) errors.push(`${field.label}日期格式不正确`)
  if (["select", "radio"].includes(field.type) && field.linkage?.mode !== "options" && field.options?.length && !field.options.includes(String(value))) errors.push(`${field.label}选项无效`)
  if (field.type === "checkbox" && field.linkage?.mode !== "options" && field.options?.length) {
    const values = Array.isArray(value) ? value.map(String) : [String(value)]
    if (values.some(item => !field.options!.includes(item))) errors.push(`${field.label}选项无效`)
  }
  if (["text", "textarea"].includes(field.type)) {
    const text = String(value)
    if (field.minLength !== undefined && text.length < field.minLength) errors.push(`${field.label}至少需要${field.minLength}个字符`)
    if (field.maxLength !== undefined && text.length > field.maxLength) errors.push(`${field.label}不能超过${field.maxLength}个字符`)
    if (field.pattern) {
      try { if (!new RegExp(field.pattern).test(text)) errors.push(`${field.label}格式不正确`) }
      catch { errors.push(`${field.label}的校验表达式无效`) }
    }
  }
  return errors
}

function validateInput(fields: BuilderField[], input: Record<string, unknown>) {
  const errors: string[] = []
  for (const field of fields) {
    if (field.type === "section" || !fieldVisible(field, input)) continue
    const value = input[field.key]
    if (field.type === "subform") {
      if (field.required && (!Array.isArray(value) || value.length === 0)) errors.push(`${field.label}不能为空`)
      if (value !== undefined && value !== null && !Array.isArray(value)) { errors.push(`${field.label}必须为明细列表`); continue }
      for (const [index, rawRow] of asArray<unknown>(value).entries()) {
        const row = plainObject(rawRow)
        for (const sub of asArray<BuilderSubField>(field.subFields)) {
          errors.push(...validateSimpleField({ ...sub, label: `${field.label}第${index + 1}行-${sub.label}` }, row[sub.key]))
        }
      }
      continue
    }
    errors.push(...validateSimpleField(field, value))
  }
  return errors
}

function applyCalculation(calc: Calculation, values: Record<string, unknown>) {
  const sources = calc.sourceKeys.map(key => values[key])
  if (calc.operation === "dateDiffInclusive") {
    const start = dateOnlyUtc(sources[0]); const end = dateOnlyUtc(sources[1])
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new ModelBuilderError(422, `${calc.label ?? calc.targetKey}计算失败：结束日期不能早于开始日期`)
    return Math.floor((end - start) / 86400000) + 1
  }
  if (calc.operation === "sum") return sources.reduce<number>((sum, value) => sum + numeric(value), 0)
  if (calc.operation === "difference") return numeric(sources[0]) - numeric(sources[1])
  if (calc.operation === "concat") return sources.map(value => String(value ?? "")).join(calc.separator ?? "")
  return sources[0] ?? ""
}

function ruleMatches(rule: Rule, value: unknown) {
  const expected = rule.value
  if (rule.operator === "notEmpty") return !isEmpty(value)
  if (rule.operator === "contains") return String(value ?? "").includes(String(expected ?? ""))
  if (rule.operator === "eq") return String(value ?? "") === String(expected ?? "")
  if (rule.operator === "neq") return String(value ?? "") !== String(expected ?? "")
  if (rule.operator === "gt") return numeric(value) > numeric(expected)
  if (rule.operator === "gte") return numeric(value) >= numeric(expected)
  if (rule.operator === "lt") return numeric(value) < numeric(expected)
  if (rule.operator === "lte") return numeric(value) <= numeric(expected)
  return false
}
function applyAction(action: RuleAction | undefined, output: Record<string, unknown>) { if (action?.type === "setOutput" && action.key) output[action.key] = action.value }

export function executeDesign(designValue: unknown, inputValue: unknown) {
  const design = plainObject(designValue); const input = plainObject(inputValue)
  const fields = asArray<BuilderField>(design.fields)
  const errors = validateInput(fields, input)
  if (errors.length) return { valid: false, errors, values: input, output: {} as Record<string, unknown> }
  const values: Record<string, unknown> = { ...input }
  try {
    for (const calc of asArray<Calculation>(design.calculations)) values[calc.targetKey] = applyCalculation(calc, values)
    for (const item of asArray<Expression>(design.expressions)) {
      if (!item.targetKey || !item.expression?.trim()) continue
      values[item.targetKey] = evaluateExpression(item.expression, values)
    }
  } catch (error) {
    const message = error instanceof ExpressionError ? `公式计算失败：${error.message}` : error instanceof Error ? error.message : "运算失败"
    return { valid: false, errors: [message], values, output: {} as Record<string, unknown> }
  }
  const output: Record<string, unknown> = {}
  const configuredOutputKeys = new Set<string>([
    ...asArray<string>(design.outputKeys).map(String),
    ...Object.keys(plainObject(design.outputDigitalMap)),
  ])
  for (const key of configuredOutputKeys) if (key in values) output[key] = values[key]
  for (const rule of asArray<Rule>(design.rules)) {
    const matched = ruleMatches(rule, values[rule.fieldKey])
    applyAction(matched ? rule.then : rule.else, output)
  }
  return { valid: true, errors: [] as string[], values, output }
}

function subsetEquals(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value))
}

export async function runTests(userId: string, projectId: string, casesOverride?: unknown) {
  const row = await fetchProject("p.id=$1", projectId)
  if (!row) throw new ModelBuilderError(404, "模型建设项目不存在")
  const submittedTest = await query<{ stage_run_id: string | null }>("SELECT stage_run_id FROM model_build_stage_runs WHERE target_project_id=$1 AND stage_key='test'", [projectId])
  if (submittedTest.rows[0]?.stage_run_id) throw new ModelBuilderError(409, "模型测试模型已经归档，不能覆盖该次测试结果；请按新版本重新建设。")
  const testCases = casesOverride ? asArray<TestCase>(casesOverride) : asArray<TestCase>(row.test_data?.cases)
  if (!testCases.length) throw new ModelBuilderError(400, "请至少配置一个测试用例")
  const results = await Promise.all(testCases.map(async item => {
    const run = executeDesign(row.design, item.input)
    const actualOutput = { ...run.output }
    if (run.valid && modelTypeOf(row) === "smart") Object.assign(actualOutput, await smartAssociationSummary(plainObject(item.input), actualOutput))
    const expectValid = item.expectValid !== false
    const validMatched = run.valid === expectValid
    const outputMatched = !expectValid || subsetEquals(actualOutput, plainObject(item.expectedOutput))
    return { id: item.id, name: item.name, passed: validMatched && outputMatched, expectedValid: expectValid, actualValid: run.valid, expectedOutput: item.expectedOutput ?? {}, actualOutput, errors: run.errors }
  }))
  const passed = results.every(item => item.passed)
  const report = { passed, executedAt: new Date().toISOString(), total: results.length, passedCount: results.filter(x => x.passed).length, results }
  await query("UPDATE model_projects SET test_data=$1,test_report=$2,test_passed=$3,status=$4,stage='test',updated_at=now() WHERE id=$5", [JSON.stringify({ cases: testCases }), JSON.stringify(report), passed, passed ? "ready" : "testing", projectId])
  return report
}

function graphProblems(design: Record<string, unknown>) {
  const nodes = asArray<any>(design.nodes); const edges = asArray<FlowEdge>(design.edges)
  if (!nodes.length) return ["设计阶段缺少运行节点"]
  if (nodes.some(node => node?.type === "approval")) return ["运行结构中不能使用审批节点；审批必须建设为独立模型，并通过归档后模型关系触发"]
  const ids = new Set(nodes.map(node => String(node?.id ?? "")).filter(Boolean))
  const problems: string[] = []
  if (edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) problems.push("运行结构存在指向不存在节点的连线")
  const incoming = new Map<string, number>(); const outgoing = new Map<string, string[]>()
  nodes.forEach(node => { incoming.set(node.id, 0); outgoing.set(node.id, []) })
  edges.forEach(edge => { incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1); outgoing.get(edge.source)?.push(edge.target) })
  const starts = nodes.filter(node => (incoming.get(node.id) ?? 0) === 0)
  if (nodes.length > 1 && starts.length !== 1) problems.push(`运行结构应只有 1 个起始节点，当前为 ${starts.length} 个`)
  if (starts.length === 1) {
    const visited = new Set<string>(); const stack = [starts[0].id]
    while (stack.length) { const id = stack.pop()!; if (visited.has(id)) continue; visited.add(id); for (const next of outgoing.get(id) ?? []) stack.push(next) }
    if (visited.size !== nodes.length) problems.push("运行结构存在未接入主流程的孤立节点")
  }
  for (const node of nodes) {
    const outs = edges.filter(edge => edge.source === node.id)
    if (node.type === "output" && outs.length) problems.push(`输出存储节点“${node.title ?? node.id}”不能继续连接后续节点`)
    if (node.type === "condition") {
      if (outs.length !== 2) problems.push(`判断节点“${node.title ?? node.id}”必须同时配置“是/否”两条分支`)
      const handles = outs.map(edge => String(edge.sourceHandle ?? ""))
      if (handles.some(handle => !["true", "false"].includes(handle)) || new Set(handles).size !== handles.length) problems.push(`判断节点“${node.title ?? node.id}”的出口必须分别使用“是/否”分支`)
    } else if (node.type !== "output" && outs.length !== 1) problems.push(`普通节点“${node.title ?? node.id}”必须且只能有一条后续连线`)
  }
  const visiting = new Set<string>(); const finished = new Set<string>(); let cycle = false
  const walk = (id: string) => { if (visiting.has(id)) { cycle = true; return }; if (finished.has(id) || cycle) return; visiting.add(id); for (const next of outgoing.get(id) ?? []) walk(next); visiting.delete(id); finished.add(id) }
  nodes.forEach(node => walk(node.id))
  if (cycle) problems.push("运行结构不能形成循环连线")
  return problems
}

export async function publishProject(userId: string, projectId: string) {
  const row = await fetchProject("p.id=$1", projectId)
  if (!row) throw new ModelBuilderError(404, "模型建设项目不存在")
  const suggestion = plainObject(row.suggestion); const design = plainObject(row.design); const config = plainObject(row.configuration)
  const problems: string[] = []
  if (!String(suggestion.goal ?? "").trim()) problems.push("建议阶段缺少模型目标")
  if (!String(suggestion.scope ?? "").trim()) problems.push("建议阶段缺少适用范围")
  if (!asArray<BuilderField>(design.fields).some(field => field.type !== "section")) problems.push("设计阶段至少需要一个数据字段")
  if (!asArray<any>(design.nodes).some(n => n?.type === "output")) problems.push("设计阶段缺少输出存储节点")
  problems.push(...graphProblems(design))
  if (!row.test_passed) problems.push("测试阶段尚未通过")
  if (!String(config.storageName ?? "").trim()) problems.push("配置阶段缺少本模型数字化库名称")
  const ids = asArray<string>(config.digitalIdentities).map(v => String(v).trim()).filter(Boolean)
  if (!isCurrentModelDigitalCode(config.modelCode)) problems.push("模型数字化编码必须符合当前19位结构")
  if (!ids.length || ids.some(id => !isDigitalIdentifier(id))) problems.push("数字化标识必须符合当前19位结构（历史16位兼容）")
  const startModes = asArray<string>(config.startModes).map(String).filter(Boolean)
  if (!startModes.length) problems.push("配置阶段至少需要一种模型启动方式")
  // V16 起，四个建设环节是四个独立模型。对已经进入新运行机制的建设项目，发布前必须完成四个 M→审批→智选 闭环。
  const stageRunCount = await query<{ count: string }>("SELECT count(*)::text AS count FROM model_build_stage_runs WHERE target_project_id=$1", [projectId])
  if (Number(stageRunCount.rows[0]?.count ?? 0) > 0) {
    const stageStatuses = await listBuildStageExecutions(projectId)
    for (const item of stageStatuses) if (item.status !== "已完成") problems.push(`${item.stageModelName}尚未完成“本模型 → 审批模型 → 智选模型”闭环`)
  }
  if (modelTypeOf(row) === "business") {
    const existingRelations = configRelations(config).filter(item => String(item.targetModelName ?? "").trim() !== "审批模型")
    config.relations = [mandatoryBusinessApprovalRelation(), ...existingRelations]
    config.afterArchiveEnabled = true
    config.nextModelName = "审批模型"
  }
  if (modelTypeOf(row) === "approval") {
    const existingRelations = configRelations(config).filter(item => String(item.targetModelName ?? "").trim() !== "智选模型")
    config.relations = [mandatoryApprovalSmartRelation(), ...existingRelations]
    config.afterArchiveEnabled = true
    config.nextModelName = "智选模型"
  }
  const relations = configRelations(config)
  for (const relation of relations.filter(item => item.enabled !== false)) {
    const nextModelName = String(relation.targetModelName ?? "").trim()
    if (!nextModelName) { problems.push("模型关系已启用但未选择目标模型"); continue }
    if (nextModelName === row.name) { problems.push("模型关系不能再次触发当前模型自身"); continue }
    if (!(["hard_link","smart"] as string[]).includes(String(relation.mode ?? "hard_link"))) problems.push(`模型关系“${relation.description || nextModelName}”的触发方式无效`)
    const target = await fetchProject("m.name=$1", nextModelName)
    if (!target) problems.push(`目标模型“${nextModelName}”不存在或尚未完成四阶段建设`)
    else if (target.status !== "published") problems.push(`目标模型“${nextModelName}”尚未发布`)
    else {
      const targetStartModes = asArray<string>(plainObject(target.configuration).startModes).map(String)
      const requiredMode = relation.mode === "smart" ? "smart" : "hard_link"
      const mandatoryBusinessApproval = modelTypeOf(row) === "business" && nextModelName === "审批模型" && requiredMode === "hard_link"
      const mandatoryApprovalSmart = modelTypeOf(row) === "approval" && nextModelName === "智选模型" && requiredMode === "hard_link"
      if (targetStartModes.length && !targetStartModes.includes(requiredMode) && !mandatoryBusinessApproval && !mandatoryApprovalSmart) problems.push(`目标模型“${nextModelName}”未配置“${requiredMode}”启动方式，不能使用当前模型关系触发`)
      const targetIds = asArray<string>(plainObject(target.configuration).digitalIdentities).map(String).filter(isDigitalIdentifier)
      relation.targetDigitalId = targetIds[targetIds.length - 1] ?? ""
    }
  }
  if (problems.length) throw new ModelBuilderError(400, problems.join("；"))
  await query("UPDATE model_projects SET stage='config',status='published',configuration=$2,published_at=now(),updated_at=now() WHERE id=$1", [projectId, JSON.stringify(config)])
  await ensureModelDigitalLibrary(projectId)
  await query("UPDATE models SET can_start=true WHERE id=$1", [row.model_id])
  return getProject(projectId)
}

type TriggerMode = "manual" | "hard_link" | "smart" | "schedule" | "quantity"
type RelationOperator = "always" | "eq" | "neq" | "contains" | "notEmpty" | "gt" | "gte" | "lt" | "lte"
type ModelRelation = { id?: string; enabled?: boolean; mode?: "hard_link" | "smart"; targetModelName?: string; targetDigitalId?: string; condition?: { fieldKey?: string; operator?: RelationOperator; value?: unknown }; description?: string }
type RunOptions = { triggerMode?: TriggerMode; sourceDepth?: number; systemLink?: "business_to_approval" | "approval_to_smart" }

function configRelations(configValue: unknown): ModelRelation[] {
  const config = plainObject(configValue)
  const configured = asArray<ModelRelation>(config.relations)
  if (configured.length) return configured
  if (Boolean(config.afterArchiveEnabled) && String(config.nextModelName ?? "").trim()) return [{ id: "legacy-relation", enabled: true, mode: "hard_link", targetModelName: String(config.nextModelName), condition: { operator: "always" }, description: "兼容旧版归档后模型关系" }]
  return []
}

function mandatoryBusinessApprovalRelation(): ModelRelation {
  return { id: "system-business-approval", enabled: true, mode: "hard_link", targetModelName: "审批模型", condition: { fieldKey: "", operator: "always", value: "" }, description: "系统固定链路：业务模型数字化库正式入库后必须启动通用审批模型" }
}

function mandatoryApprovalSmartRelation(): ModelRelation {
  return { id: "system-approval-smart", enabled: true, mode: "hard_link", targetModelName: "智选模型", condition: { fieldKey: "", operator: "always", value: "" }, description: "系统固定链路：审批模型数字化库正式入库后必须启动通用智选模型" }
}

function archiveRelations(row: ProjectRow, input: Record<string, unknown>, output: Record<string, unknown>): ModelRelation[] {
  const type = modelTypeOf(row)
  if (type === "smart") return []
  const configured = configRelations(runConfig(row)).filter(item => item.enabled !== false && item.mode !== "smart" && relationMatches(item, input, output))
  if (type === "business") {
    // 业务 → 审批属于模型簇系统硬性链接。历史项目即使缺少 relations、afterArchiveEnabled 或被误删关系，
    // 只要本次业务已经正式写入业务模型数字化库，就必须启动通用审批模型。
    const otherRelations = configured.filter(item => String(item.targetModelName ?? "").trim() !== "审批模型")
    return [mandatoryBusinessApprovalRelation(), ...otherRelations]
  }
  if (type !== "approval") return configured
  // 审批 → 智选属于模型簇系统硬性链接，不允许因历史配置缺失、删除、禁用或版本升级未刷新而断链。
  // 配置中如存在智选关系，仅作为可见配置快照；真正执行时统一使用系统固定关系，并避免重复触发。
  const otherRelations = configured.filter(item => String(item.targetModelName ?? "").trim() !== "智选模型")
  return [mandatoryApprovalSmartRelation(), ...otherRelations]
}
function relationMatches(relation: ModelRelation, input: Record<string, unknown>, output: Record<string, unknown>) {
  const condition = relation.condition ?? {}
  const op = condition.operator ?? "always"
  if (op === "always") return true
  const values = { ...input, ...output }
  const actual = values[String(condition.fieldKey ?? "")]
  const expected = condition.value
  if (op === "notEmpty") return !isEmpty(actual)
  if (op === "contains") return String(actual ?? "").includes(String(expected ?? ""))
  if (op === "eq") return String(actual ?? "") === String(expected ?? "")
  if (op === "neq") return String(actual ?? "") !== String(expected ?? "")
  if (op === "gt") return numeric(actual) > numeric(expected)
  if (op === "gte") return numeric(actual) >= numeric(expected)
  if (op === "lt") return numeric(actual) < numeric(expected)
  if (op === "lte") return numeric(actual) <= numeric(expected)
  return false
}
type RuntimeTodo = { id: string; title: string; model: string; sender: string; date: string; status: string; content: string; ownerId?: string }
type RunResult = { todo?: RuntimeTodo | null; fileName: string; displayFileName: string; digitalId: string; output: Record<string, unknown>; runId: string; archived: boolean; triggeredModel?: string; triggeredModels?: string[]; triggerError?: string }

function modelTypeOf(row: ProjectRow) { return String(row.suggestion?.modelType ?? "business") }
function runConfig(row: ProjectRow) { return plainObject(row.configuration) }
function runDigitalId(row: ProjectRow) { const ids = asArray<string>(runConfig(row).digitalIdentities).map(String).filter(Boolean); return ids[ids.length - 1] ?? "" }
async function runFileNames(row: ProjectRow, user: BuilderUser) {
  const modelCode = String(runConfig(row).modelCode ?? "").trim()
  if (!isCurrentModelDigitalCode(modelCode)) throw new ModelBuilderError(409, `模型“${row.name}”未配置当前19位模型数字化编码，禁止继续生成旧格式模型文件名`)
  const employeeCode = isCurrentEmployeeDigitalCode(user.employee_code) ? String(user.employee_code) : await getEmployeeDigitalCode(user.id)
  const now = new Date()
  const baseStamp = timeCode(now)
  const candidates = [
    baseStamp,
    `${baseStamp}${String(now.getMilliseconds()).padStart(3,"0")}`,
    ...Array.from({length:999},(_,index)=>`${baseStamp}${String(now.getMilliseconds()).padStart(3,"0")}${String(index+1).padStart(3,"0")}`),
  ]
  for (const stamp of candidates) {
    const fileName = buildRuntimeFileName(modelCode, employeeCode, stamp)
    const exists = await query<{ exists:boolean }>("SELECT EXISTS(SELECT 1 FROM model_runs WHERE file_name=$1) AS exists",[fileName])
    if (!exists.rows[0]?.exists) return { fileName, displayFileName: buildDisplayFileName(row.name, user.display_name, stamp) }
  }
  throw new ModelBuilderError(409,"同一模型、人员和时间窗口内运行次数超过文件名时间码容量，请稍后重试")
}
function approvalSettings(row: ProjectRow) { return plainObject(row.design?.approvalSettings) }
type ApprovalStepDefinition = {
  id: string
  title: string
  approvalType?: string
  assigneeScope?: "global_role" | "department_role" | "named_user" | "legacy"
  role?: string
  roleLabel?: string
  departmentField?: string
  userName?: string
  organizationName?: string
  organizationRank?: string
  requirement?: string
  timeoutHours?: number
  timeoutValue?: string
  reminderRule?: string
  outputField?: string
  evidence?: Record<string, unknown>
}

type BusinessFieldDefinition = { key: string; label: string; digitalId?: string; type?: string; order: number }
type SourceBusinessContext = {
  sourceRunId: string
  sourceProjectId: string
  modelName: string
  modelCode: string
  fileName: string
  displayFileName: string
  digitalId: string
  businessFields: BusinessFieldDefinition[]
  businessData: Record<string, unknown>
  identifierValues: Record<string, unknown>
  input: Record<string, unknown>
  output: Record<string, unknown>
}

function approvalStepDefinitions(row: ProjectRow, output: Record<string, unknown>): ApprovalStepDefinition[] {
  const resolved = asArray<any>(output.approvalResolvedSteps).map((item, index) => ({
    id: String(item?.id ?? `resolved-step-${index + 1}`),
    title: String(item?.title ?? `审批步骤${index + 1}`).trim(),
    approvalType: String(item?.approvalType ?? ""),
    assigneeScope: ["global_role", "department_role", "named_user"].includes(String(item?.assigneeScope)) ? item.assigneeScope : "legacy",
    role: String(item?.role ?? ""),
    roleLabel: String(item?.roleLabel ?? ""),
    departmentField: String(item?.departmentField ?? "department"),
    userName: String(item?.userName ?? ""),
    organizationName: String(item?.organizationName ?? ""),
    organizationRank: String(item?.organizationRank ?? ""),
    requirement: String(item?.requirement ?? ""),
    timeoutHours: Number(item?.timeoutHours ?? 0),
    timeoutValue: String(item?.timeoutValue ?? ""),
    reminderRule: String(item?.reminderRule ?? ""),
    outputField: String(item?.outputField ?? ""),
    evidence: plainObject(item?.evidence),
  })).filter(item => item.title)
  if (resolved.length) return resolved
  const settings = approvalSettings(row)
  const configured = asArray<any>(settings.steps).map((item, index) => ({
    id: String(item?.id ?? `approval-step-${index + 1}`),
    title: String(item?.title ?? item?.name ?? `审批步骤${index + 1}`).trim(),
    approvalType: String(item?.approvalType ?? ""),
    assigneeScope: ["global_role", "department_role", "named_user"].includes(String(item?.assigneeScope)) ? item.assigneeScope : "legacy",
    role: String(item?.role ?? ""),
    roleLabel: String(item?.roleLabel ?? ""),
    departmentField: String(item?.departmentField ?? "department"),
    userName: String(item?.userName ?? ""),
    organizationName: String(item?.organizationName ?? ""),
    organizationRank: String(item?.organizationRank ?? ""),
    requirement: String(item?.requirement ?? ""),
    timeoutHours: Number(item?.timeoutHours ?? 0),
    timeoutValue: String(item?.timeoutValue ?? ""),
    reminderRule: String(item?.reminderRule ?? ""),
    outputField: String(item?.outputField ?? ""),
    evidence: plainObject(item?.evidence),
  })).filter(item => item.title)
  if (configured.length) return configured
  const key = String(settings.routeOutputKey ?? "正式审批路径")
  return String(output[key] ?? output.approvalRoute ?? "").split(/\s*→\s*/).map((title, index) => ({ id: `legacy-${index + 1}`, title: title.trim(), assigneeScope: "legacy" as const })).filter(item => item.title)
}
function routeSteps(row: ProjectRow, output: Record<string, unknown>) { return approvalStepDefinitions(row, output).map(item => item.title) }
function dateText() { return new Date().toISOString().slice(0, 16).replace("T", " ") }

type StandardRecord = { values: Record<string, unknown>; data: Record<string, unknown> }
async function standardRecords(libraryId: string): Promise<StandardRecord[]> {
  if (!libraryId) return []
  const result = await query<any>("SELECT identifier_values,data FROM digital_library_records WHERE library_id=$1 ORDER BY created_at DESC LIMIT 1000", [libraryId])
  return result.rows.map((row:any) => ({ values: plainObject(row.identifier_values), data: plainObject(row.data) }))
}
function valueText(record: StandardRecord | undefined, digitalId: string) { return String(record?.values?.[digitalId] ?? "").trim() }

async function approvalBusinessCandidates(input: Record<string, unknown>) {
  const values = new Set<string>()
  const add = (value: unknown) => { const text=String(value ?? "").trim(); if (text) values.add(text) }
  add(input.sourceModelName)
  const sourceInput=plainObject(input.sourceInput)
  for (const key of ["businessName","businessDomain","category","业务分类","业务名称"]) add(sourceInput[key])
  const sourceRunId=String(input.sourceRunId ?? "").trim()
  if (sourceRunId) {
    const found=await query<any>(`SELECT m.name,m.category,p.suggestion FROM model_runs r JOIN models m ON m.id=r.model_id JOIN model_projects p ON p.id=r.project_id WHERE r.id=$1 LIMIT 1`,[sourceRunId])
    const row=found.rows[0]
    if (row) { add(row.name); add(row.category); add(plainObject(row.suggestion).category) }
  }
  return [...values]
}

function listText(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map(item=>item.trim()).filter(Boolean)
  const text=String(value ?? "").trim()
  if (!text) return []
  if (text.startsWith("[") && text.endsWith("]")) {
    try { const parsed=JSON.parse(text); if (Array.isArray(parsed)) return parsed.map(String).map(item=>item.trim()).filter(Boolean) } catch { /* plain text fallback */ }
  }
  return text.split(/[,，、;；\n]/).map(item=>item.trim()).filter(Boolean)
}
function recordList(record: StandardRecord | undefined, digitalId: string) { return listText(record?.values?.[digitalId]) }
function intersectsAny(left: string[], right: string[]) { return left.some(item=>right.includes(item)) }
function boolValue(value: unknown) {
  if (value === true || value === 1) return true
  const normalized=String(value ?? "").trim().toLowerCase()
  return ["1","true","是","yes"].includes(normalized)
}
function levelWeight(level: string) {
  const chinese:Record<string,number>={"一级":1,"二级":2,"三级":3,"四级":4,"五级":5,"六级":6,"七级":7,"八级":8,"九级":9}
  if (chinese[level]) return chinese[level]
  const number=Number(level.match(/\d+/)?.[0] ?? NaN)
  return Number.isFinite(number) ? number : 0
}
function higherLevel(base: string, threshold: string) {
  if (!threshold) return base
  if (!base) return threshold
  return levelWeight(threshold) >= levelWeight(base) ? threshold : base
}
function relativeLevelLabel(index:number,type:"administrative"|"technical") {
  const map=["零","一","二","三","四","五","六","七","八","九","十"]
  const numberText=index<=10 ? map[index] : index<20 ? `十${map[index-10]}` : String(index)
  return type === "technical" ? `${numberText}级技术/业务审查` : `${numberText}级审批`
}
async function sourceIdentifierValues(input: Record<string, unknown>) {
  const sourceRunId=String(input.sourceRunId ?? "").trim()
  if (!sourceRunId) return {} as Record<string,unknown>
  const found=await query<any>("SELECT identifier_values FROM digital_library_records WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1",[sourceRunId])
  return plainObject(found.rows[0]?.identifier_values)
}
async function modelDesignLibrarySnapshot(projectId: string) {
  const found=await query<any>(`SELECT d.identifier_values,d.data
    FROM model_build_stage_runs s
    JOIN digital_library_records d ON d.run_id=s.stage_run_id
    WHERE s.target_project_id=$1 AND s.stage_key='design'
    ORDER BY d.created_at DESC LIMIT 1`,[projectId])
  const record=found.rows[0]
  if (!record) return null
  const data=plainObject(record.data)
  const input=plainObject(data.input)
  const stagePayload=plainObject(input.stagePayload)
  return { identifierValues:plainObject(record.identifier_values), stagePayload }
}

function sourceBusinessFields(design: Record<string, unknown>): BusinessFieldDefinition[] {
  const fields=asArray<BuilderField>(design.fields)
  const result:BusinessFieldDefinition[]=[]
  const seen=new Set<string>()
  fields.forEach((field,index)=>{
    if (!field?.key || field.type === "section") return
    const key=String(field.key).trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    result.push({key,label:String(field.label ?? key).trim() || key,digitalId:String(field.digitalId ?? "").trim() || undefined,type:String(field.type ?? "text"),order:index})
  })
  const calculationLabels=new Map<string,string>()
  asArray<Record<string,unknown>>(design.calculations).forEach(item=>{ const key=String(item.targetKey ?? "").trim(); if(key) calculationLabels.set(key,String(item.label ?? key)) })
  asArray<Record<string,unknown>>(design.expressions).forEach(item=>{ const key=String(item.targetKey ?? "").trim(); if(key) calculationLabels.set(key,String(item.label ?? key)) })
  const outputMap=plainObject(design.outputDigitalMap)
  for (const [key,rawDigitalId] of Object.entries(outputMap)) {
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({key,label:calculationLabels.get(key) ?? key,digitalId:String(rawDigitalId ?? "").trim() || undefined,type:"result",order:result.length})
  }
  return result.sort((a,b)=>a.order-b.order)
}

async function sourceBusinessContext(input: Record<string, unknown>): Promise<SourceBusinessContext> {
  const sourceRunId=String(input.sourceRunId ?? "").trim()
  const fallbackInput=plainObject(input.sourceInput)
  const fallbackOutput=plainObject(input.sourceOutput)
  if (!sourceRunId) {
    return {
      sourceRunId:"", sourceProjectId:"", modelName:String(input.sourceModelName ?? "业务事项"), modelCode:"",
      fileName:String(input.sourceFileName ?? ""), displayFileName:String(input.sourceDisplayFileName ?? ""), digitalId:String(input.sourceDigitalId ?? ""),
      businessFields:[], businessData:{...fallbackInput,...fallbackOutput}, identifierValues:{}, input:fallbackInput, output:fallbackOutput,
    }
  }
  const found=await query<any>(`SELECT r.id AS run_id,r.project_id,r.file_name,r.display_file_name,r.digital_id,r.input_data,r.output_data,
      m.name AS model_name,p.design,p.configuration,dlr.identifier_values
    FROM model_runs r
    JOIN models m ON m.id=r.model_id
    LEFT JOIN model_projects p ON p.id=r.project_id
    LEFT JOIN LATERAL (
      SELECT identifier_values FROM digital_library_records WHERE run_id=r.id ORDER BY created_at DESC LIMIT 1
    ) dlr ON true
    WHERE r.id=$1 LIMIT 1`,[sourceRunId])
  const source=found.rows[0]
  if (!source) {
    return {
      sourceRunId, sourceProjectId:"", modelName:String(input.sourceModelName ?? "业务事项"), modelCode:"",
      fileName:String(input.sourceFileName ?? ""), displayFileName:String(input.sourceDisplayFileName ?? ""), digitalId:String(input.sourceDigitalId ?? ""),
      businessFields:[], businessData:{...fallbackInput,...fallbackOutput}, identifierValues:await sourceIdentifierValues(input), input:fallbackInput, output:fallbackOutput,
    }
  }
  const design=plainObject(source.design)
  const config=plainObject(source.configuration)
  const sourceInput=plainObject(source.input_data)
  const sourceOutput=plainObject(source.output_data)
  const identifierValues=plainObject(source.identifier_values)
  const businessFields=sourceBusinessFields(design)
  const businessData:Record<string,unknown>={}
  for (const field of businessFields) {
    const byIdentifier=field.digitalId ? identifierValues[field.digitalId] : undefined
    const value=byIdentifier !== undefined && byIdentifier !== null && byIdentifier !== "" ? byIdentifier : (sourceOutput[field.key] ?? sourceInput[field.key])
    if (value !== undefined && value !== null && value !== "") businessData[field.key]=value
  }
  for (const [key,value] of Object.entries({...sourceInput,...sourceOutput})) {
    if (key.startsWith("source") || key.startsWith("approval")) continue
    if (value !== undefined && value !== null && value !== "" && !(key in businessData)) businessData[key]=value
  }
  return {
    sourceRunId, sourceProjectId:String(source.project_id ?? ""), modelName:String(source.model_name ?? input.sourceModelName ?? "业务事项"),
    modelCode:String(config.modelCode ?? ""), fileName:String(source.file_name ?? input.sourceFileName ?? ""), displayFileName:String(source.display_file_name ?? input.sourceDisplayFileName ?? ""),
    digitalId:String(source.digital_id ?? input.sourceDigitalId ?? ""), businessFields, businessData, identifierValues, input:sourceInput, output:sourceOutput,
  }
}

function recordDataText(record: StandardRecord | undefined, ...keys: string[]) {
  if (!record) return ""
  const data=plainObject(record.data)
  const nestedInput=plainObject(data.input)
  const nestedOutput=plainObject(data.output)
  for (const key of keys) {
    const value=data[key] ?? nestedOutput[key] ?? nestedInput[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ""
}

function approvalNodeRuntimeConfig(rows: StandardRecord[], candidates: string[], nodeType: string, levelOrPosition: string, fallbackRequirement: string) {
  const applicable=rows.filter(item=>{
    const domains=recordList(item,"5013001001110172")
    if (domains.length && !intersectsAny(domains,candidates)) return false
    const configuredType=recordDataText(item,"节点类型","nodeType","审批类型","approvalType")
    const configuredLevel=recordDataText(item,"审批层级/岗位","approvalLevelOrPosition","审批层级","approvalLevel","岗位","position")
    if (configuredType && !nodeType.includes(configuredType) && !configuredType.includes(nodeType)) return false
    if (configuredLevel && levelOrPosition && configuredLevel !== levelOrPosition) return false
    return true
  })
  const scored=applicable.map(item=>{
    const configuredType=recordDataText(item,"节点类型","nodeType","审批类型","approvalType")
    const configuredLevel=recordDataText(item,"审批层级/岗位","approvalLevelOrPosition","审批层级","approvalLevel","岗位","position")
    return {item,score:(configuredType ? 2 : 0)+(configuredLevel ? 4 : 0)}
  }).sort((a,b)=>b.score-a.score)
  const selected=scored[0]?.item
  const timeoutRaw=selected?.values?.["5013001001110171"] ?? recordDataText(selected,"模型时限","timeoutHours")
  const timeoutHours=Number(timeoutRaw ?? NaN)
  return {
    timeoutHours:Number.isFinite(timeoutHours) && timeoutHours>0 ? timeoutHours : 0,
    timeoutValue:String(timeoutRaw ?? "").trim(),
    requirement:recordDataText(selected,"办理要求","审批内容","审查内容","requirement") || fallbackRequirement,
    reminderRule:recordDataText(selected,"提醒规则","时限提醒规则","reminderRule"),
    outputField:recordDataText(selected,"输出字段","outputField") || (nodeType.includes("审查") ? "审查意见" : "审批意见"),
    evidence:{nodeType,levelOrPosition,matchedBusiness:candidates,rule:selected ? "节点类型 + 审批层级/岗位匹配模型时限数字化库" : "未匹配专属节点时限，使用业务范围默认配置",timeoutLibraryId:"lib-standard-model-timeout",timeoutValue:String(timeoutRaw ?? "").trim()},
  }
}
function departmentPath(departmentRows: StandardRecord[], startDepartment: string) {
  const organizationPath:string[]=[]
  const seen=new Set<string>()
  let current=startDepartment.trim()
  while (current && !seen.has(current) && organizationPath.length<20) {
    organizationPath.push(current); seen.add(current)
    const row=departmentRows.find(item=>valueText(item,"5013001001003001")===current)
    const parentDepartment=valueText(row,"5013001001003002")
    current=parentDepartment
  }
  return organizationPath
}
function personRecordInDepartment(personnelRows: StandardRecord[], department: string, rank: string, candidates: string[]) {
  const rows=personnelRows.filter(item=>valueText(item,"5013001001002004")===department && (recordList(item,"5013001001002008").length===0 || intersectsAny(recordList(item,"5013001001002008"),candidates)))
  if (rank) {
    const exact=rows.find(item=>valueText(item,"5013001001002007")===rank)
    if (exact) return exact
  }
  return rows.find(item=>/负责人|正职|经理|主管/.test(valueText(item,"5013001001002007") || valueText(item,"5013001001002009")))
}
function organizationRankWeights(rows: StandardRecord[]) {
  const weights=new Map<string,number>()
  for (const row of rows) {
    const name=valueText(row,"5013001001110154")
    const levelCode=valueText(row,"5013001001110152")
    const rankCode=valueText(row,"5013001001110153")
    const numeric=Number(levelCode.match(/\d+/)?.[0] ?? rankCode.match(/\d+/)?.[0] ?? NaN)
    if (name && Number.isFinite(numeric)) weights.set(name,numeric)
  }
  return weights
}
function personByRankAndBusiness(personnelRows: StandardRecord[], rank: string, candidates: string[]) {
  if (!rank) return ""
  const exact=personnelRows.find(item=>valueText(item,"5013001001002007")===rank && (recordList(item,"5013001001002008").length===0 || intersectsAny(recordList(item,"5013001001002008"),candidates)))
  return valueText(exact,"5013001001002002")
}

async function resolveDigitalApprovalPlan(row: ProjectRow, input: Record<string, unknown>, output: Record<string, unknown>) {
  const settings=approvalSettings(row)
  const ids=plainObject(settings.standardSourceIds)
  // lib-standard-* 仅是历史兼容技术 ID；运行口径统一称“数字化库”。
  const sourceIds={
    administrativeLevel:String(ids.administrativeLevel ?? "lib-standard-admin-approval-selector"),
    businessLevel:String(ids.businessLevel ?? "lib-standard-business-approval-selector"),
    positions:String(ids.positions ?? "lib-standard-position-selector"),
    opinions:String(ids.opinions ?? "lib-standard-approval-opinion"),
    approvalAssignment:String(ids.approvalAssignment ?? "lib-standard-approval-assignment"),
    thresholds:String(ids.thresholds ?? "lib-standard-threshold-config"),
    personnel:String(ids.personnel ?? "lib-standard-person"),
    departments:String(ids.departments ?? "lib-standard-dept"),
    organizationRanks:String(ids.organizationRanks ?? "lib-standard-org-rank"),
    timeout:String(ids.timeout ?? "lib-standard-model-timeout"),
  }
  const businessContext=await sourceBusinessContext(input)
  const currentDesignSnapshot=businessContext.sourceProjectId ? await modelDesignLibrarySnapshot(businessContext.sourceProjectId) : null
  let current0622=null as Awaited<ReturnType<typeof resolveApprovalPlan0622>>
  try {
    current0622=await resolveApprovalPlan0622({
      sourceModelCode:businessContext.modelCode, sourceModelName:businessContext.modelName, sourceRunId:businessContext.sourceRunId, sourceProjectId:businessContext.sourceProjectId,
      sourceFileName:businessContext.fileName, sourceDisplayFileName:businessContext.displayFileName, sourceDigitalId:businessContext.digitalId,
      originatorId:String(input.originatorId ?? row.owner_id ?? ""), originatorName:String(input.originatorName ?? businessContext.businessData.applicant ?? ""),
      businessFields:businessContext.businessFields as Array<Record<string,unknown>>, businessData:businessContext.businessData, identifierValues:businessContext.identifierValues,
      modelDesignSource:currentDesignSnapshot ? "来源业务模型的模型设计模型数字化库" : "来源业务模型已发布设计配置", modelDesignIdentifierValues:currentDesignSnapshot?.identifierValues ?? {},
    })
  } catch (error) {
    const message=error instanceof Error ? error.message : "审批数字化配置计算失败"
    if (["未匹配到模型数字化配置","未匹配到申请人员工数字化配置","未匹配到基础审批级次配置","申请人所属部门未匹配到组织名称数字化配置","治理类组织人员必须在员工信息数字化库中正式维护组织职级"].includes(message)) throw new ModelBuilderError(409,message)
    throw error
  }
  if (current0622) return current0622
  if (businessContext.modelName === "请休假模型") throw new ModelBuilderError(409,"未匹配到基础审批级次配置")
  const candidates=[...new Set([...(await approvalBusinessCandidates(input)),businessContext.modelName].map(item=>String(item).trim()).filter(Boolean))]
  const identifierValues=Object.keys(businessContext.identifierValues).length ? businessContext.identifierValues : await sourceIdentifierValues(input)
  const [adminRows,businessRows,positionRows,opinionRows,assignmentRows,thresholdRows,personnelRows,departmentRows,organizationRankRows,timeoutRows,designSnapshot]=await Promise.all([
    standardRecords(sourceIds.administrativeLevel),standardRecords(sourceIds.businessLevel),standardRecords(sourceIds.positions),standardRecords(sourceIds.opinions),
    standardRecords(sourceIds.approvalAssignment),standardRecords(sourceIds.thresholds),standardRecords(sourceIds.personnel),standardRecords(sourceIds.departments),standardRecords(sourceIds.organizationRanks),standardRecords(sourceIds.timeout),
    Promise.resolve(currentDesignSnapshot),
  ])
  const matches=(record:StandardRecord,did:string)=>candidates.includes(valueText(record,did))
  const admin=adminRows.find(item=>matches(item,"5013001001210101"))
  const business=businessRows.find(item=>matches(item,"5013001001210201"))
  const position=positionRows.find(item=>matches(item,"5013001001210301"))
  const matchingAdminAssignments=assignmentRows.filter(item=>intersectsAny(recordList(item,"5013001001210602"),candidates))
  const matchingTechnicalAssignments=assignmentRows.filter(item=>intersectsAny(recordList(item,"5013001001210603"),candidates))
  const adminAssignment=matchingAdminAssignments[0]
  const technicalAssignment=matchingTechnicalAssignments[0]

  const thresholdVariables=thresholdRows.map(item=>{
    const thresholdType=valueText(item,"5013001001210701")
    const digitalIdentifier=valueText(item,"5013001001210702")
    const thresholdValue=Number(item.values?.["5013001001210703"] ?? NaN)
    const rawActual=identifierValues[digitalIdentifier]
    const actualValue=Number(rawActual ?? NaN)
    const approvalLevel=valueText(item,"5013001001210704")
    return {thresholdType,digitalIdentifier,thresholdValue,actualValue,rawActual,approvalLevel,matched:Boolean(digitalIdentifier) && Number.isFinite(thresholdValue) && Number.isFinite(actualValue) && actualValue>=thresholdValue}
  }).filter(item=>item.matched).sort((a,b)=>a.thresholdValue-b.thresholdValue)

  const thresholdLevelFor=(type:string)=>{
    const normalized=type.trim()
    const rows=thresholdVariables.filter(item=>!normalized || item.thresholdType===normalized)
    return rows.length ? rows[rows.length-1].approvalLevel : ""
  }
  const adminThresholdType=valueText(adminAssignment,"5013001001210604")
  const technicalThresholdType=valueText(technicalAssignment,"5013001001210605")
  const rankWeights=organizationRankWeights(organizationRankRows)
  const compareLevel=(base:string,threshold:string)=>{
    if (!threshold) return base
    if (!base) return threshold
    const baseWeight=rankWeights.get(base) ?? levelWeight(base)
    const thresholdWeight=rankWeights.get(threshold) ?? levelWeight(threshold)
    return thresholdWeight >= baseWeight ? threshold : base
  }
  const baseAdministrativeTarget=valueText(admin,"5013001001210102")
  const baseTechnicalTarget=valueText(business,"5013001001210202")
  const administrativeLevel=compareLevel(baseAdministrativeTarget,thresholdLevelFor(adminThresholdType))
  const technicalLevel=compareLevel(baseTechnicalTarget,thresholdLevelFor(technicalThresholdType))

  const adminRank=valueText(adminAssignment,"5013001001210601") || administrativeLevel
  const technicalRank=valueText(technicalAssignment,"5013001001210601") || technicalLevel
  const applicantName=String(businessContext.businessData.applicant ?? input.applicant ?? "").trim()
  const applicantPerson=personnelRows.find(item=>valueText(item,"5013001001002002")===applicantName)
  const startDepartment=String(businessContext.businessData.department ?? valueText(applicantPerson,"5013001001002004") ?? input.department ?? "").trim()
  const organizationPath=departmentPath(departmentRows,startDepartment)

  const adminUser=personByRankAndBusiness(personnelRows,adminRank,candidates) || valueText(position,"5013001001210304")
  const technicalUser=personByRankAndBusiness(personnelRows,technicalRank,candidates) || valueText(position,"5013001001210303") || valueText(position,"5013001001210304")
  const fallback=approvalStepDefinitions(row,{...output,approvalResolvedSteps:[]})
  const fallbackByType=(types:string[],index:number)=>fallback.find(item=>types.includes(String(item.approvalType ?? ""))) ?? fallback[index]

  const timeoutRules=timeoutRows.filter(item=>{ const domains=recordList(item,"5013001001110172"); return domains.length===0 || intersectsAny(domains,candidates) })
  const defaultTimeoutHours=timeoutRules.map(item=>Number(item.values?.["5013001001110171"] ?? NaN)).filter(value=>Number.isFinite(value) && value>0).sort((a,b)=>a-b)[0] ?? 0
  const administrativeRequirement=recordDataText(admin,"审批内容","行政审批内容","办理要求") || recordDataText(adminAssignment,"审批内容","办理要求") || `按行政审批层级“${administrativeLevel || adminRank || "配置层级"}”核验业务事项及其数字化依据`
  const technicalRequirement=recordDataText(business,"审查内容","业务审查内容","办理要求") || recordDataText(technicalAssignment,"审查内容","办理要求") || `按技术/业务审查层级“${technicalLevel || technicalRank || "配置层级"}”核验业务数据和专业要求`

  const steps:ApprovalStepDefinition[]=[]
  // 行政路径从申请人所在组织开始。进入上级组织后重新读取该组织人员/职级配置，不延续下级组织的职级序列。
  for (const organizationName of organizationPath) {
    const person=personRecordInDepartment(personnelRows,organizationName,adminRank,candidates)
    const userName=valueText(person,"5013001001002002")
    if (!userName) continue
    const organizationRank=valueText(person,"5013001001002007")
    const nodeConfig=approvalNodeRuntimeConfig(timeoutRules,candidates,"行政审批",organizationRank || adminRank || administrativeLevel,administrativeRequirement)
    steps.push({
      id:`digital-administrative-${steps.length+1}`,title:`行政审批 · ${organizationName}${organizationRank ? ` · ${organizationRank}` : ""}`,
      approvalType:"administrative",assigneeScope:"named_user",userName,roleLabel:userName,departmentField:"department",organizationName,organizationRank,
      requirement:nodeConfig.requirement,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,outputField:nodeConfig.outputField,
      evidence:{organizationName,organizationRank,baseTarget:baseAdministrativeTarget,adjustedTarget:administrativeLevel,organizationRule:"进入新的组织后按该组织数字化属性重新匹配审批人",nodeConfig:nodeConfig.evidence},
    })
    if (adminRank && organizationRank === adminRank) break
  }
  if (!steps.length && (admin || adminAssignment || administrativeLevel)) {
    const fallbackStep=fallbackByType(["administrative"],0)
    const nodeConfig=approvalNodeRuntimeConfig(timeoutRules,candidates,"行政审批",adminRank || administrativeLevel,administrativeRequirement)
    if (adminUser) steps.push({id:"digital-administrative-1",title:`行政审批${administrativeLevel ? ` · ${administrativeLevel}` : ""}`,approvalType:"administrative",assigneeScope:"named_user",userName:adminUser,roleLabel:adminUser,departmentField:"department",organizationName:startDepartment,organizationRank:adminRank,requirement:nodeConfig.requirement,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,outputField:nodeConfig.outputField,evidence:{organizationName:startDepartment,organizationRank:adminRank,baseTarget:baseAdministrativeTarget,adjustedTarget:administrativeLevel,rule:"审批分管配置数字化库匹配",nodeConfig:nodeConfig.evidence}})
    else if (fallbackStep) steps.push({...fallbackStep,id:"digital-administrative-1",title:`行政审批${administrativeLevel ? ` · ${administrativeLevel}` : ""}`,requirement:nodeConfig.requirement,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,outputField:nodeConfig.outputField,evidence:{organizationName:startDepartment,baseTarget:baseAdministrativeTarget,adjustedTarget:administrativeLevel,rule:"审批配置兼容路径",nodeConfig:nodeConfig.evidence}})
  }
  if (business || technicalAssignment || technicalLevel) {
    const fallbackStep=fallbackByType(["technical","business"],1)
    const nodeConfig=approvalNodeRuntimeConfig(timeoutRules,candidates,"技术/业务审查",technicalRank || technicalLevel,technicalRequirement)
    if (technicalUser) steps.push({id:`digital-technical-${steps.length+1}`,title:`技术/业务审查${technicalLevel ? ` · ${technicalLevel}` : ""}`,approvalType:"technical",assigneeScope:"named_user",userName:technicalUser,roleLabel:technicalUser,departmentField:"department",organizationRank:technicalRank,requirement:nodeConfig.requirement,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,outputField:nodeConfig.outputField,evidence:{organizationRank:technicalRank,baseTarget:baseTechnicalTarget,adjustedTarget:technicalLevel,rule:"业务审批分管与岗位数字化库匹配",nodeConfig:nodeConfig.evidence}})
    else if (fallbackStep) steps.push({...fallbackStep,id:`digital-technical-${steps.length+1}`,title:`技术/业务审查${technicalLevel ? ` · ${technicalLevel}` : ""}`,requirement:nodeConfig.requirement,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,outputField:nodeConfig.outputField,evidence:{organizationRank:technicalRank,baseTarget:baseTechnicalTarget,adjustedTarget:technicalLevel,rule:"业务审查配置兼容路径",nodeConfig:nodeConfig.evidence}})
  }
  if (!steps.length) steps.push(...fallback.map((item,index)=>{ const nodeConfig=approvalNodeRuntimeConfig(timeoutRules,candidates,item.approvalType === "technical" ? "技术/业务审查" : "行政审批",item.organizationRank || item.roleLabel || item.title,item.requirement || "按审批模型数字化配置执行本环节审批/审查"); return {...item,id:`digital-fallback-${index+1}`,timeoutHours:nodeConfig.timeoutHours || defaultTimeoutHours,timeoutValue:nodeConfig.timeoutValue || (defaultTimeoutHours ? String(defaultTimeoutHours) : ""),reminderRule:nodeConfig.reminderRule,requirement:nodeConfig.requirement,outputField:nodeConfig.outputField,evidence:{...plainObject(item.evidence),nodeConfig:nodeConfig.evidence}} }))

  // 正式路径按“实际人员”去重，保留靠后的有效环节。
  const unique:ApprovalStepDefinition[]=[]; const seen=new Set<string>()
  for (let index=steps.length-1; index>=0; index-=1) {
    const step=steps[index]
    const key=step.assigneeScope === "named_user" && step.userName ? `user:${step.userName}` : `${step.assigneeScope}:${step.role}:${step.organizationName}:${step.title}`
    if (seen.has(key)) continue
    seen.add(key); unique.unshift(step)
  }

  // 审批人计算保留内部审计，但对外最终路径仅使用“岗位/角色（员工数字化编码）”。
  const approvalOwnerInput={...input,department:startDepartment || input.department,"所属部门":startDepartment || input["所属部门"]}
  const resolvedApproverMeta = await Promise.all(unique.map(async step=>{
    try {
      const ownerId=await resolveApprovalOwner(step,approvalOwnerInput,String(row.owner_id ?? ""))
      const person=await query<{display_name:string;employee_code:string}>("SELECT display_name,employee_code FROM users WHERE id=$1 LIMIT 1",[ownerId])
      return {name:person.rows[0]?.display_name || step.userName || step.roleLabel || "待匹配",employeeCode:String(person.rows[0]?.employee_code ?? "").trim()}
    } catch {
      const personRow=personnelRows.find(item=>valueText(item,"5013001001002002")===(step.userName || step.roleLabel || ""))
      return {name:step.userName || step.roleLabel || "待匹配",employeeCode:valueText(personRow,"5013001001002001")}
    }
  }))
  let administrativeSequence=0
  let technicalSequence=0
  const approverCalculation = unique.map((step,index)=>{
    const relativeLevel=step.approvalType === "technical" ? relativeLevelLabel(++technicalSequence,"technical") : relativeLevelLabel(++administrativeSequence,"administrative")
    return {
      "环节序号":index+1,"相对级次":relativeLevel,
      "环节名称":step.title,
      "环节类型":step.approvalType === "technical" ? "技术/业务审查" : "行政审批",
      "审批组织":step.organizationName || startDepartment || "按数字化库配置",
      "组织数字化属性":step.organizationRank || "",
      "审批层级岗位":step.organizationRank || step.roleLabel || "按数字化库配置",
      "审批人":resolvedApproverMeta[index].name,"员工数字化编码":resolvedApproverMeta[index].employeeCode,
      "审批人计算依据":String(plainObject(step.evidence).organizationRule ?? plainObject(step.evidence).rule ?? "按组织数字化属性、组织名称数字化属性、人员组织岗位配置数字化库匹配"),
      "审批要求":step.requirement || "按数字化库配置",
      "规定时限":step.timeoutValue || (Number(step.timeoutHours ?? 0)>0 ? String(Number(step.timeoutHours)) : "未配置"),
    }
  })
  const routeLabel=(step:ApprovalStepDefinition,index:number)=>{
    const role=step.organizationRank || step.roleLabel || resolvedApproverMeta[index].name
    const code=resolvedApproverMeta[index].employeeCode
    return `${role}${code ? `（${code}）` : ""}`
  }
  const administrativePath = unique.map((step,index)=>({step,index})).filter(item=>item.step.approvalType !== "technical").map(item=>routeLabel(item.step,item.index))
  const technicalPath = unique.map((step,index)=>({step,index})).filter(item=>item.step.approvalType === "technical").map(item=>routeLabel(item.step,item.index))
  const formalPath = unique.map((step,index)=>routeLabel(step,index))
  const relativeAdministrativeLevel=administrativePath.length ? relativeLevelLabel(administrativePath.length,"administrative") : "无"
  const relativeTechnicalLevel=technicalPath.length ? relativeLevelLabel(technicalPath.length,"technical") : "无"
  const pathCalculation = {
    "申请人":applicantName || "—",
    "申请人所在部门":startDepartment || "—",
    "基础行政审批级次":administrativePath.length ? "一级审批" : "无",
    "最终行政审批级次":relativeAdministrativeLevel,
    "技术/业务审查级次":relativeTechnicalLevel,
    "组织逐级路径":organizationPath,
    "行政审批路径":administrativePath,
    "技术业务审查路径":technicalPath,
    "正式审批路径":formalPath,
    "审批路径明细":approverCalculation,
    "审批路径计算依据":"组织数字化属性仅用于匹配组织、岗位和人员；行政审批与技术/业务审查均以发起人为起点按实际有效节点形成相对级次，最终按配置合并并按实际人员去重。",
  }
  const thresholdCalculation = thresholdVariables.map(item=>({
    "阈值类型":item.thresholdType || "阈值",
    "数字化标识":item.digitalIdentifier,
    "本次业务值":item.rawActual ?? item.actualValue,
    "阈值":item.thresholdValue,
    "调整审批层级":item.approvalLevel,
  }))

  const opinionRules=opinionRows.map(item=>({name:valueText(item,"5013001001110102"),terminal:boolValue(item.values?.["5013001001110103"])})).filter(item=>item.name)
  const actions=[...new Set(opinionRules.map(item=>item.name))]
  const approvalTimeoutHours=unique.map(item=>Number(item.timeoutHours ?? 0)).filter(value=>Number.isFinite(value) && value>0)[0] ?? defaultTimeoutHours
  if (!admin && !business && !adminAssignment && !technicalAssignment && thresholdVariables.length===0 && unique.length===0) return null
  return {
    steps:unique,
    actions:actions.length ? actions : asArray<string>(settings.actions).map(String).filter(Boolean),
    opinionRules,
    source:"数字化库",
    businessCandidates:candidates,
    identifierValues,
    thresholdVariables,
    administrativeLevel:relativeAdministrativeLevel,
    technicalLevel:relativeTechnicalLevel,
    approvalTimeoutHours,
    assignment:{administrativeRank:adminRank,technicalRank},
    organizationPath,
    approverCalculation,
    pathCalculation,
    thresholdCalculation,
    businessContent:{
      sourceRunId:businessContext.sourceRunId,sourceProjectId:businessContext.sourceProjectId,sourceModelName:businessContext.modelName,sourceModelCode:businessContext.modelCode,
      sourceFileName:businessContext.fileName,sourceDisplayFileName:businessContext.displayFileName,sourceDigitalId:businessContext.digitalId,
      businessFields:businessContext.businessFields,businessData:businessContext.businessData,identifierValues:businessContext.identifierValues,
    },
    approvalComputationEvidence:{
      sourceModel:businessContext.modelName,sourceModelCode:businessContext.modelCode,sourceProjectId:businessContext.sourceProjectId,
      baseAdministrativeLevel:administrativePath.length ? "一级审批" : "无",adjustedAdministrativeLevel:relativeAdministrativeLevel,technicalReviewLevel:relativeTechnicalLevel,
      organizationAttributeTargets:{baseAdministrativeTarget,adjustedAdministrativeTarget:administrativeLevel,baseTechnicalTarget,adjustedTechnicalTarget:technicalLevel},
      matchedThresholds:thresholdVariables,applicant:applicantName,startDepartment,organizationPath,
      organizationRule:"从申请人所在组织开始；进入新的上级/分管组织后重新读取该组织规则和人员职级配置",
      nodeRule:"节点类型 + 审批层级/岗位匹配数字化配置，形成审批/审查要求、规定时限、提醒规则和输出字段",
    },
    modelDesignSource:designSnapshot ? "来源业务模型的模型设计模型数字化库" : "来源业务模型已发布设计配置",
    modelDesignIdentifierValues:designSnapshot?.identifierValues ?? {},
  }
}

async function resolveApprovalOwner(step: ApprovalStepDefinition, input: Record<string, unknown>, fallbackUserId: string) {
  const departmentField = step.departmentField || "department"
  const department = String(input[departmentField] ?? input.department ?? "").trim()
  if (step.assigneeScope === "department_role" && step.role) {
    if (!department) throw new ModelBuilderError(409, `${step.title}无法确定申请人所属部门，请检查前序模型传递的部门数据`)
    const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role=$1 AND department=$2 ORDER BY created_at LIMIT 1", [step.role, department])
    if (found.rows[0]?.id) return found.rows[0].id
    throw new ModelBuilderError(409, `${department}未配置${step.roleLabel || step.title}，请在管理后台为对应人员设置角色`)
  }
  if (step.assigneeScope === "global_role" && step.role) {
    const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role=$1 ORDER BY created_at LIMIT 1", [step.role])
    if (found.rows[0]?.id) return found.rows[0].id
    throw new ModelBuilderError(409, `未配置${step.roleLabel || step.title}，请在管理后台为对应人员设置角色`)
  }
  if (step.assigneeScope === "named_user" && step.userName) {
    const named = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND display_name=$1 ORDER BY created_at LIMIT 1", [step.userName])
    if (named.rows[0]?.id) return named.rows[0].id
    // 系统初始化示例允许用岗位中文名做占位；真实配置通过员工信息数字化库选择具体人员后会直接命中姓名。
    if (step.userName === "部门经理" && department) {
      const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role='department_manager' AND department=$1 ORDER BY created_at LIMIT 1", [department])
      if (found.rows[0]?.id) return found.rows[0].id
    }
    if (step.userName === "考勤主管") {
      const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role='attendance_supervisor' ORDER BY created_at LIMIT 1")
      if (found.rows[0]?.id) return found.rows[0].id
    }
    throw new ModelBuilderError(409, `未找到审批人“${step.userName}”，请通过员工信息模型和岗位分选模型维护审批人员`)
  }
  // 兼容旧审批模型配置。
  const title = step.title
  if ((title.includes("部门负责人") || title.includes("部门经理") || title.includes("行政审批")) && department) {
    const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role='department_manager' AND department=$1 ORDER BY created_at LIMIT 1", [department])
    if (found.rows[0]?.id) return found.rows[0].id
  }
  if (title.includes("考勤主管")) {
    const found = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND role='attendance_supervisor' ORDER BY created_at LIMIT 1")
    if (found.rows[0]?.id) return found.rows[0].id
  }
  const named = await query<{ id: string }>("SELECT id FROM users WHERE status='active' AND display_name=$1 ORDER BY created_at LIMIT 1", [title])
  if (named.rows[0]?.id) return named.rows[0].id
  throw new ModelBuilderError(409, `${step.title}未匹配到有效审批人，请检查审批分管配置、岗位分选和员工信息数字化库`)
}

function flattenArchiveInput(sourceModelName: string, sourceFileName: string, sourceDisplayFileName: string, sourceDigitalId: string, sourceRunId: string, input: Record<string, unknown>, output: Record<string, unknown>) {
  // 当前触发源必须覆盖更早链路里的同名 source* 字段；更早业务上下文保存在 sourceInput/sourceOutput 中。
  return { ...input, ...output, sourceModelName, sourceFileName, sourceDisplayFileName, sourceDigitalId, sourceRunId, sourceInput: input, sourceOutput: output }
}

function approvalBusinessData(input: Record<string, unknown>, output: Record<string, unknown>) {
  const approvalBusinessContent=plainObject(output.approvalBusinessContent)
  const structuredBusinessData=plainObject(approvalBusinessContent.businessData)
  if (Object.keys(structuredBusinessData).length) return structuredBusinessData
  const sourceInput = plainObject(input.sourceInput)
  const sourceOutput = plainObject(input.sourceOutput)
  const merged: Record<string, unknown> = { ...sourceInput, ...sourceOutput }
  if (!Object.keys(merged).length) {
    for (const [key, value] of Object.entries({ ...input, ...output })) {
      if (key.startsWith("source") || key.startsWith("approval")) continue
      if (["fileName", "digitalId", "runId"].includes(key)) continue
      merged[key] = value
    }
  }
  for (const key of ["sourceModelName", "sourceFileName", "sourceDigitalId", "sourceRunId", "sourceInput", "sourceOutput", "approvalRoute", "approvalStatus", "approvalResult", "approvalProcess"]) delete merged[key]
  return merged
}

async function createApprovalTodo(row: ProjectRow, runId: string, ownerId: string, sender: string, fileName: string, digitalId: string, input: Record<string, unknown>, output: Record<string, unknown>, stepIndex: number): Promise<RuntimeTodo> {
  const stepDefs = approvalStepDefinitions(row, output)
  const formalRouteText=String(output["正式审批路径"] ?? "").trim()
  const steps = formalRouteText ? formalRouteText.split(/\s*→\s*/).map(item=>item.trim()).filter(Boolean) : stepDefs.map(item => item.title)
  const currentDef = stepDefs[stepIndex]
  const step = currentDef?.title ?? "审批人"
  const settings = approvalSettings(row)
  const taskTitle = String(settings.taskTitle ?? "审批任务").replaceAll("{sourceModelName}", String(input.sourceModelName ?? input["前序业务模型"] ?? "业务")).replaceAll("{前序业务模型}", String(input["前序业务模型"] ?? input.sourceModelName ?? "业务"))
  const todoId = randomUUID()
  const arrivedAt = new Date()
  const timeoutHours = Number(currentDef?.timeoutHours ?? output.approvalTimeoutHours ?? 0)
  const dueAt = Number.isFinite(timeoutHours) && timeoutHours > 0 ? new Date(arrivedAt.getTime() + timeoutHours * 3600000) : null
  const businessContent=plainObject(output.approvalBusinessContent)
  // 当前办理页的“规定时限”必须来自模型时限数字化库。
  // currentDef.timeoutValue 是本次审批路径计算时从模型时限数字化库匹配得到的当前节点正式值；
  // 审批人计算和模型运行 output 只保留运算留痕，不再作为当前办理页的反向补值来源。
  const currentTimeoutValue = String(currentDef?.timeoutValue ?? "").trim() || "未配置"
  const content = JSON.stringify({
    type: "approval_task_v3",
    sourceModelName: String(businessContent.sourceModelName ?? input.sourceModelName ?? "业务事项"),
    sourceFileName: String(businessContent.sourceFileName ?? input.sourceFileName ?? ""),
    sourceRunId: String(businessContent.sourceRunId ?? input.sourceRunId ?? ""),
    currentStep: step,
    currentStepIndex: stepIndex,
    currentRole: String(currentDef?.roleLabel ?? ""),
    currentRequirement: String(currentDef?.requirement ?? ""),
    currentReminderRule: String(currentDef?.reminderRule ?? ""),
    currentOutputField: String(currentDef?.outputField ?? ""),
    approvalNodeEvidence: plainObject(currentDef?.evidence),
    route: steps,
    businessFields: asArray<Record<string,unknown>>(businessContent.businessFields),
    businessData: approvalBusinessData(input, output),
    approvalTotalSteps: steps.length,
    approvalArrivedAt: arrivedAt.toISOString(),
    approvalDueAt: dueAt?.toISOString() ?? "",
    approvalTimeoutHours: timeoutHours,
    currentTimeoutValue,
    currentTimeoutSourceLibraryId:"lib-standard-model-timeout",
    currentTimeoutSourceLibraryName:"模型时限数字化库",
    thresholdVariables: asArray<Record<string,unknown>>(output.approvalThresholdVariables),
    approvalComputationEvidence: plainObject(output.approvalComputationEvidence),
    "审批人计算": asArray<Record<string,unknown>>(output["审批人计算"]),
    "审批路径计算": plainObject(output["审批路径计算"]),
    "正式审批路径": output["正式审批路径"] ?? output.approvalRoute ?? steps.join(" → "),
    allowedActions: asArray<string>(output.approvalAllowedActions).map(String).filter(Boolean).length
      ? asArray<string>(output.approvalAllowedActions).map(String).filter(Boolean)
      : asArray<string>(settings.actions).map(String).filter(Boolean),
  })
  await query("INSERT INTO todos(id,title,model,sender,owner_id,status,content,run_id,step_index,due_at) VALUES($1,$2,$3,$4,$5,'待处理',$6,$7,$8,$9)", [todoId, `${taskTitle} · ${step}`, row.name, sender, ownerId, content, runId, stepIndex, dueAt])
  return { id: todoId, title: `${taskTitle} · ${step}`, model: row.name, sender, date: dateText(), status: "待处理", content, ownerId }
}

async function approvalProcessForRun(runId: string) {
  const processRows = await query<{ step_index: number; title: string; content: string | null; handled_result: string | null; handled_at: Date | null; created_at: Date | null; due_at: Date | null; display_name: string | null }>(`SELECT t.step_index,t.title,t.content,t.handled_result,t.handled_at,t.created_at,t.due_at,u.display_name
    FROM todos t LEFT JOIN users u ON u.id=t.owner_id WHERE t.run_id=$1 ORDER BY t.step_index,t.created_at`, [runId])
  return processRows.rows.map(item => {
    let todoContent:Record<string,unknown>={}
    try { todoContent=plainObject(item.content ? JSON.parse(item.content) : {}) } catch { todoContent={} }
    const arrived=item.created_at ? new Date(item.created_at) : null
    const due=item.due_at ? new Date(item.due_at) : null
    const handled=item.handled_at ? new Date(item.handled_at) : null
    return {
      stepIndex: Number(item.step_index ?? 0) + 1,
      step: String(todoContent.currentStep ?? (item.title.includes(" · ") ? item.title.split(" · ").slice(-1)[0] : item.title)),
      approver: item.display_name ?? "",
      result: item.handled_result ?? "",
      requirement:String(todoContent.currentRequirement ?? ""),
      reminderRule:String(todoContent.currentReminderRule ?? ""),
      outputField:String(todoContent.currentOutputField ?? ""),
      evidence:plainObject(todoContent.approvalNodeEvidence),
      arrivedAt: arrived?.toISOString() ?? null,
      dueAt: due?.toISOString() ?? null,
      requiredHours:Number(todoContent.approvalTimeoutHours ?? 0),
      requiredTimeoutValue:String(todoContent.currentTimeoutValue ?? ""),
      handledAt: handled?.toISOString() ?? null,
      elapsedMilliseconds: arrived && handled ? Math.max(0, handled.getTime() - arrived.getTime()) : null,
      overdue: Boolean(due && handled && handled.getTime() > due.getTime()),
    }
  })
}

function smartTodoBusinessData(input: Record<string, unknown>, output: Record<string, unknown>) {
  const approvalInput = plainObject(input.sourceInput)
  const approvalOutput = plainObject(input.sourceOutput)
  const nestedBusiness = approvalBusinessData(approvalInput, approvalOutput)
  if (Object.keys(nestedBusiness).length) return nestedBusiness
  return approvalBusinessData(input, output)
}

type BusinessSourceContext = { modelName: string; fileName: string; displayFileName: string; digitalId: string; runId: string }
function resolveBusinessSourceContext(input: Record<string, unknown>): BusinessSourceContext {
  let cursor = input
  let fallback: BusinessSourceContext = {
    modelName: String(input.businessSourceModelName ?? input.sourceModelName ?? "业务模型"),
    fileName: String(input.businessFileName ?? input.sourceFileName ?? ""),
    displayFileName: String(input.businessDisplayFileName ?? input.sourceDisplayFileName ?? ""),
    digitalId: String(input.businessDigitalId ?? input.sourceDigitalId ?? ""),
    runId: String(input.businessRunId ?? input.sourceRunId ?? ""),
  }
  for (let depth = 0; depth < 8; depth += 1) {
    const modelName = String(cursor.sourceModelName ?? cursor.businessSourceModelName ?? "").trim()
    const fileName = String(cursor.sourceFileName ?? cursor.businessFileName ?? "").trim()
    const displayFileName = String(cursor.sourceDisplayFileName ?? cursor.businessDisplayFileName ?? "").trim()
    const digitalId = String(cursor.sourceDigitalId ?? cursor.businessDigitalId ?? "").trim()
    const runId = String(cursor.sourceRunId ?? cursor.businessRunId ?? "").trim()
    if (modelName || fileName || displayFileName || digitalId || runId) fallback = {
      modelName: modelName || fallback.modelName,
      fileName: fileName || fallback.fileName,
      displayFileName: displayFileName || fallback.displayFileName,
      digitalId: digitalId || fallback.digitalId,
      runId: runId || fallback.runId,
    }
    if (modelName && modelName !== "审批模型" && modelName !== "智选模型") return fallback
    const next = plainObject(cursor.sourceInput)
    if (!Object.keys(next).length) break
    cursor = next
  }
  return fallback
}

function smartRelationValues(input: Record<string, unknown>, output: Record<string, unknown>) {
  // 智选模型本身不保存某个业务模型的专用字段。条件判断所需业务数据从前序链路中动态取回。
  const businessData = smartTodoBusinessData(input, output)
  const approvalInput = plainObject(input.sourceInput)
  const approvalOutput = plainObject(input.sourceOutput)
  return { ...businessData, ...approvalInput, ...approvalOutput, ...input, ...output }
}

async function sourceBusinessSmartRelations(input: Record<string, unknown>, output: Record<string, unknown>) {
  const source = resolveBusinessSourceContext(input)
  if (!source.modelName || ["审批模型", "智选模型", "业务模型"].includes(source.modelName)) return { source, relations: [] as ModelRelation[] }
  const values = smartRelationValues(input, output)
  const relations: ModelRelation[] = []

  // 兼容原业务模型第4阶段中已配置的“智选关联”。
  const businessProject = await fetchProject("m.name=$1 AND p.status='published'", source.modelName)
  if (businessProject) {
    relations.push(...configRelations(runConfig(businessProject)).filter(item => item.enabled !== false && item.mode === "smart" && relationMatches(item, values, values)))
  }

  // 通用智选模型读取设计阶段配置的“标识关联配置数字化库”。
  // 每条配置本身也是模型运行结果：业务数字化标识 -> 目标模型；新增业务模型后无需修改智选代码。
  const smartProject=await fetchProject("m.name=$1 AND p.status='published'","智选模型")
  const smartSourceIds=plainObject(smartProject?.design?.smartStandardSourceIds)
  const triggerLibraryId=String(smartSourceIds.identifierTrigger ?? "lib-standard-identifier-trigger")
  if (isDigitalIdentifier(source.digitalId)) {
    const configured = await query<any>(`SELECT identifier_values FROM digital_library_records
      WHERE library_id=$2
        AND identifier_values->>'5013001001210401'=$1
      ORDER BY created_at`, [source.digitalId,triggerLibraryId])
    for (const row of configured.rows) {
      const item = plainObject(row.identifier_values)
      const targetModelName = String(item["5013001001210402"] ?? "").trim()
      const enabledRaw = item["5013001001210403"]
      const enabled = enabledRaw === undefined || enabledRaw === null || enabledRaw === true || ["true","1","是","启用"].includes(String(enabledRaw).toLowerCase())
      if (!enabled || !targetModelName) continue
      relations.push({
        id: `identifier-trigger-${source.digitalId}-${targetModelName}`,
        enabled: true,
        mode: "smart",
        targetModelName,
        condition: { fieldKey: "", operator: "always", value: "" },
        description: "由标识触发配置模型数字化库匹配",
      })
    }
  }

  // 同一目标模型只触发一次；中心标识配置与旧业务配置并存时不会重复运行。
  const unique = [...new Map(relations.map(item => [String(item.targetModelName ?? "").trim(), item])).values()].filter(item => Boolean(item.targetModelName))
  return { source, relations: unique }
}

async function smartAssociationSummary(input: Record<string, unknown>, output: Record<string, unknown>) {
  const { source, relations } = await sourceBusinessSmartRelations(input, output)
  const associatedModels = relations.map(item => String(item.targetModelName ?? "").trim()).filter(Boolean)
  const associatedDigitalIds = relations.length && isDigitalIdentifier(source.digitalId) ? [source.digitalId] : []
  const smartDecision = associatedModels.length
    ? `已匹配后续关联模型：${associatedModels.join(" → ")}`
    : `本模型（${source.modelName || "业务模型"}）没有后续关联的模型`
  return {
    businessSourceModelName: source.modelName || "业务模型",
    businessFileName: source.fileName,
    businessDisplayFileName: source.displayFileName,
    businessDigitalId: source.digitalId,
    associatedDigitalIds,
    associatedModels,
    smartDecision,
  }
}

async function createSmartResultTodo(row: ProjectRow, runId: string, ownerId: string, input: Record<string, unknown>, output: Record<string, unknown>, triggeredModels: string[], triggerError?: string): Promise<RuntimeTodo> {
  const existing = await query<{ id: string; title: string; model: string; sender: string; status: string; content: string; owner_id: string; created_at: Date }>("SELECT id,title,model,sender,status,content,owner_id,created_at FROM todos WHERE run_id=$1 AND model=$2 ORDER BY created_at LIMIT 1", [runId, row.name])
  if (existing.rows[0]) {
    const item = existing.rows[0]
    return { id: item.id, title: item.title, model: item.model, sender: item.sender, date: item.created_at.toISOString().slice(0,16).replace("T"," "), status: item.status, content: item.content, ownerId: item.owner_id }
  }
  const summary = await smartAssociationSummary(input, output)
  const currentBusinessName = String(output["业务模型"] ?? summary.businessSourceModelName ?? "业务模型")
  const currentBusinessFileName = String(output["业务模型文件名"] ?? summary.businessFileName ?? "")
  const currentBusinessDisplayName = String(output["业务中文显示名称"] ?? summary.businessDisplayFileName ?? "")
  const currentBusinessDigitalId = String(output["业务数字化标识"] ?? summary.businessDigitalId ?? "")
  const currentAssociatedIds = asArray<string>(output["有关联数字化标识集合"]).map(String).filter(Boolean)
  const approvalResult = String(output["审批结果"] ?? input["审批结果"] ?? input.approvalResult ?? plainObject(input.sourceOutput)["审批结果"] ?? plainObject(input.sourceOutput).approvalResult ?? "")
  const currentDecision = String(output["智选结果"] ?? output.smartDecision ?? summary.smartDecision)
  const todoId = randomUUID()
  const title = `${currentBusinessName} · 智选结果`
  const content = JSON.stringify({
    type: "smart_result_v3",
    sourceModelName: String(input["前序业务模型"] ?? input.sourceModelName ?? "审批模型"),
    businessSourceModelName: currentBusinessName,
    businessFileName: currentBusinessFileName,
    businessDisplayFileName: currentBusinessDisplayName,
    businessDigitalId: currentBusinessDigitalId,
    associatedDigitalIds: currentAssociatedIds.length ? currentAssociatedIds : summary.associatedDigitalIds,
    approvalResult,
    smartDecision: currentDecision,
    triggeredModels,
    triggerError: triggerError ?? "",
    businessData: smartTodoBusinessData(input, output),
  })
  await query("INSERT INTO todos(id,title,model,sender,owner_id,status,content,run_id,step_index) VALUES($1,$2,$3,'系统',$4,'待确认',$5,$6,0)", [todoId, title, row.name, ownerId, content, runId])
  return { id: todoId, title, model: row.name, sender: "系统", date: dateText(), status: "待确认", content, ownerId }
}

function libraryArchiveData(row: ProjectRow, runId: string, fileName: string, displayFileName: string, digitalId: string, input: Record<string, unknown>, output: Record<string, unknown>) {
  const type = modelTypeOf(row)
  if (type === "approval") {
    return {
      "模型运行记录":runId,"模型文件名":fileName,"中文显示文件名":displayFileName,"数字化标识":digitalId,
      "前序业务模型":String(input["前序业务模型"] ?? input.sourceModelName ?? ""),"前序模型文件名":String(input["前序模型文件名"] ?? input.sourceFileName ?? ""),
      "前序中文显示名称":String(input["中文显示名称"] ?? input.sourceDisplayFileName ?? ""),"前序数字化标识":String(input["前序数字化标识"] ?? input.sourceDigitalId ?? ""),
      "正式审批路径":output["正式审批路径"] ?? output.approvalRoute ?? "","审批总环节":output["审批总环节"] ?? output.approvalTotalSteps ?? 0,
      "当前审批环节":output["当前审批环节"] ?? output.approvalCurrentStep ?? 0,"当前审批人":output["当前审批人"] ?? output.approvalCurrentApprover ?? "",
      "审批意见":output["审批意见"] ?? output.approvalOpinion ?? "","审批时间":output["审批时间"] ?? output.approvalTime ?? "","审批状态":output["审批状态"] ?? output.approvalStatus ?? "",
      "审批结果":output["审批结果"] ?? output.approvalResult ?? "","审批结果文件":output["审批结果文件"] ?? output.approvalResultPdf ?? "",
      "命中数字化标识阈值":output["命中数字化标识阈值"] ?? [],"基础行政审批级次":output["基础行政审批级次"] ?? "",
      "最终行政审批级次":output["最终行政审批级次"] ?? output.approvalAdministrativeLevel ?? "","技术业务审查级次":output["技术业务审查级次"] ?? output.approvalTechnicalLevel ?? "","规定时限":output["规定时限"] ?? "",
      "审批人计算":output["审批人计算"] ?? [],"审批路径计算":output["审批路径计算"] ?? {},"正式审批路径节点":output["正式审批路径节点"] ?? output["审批人计算"] ?? [],
      "审批办理记录":output["审批办理记录"] ?? output.approvalProcess ?? [],
    }
  }
  if (type === "smart") {
    return {
      "模型运行记录":runId,"模型文件名":fileName,"中文显示文件名":displayFileName,"数字化标识":digitalId,
      "业务模型":output["业务模型"] ?? input["业务模型"] ?? output.businessSourceModelName ?? input.businessSourceModelName ?? "",
      "业务模型文件名":output["业务模型文件名"] ?? input["业务模型文件名"] ?? output.businessFileName ?? input.businessFileName ?? "",
      "业务中文显示名称":output["业务中文显示名称"] ?? input["业务中文显示名称"] ?? output.businessDisplayFileName ?? input.businessDisplayFileName ?? "",
      "业务数字化标识":output["业务数字化标识"] ?? input["业务数字化标识"] ?? output.businessDigitalId ?? input.businessDigitalId ?? "",
      "来源审批模型运行记录":String(input.sourceRunId ?? ""),"来源审批模型文件名":String(input["前序模型文件名"] ?? input.sourceFileName ?? ""),
      "审批结果":output["审批结果"] ?? input["审批结果"] ?? input.approvalResult ?? plainObject(input.sourceOutput).approvalResult ?? "",
      "统计分析状态":output["统计分析状态"] ?? "","统计分析模型文件名":output["统计分析模型文件名"] ?? "","待处理数字化标识集合":output["待处理数字化标识集合"] ?? [],"有关联数字化标识集合":output["有关联数字化标识集合"] ?? [],
      "各数字化标识有效数据条数":output["各数字化标识有效数据条数"] ?? [],"特殊判断结果":output["特殊判断结果"] ?? "","正常关联判断结果":output["正常关联判断结果"] ?? "",
      "关联模型集合":output["关联模型集合"] ?? output.associatedModels ?? [],"关联模型启动明细":output["关联模型启动明细"] ?? [],"关联模型启动次数":output["关联模型启动次数"] ?? 0,"智选结果":output["智选结果"] ?? output.smartDecision ?? "",
    }
  }
  return { runId, fileName, displayFileName, digitalId, input, output }
}


async function applyDigitalAdministrationModel(modelName: string, input: Record<string, unknown>, output: Record<string, unknown>) {
  const values = { ...input, ...output }
  if (modelName === "业务定义模型") {
    const name=String(values.businessName ?? "").trim(); if (!name) return
    const parentName=String(values.parentBusiness ?? "").trim()
    const parent=parentName ? await query<any>("SELECT id,level_no FROM business_definitions WHERE name=$1 AND status='active' ORDER BY level_no LIMIT 1",[parentName]) : {rows:[]}
    const levelText=String(values.businessLevel ?? "一级")
    const levelMap:Record<string,number>={"一级":1,"二级":2,"三级":3,"四级":4}
    const parentLevel = Number(parent.rows[0]?.level_no ?? 0)
    const level = levelMap[levelText] ?? (Number.isFinite(parentLevel) ? parentLevel + 1 : 1)
    const code=`B${String(Date.now()).slice(-8)}`
    await query("INSERT INTO business_definitions(id,code,name,parent_id,level_no,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,parent_id=EXCLUDED.parent_id,level_no=EXCLUDED.level_no,description=EXCLUDED.description,updated_at=now()",[randomUUID(),code,name,parent.rows[0]?.id ?? null,level,String(values.businessDefinition ?? "")])
  } else if (modelName === "数字化定义模型") {
    const name=String(values.definitionName ?? "").trim(); const type=String(values.definitionType ?? "").trim(); if(!name||!type)return
    const code=`D${String(Date.now()).slice(-9)}`
    await query("INSERT INTO digital_definitions(id,code,name,definition_type,definition_text) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,definition_type=EXCLUDED.definition_type,definition_text=EXCLUDED.definition_text,updated_at=now()",[randomUUID(),code,name,type,String(values.definitionText ?? "")])
  } else if (modelName === "模型数字化编码模型") {
    const target=String(values.targetModelName ?? "").trim(); const code=String(values.modelDigitalCode ?? "").trim(); if(!target||!isCurrentModelDigitalCode(code)) return
    const model=await query<any>("SELECT id FROM models WHERE name=$1",[target]); if(!model.rows[0]) throw new ModelBuilderError(404,"所选模型不存在")
    await query("INSERT INTO digital_codes(id,object_type,object_id,code,display_name) VALUES($1,'model',$2,$3,$4) ON CONFLICT(object_type,object_id) DO UPDATE SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now()",[randomUUID(),model.rows[0].id,code,target])
    await query("UPDATE model_projects SET configuration=jsonb_set(configuration,'{modelCode}',to_jsonb($1::text),true),updated_at=now() WHERE model_id=$2",[code,model.rows[0].id])
  } else if (modelName === "人员数字化编码模型") {
    const person=String(values.personName ?? "").trim(); const code=String(values.personDigitalCode ?? "").trim(); if(!person||!isCurrentEmployeeDigitalCode(code)) return
    const user=await query<any>("SELECT id FROM users WHERE display_name=$1 AND status='active' ORDER BY created_at LIMIT 1",[person]); if(!user.rows[0]) throw new ModelBuilderError(404,"所选人员不存在")
    await query("UPDATE users SET employee_code=$1,updated_at=now() WHERE id=$2",[code,user.rows[0].id])
    await query("INSERT INTO digital_codes(id,object_type,object_id,code,display_name) VALUES($1,'person',$2,$3,$4) ON CONFLICT(object_type,object_id) DO UPDATE SET code=EXCLUDED.code,display_name=EXCLUDED.display_name,updated_at=now()",[randomUUID(),user.rows[0].id,code,person])
  } else if (modelName === "数字化属性配置模型") {
    const objectType=String(values.objectType ?? "模型"); const objectName=String(values.objectName ?? "").trim(); const attrName=String(values.attributeName ?? "").trim(); if(!objectName||!attrName)return
    const typeMap:Record<string,string>={"模型":"model","人员":"person","组织":"organization"}
    const dc=await query<any>("SELECT id FROM digital_codes WHERE object_type=$1 AND display_name=$2 AND status='active' ORDER BY created_at LIMIT 1",[typeMap[objectType] ?? "model",objectName])
    const ad=await query<any>("SELECT id FROM digital_attribute_definitions WHERE name=$1 AND status='active' ORDER BY created_at LIMIT 1",[attrName])
    if(!dc.rows[0]) throw new ModelBuilderError(409,"所选对象尚未分配数字化编码")
    if(!ad.rows[0]) throw new ModelBuilderError(409,"数字化属性定义不存在")
    await query("INSERT INTO digital_object_attributes(id,digital_code_id,attribute_definition_id,value) VALUES($1,$2,$3,$4) ON CONFLICT(digital_code_id,attribute_definition_id) DO UPDATE SET value=EXCLUDED.value,updated_at=now()",[randomUUID(),dc.rows[0].id,ad.rows[0].id,JSON.stringify(values.attributeValue ?? "")])
  } else if (modelName === "数字化标识建设模型") {
    const code=String(values.digitalIdentifier ?? "").trim(); const displayName=String(values.displayName ?? "").trim(); if(!isDigitalIdentifier(code)||!displayName)return
    const biz=await query<any>("SELECT id FROM business_definitions WHERE name=$1 AND status='active' ORDER BY level_no DESC LIMIT 1",[String(values.businessName ?? "")])
    await query("INSERT INTO digital_identifiers(id,code,display_name,data_type,business_definition_id,description) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(code) DO UPDATE SET display_name=EXCLUDED.display_name,data_type=EXCLUDED.data_type,business_definition_id=EXCLUDED.business_definition_id,description=EXCLUDED.description,updated_at=now()",[randomUUID(),code,displayName,String(values.dataType ?? "text"),biz.rows[0]?.id ?? null,String(values.identifierDescription ?? "")])
  } else if (modelName === "数字化库配置模型") {
    const target=String(values.targetModelName ?? "").trim(); const libraryName=String(values.libraryName ?? "").trim(); if(!target||!libraryName)return
    const model=await query<any>("SELECT id FROM models WHERE name=$1",[target]); if(!model.rows[0]) throw new ModelBuilderError(404,"所选模型不存在")
    const existing=await query<any>("SELECT id FROM digital_libraries WHERE model_id=$1",[model.rows[0].id]); const libraryId=existing.rows[0]?.id ?? `lib-model-${model.rows[0].id}`
    const isStandard=[true,"true","是",1,"1"].includes(values.isStandardLibrary as any); const allowSource=![false,"false","否",0,"0"].includes(values.allowAsSource as any)
    if(existing.rows[0]) await query("UPDATE digital_libraries SET name=$1,is_standard=$2,allow_as_source=$3,updated_at=now() WHERE id=$4",[libraryName,isStandard,allowSource,libraryId])
    else await query("INSERT INTO digital_libraries(id,name,model_id,library_type,is_standard,allow_as_source,description) VALUES($1,$2,$3,'model',$4,$5,$6)",[libraryId,libraryName,model.rows[0].id,isStandard,allowSource,`${target}数字化库`])
    const selected=Array.isArray(values.digitalIdentifierColumns) ? values.digitalIdentifierColumns.map(String) : String(values.digitalIdentifierColumns ?? "").split(/[,，\n]/).map(x=>x.trim()).filter(Boolean)
    let position=1
    for(const item of selected){ const did=await query<any>("SELECT id FROM digital_identifiers WHERE (display_name=$1 OR code=$1) AND status='active' ORDER BY code LIMIT 1",[item]); if(!did.rows[0])continue; await query("INSERT INTO digital_library_columns(id,library_id,digital_identifier_id,position,required,source_role) VALUES($1,$2,$3,$4,false,'data') ON CONFLICT(library_id,digital_identifier_id) DO UPDATE SET position=EXCLUDED.position",[randomUUID(),libraryId,did.rows[0].id,position++]) }
    await query("UPDATE model_projects SET configuration=configuration || jsonb_build_object('storageName',$1,'isStandardLibrary',$2),updated_at=now() WHERE model_id=$3",[libraryName,isStandard,model.rows[0].id])
  }
}

async function assertCurrentRuntimeFile(runId: string, fileName: string) {
  if (!isCurrentRuntimeFileName(fileName)) throw new ModelBuilderError(409,"当前运行仍使用旧模型文件名，必须先完成V17.7.12文件名迁移修复后才能继续办理或跨模型流转")
  try {
    const issue=await query<{reason:string}>("SELECT reason FROM model_file_name_migration_issues WHERE run_id=$1 AND resolved_at IS NULL LIMIT 1",[runId])
    if (issue.rows[0]?.reason) throw new ModelBuilderError(409,`当前运行的模型文件名迁移存在异常：${issue.rows[0].reason}`)
  } catch (error) {
    if (error instanceof ModelBuilderError) throw error
    // 新库尚未执行V17.7.12文件名迁移修复时，仍以当前文件名格式作为硬校验。
  }
}

async function archiveRun(row: ProjectRow, user: BuilderUser, runId: string, fileName: string, displayFileName: string, digitalId: string, input: Record<string, unknown>, output: Record<string, unknown>, status = "已归档") {
  const config = runConfig(row)
  await query("UPDATE model_runs SET output_data=$1,status=$2,completed_at=now() WHERE id=$3", [JSON.stringify(output), status, runId])
  const exists = await query("SELECT 1 FROM digital_library_records WHERE run_id=$1", [runId])
  const archiveData = libraryArchiveData(row, runId, fileName, displayFileName, digitalId, input, output)
  const libraryId = await ensureModelDigitalLibrary(row.id)
  const identifierValues = await buildIdentifierValues(row.id, input, output)
  const libraryName = String(config.storageName ?? `${row.name}数字化库`)
  if (!exists.rowCount) await query("INSERT INTO digital_library_records(id,model_id,project_id,run_id,owner_id,library_name,digital_id,library_id,identifier_values,data,file_name,display_file_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)", [randomUUID(), row.model_id, row.id, runId, user.id, libraryName, digitalId, libraryId, JSON.stringify(identifierValues), JSON.stringify(archiveData), fileName, displayFileName])
  else await query("UPDATE digital_library_records SET library_name=$1,digital_id=$2,library_id=$3,identifier_values=$4,data=$5,file_name=$6,display_file_name=$7 WHERE run_id=$8", [libraryName, digitalId, libraryId, JSON.stringify(identifierValues), JSON.stringify(archiveData), fileName, displayFileName, runId])
}

async function recordModelTriggerFailure(row: ProjectRow, runId: string, fileName: string, targetModelName: string, triggerMode: TriggerMode, error: unknown) {
  const config = runConfig(row)
  const message = error instanceof Error ? error.message : String(error || "目标模型触发失败")
  try {
    await query(`INSERT INTO model_trigger_failures(id,source_run_id,source_model_name,source_model_code,source_file_name,target_model_name,trigger_mode,status,error_message)
      VALUES($1,$2,$3,$4,$5,$6,$7,'失败',$8)`, [randomUUID(), runId, row.name, String(config.modelCode ?? ""), fileName, targetModelName, triggerMode, message])
  } catch {
    // 失败日志不能反向吞掉原始触发异常；旧库未执行迁移时仍返回原始错误。
  }
}

async function triggerAfterArchive(user: BuilderUser, row: ProjectRow, runId: string, fileName: string, displayFileName: string, digitalId: string, input: Record<string, unknown>, output: Record<string, unknown>, depth: number) {
  await assertCurrentRuntimeFile(runId,fileName)
  const type = modelTypeOf(row)
  // V17.5 当前智选：按“数字化标识 → 关联数字化标识 → 模型数字化配置”展开，每个标识下每条有效数据各触发一次。
  if (type === "smart") {
    const details=asArray<Record<string,unknown>>(output["关联模型启动明细"])
    if (details.length) {
      if (depth >= 8) return {todo:null as RuntimeTodo|null,targetNames:details.map(item=>String(item["关联模型"] ?? "")).filter(Boolean),error:"跨模型触发链超过 8 层，已停止继续触发"}
      const targetNames:string[]=[]; const errors:string[]=[]; let firstTodo:RuntimeTodo|null=null
      for (const detail of details) {
        const targetName=String(detail["关联模型"] ?? "").trim(); if(!targetName) continue
        const targetInput={...flattenArchiveInput(row.name,fileName,displayFileName,digitalId,runId,input,output),originatorId:user.id,originatorName:user.display_name,originatorDepartment:user.department ?? String(input.department ?? ""),department:String(input.department ?? user.department ?? ""),
          "来源数字化标识":detail["来源数字化标识"],"关联数字化标识":detail["关联数字化标识"],"关联数据":detail["关联数据"],"数据序号":detail["数据序号"],"关联类型":detail["关联类型"]}
        try { const next=await runPublishedModel(user,targetName,targetInput,{triggerMode:"smart",sourceDepth:depth+1}); targetNames.push(targetName); if(!firstTodo&&next.todo) firstTodo=next.todo }
        catch(error){ errors.push(`${targetName}：${error instanceof Error ? error.message : "目标模型触发失败"}`) }
      }
      return {todo:firstTodo,targetNames,error:errors.length?errors.join("；"):undefined}
    }
    // 当前0622标识关联库没有可执行配置时，不回退到业务代码硬编码关系；仅历史16位业务保留旧关联兼容。
    const currentSourceCode=String(plainObject(output.approvalBusinessContent).sourceModelCode ?? plainObject(input.approvalBusinessContent).sourceModelCode ?? "")
    if (/^5011001\d{12}$/.test(currentSourceCode)) return {todo:null as RuntimeTodo|null,targetNames:[] as string[]}
  }
  // 业务模型/审批模型归档时只执行固定硬性链接；“智选”关系保存在业务模型配置中，由通用智选模型完成判断后再执行。
  const relations = type === "smart"
    ? (await sourceBusinessSmartRelations(input, output)).relations
    : archiveRelations(row, input, output)
  if (!relations.length) return { todo: null as RuntimeTodo | null, targetNames: [] as string[] }
  if (depth >= 8) return { todo: null as RuntimeTodo | null, targetNames: relations.map(item => String(item.targetModelName ?? "")).filter(Boolean), error: "跨模型触发链超过 8 层，已停止继续触发" }
  const targetInput = {
    ...flattenArchiveInput(row.name, fileName, displayFileName, digitalId, runId, input, output),
    // 通用审批模型通过运行上下文获取原始发起人及组织，不在审批模型中固化某一业务模型字段。
    originatorId: user.id,
    originatorName: user.display_name,
    originatorDepartment: user.department ?? String(input.department ?? ""),
    department: String(input.department ?? user.department ?? ""),
  }
  const targetNames: string[] = []
  const errors: string[] = []
  let firstTodo: RuntimeTodo | null = null
  for (const relation of relations) {
    const targetName = String(relation.targetModelName ?? "").trim()
    if (!targetName) continue
    try {
      const mode: TriggerMode = type === "smart" ? "smart" : "hard_link"
      let systemLink = type === "approval" && targetName === "智选模型" ? "approval_to_smart" as const : undefined as RunOptions["systemLink"]
      if (type === "business" && targetName === "审批模型") systemLink = "business_to_approval"
      const next = await runPublishedModel(user, targetName, targetInput, { triggerMode: mode, sourceDepth: depth + 1, systemLink })
      targetNames.push(targetName)
      if (!firstTodo && next.todo) firstTodo = next.todo
    } catch (error) {
      await recordModelTriggerFailure(row, runId, fileName, targetName, type === "smart" ? "smart" : "hard_link", error)
      errors.push(`${targetName}：${error instanceof Error ? error.message : "目标模型触发失败"}`)
    }
  }
  return { todo: firstTodo, targetNames, error: errors.length ? errors.join("；") : undefined }
}

function normalizeApprovalInputAliases(input: Record<string, unknown>) {
  const aliases: Array<[string,string]> = [
    ["sourceModelName","前序业务模型"],
    ["sourceFileName","前序模型文件名"],
    ["sourceDisplayFileName","中文显示名称"],
    ["sourceDigitalId","前序数字化标识"],
  ]
  for (const [internalKey, chineseKey] of aliases) {
    if ((input[internalKey] === undefined || input[internalKey] === null || input[internalKey] === "") && input[chineseKey] !== undefined) input[internalKey] = input[chineseKey]
    if ((input[chineseKey] === undefined || input[chineseKey] === null || input[chineseKey] === "") && input[internalKey] !== undefined) input[chineseKey] = input[internalKey]
  }
}

function normalizeSmartInputAliases(input: Record<string, unknown>) {
  const aliases: Array<[string,string]> = [
    ["businessSourceModelName","业务模型"],
    ["businessFileName","业务模型文件名"],
    ["businessDisplayFileName","业务中文显示名称"],
    ["businessDigitalId","业务数字化标识"],
    ["approvalResult","审批结果"],
  ]
  for (const [internalKey,chineseKey] of aliases) {
    if ((input[internalKey]===undefined || input[internalKey]===null || input[internalKey]==="") && input[chineseKey]!==undefined) input[internalKey]=input[chineseKey]
    if ((input[chineseKey]===undefined || input[chineseKey]===null || input[chineseKey]==="") && input[internalKey]!==undefined) input[chineseKey]=input[internalKey]
  }
}

export async function runPublishedModel(user: BuilderUser, modelName: string, inputValue: unknown, options: RunOptions = {}): Promise<RunResult> {
  const row = await fetchProject("m.name=$1 AND p.status='published' AND m.can_start=true", modelName)
  if (!row) throw new ModelBuilderError(404, "模型未发布或不存在")
  const triggerMode = options.triggerMode ?? "manual"
  const config = runConfig(row)
  const startModes = asArray<string>(config.startModes).map(String)
  const mandatoryBusinessApprovalStart = options.systemLink === "business_to_approval" && modelName === "审批模型" && triggerMode === "hard_link"
  const mandatoryApprovalSmartStart = options.systemLink === "approval_to_smart" && modelName === "智选模型" && triggerMode === "hard_link"
  if (startModes.length && !startModes.includes(triggerMode) && !mandatoryBusinessApprovalStart && !mandatoryApprovalSmartStart) throw new ModelBuilderError(409, `模型“${modelName}”未配置“${triggerMode}”启动方式`)
  const input = plainObject(inputValue)
  const type = modelTypeOf(row)
  if (type === "approval") normalizeApprovalInputAliases(input)
  if (type === "smart") {
    normalizeSmartInputAliases(input)
    const source = resolveBusinessSourceContext(input)
    input.businessSourceModelName = source.modelName
    input.businessFileName = source.fileName
    input.businessDisplayFileName = source.displayFileName
    input.businessDigitalId = source.digitalId
    input.businessRunId = source.runId
    // 原业务上下文是在审批输入链中追溯得到的；追溯完成后必须再次回填中文字段，
    // 否则智选模型设计中的“业务模型/业务模型文件名”等必填字段会在 executeDesign 前仍为空。
    normalizeSmartInputAliases(input)
  }

  // 审批模型的“启动”必须先于审批目标、审批路径等内部运算。
  // 这样即使数字化库配置不完整导致后续计算失败，也会留下真实审批运行实例与明确异常状态，
  // 而不是让用户看到“业务已归档但审批模型完全没有触发”。
  let approvalStart: { digitalId: string; fileName: string; displayFileName: string; runId: string; sourceRunId: string | null } | null = null
  if (type === "approval") {
    const digitalId = runDigitalId(row)
    if (!isDigitalIdentifier(digitalId)) throw new ModelBuilderError(409, `模型“${modelName}”未配置有效数字化标识（当前19位；历史16位兼容）`)
    const { fileName, displayFileName } = await runFileNames(row, user)
    const runId = randomUUID()
    const sourceRunId = String(input.sourceRunId ?? "").trim() || null
    await query("INSERT INTO model_runs(id,model_id,project_id,owner_id,file_name,display_file_name,digital_id,input_data,output_data,status,trigger_mode,source_run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'{}'::jsonb,'启动中',$9,$10)", [runId, row.model_id, row.id, user.id, fileName, displayFileName, digitalId, JSON.stringify(input), triggerMode, sourceRunId])
    approvalStart = { digitalId, fileName, displayFileName, runId, sourceRunId }
  }

  let execution: ReturnType<typeof executeDesign>
  try {
    execution = executeDesign(row.design, input)
    if (!execution.valid) throw new ModelBuilderError(400, execution.errors.join("；"))
  } catch (error) {
    if (approvalStart) {
      const message = error instanceof Error ? error.message : "审批模型设计执行失败"
      await query("UPDATE model_runs SET output_data=$1,status='运行异常',completed_at=now() WHERE id=$2", [JSON.stringify({ approvalStatus:"运行异常", approvalStartError:message }), approvalStart.runId])
    }
    throw error
  }
  if (type === "smart") {
    const smart0622=await resolveSmartPlan0622(input,execution.output)
    let statisticsState="统计分析模型未配置"
    let statisticsFileName=""
    if (smart0622.current) {
      const statisticsProject=await fetchProject("m.name=$1 AND p.status='published' AND m.can_start=true","统计分析模型")
      if (statisticsProject && (options.sourceDepth ?? 0) < 8) {
        const modes=asArray<string>(runConfig(statisticsProject).startModes).map(String)
        if (modes.includes("smart")) {
          try { const statisticsRun=await runPublishedModel(user,"统计分析模型",{...input,"统计分析来源":"智选模型","业务模型文件名":smart0622.businessFileName},{triggerMode:"smart",sourceDepth:(options.sourceDepth ?? 0)+1}); statisticsState="统计分析模型已启动"; statisticsFileName=statisticsRun.fileName }
          catch(error){ statisticsState=`统计分析模型启动失败：${error instanceof Error ? error.message : "未知错误"}` }
        } else statisticsState="统计分析模型未配置智选启动方式"
      }
      Object.assign(execution.output,{
        "业务模型":smart0622.businessSourceModelName,"业务模型文件名":smart0622.businessFileName,"业务中文显示名称":smart0622.businessDisplayFileName,"业务数字化标识":smart0622.businessDigitalId,
        "审批结果":smart0622.approvalResult,"统计分析状态":statisticsState,"统计分析模型文件名":statisticsFileName,"待处理数字化标识集合":smart0622.pendingIdentifiers,"有关联数字化标识集合":smart0622.associatedIdentifiers,
        "各数字化标识有效数据条数":smart0622.identifierCounts,"特殊判断结果":smart0622.specialResult,"正常关联判断结果":smart0622.normalResult,"关联模型集合":smart0622.associatedModels,
        "关联模型启动明细":smart0622.instances.map(item=>({"关联模型":item.targetModelName,"来源数字化标识":item.sourceIdentifier,"关联数字化标识":item.relatedIdentifier,"关联数据":item.sourceData,"数据序号":item.dataIndex,"关联类型":item.special?"特殊":"正常"})),
        "关联模型启动次数":smart0622.instances.length,"智选结果":smart0622.smartDecision,
      })
    } else Object.assign(execution.output, await smartAssociationSummary(input, execution.output))
  }
  const digitalId = approvalStart?.digitalId ?? runDigitalId(row)
  if (!isDigitalIdentifier(digitalId)) throw new ModelBuilderError(409, `模型“${modelName}”未配置有效数字化标识（当前19位；历史16位兼容）`)
  const generatedNames = approvalStart ? { fileName: approvalStart.fileName, displayFileName: approvalStart.displayFileName } : await runFileNames(row, user)
  const fileName = generatedNames.fileName
  const displayFileName = generatedNames.displayFileName
  const runId = approvalStart?.runId ?? randomUUID()
  const sourceRunId = approvalStart?.sourceRunId ?? (String(input.sourceRunId ?? "").trim() || null)
  if (type === "approval") {
    try {
    const digitalPlan=await resolveDigitalApprovalPlan(row,input,execution.output)
    if (digitalPlan) {
      execution.output.approvalResolvedSteps=digitalPlan.steps
      execution.output.approvalRoute=digitalPlan.steps.map(item=>item.title).join(" → ")
      execution.output.approvalPlanSource=digitalPlan.source
      execution.output.approvalBusinessCandidates=digitalPlan.businessCandidates
      execution.output.approvalAllowedActions=digitalPlan.actions
      execution.output.approvalOpinionRules=digitalPlan.opinionRules
      execution.output.approvalThresholdVariables=digitalPlan.thresholdVariables
      execution.output.approvalAdministrativeLevel=digitalPlan.administrativeLevel
      execution.output.approvalTechnicalLevel=digitalPlan.technicalLevel
      execution.output.approvalAssignment=digitalPlan.assignment
      execution.output.approvalModelDesignSource=digitalPlan.modelDesignSource
      execution.output.approvalModelDesignIdentifierValues=digitalPlan.modelDesignIdentifierValues
      execution.output.approvalTimeoutHours=digitalPlan.approvalTimeoutHours
      execution.output["规定时限"]=(digitalPlan as any).approvalTimeoutValue ?? (digitalPlan.approvalTimeoutHours ? String(digitalPlan.approvalTimeoutHours) : "未配置")
      execution.output.approvalBusinessContent=digitalPlan.businessContent
      execution.output.approvalComputationEvidence=digitalPlan.approvalComputationEvidence
      execution.output.approvalOrganizationPath=digitalPlan.organizationPath
      execution.output["审批人计算"]=digitalPlan.approverCalculation
      execution.output["审批路径计算"]=digitalPlan.pathCalculation
      execution.output["正式审批路径节点"]=digitalPlan.approverCalculation
      execution.output["命中数字化标识阈值"]=digitalPlan.thresholdCalculation
      execution.output["正式审批路径"]=asArray<string>(digitalPlan.pathCalculation["正式审批路径"]).join(" → ") || digitalPlan.steps.map(item=>item.title).join(" → ")
      execution.output["基础行政审批级次"]=digitalPlan.pathCalculation["基础行政审批级次"] ?? (digitalPlan.steps.some(item=>item.approvalType === "administrative") ? "一级审批" : "无")
      execution.output["最终行政审批级次"]=digitalPlan.pathCalculation["最终行政审批级次"] ?? digitalPlan.administrativeLevel
      execution.output["技术业务审查级次"]=digitalPlan.pathCalculation["技术/业务审查级次"] ?? digitalPlan.technicalLevel
      delete execution.output["基础审批目标"]
      delete execution.output["最终审批目标"]
      delete execution.output["技术业务审查目标层级"]
      execution.output["审批状态"]="待审批"
      execution.output.approvalStatus="待审批"
    }
    const stepDefs = approvalStepDefinitions(row, execution.output)
    if (!stepDefs.length) throw new ModelBuilderError(409, "审批模型未形成有效审批路径，请检查审批层级、阈值、分管和岗位数字化库")
    const firstStep = stepDefs[0]
    const ownerId = await resolveApprovalOwner(firstStep, input, user.id)
    const approver=await query<{display_name:string}>("SELECT display_name FROM users WHERE id=$1 LIMIT 1",[ownerId])
    execution.output.approvalTotalSteps=stepDefs.length
    execution.output.approvalCurrentStep=1
    execution.output.approvalCurrentApprover=approver.rows[0]?.display_name ?? firstStep.roleLabel ?? firstStep.title
    execution.output["审批总环节"]=stepDefs.length
    execution.output["当前审批环节"]=firstStep.title
    execution.output["当前审批人"]=execution.output.approvalCurrentApprover
    execution.output["审批状态"]="审批中"
    execution.output.approvalArrivedAt=new Date().toISOString()
    await query("UPDATE model_runs SET input_data=$1,output_data=$2,status='审批中',completed_at=NULL WHERE id=$3", [JSON.stringify(input), JSON.stringify(execution.output), runId])
    const todo = await createApprovalTodo(row, runId, ownerId, user.display_name, fileName, digitalId, input, execution.output, 0)
    return { todo: ownerId === user.id ? todo : null, fileName, displayFileName, digitalId, output: execution.output, runId, archived: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : "审批目标或审批路径计算失败"
      await query("UPDATE model_runs SET output_data=$1,status='运行异常',completed_at=now() WHERE id=$2", [JSON.stringify({ ...execution.output, approvalStatus:"运行异常", approvalStartError:message }), runId])
      throw error
    }
  }
  await query("INSERT INTO model_runs(id,model_id,project_id,owner_id,file_name,display_file_name,digital_id,input_data,output_data,status,completed_at,trigger_mode,source_run_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'已归档',now(),$10,$11)", [runId, row.model_id, row.id, user.id, fileName, displayFileName, digitalId, JSON.stringify(input), JSON.stringify(execution.output), triggerMode, sourceRunId])
  await archiveRun(row, user, runId, fileName, displayFileName, digitalId, input, execution.output)
  if (row.category === "数字化管理") await applyDigitalAdministrationModel(row.name, input, execution.output)
  const triggered = await triggerAfterArchive(user, row, runId, fileName, displayFileName, digitalId, input, execution.output, options.sourceDepth ?? 0)
  if (type === "business") {
    const approvalStarted = triggered.targetNames.includes("审批模型")
    if (!approvalStarted) {
      const reason = triggered.error || "业务模型数字化库已正式入库，但未形成审批模型运行实例"
      await query("UPDATE model_runs SET output_data=COALESCE(output_data,'{}'::jsonb) || $1::jsonb WHERE id=$2", [JSON.stringify({ modelClusterTriggerStatus:"异常", approvalTriggerError:reason }), runId])
      throw new ModelBuilderError(409, `业务模型已归档，但审批模型未成功启动：${reason}`)
    }
  }
  if (type === "smart") {
    const smartTodo = await createSmartResultTodo(row, runId, user.id, input, execution.output, triggered.targetNames, triggered.error)
    return { todo: smartTodo, fileName, displayFileName, digitalId, output: execution.output, runId, archived: true, triggeredModel: triggered.targetNames[0], triggeredModels: triggered.targetNames, triggerError: triggered.error }
  }
  return { todo: triggered.todo, fileName, displayFileName, digitalId, output: execution.output, runId, archived: true, triggeredModel: triggered.targetNames[0], triggeredModels: triggered.targetNames, triggerError: triggered.error }
}

export async function handleModelTodo(user: BuilderUser, todoId: string, resultName: string) {
  const found = await query<any>(`SELECT t.id,t.run_id,t.step_index,t.status,t.model,t.content,r.model_id,r.project_id,r.file_name,r.display_file_name,r.digital_id,r.input_data,r.output_data,r.owner_id AS run_owner_id,m.name AS model_name,p.suggestion,p.design,p.configuration
    FROM todos t
    LEFT JOIN model_runs r ON r.id=t.run_id
    LEFT JOIN models m ON m.id=r.model_id
    LEFT JOIN model_projects p ON p.id=r.project_id
    WHERE t.id=$1 AND t.owner_id=$2`, [todoId, user.id])
  const current = found.rows[0]
  if (!current) throw new ModelBuilderError(404, "待办不存在")
  if (!current.run_id || !current.project_id) return { handled: false as const }
  if (["已完成", "已退回"].includes(String(current.status))) throw new ModelBuilderError(409, "该待办已经办理")
  await assertCurrentRuntimeFile(String(current.run_id),String(current.file_name ?? ""))
  const projectRow: ProjectRow = {
    id: current.project_id, model_id: current.model_id, owner_id: current.run_owner_id, stage: "config", status: "published", suggestion: current.suggestion ?? {}, design: current.design ?? {}, test_data: {}, test_report: {}, configuration: current.configuration ?? {}, test_passed: true, version: 1, published_at: null, created_at: new Date(), updated_at: new Date(), name: current.model_name, category: "", description: "", can_start: true,
  }
  if (modelTypeOf(projectRow) !== "approval") return { handled: false as const }
  const settings = approvalSettings(projectRow)
  const output = plainObject(current.output_data)
  const allowedActions = asArray<string>(output.approvalAllowedActions).map(String).filter(Boolean).length
    ? asArray<string>(output.approvalAllowedActions).map(String).filter(Boolean)
    : asArray<string>(settings.actions).map(String).filter(Boolean)
  if (allowedActions.length && !allowedActions.includes(resultName)) throw new ModelBuilderError(400, `当前审批模型不允许办理动作“${resultName}”`)

  const opinionRules=asArray<Record<string,unknown>>(output.approvalOpinionRules)
  const selectedRule=opinionRules.find(item=>String(item.name ?? "")===resultName)
  const explicitTerminal=selectedRule ? boolValue(selectedRule.terminal) : resultName!=="同意"
  const doneStatus = resultName === "退回修改" ? "已退回" : "已完成"
  await query("UPDATE todos SET status=$1,handled_result=$2,handled_at=now(),updated_at=now() WHERE id=$3", [doneStatus, resultName, todoId])

  const input = plainObject(current.input_data)
  const stepDefs = approvalStepDefinitions(projectRow, output)
  const stepIndex = Number(current.step_index ?? 0)
  const approvalProcess = await approvalProcessForRun(current.run_id)

  if (!explicitTerminal && resultName === "同意" && stepIndex + 1 < stepDefs.length) {
    const nextIndex = stepIndex + 1
    const ownerId = await resolveApprovalOwner(stepDefs[nextIndex], input, String(current.run_owner_id ?? user.id))
    const approver=await query<{display_name:string}>("SELECT display_name FROM users WHERE id=$1 LIMIT 1",[ownerId])
    const nextOutput:Record<string,unknown>={
      ...output,
      approvalTotalSteps:stepDefs.length,
      approvalCurrentStep:nextIndex+1,
      approvalCurrentApprover:approver.rows[0]?.display_name ?? stepDefs[nextIndex].roleLabel ?? stepDefs[nextIndex].title,
      approvalOpinion:resultName,
      approvalTime:new Date().toISOString(),
      approvalProcess,
      approvalStatus:"审批中",
      "审批总环节":stepDefs.length,
      "当前审批环节":stepDefs[nextIndex].title,
      "当前审批人":approver.rows[0]?.display_name ?? stepDefs[nextIndex].roleLabel ?? stepDefs[nextIndex].title,
      "审批意见":resultName,
      "审批时间":new Date().toISOString(),
      "审批办理记录":approvalProcess,
      "审批状态":"审批中",
    }
    await query("UPDATE model_runs SET output_data=$1,status='审批中' WHERE id=$2",[JSON.stringify(nextOutput),current.run_id])
    const todo = await createApprovalTodo(projectRow, current.run_id, ownerId, String(input.applicant ?? user.display_name), current.file_name, current.digital_id, input, nextOutput, nextIndex)
    return { handled: true as const, completed: false, todo: ownerId === user.id ? todo : null, runId: current.run_id, output: nextOutput }
  }

  const resultKey = String(settings.resultOutputKey ?? "审批结果")
  const completedAt=new Date().toISOString()
  const finalOutput: Record<string, unknown> = {
    ...output,
    [resultKey]: resultName,
    approvalStatus: resultName === "同意" ? "审批通过" : resultName === "不同意" ? "审批不通过" : resultName === "退回修改" ? "退回修改" : resultName,
    approvalTotalSteps:stepDefs.length,
    approvalCurrentStep:Math.min(stepIndex+1,Math.max(stepDefs.length,1)),
    approvalCurrentApprover:user.display_name,
    approvalOpinion:resultName,
    approvalTime:completedAt,
    approvalProcess,
    approvalResultPdf:`${current.file_name}-审批结果.pdf`,
    "审批结果":resultName,
    "审批状态":resultName === "同意" ? "审批通过" : resultName === "不同意" ? "审批不通过" : resultName === "退回修改" ? "退回修改" : resultName,
    "审批总环节":stepDefs.length,
    "当前审批环节":stepDefs[stepIndex]?.title ?? `第${stepIndex+1}环节`,
    "当前审批人":user.display_name,
    "审批意见":resultName,
    "审批时间":completedAt,
    "审批办理记录":approvalProcess,
    "审批结果文件":`${current.file_name}-审批结果.pdf`,
    "正式审批路径":output["正式审批路径"] ?? output.approvalRoute ?? stepDefs.map(item=>item.title).join(" → "),
  }
  const runOwner = await query<{ id: string; display_name: string; employee_code: string }>("SELECT id,display_name,employee_code FROM users WHERE id=$1", [current.run_owner_id])
  const ownerUser: BuilderUser = runOwner.rows[0] ?? user
  await archiveRun(projectRow, ownerUser, current.run_id, current.file_name, String(current.display_file_name ?? current.file_name), current.digital_id, input, finalOutput, "已归档")
  const triggered = await triggerAfterArchive(ownerUser, projectRow, current.run_id, current.file_name, String(current.display_file_name ?? current.file_name), current.digital_id, input, finalOutput, 0)
  const visibleTodo = triggered.todo?.ownerId === user.id ? triggered.todo : null
  return { handled: true as const, completed: true, todo: visibleTodo, runId: current.run_id, output: finalOutput, triggeredModel: triggered.targetNames[0], triggeredModels: triggered.targetNames, triggerError: triggered.error }
}


const BUILD_STAGE_MODELS: Record<string,string> = {
  suggestion: "模型建议模型",
  design: "模型设计模型",
  test: "模型测试模型",
  config: "模型配置模型",
}
const BUILD_STAGE_ORDER = ["suggestion","design","test","config"] as const

export async function startProjectRevision(userId: string, projectId: string) {
  const row = await fetchProject("p.id=$1", projectId)
  if (!row) throw new ModelBuilderError(404, "模型建设项目不存在")
  // 当前四个建设模型的运行实例仅代表上一轮建设结果。开启修改轮次时保留模型运行/审批/智选历史，
  // 只清空“当前建设轮次”的指针，使四个独立建设模型重新可编辑、可按顺序归档。
  await query("DELETE FROM model_build_stage_runs WHERE target_project_id=$1", [projectId])
  await query("UPDATE model_projects SET stage='suggestion',status='draft',test_passed=false,test_report='{}'::jsonb,published_at=NULL,version=version+1,updated_at=now() WHERE id=$1", [projectId])
  await query("UPDATE models SET can_start=false WHERE id=$1", [row.model_id])
  return getProject(projectId)
}

export async function listBuildStageExecutions(projectId: string) {
  const result = await query<any>(`
    SELECT s.stage_key,s.stage_model_name,s.stage_run_id,s.status,s.submitted_at,
           sr.file_name AS stage_file_name,sr.display_file_name AS stage_display_file_name,sr.status AS stage_run_status,
           ar.id AS approval_run_id,ar.status AS approval_status,ar.output_data AS approval_output,
           sm.id AS smart_run_id,sm.status AS smart_status,sm.output_data AS smart_output
    FROM model_build_stage_runs s
    LEFT JOIN model_runs sr ON sr.id=s.stage_run_id
    LEFT JOIN model_runs ar ON ar.source_run_id=sr.id AND EXISTS(SELECT 1 FROM models am WHERE am.id=ar.model_id AND am.name='审批模型')
    LEFT JOIN model_runs sm ON sm.source_run_id=ar.id AND EXISTS(SELECT 1 FROM models xm WHERE xm.id=sm.model_id AND xm.name='智选模型')
    WHERE s.target_project_id=$1
    ORDER BY array_position(ARRAY['suggestion','design','test','config'],s.stage_key)
  `,[projectId])
  const map = new Map(result.rows.map((row:any)=>[String(row.stage_key),row]))
  return BUILD_STAGE_ORDER.map(stageKey => {
    const row:any = map.get(stageKey)
    let status = "未提交"
    if (row?.stage_run_id) status = "已归档"
    if (row?.approval_run_id && row.approval_status !== "已归档") status = "审批中"
    if (row?.approval_run_id && row.approval_status === "已归档") status = "审批已完成"
    if (row?.smart_run_id && row.smart_status === "已归档") status = "已完成"
    return {
      stageKey,
      stageModelName: BUILD_STAGE_MODELS[stageKey],
      status,
      runId: row?.stage_run_id ?? "",
      fileName: row?.stage_file_name ?? "",
      displayFileName: row?.stage_display_file_name ?? "",
      approvalRunId: row?.approval_run_id ?? "",
      smartRunId: row?.smart_run_id ?? "",
      submittedAt: row?.submitted_at ?? null,
    }
  })
}

export async function submitBuildStage(user: BuilderUser, projectId: string, stageKey: string) {
  if (!BUILD_STAGE_MODELS[stageKey]) throw new ModelBuilderError(400,"无效的模型建设阶段模型")
  const row = await fetchProject("p.id=$1",projectId)
  if (!row) throw new ModelBuilderError(404,"模型建设项目不存在")
  const stageIndex = BUILD_STAGE_ORDER.indexOf(stageKey as any)
  if (stageIndex > 0) {
    const statuses = await listBuildStageExecutions(projectId)
    const previous = statuses[stageIndex-1]
    if (previous.status !== "已完成") throw new ModelBuilderError(409,`请先完成“${previous.stageModelName} → 审批模型 → 智选模型”运行闭环`)
  }
  if (stageKey === "test" && !row.test_passed) throw new ModelBuilderError(409,"模型测试用例尚未通过，不能归档模型测试模型")
  if (stageKey === "config") {
    const ids = asArray<string>(plainObject(row.configuration).digitalIdentities).map(String)
    if (!isCurrentModelDigitalCode(plainObject(row.configuration).modelCode) || !ids.length || ids.some(id=>!isDigitalIdentifier(id))) throw new ModelBuilderError(409,"模型配置中的模型数字化编码必须为当前19位结构，且数字化标识配置必须完整")
  }
  const existing = await query<any>("SELECT stage_run_id FROM model_build_stage_runs WHERE target_project_id=$1 AND stage_key=$2",[projectId,stageKey])
  if (existing.rows[0]?.stage_run_id) {
    const run = await query<any>("SELECT status FROM model_runs WHERE id=$1",[existing.rows[0].stage_run_id])
    if (run.rows[0]) throw new ModelBuilderError(409,"该阶段模型已经归档。如需修改，请在当前阶段保存草稿后按版本重新建设，不重复生成同一阶段实例。")
  }
  const stagePayload = stageKey === "suggestion" ? row.suggestion : stageKey === "design" ? row.design : stageKey === "test" ? { testData: row.test_data, testReport: row.test_report } : row.configuration
  const stageModelName = BUILD_STAGE_MODELS[stageKey]
  const result = await runPublishedModel(user,stageModelName,{
    targetModelId: row.model_id,
    targetProjectId: row.id,
    targetModelName: row.name,
    stageKey,
    stagePayload,
    applicant: user.display_name,
    department: user.department ?? "",
  },{triggerMode:"manual"})
  await query(`INSERT INTO model_build_stage_runs(id,target_project_id,stage_key,stage_model_name,stage_run_id,status,submitted_by,submitted_at)
    VALUES($1,$2,$3,$4,$5,'已归档',$6,now())
    ON CONFLICT(target_project_id,stage_key) DO UPDATE SET stage_model_name=EXCLUDED.stage_model_name,stage_run_id=EXCLUDED.stage_run_id,status='已归档',submitted_by=EXCLUDED.submitted_by,submitted_at=now(),updated_at=now()`,
    [randomUUID(),projectId,stageKey,stageModelName,result.runId,user.id])
  return { result, stages: await listBuildStageExecutions(projectId) }
}
