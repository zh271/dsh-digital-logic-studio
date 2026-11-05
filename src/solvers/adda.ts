// dlogic_adda 的求解器（纯函数，不做 I/O，不依赖 DSH）。
// 覆盖：D/A（权电阻、R-2R T 型、R-2R 倒 T 型）、逐次逼近、并行比较、双积分 A/D，以及量化与采样判断。
// 约定：位数 n 为 1～16；输入电压范围 [0, VREF]；量化单位 Δ；数值用 JS 数字计算，显示时由 fmtNum 取位，分数形式在结果中给出。
// 只使用可擦除的 TypeScript 语法。

import { DlogicInputError } from '../shared/contracts.ts'
import {
  fmtNum,
  fmtTime,
  type AddaOp,
  type DacBranch,
  type DacResult,
  type DacType,
  type DualSlopeResult,
  type FlashComparator,
  type FlashResult,
  type QuantMode,
  type QuantizeResult,
  type SamplingResult,
  type SarResult,
  type SarStep,
} from '../shared/adda.ts'

export const MAX_BITS = 16
export const ADDA_OPS: AddaOp[] = ['dac', 'adc_sar', 'adc_flash', 'adc_dual', 'quantize']
export const DAC_TYPES: DacType[] = ['weighted', 'r2r_t', 'r2r_inverted']
export const QUANT_MODES: QuantMode[] = ['truncate', 'round']

/** 并行比较器个数超过此值时，不逐个列出比较器（避免结果过大）。 */
export const FLASH_LIST_LIMIT = 127

const EPS = 1e-9

const DAC_NAME: Record<DacType, string> = {
  weighted: '权电阻型 DAC',
  r2r_t: 'R-2R T 型电阻网络 DAC',
  r2r_inverted: 'R-2R 倒 T 型电阻网络 DAC',
}

/** 求解结果：结果本体与需要提醒用户的注意事项。 */
export interface Solved<T> {
  result: T
  warnings: string[]
}

function solved<T>(result: T, warnings: string[] = []): Solved<T> {
  return { result, warnings }
}

// ───────────────────────── 参数检查 ─────────────────────────

export function checkBits(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) throw new DlogicInputError('位数 bits 必须为整数。')
  if (v < 1 || v > MAX_BITS) throw new DlogicInputError(`位数 bits 须在 1～${MAX_BITS} 之间，当前为 ${v}。`)
  return v
}

export function checkNumber(v: unknown, name: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DlogicInputError(`${name} 必须是有限的数字。`)
  return v
}

export function checkPositive(v: unknown, name: string): number {
  const x = checkNumber(v, name)
  if (x <= 0) throw new DlogicInputError(`${name} 必须大于 0，当前为 ${fmtNum(x)}。`)
  return x
}

function checkRange(vin: number, full: number): void {
  if (vin < 0 || vin > full) throw new DlogicInputError(`输入电压 ${fmtNum(vin)} V 超出量程 [0, ${fmtNum(full)}] V。`)
}

export function checkMode(v: unknown): QuantMode {
  if (v === undefined) return 'truncate'
  if (v === 'truncate' || v === 'round') return v
  throw new DlogicInputError(`量化方式 mode 只能是 truncate（舍尾）或 round（四舍五入），当前为 ${String(v)}。`)
}

function bitsText(v: number, n: number): string {
  return v.toString(2).padStart(n, '0')
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 非负整数 num / den 的既约分数文本。 */
function fractionText(num: number, den: number): string {
  if (num === 0) return '0'
  const g = gcd(num, den)
  const a = num / g
  const b = den / g
  return b === 1 ? String(a) : `${a}/${b}`
}

/** 第 e 级权的电阻写法：e = 0 为 R，否则为 2^e·R 的数值形式。 */
function resistorText(e: number): string {
  return e === 0 ? 'R' : `${2 ** e}R`
}

/** 量化单位 Δ。 */
export function quantDelta(n: number, full: number, mode: QuantMode): number {
  return mode === 'truncate' ? full / 2 ** n : (2 * full) / (2 ** (n + 1) - 1)
}

function quantDeltaFormula(n: number, mode: QuantMode, sym: string): string {
  return mode === 'truncate' ? `${sym}/2^${n}` : `2${sym}/(2^${n + 1}-1)`
}

/** 量化后的数字码：舍尾取 floor(Vin/Δ)，四舍五入取 floor(Vin/Δ + 1/2)，并限制在 [0, 2^n-1]。 */
function quantCode(vin: number, n: number, delta: number, mode: QuantMode): number {
  const raw = mode === 'truncate' ? Math.floor(vin / delta + EPS) : Math.floor(vin / delta + 0.5 + EPS)
  return Math.min(Math.max(raw, 0), 2 ** n - 1)
}

// ───────────────────────── D/A（dac） ─────────────────────────

export interface DacRequest {
  bits: number
  vref: number
  /** 十进制数字量；与 binary 二选一。 */
  code?: number
  /** 二进制数字量，长度须等于位数。 */
  binary?: string
  dacType: DacType
  /** Rf 与 R 之比。权电阻型默认 1/2（标准比例，理想输出 -VREF·D/2^n），倒 T 型默认 1。T 型忽略。 */
  rfRatio?: number
}

export function solveDac(req: DacRequest): Solved<DacResult> {
  const n = checkBits(req.bits)
  const vref = checkPositive(req.vref, 'vref')
  const max = 2 ** n - 1
  const dacType = req.dacType
  if (!DAC_TYPES.includes(dacType)) {
    throw new DlogicInputError(`未知的 DAC 类型：${String(dacType)}，可选 weighted（权电阻）、r2r_t（T 型）、r2r_inverted（倒 T 型）。`)
  }

  let d: number
  if (req.binary !== undefined) {
    if (typeof req.binary !== 'string' || !/^[01]+$/.test(req.binary)) throw new DlogicInputError('binary 只能由 0 和 1 组成。')
    if (req.binary.length !== n) throw new DlogicInputError(`binary 的长度 ${req.binary.length} 须等于位数 ${n}。`)
    d = parseInt(req.binary, 2)
  } else if (req.code !== undefined) {
    if (!Number.isInteger(req.code) || req.code < 0 || req.code > max) {
      throw new DlogicInputError(`数字量 code 须为 0～${max} 的整数，当前为 ${String(req.code)}。`)
    }
    d = req.code
  } else {
    throw new DlogicInputError('dac 需要提供 code（十进制整数）或 binary（二进制串）。')
  }

  const defaultRf = dacType === 'weighted' ? 0.5 : 1
  const rf = dacType === 'r2r_t' ? null : checkPositive(req.rfRatio ?? defaultRf, 'rfRatio')
  const factor = rf ?? 1
  const inverting = dacType !== 'r2r_t'
  // 权电阻型的分母为 2^(n-1)（MSB 支路为 R）；倒 T 型与 T 型为 2^n。
  const k = dacType === 'weighted' ? n - 1 : n
  const denom = 2 ** k
  const vout = ((inverting ? -1 : 1) * factor * vref * d) / denom
  const lsb = (factor * vref) / denom
  const fullScale = (factor * vref * max) / denom
  const bin = bitsText(d, n)

  const onePowers: number[] = []
  for (let i = n - 1; i >= 0; i--) if ((d >> i) & 1) onePowers.push(i)
  const sumTerms = onePowers.length ? onePowers.map(i => `2^${i}`).join(' + ') : '0'

  const formula =
    dacType === 'weighted'
      ? 'Vo = -(Rf/R)·VREF·D/2^(n-1)'
      : dacType === 'r2r_inverted'
        ? 'Vo = -(Rf/R)·VREF·D/2^n'
        : 'Vo = VREF·D/2^n'
  const factorPart = rf === null ? '' : `${fmtNum(rf)} × `
  const substituted = `Vo = ${inverting ? '-' : ''}${factorPart}${fmtNum(vref)} × ${d} / ${denom} = ${fmtNum(vout)} V`
  const lsbFormula = rf === null ? `VREF/2^${k}` : `(Rf/R)·VREF/2^${k}`

  const derivation: string[] = [`输入数字量 D = ${d}，二进制 ${bin}，D = Σ d_i·2^i = ${sumTerms} = ${d}`]
  if (dacType === 'weighted') {
    derivation.push(
      `权电阻：第 i 位支路电阻 R_i = 2^(n-1-i)·R，最高位为 R，最低位为 ${resistorText(n - 1)}`,
      `各位电流 I_i = d_i·VREF/R_i，求和得 I_f = VREF·D/(R·2^(n-1))`,
      `输出 Vo = -Rf·I_f = -(Rf/R)·VREF·D/2^(n-1)`,
    )
  } else if (dacType === 'r2r_inverted') {
    derivation.push(
      `参考电流 I_REF = VREF/R，经 R-2R 梯形网络按位分流，输出电流 I_O = I_REF·D/2^n = VREF·D/(R·2^n)`,
      `输出 Vo = -Rf·I_O = -(Rf/R)·VREF·D/2^n`,
    )
  } else {
    derivation.push('T 型网络各位支路经等效变换后，输出端电压 Vo = VREF·D/2^n')
  }
  derivation.push(
    `分辨率 1LSB = ${lsbFormula} = ${fmtNum(lsb)} V`,
    `满量程（D = ${max}，各位全为 1）= ${fmtNum(fullScale)} V`,
    inverting
      ? '符号约定：反相输出，正的数字量对应负的输出电压（接反相放大器时）'
      : '符号约定：同相输出，输出电压与 D 同号，无负号',
  )

  const branches: DacBranch[] | null =
    dacType === 'weighted'
      ? Array.from({ length: n }, (_, j) => {
          const bit = n - 1 - j
          return { bit, value: ((d >> bit) & 1) as 0 | 1, resistor: resistorText(j) }
        })
      : null

  const result: DacResult = {
    dacType,
    typeName: DAC_NAME[dacType],
    bits: n,
    vref,
    code: d,
    codeBinary: bin,
    inverting,
    rfRatio: rf,
    formula,
    substituted,
    vout,
    fraction: fractionText(d, denom),
    lsb,
    fullScale,
    branches,
    derivation,
  }
  return solved(result)
}

// ───────────────────────── 逐次逼近 ADC（adc_sar） ─────────────────────────

export interface SarRequest {
  bits: number
  vref: number
  vin: number
}

export function solveSar(req: SarRequest): Solved<SarResult> {
  const n = checkBits(req.bits)
  const vref = checkPositive(req.vref, 'vref')
  const vin = checkNumber(req.vin, 'vin')
  checkRange(vin, vref)
  const denom = 2 ** n
  const delta = vref / denom
  const steps: SarStep[] = []
  let cur = 0
  for (let i = n - 1; i >= 0; i--) {
    const trial = cur | (1 << i)
    const dacVoltage = (vref * trial) / denom
    const geq = vin + EPS >= dacVoltage
    if (geq) cur = trial
    steps.push({
      step: steps.length + 1,
      bit: i,
      trialCode: trial,
      trialBinary: bitsText(trial, n),
      dacVoltage,
      geq,
      kept: geq ? 1 : 0,
      partialBinary: bitsText(cur, n),
    })
  }
  const code = cur
  const codeBinary = bitsText(code, n)
  const quantized = code * delta
  const error = vin - quantized
  const derivation: string[] = [
    `量化单位 Δ = VREF/2^${n} = ${fmtNum(vref)}/${denom} = ${fmtNum(delta)} V`,
    ...steps.map(
      s =>
        `第 ${s.step} 次：试探 ${s.trialBinary}（第 ${s.bit} 位置 1），DAC 输出 Vo = ${fmtNum(s.dacVoltage)} V，` +
        (s.geq ? 'Vin ≥ Vo，保留 1' : 'Vin < Vo，清除为 0'),
    ),
    `转换结果 ${codeBinary}（十进制 ${code}），对应模拟值 ${code}·Δ = ${fmtNum(quantized)} V`,
    `量化误差 e = Vin - ${code}·Δ = ${fmtNum(error)} V，舍尾法误差范围 0 ≤ e < Δ`,
  ]
  const warnings = vin >= vref ? ['输入等于满量程，数字量取最大码，误差等于 Δ。'] : []
  return solved(
    {
      bits: n,
      vref,
      vin,
      delta,
      steps,
      code,
      codeBinary,
      quantized,
      error,
      errorRange: [0, delta],
      derivation,
    },
    warnings,
  )
}

// ───────────────────────── 并行比较 ADC（adc_flash） ─────────────────────────

export interface FlashRequest {
  bits: number
  vref: number
  vin: number
  mode?: string
}

export function solveFlash(req: FlashRequest): Solved<FlashResult> {
  const n = checkBits(req.bits)
  const vref = checkPositive(req.vref, 'vref')
  const vin = checkNumber(req.vin, 'vin')
  checkRange(vin, vref)
  const mode = checkMode(req.mode)
  const denom = 2 ** n
  const count = denom - 1
  const delta = quantDelta(n, vref, mode)
  const refFormula =
    mode === 'truncate'
      ? `V_k = k·VREF/2^${n}，k = 1～${count}`
      : `V_k = (2k-1)·VREF/(2^${n + 1}-1)，k = 1～${count}`

  const code = quantCode(vin, n, delta, mode)
  const codeBinary = bitsText(code, n)
  const quantized = code * delta
  const error = vin - quantized
  const errorRange: [number, number] = mode === 'truncate' ? [0, delta] : [-delta / 2, delta / 2]

  let comparators: FlashComparator[] = []
  let thermometer: string | null = null
  if (count <= FLASH_LIST_LIMIT) {
    for (let k = 1; k <= count; k++) {
      const ref = mode === 'truncate' ? (k * vref) / denom : ((2 * k - 1) * vref) / (2 ** (n + 1) - 1)
      comparators.push({ index: k, ref, output: vin + EPS >= ref ? 1 : 0 })
    }
    thermometer = [...comparators].reverse().map(c => c.output).join('')
  }

  const errText = mode === 'truncate' ? '误差范围 0 ≤ e < Δ' : '误差范围 -Δ/2 ≤ e ≤ Δ/2'
  const derivation: string[] = [
    `量化单位 Δ = ${quantDeltaFormula(n, mode, 'VREF')} = ${fmtNum(delta)} V`,
    `比较器数量 2^${n} - 1 = ${count} 个，参考电压 ${refFormula}`,
  ]
  if (thermometer !== null) derivation.push(`各比较器输出自高到低为 ${thermometer}（温度计码）`)
  derivation.push(
    `编码器把 1 的个数 ${code} 编为二进制 ${codeBinary}`,
    `量化值 ${code}·Δ = ${fmtNum(quantized)} V，误差 e = ${fmtNum(error)} V，${errText}`,
  )
  const warnings = vin >= vref ? ['输入等于满量程，数字量取最大码。'] : []
  return solved(
    {
      bits: n,
      vref,
      vin,
      mode,
      delta,
      comparatorCount: count,
      refFormula,
      comparators,
      thermometer,
      code,
      codeBinary,
      quantized,
      error,
      errorRange,
      derivation,
    },
    warnings,
  )
}

// ───────────────────────── 双积分 ADC（adc_dual） ─────────────────────────

export interface DualRequest {
  /** 定时积分时间 T1（秒）。 */
  t1: number
  clockHz: number
  vref: number
  vin: number
  /** 量程上限 Vfs，默认等于 VREF。 */
  vfs?: number
  /** 工频频率，默认 50 Hz。 */
  mainsHz?: number
}

export function solveDual(req: DualRequest): Solved<DualSlopeResult> {
  const vref = checkPositive(req.vref, 'vref')
  const vfs = req.vfs === undefined ? vref : checkPositive(req.vfs, 'vfs')
  const vin = checkNumber(req.vin, 'vin')
  if (vin < 0 || vin > vfs) {
    throw new DlogicInputError(`双积分 ADC 只处理 0～Vfs（${fmtNum(vfs)} V）的输入，当前为 ${fmtNum(vin)} V（极性由比较器判断，取绝对值）。`)
  }
  const clockHz = checkPositive(req.clockHz, 'clockHz')
  const t1Req = checkPositive(req.t1, 't1')
  const mainsHz = req.mainsHz === undefined ? 50 : checkPositive(req.mainsHz, 'mainsHz')

  const warnings: string[] = []
  const nRaw = t1Req * clockHz
  const n1 = Math.round(nRaw)
  if (n1 < 1) throw new DlogicInputError('T1 过短，T1 内至少需要 1 个时钟脉冲。')
  if (Math.abs(nRaw - n1) > 1e-6) {
    warnings.push(`T1 不是时钟周期的整数倍，取 N1 = ${n1}，实际 T1 = ${fmtTime(n1 / clockHz)}。`)
  }
  const t1 = n1 / clockHz
  const t2 = (vin / vref) * t1
  const n2 = Math.floor((vin * n1) / vref + EPS)
  const t2Max = (vfs / vref) * t1
  const convMax = t1 + t2Max
  const resolution = vref / n1
  const mainsPeriods = t1 * mainsHz
  const mainsMultiple = mainsPeriods >= 1 - 1e-9 && Math.abs(mainsPeriods - Math.round(mainsPeriods)) < 1e-6
  if (!mainsMultiple) {
    warnings.push(`T1 不是工频周期（${fmtTime(1 / mainsHz)}）的整数倍，工频干扰不能被完全抑制。`)
  }

  const derivation: string[] = [
    `定时积分 T1：N1 = T1·f_clk = ${n1}，T1 = ${fmtTime(t1)}`,
    `反向积分：以 VREF 反向积分，T2 = (Vin/VREF)·T1 = ${fmtTime(t2)}`,
    `计数值 N2 = (Vin/VREF)·N1 = ${fmtNum((vin * n1) / vref)}，取整为 ${n2}`,
    `最大转换时间 Tmax = T1 + T2max = ${fmtTime(t1)} + ${fmtTime(t2Max)} = ${fmtTime(convMax)}（T2max 对应 Vfs = ${fmtNum(vfs)} V）`,
    `分辨率：每个计数对应 VREF/N1 = ${fmtNum(resolution)} V`,
    `抗干扰：T1 = ${fmtNum(mainsPeriods)} 个工频周期（${mainsHz} Hz），${mainsMultiple ? '是整数倍，积分后工频分量为零' : '不是整数倍，工频分量不能完全抵消'}`,
  ]
  return solved(
    {
      vref,
      vin,
      vfs,
      clockHz,
      mainsHz,
      t1,
      n1,
      t2,
      n2,
      t2Max,
      convMax,
      resolution,
      mainsPeriods,
      mainsMultiple,
      derivation,
    },
    warnings,
  )
}

// ───────────────────────── 量化与采样（quantize） ─────────────────────────

export interface QuantRequest {
  bits: number
  fullScale: number
  vin?: number
  mode?: string
  /** 绝对误差要求（V），用于反求最少位数。 */
  maxError?: number
  /** 信号最高频率（Hz），用于采样定理判断。 */
  fmax?: number
  /** 采样频率（Hz），与 fmax 同时给出时判断是否满足采样定理。 */
  fs?: number
}

export function solveQuantize(req: QuantRequest): Solved<QuantizeResult> {
  const n = checkBits(req.bits)
  const full = checkPositive(req.fullScale, 'fullScale')
  const mode = checkMode(req.mode)
  const denom = 2 ** n
  const delta = quantDelta(n, full, mode)
  const maxAbsError = mode === 'truncate' ? delta : delta / 2
  const errorRange: [number, number] = mode === 'truncate' ? [0, delta] : [-delta / 2, delta / 2]
  const warnings: string[] = []
  const derivation: string[] = [
    `量化单位 Δ = ${quantDeltaFormula(n, mode, 'FS')} = ${fmtNum(delta)} V`,
    `量化等级数 2^${n} = ${denom}`,
    mode === 'truncate'
      ? `舍尾法：量化值 = code·Δ，误差范围 0 ≤ e < Δ，|e| 的上限为 Δ`
      : `四舍五入法：量化值 = code·Δ，误差范围 -Δ/2 ≤ e ≤ Δ/2`,
  ]

  let vin: number | null = null
  let code: number | null = null
  let codeBinary: string | null = null
  let quantized: number | null = null
  let error: number | null = null
  if (req.vin !== undefined) {
    vin = checkNumber(req.vin, 'vin')
    checkRange(vin, full)
    code = quantCode(vin, n, delta, mode)
    codeBinary = bitsText(code, n)
    quantized = code * delta
    error = vin - quantized
    derivation.push(
      `输入 Vin = ${fmtNum(vin)} V，数字码 ${codeBinary}（十进制 ${code}），量化值 ${fmtNum(quantized)} V`,
      `量化误差 e = ${fmtNum(error)} V`,
    )
    if (vin >= full) warnings.push('输入等于满量程，数字码取最大值。')
  }

  let minBits: QuantizeResult['minBits'] = null
  if (req.maxError !== undefined) {
    const maxError = checkPositive(req.maxError, 'maxError')
    let found: number | null = null
    for (let m = 1; m <= MAX_BITS; m++) {
      const d = quantDelta(m, full, mode)
      const bound = mode === 'truncate' ? d : d / 2
      if (bound <= maxError + 1e-12) {
        found = m
        break
      }
    }
    minBits = {
      maxError,
      bits: found,
      delta: found === null ? null : quantDelta(found, full, mode),
    }
    if (found === null) {
      warnings.push(`误差要求 ${fmtNum(maxError)} V 在 ${MAX_BITS} 位以内无法满足。`)
      derivation.push(`误差要求 |e| ≤ ${fmtNum(maxError)} V：${MAX_BITS} 位以内无法满足`)
    } else {
      const bound = mode === 'truncate' ? 'Δ ≤ 误差要求' : 'Δ/2 ≤ 误差要求'
      derivation.push(`误差要求 |e| ≤ ${fmtNum(maxError)} V，${bound}，最少位数 n = ${found}`)
    }
  }

  let sampling: SamplingResult | null = null
  if (req.fmax !== undefined) {
    const fmax = checkPositive(req.fmax, 'fmax')
    const minFs = 2 * fmax
    if (req.fs === undefined) {
      sampling = {
        fmax,
        minFs,
        fs: null,
        ok: null,
        aliasFreq: null,
        verdict: `最高频率 ${fmtNum(fmax)} Hz，最小采样频率 fs ≥ 2fmax = ${fmtNum(minFs)} Hz`,
      }
    } else {
      const fs = checkPositive(req.fs, 'fs')
      if (fs + EPS >= minFs) {
        sampling = {
          fmax,
          minFs,
          fs,
          ok: true,
          aliasFreq: null,
          verdict: `fs = ${fmtNum(fs)} Hz ≥ 2fmax = ${fmtNum(minFs)} Hz，满足采样定理`,
        }
      } else {
        const alias = Math.abs(fmax - Math.round(fmax / fs) * fs)
        sampling = {
          fmax,
          minFs,
          fs,
          ok: false,
          aliasFreq: alias,
          verdict: `fs = ${fmtNum(fs)} Hz < 2fmax = ${fmtNum(minFs)} Hz，发生混叠，${fmtNum(fmax)} Hz 的信号将被误认为 ${fmtNum(alias)} Hz`,
        }
      }
    }
    derivation.push(`采样定理：fs ≥ 2fmax = ${fmtNum(minFs)} Hz`)
  }

  return solved(
    {
      bits: n,
      fullScale: full,
      mode,
      levels: denom,
      delta,
      deltaFormula: quantDeltaFormula(n, mode, 'FS'),
      vin,
      code,
      codeBinary,
      quantized,
      error,
      errorRange,
      maxAbsError,
      minBits,
      sampling,
      derivation,
    },
    warnings,
  )
}

/** 分发入口的辅助：只检查 op 是否合法。 */
export function checkOp(op: unknown): AddaOp {
  if (typeof op === 'string' && (ADDA_OPS as string[]).includes(op)) return op as AddaOp
  throw new DlogicInputError(`未知的 op：${String(op)}，可选 dac、adc_sar、adc_flash、adc_dual、quantize。`)
}
