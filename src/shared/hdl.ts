// dlogic_hdl 的数据契约：Verilog 静态检查（iverilog 诊断与规则匹配）与仿真（输出、VCD 信号变化）。
// 纯函数与类型，Host 与前端共用。只允许可擦除的 TypeScript 语法。
import type { WaveSignal } from './seq.ts'

export type HdlOp = 'lint' | 'simulate'

export type HdlSeverity = 'error' | 'warning' | 'info'

/** 结果来源：iverilog 可用为 iverilog；否则只有规则匹配。 */
export type HdlEngine = 'iverilog' | 'rules'

/** iverilog 报告的一条诊断；line 为空表示与具体行无关。 */
export interface LintIssue {
  line: number | null
  severity: HdlSeverity
  message: string
}

export type RuleId = 'latch' | 'case-default' | 'nba-in-comb' | 'blocking-in-seq' | 'multi-driver'

/** 规则匹配命中（教学向提示，不等于编译错误）。 */
export interface RuleHit {
  rule: RuleId
  line: number
  severity: HdlSeverity
  message: string
}

export interface LintResult {
  engine: HdlEngine
  /** iverilog 版本（如 "13.0"）；不可用时为 null。 */
  iverilogVersion: string | null
  issues: LintIssue[]
  ruleHits: RuleHit[]
  /** 降级或补充说明（中文）；iverilog 正常可用时为 null。 */
  notice: string | null
}

export interface SimChange {
  /** 仿真时刻（刻度单位下的整数，见 SimulateResult.tickUnit）。 */
  time: number
  /** 取值：单比特为 0/1/x/z，多比特为二进制串。 */
  value: string
}

export interface SimSignal {
  /** 点分层次名，例如 "tb.q"。 */
  name: string
  width: number
  changes: SimChange[]
}

/** 仿真结束方式：finish 调用了 $finish；timeout 触发时间上限；idle 事件耗尽；其余为工具强制结束。 */
export type SimEnd = 'finish' | 'timeout' | 'idle' | 'wall_clock' | 'output_limit' | 'vcd_limit'

export interface SimulateResult {
  engine: 'iverilog'
  iverilogVersion: string | null
  top: string
  maxTimeUnits: number
  /** 第一个 `timescale 指令，例如 "1ns/1ps"；没有时为 null。 */
  timescale: string | null
  /** 刻度单位（VCD 时间戳与 $finish 时刻的单位，即精度），例如 "ps"；无法判断时为 null。 */
  tickUnit: string | null
  end: SimEnd
  finishTime: number | null
  /** testbench 输出（$display / $monitor 等）的行，已去掉 VCD 提示行。 */
  output: string[]
  outputTruncated: boolean
  /** VCD 中的信号（上限若干路）；没有 VCD 时为空数组。 */
  signals: SimSignal[]
  vcdTruncated: boolean
}

export interface HdlResultMap {
  lint: LintResult
  simulate: SimulateResult
}

/** dlogic_hdl 的 result：按 op 为 lint 或 simulate 的结果之一。 */
export type HdlResult = LintResult | SimulateResult

/** 波形卡片最多显示的时刻列数。 */
export const SIM_WAVE_COLUMNS = 160

// ───────────────────────── 时间单位 ─────────────────────────

const FS_PER_UNIT: Record<string, number> = { fs: 1, ps: 1e3, ns: 1e6, us: 1e9, ms: 1e12, s: 1e15 }
const UNIT_RE = /^(\d*)\s*(fs|ps|ns|us|ms|s)$/i

/** 解析 "1ns"、"10ps" 这类时间单位；无法识别时为 null。 */
export function unitSpec(spec: string | null | undefined): { fs: number; name: string } | null {
  if (!spec) return null
  const m = UNIT_RE.exec(spec.trim())
  if (!m) return null
  const mul = m[1] === '' ? 1 : Number(m[1])
  const name = m[2].toLowerCase()
  return { fs: mul * FS_PER_UNIT[name], name }
}

/** 规范化单位文本："1ps" 与 "ps" 都为 "ps"；带倍数的（如 "10ns"）保持原样；无法识别时为 null。 */
export function normalizeUnit(spec: string | null | undefined): string | null {
  const u = unitSpec(spec)
  if (!u || !spec) return null
  return u.fs === FS_PER_UNIT[u.name] ? u.name : spec.trim()
}

/** timescale "1ns/1ps" 的时间单位部分（显示用，"ns"）；没有时为 null。 */
export function timeUnitOf(timescale: string | null): string | null {
  if (!timescale) return null
  return normalizeUnit(timescale.split('/')[0])
}

/** 仿真结果的显示单位：优先 timescale 的时间单位，否则用刻度单位。 */
export function simDisplayUnit(r: Pick<SimulateResult, 'timescale' | 'tickUnit'>): string | null {
  return timeUnitOf(r.timescale) ?? r.tickUnit
}

/** 把刻度值换算为显示单位下的数值（去掉浮点误差）；无法换算时原样返回。 */
export function simTimeValue(ticks: number, tickUnit: string | null, displayUnit: string | null): number {
  const a = unitSpec(tickUnit)
  const b = unitSpec(displayUnit)
  if (!a || !b) return ticks
  return Number(((ticks * a.fs) / b.fs).toPrecision(12))
}

/** 带单位的时刻文本，例如 "276 ns"。 */
export function formatSimTime(ticks: number, tickUnit: string | null, displayUnit: string | null): string {
  const convertible = unitSpec(displayUnit) !== null && unitSpec(tickUnit) !== null
  const value = convertible ? simTimeValue(ticks, tickUnit, displayUnit) : ticks
  const unit = convertible ? displayUnit : tickUnit
  return unit ? `${value} ${unit}` : String(value)
}

/** $finish 的时刻文本（带单位）；没有 $finish 时为 null。 */
export function simFinishLabel(r: Pick<SimulateResult, 'finishTime' | 'timescale' | 'tickUnit'>): string | null {
  return r.finishTime === null ? null : formatSimTime(r.finishTime, r.tickUnit, simDisplayUnit(r))
}

// ───────────────────────── 波形数据 ─────────────────────────

/** 取值转为十六进制文本（多比特）；含 x/z 时为 "x"；非二进制文本（如实数）原样返回。 */
export function busText(value: string, width: number): string {
  if (/[xz]/i.test(value)) return 'x'
  if (!/^[01]+$/.test(value)) return value
  const v = value.length < width ? '0'.repeat(width - value.length) + value : value
  const bits = '0'.repeat((4 - (v.length % 4)) % 4) + v
  let out = ''
  for (let i = 0; i < bits.length; i += 4) out += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return out
}

export interface SimWaveSignal extends WaveSignal {
  /** 多比特信号（总线）：每列的取值文本（十六进制；含 x/z 为 "x"）。单比特信号没有此字段。 */
  values?: string[]
}

export interface SimWave {
  /** 列数。 */
  steps: number
  /** 每列对应的刻度时刻（整数，单位见 SimulateResult.tickUnit）。 */
  times: number[]
  signals: SimWaveSignal[]
  /** 有变化的时刻超过列数上限时为 true，列为抽样结果。 */
  truncated: boolean
  /** 有变化的时刻总数（含 0）。 */
  total: number
}

const RESET_NAME = /rst|reset/i

function leafOf(name: string): string {
  return name.split('.').pop() ?? name
}

/** 从有序数组中均匀取 k 个元素（保持顺序，覆盖首尾）。 */
function sampleEvenly<T>(arr: T[], k: number): T[] {
  if (k <= 0) return []
  if (arr.length <= k) return arr.slice()
  if (k === 1) return [arr[0]]
  const out: T[] = []
  for (let i = 0; i < k; i++) out.push(arr[Math.round((i * (arr.length - 1)) / (k - 1))])
  return out
}

/**
 * 选出要显示的列（时刻）：只取有信号变化的时刻（含 0），空闲时刻不占列。
 * 超过上限时，复位类信号（名称含 rst/reset）的变化时刻优先保留，其余变化时刻均匀抽样。
 */
export function pickColumns(signals: SimSignal[], all: number[], maxColumns: number): number[] {
  if (all.length <= maxColumns) return all
  const prio = new Set<number>([0])
  for (const s of signals) {
    if (!RESET_NAME.test(leafOf(s.name))) continue
    for (const c of s.changes) prio.add(c.time)
  }
  if (prio.size >= maxColumns) return sampleEvenly([...prio].sort((a, b) => a - b), maxColumns)
  const others = all.filter(t => !prio.has(t))
  return [...prio, ...sampleEvenly(others, maxColumns - prio.size)].sort((a, b) => a - b)
}

/**
 * 把 VCD 信号转换为 Waveform 组件的数据。每一列对应一个有变化的时刻（含 0），取该时刻的值：
 * 单比特信号画电平；多比特信号画总线（values 为十六进制文本，含 x/z 为 "x"）。
 */
export function toWaveSignals(signals: SimSignal[], maxColumns: number = SIM_WAVE_COLUMNS): SimWave {
  const timeSet = new Set<number>([0])
  for (const s of signals) for (const c of s.changes) timeSet.add(c.time)
  const all = [...timeSet].sort((a, b) => a - b)
  const times = pickColumns(signals, all, maxColumns)
  const rows: SimWaveSignal[] = signals.map(s => {
    let idx = 0
    let cur = 'x'
    const chars: string[] = []
    const values: string[] = []
    for (const t of times) {
      while (idx < s.changes.length && s.changes[idx].time <= t) {
        cur = s.changes[idx].value
        idx++
      }
      const v = busText(cur, s.width)
      if (s.width === 1) chars.push(v === '1' ? '1' : v === '0' ? '0' : 'x')
      else {
        chars.push(v === 'x' ? 'x' : 'd')
        values.push(v)
      }
    }
    const leaf = leafOf(s.name)
    const row: SimWaveSignal = { name: leaf, wave: chars.join(''), role: /^(clk|clock)$/i.test(leaf) ? 'clock' : 'output' }
    if (s.width > 1) row.values = values
    return row
  })
  return { steps: times.length, times, signals: rows, truncated: all.length > maxColumns, total: all.length }
}
