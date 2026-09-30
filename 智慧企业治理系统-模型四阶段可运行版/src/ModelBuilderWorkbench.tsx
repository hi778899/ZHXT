import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "./api"
import { ModelFormDesigner } from "./ModelFormDesigner"
import { ModelFlowDesigner, type FlowEdge } from "./ModelFlowDesigner"
import { FormulaEditor } from "./FormulaEditor"

type Stage = "suggestion" | "design" | "test" | "config"
type FieldType = "text" | "textarea" | "select" | "dataSelect" | "dataMultiSelect" | "radio" | "checkbox" | "date" | "number" | "boolean" | "user" | "department" | "subform" | "section"
type Field = { id: string; label: string; key: string; type: FieldType; required?: boolean; options?: string[]; source?: string; placeholder?: string; defaultValue?: string }
type FlowNode = { id: string; type: string; title: string; description: string; position?: { x: number; y: number } }
type Parameter = { id: string; name: string; label: string; source: string }
type Calculation = { id: string; targetKey: string; label?: string; operation: "dateDiffInclusive" | "sum" | "difference" | "concat" | "copy"; sourceKeys: string[]; separator?: string }
type Expression = { id: string; targetKey: string; label?: string; expression: string }
type Rule = { id: string; fieldKey: string; operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "contains" | "notEmpty"; value?: string | number; then: { type: "setOutput"; key: string; value: string }; else?: { type: "setOutput"; key: string; value: string } }
type TestCase = { id: string; name: string; input: Record<string, unknown>; expectValid?: boolean; expectedOutput?: Record<string, unknown> }
type ApprovalStep = { id: string; title: string; approvalType?: string; assigneeScope?: "global_role" | "department_role" | "named_user"; role?: string; roleLabel?: string; departmentField?: string; userName?: string }
type Project = {
  id: string; modelId: string; name: string; category: string; description: string; stage: Stage; status: string; canStart: boolean; testPassed: boolean; version: number;
  suggestion: Record<string, any>; design: Record<string, any>; testData: { cases?: TestCase[] }; testReport: Record<string, any>; configuration: Record<string, any>;
  updatedAt?: string; publishedAt?: string | null;
}
type TemplateCatalogItem = { key: string; name: string; shortName: string; category: string; group: string; description: string; source: string; modelType: string; startModes: string[] }
type ModelRelation = { id: string; enabled: boolean; mode: "hard_link" | "smart"; targetModelName: string; condition?: { fieldKey?: string; operator?: string; value?: string | number }; description?: string }
type StageExecution = { stageKey: Stage; stageModelName: string; status: string; runId?: string; fileName?: string; displayFileName?: string; approvalRunId?: string; smartRunId?: string; submittedAt?: string | null }
type DigitalLibraryChoice = { id: string; name: string; isStandard?: boolean; allowAsSource?: boolean; modelName?: string }
type DigitalIdentifierChoice = { id: string; code: string; displayName: string; dataType: string; description?: string }

const stageMeta: Array<{ key: Stage; title: string; shortTitle: string; subtitle: string }> = [
  { key: "suggestion", title: "模型建议模型", shortTitle: "建议", subtitle: "形成模型目标、边界与启动条件" },
  { key: "design", title: "模型设计模型", shortTitle: "设计", subtitle: "形成表单、数据源、运算与运行结构" },
  { key: "test", title: "模型测试模型", shortTitle: "测试", subtitle: "验证输入、运算、规则与输出" },
  { key: "config", title: "模型配置模型", shortTitle: "配置", subtitle: "形成数字化库、标识和模型关系配置" },
]
const fieldMeta: Array<{ type: FieldType; label: string; sample: string }> = [
  { type: "text", label: "单行文本", sample: "名称、标题、编号" },
  { type: "textarea", label: "多行文本", sample: "事由、说明、意见" },
  { type: "select", label: "下拉选择", sample: "类型、状态、分类" },
  { type: "date", label: "日期", sample: "开始日期、结束日期" },
  { type: "number", label: "数字", sample: "金额、数量、天数" },
  { type: "boolean", label: "是否", sample: "是 / 否" },
  { type: "user", label: "人员", sample: "申请人、审批人" },
]
function uid(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function messageOf(error: unknown) { return error instanceof Error ? error.message : "操作失败" }
function useLibraryOptions(libraryId: string, sourceDigitalId: string) {
  const [options,setOptions]=useState<string[]>([])
  useEffect(()=>{
    let cancelled=false
    const params=new URLSearchParams({libraryId,sourceDigitalId,mode:"options"})
    apiFetch<{options?:string[]}>(`/api/digital-library/lookup?${params.toString()}`).then(result=>{ if(!cancelled) setOptions(result.options ?? []) }).catch(()=>{ if(!cancelled) setOptions([]) })
    return ()=>{cancelled=true}
  },[libraryId,sourceDigitalId])
  return options
}

export function ModelBuilderWorkbench({ onToast, onLaunch }: { onToast: (message: string) => void; onLaunch: (modelName: string) => void }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<TemplateCatalogItem[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [stage, setStage] = useState<Stage>("suggestion")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [stageExecutions, setStageExecutions] = useState<StageExecution[]>([])
  const [stageRefreshing, setStageRefreshing] = useState(false)
  const [revisionStarting, setRevisionStarting] = useState(false)

  const loadStageExecutions = async (projectId: string) => {
    setStageRefreshing(true)
    try {
      const result = await apiFetch<{ stages: StageExecution[] }>(`/api/model-builder/${projectId}/stage-models`)
      setStageExecutions(result.stages ?? [])
      return result.stages ?? []
    } catch (e) { setError(messageOf(e)); return [] } finally { setStageRefreshing(false) }
  }

  const load = async (selectId?: string) => {
    setLoading(true)
    try {
      const [result, templateResult] = await Promise.all([
        apiFetch<{ projects: Project[] }>("/api/model-builder"),
        apiFetch<{ templates: TemplateCatalogItem[] }>("/api/model-builder/templates"),
      ])
      setProjects(result.projects)
      setTemplates(templateResult.templates ?? [])
      const next = result.projects.find(item => item.id === (selectId ?? project?.id)) ?? result.projects[0] ?? null
      setProject(next ? copy(next) : null)
      if (next) {
        const stages = await loadStageExecutions(next.id)
        const inProgress = stageMeta.find(meta => (stages.find(item => item.stageKey === meta.key)?.status ?? "未提交") !== "已完成")
        setStage(inProgress?.key ?? "suggestion")
      } else setStageExecutions([])
      setError("")
    } catch (e) { setError(messageOf(e)) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const create = async (template: string) => {
    setSaving(true)
    try {
      const result = await apiFetch<{ project: Project }>("/api/model-builder", { method: "POST", body: JSON.stringify({ template }) })
      const meta = templates.find(item => item.key === template)
      setCreateOpen(false); await load(result.project.id); setStage("suggestion"); onToast(meta ? `已从“${meta.name}”模板创建目标模型；请先运行“模型建议模型”` : "已创建目标模型；请先运行模型建议模型")
    } catch (e) { setError(messageOf(e)) } finally { setSaving(false) }
  }
  const saveStage = async (target: Stage, data: Record<string, unknown>) => {
    if (!project) return null
    setSaving(true)
    try {
      const result = await apiFetch<{ project: Project }>(`/api/model-builder/${project.id}/${target}`, { method: "PATCH", body: JSON.stringify({ data }) })
      setProject(copy(result.project)); setProjects(items => items.map(item => item.id === result.project.id ? result.project : item)); setError(""); onToast(`${stageMeta.find(x => x.key === target)?.title}草稿已保存`); return result.project
    } catch (e) { setError(messageOf(e)); return null } finally { setSaving(false) }
  }
  const submitStageModel = async (target: Stage, data?: Record<string, unknown>) => {
    if (!project) return false
    if (data) { const saved = await saveStage(target, data); if (!saved) return false }
    setSaving(true)
    try {
      const result = await apiFetch<{ result: { runId: string; todo?: unknown }; stages: StageExecution[] }>(`/api/model-builder/${project.id}/${target}/submit`, { method: "POST", body: "{}" })
      setStageExecutions(result.stages ?? [])
      const meta = stageMeta.find(item => item.key === target)
      onToast(`${meta?.title ?? "建设模型"}已归档，并按统一关系进入审批模型`); setError("")
      const refreshed = await apiFetch<{ project: Project }>(`/api/model-builder/${project.id}`)
      setProject(copy(refreshed.project)); setProjects(items => items.map(item => item.id === refreshed.project.id ? refreshed.project : item))
      return true
    } catch (e) { setError(messageOf(e)); return false } finally { setSaving(false) }
  }
  const startRevision = async () => {
    if (!project || revisionStarting) return
    if (!window.confirm(`开启“${project.name}”新的修改轮次？\n\n现有模型运行、审批、智选和数字化库历史记录都会保留；当前四个建设模型会重新开放编辑，目标模型在重新发布前暂停人工发起。`)) return
    setRevisionStarting(true)
    try {
      const result = await apiFetch<{ project: Project; stages: StageExecution[] }>(`/api/model-builder/${project.id}/revise`, { method: "POST", body: "{}" })
      setProject(copy(result.project)); setProjects(items => items.map(item => item.id === result.project.id ? result.project : item)); setStageExecutions(result.stages ?? []); setStage("suggestion"); setError(""); onToast(`已开启 ${project.name} v${result.project.version} 修改轮次，四个建设模型均可编辑`)
    } catch (e) { setError(messageOf(e)) } finally { setRevisionStarting(false) }
  }
  const executionOf = (key: Stage) => stageExecutions.find(item => item.stageKey === key) ?? { stageKey: key, stageModelName: stageMeta.find(item => item.key === key)?.title ?? key, status: "未提交" }
  // 四个阶段本身是四个独立建设模型。编辑不互相锁定，便于一次把目标模型的四部分配置完整；
  // 归档/审批/智选仍按建议→设计→测试→配置的顺序进行。
  const canOpenStage = (_key: Stage) => true

  if (loading) return <div className="builder-loading">正在加载模型建设项目…</div>
  return <div className="mb-root">
    <aside className="mb-projects">
      <div className="mb-project-head"><div><b>模型建设</b><span>{projects.length} 个项目</span></div><button onClick={() => setCreateOpen(true)} className="mb-primary small">＋ 新建</button></div>
      <div className="mb-project-list">{projects.map(item => <button key={item.id} onClick={() => { setProject(copy(item)); setStage("suggestion"); setError(""); void loadStageExecutions(item.id) }} className={project?.id === item.id ? "active" : ""}><span className="mb-project-icon">M</span><span><b>{item.name}</b><small>{item.category} · v{item.version}</small></span><em className={`mb-badge ${item.status}`}>{item.status === "published" ? "已发布" : item.testPassed ? "已测试" : "建设中"}</em></button>)}</div>
      <div className="mb-project-note">四个建设环节不是一个页面中的四个阶段，而是“模型建议模型、模型设计模型、模型测试模型、模型配置模型”四个独立模型·库；每个建设模型归档后同样进入审批模型和智选模型。</div>
    </aside>
    <main className="mb-main">
      {!project ? <div className="mb-empty"><h3>还没有目标模型</h3><p>创建目标模型后，依次运行四个独立建设模型。模板只用于减少重复录入，不替代模型建设、审批和智选运行。</p><div><button className="mb-primary" onClick={() => setCreateOpen(true)}>打开模型模板中心</button></div></div> : <>
        <header className="mb-hero"><div><div className="mb-kicker">智能体式数智化体系 · 模型·库建设</div><h2>{project.name}</h2><p>{project.description || "通过四个独立建设模型完成目标模型建设。"}</p></div><div className="mb-hero-actions"><span className={`mb-status ${project.status}`}>{project.status === "published" ? "已发布" : project.testPassed ? "测试通过" : "建设中"}</span>{stageExecutions.some(item => item.status !== "未提交") && <button className="mb-secondary" disabled={revisionStarting} onClick={() => void startRevision()}>{revisionStarting ? "正在开启…" : "修改模型（新轮次）"}</button>}{project.status === "published" && (project.configuration?.startModes ?? project.suggestion?.startModes ?? []).includes("manual") && <button className="mb-primary" onClick={() => onLaunch(project.name)}>运行模型</button>}</div></header>
        <section className="mb-stage-model-chain">
          <div className="mb-stage-model-chain-head"><div><b>四个独立建设模型</b><span>四个建设模型均可打开填写和保存草稿；归档仍按“建议 → 审批 → 智选 → 设计 → 审批 → 智选 → 测试 → 审批 → 智选 → 配置”顺序执行。</span></div><button className="mb-secondary small" disabled={stageRefreshing} onClick={() => void loadStageExecutions(project.id)}>{stageRefreshing ? "刷新中…" : "刷新运行状态"}</button></div>
          <div className="mb-stage-model-grid">{stageMeta.map((item, index) => { const execution = executionOf(item.key); const accessible = canOpenStage(item.key); return <button key={item.key} onClick={() => setStage(item.key)} className={`${stage === item.key ? "active" : ""} status-${execution.status}`}><span className="mb-stage-order">{index + 1}</span><div><b>{item.title}</b><small>{item.subtitle}</small>{execution.displayFileName && <em>{execution.displayFileName}</em>}</div><strong>{execution.status}</strong></button> })}</div>
        </section>
        {error && <div className="mb-error">{error}</div>}
        <section className="mb-stage-panel">
          {stage === "suggestion" && <SuggestionStage project={project} execution={executionOf("suggestion")} saving={saving} onSave={data => saveStage("suggestion", data)} onNext={data => submitStageModel("suggestion", data)}/>} 
          {stage === "design" && <DesignStage project={project} execution={executionOf("design")} saving={saving} onSave={data => saveStage("design", data)} onNext={data => submitStageModel("design", data)}/>} 
          {stage === "test" && <TestStage project={project} execution={executionOf("test")} saving={saving} onProject={next => { setProject(copy(next)); setProjects(items => items.map(item => item.id === next.id ? next : item)) }} onError={setError} onToast={onToast} onNext={() => submitStageModel("test")}/>} 
          {stage === "config" && <ConfigStage project={project} projects={projects} execution={executionOf("config")} saving={saving} onSave={data => saveStage("config", data)} onSubmitStage={data => submitStageModel("config", data)} onRefreshStages={() => loadStageExecutions(project.id)} onProject={next => { setProject(copy(next)); setProjects(items => items.map(item => item.id === next.id ? next : item)) }} onError={setError} onToast={onToast} onLaunch={() => onLaunch(project.name)}/>} 
        </section>
      </>}
    </main>
    {createOpen && <div className="mb-modal-backdrop" onMouseDown={() => setCreateOpen(false)}><div className="mb-modal mb-template-center" onMouseDown={e => e.stopPropagation()}>
      <div className="mb-template-center-head"><div><h3>模型模板中心</h3><p>模板用于“多选择、少填写”。创建的是目标模型建设事项，真正建设由四个独立建设模型依次完成；数字化建设模型也在这里作为普通模型使用。</p></div><button className="mb-modal-close" onClick={() => setCreateOpen(false)}>×</button></div>
      {["基础业务", "基础数字化库", "数字化建设", "审批智选配置", "系统管控", "智能关联", "模型建设", "会议模型簇"].map(group => { const items = templates.filter(item => item.group === group); if (!items.length) return null; return <section className="mb-template-group" key={group}><header><b>{group}</b><span>{group === "会议模型簇" ? "会议不是一个大流程，而是由多个独立模型·库按关系组合运行" : "每个模板均生成独立模型·库建设项目"}</span></header><div className="mb-template-grid">{items.map(item => <button key={item.key} disabled={saving} onClick={() => void create(item.key)}><div className="mb-template-card-top"><b>{item.name}</b><em>{item.group === "基础数字化库" ? "数字化库模型" : item.group === "审批智选配置" ? "配置模型" : item.modelType === "approval" ? "审批模型" : item.modelType === "smart" ? "智选模型" : item.modelType === "build" ? "建设模型" : item.modelType === "digital" ? "数字化模型" : "业务模型"}</em></div><span>{item.description}</span><small>启动：{item.startModes.map(mode => mode === "manual" ? "人工" : mode === "smart" ? "智选" : mode === "hard_link" ? "硬性链接" : mode === "schedule" ? "定时" : mode === "quantity" ? "定量" : mode).join(" / ")}</small><small>依据：{item.source}</small></button>)}</div></section> })}
      <div className="mb-modal-foot"><span>模型模板是建设起点，不是固化的业务流程。</span><button className="mb-secondary" onClick={() => setCreateOpen(false)}>取消</button></div>
    </div></div>}
  </div>
}

function SuggestionStage({ project, execution, saving, onSave, onNext }: { project: Project; execution: StageExecution; saving: boolean; onSave: (data: Record<string, unknown>) => Promise<unknown>; onNext: (data: Record<string, unknown>) => Promise<boolean> }) {
  const [data, setData] = useState(() => ({ ...project.suggestion, name: project.suggestion.name ?? project.name, category: project.suggestion.category ?? project.category, description: project.suggestion.description ?? project.description, modelType: project.suggestion.modelType ?? "business", goal: project.suggestion.goal ?? "", scope: project.suggestion.scope ?? "", ownerDepartment: project.suggestion.ownerDepartment ?? "", startModes: project.suggestion.startModes ?? ["manual"] }))
  useEffect(() => setData({ ...project.suggestion, name: project.suggestion.name ?? project.name, category: project.suggestion.category ?? project.category, description: project.suggestion.description ?? project.description, modelType: project.suggestion.modelType ?? "business", goal: project.suggestion.goal ?? "", scope: project.suggestion.scope ?? "", ownerDepartment: project.suggestion.ownerDepartment ?? "", startModes: project.suggestion.startModes ?? ["manual"] }), [project.id, project.version])
  const toggleMode = (mode: string) => setData((old: any) => ({ ...old, startModes: old.startModes.includes(mode) ? old.startModes.filter((x: string) => x !== mode) : [...old.startModes, mode] }))
  const businessOptions=useLibraryOptions("lib-standard-business-definition","5013001001006002")
  const departmentOptions=useLibraryOptions("lib-standard-dept","5013001001003001")
  const optionList=(current:string,items:string[])=>[...new Set([current,...items].filter(Boolean))]
  return <div className="mb-editor-stage"><StageTitle number="01" title="模型建议模型" subtitle="先明确模型承担什么独立功能、由谁使用、在什么条件下启动。这里不是写流程说明，而是定义模型建设边界。"/>
    {data.templateSource && <div className="mb-template-origin"><b>当前建设起点</b><span>模板：{data.templateKey || "自定义"} · 推演依据：{data.templateSource}</span><em>模板只提供四阶段初值，后续内容均可继续修改。</em></div>}
    <div className="mb-form-grid"><label>模型名称<input value={data.name} onChange={e => setData({ ...data, name: e.target.value })}/></label><label>业务分类<select value={data.category} onChange={e => setData({ ...data, category: e.target.value })}><option value="">从业务定义数字化库选择</option>{optionList(String(data.category ?? ""),businessOptions).map(item=><option key={item} value={item}>{item}</option>)}</select><small>业务分类来自“业务定义模型”的数字化库；需要新分类时先运行对应基础模型。</small></label><label>模型类型<select value={data.modelType} onChange={e => setData({ ...data, modelType: e.target.value })}><option value="business">业务模型</option><option value="approval">审批模型</option><option value="smart">智选模型</option><option value="service">服务模型</option><option value="build">模型建设模型</option><option value="digital">数字化建设模型</option></select></label><label>责任部门<select value={data.ownerDepartment} onChange={e => setData({ ...data, ownerDepartment: e.target.value })}><option value="">从部门信息数字化库选择</option>{optionList(String(data.ownerDepartment ?? ""),departmentOptions).map(item=><option key={item} value={item}>{item}</option>)}</select><small>责任部门来自部门信息模型数字化库。</small></label><label className="wide">模型说明<textarea rows={3} value={data.description} onChange={e => setData({ ...data, description: e.target.value })}/></label><label className="wide">模型目标<textarea rows={3} value={data.goal} onChange={e => setData({ ...data, goal: e.target.value })} placeholder="例如：形成请休假申请业务记录并归档"/></label><label className="wide">适用范围<textarea rows={3} value={data.scope} onChange={e => setData({ ...data, scope: e.target.value })} placeholder="例如：全体在职人员，按当前用户与组织关系读取数据"/></label></div>
    <div className="mb-section"><div className="mb-section-title"><b>模型启动方式</b><span>可多选。模型发布后按配置决定人工入口或系统触发方式。</span></div><div className="mb-check-grid">{[["manual","人工点击"],["smart","智选触发"],["schedule","定时启动"],["quantity","定量启动"],["hard_link","硬性链接"]].map(([key,label]) => <label key={key}><input type="checkbox" checked={data.startModes.includes(key)} onChange={() => toggleMode(key)}/><span><b>{label}</b><small>{key === "manual" ? "驾驶舱可发起模型" : key === "smart" ? "由数字化标识关联触发" : key === "schedule" ? "按周期或时点启动" : key === "quantity" ? "按数据量阈值启动" : "前序模型归档后固定启动本模型"}</small></span></label>)}</div></div>
    <StageFooter saving={saving} submitted={execution.status !== "未提交"} onSave={() => void onSave(data)} onNext={() => void onNext(data)} nextLabel="归档模型建议模型"/>
  </div>
}

function DesignStage({ project, execution, saving, onSave, onNext }: { project: Project; execution: StageExecution; saving: boolean; onSave: (data: Record<string, unknown>) => Promise<unknown>; onNext: (data: Record<string, unknown>) => Promise<boolean> }) {
  const [design, setDesign] = useState<Record<string, any>>(() => copy(project.design))
  const [dataLibraries,setDataLibraries]=useState<DigitalLibraryChoice[]>([])
  useEffect(() => { setDesign(copy(project.design)) }, [project.id, project.version])
  useEffect(()=>{ apiFetch<{libraries:DigitalLibraryChoice[]}>("/api/digital-libraries").then(result=>setDataLibraries((result.libraries ?? []).filter(item=>item.allowAsSource !== false))).catch(()=>setDataLibraries([])) },[project.id])
  const modelType = String(project.suggestion?.modelType ?? "business")
  const fields: Field[] = design.fields ?? []; const nodes: FlowNode[] = design.nodes ?? []; const edges: FlowEdge[] = design.edges ?? []; const parameters: Parameter[] = design.parameters ?? []; const calculations: Calculation[] = design.calculations ?? []; const expressions: Expression[] = design.expressions ?? []; const rules: Rule[] = design.rules ?? []
  const cleanResultName=(value:string)=>{ const cleaned=value.replace(/[^\p{L}\p{N}_]/gu, ""); return modelType === "approval" ? cleaned.replace(/[A-Za-z]/g, "") : cleaned }
  const approvalSettings = design.approvalSettings ?? { taskTitle: "审批任务", routeOutputKey: "正式审批路径", resultOutputKey: "审批结果", actions: ["同意", "不同意", "退回修改"], steps: [] }
  const approvalSteps: ApprovalStep[] = approvalSettings.steps ?? []
  const patch = (changes: Record<string, any>) => setDesign(old => ({ ...old, ...changes }))
  const approvalSourceIds:Record<string,string> = approvalSettings.standardSourceIds ?? {}
  const smartSourceIds:Record<string,string> = design.smartStandardSourceIds ?? {}
  const setApprovalSource=(key:string,id:string)=>{ const lib=dataLibraries.find(item=>item.id===id); patch({approvalSettings:{...approvalSettings,standardSourceIds:{...approvalSourceIds,[key]:id},standardSources:{...(approvalSettings.standardSources ?? {}),[key]:lib?.name ?? ""}}}) }
  const setSmartSource=(key:string,id:string)=>{ const lib=dataLibraries.find(item=>item.id===id); patch({smartStandardSourceIds:{...smartSourceIds,[key]:id},smartStandardSources:{...(design.smartStandardSources ?? {}),[key]:lib?.name ?? ""}}) }
  const sourceSelect=(value:string,onChange:(id:string)=>void)=><select value={value ?? ""} onChange={e=>onChange(e.target.value)}><option value="">请选择数字化库</option>{dataLibraries.map(lib=><option key={lib.id} value={lib.id}>{lib.name}</option>)}</select>
  const addParameter = () => patch({ parameters: [...parameters, { id: uid("param"), name: modelType === "approval" ? `运行参数${parameters.length + 1}` : `p${parameters.length + 1}`, label: "运行参数", source: "用户输入" }] })
  const updateParameter = (id: string, changes: Partial<Parameter>) => patch({ parameters: parameters.map(item => item.id === id ? { ...item, ...changes } : item) })
  const addCalculation = () => patch({ calculations: [...calculations, { id: uid("calc"), targetKey: modelType === "approval" ? `计算结果${calculations.length + 1}` : "result", label: "计算结果", operation: "copy", sourceKeys: [fields.find(field => !["section", "subform"].includes(field.type))?.key ?? ""] }] })
  const updateCalculation = (id: string, changes: Partial<Calculation>) => patch({ calculations: calculations.map(item => item.id === id ? { ...item, ...changes } : item) })
  const addExpression = () => patch({ expressions: [...expressions, { id: uid("expr"), targetKey: modelType === "approval" ? `公式结果${expressions.length + 1}` : `result${expressions.length + 1}`, label: "公式结果", expression: "" }] })
  const updateExpression = (id: string, changes: Partial<Expression>) => patch({ expressions: expressions.map(item => item.id === id ? { ...item, ...changes } : item) })
  const addRule = () => patch({ rules: [...rules, { id: uid("rule"), fieldKey: fields.find(field => !["section", "subform"].includes(field.type))?.key ?? "", operator: "eq", value: "", then: { type: "setOutput", key: modelType === "approval" ? "规则结果" : "result", value: "" } }] })
  const updateRule = (id: string, changes: Partial<Rule>) => patch({ rules: rules.map(item => item.id === id ? { ...item, ...changes } : item) })
  const setApprovalSteps = (steps: ApprovalStep[]) => patch({ approvalSettings: { ...approvalSettings, steps } })
  const addApprovalStep = () => setApprovalSteps([...approvalSteps, { id: uid("approval-step"), title: `审批步骤${approvalSteps.length + 1}`, approvalType: "business", assigneeScope: "global_role", role: "user", roleLabel: "普通用户", departmentField: "department" }])
  const updateApprovalStep = (id: string, changes: Partial<ApprovalStep>) => setApprovalSteps(approvalSteps.map(item => item.id === id ? { ...item, ...changes } : item))
  const formulaVariables = [...fields.filter(field => !["section", "subform"].includes(field.type)).map(field => ({ key: field.key, label: field.label, kind: "表单字段" })), ...parameters.map(item => ({ key: item.name, label: item.label, kind: "参数" })), ...calculations.map(item => ({ key: item.targetKey, label: item.label || item.targetKey, kind: "运算结果" })), ...expressions.map(item => ({ key: item.targetKey, label: item.label || item.targetKey, kind: "公式结果" }))]
  const typeHint = modelType === "approval"
    ? "这是系统通用审批模型：不固化请假、采购等任何具体业务字段。前序业务对象以文件名、数字化标识和运行上下文动态带入；审批路线、人员匹配和审批结论属于本模型内部逻辑。"
    : modelType === "smart"
      ? "这是系统通用智选模型：不固化任何具体业务字段或后续目标列表。它读取原业务模型文件名、当前19位数字化标识（历史16位仅兼容读取），并按数字化库中的标识关联配置判断是否启动新的业务模型。"
      : modelType === "build"
        ? "这是模型建设模型：它本身也是独立模型·库，归档后同样进入审批模型和智选模型；不再把四个建设模型拼成一个页面流程。"
        : modelType === "digital"
          ? "这是数字化建设模型：从数字化库选择对象，形成业务定义、编码、属性、标识或数字化库配置，归档后同样进入审批模型和智选模型。"
          : "这是业务模型：只负责本业务数据的交互、读取、运算、判断与归档。需要审批时，通过配置模型形成硬性链接触发通用审批模型；需要审批后智选时，智选关联规则也配置在当前业务模型中。"

  return <div className="mb-editor-stage"><StageTitle number="02" title="模型设计模型" subtitle="像零代码表单设计器一样完成交互表单，同时用通用运行节点描述本模型内部的数据处理结构。跨模型关系不混入节点画布。"/>
    <div className={`mb-model-type-banner type-${modelType}`}><b>{modelType === "approval" ? "独立审批模型" : modelType === "smart" ? "独立智选模型" : modelType === "build" ? "独立模型建设模型" : modelType === "digital" ? "独立数字化建设模型" : modelType === "service" ? "服务模型" : "业务模型"}</b><span>{typeHint}</span></div>
    <ModelFormDesigner projectName={project.name} projectDescription={project.description} design={design} onChange={setDesign}/>
    <ModelFlowDesigner modelType={modelType} nodes={nodes} edges={edges} onChange={(nextNodes, nextEdges) => patch({ nodes: nextNodes, edges: nextEdges })}/>
    {modelType === "approval" && <div className="mb-section"><div className="mb-section-title"><div><b>审批模型数字化数据源</b><span>审批路线优先由这些数字化库的模型运行记录动态生成。业务模型增加后，不需要修改审批模型代码。</span></div></div><div className="mb-form-grid">
      <label>行政审批层级分选数字化库{sourceSelect(approvalSourceIds.administrativeLevel || "lib-standard-admin-approval-selector",id=>setApprovalSource("administrativeLevel",id))}</label>
      <label>业务审批层级分选数字化库{sourceSelect(approvalSourceIds.businessLevel || "lib-standard-business-approval-selector",id=>setApprovalSource("businessLevel",id))}</label>
      <label>岗位分选数字化库{sourceSelect(approvalSourceIds.positions || "lib-standard-position-selector",id=>setApprovalSource("positions",id))}</label>
      <label>人员信息数字化库{sourceSelect(approvalSourceIds.personnel || "lib-standard-person",id=>setApprovalSource("personnel",id))}</label>
      <label>部门信息数字化库{sourceSelect(approvalSourceIds.departments || "lib-standard-dept",id=>setApprovalSource("departments",id))}</label>
      <label>审批分管配置数字化库{sourceSelect(approvalSourceIds.approvalAssignment || "lib-standard-approval-assignment",id=>setApprovalSource("approvalAssignment",id))}</label>
      <label>审批阈值配置数字化库{sourceSelect(approvalSourceIds.thresholds || "lib-standard-threshold-config",id=>setApprovalSource("thresholds",id))}</label>
      <label>审批意见数字化库{sourceSelect(approvalSourceIds.opinions || "lib-standard-approval-opinion",id=>setApprovalSource("opinions",id))}</label>
      <label>模型时限数字化库{sourceSelect(approvalSourceIds.timeout || "lib-standard-model-timeout",id=>setApprovalSource("timeout",id))}</label>
    </div><div className="mb-inline-tip"><b>运行规则：</b>先按业务分类读取行政/业务审批层级，再读取部门、岗位和人员数字化数据形成审批路径；若对应数字化配置暂未建立，才使用下面的兼容兜底步骤。</div></div>}
    {modelType === "smart" && <div className="mb-section"><div className="mb-section-title"><div><b>智选模型数字化数据源</b><span>智选只读取数字化配置和标识关联记录；后续模型关系由数字化配置数据决定。</span></div></div><div className="mb-form-grid">
      <label>数字化配置数字化库{sourceSelect(smartSourceIds.digitalConfig || "lib-standard-digital-config",id=>setSmartSource("digitalConfig",id))}</label>
      <label>标识触发配置数字化库{sourceSelect(smartSourceIds.identifierTrigger || "lib-standard-identifier-trigger",id=>setSmartSource("identifierTrigger",id))}</label>
      <label>数字化标识数字化库{sourceSelect(smartSourceIds.identifiers || "lib-standard-identifier",id=>setSmartSource("identifiers",id))}</label>
      <label>模型信息数字化库{sourceSelect(smartSourceIds.models || "lib-standard-model",id=>setSmartSource("models",id))}</label>
    </div></div>}
    {modelType === "approval" && <div className="mb-section approval-model-settings"><div className="mb-section-title"><div><b>兼容兜底审批步骤</b><span>仅当上方数字化库没有匹配到审批配置时使用。正常运行优先读取数字化库，不把具体业务审批人员固化在审批模型中。</span></div><button className="mb-secondary small" onClick={addApprovalStep}>＋ 添加兜底步骤</button></div><div className="mb-form-grid"><label>审批待办标题<input value={approvalSettings.taskTitle ?? "审批任务"} onChange={e => patch({ approvalSettings: { ...approvalSettings, taskTitle: e.target.value } })}/></label><label>审批路径输出字段<input value="正式审批路径" readOnly/><small>系统按数字化标识映射保存，不使用英文业务字段名。</small></label><label>审批结果输出字段<input value="审批结果" readOnly/><small>系统按数字化标识映射保存，不使用英文业务字段名。</small></label><label>无匹配人员时<input value="阻止流转并提示管理员配置角色" readOnly/></label><label className="wide">兜底办理动作<input value={(approvalSettings.actions ?? ["同意", "不同意", "退回修改"]).join("、")} onChange={e => patch({ approvalSettings: { ...approvalSettings, actions: e.target.value.split(/[、,，]/).map((x: string) => x.trim()).filter(Boolean) } })}/></label></div>
      <div className="approval-step-list">{approvalSteps.length === 0 ? <div className="mb-mini-empty">尚未配置兜底步骤。数字化审批配置完整时可不依赖兜底；为兼容历史数据建议保留至少一个。</div> : approvalSteps.map((step, index) => <div className="approval-step-row" key={step.id}><span className="approval-step-index">{index + 1}</span><label>步骤名称<input value={step.title} onChange={e => updateApprovalStep(step.id, { title: e.target.value })}/></label><label>审批类型<select value={step.approvalType ?? "business"} onChange={e => updateApprovalStep(step.id, { approvalType: e.target.value })}><option value="administrative">行政审批</option><option value="business">业务审批</option><option value="other">其他审批</option></select></label><label>负责人范围<select value={step.assigneeScope ?? "global_role"} onChange={e => updateApprovalStep(step.id, { assigneeScope: e.target.value as ApprovalStep["assigneeScope"] })}><option value="global_role">全局角色</option><option value="department_role">申请人所属部门内角色</option><option value="named_user">指定人员</option></select></label>{step.assigneeScope === "named_user" ? <label>指定人员<input value={step.userName ?? ""} onChange={e => updateApprovalStep(step.id, { userName: e.target.value })} placeholder="姓名"/></label> : <label>负责人角色<select value={step.role ?? "user"} onChange={e => { const role=e.target.value; const labels:Record<string,string>={attendance_supervisor:"历史兼容角色（考勤主管）",department_manager:"部门负责人",admin:"系统管理员",user:"普通用户"}; updateApprovalStep(step.id, { role, roleLabel: labels[role] ?? role }) }}><option value="department_manager">部门负责人</option><option value="admin">系统管理员</option><option value="user">普通用户</option><option value="attendance_supervisor">历史兼容角色（考勤主管）</option></select></label>}<div className="approval-step-actions"><button disabled={index===0} onClick={() => { const next=[...approvalSteps]; [next[index-1],next[index]]=[next[index],next[index-1]]; setApprovalSteps(next) }}>上移</button><button disabled={index===approvalSteps.length-1} onClick={() => { const next=[...approvalSteps]; [next[index],next[index+1]]=[next[index+1],next[index]]; setApprovalSteps(next) }}>下移</button><button className="mb-text-danger" onClick={() => setApprovalSteps(approvalSteps.filter(x => x.id !== step.id))}>删除</button></div></div>)}</div><div className="mb-inline-tip"><b>通用审批模型：</b>审批模型自身不保存任何具体业务模型字段。办理时根据前序运行上下文动态展示当前业务内容；审批步骤及负责人规则只定义通用管控过程。</div></div>}
    <div className="mb-section"><div className="mb-section-title"><div><b>参数定义</b><span>参数只服务于本模型运行，不直接作为数字化库存储项；参数名称在本模型内保持唯一。</span></div><button className="mb-secondary small" onClick={addParameter}>＋ 添加参数</button></div>{parameters.length === 0 ? <div className="mb-mini-empty">尚未定义运行参数。模型有派生值或规则中间量时可在这里定义。</div> : <div className="mb-config-list">{parameters.map(param => <div key={param.id} className="mb-param-row"><input value={param.label} onChange={e => updateParameter(param.id, { label: e.target.value })} placeholder="参数含义"/><input value={param.name} onChange={e => updateParameter(param.id, { name: cleanResultName(e.target.value) })} placeholder={modelType === "approval" ? "参数名称，例如：正式审批路径" : "参数名称"}/><input value={param.source} onChange={e => updateParameter(param.id, { source: e.target.value })} placeholder="来源，如计算结果 / 用户输入"/><button onClick={() => patch({ parameters: parameters.filter(x => x.id !== param.id) })}>删除</button></div>)}</div>}</div>
    <div className="mb-section"><div className="mb-section-title"><div><b>运算配置</b><span>不是只写文字公式：这里配置服务器实际执行的运算。</span></div><button className="mb-secondary small" onClick={addCalculation}>＋ 添加运算</button></div>{calculations.length === 0 ? <div className="mb-mini-empty">尚未配置运算。</div> : <div className="mb-config-list">{calculations.map(calc => <div key={calc.id} className="mb-calc-row"><input value={calc.targetKey} onChange={e => updateCalculation(calc.id, { targetKey: cleanResultName(e.target.value) })} placeholder="结果参数"/><select value={calc.operation} onChange={e => updateCalculation(calc.id, { operation: e.target.value as Calculation["operation"] })}><option value="dateDiffInclusive">日期差（含首尾）</option><option value="sum">求和</option><option value="difference">相减</option><option value="concat">文本拼接</option><option value="copy">复制</option></select><input value={(calc.sourceKeys ?? []).join(",")} onChange={e => updateCalculation(calc.id, { sourceKeys: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} placeholder="来源字段，逗号分隔"/><button onClick={() => patch({ calculations: calculations.filter(x => x.id !== calc.id) })}>删除</button></div>)}</div>}</div>
    <div className="mb-section formula-section"><div className="mb-section-title"><div><b>公式计算编辑器</b><span>可直接用字段、参数和运算结果编写可执行表达式；测试和正式运行均由服务器安全解析执行。</span></div><button className="mb-secondary small" onClick={addExpression}>＋ 添加公式结果</button></div>{expressions.length === 0 ? <div className="mb-mini-empty">尚未配置公式计算。适合 IF、日期差、拼接、求和及多层组合运算。</div> : <div className="formula-expression-list">{expressions.map(expr => <div key={expr.id} className="formula-expression-card"><div className="formula-expression-head"><input value={expr.label ?? ""} onChange={e => updateExpression(expr.id, { label: e.target.value })} placeholder="公式结果名称"/><input value={expr.targetKey} onChange={e => updateExpression(expr.id, { targetKey: cleanResultName(e.target.value) })} placeholder={modelType === "approval" ? "结果名称，例如：正式审批路径" : "结果名称"}/><button onClick={() => patch({ expressions: expressions.filter(x => x.id !== expr.id) })}>删除</button></div><FormulaEditor value={expr.expression} onChange={expression => updateExpression(expr.id, { expression })} variables={formulaVariables.filter(item => item.key !== expr.targetKey)} sampleValues={Object.fromEntries(formulaVariables.map(item => [item.key, item.key.toLowerCase().includes("date") ? "2026-09-08" : item.key.toLowerCase().includes("day") ? 2 : 1]))}/></div>)}</div>}</div>
    <div className="mb-section"><div className="mb-section-title"><div><b>条件与结果规则</b><span>规则命中后写入模型输出参数，测试阶段和正式运行使用同一规则引擎。</span></div><button className="mb-secondary small" onClick={addRule}>＋ 添加规则</button></div>{rules.length === 0 ? <div className="mb-mini-empty">尚未配置条件规则。</div> : <div className="mb-config-list">{rules.map(rule => <div key={rule.id} className="mb-rule-row"><select value={rule.fieldKey} onChange={e => updateRule(rule.id, { fieldKey: e.target.value })}>{[...fields.filter(f => !["section", "subform"].includes(f.type)).map(f => f.key), ...calculations.map(c => c.targetKey), ...expressions.map(c => c.targetKey)].filter(Boolean).map(key => <option key={key}>{key}</option>)}</select><select value={rule.operator} onChange={e => updateRule(rule.id, { operator: e.target.value as Rule["operator"] })}><option value="eq">等于</option><option value="neq">不等于</option><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option><option value="contains">包含</option><option value="notEmpty">非空</option></select><input value={String(rule.value ?? "")} onChange={e => updateRule(rule.id, { value: e.target.value })} placeholder="比较值"/><span>→ 输出</span><input value={rule.then.key} onChange={e => updateRule(rule.id, { then: { ...rule.then, key: cleanResultName(e.target.value) } })} placeholder="输出参数"/><input value={rule.then.value} onChange={e => updateRule(rule.id, { then: { ...rule.then, value: e.target.value } })} placeholder="输出值"/><button onClick={() => patch({ rules: rules.filter(x => x.id !== rule.id) })}>删除</button></div>)}</div>}</div>
    <div className="mb-section"><div className="mb-section-title"><div><b>模型输出参数</b><span>定义本模型完成运行后形成并可供后续处理使用的输出参数。</span></div></div><div className="mb-form-grid"><label className="wide">输出参数<input value={(design.outputKeys ?? []).join(",")} onChange={e => patch({ outputKeys: e.target.value.split(",").map(x => cleanResultName(x.trim())).filter(Boolean) })} placeholder={modelType === "approval" ? "例如：正式审批路径,审批状态,审批结果" : "例如：业务结果,所属部门,事项名称"}/></label></div></div>
    <StageFooter saving={saving} submitted={execution.status !== "未提交"} onSave={() => void onSave(design)} onNext={() => void onNext(design)} nextLabel="归档模型设计模型"/>
  </div>
}

function TestStage({ project, execution, saving, onProject, onError, onToast, onNext }: { project: Project; execution: StageExecution; saving: boolean; onProject: (project: Project) => void; onError: (message: string) => void; onToast: (message: string) => void; onNext: () => Promise<boolean> }) {
  const [cases, setCases] = useState<TestCase[]>(() => copy(project.testData?.cases ?? []))
  const [running, setRunning] = useState(false)
  useEffect(() => setCases(copy(project.testData?.cases ?? [])), [project.id, project.version])
  const update = (id: string, changes: Partial<TestCase>) => setCases(items => items.map(item => item.id === id ? { ...item, ...changes } : item))
  const editJson = (id: string, key: "input" | "expectedOutput", text: string) => { try { update(id, { [key]: text.trim() ? JSON.parse(text) : {} } as Partial<TestCase>); onError("") } catch { onError("测试用例 JSON 格式不正确；修改完成后再运行测试") } }
  const run = async () => { setRunning(true); try { const result = await apiFetch<{ report: any; project: Project }>(`/api/model-builder/${project.id}/run-tests`, { method: "POST", body: JSON.stringify({ cases }) }); onProject(result.project); onToast(result.report.passed ? "全部测试用例通过" : "测试未全部通过，请查看失败项"); onError("") } catch (e) { onError(messageOf(e)) } finally { setRunning(false) } }
  const report = project.testReport
  return <div className="mb-editor-stage"><StageTitle number="03" title="模型测试模型" subtitle="这里运行的是与正式模型相同的字段校验、计算和条件规则，不是页面演示。只有测试用例全部通过，才能归档模型测试模型；其审批、智选完成后才开放模型配置模型。"/>
    <div className="mb-test-head"><div><b>测试用例</b><span>输入和期望输出使用 JSON，便于精确验证参数和数字化结果。</span></div><button className="mb-secondary" onClick={() => setCases(items => [...items, { id: uid("case"), name: `测试用例${items.length + 1}`, input: {}, expectValid: true, expectedOutput: {} }])}>＋ 添加用例</button></div>
    <div className="mb-test-list">{cases.map((item, index) => <article key={item.id}><header><span>{index + 1}</span><input value={item.name} onChange={e => update(item.id, { name: e.target.value })}/><label><input type="checkbox" checked={item.expectValid !== false} onChange={e => update(item.id, { expectValid: e.target.checked })}/>预期有效</label><button onClick={() => setCases(items => items.filter(x => x.id !== item.id))}>删除</button></header><div><label>模型输入<textarea rows={6} defaultValue={JSON.stringify(item.input ?? {}, null, 2)} onBlur={e => editJson(item.id, "input", e.target.value)}/></label><label>期望输出<textarea rows={6} defaultValue={JSON.stringify(item.expectedOutput ?? {}, null, 2)} onBlur={e => editJson(item.id, "expectedOutput", e.target.value)}/></label></div></article>)}</div>
    {cases.length === 0 && <div className="mb-mini-empty">至少添加一个测试用例。业务模型建议覆盖正常与异常数据；审批模型建议分别覆盖不同审批路线。</div>}
    <div className="mb-test-actions"><div><b>{project.testPassed ? "测试已通过" : "等待运行测试"}</b><span>{project.testPassed ? "可以归档模型测试模型；归档后仍需完成审批和智选，才能开放模型配置模型。" : "运行服务器测试引擎验证当前设计。"}</span></div><button className="mb-primary" disabled={running || saving || cases.length === 0} onClick={() => void run()}>{running ? "正在测试…" : "运行全部测试"}</button></div>
    {report?.results?.length > 0 && <div className="mb-report"><div className="mb-report-summary"><b>测试报告</b><span className={report.passed ? "ok" : "fail"}>{report.passedCount}/{report.total} 通过</span><small>{report.executedAt ? new Date(report.executedAt).toLocaleString() : ""}</small></div>{report.results.map((item: any) => <div key={item.id} className={`mb-report-row ${item.passed ? "passed" : "failed"}`}><span>{item.passed ? "✓" : "×"}</span><div><b>{item.name}</b><small>实际有效：{String(item.actualValid)}；实际输出：{JSON.stringify(item.actualOutput)}</small>{item.errors?.length > 0 && <em>{item.errors.join("；")}</em>}</div></div>)}</div>}
    <StageFooter saving={saving || running} submitted={execution.status !== "未提交"} onSave={() => void run()} onNext={() => void onNext()} nextLabel="归档模型测试模型" disabledNext={!project.testPassed}/>
  </div>
}

function ConfigStage({ project, projects, execution, saving, onSave, onSubmitStage, onRefreshStages, onProject, onError, onToast, onLaunch }: { project: Project; projects: Project[]; execution: StageExecution; saving: boolean; onSave: (data: Record<string, unknown>) => Promise<unknown>; onSubmitStage: (data: Record<string, unknown>) => Promise<boolean>; onRefreshStages: () => Promise<StageExecution[]>; onProject: (project: Project) => void; onError: (message: string) => void; onToast: (message: string) => void; onLaunch: () => void }) {
  const modelType = String(project.suggestion?.modelType ?? "business")
  const normalize = (source: Record<string, any>) => {
    const rawRelations: ModelRelation[] = Array.isArray(source.relations) ? copy(source.relations) : []
    const relations = rawRelations.length ? rawRelations : (source.afterArchiveEnabled && source.nextModelName ? [{ id: uid("rel"), enabled: true, mode: "hard_link" as const, targetModelName: source.nextModelName, condition: { fieldKey: "", operator: "always", value: "" }, description: "兼容历史归档后硬性链接配置" }] : [])
    return { ...copy(source), digitalIdentities: source.digitalIdentities ?? [], startModes: source.startModes ?? project.suggestion.startModes ?? ["manual"], relations }
  }
  const [data, setData] = useState<Record<string, any>>(() => normalize(project.configuration))
  const [publishing, setPublishing] = useState(false)
  const [digitalIdentifiers,setDigitalIdentifiers]=useState<DigitalIdentifierChoice[]>([])
  useEffect(() => setData(normalize(project.configuration)), [project.id, project.version])
  useEffect(()=>{ apiFetch<{identifiers:DigitalIdentifierChoice[]}>("/api/digital-identifiers").then(result=>setDigitalIdentifiers(result.identifiers ?? [])).catch(()=>setDigitalIdentifiers([])) },[project.id])
  const relations: ModelRelation[] = data.relations ?? []
  const toggle = (mode: string) => setData(old => ({ ...old, startModes: old.startModes.includes(mode) ? old.startModes.filter((x: string) => x !== mode) : [...old.startModes, mode] }))
  const setRelations = (next: ModelRelation[]) => {
    const firstHardLink = next.find(item => item.enabled && item.mode === "hard_link")
    setData(old => ({ ...old, relations: next, afterArchiveEnabled: Boolean(firstHardLink), nextModelName: firstHardLink?.targetModelName ?? "" }))
  }
  const addRelation = () => setRelations([...relations, { id: uid("rel"), enabled: true, mode: "hard_link", targetModelName: "", condition: { fieldKey: "", operator: "always", value: "" }, description: "" }])
  const updateRelation = (id: string, changes: Partial<ModelRelation>) => setRelations(relations.map(item => item.id === id ? { ...item, ...changes } : item))
  const updateCondition = (id: string, changes: Record<string, unknown>) => setRelations(relations.map(item => item.id === id ? { ...item, condition: { ...(item.condition ?? {}), ...changes } } : item))
  const publish = async () => {
    const saved = await onSave(data); if (!saved) return
    setPublishing(true)
    try {
      const result = await apiFetch<{ project: Project }>(`/api/model-builder/${project.id}/publish`, { method: "POST", body: "{}" })
      onProject(result.project); onToast("模型已发布；本模型启动方式和跨模型关系将按第 4 阶段配置生效"); onError("")
    } catch (e) { onError(messageOf(e)) } finally { setPublishing(false) }
  }
  const targetOptions = projects.filter(item => item.id !== project.id)
  const manualEnabled = (data.startModes ?? []).includes("manual")
  const visibleRelations = modelType === "smart" ? [] : relations
  const activeRelations = visibleRelations.filter(item => item.enabled)
  const relationReady = modelType === "smart" || activeRelations.every(item => Boolean(item.targetModelName) && (item.mode === "hard_link" || item.mode === "smart"))
  const typeLabel = (type: string) => type === "approval" ? "审批模型" : type === "smart" ? "智选模型" : type === "build" ? "模型建设模型" : type === "digital" ? "数字化建设模型" : type === "service" ? "服务模型" : "业务模型"
  return <div className="mb-editor-stage"><StageTitle number="04" title="模型配置模型" subtitle="本页编辑的是“模型配置模型”的输入内容：数字化库、固定数字化标识、启动方式和跨模型关系。保存后要先归档模型配置模型，并完成审批、智选闭环，最后才允许正式发布目标模型。"/>
    <div className="mb-form-grid"><label>模型数字化编码（当前19位）<input value={data.modelCode ?? ""} maxLength={19} onChange={e => setData({ ...data, modelCode: e.target.value.replace(/\D/g, "").slice(0, 19) })} placeholder="例如：5011001099001001001"/><small>当前新建模型使用19位数字；历史16位编码仅兼容读取。</small></label><label>系统文件名规则<input value="模型数字化编码-发起人人员数字化编码-时间码" readOnly/><small>示例：5011001099001001001-50110020001-20260921140000</small></label><label>中文显示名称规则<input value="模型中文名称-发起人姓名-时间码" readOnly/><small>请休假模型示例：请假模型-张珊-20260908140000</small></label><label>本模型数字化库<input value={data.storageName ?? ""} onChange={e => setData({ ...data, storageName: e.target.value })} placeholder={`例如：${project.name}数字化库`}/></label><label>归档状态<input value="模型完成规定处理 → 数据按数字化标识确认入库" readOnly/></label><label className="mb-inline-check"><span>允许作为数据源</span><span><input type="checkbox" checked={data.allowAsSource !== false} onChange={e => setData({ ...data, allowAsSource: e.target.checked })}/> 允许其他模型引用本数字化库</span><small>不启用时，本库仅存储本模型运行记录。</small></label><label className="wide">数字化标识（来自数字化标识建设模型数字化库）<select multiple size={7} value={data.digitalIdentities ?? []} onChange={e=>setData({...data,digitalIdentities:Array.from(e.currentTarget.selectedOptions).map(option=>option.value)})}>{digitalIdentifiers.map(item=><option key={item.code} value={item.code}>{item.displayName}（{item.code}） · {item.dataType}</option>)}</select><small>按 Ctrl / Shift 可多选。数字化标识由“数字化标识建设模型”形成，本阶段只选择，不手工编造数字化标识；当前正式标识为19位，历史16位仅兼容读取。</small></label></div>
    <div className="mb-section"><div className="mb-section-title"><div><b>本模型如何启动</b><span>这是进入当前独立模型的入口条件。人工、智选、定时、定量和硬性链接是模型级启动方式，不是运行节点。</span></div></div><div className="mb-check-grid">{[["manual","人工点击"],["smart","智选触发"],["schedule","定时启动"],["quantity","定量启动"],["hard_link","硬性链接"]].map(([key,label]) => <label key={key}><input type="checkbox" checked={(data.startModes ?? []).includes(key)} onChange={() => toggle(key)}/><span><b>{label}</b><small>{key === "manual" ? "驾驶舱根据人员数字化属性和功能配置展示入口" : key === "smart" ? "由智选模型依据已确认数据与关联规则触发" : key === "schedule" ? "按周期或时点条件启动" : key === "quantity" ? "按数据数量和阈值条件启动" : "前序模型数字化库确认数据后固定、不可跳过地启动本模型"}</small></span></label>)}</div></div>
    <div className="mb-section mb-model-relation"><div className="mb-section-title"><div><b>模型关系配置</b><span>{modelType === "smart" ? "智选模型是全系统通用模型，不在本模型中逐个登记所有业务模型的目标关系。" : "硬性链接用于固定衔接；业务模型还可配置“智选关联”，该关系在审批完成后由通用智选模型读取并判断。"}</span></div>{modelType !== "smart" && <button className="mb-secondary small" onClick={addRelation}>＋ 添加模型关系</button>}</div>
      {modelType === "smart" ? <div className="mb-smart-generic-note"><b>通用智选模型不维护业务专属目标列表</b><p>请在每个业务模型自己的第 4 阶段配置“智选关联”：指定本业务模型的数字化标识、判断数据/参数、条件和目标业务模型。审批模型归档后，智选模型读取原业务模型文件名、当前数字化标识及标识关联配置数字化库，再按照“先统计、后判断、先特殊、后正常、多标识多数据逐条展开”决定是否启动新的业务模型。</p><p>这样无论系统以后增加多少业务模型，审批模型和智选模型都无需逐个增加业务字段或目标配置。</p></div> : relations.length === 0 ? <div className="mb-mini-empty">当前模型完成入库后没有配置后续模型。业务模型通常配置“硬性链接 → 审批模型”；如果审批后还可能启动其他业务模型，再在当前业务模型增加“智选关联”。</div> : <div className="mb-relation-list">{relations.map((relation, index) => <article key={relation.id} className={`mb-relation-card ${relation.enabled ? "enabled" : "disabled"}`}>
        <header><div><span>{index + 1}</span><b>{project.name}</b><em>→</em><strong>{relation.targetModelName || "未选择后续模型"}</strong></div><label><input type="checkbox" checked={relation.enabled} onChange={e => updateRelation(relation.id, { enabled: e.target.checked })}/>启用</label><button className="mb-text-danger" onClick={() => setRelations(relations.filter(item => item.id !== relation.id))}>删除</button></header>
        <div className="mb-relation-fields"><label>关系类型<select value={relation.mode} onChange={e => { const mode = e.target.value as ModelRelation["mode"]; updateRelation(relation.id, { mode, condition: mode === "hard_link" ? { fieldKey: "", operator: "always", value: "" } : { ...(relation.condition ?? {}), operator: relation.condition?.operator === "always" ? "eq" : (relation.condition?.operator ?? "eq") } }) }}><option value="hard_link">硬性链接</option><option value="smart">智选关联（审批后判断）</option></select><small>{relation.mode === "hard_link" ? "本模型数据确认后固定启动目标模型" : "关系保存在当前业务模型中；本次业务归档时不直接启动，审批完成后由通用智选模型按条件判断"}</small></label><label>目标独立模型<select value={relation.targetModelName ?? ""} onChange={e => updateRelation(relation.id, { targetModelName: e.target.value })}><option value="">请选择模型</option>{(relation.mode === "smart" ? targetOptions.filter(item => String(item.suggestion?.modelType ?? "business") === "business") : targetOptions).map(item => <option key={item.id} value={item.name}>{item.name}（{typeLabel(String(item.suggestion?.modelType ?? "business"))} · {item.status === "published" ? "已发布" : "未发布"}）</option>)}</select><small>{relation.mode === "smart" ? "智选关联的目标仅选择独立业务模型。" : "目标模型必须先完成自己的四阶段建设并发布。"}</small></label>
          {relation.mode === "smart" ? <><label>判断数据/参数<input value={relation.condition?.fieldKey ?? ""} onChange={e => updateCondition(relation.id, { fieldKey: e.target.value })} placeholder="例如：审批结果 / 会议类型"/></label><label>条件<select value={relation.condition?.operator ?? "eq"} onChange={e => updateCondition(relation.id, { operator: e.target.value })}><option value="eq">等于</option><option value="neq">不等于</option><option value="contains">包含</option><option value="notEmpty">非空</option><option value="gt">大于</option><option value="gte">大于等于</option><option value="lt">小于</option><option value="lte">小于等于</option></select></label><label>条件值<input value={String(relation.condition?.value ?? "")} onChange={e => updateCondition(relation.id, { value: e.target.value })} placeholder="例如：0 / 同意 / 董事长专题会"/></label></> : <div className="mb-hardlink-note"><b>固定关系</b><span>不设置业务判断条件；达到本模型规定的入库节点后按配置直接启动目标模型。</span></div>}
          <label className="wide">关系说明<input value={relation.description ?? ""} onChange={e => updateRelation(relation.id, { description: e.target.value })} placeholder="说明为什么由本模型启动该后续模型"/></label></div>
      </article>)}</div>}
    </div>
    <div className="mb-system-boundary"><b>模型边界校核</b><div><span>当前模型：{project.name}（{typeLabel(modelType)}）</span><span>本模型内部：交互 / 参数 / 运算 / 公式 / 输出 / 存储</span><span>模型外部：{modelType === "smart" ? "从原业务模型读取智选关联" : activeRelations.length ? `${activeRelations.length} 条已启用跨模型关系` : "无后续模型关系"}</span></div><p>{modelType === "approval" ? "审批模型面向所有业务模型通用，业务内容由前序运行上下文动态带入；本模型不固化任何具体业务字段。" : modelType === "smart" ? "智选模型面向所有业务模型通用；后续业务目标和条件由各原业务模型自己配置，本模型只负责读取、判断和触发。" : "业务模型负责自己的业务数据；固定审批关系和本业务特有的智选关联均在本模型配置，审批、智选模型保持通用。"}</p></div>
    <div className="mb-publish-check"><div><b>目标模型发布校核</b><span className={project.testPassed ? "ok" : "warn"}>{project.testPassed ? "✓ 测试数据已通过" : "! 测试数据未通过"}</span><span className={/^(?:5011001\d{12}|\d{16})$/.test(String(data.modelCode ?? "")) ? "ok" : "warn"}>{/^5011001\d{12}$/.test(String(data.modelCode ?? "")) ? `✓ 当前19位模型编码：${data.modelCode}` : /^\d{16}$/.test(String(data.modelCode ?? "")) ? `△ 历史16位模型编码：${data.modelCode}（仅兼容）` : "! 模型数字化编码应为当前19位结构；历史16位仅兼容"}</span><span className={data.storageName ? "ok" : "warn"}>{data.storageName ? "✓ 已配置本模型数字化库" : "! 缺少数字化库"}</span><span className={(data.digitalIdentities ?? []).length && (data.digitalIdentities ?? []).every((x: string) => /^(?:5013\d{15}|\d{16})$/.test(x)) ? "ok" : "warn"}>数字化标识：{(data.digitalIdentities ?? []).join("、") || "未配置"}</span><span className={relationReady ? "ok" : "warn"}>{relationReady ? `✓ ${activeRelations.length} 条启用关系已选目标` : "! 存在启用但未选择目标的模型关系"}</span><span className={execution.status === "已完成" ? "ok" : "warn"}>{execution.status === "已完成" ? "✓ 模型配置模型审批、智选闭环已完成" : `! 模型配置模型当前：${execution.status}`}</span></div><div>{project.status === "published" ? <><span className="mb-status published">目标模型已发布</span>{manualEnabled && <button className="mb-primary" onClick={onLaunch}>立即运行</button>}</> : <><button className="mb-secondary" onClick={() => void onRefreshStages()}>刷新建设状态</button><button className="mb-primary publish" disabled={publishing || saving || execution.status !== "已完成" || !project.testPassed || !relationReady} onClick={() => void publish()}>{publishing ? "正在发布…" : "发布目标模型"}</button></>}</div></div>
    <StageFooter saving={saving} submitted={execution.status !== "未提交"} onSave={() => void onSave(data)} onNext={() => void onSubmitStage(data)} nextLabel="归档模型配置模型" disabledNext={!project.testPassed || !relationReady}/>
  </div>
}

function StageTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) { return <div className="mb-stage-title"><span>{number}</span><div><h3>{title}</h3><p>{subtitle}</p></div></div> }
function StageFooter({ saving, submitted, onSave, onNext, nextLabel, disabledNext }: { saving: boolean; submitted?: boolean; onSave: () => void; onNext: () => void; nextLabel: string; disabledNext?: boolean }) { return <div className="mb-stage-footer"><span>{submitted ? "该建设模型已经形成运行实例；运行结果、审批和智选状态请在上方建设模型链查看。" : "先保存当前建设模型输入，再归档形成独立模型运行实例。"}</span><div><button className="mb-secondary" disabled={saving || submitted} onClick={onSave}>{saving ? "保存中…" : submitted ? "已提交" : "保存草稿"}</button><button className="mb-primary" disabled={saving || submitted || disabledNext} onClick={onNext}>{submitted ? "已归档" : nextLabel} →</button></div></div> }
