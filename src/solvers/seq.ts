// 时序逻辑求解器：纯函数，不做 I/O，不依赖 DSH。
// 约定：
//  - 分析与状态字符串按触发器书写顺序，第一个触发器在最左（最高位）；
//  - 移位寄存器的内部编码 bit i 表示 Q_i，字符串从 Q(n-1) 写到 Q0。
// 只使用可擦除的 TypeScript 语法，Node 可直接运行。

import { DlogicInputError } from '../shared/contracts.ts'
import type {
  AnalyzeResult,
  Bit,
  ClockedFfKind,
  CounterMethod,
  CounterModel,
  CounterResult,
  FfExcitation,
  FfKind,
  FfResult,
  FfRow,
  FlipFlopSpec,
  NextBit,
  OutputSpec,
  ShiftKind,
  ShiftResult,
  StateGraph,
  WaveSignal,
  WaveTarget,
  WaveformResult,
} from '../shared/seq.ts'
import { minimize, parseExpr, type BoolExpr } from './bool.ts'

// ───────────────────────── 触发器 ─────────────────────────

const SB = 'S̄' // S̄
const RB = 'R̄' // R̄

interface FfInfo {
  title: string
  pins: string[]
  trigger: 'edge' | 'level' | 'none'
  characteristic: string
  latex: string
  constraint: string | null
}

const FF_INFO: Record<FfKind, FfInfo> = {
  SR: {
    title: 'SR 触发器（边沿触发）',
    pins: ['S', 'R'],
    trigger: 'edge',
    characteristic: 'Q* = S + R̄Q',
    latex: 'Q^{n+1} = S + \\overline{R}Q^n',
    constraint: 'SR = 0（S 与 R 不能同时为 1）',
  },
  D: {
    title: 'D 触发器（边沿触发）',
    pins: ['D'],
    trigger: 'edge',
    characteristic: 'Q* = D',
    latex: 'Q^{n+1} = D',
    constraint: null,
  },
  JK: {
    title: 'JK 触发器（边沿触发）',
    pins: ['J', 'K'],
    trigger: 'edge',
    characteristic: "Q* = JQ' + K'Q",
    latex: 'Q^{n+1} = J\\overline{Q}^{n} + \\overline{K}Q^n',
    constraint: null,
  },
  T: {
    title: 'T 触发器（边沿触发）',
    pins: ['T'],
    trigger: 'edge',
    characteristic: "Q* = T ⊕ Q = TQ' + T'Q",
    latex: 'Q^{n+1} = T \\oplus Q^n',
    constraint: null,
  },
  SR_LATCH: {
    title: '基本 SR 锁存器（与非门，低电平有效）',
    pins: [SB, RB],
    trigger: 'none',
    characteristic: "Q* = S̄' + R̄Q",
    latex: 'Q^{n+1} = \\overline{\\overline{S}} + \\overline{R}\\,Q^n',
    constraint: 'S̄ + R̄ = 1（S̄ 与 R̄ 不能同时为 0）',
  },
  GATED_SR: {
    title: '门控 SR 锁存器（CP 高电平有效）',
    pins: ['S', 'R', 'CP'],
    trigger: 'level',
    characteristic: 'Q* = S + R̄Q（CP = 1 时）',
    latex: 'Q^{n+1} = S + \\overline{R}Q^n \\quad (CP=1)',
    constraint: 'SR = 0（CP = 1 期间）',
  },
  GATED_D: {
    title: '门控 D 锁存器（CP 高电平有效）',
    pins: ['D', 'CP'],
    trigger: 'level',
    characteristic: 'Q* = D（CP = 1 时）',
    latex: 'Q^{n+1} = D \\quad (CP=1)',
    constraint: null,
  },
}

/** 触发器的输入端（不含 CP）。 */
export const FF_PINS_CLOCKED: Record<ClockedFfKind, string[]> = {
  SR: ['S', 'R'],
  D: ['D'],
  JK: ['J', 'K'],
  T: ['T'],
}

function flip(q: Bit): Bit {
  return q === 1 ? 0 : 1
}

function setReset(q: Bit, s: Bit, r: Bit): NextBit {
  if (s === 1 && r === 1) return 'X'
  if (s === 1) return 1
  if (r === 1) return 0
  return q
}

/** 一步状态转换。pins 为各输入端取值；返回 'X' 表示禁止。 */
function stepFf(kind: FfKind, q: Bit, v: Record<string, Bit>): NextBit {
  switch (kind) {
    case 'D':
      return v.D
    case 'T':
      return v.T === 1 ? flip(q) : q
    case 'JK':
      if (v.J === 1 && v.K === 1) return flip(q)
      if (v.J === 1) return 1
      if (v.K === 1) return 0
      return q
    case 'SR':
      return setReset(q, v.S, v.R)
    case 'GATED_D':
      return v.CP === 1 ? v.D : q
    case 'GATED_SR':
      return v.CP === 1 ? setReset(q, v.S, v.R) : q
    case 'SR_LATCH': {
      const sb = v[SB]
      const rb = v[RB]
      if (sb === 0 && rb === 0) return 'X'
      if (sb === 0) return 1
      if (rb === 0) return 0
      return q
    }
  }
}

/** 所有输入组合（第一个名字为最高位）。 */
function assignments(names: string[]): Record<string, Bit>[] {
  const out: Record<string, Bit>[] = []
  const n = names.length
  for (let m = 0; m < 1 << n; m++) {
    const rec: Record<string, Bit> = {}
    names.forEach((nm, i) => {
      rec[nm] = ((m >> (n - 1 - i)) & 1) as Bit
    })
    out.push(rec)
  }
  return out
}

/** 触发器的特性表、激励表与特性方程。 */
export function ffCharacteristic(kind: FfKind): FfResult {
  const info = FF_INFO[kind]
  if (info === undefined) throw new DlogicInputError(`未知的触发器类型：${String(kind)}`)
  const inputs = info.pins
  const table: FfRow[] = []
  for (const v of assignments(inputs)) {
    for (const q of [0, 1] as Bit[]) {
      table.push({ q, inputs: { ...v }, next: stepFf(kind, q, v) })
    }
  }
  const gated = inputs.includes('CP')
  const drivable = inputs.filter(p => p !== 'CP')
  const excitation: FfExcitation[] = []
  for (const from of [0, 1] as Bit[]) {
    for (const to of [0, 1] as Bit[]) {
      const cands = assignments(inputs)
        .filter(v => !gated || v.CP === 1)
        .filter(v => stepFf(kind, from, v) === to)
      const drive: Record<string, NextBit> = {}
      for (const p of drivable) {
        const vals = new Set(cands.map(v => v[p]))
        drive[p] = vals.size === 1 ? (Array.from(vals)[0] as Bit) : 'X'
      }
      if (gated) drive.CP = 1
      excitation.push({ from, to, drive })
    }
  }
  return {
    kind,
    title: info.title,
    trigger: info.trigger,
    inputs: inputs.slice(),
    characteristic: info.characteristic,
    latex: info.latex,
    constraint: info.constraint,
    table,
    excitation,
  }
}

// ───────────────────────── 通用：编码与函数图 ─────────────────────────

/** 分析用：状态 k（第一个触发器为最高位）按位展开。 */
function bitsOf(k: number, n: number): Bit[] {
  const out: Bit[] = []
  for (let i = 0; i < n; i++) out.push(((k >> (n - 1 - i)) & 1) as Bit)
  return out
}

function keyOf(bits: Bit[]): number {
  let k = 0
  for (const b of bits) k = (k << 1) | b
  return k
}

function strOf(bits: Bit[]): string {
  return bits.join('')
}

function parseBits(s: string, n: number, what: string): Bit[] {
  const t = s.trim()
  if (!/^[01]+$/.test(t) || t.length !== n) {
    throw new DlogicInputError(`${what}应为 ${n} 位的 0/1 字符串，例如 "${'0'.repeat(n)}"。`)
  }
  return t.split('').map(ch => (ch === '1' ? 1 : 0)) as Bit[]
}

/** 从初始节点出发的唯一循环（没有循环或中途进入禁止状态时返回 null）。 */
function cycleFrom(next: (number | null)[], start: number): number[] | null {
  const seen = new Map<number, number>()
  const path: number[] = []
  let cur: number | null = start
  while (cur !== null) {
    const at = seen.get(cur)
    if (at !== undefined) return path.slice(at)
    seen.set(cur, path.length)
    path.push(cur)
    cur = next[cur]
  }
  return null
}

/** 从 k 出发能否进入集合 set。 */
function reaches(next: (number | null)[], set: Set<number>, k: number): boolean {
  const seen = new Set<number>()
  let cur: number | null = k
  while (cur !== null) {
    if (set.has(cur)) return true
    if (seen.has(cur)) return false
    seen.add(cur)
    cur = next[cur]
  }
  return false
}

/** 从 k 出发走到进入 set，或重复（陷入其他循环），或进入禁止状态。 */
function walkTo(
  next: (number | null)[],
  k: number,
  set: Set<number>,
): { path: number[]; end: 'valid' | 'loop' | 'forbidden' } {
  const path = [k]
  const seen = new Set<number>([k])
  let cur = k
  for (;;) {
    if (set.has(cur)) return { path, end: 'valid' }
    const nx = next[cur]
    if (nx === null) return { path, end: 'forbidden' }
    path.push(nx)
    if (seen.has(nx)) return { path, end: 'loop' }
    seen.add(nx)
    cur = nx
  }
}

/** 多输入图上从 k 到集合 set 的最短路径（含两端），不经过禁止状态；不可达时返回 null。 */
function shortestToSet(nextAll: (number | null)[][], k: number, set: Set<number>): number[] | null {
  if (set.has(k)) return [k]
  const parent = new Map<number, number>([[k, -1]])
  const queue: number[] = [k]
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi]
    for (const nx of nextAll) {
      const to = nx[cur]
      if (to === null || parent.has(to)) continue
      parent.set(to, cur)
      if (set.has(to)) {
        const path: number[] = [to]
        let p = cur
        while (p !== -1) {
          path.unshift(p)
          p = parent.get(p) ?? -1
        }
        return path
      }
      queue.push(to)
    }
  }
  return null
}

/** 函数图（每个节点至多一条出边）的全部循环。 */
function allCycles(next: (number | null)[]): number[][] {
  const N = next.length
  const color: number[] = new Array(N).fill(0)
  const out: number[][] = []
  for (let s = 0; s < N; s++) {
    if (color[s] !== 0) continue
    const stack: number[] = []
    const pos = new Map<number, number>()
    let cur: number | null = s
    while (cur !== null && color[cur] === 0) {
      color[cur] = 1
      pos.set(cur, stack.length)
      stack.push(cur)
      cur = next[cur]
    }
    if (cur !== null && color[cur] === 1) out.push(stack.slice(pos.get(cur) ?? 0))
    for (const x of stack) color[x] = 2
  }
  return out
}

// ───────────────────────── 同步时序电路分析 ─────────────────────────

interface CompiledPin {
  pin: string
  expr: string
  ast: BoolExpr
}

interface CompiledFf {
  name: string
  kind: ClockedFfKind
  pins: CompiledPin[]
}

interface Machine {
  ffs: CompiledFf[]
  inputs: string[]
  outputs: { name: string; expr: string; ast: BoolExpr }[]
  vars: string[]
}

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/
const CLOCKED_KINDS: ClockedFfKind[] = ['SR', 'D', 'JK', 'T']

/** 校验并编译电路描述：驱动表达式解析为语法树。变量为 Q 名加输入名。 */
export function compileMachine(ffs: FlipFlopSpec[], inputs: string[], outputs: OutputSpec[]): Machine {
  if (!Array.isArray(ffs) || ffs.length < 1 || ffs.length > 4) {
    throw new DlogicInputError('触发器数量须为 1～4 个。')
  }
  const ins = Array.isArray(inputs) ? inputs : []
  if (ins.length > 2) throw new DlogicInputError('外部输入最多 2 个。')
  const vars = [...ffs.map(f => f.name), ...ins]
  const seen = new Set<string>()
  for (const v of vars) {
    if (typeof v !== 'string' || !NAME_RE.test(v)) throw new DlogicInputError(`变量名“${String(v)}”不合法，应以字母开头。`)
    if (seen.has(v)) throw new DlogicInputError(`变量名重复：${v}`)
    seen.add(v)
  }
  const compiledFfs: CompiledFf[] = ffs.map(f => {
    if (!CLOCKED_KINDS.includes(f.kind)) {
      throw new DlogicInputError(`触发器 ${f.name} 的类型应为 SR、D、JK 或 T。`)
    }
    const pins = FF_PINS_CLOCKED[f.kind]
    const drives = Array.isArray(f.drives) ? f.drives : []
    for (const d of drives) {
      if (!pins.includes(d.pin)) throw new DlogicInputError(`触发器 ${f.name}（${f.kind}）没有 ${d.pin} 端。`)
    }
    for (const p of pins) {
      if (!drives.some(d => d.pin === p)) throw new DlogicInputError(`触发器 ${f.name} 缺少 ${p} 端的驱动表达式。`)
    }
    return {
      name: f.name,
      kind: f.kind,
      pins: pins.map(p => {
        const d = drives.find(x => x.pin === p)
        const expr = d ? d.expr : ''
        return { pin: p, expr, ast: parseExpr(expr, vars).ast }
      }),
    }
  })
  const compiledOuts = (Array.isArray(outputs) ? outputs : []).map(o => {
    if (vars.includes(o.name)) throw new DlogicInputError(`输出名 ${o.name} 与变量重名。`)
    return { name: o.name, expr: o.expr, ast: parseExpr(o.expr, vars).ast }
  })
  return { ffs: compiledFfs, inputs: ins.slice(), outputs: compiledOuts, vars }
}

function evalAst(e: BoolExpr, env: Record<string, Bit>): Bit {
  switch (e.k) {
    case 'var': {
      const v = env[e.name]
      if (v === undefined) throw new DlogicInputError(`未知变量“${e.name}”`)
      return v
    }
    case 'const':
      return e.v
    case 'not':
      return evalAst(e.x, env) === 1 ? 0 : 1
    case 'and':
      return e.xs.every(x => evalAst(x, env) === 1) ? 1 : 0
    case 'or':
      return e.xs.some(x => evalAst(x, env) === 1) ? 1 : 0
    case 'xor':
      return evalAst(e.a, env) ^ evalAst(e.b, env) ? 1 : 0
    case 'xnor':
      return evalAst(e.a, env) ^ evalAst(e.b, env) ? 0 : 1
  }
}

interface Move {
  /** 次态（各触发器的 Q 值）；存在禁止状态时为 null。 */
  next: Bit[] | null
  outs: Bit[]
}

function move(m: Machine, s: Bit[], x: Bit[]): Move {
  const env: Record<string, Bit> = {}
  m.ffs.forEach((f, i) => {
    env[f.name] = s[i]
  })
  m.inputs.forEach((nm, j) => {
    env[nm] = x[j]
  })
  const next: Bit[] = []
  let ok = true
  m.ffs.forEach((f, i) => {
    const v: Record<string, Bit> = {}
    for (const p of f.pins) v[p.pin] = evalAst(p.ast, env)
    const nx = stepFf(f.kind, s[i], v)
    if (nx === 'X') ok = false
    else next.push(nx)
  })
  return { next: ok ? next : null, outs: m.outputs.map(o => evalAst(o.ast, env)) }
}

/**
 * 同步时序电路分析：状态方程、状态表、状态图、有效循环、自启动与无效状态流向。
 * 异步电路（各触发器独立时钟）不在本函数支持范围内，由调用方在 warnings 中说明。
 */
export function analyzeMachine(ffs: FlipFlopSpec[], inputs: string[], outputs: OutputSpec[], init?: string): AnalyzeResult {
  const m = compileMachine(ffs, inputs, outputs)
  const n = m.ffs.length
  const mi = m.inputs.length
  const NS = 1 << n
  const NX = 1 << mi
  const initBits = init === undefined || init.trim() === '' ? bitsOf(0, n) : parseBits(init, n, '初态')
  const initK = keyOf(initBits)

  const moves: Move[][] = []
  for (let k = 0; k < NS; k++) {
    const row: Move[] = []
    for (let x = 0; x < NX; x++) row.push(move(m, bitsOf(k, n), bitsOf(x, mi)))
    moves.push(row)
  }
  const nextOf = (x: number): (number | null)[] =>
    moves.map(row => (row[x].next === null ? null : keyOf(row[x].next as Bit[])))
  const nextArr: (number | null)[][] = []
  for (let x = 0; x < NX; x++) nextArr.push(nextOf(x))

  // 有效状态：各输入取值下，从初态进入的循环上的状态之并。
  const cyc: (number[] | null)[] = nextArr.map(nx => cycleFrom(nx, initK))
  const validSet = new Set<number>()
  for (const c of cyc) if (c) for (const k of c) validSet.add(k)

  // 自启动：从任一状态出发，在某个输入序列下都能进入有效状态（允许每个时钟选择不同的输入）。
  const toValid = (k: number): number[] | null => shortestToSet(nextArr, k, validSet)
  const invalidPaths: AnalyzeResult['invalidPaths'] = []
  let selfStart = validSet.size > 0
  for (let k = 0; k < NS; k++) {
    if (validSet.has(k)) continue
    const p = toValid(k)
    if (p === null) selfStart = false
    invalidPaths.push({
      from: strOf(bitsOf(k, n)),
      path: (p ?? [k]).map(s => strOf(bitsOf(s, n))),
      reached: p !== null,
    })
  }

  const table: AnalyzeResult['table'] = []
  for (let k = 0; k < NS; k++) {
    for (let x = 0; x < NX; x++) {
      const mv = moves[k][x]
      table.push({
        state: strOf(bitsOf(k, n)),
        input: mi > 0 ? strOf(bitsOf(x, mi)) : '',
        next: mv.next === null ? '×' : strOf(mv.next),
        outputs: m.outputs.map((o, i) => ({ name: o.name, value: mv.outs[i] })),
        valid: validSet.has(k),
      })
    }
  }

  const stateEquations: AnalyzeResult['stateEquations'] = m.ffs.map((f, i) => {
    const minterms: number[] = []
    const dontCares: number[] = []
    for (let k = 0; k < NS; k++) {
      for (let x = 0; x < NX; x++) {
        const idx = k * NX + x
        const nx = moves[k][x].next
        if (nx === null) dontCares.push(idx)
        else if (nx[i] === 1) minterms.push(idx)
      }
    }
    const r = minimize({ variables: m.vars.slice(), minterms, dontCares }, 'SOP')
    return { ff: f.name, text: r.texts[0] ?? '0', latex: r.latex[0] ?? '0' }
  })

  const outs: AnalyzeResult['outputs'] = m.outputs.map((o, oi) => {
    let mealy = false
    for (let k = 0; k < NS; k++) {
      for (let x = 1; x < NX; x++) if (moves[k][x].outs[oi] !== moves[k][0].outs[oi]) mealy = true
    }
    return { name: o.name, expr: o.expr, type: mealy ? 'Mealy' : 'Moore' }
  })

  const cycles: AnalyzeResult['cycles'] = []
  for (let x = 0; x < NX; x++) {
    const c = cyc[x]
    if (c) cycles.push({ input: mi > 0 ? strOf(bitsOf(x, mi)) : '', states: c.map(k => strOf(bitsOf(k, n))) })
  }

  // 状态图：节点为全部状态；边按 (现态, 输入) 生成，同一对节点合并标签。
  const nodes: StateGraph['nodes'] = []
  for (let k = 0; k < NS; k++) {
    nodes.push({ id: strOf(bitsOf(k, n)), label: strOf(bitsOf(k, n)), valid: validSet.has(k), initial: k === initK })
  }
  const hasForbidden = moves.some(row => row.some(mv => mv.next === null))
  if (hasForbidden) nodes.push({ id: '×', label: '×', valid: false })
  const edgeMap = new Map<string, { from: string; to: string; labels: string[] }>()
  for (let k = 0; k < NS; k++) {
    for (let x = 0; x < NX; x++) {
      const mv = moves[k][x]
      const from = strOf(bitsOf(k, n))
      const to = mv.next === null ? '×' : strOf(mv.next)
      const parts: string[] = []
      if (mi > 0) parts.push(strOf(bitsOf(x, mi)))
      if (mv.outs.length > 0) parts.push(mv.outs.join(''))
      const label = parts.join('/')
      const key = `${from}>${to}`
      const e = edgeMap.get(key) ?? { from, to, labels: [] }
      if (!e.labels.includes(label)) e.labels.push(label)
      edgeMap.set(key, e)
    }
  }
  const edges: StateGraph['edges'] = []
  for (const e of edgeMap.values()) edges.push({ from: e.from, to: e.to, label: e.labels.join(', ') })

  return {
    stateNames: m.ffs.map(f => f.name),
    inputNames: m.inputs.slice(),
    drives: m.ffs.flatMap(f => f.pins.map(p => ({ ff: f.name, kind: f.kind, pin: p.pin, expr: p.expr }))),
    stateEquations,
    outputs: outs,
    initial: strOf(initBits),
    table,
    validStates: Array.from(validSet).sort((a, b) => a - b).map(k => strOf(bitsOf(k, n))),
    cycles,
    selfStart,
    invalidPaths,
    graph: { nodes, edges },
  }
}

// ───────────────────────── 计数器 160 / 161 / 163 ─────────────────────────

function bin4(v: number): string {
  return v.toString(2).padStart(4, '0')
}

/**
 * 模 N 计数器设计：清零法（161/160 异步清零，有过渡态；163 同步清零）与置数法（同步置数）。
 * N 超过一片的模时用两片级联（模最多 256，160 为 100）。
 */
export function counterDesign(model: CounterModel, method: CounterMethod, N: number): CounterResult {
  if (!Number.isInteger(N) || N < 2 || N > 256) throw new DlogicInputError('模 N 须为 2～256 的整数。')
  const M = model === '160' ? 10 : 16
  if (N > M * M) throw new DlogicInputError(`${model} 两片级联的最大模为 ${M * M}。`)
  const chips: 1 | 2 = N <= M ? 1 : 2
  const C = chips === 1 ? M : M * M
  const bitNames = chips === 1 ? ['Q3', 'Q2', 'Q1', 'Q0'] : ['H3', 'H2', 'H1', 'H0', 'L3', 'L2', 'L1', 'L0']
  const str = (v: number): string => (chips === 1 ? bin4(v) : `${bin4(Math.floor(v / M))} ${bin4(v % M)}`)
  const natural = N === C

  let feedbackKind: 'async' | 'sync' | 'none' = 'none'
  let signal: string | null = null
  let decode: number | null = null
  let load: CounterResult['load'] = null
  let transient: number | null = null
  let start = 0

  if (!natural) {
    if (method === 'preset') {
      const D = C - N
      start = D
      load = { value: D, bits: str(D) }
      decode = C - 1
      signal = 'LD̄'
      feedbackKind = 'sync'
    } else if (model === '163') {
      decode = N - 1
      signal = 'CR̄'
      feedbackKind = 'sync'
    } else {
      decode = N
      signal = 'CR̄'
      feedbackKind = 'async'
      transient = N
    }
  }

  const values: number[] = []
  for (let i = 0; i < N; i++) values.push(method === 'preset' && !natural ? start + i : i)
  const sequence: CounterResult['sequence'] = values.map((v, i) => ({ index: i, value: v, bits: str(v), transient: false }))
  if (transient !== null) sequence.push({ index: N, value: transient, bits: str(transient), transient: true })

  let expr = ''
  let decodeBits: string | null = null
  if (decode !== null && signal !== null) {
    decodeBits = str(decode)
    const ones: string[] = []
    const flat = decodeBits.replace(' ', '')
    for (let i = 0; i < flat.length; i++) if (flat[i] === '1') ones.push(bitNames[i])
    expr = `${signal} = (${ones.join('')})'`
  }

  return {
    model,
    method,
    N,
    chips,
    modulus: C,
    natural,
    bitNames,
    feedback: { kind: feedbackKind, signal, decode: decodeBits, expr },
    load,
    sequence,
    glitch: transient !== null,
    transient: transient === null ? null : str(transient),
  }
}

// ───────────────────────── 移位寄存器、环形与扭环计数器 ─────────────────────────

/** 内部编码：bit i 为 Q_i。 */
function shiftBits(k: number, n: number): Bit[] {
  const out: Bit[] = []
  for (let i = 0; i < n; i++) out.push(((k >> i) & 1) as Bit)
  return out
}

function shiftKey(b: Bit[]): number {
  let k = 0
  for (let i = 0; i < b.length; i++) k |= b[i] << i
  return k
}

function shiftStr(k: number, n: number): string {
  return shiftBits(k, n)
    .reverse()
    .join('')
}

function shiftParse(s: string, n: number): number {
  const b = parseBits(s, n, '初态')
  // 字符串第 j 位对应 Q(n-1-j)
  const bits: Bit[] = new Array(n).fill(0)
  for (let j = 0; j < n; j++) bits[n - 1 - j] = b[j]
  return shiftKey(bits)
}

function shiftNext(kind: ShiftKind, dir: 'left' | 'right', b: Bit[], serial: Bit): Bit[] {
  const n = b.length
  const out: Bit[] = new Array(n).fill(0)
  if (kind === '194') {
    for (let i = 0; i < n; i++) {
      if (dir === 'right') out[i] = i < n - 1 ? b[i + 1] : serial
      else out[i] = i > 0 ? b[i - 1] : serial
    }
    return out
  }
  for (let i = 1; i < n; i++) out[i] = b[i - 1]
  out[0] = kind === 'johnson' ? (b[n - 1] === 1 ? 0 : 1) : b[n - 1]
  return out
}

/**
 * 移位寄存器（194，4 位，串行输入序列）、环形计数器（模 n）与扭环计数器（模 2n）。
 * 环形与扭环给出有效循环、全部循环与自启动检查。
 */
export function shiftDesign(
  kind: ShiftKind,
  bits: number | undefined,
  init: string | undefined,
  direction: 'left' | 'right' | undefined,
  serial: Bit[] | undefined,
): ShiftResult {
  if (kind === '194') {
    if (bits !== undefined && bits !== 4) throw new DlogicInputError('194 为 4 位移位寄存器，bits 只能为 4。')
    const n = 4
    const dir = direction ?? 'right'
    const initK = init === undefined || init.trim() === '' ? 0 : shiftParse(init, n)
    const seq = Array.isArray(serial) ? serial : []
    for (const s of seq) if (s !== 0 && s !== 1) throw new DlogicInputError('串行输入只能是 0 或 1。')
    if (seq.length > 64) throw new DlogicInputError('串行输入最多 64 位。')
    let cur = shiftBits(initK, n)
    const sequence: ShiftResult['sequence'] = [{ step: 0, state: shiftStr(initK, n), valid: true }]
    seq.forEach((s, i) => {
      cur = shiftNext('194', dir, cur, s)
      sequence.push({ step: i + 1, state: shiftStr(shiftKey(cur), n), valid: true })
    })
    const feedback =
      dir === 'right'
        ? `右移：Q3 ← D（串行输入），Q2 ← Q3，Q1 ← Q2，Q0 ← Q1`
        : `左移：Q0 ← D（串行输入），Q1 ← Q0，Q2 ← Q1，Q3 ← Q2`
    return {
      kind,
      bits: n,
      direction: dir,
      init: shiftStr(initK, n),
      feedback,
      sequence,
      modulus: null,
      expectedModulus: null,
      validCycle: null,
      cycles: null,
      selfStart: null,
      invalidPaths: [],
      graph: null,
    }
  }

  const n = bits ?? 4
  if (!Number.isInteger(n) || n < 2 || n > 8) throw new DlogicInputError('环形与扭环计数器的位数须为 2～8。')
  const N = 1 << n
  const defaultInit = kind === 'ring' ? '0'.repeat(n - 1) + '1' : '0'.repeat(n)
  const initStr = init === undefined || init.trim() === '' ? defaultInit : init.trim()
  const initK = shiftParse(initStr, n)
  const nextArr: (number | null)[] = []
  for (let k = 0; k < N; k++) nextArr.push(shiftKey(shiftNext(kind, 'right', shiftBits(k, n), 0)))

  const cyc = cycleFrom(nextArr, initK)
  const cycSet = new Set(cyc ?? [])
  const expected = kind === 'ring' ? n : 2 * n

  // 从初态出发，直到第一次重复为止的状态序列（含过渡部分）。
  const walk: number[] = []
  const seenWalk = new Set<number>()
  let cur: number | null = initK
  while (cur !== null && !seenWalk.has(cur)) {
    seenWalk.add(cur)
    walk.push(cur)
    cur = nextArr[cur]
  }
  const sequence: ShiftResult['sequence'] = walk.map((k, i) => ({ step: i, state: shiftStr(k, n), valid: cycSet.has(k) }))

  const all = allCycles(nextArr)
  const cycles: { states: string[]; valid: boolean }[] = all.map(c => ({
    states: c.map(k => shiftStr(k, n)),
    valid: c.some(k => cycSet.has(k)),
  }))

  let selfStart = cyc !== null
  if (cyc !== null) {
    for (let k = 0; k < N; k++) if (!reaches(nextArr, cycSet, k)) selfStart = false
  }

  const invalidPaths: ShiftResult['invalidPaths'] = []
  if (cyc !== null) {
    for (let k = 0; k < N && invalidPaths.length < 16; k++) {
      if (cycSet.has(k)) continue
      const w = walkTo(nextArr, k, cycSet)
      invalidPaths.push({ from: shiftStr(k, n), path: w.path.map(p => shiftStr(p, n)), reached: w.end === 'valid' })
    }
  }

  let graph: StateGraph | null = null
  if (N <= 16) {
    const nodes: StateGraph['nodes'] = []
    const edges: StateGraph['edges'] = []
    for (let k = 0; k < N; k++) {
      nodes.push({ id: shiftStr(k, n), label: shiftStr(k, n), valid: cycSet.has(k), initial: k === initK })
    }
    for (let k = 0; k < N; k++) {
      const to = nextArr[k]
      if (to !== null) edges.push({ from: shiftStr(k, n), to: shiftStr(to, n), label: '' })
    }
    graph = { nodes, edges }
  }

  const feedback =
    kind === 'ring'
      ? `Q0 ← Q${n - 1}（各位依次右移，Q0 取 Q${n - 1}），模 = ${n}`
      : `Q0 ← Q${n - 1}'（Q0 取 Q${n - 1} 的反相，各位依次右移），模 = ${2 * n}`

  return {
    kind,
    bits: n,
    direction: null,
    init: initStr,
    feedback,
    sequence,
    modulus: cyc === null ? null : cyc.length,
    expectedModulus: expected,
    validCycle: cyc === null ? null : cyc.map(k => shiftStr(k, n)),
    cycles,
    selfStart,
    invalidPaths,
    graph,
  }
}

// ───────────────────────── 波形 ─────────────────────────

export interface WaveInput {
  name: string
  wave: string
}

export interface WaveSpec {
  ffKind?: FfKind
  /** ff：'0' 或 '1'；analyze 与 shift：状态字符串。 */
  init?: string
  flipflops?: FlipFlopSpec[]
  inputs?: string[]
  outputs?: OutputSpec[]
  model?: CounterModel
  method?: CounterMethod
  N?: number
  shiftKind?: ShiftKind
  bits?: number
  direction?: 'left' | 'right'
  waves?: WaveInput[]
  steps?: number
}

const MAX_STEPS = 64

function charOf(v: Bit | 'X'): 'x' | '0' | '1' {
  return v === 'X' ? 'x' : v === 1 ? '1' : '0'
}

/** 校验输入波形，返回 名称 → 字符串 的映射与统一长度。 */
function collectWaves(waves: WaveInput[] | undefined): Map<string, string> {
  const map = new Map<string, string>()
  for (const w of Array.isArray(waves) ? waves : []) {
    if (!/^[01]+$/.test(w.wave)) throw new DlogicInputError(`输入 ${w.name} 的波形只能包含 0 与 1。`)
    if (map.has(w.name)) throw new DlogicInputError(`输入 ${w.name} 重复给出。`)
    map.set(w.name, w.wave)
  }
  return map
}

function stepCount(waves: Map<string, string>, steps: number | undefined): number {
  let len: number | null = null
  for (const [name, w] of waves) {
    if (len === null) len = w.length
    else if (w.length !== len) throw new DlogicInputError(`输入 ${name} 的波形长度与其他输入不一致。`)
  }
  const T = steps ?? len ?? 8
  if (!Number.isInteger(T) || T < 1 || T > MAX_STEPS) throw new DlogicInputError(`波形长度须为 1～${MAX_STEPS}。`)
  if (len !== null && steps !== undefined && steps !== len) throw new DlogicInputError('steps 与输入波形长度不一致。')
  return T
}

function bitAt(w: string | undefined, t: number): Bit {
  if (w === undefined) return 0
  return w[t] === '1' ? 1 : 0
}

/** 时序波形：按时钟周期给出 CP、输入、状态与输出的波形数据。第 t 个周期内输入稳定，周期末的时钟沿更新状态。 */
export function waveformDesign(target: WaveTarget, spec: WaveSpec): WaveformResult {
  const waves = collectWaves(spec.waves)
  const T = stepCount(waves, spec.steps)
  const signals: WaveSignal[] = []

  if (target === 'ff') {
    if (spec.ffKind === undefined) throw new DlogicInputError('ff 波形需要 ffKind（触发器类型）。')
    const info = ffCharacteristic(spec.ffKind)
    const gated = info.inputs.includes('CP')
    const q0 = spec.init === undefined || spec.init === '' ? 0 : spec.init === '1' ? 1 : spec.init === '0' ? 0 : -1
    if (q0 < 0) throw new DlogicInputError('ff 的初态只能是 0 或 1。')
    if (gated) signals.push({ name: 'CP', wave: cpWave(waves.get('CP'), T), role: 'input' })
    else signals.push({ name: 'CP', wave: 'p'.repeat(T), role: 'clock' })
    for (const p of info.inputs.filter(x => x !== 'CP')) {
      signals.push({ name: p, wave: (waves.get(p) ?? '0'.repeat(T)).slice(0, T), role: 'input' })
    }
    const q: (Bit | 'X')[] = []
    let cur: Bit | 'X' = q0 as Bit
    for (let t = 0; t < T; t++) {
      q.push(cur)
      if (cur === 'X') continue
      const v: Record<string, Bit> = {}
      for (const p of info.inputs) v[p] = p === 'CP' ? bitAt(waves.get('CP') ?? '1'.repeat(T), t) : bitAt(waves.get(p), t)
      cur = stepFf(spec.ffKind, cur, v)
    }
    signals.push({ name: 'Q', wave: q.map(charOf).join(''), role: 'state' })
    return { target, steps: T, signals }
  }

  if (target === 'analyze') {
    const m = compileMachine(spec.flipflops ?? [], spec.inputs ?? [], spec.outputs ?? [])
    const n = m.ffs.length
    const mi = m.inputs.length
    const initK = spec.init === undefined || spec.init.trim() === '' ? 0 : keyOf(parseBits(spec.init, n, '初态'))
    signals.push({ name: 'CP', wave: 'p'.repeat(T), role: 'clock' })
    for (const nm of m.inputs) signals.push({ name: nm, wave: (waves.get(nm) ?? '0'.repeat(T)).slice(0, T), role: 'input' })
    const stateCols: string[][] = m.ffs.map(() => [])
    const outCols: string[][] = m.outputs.map(() => [])
    let cur: number | null = initK
    for (let t = 0; t < T; t++) {
      const x = keyOf(m.inputs.map(nm => bitAt(waves.get(nm), t)) as Bit[])
      const sb = cur === null ? null : bitsOf(cur, n)
      m.ffs.forEach((_f, i) => stateCols[i].push(sb === null ? 'x' : String(sb[i])))
      if (sb === null) {
        outCols.forEach(c => c.push('x'))
        continue
      }
      const mv = move(m, sb, bitsOf(x, mi))
      mv.outs.forEach((o, i) => outCols[i].push(String(o)))
      cur = mv.next === null ? null : keyOf(mv.next)
    }
    m.ffs.forEach((f, i) => signals.push({ name: f.name, wave: stateCols[i].join(''), role: 'state' }))
    m.outputs.forEach((o, i) => signals.push({ name: o.name, wave: outCols[i].join(''), role: 'output' }))
    return { target, steps: T, signals }
  }

  if (target === 'counter') {
    if (spec.model === undefined || spec.method === undefined || spec.N === undefined) {
      throw new DlogicInputError('counter 波形需要 model、method 与 N。')
    }
    const c = counterDesign(spec.model, spec.method, spec.N)
    const cycle = c.sequence.filter(r => !r.transient)
    signals.push({ name: 'CP', wave: 'p'.repeat(T), role: 'clock' })
    c.bitNames.forEach((name, bi) => {
      let w = ''
      for (let t = 0; t < T; t++) {
        const row = cycle[t % cycle.length]
        w += row.bits.replace(' ', '')[bi]
      }
      signals.push({ name, wave: w, role: 'state' })
    })
    return { target, steps: T, signals }
  }

  // shift
  if (spec.shiftKind === undefined) throw new DlogicInputError('shift 波形需要 shiftKind。')
  const kind = spec.shiftKind
  const n = kind === '194' ? 4 : spec.bits ?? 4
  if (!Number.isInteger(n) || n < 2 || n > 8) throw new DlogicInputError('移位寄存器位数须为 2～8。')
  const defaultInit = kind === 'ring' ? '0'.repeat(n - 1) + '1' : '0'.repeat(n)
  const initStr = spec.init === undefined || spec.init.trim() === '' ? defaultInit : spec.init.trim()
  let curBits = shiftBits(shiftParse(initStr, n), n)
  signals.push({ name: 'CP', wave: 'p'.repeat(T), role: 'clock' })
  if (kind === '194') signals.push({ name: 'D', wave: (waves.get('D') ?? '0'.repeat(T)).slice(0, T), role: 'input' })
  const cols: string[][] = Array.from({ length: n }, () => [])
  const dir = spec.direction ?? 'right'
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < n; i++) cols[i].push(String(curBits[i]))
    curBits = shiftNext(kind, dir, curBits, bitAt(waves.get('D'), t))
  }
  for (let i = n - 1; i >= 0; i--) signals.push({ name: `Q${i}`, wave: cols[i].join(''), role: 'state' })
  return { target, steps: T, signals }
}

/** CP 门控波形：未给出时全为 1（允许锁存器透明），给出时原样使用。 */
function cpWave(w: string | undefined, T: number): string {
  return w === undefined ? '1'.repeat(T) : w.slice(0, T)
}
