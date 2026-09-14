import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "./api"

type FieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "dataSelect" | "dataMultiSelect" | "date" | "number" | "boolean" | "user" | "department" | "subform" | "section"
type VisibilityOperator = "eq" | "neq" | "contains" | "notEmpty"
type SubField = { id: string; label: string; key: string; type: Exclude<FieldType, "subform" | "section">; required?: boolean }
type Field = {
  id: string
  label: string
  key: string
  type: FieldType
  required?: boolean
  options?: string[]
  source?: string
  sourceMode?: "manual" | "current_user" | "library_select" | "library_multi_select" | "library_fill" | "calculated"
  digitalId?: string
  placeholder?: string
  description?: string
  defaultValue?: unknown
  width?: 3 | 4 | 6 | 8 | 9 | 12
  readonly?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  visibleWhen?: { fieldKey: string; operator: VisibilityOperator; value?: string }
  linkage?: { sourceLibrary?: string; sourceLibraryId?: string; triggerFieldKey?: string; matchField?: string; matchDigitalId?: string; sourceField?: string; sourceDigitalId?: string; mode?: "fill" | "options" }
  permissions?: { visible?: boolean; editable?: boolean }
  subFields?: SubField[]
}

type LibraryColumn = { digitalId: string; displayName: string; dataType: string; required: boolean; position: number; sourceRole: string }
type LibraryCatalogItem = { id: string; name: string; kind: "standard" | "model"; isStandard: boolean; allowAsSource: boolean; recordCount: number; fields: string[]; columns: LibraryColumn[] }
type DigitalIdentifierItem = { id: string; code: string; displayName: string; dataType: string; description: string }

type FormSettings = {
  columns: 1 | 2 | 3 | 4
  labelPosition: "top" | "left"
  descriptionMode: "inline" | "tooltip"
  inputWidth: "auto" | "standard"
  submitText: string
  showHeader: boolean
}

type Props = {
  projectName: string
  projectDescription?: string
  design: Record<string, any>
  onChange: (design: Record<string, any>) => void
}

const paletteGroups: Array<{ title: string; items: Array<{ type: FieldType; label: string; sample: string; icon: string }> }> = [
  { title: "基础字段", items: [
    { type: "text", label: "单行文本", sample: "名称、标题、编号", icon: "T" },
    { type: "textarea", label: "多行文本", sample: "事由、说明、意见", icon: "≡" },
    { type: "number", label: "数字", sample: "金额、数量、天数", icon: "#" },
    { type: "date", label: "日期", sample: "开始日期、结束日期", icon: "日" },
  ] },
  { title: "数字化数据字段", items: [
    { type: "dataSelect", label: "数字化库选择", sample: "从标准库/模型库选择一条数据", icon: "库" },
    { type: "dataMultiSelect", label: "数字化库多选", sample: "从数字化库选择多条数据", icon: "多" },
  ] },
  { title: "选择字段", items: [
    { type: "select", label: "标准库下拉", sample: "从数字化库对应模型运行记录选择", icon: "⌄" },
    { type: "radio", label: "标准库单选", sample: "从数字化库选择一项", icon: "◉" },
    { type: "checkbox", label: "标准库多选", sample: "从数字化库选择多项", icon: "☑" },
    { type: "boolean", label: "是否", sample: "是 / 否", icon: "✓" },
  ] },
  { title: "组织字段", items: [
    { type: "user", label: "人员", sample: "申请人、审批人", icon: "人" },
    { type: "department", label: "部门", sample: "所属部门、责任部门", icon: "部" },
  ] },
  { title: "布局与明细", items: [
    { type: "section", label: "分组标题", sample: "基本信息、审批信息", icon: "—" },
    { type: "subform", label: "子表单", sample: "费用明细、物资明细", icon: "表" },
  ] },
]

const typeLabels = Object.fromEntries(paletteGroups.flatMap(group => group.items).map(item => [item.type, item.label])) as Record<FieldType, string>
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const normalizeSettings = (value: any): FormSettings => ({
  columns: [1, 2, 3, 4].includes(Number(value?.columns)) ? Number(value.columns) as 1 | 2 | 3 | 4 : 2,
  labelPosition: value?.labelPosition === "left" ? "left" : "top",
  descriptionMode: value?.descriptionMode === "tooltip" ? "tooltip" : "inline",
  inputWidth: value?.inputWidth === "standard" ? "standard" : "auto",
  submitText: String(value?.submitText || "提交并运行模型"),
  showHeader: value?.showHeader !== false,
})
const defaultWidth = (columns: number, type: FieldType): 3 | 4 | 6 | 8 | 9 | 12 => type === "textarea" || type === "subform" || type === "section" ? 12 : columns === 4 ? 3 : columns === 3 ? 4 : columns === 2 ? 6 : 12

export function ModelFormDesigner({ projectName, projectDescription, design, onChange }: Props) {
  const fields: Field[] = Array.isArray(design.fields) ? design.fields : []
  const formSettings = normalizeSettings(design.formSettings)
  const [selectedFieldId, setSelectedFieldId] = useState(fields[0]?.id ?? "")
  const [inspectorTab, setInspectorTab] = useState<"field" | "form">("field")
  const [dragging, setDragging] = useState("")
  const [dragOver, setDragOver] = useState("")
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop")
  const [previewOpen, setPreviewOpen] = useState(false)
  const [libraries, setLibraries] = useState<LibraryCatalogItem[]>([])
  const [identifiers, setIdentifiers] = useState<DigitalIdentifierItem[]>([])
  const selected = fields.find(field => field.id === selectedFieldId)

  useEffect(() => {
    if (!fields.some(field => field.id === selectedFieldId)) setSelectedFieldId(fields[0]?.id ?? "")
  }, [design.fields])
  useEffect(() => {
    apiFetch<{ libraries: LibraryCatalogItem[] }>("/api/digital-libraries").then(result => setLibraries(result.libraries ?? [])).catch(() => setLibraries([]))
    apiFetch<{ identifiers: DigitalIdentifierItem[] }>("/api/digital-identifiers").then(result => setIdentifiers(result.identifiers ?? [])).catch(() => setIdentifiers([]))
  }, [])

  const commit = (changes: Record<string, any>) => onChange({ ...design, ...changes })
  const setFields = (next: Field[]) => commit({ fields: next })
  const setFormSettings = (changes: Partial<FormSettings>) => commit({ formSettings: { ...formSettings, ...changes } })

  const addField = (type: FieldType, beforeId?: string) => {
    const index = fields.length + 1
    const base: Field = {
      id: uid("field"), label: typeLabels[type], key: `${type}${index}`, type, required: false,
      width: defaultWidth(formSettings.columns, type), permissions: { visible: true, editable: true },
      placeholder: type === "select" || type === "radio" || type === "checkbox" ? "请选择" : type === "user" ? "请选择人员" : type === "department" ? "请选择部门" : "请输入",
    }
    if (["select", "radio", "dataSelect"].includes(type)) { base.sourceMode="library_select"; base.options=[]; base.linkage={ mode:"options" }; base.placeholder="请选择标准库数据" }
    if (["checkbox", "dataMultiSelect"].includes(type)) { base.sourceMode="library_multi_select"; base.options=[]; base.linkage={ mode:"options" }; base.placeholder="请选择标准库数据" }
    if (type === "user") { base.sourceMode="library_select"; base.linkage={ sourceLibraryId:"lib-standard-person", sourceLibrary:"人员信息标准库", sourceDigitalId:"5013001001002002", mode:"options" }; base.placeholder="请选择人员" }
    if (type === "department") { base.sourceMode="library_select"; base.linkage={ sourceLibraryId:"lib-standard-dept", sourceLibrary:"部门信息标准库", sourceDigitalId:"5013001001003001", mode:"options" }; base.placeholder="请选择部门" }
    if (type === "section") { base.key = `section${index}`; base.description = "用于将相关字段划分为一个业务区域。" }
    if (type === "subform") {
      base.key = `subform${index}`
      base.subFields = [
        { id: uid("sub"), label: "明细名称", key: "itemName", type: "text", required: true },
        { id: uid("sub"), label: "数量", key: "quantity", type: "number" },
        { id: uid("sub"), label: "说明", key: "remark", type: "text" },
      ]
    }
    const next = [...fields]
    const at = beforeId ? next.findIndex(field => field.id === beforeId) : -1
    if (at >= 0) next.splice(at, 0, base); else next.push(base)
    setFields(next); setSelectedFieldId(base.id); setInspectorTab("field")
  }

  const moveField = (id: string, beforeId?: string) => {
    if (!id || id === beforeId) return
    const moving = fields.find(field => field.id === id); if (!moving) return
    const rest = fields.filter(field => field.id !== id)
    const at = beforeId ? rest.findIndex(field => field.id === beforeId) : -1
    if (at >= 0) rest.splice(at, 0, moving); else rest.push(moving)
    setFields(rest)
  }

  const onDrop = (event: React.DragEvent, beforeId?: string) => {
    event.preventDefault(); event.stopPropagation()
    const movingId = event.dataTransfer.getData("model/field-id")
    const type = event.dataTransfer.getData("model/field-type") as FieldType
    if (movingId) moveField(movingId, beforeId); else if (type) addField(type, beforeId)
    setDragging(""); setDragOver("")
  }

  const updateSelected = (changes: Partial<Field>) => {
    if (!selected) return
    setFields(fields.map(field => field.id === selected.id ? { ...field, ...changes } : field))
  }
  const removeField = (id = selected?.id) => {
    if (!id) return
    const next = fields.filter(field => field.id !== id)
    setFields(next); setSelectedFieldId(next[0]?.id ?? "")
  }
  const duplicateField = () => {
    if (!selected) return
    const at = fields.findIndex(field => field.id === selected.id)
    const nextField: Field = { ...clone(selected), id: uid("field"), label: `${selected.label} 副本`, key: `${selected.key || "field"}_copy${fields.length + 1}` }
    const next = [...fields]; next.splice(at + 1, 0, nextField); setFields(next); setSelectedFieldId(nextField.id)
  }

  const exportSchema = () => {
    const payload = JSON.stringify({ formSettings, fields }, null, 2)
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json;charset=utf-8" }))
    const link = document.createElement("a"); link.href = url; link.download = `${projectName || "model"}-form-schema.json`; link.click(); URL.revokeObjectURL(url)
  }
  const importSchema = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".json,application/json"
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || "{}"))
          if (!Array.isArray(parsed.fields)) throw new Error("缺少 fields 数组")
          commit({ fields: parsed.fields, formSettings: normalizeSettings(parsed.formSettings) })
          setSelectedFieldId(parsed.fields[0]?.id ?? "")
        } catch (error) { window.alert(`导入失败：${error instanceof Error ? error.message : "JSON格式不正确"}`) }
      }
      reader.readAsText(file, "utf-8")
    }
    input.click()
  }

  const canvasStyle = useMemo(() => ({ gridTemplateColumns: "repeat(12,minmax(0,1fr))" }), [])

  return <div className="ncd-shell">
    <aside className="ncd-palette">
      <div className="ncd-side-head"><div><b>控件库</b><span>点击或拖拽到表单画布</span></div><em>{paletteGroups.reduce((sum, group) => sum + group.items.length, 0)}</em></div>
      <div className="ncd-palette-scroll">{paletteGroups.map(group => <section key={group.title}><h5>{group.title}</h5><div className="ncd-palette-list">{group.items.map(item => <button key={item.type} draggable onDragStart={event => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("model/field-type", item.type); setDragging(item.type) }} onDragEnd={() => { setDragging(""); setDragOver("") }} onClick={() => addField(item.type)} className={dragging === item.type ? "dragging" : ""}><span className={`ncd-palette-icon type-${item.type}`}>{item.icon}</span><span><b>{item.label}</b><small>{item.sample}</small></span><em>＋</em></button>)}</div></section>)}</div>
      <div className="ncd-palette-note"><b>设计规则</b><span>桌面端支持 1～4 列和字段独立宽度。</span><span>移动端自动单列，避免字段被压缩。</span><span>字段配置会直接作为模型运行时表单定义。</span></div>
    </aside>

    <section className="ncd-canvas" onDragOver={event => { event.preventDefault(); if (!dragOver) setDragOver("__tail") }} onDrop={event => onDrop(event)}>
      <div className="ncd-toolbar"><div><b>交互表单设计</b><span>{fields.length} 个字段 · {formSettings.columns} 列布局 · 所见即所得</span></div><div className="ncd-toolbar-actions"><button onClick={() => setInspectorTab("form")}>表单属性</button><button onClick={importSchema}>导入 JSON</button><button onClick={exportSchema}>导出 JSON</button><button className="primary" onClick={() => setPreviewOpen(true)}>运行预览</button><div className="ncd-device"><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}>▣ PC</button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}>▯ 手机</button></div></div></div>
      <div className="ncd-workspace">
        <div className={`ncd-form ${device} label-${formSettings.labelPosition} width-${formSettings.inputWidth}`}>
          {formSettings.showHeader && <header className="ncd-form-head"><span>M</span><div><h4>{projectName}</h4><p>{projectDescription || "请填写以下信息并提交模型。"}</p></div></header>}
          {fields.length === 0 ? <div className={`ncd-empty ${dragOver === "__tail" ? "over" : ""}`}>从左侧拖入字段开始设计<br/><small>支持拖拽排序、多列布局、显隐规则、校验与数据联动</small></div> : <div className="ncd-grid" style={canvasStyle}>{fields.map((field, index) => {
            const span = device === "mobile" || formSettings.columns === 1 ? 12 : Math.min(12, Math.max(3, Number(field.width || defaultWidth(formSettings.columns, field.type))))
            return <article key={field.id} style={{ gridColumn: `span ${span}` }} className={`ncd-field ${field.type === "section" ? "section" : ""} ${selectedFieldId === field.id ? "selected" : ""} ${dragOver === field.id ? "drag-over" : ""}`} onClick={() => { setSelectedFieldId(field.id); setInspectorTab("field") }} onDragEnter={event => { event.preventDefault(); event.stopPropagation(); setDragOver(field.id) }} onDragOver={event => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = event.dataTransfer.getData("model/field-id") ? "move" : "copy" }} onDrop={event => onDrop(event, field.id)}>
              <button className="ncd-grip" draggable title="拖动排序" onClick={event => event.stopPropagation()} onDragStart={event => { event.stopPropagation(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("model/field-id", field.id); setDragging(field.id) }} onDragEnd={() => { setDragging(""); setDragOver("") }}>⋮⋮</button>
              <div className="ncd-field-main">{field.type === "section" ? <><div className="ncd-section-title"><b>{field.label || "分组标题"}</b><span>{field.description || "分组说明"}</span></div></> : <><div className="ncd-field-label"><label>{field.label}{field.required && <em>*</em>}</label><span>{typeLabels[field.type]}</span></div>{field.description && formSettings.descriptionMode === "inline" && <p className="ncd-description">{field.description}</p>}<ControlPreview field={field}/><small>{field.digitalId ? `数字化标识：${field.digitalId}` : "未配置数字化标识"}{field.visibleWhen?.fieldKey ? ` · 条件显示` : ""}{field.linkage?.sourceLibrary ? ` · ${field.linkage.sourceLibrary}` : ""}</small></>}</div>
              {selectedFieldId === field.id && <div className="ncd-field-actions"><button onClick={event => { event.stopPropagation(); duplicateField() }}>复制</button><button className="danger" onClick={event => { event.stopPropagation(); removeField(field.id) }}>删除</button></div>}
              <span className="ncd-index">{index + 1}</span>
            </article>
          })}</div>}
          <div className={`ncd-tail ${dragOver === "__tail" ? "over" : ""}`} onDragEnter={event => { event.preventDefault(); event.stopPropagation(); setDragOver("__tail") }} onDragOver={event => { event.preventDefault(); event.stopPropagation() }} onDrop={event => onDrop(event)}>＋ 拖到这里追加字段</div>
          <div className="ncd-submit-preview"><button>{formSettings.submitText}</button></div>
        </div>
      </div>
    </section>

    <aside className="ncd-inspector">
      <div className="ncd-tabs"><button className={inspectorTab === "field" ? "active" : ""} onClick={() => setInspectorTab("field")}>字段属性</button><button className={inspectorTab === "form" ? "active" : ""} onClick={() => setInspectorTab("form")}>表单属性</button></div>
      {inspectorTab === "form" ? <FormInspector value={formSettings} onChange={setFormSettings}/> : selected ? <FieldInspector field={selected} fields={fields} libraries={libraries} identifiers={identifiers} onChange={updateSelected} onDuplicate={duplicateField} onRemove={() => removeField()}/> : <div className="ncd-inspector-empty"><span>↖</span><b>请选择一个字段</b><p>点击中间画布中的字段后，可配置属性、校验、显隐、权限和数据联动。</p><button onClick={() => setInspectorTab("form")}>改为编辑表单属性</button></div>}
    </aside>
    {previewOpen && <FormPreviewDialog name={projectName} description={projectDescription} fields={fields} settings={formSettings} onClose={() => setPreviewOpen(false)}/>} 
  </div>
}

function ControlPreview({ field }: { field: Field }) {
  const placeholder = field.placeholder || (["select", "radio", "checkbox"].includes(field.type) ? "请选择" : "请输入")
  if (field.type === "textarea") return <textarea rows={3} disabled placeholder={placeholder}/>
  if (field.type === "select") return <select disabled defaultValue=""><option value="">{placeholder}</option>{(field.options ?? []).map(option => <option key={option}>{option}</option>)}</select>
  if (field.type === "radio") return <div className="ncd-option-preview">{(field.options ?? []).slice(0, 3).map(option => <span key={option}><i className="radio"/>{option}</span>)}</div>
  if (field.type === "checkbox") return <div className="ncd-option-preview">{(field.options ?? []).slice(0, 3).map(option => <span key={option}><i className="check"/>{option}</span>)}</div>
  if (field.type === "date") return <div className="ncd-input-icon"><input disabled placeholder="年 / 月 / 日"/><span>▣</span></div>
  if (field.type === "number") return <input disabled placeholder={placeholder}/>
  if (field.type === "boolean") return <div className="ncd-switch"><i/><b>否</b><small>切换后为“是”</small></div>
  if (field.type === "user" || field.type === "department") return <div className="ncd-picker"><span>{field.type === "user" ? "人" : "部"}</span><input disabled placeholder={placeholder}/><em>选择</em></div>
  if (field.type === "subform") return <div className="ncd-subform"><div>{(field.subFields ?? []).map(sub => <b key={sub.id}>{sub.label}</b>)}</div><div>{(field.subFields ?? []).map(sub => <span key={sub.id}>—</span>)}</div><button>＋ 添加明细</button></div>
  return <input disabled placeholder={placeholder}/>
}

function FormInspector({ value, onChange }: { value: FormSettings; onChange: (changes: Partial<FormSettings>) => void }) {
  return <div className="ncd-inspector-scroll"><section className="ncd-block"><h5>布局</h5><label>桌面端列数<select value={value.columns} onChange={event => onChange({ columns: Number(event.target.value) as 1 | 2 | 3 | 4 })}><option value={1}>单列</option><option value={2}>双列</option><option value={3}>三列</option><option value={4}>四列</option></select><small>移动端始终自动单列。</small></label><label>字段标题位置<select value={value.labelPosition} onChange={event => onChange({ labelPosition: event.target.value as FormSettings["labelPosition"] })}><option value="top">上下布局</option><option value="left">左右布局</option></select></label><label>输入框宽度<select value={value.inputWidth} onChange={event => onChange({ inputWidth: event.target.value as FormSettings["inputWidth"] })}><option value="auto">自动占满列宽</option><option value="standard">标准宽度</option></select></label><label>描述信息<select value={value.descriptionMode} onChange={event => onChange({ descriptionMode: event.target.value as FormSettings["descriptionMode"] })}><option value="inline">直接显示</option><option value="tooltip">收起为提示</option></select></label></section><section className="ncd-block"><h5>表单行为</h5><label>提交按钮文字<input value={value.submitText} onChange={event => onChange({ submitText: event.target.value })}/></label><label className="ncd-checkline"><input type="checkbox" checked={value.showHeader} onChange={event => onChange({ showHeader: event.target.checked })}/><span>显示模型标题和说明</span></label></section></div>
}

function FieldInspector({ field, fields, libraries, identifiers, onChange, onDuplicate, onRemove }: { field: Field; fields: Field[]; libraries: LibraryCatalogItem[]; identifiers: DigitalIdentifierItem[]; onChange: (changes: Partial<Field>) => void; onDuplicate: () => void; onRemove: () => void }) {
  const dataFields = fields.filter(item => item.id !== field.id && item.type !== "section" && item.type !== "subform")
  const isLibraryChoice = ["select", "radio", "checkbox", "dataSelect", "dataMultiSelect"].includes(field.type)
  const isLibraryMulti = ["checkbox", "dataMultiSelect"].includes(field.type)
  const widthOptions = [[3, "1/4 行"], [4, "1/3 行"], [6, "1/2 行"], [8, "2/3 行"], [9, "3/4 行"], [12, "整行"]] as const
  const sourceLibrary = libraries.find(item => item.id === field.linkage?.sourceLibraryId || item.name === field.linkage?.sourceLibrary)
  const sourceColumns = sourceLibrary?.columns ?? []
  const updateSubField = (id: string, changes: Partial<SubField>) => onChange({ subFields: (field.subFields ?? []).map(item => item.id === id ? { ...item, ...changes } : item) })
  return <div className="ncd-inspector-scroll">
    <section className="ncd-block"><h5>基础设置</h5><label>字段名称<input value={field.label} onChange={event => onChange({ label: event.target.value })}/></label>{field.type !== "section" && <><label>内部字段名<input value={field.key} onChange={event => onChange({ key: event.target.value.replace(/[^A-Za-z0-9_]/g, "") })}/><small>仅用于本模型内部运算；不作为数字化库存储列名。</small></label><label>数字化标识<select value={field.digitalId ?? ""} onChange={event => onChange({ digitalId:event.target.value })}><option value="">请选择16位数字化标识</option>{identifiers.map(item => <option key={item.code} value={item.code}>{item.displayName}（{item.code}）</option>)}</select><small>数字化库的列由16位数字化标识定义；新增标识请先运行“数字化标识建设模型”。</small></label></>}<label>控件类型<select value={field.type} onChange={event => { const nextType=event.target.value as FieldType; const common={ type:nextType, width:defaultWidth(2,nextType) } as Partial<Field>; if (["select","radio","dataSelect"].includes(nextType)) onChange({ ...common, sourceMode:"library_select", options:[], linkage:{ ...(field.linkage ?? {}), mode:"options" } }); else if (["checkbox","dataMultiSelect"].includes(nextType)) onChange({ ...common, sourceMode:"library_multi_select", options:[], linkage:{ ...(field.linkage ?? {}), mode:"options" } }); else if (nextType === "user") onChange({ ...common, sourceMode:"library_select", linkage:{sourceLibraryId:"lib-standard-person",sourceLibrary:"人员信息标准库",sourceDigitalId:"5013001001002002",mode:"options"} }); else if (nextType === "department") onChange({ ...common, sourceMode:"library_select", linkage:{sourceLibraryId:"lib-standard-dept",sourceLibrary:"部门信息标准库",sourceDigitalId:"5013001001003001",mode:"options"} }); else onChange(common) }}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{field.type !== "section" && <label>字段宽度<select value={field.width ?? 12} onChange={event => onChange({ width: Number(event.target.value) as Field["width"] })}>{widthOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}<label>字段说明<textarea rows={2} value={field.description ?? ""} onChange={event => onChange({ description: event.target.value })} placeholder="填写说明、口径或填报提示"/></label>{!["boolean", "section", "subform"].includes(field.type) && <label>提示文字<input value={field.placeholder ?? ""} onChange={event => onChange({ placeholder: event.target.value })}/></label>}</section>
    {field.type !== "section" && <section className="ncd-block"><h5>数据取得方式</h5>{isLibraryChoice ? <label>输入方式<input value={isLibraryMulti ? "从数字化库多选" : "从数字化库选择"} readOnly/><small>选择类字段不允许在模型里手工维护固定选项。每一个选项都来自某个标准数据模型运行后形成的数字化库记录。</small></label> : <label>输入方式<select value={field.sourceMode ?? (field.source === "当前用户" ? "current_user" : "manual")} onChange={event => { const mode=event.target.value as Field["sourceMode"]; onChange({ sourceMode:mode, readonly: mode === "current_user" || mode === "library_fill" || mode === "calculated" ? true : field.readonly, linkage: mode?.startsWith("library_") ? { ...(field.linkage ?? {}), mode: mode === "library_fill" ? "fill" : "options" } : field.linkage }) }}><option value="manual">本次业务人工填写</option><option value="current_user">当前登录人员自动带入</option><option value="library_select">从数字化库选择</option><option value="library_multi_select">从数字化库多选</option><option value="library_fill">按条件从数字化库自动带入</option><option value="calculated">系统运算形成</option></select><small>设计原则：标准库选择 ＞ 数据联动 ＞ 自动带入 ＞ 系统计算 ＞ 人工填写。</small></label>}{field.type !== "subform" && <label>默认值<input value={String(field.defaultValue ?? "")} onChange={event => onChange({ defaultValue: event.target.value })} placeholder="可留空"/></label>}</section>}
    {field.type !== "section" && field.sourceMode?.startsWith("library_") && <section className="ncd-block"><h5>数字化库数据源</h5><label>选择数字化库<select value={sourceLibrary?.id ?? ""} onChange={event => { const lib=libraries.find(item=>item.id===event.target.value); onChange({ linkage:{...(field.linkage ?? {}),sourceLibraryId:event.target.value,sourceLibrary:lib?.name ?? "",sourceDigitalId:"",matchDigitalId:"",mode:field.sourceMode === "library_fill" ? "fill" : "options"} }) }}><option value="">请选择数字化库</option>{libraries.filter(item=>item.allowAsSource).map(item=><option key={item.id} value={item.id}>{item.isStandard ? "[标准] " : ""}{item.name} · {item.recordCount}条</option>)}</select></label><label>取值数字化标识<select value={field.linkage?.sourceDigitalId ?? field.linkage?.sourceField ?? ""} onChange={event=>onChange({linkage:{...(field.linkage ?? {}),sourceDigitalId:event.target.value,sourceField:event.target.value}})}><option value="">请选择库列</option>{sourceColumns.map(col=><option key={col.digitalId} value={col.digitalId}>{col.displayName}（{col.digitalId}）</option>)}</select><small>这里的库列不是程序字段名，而是16位数字化标识。</small></label>{field.sourceMode === "library_fill" && <><label>触发当前字段<select value={field.linkage?.triggerFieldKey ?? ""} onChange={event=>onChange({linkage:{...(field.linkage ?? {}),triggerFieldKey:event.target.value}})}><option value="">读取全部 / 不匹配</option>{dataFields.map(item=><option key={item.id} value={item.key}>{item.label}</option>)}</select></label><label>匹配数字化标识<select value={field.linkage?.matchDigitalId ?? field.linkage?.matchField ?? ""} onChange={event=>onChange({linkage:{...(field.linkage ?? {}),matchDigitalId:event.target.value,matchField:event.target.value}})}><option value="">不过滤</option>{sourceColumns.map(col=><option key={col.digitalId} value={col.digitalId}>{col.displayName}（{col.digitalId}）</option>)}</select></label></>} {sourceLibrary && field.linkage?.sourceDigitalId && <div className="ncd-linkage-ready"><b>已接入数字化库</b><span>{sourceLibrary.name} → {sourceColumns.find(c=>c.digitalId===field.linkage?.sourceDigitalId)?.displayName ?? field.linkage.sourceDigitalId}</span></div>}</section>}
    {field.type !== "section" && <section className="ncd-block"><h5>权限</h5><label className="ncd-checkline"><input type="checkbox" checked={field.permissions?.visible !== false} onChange={event => onChange({ permissions: { ...(field.permissions ?? {}), visible: event.target.checked } })}/><span>运行时可见</span></label><label className="ncd-checkline"><input type="checkbox" checked={field.permissions?.editable !== false} onChange={event => onChange({ permissions: { ...(field.permissions ?? {}), editable: event.target.checked } })}/><span>运行时可编辑</span></label><label className="ncd-checkline"><input type="checkbox" checked={Boolean(field.readonly)} onChange={event => onChange({ readonly: event.target.checked })}/><span>只读字段</span></label></section>}
    <div className="ncd-inspector-actions"><button onClick={onDuplicate}>复制字段</button><button className="danger" onClick={onRemove}>删除字段</button></div>
  </div>
}

function visibleByRule(field: Field, values: Record<string, unknown>) {
  if (field.permissions?.visible === false) return false
  const rule = field.visibleWhen; if (!rule?.fieldKey) return true
  const actual = values[rule.fieldKey]
  if (rule.operator === "notEmpty") return actual !== undefined && actual !== null && String(actual).trim() !== ""
  if (rule.operator === "contains") return String(actual ?? "").includes(String(rule.value ?? ""))
  if (rule.operator === "neq") return String(actual ?? "") !== String(rule.value ?? "")
  return String(actual ?? "") === String(rule.value ?? "")
}

function FormPreviewDialog({ name, description, fields, settings, onClose }: { name: string; description?: string; fields: Field[]; settings: FormSettings; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.filter(field => field.defaultValue !== undefined).map(field => [field.key, field.defaultValue])))
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({})
  const [linkageStatus, setLinkageStatus] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      for (const field of fields) {
        const linkage = field.linkage
        if (!(linkage?.sourceLibraryId || linkage?.sourceLibrary) || !(linkage.sourceDigitalId || linkage.sourceField)) continue
        const triggerValue = linkage.triggerFieldKey ? values[linkage.triggerFieldKey] : undefined
        if (linkage.triggerFieldKey && (triggerValue === undefined || triggerValue === null || String(triggerValue).trim() === "")) continue
        const params = new URLSearchParams({ mode: linkage.mode ?? "fill" })
        if (linkage.sourceLibraryId) params.set("libraryId", linkage.sourceLibraryId); else if (linkage.sourceLibrary) params.set("library", linkage.sourceLibrary)
        if (linkage.sourceDigitalId) params.set("sourceDigitalId", linkage.sourceDigitalId); else if (linkage.sourceField) params.set("sourceField", linkage.sourceField)
        if (linkage.matchDigitalId) params.set("matchDigitalId", linkage.matchDigitalId); else if (linkage.matchField) params.set("matchField", linkage.matchField)
        if (triggerValue !== undefined && triggerValue !== null) params.set("triggerValue", String(triggerValue))
        try {
          const result = await apiFetch<{ value?: unknown; options?: string[]; matched: number }>(`/api/digital-library/lookup?${params.toString()}`)
          if (cancelled) return
          setLinkageStatus(old => ({ ...old, [field.key]: `已匹配 ${result.matched} 条数据` }))
          if ((linkage.mode ?? "fill") === "options") setDynamicOptions(old => ({ ...old, [field.key]: result.options ?? [] }))
          else if (result.value !== undefined && result.value !== null) setValues(old => old[field.key] === result.value ? old : ({ ...old, [field.key]: result.value }))
        } catch (error) {
          if (!cancelled) setLinkageStatus(old => ({ ...old, [field.key]: error instanceof Error ? error.message : "联动失败" }))
        }
      }
    }
    void run()
    return () => { cancelled = true }
  }, [fields, values])
  return <div className="ncd-preview-backdrop" onMouseDown={onClose}><div className="ncd-preview-dialog" onMouseDown={event => event.stopPropagation()}><header><div><b>运行预览</b><span>布局、显隐、权限和实时数据联动都会响应</span></div><button onClick={onClose}>×</button></header><div className="ncd-preview-body"><div className={`ncd-preview-form label-${settings.labelPosition} width-${settings.inputWidth}`}>{settings.showHeader && <div className="ncd-preview-title"><h3>{name}</h3><p>{description}</p></div>}<div className="ncd-preview-grid" style={{ gridTemplateColumns: "repeat(12,minmax(0,1fr))" }}>{fields.filter(field => visibleByRule(field, values)).map(field => { const span = settings.columns === 1 ? 12 : Math.min(12, Math.max(3, Number(field.width || defaultWidth(settings.columns, field.type)))); return <PreviewRuntimeField key={field.id} field={field} value={values[field.key]} optionsOverride={dynamicOptions[field.key]} linkageStatus={linkageStatus[field.key]} onChange={value => setValues(old => ({ ...old, [field.key]: value }))} style={{ gridColumn: field.type === "section" || field.type === "subform" ? "1 / -1" : `span ${span}` }} descriptionMode={settings.descriptionMode}/> })}</div><button className="ncd-preview-submit">{settings.submitText}</button></div><aside><b>当前表单数据</b><pre>{JSON.stringify(values, null, 2)}</pre></aside></div></div></div>
}

function PreviewRuntimeField({ field, value, onChange, style, descriptionMode, optionsOverride, linkageStatus }: { field: Field; value: unknown; onChange: (value: unknown) => void; style?: React.CSSProperties; descriptionMode?: FormSettings["descriptionMode"]; optionsOverride?: string[]; linkageStatus?: string }) {
  if (field.type === "section") return <div className="ncd-preview-section" style={style}><b>{field.label}</b><span>{field.description}</span></div>
  const disabled = field.readonly || field.permissions?.editable === false
  const title = <span>{field.label}{field.required && <em>*</em>}{field.description && descriptionMode === "tooltip" && <i className="ncd-help" title={field.description}>?</i>}</span>
  const description = field.description && descriptionMode !== "tooltip" ? <small className="ncd-preview-description">{field.description}</small> : null
  const linkageNote = field.linkage?.sourceLibrary ? <small className="ncd-linkage-status">联动：{field.linkage.sourceLibrary}{linkageStatus ? ` · ${linkageStatus}` : ""}</small> : null
  if (field.type === "textarea") return <label style={style}>{title}{description}<textarea disabled={disabled} rows={3} value={String(value ?? "")} onChange={event => onChange(event.target.value)} placeholder={field.placeholder}/>{linkageNote}</label>
  if (field.type === "boolean") { const checked=value === true || String(value) === "是" || String(value) === "true"; return <label style={style}>{title}{description}<span className="ncd-preview-boolean"><input type="checkbox" disabled={disabled} checked={checked} onChange={event => onChange(event.target.checked)}/><b>{checked ? "是" : "否"}</b></span>{linkageNote}</label> }
  if (["select", "radio", "dataSelect"].includes(field.type)) { const options = optionsOverride ?? field.options ?? []; return <label style={style}>{title}{description}<select disabled={disabled} value={String(value ?? "")} onChange={event => onChange(event.target.value)}><option value="">请选择</option>{options.map(option => <option key={option}>{option}</option>)}</select>{linkageNote}</label> }
  if (["checkbox", "dataMultiSelect"].includes(field.type)) { const current = Array.isArray(value) ? value.map(String) : []; const options = optionsOverride ?? field.options ?? []; return <label style={style}>{title}{description}<div className="ncd-preview-checks">{options.map(option => <span key={option}><input type="checkbox" disabled={disabled} checked={current.includes(option)} onChange={event => onChange(event.target.checked ? [...current, option] : current.filter(item => item !== option))}/>{option}</span>)}</div>{linkageNote}</label> }
  if (field.type === "subform") return <label className="full" style={style}>{title}{description}<SubformRuntime field={field} value={value} onChange={onChange} disabled={disabled}/>{linkageNote}</label>
  return <label style={style}>{title}{description}<input disabled={disabled} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} value={String(value ?? "")} onChange={event => onChange(event.target.value)} placeholder={field.placeholder}/>{linkageNote}</label>
}

function SubformRuntime({ field, value, onChange, disabled }: { field: Field; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  const rows = Array.isArray(value) ? value as Array<Record<string, unknown>> : []
  const subFields = field.subFields ?? []
  const gridStyle = { gridTemplateColumns: `repeat(${Math.max(1, subFields.length)}, minmax(95px,1fr)) 28px` }
  const changeCell = (rowIndex: number, key: string, nextValue: unknown) => { const next = rows.map((row, index) => index === rowIndex ? { ...row, [key]: nextValue } : row); onChange(next) }
  return <div className="ncd-runtime-subform"><div className="head" style={gridStyle}>{subFields.map(sub => <b key={sub.id}>{sub.label}</b>)}<i/></div>{rows.map((row, rowIndex) => <div className="row" style={gridStyle} key={rowIndex}>{subFields.map(sub => <input key={sub.id} disabled={disabled} type={sub.type === "number" ? "number" : sub.type === "date" ? "date" : "text"} value={String(row[sub.key] ?? "")} onChange={event => changeCell(rowIndex, sub.key, event.target.value)}/>) }<button disabled={disabled} onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}>×</button></div>)}<button disabled={disabled} onClick={() => onChange([...rows, Object.fromEntries(subFields.map(sub => [sub.key, ""]))])}>＋ 添加一行</button></div>
}
