import type { IncomingMessage, ServerResponse } from "node:http"

export function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) {
  const body = JSON.stringify(data)
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers })
  res.end(body)
}

export function text(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType })
  res.end(body)
}

export async function readJson(req: IncomingMessage, limit = 1_000_000): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > limit) throw new Error("request_too_large")
    chunks.push(buffer)
  }
  if (total === 0) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json")
  return parsed as Record<string, unknown>
}

export function cookies(req: IncomingMessage) {
  const header = req.headers.cookie ?? ""
  return Object.fromEntries(header.split(";").map(item => item.trim().split("=")).filter(parts => parts[0]))
}

export function setCookie(res: ServerResponse, name: string, value: string, options: { maxAge?: number; expires?: Date } = {}) {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
  // Local Docker deployments commonly use plain HTTP. Only add Secure when
  // the deployment explicitly terminates TLS in front of the application.
  if (process.env.COOKIE_SECURE === "true") parts.push("Secure")
  res.setHeader("Set-Cookie", parts.join("; "))
}

export function clearCookie(res: ServerResponse, name: string) {
  setCookie(res, name, "", { maxAge: 0, expires: new Date(0) })
}

export function requestIp(req: IncomingMessage) {
  const forwarded = req.headers["x-forwarded-for"]
  return typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket.remoteAddress ?? "unknown"
}

export function isSameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin
  if (!origin) return true
  const host = req.headers.host
  try { return new URL(origin).host === host } catch { return false }
}
