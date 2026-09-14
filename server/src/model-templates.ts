export type TemplateKey =
  | "blank" | "leave" | "approval" | "smart"
  | "stage_suggestion" | "stage_design" | "stage_test" | "stage_config"
  | "digital_business_definition" | "digital_definition" | "digital_model_code" | "digital_person_code" | "digital_attribute" | "digital_identifier" | "digital_library"
  | "meeting_topic" | "meeting_collect" | "meeting_group" | "meeting_review"
  | "meeting_organize" | "meeting_notice" | "meeting_feedback" | "meeting_session" | "meeting_minutes"
  | "std_person" | "std_department" | "std_leave_type" | "std_model_info" | "std_digital_type" | "std_code_type" | "std_business_level"
  | "std_definition_type" | "std_object_type" | "std_attribute_definition" | "std_data_type" | "std_org_nature"
  | "std_admin_approval_level" | "std_business_approval_level" | "std_approval_opinion" | "std_meeting_type" | "std_meeting_room" | "std_review_opinion" | "std_yes_no" | "std_org_rank" | "std_threshold_type" | "std_model_timeout"
  | "config_digital" | "config_digital_display" | "config_admin_approval" | "config_business_approval" | "config_position" | "config_identifier_trigger" | "config_business_ownership" | "config_approval_assignment" | "config_threshold"

export type TemplateCatalogItem = {
  key: TemplateKey
  name: string
  shortName: string
  category: string
  group: "基础业务" | "系统管控" | "智能关联" | "模型建设" | "数字化建设" | "基础标准库" | "审批智选配置" | "会议模型簇"
  description: string
  source: string
  modelType: "business" | "approval" | "smart" | "service" | "build" | "digital"
  startModes: string[]
}

type StandardStep = { id: string; interaction?: string; parameters?: string; operation?: string; explanation?: string; output?: string; storage?: string }
type Field = Record<string, unknown> & { id: string; label: string; key: string; type: string }
type Node = { id: string; type: string; title: string; description: string; position: { x: number; y: number } }
type Edge = { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }
export type TemplatePreset = { suggestion: Record<string, any>; design: Record<string, any>; testData: { cases: any[] }; configuration: Record<string, any> }

export const MODEL_TEMPLATE_CATALOG: TemplateCatalogItem[] = [
  { key: "blank", name: "空白模型", shortName: "空白模型", category: "通用", group: "基础业务", description: "从零配置交互、参数、运算、公式、输出、存储及模型关系。", source: "模型·库推演技术总结20260820", modelType: "business", startModes: ["manual"] },
  { key: "leave", name: "请休假模型", shortName: "请休假", category: "考勤管理", group: "基础业务", description: "采集请休假业务数据，形成业务归档；归档后通过模型关系触发独立审批模型。", source: "系统示例 + 模型·库推演技术总结20260820", modelType: "business", startModes: ["manual"] },
  { key: "approval", name: "审批模型", shortName: "审批", category: "审批管理", group: "系统管控", description: "读取前序模型数据，按阈值、组织关系和审批路径形成审批过程及审批结论。", source: "审批模型0728.docx", modelType: "approval", startModes: ["hard_link"] },
  { key: "smart", name: "智选模型", shortName: "智选", category: "智能关联", group: "智能关联", description: "读取已确认数据与数字化标识，按关联规则选择并触发后续模型。", source: "智选模型0729.docx", modelType: "smart", startModes: ["hard_link"] },
  { key: "stage_suggestion", name: "模型建议模型", shortName: "建议模型", category: "模型建设", group: "模型建设", description: "独立形成目标模型的功能目标、边界、范围与启动约束。", source: "模型·库推演技术总结20260820", modelType: "build", startModes: ["manual"] },
  { key: "stage_design", name: "模型设计模型", shortName: "设计模型", category: "模型建设", group: "模型建设", description: "独立形成目标模型的表单、数据源、数字化标识、运算与运行结构。", source: "模型·库推演技术总结20260820", modelType: "build", startModes: ["manual"] },
  { key: "stage_test", name: "模型测试模型", shortName: "测试模型", category: "模型建设", group: "模型建设", description: "独立验证目标模型输入、数据源、运算、输出与存储映射。", source: "模型·库推演技术总结20260820", modelType: "build", startModes: ["manual"] },
  { key: "stage_config", name: "模型配置模型", shortName: "配置模型", category: "模型建设", group: "模型建设", description: "独立配置目标模型数字化库、启动方式、模型关系并形成发布结果。", source: "模型·库推演技术总结20260820", modelType: "build", startModes: ["manual"] },
  { key: "digital_business_definition", name: "业务定义模型", shortName: "业务定义", category: "数字化管理", group: "数字化建设", description: "建立业务领域、业务层级、业务颗粒和业务边界定义。", source: "模型·库推演技术总结20260820", modelType: "digital", startModes: ["manual"] },
  { key: "digital_definition", name: "数字化定义模型", shortName: "数字化定义", category: "数字化管理", group: "数字化建设", description: "建立数字化编码、数字化属性、数字化标识和数字化库的系统定义。", source: "模型·库推演技术总结20260820", modelType: "digital", startModes: ["manual"] },
  { key: "digital_model_code", name: "模型数字化编码模型", shortName: "模型编码", category: "数字化管理", group: "数字化建设", description: "为模型分配16位模型数字化编码。", source: "编码结构标准", modelType: "digital", startModes: ["manual"] },
  { key: "digital_person_code", name: "人员数字化编码模型", shortName: "人员编码", category: "数字化管理", group: "数字化建设", description: "为人员分配16位人员数字化编码。", source: "编码结构标准", modelType: "digital", startModes: ["manual"] },
  { key: "digital_attribute", name: "数字化属性配置模型", shortName: "属性配置", category: "数字化管理", group: "数字化建设", description: "在模型、人员等数字化编码对象下配置数字化属性。", source: "模型·库推演技术总结20260820", modelType: "digital", startModes: ["manual"] },
  { key: "digital_identifier", name: "数字化标识建设模型", shortName: "标识建设", category: "数字化管理", group: "数字化建设", description: "建立16位数字化标识、中文显示名称、数据类型和业务归属。", source: "模型·库推演技术总结20260820", modelType: "digital", startModes: ["manual"] },
  { key: "digital_library", name: "数字化库配置模型", shortName: "数字化库", category: "数字化管理", group: "数字化建设", description: "将数字化标识组合成数字化库，并配置标准库和数据源能力。", source: "模型·库推演技术总结20260820", modelType: "digital", startModes: ["manual"] },
  { key: "std_person", name: "人员信息模型", shortName: "人员信息", category: "基础标准", group: "基础标准库", description: "维护人员姓名、账号、部门、角色等标准数据；人员选择类字段统一引用本模型数字化库。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_department", name: "部门信息模型", shortName: "部门信息", category: "基础标准", group: "基础标准库", description: "维护部门名称、上级部门和组织性质等标准数据。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_leave_type", name: "请假类型标准模型", shortName: "请假类型", category: "基础标准", group: "基础标准库", description: "维护请假类型标准数据，供请休假等模型下拉选择。", source: "标准库设计", modelType: "business", startModes: ["manual"] },
  { key: "std_model_info", name: "模型信息标准模型", shortName: "模型信息", category: "基础标准", group: "基础标准库", description: "形成可供其他模型选择的模型名称、类别、16位模型编码和状态标准数据。", source: "数字化配置模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_digital_type", name: "数字化类型标准模型", shortName: "数字化类型", category: "数字化标准", group: "基础标准库", description: "维护数字化编码、数字化属性、数字化标识等数字化类型标准。", source: "数字化配置模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_code_type", name: "数字化编码类型标准模型", shortName: "编码类型", category: "数字化标准", group: "基础标准库", description: "维护模型、人员、组织等数字化编码类型标准。", source: "数字化配置模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_business_level", name: "业务层级标准模型", shortName: "业务层级", category: "数字化标准", group: "基础标准库", description: "维护一级、二级、三级、四级业务层级标准。", source: "数字化配置模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_definition_type", name: "数字化定义类型标准模型", shortName: "定义类型", category: "数字化标准", group: "基础标准库", description: "维护编码、属性、标识、数字化库、文件名等定义类型。", source: "数字化定义模型", modelType: "business", startModes: ["manual"] },
  { key: "std_object_type", name: "数字化对象类型标准模型", shortName: "对象类型", category: "数字化标准", group: "基础标准库", description: "维护模型、人员、组织等数字化对象类型。", source: "数字化属性模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_attribute_definition", name: "数字化属性定义模型", shortName: "属性定义", category: "数字化标准", group: "基础标准库", description: "维护可配置到数字化编码对象下的数字化属性名称和属性定义。", source: "数字化配置模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_data_type", name: "数据类型标准模型", shortName: "数据类型", category: "数字化标准", group: "基础标准库", description: "维护数字化标识可采用的数据类型。", source: "数字化标识模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_org_nature", name: "组织性质标准模型", shortName: "组织性质", category: "组织标准", group: "基础标准库", description: "维护党组织、行政机构、委员会等组织性质标准。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_admin_approval_level", name: "行政审批层级标准模型", shortName: "行政层级", category: "审批标准", group: "基础标准库", description: "录入行政审批层级标准，供行政审批层级分选模型选择。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_business_approval_level", name: "业务审批层级标准模型", shortName: "业务层级", category: "审批标准", group: "基础标准库", description: "录入业务审批层级标准，供业务审批层级分选模型选择。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_approval_opinion", name: "审批意见标准模型", shortName: "审批意见", category: "审批标准", group: "基础标准库", description: "维护同意、不同意、退回修改等审批意见标准。", source: "审批模型0728.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_meeting_type", name: "会议类型标准模型", shortName: "会议类型", category: "会议标准", group: "基础标准库", description: "维护会议类型标准，供所有会议模型复用。", source: "会议模型簇初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_meeting_room", name: "会议室标准模型", shortName: "会议室", category: "会议标准", group: "基础标准库", description: "维护会议室标准数据。", source: "会议组织模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_review_opinion", name: "议题审定意见标准模型", shortName: "审定意见", category: "会议标准", group: "基础标准库", description: "维护同意上会、不同意上会等议题审定意见。", source: "会议议题审定模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "std_yes_no", name: "是否标准模型", shortName: "是否", category: "公共标准", group: "基础标准库", description: "维护是/否标准值，供需要下拉选择的模型复用。", source: "标准库设计", modelType: "business", startModes: ["manual"] },
  { key: "std_org_rank", name: "组织职级标准模型", shortName: "组织职级", category: "组织标准", group: "基础标准库", description: "维护组织性质、组织层级、职级含义等组织职级标准，供审批层级与人员匹配使用。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_threshold_type", name: "阈值类型标准模型", shortName: "阈值类型", category: "审批标准", group: "基础标准库", description: "维护金额、人员、天数等阈值类型标准。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "std_model_timeout", name: "模型时限标准模型", shortName: "模型时限", category: "运行标准", group: "基础标准库", description: "维护模型办理时限标准，供审批提醒和模型运行时限配置使用。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "config_digital", name: "数字化配置模型", shortName: "数字化配置", category: "数字化配置", group: "审批智选配置", description: "为已分配数字化编码的对象配置数字化属性与数字化标识。", source: "数字化配置模型初稿", modelType: "digital", startModes: ["manual"] },
  { key: "config_digital_display", name: "数字化展示模型", shortName: "数字化展示", category: "数字化配置", group: "审批智选配置", description: "按当前人员、部门和业务授权范围展示16位数字化及标准中文名称。", source: "数字化配置模型初稿", modelType: "digital", startModes: ["manual"] },
  { key: "config_admin_approval", name: "行政审批层级分选模型", shortName: "行政分选", category: "审批配置", group: "审批智选配置", description: "按业务层级配置行政审批层级。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "config_business_approval", name: "业务审批层级分选模型", shortName: "业务分选", category: "审批配置", group: "审批智选配置", description: "按业务层级配置业务审批层级。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "config_position", name: "岗位分选模型", shortName: "岗位分选", category: "审批配置", group: "审批智选配置", description: "按业务事项配置使用岗、审查岗和管理岗。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "config_identifier_trigger", name: "标识触发配置模型", shortName: "标识触发", category: "智选配置", group: "审批智选配置", description: "配置业务数字化标识与后续目标模型之间的引用关系，供通用智选模型读取。", source: "审批智选模型初稿", modelType: "business", startModes: ["manual"] },
  { key: "config_business_ownership", name: "业务归属配置模型", shortName: "业务归属", category: "数字化配置", group: "审批智选配置", description: "配置组织/部门与业务领域之间的归属关系。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "config_approval_assignment", name: "审批分管配置模型", shortName: "审批分管", category: "审批配置", group: "审批智选配置", description: "配置组织职级对应的行政审批业务范围、业务审批范围及阈值调整规则。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "config_threshold", name: "审批阈值配置模型", shortName: "审批阈值", category: "审批配置", group: "审批智选配置", description: "配置金额、人员、天数等数字化标识的审批阈值规则。", source: "数字化编码与审批标准库20260810.docx", modelType: "business", startModes: ["manual"] },
  { key: "meeting_topic", name: "会议议题提报", shortName: "议题提报", category: "会议管理", group: "会议模型簇", description: "根据会议类型匹配对应议题模板，形成议题提报结果。", source: "1.会议议题提报模型20260727.docx", modelType: "business", startModes: ["manual", "smart"] },
  { key: "meeting_collect", name: "会议收集", shortName: "会议收集", category: "会议管理", group: "会议模型簇", description: "读取审议事项、议题名称与会议类型，形成会议收集数据。", source: "2.会议收集模型20260727.docx", modelType: "business", startModes: ["smart"] },
  { key: "meeting_group", name: "会议议题编组", shortName: "议题编组", category: "会议管理", group: "会议模型簇", description: "按会议类型读取待上会议题并形成议题编组。", source: "3.会议议题编组模型20260729.docx", modelType: "business", startModes: ["manual", "schedule", "quantity"] },
  { key: "meeting_review", name: "会议议题审定", shortName: "议题审定", category: "会议管理", group: "会议模型簇", description: "对编组中的单个议题形成独立审定结果。", source: "4.会议议题审定模型20260729.docx", modelType: "business", startModes: ["smart"] },
  { key: "meeting_organize", name: "会议组织", shortName: "会议组织", category: "会议管理", group: "会议模型簇", description: "汇总审定议题，选择会议时间、会议室、主持人、参会人员及汇报人。", source: "5.会议组织模型20260729.docx", modelType: "business", startModes: ["manual", "schedule", "quantity"] },
  { key: "meeting_notice", name: "会议通知", shortName: "会议通知", category: "会议管理", group: "会议模型簇", description: "根据会议组织数据生成会议通知内容和通知范围。", source: "6.会议通知模型20260729.docx", modelType: "business", startModes: ["smart"] },
  { key: "meeting_feedback", name: "参会反馈", shortName: "参会反馈", category: "会议管理", group: "会议模型簇", description: "读取会议通知并采集是否参会反馈，形成反馈结果。", source: "7.会议反馈模型20260729.docx", modelType: "business", startModes: ["smart"] },
  { key: "meeting_session", name: "会议", shortName: "会议", category: "会议管理", group: "会议模型簇", description: "展示会议整体信息，逐项展示并选择审议事项。", source: "8.会议模型20260730.docx", modelType: "business", startModes: ["smart"] },
  { key: "meeting_minutes", name: "会议纪要", shortName: "会议纪要", category: "会议管理", group: "会议模型簇", description: "读取纪要标准内容、议案结果和会议记录，逐项形成会议纪要。", source: "9.会议纪要模型20260727.docx", modelType: "business", startModes: ["smart"] },
]

const pos = (i: number) => ({ x: 60 + i * 260, y: 120 })
function nodes(defs: Array<[string, string, string, string]>): Node[] { return defs.map(([id, type, title, description], i) => ({ id, type, title, description, position: pos(i) })) }
function edges(list: Node[]): Edge[] { return list.slice(0, -1).map((item, i) => ({ id: `${item.id}-e${i + 1}`, source: item.id, target: list[i + 1].id, sourceHandle: "out", targetHandle: "in" })) }
function standard(id: string, interaction: string, parameters: string, operation: string, explanation: string, output: string, storage = ""): StandardStep { return { id, interaction, parameters, operation, explanation, output, storage } }
function baseSuggestion(name: string, category: string, description: string, modelType: string, startModes: string[], goal: string, scope: string) {
  return { name, category, description, modelType, goal, scope, startModes, ownerDepartment: "设备管理部" }
}
function baseConfig(name: string, code: string, identity: string, startModes: string[], visibility = "internal") {
  return { modelCode: code, fileNameRule: "模型数字化编码-发起人人员数字化编码-时间码", displayFileNameRule: "模型中文名称-发起人姓名-时间码", storageName: `${name}数字化库`, digitalIdentities: identity ? [identity] : [], isStandardLibrary: false, allowAsSource: true, startModes, relations: [], afterArchiveEnabled: false, nextModelName: "", visibility }
}
function businessConfig(name: string, code: string, identity: string, startModes: string[], visibility = "internal") {
  const config = baseConfig(name, code, identity, startModes, visibility)
  return { ...config, relations: [{ id: `rel-${code || "business"}-approval`, enabled: true, mode: "hard_link", targetModelName: "审批模型", condition: { fieldKey: "", operator: "always", value: "" }, description: "业务模型数字化库完成数据确认后固定启动通用审批模型" }], afterArchiveEnabled: true, nextModelName: "审批模型" }
}
function baseDesign(fields: Field[], list: Node[], _sourceSteps: StandardStep[], outputKeys: string[], extra: Record<string, unknown> = {}) {
  return { fields, nodes: list, edges: edges(list), parameters: [], calculations: [], expressions: [], rules: [], formula: "", outputKeys, formSettings: { columns: 2, labelPosition: "top", descriptionMode: "inline", inputWidth: "auto", submitText: "提交并运行模型", showHeader: true }, ...extra }
}
function stableFieldDigitalId(seed: string) {
  let h = 2166136261
  for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0 }
  return `5013999${String(h % 1_000_000_000).padStart(9,"0")}`
}
const f = (id: string, label: string, key: string, type = "text", extra: Record<string, unknown> = {}): Field => ({ id, label, key, type, width: 6, digitalId: stableFieldDigitalId(`${id}:${key}`), ...extra })

export function leaveTemplate(): TemplatePreset {
  const suggestion = baseSuggestion("请休假模型", "考勤管理", "采集请休假申请、读取人员组织信息、计算请假天数并形成独立业务归档记录", "business", ["manual"], "形成完整的请休假业务申请记录并归档到请休假模型数字化库；归档后按模型关系触发独立审批模型。", "全体在职人员，按当前用户和组织关系读取数据。")
  const fields = [
    f("leave-applicant", "申请人", "applicant", "user", { digitalId:"5013001005001101", readonly: true, source: "当前用户", sourceMode:"current_user", required: false }),
    f("leave-department", "所属部门", "department", "department", { digitalId:"5013001005001102", readonly: true, required: false, sourceMode:"library_fill", linkage: { sourceLibraryId:"lib-standard-person", sourceLibrary:"人员信息标准库", triggerFieldKey:"applicant", matchDigitalId:"5013001001002002", sourceDigitalId:"5013001001002004", mode:"fill" } }),
    f("leave-type", "请假类型", "leaveType", "dataSelect", { digitalId:"5013001005001103", required: true, sourceMode:"library_select", linkage:{ sourceLibraryId:"lib-standard-leave-type", sourceLibrary:"请假类型标准库", sourceDigitalId:"5013001001004002", mode:"options" } }),
    f("leave-start", "开始日期", "startDate", "date", { digitalId:"5013001005001104", sourceMode:"manual", required: true }), f("leave-end", "结束日期", "endDate", "date", { digitalId:"5013001005001105", sourceMode:"manual", required: true }),
    f("leave-reason", "请假事由", "reason", "textarea", { digitalId:"5013001005001107", sourceMode:"manual", required: true, width: 12, minLength: 2, placeholder: "请说明请假原因及工作交接安排" }),
  ]
  const list = nodes([["leave-interaction","interaction","请休假申请","采集请假类型、起止日期、事由"],["leave-read","read","读取员工与组织信息","读取员工信息库和组织关系"],["leave-calc","calculation","计算请假天数","结束日期 - 开始日期 + 1"],["leave-output","output","业务归档","形成业务结果并写入请休假模型数字化库"]])
  const design = baseDesign(fields, list, [standard("leave-s1","Input() 采集请休假数据","申请人、部门、请假类型、起止日期、事由","读取人员组织信息并计算日期差","业务数据采集与请假天数计算","请假业务结果","按16位数字化标识 5013001005001002 写入本模型数字化库")], ["applicant","department","leaveType","startDate","endDate","reason","days"], { parameters: [{ id: "p-days", name: "days", label: "请假天数", source: "计算结果" }], calculations: [{ id: "calc-days", targetKey: "days", label: "请假天数", operation: "dateDiffInclusive", sourceKeys: ["startDate","endDate"] }], formula: "days = DATE_DIFF_INCLUSIVE(startDate, endDate)", outputDigitalMap:{days:"5013001005001106"}, formSettings: { columns: 2, labelPosition: "top", descriptionMode: "inline", inputWidth: "auto", submitText: "提交请休假申请", showHeader: true } })
  const testData = { cases: [{ id:"case-1",name:"正常场景：2天年休假",input:{applicant:"张珊",leaveType:"年休假",startDate:"2026-09-08",endDate:"2026-09-09",reason:"年休假"},expectValid:true,expectedOutput:{days:2,leaveType:"年休假"}},{id:"case-2",name:"正常场景：4天年休假",input:{applicant:"张珊",leaveType:"年休假",startDate:"2026-09-08",endDate:"2026-09-11",reason:"年休假"},expectValid:true,expectedOutput:{days:4}},{id:"case-3",name:"拦截场景：日期倒置",input:{applicant:"张珊",leaveType:"年休假",startDate:"2026-09-11",endDate:"2026-09-08",reason:"日期测试"},expectValid:false,expectedOutput:{}}] }
  const configuration = businessConfig("请休假模型", "5011001005001002", "5013001005001002", ["manual"], "all")
  return { suggestion, design, testData, configuration }
}

export function approvalTemplate(): TemplatePreset {
  const suggestion = baseSuggestion("审批模型", "审批管理", "通用承接所有业务模型的归档结果，按审批配置形成审批过程和审批结论", "approval", ["hard_link"], "作为全系统统一审批模型，读取任一业务模型的文件名、数字化标识和运行上下文，按审批配置完成审批并写入审批模型数字化库。", "所有业务模型归档后的审批处理；不在审批模型中固化某个业务模型的专用表单字段。")
  const fields = [
    f("ap-source","前序业务模型","sourceModelName","text",{digitalId:"5013999000001200",readonly:true,required:true}),
    f("ap-file","前序模型文件名","sourceFileName","text",{digitalId:"5013001005001201",readonly:true,required:true,width:12}),
    f("ap-display-file","中文显示名称","sourceDisplayFileName","text",{digitalId:"5013999000001206",readonly:true,width:12}),
    f("ap-id","前序数字化标识","sourceDigitalId","text",{digitalId:"5013001005001202",readonly:true,required:true}),
  ]
  const list = nodes([
    ["ap-read","read","读取业务归档","读取前序业务模型文件名、数字化标识和运行上下文"],
    ["ap-param","parameter","读取审批配置","按业务对象与审批配置读取审批层级、人员和规则"],
    ["ap-calc","calculation","形成审批路径","根据审批模型配置形成本次审批正式路径"],
    ["ap-interaction","interaction","逐步审批交互","审批人按本次审批路径逐环节填写审批意见"],
    ["ap-output","output","审批结果归档","形成审批过程、审批意见和最终结论并写入审批模型数字化库"],
  ])
  const steps = [
    standard("ap-s1","","前序业务模型、文件名、数字化标识、运行上下文","读取前序业务模型归档数据","确认本次审批对象","审批对象引用信息",""),
    standard("ap-s2","","审批配置、角色配置、组织关系","读取审批模型设计阶段保存的审批步骤及负责人规则","形成本次审批配置","审批步骤与负责人",""),
    standard("ap-s3","","审批步骤顺序","按配置形成正式审批路径","形成正式审批路径","审批路径",""),
    standard("ap-s4","审批人填写审批意见并提交","当前步骤、审批人、审批结果、审批时间","按审批配置逐步执行；终止条件由审批模型规则决定","逐步形成审批过程和最终结论","审批步骤、审批人、审批意见、审批时间、审批结果","审批模型自身运行结果按数字化标识写入审批模型数字化库"),
  ]
  const approvalSteps = [
    { id: "approval-admin", title: "行政审批", approvalType: "administrative", assigneeScope: "department_role", role: "department_manager", roleLabel: "部门经理", departmentField: "department" },
    { id: "approval-business", title: "业务审批", approvalType: "business", assigneeScope: "global_role", role: "attendance_supervisor", roleLabel: "考勤主管" },
  ]
  const design = baseDesign(fields, list, steps, ["approvalRoute","approvalStatus","approvalResult","approvalProcess"], { parameters:[{id:"p-route",name:"approvalRoute",label:"正式审批路径",source:"审批步骤配置"}], expressions:[{id:"expr-route",targetKey:"approvalRoute",label:"审批路径",expression:'"行政审批 → 业务审批"'},{id:"expr-status",targetKey:"approvalStatus",label:"审批状态",expression:'"待审批"'}], approvalSettings:{taskTitle:"{sourceModelName}审批",routeOutputKey:"approvalRoute",resultOutputKey:"approvalResult",actions:["同意","不同意","退回修改"],steps:approvalSteps,assigneeFallback:"error",routeStrategy:"standard_first",standardSources:{administrativeLevel:"行政审批层级分选标准库",businessLevel:"业务审批层级分选标准库",positions:"岗位分选标准库",personnel:"人员信息标准库",approvalAssignment:"审批分管配置标准库",thresholds:"审批阈值配置标准库",opinions:"审批意见标准库",timeout:"模型时限标准库"},standardSourceIds:{administrativeLevel:"lib-standard-admin-approval-selector",businessLevel:"lib-standard-business-approval-selector",positions:"lib-standard-position-selector",personnel:"lib-standard-person",approvalAssignment:"lib-standard-approval-assignment",thresholds:"lib-standard-threshold-config",opinions:"lib-standard-approval-opinion",timeout:"lib-standard-model-timeout"}}, formula:"审批模型读取前序业务对象后，按审批配置形成并执行本次审批路径。", outputDigitalMap:{approvalRoute:"5013001005001203",approvalResult:"5013001005001204",approvalProcess:"5013001005001205"}, formSettings:{columns:2,labelPosition:"top",descriptionMode:"inline",inputWidth:"auto",submitText:"审批模型由系统触发",showHeader:true} })
  const testData = { cases:[
    {id:"ap-case-1",name:"通用业务模型两步审批",input:{sourceModelName:"业务模型A",sourceFileName:"5011001007001001-5011002000000001-20260908170000",sourceDisplayFileName:"业务模型A-张珊-20260908170000",sourceDigitalId:"5013001007001001"},expectValid:true,expectedOutput:{approvalRoute:"行政审批 → 业务审批",approvalStatus:"待审批"}},
    {id:"ap-case-2",name:"另一业务模型复用审批",input:{sourceModelName:"业务模型B",sourceFileName:"5011001007001002-5011002000000001-20260908170100",sourceDisplayFileName:"业务模型B-张珊-20260908170100",sourceDigitalId:"5013001007001002"},expectValid:true,expectedOutput:{approvalRoute:"行政审批 → 业务审批",approvalStatus:"待审批"}},
  ] }
  const configuration = { ...baseConfig("审批模型","5011001005001001","5013001005001001",["hard_link"]), relations:[{id:"rel-approval-smart",enabled:true,mode:"hard_link",targetModelName:"智选模型",condition:{fieldKey:"",operator:"always",value:""},description:"审批模型数字化库完成数据确认后固定启动通用智选模型"}], afterArchiveEnabled:true, nextModelName:"智选模型" }
  return { suggestion, design, testData, configuration }
}

export function smartTemplate(): TemplatePreset {
  const suggestion = baseSuggestion("智选模型","智能关联","读取业务模型系统文件名、中文显示名称、数字化标识和审批结果，依据标识关联配置判断是否存在后续关联模型","smart",["hard_link"],"基于已确认业务数据、审批数据和数字化标识关联关系，识别当前业务模型是否存在后续关联模型；存在时直接触发，不存在时形成明确的无关联结果。","由审批模型归档后硬性链接进入的已确认数据，同时保留最初业务模型的文件名和数字化标识。")
  const fields = [f("sm-model","业务模型","businessSourceModelName","text",{digitalId:"5013999000001300",readonly:true,required:true}),f("sm-file","文件名","businessFileName","text",{digitalId:"5013001005001301",readonly:true,required:true,width:12}),f("sm-display-file","中文显示名称","businessDisplayFileName","text",{digitalId:"5013999000001306",readonly:true,required:true,width:12}),f("sm-id","数字化标识","businessDigitalId","text",{digitalId:"5013001005001302",readonly:true,required:true}),f("sm-related-id","关联数字化标识","associatedDigitalIds","text",{digitalId:"5013001005001303",readonly:true}),f("sm-result","审批结果","approvalResult","text",{digitalId:"5013999000001307",readonly:true})]
  const list = nodes([["sm-read","read","读取文件名与数字化标识","读取原业务模型系统文件名、中文显示名称、数字化标识、审批结果和标识关联配置"],["sm-calc","calculation","查找关联数字化标识","根据业务数字化标识在标识关联配置中筛选存在模型关联的数字化标识"],["sm-output","output","智选结果归档","存在关联模型时触发目标模型；不存在时记录“本模型没有后续关联的模型”"]])
  const steps = [standard("sm-s1","","业务模型文件名、中文显示名称、业务数字化标识、审批结果","读取业务模型文件名、数字化标识和审批模型确认结果","确认本次智选对象","业务模型、文件名、中文显示名称、数字化标识",""),standard("sm-s2","","标识关联配置库、关联数字化标识集合","按数字化标识查找配置；筛选有模型关联的数字化标识并形成目标集合","判断是否存在后续关联模型","关联数字化标识、智选判断、目标模型集合","智选模型结果按 5013001005001003 入库")]
  const design = baseDesign(fields,list,steps,["smartDecision","businessSourceModelName","businessFileName","businessDisplayFileName","businessDigitalId","associatedDigitalIds","associatedModels"],{smartStandardSources:{digitalConfig:"数字化配置标准库",identifierTrigger:"标识触发配置标准库",identifiers:"数字化标识标准库",models:"模型信息标准库"},smartStandardSourceIds:{digitalConfig:"lib-standard-digital-config",identifierTrigger:"lib-standard-identifier-trigger",identifiers:"lib-standard-identifier",models:"lib-standard-model"},expressions:[{id:"sm-expr",targetKey:"smartDecision",label:"审批结果预判",expression:'IF(approvalResult == "同意", "进入标识关联判断", IF(approvalResult == "建议会议研究", "进入特殊关联判断", "终止"))'}],formula:"读取原业务模型文件名与数字化标识；查询标识关联配置；有匹配关联则形成关联数字化标识并触发目标模型，无匹配关联则记录本模型没有后续关联的模型。",outputDigitalMap:{smartDecision:"5013001005001304",associatedModels:"5013001005001305"}})
  const testData={cases:[{id:"sm-c1",name:"业务模型无后续关联",input:{businessSourceModelName:"业务模型A",businessFileName:"5011001007001001-5011002000000001-20260908170000",businessDisplayFileName:"业务模型A-张珊-20260908170000",businessDigitalId:"5013001007001001",approvalResult:"同意"},expectValid:true,expectedOutput:{smartDecision:"本模型（业务模型A）没有后续关联的模型",businessFileName:"5011001007001001-5011002000000001-20260908170000",businessDisplayFileName:"业务模型A-张珊-20260908170000",businessDigitalId:"5013001007001001",associatedDigitalIds:[]}},{id:"sm-c2",name:"另一业务模型复用智选",input:{businessSourceModelName:"业务模型B",businessFileName:"5011001007001002-5011002000000001-20260908170100",businessDisplayFileName:"业务模型B-张珊-20260908170100",businessDigitalId:"5013001007001002",approvalResult:"同意"},expectValid:true,expectedOutput:{smartDecision:"本模型（业务模型B）没有后续关联的模型",associatedDigitalIds:[]}}]}
  const configuration={...baseConfig("智选模型","5011001005001003","5013001005001003",["hard_link"]),relations:[]}
  return {suggestion,design,testData,configuration}
}



type StandardLibrarySpec = {
  code: string
  identity: string
  libraryId: string
  libraryName: string
  fields: Field[]
  outputKeys: string[]
}

function libraryField(id:string,label:string,key:string,digitalId:string,libraryId:string,libraryName:string,sourceDigitalId:string,extra:Record<string,unknown>={}) {
  return f(id,label,key,"dataSelect",{digitalId,required:true,sourceMode:"library_select",linkage:{sourceLibraryId:libraryId,sourceLibrary:libraryName,sourceDigitalId,mode:"options"},...extra})
}
function libraryMultiField(id:string,label:string,key:string,digitalId:string,libraryId:string,libraryName:string,sourceDigitalId:string,extra:Record<string,unknown>={}) {
  return f(id,label,key,"dataMultiSelect",{digitalId,required:true,sourceMode:"library_multi_select",linkage:{sourceLibraryId:libraryId,sourceLibrary:libraryName,sourceDigitalId,mode:"options"},...extra})
}
function standardLibraryConfig(name:string, code:string, identity:string, startModes=["manual"]) {
  const config=businessConfig(name,code,identity,startModes,"internal")
  return {...config,storageName:`${name.replace(/标准模型$/,"标准库").replace(/模型$/,"数字化库")}`,isStandardLibrary:true,allowAsSource:true}
}

function standardLibraryTemplate(key:TemplateKey):TemplatePreset|null {
  const meta=MODEL_TEMPLATE_CATALOG.find(item=>item.key===key)
  if(!meta || meta.group!=="基础标准库") return null
  const specs:Record<string,StandardLibrarySpec>={
    std_person:{code:"5011001001100001",identity:"5013001001100001",libraryId:"lib-standard-person",libraryName:"人员信息标准库",fields:[
      f("std-person-code","人员数字化编码","employeeCode","text",{digitalId:"5013001001002001",required:true,pattern:"^[0-9]{16}$",placeholder:"16位人员数字化编码"}),
      f("std-person-name","人员姓名","personName","text",{digitalId:"5013001001002002",required:true}),
      f("std-person-account","人员账号","username","text",{digitalId:"5013001001002003"}),
      libraryField("std-person-dept","所属部门","department","5013001001002004","lib-standard-dept","部门信息标准库","5013001001003001"),
      f("std-person-role","身份/角色","roleName","text",{digitalId:"5013001001002005"}),
      f("std-person-enabled","是否启用","enabled","boolean",{digitalId:"5013001001002006",required:true,defaultValue:true}),
      libraryField("std-person-rank","组织职级","organizationRank","5013001001002007","lib-standard-org-rank","组织职级标准库","5013001001110154",{required:false}),
      libraryMultiField("std-person-business","业务领域","businessDomains","5013001001002008","lib-standard-business-definition","业务定义标准库","5013001001006002",{required:false}),
      f("std-person-title","身份说明","identityTitle","text",{digitalId:"5013001001002009"}),
      libraryMultiField("std-person-models","可使用模型","usableModels","5013001001002010","lib-standard-model","模型信息标准库","5013001001005001",{required:false}),
    ],outputKeys:["employeeCode","personName","username","department","roleName","enabled","organizationRank","businessDomains","identityTitle","usableModels"]},
    std_department:{code:"5011001001100002",identity:"5013001001100002",libraryId:"lib-standard-dept",libraryName:"部门信息标准库",fields:[
      f("std-dept-name","部门名称","departmentName","text",{digitalId:"5013001001003001",required:true}),
      libraryField("std-dept-parent","上级部门","parentDepartment","5013001001003002","lib-standard-dept","部门信息标准库","5013001001003001",{required:false}),
      f("std-dept-enabled","是否启用","enabled","boolean",{digitalId:"5013001001003003",required:true,defaultValue:true}),
      libraryField("std-dept-nature","组织性质","organizationNature","5013001001110703","lib-standard-org-nature","组织性质标准库","5013001001110702",{required:false}),
    ],outputKeys:["departmentName","parentDepartment","enabled","organizationNature"]},
    std_leave_type:{code:"5011001001100003",identity:"5013001001100003",libraryId:"lib-standard-leave-type",libraryName:"请假类型标准库",fields:[
      f("std-leave-code","请假类型编码","leaveTypeCode","text",{digitalId:"5013001001004001",required:true}),
      f("std-leave-name","请假类型名称","leaveTypeName","text",{digitalId:"5013001001004002",required:true}),
      f("std-leave-enabled","是否启用","enabled","boolean",{digitalId:"5013001001004003",required:true,defaultValue:true}),
    ],outputKeys:["leaveTypeCode","leaveTypeName","enabled"]},
    std_model_info:{code:"5011001001100019",identity:"5013001001100019",libraryId:"lib-standard-model",libraryName:"模型信息标准库",fields:[
      f("std-model-name","模型名称","modelName","text",{digitalId:"5013001001005001",required:true}),
      f("std-model-category","模型类别","modelCategory","text",{digitalId:"5013001001005002",required:true}),
      f("std-model-code","模型数字化编码","modelDigitalCode","text",{digitalId:"5013001001005003",required:true,pattern:"^[0-9]{16}$"}),
      f("std-model-status","模型状态","modelStatus","text",{digitalId:"5013001001005004",required:true,defaultValue:"已发布"}),
    ],outputKeys:["modelName","modelCategory","modelDigitalCode","modelStatus"]},
    std_digital_type:{code:"5011001001100004",identity:"5013001001100004",libraryId:"lib-standard-digital-type",libraryName:"数字化类型标准库",fields:[f("std-dt-code","类型码","typeCode","text",{digitalId:"5013001001110001",required:true,pattern:"^[0-9]$"}),f("std-dt-name","数字化类型","typeName","text",{digitalId:"5013001001110002",required:true})],outputKeys:["typeCode","typeName"]},
    std_code_type:{code:"5011001001100005",identity:"5013001001100005",libraryId:"lib-standard-code-type",libraryName:"数字化编码类型标准库",fields:[f("std-ct-code","编码类型码","codeTypeCode","text",{digitalId:"5013001001110011",required:true,pattern:"^[0-9]{3}$"}),f("std-ct-name","数字化编码类型","codeTypeName","text",{digitalId:"5013001001110012",required:true})],outputKeys:["codeTypeCode","codeTypeName"]},
    std_business_level:{code:"5011001001100006",identity:"5013001001100006",libraryId:"lib-standard-business-level",libraryName:"业务层级标准库",fields:[f("std-bl-code","业务层级码","businessLevelCode","text",{digitalId:"5013001001110021",required:true}),f("std-bl-name","业务层级","businessLevelName","text",{digitalId:"5013001001110022",required:true})],outputKeys:["businessLevelCode","businessLevelName"]},
    std_definition_type:{code:"5011001001100007",identity:"5013001001100007",libraryId:"lib-standard-definition-type",libraryName:"数字化定义类型标准库",fields:[f("std-def-code","定义类型码","definitionTypeCode","text",{digitalId:"5013001001110031",required:true}),f("std-def-name","定义类型","definitionTypeName","text",{digitalId:"5013001001110032",required:true})],outputKeys:["definitionTypeCode","definitionTypeName"]},
    std_object_type:{code:"5011001001100008",identity:"5013001001100008",libraryId:"lib-standard-object-type",libraryName:"数字化对象类型标准库",fields:[f("std-obj-code","对象类型码","objectTypeCode","text",{digitalId:"5013001001110041",required:true}),f("std-obj-name","对象类型","objectTypeName","text",{digitalId:"5013001001110042",required:true})],outputKeys:["objectTypeCode","objectTypeName"]},
    std_attribute_definition:{code:"5011001001100009",identity:"5013001001100009",libraryId:"lib-standard-attribute-definition",libraryName:"数字化属性定义标准库",fields:[f("std-attr-code","属性定义码","attributeCode","text",{digitalId:"5013001001110051",required:true}),f("std-attr-name","数字化属性名称","attributeName","text",{digitalId:"5013001001110052",required:true}),f("std-attr-desc","属性说明","attributeDescription","textarea",{digitalId:"5013001001110053",width:12})],outputKeys:["attributeCode","attributeName","attributeDescription"]},
    std_data_type:{code:"5011001001100010",identity:"5013001001100010",libraryId:"lib-standard-data-type",libraryName:"数据类型标准库",fields:[f("std-type-code","数据类型码","dataTypeCode","text",{digitalId:"5013001001110061",required:true}),f("std-type-name","数据类型","dataTypeName","text",{digitalId:"5013001001110062",required:true})],outputKeys:["dataTypeCode","dataTypeName"]},
    std_org_nature:{code:"5011001001100011",identity:"5013001001100011",libraryId:"lib-standard-org-nature",libraryName:"组织性质标准库",fields:[f("std-on-code","组织性质码","organizationNatureCode","text",{digitalId:"5013001001110071",required:true,pattern:"^[0-9]{2}$"}),f("std-on-name","组织性质","organizationNatureName","text",{digitalId:"5013001001110072",required:true})],outputKeys:["organizationNatureCode","organizationNatureName"]},
    std_admin_approval_level:{code:"5011001001100012",identity:"5013001001100012",libraryId:"lib-standard-admin-approval-level",libraryName:"行政审批层级标准库",fields:[f("std-aal-code","行政审批层级码","approvalLevelCode","number",{digitalId:"5013001001110081",required:true,min:0,max:999}),f("std-aal-name","行政审批层级","approvalLevelName","text",{digitalId:"5013001001110082",required:true})],outputKeys:["approvalLevelCode","approvalLevelName"]},
    std_business_approval_level:{code:"5011001001100013",identity:"5013001001100013",libraryId:"lib-standard-business-approval-level",libraryName:"业务审批层级标准库",fields:[f("std-bal-code","业务审批层级码","approvalLevelCode","number",{digitalId:"5013001001110091",required:true,min:0,max:999}),f("std-bal-name","业务审批层级","approvalLevelName","text",{digitalId:"5013001001110092",required:true})],outputKeys:["approvalLevelCode","approvalLevelName"]},
    std_approval_opinion:{code:"5011001001100014",identity:"5013001001100014",libraryId:"lib-standard-approval-opinion",libraryName:"审批意见标准库",fields:[f("std-op-code","审批意见码","opinionCode","text",{digitalId:"5013001001110101",required:true}),f("std-op-name","审批意见","opinionName","text",{digitalId:"5013001001110102",required:true}),f("std-op-terminal","是否终止","terminal","boolean",{digitalId:"5013001001110103",required:true})],outputKeys:["opinionCode","opinionName","terminal"]},
    std_meeting_type:{code:"5011001001100015",identity:"5013001001100015",libraryId:"lib-standard-meeting-type",libraryName:"会议类型标准库",fields:[f("std-mt-code","会议类型码","meetingTypeCode","text",{digitalId:"5013001001110111",required:true}),f("std-mt-name","会议类型","meetingTypeName","text",{digitalId:"5013001001110112",required:true})],outputKeys:["meetingTypeCode","meetingTypeName"]},
    std_meeting_room:{code:"5011001001100016",identity:"5013001001100016",libraryId:"lib-standard-meeting-room",libraryName:"会议室标准库",fields:[f("std-mr-code","会议室编码","meetingRoomCode","text",{digitalId:"5013001001110121",required:true}),f("std-mr-name","会议室名称","meetingRoomName","text",{digitalId:"5013001001110122",required:true}),f("std-mr-cap","容纳人数","capacity","number",{digitalId:"5013001001110123"})],outputKeys:["meetingRoomCode","meetingRoomName","capacity"]},
    std_review_opinion:{code:"5011001001100017",identity:"5013001001100017",libraryId:"lib-standard-review-opinion",libraryName:"议题审定意见标准库",fields:[f("std-ro-code","审定意见码","reviewOpinionCode","text",{digitalId:"5013001001110131",required:true}),f("std-ro-name","审定意见","reviewOpinionName","text",{digitalId:"5013001001110132",required:true})],outputKeys:["reviewOpinionCode","reviewOpinionName"]},
    std_yes_no:{code:"5011001001100018",identity:"5013001001100018",libraryId:"lib-standard-yes-no",libraryName:"是否标准库",fields:[f("std-yn-code","标准值码","valueCode","text",{digitalId:"5013001001110141",required:true}),f("std-yn-name","标准值","valueName","text",{digitalId:"5013001001110142",required:true})],outputKeys:["valueCode","valueName"]},
    std_org_rank:{code:"5011001001100020",identity:"5013001001100020",libraryId:"lib-standard-org-rank",libraryName:"组织职级标准库",fields:[
      libraryField("std-or-nature","组织性质","organizationNature","5013001001110151","lib-standard-org-nature","组织性质标准库","5013001001110072"),
      f("std-or-level","组织层级码","organizationLevelCode","text",{digitalId:"5013001001110152",required:true}),
      f("std-or-rank","职级码","rankCode","text",{digitalId:"5013001001110153",required:true}),
      f("std-or-name","职级含义","rankName","text",{digitalId:"5013001001110154",required:true}),
    ],outputKeys:["organizationNature","organizationLevelCode","rankCode","rankName"]},
    std_threshold_type:{code:"5011001001100021",identity:"5013001001100021",libraryId:"lib-standard-threshold-type",libraryName:"阈值类型标准库",fields:[f("std-th-code","阈值类型码","thresholdTypeCode","text",{digitalId:"5013001001110161",required:true}),f("std-th-name","阈值类型","thresholdTypeName","text",{digitalId:"5013001001110162",required:true})],outputKeys:["thresholdTypeCode","thresholdTypeName"]},
    std_model_timeout:{code:"5011001001100022",identity:"5013001001100022",libraryId:"lib-standard-model-timeout",libraryName:"模型时限标准库",fields:[f("std-time-hours","模型时限（小时）","timeoutHours","number",{digitalId:"5013001001110171",required:true,min:1}),libraryMultiField("std-time-biz","适用业务范围","businessDomains","5013001001110172","lib-standard-business-definition","业务定义标准库","5013001001006002")],outputKeys:["timeoutHours","businessDomains"]},
  }
  const spec=specs[key]
  if(!spec) return null
  const list=nodes([[`${key}-input`,"interaction","录入标准数据","录入一条标准数据；需要选择的字段继续从其他标准数字化库读取"],[`${key}-output`,"output","标准数据归档","形成一条模型运行记录并写入本模型标准数字化库"]])
  const suggestion=baseSuggestion(meta.name,meta.category,meta.description,"business",["manual"],meta.description,"基础标准数据维护人员；标准值必须通过对应标准模型运行形成，不在业务模型中维护固定选项。")
  const configuration={...standardLibraryConfig(meta.name,spec.code,spec.identity),storageName:spec.libraryName}
  return {suggestion,design:baseDesign(spec.fields,list,[],spec.outputKeys,{formSettings:{columns:2,labelPosition:"top",descriptionMode:"inline",inputWidth:"auto",submitText:"提交标准数据",showHeader:true}}),testData:{cases:[]},configuration}
}

function controlConfigTemplate(key:TemplateKey):TemplatePreset|null {
  const meta=MODEL_TEMPLATE_CATALOG.find(item=>item.key===key)
  if(!meta || meta.group!=="审批智选配置") return null
  const specs:Record<string,{code:string;identity:string;libraryName:string;fields:Field[];outputs:string[];modelType?:string}>={
    config_digital:{code:"5011001001200001",identity:"5013001001200001",libraryName:"数字化配置标准库",fields:[
      libraryField("cfg-d-model","数字化编码对象","targetModelName","5013001001210001","lib-standard-model","模型信息标准库","5013001001005001"),
      f("cfg-d-code","模型数字化编码","targetModelCode","text",{digitalId:"5013001001210002",readonly:true,sourceMode:"library_fill",linkage:{sourceLibraryId:"lib-standard-model",sourceLibrary:"模型信息标准库",triggerFieldKey:"targetModelName",matchDigitalId:"5013001001005001",sourceDigitalId:"5013001001005003",mode:"fill"}}),
      libraryMultiField("cfg-d-attr","数字化属性集合","digitalAttributes","5013001001210003","lib-standard-attribute-definition","数字化属性定义标准库","5013001001110052"),
      libraryMultiField("cfg-d-id","数字化标识集合","digitalIdentifiers","5013001001210004","lib-standard-identifier","数字化标识标准库","5013001001008002"),
    ],outputs:["targetModelName","targetModelCode","digitalAttributes","digitalIdentifiers"]},
    config_digital_display:{code:"5011001001200002",identity:"5013001001200002",libraryName:"数字化展示结果库",fields:[
      f("cfg-show-user","当前操作者","operatorName","user",{digitalId:"5013001001210011",sourceMode:"current_user",readonly:true}),
      f("cfg-show-dept","操作者部门","operatorDepartment","department",{digitalId:"5013001001210012",sourceMode:"library_fill",readonly:true,linkage:{sourceLibraryId:"lib-standard-person",sourceLibrary:"人员信息标准库",triggerFieldKey:"operatorName",matchDigitalId:"5013001001002002",sourceDigitalId:"5013001001002004",mode:"fill"}}),
      libraryMultiField("cfg-show-code","数字化编码展示集","digitalCodes","5013001001210013","lib-standard-model","模型信息标准库","5013001001005001"),
      libraryMultiField("cfg-show-attr","数字化属性展示集","digitalAttributes","5013001001210014","lib-standard-attribute-definition","数字化属性定义标准库","5013001001110052"),
      libraryMultiField("cfg-show-id","数字化标识展示集","digitalIdentifiers","5013001001210015","lib-standard-identifier","数字化标识标准库","5013001001008002"),
    ],outputs:["operatorName","operatorDepartment","digitalCodes","digitalAttributes","digitalIdentifiers"]},
    config_admin_approval:{code:"5011001001200003",identity:"5013001001200003",libraryName:"行政审批层级分选标准库",fields:[
      libraryField("cfg-aa-biz","业务事项","businessName","5013001001210101","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      libraryField("cfg-aa-level","行政审批层级","administrativeApprovalLevel","5013001001210102","lib-standard-admin-approval-level","行政审批层级标准库","5013001001110082"),
    ],outputs:["businessName","administrativeApprovalLevel"]},
    config_business_approval:{code:"5011001001200004",identity:"5013001001200004",libraryName:"业务审批层级分选标准库",fields:[
      libraryField("cfg-ba-biz","业务事项","businessName","5013001001210201","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      libraryField("cfg-ba-level","业务审批层级","businessApprovalLevel","5013001001210202","lib-standard-business-approval-level","业务审批层级标准库","5013001001110092"),
    ],outputs:["businessName","businessApprovalLevel"]},
    config_position:{code:"5011001001200005",identity:"5013001001200005",libraryName:"岗位分选标准库",fields:[
      libraryField("cfg-pos-biz","业务事项","businessName","5013001001210301","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      libraryField("cfg-pos-use","使用岗","usePerson","5013001001210302","lib-standard-person","人员信息标准库","5013001001002002"),
      libraryField("cfg-pos-review","审查岗","reviewPerson","5013001001210303","lib-standard-person","人员信息标准库","5013001001002002"),
      libraryField("cfg-pos-manage","管理岗","managePerson","5013001001210304","lib-standard-person","人员信息标准库","5013001001002002"),
    ],outputs:["businessName","usePerson","reviewPerson","managePerson"]},
    config_identifier_trigger:{code:"5011001001200006",identity:"5013001001200006",libraryName:"标识触发配置标准库",fields:[
      libraryField("cfg-tr-id","业务数字化标识","sourceDigitalIdentifier","5013001001210401","lib-standard-identifier","数字化标识标准库","5013001001008001"),
      libraryField("cfg-tr-model","关联目标模型","targetModelName","5013001001210402","lib-standard-model","模型信息标准库","5013001001005001"),
      f("cfg-tr-enabled","是否启用","enabled","boolean",{digitalId:"5013001001210403",required:true,defaultValue:true}),
    ],outputs:["sourceDigitalIdentifier","targetModelName","enabled"]},
    config_business_ownership:{code:"5011001001200007",identity:"5013001001200007",libraryName:"业务归属配置标准库",fields:[
      libraryField("cfg-bo-dept","组织/部门","departmentName","5013001001210501","lib-standard-dept","部门信息标准库","5013001001003001"),
      libraryMultiField("cfg-bo-biz","业务领域集合","businessDomains","5013001001210502","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      f("cfg-bo-desc","业务归属说明","ownershipDescription","textarea",{digitalId:"5013001001210503",width:12}),
    ],outputs:["departmentName","businessDomains","ownershipDescription"]},
    config_approval_assignment:{code:"5011001001200008",identity:"5013001001200008",libraryName:"审批分管配置标准库",fields:[
      libraryField("cfg-as-rank","组织职级","organizationRank","5013001001210601","lib-standard-org-rank","组织职级标准库","5013001001110154"),
      libraryMultiField("cfg-as-admin","行政审批分管业务","administrativeBusinessDomains","5013001001210602","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      libraryMultiField("cfg-as-biz","业务审批分管业务","businessApprovalDomains","5013001001210603","lib-standard-business-definition","业务定义标准库","5013001001006002"),
      libraryField("cfg-as-ath","行政阈值类型","administrativeThresholdType","5013001001210604","lib-standard-threshold-type","阈值类型标准库","5013001001110162",{required:false}),
      libraryField("cfg-as-bth","业务阈值类型","businessThresholdType","5013001001210605","lib-standard-threshold-type","阈值类型标准库","5013001001110162",{required:false}),
    ],outputs:["organizationRank","administrativeBusinessDomains","businessApprovalDomains","administrativeThresholdType","businessThresholdType"]},
    config_threshold:{code:"5011001001200009",identity:"5013001001200009",libraryName:"审批阈值配置标准库",fields:[
      libraryField("cfg-th-type","阈值类型","thresholdType","5013001001210701","lib-standard-threshold-type","阈值类型标准库","5013001001110162"),
      libraryField("cfg-th-id","对应数字化标识","thresholdDigitalIdentifier","5013001001210702","lib-standard-identifier","数字化标识标准库","5013001001008001"),
      f("cfg-th-value","阈值值","thresholdValue","number",{digitalId:"5013001001210703",required:true}),
      libraryField("cfg-th-rank","对应审批层级","approvalLevel","5013001001210704","lib-standard-admin-approval-level","行政审批层级标准库","5013001001110082"),
    ],outputs:["thresholdType","thresholdDigitalIdentifier","thresholdValue","approvalLevel"]},
  }
  const spec=specs[key]
  if(!spec) return null
  const list=nodes([[`${key}-read`,"read","读取标准库","从业务、数字化、人员或审批标准数字化库读取候选数据"],[`${key}-input`,"interaction","配置关系","通过选择形成配置，不在本模型中维护固定字典"],[`${key}-output`,"output","配置归档","将配置结果写入本模型数字化库，供审批模型或智选模型读取"]])
  const suggestion=baseSuggestion(meta.name,meta.category,meta.description,spec.modelType??"business",["manual"],meta.description,"系统配置人员；配置数据本身也是模型运行记录，归档后可被审批、智选及其他模型读取。")
  const config={...standardLibraryConfig(meta.name,spec.code,spec.identity),storageName:spec.libraryName}
  return {suggestion,design:baseDesign(spec.fields,list,[],spec.outputs),testData:{cases:[]},configuration:config}
}

function systemBuildTemplate(key: TemplateKey): TemplatePreset | null {
  const meta = MODEL_TEMPLATE_CATALOG.find(item=>item.key===key)
  if (!meta || !["模型建设","数字化建设"].includes(meta.group)) return null
  const stageMap: Record<string,{code:string;identity:string;stageKey:string;payloadLabel:string}> = {
    stage_suggestion:{code:"5011001002001001",identity:"5013001002001001",stageKey:"suggestion",payloadLabel:"建议模型内容"},
    stage_design:{code:"5011001002001002",identity:"5013001002001002",stageKey:"design",payloadLabel:"设计模型内容"},
    stage_test:{code:"5011001002001003",identity:"5013001002001003",stageKey:"test",payloadLabel:"测试模型内容"},
    stage_config:{code:"5011001002001004",identity:"5013001002001004",stageKey:"config",payloadLabel:"配置模型内容"},
  }
  if (stageMap[key]) {
    const x=stageMap[key]
    const fields=[
      f(`${key}-target`,`目标模型`,`targetModelName`,`text`,{required:true,readonly:true}),
      f(`${key}-project`,`建设事项`,`targetProjectId`,`text`,{required:true,readonly:true}),
      f(`${key}-stage`,`建设模型类型`,`stageKey`,`text`,{required:true,readonly:true}),
      f(`${key}-payload`,x.payloadLabel,`stagePayload`,`textarea`,{required:true,width:12,readonly:true}),
    ]
    const list=nodes([[`${key}-read`,"read","读取目标模型建设数据","读取目标模型和当前建设模型输入"],[`${key}-process`,"calculation",meta.name,"形成当前建设模型的独立运行结果"],[`${key}-output`,"output","建设结果归档","写入本建设模型数字化库；归档后进入通用审批模型"]])
    const suggestion=baseSuggestion(meta.name,meta.category,meta.description,"build",["manual"],meta.description,"模型建设人员；每个建设阶段作为一个独立模型运行。")
    return {suggestion,design:baseDesign(fields,list,[],["targetModelName","targetProjectId","stageKey","stagePayload"],{formSettings:{columns:2,labelPosition:"top",descriptionMode:"inline",inputWidth:"auto",submitText:"归档本建设模型",showHeader:true}}),testData:{cases:[{id:`${key}-case`,name:"建设模型基础验证",input:{targetModelName:"示例业务模型",targetProjectId:"project-demo",stageKey:x.stageKey,stagePayload:{example:true}},expectValid:true,expectedOutput:{targetModelName:"示例业务模型",stageKey:x.stageKey}}]},configuration:businessConfig(meta.name,x.code,x.identity,["manual"],"internal")}
  }

  const digitalMap: Record<string,{code:string;identity:string;fields:Field[];outputs:string[]}> = {
    digital_business_definition:{code:"5011001001001001",identity:"5013001001001001",fields:[
      f("dbd-name","业务名称","businessName","text",{required:true}),
      f("dbd-parent","上级业务","parentBusiness","dataSelect",{sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-business-definition",sourceLibrary:"业务定义标准库",sourceDigitalId:"5013001001006002",mode:"options"}}),
      libraryField("dbd-level","业务层级","businessLevel",stableFieldDigitalId("dbd-level:businessLevel"),"lib-standard-business-level","业务层级标准库","5013001001110022"),
      f("dbd-desc","业务定义","businessDefinition","textarea",{required:true,width:12}),
    ],outputs:["businessName","parentBusiness","businessLevel","businessDefinition"]},
    digital_definition:{code:"5011001001001002",identity:"5013001001001002",fields:[
      f("dd-name","定义名称","definitionName","text",{required:true}),
      libraryField("dd-type","定义类型","definitionType",stableFieldDigitalId("dd-type:definitionType"),"lib-standard-definition-type","数字化定义类型标准库","5013001001110032"),
      f("dd-text","定义内容","definitionText","textarea",{required:true,width:12}),
    ],outputs:["definitionName","definitionType","definitionText"]},
    digital_model_code:{code:"5011001001001003",identity:"5013001001001003",fields:[
      f("dmc-model","选择模型","targetModelName","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-model",sourceLibrary:"模型信息标准库",sourceDigitalId:"5013001001005001",mode:"options"}}),
      f("dmc-code","模型数字化编码","modelDigitalCode","text",{required:true,pattern:"^[0-9]{16}$",placeholder:"16位数字"}),
      f("dmc-domain","业务领域","businessDomain","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-business-definition",sourceLibrary:"业务定义标准库",sourceDigitalId:"5013001001006002",mode:"options"}}),
    ],outputs:["targetModelName","modelDigitalCode","businessDomain"]},
    digital_person_code:{code:"5011001001001004",identity:"5013001001001004",fields:[
      f("dpc-person","选择人员","personName","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-person",sourceLibrary:"人员信息标准库",sourceDigitalId:"5013001001002002",mode:"options"}}),
      f("dpc-code","人员数字化编码","personDigitalCode","text",{required:true,pattern:"^[0-9]{16}$",placeholder:"16位数字"}),
      f("dpc-dept","所属部门","department","department",{readonly:true,sourceMode:"library_fill",linkage:{sourceLibraryId:"lib-standard-person",sourceLibrary:"人员信息标准库",triggerFieldKey:"personName",matchDigitalId:"5013001001002002",sourceDigitalId:"5013001001002004",mode:"fill"}}),
    ],outputs:["personName","personDigitalCode","department"]},
    digital_attribute:{code:"5011001001001005",identity:"5013001001001005",fields:[
      libraryField("dac-type","对象类型","objectType",stableFieldDigitalId("dac-type:objectType"),"lib-standard-object-type","数字化对象类型标准库","5013001001110042"),
      f("dac-model","模型对象","objectName","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-model",sourceLibrary:"模型信息标准库",sourceDigitalId:"5013001001005001",mode:"options"}}),
      libraryField("dac-attr","数字化属性","attributeName",stableFieldDigitalId("dac-attr:attributeName"),"lib-standard-attribute-definition","数字化属性定义标准库","5013001001110052"),
      f("dac-value","属性值","attributeValue","text",{required:true}),
    ],outputs:["objectType","objectName","attributeName","attributeValue"]},
    digital_identifier:{code:"5011001001001006",identity:"5013001001001006",fields:[
      f("dic-biz","业务归属","businessName","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-business-definition",sourceLibrary:"业务定义标准库",sourceDigitalId:"5013001001006002",mode:"options"}}),
      f("dic-code","数字化标识","digitalIdentifier","text",{required:true,pattern:"^[0-9]{16}$",placeholder:"16位数字"}),
      f("dic-name","中文显示名称","displayName","text",{required:true}),
      libraryField("dic-type","数据类型","dataType",stableFieldDigitalId("dic-type:dataType"),"lib-standard-data-type","数据类型标准库","5013001001110062"),
      f("dic-desc","标识说明","identifierDescription","textarea",{width:12}),
    ],outputs:["businessName","digitalIdentifier","displayName","dataType","identifierDescription"]},
    digital_library:{code:"5011001001001007",identity:"5013001001001007",fields:[
      f("dlc-model","对应模型","targetModelName","dataSelect",{required:true,sourceMode:"library_select",linkage:{sourceLibraryId:"lib-standard-model",sourceLibrary:"模型信息标准库",sourceDigitalId:"5013001001005001",mode:"options"}}),
      f("dlc-name","数字化库名称","libraryName","text",{required:true}),
      f("dlc-ids","数字化标识列","digitalIdentifierColumns","dataMultiSelect",{required:true,width:12,sourceMode:"library_multi_select",linkage:{sourceLibraryId:"lib-standard-identifier",sourceLibrary:"数字化标识标准库",sourceDigitalId:"5013001001008002",mode:"options"}}),
      f("dlc-standard","启用标准库功能","isStandardLibrary","boolean",{required:true}),
      f("dlc-source","允许作为模型数据源","allowAsSource","boolean",{required:true}),
    ],outputs:["targetModelName","libraryName","digitalIdentifierColumns","isStandardLibrary","allowAsSource"]},
  }
  const x=digitalMap[key]
  if (!x) return null
  const list=nodes([[`${key}-input`,"interaction","选择与定义","优先从既有标准数字化库选择对象；仅新增定义内容采用人工填写"],[`${key}-output`,"output","数字化结果归档","形成数字化建设结果并写入本模型数字化库"]])
  const suggestion=baseSuggestion(meta.name,meta.category,meta.description,"digital",["manual"],meta.description,"数字化管理人员；结果经审批和智选后成为后续模型可选择的数据。")
  return {suggestion,design:baseDesign(x.fields,list,[],x.outputs),testData:{cases:[]},configuration:businessConfig(meta.name,x.code,x.identity,["manual"],"internal")}
}

function meetingTemplate(key: Exclude<TemplateKey,"blank"|"leave"|"approval"|"smart">): TemplatePreset {
  const item = MODEL_TEMPLATE_CATALOG.find(x=>x.key===key)!
  const common = (goal:string, scope:string)=>baseSuggestion(item.name,item.category,item.description,item.modelType,item.startModes,goal,scope)
  if(key==="meeting_topic"){
    const fields=[f("mt-title","议题名称","topicName","text",{required:true,width:12}),libraryField("mt-type","会议类型","meetingType",stableFieldDigitalId("mt-type:meetingType"),"lib-standard-meeting-type","会议类型标准库","5013001001110112"),f("mt-basis","上会依据","basis","textarea",{required:true,width:12}),f("mt-bg","有关背景情况","background","textarea",{required:true,width:12}),f("mt-focus","提请领导重点关注事项","focus","textarea",{width:12}),f("mt-suggest","有关工作建议/工作建议","suggestionText","textarea",{width:12}),f("mt-decision","决策要点","decisionPoints","textarea",{width:12}),f("mt-limit","办结时限","deadline","text"),f("mt-reason","动因合理性","reasonableness","textarea",{width:12}),f("mt-compliance","依据合规性","compliance","textarea",{width:12}),f("mt-plan","方案","plan","textarea",{width:12}),f("mt-item","审议事项","deliberation","textarea",{width:12})]
    const list=nodes([["mt-read","read","接收启动数字化标识","接收智选传递的数字化标识或人工启动上下文"],["mt-input","interaction","议题提报交互","输入议题名称并根据会议类型展示对应模板"],["mt-calc","calculation","匹配会议议题模板","党委会、董事长专题会、总经理办公会、采购管理委员会分别匹配模板字段"],["mt-output","output","议题提报归档","生成文件名、模型结果并入库"]])
    return {suggestion:common("形成单一议题提报实例，根据会议类型匹配对应议题模板并形成规范化议题数据。","人工发起或由前序智选模型带入数字化标识的议题。"),design:baseDesign(fields,list,[standard("mt-s1","Input() 议题名称、会议类型","FN、议题名称、会议类型","接收数字化标识；按会议类型选择模板","数字化标识传递与模板匹配","对应会议类型议题内容",""),standard("mt-s2","按模板输入议题内容","议题模板、议题模板库、A1..A5","if meetingType 匹配模板并组合 A1..An","匹配党委会/董事长专题会/总经理办公会/采购管理委员会模板","议题模型结果","生成文件名并写入会议议题提报数字化库")],["topicName","meetingType","basis","background","focus","suggestionText","decisionPoints","deadline","reasonableness","compliance","plan","deliberation"]),testData:{cases:[{id:"mt-c1",name:"董事长专题会议题",input:{topicName:"测试议题",meetingType:"董事长专题会",basis:"依据",background:"背景",focus:"关注事项",decisionPoints:"决策要点"},expectValid:true,expectedOutput:{topicName:"测试议题",meetingType:"董事长专题会"}}]},configuration:businessConfig(item.name,"5011001006001001","5013001006001001",item.startModes,"all")}
  }
  if(key==="meeting_collect"){
    const fields=[f("mc-source","来源文件名","sourceFileName","text",{readonly:true,required:true}),f("mc-title","议题名称","topicName","text",{readonly:true,required:true}),f("mc-type","会议类型","meetingType","text",{readonly:true,required:true}),f("mc-item","审议事项","deliberation","textarea",{readonly:true,width:12})]
    const list=nodes([["mc-read","read","读取智选传递数据","读取审议事项、议题名称和会议类型"],["mc-calc","calculation","形成会议收集记录","按传入数字化标识关联议题数据"],["mc-output","output","会议收集归档","生成文件名和模型结果并入库"]])
    return {suggestion:common("收集可进入会议管理的审议事项，形成会议类型、议题名称和审议事项的标准数据。","由智选模型触发并带入已确认议题数据。"),design:baseDesign(fields,list,[standard("mc-s1","","智选启动传递数字化标识、审议事项、议题名称、会议类型","按数字化标识读取并组合议题数据","数字化标识传递和审议事项收集","审议事项","生成文件名、模型结果并入会议收集数字化库")],["sourceFileName","topicName","meetingType","deliberation"]),testData:{cases:[{id:"mc-c1",name:"收集一项议题",input:{sourceFileName:"5011001006001001-5011002000000001-20260908140000",topicName:"测试议题",meetingType:"董事长专题会",deliberation:"审议事项"},expectValid:true,expectedOutput:{topicName:"测试议题"}}]},configuration:businessConfig(item.name,"5011001006001002","5013001006001002",item.startModes)}
  }
  if(key==="meeting_group"){
    const fields=[libraryField("mg-type","会议类型","meetingType",stableFieldDigitalId("mg-type:meetingType"),"lib-standard-meeting-type","会议类型标准库","5013001001110112"),f("mg-topics","待上会审议事项","topics","subform",{width:12,required:true,subFields:[{id:"mg-s1",label:"议题序号",key:"sequence",type:"number",required:true},{id:"mg-s2",label:"审议事项",key:"item",type:"text",required:true}]})]
    const list=nodes([["mg-read","read","接收定时/定量/人工启动条件","读取会议类型及会议收集库"],["mg-calc","calculation","统计并形成待上会议题集合","Count 待上会审议事项数量并组织议题序号"],["mg-output","output","议题编组归档","形成编组文件名和多条议题标识并入库"]])
    return {suggestion:common("按会议类型形成本次会议的待上会议题集合和编组结果。","支持定时、定量和人工启动；读取会议收集库中的待上会事项。"),design:baseDesign(fields,list,[standard("mg-s1","","定时/定量启动数字化标识、会议类型","按启动条件确定会议类型","形成本次编组会议类型","会议类型",""),standard("mg-s2","","会议组织库、会议收集库、MTG 待上会审议事项、m 审议事项数量、议题序号","读取待上会议题并 Count 数量，形成议题集合","议题编组","审议事项集合","生成文件名、模型结果并入会议议题编组数字化库")],["meetingType","topics"]),testData:{cases:[{id:"mg-c1",name:"编组2项议题",input:{meetingType:"董事长专题会",topics:[{sequence:1,item:"事项A"},{sequence:2,item:"事项B"}]},expectValid:true,expectedOutput:{meetingType:"董事长专题会"}}]},configuration:businessConfig(item.name,"5011001006001003","5013001006001003",item.startModes)}
  }
  if(key==="meeting_review"){
    const fields=[f("mr-source","编组文件名","groupFileName","text",{readonly:true,required:true}),f("mr-seq","议题序号","sequence","number",{readonly:true,required:true}),f("mr-item","审定议题","topic","textarea",{readonly:true,width:12,required:true}),libraryField("mr-result","审定意见","reviewResult",stableFieldDigitalId("mr-result:reviewResult"),"lib-standard-review-opinion","议题审定意见标准库","5013001001110132")]
    const list=nodes([["mr-read","read","读取单个编组议题","按编组文件名和议题序号读取一条议题"],["mr-input","interaction","议题审定交互","一对一审定当前议题"],["mr-output","output","审定结果归档","生成独立审定实例并入库"]])
    return {suggestion:common("对编组中的每个议题分别形成一对一审定实例和审定结果。","由智选触发；每个实例只审定一个议题。"),design:baseDesign(fields,list,[standard("mr-s1","审定单一议题","智选启动数字化标识、编组文件名、议题序号","读取对应议题并形成审定结果","一对一审定","审定议题、审定结果","生成文件名、模型结果并入会议议题审定数字化库")],["groupFileName","sequence","topic","reviewResult"]),testData:{cases:[{id:"mr-c1",name:"单议题审定通过",input:{groupFileName:"5011001006001003-5011002000000001-20260908140000",sequence:1,topic:"事项A",reviewResult:"同意上会"},expectValid:true,expectedOutput:{reviewResult:"同意上会"}}]},configuration:businessConfig(item.name,"5011001006001004","5013001006001004",item.startModes)}
  }
  if(key==="meeting_organize"){
    const fields=[libraryField("mo-type","会议类型","meetingType",stableFieldDigitalId("mo-type:meetingType"),"lib-standard-meeting-type","会议类型标准库","5013001001110112"),f("mo-items","审定通过议题","approvedTopics","subform",{width:12,required:true,subFields:[{id:"mo-si1",label:"议题",key:"topic",type:"text",required:true},{id:"mo-si2",label:"汇报人",key:"reporter",type:"user"}]}),libraryField("mo-host","会议主持人","host",stableFieldDigitalId("mo-host:host"),"lib-standard-person","人员信息标准库","5013001001002002"),libraryMultiField("mo-att","会议出席人员","attendees",stableFieldDigitalId("mo-att:attendees"),"lib-standard-person","人员信息标准库","5013001001002002",{width:12}),f("mo-time","会议时间","meetingTime","text",{required:true}),libraryField("mo-room","会议室","meetingRoom",stableFieldDigitalId("mo-room:meetingRoom"),"lib-standard-meeting-room","会议室标准库","5013001001110122")]
    const list=nodes([["mo-read","read","读取会议议题编组与审定结果","仅取审定通过议题"],["mo-input","interaction","会议组织交互","选择会议时间、会议室、主持人、出席人员"],["mo-calc","calculation","匹配会议室与汇报人","读取会议室标准库和员工信息库"],["mo-output","output","会议组织归档","生成会议组织结果并入库"]])
    return {suggestion:common("形成可执行的会议组织数据，包括审定通过议题、时间、会议室、主持人、参会人员和汇报人。","支持定时、定量或人工启动；只组织审定通过的议题。"),design:baseDesign(fields,list,[standard("mo-s1","","启动数字化标识、会议类型、会议议题编组库","按会议类型读取审定通过的审议事项","确定会议类型与议题集合","会议类型、审议事项",""),standard("mo-s2","选择会议时间、会议室","会议主持人、出席人员、会议室标准库、员工信息库","匹配可用会议室并读取汇报人","会议组织","会议时间、会议室、主持人、出席人员、汇报人","生成文件名、模型结果并入会议组织数字化库")],["meetingType","approvedTopics","host","attendees","meetingTime","meetingRoom"]),testData:{cases:[{id:"mo-c1",name:"组织1项议题",input:{meetingType:"董事长专题会",approvedTopics:[{topic:"事项A",reporter:"张珊"}],host:"张珊",attendees:"参会人员A",meetingTime:"2026-09-10 09:00",meetingRoom:"第一会议室"},expectValid:true,expectedOutput:{meetingRoom:"第一会议室"}}]},configuration:businessConfig(item.name,"5011001006001005","5013001006001005",item.startModes)}
  }
  if(key==="meeting_notice"){
    const fields=[f("mn-type","会议类型","meetingType","text",{readonly:true,required:true}),f("mn-time","会议时间","meetingTime","text",{readonly:true,required:true}),f("mn-room","会议室","meetingRoom","text",{readonly:true,required:true}),f("mn-content","通知内容","noticeContent","textarea",{width:12,required:true}),f("mn-range","通知范围","noticeRange","textarea",{width:12,required:true})]
    const list=nodes([["mn-read","read","读取会议组织数据","读取会议类型、时间、地点和参会范围"],["mn-calc","calculation","生成通知内容与范围","按会议组织结果组合通知内容并统计通知范围"],["mn-output","output","会议通知归档","会议通知模型入库"]])
    return {suggestion:common("根据会议组织结果形成会议通知内容和通知范围。","由智选模型触发并读取已确认的会议组织数据。"),design:baseDesign(fields,list,[standard("mn-s1","","智选启动数字化标识、通知内容","读取会议组织相关数据并按条件组合会议通知内容","生成会议通知内容","会议通知内容",""),standard("mn-s2","","通知范围","读取人员范围并统计通知数量","确定通知范围","通知范围","会议通知模型入库")],["meetingType","meetingTime","meetingRoom","noticeContent","noticeRange"]),testData:{cases:[{id:"mn-c1",name:"生成会议通知",input:{meetingType:"董事长专题会",meetingTime:"2026-09-10 09:00",meetingRoom:"第一会议室",noticeContent:"会议通知",noticeRange:"参会人员A、参会人员B"},expectValid:true,expectedOutput:{noticeContent:"会议通知"}}]},configuration:businessConfig(item.name,"5011001006001006","5013001006001006",item.startModes)}
  }
  if(key==="meeting_feedback"){
    const fields=[f("mf-content","会议通知内容","noticeContent","textarea",{readonly:true,width:12,required:true}),libraryField("mf-attend","是否参会","willAttend",stableFieldDigitalId("mf-attend:willAttend"),"lib-standard-yes-no","是否标准库","5013001001110142"),f("mf-reason","不能参会原因","absenceReason","textarea",{width:12,visibleWhen:{fieldKey:"willAttend",operator:"eq",value:"否"}})]
    const list=nodes([["mf-read","read","读取会议通知","读取通知内容与参会对象"],["mf-input","interaction","参会反馈交互","选择是否参会并按需要填写原因"],["mf-output","output","反馈结果归档","形成参会反馈结果并入库；后续触发关系在第4阶段配置"]])
    return {suggestion:common("收集参会人员是否参会及必要说明，形成参会反馈数据。","由智选模型触发并读取会议通知数据。"),design:baseDesign(fields,list,[standard("mf-s1","选择是否参会","智选启动数字化标识、通知内容","读取会议通知并采集参会选择","参会反馈","是否参会、不能参会原因","参会反馈模型入库；后续模型由配置关系触发")],["noticeContent","willAttend","absenceReason"]),testData:{cases:[{id:"mf-c1",name:"确认参会",input:{noticeContent:"会议通知",willAttend:"是"},expectValid:true,expectedOutput:{willAttend:"是"}}]},configuration:businessConfig(item.name,"5011001006001010","5013001006001010",item.startModes)}
  }
  if(key==="meeting_session"){
    const fields=[f("ms-type","会议类型","meetingType","text",{readonly:true,required:true}),f("ms-info","会议整体信息","meetingInfo","textarea",{readonly:true,width:12,required:true}),f("ms-items","审议事项","agendaItems","subform",{width:12,required:true,subFields:[{id:"ms-si1",label:"议题",key:"topic",type:"text",required:true},{id:"ms-si2",label:"汇报内容",key:"content",type:"textarea"},{id:"ms-si3",label:"会议意见",key:"opinion",type:"textarea"}]})]
    const list=nodes([["ms-read","read","读取会议组织、通知与反馈数据","形成会议整体展示数据"],["ms-interaction","interaction","逐项审议展示","按议题序号逐项 Show 并选择当前审议事项"],["ms-output","output","会议结果归档","形成会议展示/审议记录并入库"]])
    return {suggestion:common("展示会议整体信息并逐项展示审议事项，形成会议过程数据。","由智选模型触发，读取会议组织、通知、反馈及议题相关数据。"),design:baseDesign(fields,list,[standard("ms-s1","会议整体展示","智选启动数字化标识、会议相关数据","读取并组合会议整体数据；统计汇报通知数量 m","会议整体展示","会议整体信息",""),standard("ms-s2","选择当前审议事项并逐项展示","Show、Select、n、m","n=0；按 n<m 循环逐项 Show，并按配置触发关联模型","逐项会议展示","审议事项展示/会议记录","会议模型入库")],["meetingType","meetingInfo","agendaItems"]),testData:{cases:[{id:"ms-c1",name:"展示1项议题",input:{meetingType:"董事长专题会",meetingInfo:"会议整体信息",agendaItems:[{topic:"事项A",content:"汇报内容",opinion:"同意"}]},expectValid:true,expectedOutput:{meetingType:"董事长专题会"}}]},configuration:businessConfig(item.name,"5011001006001008","5013001006001008",item.startModes)}
  }
  const fields=[f("mm-standard","纪要标准内容","standardContent","textarea",{readonly:true,width:12,required:true}),f("mm-items","审议事项与结果","agendaResults","subform",{width:12,required:true,subFields:[{id:"mm-si1",label:"审议事项",key:"topic",type:"text",required:true},{id:"mm-si2",label:"议案结果",key:"result",type:"text",required:true},{id:"mm-si3",label:"议题记录",key:"record",type:"textarea"},{id:"mm-si4",label:"议题纪要",key:"minutes",type:"textarea"}]}),f("mm-record","会议记录","meetingRecord","textarea",{width:12}),f("mm-minutes","会议纪要","meetingMinutes","textarea",{width:12,required:true})]
  const list=nodes([["mm-read","read","读取会议记录和纪要标准","读取纪要标准内容、议案标准意见和会议数据"],["mm-input","interaction","逐项形成议题纪要","选择议案结果并形成每项议题纪要"],["mm-calc","calculation","汇总会议纪要","统计审议事项并逐项拼接议题纪要"],["mm-output","output","会议纪要归档","形成会议纪要并入库"]])
  return {suggestion:common("依据纪要标准内容、议案结果、议题记录和会议记录逐项形成并汇总会议纪要。","由智选模型触发并读取已确认的会议数据。"),design:baseDesign(fields,list,[standard("mm-s1","","智选启动数字化标识、纪要标准内容","读取会议相关数据并形成纪要标准内容","纪要标准内容读取","纪要标准内容、审议事项",""),standard("mm-s2","Select() 议案结果","议案标准意见、纪要标准意见库、议题记录、议题纪要","统计审议事项数量；逐项形成议题纪要","逐项生成纪要","议题纪要",""),standard("mm-s3","","会议记录、会议纪要","将各议题纪要与会议记录汇总形成会议纪要","会议纪要汇总","会议纪要","会议纪要模型入库")],["standardContent","agendaResults","meetingRecord","meetingMinutes"]),testData:{cases:[{id:"mm-c1",name:"生成会议纪要",input:{standardContent:"标准内容",agendaResults:[{topic:"事项A",result:"同意",record:"记录",minutes:"纪要"}],meetingRecord:"会议记录",meetingMinutes:"会议纪要正文"},expectValid:true,expectedOutput:{meetingMinutes:"会议纪要正文"}}]},configuration:businessConfig(item.name,"5011001006001009","5013001006001009",item.startModes)}
}

export function blankTemplate(name="新建业务模型"): TemplatePreset {
  const suggestion=baseSuggestion(name,"业务管理","","business",["manual"],"","" )
  const list=nodes([["blank-input","interaction","交互输入","用户输入或选择业务数据"],["blank-output","output","输出存储","形成结果并写入本模型数字化库"]])
  return {suggestion,design:baseDesign([],list,[standard("blank-s1","交互输入","参数首次出现时定义名称、含义和来源","按读取、匹配、计算、分析、判断顺序配置运算","说明公式对应的业务含义","明确本模型形成的数据和结果","仅数字化标识对应的数据进入本模型数字化库")],[]),testData:{cases:[]},configuration:businessConfig(name,"","",["manual"],"all")}
}

export function getTemplatePreset(key: string): TemplatePreset | null {
  let preset: TemplatePreset | null = null
  if(key==="blank") preset = blankTemplate()
  else if(key==="leave") preset = leaveTemplate()
  else if(key==="approval") preset = approvalTemplate()
  else if(key==="smart") preset = smartTemplate()
  else if(MODEL_TEMPLATE_CATALOG.some(x=>x.key===key && x.group==="基础标准库")) preset = standardLibraryTemplate(key as TemplateKey)
  else if(MODEL_TEMPLATE_CATALOG.some(x=>x.key===key && x.group==="审批智选配置")) preset = controlConfigTemplate(key as TemplateKey)
  else if(MODEL_TEMPLATE_CATALOG.some(x=>x.key===key && ["模型建设","数字化建设"].includes(x.group))) preset = systemBuildTemplate(key as TemplateKey)
  else if(MODEL_TEMPLATE_CATALOG.some(x=>x.key===key && x.group==="会议模型簇")) preset = meetingTemplate(key as any)
  if(!preset) return null
  const meta = MODEL_TEMPLATE_CATALOG.find(item=>item.key===key)
  return { ...preset, suggestion: { ...preset.suggestion, templateKey: key, templateSource: meta?.source ?? "模型·库推演技术总结20260820" } }
}

export function getTemplateCatalog() { return MODEL_TEMPLATE_CATALOG.map(item=>({ ...item })) }
