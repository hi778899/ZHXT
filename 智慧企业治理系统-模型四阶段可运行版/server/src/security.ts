import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt}$${derived.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, encoded] = stored.split("$")
  if (algorithm !== "scrypt" || !salt || !encoded) return false
  const expected = Buffer.from(encoded, "hex")
  const actual = (await scrypt(password, salt, expected.length)) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function randomToken(bytes = 48) {
  return randomBytes(bytes).toString("base64url")
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

export function passwordIssue(value: string) {
  if (value.length < 8) return "密码不能少于 8 位"
  if (value.length > 128) return "密码不能超过 128 位"
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "密码必须同时包含字母和数字"
  return ""
}

export function safeEqualText(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
