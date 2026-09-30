import { query } from "./db.js"

export const EMPLOYEE_CODE_PREFIX = "5011002"
export const LEGACY_DIGITAL_16_PATTERN = /^\d{16}$/
export const CURRENT_MODEL_DIGITAL_CODE_PATTERN = /^5011001\d{12}$/
export const CURRENT_EMPLOYEE_DIGITAL_CODE_PATTERN = /^5011002\d{4}$/
export const CURRENT_DIGITAL_IDENTIFIER_PATTERN = /^5013\d{15}$/
export const CURRENT_BUSINESS_ATTRIBUTE_PATTERN = /^5012001\d{12}$/
export const CURRENT_ORGANIZATION_ATTRIBUTE_PATTERN = /^5012003\d{5}$/
export const CURRENT_ORGANIZATION_NAME_ATTRIBUTE_PATTERN = /^5012004\d{5}$/

/** 历史兼容：仅用于读取旧16位数据。新数据不得以此作为当前结构校验。 */
export function isDigital16(value: unknown) {
  return LEGACY_DIGITAL_16_PATTERN.test(String(value ?? "").trim())
}

export function isCurrentModelDigitalCode(value: unknown) {
  return CURRENT_MODEL_DIGITAL_CODE_PATTERN.test(String(value ?? "").trim())
}

export function isModelDigitalCode(value: unknown) {
  const text = String(value ?? "").trim()
  return isCurrentModelDigitalCode(text) || isDigital16(text)
}

export function isCurrentEmployeeDigitalCode(value: unknown) {
  return CURRENT_EMPLOYEE_DIGITAL_CODE_PATTERN.test(String(value ?? "").trim())
}

export function isEmployeeDigitalCode(value: unknown) {
  const text = String(value ?? "").trim()
  return isCurrentEmployeeDigitalCode(text) || isDigital16(text)
}

export function isCurrentDigitalIdentifier(value: unknown) {
  return CURRENT_DIGITAL_IDENTIFIER_PATTERN.test(String(value ?? "").trim())
}

export function isDigitalIdentifier(value: unknown) {
  const text = String(value ?? "").trim()
  return isCurrentDigitalIdentifier(text) || isDigital16(text)
}

export function isBusinessDigitalAttribute(value: unknown) {
  return CURRENT_BUSINESS_ATTRIBUTE_PATTERN.test(String(value ?? "").trim())
}

export function isOrganizationDigitalAttribute(value: unknown) {
  return CURRENT_ORGANIZATION_ATTRIBUTE_PATTERN.test(String(value ?? "").trim())
}

export function isOrganizationNameDigitalAttribute(value: unknown) {
  return CURRENT_ORGANIZATION_NAME_ATTRIBUTE_PATTERN.test(String(value ?? "").trim())
}

export function timeCode(date = new Date()) {
  const zone = process.env.BUSINESS_TIMEZONE || "Asia/Shanghai"
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, hourCycle: "h23",
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00"
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`
}

export const CURRENT_RUNTIME_FILE_NAME_PATTERN = /^5011001\d{12}-5011002\d{4}-\d{14}(?:\d{3})?(?:\d{3})?$/

export function buildRuntimeFileName(modelCode: string, employeeCode: string, stamp: string) {
  if (!isCurrentModelDigitalCode(modelCode)) throw new Error("模型运行必须使用当前19位模型数字化编码")
  if (!isCurrentEmployeeDigitalCode(employeeCode)) throw new Error("模型运行必须使用当前11位员工数字化编码")
  if (!/^\d{14}(?:\d{3})?(?:\d{3})?$/.test(stamp)) throw new Error("模型运行时间码格式无效")
  return `${modelCode}-${employeeCode}-${stamp}`
}

export function isCurrentRuntimeFileName(value: unknown) {
  return CURRENT_RUNTIME_FILE_NAME_PATTERN.test(String(value ?? "").trim())
}

export function displayModelName(modelName: string) {
  return modelName === "请休假模型" ? "请假模型" : modelName
}

export function buildDisplayFileName(modelName: string, displayName: string, stamp: string) {
  return `${displayModelName(modelName)}-${displayName}-${stamp}`
}

export async function getEmployeeDigitalCode(userId: string) {
  const result = await query<{ employee_code: string }>("SELECT employee_code FROM users WHERE id=$1", [userId])
  const code = String(result.rows[0]?.employee_code ?? "").trim()
  if (!isCurrentEmployeeDigitalCode(code)) throw new Error("当前人员未配置当前11位员工数字化编码")
  return code
}

export async function nextEmployeeDigitalCode() {
  const result = await query<{ code: string }>("SELECT $1 || lpad(nextval('employee_digital_code_seq')::text, 4, '0') AS code", [EMPLOYEE_CODE_PREFIX])
  return result.rows[0].code
}
