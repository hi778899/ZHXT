import { useEffect, useState } from "react"
import { apiFetch } from "./api"
import { ModelBuilderWorkbench } from "./ModelBuilderWorkbench"

type IconName = "squares" | "plus" | "clock" | "check" | "search" | "chevron" | "bell" | "gear" | "book" | "shield" | "layers" | "file" | "user" | "arrow" | "back" | "close" | "home"
type View = "dashboard" | "models" | "model-detail" | "todo" | "todo-detail" | "done" | "done-detail" | "completed" | "completed-detail" | "construction" | "query" | "query-result" | "information" | "information-detail" | "settings" | "status" | "feature" | "admin" | "login"
type Model = [string, string, string]
type LeaveRequest = { leaveType: string; startDate: string; endDate: string; days: number; reason: string }
type ModelFieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "dataSelect" | "dataMultiSelect" | "date" | "number" | "boolean" | "user" | "department" | "subform" | "section"
type ModelSubField = { id: string; label: string; key: string; type: Exclude<ModelFieldType, "subform" | "section">; required?: boolean }
type ModelField = { id: string; label: string; key: string; type: ModelFieldType; required: boolean; options?: string[]; source?: string; sourceMode?: "manual" | "current_user" | "library_select" | "library_multi_select" | "library_fill" | "calculated"; digitalId?: string; placeholder?: string; description?: string; defaultValue?: unknown; width?: number; readonly?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string; visibleWhen?: { fieldKey: string; operator: "eq" | "neq" | "contains" | "notEmpty"; value?: string }; linkage?: { sourceLibrary?: string; sourceLibraryId?: string; triggerFieldKey?: string; matchField?: string; matchDigitalId?: string; sourceField?: string; sourceDigitalId?: string; mode?: "fill" | "options" }; permissions?: { visible?: boolean; editable?: boolean }; subFields?: ModelSubField[] }
type ModelDefinition = { kind: "business" | "approval" | "smart" | "service"; code: string; fileName: string; fields: ModelField[]; formula: string; explanation: string; output: string; storage: string; chain: string[] }
type DigitalLibraryColumn = { digitalId:string; displayName:string; fieldKey?:string; dataType:string; required:boolean; position:number; sourceRole:string }
type DigitalLibrarySummary = { id:string; name:string; kind:"standard"|"model"; isStandard:boolean; allowAsSource:boolean; recordCount:number; columns:DigitalLibraryColumn[]; fields:string[]; modelName?:string; modelCode?:string; digitalId?:string; projectStatus?:string }
type DigitalLibraryRecord = { recordId:string; modelId:string; projectId:string; runId:string; ownerId:string; ownerName:string; ownerCode:string; libraryId:string; libraryName:string; modelName:string; modelCode:string; digitalId:string; fileName:string; displayFileName:string; status:string; createdAt:string; values:Record<string,unknown>; data:Record<string,unknown> }

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const parts: Record<IconName, React.ReactNode> = {
    squares: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    plus: <path d="M12 5v14M5 12h14"/>, clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></>, check: <path d="m5 12 4 4 10-10"/>, search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>, chevron: <path d="m9 18 6-6-6-6"/>, bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 22h4"/></>, gear: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7.2 7.2 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.6 3h-4l-.3 3.1a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L6.4 11a7.2 7.2 0 0 0 0 2l-2.1 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 3.1h4l.3-3.1a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7.2 7.2 0 0 0 .1-1Z"/></>, book: <><path d="M5 4a3 3 0 0 1 3-3h11v18H8a3 3 0 0 0-3 3V4Z"/><path d="M5 19h14"/></>, shield: <path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6l8-3Z"/>, layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>, file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></>, user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>, arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>, back: <path d="m15 18-6-6 6-6"/>, close: <path d="m6 6 12 12M18 6 6 18"/>, home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{parts[name]}</svg>
}

const leaveModel: Model = ["请休假模型", "请休假管理", "采集请休假申请、计算业务结果并归档；归档后按模型关系触发独立审批模型"]
const modelList: Model[] = [
  leaveModel,
  ["会议议题提报", "会议管理", "根据会议类型匹配议题模板并生成提报结果"],
  ["会议收集", "会议管理", "读取议题名称、会议类型和审议事项形成收集结果"],
  ["会议议题编组", "会议管理", "按会议类型和议题数量形成待上会议题编组"],
  ["会议议题审定", "会议管理", "对编组中的议题逐项进行审定并输出结果"],
  ["会议组织", "会议管理", "汇总审定议题并选择会议时间、会议室和参会人员"],
  ["会议通知", "会议管理", "根据会议内容和通知范围生成会议通知"],
  ["参会反馈", "会议管理", "读取会议通知并收集是否参会反馈"],
  ["会议", "会议管理", "展示会议整体信息并逐项选择审议事项"],
  ["会议纪要", "会议管理", "根据标准内容、议案结果和会议记录生成会议纪要"],
]
const modelDefinitions: Record<string, ModelDefinition> = {
  "请休假模型": { kind: "business", code: "5011001005001000001", fileName: "5011001005001000001-50110020015-20260908140000", fields: [{ id: "leave-applicant", label: "申请人", key: "applicant", type: "user", required: false, source: "当前用户", readonly: true }, { id: "leave-department", label: "所属部门", key: "department", type: "department", required: false, readonly: true, source: "人员信息数字化库" }, { id: "leave-type", label: "请假类型", key: "leaveType", type: "select", required: true, options: ["年休假", "事假", "病假", "婚假", "调休"] }, { id: "leave-start", label: "开始日期", key: "startDate", type: "date", required: true }, { id: "leave-end", label: "结束日期", key: "endDate", type: "date", required: true }, { id: "leave-reason", label: "请假事由", key: "reason", type: "textarea", required: true }], formula: "请假天数 = 结束日期 - 开始日期 + 1", explanation: "读取员工与组织信息，计算请假天数，形成请休假业务结果并归档。审批不属于本模型内部节点。", output: "申请数据、请假天数、业务归档结果", storage: "请休假模型数字化库", chain: ["请休假模型", "业务归档", "审批模型"] },
  "会议议题提报": { kind: "business", code: "5011001006001001", fileName: "5011001006001001-50110020015-20260908140000", fields: [{ id: "topic-name", label: "议题名称", key: "topicName", type: "text", required: true }, { id: "meeting-type", label: "会议类型", key: "meetingType", type: "select", required: true, options: ["党委会", "董事长专题会", "总经理办公会", "采购管理委员会"] }, { id: "meeting-topic", label: "上会依据", key: "meetingBasis", type: "textarea", required: true }, { id: "topic-background", label: "有关背景情况", key: "background", type: "textarea", required: true }, { id: "topic-focus", label: "提请领导重点关注事项", key: "focus", type: "textarea", required: false }, { id: "topic-suggestion", label: "有关工作建议", key: "suggestion", type: "textarea", required: false }, { id: "topic-deadline", label: "此项工作办结时限", key: "deadline", type: "date", required: false }], formula: "IF(会议类型 = 党委会, 党委会议题模板, IF(会议类型 = 董事长专题会, 董事长专题会议题模板, 会议类型对应模板))", explanation: "按会议类型匹配对应议题模板，输入项组成模型结果。", output: "匹配对应会议议题模板、生成文件名", storage: "会议议题提报数字化库", chain: ["会议议题提报", "审批模型", "智选模型", "会议收集"] },
  "会议收集": { kind: "business", code: "5011001006001002", fileName: "5011001006001002-50110020015-20260908140000", fields: [{ id: "collect-item", label: "审议事项", key: "reviewItem", type: "textarea", required: true }, { id: "collect-topic", label: "议题名称", key: "topicName", type: "text", required: true }, { id: "collect-type", label: "会议类型", key: "meetingType", type: "select", required: true, options: ["党委会", "董事长专题会", "总经理办公会", "采购管理委员会"] }, { id: "collect-source", label: "议题来源", key: "topicSource", type: "text", required: false, source: "会议议题提报模型" }], formula: "审议事项 = Read(会议议题提报结果) + Read(议题名称) + Read(会议类型)", explanation: "读取前序议题提报结果，形成可收集的审议事项。", output: "审议事项", storage: "会议收集数字化库", chain: ["会议收集", "审批模型", "智选模型", "会议议题编组"] },
  "会议议题编组": { kind: "business", code: "5011001006001003", fileName: "5011001006001003-50110020015-20260908140000", fields: [{ id: "group-type", label: "会议类型", key: "meetingType", type: "select", required: true, options: ["党委会", "董事长专题会", "总经理办公会", "采购管理委员会"], source: "会议组织数字化库" }, { id: "group-collection", label: "待上会议题", key: "collectedTopics", type: "textarea", required: true, source: "会议收集数字化库" }, { id: "group-number", label: "议题序号", key: "topicIndex", type: "number", required: false }, { id: "group-item", label: "审议事项", key: "reviewItem", type: "textarea", required: true }], formula: "m = Count(会议收集数字化库)；IF(议题序号 <= m, 输出当前审议事项)", explanation: "按会议类型读取会议组织数字化库和会议收集数字化库，并按数量编组。", output: "会议类型、审议事项", storage: "会议议题编组数字化库", chain: ["会议议题编组", "审批模型", "智选模型", "会议议题审定"] },
  "会议议题审定": { kind: "business", code: "5011001006001004", fileName: "5011001006001004-50110020015-20260908140000", fields: [{ id: "review-topic", label: "待审定议题", key: "topic", type: "text", required: true, source: "会议议题编组模型" }, { id: "review-result", label: "审定结果", key: "reviewResult", type: "select", required: true, options: ["通过", "不通过", "退回修改"] }, { id: "review-opinion", label: "审定意见", key: "reviewOpinion", type: "textarea", required: false }], formula: "审定议题 = Read(会议议题编组结果)；输出 = 审定议题", explanation: "对编组中的会议议题进行独立审定，形成后续组织依据。", output: "审定议题", storage: "会议议题审定数字化库", chain: ["会议议题审定", "审批模型", "智选模型", "会议组织"] },
  "会议组织": { kind: "business", code: "5011001006001005", fileName: "5011001006001005-50110020015-20260908140000", fields: [{ id: "org-type", label: "会议类型", key: "meetingType", type: "select", required: true, options: ["党委会", "董事长专题会", "总经理办公会", "采购管理委员会"] }, { id: "org-item", label: "审议事项", key: "reviewItems", type: "textarea", required: true, source: "会议议题编组模型" }, { id: "org-host", label: "会议主持人", key: "host", type: "user", required: true }, { id: "org-time", label: "会议时间", key: "meetingTime", type: "date", required: true }, { id: "org-room", label: "会议室", key: "room", type: "select", required: true, options: ["第一会议室", "第二会议室", "视频会议室"], source: "会议室数字化库" }, { id: "org-attendees", label: "会议出席人员", key: "attendees", type: "textarea", required: true, source: "人员信息数字化库" }, { id: "org-reporter", label: "汇报人", key: "reporter", type: "user", required: false, source: "人员信息数字化库" }], formula: "会议组织 = Read(审定议题) + Select(会议时间) + Select(会议室数字化库) + Read(人员信息数字化库)", explanation: "汇总审定通过的议题，配置会议主持人、时间、会议室和参会人员。", output: "会议类型、审议事项、会议出席人员、会议时间、会议室、汇报人", storage: "会议组织数字化库", chain: ["会议组织", "审批模型", "智选模型", "会议通知"] },
  "会议通知": { kind: "business", code: "5011001006001006", fileName: "5011001006001006-50110020015-20260908140000", fields: [{ id: "notice-content", label: "通知内容", key: "noticeContent", type: "textarea", required: true, source: "会议组织模型" }, { id: "notice-type", label: "会议类型", key: "meetingType", type: "select", required: true, options: ["党委会", "董事长专题会", "总经理办公会", "采购管理委员会"] }, { id: "notice-time", label: "会议时间", key: "meetingTime", type: "date", required: true }, { id: "notice-scope", label: "通知范围", key: "noticeScope", type: "textarea", required: true }, { id: "notice-attendees", label: "参会人员", key: "attendees", type: "textarea", required: false, source: "人员信息数字化库" }], formula: "会议通知内容 = Build(会议类型, 会议时间, 会议室, 审议事项)；通知范围 = Count(参会人员)", explanation: "读取会议组织结果生成通知内容，并按参会人员形成通知范围。", output: "会议通知内容、通知范围", storage: "会议通知数字化库", chain: ["会议通知", "审批模型", "智选模型", "参会反馈"] },
  "参会反馈": { kind: "business", code: "5011001006001010", fileName: "5011001006001010-50110020015-20260908140000", fields: [{ id: "feedback-notice", label: "通知内容", key: "noticeContent", type: "textarea", required: true, source: "会议通知模型" }, { id: "feedback-attend", label: "是否参会", key: "willAttend", type: "select", required: true, options: ["是", "否"] }, { id: "feedback-reason", label: "反馈说明", key: "feedbackReason", type: "textarea", required: false }], formula: "通知内容 = Read(会议通知模型)；IF(是否参会 = 是, 触发参会反馈结果, 记录未参会原因)", explanation: "用户对会议通知进行反馈，反馈结果进入后续会议组织关系。", output: "参会反馈结果", storage: "参会反馈数字化库", chain: ["参会反馈", "审批模型", "智选模型", "会议"] },
  "会议": { kind: "business", code: "5011001006001008", fileName: "5011001006001008-50110020015-20260908140000", fields: [{ id: "meeting-display", label: "会议整体展示", key: "meetingOverview", type: "textarea", required: true, source: "会议组织模型" }, { id: "meeting-notice", label: "汇报通知", key: "reportNotice", type: "text", required: false, source: "会议通知模型" }, { id: "meeting-select", label: "选择审议事项", key: "selectedReviewItem", type: "select", required: true, options: ["第一项", "第二项", "第三项"], source: "会议议题编组模型" }], formula: "m = Count(会议通知模型)；IF(n < m, n = n + 1, Show(审议事项))", explanation: "展示会议整体信息，并按序选择需要审议的事项。", output: "会议整体展示、选择审议事项", storage: "会议数字化库", chain: ["会议", "审批模型", "智选模型", "会议纪要"] },
  "会议纪要": { kind: "business", code: "5011001006001009", fileName: "5011001006001009-50110020015-20260908140000", fields: [{ id: "minutes-standard", label: "纪要标准内容", key: "standardContent", type: "textarea", required: true, source: "纪要标准内容数字化库" }, { id: "minutes-opinion", label: "议案标准意见", key: "standardOpinion", type: "textarea", required: false, source: "会议纪要数字化库" }, { id: "minutes-result", label: "议案结果", key: "motionResult", type: "select", required: true, options: ["同意", "不同意", "会议研究"] }, { id: "minutes-record", label: "会议记录", key: "meetingRecord", type: "textarea", required: true, source: "会议模型" }, { id: "minutes-content", label: "会议纪要", key: "minutes", type: "textarea", required: false }], formula: "审议事项数量 = Count(审议事项)；逐项生成纪要；会议纪要 = 纪要标准内容 + 议案结果 + 会议记录", explanation: "逐项读取议案结果并生成会议纪要，作为会议业务链的收束结果。", output: "会议纪要", storage: "会议纪要数字化库", chain: ["会议纪要", "审批模型", "智选模型", "后续业务模型"] },
  "审批模型": { kind: "approval", code: "5011001005001001", fileName: "5011001005001001-50110020015-20260908170000", fields: [{ id: "approval-source", label: "前序业务模型", key: "前序业务模型", type: "text", required: true, readonly: true }, { id: "approval-file", label: "前序模型文件名", key: "前序模型文件名", type: "text", required: true, readonly: true }, { id: "approval-display-file", label: "中文显示名称", key: "中文显示名称", type: "text", required: false, readonly: true }, { id: "approval-digital-id", label: "前序数字化标识", key: "前序数字化标识", type: "text", required: true, readonly: true }], formula: "按审批模型配置形成并执行本次审批路径", explanation: "审批模型是面向所有业务模型的通用管控模型，不固化某个业务模型的专用字段。", output: "审批过程、审批意见、审批结果", storage: "审批模型数字化库", chain: ["任一业务模型", "审批模型", "智选模型"] },
  "智选模型": { kind: "smart", code: "5011001005001003", fileName: "5011001005001003-50110020015-20260908170000", fields: [{ id: "smart-model", label: "业务模型", key: "businessSourceModelName", type: "text", required: true, readonly: true }, { id: "smart-file", label: "文件名", key: "businessFileName", type: "text", required: true, readonly: true }, { id: "smart-display-file", label: "中文显示名称", key: "businessDisplayFileName", type: "text", required: true, readonly: true }, { id: "smart-id", label: "数字化标识", key: "businessDigitalId", type: "text", required: true, readonly: true }, { id: "smart-related-id", label: "关联数字化标识", key: "associatedDigitalIds", type: "text", required: false, readonly: true }, { id: "smart-result", label: "审批结果", key: "approvalResult", type: "text", required: false, readonly: true, source: "审批模型" }], formula: "读取业务模型文件名与数字化标识 → 查询业务模型配置的标识关联关系 → 判断是否触发后续业务模型", explanation: "智选模型是面向所有业务模型的通用智能关联模型，只读取业务对象引用、审批结果和标识关联配置，不固化具体业务字段。", output: "业务文件名、中文显示名称、数字化标识、关联数字化标识、智选判断、后续关联模型", storage: "智选模型数字化库", chain: ["任一业务模型", "审批模型", "智选模型", "按业务模型标识关联结果决定后续模型"] },
}
const initialTodos = [
  { id: "seed-1", title: "模型建设标准更新待确认", model: "模型建设", sender: "设备管理部", date: "今天 09:30", status: "待确认" },
  { id: "seed-2", title: "运行记录补充填报", model: "设备运转统计", sender: "船机管理组", date: "今天 08:45", status: "待处理" },
  { id: "seed-3", title: "驾驶舱要素配置审核", model: "配置审批", sender: "数字化工作组", date: "9月2日", status: "处理中" },
  { id: "seed-4", title: "待办事项已送达", model: "审批模型", sender: "系统管理员", date: "9月1日", status: "待处理" },
  { id: "seed-5", title: "公共信息阅读确认", model: "信息发布", sender: "综合管理部", date: "8月30日", status: "待确认" },

]
type TodoItem = typeof initialTodos[number]
type DoneRecord = TodoItem & { content?: string; result: string; handled: string; handled_result?: string; handled_at?: string; record_kind?: "handled" | "launched" | "approval_run" | "cluster" | "completed_run" }
type DashboardMetrics = { todayCompleted:number; todayWorkRecords:number; todayHandled:number; rank:number; activeUsers:number; rankLabel:string }
const notices = [["关于驾驶舱要素调整的通知", "通知", "2026-09-01"], ["模型建设阶段说明更新", "说明", "2026-08-30"], ["数字化库使用指引发布", "指引", "2026-08-28"], ["系统维护安排", "通知", "2026-08-24"], ["公共信息阅读提醒", "提醒", "2026-08-22"], ["驾驶舱功能优化公告", "公告", "2026-08-20"], ["本月模型运行情况汇总", "汇总", "2026-08-18"]]
function dedupeNoticeRows<T extends { title: string; type: string; date: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = `${item.title.trim().toLowerCase()}|${item.type.trim().toLowerCase()}|${item.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
const titles: Record<View, string> = { dashboard: "驾驶舱", models: "可发起模型", "model-detail": "发起模型", todo: "我的待办", "todo-detail": "事项办理", done: "我的已办", "done-detail": "已办详情", completed: "我的办结", "completed-detail": "模型详情", construction: "模型建设工作台", query: "数字化库", "query-result": "数字化库", information: "公共信息", "information-detail": "信息详情", settings: "个人设置", status: "系统运行状态", feature: "功能工作区", admin: "管理后台", login: "用户登录" }

export default function App() {
  const [view, setView] = useState<View>("login")
  const [previous, setPrevious] = useState<View>("dashboard")
  const [todos, setTodos] = useState(initialTodos)
  const [done, setDone] = useState<DoneRecord[]>([{ ...initialTodos[4], result: "已阅读", handled: "2026-08-30 16:20", record_kind: "handled" }])
  const [selectedDone, setSelectedDone] = useState<DoneRecord | null>(null)
  const [completed, setCompleted] = useState<DoneRecord[]>([])
  const [selectedCompleted, setSelectedCompleted] = useState<DoneRecord | null>(null)
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>({ todayCompleted:0, todayWorkRecords:0, todayHandled:0, rank:0, activeUsers:0, rankLabel:"今日数字化成果数排名" })
  const [selectedTodo, setSelectedTodo] = useState(initialTodos[0])
  const [selectedModel, setSelectedModel] = useState<Model>(modelList[0])
  const [selectedNotice, setSelectedNotice] = useState(notices[0])
  const [noticeList, setNoticeList] = useState(notices)
  const [feature, setFeature] = useState("模型引擎")
  const [toast, setToast] = useState("")
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<{id:string;username:string;displayName:string;department:string;role:string} | null>(null)
  const refreshDashboard = async () => {
    const data = await apiFetch<{ todos: typeof initialTodos; done: Array<TodoItem & { content?: string; handled_result?: string; handled_at?: string; record_kind?: "handled" | "launched" | "approval_run" | "cluster" | "completed_run" }>; completed: Array<TodoItem & { content?: string; handled_result?: string; handled_at?: string; record_kind?: "completed_run" }>; metrics: DashboardMetrics }>("/api/dashboard")
    setTodos(data.todos)
    setDone(data.done.map(item => ({ ...item, result: item.handled_result ?? "已完成", handled: item.handled_at ?? item.date })))
    setCompleted((data.completed ?? []).map(item => ({ ...item, result:item.handled_result ?? "已办结", handled:item.handled_at ?? item.date })))
    if (data.metrics) setDashboardMetrics(data.metrics)
  }
  useEffect(() => { if (toast) { const t = window.setTimeout(() => setToast(""), 2200); return () => window.clearTimeout(t) } }, [toast])
  useEffect(() => { apiFetch<{user:NonNullable<typeof currentUser> }>("/api/auth/me").then(({user}) => { setCurrentUser(user); setView("dashboard") }).catch(() => undefined) }, [])
  useEffect(() => { if (!["dashboard", "todo", "done", "completed"].includes(view)) return; void refreshDashboard().catch(() => undefined) }, [view])
  useEffect(() => { if (view !== "dashboard") return; apiFetch<{ notices: Array<{ title:string; type:string; date:string }> }>("/api/notices").then(data => setNoticeList(dedupeNoticeRows(data.notices).map(item => [item.title, item.type, item.date]))).catch(() => undefined) }, [view])
  const navigate = (next: View) => { setPrevious(view); setView(next); setNotificationOpen(false); setUserOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }) }
  const openTodo = (item: typeof initialTodos[number]) => { setSelectedTodo(item); navigate("todo-detail") }
  const openFeature = (name: string) => { setFeature(name); navigate("feature") }
  const openModel = (model: Model) => { setSelectedModel(model); navigate("model-detail") }
  const finishTodo = async (result: string) => {
    const smartTask = Boolean(parseSmartTodoContent(selectedTodo))
    let nextTodo: typeof initialTodos[number] | null = null
    let completed = true
    let triggeredModel = ""
    if (!selectedTodo.id.startsWith("local-")) {
      try {
        const response = await apiFetch<{ todo?: typeof initialTodos[number] | null; completed?: boolean; triggeredModel?: string; triggerError?: string }>(`/api/todos/${selectedTodo.id}/handle`, { method: "POST", body: JSON.stringify({ result }) })
        nextTodo = response.todo ?? null
        completed = response.completed !== false
        triggeredModel = response.triggeredModel ?? ""
        if (response.triggerError) setToast(`审批已完成，但后续模型触发失败：${response.triggerError}`)
      } catch (error) { setToast(error instanceof Error ? error.message : "办理失败"); return }
    }
    if (selectedTodo.id.startsWith("local-")) {
      setTodos(v => { const rest = v.filter(x => x.id !== selectedTodo.id); return nextTodo ? [nextTodo, ...rest.filter(x => x.id !== nextTodo!.id)] : rest })
      setDone(v => [{ ...selectedTodo, result, handled: new Date().toISOString().slice(0,16).replace("T"," ") }, ...v])
    } else {
      try { await refreshDashboard() } catch { /* 页面切换后还会再次按真实服务端状态刷新 */ }
    }
    if (smartTask) setToast("智选结果已确认，记录已进入我的已办")
    else if (!nextTodo) setToast(triggeredModel ? `审批模型已归档，并已触发${triggeredModel}` : completed ? `审批模型处理完成：${result}` : `当前审批环节已完成：${result}`)
    else setToast("当前审批环节已完成，审批模型已生成下一环节待办")
    setView(nextTodo ? "todo" : "done")
  }
  const authenticate = async (account: string, password: string, remember: boolean) => { const result=await apiFetch<{user:NonNullable<typeof currentUser>}>("/api/auth/login", { method: "POST", body: JSON.stringify({ username: account, password, remember }) }); setCurrentUser(result.user); setView("dashboard"); setToast("登录成功") }
  const register = async (account:string, displayName:string, department:string, password:string) => { await apiFetch("/api/auth/register", {method:"POST", body:JSON.stringify({username:account,displayName,department,password})}) }
  if (view === "login") return <Login onLogin={authenticate} onRegister={register} />
  return <div className="min-h-screen bg-[#eaf1fb] text-[#142968]"><div className="mx-auto min-h-screen max-w-[1800px] bg-[#f5f8fe] shadow-[0_0_36px_rgba(30,58,123,.10)]">
    <Header title={titles[view]} userName={currentUser?.displayName ?? "张珊"} onHome={() => navigate("dashboard")} onNotify={() => setNotificationOpen(v => !v)} onSettings={() => navigate("settings")} onUser={() => setUserOpen(v => !v)} onLogout={() => setLogoutOpen(true)} onAdmin={currentUser?.role === "admin" ? () => navigate("admin") : undefined} />
    {notificationOpen && <Popover className="right-28 top-[58px] w-[330px]"><h3>通知中心</h3><p className="mt-3 rounded-lg bg-[#f0f5fd] p-3 text-sm">您有 {todos.length} 项待办需要处理。</p><button onClick={() => navigate("todo")} className="link mt-3">查看全部通知</button></Popover>}
    {userOpen && <Popover className="right-5 top-[58px] w-[220px]"><div className="flex items-center gap-3"><span className="avatar">{(currentUser?.displayName ?? "张珊").slice(0, 1)}</span><div><b>{currentUser?.displayName ?? "张珊"}</b><p className="muted">当前用户</p></div></div><button onClick={() => navigate("settings")} className="menu-button">个人设置</button><button onClick={() => setLogoutOpen(true)} className="menu-button text-[#c44949]">退出登录</button></Popover>}
    <TopNav view={view} navigate={navigate} isAdmin={currentUser?.role === "admin"} />
    {view === "dashboard" ? <Dashboard todos={todos} done={done} completed={completed} metrics={dashboardMetrics} openTodo={openTodo} navigate={navigate} /> : <Workspace title={titles[view]} onBack={() => setView(previous === view ? "dashboard" : previous)} onHome={() => navigate("dashboard")}>
      {view === "models" && <Models onSelect={openModel} />}
      {view === "model-detail" && <ModelDetail model={selectedModel} requester={currentUser?.displayName ?? "张珊"} requesterDepartment={currentUser?.department ?? ""} onStart={async (request, run) => {
        if (request) {
          const response = await apiFetch<{ todo?: typeof initialTodos[number] | null; archived?: boolean; triggeredModel?: string; triggerError?: string }>("/api/leave-requests", { method: "POST", body: JSON.stringify(request) })
          if (response.todo) setTodos(items => [response.todo!, ...items.filter(x => x.id !== response.todo!.id)])
          setToast(response.triggerError ? `请休假模型已归档，但审批模型触发失败：${response.triggerError}` : response.triggeredModel ? `请休假模型已归档，并已触发${response.triggeredModel}` : "请休假模型已归档")
          navigate(response.todo ? "todo" : "completed")
        } else if (run) {
          const response = await apiFetch<{ todo?: typeof initialTodos[number] | null; archived?: boolean; triggeredModel?: string; triggerError?: string }>("/api/model-runs", { method: "POST", body: JSON.stringify(run) })
          if (response.todo) setTodos(items => [response.todo!, ...items.filter(x => x.id !== response.todo!.id)])
          setToast(response.triggerError ? `${run.modelName}已归档，但后续模型触发失败：${response.triggerError}` : response.triggeredModel ? `${run.modelName}已归档，并已触发${response.triggeredModel}` : `${run.modelName}已运行并归档`)
          navigate(response.todo ? "todo" : "completed")
        }
      }} />}
      {view === "todo" && <TodoTable items={todos} openTodo={openTodo} />}
      {view === "todo-detail" && <TodoDetail item={selectedTodo} onFinish={finishTodo} onSave={() => setToast("办理内容已保存")} />}
      {view === "done" && <HandledTable items={done} onOpen={(item) => { setSelectedDone(item); navigate("done-detail") }} />}
      {view === "done-detail" && <HandledDetail item={selectedDone ?? done[0]} onOpenModel={x=>{setSelectedDone(x); setView("done-detail")}} />}
      {view === "completed" && <CompletedTable items={completed} onOpen={(item) => { setSelectedCompleted(item); navigate("completed-detail") }} />}
      {view === "completed-detail" && <CompletedDetail item={selectedCompleted ?? completed[0]} onOpenModel={(item) => { setSelectedCompleted(item); setView("completed-detail") }} />}
      {view === "construction" && <ModelBuilderWorkbench onToast={setToast} onLaunch={(name) => openModel(modelList.find(item => item[0] === name) ?? [name, "业务管理", "通过模型建设四阶段创建并发布的模型"])} />} 
      {view === "query" && <DigitalLibrary />}
      {view === "information" && <Information items={noticeList} onOpen={(n) => { setSelectedNotice(n); navigate("information-detail") }} />}
      {view === "information-detail" && <InformationDetail notice={selectedNotice} onAttachment={() => openFeature("附件查看")} />}
      {view === "settings" && <Settings onPasswordChange={async (current, next) => { await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) }); setToast("密码修改成功") }} onSave={() => setToast("个人设置已保存")} />}
      {view === "status" && <Status />}
      {view === "feature" && <Feature title={feature} />}
      {view === "admin" && currentUser?.role === "admin" && <AdminConsole />}
    </Workspace>}
  </div>{logoutOpen && <Modal title="确认退出登录？" onClose={() => setLogoutOpen(false)}><p className="muted">退出后需要重新登录才能进入驾驶舱。</p><div className="mt-6 flex justify-end gap-3"><button className="btn-secondary" onClick={() => setLogoutOpen(false)}>取消</button><button className="btn-primary" onClick={async () => { await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => undefined); setLogoutOpen(false); setView("login") }}>确认退出</button></div></Modal>}{toast && <div className="toast"><Icon name="check" size={17}/>{toast}</div>}</div>
}

function Header({ title, userName, onHome, onNotify, onSettings, onUser, onLogout, onAdmin }: { title: string; userName: string; onHome: () => void; onNotify: () => void; onSettings: () => void; onUser: () => void; onLogout: () => void; onAdmin?: () => void }) { return <header className="relative z-30 flex h-[62px] items-center bg-[#475aad] px-5 text-white md:px-8"><button onClick={onHome} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-white/10"><span className="grid size-8 place-items-center rounded-lg bg-white text-[#5062b1]"><Icon name="squares" size={18}/></span><span className="hidden font-semibold tracking-[.08em] sm:inline">公司标识</span></button><div className="mx-5 hidden h-6 w-px bg-white/25 md:block"/><h1 className="text-base font-semibold tracking-[.08em] md:text-lg">{title}</h1><div className="ml-auto flex items-center gap-1">{onAdmin && <button onClick={onAdmin} className="hidden rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 md:block">管理后台</button>}<button aria-label="通知" onClick={onNotify} className="header-icon"><Icon name="bell"/></button><button aria-label="设置" onClick={onSettings} className="header-icon"><Icon name="gear"/></button><button onClick={onUser} className="ml-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10"><span className="avatar small">{userName.slice(0, 1)}</span><span className="hidden text-left text-sm md:block"><b className="block font-medium">{userName}</b><small className="text-white/70">当前用户</small></span></button><button onClick={onLogout} className="ml-1 hidden rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white sm:block">退出</button></div></header> }
function TopNav({ view, navigate, isAdmin }: { view: View; navigate: (v: View) => void; isAdmin?: boolean }) { const items: [string, View][] = [["驾驶舱", "dashboard"], ["数字化库", "query"], ["我的待办", "todo"], ["我的已办", "done"], ["我的办结", "completed"], ["模型建设", "construction"], ["公共信息", "information"], ...(isAdmin ? [["管理后台", "admin"] as [string, View]] : [])]; return <nav className="sticky top-0 z-20 flex h-11 overflow-x-auto bg-[#394b98] px-3 text-white md:px-6">{items.map(([label, target]) => <button key={label} onClick={() => navigate(target)} className={`relative min-w-[112px] px-4 text-sm transition ${view === target || (view === "todo-detail" && target === "todo") || (view === "done-detail" && target === "done") || (view === "completed-detail" && target === "completed") || (view === "information-detail" && target === "information") ? "bg-[#6578bd] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-[#78c7ff]" : "text-white/88 hover:bg-white/10"}`}>{label}</button>)}</nav> }

function Dashboard({ todos, done, completed, metrics, openTodo, navigate }: { todos: typeof initialTodos; done: DoneRecord[]; completed: DoneRecord[]; metrics: DashboardMetrics; openTodo: (x: typeof initialTodos[number]) => void; navigate: (v: View) => void }) {
  return <main className="dashboard-home dashboard-workbench p-4 md:p-6">
    <section className="dashboard-welcome"><div><span className="status status-accent">个人工作台</span><h2>工作台</h2><p>集中处理个人事项、发起业务、查看工作进展，并快速进入常用功能。</p></div><button onClick={() => navigate("models")} className="btn-primary"><Icon name="plus" size={16}/>发起业务</button></section>

    <section className="dashboard-rule-section"><div className="dashboard-rule-heading"><div><h3>快捷入口</h3></div></div><div className="dashboard-rule-grid interaction-grid">
      <button className="dashboard-rule-card" onClick={() => navigate("models")}><span className="dashboard-rule-icon"><Icon name="layers" size={20}/></span><div><small>业务办理</small><b>发起业务</b><p>进入本人有权使用的已发布模型</p></div><Icon name="chevron" size={16}/></button>
      <button className="dashboard-rule-card" onClick={() => navigate("construction")}><span className="dashboard-rule-icon"><Icon name="gear" size={20}/></span><div><small>系统配置</small><b>模型建设</b><p>业务定义 → 数字化定义 → 模型设计 → 模型发布</p></div><Icon name="chevron" size={16}/></button>
    </div></section>

    <section className="dashboard-rule-section"><div className="dashboard-rule-heading"><div><h3>我的事项</h3></div></div><div className="dashboard-feedback-grid">
      <button onClick={() => navigate("todo")} className="feedback-card"><span className="dashboard-rule-icon"><Icon name="clock" size={19}/></span><small>当前需要本人处理</small><b>我的待办</b><strong>{todos.length}</strong></button>
      <button onClick={() => navigate("done")} className="feedback-card"><span className="dashboard-rule-icon"><Icon name="check" size={19}/></span><small>本人已经处理的任务/环节</small><b>我的已办</b><strong>{done.length}</strong></button>
      <button onClick={() => navigate("completed")} className="feedback-card"><span className="dashboard-rule-icon"><Icon name="file" size={19}/></span><small>已经完成归档的模型记录</small><b>我的办结</b><strong>{completed.length}</strong></button>
    </div><div className="dashboard-feedback-list"><div className="compact-panel-head"><div><b>待办事项</b><span>优先展示最近到达的个人待办</span></div><button onClick={() => navigate("todo")} className="link">查看全部 →</button></div><div className="dashboard-task-list">{todos.slice(0,4).map(item => <button key={item.id} onClick={() => openTodo(item)}><span><b>{item.title}</b><small>{item.model} · {item.date}</small></span><Icon name="chevron" size={15}/></button>)}{todos.length === 0 && <Empty text="当前没有待办事项" />}</div></div></section>

    <section className="dashboard-rule-section"><div className="dashboard-rule-heading"><div><h3>工作概览</h3></div></div><div className="dashboard-constraint-grid">
      <div className="constraint-card"><small>今日办结</small><b>{metrics.todayCompleted}</b><span>已完成归档的模型记录</span></div>
      <div className="constraint-card"><small>今日工作记录</small><b>{metrics.todayWorkRecords}</b><span>本人数字化库有效入库记录</span></div>
      <div className="constraint-card"><small>今日已办理</small><b>{metrics.todayHandled}</b><span>本人完成的办理动作</span></div>
      <div className="constraint-card"><small>{metrics.rankLabel}</small><b>{metrics.rank > 0 ? `第 ${metrics.rank} 名` : "暂无"}</b><span>{metrics.activeUsers > 0 ? `今日参与统计 ${metrics.activeUsers} 人` : "今日暂无可排名记录"}</span></div>
    </div></section>

    <section className="dashboard-rule-section"><div className="dashboard-rule-heading"><div><h3>常用服务</h3></div></div><div className="dashboard-resource-row"><button onClick={() => navigate("query")}>数字化库</button><button onClick={() => navigate("information")}>公共信息</button><button onClick={() => navigate("models")}>可发起模型</button></div></section>
  </main>
}
function LegacyDashboard({ todos, notices: dashboardNotices, openTodo, navigate, openFeature, setSelectedNotice }: { todos: typeof initialTodos; notices: string[][]; openTodo: (x: typeof initialTodos[number]) => void; navigate: (v: View) => void; openFeature: (x: string) => void; setSelectedNotice: (x: string[]) => void }) {
  const [taskTab, setTaskTab] = useState("待办")
  return <main className="dashboard-grid grid gap-5 p-4 xl:p-5"><section className="space-y-5"><Panel title="工作数字化"><div className="grid gap-3 p-3 md:grid-cols-2">
    <Card title="模型操作"><div className="grid grid-cols-3 gap-2">{[["新建", "新建模型", "plus", "models"], ["待办", `${todos.length}项待办`, "clock", "todo"], ["已办", "模型簇记录", "check", "done"]].map(([title, sub, icon, target]) => <button key={title} onClick={() => navigate(target as View)} className="action-tile"><span className="action-icon"><Icon name={icon as IconName} size={17}/></span><b>{title}</b><small>{sub}</small></button>)}</div></Card>
    <button onClick={() => navigate("construction")} className="card text-left hover-card"><h3 className="card-title">模型建设</h3><div className="mt-5 flex items-center justify-between text-sm font-medium">{["建议", "设计", "测试", "配置"].map((x, i) => <span className="contents" key={x}><span>{x}</span>{i < 3 && <Icon name="arrow" size={14}/>}</span>)}</div><p className="mt-5 text-center text-xs text-[#58709e]">请休假模型 · 四阶段建设闭环</p></button>
    <DigitalLibraryMini onOpen={() => navigate("query")} />
    <Card title="自定义展示"><div className="grid grid-cols-2 gap-2">{["我的模型", "最近使用", "最近查询", "继续查看", "收藏要素", "快捷进入"].map(x => <button onClick={() => openFeature(x)} key={x} className="quick-row">{x}<Icon name="chevron" size={13}/></button>)}</div></Card>
  </div></Panel><Panel title="公共信息"><div className="p-3"><div className="info-grid table-head"><span>信息标题</span><span>信息类型</span><span>发布日期</span></div>{dashboardNotices.map(n => <button key={n[0]} onClick={() => { setSelectedNotice(n); navigate("information-detail") }} className="info-grid table-row"><span>{n[0]}</span><span className="muted">{n[1]}</span><span className="muted">{n[2]}</span></button>)}<button onClick={() => navigate("information")} className="link mt-2 ml-auto block">查看更多 →</button></div></Panel></section>
    <section className="space-y-5"><Panel title="任务中心"><div className="flex p-3"><aside className="w-[100px] shrink-0 rounded-l-lg bg-[#5265a6] p-2 text-white">{["待办", "已办", "跟踪", "完成"].map(x => <button key={x} onClick={() => { setTaskTab(x); if (x === "已办") navigate("done") }} className={`w-full rounded-md py-3 text-sm ${taskTab === x ? "bg-[#7487c4] shadow-inner" : "hover:bg-white/10"}`}>{x}</button>)}</aside><div className="min-w-0 flex-1 rounded-r-lg bg-white p-4"><div className="mb-2 flex items-center justify-between"><h3 className="card-title">当前待办事项</h3><span className="status warning">{todos.length} 项</span></div><div className="space-y-2">{todos.slice(0, 5).map(item => <button key={item.id} onClick={() => openTodo(item)} className="todo-row"><span className="truncate">{item.title}</span><span className={item.date.startsWith("今天") ? "text-[#d77631]" : "muted"}>{item.date.replace(/ .*/, "")}</span><Icon name="chevron" size={14}/></button>)}{todos.length === 0 && <Empty text="当前没有待办事项" />}</div><button onClick={() => navigate("todo")} className="link mt-3 ml-auto block">查看全部 →</button></div></div></Panel>
      <Panel title="智慧空间"><div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-5">{[["模型引擎","layers"],["建设引擎","gear"],["组织权限","user"],["门户引擎","squares"],["内容引擎","file"],["授权手册","book"],["制度查询","search"],["移动引擎","bell"],["日志中心","file"],["系统安全","shield"]].map(([label, icon]) => <button key={label} onClick={() => openFeature(label)} className="feature-tile"><span><Icon name={icon as IconName} size={17}/></span>{label}</button>)}</div><div className="mx-3 mb-3 flex flex-wrap justify-between gap-2 rounded-lg bg-[#e1ebfa] px-6 py-2.5 text-xs"><button onClick={() => openFeature("全局设置")} className="hover:underline">全局设置：<b className="text-[#27805f]">正常</b></button><button onClick={() => navigate("status")} className="hover:underline">系统状态：<b className="text-[#27805f]">正常</b></button></div></Panel></section></main>
}

function DigitalLibraryMini({ onOpen }: { onOpen: () => void }) { return <Card title="数字化库"><div className="space-y-3"><p className="muted">查看各模型数字化库及已经确认入库的运行记录。</p><button onClick={onOpen} className="btn-secondary w-full"><Icon name="layers" size={15}/>进入数字化库</button></div></Card> }

function Workspace({ title, onBack, onHome, children }: { title: string; onBack: () => void; onHome: () => void; children: React.ReactNode }) { return <main className="p-4 md:p-6"><div className="mx-auto max-w-[1460px]"><div className="mb-5 flex items-center gap-2 text-sm"><button onClick={onHome} className="breadcrumb"><Icon name="home" size={15}/>驾驶舱</button><Icon name="chevron" size={13}/><span className="font-medium">{title}</span></div><section className="workspace"><div className="workspace-head"><button onClick={onBack} className="back-button"><Icon name="back" size={18}/>返回</button><h2>{title}</h2></div><div className="p-5 md:p-7">{children}</div></section></div></main> }
function Models({ onSelect }: { onSelect: (m: Model) => void }) {
  const [term, setTerm] = useState("")
  const [category, setCategory] = useState("全部分类")
  const [items, setItems] = useState<Model[]>(modelList)
  useEffect(() => {
    apiFetch<{ models: Array<{ name: string; category: string; description: string }> }>("/api/models").then(data => {
      const remote = data.models.map(m => [m.name, m.category, m.description] as Model)
      setItems(remote.length ? remote : modelList)
    }).catch(() => undefined)
  }, [])
  const filtered = items.filter(m => (m[0].includes(term) || m[1].includes(term)) && (category === "全部分类" || m[1] === category))
  return <>
    <div className="toolbar"><div className="search-box"><Icon name="search" size={17}/><input value={term} onChange={e => setTerm(e.target.value)} placeholder="搜索模型名称或类型"/></div><select value={category} onChange={e => setCategory(e.target.value)} className="select"><option>全部分类</option><option>请休假管理</option><option>会议管理</option></select></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(m => <button key={m[0]} onClick={() => onSelect(m)} className={`model-card model-card-compact ${m[0] === leaveModel[0] ? "leave-model-card" : ""}`}><span className="model-icon"><Icon name={m[0] === leaveModel[0] ? "clock" : "layers"}/></span><span className={`status ${m[0] === leaveModel[0] ? "status-accent" : ""}`}>{m[1]}</span><h3>{m[0]}</h3><span className="link">进入并发起 →</span></button>)}</div>
    {filtered.length === 0 && <Empty text="没有匹配的模型"/>}
  </>
}

function leaveDays(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 0
  const start = new Date(`${startDate}T00:00:00`).getTime()
  const end = new Date(`${endDate}T00:00:00`).getTime()
  return end >= start ? Math.floor((end - start) / 86400000) + 1 : 0
}

function runtimeFieldVisible(field: ModelField, values: Record<string, unknown>) {
  if (field.permissions?.visible === false) return false
  const rule = field.visibleWhen
  if (!rule?.fieldKey) return true
  const actual = values[rule.fieldKey]
  if (rule.operator === "notEmpty") return actual !== undefined && actual !== null && String(actual).trim() !== ""
  if (rule.operator === "contains") return String(actual ?? "").includes(String(rule.value ?? ""))
  if (rule.operator === "neq") return String(actual ?? "") !== String(rule.value ?? "")
  return String(actual ?? "") === String(rule.value ?? "")
}

function RuntimeSubformField({ field, value, onChange, disabled }: { field: ModelField; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  const rows = Array.isArray(value) ? value as Array<Record<string, unknown>> : []
  const subFields = field.subFields ?? []
  const rowStyle = { gridTemplateColumns: `repeat(${Math.max(1, subFields.length)}, minmax(120px,1fr)) 34px` }
  const updateCell = (rowIndex: number, key: string, nextValue: unknown) => onChange(rows.map((row, index) => index === rowIndex ? { ...row, [key]: nextValue } : row))
  return <div className="runtime-subform"><div className="runtime-subform-head" style={rowStyle}>{subFields.map(sub => <b key={sub.id}>{sub.label}{sub.required ? " *" : ""}</b>)}<i/></div>{rows.map((row, rowIndex) => <div className="runtime-subform-row" style={rowStyle} key={rowIndex}>{subFields.map(sub => <input key={sub.id} disabled={disabled} type={sub.type === "number" ? "number" : sub.type === "date" ? "date" : "text"} value={String(row[sub.key] ?? "")} onChange={event => updateCell(rowIndex, sub.key, event.target.value)}/>)}<button type="button" disabled={disabled} onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}>×</button></div>)}<button type="button" disabled={disabled} className="runtime-subform-add" onClick={() => onChange([...rows, Object.fromEntries(subFields.map(sub => [sub.key, ""]))])}>＋ 添加一行</button></div>
}

function RuntimeModelField({ field, value, onChange, style, optionsOverride }: { field: ModelField; value: unknown; onChange: (value: unknown) => void; style?: React.CSSProperties; optionsOverride?: string[] }) {
  if (field.type === "section") return <div className="runtime-form-section" style={style}><b>{field.label}</b>{field.description && <span>{field.description}</span>}</div>
  const disabled = field.readonly || field.permissions?.editable === false
  const title = field.label + (field.required ? " *" : "")
  const common = <><span className="runtime-field-title">{title}</span>{field.description && <small className="muted">{field.description}</small>}</>
  if (field.type === "boolean") return <label className="runtime-model-field" style={style}>{common}<span className="runtime-boolean"><input type="checkbox" disabled={disabled} checked={value === true || String(value) === "是" || String(value) === "true"} onChange={event => onChange(event.target.checked)}/><b>{value === true || String(value) === "是" || String(value) === "true" ? "是" : "否"}</b></span></label>
  if (field.type === "select" || field.type === "radio" || field.type === "dataSelect") return <label className="runtime-model-field" style={style}>{common}<select disabled={disabled} value={String(value ?? "")} onChange={event => onChange(event.target.value)}><option value="">请选择</option>{(optionsOverride ?? field.options ?? []).map(option => <option key={option}>{option}</option>)}</select></label>
  if (field.type === "checkbox" || field.type === "dataMultiSelect") { const current = Array.isArray(value) ? value.map(String) : []; return <label className="runtime-model-field" style={style}>{common}<div className="runtime-checkboxes">{(optionsOverride ?? field.options ?? []).map(option => <span key={option}><input type="checkbox" disabled={disabled} checked={current.includes(option)} onChange={event => onChange(event.target.checked ? [...current, option] : current.filter(item => item !== option))}/>{option}</span>)}</div></label> }
  if (field.type === "textarea") return <label className="runtime-model-field" style={style}>{common}<textarea disabled={disabled} rows={4} value={String(value ?? "")} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || "请输入" + field.label}/></label>
  if (field.type === "subform") return <label className="runtime-model-field runtime-model-subform" style={style}>{common}<RuntimeSubformField field={field} value={value} onChange={onChange} disabled={disabled}/></label>
  return <label className="runtime-model-field" style={style}>{common}<input disabled={disabled} type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"} value={String(value ?? "")} min={field.type === "number" && field.min !== undefined ? field.min : undefined} max={field.type === "number" && field.max !== undefined ? field.max : undefined} minLength={field.minLength} maxLength={field.maxLength} pattern={field.pattern} onChange={event => onChange(event.target.value)} placeholder={field.placeholder || (field.type === "user" ? "请选择人员" : field.type === "department" ? "请选择部门" : "请输入" + field.label)}/></label>
}

function ModelDetail({ model, requester, requesterDepartment, onStart }: { model: Model; requester: string; requesterDepartment: string; onStart: (request?: LeaveRequest, run?: { modelName: string; values: Record<string, unknown> }) => Promise<void> | void }) {
  const fallback = modelDefinitions[model[0]] ?? modelDefinitions[leaveModel[0]]
  const [runtimeProject, setRuntimeProject] = useState<any>(null)
  const [loadingDefinition, setLoadingDefinition] = useState(true)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, string[]>>({})
  useEffect(() => {
    setRuntimeProject(null); setValues({}); setLoadingDefinition(true); setError("")
    apiFetch<{ project: any }>(`/api/model-definition?name=${encodeURIComponent(model[0])}`).then(({ project }) => {
      setRuntimeProject(project)
      const defaults: Record<string, unknown> = {}
      for (const field of (project.design?.fields ?? [])) {
        if (field.defaultValue !== undefined) defaults[field.key] = field.defaultValue
        if (field.source === "当前用户" || field.sourceMode === "current_user") defaults[field.key] = requester
        if (field.key === "department" && requesterDepartment && (field.type === "department" || field.sourceMode === "library_fill")) defaults[field.key] = requesterDepartment
      }
      setValues(defaults)
    }).catch(() => undefined).finally(() => setLoadingDefinition(false))
  }, [model[0], requester, requesterDepartment])
  const fields: ModelField[] = runtimeProject?.design?.fields ?? fallback.fields
  const config = runtimeProject?.configuration ?? {}
  const design = runtimeProject?.design ?? {}
  const manualStart = (config.startModes ?? runtimeProject?.suggestion?.startModes ?? ["manual"]).includes("manual")
  const updateValue = (key: string, value: unknown) => setValues(items => ({ ...items, [key]: value }))
  useEffect(() => {
    let cancelled = false
    const runLinkages = async () => {
      for (const field of fields) {
        const linkage = field.linkage
        const sourceDigitalId = linkage?.sourceDigitalId || linkage?.sourceField
        if (!(linkage?.sourceLibraryId || linkage?.sourceLibrary) || !sourceDigitalId) continue
        const triggerValue = linkage.triggerFieldKey ? values[linkage.triggerFieldKey] : undefined
        if (linkage.triggerFieldKey && (triggerValue === undefined || triggerValue === null || String(triggerValue).trim() === "")) {
          continue
        }
        const params = new URLSearchParams({ sourceDigitalId, mode: linkage.mode ?? (field.sourceMode === "library_fill" ? "fill" : "options") })
        if (linkage.sourceLibraryId) params.set("libraryId", linkage.sourceLibraryId)
        else if (linkage.sourceLibrary) params.set("library", linkage.sourceLibrary)
        const matchDigitalId = linkage.matchDigitalId || linkage.matchField
        if (matchDigitalId) params.set("matchDigitalId", matchDigitalId)
        if (triggerValue !== undefined && triggerValue !== null) params.set("triggerValue", String(triggerValue))
        try {
          const result = await apiFetch<{ value?: unknown; options?: string[]; matched: number }>(`/api/digital-library/lookup?${params.toString()}`)
          if (cancelled) return
          if ((linkage.mode ?? (field.sourceMode === "library_fill" ? "fill" : "options")) === "options") setDynamicOptions(old => ({ ...old, [field.key]: result.options ?? [] }))
          else if (result.value !== undefined && result.value !== null) setValues(old => old[field.key] === result.value ? old : ({ ...old, [field.key]: result.value }))
        } catch {
          // 发起页面不展示数据联动实现状态；提交时仍按字段必填规则校验。
        }
      }
    }
    void runLinkages()
    return () => { cancelled = true }
  }, [runtimeProject?.id, fields, values])
  const startKey = fields.find(field => field.key === "startDate")?.key
  const endKey = fields.find(field => field.key === "endDate")?.key
  const days = startKey && endKey ? leaveDays(String(values[startKey] ?? ""), String(values[endKey] ?? "")) : 0
  const submit = async () => {
    const visibleFields = fields.filter(field => runtimeFieldVisible(field, values))
    const missing = visibleFields.find(field => field.type !== "section" && field.required && (field.type === "subform" ? !Array.isArray(values[field.key]) || (values[field.key] as unknown[]).length === 0 : !String(values[field.key] ?? "").trim()))
    if (missing) return setError("请填写" + missing.label)
    if (startKey && endKey && values[startKey] && values[endKey] && days <= 0) return setError("结束日期不能早于开始日期")
    setError(""); setSubmitting(true)
    try { await onStart(undefined, { modelName: model[0], values }) } catch (e) { setError(e instanceof Error ? e.message : "发起失败") } finally { setSubmitting(false) }
  }
  return <div className="runtime-entry">
    <div className="runtime-entry-head"><span className="status">{model[1]}</span><h3 className="detail-title">{model[0]}</h3></div>
    <div className={`runtime-form-grid runtime-entry-form label-${design.formSettings?.labelPosition === "left" ? "left" : "top"}`} style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(4, Number(design.formSettings?.columns ?? 2)))}, minmax(0,1fr))` }}>{fields.filter(field => runtimeFieldVisible(field, values)).map(field => { const columns = Math.max(1, Math.min(4, Number(design.formSettings?.columns ?? 2))); const fraction = Math.max(1, Math.min(columns, Math.round((Number(field.width ?? (columns === 1 ? 12 : 12 / columns)) / 12) * columns))); return <RuntimeModelField key={field.id} field={field} value={values[field.key]} optionsOverride={dynamicOptions[field.key]} onChange={value => updateValue(field.key, value)} style={{ gridColumn: field.type === "section" || field.type === "subform" ? "1 / -1" : `span ${fraction}` }}/>} )}</div>
    {error && <p className="form-error mt-4">{error}</p>}
    <div className="runtime-submit-bar"><button onClick={() => void submit()} disabled={submitting || loadingDefinition || !manualStart} className="btn-primary">{submitting ? "正在提交…" : !manualStart ? "该模型仅由系统触发" : (design.formSettings?.submitText || "提交")}</button></div>
  </div>
}
function TodoTable({ items, openTodo }: { items: typeof initialTodos; openTodo: (x: typeof initialTodos[number]) => void }) { return <div className="table-wrap"><div className="data-table todo-cols table-head"><span>事项名称</span><span>所属模型</span><span>发起人</span><span>到达时间</span><span>状态</span><span>操作</span></div>{items.map(item => { const smart = parseSmartTodoContent(item); return <button key={item.id} onClick={() => openTodo(item)} className="data-table todo-cols table-row"><span>{item.title}</span><span>{item.model}</span><span>{item.sender}</span><span>{item.date}</span><span><em className="status warning">{item.status}</em></span><span className="link">{smart ? "查看" : "办理"}</span></button> })}{items.length === 0 && <Empty text="当前没有待办事项"/>}</div> }

type BusinessFieldView = { key:string; label:string; digitalId?:string; type?:string; order?:number }
type ApprovalTodoView = { sourceModelName: string; sourceFileName:string; currentStep: string; currentStepIndex: number; currentRole: string; currentRequirement:string; currentReminderRule:string; currentOutputField:string; approvalNodeEvidence:Record<string,unknown>; approvalComputationEvidence:Record<string,unknown>; approverCalculation:Record<string,unknown>[]; pathCalculation:Record<string,unknown>; route: string[]; businessFields:BusinessFieldView[]; businessData: Record<string, unknown>; approvalTotalSteps:number; approvalArrivedAt:string; approvalDueAt:string; approvalTimeoutHours:number; currentTimeoutValue:string; thresholdVariables:Record<string,unknown>[]; allowedActions:string[] }
type SmartTodoView = { sourceModelName: string; businessSourceModelName: string; businessFileName: string; businessDisplayFileName: string; businessDigitalId: string; associatedDigitalIds: string[]; approvalResult: string; smartDecision: string; triggeredModels: string[]; triggerError: string; businessData: Record<string, unknown> }
const businessFieldLabels: Record<string, string> = { applicant: "申请人", department: "所属部门", leaveType: "请假类型", startDate: "开始日期", endDate: "结束日期", days: "请假天数", reason: "请假事由", approvalContent: "申请内容", title: "事项名称", amount: "金额", meetingType: "会议类型", topicName: "议题名称", approvalTotalSteps:"审批总环节", approvalCurrentStep:"当前审批环节", approvalCurrentApprover:"当前审批人", approvalOpinion:"审批意见", approvalTime:"审批时间", approvalResultPdf:"审批结果文档引用", approvalAdministrativeLevel:"行政审批最终层级", approvalTechnicalLevel:"技术审查最终层级", approvalTimeoutHours:"审批时限", approvalModelDesignSource:"审批设计来源" }
const preferredBusinessKeys = ["applicant", "department", "leaveType", "startDate", "endDate", "days", "reason", "approvalContent"]
function parseApprovalTodoContent(item: typeof initialTodos[number]): ApprovalTodoView | null {
  const raw = "content" in item ? String(item.content ?? "").trim() : ""
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.type === "approval_task_v2" || parsed.type === "approval_task_v3") return {
      sourceModelName: String(parsed.sourceModelName ?? "业务事项"), sourceFileName:String(parsed.sourceFileName ?? ""), currentStep: String(parsed.currentStep ?? "审批"), currentStepIndex: Number(parsed.currentStepIndex ?? 0), currentRole: String(parsed.currentRole ?? ""),
      currentRequirement:String(parsed.currentRequirement ?? ""), currentReminderRule:String(parsed.currentReminderRule ?? ""), currentOutputField:String(parsed.currentOutputField ?? ""),
      approvalNodeEvidence:parsed.approvalNodeEvidence && typeof parsed.approvalNodeEvidence === "object" && !Array.isArray(parsed.approvalNodeEvidence) ? parsed.approvalNodeEvidence as Record<string,unknown> : {},
      approvalComputationEvidence:parsed.approvalComputationEvidence && typeof parsed.approvalComputationEvidence === "object" && !Array.isArray(parsed.approvalComputationEvidence) ? parsed.approvalComputationEvidence as Record<string,unknown> : {},
      approverCalculation:Array.isArray(parsed["审批人计算"]) ? parsed["审批人计算"].filter((value):value is Record<string,unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)) : [],
      pathCalculation:parsed["审批路径计算"] && typeof parsed["审批路径计算"] === "object" && !Array.isArray(parsed["审批路径计算"]) ? parsed["审批路径计算"] as Record<string,unknown> : {},
      route: Array.isArray(parsed.route) ? parsed.route.map(String) : [],
      businessFields:Array.isArray(parsed.businessFields) ? parsed.businessFields.filter((value):value is Record<string,unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)).map((field,index)=>({key:String(field.key ?? ""),label:String(field.label ?? field.key ?? "字段"),digitalId:String(field.digitalId ?? "") || undefined,type:String(field.type ?? "") || undefined,order:Number(field.order ?? index)})).filter(field=>field.key) : [],
      businessData: parsed.businessData && typeof parsed.businessData === "object" && !Array.isArray(parsed.businessData) ? parsed.businessData as Record<string, unknown> : {},
      approvalTotalSteps:Number(parsed.approvalTotalSteps ?? (Array.isArray(parsed.route) ? parsed.route.length : 0)), approvalArrivedAt:String(parsed.approvalArrivedAt ?? ""), approvalDueAt:String(parsed.approvalDueAt ?? ""), approvalTimeoutHours:Number(parsed.approvalTimeoutHours ?? 0), currentTimeoutValue:String(parsed.currentTimeoutValue ?? ""), thresholdVariables:Array.isArray(parsed.thresholdVariables) ? parsed.thresholdVariables.filter((value): value is Record<string,unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value)) : [], allowedActions:Array.isArray(parsed.allowedActions) ? parsed.allowedActions.map(String).filter(Boolean) : ["同意","不同意","退回修改"],
    }
  } catch { /* 兼容升级前生成的待办内容 */ }
  const findLine = (label: string) => raw.split(/\r?\n/).find(line => line.startsWith(`${label}：`))?.slice(label.length + 1).trim() ?? ""
  const businessLine = findLine("业务数据")
  if (!businessLine) return null
  let businessData: Record<string, unknown> = {}
  try { const parsed = JSON.parse(businessLine); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) businessData = parsed as Record<string, unknown> } catch { /* ignore */ }
  const route = findLine("审批路线").split(/\s*→\s*/).filter(Boolean)
  const currentStep = findLine("当前审批环节") || route[0] || "审批"
  return { sourceModelName: findLine("前序模型") || "业务事项",sourceFileName:"", currentStep, currentStepIndex: Math.max(0, route.indexOf(currentStep)), currentRole: "",currentRequirement:"",currentReminderRule:"",currentOutputField:"",approvalNodeEvidence:{},approvalComputationEvidence:{},approverCalculation:[],pathCalculation:{}, route, businessFields:[],businessData, approvalTotalSteps:route.length, approvalArrivedAt:"", approvalDueAt:"", approvalTimeoutHours:0, currentTimeoutValue:"", thresholdVariables:[], allowedActions:["同意","不同意","退回修改"] }
}

function parseSmartTodoContent(item: typeof initialTodos[number]): SmartTodoView | null {
  const raw = "content" in item ? String(item.content ?? "").trim() : ""
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!(["smart_result_v1", "smart_result_v2", "smart_result_v3"] as unknown[]).includes(parsed.type)) return null
    const associatedDigitalIds = Array.isArray(parsed.associatedDigitalIds) ? parsed.associatedDigitalIds.map(String).filter(value => /^(?:5013\d{15}|\d{16})$/.test(value)) : []
    const businessSourceModelName = String(parsed.businessSourceModelName ?? "业务事项")
    return {
      sourceModelName: String(parsed.sourceModelName ?? "审批模型"),
      businessSourceModelName,
      businessFileName: String(parsed.businessFileName ?? parsed.sourceFileName ?? ""),
      businessDisplayFileName: String(parsed.businessDisplayFileName ?? parsed.sourceDisplayFileName ?? ""),
      businessDigitalId: String(parsed.businessDigitalId ?? parsed.sourceDigitalId ?? ""),
      associatedDigitalIds,
      approvalResult: String(parsed.approvalResult ?? ""),
      smartDecision: String(parsed.smartDecision ?? (associatedDigitalIds.length ? "已匹配后续关联模型" : `本模型（${businessSourceModelName}）没有后续关联的模型`)),
      triggeredModels: Array.isArray(parsed.triggeredModels) ? parsed.triggeredModels.map(String) : [],
      triggerError: String(parsed.triggerError ?? ""),
      businessData: parsed.businessData && typeof parsed.businessData === "object" && !Array.isArray(parsed.businessData) ? parsed.businessData as Record<string, unknown> : {},
    }
  } catch { return null }
}
function businessValue(key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return "—"
  if (key === "days") return `${value} 天`
  if (typeof value === "boolean") return value ? "是" : "否"
  if (Array.isArray(value)) return value.map(String).join("、")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}
const approvalEvidenceLabels:Record<string,string> = {
  organizationName:"审批组织", organizationRank:"审批层级岗位", baseTarget:"基础审批目标", adjustedTarget:"最终审批目标",
  organizationRule:"组织路径规则", rule:"匹配规则", nodeConfig:"节点配置依据", nodeType:"节点类型", rank:"审批层级岗位",
  sourceModel:"来源业务模型", sourceModelCode:"来源业务模型数字化编码", baseAdministrativeTarget:"基础审批目标",
  adjustedAdministrativeTarget:"最终审批目标层级", baseTechnicalTarget:"基础技术业务审查目标层级", adjustedTechnicalTarget:"最终技术业务审查目标层级",
  matchedThresholds:"命中数字化标识阈值", applicant:"申请人", startDepartment:"申请人所在部门", organizationPath:"组织逐级路径",
  nodeRule:"节点计算规则", requirement:"审批要求", timeoutHours:"规定时限", reminderRule:"提醒规则", outputField:"输出要求",
}
function evidenceValueText(value:unknown):string {
  if (value === undefined || value === null || value === "") return "—"
  if (Array.isArray(value)) return value.map(item => typeof item === "object" && item !== null ? evidenceText(item as Record<string,unknown>) : String(item)).filter(Boolean).join("、")
  if (typeof value === "object") return evidenceText(value as Record<string,unknown>)
  return String(value)
}
function evidenceText(value: Record<string,unknown>) {
  return Object.entries(value).filter(([key,item]) => item !== undefined && item !== null && item !== "" && (approvalEvidenceLabels[key] || /[\u3400-\u9fff]/.test(key))).map(([key,item]) => `${approvalEvidenceLabels[key] ?? key}：${evidenceValueText(item)}`).join("；")
}
function businessEntries(data: Record<string, unknown>, fields: BusinessFieldView[] = []) {
  const hidden = new Set(["sourceModelName", "sourceFileName", "sourceDisplayFileName", "sourceDigitalId", "sourceRunId", "sourceInput", "sourceOutput", "businessSourceModelName", "businessFileName", "businessDisplayFileName", "businessDigitalId", "associatedDigitalIds", "approvalRoute", "approvalStatus", "approvalResult", "approvalProcess", "approvalBusinessContent", "approvalComputationEvidence"])
  const configured=fields.filter(field=>field.key && field.key in data).sort((a,b)=>Number(a.order ?? 0)-Number(b.order ?? 0))
  const configuredKeys=new Set(configured.map(field=>field.key))
  const result=configured.filter(field=>data[field.key] !== undefined && data[field.key] !== null && data[field.key] !== "").map(field=>({key:field.key,label:field.label || businessFieldLabels[field.key] || field.key,value:businessValue(field.key,data[field.key])}))
  const keys = [...preferredBusinessKeys.filter(key => key in data && !configuredKeys.has(key)), ...Object.keys(data).filter(key => !preferredBusinessKeys.includes(key) && !configuredKeys.has(key) && !hidden.has(key))]
  return [...result,...keys.filter((key, index) => keys.indexOf(key) === index && data[key] !== undefined && data[key] !== null && data[key] !== "").map(key => ({ key, label: businessFieldLabels[key] ?? key, value: businessValue(key, data[key]) }))]
}

function TodoDetail({ item, onFinish, onSave }: { item: typeof initialTodos[number]; onFinish: (r: string) => void; onSave: () => void }) {
  const smart = parseSmartTodoContent(item)
  if (smart) {
    const entries = businessEntries(smart.businessData)
    const applicant = String(smart.businessData.applicant ?? "—")
    const department = String(smart.businessData.department ?? "—")
    return <div className="detail-grid"><div><div className="flex flex-wrap items-center gap-3"><h3 className="detail-title !mt-0">{item.title}</h3><span className="status warning">{item.status}</span></div>
      <div className="meta-grid todo-meta-grid"><span>申请人<b>{applicant}</b></span><span>所属部门<b>{department}</b></span><span>当前环节<b>智选判断</b></span><span>到达时间<b>{item.date}</b></span></div>
      <h4 className="section-title">业务内容</h4><div className="business-detail-grid">{entries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{entries.length === 0 && <div className="business-empty">暂无可展示的业务字段</div>}</div>
      <h4 className="section-title">智选依据</h4><div className="business-detail-grid"><div><span>业务模型</span><b>{smart.businessSourceModelName}</b></div><div className="wide"><span>文件名</span><b className="font-mono text-xs">{smart.businessFileName || "—"}</b></div><div className="wide"><span>中文显示名称</span><b>{smart.businessDisplayFileName || "—"}</b></div><div><span>数字化标识</span><b className="font-mono text-xs">{smart.businessDigitalId || "—"}</b></div><div><span>关联数字化标识</span><b className="font-mono text-xs">{smart.associatedDigitalIds.length ? smart.associatedDigitalIds.join("、") : "无"}</b></div></div>
      <h4 className="section-title">智选结果</h4><div className="business-detail-grid"><div><span>审批结果</span><b>{smart.approvalResult || "—"}</b></div><div className="wide"><span>智选判断</span><b>{smart.smartDecision || `本模型（${smart.businessSourceModelName}）没有后续关联的模型`}</b></div><div className="wide"><span>后续关联模型</span><b>{smart.triggeredModels.length ? smart.triggeredModels.join(" → ") : "无"}</b></div>{smart.triggerError && <div className="wide"><span>触发状态</span><b className="text-[#bb4545]">{smart.triggerError}</b></div>}</div>
      <div className="mt-5 flex justify-end"><button onClick={() => onFinish("已查看")} className="btn-primary">确认已查看</button></div></div>
      <aside className="summary approval-summary"><h4>模型运行进度</h4><div className="approval-source"><span>业务来源</span><b>{smart.businessSourceModelName}</b></div><div className="approval-progress"><div className="done"><i>✓</i><span><b>{smart.sourceModelName}</b><small>已归档</small></span></div><div className="done"><i>✓</i><span><b>智选模型</b><small>已完成标识关联判断</small></span></div>{smart.triggeredModels.length ? smart.triggeredModels.map((name, index) => <div className="current" key={`${name}-${index}`}><i>{index + 3}</i><span><b>{name}</b><small>已触发</small></span></div>) : <div className="pending"><i>3</i><span><b>后续关联模型</b><small>未配置关联模型</small></span></div>}</div></aside></div>
  }
  const approval = parseApprovalTodoContent(item)
  const entries = approval ? businessEntries(approval.businessData, approval.businessFields) : []
  const applicant = approval ? String(approval.businessData.applicant ?? item.sender) : item.sender
  const department = approval ? String(approval.businessData.department ?? "—") : "—"
  return <div className="detail-grid"><div><div className="flex flex-wrap items-center gap-3"><h3 className="detail-title !mt-0">{item.title}</h3><span className="status warning">{item.status}</span></div>
    <div className="meta-grid todo-meta-grid"><span>发起人<b>{applicant}</b></span><span>所属部门<b>{department}</b></span><span>当前环节<b>{approval?.currentStep ?? item.model}</b></span><span>到达时间<b>{item.date}</b></span></div>
    <h4 className="section-title">业务内容</h4>
    {approval ? <div className="business-detail-grid">{entries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{entries.length === 0 && <div className="business-empty">暂无可展示的业务字段</div>}</div> : <div className="content-box whitespace-pre-line">{("content" in item ? String(item.content ?? "") : "") || "请核对本事项相关内容及附件，根据实际情况填写办理意见，并选择相应处理结果。"}</div>}
    {approval && <><h4 className="section-title">本环节办理信息</h4><div className="business-detail-grid"><div><span>规定时限</span><b>{approvalTimeoutDisplay(approval.currentTimeoutValue)}</b></div><div><span>提醒规则</span><b>{approval.currentReminderRule || "未配置"}</b></div><div><span>输出要求</span><b>{approval.currentOutputField || "审批/审查意见"}</b></div></div><h4 className="section-title">审批路径计算</h4><div className="business-detail-grid"><div className="wide"><span>正式审批路径</span><b>{approval.route.length ? approval.route.join(" → ") : approval.currentStep}</b></div><div><span>基础审批目标</span><b>{String(approval.pathCalculation["基础审批目标"] ?? approval.pathCalculation["基础审批目标层级"] ?? approval.approvalComputationEvidence.baseAdministrativeTarget ?? "—")}</b></div><div><span>最终审批目标</span><b>{String(approval.pathCalculation["最终审批目标"] ?? approval.pathCalculation["最终审批目标层级"] ?? approval.approvalComputationEvidence.adjustedAdministrativeTarget ?? "—")}</b></div>{approval.thresholdVariables.length > 0 && <div className="wide"><span>命中数字化标识阈值</span><b>{approval.thresholdVariables.map(value => `${String(value.thresholdType ?? "阈值")}：${String(value.actualValue ?? "—")} ≥ ${String(value.thresholdValue ?? "—")} → ${String(value.approvalLevel ?? "")}`).join("；")}</b></div>}</div><h4 className="section-title">审批人计算</h4><div className="business-detail-grid"><div><span>当前审批人</span><b>{String(approval.approverCalculation[approval.currentStepIndex]?.["审批人"] ?? approval.currentRole ?? "待匹配")}</b></div><div><span>审批组织</span><b>{String(approval.approverCalculation[approval.currentStepIndex]?.["审批组织"] ?? "按组织关系计算")}</b></div><div><span>审批层级/岗位</span><b>{String(approval.approverCalculation[approval.currentStepIndex]?.["审批层级岗位"] ?? approval.currentRole ?? "未配置")}</b></div></div></>}
    <h4 className="section-title">办理意见</h4><textarea className="input w-full" rows={5} placeholder="请输入办理意见"/><div className="mt-5 flex flex-wrap justify-end gap-3"><button onClick={onSave} className="btn-secondary">保存</button>{(approval?.allowedActions.length ? approval.allowedActions : ["同意","不同意","退回修改"]).map(action => <button key={action} onClick={() => onFinish(action)} className={action === "同意" ? "btn-primary" : action === "不同意" ? "btn-secondary text-[#bb4545]" : "btn-secondary text-[#b55a37]"}>{action}</button>)}</div></div>
    <aside className="summary approval-summary"><h4>审批路径</h4>{approval ? <><div className="approval-source"><span>业务来源</span><b>{approval.sourceModelName}</b></div><div className="approval-progress">{(approval.route.length ? approval.route : [approval.currentStep]).map((step, index) => <div key={`${step}-${index}`} className={index < approval.currentStepIndex ? "done" : index === approval.currentStepIndex ? "current" : "pending"}><i>{index < approval.currentStepIndex ? "✓" : index + 1}</i><span><b>{step}</b><small>{index < approval.currentStepIndex ? "已完成" : index === approval.currentStepIndex ? `${approval.currentRole ? `${approval.currentRole} · ` : ""}待办理` : "待流转"}</small></span></div>)}</div>{approval.approvalDueAt && <div className="approval-source"><span>当前环节到期</span><b>{approval.approvalDueAt.slice(0,19).replace("T"," ")}</b></div>}</> : <div className="timeline"><p><b>事项发起</b><span>{item.sender}</span></p><p><b>当前状态</b><span>{item.status} · {item.date}</span></p></div>}</aside></div>
}
type BusinessActivityContent = { rootRunId:string; fileName:string; displayFileName:string; digitalId:string; businessStatus:string; phase:string; input:Record<string,unknown>; output:Record<string,unknown>; approval:Record<string,unknown>|null; smart:Record<string,unknown>|null }
function parseBusinessActivityContent(item: DoneRecord): BusinessActivityContent | null {
  if (item.record_kind !== "cluster") return null
  try {
    const parsed=JSON.parse(String(item.content ?? "{}")) as Record<string,unknown>
    if (parsed.type !== "business_model_activity_v2") return null
    const object=(value:unknown)=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}
    return {
      rootRunId:String(parsed.rootRunId ?? ""),fileName:String(parsed.fileName ?? ""),displayFileName:String(parsed.displayFileName ?? ""),digitalId:String(parsed.digitalId ?? ""),businessStatus:String(parsed.businessStatus ?? item.status),phase:String(parsed.phase ?? item.result ?? "申请阶段"),
      input:object(parsed.input),output:object(parsed.output),approval:parsed.approval && typeof parsed.approval === "object" && !Array.isArray(parsed.approval) ? parsed.approval as Record<string,unknown> : null,smart:parsed.smart && typeof parsed.smart === "object" && !Array.isArray(parsed.smart) ? parsed.smart as Record<string,unknown> : null,
    }
  } catch { return null }
}
function phaseClass(phase:string) { return phase === "有效阶段" ? "success" : phase.includes("终止") || phase.includes("未生效") ? "danger" : "warning" }
function relatedModelStatus(value: unknown) {
  const raw=String(value ?? "").trim()
  if (["已归档","已完成","已办结"].includes(raw)) return "已完成"
  if (["待处理","待办理","运行中","审批中","处理中","已启动"].includes(raw)) return "运行中"
  if (["启动中","待启动"].includes(raw)) return "启动中"
  return raw || "已启动"
}
function relatedModelStatusClass(value: unknown) { return relatedModelStatus(value) === "已完成" ? "success" : "warning" }
function approvalTimeoutDisplay(value: unknown) {
  const raw=String(value ?? "").trim()
  if (!raw || raw === "0" || raw === "未配置" || /按.*配置|来自.*数字化库/.test(raw)) return "未配置"
  const cleaned=raw.replace(/（源资料未定义单位）/g, "").replace(/\s*(小时|工作日|天)$/g, "").trim()
  if (/[、,，;；]/.test(cleaned)) return "未配置"
  return /^\d+(?:\.\d+)?$/.test(cleaned) ? cleaned : "未配置"
}
function approvalElapsedDisplay(arrivedAt: unknown, handledAt: unknown) {
  const arrived=new Date(String(arrivedAt ?? ""))
  const handled=new Date(String(handledAt ?? ""))
  const arrivedMs=arrived.getTime()
  const handledMs=handled.getTime()
  if (!Number.isFinite(arrivedMs) || !Number.isFinite(handledMs) || handledMs < arrivedMs) return "—"
  let seconds=Math.floor((handledMs-arrivedMs)/1000)
  const days=Math.floor(seconds/86400); seconds%=86400
  const hours=Math.floor(seconds/3600); seconds%=3600
  const minutes=Math.floor(seconds/60); seconds%=60
  const parts:string[]=[]
  if (days) parts.push(`${days}天`)
  if (hours || days) parts.push(`${hours}小时`)
  if (minutes || hours || days) parts.push(`${minutes}分`)
  parts.push(`${seconds}秒`)
  return parts.join("")
}
function HandledTable({ items, onOpen }: { items: DoneRecord[]; onOpen: (x: DoneRecord) => void }) {
  const [expanded,setExpanded]=useState<Record<string,boolean>>({})
  return <div className="done-cluster-list"><div className="data-table handled-stage-cols table-head"><span>事项/文件名</span><span>所属模型</span><span>当前阶段</span><span>办理/发起时间</span><span>结果</span><span>操作</span></div>{items.map(item=>{
    const activity=parseBusinessActivityContent(item)
    if (!activity) return <button key={item.id} onClick={()=>onOpen(item)} className="data-table handled-stage-cols table-row"><span>{item.title}</span><span>{item.model}</span><span><em className="status">办理记录</em></span><span>{item.handled || item.date}</span><span><em className={`status ${item.result === "不同意" || item.result === "退回修改" ? "danger" : "success"}`}>{item.result}</em></span><span className="link">{item.record_kind === "approval_run" ? "查看审批模型" : "查看办理记录"}</span></button>
    const opened=Boolean(expanded[item.id])
    return <div key={item.id} className={`done-cluster-item ${opened ? "expanded" : ""}`}><div className="data-table handled-stage-cols table-row"><span className="cluster-file-cell"><button type="button" className={`cluster-expand-toggle ${opened ? "open" : ""}`} onClick={()=>setExpanded(current=>({...current,[item.id]:!opened}))} aria-label={opened ? "收起关联模型" : "展开关联模型"}><Icon name="chevron" size={13}/></button><span><b className="font-mono">{activity.fileName || item.title}</b>{activity.displayFileName && activity.displayFileName !== activity.fileName && <small>{activity.displayFileName}</small>}</span></span><span>{item.model}</span><span><em className={`status ${phaseClass(activity.phase)}`}>{activity.phase}</em></span><span>{item.handled || item.date}</span><span><em className="status success">业务模型已办结</em></span><span><button onClick={()=>onOpen(item)} className="link">查看业务模型</button></span></div>{opened && <div className="model-cluster-expand"><div className="cluster-model-list-head"><b>关联模型</b><small>点击模型直接查看该次模型本身</small></div><div className="cluster-model-list">{activity.approval ? <button className="cluster-model-entry" onClick={()=>onOpen(completedRelatedRecord(item,activity.approval!,"approval"))}><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small className="font-mono">{String(activity.approval.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(activity.approval.status)}`}>{relatedModelStatus(activity.approval.status)}</span><span className="cluster-model-open">查看审批模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small>业务模型数字化库触发后生成审批模型文件</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}{activity.smart ? <button className="cluster-model-entry" onClick={()=>onOpen(completedRelatedRecord(item,activity.smart!,"smart"))}><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small className="font-mono">{String(activity.smart.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(activity.smart.status)}`}>{relatedModelStatus(activity.smart.status)}</span><span className="cluster-model-open">查看智选模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small>审批模型归档后由数字化库触发</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}</div></div>}</div>
  })}{items.length === 0 && <Empty text="当前没有已办记录"/>}</div>
}
function HandledDetail({ item, onOpenModel }: { item?: DoneRecord; onOpenModel:(x:DoneRecord)=>void }) {
  if (!item) return <Empty text="未找到已办记录"/>
  if (item.record_kind === "approval_run" || item.record_kind === "launched") return <DoneDetail item={item}/>
  const activity=parseBusinessActivityContent(item)
  if (activity) {
    const entries=businessEntries({...activity.input,...activity.output})
    return <div className="cluster-detail-page"><div className="cluster-detail-head"><div><span className="status status-accent">业务模型</span><h3 className="detail-title">{activity.displayFileName || item.title}</h3><p className="font-mono">{activity.fileName || "—"}</p></div><em className={`status ${phaseClass(activity.phase)}`}>{activity.phase}</em></div><div className="meta-grid"><span>所属模型<b>{item.model}</b></span><span>发起人<b>{item.sender}</b></span><span>业务模型办结时间<b>{item.handled || item.date}</b></span><span>当前阶段<b>{activity.phase}</b></span></div><h4 className="section-title">业务模型内容</h4><div className="business-detail-grid">{entries.map(entry=><div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{entries.length === 0 && <div className="business-empty">业务模型已归档，暂无可展示的业务字段</div>}</div><h4 className="section-title">阶段说明</h4><div className="content-box">{activity.phase === "有效阶段" ? "审批模型已经完成并确认业务生效。" : activity.phase.includes("终止") ? "审批模型已经终止或未通过，本业务未进入有效阶段。" : "业务模型已经完成并进入申请阶段，审批模型仍在运行或等待形成最终审批结论。"}</div><h4 className="section-title">关联模型</h4><div className="cluster-model-list">{activity.approval ? <button className="cluster-model-entry" onClick={()=>onOpenModel(completedRelatedRecord(item,activity.approval!,"approval"))}><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small className="font-mono">{String(activity.approval.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(activity.approval.status)}`}>{relatedModelStatus(activity.approval.status)}</span><span className="cluster-model-open">查看审批模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small>业务模型数字化库触发后生成审批模型文件</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}{activity.smart ? <button className="cluster-model-entry" onClick={()=>onOpenModel(completedRelatedRecord(item,activity.smart!,"smart"))}><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small className="font-mono">{String(activity.smart.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(activity.smart.status)}`}>{relatedModelStatus(activity.smart.status)}</span><span className="cluster-model-open">查看智选模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small>审批模型归档后由数字化库触发</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}</div></div>
  }
  let content:Record<string,unknown>={}
  try { const parsed=JSON.parse(String(item.content ?? "{}")); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) content=parsed as Record<string,unknown> } catch { /* historical text content */ }
  const businessData=content.businessData && typeof content.businessData === "object" && !Array.isArray(content.businessData) ? content.businessData as Record<string,unknown> : {}
  const fields=Array.isArray(content.businessFields) ? content.businessFields.filter((value):value is Record<string,unknown>=>Boolean(value)&&typeof value === "object"&&!Array.isArray(value)).map((field,index)=>({key:String(field.key ?? ""),label:String(field.label ?? field.key ?? "字段"),order:Number(field.order ?? index)})).filter(field=>field.key) : []
  const entries=businessEntries(businessData,fields)
  return <div><h3 className="detail-title !mt-0">{item.title}</h3><div className="meta-grid"><span>所属模型<b>{item.model}</b></span><span>办理来源<b>{item.sender}</b></span><span>办理时间<b>{item.handled || item.date}</b></span><span>办理结果<b className="text-[#27805f]">{item.result}</b></span></div>{entries.length > 0 && <><h4 className="section-title">办理时业务内容</h4><div className="business-detail-grid">{entries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}</div></>}<h4 className="section-title">办理记录</h4><div className="business-detail-grid"><div><span>当前环节</span><b>{String(content.currentStep ?? "—")}</b></div><div><span>审批路径</span><b>{Array.isArray(content.route) ? content.route.map(String).join(" → ") : "—"}</b></div><div><span>到达时间</span><b>{String(content.approvalArrivedAt ?? "—").slice(0,19).replace("T"," ")}</b></div><div><span>耗时</span><b>{approvalElapsedDisplay(content.approvalArrivedAt, item.handled_at ?? item.handled)}</b></div></div></div>
}

type CompletedModelContent = { type:string; runId:string; runKind:string; fileName:string; displayFileName:string; digitalId:string; sourceRunId:string; sourceModelName:string; input:Record<string,unknown>; output:Record<string,unknown>; status:string; phase:string; approval:Record<string,unknown>|null; smart:Record<string,unknown>|null }
function parseCompletedModelContent(item: DoneRecord): CompletedModelContent | null {
  if (item.record_kind !== "completed_run") return null
  try {
    const parsed=JSON.parse(String(item.content ?? "{}")) as Record<string,unknown>
    if (parsed.type !== "completed_model_v1") return null
    const object=(value:unknown)=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}
    return { type:"completed_model_v1", runId:String(parsed.runId ?? item.id), runKind:String(parsed.runKind ?? "business"), fileName:String(parsed.fileName ?? ""), displayFileName:String(parsed.displayFileName ?? ""), digitalId:String(parsed.digitalId ?? ""), sourceRunId:String(parsed.sourceRunId ?? ""), sourceModelName:String(parsed.sourceModelName ?? ""), input:object(parsed.input), output:object(parsed.output), status:String(parsed.status ?? item.status), phase:String(parsed.phase ?? ""), approval:parsed.approval && typeof parsed.approval === "object" && !Array.isArray(parsed.approval) ? parsed.approval as Record<string,unknown> : null, smart:parsed.smart && typeof parsed.smart === "object" && !Array.isArray(parsed.smart) ? parsed.smart as Record<string,unknown> : null }
  } catch { return null }
}
function completedRelatedRecord(parent: DoneRecord, raw: Record<string,unknown>, kind:"approval"|"smart"): DoneRecord {
  const object=(value:unknown)=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}
  const fileName=String(raw.fileName ?? "")
  const displayFileName=String(raw.displayFileName ?? "")
  const status=String(raw.status ?? "运行中")
  return {
    ...parent,
    id:`${parent.id}:${kind}:${String(raw.runId ?? fileName)}`,
    title:displayFileName || fileName || (kind === "approval" ? "审批模型" : "智选模型"),
    model:kind === "approval" ? "审批模型" : "智选模型",
    status,
    result:status === "已归档" ? "已办结" : status,
    record_kind:kind === "approval" ? "approval_run" : "launched",
    content:JSON.stringify({ type:"model_run", runKind:kind, runId:String(raw.runId ?? ""), fileName, displayFileName, digitalId:String(raw.digitalId ?? ""), sourceRunId:String(raw.sourceRunId ?? ""), sourceModelName:String(raw.sourceModelName ?? (kind === "approval" ? parent.model : "审批模型")), status, input:object(raw.input), output:object(raw.output) }),
  }
}
function CompletedTable({ items, onOpen }: { items: DoneRecord[]; onOpen:(x:DoneRecord)=>void }) {
  return <div className="table-wrap"><div className="data-table completed-stage-cols table-head"><span>文件名</span><span>所属模型</span><span>当前阶段</span><span>完成时间</span><span>状态</span><span>操作</span></div>{items.map(item => { const run=parseCompletedModelContent(item); const stage=run?.runKind === "business" ? (run.phase || "申请阶段") : "模型办结"; return <button key={item.id} onClick={() => onOpen(item)} className="data-table completed-stage-cols table-row"><span className="completed-file-cell"><b className="font-mono">{run?.fileName || item.title}</b>{run?.displayFileName && run.displayFileName !== run.fileName && <small>{run.displayFileName}</small>}</span><span>{item.model}</span><span><em className={`status ${run?.runKind === "business" ? phaseClass(stage) : "success"}`}>{stage}</em></span><span>{item.handled || item.date}</span><span><em className="status success">已办结</em></span><span className="link">查看模型</span></button> })}{items.length === 0 && <Empty text="当前没有办结模型"/>}</div>
}

function CompletedDetail({ item, onOpenModel }: { item?:DoneRecord; onOpenModel:(x:DoneRecord)=>void }) {
  if (!item) return <Empty text="未找到办结模型"/>
  const completed=parseCompletedModelContent(item)
  if (!completed) return <DoneDetail item={item}/>
  if (completed.runKind === "approval" || completed.runKind === "smart") {
    return <DoneDetail item={{...item,record_kind:completed.runKind === "approval" ? "approval_run" : "launched",content:JSON.stringify({type:"model_run",runKind:completed.runKind,runId:completed.runId,fileName:completed.fileName,displayFileName:completed.displayFileName,digitalId:completed.digitalId,sourceRunId:completed.sourceRunId,sourceModelName:completed.sourceModelName,status:completed.status,input:completed.input,output:completed.output})}}/>
  }
  const entries=businessEntries({...completed.input,...completed.output})
  const phase=completed.phase || "申请阶段"
  return <div className="cluster-detail-page"><div className="cluster-detail-head"><div><span className="status status-accent">{item.model}</span><h3 className="detail-title">{completed.displayFileName || item.title}</h3><p className="font-mono">{completed.fileName || "—"}</p></div><em className={`status ${phaseClass(phase)}`}>{phase}</em></div><div className="meta-grid"><span>所属模型<b>{item.model}</b></span><span>模型所有人<b>{item.sender}</b></span><span>办结时间<b>{item.handled || item.date}</b></span><span>当前阶段<b>{phase}</b></span><span>数字化标识<b className="font-mono text-xs">{completed.digitalId || "—"}</b></span></div><h4 className="section-title">模型结果</h4><div className="business-detail-grid">{entries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{entries.length === 0 && <div className="business-empty">本模型已完成并形成归档结果</div>}</div><h4 className="section-title">关联模型</h4><div className="cluster-model-list">{completed.approval ? <button className="cluster-model-entry" onClick={() => onOpenModel(completedRelatedRecord(item,completed.approval!,"approval"))}><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small className="font-mono">{String(completed.approval.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(completed.approval.status)}`}>{relatedModelStatus(completed.approval.status)}</span><span className="cluster-model-open">查看审批模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind approval">审批</span><span className="cluster-model-main"><b>审批模型</b><small>尚未形成审批模型运行文件</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}{completed.smart ? <button className="cluster-model-entry" onClick={() => onOpenModel(completedRelatedRecord(item,completed.smart!,"smart"))}><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small className="font-mono">{String(completed.smart.fileName ?? "—")}</small></span><span className={`status ${relatedModelStatusClass(completed.smart.status)}`}>{relatedModelStatus(completed.smart.status)}</span><span className="cluster-model-open">查看智选模型 <Icon name="chevron" size={12}/></span></button> : <div className="cluster-model-entry unavailable"><span className="cluster-model-kind smart">智选</span><span className="cluster-model-main"><b>智选模型</b><small>审批模型办结入库后由数字化库触发</small></span><span className="status">未启动</span><span className="cluster-model-open muted">暂无模型记录</span></div>}</div></div>
}

function parseRunDoneContent(item: DoneRecord) {
  if (!(["launched", "approval_run"] as Array<DoneRecord["record_kind"]>).includes(item.record_kind)) return null
  try {
    const parsed = JSON.parse(String(item.content ?? "")) as Record<string, unknown>
    if (parsed.type !== "model_run") return null
    const input = parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input) ? parsed.input as Record<string, unknown> : {}
    const output = parsed.output && typeof parsed.output === "object" && !Array.isArray(parsed.output) ? parsed.output as Record<string, unknown> : {}
    return { input, output, runId:String(parsed.runId ?? ""), fileName: String(parsed.fileName ?? ""), displayFileName:String(parsed.displayFileName ?? ""), digitalId: String(parsed.digitalId ?? ""), sourceRunId:String(parsed.sourceRunId ?? ""), sourceModelName: String(parsed.sourceModelName ?? input.sourceModelName ?? ""), runKind: String(parsed.runKind ?? (item.record_kind === "approval_run" ? "approval" : "manual")), status: String(parsed.status ?? item.result) }
  } catch { return null }
}
type RunDetailView = { id:string; modelName:string; ownerName:string; fileName:string; displayFileName:string; digitalId:string; status:string; sourceRunId:string; triggerMode:string; createdAt:string|null; completedAt:string|null }
type RunDigitalRecordView = { libraryName:string; digitalId:string; identifierValues:Record<string,unknown>; data:Record<string,unknown>; createdAt:string|null }
type SmartRunDetailPayload = { run:RunDetailView; sourceApproval:RunDetailView|null; businessRun:RunDetailView|null; smartDigitalRecord:RunDigitalRecordView|null; sourceApprovalDigitalRecord:RunDigitalRecordView|null; businessDigitalRecord:RunDigitalRecordView|null }
function SmartRunDetail({ item, snapshot }: { item:DoneRecord; snapshot:NonNullable<ReturnType<typeof parseRunDoneContent>> }) {
  const [detail,setDetail]=useState<SmartRunDetailPayload|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const runId=snapshot.runId
  useEffect(()=>{
    let cancelled=false
    if (!runId) { setDetail(null); setError("未找到本次智选模型运行记录"); setLoading(false); return ()=>{cancelled=true} }
    setLoading(true); setError("")
    apiFetch<{detail:SmartRunDetailPayload}>(`/api/model-runs/${encodeURIComponent(runId)}/detail`).then(result=>{ if (!cancelled) setDetail(result.detail) }).catch(()=>{ if (!cancelled) { setDetail(null); setError("未找到本次智选模型运行记录") } }).finally(()=>{ if (!cancelled) setLoading(false) })
    return ()=>{cancelled=true}
  },[runId])
  const object=(value:unknown)=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}
  const objectArray=(value:unknown)=>Array.isArray(value) ? value.filter((entry):entry is Record<string,unknown>=>Boolean(entry)&&typeof entry === "object"&&!Array.isArray(entry)) : []
  const text=(value:unknown,fallback="—")=>value === undefined || value === null || String(value).trim() === "" ? fallback : String(value)
  const listText=(value:unknown,separator="、",fallback="无")=>Array.isArray(value) ? (value.map(String).filter(Boolean).join(separator)||fallback) : text(value,fallback)
  const timeText=(value:unknown)=>value ? String(value).slice(0,19).replace("T"," ") : "—"
  const libraryBusinessData=(record:RunDigitalRecordView|null)=>{
    const data=object(record?.data)
    const nestedInput=object(data.input)
    const nestedOutput=object(data.output)
    const direct=Object.fromEntries(Object.entries(data).filter(([key])=>!["runId","fileName","displayFileName","digitalId","input","output","模型运行记录","模型文件名","中文显示文件名","数字化标识"].includes(key)))
    return {...nestedInput,...nestedOutput,...direct}
  }
  if (loading) return <div><h3 className="detail-title !mt-0">{item.title || snapshot.displayFileName || snapshot.fileName || "智选模型"}</h3><div className="content-box">正在读取本次智选模型数字化库记录…</div></div>
  if (!detail) return <div><h3 className="detail-title !mt-0">{item.title || snapshot.displayFileName || snapshot.fileName || "智选模型"}</h3><div className="meta-grid"><span>所属模型<b>智选模型</b></span><span>模型文件名<b className="font-mono text-xs">{snapshot.fileName || "—"}</b></span><span>来源模型<b>{snapshot.sourceModelName || "审批模型"}</b></span><span>运行标识<b className="font-mono text-xs">{runId || "—"}</b></span></div><h4 className="section-title">模型信息</h4><div className="content-box">{error || "未找到本次智选模型运行记录"}</div></div>
  const run=detail.run
  const approval=detail.sourceApproval
  const business=detail.businessRun
  const smartDigital=object(detail.smartDigitalRecord?.data)
  const approvalDigital=object(detail.sourceApprovalDigitalRecord?.data)
  const businessData=libraryBusinessData(detail.businessDigitalRecord)
  const businessContentEntries=businessEntries(businessData)
  const approvalResult=text(approvalDigital["审批结果"],"—")
  const sourceApprovalFile=text(approvalDigital["模型文件名"] ?? approval?.fileName,"—")
  const businessModelName=text(smartDigital["业务模型"] ?? business?.modelName,"—")
  const businessFileName=text(smartDigital["业务模型文件名"] ?? detail.businessDigitalRecord?.data?.["模型文件名"] ?? business?.fileName,"—")
  const businessDigitalId=text(smartDigital["业务数字化标识"] ?? detail.businessDigitalRecord?.digitalId ?? business?.digitalId,"—")
  const statisticsState=text(smartDigital["统计分析状态"],"未形成")
  const statisticsFile=text(smartDigital["统计分析模型文件名"],"—")
  const pendingRaw=smartDigital["待处理数字化标识集合"]
  const associatedRaw=smartDigital["有关联数字化标识集合"]
  const specialResult=text(smartDigital["特殊判断结果"],"未形成")
  const normalResult=text(smartDigital["正常关联判断结果"],"未形成")
  const triggeredRaw=smartDigital["关联模型集合"]
  const triggerDetails=objectArray(smartDigital["关联模型启动明细"])
  const identifierCounts=objectArray(smartDigital["各数字化标识有效数据条数"])
  const triggerCount=text(smartDigital["关联模型启动次数"],"0")
  const decision=text(smartDigital["智选结果"],"—")
  return <div><h3 className="detail-title !mt-0">{run.displayFileName || run.fileName || item.title || "智选模型"}</h3>
    <h4 className="section-title">模型信息</h4><div className="business-detail-grid"><div><span>所属模型</span><b>智选模型</b></div><div><span>模型状态</span><b>{text(run.status)}</b></div><div className="wide"><span>智选模型文件名</span><b className="font-mono text-xs">{text(run.fileName)}</b></div><div><span>完成/归档时间</span><b>{timeText(run.completedAt)}</b></div><div><span>来源审批模型</span><b>{approval?.modelName || "审批模型"}</b></div><div className="wide"><span>来源审批模型文件名</span><b className="font-mono text-xs">{sourceApprovalFile}</b></div></div>
    <h4 className="section-title">业务内容</h4><div className="business-detail-grid"><div><span>原业务模型</span><b>{businessModelName}</b></div><div className="wide"><span>原业务模型文件名</span><b className="font-mono text-xs">{businessFileName}</b></div><div><span>原业务数字化标识</span><b className="font-mono text-xs">{businessDigitalId}</b></div>{businessContentEntries.map(entry=><div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{businessContentEntries.length === 0 && <div className="wide business-empty">未找到原业务模型数字化库记录</div>}</div>
    <h4 className="section-title">审批结果</h4><div className="business-detail-grid"><div><span>审批结果</span><b>{approvalResult}</b></div><div className="wide"><span>审批模型文件名</span><b className="font-mono text-xs">{sourceApprovalFile}</b></div></div>
    <h4 className="section-title">统计分析</h4><div className="business-detail-grid"><div><span>统计分析状态</span><b>{statisticsState}</b></div><div className="wide"><span>统计分析模型文件名</span><b className="font-mono text-xs">{statisticsFile}</b></div></div>
    <h4 className="section-title">智选判断</h4><div className="business-detail-grid"><div className="wide"><span>待处理数字化标识集合</span><b className="font-mono text-xs">{listText(pendingRaw)}</b></div><div className="wide"><span>有关联数字化标识集合</span><b className="font-mono text-xs">{listText(associatedRaw)}</b></div><div><span>特殊判断结果</span><b>{specialResult}</b></div><div><span>正常关联判断结果</span><b>{normalResult}</b></div>{identifierCounts.length > 0 && <div className="wide"><span>各数字化标识有效数据条数</span><b>{identifierCounts.map(row=>`${text(row["数字化标识"])}：${text(row["有效数据条数"],"0")}条`).join("；")}</b></div>}<div className="wide"><span>关联模型集合</span><b>{listText(triggeredRaw," → ")}</b></div><div><span>关联模型启动次数</span><b>{triggerCount}</b></div><div className="wide"><span>智选结果</span><b>{decision}</b></div></div>
    <h4 className="section-title">关联模型启动明细</h4>{triggerDetails.length ? <div className="approval-record-list">{triggerDetails.map((detailRow,index)=><div className="approval-record-card" key={`智选触发-${index}`}><div className="approval-record-title"><span>{index+1}</span><b>{text(detailRow["目标模型"] ?? detailRow["关联模型"],"关联模型")}</b><em className="status">{text(detailRow["启动结果"] ?? detailRow["触发状态"],"已触发")}</em></div><div className="business-detail-grid"><div><span>来源数字化标识</span><b className="font-mono text-xs">{text(detailRow["来源数字化标识"])}</b></div><div><span>关联数字化标识</span><b className="font-mono text-xs">{text(detailRow["关联数字化标识"])}</b></div><div><span>数据序号</span><b>{text(detailRow["数据序号"])}</b></div><div><span>触发类型</span><b>{text(detailRow["关联类型"] ?? detailRow["触发类型"],"正常")}</b></div><div className="wide"><span>目标模型文件名</span><b className="font-mono text-xs">{text(detailRow["目标模型文件名"] ?? detailRow["模型文件名"])}</b></div></div></div>)}</div> : <div className="content-box">无</div>}</div>
}

function DoneDetail({ item }: { item?: DoneRecord }) {
  if (!item) return <Empty text="未找到已办记录"/>
  const run = parseRunDoneContent(item)
  const runEntries = run ? businessEntries({ ...run.input, ...run.output }) : []
  if (run?.runKind === "approval") {
    const object=(value:unknown)=>value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {}
    const objectArray=(value:unknown)=>Array.isArray(value) ? value.filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item === "object"&&!Array.isArray(item)) : []
    const approvalProcess = objectArray(run.output["审批办理记录"] ?? run.output.approvalProcess)
    const approverCalculation = objectArray(run.output["审批人计算"])
    const pathCalculation = object(run.output["审批路径计算"])
    const thresholdCalculation = objectArray(run.output["命中数字化标识阈值"])
    const legacyThresholds = objectArray(run.output.approvalThresholdVariables)
    const businessContent=object(run.output.approvalBusinessContent)
    const businessData=Object.keys(object(businessContent.businessData)).length ? object(businessContent.businessData) : (()=>{ const sourceInput=object(run.input.sourceInput); const sourceOutput=object(run.input.sourceOutput); return {...sourceInput,...sourceOutput} })()
    const businessFields:BusinessFieldView[]=Array.isArray(businessContent.businessFields) ? businessContent.businessFields.filter((value):value is Record<string,unknown>=>Boolean(value)&&typeof value === "object"&&!Array.isArray(value)).map((field,index)=>({key:String(field.key ?? ""),label:String(field.label ?? "业务字段"),digitalId:String(field.digitalId ?? "") || undefined,type:String(field.type ?? "") || undefined,order:Number(field.order ?? index)})).filter(field=>field.key) : []
    const approvalEntries=businessEntries(businessData,businessFields)
    const legacyEvidence=object(run.output.approvalComputationEvidence)
    const organizationPath=Array.isArray(pathCalculation["组织逐级路径"]) ? (pathCalculation["组织逐级路径"] as unknown[]).map(String).filter(Boolean) : Array.isArray(run.output.approvalOrganizationPath) ? run.output.approvalOrganizationPath.map(String).filter(Boolean) : []
    const routeValue=run.output["正式审批路径"] ?? run.output.approvalRoute
    const formalRoute=Array.isArray(routeValue) ? routeValue.map(String).filter(Boolean).join(" → ") : String(routeValue ?? "—")
    const approvalStatus=String(run.output["审批状态"] ?? run.output.approvalStatus ?? item.result)
    const approvalResult=String(run.output["审批结果"] ?? run.output.approvalResult ?? approvalStatus)
    const currentStep=String(run.output["当前审批环节"] ?? run.output.approvalCurrentStep ?? (approvalProcess.length ? "已完成全部环节" : "待进入审批环节"))
    const currentApprover=String(run.output["当前审批人"] ?? run.output.approvalCurrentApprover ?? "—")
    const baseTarget=String(pathCalculation["基础审批目标"] ?? pathCalculation["基础审批目标层级"] ?? run.output["基础审批目标"] ?? run.output["基础审批目标层级"] ?? legacyEvidence.baseAdministrativeTarget ?? "—")
    const finalTarget=String(pathCalculation["最终审批目标"] ?? pathCalculation["最终审批目标层级"] ?? run.output["最终审批目标"] ?? run.output["最终审批目标层级"] ?? legacyEvidence.adjustedAdministrativeTarget ?? run.output.approvalAdministrativeLevel ?? "—")
    const technicalTarget=String(pathCalculation["最终技术业务审查目标层级"] ?? run.output["技术业务审查目标层级"] ?? legacyEvidence.adjustedTechnicalTarget ?? run.output.approvalTechnicalLevel ?? "—")
    return <div><h3 className="detail-title !mt-0">{item.title}</h3><div className="meta-grid"><span>所属模型<b>审批模型</b></span><span>业务来源<b>{String(businessContent.sourceModelName ?? run.sourceModelName ?? "业务事项")}</b></span><span>模型状态<b>{run.status || item.result}</b></span><span>审批结果<b className="text-[#27805f]">{approvalResult}</b></span></div>
      <h4 className="section-title">审批模型</h4><div className="business-detail-grid"><div className="wide"><span>审批模型文件名</span><b className="font-mono text-xs">{run.fileName || "—"}</b></div><div className="wide"><span>被审批业务模型文件名</span><b className="font-mono text-xs">{String(businessContent.sourceFileName ?? run.input["前序模型文件名"] ?? run.input.sourceFileName ?? "—")}</b></div><div><span>当前审批环节</span><b>{currentStep}</b></div><div><span>当前审批人</span><b>{currentApprover}</b></div><div><span>审批状态</span><b>{approvalStatus}</b></div><div className="wide"><span>正式审批路径</span><b>{formalRoute}</b></div></div>
      <h4 className="section-title">业务内容</h4><div className="business-detail-grid">{approvalEntries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{approvalEntries.length === 0 && <div className="business-empty">来源业务模型暂无可展示业务内容</div>}</div>
      <h4 className="section-title">审批路径计算</h4><div className="business-detail-grid"><div><span>基础审批目标</span><b>{baseTarget}</b></div><div><span>最终审批目标</span><b>{finalTarget}</b></div><div><span>技术/业务审查目标层级</span><b>{technicalTarget}</b></div><div><span>申请人所在部门</span><b>{String(pathCalculation["申请人所在部门"] ?? legacyEvidence.startDepartment ?? "—")}</b></div>{organizationPath.length > 0 && <div className="wide"><span>组织逐级路径</span><b>{organizationPath.join(" → ")}</b></div>}<div className="wide"><span>正式审批路径</span><b>{formalRoute}</b></div>{(thresholdCalculation.length || legacyThresholds.length) > 0 && <div className="wide"><span>命中数字化标识阈值</span><b>{thresholdCalculation.length ? thresholdCalculation.map(value => `${String(value["阈值类型"] ?? "阈值")}：${String(value["本次业务值"] ?? "—")} ≥ ${String(value["阈值"] ?? "—")} → ${String(value["调整审批层级"] ?? "")}`).join("；") : legacyThresholds.map(value => `${String(value.thresholdType ?? "阈值")}：${String(value.actualValue ?? "—")} ≥ ${String(value.thresholdValue ?? "—")} → ${String(value.approvalLevel ?? "")}`).join("；")}</b></div>}</div>
      <h4 className="section-title">审批人计算</h4>{approverCalculation.length ? <div className="approval-record-list">{approverCalculation.map((calc,index)=><div className="approval-record-card" key={`审批人计算-${index}`}><div className="approval-record-title"><span>{index+1}</span><b>{String(calc["环节名称"] ?? `审批环节${index+1}`)}</b><em className="status">{String(calc["环节类型"] ?? "审批")}</em></div><div className="business-detail-grid"><div><span>审批人</span><b>{String(calc["审批人"] ?? "待匹配")}</b></div><div><span>审批组织</span><b>{String(calc["审批组织"] ?? "—")}</b></div><div><span>审批层级/岗位</span><b>{String(calc["审批层级岗位"] ?? "—")}</b></div><div><span>规定时限</span><b>{approvalTimeoutDisplay(calc["规定时限"])}</b></div></div></div>)}</div> : <div className="content-box">历史审批记录未保存独立的审批人计算快照；可从办理记录中的实际审批人追溯。</div>}
      <h4 className="section-title">审批办理记录</h4>{approvalProcess.length ? <div className="approval-record-list">{approvalProcess.map((step,index)=>{ const calc=approverCalculation[index] ?? {}; return <div className="approval-record-card" key={`${String(step.step ?? "审批")}-${index}`}><div className="approval-record-title"><span>{index+1}</span><b>{String(step.step ?? `审批步骤${index+1}`)}</b><em className={`status ${step.result === "不同意" || step.result === "退回修改" ? "danger" : "success"}`}>{String(step.result ?? "已办理")}</em></div><div className="business-detail-grid"><div><span>审批/审查人</span><b>{String(step.approver ?? calc["审批人"] ?? "—")}</b></div><div><span>耗时</span><b>{approvalElapsedDisplay(step.arrivedAt,step.handledAt)}</b></div><div><span>到达时间</span><b>{String(step.arrivedAt ?? "—").slice(0,19).replace("T"," ")}</b></div><div><span>办理时间</span><b>{String(step.handledAt ?? "—").slice(0,19).replace("T"," ")}</b></div></div></div>})}</div> : <div className="content-box">审批模型当前暂无已完成的办理记录；模型仍在运行时可查看当前审批人和正式审批路径。</div>}</div>
  }
  if (run?.runKind === "smart") return <SmartRunDetail item={item} snapshot={run}/>
  return <div><h3 className="detail-title !mt-0">{item.title}</h3><div className="meta-grid"><span>所属模型<b>{item.model}</b></span><span>{run ? "发起人" : "办理人"}<b>{item.sender}</b></span><span>{run ? "完成时间" : "处理时间"}<b>{item.handled}</b></span><span>{run ? "运行状态" : "处理结果"}<b className="text-[#27805f]">{item.result}</b></span></div>{run ? <><h4 className="section-title">业务内容</h4><div className="business-detail-grid">{runEntries.map(entry => <div key={entry.key} className={entry.key === "reason" || entry.key === "approvalContent" ? "wide" : ""}><span>{entry.label}</span><b>{entry.value}</b></div>)}{runEntries.length === 0 && <div className="business-empty">本次模型已完成并归档</div>}</div></> : <><h4 className="section-title">处理记录</h4><div className="content-box">本事项已完成处理，当前页面仅供查看，不再提供办理操作。</div></>}</div>
}
function libraryValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

function digitalRecordValue(record: DigitalLibraryRecord, column: DigitalLibraryColumn) {
  const present = (value: unknown) => value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "")
  const byIdentifier = record.values?.[column.digitalId]
  if (present(byIdentifier)) return byIdentifier
  const data = record.data ?? {}
  const nestedInput = data.input && typeof data.input === "object" && !Array.isArray(data.input) ? data.input as Record<string,unknown> : {}
  const nestedOutput = data.output && typeof data.output === "object" && !Array.isArray(data.output) ? data.output as Record<string,unknown> : {}
  if (column.fieldKey) {
    const byFieldKey = nestedOutput[column.fieldKey] ?? nestedInput[column.fieldKey] ?? data[column.fieldKey]
    if (present(byFieldKey)) return byFieldKey
  }
  const byDisplayName = nestedOutput[column.displayName] ?? nestedInput[column.displayName] ?? data[column.displayName]
  if (present(byDisplayName)) return byDisplayName
  const compact = column.displayName.replace(/[\s：:]/g, "")
  for (const source of [nestedOutput,nestedInput,data]) {
    const fallback = Object.entries(source).find(([key]) => key.replace(/[\s：:]/g, "") === compact)?.[1]
    if (present(fallback)) return fallback
  }
  return undefined
}

type DigitalLibraryTab = "records" | "fields" | "relations" | "permissions"

function DigitalLibrary() {
  const [libraries, setLibraries] = useState<DigitalLibrarySummary[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [records, setRecords] = useState<DigitalLibraryRecord[]>([])
  const [loadingLibraries, setLoadingLibraries] = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [term, setTerm] = useState("")
  const [recordTerm, setRecordTerm] = useState("")
  const [activeTab, setActiveTab] = useState<DigitalLibraryTab>("records")
  const [selectedRecord, setSelectedRecord] = useState<DigitalLibraryRecord | null>(null)

  const loadLibraries = () => {
    setLoadingLibraries(true)
    apiFetch<{libraries:DigitalLibrarySummary[]}>("/api/digital-libraries").then(data => {
      setLibraries(data.libraries)
      setSelectedId(current => current || data.libraries.find(item => item.modelName === "请休假模型")?.id || data.libraries[0]?.id || "")
    }).catch(() => setLibraries([])).finally(() => setLoadingLibraries(false))
  }
  useEffect(loadLibraries, [])
  useEffect(() => {
    setActiveTab("records")
    setRecordTerm("")
    if (!selectedId) { setRecords([]); return }
    setLoadingRecords(true)
    const params = new URLSearchParams({ libraryId: selectedId, limit: "300" })
    apiFetch<{records:DigitalLibraryRecord[]}>(`/api/digital-library/records?${params.toString()}`).then(data => setRecords(data.records)).catch(() => setRecords([])).finally(() => setLoadingRecords(false))
  }, [selectedId])

  const selected = libraries.find(item => item.id === selectedId)
  const filterText = term.trim().toLowerCase()
  const visibleLibraries = libraries.filter(item => `${item.name} ${item.modelName ?? ""} ${item.digitalId ?? ""} ${item.columns.map(c => `${c.displayName} ${c.digitalId}`).join(" ")}`.toLowerCase().includes(filterText))
  const columns = selected?.columns ?? []
  const filteredRecords = records.filter(record => {
    const search = recordTerm.trim().toLowerCase()
    if (!search) return true
    return [record.fileName, record.displayFileName, record.recordId].join(" ").toLowerCase().includes(search)
  })
  const tabItems: {key:DigitalLibraryTab;label:string;hint:string}[] = [
    {key:"records",label:"文件记录",hint:`${selected?.recordCount ?? 0} 个`},
    {key:"fields",label:"字段设计",hint:`${columns.length} 个字段`},
    {key:"relations",label:"模型关联",hint:selected?.modelName ? "1 个来源模型" : "系统配置"},
    {key:"permissions",label:"权限",hint:"数字化库权限"},
  ]
  return <div className="digital-library-workspace">
    <aside className="digital-library-sidebar-v2">
      <div className="digital-library-brand"><span className="digital-library-brand-icon"><Icon name="layers" size={17}/></span><div><b>数字化库中心</b><small>模型运行数据与数字化数据</small></div><button onClick={loadLibraries} className="icon-button" title="刷新"><Icon name="arrow" size={14}/></button></div>
      <div className="digital-library-search-v2"><Icon name="search" size={15}/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="搜索数字化库"/></div>
      <div className="digital-library-tree">
        {loadingLibraries ? <Empty text="正在读取数字化库…"/> : visibleLibraries.map(item => <button key={item.id} onClick={() => setSelectedId(item.id)} className={selectedId === item.id ? "active" : ""}>
          <span className="digital-library-tree-icon model"><Icon name="layers" size={15}/></span>
          <span className="digital-library-tree-text"><b>{item.name}</b><small>{item.modelName || "数字化库"}</small></span>
          <span className="digital-library-tree-count">{item.recordCount}</span>
        </button>)}
        {!loadingLibraries && visibleLibraries.length === 0 && <Empty text="没有匹配的数字化库"/>}
      </div>
    </aside>

    <section className="digital-library-content-v2">
      {!selected ? <Empty text="请选择一个数字化库"/> : <>
        <header className="digital-library-page-head">
          <div className="digital-library-title-area"><div className="digital-library-breadcrumb">数字化库</div><div className="digital-library-title-row"><h2>{selected.name}</h2>{selected.allowAsSource && <span className="library-source-pill">可作为数据源</span>}</div><p>{selected.modelName ? `${selected.modelName}运行形成并维护本数字化库。记录列表仅显示文件名，全部业务数据、数字化标识和运行技术信息统一进入“查看详情”。` : "本数字化库由对应模型运行形成并维护，可按权限被其他模型引用。记录列表仅显示文件名，全部数字化数据在详情中查看。"}</p></div>
          <div className="digital-library-kpi-group"><div><b>{selected.recordCount}</b><span>文件记录</span></div><div><b>{columns.length}</b><span>字段数量</span></div></div>
        </header>

        <div className="digital-library-overview-grid">
          <div><span>来源模型</span><b>{selected.modelName || "系统配置模型"}</b></div>
          <div><span>数据用途</span><b>{selected.allowAsSource ? "可被模型引用" : "仅本模型使用"}</b></div>
          <div><span>模型数字化编码</span><b className="font-mono">{selected.modelCode || "—"}</b></div>
          <div><span>当前状态</span><b>{selected.projectStatus === "published" ? "已发布" : selected.projectStatus || "系统配置"}</b></div>
        </div>

        <nav className="digital-library-tabs-v2">{tabItems.map(tab => <button key={tab.key} onClick={()=>setActiveTab(tab.key)} className={activeTab === tab.key ? "active" : ""}><b>{tab.label}</b><small>{tab.hint}</small></button>)}</nav>

        {activeTab === "records" && <div className="digital-library-tab-panel">
          <div className="digital-library-toolbar"><div className="search-box digital-record-search"><Icon name="search" size={15}/><input value={recordTerm} onChange={e=>setRecordTerm(e.target.value)} placeholder="搜索文件名"/></div><div className="digital-library-toolbar-note">共 {filteredRecords.length} 个文件 · 列表仅保留文件名和查看详情</div></div>
          <div className="digital-library-table-card">
            {loadingRecords ? <Empty text="正在读取数字化库记录…"/> : filteredRecords.length === 0 ? <Empty text={records.length ? "没有匹配的文件" : "该数字化库当前还没有文件记录"}/> : <div className="digital-library-table-scroll"><table className="digital-library-file-table"><thead><tr><th>文件名</th><th className="action-col">查看详情</th></tr></thead><tbody>{filteredRecords.map(record => { const fileName=record.fileName || record.displayFileName || record.recordId; return <tr key={record.recordId}><td><b className="font-mono">{fileName}</b>{record.displayFileName && record.displayFileName !== fileName && <small>{record.displayFileName}</small>}</td><td className="action-col"><button onClick={() => setSelectedRecord(record)} className="table-action">查看详情</button></td></tr>})}</tbody></table></div>}
          </div>
        </div>}

        {activeTab === "fields" && <div className="digital-library-tab-panel">
          <div className="digital-library-section-head"><div><h3>字段设计</h3><p>字段中文名称面向业务人员；16 位数字化标识用于系统存储、跨模型引用和智选判断。</p></div><span className="section-badge">{columns.length} 个字段</span></div>
          <div className="digital-field-table"><div className="digital-field-row head"><span>字段名称</span><span>字段类型</span><span>必填</span><span>字段角色</span><span>数字化标识</span></div>{columns.map(col => <div className="digital-field-row" key={col.digitalId}><span><b>{col.displayName}</b><small>业务显示名称</small></span><span><em>{col.dataType || "text"}</em></span><span>{col.required ? <em className="yes">是</em> : <em>否</em>}</span><span>{col.sourceRole || "数据字段"}</span><span className="font-mono digital-id-cell">{col.digitalId}</span></div>)}</div>
          <div className="digital-source-rule-card"><div className="digital-source-rule-icon"><Icon name="layers" size={18}/></div><div><b>选择类字段的数据源规则</b><p>下拉、人员、部门、多选等选择类字段应绑定到一个数字化库及其数字化标识列。多个字段可以复用同一个数字化库，例如请休假、会议等模型中的人员选择统一引用“人员信息数字化库”。具体来源在模型设计阶段配置，不再通过代码写死 options。</p></div></div>
        </div>}

        {activeTab === "relations" && <div className="digital-library-tab-panel">
          <div className="digital-library-section-head"><div><h3>模型关联</h3><p>查看本库由哪个模型产生，以及作为数字化数据源时可被哪些模型字段复用。</p></div></div>
          <div className="digital-relation-grid"><div className="digital-relation-card primary"><span>数据产生模型</span><b>{selected.modelName || "系统配置模型"}</b><p>模型运行后向本数字化库写入或维护有效数据。</p><small>{selected.modelCode || "未配置模型数字化编码"}</small></div><div className="digital-relation-arrow"><Icon name="arrow" size={20}/></div><div className="digital-relation-card"><span>数字化库</span><b>{selected.name}</b><p>{selected.allowAsSource ? "当前允许作为其他模型字段的数据源。" : "当前未开放给其他模型作为选择数据源。"}</p><small>{columns.length} 个数字化标识字段</small></div></div>
          <div className="digital-relation-list"><h4>可引用字段</h4>{columns.map(col => <div key={col.digitalId}><span><b>{col.displayName}</b><small>{col.dataType}</small></span><span className="font-mono">{col.digitalId}</span><em>{selected.allowAsSource ? "可引用" : "仅内部"}</em></div>)}</div>
        </div>}

        {activeTab === "permissions" && <div className="digital-library-tab-panel">
          <div className="digital-library-section-head"><div><h3>数据权限</h3><p>当前权限规则与后台真实查询规则保持一致，避免前端展示与服务端数据范围不一致。</p></div></div>
          <div className="digital-permission-grid"><div><span className="permission-icon"><Icon name="user" size={18}/></span><b>普通用户</b><p>按本人权限读取数字化库记录；本人业务记录与系统公共数据分别按权限范围控制。</p></div><div><span className="permission-icon"><Icon name="shield" size={18}/></span><b>管理员</b><p>可查看本数字化库全部记录，用于数字化数据维护、模型配置核验和系统管理。</p></div><div><span className="permission-icon"><Icon name="layers" size={18}/></span><b>模型引用</b><p>{selected.allowAsSource ? "已允许模型设计器把本库作为字段数据源。" : "当前不允许作为字段数据源，模型设计阶段不会列入可选数据源。"}</p></div></div>
        </div>}
      </>}
    </section>

    {selectedRecord && selected && <Modal title={`${selected.name} · 记录详情`} onClose={() => setSelectedRecord(null)}><div className="digital-record-modal-v2"><div className="record-detail-banner"><div><b className="font-mono">{selectedRecord.fileName || selectedRecord.displayFileName || selectedRecord.recordId}</b><span>{selectedRecord.displayFileName || selectedRecord.createdAt}</span></div><em>{selectedRecord.status || "已入库"}</em></div><div className="digital-record-identifier-grid-v2">{columns.map(col => <div key={col.digitalId}><span><b>{col.displayName}</b><small className="font-mono">{col.digitalId}</small></span><strong>{libraryValue(digitalRecordValue(selectedRecord,col))}</strong></div>)}</div><details className="digital-record-tech"><summary>运行技术信息</summary><div className="digital-record-db-grid">{[["record_id", selectedRecord.recordId],["model_id", selectedRecord.modelId],["project_id",selectedRecord.projectId],["run_id",selectedRecord.runId],["library_id",selectedRecord.libraryId],["model_code",selectedRecord.modelCode]].map(([key,value]) => <div key={key}><span>{key}</span><b className="font-mono">{value || "—"}</b></div>)}</div></details></div></Modal>}
  </div>
}

function Information({ items, onOpen }: { items:string[][]; onOpen:(n:string[])=>void }) { return <div className="table-wrap"><div className="info-list table-head"><span>信息标题</span><span>信息类型</span><span>发布日期</span><span>操作</span></div>{items.map(n => <button key={n[0]} onClick={() => onOpen(n)} className="info-list table-row"><span>{n[0]}</span><span><em className="status">{n[1]}</em></span><span>{n[2]}</span><span className="link">查看详情</span></button>)}</div> }
function InformationDetail({ notice, onAttachment }: { notice:string[]; onAttachment:()=>void }) { return <article className="article"><span className="status">{notice[1]}</span><h2>{notice[0]}</h2><p className="article-meta">发布部门：数字化工作组　发布时间：{notice[2]}</p><hr/><p>为进一步规范驾驶舱各区域的功能入口与操作关系，现对相关页面要素和交互逻辑进行调整。</p><p>本次调整重点完善新建、待办、已办、模型建设、数字化库、公共信息及智慧空间等功能入口。用户可通过驾驶舱首页直接进入对应工作页面，待办事项支持直接办理，处理完成后自动进入已办记录。</p><p>请各部门结合实际使用情况及时反馈问题，持续优化驾驶舱的操作体验。</p><div className="attachment"><Icon name="file"/>附件：驾驶舱要素调整说明.pdf <button onClick={onAttachment} className="link">查看</button></div></article> }
function Settings({ onPasswordChange, onSave }: { onPasswordChange:(current:string,next:string)=>Promise<void>; onSave:()=>void }) {
  const [current, setCurrent] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [show, setShow] = useState(false)
  const changePassword = async () => { const issue = passwordIssue(next); if (issue) return setError(issue); if (next !== confirm) return setError("两次输入的新密码不一致"); try { await onPasswordChange(current, next); setCurrent(""); setNext(""); setConfirm(""); setError("") } catch (error) { setError(error instanceof Error ? error.message : "密码修改失败") } }
  return <div className="mx-auto max-w-[820px]"><div className="flex items-center gap-4 border-b border-[#d8e2f2] pb-6"><span className="avatar large">张</span><div><h3 className="text-lg font-semibold">张珊</h3><p className="muted">设备管理部 · 当前用户</p></div></div>
    <h3 className="section-title">基本设置</h3><div className="form-grid"><label>显示名称<input defaultValue="张珊"/></label><label>默认首页<select><option>驾驶舱</option><option>我的待办</option></select></label><label>每页显示数量<select><option>10 条</option><option>20 条</option><option>50 条</option></select></label><label>消息提醒<select><option>站内通知</option><option>关闭</option></select></label></div><div className="mt-5 text-right"><button onClick={onSave} className="btn-secondary">保存基本设置</button></div>
    <div className="password-panel"><div><h3>修改登录密码</h3><p>密码至少 8 位，须包含字母和数字。</p></div><button onClick={() => setShow(v => !v)} className="link">{show ? "隐藏密码" : "显示密码"}</button></div>
    <div className="form-grid mt-5"><label>当前密码<input type={show?"text":"password"} value={current} onChange={e=>setCurrent(e.target.value)} autoComplete="current-password" placeholder="请输入当前密码"/></label><span/><label>新密码<input type={show?"text":"password"} value={next} onChange={e=>setNext(e.target.value)} autoComplete="new-password" placeholder="请输入新密码"/><PasswordStrength value={next}/></label><label>确认新密码<input type={show?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="再次输入新密码"/></label></div>{error && <p className="form-error">{error}</p>}<div className="mt-5 text-right"><button onClick={changePassword} className="btn-primary">确认修改密码</button></div>
  </div>
}
function Status() { return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[["门户服务","正常","99.99%"],["模型引擎","正常","99.97%"],["数字化库","正常","99.98%"],["审批服务","正常","99.96%"],["消息服务","正常","99.95%"],["安全服务","正常","100%"]].map(x => <div key={x[0]} className="status-card"><span className="status-dot"/><div><b>{x[0]}</b><p>运行状态：{x[1]}</p></div><strong>{x[2]}</strong></div>)}</div> }
function Feature({ title }: { title: string }) {
  const asset = title.includes("—") ? title.split("—").slice(-1)[0].replace("配置", "").replace("说明", "") : ""
  const configs: Record<string, { stage: string; summary: string; rows: string[][] }> = {
    模型目标: { stage: "建议阶段", summary: "确认请休假业务模型要解决的问题和边界。", rows: [["业务目标", "统一收集请休假申请、计算业务结果并形成可追溯归档"], ["适用范围", "全体在职人员，按员工身份与组织关系控制"], ["验收标准", "申请可提交、业务结果可计算、结果可归档并可触发独立审批模型"]] },
    模型输入: { stage: "设计阶段", summary: "定义请休假业务模型启动时的交互数据。", rows: [["输入字段", "申请人、所属部门、请假类型、开始日期、结束日期、事由"], ["参数来源", "驾驶舱交互；申请人与部门从人员信息数字化库读取"], ["校验规则", "日期有效、请假类型和请假事由必填"]] },
    模型运算: { stage: "设计阶段", summary: "本业务模型只完成自身读取和业务运算，不计算审批路径。", rows: [["读取", "当前用户、所属部门"], ["计算", "请假天数 = 结束日期 - 开始日期 + 1"], ["边界", "审批路线、审批人员、审批结果均由独立审批模型计算和处理"]] },
    模型输出: { stage: "设计阶段", summary: "明确请休假业务模型自身的输出数据。", rows: [["业务输出", "申请人、部门、请假类型、起止日期、事由、请假天数"], ["文件名", "5011001005001000001-50110020015-时间码"], ["后续传递", "归档后把业务文件名、数字化标识、输入与输出传给独立审批模型"]] },
    模型存储: { stage: "设计阶段", summary: "请休假业务模型运行完成后只写入本模型数字化库。", rows: [["存储库", "请休假模型数字化库"], ["数字化标识", "5013001005001002"], ["实例区分", "数字化标识固定；每次运行通过模型文件名与 runId 区分"]] },
    普通场景: { stage: "测试阶段", summary: "验证常规请休假业务数据能够正确计算并归档。", rows: [["测试输入", "年休假，连续2天，事由完整"], ["预期计算", "请假天数 = 2"], ["预期结果", "形成请休假业务归档；归档关系可触发审批模型"]] },
    升级场景: { stage: "测试阶段", summary: "验证业务模型对较长请假仍只输出业务数据，不承载审批判断。", rows: [["测试输入", "年休假，连续4天，事由完整"], ["预期计算", "请假天数 = 4"], ["预期结果", "业务模型归档完成；审批路径由独立审批模型后续计算"]] },
    拦截场景: { stage: "测试阶段", summary: "验证业务输入无效时不产生业务归档，也不触发后续模型。", rows: [["测试输入", "结束日期早于开始日期，或事由为空"], ["预期动作", "页面提示并阻止提交"], ["校验结果", "不归档、不触发审批模型"]] },
    模型关联: { stage: "配置阶段", summary: "配置模型之间的归档后硬性链接；该关系不属于业务模型内部节点。", rows: [["当前模型", "请休假模型"], ["触发时点", "请休假模型完成归档后"], ["后续模型", "独立审批模型（接收业务文件名、数字化标识、输入和输出）"]] },
    审批规则: { stage: "独立审批模型", summary: "审批规则属于审批模型自身的四阶段设计，不属于请休假模型。", rows: [["模型对象", "审批模型"], ["审批步骤", "行政审批（申请人所属部门的部门经理） → 业务审批（考勤主管）"], ["数据来源", "前序请休假业务归档 + 用户角色 + 组织关系"]] },
    数字化标识: { stage: "配置阶段", summary: "数字化标识必须由数字化标识建设模型正式分配。", rows: [["当前结构", "数字化标识使用0622规定的19位结构"], ["历史数据", "既有16位标识仅兼容读取，不作为新建口径"], ["运行区分", "每次模型运行通过模型文件名追溯，不设置模型ID"]] },
    发布状态: { stage: "配置阶段", summary: "完成闭环校验后发布模型，供用户人工启动。", rows: [["模型状态", "已启用"], ["可见入口", "可发起模型、模型建设工作台"], ["回退规则", "校验未通过时回到配置环节修改并重新测试"]] },
  }
  const config = configs[asset]
  if (!config) return <div className="empty-feature"><span><Icon name="layers" size={30}/></span><h3>{title}</h3><p>已进入{title}工作区。该入口已完成跳转，可继续接入对应业务功能。</p></div>
  return <div className="feature-config"><div className="feature-config-head"><div><span className="status status-accent">请休假模型 · {config.stage}</span><h3>{asset}配置</h3><p>{config.summary}</p></div><span className="status success">已校验</span></div><div className="config-table">{config.rows.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div><div className="content-box mt-5">本配置遵循模型标准的“交互、参数、运算、输出、存储”结构，前序输出将作为后序环节的输入。</div></div>
}
function AdminConsole() {
  const [tab, setTab] = useState<"overview" | "users" | "registrations">("overview")
  const [overview, setOverview] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [registrations, setRegistrations] = useState<any[]>([])
  const [error, setError] = useState("")
  const load = async () => {
    try {
      const [summary, userData, registrationData] = await Promise.all([apiFetch<any>("/api/admin/overview"), apiFetch<any>("/api/admin/users"), apiFetch<any>("/api/admin/registrations")])
      setOverview(summary); setUsers(userData.users ?? []); setRegistrations(registrationData.registrations ?? []); setError("")
    } catch (e) { setError(e instanceof Error ? e.message : "管理员数据加载失败") }
  }
  useEffect(() => { void load() }, [])
  const review = async (id: string, action: string) => { try { await apiFetch(`/api/admin/registrations/${id}/${action}`, { method: "POST" }); await load() } catch (e) { setError(e instanceof Error ? e.message : "审核失败") } }
  const toggle = async (u: any) => { try { await apiFetch(`/api/admin/users/${u.id}/status`, { method: "POST", body: JSON.stringify({ status: u.status === "active" ? "disabled" : "active" }) }); await load() } catch (e) { setError(e instanceof Error ? e.message : "账号状态更新失败") } }
  const changeRole = async (u: any, role: string) => { try { await apiFetch(`/api/admin/users/${u.id}/role`, { method: "POST", body: JSON.stringify({ role }) }); await load() } catch (e) { setError(e instanceof Error ? e.message : "角色设置失败") } }
  const roleLabel = (role: string) => role === "admin" ? "系统管理员" : role === "department_manager" ? "部门经理" : role === "attendance_supervisor" ? "考勤主管" : "普通用户"
  return <div><div className="mb-5 flex flex-wrap items-center gap-2">{[["overview", "总览"], ["users", "用户管理"], ["registrations", "注册审核"]].map(([key, label]) => <button key={key} onClick={() => setTab(key as typeof tab)} className={tab === key ? "btn-primary" : "btn-secondary"}>{label}</button>)}<button onClick={() => void load()} className="btn-secondary ml-auto">刷新数据</button></div>{error && <p className="form-error mb-4">{error}</p>}{tab === "overview" && <div className="grid gap-4 md:grid-cols-4">{[["用户总数", overview?.users?.total ?? "-"], ["活跃用户", overview?.users?.active ?? "-"], ["待审核注册", overview?.pendingRegistrations ?? "-"], ["24小时操作", overview?.audit24h ?? "-"]].map(x => <div className="status-card" key={x[0]}><div><b>{x[0]}</b><strong>{x[1]}</strong></div></div>)}</div>}{tab === "users" && <div className="table-wrap"><div className="data-table admin-user-cols table-head"><span>账号</span><span>姓名/部门</span><span>角色</span><span>状态</span><span>操作</span></div>{users.map(u => <div className="data-table admin-user-cols table-row" key={u.id}><span>{u.username}<small className="muted font-mono">{u.employee_code || "未分配人员编码"}</small></span><span>{u.display_name}<small className="muted">{u.department || "未填写"}</small></span><span><select className="admin-role-select" value={u.role} onChange={e=>void changeRole(u,e.target.value)} aria-label={`${u.display_name}角色`}><option value="user">普通用户</option><option value="department_manager">部门经理</option><option value="attendance_supervisor">考勤主管</option><option value="admin">系统管理员</option></select><small className="muted">{roleLabel(u.role)}</small></span><span><em className={`status ${u.status === "active" ? "success" : ""}`}>{u.status === "active" ? "正常" : "已停用"}</em></span><button className="link admin-action" onClick={() => void toggle(u)}>{u.status === "active" ? "停用" : "启用"}</button></div>)}{users.length === 0 && <Empty text="暂无用户数据" />}</div>}{tab === "registrations" && <div className="table-wrap"><div className="data-table admin-registration-cols table-head"><span>账号</span><span>姓名</span><span>部门</span><span>状态</span><span>操作</span></div>{registrations.map(r => <div className="data-table admin-registration-cols table-row" key={r.id}><span>{r.username}</span><span>{r.display_name}</span><span>{r.department || "未填写"}</span><span><em className={`status ${r.status === "approved" ? "success" : r.status === "rejected" ? "danger" : "warning"}`}>{r.status === "pending" ? "待审核" : r.status === "approved" ? "已通过" : "已拒绝"}</em></span><span className="admin-actions">{r.status === "pending" && <><button className="link" onClick={() => void review(r.id, "approve")}>通过</button><button className="link" onClick={() => void review(r.id, "reject")}>拒绝</button></>}</span></div>)}{registrations.length === 0 && <Empty text="暂无注册申请，点击右上角刷新数据" />}</div>}</div>
}
function Panel({ title, children }: { title:string; children:React.ReactNode }) { return <section className="overflow-hidden rounded-xl border border-[#bfcee9] bg-[#f4f8ff]"><div className="bg-[#6275b5] px-6 py-2.5 text-lg font-medium text-white">{title}</div>{children}</section> }
function Card({ title, children }: { title:string; children:React.ReactNode }) { return <div className="card"><h3 className="card-title">{title}</h3><div className="mt-3">{children}</div></div> }
function Popover({ children, className }: {children:React.ReactNode;className:string}) { return <div className={`fixed z-50 rounded-xl border border-[#c8d6ec] bg-white p-4 text-[#1a306e] shadow-[0_18px_50px_rgba(24,46,103,.22)] ${className}`}>{children}</div> }
function Modal({ title, onClose, children }: {title:string;onClose:()=>void;children:React.ReactNode}) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="icon-button"><Icon name="close"/></button></div><div className="mt-4">{children}</div></div></div> }
function Empty({ text }: {text:string}) { return <div className="grid min-h-[180px] place-items-center text-sm text-[#7584a3]">{text}</div> }
function Login({ onLogin, onRegister }: { onLogin:(account:string,password:string,remember:boolean)=>Promise<void>; onRegister:(account:string,displayName:string,department:string,password:string)=>Promise<void> }) {
  const [mode, setMode] = useState<"login"|"forgot"|"register"|"success">("login"); const [account, setAccount] = useState(""); const [displayName, setDisplayName] = useState(""); const [department, setDepartment] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [next, setNext] = useState(""); const [confirm, setConfirm] = useState(""); const [show, setShow] = useState(false); const [error, setError] = useState(""); const [codeSent, setCodeSent] = useState(false)
  const [loading, setLoading] = useState(false); const [remember, setRemember] = useState(false)
  const submitLogin = async () => { if (!account.trim()) return setError("请输入账号"); if (!password) return setError("请输入密码"); setLoading(true); try { await onLogin(account, password, remember); setError("") } catch (error) { setError(error instanceof Error ? error.message : "登录失败") } finally { setLoading(false) } }
  const requestCode = async () => { if (!account.trim()) return setError("请输入需要找回密码的账号"); setLoading(true); try { const response = await apiFetch<{ devCode?: string }>("/api/auth/request-reset", { method: "POST", body: JSON.stringify({ username: account }) }); setCodeSent(true); if (response.devCode) setCode(response.devCode); setError("") } catch (error) { setError(error instanceof Error ? error.message : "验证码发送失败") } finally { setLoading(false) } }
  const reset = async () => { if (!account.trim()) return setError("请输入需要找回密码的账号"); if (!/^\d{6}$/.test(code)) return setError("请输入 6 位验证码"); const issue = passwordIssue(next); if (issue) return setError(issue); if (next !== confirm) return setError("两次输入的新密码不一致"); setLoading(true); try { await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ username: account, code, newPassword: next }) }); setError(""); setMode("success") } catch (error) { setError(error instanceof Error ? error.message : "密码重置失败") } finally { setLoading(false) } }
  const submitRegister=async()=>{if(!account.trim()||!displayName.trim())return setError("请填写账号和姓名");setLoading(true);try{await onRegister(account,displayName,department,password);setMode("login");setError("注册申请已提交，请等待管理员审核")}catch(e){setError(e instanceof Error?e.message:"注册失败")}finally{setLoading(false)}}
  if (mode === "register") return <main className="login-page"><section><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#5063b3] text-white"><Icon name="squares" size={22}/></span><div><h1>智能体式数智化体系</h1><p>企业数字化工作驾驶舱</p></div></div><div className="mt-9"><button onClick={()=>{setMode("login");setError("")}} className="back-button !p-0"><Icon name="back" size={16}/>返回登录</button><h2 className="mt-5">申请注册</h2><p className="muted mt-1">提交后由管理员审核开通</p><label className="login-label">账号<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="3-32位小写字母、数字或 ._-"/></label><label className="login-label">姓名<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="请输入真实姓名"/></label><label className="login-label">部门<input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="请输入所属部门"/></label><label className="login-label">密码<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少8位，包含字母和数字"/><PasswordStrength value={password}/></label>{error&&<p className="form-error">{error}</p>}<button disabled={loading} onClick={()=>void submitRegister()} className="btn-primary mt-5 w-full !py-3">提交注册申请</button></div></section></main>
  return <main className="login-page"><section><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#5063b3] text-white"><Icon name="squares" size={22}/></span><div><h1>智能体式数智化体系</h1><p>企业数字化工作驾驶舱</p></div></div>
    <button onClick={()=>setMode("register")} className="link mt-4">注册账号</button>
    {mode === "login" && <div className="mt-9"><h2>账号登录</h2><p className="muted mt-1">登录后进入个人工作驾驶舱</p><label className="login-label">账号<input value={account} onChange={e=>setAccount(e.target.value)} autoComplete="username" placeholder="请输入账号"/></label><label className="login-label">密码<div className="password-input"><input type={show?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void submitLogin()} autoComplete="current-password" placeholder="请输入密码"/><button onClick={()=>setShow(v=>!v)}>{show?"隐藏":"显示"}</button></div></label><div className="login-options"><label><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> 记住账号</label><button onClick={()=>{setMode("forgot");setError("")}} className="link">忘记密码？</button></div>{error&&<p className="form-error">{error}</p>}<button disabled={loading} onClick={() => void submitLogin()} className="btn-primary mt-5 w-full !py-3">{loading?"登录中…":"登录"}</button><p className="demo-tip">初始管理员账号由部署环境变量配置，不在前端写死。</p></div>}
    {mode === "forgot" && <div className="mt-9"><button onClick={()=>{setMode("login");setError("")}} className="back-button !p-0"><Icon name="back" size={16}/>返回登录</button><h2 className="mt-5">找回密码</h2><p className="muted mt-1">验证账号身份后设置新密码</p><label className="login-label">账号<input value={account} onChange={e=>setAccount(e.target.value)} placeholder="请输入账号"/></label><label className="login-label">验证码<div className="code-input"><input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="请输入 6 位验证码"/><button disabled={loading} onClick={() => void requestCode()}>{codeSent?"重新获取":"获取验证码"}</button></div></label><p className="verify-hint">验证码发送至账户绑定的手机或邮件，请勿向他人透露。</p><label className="login-label">新密码<input type={show?"text":"password"} value={next} onChange={e=>setNext(e.target.value)} placeholder="请输入新密码"/><PasswordStrength value={next}/></label><label className="login-label">确认新密码<input type={show?"text":"password"} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="再次输入新密码"/></label><button onClick={()=>setShow(v=>!v)} className="link mt-3">{show?"隐藏密码":"显示密码"}</button>{error&&<p className="form-error">{error}</p>}<button disabled={loading} onClick={() => void reset()} className="btn-primary mt-5 w-full !py-3">{loading?"处理中…":"确认重置密码"}</button></div>}
    {mode === "success" && <div className="reset-success"><span><Icon name="check" size={28}/></span><h2>密码重置成功</h2><p>请使用新密码重新登录。</p><button onClick={()=>{setMode("login");setPassword("")}} className="btn-primary mt-6 w-full">返回登录</button></div>}
  </section></main>
}

function PasswordStrength({ value }: {value:string}) { const score = Number(value.length>=8)+Number(/[A-Za-z]/.test(value))+Number(/\d/.test(value))+Number(/[^A-Za-z0-9]/.test(value)); const level = score<=1?"弱":score<=3?"中":"强"; return <div className="password-strength"><span className={score>=1?"active":""}/><span className={score>=3?"active":""}/><span className={score>=4?"active strong":""}/><em>{value?level:""}</em></div> }
function passwordIssue(value:string) { if (value.length<8) return "新密码不能少于 8 位"; if (!/[A-Za-z]/.test(value)||!/\d/.test(value)) return "新密码必须同时包含字母和数字"; return "" }
