export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.name = "ApiError"; this.status = status }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { "Content-Type": "application/json", ...(options.headers ?? {}) }, ...options })
  const payload = await response.json().catch(() => ({})) as { error?: string; [key: string]: unknown }
  if (!response.ok) throw new ApiError(payload.error ?? `请求失败（${response.status}）`, response.status)
  return payload as T
}
