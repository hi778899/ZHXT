export class ExpressionError extends Error {}

type Token = { type: "number" | "string" | "identifier" | "operator" | "paren" | "comma" | "eof"; value: string; pos: number }

type Context = Record<string, unknown>

const isSpace = (ch: string) => /\s/.test(ch)
const isDigit = (ch: string) => /[0-9]/.test(ch)
const isIdentStart = (ch: string) => /[A-Za-z_$]/.test(ch)
const isIdent = (ch: string) => /[A-Za-z0-9_.$]/.test(ch)

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (isSpace(ch)) { i++; continue }
    if (isDigit(ch) || (ch === "." && isDigit(source[i + 1] ?? ""))) {
      const start = i; i++
      while (i < source.length && /[0-9.]/.test(source[i])) i++
      const raw = source.slice(start, i)
      if (!/^\d+(?:\.\d+)?$|^\.\d+$/.test(raw)) throw new ExpressionError(`数字格式错误（位置 ${start + 1}）`)
      tokens.push({ type: "number", value: raw, pos: start }); continue
    }
    if (ch === '"' || ch === "'") {
      const quote = ch; const start = i; i++; let value = ""
      let closed = false
      while (i < source.length) {
        const current = source[i++]
        if (current === quote) { closed = true; break }
        if (current === "\\") {
          if (i >= source.length) break
          const escaped = source[i++]
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped
        } else value += current
      }
      if (!closed) throw new ExpressionError(`字符串缺少结束引号（位置 ${start + 1}）`)
      tokens.push({ type: "string", value, pos: start }); continue
    }
    if (isIdentStart(ch)) {
      const start = i; i++
      while (i < source.length && isIdent(source[i])) i++
      tokens.push({ type: "identifier", value: source.slice(start, i), pos: start }); continue
    }
    const two = source.slice(i, i + 2)
    if ([">=", "<=", "==", "!=", "&&", "||"].includes(two)) { tokens.push({ type: "operator", value: two, pos: i }); i += 2; continue }
    if (["+", "-", "*", "/", ">", "<", "!"].includes(ch)) { tokens.push({ type: "operator", value: ch, pos: i }); i++; continue }
    if (ch === "(" || ch === ")") { tokens.push({ type: "paren", value: ch, pos: i }); i++; continue }
    if (ch === ",") { tokens.push({ type: "comma", value: ch, pos: i }); i++; continue }
    throw new ExpressionError(`不支持的字符“${ch}”（位置 ${i + 1}）`)
  }
  tokens.push({ type: "eof", value: "", pos: source.length })
  return tokens
}

const empty = (value: unknown) => value === undefined || value === null || String(value).trim() === ""
const num = (value: unknown) => { const n = Number(value); if (!Number.isFinite(n)) throw new ExpressionError(`“${String(value)}”不能转换为数字`); return n }
const truthy = (value: unknown) => Boolean(value)

const functions: Record<string, (...args: unknown[]) => unknown> = {
  DATE_DIFF_INCLUSIVE: (start, end) => {
    const a = new Date(`${String(start ?? "")}T00:00:00`).getTime(); const b = new Date(`${String(end ?? "")}T00:00:00`).getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new ExpressionError("DATE_DIFF_INCLUSIVE 需要两个有效日期")
    if (b < a) throw new ExpressionError("结束日期不能早于开始日期")
    return Math.floor((b - a) / 86400000) + 1
  },
  SUM: (...args) => args.reduce<number>((total, item) => total + num(item), 0),
  SUBTRACT: (a, b) => num(a) - num(b),
  CONCAT: (...args) => args.map(item => String(item ?? "")).join(""),
  IF: (condition, whenTrue, whenFalse) => truthy(condition) ? whenTrue : whenFalse,
  COALESCE: (...args) => args.find(item => !empty(item)) ?? "",
  LEN: (value) => String(value ?? "").length,
  ROUND: (value, digits = 0) => { const d = Math.max(0, Math.min(10, Math.trunc(num(digits)))); const factor = 10 ** d; return Math.round(num(value) * factor) / factor },
  ABS: (value) => Math.abs(num(value)),
  MIN: (...args) => Math.min(...args.map(num)),
  MAX: (...args) => Math.max(...args.map(num)),
}

class Parser {
  private index = 0
  constructor(private tokens: Token[], private context: Context) {}
  private current() { return this.tokens[this.index] }
  private eat(type?: Token["type"], value?: string) {
    const token = this.current()
    if (type && token.type !== type) throw new ExpressionError(`位置 ${token.pos + 1} 需要 ${type}`)
    if (value && token.value !== value) throw new ExpressionError(`位置 ${token.pos + 1} 需要“${value}”`)
    this.index++; return token
  }
  parse() {
    const result = this.parseOr()
    if (this.current().type !== "eof") throw new ExpressionError(`位置 ${this.current().pos + 1} 存在多余内容`)
    return result
  }
  private parseOr(): unknown { let left = this.parseAnd(); while (this.current().type === "operator" && this.current().value === "||") { this.eat("operator", "||"); const right = this.parseAnd(); left = truthy(left) || truthy(right) } return left }
  private parseAnd(): unknown { let left = this.parseEquality(); while (this.current().type === "operator" && this.current().value === "&&") { this.eat("operator", "&&"); const right = this.parseEquality(); left = truthy(left) && truthy(right) } return left }
  private parseEquality(): unknown { let left = this.parseCompare(); while (this.current().type === "operator" && ["==", "!="].includes(this.current().value)) { const op = this.eat("operator").value; const right = this.parseCompare(); left = op === "==" ? String(left ?? "") === String(right ?? "") : String(left ?? "") !== String(right ?? "") } return left }
  private parseCompare(): unknown { let left = this.parseAdd(); while (this.current().type === "operator" && [">", ">=", "<", "<="].includes(this.current().value)) { const op = this.eat("operator").value; const right = this.parseAdd(); const a = num(left), b = num(right); left = op === ">" ? a > b : op === ">=" ? a >= b : op === "<" ? a < b : a <= b } return left }
  private parseAdd(): unknown { let left = this.parseMultiply(); while (this.current().type === "operator" && ["+", "-"].includes(this.current().value)) { const op = this.eat("operator").value; const right = this.parseMultiply(); left = op === "+" ? (typeof left === "string" || typeof right === "string" ? String(left ?? "") + String(right ?? "") : num(left) + num(right)) : num(left) - num(right) } return left }
  private parseMultiply(): unknown { let left = this.parseUnary(); while (this.current().type === "operator" && ["*", "/"].includes(this.current().value)) { const op = this.eat("operator").value; const right = this.parseUnary(); if (op === "/" && num(right) === 0) throw new ExpressionError("不能除以 0"); left = op === "*" ? num(left) * num(right) : num(left) / num(right) } return left }
  private parseUnary(): unknown { if (this.current().type === "operator" && ["!", "-", "+"].includes(this.current().value)) { const op = this.eat("operator").value; const value = this.parseUnary(); return op === "!" ? !truthy(value) : op === "-" ? -num(value) : num(value) } return this.parsePrimary() }
  private parsePrimary(): unknown {
    const token = this.current()
    if (token.type === "number") { this.eat(); return Number(token.value) }
    if (token.type === "string") { this.eat(); return token.value }
    if (token.type === "paren" && token.value === "(") { this.eat(); const value = this.parseOr(); this.eat("paren", ")"); return value }
    if (token.type === "identifier") {
      const name = this.eat().value
      if (this.current().type === "paren" && this.current().value === "(") {
        this.eat(); const args: unknown[] = []
        if (!(this.current().type === "paren" && this.current().value === ")")) {
          while (true) { args.push(this.parseOr()); if (this.current().type !== "comma") break; this.eat("comma") }
        }
        this.eat("paren", ")")
        const fn = functions[name.toUpperCase()]
        if (!fn) throw new ExpressionError(`不支持的函数 ${name}`)
        return fn(...args)
      }
      const upper = name.toUpperCase()
      if (upper === "TRUE") return true
      if (upper === "FALSE") return false
      if (upper === "NULL") return null
      if (!(name in this.context)) throw new ExpressionError(`变量 ${name} 不存在`)
      return this.context[name]
    }
    throw new ExpressionError(`位置 ${token.pos + 1} 缺少有效表达式`)
  }
}

export function evaluateExpression(expression: string, context: Context) {
  const source = String(expression ?? "").trim()
  if (!source) throw new ExpressionError("表达式不能为空")
  if (source.length > 4000) throw new ExpressionError("表达式过长")
  return new Parser(tokenize(source), context).parse()
}
