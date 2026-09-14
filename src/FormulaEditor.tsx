import { useMemo, useRef, useState } from "react"
import { apiFetch } from "./api"

type Variable = { key: string; label: string; kind?: string }

type Props = {
  value: string
  onChange: (value: string) => void
  variables: Variable[]
  sampleValues?: Record<string, unknown>
}

const functions = [
  { name: "DATE_DIFF_INCLUSIVE", title: "日期差（含首尾）", template: "DATE_DIFF_INCLUSIVE(startDate, endDate)" },
  { name: "SUM", title: "求和", template: "SUM(amount1, amount2)" },
  { name: "SUBTRACT", title: "相减", template: "SUBTRACT(a, b)" },
  { name: "CONCAT", title: "文本拼接", template: 'CONCAT(name, "-", code)' },
  { name: "IF", title: "条件取值", template: 'IF(amount > 1000, "高", "普通")' },
  { name: "COALESCE", title: "首个非空值", template: "COALESCE(a, b, c)" },
  { name: "LEN", title: "文本长度", template: "LEN(reason)" },
  { name: "ROUND", title: "四舍五入", template: "ROUND(amount, 2)" },
]

export function FormulaEditor({ value, onChange, variables, sampleValues = {} }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const sortedVariables = useMemo(() => [...variables].sort((a, b) => a.label.localeCompare(b.label, "zh-CN")), [variables])

  const insert = (text: string) => {
    const el = textareaRef.current
    if (!el) { onChange(value + text); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? start
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + text.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  const check = async () => {
    setChecking(true); setResult(null)
    try {
      const response = await apiFetch<{ value: unknown }>("/api/model-expression/evaluate", { method: "POST", body: JSON.stringify({ expression: value, values: sampleValues }) })
      setResult({ ok: true, text: `语法有效 · 试算结果：${typeof response.value === "string" ? response.value : JSON.stringify(response.value)}` })
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : "表达式校验失败" })
    } finally { setChecking(false) }
  }

  return <div className="formula-editor">
    <div className="formula-toolbar">
      <div className="formula-toolbar-group"><b>变量</b><div className="formula-chip-list">{sortedVariables.map(item => <button type="button" key={item.key} title={`${item.label} · ${item.kind ?? "变量"}`} onClick={() => insert(item.key)}>{item.label}<small>{item.key}</small></button>)}</div></div>
      <div className="formula-toolbar-group"><b>函数</b><div className="formula-chip-list funcs">{functions.map(item => <button type="button" key={item.name} title={item.title} onClick={() => insert(item.template)}>{item.name}<small>{item.title}</small></button>)}</div></div>
    </div>
    <textarea ref={textareaRef} rows={4} value={value} onChange={event => onChange(event.target.value)} spellCheck={false} placeholder={'例如：IF(DATE_DIFF_INCLUSIVE(startDate, endDate) > 3, "长周期", "短周期")'}/>
    <div className="formula-foot"><span>支持 + - * /、比较运算、AND/OR（&&/||）、括号及上方函数。表达式由服务器安全解析，不使用 eval。</span><button type="button" disabled={checking || !value.trim()} onClick={() => void check()}>{checking ? "校验中…" : "校验 / 试算"}</button></div>
    {result && <div className={`formula-result ${result.ok ? "ok" : "error"}`}>{result.text}</div>}
  </div>
}
