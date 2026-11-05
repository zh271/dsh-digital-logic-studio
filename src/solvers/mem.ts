// dlogic_mem 的求解器：存储器扩展（expand）、ROM 实现函数（rom_func）、PLA / PAL 阵列（pla / pal）、LUT 掩码（lut）。
// 纯函数，不做 I/O，不依赖 DSH。约定与 bool.ts 相同：最小项编号中 variables[0] 为最高位（MSB）。
// 只使用可擦除的 TypeScript 语法。

import { DlogicInputError } from '../shared/contracts.ts'
import type { BoolSpec, Implicant, Step } from '../shared/contracts.ts'
import type { MsiWire } from '../shared/comb.ts'
import type {
  ExpandChip,
  AddressRange,
  DecodeInfo,
  ExpandMode,
  ExpandResult,
  LutCofactor,
  LutResult,
  MemSize,
  PlaOutput,
  PlaResult,
  PlaTerm,
  RomResult,
  RomRow,
} from '../shared/mem.ts'
import { minimize, specFromExpr } from './bool.ts'
import { latexName } from './comb.ts'

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/
const MAX_FUNC_VARS = 6
const MAX_OUTPUTS = 8
const MAX_TERMS = 64
const MAX_WORDS = 1 << 20
const MAX_BITS = 64
const MAX_CHIPS = 128
const MAX_SELECT_GROUPS = 8
const MAX_PAL_TERMS = 8
const PICK_CAP = 512

export interface Outcome<R> {
  result: R
  steps: Step[]
  warnings: string[]
}

export interface ExpandRequest {
  targetWords: number
  targetBits: number
  chipWords: number
  chipBits: number
  /**
   * 仅在用户明确要求单译码或双译码结构时给出；不给出时结果中 decode 为 null，
   * 文字与卡片都不输出“译码结构”块（芯片扩展的片选译码由 138 接线说明）。
   */
  decode?: 'single' | 'double'
  /** 双译码时的行译码位数，默认取地址位数的一半（向下取整）。 */
  rowBits?: number
}

export interface OutputRequest {
  name?: string
  expr?: string
  minterms?: number[]
  dontCares?: number[]
}

export interface LutRequest {
  variables?: string[]
  expr?: string
  minterms?: number[]
  dontCares?: number[]
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

function isPow2(x: number): boolean {
  return Number.isInteger(x) && x >= 2 && (x & (x - 1)) === 0
}

function log2(x: number): number {
  let n = 0
  while ((1 << n) < x) n++
  return n
}

function hexText(v: number, digits: number): string {
  return v.toString(16).toUpperCase().padStart(digits, '0')
}

function binText(v: number, n: number): string {
  return n === 0 ? '' : v.toString(2).padStart(n, '0')
}

// ───────────────────────── 输入校验 ─────────────────────────

function checkVariables(variables: unknown, max: number, allowEmpty: boolean): string[] {
  if (!Array.isArray(variables)) throw new DlogicInputError('需要提供 variables（变量名列表，variables[0] 为最高位）。')
  if (variables.length === 0 && !allowEmpty) throw new DlogicInputError('变量至少需要一个。')
  if (variables.length > max) throw new DlogicInputError(`最多支持 ${max} 个变量，当前为 ${variables.length} 个。`)
  const seen = new Set<string>()
  for (const v of variables) {
    if (typeof v !== 'string' || !NAME_RE.test(v)) {
      throw new DlogicInputError(`变量“${String(v)}”不合法：变量名应以字母开头，只含字母、数字与下划线。`)
    }
    if (seen.has(v)) throw new DlogicInputError(`变量“${v}”重复。`)
    seen.add(v)
  }
  return variables.slice()
}

function normList(list: unknown, total: number, label: string): number[] {
  if (list === undefined) return []
  if (!Array.isArray(list)) throw new DlogicInputError(`${label}应为整数数组。`)
  const set = new Set<number>()
  for (const m of list) {
    if (!Number.isInteger(m)) throw new DlogicInputError(`${label}中含有非整数：${String(m)}。`)
    if (m < 0 || m >= total) throw new DlogicInputError(`${label}编号 ${m} 超出范围（0～${total - 1}）。`)
    set.add(m)
  }
  return [...set].sort((a, b) => a - b)
}

/** 由 expr 或 minterms 得到函数规范；vars 为空时 expr 的变量由表达式推定。 */
function specFromRequest(
  req: { expr?: string; minterms?: number[]; dontCares?: number[] },
  vars: unknown,
  allowEmptyVars: boolean,
  label: string,
): BoolSpec {
  let spec: BoolSpec
  if (typeof req.expr === 'string' && req.expr.trim() !== '') {
    const base = specFromExpr(req.expr, vars === undefined ? undefined : (vars as string[]))
    spec = {
      variables: base.variables,
      minterms: base.minterms,
      dontCares: normList(req.dontCares, 1 << base.variables.length, '无关项'),
    }
  } else if (Array.isArray(req.minterms)) {
    const v = checkVariables(vars, MAX_FUNC_VARS, allowEmptyVars)
    const total = 1 << v.length
    spec = {
      variables: v,
      minterms: normList(req.minterms, total, '最小项'),
      dontCares: normList(req.dontCares, total, '无关项'),
    }
  } else {
    throw new DlogicInputError(`${label}缺少函数：请提供 expr，或同时提供 minterms 与 variables。`)
  }
  if (spec.minterms.some(m => spec.dontCares.includes(m))) {
    throw new DlogicInputError(`${label}同一编号不能同时是最小项与无关项。`)
  }
  return spec
}

function specText(spec: BoolSpec): string {
  let s = `F(${spec.variables.join(',')}) = Σm(${spec.minterms.join(',')})`
  if (spec.dontCares.length) s += ` + Σd(${spec.dontCares.join(',')})`
  return s
}

function specLatex(spec: BoolSpec): string {
  let s = `F(${spec.variables.join(',')}) = \\sum m(${spec.minterms.join(',')})`
  if (spec.dontCares.length) s += ` + \\sum d(${spec.dontCares.join(',')})`
  return s
}

/** 多输出函数列表：名称默认 F1、F2 …；全部共用同一组变量。 */
function outputSpecs(vars: string[], outputs: unknown, label: string): { names: string[]; specs: BoolSpec[]; hasDontCare: boolean } {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new DlogicInputError(`${label} 至少需要一个输出函数（outputs）。`)
  }
  if (outputs.length > MAX_OUTPUTS) {
    throw new DlogicInputError(`输出函数最多 ${MAX_OUTPUTS} 个，当前为 ${outputs.length} 个。`)
  }
  const names: string[] = []
  const specs: BoolSpec[] = []
  let hasDontCare = false
  outputs.forEach((o: OutputRequest, i: number) => {
    const name = typeof o?.name === 'string' && o.name !== '' ? o.name : `F${i + 1}`
    if (!NAME_RE.test(name)) throw new DlogicInputError(`输出名“${name}”不合法：应以字母开头，只含字母、数字与下划线。`)
    if (names.includes(name)) throw new DlogicInputError(`输出名“${name}”重复。`)
    const spec = specFromRequest(o, vars, false, `输出 ${name} `)
    if (spec.dontCares.length) hasDontCare = true
    names.push(name)
    specs.push(spec)
  })
  return { names, specs, hasDontCare }
}

// ───────────────────────── 存储器扩展（expand） ─────────────────────────

function decodeInfo(n: number, mode: string, rowBits: number | undefined): DecodeInfo {
  if (mode !== 'single' && mode !== 'double') {
    throw new DlogicInputError('译码方式应为 single（单译码）或 double（双译码）。')
  }
  if (n < 1) throw new DlogicInputError('地址线为 0 位，无需译码。')
  if (mode === 'single') {
    return {
      mode: 'single',
      addressBits: n,
      rowBits: n,
      colBits: 0,
      rows: 1 << n,
      cols: 1,
      decoderLines: 1 << n,
      cellsPerBit: 1 << n,
      note: `单译码：${n} 位地址直接译码为 ${1 << n} 根字线，每根字线选中一个字。`,
    }
  }
  if (n < 2) throw new DlogicInputError('双译码至少需要 2 位地址线。')
  const r = rowBits ?? Math.floor(n / 2)
  if (!Number.isInteger(r) || r < 1 || r > n - 1) {
    throw new DlogicInputError(`行译码位数应为 1 到 ${n - 1} 之间的整数，当前为 ${String(rowBits)}。`)
  }
  const c = n - r
  return {
    mode: 'double',
    addressBits: n,
    rowBits: r,
    colBits: c,
    rows: 1 << r,
    cols: 1 << c,
    decoderLines: (1 << r) + (1 << c),
    cellsPerBit: 1 << n,
    note: `双译码：高 ${r} 位译出 ${1 << r} 根行线，低 ${c} 位译出 ${1 << c} 根列线；每位存储单元排成 ${1 << r} 行 × ${1 << c} 列，行线与列线交点选中一个单元。`,
  }
}

/** 位 / 字 / 字位扩展：芯片数、地址线分配、138 片选接线与地址映射表。 */
export function expandMemory(req: ExpandRequest): Outcome<ExpandResult> {
  const W = req.targetWords
  const B = req.targetBits
  const w = req.chipWords
  const b = req.chipBits
  if (!isPow2(W) || W > MAX_WORDS) {
    throw new DlogicInputError(`目标字数应为不小于 2 的 2 的幂，且不超过 ${MAX_WORDS}，当前为 ${String(W)}。`)
  }
  if (!isPow2(w)) throw new DlogicInputError(`芯片字数应为不小于 2 的 2 的幂，当前为 ${String(w)}。`)
  if (w > W) throw new DlogicInputError(`芯片字数 ${w} 大于目标字数 ${W}，无法用此芯片组成目标存储器。`)
  if (!Number.isInteger(B) || B < 1 || B > MAX_BITS) {
    throw new DlogicInputError(`目标位数应为 1 到 ${MAX_BITS} 之间的整数，当前为 ${String(B)}。`)
  }
  if (!Number.isInteger(b) || b < 1 || b > B) {
    throw new DlogicInputError(`芯片位数应为 1 到 ${B} 之间的整数，当前为 ${String(b)}。`)
  }
  if (B % b !== 0) throw new DlogicInputError(`目标位数 ${B} 不是芯片位数 ${b} 的整数倍，无法按位扩展。`)
  const kw = W / w
  const kb = B / b
  if (kw === 1 && kb === 1) throw new DlogicInputError('芯片规格与目标容量相同，无需扩展。')
  if (kw > MAX_SELECT_GROUPS) {
    throw new DlogicInputError(
      `字向需要 ${kw} 组芯片，超过 ${MAX_SELECT_GROUPS} 组：一片 74LS138 无法直接选片，需要多级译码（此处不展开）。`,
    )
  }
  const chipCount = kw * kb
  if (chipCount > MAX_CHIPS) throw new DlogicInputError(`共需 ${chipCount} 片，超过 ${MAX_CHIPS} 片的上限。`)

  const n = log2(W)
  const k = log2(w)
  const s = n - k
  const mode: ExpandMode = kw > 1 && kb > 1 ? 'both' : kw > 1 ? 'word' : 'bit'
  const chipAddressLines = range(k).map(i => `A${i}`)
  const selectLines = range(s).map(j => `A${n - 1 - j}`)

  let decoder: ExpandResult['decoder'] = null
  if (kw > 1) {
    const addrPins = ['A2', 'A1', 'A0']
    const addrWiring: MsiWire[] = addrPins.map((p, idx) => {
      const j = idx - (3 - s)
      return j < 0 ? { pin: p, signal: 'GND', note: '高位地址接地' } : { pin: p, signal: selectLines[j] }
    })
    const enable: MsiWire[] = [
      { pin: 'S1', signal: 'VCC', note: '使能有效' },
      { pin: 'S̄2', signal: 'GND' },
      { pin: 'S̄3', signal: 'GND' },
    ]
    decoder = { chip: '138', wiring: [...addrWiring, ...enable], outputs: range(kw).map(g => `Y̅${g}`) }
  }

  const chips: ExpandChip[] = []
  for (let g = 0; g < kw; g++) {
    for (let h = 0; h < kb; h++) {
      chips.push({
        index: g * kb + h + 1,
        wordGroup: g,
        bitGroup: h,
        dataLow: h * b,
        dataHigh: h * b + b - 1,
        select: kw > 1 ? `Y̅${g}` : 'GND',
      })
    }
  }

  const digits = Math.max(1, Math.ceil(n / 4))
  const addressMap: AddressRange[] = range(kw).map(g => {
    const low = g * w
    const high = low + w - 1
    return {
      wordGroup: g,
      chips: chips.filter(c => c.wordGroup === g).map(c => c.index),
      low,
      high,
      lowHex: hexText(low, digits) + 'H',
      highHex: hexText(high, digits) + 'H',
    }
  })

  const decode = req.decode === undefined ? null : decodeInfo(n, req.decode, req.rowBits)

  const warnings: string[] = []
  if (kw === 1) warnings.push('只做位扩展：各片片选接地（常选通），读写控制线并联。')

  const steps: Step[] = [
    { kind: 'capacity', text: `目标容量 ${W}×${B}＝${W * B} 位，芯片 ${w}×${b}＝${w * b} 位。` },
    {
      kind: 'mode',
      text:
        mode === 'bit'
          ? `位扩展：字数相同，${kb} 片地址线并联，数据线分组接入。`
          : mode === 'word'
            ? `字扩展：位数相同，${kw} 组芯片按地址区间分段，高位地址经译码选片。`
            : `字位扩展：先字向 ${kw} 组，每组再位向 ${kb} 片，共 ${chipCount} 片。`,
    },
    {
      kind: 'address',
      text:
        s > 0
          ? `芯片地址线 ${chipAddressLines.join('、')} 并接各片；高 ${s} 位 ${selectLines.join('、')} 进入 74LS138 译码选片。`
          : `芯片地址线 ${chipAddressLines.join('、')} 并接各片。`,
    },
  ]
  if (decoder) {
    steps.push({ kind: 'decode', text: `138 的 Y̅0～Y̅${kw - 1} 分别接第 0～${kw - 1} 组芯片的片选，低有效。` })
  }
  if (decode) steps.push({ kind: 'decode-structure', text: decode.note })

  return {
    result: {
      mode,
      target: { words: W, bits: B, capacity: W * B, addressBits: n },
      chip: { words: w, bits: b, capacity: w * b, addressBits: k },
      wordGroups: kw,
      bitGroups: kb,
      chipCount,
      chipAddressLines,
      selectLines,
      decoder,
      chips,
      addressMap,
      decode,
    },
    steps,
    warnings,
  }
}

// ───────────────────────── ROM 实现函数（rom_func） ─────────────────────────

/** 用 ROM 实现多输出组合函数：地址为变量取值，数据为各输出在该地址的值。 */
export function romFunction(variables: unknown, outputs: unknown): Outcome<RomResult> {
  const vars = checkVariables(variables, MAX_FUNC_VARS, false)
  const { names, specs, hasDontCare } = outputSpecs(vars, outputs, 'ROM')
  const n = vars.length
  const words = 1 << n
  const m = names.length
  const onSets = specs.map(sp => new Set(sp.minterms))
  const digits = Math.max(1, Math.ceil(m / 4))
  const rows: RomRow[] = range(words).map(a => {
    const data = onSets.map(on => (on.has(a) ? 1 : 0) as 0 | 1)
    const word = data.join('')
    return { address: a, addressBits: binText(a, n), data, word, hex: hexText(parseInt(word, 2), digits) }
  })
  const functions = specs.map((sp, i) => ({
    name: names[i],
    text: `${names[i]} = Σm(${sp.minterms.join(',')})`,
    latex: `${names[i]} = \\sum m(${sp.minterms.join(',')})`,
  }))
  const warnings: string[] = []
  if (hasDontCare) warnings.push('ROM 不利用无关项，无关项按 0 处理。')
  const steps: Step[] = [
    { kind: 'address', text: `地址线为 ${vars.join('、')}（${vars[0]} 为最高位），共 ${words} 个单元。` },
    { kind: 'data', text: `每个输出在其最小项对应的地址写 1，其余写 0；数据字的最左位为第一个输出。` },
    { kind: 'size', text: `ROM 容量 ${words}×${m}＝${words * m} 位。` },
  ]
  const size: MemSize = { words, bits: m, capacity: words * m, addressBits: n }
  return { result: { variables: vars, outputNames: names, size, functions, rows }, steps, warnings }
}

// ───────────────────────── PLA / PAL 阵列（pla / pal） ─────────────────────────

function allDash(n: number): Implicant {
  return { mask: '-'.repeat(n), covers: range(1 << n), literals: 0, text: '1', latex: '1' }
}

/** 单个输出的全部最简与或解；常数 0 时为空项列表，常数 1 时为全"-"项。 */
function coverSets(spec: BoolSpec): Implicant[][] {
  const n = spec.variables.length
  if (spec.minterms.length === 0) return [[]]
  if (spec.minterms.length === 1 << n) return [[allDash(n)]]
  const sols = minimize(spec, 'SOP').solutions
  return sols.length > 0 ? sols : [[]]
}

function sortImplicants(imps: Implicant[]): Implicant[] {
  return imps
    .slice()
    .sort((a, b) => a.literals - b.literals || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0))
}

/** 在各输出的最简解中选取一组，使共用后的乘积项最少（项数相同时文字数最少）。 */
function pickCovers(sols: Implicant[][][], shared: boolean): number[] {
  const picks = sols.map(() => 0)
  if (!shared) return picks
  let total = 1
  for (const s of sols) {
    total *= s.length
    if (total > PICK_CAP) return picks
  }
  let best = picks.slice()
  let bestCost: [number, number] | null = null
  for (;;) {
    const set = new Map<string, number>()
    sols.forEach((s, i) => {
      for (const imp of s[picks[i]]) set.set(imp.mask, imp.literals)
    })
    let lits = 0
    for (const v of set.values()) lits += v
    const cost: [number, number] = [set.size, lits]
    if (bestCost === null || cost[0] < bestCost[0] || (cost[0] === bestCost[0] && cost[1] < bestCost[1])) {
      bestCost = cost
      best = picks.slice()
    }
    let i = 0
    while (i < picks.length) {
      picks[i]++
      if (picks[i] < sols[i].length) break
      picks[i] = 0
      i++
    }
    if (i === picks.length) break
  }
  return best
}

/** 乘积项的文字写法：'1' 为原变量，'0' 为反变量，'-' 不出现。 */
function productText(mask: string, vars: string[]): { text: string; latex: string } {
  const sep = vars.every(v => v.length === 1) ? '' : '·'
  const lsep = sep === '' ? '' : '\\cdot '
  const txt: string[] = []
  const tex: string[] = []
  vars.forEach((v, i) => {
    if (mask[i] === '1') {
      txt.push(v)
      tex.push(latexName(v))
    } else if (mask[i] === '0') {
      txt.push(v + "'")
      tex.push(`\\overline{${latexName(v)}}`)
    }
  })
  if (txt.length === 0) return { text: '1', latex: '1' }
  return { text: txt.join(sep), latex: tex.join(lsep) }
}

/**
 * PLA（共用乘积项）或 PAL（或阵列固定，每输出最多 termsPerOutput 个乘积项）。
 * 各输出先用 minimize 得最简与或式，再合并或分配乘积项。
 */
export function plaFunction(variables: unknown, outputs: unknown, kind: 'pla' | 'pal', termsPerOutput: number): Outcome<PlaResult> {
  const vars = checkVariables(variables, MAX_FUNC_VARS, false)
  const label = kind === 'pla' ? 'PLA' : 'PAL'
  const { names, specs } = outputSpecs(vars, outputs, label)
  const shared = kind === 'pla'
  let K = 0
  if (!shared) {
    if (!Number.isInteger(termsPerOutput) || termsPerOutput < 1 || termsPerOutput > MAX_PAL_TERMS) {
      throw new DlogicInputError(`PAL 每个输出的乘积项数应为 1 到 ${MAX_PAL_TERMS} 之间的整数，当前为 ${String(termsPerOutput)}。`)
    }
    K = termsPerOutput
  }

  const sols = specs.map(coverSets)
  const picks = pickCovers(sols, shared)
  const chosen = sols.map((s, i) => sortImplicants(s[picks[i]]))

  const termIndex = new Map<string, number>()
  const termRecs: { mask: string; literals: number; usedBy: number[] }[] = []
  chosen.forEach((imps, oi) => {
    for (const imp of imps) {
      const key = shared ? imp.mask : `${oi}:${imp.mask}`
      let ti = termIndex.get(key)
      if (ti === undefined) {
        ti = termRecs.length
        termIndex.set(key, ti)
        termRecs.push({ mask: imp.mask, literals: imp.literals, usedBy: [] })
      }
      if (!termRecs[ti].usedBy.includes(oi)) termRecs[ti].usedBy.push(oi)
    }
  })
  if (termRecs.length > MAX_TERMS) {
    throw new DlogicInputError(`乘积项共 ${termRecs.length} 个，超过 ${MAX_TERMS} 个的上限。`)
  }

  const terms: PlaTerm[] = termRecs.map((r, ti) => {
    const pt = productText(r.mask, vars)
    return {
      label: `P${ti + 1}`,
      mask: r.mask,
      text: pt.text,
      latex: pt.latex,
      literals: r.literals,
      usedBy: r.usedBy.map(i => names[i]),
    }
  })

  const outs: PlaOutput[] = names.map((name, oi) => {
    const hit = termRecs.map((r, ti) => (r.usedBy.includes(oi) ? ti : -1)).filter(ti => ti >= 0)
    const parts = hit.map(ti => terms[ti])
    return {
      name,
      text: parts.length === 0 ? '0' : parts.map(p => p.text).join(' + '),
      latex: parts.length === 0 ? '0' : parts.map(p => p.latex).join(' + '),
      termLabels: parts.map(p => p.label),
      overflow: K > 0 && parts.length > K,
    }
  })

  const andColumns: string[] = []
  vars.forEach(v => andColumns.push(v, `${v}̅`))
  const andDots = termRecs.map(r => {
    const row: boolean[] = []
    for (let i = 0; i < vars.length; i++) {
      row.push(r.mask[i] === '1')
      row.push(r.mask[i] === '0')
    }
    return row
  })
  const orDots = termRecs.map(r => names.map((_, oi) => r.usedBy.includes(oi)))
  const literals = termRecs.reduce((acc, r) => acc + r.literals, 0)
  const separate = chosen.reduce((acc, imps) => acc + imps.length, 0)

  const warnings: string[] = []
  if (K > 0) {
    for (const o of outs) {
      if (o.overflow) {
        warnings.push(`输出 ${o.name} 需要 ${o.termLabels.length} 个乘积项，超过每输出固定的 ${K} 个，本 PAL 无法直接实现。`)
      }
    }
  }

  const steps: Step[] = [{ kind: 'minimize', text: '各输出函数分别用 Q-M 法化简，取最简与或式。' }]
  if (shared) {
    steps.push({
      kind: 'share',
      text: `合并共用的乘积项：各输出分别需要 ${separate} 项，共用后只需 ${terms.length} 个乘积项。`,
    })
  } else {
    steps.push({ kind: 'fixed', text: `或阵列固定：每个输出最多接 ${K} 个乘积项，未用的项留空（编程为恒 0）。` })
  }
  steps.push({ kind: 'and-plane', text: '与阵列：每个乘积项占一行，输入的原变量与反变量各占一列，打点表示接入。' })
  steps.push({ kind: 'or-plane', text: '或阵列：乘积项占行，输出占列，打点表示该项接入该输出。' })

  return {
    result: {
      kind,
      variables: vars,
      terms,
      outputs: outs,
      andColumns,
      andDots,
      orDots,
      termsPerOutput: shared ? null : K,
      cost: { terms: termRecs.length, literals },
      separateTerms: separate,
    },
    steps,
    warnings,
  }
}

// ───────────────────────── LUT 掩码（lut） ─────────────────────────

/** 16 位掩码的数值：地址 a 的位为 f(a 的低 n 位)，未用输入的取值不影响输出。 */
function lut16(on: Set<number>, n: number): number {
  let v = 0
  for (let a = 0; a < 16; a++) {
    if (on.has(a & ((1 << n) - 1))) v |= 1 << a
  }
  return v
}

/** 高地址在前的 16 位二进制写法。 */
function maskString(v: number): string {
  let s = ''
  for (let a = 15; a >= 0; a--) s += (v >> a) & 1
  return s
}

/** LUT 输入接线：变量 vars[i] 接 I(n-1-i)，未用的高位输入接 0。 */
function lutPins(vars: string[]): MsiWire[] {
  const n = vars.length
  return [3, 2, 1, 0].map(j =>
    j < n ? { pin: `I${j}`, signal: vars[n - 1 - j] } : { pin: `I${j}`, signal: 'GND', note: '未用，接 0' },
  )
}

/**
 * LUT4 配置掩码。不超过 4 个变量时给出 16 位掩码；5～6 个变量时按最高变量起香农展开，
 * 给出各子函数（4 变量）的掩码与合成所需的选择器说明。
 */
export function lutMap(req: LutRequest): Outcome<LutResult> {
  const spec = specFromRequest(req, req.variables, true, 'LUT ')
  const warnings: string[] = []
  if (spec.dontCares.length > 0) warnings.push('LUT 掩码不利用无关项，无关项按 0 处理。')
  const vars = spec.variables
  const n = vars.length
  const on = new Set(spec.minterms)
  const fnText = specText(spec)
  const fnLatex = specLatex(spec)

  if (n <= 4) {
    const value = lut16(on, n)
    const steps: Step[] = [
      {
        kind: 'address',
        text: n > 0 ? `地址线：${vars.map((v, i) => `${v} 接 I${n - 1 - i}`).join('、')}，未用的输入接 0。` : '函数为常数，全部输入接 0。',
      },
      { kind: 'mask', text: `掩码共 16 位，高位在前（最左为地址 15），十六进制为 ${hexText(value, 4)}H。` },
    ]
    if (n < 4) {
      steps.push({ kind: 'replicate', text: '变量少于 4 个时，未用输入取何值都不影响输出，掩码按周期重复填充。' })
    }
    return {
      result: {
        kind: 'single',
        variables: vars,
        mask: maskString(value),
        hex: hexText(value, 4),
        pins: lutPins(vars),
        rows: range(1 << n).map(a => ({ address: a, addressBits: binText(a, n), value: (on.has(a) ? 1 : 0) as 0 | 1 })),
        functionText: fnText,
        functionLatex: fnLatex,
      },
      steps,
      warnings,
    }
  }

  const k = n - 4
  const splitVars = vars.slice(0, k)
  const lutVars = vars.slice(k)
  const cofactors: LutCofactor[] = range(1 << k).map(h => {
    const on4 = new Set<number>()
    for (const m of spec.minterms) {
      if ((m >> 4) === h) on4.add(m & 15)
    }
    const value = lut16(on4, 4)
    return {
      assignment: splitVars.map((v, j) => `${v}=${(h >> (k - 1 - j)) & 1}`).join(' '),
      variables: lutVars.slice(),
      mask: maskString(value),
      hex: hexText(value, 4),
    }
  })
  warnings.push(`函数有 ${n} 个变量，超过 LUT4 的 4 个输入，需要拆分到 ${1 << k} 个 LUT 与一个选择器。`)
  const steps: Step[] = [
    {
      kind: 'shannon',
      text: `香农展开：按 ${splitVars.join('、')} 展开为 ${1 << k} 个 4 变量子函数，每个子函数用一个 LUT4 的掩码实现。`,
    },
    {
      kind: 'combine',
      text: `再用 ${1 << k} 选 1 的数据选择器合成，选择端接 ${splitVars.join('、')}，数据端接各子函数 LUT 的输出。`,
    },
  ]
  return {
    result: {
      kind: 'split',
      variables: vars,
      splitVars,
      lutVars,
      pins: lutPins(lutVars),
      cofactors,
      functionText: fnText,
      functionLatex: fnLatex,
    },
    steps,
    warnings,
  }
}
