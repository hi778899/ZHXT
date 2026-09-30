import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { closePool, query } from "./db.js"
import { cookies, clearCookie, isSameOrigin, json, readJson, requestIp, setCookie, text } from "./http.js"
import { hashPassword, passwordIssue, randomToken, sha256, verifyPassword } from "./security.js"
import type { AuthUser, Todo } from "./types.js"
import { createProject, getProject, getPublishedByName, getTemplateCatalog, handleModelTodo, listProjects, listBuildStageExecutions, submitBuildStage, startProjectRevision, ModelBuilderError, publishProject, runPublishedModel, runTests, saveStage } from "./model-builder.js"
import { listDataLibraries, listDataLibraryRecords, lookupDataLibrary, listDigitalIdentifiers } from "./data-linkage.js"
import { evaluateExpression, ExpressionError } from "./expression.js"
import { nextEmployeeDigitalCode } from "./digital-codes.js"
import { ensureEmployeeApprovalDigitalConfig } from "./employee-digital-config.js"

const PORT = Number(process.env.PORT ?? 8787)
const SESSION_HOURS = Number(process.env.SESSION_HOURS ?? 8)
const RESET_MINUTES = Number(process.env.RESET_TOKEN_MINUTES ?? 10)
const COOKIE_NAME = "cockpit_sid"
const staticRoot = path.resolve(process.cwd(), "dist")

type UserRow = { id: string; username: string; display_name: string; department: string; employee_code: string; role: string; status: string; password_hash: string; failed_login_count: number; locked_until: Date | null }

function userView(row: Pick<UserRow, "id" | "username" | "display_name" | "department" | "employee_code" | "role">): AuthUser { return { id: row.id, username: row.username, displayName: row.display_name, department: row.department, employeeCode: row.employee_code, role: row.role } }
function allowedOrigin(req: IncomingMessage) {
  const origin = req.headers.origin
  if (!origin) return true
  if (isSameOrigin(req)) return true
  const configured = (process.env.WEB_ORIGIN ?? "http://localhost:8443").split(",").map(x => x.trim()).filter(Boolean)
  return configured.includes(origin)
}
function headers(req: IncomingMessage) {
  const origin = req.headers.origin
  const allowed = origin && (isSameOrigin(req) || (process.env.WEB_ORIGIN ?? "http://localhost:8443").split(",").map(x => x.trim()).includes(origin)) ? origin : undefined
  return { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN", "Referrer-Policy": "strict-origin-when-cross-origin", "Content-Security-Policy": "default-src 'self'; connect-src 'self' http://localhost:8443 http://127.0.0.1:8443; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'", ...(allowed ? { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Credentials": "true", Vary: "Origin" } : {}) }
}
function sendJson(res: ServerResponse, req: IncomingMessage, status: number, data: unknown, extra: Record<string, string> = {}) { json(res, status, data, { ...headers(req), ...extra }) }
function sendText(res: ServerResponse, req: IncomingMessage, status: number, body: string, type?: string) { res.writeHead(status, { ...headers(req), "Content-Type": type ?? "text/plain; charset=utf-8" }); res.end(body) }
function badRequest(res: ServerResponse, req: IncomingMessage, message: string) { sendJson(res, req, 400, { error: message }) }
function clientMeta(req: IncomingMessage) { return { ip: requestIp(req), userAgent: String(req.headers["user-agent"] ?? "").slice(0, 500) } }
async function audit(req: IncomingMessage, userId: string | null, action: string, resourceType: string, resourceId: string | null = null, metadata: Record<string, unknown> = {}) { await query("INSERT INTO audit_logs(id,user_id,action,resource_type,resource_id,ip,user_agent,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [randomUUID(), userId, action, resourceType, resourceId, clientMeta(req).ip, clientMeta(req).userAgent, JSON.stringify(metadata)]) }

async function currentUser(req: IncomingMessage): Promise<UserRow | null> {
  const sid = cookies(req)[COOKIE_NAME]
  if (!sid) return null
  const result = await query<UserRow>("SELECT u.id,u.username,u.display_name,u.department,u.employee_code,u.role,u.status,u.password_hash,u.failed_login_count,u.locked_until FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()", [sha256(sid)])
  const row = result.rows[0]
  if (!row || row.status !== "active") return null
  await query("UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1", [sha256(sid)])
  return row
}
async function requireUser(req: IncomingMessage, res: ServerResponse) { const user = await currentUser(req); if (!user) sendJson(res, req, 401, { error: "unauthorized" }); return user }
async function requireAdmin(req: IncomingMessage, res: ServerResponse) { const user = await requireUser(req, res); if (!user) return null; if (user.role !== "admin") { sendJson(res, req, 403, { error: "admin_required" }); return null } return user }
async function createSession(req: IncomingMessage, res: ServerResponse, userId: string, remember = false) {
  const token = randomToken()
  const maxAge = (remember ? 30 * 24 : SESSION_HOURS) * 3600
  await query("INSERT INTO sessions(token_hash,user_id,expires_at,ip,user_agent) VALUES($1,$2,now()+($3 * interval '1 second'),$4,$5)", [sha256(token), userId, maxAge, clientMeta(req).ip, clientMeta(req).userAgent])
  setCookie(res, COOKIE_NAME, token, { maxAge })
}
async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") return false
  const requestPath = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname)
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\//, "")
  const candidate = path.resolve(staticRoot, relative)
  if (!candidate.startsWith(`${staticRoot}${path.sep}`)) return false
  let file = candidate
  try { const info = await stat(file); if (!info.isFile()) throw new Error("not_file") } catch { file = path.join(staticRoot, "index.html") }
  try { const body = await readFile(file); const ext = path.extname(file).toLowerCase(); const types: Record<string,string> = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".ico":"image/x-icon", ".json":"application/json; charset=utf-8" }; res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream", "Cache-Control": file.endsWith("index.html") ? "no-store" : "public, max-age=31536000, immutable" }); res.end(body); return true } catch { return false }
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  if (req.method === "OPTIONS") { if (!allowedOrigin(req)) return sendJson(res, req, 403, { error: "forbidden_origin" }); res.writeHead(204, { ...headers(req), "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600" }); return res.end() }
  if (url.pathname === "/healthz") { try { await query("SELECT 1"); return sendJson(res, req, 200, { status: "ok", service: "cockpit-api", database: "ok", time: new Date().toISOString() }) } catch { return sendJson(res, req, 503, { status: "degraded", service: "cockpit-api", database: "unavailable" }) } }
  if (!url.pathname.startsWith("/api/")) { if (await serveStatic(req, res)) return; return sendText(res, req, 404, "Not found") }
  if (!allowedOrigin(req)) return sendJson(res, req, 403, { error: "forbidden_origin" })
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method ?? "") && !isSameOrigin(req) && !allowedOrigin(req)) return sendJson(res, req, 403, { error: "csrf_check_failed" })
  try {
    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await readJson(req); const username = String(body.username ?? "").trim(); const password = String(body.password ?? ""); const remember = Boolean(body.remember)
      if (!username || !password) return badRequest(res, req, "账号和密码不能为空")
      const found = await query<UserRow>("SELECT id,username,display_name,department,employee_code,role,status,password_hash,failed_login_count,locked_until FROM users WHERE lower(username)=lower($1)", [username]); const user = found.rows[0]
      if (!user) return sendJson(res, req, 401, { error: "账号或密码不正确" })
      if (user.status !== "active") return sendJson(res, req, 403, { error: "账号已停用" })
      if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) return sendJson(res, req, 423, { error: "登录失败次数过多，请稍后再试" })
      if (!await verifyPassword(password, user.password_hash)) { const failures = user.failed_login_count + 1; await query("UPDATE users SET failed_login_count=$1,locked_until=CASE WHEN $1>=5 THEN now()+interval '15 minutes' ELSE NULL END,updated_at=now() WHERE id=$2", [failures, user.id]); await audit(req, user.id, "login_failed", "user", user.id, { failures }); return sendJson(res, req, 401, { error: failures >= 5 ? "登录失败次数过多，请 15 分钟后再试" : "账号或密码不正确" }) }
      await query("UPDATE users SET failed_login_count=0,locked_until=NULL,updated_at=now() WHERE id=$1", [user.id]); await createSession(req, res, user.id, remember); await audit(req, user.id, "login_success", "user", user.id); return sendJson(res, req, 200, { user: userView(user) })
    }
    if (req.method === "POST" && url.pathname === "/api/auth/logout") { const sid = cookies(req)[COOKIE_NAME]; const user = await currentUser(req); if (sid) await query("DELETE FROM sessions WHERE token_hash=$1", [sha256(sid)]); if (user) await audit(req, user.id, "logout", "user", user.id); clearCookie(res, COOKIE_NAME); return sendJson(res, req, 200, { ok: true }) }
    if (req.method === "GET" && url.pathname === "/api/auth/me") { const user = await currentUser(req); if (!user) return sendJson(res, req, 401, { error: "unauthorized" }); return sendJson(res, req, 200, { user: userView(user) }) }
    if (req.method === "POST" && url.pathname === "/api/auth/change-password") {
      const user = await requireUser(req, res); if (!user) return; const body = await readJson(req); const current = String(body.currentPassword ?? ""); const next = String(body.newPassword ?? ""); if (!await verifyPassword(current, user.password_hash)) return sendJson(res, req, 400, { error: "当前密码不正确" }); const issue = passwordIssue(next); if (issue) return sendJson(res, req, 400, { error: issue }); if (current === next) return sendJson(res, req, 400, { error: "新密码不能与当前密码相同" }); await query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2", [await hashPassword(next), user.id]); await query("DELETE FROM sessions WHERE user_id=$1", [user.id]); await createSession(req, res, user.id); await audit(req, user.id, "password_changed", "user", user.id); return sendJson(res, req, 200, { ok: true })
    }
    if (req.method === "POST" && url.pathname === "/api/auth/request-reset") {
      const body = await readJson(req); const username = String(body.username ?? "").trim(); if (!username) return badRequest(res, req, "请输入账号"); const found = await query<{ id:string }>("SELECT id FROM users WHERE lower(username)=lower($1) AND status='active'", [username]); const generic = { ok: true, message: "如果账号存在，验证码已发送" }; if (!found.rowCount) return sendJson(res, req, 200, generic); const code = String(Math.floor(100000 + Math.random() * 900000)); await query("DELETE FROM password_reset_tokens WHERE user_id=$1 OR expires_at<now()", [found.rows[0].id]); await query("INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+($4 * interval '1 minute'))", [randomUUID(), found.rows[0].id, sha256(code), RESET_MINUTES]); if (process.env.NODE_ENV !== "production" || process.env.RESET_CODE_MODE === "console") console.log(`[password-reset] ${username}: ${code}`); return sendJson(res, req, 200, { ...generic, ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}) })
    }
    if (req.method === "POST" && url.pathname === "/api/auth/reset-password") {
      const body = await readJson(req); const username = String(body.username ?? "").trim(); const code = String(body.code ?? ""); const next = String(body.newPassword ?? ""); const issue = passwordIssue(next); if (issue) return sendJson(res, req, 400, { error: issue }); const found = await query<{ id:string }>("SELECT id FROM users WHERE lower(username)=lower($1) AND status='active'", [username]); if (!found.rowCount) return sendJson(res, req, 400, { error: "验证码或账号不正确" }); const token = await query<{ id:string; user_id:string }>("SELECT id,user_id FROM password_reset_tokens WHERE user_id=$1 AND token_hash=$2 AND used_at IS NULL AND expires_at>now()", [found.rows[0].id, sha256(code)]); if (!token.rowCount) return sendJson(res, req, 400, { error: "验证码无效或已过期" }); await query("UPDATE users SET password_hash=$1,failed_login_count=0,locked_until=NULL,updated_at=now() WHERE id=$2", [await hashPassword(next), found.rows[0].id]); await query("UPDATE password_reset_tokens SET used_at=now() WHERE id=$1", [token.rows[0].id]); await query("DELETE FROM sessions WHERE user_id=$1", [found.rows[0].id]); await audit(req, found.rows[0].id, "password_reset", "user", found.rows[0].id); return sendJson(res, req, 200, { ok: true })
    }
    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await readJson(req); const username = String(body.username ?? "").trim().toLowerCase(); const displayName = String(body.displayName ?? "").trim(); const department = String(body.department ?? "").trim(); const password = String(body.password ?? "");
      if (!/^[a-z][a-z0-9._-]{2,31}$/.test(username)) return badRequest(res, req, "账号须为 3-32 位小写字母、数字或 ._- 组合"); if (!displayName || displayName.length > 80) return badRequest(res, req, "请输入有效姓名"); const issue = passwordIssue(password); if (issue) return badRequest(res, req, issue);
      const exists = await query("SELECT 1 FROM users WHERE lower(username)=lower($1) UNION ALL SELECT 1 FROM registration_requests WHERE lower(username)=lower($1) AND status='pending' LIMIT 1", [username]); if (exists.rowCount) return sendJson(res, req, 409, { error: "账号已存在或正在审核" });
      await query("INSERT INTO registration_requests(id,username,display_name,department,password_hash) VALUES($1,$2,$3,$4,$5)", [randomUUID(), username, displayName, department, await hashPassword(password)]); return sendJson(res, req, 201, { ok: true, message: "注册申请已提交，请等待管理员审核" });
    }
    if (req.method === "GET" && url.pathname === "/api/auth/register/status") { const username = String(url.searchParams.get("username") ?? "").trim().toLowerCase(); if (!username) return badRequest(res, req, "缺少账号"); const result = await query<{status:string}>("SELECT status FROM registration_requests WHERE lower(username)=lower($1) ORDER BY created_at DESC LIMIT 1", [username]); return sendJson(res, req, 200, { status: result.rows[0]?.status ?? "not_found" }) }
    const user = await requireUser(req, res); if (!user) return
    if (req.method === "GET" && url.pathname === "/api/admin/overview") { const admin = await requireAdmin(req, res); if (!admin) return; const [users, pending, departments, logs] = await Promise.all([query("SELECT count(*)::int AS total, count(*) FILTER (WHERE status='active')::int AS active, count(*) FILTER (WHERE role='admin')::int AS admins FROM users"), query("SELECT count(*)::int AS total FROM registration_requests WHERE status='pending'"), query("SELECT count(*)::int AS total FROM departments WHERE status='active'"), query("SELECT count(*)::int AS total FROM audit_logs WHERE created_at>now()-interval '24 hours'")]); return sendJson(res, req, 200, { users: users.rows[0], pendingRegistrations: pending.rows[0]?.total ?? 0, departments: departments.rows[0]?.total ?? 0, audit24h: logs.rows[0]?.total ?? 0 }) }
    if (req.method === "GET" && url.pathname === "/api/admin/users") { const admin = await requireAdmin(req, res); if (!admin) return; const result = await query("SELECT id,username,display_name,department,employee_code,role,status,created_at FROM users ORDER BY created_at DESC"); return sendJson(res, req, 200, { users: result.rows }) }
    if (req.method === "GET" && url.pathname === "/api/admin/registrations") { const admin = await requireAdmin(req, res); if (!admin) return; const result = await query("SELECT id,username,display_name,department,status,created_at FROM registration_requests ORDER BY created_at DESC"); return sendJson(res, req, 200, { registrations: result.rows }) }
    const registrationMatch = url.pathname.match(/^\/api\/admin\/registrations\/([^/]+)\/(approve|reject)$/)
    if (registrationMatch && req.method === "POST") { const admin = await requireAdmin(req, res); if (!admin) return; const requestId = registrationMatch[1]; const action = registrationMatch[2]; const result = await query<{id:string;username:string;display_name:string;department:string;password_hash:string}>("SELECT id,username,display_name,department,password_hash FROM registration_requests WHERE id=$1 AND status='pending'", [requestId]); if (!result.rowCount) return sendJson(res, req, 404, { error: "registration_not_found" }); if (action === "reject") { await query("UPDATE registration_requests SET status='rejected',reviewed_by=$1,reviewed_at=now() WHERE id=$2", [admin.id, requestId]); await audit(req, admin.id, "registration_rejected", "registration", requestId); return sendJson(res, req, 200, { ok: true }) } const item=result.rows[0]; const existing=await query("SELECT 1 FROM users WHERE lower(username)=lower($1)",[item.username]); if(existing.rowCount) return sendJson(res, req, 409, {error:"账号已存在"}); const userId=randomUUID(); const employeeCode=await nextEmployeeDigitalCode(); await query("INSERT INTO users(id,username,display_name,department,employee_code,password_hash,role,status) VALUES($1,$2,$3,$4,$5,$6,'user','active')",[userId,item.username,item.display_name,item.department,employeeCode,item.password_hash]); await ensureEmployeeApprovalDigitalConfig(userId); await query("UPDATE registration_requests SET status='approved',reviewed_by=$1,reviewed_at=now() WHERE id=$2",[admin.id,requestId]); await audit(req,admin.id,"registration_approved","registration",requestId,{userId}); return sendJson(res,req,200,{ok:true,userId}) }
    if (req.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/status")) { const admin = await requireAdmin(req, res); if (!admin) return; const id=url.pathname.split("/")[4]; if(id===admin.id) return badRequest(res,req,"不能停用当前管理员账号"); const body=await readJson(req); const status=body.status==="disabled"?"disabled":"active"; const result=await query("UPDATE users SET status=$1,updated_at=now() WHERE id=$2 RETURNING id",[status,id]); if(!result.rowCount) return sendJson(res,req,404,{error:"user_not_found"}); await audit(req,admin.id,"user_status_changed","user",id,{status}); return sendJson(res,req,200,{ok:true,status}) }
    if (req.method === "POST" && url.pathname.startsWith("/api/admin/users/") && url.pathname.endsWith("/role")) { const admin = await requireAdmin(req, res); if (!admin) return; const id=url.pathname.split("/")[4]; const body=await readJson(req); const role=String(body.role ?? "").trim(); const allowed=new Set(["user","department_manager","attendance_supervisor","admin"]); if(!allowed.has(role)) return badRequest(res,req,"无效的用户角色"); if(id===admin.id && role!=="admin") return badRequest(res,req,"不能取消当前管理员的管理员角色"); const result=await query("UPDATE users SET role=$1,updated_at=now() WHERE id=$2 RETURNING id",[role,id]); if(!result.rowCount) return sendJson(res,req,404,{error:"user_not_found"}); await ensureEmployeeApprovalDigitalConfig(id); await audit(req,admin.id,"user_role_changed","user",id,{role}); return sendJson(res,req,200,{ok:true,role}) }
    if (req.method === "GET" && url.pathname === "/api/admin/audit") { const admin = await requireAdmin(req, res); if (!admin) return; const result = await query("SELECT a.id,a.action,a.resource_type,a.resource_id,a.ip,a.created_at,u.username FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 200"); return sendJson(res, req, 200, { logs: result.rows }) }
    if (req.method === "GET" && url.pathname === "/api/digital-libraries") { return sendJson(res, req, 200, { libraries: await listDataLibraries(user.id, user.role === "admin") }) }
    if (req.method === "GET" && url.pathname === "/api/model-library/models") {
      const result = await query<any>(`
        SELECT m.id,m.name,m.category,m.description,m.can_start,
               COALESCE(p.id,'') AS project_id,
               COALESCE(p.status,'system') AS project_status,
               COALESCE(p.configuration->>'modelCode','') AS model_code,
               COALESCE(p.configuration->'digitalIdentities'->>0,'') AS digital_id,
               COALESCE(l.id,'') AS library_id,
               COALESCE(l.name,'') AS library_name,
               COALESCE(COUNT(r.id) FILTER (WHERE ($2::boolean OR r.owner_id=$1)),0)::int AS run_count
        FROM models m
        LEFT JOIN model_projects p ON p.model_id=m.id
        LEFT JOIN digital_libraries l ON l.model_id=m.id AND l.status='active'
        LEFT JOIN model_runs r ON r.model_id=m.id
        GROUP BY m.id,m.name,m.category,m.description,m.can_start,p.id,p.status,p.configuration,l.id,l.name
        ORDER BY m.category,m.name
      `, [user.id, user.role === "admin"])
      return sendJson(res, req, 200, { models: result.rows.map((row:any) => ({
        id:String(row.id ?? ""),
        name:String(row.name ?? ""),
        category:String(row.category ?? ""),
        description:String(row.description ?? ""),
        canStart:Boolean(row.can_start),
        projectId:String(row.project_id ?? ""),
        projectStatus:String(row.project_status ?? "system"),
        modelCode:String(row.model_code ?? ""),
        digitalId:String(row.digital_id ?? ""),
        libraryId:String(row.library_id ?? ""),
        libraryName:String(row.library_name ?? ""),
        runCount:Number(row.run_count ?? 0),
      })) })
    }
    if (req.method === "GET" && url.pathname === "/api/digital-identifiers") { return sendJson(res, req, 200, { identifiers: await listDigitalIdentifiers() }) }
    if (req.method === "GET" && url.pathname === "/api/digital-library/records") { const library=String(url.searchParams.get("libraryId") ?? url.searchParams.get("library") ?? "").trim(); const limit=Number(url.searchParams.get("limit") ?? 200); return sendJson(res, req, 200, { records: await listDataLibraryRecords(user.id, library, limit, user.role === "admin") }) }
    if (req.method === "GET" && url.pathname === "/api/digital-library/lookup") {
      const library = String(url.searchParams.get("library") ?? "").trim(); const libraryId = String(url.searchParams.get("libraryId") ?? "").trim(); const sourceField = String(url.searchParams.get("sourceField") ?? "").trim(); const sourceDigitalId = String(url.searchParams.get("sourceDigitalId") ?? "").trim(); const matchField = String(url.searchParams.get("matchField") ?? "").trim(); const matchDigitalId = String(url.searchParams.get("matchDigitalId") ?? "").trim(); const triggerValue = url.searchParams.get("triggerValue"); const mode = url.searchParams.get("mode") === "options" ? "options" : "fill"
      return sendJson(res, req, 200, await lookupDataLibrary(user.id, { library, libraryId, sourceField, sourceDigitalId, matchField, matchDigitalId, triggerValue, mode }))
    }
    if (req.method === "POST" && url.pathname === "/api/model-expression/evaluate") {
      const body = await readJson(req); const expression = String(body.expression ?? ""); const rawValues = body.values; const values = rawValues && typeof rawValues === "object" && !Array.isArray(rawValues) ? rawValues as Record<string, unknown> : {}
      try { return sendJson(res, req, 200, { value: evaluateExpression(expression, values) }) } catch (error) { if (error instanceof ExpressionError) return badRequest(res, req, error.message); throw error }
    }
    if (req.method === "GET" && url.pathname === "/api/model-builder/templates") { return sendJson(res, req, 200, { templates: getTemplateCatalog() }) }
    if (req.method === "GET" && url.pathname === "/api/model-builder") { return sendJson(res, req, 200, { projects: await listProjects() }) }
    if (req.method === "POST" && url.pathname === "/api/model-builder") { const body = await readJson(req); const project = await createProject(user.id, body); await audit(req, user.id, "model_project_created", "model_project", project.id, { modelId: project.modelId, name: project.name }); return sendJson(res, req, 201, { project }) }
    if (req.method === "GET" && url.pathname === "/api/model-definition") { const name = String(url.searchParams.get("name") ?? "").trim(); if (!name) return badRequest(res, req, "缺少模型名称"); const project = await getPublishedByName(name); if (!project) return sendJson(res, req, 404, { error: "模型未发布或不存在" }); return sendJson(res, req, 200, { project }) }
    const reviseProjectMatch = url.pathname.match(/^\/api\/model-builder\/([^/]+)\/revise$/)
    if (reviseProjectMatch && req.method === "POST") { const project = await startProjectRevision(user.id, reviseProjectMatch[1]); await audit(req,user.id,"model_revision_started","model_project",reviseProjectMatch[1],{version:project.version}); return sendJson(res,req,200,{project,stages:await listBuildStageExecutions(reviseProjectMatch[1])}) }
    const buildStageStatusMatch = url.pathname.match(/^\/api\/model-builder\/([^/]+)\/stage-models$/)
    if (buildStageStatusMatch && req.method === "GET") { return sendJson(res, req, 200, { stages: await listBuildStageExecutions(buildStageStatusMatch[1]) }) }
    const buildStageSubmitMatch = url.pathname.match(/^\/api\/model-builder\/([^/]+)\/(suggestion|design|test|config)\/submit$/)
    if (buildStageSubmitMatch && req.method === "POST") { const result = await submitBuildStage(user, buildStageSubmitMatch[1], buildStageSubmitMatch[2]); await audit(req,user.id,"model_build_stage_submitted","model_project",buildStageSubmitMatch[1],{stage:buildStageSubmitMatch[2],runId:result.result.runId}); return sendJson(res,req,200,result) }
    const builderMatch = url.pathname.match(/^\/api\/model-builder\/([^/]+)(?:\/(suggestion|design|test|config|run-tests|publish))?$/)
    if (builderMatch && req.method === "GET" && !builderMatch[2]) { return sendJson(res, req, 200, { project: await getProject(builderMatch[1]) }) }
    if (builderMatch && req.method === "PATCH" && ["suggestion","design","test","config"].includes(builderMatch[2] ?? "")) { const body = await readJson(req); const project = await saveStage(user.id, builderMatch[1], builderMatch[2]!, body.data ?? body); await audit(req, user.id, "model_stage_saved", "model_project", builderMatch[1], { stage: builderMatch[2] }); return sendJson(res, req, 200, { project }) }
    if (builderMatch && req.method === "POST" && builderMatch[2] === "run-tests") { const body = await readJson(req); const report = await runTests(user.id, builderMatch[1], body.cases); await audit(req, user.id, "model_tests_executed", "model_project", builderMatch[1], { passed: report.passed, total: report.total }); return sendJson(res, req, 200, { report, project: await getProject(builderMatch[1]) }) }
    if (builderMatch && req.method === "POST" && builderMatch[2] === "publish") { const project = await publishProject(user.id, builderMatch[1]); await audit(req, user.id, "model_published", "model_project", builderMatch[1], { modelId: project.modelId, name: project.name }); return sendJson(res, req, 200, { project }) }
    if (req.method === "GET" && url.pathname === "/api/dashboard") {
      const todos = await query<Todo>("SELECT id,title,model,sender,to_char(COALESCE(due_at,created_at),'YYYY-MM-DD HH24:MI') AS date,status,content FROM todos WHERE owner_id=$1 AND status NOT IN ('已完成','已退回') ORDER BY created_at DESC", [user.id])
      // 已办：既保留“本人已经办理的动作”，也保留本人发起业务模型的模型簇追溯入口。
      // 模型簇入口不是进度页面；展开后审批模型/智选模型都直接打开对应模型运行记录。
      const done = await query<Todo & { handled_result:string; handled_at:string; record_kind:string }>(`
        SELECT id,title,model,sender,date,status,content,handled_result,handled_at,record_kind
        FROM (
          SELECT t.id,t.title,t.model,t.sender,
            to_char(COALESCE(t.handled_at,t.created_at),'YYYY-MM-DD HH24:MI') AS date,
            t.status,
            CASE WHEN rm.name IN ('审批模型','智选模型') AND rr.id IS NOT NULL THEN jsonb_build_object(
              'type','model_run','runKind',CASE WHEN rm.name='审批模型' THEN 'approval' ELSE 'smart' END,
              'runId',rr.id,'fileName',rr.file_name,'displayFileName',rr.display_file_name,'digitalId',rr.digital_id,
              'sourceModelName',sm.name,'status',rr.status,'input',rr.input_data,'output',rr.output_data,
              'handledRecord',jsonb_build_object('todoId',t.id,'result',t.handled_result,'handledAt',t.handled_at,'content',t.content)
            )::text ELSE t.content END AS content,
            COALESCE(t.handled_result,'已完成') AS handled_result,
            to_char(COALESCE(t.handled_at,t.created_at),'YYYY-MM-DD HH24:MI') AS handled_at,
            CASE WHEN rm.name='审批模型' THEN 'approval_run' WHEN rm.name='智选模型' THEN 'launched' ELSE 'handled' END::text AS record_kind,
            COALESCE(t.handled_at,t.created_at) AS sort_time
          FROM todos t
          LEFT JOIN model_runs rr ON rr.id=t.run_id
          LEFT JOIN models rm ON rm.id=rr.model_id
          LEFT JOIN model_runs rs ON rs.id=rr.source_run_id
          LEFT JOIN models sm ON sm.id=rs.model_id
          WHERE t.owner_id=$1 AND t.status IN ('已完成','已退回')

          UNION ALL

          SELECT 'business-activity:' || br.id AS id,
            COALESCE(NULLIF(br.display_file_name,''),br.file_name) AS title,
            bm.name AS model,u.display_name AS sender,
            to_char(COALESCE(br.completed_at,br.created_at),'YYYY-MM-DD HH24:MI') AS date,
            br.status,
            jsonb_build_object(
              'type','business_model_activity_v2','rootRunId',br.id,'fileName',br.file_name,'displayFileName',br.display_file_name,
              'digitalId',br.digital_id,'businessStatus',br.status,'input',br.input_data,'output',br.output_data,
              'phase',CASE
                WHEN ar.id IS NULL OR ar.status<>'已归档' THEN '申请阶段'
                WHEN COALESCE(NULLIF(ar.output_data->>'approvalStatus',''),NULLIF(ar.output_data->>'approvalResult',''),'') IN ('审批通过','同意','通过') THEN '有效阶段'
                ELSE '审批终止/未生效' END,
              'approval',CASE WHEN ar.id IS NULL THEN NULL ELSE jsonb_build_object(
                'runId',ar.id,'fileName',ar.file_name,'displayFileName',ar.display_file_name,'status',ar.status,
                'result',COALESCE(NULLIF(ar.output_data->>'approvalStatus',''),NULLIF(ar.output_data->>'approvalResult',''),ar.status),
                'input',ar.input_data,'output',ar.output_data,'sourceModelName',bm.name,'runKind','approval'
              ) END,
              'smart',CASE WHEN sr.id IS NULL THEN NULL ELSE jsonb_build_object(
                'runId',sr.id,'fileName',sr.file_name,'displayFileName',sr.display_file_name,'status',sr.status,
                'result',COALESCE(NULLIF(sr.output_data->>'smartDecision',''),NULLIF(sr.output_data->>'approvalResult',''),sr.status),
                'input',sr.input_data,'output',sr.output_data,'sourceModelName','审批模型','runKind','smart'
              ) END
            )::text AS content,
            CASE
              WHEN ar.id IS NULL OR ar.status<>'已归档' THEN '申请阶段'
              WHEN COALESCE(NULLIF(ar.output_data->>'approvalStatus',''),NULLIF(ar.output_data->>'approvalResult',''),'') IN ('审批通过','同意','通过') THEN '有效阶段'
              ELSE '审批终止/未生效' END AS handled_result,
            to_char(COALESCE(br.completed_at,br.created_at),'YYYY-MM-DD HH24:MI') AS handled_at,
            'cluster'::text AS record_kind,
            COALESCE(br.completed_at,br.created_at) AS sort_time
          FROM model_runs br
          JOIN models bm ON bm.id=br.model_id
          JOIN users u ON u.id=br.owner_id
          LEFT JOIN model_projects bp ON bp.id=br.project_id
          LEFT JOIN LATERAL (
            SELECT ar0.* FROM model_runs ar0 JOIN models am ON am.id=ar0.model_id
            WHERE am.name='审批模型' AND (
              ar0.source_run_id=br.id
              OR ar0.input_data->>'sourceRunId'=br.id::text
              OR ar0.input_data->>'sourceFileName'=br.file_name
              OR ar0.input_data->>'前序模型文件名'=br.file_name
            )
            ORDER BY ar0.created_at DESC LIMIT 1
          ) ar ON true
          LEFT JOIN LATERAL (
            SELECT sr0.* FROM model_runs sr0 JOIN models sm0 ON sm0.id=sr0.model_id
            WHERE sm0.name='智选模型' AND (
              sr0.source_run_id=ar.id
              OR sr0.input_data->>'sourceRunId'=ar.id::text
              OR sr0.input_data->>'sourceFileName'=ar.file_name
              OR sr0.input_data->>'前序模型文件名'=ar.file_name
              OR sr0.input_data->>'businessRunId'=br.id::text
              OR sr0.input_data->>'businessFileName'=br.file_name
              OR sr0.input_data->>'业务模型文件名'=br.file_name
              OR EXISTS (
                SELECT 1 FROM todos smart_todo
                WHERE smart_todo.run_id=sr0.id AND smart_todo.model='智选模型'
                  AND smart_todo.content LIKE '%' || br.file_name || '%'
              )
            )
            ORDER BY sr0.created_at DESC LIMIT 1
          ) sr ON true
          WHERE br.owner_id=$1
            AND COALESCE(br.trigger_mode,'manual')='manual'
            AND COALESCE(bp.suggestion->>'modelType','business')='business'
        ) activity
        ORDER BY sort_time DESC`, [user.id])

      // 办结：单个模型自身已经完成并归档；业务模型仍保留申请/有效阶段和关联模型追溯。
      const completed = await query<Todo & { handled_result:string; handled_at:string; record_kind:string }>(`
        SELECT r.id,
          COALESCE(NULLIF(r.display_file_name,''),r.file_name) AS title,
          m.name AS model,
          u.display_name AS sender,
          to_char(COALESCE(r.completed_at,r.created_at),'YYYY-MM-DD HH24:MI') AS date,
          r.status,
          jsonb_build_object(
            'type','completed_model_v1',
            'runId',r.id,
            'runKind',CASE WHEN m.name='审批模型' THEN 'approval' WHEN m.name='智选模型' THEN 'smart' ELSE COALESCE(NULLIF(p.suggestion->>'modelType',''),'business') END,
            'fileName',r.file_name,
            'displayFileName',r.display_file_name,
            'digitalId',r.digital_id,
            'sourceRunId',r.source_run_id,
            'sourceModelName',sm.name,
            'input',r.input_data,
            'output',r.output_data,
            'status',r.status,
            'phase',CASE WHEN m.name IN ('审批模型','智选模型') THEN NULL
              WHEN ar.id IS NULL OR ar.status<>'已归档' THEN '申请阶段'
              WHEN COALESCE(NULLIF(ar.output_data->>'approvalStatus',''),NULLIF(ar.output_data->>'approvalResult',''),'') IN ('审批通过','同意','通过') THEN '有效阶段'
              ELSE '审批终止/未生效' END,
            'approval',CASE WHEN ar.id IS NULL THEN NULL ELSE jsonb_build_object(
              'runId',ar.id,'fileName',ar.file_name,'displayFileName',ar.display_file_name,
              'status',ar.status,'digitalId',ar.digital_id,'input',ar.input_data,'output',ar.output_data,
              'sourceModelName',m.name,'runKind','approval'
            ) END,
            'smart',CASE WHEN sr.id IS NULL THEN NULL ELSE jsonb_build_object(
              'runId',sr.id,'fileName',sr.file_name,'displayFileName',sr.display_file_name,
              'status',sr.status,'digitalId',sr.digital_id,'input',sr.input_data,'output',sr.output_data,
              'sourceModelName','审批模型','runKind','smart'
            ) END
          )::text AS content,
          '已办结'::text AS handled_result,
          to_char(COALESCE(r.completed_at,r.created_at),'YYYY-MM-DD HH24:MI') AS handled_at,
          'completed_run'::text AS record_kind
        FROM model_runs r
        JOIN models m ON m.id=r.model_id
        JOIN users u ON u.id=r.owner_id
        LEFT JOIN model_projects p ON p.id=r.project_id
        LEFT JOIN model_runs source_run ON source_run.id=r.source_run_id
        LEFT JOIN models sm ON sm.id=source_run.model_id
        LEFT JOIN LATERAL (
          SELECT child.* FROM model_runs child JOIN models cm ON cm.id=child.model_id
          WHERE cm.name='审批模型' AND (
            child.source_run_id=r.id
            OR child.input_data->>'sourceRunId'=r.id::text
            OR child.input_data->>'sourceFileName'=r.file_name
            OR child.input_data->>'前序模型文件名'=r.file_name
          )
          ORDER BY child.created_at DESC LIMIT 1
        ) ar ON true
        LEFT JOIN LATERAL (
          SELECT smart_run.* FROM model_runs smart_run JOIN models stm ON stm.id=smart_run.model_id
          WHERE stm.name='智选模型' AND (
            smart_run.source_run_id=ar.id
            OR smart_run.input_data->>'sourceRunId'=ar.id::text
            OR smart_run.input_data->>'sourceFileName'=ar.file_name
            OR smart_run.input_data->>'前序模型文件名'=ar.file_name
            OR smart_run.input_data->>'businessRunId'=r.id::text
            OR smart_run.input_data->>'businessFileName'=r.file_name
            OR smart_run.input_data->>'业务模型文件名'=r.file_name
            OR EXISTS (
              SELECT 1 FROM todos smart_todo
              WHERE smart_todo.run_id=smart_run.id AND smart_todo.model='智选模型'
                AND smart_todo.content LIKE '%' || r.file_name || '%'
            )
          )
          ORDER BY smart_run.created_at DESC LIMIT 1
        ) sr ON true
        WHERE r.status='已归档'
          AND (
            r.owner_id=$1
            OR EXISTS (
              SELECT 1 FROM todos handled_todo
              WHERE handled_todo.run_id=r.id AND handled_todo.owner_id=$1
                AND handled_todo.status IN ('已完成','已退回')
            )
          )
        ORDER BY COALESCE(r.completed_at,r.created_at) DESC`, [user.id])

      const metricResult = await query<{ today_completed:string; today_work_records:string; today_handled:string }>(`
        SELECT
          (SELECT COUNT(DISTINCT r.id)::text
           FROM model_runs r
           JOIN digital_library_records dlr ON dlr.run_id=r.id
           WHERE r.status='已归档' AND dlr.created_at::date=CURRENT_DATE
             AND (r.owner_id=$1 OR EXISTS (
               SELECT 1 FROM todos t WHERE t.run_id=r.id AND t.owner_id=$1 AND t.status IN ('已完成','已退回')
             ))) AS today_completed,
          (SELECT COUNT(*)::text FROM digital_library_records dlr WHERE dlr.owner_id=$1 AND dlr.created_at::date=CURRENT_DATE) AS today_work_records,
          (SELECT COUNT(*)::text FROM todos t WHERE t.owner_id=$1 AND t.handled_at::date=CURRENT_DATE AND t.status IN ('已完成','已退回')) AS today_handled`, [user.id])
      const rankResult = await query<{ rank:string; active_users:string }>(`
        WITH daily AS (
          SELECT owner_id,COUNT(*) AS total
          FROM digital_library_records
          WHERE created_at::date=CURRENT_DATE
          GROUP BY owner_id
        ), ranked AS (
          SELECT owner_id,RANK() OVER (ORDER BY total DESC,owner_id) AS rank
          FROM daily
        )
        SELECT COALESCE((SELECT rank::text FROM ranked WHERE owner_id=$1),'0') AS rank,
               COALESCE((SELECT COUNT(*)::text FROM daily),'0') AS active_users`, [user.id])
      const metricRow=metricResult.rows[0] ?? {today_completed:'0',today_work_records:'0',today_handled:'0'}
      const rankRow=rankResult.rows[0] ?? {rank:'0',active_users:'0'}
      const metrics = {
        todayCompleted:Number(metricRow.today_completed ?? 0),
        todayWorkRecords:Number(metricRow.today_work_records ?? 0),
        todayHandled:Number(metricRow.today_handled ?? 0),
        rank:Number(rankRow.rank ?? 0),
        activeUsers:Number(rankRow.active_users ?? 0),
        rankLabel:'今日数字化成果数排名',
      }
      return sendJson(res, req, 200, { user: userView(user), todos: todos.rows, done: done.rows, completed: completed.rows, metrics: metrics })
    }
    const modelRunDetailMatch = url.pathname.match(/^\/api\/model-runs\/([^/]+)\/detail$/)
    if (req.method === "GET" && modelRunDetailMatch) {
      const runId = decodeURIComponent(modelRunDetailMatch[1])
      const runResult = await query<any>(`SELECT r.id,r.file_name,r.display_file_name,r.digital_id,r.status,r.trigger_mode,r.source_run_id,r.input_data,r.output_data,r.created_at,r.completed_at,m.name AS model_name,u.display_name AS owner_name
        FROM model_runs r JOIN models m ON m.id=r.model_id JOIN users u ON u.id=r.owner_id
        WHERE r.id=$1 AND m.name='智选模型'
          AND ($3='admin' OR r.owner_id=$2 OR EXISTS(SELECT 1 FROM todos t WHERE t.run_id=r.id AND t.owner_id=$2))
        LIMIT 1`, [runId,user.id,user.role])
      if (!runResult.rowCount) return sendJson(res, req, 404, { error: "smart_run_not_found" })
      const smart = runResult.rows[0]
      const smartInput = smart.input_data && typeof smart.input_data === "object" && !Array.isArray(smart.input_data) ? smart.input_data as Record<string,unknown> : {}
      const sourceRunId = String(smart.source_run_id ?? smartInput.sourceRunId ?? "")
      const sourceFileName = String(smartInput["前序模型文件名"] ?? smartInput.sourceFileName ?? "")
      const approvalResult = await query<any>(`SELECT r.id,r.file_name,r.display_file_name,r.digital_id,r.status,r.source_run_id,r.input_data,r.output_data,r.created_at,r.completed_at,m.name AS model_name
        FROM model_runs r JOIN models m ON m.id=r.model_id
        WHERE m.name='审批模型' AND (($1<>'' AND r.id=$1) OR ($2<>'' AND r.file_name=$2))
        ORDER BY CASE WHEN r.id=$1 THEN 0 ELSE 1 END,r.created_at DESC LIMIT 1`, [sourceRunId,sourceFileName])
      const approval = approvalResult.rows[0] ?? null
      const approvalInput = approval?.input_data && typeof approval.input_data === "object" && !Array.isArray(approval.input_data) ? approval.input_data as Record<string,unknown> : {}
      const businessRunId = String(smartInput.businessRunId ?? smartInput["业务模型运行ID"] ?? approval?.source_run_id ?? approvalInput.sourceRunId ?? "")
      const businessFileName = String(smartInput["业务模型文件名"] ?? smartInput.businessFileName ?? approvalInput["前序模型文件名"] ?? approvalInput.sourceFileName ?? "")
      const businessResult = await query<any>(`SELECT r.id,r.file_name,r.display_file_name,r.digital_id,r.status,r.input_data,r.output_data,r.created_at,r.completed_at,m.name AS model_name,u.display_name AS owner_name
        FROM model_runs r JOIN models m ON m.id=r.model_id JOIN users u ON u.id=r.owner_id
        WHERE m.name NOT IN ('审批模型','智选模型') AND (($1<>'' AND r.id=$1) OR ($2<>'' AND r.file_name=$2))
        ORDER BY CASE WHEN r.id=$1 THEN 0 ELSE 1 END,r.created_at DESC LIMIT 1`, [businessRunId,businessFileName])
      const business = businessResult.rows[0] ?? null
      const smartLibraryResult = await query<any>(`SELECT library_name,digital_id,identifier_values,data,created_at FROM digital_library_records WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1`, [smart.id])
      const approvalLibraryResult = approval?.id ? await query<any>(`SELECT library_name,digital_id,identifier_values,data,created_at FROM digital_library_records WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1`, [approval.id]) : { rows: [] as any[] }
      const businessLibraryResult = business?.id ? await query<any>(`SELECT library_name,digital_id,identifier_values,data,created_at FROM digital_library_records WHERE run_id=$1 ORDER BY created_at DESC LIMIT 1`, [business.id]) : { rows: [] as any[] }
      // model_runs 仅用于运行定位、文件名、状态和关联追溯；业务字段的正式展示值必须来自对应数字化库。
      const normalizeRun = (row:any) => row ? ({ id:String(row.id ?? ""), modelName:String(row.model_name ?? ""), ownerName:String(row.owner_name ?? ""), fileName:String(row.file_name ?? ""), displayFileName:String(row.display_file_name ?? ""), digitalId:String(row.digital_id ?? ""), status:String(row.status ?? ""), sourceRunId:String(row.source_run_id ?? ""), triggerMode:String(row.trigger_mode ?? ""), createdAt:row.created_at ?? null, completedAt:row.completed_at ?? null }) : null
      const normalizeLibrary = (row:any) => row ? ({ libraryName:String(row.library_name ?? ""), digitalId:String(row.digital_id ?? ""), identifierValues:row.identifier_values && typeof row.identifier_values === "object" ? row.identifier_values : {}, data:row.data && typeof row.data === "object" ? row.data : {}, createdAt:row.created_at ?? null }) : null
      return sendJson(res, req, 200, { detail: { run:normalizeRun(smart), sourceApproval:normalizeRun(approval), businessRun:normalizeRun(business), smartDigitalRecord:normalizeLibrary(smartLibraryResult.rows[0] ?? null), sourceApprovalDigitalRecord:normalizeLibrary(approvalLibraryResult.rows[0] ?? null), businessDigitalRecord:normalizeLibrary(businessLibraryResult.rows[0] ?? null) } })
    }
    if (req.method === "GET" && url.pathname === "/api/models") {
      const models = await query(`SELECT m.id,m.name,m.category,m.description,m.can_start
        FROM models m
        LEFT JOIN model_projects p ON p.model_id=m.id AND p.status='published'
        WHERE m.can_start=true
          AND (
            p.id IS NULL
            OR COALESCE(p.configuration->'startModes','[]'::jsonb) ? 'manual'
          )
          AND NOT (p.id IS NULL AND m.name IN ('审批模型','智选模型'))
          AND ($1='admin' OR m.category NOT IN ('模型建设','数字化管理','基础标准','数字化标准','组织标准','审批标准','会议标准','公共标准','运行标准','数字化配置','审批配置','智选配置'))
        ORDER BY m.category,m.name`, [user.role])
      return sendJson(res, req, 200, { models: models.rows })
    }
    if (req.method === "POST" && url.pathname === "/api/leave-requests") {
      const body = await readJson(req)
      const values = { applicant: user.display_name, department: user.department, leaveType: String(body.leaveType ?? "").trim(), startDate: String(body.startDate ?? "").trim(), endDate: String(body.endDate ?? "").trim(), reason: String(body.reason ?? "").trim() }
      const result = await runPublishedModel(user, "请休假模型", values, { triggerMode: "manual" })
      await audit(req, user.id, "leave_request_archived", "model", "请休假模型", { values, fileName: result.fileName, digitalId: result.digitalId, output: result.output, triggeredModel: result.triggeredModel })
      return sendJson(res, req, 201, result)
    }
    if (req.method === "POST" && url.pathname === "/api/model-runs") {
      const body = await readJson(req); const modelName = String(body.modelName ?? "").trim(); const rawValues = body.values; const values = rawValues && typeof rawValues === "object" ? rawValues as Record<string, unknown> : {}
      if (!modelName || modelName.length > 120) return badRequest(res, req, "请选择有效的模型")
      const result = await runPublishedModel(user, modelName, values, { triggerMode: "manual" })
      await audit(req, user.id, "model_run_started", "model", modelName, { values, fileName: result.fileName, digitalId: result.digitalId, output: result.output, triggeredModels: result.triggeredModels ?? [] })
      return sendJson(res, req, 201, result)
    }
    if (req.method === "GET" && url.pathname === "/api/notices") {
      const result = await query("WITH unique_notices AS (SELECT DISTINCT ON (lower(trim(title)), lower(trim(type)), published_at) id,title,type,published_at,content,created_at FROM notices ORDER BY lower(trim(title)),lower(trim(type)),published_at,created_at ASC,id ASC) SELECT id,title,type,to_char(published_at,'YYYY-MM-DD') AS date,content FROM unique_notices ORDER BY published_at DESC,created_at DESC,title ASC")
      return sendJson(res, req, 200, { notices: result.rows })
    }
    if (req.method === "GET" && url.pathname === "/api/todos") { const status = url.searchParams.get("status"); const args: unknown[] = [user.id]; const condition = status ? "AND status=$2" : "AND status NOT IN ('已完成','已退回')"; if (status) args.push(status); const result = await query(`SELECT id,title,model,sender,to_char(COALESCE(due_at,created_at),'YYYY-MM-DD HH24:MI') AS date,status,content FROM todos WHERE owner_id=$1 ${condition} ORDER BY created_at DESC`, args); return sendJson(res, req, 200, { todos: result.rows }) }
    const todoMatch = url.pathname.match(/^\/api\/todos\/([^/]+)(?:\/handle)?$/)
    if (req.method === "GET" && todoMatch) { const result = await query("SELECT id,title,model,sender,status,content,to_char(COALESCE(due_at,created_at),'YYYY-MM-DD HH24:MI') AS date,handled_result,to_char(handled_at,'YYYY-MM-DD HH24:MI') AS handled_at FROM todos WHERE id=$1 AND owner_id=$2", [todoMatch[1], user.id]); if (!result.rowCount) return sendJson(res, req, 404, { error: "not_found" }); return sendJson(res, req, 200, { todo: result.rows[0] }) }
    if (req.method === "POST" && todoMatch && url.pathname.endsWith("/handle")) {
      const body = await readJson(req); const resultName = String(body.result ?? "").trim(); if (!resultName || resultName.length > 50) return badRequest(res, req, "无效的办理结果")
      const modelResult = await handleModelTodo(user, todoMatch[1], resultName)
      if (modelResult.handled) {
        await audit(req, user.id, "approval_model_todo_handled", "todo", todoMatch[1], { result: resultName, runId: modelResult.runId, completed: modelResult.completed })
        return sendJson(res, req, 200, { ok: true, result: resultName, ...modelResult })
      }
      const current = await query<{ model: string; content: string }>("SELECT model,content FROM todos WHERE id=$1 AND owner_id=$2", [todoMatch[1], user.id]); if (!current.rowCount) return sendJson(res, req, 404, { error: "not_found" })
      const updated = await query("UPDATE todos SET status=CASE WHEN $1='退回修改' THEN '已退回' ELSE '已完成' END,handled_result=$1,handled_at=now(),updated_at=now() WHERE id=$2 AND owner_id=$3 RETURNING id", [resultName, todoMatch[1], user.id]); if (!updated.rowCount) return sendJson(res, req, 404, { error: "not_found" })
      await audit(req, user.id, "todo_handled", "todo", todoMatch[1], { result: resultName })
      return sendJson(res, req, 200, { ok: true, result: resultName })
    }
    return sendJson(res, req, 404, { error: "not_found" })
  } catch (error) { if (error instanceof ModelBuilderError) return sendJson(res, req, error.status, { error: error.message }); console.error(error); return sendJson(res, req, 500, { error: "server_error" }) }
}

const server = createServer((req, res) => { void handle(req, res) })
server.keepAliveTimeout = 65_000
server.headersTimeout = 70_000
server.listen(PORT, "0.0.0.0", () => console.log(`Cockpit API listening on :${PORT}`))
const shutdown = async () => { server.close(); await closePool(); process.exit(0) }
process.once("SIGINT", shutdown); process.once("SIGTERM", shutdown)
