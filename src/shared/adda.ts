// dlogic_adda 的数据契约：D/A 转换（权电阻、R-2R T 型、R-2R 倒 T 型）、A/D 转换（逐次逼近、并行比较、双积分）、量化与采样判断。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace），以便 Node 直接运行测试。

export type AddaOp = 'dac' | 'adc_sar' | 'adc_flash' | 'adc_dual' | 'quantize'

/** DAC 类型：权电阻型、R-2R T 型（电压输出）、R-2R 倒 T 型（电流输出，接反相放大器）。 */
export type DacType = 'weighted' | 'r2r_t' | 'r2r_inverted'

/** 量化方式：舍尾法（Δ = VREF/2^n）、四舍五入法（Δ = 2VREF/(2^(n+1)-1)）。 */
export type QuantMode = 'truncate' | 'round'

/** 所有结果共有的推导步骤（纯文本，中文）。 */
export interface AddaResultBase {
  derivation: string[]
}

// ───────────────────────── D/A（dac） ─────────────────────────

export interface DacBranch {
  /** 位号（权 2^bit）。 */
  bit: number
  value: 0 | 1
  /** 该位支路电阻，例如 "R"、"8R"。 */
  resistor: string
}

export interface DacResult extends AddaResultBase {
  dacType: DacType
  typeName: string
  bits: number
  vref: number
  /** 输入数字量 D（十进制）。 */
  code: number
  codeBinary: string
  /** 输出是否反相（权电阻型、倒 T 型为 true；T 型为 false）。 */
  inverting: boolean
  /** Rf 与 R 之比；T 型网络为 null。 */
  rfRatio: number | null
  /** 输出电压公式（纯文本）。 */
  formula: string
  /** 代入数值后的式子（纯文本）。 */
  substituted: string
  /** 带符号的输出电压（V）。 */
  vout: number
  /** D/2^k 的既约分数，例如 "181/256"（权电阻型 k = n-1，其余 k = n）。 */
  fraction: string
  /** 1LSB 对应的电压绝对值（V）。 */
  lsb: number
  /** 满量程输出的绝对值（V）。 */
  fullScale: number
  /** 权电阻型的各位支路，MSB 在前；其余类型为 null。 */
  branches: DacBranch[] | null
}

// ───────────────────────── 逐次逼近 ADC（adc_sar） ─────────────────────────

export interface SarStep {
  /** 第几次比较，从 1 开始。 */
  step: number
  /** 本次试探的位（权 2^bit）。 */
  bit: number
  /** 试探码（十进制）及其二进制。 */
  trialCode: number
  trialBinary: string
  /** 试探码经 DAC 转换得到的电压 VREF·trial/2^n。 */
  dacVoltage: number
  /** 比较结果：Vin ≥ Vo 为 true。 */
  geq: boolean
  /** 保留（1）或清除（0）该位。 */
  kept: 0 | 1
  /** 本次判决后的部分结果（未试探的位为 0）。 */
  partialBinary: string
}

export interface SarResult extends AddaResultBase {
  bits: number
  vref: number
  vin: number
  /** 量化单位 Δ = VREF/2^n。 */
  delta: number
  steps: SarStep[]
  code: number
  codeBinary: string
  /** 数字量对应的模拟值 code·Δ（V）。 */
  quantized: number
  /** 量化误差 Vin - code·Δ（V）。 */
  error: number
  /** 舍尾法误差范围 [0, Δ)。 */
  errorRange: [number, number]
}

// ───────────────────────── 并行比较 ADC（adc_flash） ─────────────────────────

export interface FlashComparator {
  /** 比较器编号 k（1 ～ 2^n-1）。 */
  index: number
  /** 比较器的参考电压（V）。 */
  ref: number
  /** 比较器输出：Vin ≥ 参考电压为 1。 */
  output: 0 | 1
}

export interface FlashResult extends AddaResultBase {
  bits: number
  vref: number
  vin: number
  mode: QuantMode
  delta: number
  /** 比较器个数 2^n - 1。 */
  comparatorCount: number
  /** 参考电压公式（纯文本）。 */
  refFormula: string
  /** 比较器明细；比较器较多（n 较大）时为空数组，此时只给出数字量。 */
  comparators: FlashComparator[]
  /** 温度计码（自高到低排列的比较器输出）；比较器较多时为 null。 */
  thermometer: string | null
  code: number
  codeBinary: string
  quantized: number
  error: number
  errorRange: [number, number]
}

// ───────────────────────── 双积分 ADC（adc_dual） ─────────────────────────

export interface DualSlopeResult extends AddaResultBase {
  vref: number
  vin: number
  /** 量程上限 Vfs（默认等于 VREF）。 */
  vfs: number
  clockHz: number
  mainsHz: number
  /** 定时积分时间 T1（秒，已取为时钟周期整数倍）。 */
  t1: number
  /** T1 内的时钟脉冲数 N1。 */
  n1: number
  /** 反积分时间 T2（秒）。 */
  t2: number
  /** T2 内的计数值 N2（取整）。 */
  n2: number
  /** 满量程输入时的反积分时间 T2max（秒）。 */
  t2Max: number
  /** 最大转换时间 T1 + T2max（秒）。 */
  convMax: number
  /** 每个计数对应的电压 VREF/N1（V）。 */
  resolution: number
  /** T1 包含的工频周期数（可能非整数）。 */
  mainsPeriods: number
  /** T1 是否为工频周期的整数倍。 */
  mainsMultiple: boolean
}

// ───────────────────────── 量化与采样（quantize） ─────────────────────────

export interface SamplingResult {
  fmax: number
  /** 最小采样频率 2fmax（Hz）。 */
  minFs: number
  /** 给定的采样频率；未给出为 null。 */
  fs: number | null
  /** 是否满足采样定理；未给出采样频率时为 null。 */
  ok: boolean | null
  /** 欠采样时信号被混叠到的频率（Hz）。 */
  aliasFreq: number | null
  verdict: string
}

export interface QuantizeResult extends AddaResultBase {
  bits: number
  fullScale: number
  mode: QuantMode
  /** 量化等级数 2^n。 */
  levels: number
  /** 量化单位 Δ。 */
  delta: number
  deltaFormula: string
  vin: number | null
  code: number | null
  codeBinary: string | null
  /** 数字码对应的模拟值（V）。 */
  quantized: number | null
  /** 量化误差 Vin - 模拟值（V）。 */
  error: number | null
  /** 误差范围：舍尾法 [0, Δ)，四舍五入法 [-Δ/2, Δ/2]。 */
  errorRange: [number, number]
  /** 绝对误差上限：舍尾法 Δ，四舍五入法 Δ/2。 */
  maxAbsError: number
  /** 按误差要求反求的最少位数；未给出误差要求时为 null。bits 为 null 表示 16 位以内无法满足。 */
  minBits: { maxError: number; bits: number | null; delta: number | null } | null
  sampling: SamplingResult | null
}

// ───────────────────────── 汇总 ─────────────────────────

export interface AddaResultMap {
  dac: DacResult
  adc_sar: SarResult
  adc_flash: FlashResult
  adc_dual: DualSlopeResult
  quantize: QuantizeResult
}

export type AddaResult = AddaResultMap[AddaOp]

/**
 * 数值格式化：默认保留 6 位小数并去掉末尾零；绝对值小于 1e-3 时保留 4 位有效数字。
 */
export function fmtNum(x: number, digits = 6): string {
  if (!Number.isFinite(x)) return String(x)
  if (x === 0) return '0'
  if (Math.abs(x) < 1e-3) return String(Number(x.toPrecision(4)))
  return String(Number(x.toFixed(digits)))
}

/** 时间格式化：按量级选用 s、ms、μs 或 ns。 */
export function fmtTime(s: number): string {
  const a = Math.abs(s)
  if (a >= 1) return `${fmtNum(s)} s`
  if (a >= 1e-3) return `${fmtNum(s * 1e3)} ms`
  if (a >= 1e-6) return `${fmtNum(s * 1e6)} μs`
  return `${fmtNum(s * 1e9)} ns`
}
