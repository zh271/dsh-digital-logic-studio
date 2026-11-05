// 同步时序状态机求解器：状态化简（隐含表 / 相容类）、状态编码评分、激励与输出函数综合、自启动检查与修正。
// 纯函数，不做 I/O，不依赖 DSH。组合部分的化简复用 solvers/bool.ts 的 minimize。
// 约定：编码的第 0 位为最高位；激励/输出函数的变量顺序为 [状态位（高→低）, 输入位（高→低）]；
// 摩尔型的输出函数只依赖状态位。
import { DlogicInputError } from '../shared/contracts.ts'
import type { Implicant } from '../shared/contracts.ts'
import type {
  AdjacencyPair,
  AssignResult,
  EncodingKind,
  EncodingScore,
  ExcitationRow,
  FfType,
  FsmSpec,
  FsmType,
  ImplicationPair,
  ReduceResult,
  SelfStartCheck,
  SelfStartResult,
  SynthFunction,
  SynthesizeResult,
} from '../shared/fsm.ts'
import { minimize } from './bool.ts'

const MAX_STATES = 16
const MAX_COMPAT_STATES = 8
const MAX_BITS = 2
const MAX_VARS = 6

// ───────────────────────── 规范校验与内部状态表 ─────────────────────────

/** 内部状态表：状态用下标表示；next 为 -1 表示次态未给定；out 每位为 '0' | '1' | 'x'。 */
export interface Table {
  type: FsmType
  states: string[]
  inputs: number
  outputs: number
  next: number[][]
  out: string[][]
}

function isUnspecifiedName(s: string): boolean {
  return s === 'x' || s === 'X' || s === '-' || s === ''
}

function normPattern(s: string): string {
  return s.replace(/X/g, 'x').replace(/-/g, 'x')
}

function bitsOf(v: number, width: number): string {
  return v.toString(2).padStart(width, '0')
}

function matchesPattern(pattern: string, combo: number, m: number): boolean {
  for (let i = 0; i < m; i++) {
    const ch = pattern[i]
    if (ch === 'x') continue
    const bit = (combo >> (m - 1 - i)) & 1
    if (Number(ch) !== bit) return false
  }
  return true
}

function mergeOut(a: string, b: string): string {
  let r = ''
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === 'x') r += y
    else if (y === 'x' || y === x) r += x
    else throw new DlogicInputError(`同一转移的输出相互矛盾：${a} 与 ${b}。`)
  }
  return r
}

function hamming(a: string, b: string): number {
  let d = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++
  return d
}

/** 校验规范；不合法时抛出 DlogicInputError。to 写 'x' 表示次态未给定，只给输出。 */
export function validateSpec(spec: FsmSpec): void {
  if (spec.type !== 'mealy' && spec.type !== 'moore') throw new DlogicInputError('状态机类型须为 mealy（米利型）或 moore（摩尔型）。')
  if (!Array.isArray(spec.states) || spec.states.length === 0) throw new DlogicInputError('状态列表不能为空。')
  if (spec.states.length > MAX_STATES) {
    throw new DlogicInputError(`状态数最多 ${MAX_STATES} 个，当前为 ${spec.states.length} 个。`)
  }
  const seen = new Set<string>()
  for (const s of spec.states) {
    if (typeof s !== 'string' || s.trim() === '') throw new DlogicInputError('状态名不能为空。')
    if (isUnspecifiedName(s)) throw new DlogicInputError(`状态名不能为“${s}”（该写法表示未给定）。`)
    if (seen.has(s)) throw new DlogicInputError(`状态名重复：${s}`)
    seen.add(s)
  }
  if (!Number.isInteger(spec.inputs) || spec.inputs < 1 || spec.inputs > MAX_BITS) {
    throw new DlogicInputError('输入位数须为 1～2。')
  }
  if (!Number.isInteger(spec.outputs) || spec.outputs < 1 || spec.outputs > MAX_BITS) {
    throw new DlogicInputError('输出位数须为 1～2。')
  }
  if (!Array.isArray(spec.transitions)) throw new DlogicInputError('transitions 必须是数组。')
  for (const t of spec.transitions) {
    if (!seen.has(t.from)) throw new DlogicInputError(`转移的现态“${t.from}”不在状态列表中。`)
    if (!isUnspecifiedName(t.to) && !seen.has(t.to)) throw new DlogicInputError(`转移的次态“${t.to}”不在状态列表中。`)
    if (typeof t.input !== 'string' || !/^[01xX-]+$/.test(t.input) || t.input.length !== spec.inputs) {
      throw new DlogicInputError(`输入“${String(t.input)}”须为 ${spec.inputs} 位的 0/1/x 串。`)
    }
    if (typeof t.output !== 'string' || !/^[01xX-]+$/.test(t.output) || t.output.length !== spec.outputs) {
      throw new DlogicInputError(`输出“${String(t.output)}”须为 ${spec.outputs} 位的 0/1/x 串。`)
    }
  }
}

/** 由规范生成内部状态表。摩尔型的输出由现态决定，因此对所有输入组合取同一值。 */
export function buildTable(spec: FsmSpec): Table {
  validateSpec(spec)
  const n = spec.states.length
  const m = spec.inputs
  const o = spec.outputs
  const combos = 1 << m
  const idx = new Map<string, number>(spec.states.map((s, i) => [s, i]))
  const next: number[][] = Array.from({ length: n }, () => new Array<number>(combos).fill(-1))
  const out: string[][] = Array.from({ length: n }, () => new Array<string>(combos).fill('x'.repeat(o)))
  const stateOut: string[] = new Array<string>(n).fill('x'.repeat(o))
  for (const t of spec.transitions) {
    const s = idx.get(t.from) as number
    const d = isUnspecifiedName(t.to) ? -1 : (idx.get(t.to) as number)
    const pattern = normPattern(t.input)
    const outPat = normPattern(t.output)
    for (let c = 0; c < combos; c++) {
      if (!matchesPattern(pattern, c, m)) continue
      if (d >= 0) {
        if (next[s][c] >= 0 && next[s][c] !== d) {
          throw new DlogicInputError(`状态 ${t.from} 在输入 ${bitsOf(c, m)} 下的次态不唯一。`)
        }
        next[s][c] = d
      }
      if (spec.type === 'mealy') out[s][c] = mergeOut(out[s][c], outPat)
    }
    if (spec.type === 'moore') stateOut[s] = mergeOut(stateOut[s], outPat)
  }
  if (spec.type === 'moore') {
    for (let s = 0; s < n; s++) for (let c = 0; c < combos; c++) out[s][c] = stateOut[s]
  }
  return { type: spec.type, states: spec.states.slice(), inputs: m, outputs: o, next, out }
}

function isComplete(T: Table): boolean {
  for (let s = 0; s < T.states.length; s++) {
    for (let c = 0; c < 1 << T.inputs; c++) {
      if (T.next[s][c] < 0 || T.out[s][c].includes('x')) return false
    }
  }
  return true
}

interface RawRow {
  from: number
  /** 次态在化简后状态表中的下标；null 表示未给定。 */
  to: number | null
  combo: number
  output: string
}

/** 把化简后的行写回规范（状态名由 names 给出）。 */
function rowsToSpec(T: Table, names: string[], rows: RawRow[]): FsmSpec {
  return {
    type: T.type,
    states: names,
    inputs: T.inputs,
    outputs: T.outputs,
    transitions: rows.map(r => ({
      from: names[r.from],
      input: bitsOf(r.combo, T.inputs),
      to: r.to === null ? 'x' : names[r.to],
      output: r.output,
    })),
  }
}

// ───────────────────────── 状态化简 ─────────────────────────

function pairKey(n: number, i: number, j: number): number {
  return i < j ? i * n + j : j * n + i
}

interface PairInfo {
  i: number
  j: number
  status: 'pending' | 'equivalent' | 'distinct'
  reason: string
  implied: { i: number; j: number; combo: number }[]
}

/** 完全给定：隐含表法。 */
function reduceComplete(T: Table): ReduceResult {
  const n = T.states.length
  const combos = 1 << T.inputs
  const infos = new Map<number, PairInfo>()
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let diffCombo = -1
      for (let c = 0; c < combos && diffCombo < 0; c++) {
        if (T.out[i][c] !== T.out[j][c]) diffCombo = c
      }
      const info: PairInfo = { i, j, status: 'pending', reason: '', implied: [] }
      if (diffCombo >= 0) {
        info.status = 'distinct'
        info.reason = `输入 ${bitsOf(diffCombo, T.inputs)} 下输出不同`
      } else {
        for (let c = 0; c < combos; c++) {
          const a = T.next[i][c]
          const b = T.next[j][c]
          if (a !== b) info.implied.push({ i: a, j: b, combo: c })
        }
      }
      infos.set(pairKey(n, i, j), info)
    }
  }
  // 逐轮标记：某对的次态对已不等价，则该对也不等价
  let changed = true
  while (changed) {
    const marks: PairInfo[] = []
    for (const info of infos.values()) {
      if (info.status !== 'pending') continue
      const hit = info.implied.find(q => infos.get(pairKey(n, q.i, q.j))?.status === 'distinct')
      if (hit) {
        info.reason = `次态对 (${T.states[hit.i]}, ${T.states[hit.j]}) 不等价（输入 ${bitsOf(hit.combo, T.inputs)}）`
        marks.push(info)
      }
    }
    for (const info of marks) info.status = 'distinct'
    changed = marks.length > 0
  }
  // 剩下未标记的对即等价；用并查集求等价类
  const parent = Array.from({ length: n }, (_, k) => k)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const implication: ImplicationPair[] = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const info = infos.get(pairKey(n, i, j)) as PairInfo
      if (info.status === 'pending') {
        info.status = 'equivalent'
        info.reason = info.implied.length === 0 ? '输出相同且次态相同' : '输出相同，且各次态对均等价'
        parent[find(i)] = find(j)
      }
      implication.push({
        a: T.states[i],
        b: T.states[j],
        status: info.status === 'equivalent' ? 'equivalent' : 'distinct',
        reason: info.reason,
        implied: info.implied.map(q => ({ a: T.states[q.i], b: T.states[q.j], input: bitsOf(q.combo, T.inputs) })),
      })
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)?.push(i)
  }
  const classes = [...groups.values()].sort((x, y) => x[0] - y[0])
  const classOf = new Array<number>(n).fill(-1)
  classes.forEach((cls, k) => cls.forEach(i => (classOf[i] = k)))
  const names = classes.map(cls => T.states[cls[0]])
  const rows: RawRow[] = []
  classes.forEach((cls, k) => {
    const rep = cls[0]
    for (let c = 0; c < combos; c++) {
      rows.push({ from: k, to: classOf[T.next[rep][c]], combo: c, output: T.out[rep][c] })
    }
  })
  return {
    complete: true,
    method: 'implication',
    implication,
    classes: classes.map(cls => cls.map(i => T.states[i])),
    stateMap: T.states.map((s, i) => ({ state: s, groups: [names[classOf[i]]] })),
    reduced: rowsToSpec(T, names, rows),
    reducedCount: classes.length,
  }
}

/** 最大团（Bron–Kerbosch）。adj 为不含自环的邻接矩阵。 */
function maximalCliques(n: number, adj: boolean[][]): number[][] {
  const result: number[][] = []
  const expand = (R: number[], P0: number[], X0: number[]): void => {
    if (P0.length === 0 && X0.length === 0) {
      result.push(R.slice().sort((a, b) => a - b))
      return
    }
    let P = P0.slice()
    const X = X0.slice()
    for (const v of P0) {
      expand([...R, v], P.filter(u => adj[v][u]), X.filter(u => adj[v][u]))
      P = P.filter(u => u !== v)
      X.push(v)
    }
  }
  expand([], Array.from({ length: n }, (_, k) => k), [])
  return result
}

/** 不完全给定：相容类、最大相容类与最小闭覆盖。 */
function reduceIncomplete(T: Table): ReduceResult {
  const n = T.states.length
  if (n > MAX_COMPAT_STATES) {
    throw new DlogicInputError(`不完全给定的状态化简最多支持 ${MAX_COMPAT_STATES} 个状态，当前为 ${n} 个。`)
  }
  const combos = 1 << T.inputs
  const incompat: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  const outConflict = (i: number, j: number): boolean => {
    for (let c = 0; c < combos; c++) {
      for (let b = 0; b < T.outputs; b++) {
        const x = T.out[i][c][b]
        const y = T.out[j][c][b]
        if (x !== 'x' && y !== 'x' && x !== y) return true
      }
    }
    return false
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (outConflict(i, j)) incompat[i][j] = incompat[j][i] = true
    }
  }
  let changed = true
  while (changed) {
    changed = false
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (incompat[i][j]) continue
        for (let c = 0; c < combos; c++) {
          const a = T.next[i][c]
          const b = T.next[j][c]
          if (a >= 0 && b >= 0 && a !== b && incompat[a][b]) {
            incompat[i][j] = incompat[j][i] = true
            changed = true
            break
          }
        }
      }
    }
  }
  const adj = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i !== j && !incompat[i][j]))
  const cliques = maximalCliques(n, adj)
  // 每个相容类在各输入组合下的蕴含集合（次态集合）
  const implied: number[][][] = cliques.map(cl => {
    const sets: number[][] = []
    for (let c = 0; c < combos; c++) {
      const set = new Set<number>()
      for (const i of cl) if (T.next[i][c] >= 0) set.add(T.next[i][c])
      sets.push([...set].sort((a, b) => a - b))
    }
    return sets
  })
  const contains = (big: number[], small: number[]): boolean => small.every(v => big.includes(v))
  const isClosedCover = (F: number[]): boolean =>
    F.every(ci => implied[ci].every(S => S.length === 0 || F.some(di => contains(cliques[di], S))))
  const coversAll = (F: number[]): boolean => {
    const seen = new Set<number>()
    for (const ci of F) for (const s of cliques[ci]) seen.add(s)
    return seen.size === n
  }
  // 按类个数从少到多搜索第一个闭覆盖，即最小闭覆盖
  let cover: number[] = []
  const search = (start: number, k: number, picked: number[]): boolean => {
    if (picked.length === k) {
      if (coversAll(picked) && isClosedCover(picked)) {
        cover = picked.slice()
        return true
      }
      return false
    }
    for (let ci = start; ci < cliques.length; ci++) {
      if (search(ci + 1, k, [...picked, ci])) return true
    }
    return false
  }
  for (let k = 1; k <= cliques.length && cover.length === 0; k++) search(0, k, [])
  if (cover.length === 0) throw new DlogicInputError('未能求得闭覆盖。')
  cover.sort((a, b) => a - b)
  const coverSets = cover.map(ci => cliques[ci])
  const nameOf = (cls: number[]): string =>
    cls.length === 1 ? T.states[cls[0]] : `{${cls.map(i => T.states[i]).join(',')}}`
  const names = coverSets.map(nameOf)
  const rows: RawRow[] = []
  cover.forEach((ci, k) => {
    for (let c = 0; c < combos; c++) {
      const S = implied[ci][c]
      const dest = S.length === 0 ? null : coverSets.findIndex(cls => contains(cls, S))
      const outs: string[] = []
      for (let b = 0; b < T.outputs; b++) {
        const vals = cliques[ci].map(i => T.out[i][c][b])
        outs.push(vals.includes('1') ? '1' : vals.includes('0') ? '0' : 'x')
      }
      const output = outs.join('')
      if (dest === null && output.split('').every(ch => ch === 'x')) continue
      rows.push({ from: k, to: dest, combo: c, output })
    }
  })
  return {
    complete: false,
    method: 'compatible',
    classes: cliques.map(cl => cl.map(i => T.states[i])),
    cover: coverSets.map(cls => cls.map(i => T.states[i])),
    stateMap: T.states.map((s, i) => ({
      state: s,
      groups: coverSets.flatMap((cls, k) => (cls.includes(i) ? [names[k]] : [])),
    })),
    reduced: rowsToSpec(T, names, rows),
    reducedCount: coverSets.length,
  }
}

/** 状态化简入口：完全给定用隐含表，不完全给定用相容类与最小闭覆盖。 */
export function reduceFsm(spec: FsmSpec): ReduceResult {
  const T = buildTable(spec)
  return isComplete(T) ? reduceComplete(T) : reduceIncomplete(T)
}

// ───────────────────────── 状态编码 ─────────────────────────

/**
 * 相邻状态对（用于评分）：
 * 规则 1：同一现态在不同输入下的两个次态应相邻；
 * 规则 2：同一输入下有相同次态的两个现态应相邻。
 */
export function adjacencyPairs(T: Table): AdjacencyPair[] {
  const n = T.states.length
  const combos = 1 << T.inputs
  const rules = new Map<string, { i: number; j: number; rules: Set<number> }>()
  const add = (i: number, j: number, rule: number): void => {
    if (i < 0 || j < 0 || i === j) return
    const a = Math.min(i, j)
    const b = Math.max(i, j)
    const key = `${a},${b}`
    if (!rules.has(key)) rules.set(key, { i: a, j: b, rules: new Set<number>() })
    rules.get(key)?.rules.add(rule)
  }
  for (let s = 0; s < n; s++) {
    for (let c1 = 0; c1 < combos; c1++) {
      for (let c2 = c1 + 1; c2 < combos; c2++) add(T.next[s][c1], T.next[s][c2], 1)
    }
  }
  for (let c = 0; c < combos; c++) {
    for (let s1 = 0; s1 < n; s1++) {
      for (let s2 = s1 + 1; s2 < n; s2++) {
        const d = T.next[s1][c]
        if (d >= 0 && d === T.next[s2][c]) add(s1, s2, 2)
      }
    }
  }
  return [...rules.values()]
    .sort((x, y) => x.i - y.i || x.j - y.j)
    .map(p => ({ a: T.states[p.i], b: T.states[p.j], rules: [...p.rules].sort((x, y) => x - y) }))
}

function bitsFor(n: number): number {
  let k = 1
  while (1 << k < n) k++
  return k
}

/** 三种标准编码，按状态在规范中的顺序分配。 */
function standardCodes(n: number, kind: EncodingKind): string[] {
  if (kind === 'onehot') return Array.from({ length: n }, (_, i) => '0'.repeat(i) + '1' + '0'.repeat(n - 1 - i))
  const k = bitsFor(n)
  if (kind === 'binary') return Array.from({ length: n }, (_, i) => bitsOf(i, k))
  return Array.from({ length: n }, (_, i) => bitsOf(i ^ (i >> 1), k))
}

/** 校验自定义编码：每个状态一条、等长、0/1 串、互不相同。 */
function customCodes(T: Table, custom: Record<string, string>): string[] {
  const codes: string[] = []
  for (const s of T.states) {
    const code = custom[s]
    if (typeof code !== 'string' || !/^[01]+$/.test(code)) throw new DlogicInputError(`状态 ${s} 的编码须为 0/1 串。`)
    codes.push(code)
  }
  const width = codes[0].length
  if (codes.some(c => c.length !== width)) throw new DlogicInputError('自定义编码的位数必须相同。')
  if (new Set(codes).size !== codes.length) throw new DlogicInputError('自定义编码互不相同。')
  return codes
}

/** 状态编码评分：二进制、格雷、独热三种标准编码，外加可选的自定义编码。 */
export function assignStates(spec: FsmSpec, custom?: Record<string, string>): AssignResult {
  const T = buildTable(spec)
  const pairs = adjacencyPairs(T)
  const idxOf = new Map(T.states.map((s, i) => [s, i]))
  const make = (kind: EncodingScore['kind'], codes: string[]): EncodingScore => {
    let total = 0
    let satisfied = 0
    for (const p of pairs) {
      const d = hamming(codes[idxOf.get(p.a) as number], codes[idxOf.get(p.b) as number])
      total += d
      if (d === 1) satisfied++
    }
    return {
      kind,
      bits: codes[0].length,
      codes: T.states.map((state, i) => ({ state, code: codes[i] })),
      score: total,
      satisfied,
      total: pairs.length,
    }
  }
  const encodings: EncodingScore[] = [
    make('binary', standardCodes(T.states.length, 'binary')),
    make('gray', standardCodes(T.states.length, 'gray')),
    make('onehot', standardCodes(T.states.length, 'onehot')),
  ]
  if (custom) encodings.push(make('custom', customCodes(T, custom)))
  let best = encodings[0]
  for (const e of encodings) if (e.score < best.score) best = e
  return { pairs, encodings, best: best.kind }
}

// ───────────────────────── 激励与输出函数综合 ─────────────────────────

interface Core {
  T: Table
  ff: FfType
  kind: EncodingKind | 'custom'
  k: number
  codes: string[]
  /** 编码值（十进制）→ 状态下标。 */
  stateOfCode: Map<number, number>
  stateBits: string[]
  inputNames: string[]
  outputNames: string[]
  /** 每个状态位对应的触发器输入函数名：D/T 为 1 个，JK 为 [J, K]。 */
  ffNames: string[][]
  excitationNames: string[]
}

function resolveCodes(T: Table, encoding: EncodingKind | 'custom', custom?: Record<string, string>): { kind: EncodingKind | 'custom'; codes: string[] } {
  if (encoding === 'custom') {
    if (!custom) throw new DlogicInputError('选择自定义编码时必须提供 codes。')
    return { kind: 'custom', codes: customCodes(T, custom) }
  }
  return { kind: encoding, codes: standardCodes(T.states.length, encoding) }
}

function makeCore(T: Table, ff: FfType, kind: EncodingKind | 'custom', codes: string[]): Core {
  const k = codes[0].length
  if (k + T.inputs > MAX_VARS) {
    throw new DlogicInputError(
      `状态寄存器 ${k} 位加输入 ${T.inputs} 位共 ${k + T.inputs} 个变量，超过化简上限 ${MAX_VARS} 个；请减少状态数或改用二进制/格雷编码。`,
    )
  }
  const stateBits = Array.from({ length: k }, (_, p) => (k === 1 ? 'Q' : `Q${k - 1 - p}`))
  const inputNames = Array.from({ length: T.inputs }, (_, t) => (T.inputs === 1 ? 'X' : `X${T.inputs - 1 - t}`))
  const outputNames = Array.from({ length: T.outputs }, (_, j) => (T.outputs === 1 ? 'Z' : `Z${T.outputs - 1 - j}`))
  const suffix = (p: number): string => stateBits[p].slice(1)
  const ffNames: string[][] = stateBits.map((_, p) => {
    if (ff === 'D') return [`D${suffix(p)}`]
    if (ff === 'T') return [`T${suffix(p)}`]
    return [`J${suffix(p)}`, `K${suffix(p)}`]
  })
  const stateOfCode = new Map<number, number>()
  codes.forEach((c, i) => stateOfCode.set(parseInt(c, 2), i))
  return {
    T,
    ff,
    kind,
    k,
    codes,
    stateOfCode,
    stateBits,
    inputNames,
    outputNames,
    ffNames,
    excitationNames: ffNames.flat(),
  }
}

/** 一位状态的触发器输入取值。cur 为现态位，nb 为次态位（null 表示次态未给定）。返回 [第一输入, K]。 */
function excitationBit(ff: FfType, cur: string, nb: string | null): [string, string] {
  if (nb === null) return ['x', 'x']
  if (ff === 'D') return [nb, 'x']
  if (ff === 'T') return [cur === nb ? '0' : '1', 'x']
  if (cur === '0') return nb === '0' ? ['0', 'x'] : ['1', 'x']
  return nb === '0' ? ['x', '1'] : ['x', '0']
}

/** 生成激励表。overrides：无效编码（十进制）→ 被改写的目标状态下标（用于自启动修正）。行序：编码值为高位，输入为低位。 */
function buildRows(core: Core, overrides: Map<number, number>): ExcitationRow[] {
  const { T, k, codes } = core
  const m = T.inputs
  const o = T.outputs
  const combos = 1 << m
  const rows: ExcitationRow[] = []
  for (let cv = 0; cv < 1 << k; cv++) {
    const s = core.stateOfCode.get(cv)
    const code = bitsOf(cv, k)
    for (let c = 0; c < combos; c++) {
      let nextState = -1
      let output = 'x'.repeat(o)
      if (s !== undefined) {
        nextState = T.next[s][c]
        output = T.out[s][c]
      } else if (overrides.has(cv)) {
        nextState = overrides.get(cv) as number
      }
      const nextCode = nextState >= 0 ? codes[nextState] : null
      const excitation: Record<string, string> = {}
      for (let p = 0; p < k; p++) {
        const [first, second] = excitationBit(core.ff, code[p], nextCode === null ? null : nextCode[p])
        excitation[core.ffNames[p][0]] = first
        if (core.ff === 'JK') excitation[core.ffNames[p][1]] = second
      }
      rows.push({
        code,
        state: s === undefined ? null : T.states[s],
        input: bitsOf(c, m),
        next: nextState >= 0 ? T.states[nextState] : null,
        nextCode,
        output,
        excitation,
      })
    }
  }
  return rows
}

interface Solved {
  implicants: Map<string, Implicant[]>
  functions: SynthFunction[]
}

/** 对每个函数做 SOP 化简（复用 bool.minimize）。摩尔型输出只依赖状态位。 */
function solveFunctions(core: Core, rows: ExcitationRow[]): Solved {
  const combos = 1 << core.T.inputs
  const implicants = new Map<string, Implicant[]>()
  const functions: SynthFunction[] = []
  const solve = (name: string, role: 'excitation' | 'output', variables: string[], minterms: number[], dontCares: number[]): void => {
    const r = minimize({ variables, minterms, dontCares }, 'SOP')
    const first = r.solutions[0] ?? []
    implicants.set(name, first)
    functions.push({
      name,
      role,
      variables,
      minterms,
      dontCares,
      text: r.texts[0] ?? '0',
      texts: r.texts,
      latex: r.latex,
      cost: r.cost,
      implicants: first,
    })
  }
  const vars = [...core.stateBits, ...core.inputNames]
  for (const name of core.excitationNames) {
    const minterms: number[] = []
    const dontCares: number[] = []
    rows.forEach((row, idx) => {
      const v = row.excitation[name]
      if (v === '1') minterms.push(idx)
      else if (v === 'x') dontCares.push(idx)
    })
    solve(name, 'excitation', vars, minterms, dontCares)
  }
  const T = core.T
  for (let j = 0; j < T.outputs; j++) {
    const minterms: number[] = []
    const dontCares: number[] = []
    if (T.type === 'mealy') {
      rows.forEach((row, idx) => {
        const v = row.output[j]
        if (v === '1') minterms.push(idx)
        else if (v === 'x') dontCares.push(idx)
      })
      solve(core.outputNames[j], 'output', vars, minterms, dontCares)
    } else {
      for (let cv = 0; cv < 1 << core.k; cv++) {
        const v = rows[cv * combos].output[j]
        if (v === '1') minterms.push(cv)
        else if (v === 'x') dontCares.push(cv)
      }
      solve(core.outputNames[j], 'output', core.stateBits, minterms, dontCares)
    }
  }
  return { implicants, functions }
}

/** 在一组变量取值下求蕴涵项和（SOP）的值。bits 的顺序与变量顺序一致。 */
export function evalCover(imps: Implicant[], bits: number[]): 0 | 1 {
  const hit = imps.some(imp => {
    for (let j = 0; j < imp.mask.length; j++) {
      const ch = imp.mask[j]
      if (ch !== '-' && Number(ch) !== bits[j]) return false
    }
    return true
  })
  return hit ? 1 : 0
}

interface Run {
  core: Core
  solved: Solved
  result: SynthesizeResult
}

function runSynth(
  T: Table,
  ff: FfType,
  encoding: EncodingKind | 'custom',
  custom: Record<string, string> | undefined,
  overrides: Map<number, number>,
): Run {
  const { kind, codes } = resolveCodes(T, encoding, custom)
  const core = makeCore(T, ff, kind, codes)
  const rows = buildRows(core, overrides)
  const solved = solveFunctions(core, rows)
  const result: SynthesizeResult = {
    ff,
    encoding: kind,
    codes: T.states.map((state, i) => ({ state, code: codes[i] })),
    stateBits: core.stateBits,
    inputNames: core.inputNames,
    outputNames: core.outputNames,
    excitationNames: core.excitationNames,
    table: rows,
    functions: solved.functions,
  }
  return { core, solved, result }
}

function checkFf(ff: string): asserts ff is FfType {
  if (ff !== 'D' && ff !== 'JK' && ff !== 'T') throw new DlogicInputError('触发器类型须为 D、JK 或 T。')
}

/** 综合：选定触发器与编码，生成激励表，并化简各激励函数与输出函数。 */
export function synthesize(spec: FsmSpec, ff: FfType, encoding: EncodingKind | 'custom', custom?: Record<string, string>): SynthesizeResult {
  checkFf(ff)
  const T = buildTable(spec)
  return runSynth(T, ff, encoding, custom, new Map()).result
}

// ───────────────────────── 自启动 ─────────────────────────

/** 按化简后的函数计算一步之后的编码：D: Q+=D；T: Q+=Q⊕T；JK: Q+=JQ'+K'Q。 */
function nextCodeValue(run: Run, cv: number, c: number): number {
  const { core, solved } = run
  const k = core.k
  const m = core.T.inputs
  const bits: number[] = []
  for (let j = 0; j < k; j++) bits.push((cv >> (k - 1 - j)) & 1)
  for (let t = 0; t < m; t++) bits.push((c >> (m - 1 - t)) & 1)
  const evalName = (name: string): number => evalCover(solved.implicants.get(name) ?? [], bits)
  let nv = 0
  for (let p = 0; p < k; p++) {
    const cur = (cv >> (k - 1 - p)) & 1
    let nb: number
    if (core.ff === 'D') nb = evalName(core.ffNames[p][0])
    else if (core.ff === 'T') nb = cur ^ evalName(core.ffNames[p][0])
    else {
      const J = evalName(core.ffNames[p][0])
      const K = evalName(core.ffNames[p][1])
      nb = (J === 1 && cur === 0) || (K === 0 && cur === 1) ? 1 : 0
    }
    nv |= nb << (k - 1 - p)
  }
  return nv
}

/** 对每个无效编码、每个固定输入组合，沿次态走，检查能否进入有效编码。 */
function checkSelfStart(run: Run): SelfStartCheck[] {
  const { core } = run
  const k = core.k
  const m = core.T.inputs
  const checks: SelfStartCheck[] = []
  for (let cv = 0; cv < 1 << k; cv++) {
    if (core.stateOfCode.has(cv)) continue
    for (let c = 0; c < 1 << m; c++) {
      const trace = [bitsOf(cv, k)]
      const seen = new Set<number>([cv])
      let cur = cv
      let ok = false
      for (;;) {
        const nv = nextCodeValue(run, cur, c)
        trace.push(bitsOf(nv, k))
        if (core.stateOfCode.has(nv)) {
          ok = true
          break
        }
        if (seen.has(nv)) break
        seen.add(nv)
        cur = nv
      }
      checks.push({ code: bitsOf(cv, k), input: bitsOf(c, m), trace, ok })
    }
  }
  return checks
}

/** 与无效编码汉明距离最近的有效状态（并列取序号最小者）。 */
function nearestState(core: Core, cv: number): number {
  let best = 0
  let bestD = Infinity
  core.codes.forEach((code, i) => {
    const d = hamming(bitsOf(cv, core.k), code)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/**
 * 自启动检查与修正。原函数满足则原样返回；否则先只改写失败的无效编码的次态（改为最近的有效状态），
 * 重新化简并复查；仍不满足则改写全部无效编码。
 */
export function selfStart(spec: FsmSpec, ff: FfType, encoding: EncodingKind | 'custom', custom?: Record<string, string>): SelfStartResult {
  checkFf(ff)
  const T = buildTable(spec)
  const base = runSynth(T, ff, encoding, custom, new Map())
  const checks = checkSelfStart(base)
  if (checks.every(ch => ch.ok)) {
    return { selfStarting: true, checks, fixed: false, rewritten: [], after: checks, synthesis: base.result }
  }
  const unused: number[] = []
  for (let cv = 0; cv < 1 << base.core.k; cv++) if (!base.core.stateOfCode.has(cv)) unused.push(cv)
  const failing = [...new Set(checks.filter(ch => !ch.ok).map(ch => parseInt(ch.code, 2)))].sort((a, b) => a - b)
  const overridesFor = (list: number[]): Map<number, number> => new Map(list.map(cv => [cv, nearestState(base.core, cv)]))
  let used = failing
  let run = runSynth(T, ff, encoding, custom, overridesFor(used))
  let after = checkSelfStart(run)
  if (!after.every(ch => ch.ok)) {
    used = unused
    run = runSynth(T, ff, encoding, custom, overridesFor(used))
    after = checkSelfStart(run)
  }
  return {
    selfStarting: false,
    checks,
    fixed: after.every(ch => ch.ok),
    rewritten: used.map(cv => ({ code: bitsOf(cv, base.core.k), to: T.states[nearestState(base.core, cv)] })),
    after,
    synthesis: run.result,
  }
}
