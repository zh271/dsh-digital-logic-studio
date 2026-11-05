// 组合逻辑求解器（纯函数，不做 I/O，不依赖 DSH）。
// 1) 门级网表分析：逐级推导每个门的式子、最终输出式、真值表；
// 2) MSI 芯片映射：138 / 139 / 148 / 151 / 153 / 85 / 283 / 280 的引脚、接线与降维。
// 约定与 bool.ts 相同：最小项编号中 variables[0] 为最高位（MSB）。只使用可擦除的 TypeScript 语法。

import { DlogicInputError } from '../shared/contracts.ts'
import type { BoolSpec, Step } from '../shared/contracts.ts'
import type {
  AdderMapping,
  AnalyzeResult,
  CombTruthTable,
  ComparatorMapping,
  DataValue,
  DecoderMapping,
  EncoderMapping,
  GateDerivation,
  GateSpec,
  GateType,
  MsiChip,
  MsiPin,
  MsiResult,
  MsiStage,
  MsiWire,
  MuxMapping,
  MuxRow,
  Netlist,
  OutputExpr,
  ParityMapping,
} from '../shared/comb.ts'
import { minimize, parseExpr, specFromExpr, type BoolExpr } from './bool.ts'

const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/
const MAX_INPUTS = 6
const MAX_GATES = 20
const MAX_FANIN = 8
/** 展开式语法树的节点上限；超过则不给出展开式，只给出本级式与真值表。 */
const EXPAND_LIMIT = 300
const MAX_FUNC_VARS = 6

export const GATE_TYPES: GateType[] = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR']
export const MSI_CHIPS: MsiChip[] = ['138', '139', '148', '151', '153', '85', '283', '280']

const TYPE_NAME: Record<GateType, string> = {
  AND: '与门',
  OR: '或门',
  NOT: '非门',
  NAND: '与非门',
  NOR: '或非门',
  XOR: '异或门',
  XNOR: '同或门',
}

const CHIP_NAME: Record<MsiChip, string> = {
  '138': '74LS138（3 线-8 线译码器）',
  '139': '74LS139（双 2 线-4 线译码器）',
  '148': '74LS148（8 线-3 线优先编码器）',
  '151': '74LS151（8 选 1 数据选择器）',
  '153': '74LS153（双 4 选 1 数据选择器）',
  '85': '74LS85（4 位数值比较器）',
  '283': '74LS283（4 位二进制全加器）',
  '280': '74LS280（9 位奇偶产生/校验器）',
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}

// ───────────────────────── 表达式语法树 ─────────────────────────

type Ast =
  | { k: 'var'; name: string }
  | { k: 'not'; x: Ast }
  | { k: 'and'; xs: Ast[] }
  | { k: 'or'; xs: Ast[] }
  | { k: 'xor'; xs: Ast[] }

function buildGate(type: GateType, ins: Ast[]): Ast {
  switch (type) {
    case 'AND':
      return { k: 'and', xs: ins }
    case 'OR':
      return { k: 'or', xs: ins }
    case 'NOT':
      return { k: 'not', x: ins[0] }
    case 'NAND':
      return { k: 'not', x: { k: 'and', xs: ins } }
    case 'NOR':
      return { k: 'not', x: { k: 'or', xs: ins } }
    case 'XOR':
      return { k: 'xor', xs: ins }
    case 'XNOR':
      return { k: 'not', x: { k: 'xor', xs: ins } }
  }
}

const sizeMemo = new WeakMap<Ast, number>()

/** 展开为树形后的节点数（共享子树按多次计入）。 */
function treeSize(a: Ast): number {
  const hit = sizeMemo.get(a)
  if (hit !== undefined) return hit
  let s: number
  if (a.k === 'var') s = 1
  else if (a.k === 'not') s = 1 + treeSize(a.x)
  else s = 1 + a.xs.reduce((acc, x) => acc + treeSize(x), 0)
  sizeMemo.set(a, s)
  return s
}

/** 文本渲染：取反用后缀 '；sep 为相邻因子之间的分隔（全为单字母变量时为空，否则为 ·）。 */
function renderText(a: Ast, sep: string): string {
  switch (a.k) {
    case 'var':
      return a.name
    case 'not':
      return a.x.k === 'var' ? a.x.name + "'" : '(' + renderText(a.x, sep) + ")'"
    case 'and':
      return a.xs.map(x => (x.k === 'or' || x.k === 'xor' ? '(' + renderText(x, sep) + ')' : renderText(x, sep))).join(sep)
    case 'or':
      return a.xs.map(x => renderText(x, sep)).join(' + ')
    case 'xor':
      return a.xs.map(x => (x.k === 'or' ? '(' + renderText(x, sep) + ')' : renderText(x, sep))).join('⊕')
  }
}

/** 变量名的 KaTeX 写法：X1 写作 X_{1}。 */
export function latexName(name: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(name)
  return m ? `${m[1]}_{${m[2]}}` : name
}

function renderLatex(a: Ast, sep: string): string {
  const lsep = sep === '' ? '' : '\\cdot '
  switch (a.k) {
    case 'var':
      return latexName(a.name)
    case 'not':
      return a.x.k === 'var' ? '\\overline{' + latexName(a.x.name) + '}' : '\\overline{' + renderLatex(a.x, sep) + '}'
    case 'and':
      return a.xs
        .map(x => (x.k === 'or' || x.k === 'xor' ? '\\left(' + renderLatex(x, sep) + '\\right)' : renderLatex(x, sep)))
        .join(lsep)
    case 'or':
      return a.xs.map(x => renderLatex(x, sep)).join(' + ')
    case 'xor':
      return a.xs
        .map(x => (x.k === 'or' ? '\\left(' + renderLatex(x, sep) + '\\right)' : renderLatex(x, sep)))
        .join(' \\oplus ')
  }
}

// ───────────────────────── 门级网表：校验、拓扑排序、求值 ─────────────────────────

function checkNames(names: string[], label: string): void {
  const seen = new Set<string>()
  for (const s of names) {
    if (typeof s !== 'string' || !NAME_RE.test(s)) {
      throw new DlogicInputError(`${label}“${String(s)}”不合法：信号名应以字母开头，只含字母、数字与下划线。`)
    }
    if (seen.has(s)) throw new DlogicInputError(`${label}“${s}”重复。`)
    seen.add(s)
  }
}

function validateNetlist(nl: Netlist): void {
  if (!nl || !Array.isArray(nl.inputs) || nl.inputs.length === 0) {
    throw new DlogicInputError('门级网表需要至少一个输入（inputs）。')
  }
  if (nl.inputs.length > MAX_INPUTS) {
    throw new DlogicInputError(`最多支持 ${MAX_INPUTS} 个输入，当前为 ${nl.inputs.length} 个。`)
  }
  checkNames(nl.inputs, '输入')
  if (!Array.isArray(nl.gates) || nl.gates.length === 0) throw new DlogicInputError('门列表为空（gates）。')
  if (nl.gates.length > MAX_GATES) {
    throw new DlogicInputError(`最多支持 ${MAX_GATES} 个门，当前为 ${nl.gates.length} 个。`)
  }
  const inputSet = new Set(nl.inputs)
  const outSet = new Set<string>()
  for (const g of nl.gates) {
    if (!g || typeof g.out !== 'string') throw new DlogicInputError('每个门都需要 out（输出信号名）。')
    if (!GATE_TYPES.includes(g.type)) {
      throw new DlogicInputError(`门 ${g.out} 的类型“${String(g.type)}”不支持，可用：${GATE_TYPES.join('、')}。`)
    }
    checkNames([g.out], '门输出')
    if (inputSet.has(g.out) || outSet.has(g.out)) throw new DlogicInputError(`信号“${g.out}”被重复定义。`)
    outSet.add(g.out)
    if (!Array.isArray(g.in)) throw new DlogicInputError(`门 ${g.out} 的输入（in）必须是数组。`)
    if (g.type === 'NOT') {
      if (g.in.length !== 1) throw new DlogicInputError(`非门 ${g.out} 只能有 1 个输入，当前为 ${g.in.length} 个。`)
    } else if (g.in.length < 2 || g.in.length > MAX_FANIN) {
      throw new DlogicInputError(
        `${TYPE_NAME[g.type]} ${g.out} 的输入端数应在 2 到 ${MAX_FANIN} 之间，当前为 ${g.in.length} 个。`,
      )
    }
  }
  for (const g of nl.gates) {
    for (const i of g.in) {
      if (!inputSet.has(i) && !outSet.has(i)) {
        throw new DlogicInputError(`门 ${g.out} 的输入“${i}”未定义（既不是原始输入，也不是门输出）。`)
      }
    }
  }
  if (nl.outputs !== undefined) {
    if (!Array.isArray(nl.outputs) || nl.outputs.length === 0) throw new DlogicInputError('outputs 若给出，不能为空。')
    checkNames(nl.outputs, '输出')
    for (const o of nl.outputs) {
      if (!inputSet.has(o) && !outSet.has(o)) throw new DlogicInputError(`输出“${o}”未定义。`)
    }
  }
}

/** 按依赖关系排序门（输入在前），同时检查反馈回路。 */
function topoOrder(gates: GateSpec[]): GateSpec[] {
  const byOut = new Map<string, GateSpec>()
  for (const g of gates) byOut.set(g.out, g)
  const state = new Map<string, 1 | 2>()
  const order: GateSpec[] = []
  const visit = (name: string): void => {
    const g = byOut.get(name)
    if (!g) return
    const s = state.get(name)
    if (s === 2) return
    if (s === 1) throw new DlogicInputError(`网表中存在反馈回路（经过信号 ${name}）；组合电路不能有环。`)
    state.set(name, 1)
    for (const i of g.in) visit(i)
    state.set(name, 2)
    order.push(g)
  }
  for (const g of gates) visit(g.out)
  return order
}

function evalGate(type: GateType, vals: (0 | 1)[]): 0 | 1 {
  const all = vals.every(v => v === 1)
  const any = vals.some(v => v === 1)
  const par = vals.reduce<number>((acc, v) => acc ^ v, 0)
  switch (type) {
    case 'AND':
      return all ? 1 : 0
    case 'OR':
      return any ? 1 : 0
    case 'NOT':
      return vals[0] === 1 ? 0 : 1
    case 'NAND':
      return all ? 0 : 1
    case 'NOR':
      return any ? 0 : 1
    case 'XOR':
      return par === 1 ? 1 : 0
    case 'XNOR':
      return par === 1 ? 0 : 1
  }
}

/** 由真值表的一列得到最简与或式（不含展开式字段）。 */
function simplifyColumn(inputs: string[], rows: CombTruthTable['rows'], oi: number): Omit<OutputExpr, 'name' | 'expr' | 'latex'> {
  const n = inputs.length
  const minterms = rows.filter(r => r.outputs[oi] === 1).map(r => r.index)
  if (minterms.length === 0) {
    return { simplified: '0', simplifiedLatex: '0', cost: { terms: 0, literals: 0 } }
  }
  if (minterms.length === 1 << n) {
    return { simplified: '1', simplifiedLatex: '1', cost: { terms: 0, literals: 0 } }
  }
  const m = minimize({ variables: inputs.slice(), minterms, dontCares: [] }, 'SOP')
  return { simplified: m.texts[0] ?? '0', simplifiedLatex: m.latex[0] ?? '0', cost: m.cost }
}

/**
 * 分析门级网表：逐级推导每个门的式子（本级式与代入原始输入后的展开式），
 * 给出各输出的最终式、真值表与最简与或式。
 */
export function analyzeNetlist(nl: Netlist): AnalyzeResult {
  validateNetlist(nl)
  const inputs = nl.inputs.slice()
  const gates: GateSpec[] = nl.gates.map(g => ({ out: g.out, type: g.type, in: g.in.slice() }))
  const order = topoOrder(gates)
  const consumed = new Set(gates.flatMap(g => g.in))
  const outputs = nl.outputs ? nl.outputs.slice() : gates.filter(g => !consumed.has(g.out)).map(g => g.out)
  if (outputs.length === 0) {
    throw new DlogicInputError('网表没有输出：请给出 outputs，或确保存在未被其他门使用的门输出。')
  }

  // 展开式只含原始输入；本级式还含门输出名，二者的因子分隔各自判断。
  const sepIn = inputs.every(s => s.length === 1) ? '' : '·'
  const sepAll = [...inputs, ...gates.map(g => g.out)].every(s => s.length === 1) ? '' : '·'

  const level = new Map<string, number>()
  const ast = new Map<string, Ast>()
  for (const i of inputs) {
    level.set(i, 0)
    ast.set(i, { k: 'var', name: i })
  }

  const derivations: GateDerivation[] = []
  for (const g of order) {
    const lv = 1 + Math.max(...g.in.map(i => level.get(i) ?? 0))
    level.set(g.out, lv)
    const full = buildGate(
      g.type,
      g.in.map(i => ast.get(i) as Ast),
    )
    ast.set(g.out, full)
    const local = buildGate(
      g.type,
      g.in.map(i => ({ k: 'var', name: i }) as Ast),
    )
    const small = treeSize(full) <= EXPAND_LIMIT
    derivations.push({
      out: g.out,
      type: g.type,
      in: g.in.slice(),
      level: lv,
      local: renderText(local, sepAll),
      localLatex: renderLatex(local, sepAll),
      expr: small ? renderText(full, sepIn) : null,
      latex: small ? renderLatex(full, sepIn) : null,
    })
  }

  const n = inputs.length
  const rows: CombTruthTable['rows'] = []
  for (let m = 0; m < 1 << n; m++) {
    const vals = new Map<string, 0 | 1>()
    const bits: (0 | 1)[] = []
    for (let i = 0; i < n; i++) {
      const b = ((m >> (n - 1 - i)) & 1) as 0 | 1
      bits.push(b)
      vals.set(inputs[i], b)
    }
    for (const g of order) {
      const ins = g.in.map(i => vals.get(i) as 0 | 1)
      vals.set(g.out, evalGate(g.type, ins))
    }
    rows.push({ index: m, inputs: bits, outputs: outputs.map(o => vals.get(o) as 0 | 1) })
  }
  const truthTable: CombTruthTable = { variables: inputs.slice(), outputs: outputs.slice(), rows }

  const finalExprs: OutputExpr[] = outputs.map((name, oi) => {
    const a = ast.get(name) as Ast
    const small = treeSize(a) <= EXPAND_LIMIT
    return {
      name,
      expr: small ? renderText(a, sepIn) : null,
      latex: small ? renderLatex(a, sepIn) : null,
      ...simplifyColumn(inputs, rows, oi),
    }
  })

  return {
    inputs,
    outputs,
    gates: derivations,
    finalExprs,
    truthTable,
    depth: Math.max(0, ...derivations.map(d => d.level)),
  }
}

/** 分析过程的分步说明（前端按 kind 渲染；text 为一句中文）。 */
export function analyzeSteps(r: AnalyzeResult): Step[] {
  const steps: Step[] = []
  steps.push({
    kind: 'levels',
    text: `共 ${r.gates.length} 个门，${r.depth} 级；原始输入 ${r.inputs.join('、')}，自输入向输出逐级代入。`,
  })
  for (const g of r.gates) {
    const tail = g.expr !== null ? `；代入原始输入得 ${g.out} = ${g.expr}` : '（展开式过长，略）'
    steps.push({
      kind: 'gate',
      text: `第 ${g.level} 级 ${g.out}（${TYPE_NAME[g.type]}，输入 ${g.in.join('、')}）：${g.out} = ${g.local}${tail}`,
      out: g.out,
      level: g.level,
      local: g.local,
      expr: g.expr,
    })
  }
  for (const f of r.finalExprs) {
    steps.push({
      kind: 'output',
      text: `输出 ${f.name} = ${f.expr ?? f.simplified}`,
      name: f.name,
      expr: f.expr,
    })
    steps.push({
      kind: 'simplify',
      text: `由真值表化简：${f.name} = ${f.simplified}（${f.cost.terms} 项，${f.cost.literals} 个文字）`,
      name: f.name,
      simplified: f.simplified,
    })
  }
  steps.push({
    kind: 'truth',
    text: `真值表共 ${r.truthTable.rows.length} 行，按 ${r.inputs.join(' ')} 的二进制顺序列出。`,
  })
  return steps
}

// ───────────────────────── 逻辑图（draw）：由表达式生成两级门网表 ─────────────────────────

/** 字面量：变量名与是否取反。 */
interface Lit {
  name: string
  neg: boolean
}

function literalOf(a: BoolExpr): Lit | null {
  if (a.k === 'var') return { name: a.name, neg: false }
  if (a.k === 'not' && a.x.k === 'var') return { name: a.x.name, neg: true }
  return null
}

/** 与项的字面量（允许嵌套的与）；不是与项时返回 null。 */
function productLits(a: BoolExpr): Lit[] | null {
  if (a.k === 'and') {
    const out: Lit[] = []
    for (const x of a.xs) {
      const sub = productLits(x)
      if (sub === null) return null
      out.push(...sub)
    }
    return out
  }
  const l = literalOf(a)
  return l ? [l] : null
}

/** 与或式的各项（允许嵌套的或）；不是与或式时返回 null。 */
function sopTerms(a: BoolExpr): Lit[][] | null {
  if (a.k === 'or') {
    const out: Lit[][] = []
    for (const x of a.xs) {
      const sub = sopTerms(x)
      if (sub === null) return null
      out.push(...sub)
    }
    return out
  }
  const p = productLits(a)
  return p === null ? null : [p]
}

/** 去掉项内重复的字面量与重复的项（保持首次出现的次序）。 */
function dedupeTerms(terms: Lit[][]): Lit[][] {
  const seen = new Set<string>()
  const out: Lit[][] = []
  for (const t of terms) {
    const uniq: Lit[] = []
    const keys = new Set<string>()
    for (const l of t) {
      const k = (l.neg ? "'" : '') + l.name
      if (keys.has(k)) continue
      keys.add(k)
      uniq.push(l)
    }
    const key = [...keys].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(uniq)
  }
  return out
}

/**
 * 与或式 → 两级门网表。取反变量共用一个非门（名为 变量_n）；单文字项直接接到或门；
 * 多于一项时，末级为或门。唯一一项时，末级门即输出门。
 */
function sopNetlist(inputs: string[], terms: Lit[][], outName: string): Netlist {
  const used = new Set<string>([...inputs, outName])
  const fresh = (base: string): string => {
    let name = base
    for (let k = 2; used.has(name); k++) name = `${base}_${k}`
    used.add(name)
    return name
  }
  const gates: GateSpec[] = []
  const negOf = new Map<string, string>()
  const signalOf = (l: Lit): string => {
    if (!l.neg) return l.name
    let s = negOf.get(l.name)
    if (s === undefined) {
      s = fresh(`${l.name}_n`)
      negOf.set(l.name, s)
      gates.push({ out: s, type: 'NOT', in: [l.name] })
    }
    return s
  }

  if (terms.length === 1) {
    const lits = terms[0]
    if (lits.length === 1) {
      if (!lits[0].neg) throw new DlogicInputError(`函数 ${outName} = ${lits[0].name} 只是一个变量，没有门可画。`)
      gates.push({ out: outName, type: 'NOT', in: [lits[0].name] })
    } else {
      gates.push({ out: outName, type: 'AND', in: lits.map(signalOf) })
    }
  } else {
    const ins = terms.map((lits, i) => {
      if (lits.length === 1) return signalOf(lits[0])
      const p = fresh(`P${i + 1}`)
      gates.push({ out: p, type: 'AND', in: lits.map(signalOf) })
      return p
    })
    gates.push({ out: outName, type: 'OR', in: ins })
  }
  return { inputs: inputs.slice(), gates, outputs: [outName] }
}

export interface DrawRequest {
  expr: string
  variables?: string[]
  /** 输出信号名，默认 F。 */
  outputName?: string
}

export interface DrawOutcome {
  result: AnalyzeResult
  steps: Step[]
  warnings: string[]
}

/**
 * 由表达式画门级逻辑图：表达式本身是与或式时按原样建网表；否则取第一个最简与或式，并给出提示。
 * 结果经 analyzeNetlist 分析，因此与 analyze 的文字、真值表完全一致。
 */
export function drawExpr(req: DrawRequest): DrawOutcome {
  if (typeof req.expr !== 'string' || req.expr.trim() === '') throw new DlogicInputError('draw 需要提供 expr（表达式）。')
  const outName = req.outputName ?? 'F'
  checkNames([outName], '输出名')
  const parsed = parseExpr(req.expr, req.variables)
  const inputs = parsed.variables
  const warnings: string[] = []

  let terms = sopTerms(parsed.ast)
  if (terms !== null) {
    terms = dedupeTerms(terms)
  } else {
    const spec = specFromExpr(req.expr, req.variables)
    if (spec.minterms.length === 0 || spec.minterms.length === 1 << inputs.length) {
      throw new DlogicInputError('函数恒为 0 或恒为 1，没有门可画。')
    }
    const m = minimize(spec, 'SOP')
    const text = m.texts[0] ?? ''
    const reparsed = sopTerms(parseExpr(text, inputs).ast)
    if (reparsed === null) throw new DlogicInputError('无法把函数化为与或式，因此无法画出门级图。')
    terms = dedupeTerms(reparsed)
    warnings.push(`表达式不是与或式，已改用最简与或式 ${outName} = ${text} 画图。`)
  }

  const netlist = sopNetlist(inputs, terms, outName)
  const result = analyzeNetlist(netlist)
  return { result, steps: analyzeSteps(result), warnings }
}

// ───────────────────────── MSI 芯片：引脚表 ─────────────────────────

function pin(
  name: string,
  aliases: string[],
  activeLevel: MsiPin['activeLevel'],
  role: MsiPin['role'],
  note?: string,
): MsiPin {
  return note === undefined ? { name, aliases, activeLevel, role } : { name, aliases, activeLevel, role, note }
}

export const CHIP_PINS: Record<MsiChip, MsiPin[]> = {
  '138': [
    pin('A2', [], 'high', 'select', '地址高位'),
    pin('A1', [], 'high', 'select'),
    pin('A0', [], 'high', 'select', '地址低位'),
    pin('S1', ['E1'], 'high', 'enable', '使能端'),
    pin('S̄2', ['Ē2A'], 'low', 'enable', '使能端'),
    pin('S̄3', ['Ē2B'], 'low', 'enable', '使能端'),
    ...range(8).map(i => pin(`Y̅${i}`, [], 'low', 'output', `对应最小项 m${i}`)),
  ],
  '139': [
    pin('1A', [], 'high', 'select', '地址低位'),
    pin('1B', [], 'high', 'select', '地址高位'),
    pin('1S̄', ['1Ē'], 'low', 'enable', '使能端'),
    ...range(4).map(i => pin(`1Y̅${i}`, [], 'low', 'output', `对应最小项 m${i}`)),
    pin('2A', [], 'high', 'select', '地址低位'),
    pin('2B', [], 'high', 'select', '地址高位'),
    pin('2S̄', ['2Ē'], 'low', 'enable', '使能端'),
    ...range(4).map(i => pin(`2Y̅${i}`, [], 'low', 'output', `对应最小项 m${i}`)),
  ],
  '148': [
    ...range(8).map(i => pin(`I̅${i}`, [], 'low', 'input', i === 7 ? '优先级最高' : undefined)),
    pin('EI̅', [], 'low', 'enable', '输入使能'),
    pin('Y̅2', [], 'low', 'output', '编码输出（反码）'),
    pin('Y̅1', [], 'low', 'output', '编码输出（反码）'),
    pin('Y̅0', [], 'low', 'output', '编码输出（反码）'),
    pin('GS̅', [], 'low', 'output', '有输入有效时为 0'),
    pin('EO̅', [], 'low', 'output', '输出使能，用于扩展'),
  ],
  '151': [
    ...range(8).map(i => pin(`D${i}`, [], 'high', 'data')),
    pin('A2', [], 'high', 'select', '地址高位'),
    pin('A1', [], 'high', 'select'),
    pin('A0', [], 'high', 'select', '地址低位'),
    pin('S̄', ['Ē'], 'low', 'enable', '选通端'),
    pin('Y', [], 'high', 'output', '输出'),
    pin('W̅', ['Y̅'], 'high', 'output', '与 Y 互补的输出'),
  ],
  '153': [
    pin('1S̄', ['1Ē'], 'low', 'enable', '选通端'),
    pin('2S̄', ['2Ē'], 'low', 'enable', '选通端'),
    pin('B', [], 'high', 'select', '选择端高位（两路共用）'),
    pin('A', [], 'high', 'select', '选择端低位（两路共用）'),
    ...range(4).map(i => pin(`1C${i}`, [], 'high', 'data')),
    ...range(4).map(i => pin(`2C${i}`, [], 'high', 'data')),
    pin('1Y', [], 'high', 'output', '第 1 路输出'),
    pin('2Y', [], 'high', 'output', '第 2 路输出'),
  ],
  '85': [
    pin('A3', [], 'high', 'input', '最高位'),
    pin('A2', [], 'high', 'input'),
    pin('A1', [], 'high', 'input'),
    pin('A0', [], 'high', 'input', '最低位'),
    pin('B3', [], 'high', 'input', '最高位'),
    pin('B2', [], 'high', 'input'),
    pin('B1', [], 'high', 'input'),
    pin('B0', [], 'high', 'input', '最低位'),
    pin('I(A>B)', [], 'high', 'cascade', '级联输入'),
    pin('I(A<B)', [], 'high', 'cascade', '级联输入'),
    pin('I(A=B)', [], 'high', 'cascade', '级联输入，单片使用时接 1'),
    pin('F(A>B)', [], 'high', 'output', '比较输出'),
    pin('F(A<B)', [], 'high', 'output', '比较输出'),
    pin('F(A=B)', [], 'high', 'output', '比较输出'),
  ],
  '283': [
    pin('A1', [], 'high', 'input', '操作数 A 的最低位'),
    pin('A2', [], 'high', 'input'),
    pin('A3', [], 'high', 'input'),
    pin('A4', [], 'high', 'input', '操作数 A 的最高位'),
    pin('B1', [], 'high', 'input', '操作数 B 的最低位'),
    pin('B2', [], 'high', 'input'),
    pin('B3', [], 'high', 'input'),
    pin('B4', [], 'high', 'input', '操作数 B 的最高位'),
    pin('C0', ['Cin'], 'high', 'carry', '低位进位输入'),
    pin('Σ1', [], 'high', 'output', '和的最低位'),
    pin('Σ2', [], 'high', 'output'),
    pin('Σ3', [], 'high', 'output'),
    pin('Σ4', [], 'high', 'output', '和的最高位'),
    pin('C4', ['Cout'], 'high', 'carry', '进位输出'),
  ],
  '280': [
    ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map(p => pin(p, [], 'high', 'input')),
    pin('Σ_E', [], 'high', 'output', '输入中 1 的个数为偶数时为 1'),
    pin('Σ_O', [], 'high', 'output', '输入中 1 的个数为奇数时为 1'),
  ],
}

// ───────────────────────── MSI 芯片：函数输入 ─────────────────────────

export interface MsiRequest {
  chip: MsiChip
  expr?: string
  variables?: string[]
  minterms?: number[]
  dontCares?: number[]
  /** 151 / 153：作为选择端的变量（MSB 在前）；省略时取最低位的变量。 */
  selectVars?: string[]
  /** 85：比较位数，4 的倍数，4～16；默认 4。 */
  bits?: number
  /** 283：是否做 BCD（8421 码）加法修正。 */
  bcd?: boolean
}

export interface MsiOutcome {
  result: MsiResult
  steps: Step[]
  warnings: string[]
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

/** 由请求得到函数规范（与 dlogic_bool 的 expr / minterms 二选一相同）。 */
function functionSpec(req: MsiRequest): BoolSpec {
  if (typeof req.expr === 'string' && req.expr.trim() !== '') {
    return specFromExpr(req.expr, req.variables)
  }
  if (req.minterms !== undefined) {
    if (!Array.isArray(req.variables) || req.variables.length === 0) {
      throw new DlogicInputError('使用 minterms 时必须同时提供 variables（variables[0] 为最高位）。')
    }
    checkNames(req.variables, '变量')
    const n = req.variables.length
    if (n > MAX_FUNC_VARS) throw new DlogicInputError(`最多支持 ${MAX_FUNC_VARS} 个变量，当前为 ${n} 个。`)
    const total = 1 << n
    const minterms = [...new Set(req.minterms)].sort((a, b) => a - b)
    const dontCares = [...new Set(req.dontCares ?? [])].sort((a, b) => a - b)
    for (const m of [...minterms, ...dontCares]) {
      if (!Number.isInteger(m) || m < 0 || m >= total) {
        throw new DlogicInputError(`编号 ${m} 超出范围（0～${total - 1}）。`)
      }
    }
    if (minterms.some(m => dontCares.includes(m))) {
      throw new DlogicInputError('同一编号不能同时是最小项与无关项。')
    }
    return { variables: req.variables.slice(), minterms, dontCares }
  }
  throw new DlogicInputError('缺少函数：请提供 expr，或同时提供 minterms 与 variables。')
}

function requireVars(spec: BoolSpec): void {
  if (spec.variables.length === 0) throw new DlogicInputError('函数至少需要一个变量。')
}

// ───────────────────────── 138 / 139：译码器加与非门 ─────────────────────────

function decoderMap(chip: '138' | '139', spec: BoolSpec): MsiOutcome {
  requireVars(spec)
  const k = chip === '138' ? 3 : 2
  const n = spec.variables.length
  if (n > k) {
    throw new DlogicInputError(
      `74LS${chip} 只能直接实现 ${k} 个变量的函数，当前函数有 ${n} 个变量；${n} 变量函数请用 151 / 153，或多片组合。`,
    )
  }
  const addrPins = chip === '138' ? ['A2', 'A1', 'A0'] : ['1B', '1A']
  const outPin = (m: number): string => (chip === '138' ? `Y̅${m}` : `1Y̅${m}`)
  const minterms = spec.minterms.slice()
  const warnings: string[] = []
  if (spec.dontCares.length) warnings.push('译码器不能直接利用无关项，无关项按 0 处理。')

  const addrWiring: MsiWire[] = addrPins.map((p, idx) => {
    const j = idx - (k - n)
    return j < 0 ? { pin: p, signal: 'GND', note: '高位地址接地' } : { pin: p, signal: spec.variables[j] }
  })
  const enableWiring: MsiWire[] =
    chip === '138'
      ? [
          { pin: 'S1', signal: 'VCC', note: '使能有效' },
          { pin: 'S̄2', signal: 'GND' },
          { pin: 'S̄3', signal: 'GND' },
        ]
      : [{ pin: '1S̄', signal: 'GND', note: '使能有效' }]
  const stages: MsiStage[] = [{ label: CHIP_NAME[chip], wiring: [...addrWiring, ...enableWiring] }]

  const outputNames = minterms.map(m => `m${m}`)
  let nandText = '0'
  let nandLatex = '0'
  let constant: 0 | 1 | null = null
  let tail = ''
  if (minterms.length === 0) {
    constant = 0
    tail = '（恒为 0）'
    stages.push({ label: '输出', wiring: [{ pin: 'F', signal: '0', note: '函数恒为 0，无需接线' }] })
  } else {
    nandText = `(${outputNames.map(x => x + "'").join('')})'`
    nandLatex = `\\overline{${outputNames.map(x => `\\overline{${latexName(x)}}`).join('\\cdot ')}}`
    if (minterms.length === 1 << n) constant = 1
    stages.push({
      label: '与非门（输入端数等于最小项个数）',
      wiring: [
        ...minterms.map((m, j) => ({ pin: `输入 ${j + 1}`, signal: outPin(m), note: `接 m${m}` })),
        { pin: '输出', signal: 'F' },
      ],
    })
  }
  if (n < k) warnings.push(`函数只有 ${n} 个变量，高位地址接地，译码器只用前 ${1 << n} 个输出。`)

  const mapping: DecoderMapping = {
    kind: 'decoder',
    chip,
    addressVars: spec.variables.slice(),
    minterms,
    outputNames,
    nandText,
    nandLatex,
    constant,
  }
  const steps: Step[] = [
    {
      kind: 'decode',
      text:
        minterms.length === 0
          ? '函数恒为 0，无需译码器输出。'
          : `译码器低有效输出 Ȳ_i = m̄_i。F = Σm(${minterms.join(',')}) 等于这些最小项对应的 Ȳ 取与非。`,
    },
    {
      kind: 'nand',
      text:
        minterms.length === 0
          ? '输出 F 接 0。'
          : `与非门的输入接 ${minterms.map(m => outPin(m)).join('、')}，输出即为 F。`,
    },
  ]
  return {
    result: {
      chip,
      chipName: CHIP_NAME[chip],
      pins: CHIP_PINS[chip],
      stages,
      mapping,
      functionText: specText(spec) + tail,
      functionLatex: specLatex(spec),
    },
    steps,
    warnings,
  }
}

// ───────────────────────── 151 / 153：降维真值表 ─────────────────────────

function assignmentsOf(k: number): (0 | 1)[][] {
  const out: (0 | 1)[][] = []
  for (let h = 0; h < 1 << k; h++) out.push(range(k).map(j => ((h >> (k - 1 - j)) & 1) as 0 | 1))
  return out
}

function constData(value: 0 | 1): DataValue {
  return { kind: 'const', value, text: String(value) }
}

/** 数据端在高位变量各组取值（0 / 1 / X）下的结果化为常数、单变量（或其反变量）或表达式。 */
function reduceData(cof: (0 | 1 | 'X')[], highVars: string[]): DataValue {
  const hasOne = cof.some(v => v === 1)
  const hasZero = cof.some(v => v === 0)
  if (!hasOne) return constData(0)
  if (!hasZero) return constData(1)
  const minterms: number[] = []
  const dontCares: number[] = []
  cof.forEach((v, h) => {
    if (v === 1) minterms.push(h)
    else if (v === 'X') dontCares.push(h)
  })
  const mini = minimize({ variables: highVars.slice(), minterms, dontCares }, 'SOP')
  const first = mini.solutions[0] ?? []
  if (first.length === 1 && first[0].literals === 1) {
    const mask = first[0].mask
    const j = mask.split('').findIndex(ch => ch !== '-')
    const neg = mask[j] === '0'
    const name = highVars[j]
    return {
      kind: 'literal',
      name,
      neg,
      text: name + (neg ? "'" : ''),
      latex: neg ? `\\overline{${latexName(name)}}` : latexName(name),
    }
  }
  return { kind: 'expr', text: mini.texts[0] ?? '', latex: mini.latex[0] ?? '' }
}

function muxMap(chip: '151' | '153', spec: BoolSpec, selectIn: string[] | undefined): MsiOutcome {
  requireVars(spec)
  const s = chip === '151' ? 3 : 2
  const vars = spec.variables
  const n = vars.length
  const warnings: string[] = []
  let selVars: string[]
  if (selectIn !== undefined) {
    const maxSel = Math.min(s, n)
    if (!Array.isArray(selectIn) || selectIn.length === 0 || selectIn.length > maxSel) {
      throw new DlogicInputError(`选择变量的个数应在 1 到 ${maxSel} 之间。`)
    }
    checkNames(selectIn, '选择变量')
    for (const v of selectIn) {
      if (!vars.includes(v)) throw new DlogicInputError(`选择变量“${v}”不在变量列表中。`)
    }
    selVars = selectIn.slice()
  } else {
    selVars = vars.slice(n - Math.min(s, n))
  }
  const m = selVars.length
  const highVars = vars.filter(v => !selVars.includes(v))
  const k = highVars.length
  const selPins = chip === '151' ? ['A2', 'A1', 'A0'] : ['B', 'A']
  const dataPins = chip === '151' ? range(8).map(i => `D${i}`) : range(4).map(i => `1C${i}`)
  const onSet = new Set(spec.minterms)
  const dcSet = new Set(spec.dontCares)
  const highAssignments = assignmentsOf(k)

  const rows: MuxRow[] = []
  for (let i = 0; i < 1 << m; i++) {
    const selectBits = range(m).map(j => ((i >> (m - 1 - j)) & 1) as 0 | 1)
    const cof: (0 | 1 | 'X')[] = highAssignments.map(hv => {
      let idx = 0
      for (let p = 0; p < n; p++) {
        const v = vars[p]
        const sj = selVars.indexOf(v)
        const bit = sj >= 0 ? selectBits[sj] : hv[highVars.indexOf(v)]
        idx = idx * 2 + bit
      }
      if (dcSet.has(idx)) return 'X'
      return onSet.has(idx) ? 1 : 0
    })
    rows.push({ index: i, selectBits, dataPin: dataPins[i], cofactor: cof, data: reduceData(cof, highVars) })
  }
  if (spec.dontCares.length) warnings.push('无关项参与降维：数据端取值在 0 与 1 之间选择，以使结果最简。')

  const wiring: MsiWire[] = selPins.map((p, idx) => {
    const j = idx - (s - m)
    return j < 0 ? { pin: p, signal: 'GND', note: '高位地址接地' } : { pin: p, signal: selVars[j] }
  })
  if (chip === '151') {
    wiring.push({ pin: 'S̄', signal: 'GND', note: '选通有效' })
  } else {
    wiring.push({ pin: '1S̄', signal: 'GND', note: '选通有效' })
    wiring.push({ pin: '2S̄', signal: 'VCC', note: '本例不用第 2 路' })
  }
  dataPins.forEach((p, i) => {
    if (i >= 1 << m) {
      wiring.push({ pin: p, signal: 'GND', note: '地址高位接地，不会被选中' })
      return
    }
    const d = rows[i].data
    if (d.kind === 'const') wiring.push({ pin: p, signal: d.value === 1 ? 'VCC' : 'GND' })
    else if (d.kind === 'literal') {
      wiring.push(d.neg ? { pin: p, signal: d.name, note: '经非门反相' } : { pin: p, signal: d.name })
    } else wiring.push({ pin: p, signal: d.text, note: '需外加门电路' })
  })
  wiring.push({ pin: chip === '151' ? 'Y' : '1Y', signal: 'F' })

  const mapping: MuxMapping = {
    kind: 'mux',
    chip,
    selectVars: selVars.slice(),
    highVars: highVars.slice(),
    highAssignments,
    rows,
  }
  const steps: Step[] = [
    {
      kind: 'select',
      text:
        `选择端：${selVars.map((v, j) => `${selPins[s - m + j]} = ${v}`).join('，')}` +
        (m < s ? `；其余地址端接地，只用前 ${1 << m} 个数据端。` : '。'),
    },
    {
      kind: 'reduce',
      text:
        k > 0
          ? `降维：对每个选择码，把 F 按 ${highVars.join('、')} 展开，得到数据端的取值（0、1、变量或其反变量）。`
          : '函数变量全部作为选择端，数据端直接取 F 在各选择码下的值。',
    },
    ...rows.map(r => ({
      kind: 'data',
      text: `${r.dataPin}（选择码 ${r.selectBits.join('')}）= ${r.data.kind === 'expr' ? r.data.text : r.data.kind === 'const' ? String(r.data.value) : r.data.text}`,
    })),
    { kind: 'output', text: `Y = Σ D_i · m_i(${selVars.join(' ')})` },
  ]
  return {
    result: {
      chip,
      chipName: CHIP_NAME[chip],
      pins: CHIP_PINS[chip],
      stages: [{ label: CHIP_NAME[chip], wiring }],
      mapping,
      functionText: specText(spec),
      functionLatex: specLatex(spec),
    },
    steps,
    warnings,
  }
}

// ───────────────────────── 283：加法器与 BCD 修正 ─────────────────────────

/** BCD 修正判断：第一片的和 C4S4S3S2S1 ≥ 10 时修正信号 K 为 1（需加 6）。 */
export function bcdCorrection(sum: number): 0 | 1 {
  const c4 = (sum >> 4) & 1
  const s4 = (sum >> 3) & 1
  const s3 = (sum >> 2) & 1
  const s2 = (sum >> 1) & 1
  return c4 === 1 || (s4 === 1 && (s3 === 1 || s2 === 1)) ? 1 : 0
}

function adderMap(bcd: boolean): MsiOutcome {
  const stages: MsiStage[] = [
    {
      label: '第 1 片：A + B + Cin',
      wiring: [
        { pin: 'A1', signal: 'A1', note: '操作数 A 的最低位' },
        { pin: 'A2', signal: 'A2' },
        { pin: 'A3', signal: 'A3' },
        { pin: 'A4', signal: 'A4', note: '操作数 A 的最高位' },
        { pin: 'B1', signal: 'B1', note: '操作数 B 的最低位' },
        { pin: 'B2', signal: 'B2' },
        { pin: 'B3', signal: 'B3' },
        { pin: 'B4', signal: 'B4', note: '操作数 B 的最高位' },
        { pin: 'C0', signal: 'Cin', note: '无低位进位时接 GND' },
        { pin: 'Σ1', signal: 'S1' },
        { pin: 'Σ2', signal: 'S2' },
        { pin: 'Σ3', signal: 'S3' },
        { pin: 'Σ4', signal: 'S4' },
        { pin: 'C4', signal: 'C4', note: '进位输出' },
      ],
    },
  ]
  const steps: Step[] = [{ kind: 'add', text: 'S = A + B + Cin，结果为 5 位 C4 S4 S3 S2 S1（二进制）。' }]
  let mapping: AdderMapping = { kind: 'adder', bcd: false, correctionText: null, correctionLatex: null }
  if (bcd) {
    stages.push({
      label: '第 2 片：加 6（0110）修正',
      wiring: [
        { pin: 'A1', signal: 'S1', note: '第 1 片的和' },
        { pin: 'A2', signal: 'S2' },
        { pin: 'A3', signal: 'S3' },
        { pin: 'A4', signal: 'S4' },
        { pin: 'B1', signal: 'GND', note: '6 = 0110' },
        { pin: 'B2', signal: 'K', note: '修正信号' },
        { pin: 'B3', signal: 'K', note: '修正信号' },
        { pin: 'B4', signal: 'GND' },
        { pin: 'C0', signal: 'GND' },
        { pin: 'Σ1', signal: 'R1', note: '个位结果' },
        { pin: 'Σ2', signal: 'R2' },
        { pin: 'Σ3', signal: 'R3' },
        { pin: 'Σ4', signal: 'R4' },
        { pin: 'C4', signal: '不用' },
      ],
    })
    mapping = {
      kind: 'adder',
      bcd: true,
      correctionText: 'K = C4 + S4S3 + S4S2',
      correctionLatex: 'K = C_4 + S_4S_3 + S_4S_2',
    }
    steps.push(
      {
        kind: 'bcd-detect',
        text: '8421 码加法：和大于 9 时需要修正。判断式 K = C4 + S4S3 + S4S2（和为 10～19 或有进位时 K = 1）。',
      },
      {
        kind: 'bcd-add',
        text: 'K = 1 时第 2 片加 0110（即 6），结果为个位 R4R3R2R1；K 即为十位进位。K = 0 时第 2 片加 0，结果即为和。',
      },
    )
  }
  return {
    result: {
      chip: '283',
      chipName: CHIP_NAME['283'],
      pins: CHIP_PINS['283'],
      stages,
      mapping,
      functionText: bcd
        ? '4 位二进制加法，并做 8421 码（BCD）修正'
        : '4 位二进制加法：S = A + B + Cin，C4 为进位',
      functionLatex: null,
    },
    steps,
    warnings: [],
  }
}

// ───────────────────────── 85：比较器级联 ─────────────────────────

function comparatorMap(bits: number): MsiOutcome {
  if (!Number.isInteger(bits) || bits < 4 || bits > 16 || bits % 4 !== 0) {
    throw new DlogicInputError('比较位数应为 4、8、12 或 16。')
  }
  const stageCount = bits / 4
  const stages: MsiStage[] = []
  for (let s = 0; s < stageCount; s++) {
    const lo = 4 * s
    const wiring: MsiWire[] = []
    for (let j = 3; j >= 0; j--) {
      wiring.push({ pin: `A${j}`, signal: `A${lo + j}`, note: lo + j === 0 ? '最低位' : undefined })
    }
    for (let j = 3; j >= 0; j--) {
      wiring.push({ pin: `B${j}`, signal: `B${lo + j}`, note: lo + j === 0 ? '最低位' : undefined })
    }
    if (s === 0) {
      wiring.push({ pin: 'I(A>B)', signal: 'GND', note: '最低片的级联输入' })
      wiring.push({ pin: 'I(A<B)', signal: 'GND' })
      wiring.push({ pin: 'I(A=B)', signal: 'VCC', note: '最低片的级联输入' })
    } else {
      wiring.push({ pin: 'I(A>B)', signal: `G${s - 1}`, note: '接低一位片的输出' })
      wiring.push({ pin: 'I(A<B)', signal: `L${s - 1}` })
      wiring.push({ pin: 'I(A=B)', signal: `E${s - 1}` })
    }
    wiring.push({ pin: 'F(A>B)', signal: `G${s}` })
    wiring.push({ pin: 'F(A<B)', signal: `L${s}` })
    wiring.push({ pin: 'F(A=B)', signal: `E${s}` })
    stages.push({ label: `第 ${s + 1} 片：第 ${lo + 3} ~ ${lo} 位`, wiring })
  }
  const steps: Step[] = [
    {
      kind: 'compare',
      text: '比较规则：从最高位开始，第一对不相等的位决定大小；全部相等时，结果由级联输入决定。',
    },
    {
      kind: 'cascade',
      text:
        stageCount > 1
          ? `级联：低位片的 F(A>B)、F(A<B)、F(A=B) 接高位片的 I(A>B)、I(A<B)、I(A=B)；最低片的级联输入为 0、0、1。总输出取最高位片的 F。`
          : '单片使用：I(A>B)、I(A<B) 接 0，I(A=B) 接 1，输出直接取 F。',
    },
  ]
  return {
    result: {
      chip: '85',
      chipName: CHIP_NAME['85'],
      pins: CHIP_PINS['85'],
      stages,
      mapping: { kind: 'comparator', bits, stages: stageCount } as ComparatorMapping,
      functionText: `${bits} 位数值比较：F(A>B)、F(A<B)、F(A=B)`,
      functionLatex: null,
    },
    steps,
    warnings: [],
  }
}

// ───────────────────────── 280：奇偶校验 ─────────────────────────

function parityMap(spec: BoolSpec): MsiOutcome {
  requireVars(spec)
  const n = spec.variables.length
  if (n > 9) throw new DlogicInputError('74LS280 最多 9 个输入。')
  const on = new Set(spec.minterms)
  const dc = new Set(spec.dontCares)
  let oddOk = true
  let evenOk = true
  for (let m = 0; m < 1 << n; m++) {
    if (dc.has(m)) continue
    let pc = 0
    for (let x = m; x; x >>= 1) pc += x & 1
    const p = pc & 1
    const v = on.has(m) ? 1 : 0
    if (v !== p) oddOk = false
    if (v !== 1 - p) evenOk = false
  }
  if (!oddOk && !evenOk) {
    throw new DlogicInputError(
      '该函数不是输入变量的奇偶函数（输出只取决于输入中 1 的个数的奇偶性），74LS280 无法直接实现。',
    )
  }
  const odd = oddOk
  const outPin = odd ? 'Σ_O' : 'Σ_E'
  const inPins = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const wiring: MsiWire[] = inPins.map((p, j) =>
    j < n ? { pin: p, signal: spec.variables[j] } : { pin: p, signal: 'GND', note: '未用输入接地' },
  )
  wiring.push({ pin: outPin, signal: 'F' })
  wiring.push({ pin: odd ? 'Σ_E' : 'Σ_O', signal: '不用' })
  const mapping: ParityMapping = { kind: 'parity', variables: spec.variables.slice(), odd, outputPin: outPin }
  const steps: Step[] = [
    {
      kind: 'parity',
      text: odd
        ? `函数为奇校验：输入中 1 的个数为奇数时 F = 1，由 ${outPin} 输出。`
        : `函数为偶校验：输入中 1 的个数为偶数时 F = 1，由 ${outPin} 输出。`,
    },
    {
      kind: 'pad',
      text: n < 9 ? `未用的 ${9 - n} 个输入接 0（0 不改变 1 的个数的奇偶性）。` : '9 个输入全部使用。',
    },
  ]
  return {
    result: {
      chip: '280',
      chipName: CHIP_NAME['280'],
      pins: CHIP_PINS['280'],
      stages: [{ label: CHIP_NAME['280'], wiring }],
      mapping,
      functionText: odd
        ? `奇校验：F = ${spec.variables.join(' ⊕ ')} 的奇偶（1 的个数为奇数时为 1）`
        : `偶校验：F = 1 当且仅当 ${spec.variables.join('、')} 中 1 的个数为偶数`,
      functionLatex: null,
    },
    steps,
    warnings: [],
  }
}

// ───────────────────────── 148：编码器说明 ─────────────────────────

function encoderMap(): MsiOutcome {
  const mapping: EncoderMapping = { kind: 'encoder' }
  return {
    result: {
      chip: '148',
      chipName: CHIP_NAME['148'],
      pins: CHIP_PINS['148'],
      stages: [],
      mapping,
      functionText: '8 线-3 线优先编码：I7 优先级最高，输出为最高有效输入编号的反码',
      functionLatex: null,
    },
    steps: [
      { kind: 'encode', text: '同一时刻有多个输入有效时，只对优先级最高的输入编码（I7 最高，I0 最低）。' },
      { kind: 'encode', text: '输出 Y̅2Y̅1Y̅0 为低有效，即编码的反码；无输入有效时 GS̅ 为 1。' },
    ],
    warnings: ['74LS148 是优先编码器，不直接实现任意逻辑函数；此处只给出引脚与优先级说明。'],
  }
}

// ───────────────────────── 入口 ─────────────────────────

/** 按芯片分派 MSI 映射。 */
export function mapMsi(req: MsiRequest): MsiOutcome {
  if (!MSI_CHIPS.includes(req.chip)) {
    throw new DlogicInputError(`不支持的芯片 ${String(req.chip)}，可用：${MSI_CHIPS.join('、')}。`)
  }
  switch (req.chip) {
    case '138':
    case '139':
      return decoderMap(req.chip, functionSpec(req))
    case '151':
    case '153':
      return muxMap(req.chip, functionSpec(req), req.selectVars)
    case '148':
      return encoderMap()
    case '283':
      return adderMap(req.bcd === true)
    case '85':
      return comparatorMap(req.bits ?? 4)
    case '280':
      return parityMap(functionSpec(req))
  }
}
