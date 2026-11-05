// dlogic_seq 的纯逻辑：参数结构、分派、步骤与中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope, Step } from '../../shared/contracts.ts'
import type {
  AnalyzeResult,
  Bit,
  CounterMethod,
  CounterModel,
  CounterResult,
  FfKind,
  FfResult,
  FlipFlopSpec,
  OutputSpec,
  SeqOp,
  SeqResultMap,
  ShiftKind,
  ShiftResult,
  WaveformResult,
  WaveTarget,
} from '../../shared/seq.ts'
import { analyzeMachine, counterDesign, ffCharacteristic, shiftDesign, waveformDesign, type WaveSpec } from '../../solvers/seq.ts'
import { envelope } from '../envelope.ts'

export const SEQ_OPS: SeqOp[] = ['ff', 'analyze', 'counter', 'shift', 'waveform']
const FF_KINDS: FfKind[] = ['SR', 'D', 'JK', 'T', 'SR_LATCH', 'GATED_SR', 'GATED_D']
const CLOCKED_KINDS = ['SR', 'D', 'JK', 'T']
const SHIFT_KINDS: ShiftKind[] = ['194', 'ring', 'johnson']
const TARGETS: WaveTarget[] = ['ff', 'analyze', 'counter', 'shift']

export const SEQ_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...SEQ_OPS],
    description: '子功能：ff 触发器特性与激励；analyze 同步时序电路分析；counter 160/161/163 模 N 计数器；shift 移位寄存器、环形与扭环计数器；waveform 时序波形。',
  },
  ffKind: {
    type: 'string',
    enum: [...FF_KINDS],
    description: 'ff 的类型：SR、D、JK、T（边沿触发）；SR_LATCH 基本 SR 锁存器（与非门）；GATED_SR、GATED_D 门控锁存器。waveform 的 target 为 ff 时同样使用。',
  },
  flipflops: {
    type: 'array',
    description: 'analyze 的触发器（1～4 个），第一个为最高位。变量为 Q 名与外部输入名，例如 Q1、Q0、X。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', required: true, description: 'Q 名，例如 "Q1"。' },
        kind: { type: 'string', required: true, enum: CLOCKED_KINDS, description: 'SR、D、JK 或 T。' },
        drives: {
          type: 'array',
          required: true,
          description: '各输入端的驱动表达式：SR 为 S、R；D 为 D；JK 为 J、K；T 为 T。',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              pin: { type: 'string', required: true, description: '端名。' },
              expr: { type: 'string', required: true, description: '驱动表达式，例如 "XQ0 + X\'Q0\'"。' },
            },
          },
        },
      },
    },
  },
  inputs: {
    type: 'array',
    items: { type: 'string' },
    description: 'analyze 的外部输入名（最多 2 个）。waveform 的 target 为 analyze 时同样使用。',
  },
  outputs: {
    type: 'array',
    description: 'analyze 的输出，每项 {name, expr}，表达式变量为 Q 名与输入名。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', required: true, description: '输出名，例如 "Y"。' },
        expr: { type: 'string', required: true, description: '输出表达式。' },
      },
    },
  },
  init: {
    type: 'string',
    description: 'ff：初态 "0" 或 "1"。analyze：初态，按触发器顺序的 0/1 字符串，默认全 0。shift：初态，从 Q(n-1) 写到 Q0；环形默认 "0…01"，扭环与 194 默认全 0。',
  },
  asynchronous: {
    type: 'boolean',
    description: 'analyze：电路是否为异步（各触发器独立时钟）。异步电路暂不支持，将按同步电路分析并给出说明。',
  },
  model: {
    type: 'string',
    enum: ['160', '161', '163'],
    description: 'counter 的芯片型号：160 为十进制（异步清零）；161 为四位二进制（异步清零）；163 为四位二进制（同步清零）。',
  },
  method: {
    type: 'string',
    enum: ['reset', 'preset'],
    description: 'counter 的设计方法：reset 清零法（默认）；preset 置数法。',
  },
  N: {
    type: 'integer',
    description: 'counter 的模 N，2～256；超过一片的模时两片级联（160 两片最大模为 100）。',
  },
  shiftKind: {
    type: 'string',
    enum: [...SHIFT_KINDS],
    description: 'shift 的类型：194 移位寄存器（4 位）；ring 环形计数器（模 n）；johnson 扭环计数器（模 2n）。',
  },
  bits: {
    type: 'integer',
    description: 'shift 的位数：194 固定为 4；环形与扭环为 2～8，默认 4。',
  },
  direction: {
    type: 'string',
    enum: ['left', 'right'],
    description: '194 的移位方向，默认右移。',
  },
  serial: {
    type: 'array',
    items: { type: 'integer' },
    description: '194 的串行输入序列（0 或 1），每个时钟输入一位。',
  },
  target: {
    type: 'string',
    enum: [...TARGETS],
    description: 'waveform 的电路类型。其余参数与对应 op 相同（ffKind、flipflops、inputs、outputs、model、method、N、shiftKind、bits、direction、init）。',
  },
  waves: {
    type: 'array',
    description: 'waveform 的输入波形。每个输入给出由 0 和 1 组成的字符串，每个字符对应一个时钟周期；输入在周期内稳定，周期末的时钟沿更新状态。门控锁存器的 CP 按电平处理。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', required: true, description: '输入名，例如 "J"、"K"、"X"、"CP"。' },
        wave: { type: 'string', required: true, description: '由 0 和 1 组成的字符串，例如 "1100"。' },
      },
    },
  },
  steps: {
    type: 'integer',
    description: 'waveform 的周期数（1～64）。缺省时取输入波形的长度。',
  },
} as const

export interface SeqArgs {
  op: SeqOp
  ffKind?: FfKind
  flipflops?: FlipFlopSpec[]
  inputs?: string[]
  outputs?: OutputSpec[]
  init?: string
  asynchronous?: boolean
  model?: CounterModel
  method?: CounterMethod
  N?: number
  shiftKind?: ShiftKind
  bits?: number
  direction?: 'left' | 'right'
  serial?: number[]
  target?: WaveTarget
  waves?: { name: string; wave: string }[]
  steps?: number
}

export type SeqResult = SeqResultMap[SeqOp]

function need<T>(v: T | undefined, msg: string): T {
  if (v === undefined) throw new DlogicInputError(msg)
  return v
}

function bitsOfSerial(serial: number[] | undefined): Bit[] | undefined {
  if (serial === undefined) return undefined
  return serial.map(s => {
    if (s !== 0 && s !== 1) throw new DlogicInputError('串行输入只能是 0 或 1。')
    return s as Bit
  })
}

function waveSpecOf(args: SeqArgs): WaveSpec {
  return {
    ffKind: args.ffKind,
    init: args.init,
    flipflops: args.flipflops,
    inputs: args.inputs,
    outputs: args.outputs,
    model: args.model,
    method: args.method,
    N: args.N,
    shiftKind: args.shiftKind,
    bits: args.bits,
    direction: args.direction,
    waves: args.waves,
    steps: args.steps,
  }
}

/** 步骤与警告都由结果推出，便于测试与渲染。 */
function stepsOf(op: SeqOp, r: SeqResult): Step[] {
  switch (op) {
    case 'ff': {
      const x = r as FfResult
      return [
        { kind: 'characteristic', text: `${x.title}：${x.characteristic}${x.constraint ? `，约束 ${x.constraint}` : ''}` },
        { kind: 'table', text: `特性表共 ${x.table.length} 行` },
        { kind: 'excitation', text: '激励表：由 Qn 与 Qn+1 求各输入，无关项记为 X' },
      ]
    }
    case 'analyze': {
      const x = r as AnalyzeResult
      return [
        ...x.drives.map(d => ({ kind: 'drive', text: `${d.ff} 的 ${d.pin} 端：${d.expr}` })),
        ...x.stateEquations.map(e => ({ kind: 'state_eq', text: `${e.ff}* = ${e.text}` })),
        { kind: 'table', text: `状态表共 ${x.table.length} 行，初态 ${x.initial}` },
        { kind: 'self_start', text: x.selfStart ? '能够自启动' : '不能自启动' },
      ]
    }
    case 'counter': {
      const x = r as CounterResult
      const steps: Step[] = []
      steps.push({ kind: 'feedback', text: x.feedback.expr || '无反馈，按芯片自然模计数' })
      steps.push({ kind: 'sequence', text: `状态序列共 ${x.sequence.filter(s => !s.transient).length} 个有效状态` })
      if (x.chips === 2) steps.push({ kind: 'cascade', text: '两片级联：低位片的 RCO 接高位片的 ET、EP，两片共用 CP、CR̄ 或 LD̄' })
      return steps
    }
    case 'shift': {
      const x = r as ShiftResult
      return [
        { kind: 'feedback', text: x.feedback },
        { kind: 'sequence', text: `状态序列共 ${x.sequence.length} 项` },
        ...(x.selfStart === null ? [] : [{ kind: 'self_start', text: x.selfStart ? '能够自启动' : '不能自启动' }]),
      ]
    }
    case 'waveform': {
      const x = r as WaveformResult
      return [{ kind: 'waveform', text: `共 ${x.steps} 个时钟周期，${x.signals.length} 路信号` }]
    }
  }
}

function warningsOf(op: SeqOp, r: SeqResult, args: SeqArgs): string[] {
  const w: string[] = []
  switch (op) {
    case 'ff':
      break
    case 'analyze': {
      const x = r as AnalyzeResult
      if (args.asynchronous === true) {
        w.push('异步电路（各触发器独立时钟）暂不支持，本结果按同步电路（共用时钟）分析，请勿用于异步电路。')
      }
      if (x.table.some(row => row.next === '×')) {
        w.push('某些状态与输入的组合会进入禁止状态（×），请检查驱动方程或在设计中加以约束。')
      }
      if (!x.selfStart) w.push('存在无法进入有效循环的状态，电路不能自启动。')
      break
    }
    case 'counter': {
      const x = r as CounterResult
      if (x.glitch) {
        w.push(`异步清零存在过渡态 ${x.transient}：该状态只持续很短时间，输出端可能出现毛刺，不能作为有效状态使用。若需避免，改用 163 同步清零或同步置数。`)
      }
      break
    }
    case 'shift': {
      const x = r as ShiftResult
      if (x.modulus !== null && x.expectedModulus !== null && x.modulus !== x.expectedModulus) {
        w.push(`初态所在循环的模为 ${x.modulus}，与标准模 ${x.expectedModulus} 不同。`)
      }
      if (x.selfStart === false) w.push('存在无效循环，电路不能自启动。')
      break
    }
    case 'waveform': {
      if (!Array.isArray(args.waves) || args.waves.length === 0) {
        w.push('未给出输入波形，输入均按 0 处理。')
      }
      if (args.target === 'counter' && (args.model === '161' || args.model === '160') && args.method !== 'preset' && args.N !== undefined) {
        const c = counterDesign(args.model, 'reset', args.N)
        if (c.glitch) w.push('异步清零的过渡态在波形中未画出，实际电路中会出现毛刺。')
      }
      break
    }
  }
  return w
}

/** 分派执行。参数错误以 ok: false 返回。 */
export function runSeq(args: SeqArgs): Envelope<SeqResult> {
  return envelope<SeqResult>(String(args.op), () => {
    switch (args.op) {
      case 'ff': {
        const kind = need(args.ffKind, '缺少 ffKind（触发器类型）。')
        const result = ffCharacteristic(kind)
        return { result, steps: stepsOf('ff', result), warnings: [] }
      }
      case 'analyze': {
        const flipflops = need(args.flipflops, 'analyze 需要 flipflops（触发器列表）。')
        if (flipflops.length === 0) throw new DlogicInputError('analyze 至少需要 1 个触发器。')
        const result = analyzeMachine(flipflops, args.inputs ?? [], args.outputs ?? [], args.init)
        return { result, steps: stepsOf('analyze', result), warnings: warningsOf('analyze', result, args) }
      }
      case 'counter': {
        const model = need(args.model, 'counter 需要 model（160、161 或 163）。')
        const N = need(args.N, 'counter 需要 N（模）。')
        const result = counterDesign(model, args.method ?? 'reset', N)
        return { result, steps: stepsOf('counter', result), warnings: warningsOf('counter', result, args) }
      }
      case 'shift': {
        const kind = need(args.shiftKind, 'shift 需要 shiftKind（194、ring 或 johnson）。')
        const result = shiftDesign(kind, args.bits, args.init, args.direction, bitsOfSerial(args.serial))
        return { result, steps: stepsOf('shift', result), warnings: warningsOf('shift', result, args) }
      }
      case 'waveform': {
        const target = need(args.target, 'waveform 需要 target（ff、analyze、counter 或 shift）。')
        const result = waveformDesign(target, waveSpecOf(args))
        return { result, steps: stepsOf('waveform', result), warnings: warningsOf('waveform', result, args) }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

// ───────────────────────── 渲染 ─────────────────────────

const ROW_LIMIT = 32

function bitText(v: Bit | 'X'): string {
  return v === 'X' ? 'X' : String(v)
}

function renderFf(x: FfResult): string[] {
  const lines = [`${x.title}`, `特性方程：${x.characteristic}`]
  if (x.constraint) lines.push(`约束条件：${x.constraint}`)
  lines.push(`特性表（${x.inputs.join(' ')} | Qn | Qn+1）：`)
  for (const row of x.table.slice(0, ROW_LIMIT)) {
    const ins = x.inputs.map(p => String(row.inputs[p])).join(' ')
    lines.push(`  ${ins} | ${row.q} | ${row.next === 'X' ? '×（禁止）' : row.next}`)
  }
  lines.push('激励表（Qn → Qn+1 所需输入）：')
  for (const e of x.excitation) {
    const d = Object.entries(e.drive).map(([p, v]) => `${p}=${bitText(v)}`).join('，')
    lines.push(`  ${e.from} → ${e.to}：${d}`)
  }
  return lines
}

function renderAnalyze(x: AnalyzeResult): string[] {
  const lines: string[] = []
  lines.push(`状态变量：${x.stateNames.join(' ')}${x.inputNames.length ? `；输入：${x.inputNames.join(' ')}` : ''}`)
  lines.push('驱动方程：')
  for (const d of x.drives) lines.push(`  ${d.ff}.${d.pin} = ${d.expr}`)
  lines.push('状态方程：')
  for (const e of x.stateEquations) lines.push(`  ${e.ff}* = ${e.text}`)
  for (const o of x.outputs) lines.push(`输出 ${o.name} = ${o.expr}（${o.type === 'Moore' ? 'Moore 型' : 'Mealy 型'}）`)
  lines.push(`状态表（现态 ${x.inputNames.length ? '输入 ' : ''}次态 输出）：`)
  for (const row of x.table.slice(0, ROW_LIMIT)) {
    const outs = row.outputs.map(o => `${o.name}=${o.value}`).join(' ')
    lines.push(`  ${row.state}${x.inputNames.length ? ' ' + row.input : ''} → ${row.next}${outs ? '  ' + outs : ''}${row.valid ? '' : '  （无效）'}`)
  }
  if (x.table.length > ROW_LIMIT) lines.push(`  ……共 ${x.table.length} 行`)
  lines.push(`有效状态：${x.validStates.join(', ') || '无'}`)
  lines.push(`自启动：${x.selfStart ? '能' : '不能'}`)
  for (const p of x.invalidPaths.slice(0, 8)) {
    lines.push(`  无效状态 ${p.from} 的流向：${p.path.join(' → ')}${p.reached ? '' : '（无法进入有效状态）'}`)
  }
  lines.push(`状态图：${x.graph.nodes.length} 个节点，${x.graph.edges.length} 条边。`)
  return lines
}

function renderCounter(x: CounterResult): string[] {
  const lines = [
    `${x.model} 模 ${x.N}（${x.method === 'preset' ? '置数法' : '清零法'}，${x.chips === 2 ? '两片级联' : '单片'}）`,
  ]
  if (x.feedback.expr) lines.push(`反馈：${x.feedback.expr}（${x.feedback.kind === 'async' ? '异步清零' : '同步控制'}）`)
  else lines.push('反馈：无（芯片自然模）')
  if (x.load) lines.push(`预置数据 D = ${x.load.value}（${x.load.bits}）`)
  lines.push(`位名：${x.bitNames.join(' ')}`)
  lines.push('状态序列：')
  for (const r of x.sequence.slice(0, ROW_LIMIT)) {
    lines.push(`  ${r.index}：${r.bits}（十进制 ${r.value}）${r.transient ? '  过渡态' : ''}`)
  }
  if (x.glitch) lines.push(`注意：过渡态 ${x.transient} 会产生毛刺。`)
  return lines
}

function renderShift(x: ShiftResult): string[] {
  const lines = [`${x.kind === '194' ? '194 移位寄存器' : x.kind === 'ring' ? '环形计数器' : '扭环计数器'}（${x.bits} 位，初态 ${x.init}）`, `驱动：${x.feedback}`]
  lines.push('状态序列（Q(n-1)…Q0）：')
  for (const s of x.sequence.slice(0, ROW_LIMIT)) lines.push(`  ${s.step}：${s.state}${s.valid ? '' : '  （无效）'}`)
  if (x.modulus !== null) lines.push(`有效循环模 ${x.modulus}`)
  if (x.cycles) {
    for (const c of x.cycles.filter(cy => !cy.valid)) lines.push(`无效循环：${c.states.join(' → ')}`)
  }
  if (x.selfStart !== null) lines.push(`自启动：${x.selfStart ? '能' : '不能'}`)
  return lines
}

function renderWave(x: WaveformResult): string[] {
  const lines = [`时序波形（${x.steps} 个周期）：`]
  for (const s of x.signals) lines.push(`  ${s.name}: ${s.wave}`)
  return lines
}

export function renderSeq(value: Envelope<SeqResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const r = value.result
  let lines: string[]
  switch (value.op as SeqOp) {
    case 'ff':
      lines = renderFf(r as FfResult)
      break
    case 'analyze':
      lines = renderAnalyze(r as AnalyzeResult)
      break
    case 'counter':
      lines = renderCounter(r as CounterResult)
      break
    case 'shift':
      lines = renderShift(r as ShiftResult)
      break
    case 'waveform':
      lines = renderWave(r as WaveformResult)
      break
    default:
      lines = ['（无可显示的结果）']
  }
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
