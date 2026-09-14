import { query } from "./db.js"

export const EMPLOYEE_CODE_PREFIX = "5011002"
export const DIGITAL_CODE_PATTERN = /^\d{16}$/

export function isDigital16(value: unknown) {
  return DIGITAL_CODE_PATTERN.test(String(value ?? "").trim())
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

export function buildRuntimeFileName(modelCode: string, employeeCode: string, stamp: string) {
  if (!isDigital16(modelCode)) throw new Error("模型数字化编码必须为16位数字")
  if (!isDigital16(employeeCode)) throw new Error("发起人人员数字化编码必须为16位数字")
  return `${modelCode}-${employeeCode}-${stamp}`
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
  if (!isDigital16(code)) throw new Error("当前人员未配置16位人员数字化编码")
  return code
}

export async function nextEmployeeDigitalCode() {
  const result = await query<{ code: string }>("SELECT $1 || lpad(nextval('employee_digital_code_seq')::text, 9, '0') AS code", [EMPLOYEE_CODE_PREFIX])
  return result.rows[0].code
}
