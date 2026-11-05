// 进制转换求解器：纯函数，不依赖 DSH。
// 全程用 BigInt 有理数运算，避免浮点误差。

import { DlogicInputError } from '../shared/contracts.ts'

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MAX_INPUT_LENGTH = 64
const MAX_PRECISION = 32

export type ConvertMethod = 'identity' | 'grouping' | 'expansion-division'

export interface DivisionRow {
  dividend: string
  quotient: string
  remainder: number
  digit: string
}

export interface MultiplicationRow {
  value: string
  product: string
  digit: string
}

/** 分步过程的判别联合，前端按 kind 渲染。 */
export type NumStep =
  | { kind: 'weighted-expansion'; text: string; terms: string[]; result: string }
  | { kind: 'expand-bits'; text: string; binary: string }
  | { kind: 'group-bits'; text: string; intGroups: string[]; fracGroups: string[] }
  | { kind: 'int-division'; text: string; rows: DivisionRow[] }
  | { kind: 'frac-multiplication'; text: string; rows: MultiplicationRow[] }

export interface ConvertInput {
  value: string
  from: number
  to: number
  precision?: number
}

export interface ConvertResult {
  input: { value: string; from: number; to: number; precision: number }
  result: string
  decimal: string
  exact: boolean
  method: ConvertMethod
  steps: NumStep[]
}

interface Rational {
  n: bigint
  d: bigint
}

interface Parsed {
  negative: boolean
  intDigits: number[]
  fracDigits: number[]
}

interface Outcome {
  intOut: string
  fracOut: string
  exact: boolean
  steps: NumStep[]
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b !== 0n) [a, b] = [b, a % b]
  return a
}

/** 化简分数 n/d（d > 0）。 */
function reduce(n: bigint, d: bigint): Rational {
  const g = gcd(n, d) || 1n
  return { n: n / g, d: d / g }
}

/** 把非负有理数写成十进制字符串，最多保留 digits 位小数，能除尽则不补零。 */
export function rationalToDecimal({ n, d }: Rational, digits = 12): string {
  const int = n / d
  let rem = n % d
  if (rem === 0n) return int.toString()
  let frac = ''
  for (let i = 0; i < digits && rem !== 0n; i++) {
    rem *= 10n
    frac += (rem / d).toString()
    rem %= d
  }
  return `${int}.${frac}${rem === 0n ? '' : '…'}`
}

function digitValue(ch: string, base: number): number {
  const v = DIGITS.indexOf(ch.toUpperCase())
  if (v < 0 || v >= base) throw new DlogicInputError(`“${ch}”不是 ${base} 进制的合法数字`)
  return v
}

function checkBase(base: number, label: string): void {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new DlogicInputError(`${label}必须是 2～36 之间的整数`)
  }
}

/** 解析形如 "-1011.101" 的字符串，返回 { negative, intDigits, fracDigits }。 */
function parse(value: string, base: number): Parsed {
  const text = String(value).trim().replace(/_/g, '')
  if (text === '') throw new DlogicInputError('输入为空')
  if (text.length > MAX_INPUT_LENGTH) throw new DlogicInputError(`输入过长（上限 ${MAX_INPUT_LENGTH} 个字符）`)
  const negative = text.startsWith('-')
  const body = negative || text.startsWith('+') ? text.slice(1) : text
  const parts = body.split('.')
  if (parts.length > 2) throw new DlogicInputError('小数点只能出现一次')
  const [intPart, fracPart = ''] = parts
  if (intPart === '' && fracPart === '') throw new DlogicInputError('没有数字')
  const intDigits = [...(intPart || '0')].map(ch => digitValue(ch, base))
  const fracDigits = [...fracPart].map(ch => digitValue(ch, base))
  return { negative, intDigits, fracDigits }
}

/** 按权展开，得到精确有理数值（非负部分）。 */
function toRational(intDigits: number[], fracDigits: number[], base: number): { int: bigint; frac: Rational } {
  const b = BigInt(base)
  let int = 0n
  for (const v of intDigits) int = int * b + BigInt(v)
  let num = 0n
  let den = 1n
  for (const v of fracDigits) {
    num = num * b + BigInt(v)
    den *= b
  }
  return { int, frac: reduce(num, den) }
}

function powerOfTwo(base: number): number | null {
  const k = Math.log2(base)
  return Number.isInteger(k) ? k : null
}

/** 2/8/16 等 2 的幂进制之间：先展成二进制，再按目标位宽分组。 */
function convertByGrouping(parsed: Parsed, from: number, to: number): Outcome {
  const kf = powerOfTwo(from) as number
  const kt = powerOfTwo(to) as number
  const toBits = (v: number) => v.toString(2).padStart(kf, '0')
  const intBits = parsed.intDigits.map(toBits).join('').replace(/^0+(?=.)/, '')
  const fracBits = parsed.fracDigits.map(toBits).join('').replace(/0+$/, '')
  const intPad = (kt - (intBits.length % kt)) % kt
  const fracPad = (kt - (fracBits.length % kt)) % kt
  const intGrouped = '0'.repeat(intPad) + intBits
  const fracGrouped = fracBits + '0'.repeat(fracPad)
  const chunk = (s: string): string[] => s.match(new RegExp(`.{1,${kt}}`, 'g')) ?? []
  const intGroups = chunk(intGrouped)
  const fracGroups = chunk(fracGrouped)
  const intOut = intGroups.map(g => DIGITS[parseInt(g, 2)]).join('').replace(/^0+(?=.)/, '') || '0'
  const fracOut = fracGroups.map(g => DIGITS[parseInt(g, 2)]).join('').replace(/0+$/, '')
  const steps: NumStep[] = []
  // 源进制本身就是二进制时，不需要“展开”这一步；目标是二进制时，不需要“分组”这一步。
  if (kf > 1) {
    steps.push({
      kind: 'expand-bits',
      text: `每位${from}进制数字展开为 ${kf} 位二进制`,
      binary: fracBits ? `${intBits}.${fracBits}` : intBits,
    })
  }
  if (kt > 1) {
    steps.push({
      kind: 'group-bits',
      text: `从小数点向两侧每 ${kt} 位一组（整数部分在左侧补 0，小数部分在右侧补 0），每组换成一位${to}进制数字`,
      intGroups,
      fracGroups,
    })
  }
  return { intOut, fracOut, exact: true, steps }
}

/** 一般情况：整数部分除基取余，小数部分乘基取整。 */
function convertGeneral(rational: { int: bigint; frac: Rational }, to: number, precision: number): Outcome {
  const b = BigInt(to)
  const steps: NumStep[] = []
  // 整数部分：除基取余，余数逆序排列。
  // 整数部分为 0 时不展示除法步骤（“0 ÷ b = 0 余 0”没有教学意义）。
  const divisions: DivisionRow[] = []
  let q = rational.int
  while (q > 0n) {
    const next = q / b
    const r = Number(q % b)
    divisions.push({ dividend: q.toString(), quotient: next.toString(), remainder: r, digit: DIGITS[r] })
    q = next
  }
  const intOut = divisions.length > 0 ? divisions.map(s => s.digit).reverse().join('') : '0'
  if (divisions.length > 0) {
    steps.push({ kind: 'int-division', text: `整数部分除 ${to} 取余，余数从下往上读`, rows: divisions })
  }

  // 小数部分：乘基取整，整数位顺序排列。
  let { n, d } = rational.frac
  let fracOut = ''
  const multiplications: MultiplicationRow[] = []
  while (n !== 0n && fracOut.length < precision) {
    const product = n * b
    const digit = Number(product / d)
    const before = rationalToDecimal({ n, d })
    n = product % d
    multiplications.push({
      value: before,
      product: rationalToDecimal({ n: product, d }),
      digit: DIGITS[digit],
    })
    fracOut += DIGITS[digit]
  }
  const exact = n === 0n
  if (multiplications.length > 0) {
    steps.push({
      kind: 'frac-multiplication',
      text: `小数部分乘 ${to} 取整，整数位从上往下读${exact ? '' : `（保留 ${precision} 位，未除尽）`}`,
      rows: multiplications,
    })
  }
  return { intOut, fracOut, exact, steps }
}

/** 任意进制转换。 */
export function convertBase({ value, from, to, precision = 8 }: ConvertInput): ConvertResult {
  checkBase(from, '源进制')
  checkBase(to, '目标进制')
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_PRECISION) {
    throw new DlogicInputError(`精度必须是 1～${MAX_PRECISION} 之间的整数`)
  }
  const parsed = parse(value, from)
  const rational = toRational(parsed.intDigits, parsed.fracDigits, from)
  const decimal = rationalToDecimal({ n: rational.int * rational.frac.d + rational.frac.n, d: rational.frac.d })
  const steps: NumStep[] = []

  if (from !== 10 && !(powerOfTwo(from) && powerOfTwo(to))) {
    const digits = [
      ...parsed.intDigits.map((v, i, a) => ({ v, p: a.length - 1 - i })),
      ...parsed.fracDigits.map((v, i) => ({ v, p: -(i + 1) })),
    ]
    steps.push({
      kind: 'weighted-expansion',
      text: `按权展开求十进制值`,
      terms: digits.filter(t => t.v !== 0).map(t => `${t.v}×${from}^${t.p}`),
      result: decimal,
    })
  }

  let out: Outcome
  if (from === to) {
    out = {
      intOut: parsed.intDigits.map(v => DIGITS[v]).join('').replace(/^0+(?=.)/, '') || '0',
      fracOut: parsed.fracDigits.map(v => DIGITS[v]).join('').replace(/0+$/, ''),
      exact: true,
      steps: [],
    }
  } else if (powerOfTwo(from) && powerOfTwo(to)) {
    out = convertByGrouping(parsed, from, to)
  } else if (to === 10) {
    const [i, f = ''] = decimal.replace('…', '').split('.')
    out = { intOut: i, fracOut: f.slice(0, precision), exact: !decimal.endsWith('…') && f.length <= precision, steps: [] }
  } else {
    out = convertGeneral(rational, to, precision)
  }
  steps.push(...out.steps)

  const isZero = rational.int === 0n && rational.frac.n === 0n
  const sign = parsed.negative && !isZero ? '-' : ''
  const result = sign + out.intOut + (out.fracOut ? `.${out.fracOut}` : '')
  return {
    input: { value: String(value).trim(), from, to, precision },
    result,
    decimal: sign + decimal,
    exact: out.exact,
    method: from === to ? 'identity' : powerOfTwo(from) && powerOfTwo(to) ? 'grouping' : 'expansion-division',
    steps,
  }
}
