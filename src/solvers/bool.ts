// 布尔函数求解器：纯函数，不做 I/O，不依赖 DSH。
// 约定：最小项编号中 variables[0] 为最高位（MSB），例如 [A,B,C] 时 m5 = A·B'·C。
// 只使用可擦除的 TypeScript 语法，Node 可直接运行。

import { DlogicInputError } from '../shared/contracts.ts'
import type {
  BoolSpec,
  EquivalenceResult,
  GateForms,
  HazardResult,
  Implicant,
  KMapLayout,
  MinimizeResult,
  Step,
  TruthTable,
} from '../shared/contracts.ts'

export type Form = 'SOP' | 'POS'

const MAX_VARS = 6
const PETRICK_CAP = 50000

// ───────────────────────── 表达式 AST ─────────────────────────

export type BoolExpr =
  | { k: 'var'; name: string }
  | { k: 'const'; v: 0 | 1 }
  | { k: 'not'; x: BoolExpr }
  | { k: 'and'; xs: BoolExpr[] }
  | { k: 'or'; xs: BoolExpr[] }
  | { k: 'xor'; a: BoolExpr; b: BoolExpr }
  | { k: 'xnor'; a: BoolExpr; b: BoolExpr }

export interface ParsedExpr {
  ast: BoolExpr
  variables: string[]
}

// ───────────────────────── 词法与语法 ─────────────────────────

interface Token {
  kind: 'var' | 'const' | 'lp' | 'rp' | 'postNot' | 'preNot' | 'and' | 'or' | 'xor' | 'xnor'
  /** 在原始输入中的 0 起始位置。 */
  pos: number
  text: string
  name?: string
  v?: 0 | 1
}

const OPERATORS: Record<string, Token['kind']> = {
  "'": 'postNot',
  '’': 'postNot',
  '!': 'preNot',
  '~': 'preNot',
  '¬': 'preNot',
  '*': 'and',
  '·': 'and',
  '&': 'and',
  '∧': 'and',
  '+': 'or',
  '|': 'or',
  '∨': 'or',
  '⊕': 'xor',
  '^': 'xor',
  '⊙': 'xnor',
  '(': 'lp',
  '[': 'lp',
  ')': 'rp',
  ']': 'rp',
}

const PREFIX_RE = /^\s*[A-Za-z][A-Za-z0-9_]*\s*(\([^()]*\))?\s*=/

function checkVarNames(vars: string[]): void {
  const seen = new Set<string>()
  for (const v of vars) {
    if (typeof v !== 'string' || v.trim() === '') throw new DlogicInputError('变量名不能为空')
    if (seen.has(v)) throw new DlogicInputError(`变量名重复：${v}`)
    seen.add(v)
  }
}

function tokenize(src: string, offset: number, names: string[] | null): Token[] {
  const toks: Token[] = []
  const byLength = names ? names.slice().sort((x, y) => y.length - x.length) : []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    const pos = offset + i
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (names) {
      const hit = byLength.find(nm => src.startsWith(nm, i))
      if (hit !== undefined) {
        toks.push({ kind: 'var', pos, text: hit, name: hit })
        i += hit.length
        continue
      }
    }
    if (ch === '0' || ch === '1') {
      toks.push({ kind: 'const', pos, text: ch, v: ch === '1' ? 1 : 0 })
      i++
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      if (names) {
        throw new DlogicInputError(`未知变量“${ch}”（位置 ${pos + 1}），可用变量为：${names.join(', ')}`)
      }
      let j = i + 1
      while (j < src.length && /[0-9]/.test(src[j])) j++
      const name = src.slice(i, j)
      toks.push({ kind: 'var', pos, text: name, name })
      i = j
      continue
    }
    const kind = OPERATORS[ch]
    if (kind === undefined) {
      throw new DlogicInputError(`包含无法识别的字符“${ch}”（位置 ${pos + 1}）`)
    }
    toks.push({ kind, pos, text: ch })
    i++
  }
  return toks
}

function parseTokens(toks: Token[]): BoolExpr {
  let p = 0

  function kindAt(): string | undefined {
    return toks[p] ? toks[p].kind : undefined
  }

  function unexpected(): never {
    const t = toks[p]
    if (!t) throw new DlogicInputError('语法错误：表达式在结尾处不完整')
    throw new DlogicInputError(`语法错误：位置 ${t.pos + 1} 处的“${t.text}”不符合语法`)
  }

  // 最低优先级：OR
  function parseOr(): BoolExpr {
    const xs: BoolExpr[] = [parseXor()]
    while (kindAt() === 'or') {
      p++
      xs.push(parseXor())
    }
    return xs.length === 1 ? xs[0] : { k: 'or', xs }
  }

  // XOR / XNOR（同级，左结合）
  function parseXor(): BoolExpr {
    let node = parseAnd()
    while (kindAt() === 'xor' || kindAt() === 'xnor') {
      const k = kindAt() === 'xor' ? 'xor' : 'xnor'
      p++
      const rhs = parseAnd()
      node = { k, a: node, b: rhs }
    }
    return node
  }

  // AND：显式运算符或并置（相邻因子）
  function parseAnd(): BoolExpr {
    const xs: BoolExpr[] = [parseUnary()]
    for (;;) {
      const kd = kindAt()
      if (kd === 'and') {
        p++
        xs.push(parseUnary())
      } else if (kd === 'var' || kd === 'const' || kd === 'lp' || kd === 'preNot') {
        xs.push(parseUnary())
      } else {
        break
      }
    }
    return xs.length === 1 ? xs[0] : { k: 'and', xs }
  }

  // 最高优先级：前缀 NOT
  function parseUnary(): BoolExpr {
    if (kindAt() === 'preNot') {
      p++
      return { k: 'not', x: parseUnary() }
    }
    return parsePostfix()
  }

  // 后缀 '（作用于前面的原子或括号组）
  function parsePostfix(): BoolExpr {
    let node = parseAtom()
    while (kindAt() === 'postNot') {
      p++
      node = { k: 'not', x: node }
    }
    return node
  }

  function parseAtom(): BoolExpr {
    const t = toks[p]
    if (!t) unexpected()
    if (t.kind === 'var') {
      p++
      return { k: 'var', name: t.name as string }
    }
    if (t.kind === 'const') {
      p++
      return { k: 'const', v: t.v as 0 | 1 }
    }
    if (t.kind === 'lp') {
      p++
      const inner = parseOr()
      if (kindAt() !== 'rp') {
        throw new DlogicInputError(`括号不匹配：位置 ${t.pos + 1} 处的“${t.text}”缺少对应的闭括号`)
      }
      p++
      return inner
    }
    return unexpected()
  }

  if (toks.length === 0) throw new DlogicInputError('表达式为空')
  const ast = parseOr()
  if (p < toks.length) unexpected()
  return ast
}

/**
 * 解析布尔表达式。
 * 若给出 variables，则按其名称做最长匹配；否则每个字母（可跟数字）为一个变量，变量按字母序排列。
 */
export function parseExpr(expr: string, variables?: string[]): ParsedExpr {
  if (typeof expr !== 'string') throw new DlogicInputError('表达式必须是字符串')
  const m = PREFIX_RE.exec(expr)
  const offset = m ? m[0].length : 0
  const body = expr.slice(offset)
  if (body.trim() === '') throw new DlogicInputError('表达式为空')

  let names: string[] | null = null
  if (variables !== undefined) {
    if (!Array.isArray(variables)) throw new DlogicInputError('variables 必须是字符串数组')
    checkVarNames(variables)
    names = variables.slice()
  }
  const toks = tokenize(body, offset, names)
  const ast = parseTokens(toks)

  let vars: string[]
  if (names) {
    vars = names
  } else {
    const set = new Set<string>()
    for (const t of toks) if (t.kind === 'var' && t.name) set.add(t.name)
    vars = [...set].sort()
  }
  if (vars.length > MAX_VARS) {
    throw new DlogicInputError(`最多支持 ${MAX_VARS} 个变量，当前为 ${vars.length} 个`)
  }
  return { ast, variables: vars }
}

function evalExpr(e: BoolExpr, env: Map<string, 0 | 1>): 0 | 1 {
  switch (e.k) {
    case 'var': {
      const v = env.get(e.name)
      if (v === undefined) throw new DlogicInputError(`未知变量“${e.name}”`)
      return v
    }
    case 'const':
      return e.v
    case 'not':
      return evalExpr(e.x, env) === 1 ? 0 : 1
    case 'and':
      return e.xs.every(x => evalExpr(x, env) === 1) ? 1 : 0
    case 'or':
      return e.xs.some(x => evalExpr(x, env) === 1) ? 1 : 0
    case 'xor':
      return evalExpr(e.a, env) ^ evalExpr(e.b, env) ? 1 : 0
    case 'xnor':
      return evalExpr(e.a, env) ^ evalExpr(e.b, env) ? 0 : 1
  }
}

function astMinterms(ast: BoolExpr, vars: string[]): number[] {
  const n = vars.length
  const out: number[] = []
  for (let m = 0; m < 1 << n; m++) {
    const env = new Map<string, 0 | 1>()
    for (let i = 0; i < n; i++) env.set(vars[i], bitOf(m, i, n) as 0 | 1)
    if (evalExpr(ast, env) === 1) out.push(m)
  }
  return out
}

/** 由表达式得到规范（无无关项）。 */
export function specFromExpr(expr: string, variables?: string[]): BoolSpec {
  const parsed = parseExpr(expr, variables)
  return { variables: parsed.variables, minterms: astMinterms(parsed.ast, parsed.variables), dontCares: [] }
}

// ───────────────────────── 规范校验 ─────────────────────────

function checkSpec(spec: BoolSpec): { n: number; minterms: number[]; dontCares: number[] } {
  if (!spec || !Array.isArray(spec.variables) || !Array.isArray(spec.minterms)) {
    throw new DlogicInputError('布尔函数规范不完整：需要 variables 与 minterms 数组')
  }
  checkVarNames(spec.variables)
  const n = spec.variables.length
  if (n > MAX_VARS) throw new DlogicInputError(`最多支持 ${MAX_VARS} 个变量，当前为 ${n} 个`)
  const total = 1 << n
  const minterms = normalizeList(spec.minterms, '最小项', total)
  const dontCares = normalizeList(Array.isArray(spec.dontCares) ? spec.dontCares : [], '无关项', total)
  const dcSet = new Set(dontCares)
  for (const m of minterms) {
    if (dcSet.has(m)) throw new DlogicInputError(`编号 ${m} 同时出现在最小项与无关项中`)
  }
  return { n, minterms, dontCares }
}

function normalizeList(list: number[], label: string, total: number): number[] {
  const set = new Set<number>()
  for (const m of list) {
    if (!Number.isInteger(m)) throw new DlogicInputError(`${label}中含有非整数：${String(m)}`)
    if (m < 0 || m >= total) {
      throw new DlogicInputError(`${label}编号 ${m} 超出范围（0～${total - 1}）`)
    }
    set.add(m)
  }
  return [...set].sort((a, b) => a - b)
}

function checkForm(form: string): void {
  if (form !== 'SOP' && form !== 'POS') throw new DlogicInputError('形式必须是 SOP 或 POS')
}

// ───────────────────────── 位运算与掩码工具 ─────────────────────────

function bitOf(m: number, i: number, n: number): number {
  return (m >> (n - 1 - i)) & 1
}

function binString(m: number, n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += bitOf(m, i, n) ? '1' : '0'
  return s
}

function coversOf(mask: string, n: number): number[] {
  const out: number[] = []
  for (let m = 0; m < 1 << n; m++) {
    let ok = true
    for (let i = 0; i < n; i++) {
      const c = mask[i]
      if (c !== '-' && Number(c) !== bitOf(m, i, n)) {
        ok = false
        break
      }
    }
    if (ok) out.push(m)
  }
  return out
}

function literalCount(mask: string): number {
  let c = 0
  for (const ch of mask) if (ch !== '-') c++
  return c
}

function onesOf(mask: string): number {
  let c = 0
  for (const ch of mask) if (ch === '1') c++
  return c
}

function isAllDash(mask: string): boolean {
  return !/[01]/.test(mask)
}

function maskKey(mask: string): string {
  return mask.replace(/-/g, 'z')
}

/** 排序：先按文字数，再按掩码（'0'<'1'<'-'）。 */
function cmpImplicant(a: { mask: string; literals: number }, b: { mask: string; literals: number }): number {
  if (a.literals !== b.literals) return a.literals - b.literals
  const ka = maskKey(a.mask)
  const kb = maskKey(b.mask)
  return ka < kb ? -1 : ka > kb ? 1 : 0
}

function combineMasks(a: string, b: string): string | null {
  let diff = -1
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue
    if (a[k] === '-' || b[k] === '-' || diff >= 0) return null
    diff = k
  }
  if (diff < 0) return null
  return a.slice(0, diff) + '-' + a.slice(diff + 1)
}

function popNum(x: number): number {
  let c = 0
  let y = x
  while (y) {
    c += y & 1
    y >>= 1
  }
  return c
}

function popBig(x: bigint): number {
  let c = 0
  let y = x
  while (y !== 0n) {
    if ((y & 1n) === 1n) c++
    y >>= 1n
  }
  return c
}

// ───────────────────────── 文本与 LaTeX 渲染 ─────────────────────────

function latexName(name: string): string {
  const m = /^([A-Za-z])(\d+)$/.exec(name)
  return m ? m[1] + '_{' + m[2] + '}' : name
}

/** 一个文字：neg 为 true 时带反号。 */
function litOf(name: string, neg: boolean, latex: boolean): string {
  const base = latex ? latexName(name) : name
  if (!neg) return base
  return latex ? '\\overline{' + base + '}' : base + "'"
}

function makeImplicant(mask: string, vars: string[], form: Form): Implicant {
  const covers = coversOf(mask, vars.length)
  const literals = literalCount(mask)
  if (isAllDash(mask)) {
    const c = form === 'SOP' ? '1' : '0'
    return { mask, covers, literals, text: c, latex: c }
  }
  const t: string[] = []
  const l: string[] = []
  for (let i = 0; i < vars.length; i++) {
    const bit = mask[i]
    if (bit === '-') continue
    const neg = form === 'SOP' ? bit === '0' : bit === '1'
    t.push(litOf(vars[i], neg, false))
    l.push(litOf(vars[i], neg, true))
  }
  if (form === 'SOP') return { mask, covers, literals, text: t.join(''), latex: l.join('') }
  return { mask, covers, literals, text: '(' + t.join('+') + ')', latex: '(' + l.join('+') + ')' }
}

/** 由蕴涵项拼整式：SOP 项以 " + " 连接；POS 项直接相接，单文字时去掉括号。 */
function joinExpr(impls: Implicant[], form: Form, latex: boolean): string {
  if (impls.length === 0) return form === 'SOP' ? '0' : '1'
  const pick = (i: Implicant): string => (latex ? i.latex : i.text)
  if (form === 'SOP') return impls.map(pick).join(' + ')
  if (impls.length === 1 && impls[0].literals === 1) return pick(impls[0]).slice(1, -1)
  return impls.map(pick).join('')
}

function precOf(e: BoolExpr): number {
  switch (e.k) {
    case 'or':
      return 1
    case 'xor':
    case 'xnor':
      return 2
    case 'and':
      return 3
    default:
      return 4
  }
}

function wrapText(x: BoolExpr, parentPrec: number): string {
  const t = renderText(x)
  return precOf(x) <= parentPrec ? '(' + t + ')' : t
}

function renderText(e: BoolExpr): string {
  switch (e.k) {
    case 'var':
      return e.name
    case 'const':
      return String(e.v)
    case 'not': {
      const inner = renderText(e.x)
      return precOf(e.x) < 4 ? '(' + inner + ")'" : inner + "'"
    }
    case 'and': {
      let s = ''
      for (const x of e.xs) {
        const t = wrapText(x, 3)
        // 数字紧跟在变量名后会被解析成多字符变量名，需要用 · 隔开
        if (s !== '' && /^[01]/.test(t)) s += '·'
        s += t
      }
      return s
    }
    case 'or':
      return e.xs.map(x => wrapText(x, 1)).join('+')
    case 'xor':
      return wrapText(e.a, 2) + '⊕' + wrapText(e.b, 2)
    case 'xnor':
      return wrapText(e.a, 2) + '⊙' + wrapText(e.b, 2)
  }
}

function wrapLatex(x: BoolExpr, parentPrec: number): string {
  const t = renderLatex(x)
  return precOf(x) <= parentPrec ? '(' + t + ')' : t
}

function renderLatex(e: BoolExpr): string {
  switch (e.k) {
    case 'var':
      return latexName(e.name)
    case 'const':
      return String(e.v)
    case 'not':
      return '\\overline{' + renderLatex(e.x) + '}'
    case 'and':
      return e.xs.map(x => wrapLatex(x, 3)).join('')
    case 'or':
      return e.xs.map(x => wrapLatex(x, 1)).join(' + ')
    case 'xor':
      return wrapLatex(e.a, 2) + ' \\oplus ' + wrapLatex(e.b, 2)
    case 'xnor':
      return wrapLatex(e.a, 2) + ' \\odot ' + wrapLatex(e.b, 2)
  }
}

// ───────────────────────── 反演 / 对偶 ─────────────────────────

/** 反演规则：AND↔OR、0↔1、XOR↔XNOR，变量取反；¬e 直接变为 e。不化简。 */
function complementAst(e: BoolExpr): BoolExpr {
  switch (e.k) {
    case 'var':
      return { k: 'not', x: e }
    case 'const':
      return { k: 'const', v: e.v === 1 ? 0 : 1 }
    case 'not':
      return e.x
    case 'and':
      return { k: 'or', xs: e.xs.map(complementAst) }
    case 'or':
      return { k: 'and', xs: e.xs.map(complementAst) }
    case 'xor':
      return { k: 'xnor', a: complementAst(e.a), b: complementAst(e.b) }
    case 'xnor':
      return { k: 'xor', a: complementAst(e.a), b: complementAst(e.b) }
  }
}

/** 对偶规则：AND↔OR、0↔1、XOR↔XNOR，保留文字。不化简。 */
function dualAst(e: BoolExpr): BoolExpr {
  switch (e.k) {
    case 'var':
      return e
    case 'const':
      return { k: 'const', v: e.v === 1 ? 0 : 1 }
    case 'not':
      return { k: 'not', x: dualAst(e.x) }
    case 'and':
      return { k: 'or', xs: e.xs.map(dualAst) }
    case 'or':
      return { k: 'and', xs: e.xs.map(dualAst) }
    case 'xor':
      return { k: 'xnor', a: dualAst(e.a), b: dualAst(e.b) }
    case 'xnor':
      return { k: 'xor', a: dualAst(e.a), b: dualAst(e.b) }
  }
}

export function complementExpr(expr: string, variables?: string[]): { text: string; latex: string } {
  const { ast } = parseExpr(expr, variables)
  const out = complementAst(ast)
  return { text: renderText(out), latex: renderLatex(out) }
}

export function dualExpr(expr: string, variables?: string[]): { text: string; latex: string } {
  const { ast } = parseExpr(expr, variables)
  const out = dualAst(ast)
  return { text: renderText(out), latex: renderLatex(out) }
}

// ───────────────────────── 真值表与标准形 ─────────────────────────

export function truthTable(spec: BoolSpec): TruthTable {
  const { n, minterms, dontCares } = checkSpec(spec)
  const on = new Set(minterms)
  const dc = new Set(dontCares)
  const rows: TruthTable['rows'] = []
  for (let m = 0; m < 1 << n; m++) {
    const inputs: (0 | 1)[] = []
    for (let i = 0; i < n; i++) inputs.push(bitOf(m, i, n) as 0 | 1)
    const output: 0 | 1 | 'X' = on.has(m) ? 1 : dc.has(m) ? 'X' : 0
    rows.push({ index: m, inputs, output })
  }
  return { variables: spec.variables.slice(), rows }
}

export function canonical(spec: BoolSpec): {
  sigma: string
  pi: string
  sopText: string
  sopLatex: string
  posText: string
  posLatex: string
} {
  const { n, minterms, dontCares } = checkSpec(spec)
  const vars = spec.variables.slice()
  const on = new Set(minterms)
  const dc = new Set(dontCares)
  const maxterms: number[] = []
  for (let m = 0; m < 1 << n; m++) if (!on.has(m) && !dc.has(m)) maxterms.push(m)

  let sigma = `Σm(${minterms.join(',')})`
  if (dontCares.length) sigma += ` + Σd(${dontCares.join(',')})`
  let pi = `ΠM(${maxterms.join(',')})`
  if (dontCares.length) pi += ` · Πd(${dontCares.join(',')})`

  const prodTerm = (m: number, latex: boolean): string => {
    let s = ''
    for (let i = 0; i < n; i++) s += litOf(vars[i], bitOf(m, i, n) === 0, latex)
    return s === '' ? '1' : s
  }
  const sumTerm = (m: number, latex: boolean): string => {
    const parts: string[] = []
    for (let i = 0; i < n; i++) parts.push(litOf(vars[i], bitOf(m, i, n) === 1, latex))
    return parts.length ? '(' + parts.join('+') + ')' : '0'
  }

  return {
    sigma,
    pi,
    sopText: minterms.length ? minterms.map(m => prodTerm(m, false)).join(' + ') : '0',
    sopLatex: minterms.length ? minterms.map(m => prodTerm(m, true)).join(' + ') : '0',
    posText: maxterms.length ? maxterms.map(m => sumTerm(m, false)).join('') : '1',
    posLatex: maxterms.length ? maxterms.map(m => sumTerm(m, true)).join('') : '1',
  }
}

// ───────────────────────── 最简化（Quine–McCluskey + Petrick） ─────────────────────────

interface PassEntry {
  mask: string
  covers: number[]
  combined: boolean
}

/** 列表法：返回全部质蕴涵项掩码，以及每一轮的分组表。 */
function qmPrimes(n: number, seed: number[]): { primes: string[]; passes: PassEntry[][] } {
  let cur = [...new Set(seed.map(m => binString(m, n)))].sort()
  const primes: string[] = []
  const passes: PassEntry[][] = []
  while (cur.length > 0) {
    const used = new Set<string>()
    const next = new Set<string>()
    for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        const c = combineMasks(cur[i], cur[j])
        if (c !== null) {
          used.add(cur[i])
          used.add(cur[j])
          next.add(c)
        }
      }
    }
    passes.push(cur.map(mask => ({ mask, covers: coversOf(mask, n), combined: used.has(mask) })))
    for (const mask of cur) if (!used.has(mask)) primes.push(mask)
    cur = [...next].sort()
  }
  return { primes, passes }
}

/** Petrick 中去除被包含的乘积项（吸收律）。 */
function absorb(set: Set<bigint>): bigint[] {
  const arr = [...set].map(x => ({ x, c: popBig(x) })).sort((a, b) => a.c - b.c)
  const kept: bigint[] = []
  for (const { x } of arr) {
    if (!kept.some(k => (k & x) === k)) kept.push(x)
  }
  return kept
}

interface Prime {
  mask: string
  literals: number
  onCovers: number[]
}

interface Solved {
  n: number
  vars: string[]
  form: Form
  /** 编号为 ON（SOP 为最小项，POS 为最大项）。 */
  on: number[]
  passes: PassEntry[][]
  primes: Implicant[]
  onCovers: Record<string, number[]>
  essential: string[]
  solutions: Implicant[][]
  texts: string[]
  latex: string[]
  cost: { terms: number; literals: number }
}

function solve(spec: BoolSpec, form: Form): Solved {
  const { n, minterms, dontCares } = checkSpec(spec)
  const vars = spec.variables.slice()
  const total = 1 << n
  const dcSet = new Set(dontCares)
  const mset = new Set(minterms)

  // SOP 对函数本身化简；POS 对补函数（零点）化简
  let on: number[] = minterms
  if (form === 'POS') {
    on = []
    for (let m = 0; m < total; m++) if (!mset.has(m) && !dcSet.has(m)) on.push(m)
  }

  if (on.length === 0) {
    const c = form === 'SOP' ? '0' : '1'
    return {
      n,
      vars,
      form,
      on,
      passes: [],
      primes: [],
      onCovers: {},
      essential: [],
      solutions: [[]],
      texts: [c],
      latex: [c],
      cost: { terms: 0, literals: 0 },
    }
  }

  const onSet = new Set(on)
  const qm = qmPrimes(n, [...on, ...dontCares])
  const allPrimes: Prime[] = qm.primes
    .map(mask => ({
      mask,
      literals: literalCount(mask),
      onCovers: coversOf(mask, n).filter(m => onSet.has(m)),
    }))
    .filter(p => p.onCovers.length > 0)
    .sort(cmpImplicant)

  // 本质质蕴涵项：唯一覆盖某个 ON 编号的质蕴涵项
  const essentialSet = new Set<string>()
  for (const m of on) {
    const cov = allPrimes.filter(p => p.onCovers.includes(m))
    if (cov.length === 1) essentialSet.add(cov[0].mask)
  }
  const essentialPrimes = allPrimes.filter(p => essentialSet.has(p.mask))
  const coveredByEss = new Set<number>()
  for (const p of essentialPrimes) for (const m of p.onCovers) coveredByEss.add(m)
  const remaining = on.filter(m => !coveredByEss.has(m))
  const cand = allPrimes.filter(p => !essentialSet.has(p.mask) && p.onCovers.some(m => !coveredByEss.has(m)))

  // Petrick：乘积之和，每个乘积项为候选质蕴涵项的位集合
  let products: bigint[] = [0n]
  for (const m of remaining) {
    let clause = 0n
    cand.forEach((p, j) => {
      if (p.onCovers.includes(m)) clause |= 1n << BigInt(j)
    })
    const next = new Set<bigint>()
    for (const pr of products) {
      if ((pr & clause) !== 0n) {
        next.add(pr)
        continue
      }
      for (let j = 0; j < cand.length; j++) {
        if (((clause >> BigInt(j)) & 1n) !== 0n) next.add(pr | (1n << BigInt(j)))
      }
    }
    if (next.size > PETRICK_CAP) {
      throw new DlogicInputError(`Petrick 法的中间乘积项超过 ${PETRICK_CAP} 个，问题规模过大`)
    }
    products = absorb(next)
  }

  const essLits = essentialPrimes.reduce((s, p) => s + p.literals, 0)
  const scored = products.map(pr => {
    let terms = essentialPrimes.length
    let lits = essLits
    for (let j = 0; j < cand.length; j++) {
      if (((pr >> BigInt(j)) & 1n) !== 0n) {
        terms++
        lits += cand[j].literals
      }
    }
    return { pr, terms, lits }
  })
  let best = scored[0]
  for (const s of scored) {
    if (s.terms < best.terms || (s.terms === best.terms && s.lits < best.lits)) best = s
  }
  const chosen = scored.filter(s => s.terms === best.terms && s.lits === best.lits)

  const solutions: Implicant[][] = chosen.map(s => {
    const picks: Prime[] = []
    cand.forEach((p, j) => {
      if (((s.pr >> BigInt(j)) & 1n) !== 0n) picks.push(p)
    })
    return [...essentialPrimes, ...picks].sort(cmpImplicant).map(p => makeImplicant(p.mask, vars, form))
  })
  const keyOf = (sol: Implicant[]): string => sol.map(i => maskKey(i.mask)).join('|')
  solutions.sort((x, y) => {
    const kx = keyOf(x)
    const ky = keyOf(y)
    return kx < ky ? -1 : kx > ky ? 1 : 0
  })

  const first = solutions[0]
  const onCovers: Record<string, number[]> = {}
  for (const p of allPrimes) onCovers[p.mask] = p.onCovers

  return {
    n,
    vars,
    form,
    on,
    passes: qm.passes,
    primes: allPrimes.map(p => makeImplicant(p.mask, vars, form)),
    onCovers,
    essential: essentialPrimes.map(p => p.mask),
    solutions,
    texts: solutions.map(s => joinExpr(s, form, false)),
    latex: solutions.map(s => joinExpr(s, form, true)),
    cost: { terms: first.length, literals: first.reduce((s, i) => s + i.literals, 0) },
  }
}

export function minimize(spec: BoolSpec, form: Form = 'SOP'): MinimizeResult {
  checkForm(form)
  const s = solve(spec, form)
  return {
    form,
    primeImplicants: s.primes,
    essential: s.essential,
    solutions: s.solutions,
    texts: s.texts,
    latex: s.latex,
    cost: s.cost,
  }
}

function textOfMask(s: Solved, mask: string): string {
  const p = s.primes.find(q => q.mask === mask)
  return p ? p.text : mask
}

export function minimizeSteps(spec: BoolSpec, form: Form = 'SOP'): Step[] {
  checkForm(form)
  const s = solve(spec, form)
  if (s.on.length === 0) {
    return [
      {
        kind: 'constant',
        text: form === 'SOP' ? '没有最小项（函数恒为 0），SOP 结果为 0。' : '没有最大项（所有非无关项都为 1），POS 结果为 1。',
      },
    ]
  }
  const sideName = form === 'SOP' ? '最小项（取值为 1 的格）' : '最大项（取值为 0 的格，对补函数化简）'
  const steps: Step[] = []

  steps.push({
    kind: 'qm-columns',
    text: `Quine-McCluskey 列表法：以${sideName}及无关项为起点，按 1 的个数分组，逐轮合并相邻组中只差一位的项；打勾的项已被合并，未打勾的即为质蕴涵项。`,
    columns: s.passes.map(pass =>
      pass
        .slice()
        .sort((a, b) => onesOf(a.mask) - onesOf(b.mask) || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0))
        .map(e => ({ mask: e.mask, covers: e.covers, combined: e.combined })),
    ),
  })

  steps.push({
    kind: 'pi-chart',
    text: `质蕴涵项表：行为质蕴涵项，列为${sideName}，标出每个质蕴涵项覆盖的编号。`,
    primes: s.primes.map(p => p.mask),
    minterms: s.on.slice(),
    cover: Object.fromEntries(s.primes.map(p => [p.mask, s.onCovers[p.mask]])),
  })

  steps.push({
    kind: 'essential',
    text:
      s.essential.length > 0
        ? `本质质蕴涵项（唯一覆盖某个编号的质蕴涵项，必须选入）：${s.essential.map(m => textOfMask(s, m)).join('、')}`
        : '没有本质质蕴涵项，需要进一步比较各覆盖方案。',
    essential: s.essential.slice(),
  })

  steps.push({
    kind: 'petrick',
    text: `Petrick 法：对剩余未被本质质蕴涵项覆盖的编号求乘积和式，取项数最少、其次文字数最少的覆盖，共 ${s.solutions.length} 个最简解。`,
    solutions: s.solutions.map(sol => sol.map(i => i.mask)),
  })

  return steps
}

// ───────────────────────── 卡诺图 ─────────────────────────

function grayCodes(k: number): string[] {
  const out: string[] = []
  for (let i = 0; i < 1 << k; i++) {
    const g = i ^ (i >> 1)
    out.push(g.toString(2).padStart(k, '0'))
  }
  return out
}

export function kmap(spec: BoolSpec, form: Form = 'SOP'): KMapLayout {
  checkForm(form)
  const { n, minterms, dontCares } = checkSpec(spec)
  if (n < 2 || n > 5) throw new DlogicInputError(`卡诺图仅支持 2～5 个变量，当前为 ${n} 个`)
  const vars = spec.variables.slice()
  const planeVar = n === 5 ? vars[0] : null
  const body = n === 5 ? vars.slice(1) : vars
  const rowCount = Math.floor(body.length / 2)
  const rowVars = body.slice(0, rowCount)
  const colVars = body.slice(rowCount)
  const rowCodes = grayCodes(rowVars.length)
  const colCodes = grayCodes(colVars.length)
  const planes = n === 5 ? 2 : 1
  const on = new Set(minterms)
  const dc = new Set(dontCares)

  const cells: KMapLayout['cells'] = []
  for (let p = 0; p < planes; p++) {
    for (let r = 0; r < rowCodes.length; r++) {
      for (let c = 0; c < colCodes.length; c++) {
        const bits = (planeVar !== null ? String(p) : '') + rowCodes[r] + colCodes[c]
        const minterm = parseInt(bits, 2)
        const value: 0 | 1 | 'X' = on.has(minterm) ? 1 : dc.has(minterm) ? 'X' : 0
        cells.push({ plane: p, row: r, col: c, minterm, value })
      }
    }
  }

  const solved = solve(spec, form)
  const groups = solved.solutions[0].map(imp => ({
    mask: imp.mask,
    text: imp.text,
    latex: imp.latex,
    cells: imp.covers.slice(),
  }))

  return {
    variables: vars,
    rowVars,
    colVars,
    rowCodes,
    colCodes,
    planes,
    planeVar,
    cells,
    groups,
  }
}

// ───────────────────────── 险象 ─────────────────────────

type HazardEntry = HazardResult['static1'][number]

function findHazards(cells: number[], n: number, vars: string[], solved: Solved): HazardEntry[] {
  const out: HazardEntry[] = []
  const base = solved.solutions[0]
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]
      const b = cells[j]
      const diff = a ^ b
      if (popNum(diff) !== 1) continue
      const covered = base.some(imp => imp.covers.includes(a) && imp.covers.includes(b))
      if (covered) continue
      let consensus: Implicant | null = null
      for (const p of solved.primes) {
        if (!p.covers.includes(a) || !p.covers.includes(b)) continue
        if (consensus === null || p.literals < consensus.literals) consensus = p
      }
      if (consensus === null) continue
      const pbit = Math.round(Math.log2(diff))
      out.push({ a, b, variable: vars[n - 1 - pbit], consensus })
    }
  }
  return out
}

export function hazard(spec: BoolSpec): HazardResult {
  const { n, minterms, dontCares } = checkSpec(spec)
  const vars = spec.variables.slice()
  const sop = solve(spec, 'SOP')
  const pos = solve(spec, 'POS')
  const mset = new Set(minterms)
  const dcSet = new Set(dontCares)
  const zeros: number[] = []
  for (let m = 0; m < 1 << n; m++) if (!mset.has(m) && !dcSet.has(m)) zeros.push(m)

  const static1 = findHazards(minterms, n, vars, sop)
  const static0 = findHazards(zeros, n, vars, pos)

  // 无险象消除：SOP 解 0 加上静态 1 险象的消去项（去重）
  const baseTerms = sop.solutions[0]
  const texts: string[] = baseTerms.map(i => i.text)
  const latex: string[] = baseTerms.map(i => i.latex)
  const masks = new Set(baseTerms.map(i => i.mask))
  for (const h of static1) {
    if (masks.has(h.consensus.mask)) continue
    masks.add(h.consensus.mask)
    texts.push(h.consensus.text)
    latex.push(h.consensus.latex)
  }
  return {
    static1,
    static0,
    hazardFreeSop: texts.length ? texts.join(' + ') : '0',
    hazardFreeSopLatex: latex.length ? latex.join(' + ') : '0',
  }
}

// ───────────────────────── 门电路形式 ─────────────────────────

export function gateForms(spec: BoolSpec): GateForms {
  const { n, minterms, dontCares } = checkSpec(spec)
  const vars = spec.variables.slice()
  const sop = solve(spec, 'SOP')
  const pos = solve(spec, 'POS')
  const mset = new Set(minterms)
  const dcSet = new Set(dontCares)
  const zeros: number[] = []
  for (let m = 0; m < 1 << n; m++) if (!mset.has(m) && !dcSet.has(m)) zeros.push(m)
  const comp = solve({ variables: vars, minterms: zeros, dontCares }, 'SOP')

  // 与非-与非：F = ((T1)'(T2)')'；单文字项 L 直接写成 L'
  const nand = sop.solutions[0]
  let nandNand = { text: '0', latex: '0' }
  if (nand.length === 0) {
    nandNand = { text: '0', latex: '0' }
  } else if (nand.length === 1 && isAllDash(nand[0].mask)) {
    nandNand = { text: '1', latex: '1' }
  } else {
    const items = nand.map(imp => {
      if (imp.literals === 1) {
        const i = imp.mask.search(/[01]/)
        const neg = imp.mask[i] === '1'
        return { t: litOf(vars[i], neg, false), l: litOf(vars[i], neg, true) }
      }
      return { t: '(' + imp.text + ")'", l: '\\overline{' + imp.latex + '}' }
    })
    nandNand = {
      text: '(' + items.map(x => x.t).join('') + ")'",
      latex: '\\overline{' + items.map(x => x.l).join('') + '}',
    }
  }

  // 或非-或非：F = ((S1)'+(S2)')'；单文字和项 L 的补写成直接文字
  const nor = pos.solutions[0]
  let norNor = { text: '1', latex: '1' }
  if (nor.length === 0) {
    norNor = { text: '1', latex: '1' }
  } else if (nor.length === 1 && isAllDash(nor[0].mask)) {
    norNor = { text: '0', latex: '0' }
  } else {
    const items = nor.map(imp => {
      if (imp.literals === 1) {
        const i = imp.mask.search(/[01]/)
        // 和项文字在掩码为 '1' 时为反相，取补后恰好与掩码位相反
        const neg = imp.mask[i] === '0'
        return { t: litOf(vars[i], neg, false), l: litOf(vars[i], neg, true) }
      }
      return { t: imp.text + "'", l: '\\overline{' + imp.latex + '}' }
    })
    norNor = {
      text: '(' + items.map(x => x.t).join('+') + ")'",
      latex: '\\overline{' + items.map(x => x.l).join('+') + '}',
    }
  }

  // 与或非：F = (G)'，G 为补函数的最简 SOP
  const g = comp.solutions[0]
  let andOrInvert = { text: '1', latex: '1' }
  if (g.length === 0) {
    andOrInvert = { text: '1', latex: '1' }
  } else if (g.length === 1 && isAllDash(g[0].mask)) {
    andOrInvert = { text: '0', latex: '0' }
  } else {
    andOrInvert = {
      text: '(' + g.map(i => i.text).join('+') + ")'",
      latex: '\\overline{' + g.map(i => i.latex).join('+') + '}',
    }
  }

  return {
    nandNand: nandNand.text,
    nandNandLatex: nandNand.latex,
    norNor: norNor.text,
    norNorLatex: norNor.latex,
    andOrInvert: andOrInvert.text,
    andOrInvertLatex: andOrInvert.latex,
  }
}

// ───────────────────────── 等价比较 ─────────────────────────

export function equivalent(a: BoolSpec, b: BoolSpec): EquivalenceResult {
  checkSpec(a)
  checkSpec(b)
  const sameOrder =
    a.variables.length === b.variables.length && a.variables.every((v, i) => v === b.variables[i])
  const vars = sameOrder ? a.variables.slice() : [...new Set([...a.variables, ...b.variables])].sort()
  if (vars.length > MAX_VARS) {
    throw new DlogicInputError(`比较两个函数时变量并集最多 ${MAX_VARS} 个，当前为 ${vars.length} 个`)
  }
  const n = vars.length

  const lookup = (spec: BoolSpec): ((m: number) => 0 | 1 | 'X') => {
    const pos = spec.variables.map(v => vars.indexOf(v))
    const on = new Set(spec.minterms)
    const dc = new Set(spec.dontCares ?? [])
    const k = spec.variables.length
    return (m: number) => {
      let idx = 0
      for (let i = 0; i < k; i++) idx = (idx << 1) | bitOf(m, pos[i], n)
      return on.has(idx) ? 1 : dc.has(idx) ? 'X' : 0
    }
  }
  const va = lookup(a)
  const vb = lookup(b)

  for (let m = 0; m < 1 << n; m++) {
    const l = va(m)
    const r = vb(m)
    if (l === 'X' || r === 'X') continue
    if (l !== r) {
      const inputs: (0 | 1)[] = []
      for (let i = 0; i < n; i++) inputs.push(bitOf(m, i, n) as 0 | 1)
      return { equivalent: false, counterexample: { index: m, inputs, left: l, right: r } }
    }
  }
  return { equivalent: true }
}
