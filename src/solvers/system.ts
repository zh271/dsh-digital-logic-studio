// 数字系统求解器：ASM 图校验（互斥、完备、可达、悬空）、状态转移表，以及三种小型控制器的设计。
// 纯函数，不做 I/O，不依赖 DSH。控制函数的化简复用 solvers/bool.ts 的 minimize。
// 约定：状态按 ASM 图给出的顺序编号 0..n-1；条件变量的组合编号中第一个变量为最高位（与 bool 一致）。
import { DlogicInputError } from '../shared/contracts.ts'
import type {
  AsmIssue,
  AsmResult,
  AsmSpec,
  AsmState,
  AsmTableRow,
  ControllerResult,
  CtrlFunction,
  DecoderRow,
  MuxDesign,
  SchemeDesign,
} from '../shared/system.ts'
import { minimize, specFromExpr } from './bool.ts'

export const MAX_STATES = 12
export const MAX_COND_VARS = 4
export const MAX_TRANSITIONS = 96

const MAX_MINIMIZE_VARS = 6
const IDENT = /[A-Za-z][A-Za-z0-9_]*/g
const REGISTER_PREFIXES = ['Q', 'P', 'R', 'T', 'U']

/** 出口：to 为目标状态下标；set 为使该出口有效的条件组合（else 出口已补足其余组合）。 */
interface Exit {
  to: number
  cond: string
  isElse: boolean
  set: boolean[]
}

/** 校验后的内部表示。 */
export interface Prepared {
  names: string[]
  states: AsmState[]
  vars: string[]
  combos: number
  initial: number
  exits: Exit[][]
  condOuts: { state: number; name: string; set: boolean[] }[]
  issues: AsmIssue[]
  reachable: boolean[]
}

function isElseCond(c: string): boolean {
  return c.trim().toLowerCase() === 'else'
}

function bitsFor(n: number): number {
  let k = 1
  while (1 << k < n) k++
  return k
}

function comboLabel(vars: string[], m: number): string {
  if (vars.length === 0) return '（无条件）'
  return vars.map((v, i) => `${v}=${(m >> (vars.length - 1 - i)) & 1}`).join(' ')
}

/** 条件变量：先取 conditionVars，再按表达式中的标识符首次出现顺序补充。超过上限报错。 */
export function condVarsOf(spec: AsmSpec): string[] {
  const out: string[] = []
  const add = (v: string): void => {
    if (!out.includes(v)) out.push(v)
  }
  for (const v of spec.conditionVars ?? []) {
    if (typeof v !== 'string' || v.trim() === '') throw new DlogicInputError('conditionVars 中的变量名不能为空')
    add(v.trim())
  }
  const exprs: string[] = []
  for (const t of spec.transitions) if (typeof t.cond === 'string' && !isElseCond(t.cond)) exprs.push(t.cond)
  for (const s of spec.states) for (const c of s.conditionals ?? []) exprs.push(c.expr)
  for (const e of exprs) for (const m of e.match(IDENT) ?? []) add(m)
  if (out.length > MAX_COND_VARS) {
    throw new DlogicInputError(`条件变量最多 ${MAX_COND_VARS} 个，当前为 ${out.length} 个（${out.join('、')}）`)
  }
  return out
}

function condSet(expr: string, vars: string[], combos: number): boolean[] {
  const set = new Array<boolean>(combos).fill(false)
  for (const m of specFromExpr(expr.trim(), vars).minterms) set[m] = true
  return set
}

/** 校验规模与结构（不合法的输入抛出 DlogicInputError），并计算各状态的出口条件。 */
export function prepareAsm(spec: AsmSpec): Prepared {
  if (!spec || !Array.isArray(spec.states) || spec.states.length === 0) {
    throw new DlogicInputError('states 至少需要包含一个状态')
  }
  const n = spec.states.length
  if (n > MAX_STATES) throw new DlogicInputError(`状态数最多 ${MAX_STATES} 个，当前为 ${n} 个`)
  if (!Array.isArray(spec.transitions)) throw new DlogicInputError('transitions 必须是数组')
  if (spec.transitions.length > MAX_TRANSITIONS) {
    throw new DlogicInputError(`转移数最多 ${MAX_TRANSITIONS} 条，当前为 ${spec.transitions.length} 条`)
  }
  const names = spec.states.map(s => {
    if (typeof s?.name !== 'string' || s.name.trim() === '') throw new DlogicInputError('状态名不能为空')
    return s.name.trim()
  })
  const index = new Map<string, number>()
  names.forEach((nm, i) => {
    if (index.has(nm)) throw new DlogicInputError(`状态名重复：${nm}`)
    index.set(nm, i)
  })
  const states: AsmState[] = spec.states.map((s, i) => ({
    name: names[i],
    outputs: (s.outputs ?? []).map(o => String(o).trim()).filter(o => o !== ''),
    conditionals: (s.conditionals ?? []).map(c => {
      if (typeof c?.name !== 'string' || c.name.trim() === '') throw new DlogicInputError(`状态 ${names[i]} 的条件输出名不能为空`)
      if (typeof c.expr !== 'string' || c.expr.trim() === '') throw new DlogicInputError(`条件输出 ${c.name} 缺少表达式`)
      return { name: c.name.trim(), expr: c.expr.trim() }
    }),
  }))

  const initName = spec.initial === undefined ? names[0] : spec.initial
  const initial = index.get(initName)
  if (initial === undefined) throw new DlogicInputError(`初始状态 ${initName} 不存在`)

  for (const t of spec.transitions) {
    if (!index.has(t.from)) throw new DlogicInputError(`转移的现态 ${t.from} 不存在`)
    if (!index.has(t.to)) throw new DlogicInputError(`转移的次态 ${t.to} 不存在`)
    if (typeof t.cond !== 'string' || t.cond.trim() === '') {
      throw new DlogicInputError(`从 ${t.from} 出发的转移缺少条件（可写 else 或 1）`)
    }
  }

  const vars = condVarsOf(spec)
  const combos = 1 << vars.length
  const issues: AsmIssue[] = []
  const exits: Exit[][] = names.map(() => [])

  for (let s = 0; s < n; s++) {
    const own = spec.transitions.filter(t => index.get(t.from) === s)
    const conds = own.filter(t => !isElseCond(t.cond))
    const elses = own.filter(t => isElseCond(t.cond))
    const list: Exit[] = conds.map(t => ({
      to: index.get(t.to) as number,
      cond: t.cond.trim(),
      isElse: false,
      set: condSet(t.cond, vars, combos),
    }))
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const hit = list[a].set.findIndex((v, m) => v && list[b].set[m])
        if (hit >= 0) {
          issues.push({
            level: 'error',
            kind: 'overlap',
            state: names[s],
            message: `状态 ${names[s]} 的条件“${list[a].cond}”与“${list[b].cond}”同时成立（如 ${comboLabel(vars, hit)}）`,
          })
        }
      }
    }
    const covered = new Array<boolean>(combos).fill(false)
    for (const e of list) e.set.forEach((v, m) => { if (v) covered[m] = true })
    const uncovered = covered.map(v => !v)
    if (elses.length > 1) {
      issues.push({ level: 'error', kind: 'multi-else', state: names[s], message: `状态 ${names[s]} 有多个 else 出口` })
    }
    if (elses.length >= 1) {
      list.push({ to: index.get(elses[0].to) as number, cond: 'else', isElse: true, set: uncovered })
      if (!uncovered.some(v => v)) {
        issues.push({
          level: 'warning',
          kind: 'dead-else',
          state: names[s],
          message: `状态 ${names[s]} 的 else 分支永远不会执行（其余条件已覆盖全部取值）`,
        })
      }
    } else if (uncovered.some(v => v)) {
      const m = uncovered.indexOf(true)
      issues.push({
        level: 'error',
        kind: 'missing-else',
        state: names[s],
        message: `状态 ${names[s]} 缺少 else：条件未覆盖 ${comboLabel(vars, m)} 等取值`,
      })
    }
    if (list.length === 0) {
      issues.push({ level: 'error', kind: 'dangling', state: names[s], message: `悬空状态 ${names[s]}：没有任何出口` })
    }
    exits[s] = list
  }

  const reachable = new Array<boolean>(n).fill(false)
  const queue: number[] = [initial]
  reachable[initial] = true
  while (queue.length > 0) {
    const s = queue.shift() as number
    for (const e of exits[s]) {
      if (!reachable[e.to]) {
        reachable[e.to] = true
        queue.push(e.to)
      }
    }
  }
  for (let s = 0; s < n; s++) {
    if (!reachable[s]) {
      issues.push({
        level: 'error',
        kind: 'unreachable',
        state: names[s],
        message: `状态 ${names[s]} 从初始状态 ${names[initial]} 不可达`,
      })
    }
  }

  const condOuts: { state: number; name: string; set: boolean[] }[] = []
  states.forEach((s, i) => {
    for (const c of s.conditionals) condOuts.push({ state: i, name: c.name, set: condSet(c.expr, vars, combos) })
  })

  return { names, states, vars, combos, initial, exits, condOuts, issues, reachable }
}

/** 组合 m 下状态 s 的次态下标，无出口时为 -1。 */
function nextIdx(p: Prepared, s: number, m: number): number {
  const e = p.exits[s].find(x => x.set[m])
  return e ? e.to : -1
}

function nextName(p: Prepared, s: number, m: number): string | null {
  const t = nextIdx(p, s, m)
  return t < 0 ? null : p.names[t]
}

/** 校验 ASM 图，并给出等价的状态转移表。 */
export function analyzeAsm(spec: AsmSpec): AsmResult {
  const p = prepareAsm(spec)
  const rows: AsmTableRow[] = p.names.map((name, s) => ({
    state: name,
    outputs: [...p.states[s].outputs],
    cells: Array.from({ length: p.combos }, (_, m) => ({
      next: nextName(p, s, m),
      active: p.condOuts.filter(c => c.state === s && c.set[m]).map(c => c.name),
    })),
  }))
  const valid = !p.issues.some(i => i.level === 'error')
  return {
    states: p.names,
    initial: p.names[p.initial],
    conditionVars: p.vars,
    valid,
    issues: p.issues,
    table: {
      vars: p.vars,
      combos: Array.from({ length: p.combos }, (_, m) => comboLabel(p.vars, m)),
      rows,
    },
  }
}

// ───────────────────────── 控制函数的构造与化简 ─────────────────────────

/** 去掉第 i 个变量（N 个变量中下标 0 为最高位）；若该变量影响取值则返回 null。无关项不冲突。 */
function dropVar(val: number[], N: number, i: number): number[] | null {
  const p = N - 1 - i
  const bit = 1 << p
  const out = new Array<number>(1 << (N - 1))
  for (let mm = 0; mm < 1 << N; mm++) {
    if (mm & bit) continue
    const a = val[mm]
    const b = val[mm | bit]
    let merged: number
    if (a === 2) merged = b
    else if (b === 2) merged = a
    else if (a === b) merged = a
    else return null
    const low = mm & (bit - 1)
    const high = (mm >> (p + 1)) << p
    out[high | low] = merged
  }
  return out
}

function constFn(name: string, role: CtrlFunction['role'], text: string): CtrlFunction {
  return {
    name,
    role,
    variables: [],
    minterms: [],
    dontCares: [],
    text,
    texts: [text],
    latex: [text],
    cost: { terms: 0, literals: 0 },
    minimized: true,
  }
}

/**
 * 由取值表构造控制函数：val[m] 为 1、0 或 2（无关项）。先去掉不影响取值的变量，
 * 再用 minimize 化简（变量不超过 6 个）；超过时只给出最小项和式，并标记为未化简。
 */
export function buildFunction(name: string, role: CtrlFunction['role'], vars0: string[], val0: number[]): CtrlFunction {
  let vars = vars0.slice()
  let val = val0.slice()
  let i = 0
  while (i < vars.length) {
    const reduced = dropVar(val, vars.length, i)
    if (reduced) {
      val = reduced
      vars = vars.filter((_, k) => k !== i)
    } else {
      i++
    }
  }
  if (vars.length === 0) return constFn(name, role, val[0] === 1 ? '1' : '0')
  const on: number[] = []
  const dc: number[] = []
  let hasZero = false
  val.forEach((v, m) => {
    if (v === 1) on.push(m)
    else if (v === 2) dc.push(m)
    else hasZero = true
  })
  if (on.length === 0) return constFn(name, role, '0')
  if (!hasZero) return constFn(name, role, '1')
  if (vars.length <= MAX_MINIMIZE_VARS) {
    const r = minimize({ variables: vars, minterms: on, dontCares: dc }, 'SOP')
    return { name, role, variables: vars, minterms: on, dontCares: dc, text: r.texts[0], texts: r.texts, latex: r.latex, cost: r.cost, minimized: true }
  }
  const text = `Σm(${on.join(', ')})`
  return {
    name,
    role,
    variables: vars,
    minterms: on,
    dontCares: dc,
    text,
    texts: [text],
    latex: [`\\sum m(${on.join(', ')})`],
    cost: { terms: on.length, literals: on.length * vars.length },
    minimized: false,
  }
}

/** 状态寄存器位名前缀：避开条件变量的名字（如 Q0）。 */
function registerPrefix(vars: string[]): string {
  for (const pre of REGISTER_PREFIXES) {
    if (!vars.some(v => new RegExp(`^${pre}\\d+$`).test(v))) return pre
  }
  return 'Q'
}

function gateDevice(fns: CtrlFunction[]): string {
  const terms = fns.reduce((acc, f) => acc + f.cost.terms, 0)
  const literals = fns.reduce((acc, f) => acc + f.cost.literals, 0)
  return `门电路：实现上述 ${fns.length} 个函数（共 ${terms} 个乘积项，${literals} 个文字）`
}

function muxChip(k: number): string {
  if (k <= 2) return '74153（双 4 选 1）'
  if (k === 3) return '74151（8 选 1）'
  return '74150（16 选 1）'
}

// ───────────────────────── 三种控制器 ─────────────────────────

/** 计数器型：状态编码为计数序列，计数器加 1 或置数，译码器给出各状态的译码输出。 */
function counterScheme(p: Prepared): SchemeDesign {
  const n = p.names.length
  const m = p.vars.length
  const k = bitsFor(n)
  const pre = registerPrefix(p.vars)
  const bits = Array.from({ length: k }, (_, i) => `${pre}${k - 1 - i}`)
  const mod = 1 << k
  const size = 1 << (k + m)
  const vars = [...bits, ...p.vars]
  const ce: number[] = []
  const ld: number[] = []
  const dData: number[][] = bits.map(() => [])
  for (let mm = 0; mm < size; mm++) {
    const code = mm >> m
    const combo = mm & ((1 << m) - 1)
    if (code >= n) {
      ce.push(2)
      ld.push(2)
      dData.forEach(a => a.push(2))
      continue
    }
    const nx = nextIdx(p, code, combo)
    if (nx < 0 || nx === code) {
      ce.push(0)
      ld.push(0)
      dData.forEach(a => a.push(2))
    } else if (nx === (code + 1) % mod) {
      ce.push(1)
      ld.push(0)
      dData.forEach(a => a.push(2))
    } else {
      ce.push(0)
      ld.push(1)
      dData.forEach((a, b) => a.push((nx >> (k - 1 - b)) & 1))
    }
  }
  const functions: CtrlFunction[] = [
    buildFunction('CE', 'count', vars, ce),
    buildFunction('LD', 'load', vars, ld),
    ...bits.map((b, i) => buildFunction(`D_${b}`, 'load-data', vars, dData[i])),
  ]
  const decoder: DecoderRow[] = p.names.map((name, i) => ({
    state: name,
    code: i.toString(2).padStart(k, '0'),
    line: `Y${i}`,
  }))
  return {
    scheme: 'counter',
    bits,
    codes: decoder.map(d => ({ state: d.state, code: d.code })),
    decoder,
    functions,
    devices: [
      '计数器：74161（4 位同步二进制计数器，置数端低电平有效）× 1',
      `译码器：74LS138 × ${n > 8 ? 2 : 1}，产生各状态的译码输出 Y0 … Y${n - 1}`,
      gateDevice(functions),
    ],
    notes: [
      `状态编码为计数序列：状态 i 的编码为 i 的 ${k} 位二进制数；未用编码作无关项。`,
      'CE = 1 表示计数：现态的出口为下一个编码（模 2^k），计数器加 1。',
      'LD = 1 表示置数：转移到非后继状态，计数器置入目标编码（置数值 D）；LD 优先于计数。',
      '自循环（出口回到本状态）时 CE = LD = 0，计数器保持。',
      '74161 的置数端为 LOAD̄（低有效），接 LOAD̄ = ¬LD；计数使能 ENP = ENT = CE。',
    ],
  }
}

/** 多路选择器型：每个状态位的次态由一个 2^k 选 1 的 MUX 选择，地址端接现态，数据端为条件表达式。 */
function muxScheme(p: Prepared): SchemeDesign {
  const n = p.names.length
  const m = p.vars.length
  const k = bitsFor(n)
  const pre = registerPrefix(p.vars)
  const bits = Array.from({ length: k }, (_, i) => `${pre}${k - 1 - i}`)
  const mod = 1 << k
  const functions: CtrlFunction[] = []
  for (let s = 0; s < n; s++) {
    for (let bi = 0; bi < k; bi++) {
      const val: number[] = []
      for (let c = 0; c < 1 << m; c++) {
        const nx = nextIdx(p, s, c)
        val.push(nx >= 0 && (nx >> (k - 1 - bi)) & 1 ? 1 : 0)
      }
      functions.push(buildFunction(`${bits[bi]}|${p.names[s]}`, 'mux-data', p.vars, val))
    }
  }
  const muxes: MuxDesign[] = bits.map((bit, bi) => ({
    bit,
    select: [...bits],
    rows: Array.from({ length: mod }, (_, code) => {
      const codeText = code.toString(2).padStart(k, '0')
      if (code >= n) return { code: codeText, state: null, data: '0' }
      const f = functions.find(x => x.name === `${bits[bi]}|${p.names[code]}`) as CtrlFunction
      return { code: codeText, state: p.names[code], data: f.texts[0] }
    }),
  }))
  return {
    scheme: 'mux',
    bits,
    codes: p.names.map((name, i) => ({ state: name, code: i.toString(2).padStart(k, '0') })),
    muxes,
    functions,
    devices: [
      `状态寄存器：D 触发器 × ${k}（存放 ${bits.join('、')}）`,
      ...muxes.map(mx => `数据选择器：${muxChip(k)} × 1，输出次态位 ${mx.bit}（地址端接 ${bits.join('、')}）`),
      gateDevice(functions),
    ],
    notes: [
      `状态编码为 ${k} 位二进制数；未用编码的数据端取 0。`,
      '每个状态位的次态由一个 MUX 选择：地址端接现态，数据端 i 为现态为 i 时该位的次态条件表达式。',
      '数据端只与条件变量有关，化简后可直接接线；无条件转移时数据端为 1 或 0。',
    ],
  }
}

/** 定序型：一态一位（环形/移位寄存器型），无效码作无关项。 */
function sequenceScheme(p: Prepared): SchemeDesign {
  const n = p.names.length
  const m = p.vars.length
  const pre = registerPrefix(p.vars)
  const bits = Array.from({ length: n }, (_, i) => `${pre}${n - 1 - i}`)
  const size = 1 << (n + m)
  const vars = [...bits, ...p.vars]
  const functions: CtrlFunction[] = []
  for (let j = 0; j < n; j++) {
    const val: number[] = []
    for (let mm = 0; mm < size; mm++) {
      const pat = mm >> m
      const combo = mm & ((1 << m) - 1)
      if (pat === 0 || (pat & (pat - 1)) !== 0) {
        val.push(2)
        continue
      }
      const i = Math.log2(pat)
      val.push(nextIdx(p, i, combo) === j ? 1 : 0)
    }
    functions.push(buildFunction(`${pre}${j}⁺`, 'next', vars, val))
  }
  return {
    scheme: 'sequence',
    bits,
    codes: p.names.map((name, i) => ({
      state: name,
      code: bits.map((_, b) => (n - 1 - b === i ? '1' : '0')).join(''),
    })),
    functions,
    devices: [
      `状态寄存器：D 触发器 × ${n}（一态一位），或移位寄存器 74194 × ${Math.ceil(n / 4)} 接成环形计数器`,
      gateDevice(functions),
    ],
    notes: [
      `一态一位：状态 i 对应第 i 位（记作 ${pre}i），该位为 1 表示处于状态 i，其余位为 0。`,
      `复位后 ${pre}${p.initial} = 1，其余位为 0，即初始状态为 ${p.names[p.initial]}。`,
      '无效码（不止一位为 1，或全为 0）作无关项，化简式只在有效码上等价，形式可能与直接写出的不同。',
      `次态 ${pre}j⁺ = 1 当且仅当某出口条件成立且转移到状态 j。`,
      '控制信号由对应状态位直接译出（条件输出为状态位与条件相与）。',
    ],
  }
}

function signalCell(state: AsmState, name: string): string {
  if (state.outputs.includes(name)) return '1'
  const conds = state.conditionals.filter(c => c.name === name)
  if (conds.length > 0) return conds.map(c => c.expr).join(' + ')
  return '0'
}

/** 设计三种控制器（计数器型、多路选择器型、定序型）。ASM 图未通过校验时抛出 DlogicInputError。 */
export function designController(spec: AsmSpec): ControllerResult {
  const p = prepareAsm(spec)
  const errors = p.issues.filter(i => i.level === 'error')
  if (errors.length > 0) {
    throw new DlogicInputError(`ASM 图未通过校验，无法设计控制器：${errors.map(e => e.message).join('；')}`)
  }
  const signals: string[] = []
  for (const s of p.states) {
    for (const o of s.outputs) if (!signals.includes(o)) signals.push(o)
    for (const c of s.conditionals) if (!signals.includes(c.name)) signals.push(c.name)
  }
  const controlTable = p.states.map(s => ({ state: s.name, values: signals.map(sig => signalCell(s, sig)) }))
  return {
    states: p.names,
    initial: p.names[p.initial],
    conditionVars: p.vars,
    signals,
    controlTable,
    schemes: [counterScheme(p), muxScheme(p), sequenceScheme(p)],
  }
}
