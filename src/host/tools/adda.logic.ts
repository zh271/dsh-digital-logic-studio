// dlogic_adda 的纯逻辑：参数结构、求解分派与中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope } from '../../shared/contracts.ts'
import { fmtNum, fmtTime, type AddaOp, type AddaResult, type DacResult, type DacType, type DualSlopeResult, type FlashResult, type QuantizeResult, type SarResult } from '../../shared/adda.ts'
import {
  ADDA_OPS,
  MAX_BITS,
  checkOp,
  solveDac,
  solveDual,
  solveFlash,
  solveQuantize,
  solveSar,
  type Solved,
} from '../../solvers/adda.ts'
import { envelope } from '../envelope.ts'

export const ADDA_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...ADDA_OPS],
    description: 'dac 数模转换；adc_sar 逐次逼近；adc_flash 并行比较；adc_dual 双积分；quantize 量化与采样判断。',
  },
  bits: {
    type: 'integer',
    description: '位数 n，1～16。dac、adc_sar、adc_flash、quantize 必填。',
  },
  vref: {
    type: 'number',
    description: '参考电压 VREF（V）。dac、adc_sar、adc_flash、adc_dual 必填；quantize 可用它代替 fullScale。',
  },
  fullScale: {
    type: 'number',
    description: 'quantize：满量程 FS（V）。',
  },
  code: {
    type: 'integer',
    description: 'dac：十进制数字量 D，与 binary 二选一。',
  },
  binary: {
    type: 'string',
    description: 'dac：二进制数字量，长度须等于位数，例如 "10110101"。',
  },
  dacType: {
    type: 'string',
    enum: ['weighted', 'r2r_t', 'r2r_inverted'],
    description: 'dac 必填：weighted 权电阻型；r2r_t R-2R T 型；r2r_inverted R-2R 倒 T 型。',
  },
  rfRatio: {
    type: 'number',
    description: 'dac：反馈电阻与 R 之比 Rf/R。权电阻型默认 1/2（标准比例），倒 T 型默认 1；T 型忽略。',
  },
  vin: {
    type: 'number',
    description: '输入模拟电压（V）。adc_sar、adc_flash 必填；quantize 可选；adc_dual 为待测电压。',
  },
  mode: {
    type: 'string',
    enum: ['truncate', 'round'],
    description: 'adc_flash、quantize 的量化方式：truncate 舍尾法（默认）；round 四舍五入法。',
  },
  t1: {
    type: 'number',
    description: 'adc_dual：定时积分时间 T1（秒）。',
  },
  clockHz: {
    type: 'number',
    description: 'adc_dual：时钟频率（Hz）。',
  },
  vfs: {
    type: 'number',
    description: 'adc_dual：量程上限 Vfs（V），默认等于 VREF。',
  },
  mainsHz: {
    type: 'number',
    description: 'adc_dual：工频频率（Hz），默认 50。',
  },
  maxError: {
    type: 'number',
    description: 'quantize：绝对误差要求（V），用于反求最少位数。',
  },
  fmax: {
    type: 'number',
    description: 'quantize：信号最高频率（Hz），用于采样定理判断。',
  },
  fs: {
    type: 'number',
    description: 'quantize：采样频率（Hz），与 fmax 同时给出时判断是否满足 fs ≥ 2fmax。',
  },
} as const

export interface AddaArgs {
  op: AddaOp
  bits?: number
  vref?: number
  fullScale?: number
  code?: number
  binary?: string
  dacType?: string
  rfRatio?: number
  vin?: number
  mode?: string
  t1?: number
  clockHz?: number
  vfs?: number
  mainsHz?: number
  maxError?: number
  fmax?: number
  fs?: number
}

function dispatch(args: AddaArgs): Solved<AddaResult> {
  switch (checkOp(args.op)) {
    case 'dac': {
      if (!args.dacType) throw new DlogicInputError('dac 需要提供 dacType：weighted（权电阻）、r2r_t（T 型）或 r2r_inverted（倒 T 型）。')
      return solveDac({
        bits: args.bits as number,
        vref: args.vref as number,
        code: args.code,
        binary: args.binary,
        dacType: args.dacType as DacType,
        rfRatio: args.rfRatio,
      })
    }
    case 'adc_sar':
      return solveSar({ bits: args.bits as number, vref: args.vref as number, vin: args.vin as number })
    case 'adc_flash':
      return solveFlash({ bits: args.bits as number, vref: args.vref as number, vin: args.vin as number, mode: args.mode })
    case 'adc_dual':
      return solveDual({
        t1: args.t1 as number,
        clockHz: args.clockHz as number,
        vref: args.vref as number,
        vin: args.vin as number,
        vfs: args.vfs,
        mainsHz: args.mainsHz,
      })
    case 'quantize':
      return solveQuantize({
        bits: args.bits as number,
        fullScale: (args.fullScale ?? args.vref) as number,
        vin: args.vin,
        mode: args.mode,
        maxError: args.maxError,
        fmax: args.fmax,
        fs: args.fs,
      })
  }
}

export function runAdda(args: AddaArgs): Envelope<AddaResult> {
  return envelope<AddaResult>(String(args.op), () => {
    const out = dispatch(args)
    return {
      result: out.result,
      steps: out.result.derivation.map(text => ({ kind: 'derive', text })),
      warnings: out.warnings,
    }
  })
}

const SHOW_ROWS = 64

function renderDac(r: DacResult, lines: string[]): void {
  lines.push(`类型：${r.typeName}；位数 ${r.bits}；D = ${r.code}（${r.codeBinary}）；VREF = ${fmtNum(r.vref)} V`)
  lines.push(`公式：${r.formula}`)
  lines.push(`代入：${r.substituted}`)
  lines.push(`D/2^k = ${r.fraction}；1LSB = ${fmtNum(r.lsb)} V；满量程 = ${fmtNum(r.fullScale)} V`)
  if (r.branches) {
    lines.push('支路（自高位到低位）：')
    for (const b of r.branches) lines.push(`  第 ${b.bit} 位 = ${b.value}，电阻 ${b.resistor}`)
  }
  lines.push('推导：')
  for (const d of r.derivation) lines.push(`  ${d}`)
}

function renderSar(r: SarResult, lines: string[]): void {
  lines.push(`位数 ${r.bits}；VREF = ${fmtNum(r.vref)} V；Vin = ${fmtNum(r.vin)} V；Δ = ${fmtNum(r.delta)} V`)
  for (const s of r.steps) {
    lines.push(
      `第 ${s.step} 次：试探 ${s.trialBinary}，Vo = ${fmtNum(s.dacVoltage)} V，${s.geq ? 'Vin ≥ Vo' : 'Vin < Vo'}，` +
        `${s.geq ? '保留' : '清除'}第 ${s.bit} 位，部分结果 ${s.partialBinary}`,
    )
  }
  lines.push(`最终数字量 ${r.codeBinary}（十进制 ${r.code}），模拟值 ${fmtNum(r.quantized)} V`)
  lines.push(`量化误差 e = ${fmtNum(r.error)} V，范围 0 ≤ e < Δ`)
}

function renderFlash(r: FlashResult, lines: string[]): void {
  lines.push(`位数 ${r.bits}；比较器 ${r.comparatorCount} 个；${r.mode === 'truncate' ? '舍尾法' : '四舍五入法'}；Δ = ${fmtNum(r.delta)} V`)
  lines.push(`参考电压：${r.refFormula}`)
  if (r.comparators.length) {
    for (const c of r.comparators.slice(0, SHOW_ROWS)) lines.push(`  比较器 ${c.index}：Vref = ${fmtNum(c.ref)} V，输出 ${c.output}`)
    if (r.comparators.length > SHOW_ROWS) lines.push(`  其余 ${r.comparators.length - SHOW_ROWS} 个比较器略去`)
  }
  if (r.thermometer !== null) lines.push(`温度计码（自高到低）：${r.thermometer}`)
  lines.push(`编码输出 ${r.codeBinary}（十进制 ${r.code}），量化值 ${fmtNum(r.quantized)} V，误差 e = ${fmtNum(r.error)} V`)
}

function renderDual(r: DualSlopeResult, lines: string[]): void {
  lines.push(`T1 = ${fmtTime(r.t1)}（N1 = ${r.n1}）；T2 = ${fmtTime(r.t2)}；N2 = ${r.n2}`)
  lines.push(`Vfs = ${fmtNum(r.vfs)} V 时 T2max = ${fmtTime(r.t2Max)}，最大转换时间 ${fmtTime(r.convMax)}`)
  lines.push(`分辨率 VREF/N1 = ${fmtNum(r.resolution)} V/计数`)
  lines.push(`工频 ${r.mainsHz} Hz，T1 = ${fmtNum(r.mainsPeriods)} 个工频周期，${r.mainsMultiple ? '是整数倍，可抑制工频干扰' : '不是整数倍'}`)
  lines.push('推导：')
  for (const d of r.derivation) lines.push(`  ${d}`)
}

function renderQuantize(r: QuantizeResult, lines: string[]): void {
  lines.push(`位数 ${r.bits}；满量程 FS = ${fmtNum(r.fullScale)} V；${r.mode === 'truncate' ? '舍尾法' : '四舍五入法'}；量化等级 ${r.levels}`)
  lines.push(`Δ = ${r.deltaFormula} = ${fmtNum(r.delta)} V；误差范围 ${r.mode === 'truncate' ? '0 ≤ e < Δ' : '-Δ/2 ≤ e ≤ Δ/2'}`)
  if (r.vin !== null && r.codeBinary !== null && r.quantized !== null && r.error !== null) {
    lines.push(`Vin = ${fmtNum(r.vin)} V → 数字码 ${r.codeBinary}（十进制 ${r.code}），量化值 ${fmtNum(r.quantized)} V，误差 ${fmtNum(r.error)} V`)
  }
  if (r.minBits) {
    lines.push(
      r.minBits.bits === null
        ? `误差要求 ${fmtNum(r.minBits.maxError)} V：${MAX_BITS} 位以内无法满足`
        : `误差要求 ${fmtNum(r.minBits.maxError)} V：至少需要 ${r.minBits.bits} 位`,
    )
  }
  if (r.sampling) lines.push(`采样：${r.sampling.verdict}`)
}

export function renderAdda(value: Envelope<AddaResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  switch (value.op) {
    case 'dac':
      renderDac(value.result as DacResult, lines)
      break
    case 'adc_sar':
      renderSar(value.result as SarResult, lines)
      break
    case 'adc_flash':
      renderFlash(value.result as FlashResult, lines)
      break
    case 'adc_dual':
      renderDual(value.result as DualSlopeResult, lines)
      break
    case 'quantize':
      renderQuantize(value.result as QuantizeResult, lines)
      break
    default:
      lines.push('（无可显示的结果）')
  }
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
