// dlogic_fsm 的纯逻辑：参数结构、求解分派与中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope, Step } from '../../shared/contracts.ts'
import type {
  EncodingKind,
  FfType,
  FsmOp,
  FsmResultMap,
  FsmSpec,
  FsmTransition,
  ReduceResult,
  SelfStartResult,
  SynthesizeResult,
} from '../../shared/fsm.ts'
import { assignStates, reduceFsm, selfStart, synthesize } from '../../solvers/fsm.ts'
import { envelope } from '../envelope.ts'

export const FSM_OPS: FsmOp[] = ['reduce', 'assign', 'synthesize', 'self_start']

export const FSM_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...FSM_OPS],
    description: '子功能：reduce 状态化简；assign 状态编码评分；synthesize 激励与输出函数综合；self_start 自启动检查与修正',
  },
  type: {
    type: 'string',
    required: true,
    enum: ['mealy', 'moore'],
    description: '状态机类型：mealy（米利型，输出由现态与输入决定）或 moore（摩尔型，输出只由现态决定）',
  },
  states: {
    type: 'array',
    required: true,
    items: { type: 'string' },
    description: '状态名列表（至多 16 个）。顺序即编码分配的顺序。',
  },
  inputs: {
    type: 'integer',
    required: true,
    description: '输入位数，1～2',
  },
  outputs: {
    type: 'integer',
    required: true,
    description: '输出位数，1～2',
  },
  transitions: {
    type: 'array',
    required: true,
    description:
      '状态转移表。每项为 {from 现态, input 输入（位数与 inputs 相同的 0/1/x 串）, to 次态（不确定写 x）, output 输出（位数与 outputs 相同的 0/1/x 串）}。省略的 (现态, 输入) 组合视为未给定。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: { type: 'string', required: true, description: '现态' },
        input: { type: 'string', required: true, description: '输入，例如 "1"、"0x"' },
        to: { type: 'string', required: true, description: '次态，未给定时写 "x"' },
        output: { type: 'string', required: true, description: '输出，例如 "1"、"x"' },
      },
    },
  },
  ff: {
    type: 'string',
    enum: ['D', 'JK', 'T'],
    description: 'synthesize / self_start 使用的触发器类型，默认 D',
  },
  encoding: {
    type: 'string',
    enum: ['binary', 'gray', 'onehot', 'custom'],
    description: 'synthesize / self_start 的编码方式，默认 binary；custom 时必须提供 codes',
  },
  codes: {
    type: 'array',
    description: '自定义状态编码，每项 {state 状态名, code 0/1 串}；用于 assign（评分）或 encoding 为 custom 时。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        state: { type: 'string', required: true, description: '状态名' },
        code: { type: 'string', required: true, description: '0/1 编码串' },
      },
    },
  },
} as const

export interface FsmArgs {
  op: FsmOp
  type: FsmSpec['type']
  states: string[]
  inputs: number
  outputs: number
  transitions: FsmTransition[]
  ff?: FfType
  encoding?: EncodingKind | 'custom'
  codes?: { state: string; code: string }[]
}

export type FsmResult = FsmResultMap[FsmOp]

export function specFromFsmArgs(args: FsmArgs): FsmSpec {
  return {
    type: args.type,
    states: args.states,
    inputs: args.inputs,
    outputs: args.outputs,
    transitions: args.transitions,
  }
}

/** 自定义编码（若给出 codes）：状态名 → 编码串。 */
function customOf(args: FsmArgs): Record<string, string> | undefined {
  if (!Array.isArray(args.codes)) return undefined
  const map: Record<string, string> = {}
  for (const item of args.codes) {
    if (typeof item?.state !== 'string' || typeof item?.code !== 'string') {
      throw new DlogicInputError('codes 的每项须包含 state 与 code。')
    }
    map[item.state] = item.code
  }
  return map
}

function encodingOf(args: FsmArgs): EncodingKind | 'custom' {
  if (args.encoding) return args.encoding
  return customOf(args) ? 'custom' : 'binary'
}

function reduceSteps(r: ReduceResult): Step[] {
  if (r.complete) {
    return [
      {
        kind: 'implication',
        text: '完全给定：列隐含表，输出不同的状态对直接标为不等价，其余状态对逐轮按次态对的结论标记，最后未标记的状态对即为等价。',
      },
    ]
  }
  return [
    {
      kind: 'compatible',
      text: '不完全给定：输出不冲突且次态对相容的状态对为相容对，求出最大相容类，再选取满足闭合条件的最小闭覆盖。',
    },
  ]
}

export function runFsm(args: FsmArgs): Envelope<FsmResult> {
  return envelope<FsmResult>(String(args.op), () => {
    const spec = specFromFsmArgs(args)
    switch (args.op) {
      case 'reduce': {
        const reduce = reduceFsm(spec)
        return { result: { spec, reduce }, steps: reduceSteps(reduce) }
      }
      case 'assign': {
        const assign = assignStates(spec, customOf(args))
        return {
          result: { spec, assign },
          steps: [
            {
              kind: 'adjacency',
              text: '相邻编码原则：规则 1 为同一现态在不同输入下的两个次态，规则 2 为同一输入下有相同次态的两个现态；评分为这些相邻对的汉明距离之和，越小越好。',
            },
          ],
        }
      }
      case 'synthesize': {
        const ff: FfType = args.ff ?? 'D'
        const synthesis = synthesize(spec, ff, encodingOf(args), customOf(args))
        return {
          result: { spec, synthesis },
          steps: [{ kind: 'excitation', text: `按 ${ff} 触发器列激励表，化简各激励函数与输出函数；未使用的编码与未给定的项作为无关项。` }],
        }
      }
      case 'self_start': {
        const ff: FfType = args.ff ?? 'D'
        const selfStartResult = selfStart(spec, ff, encodingOf(args), customOf(args))
        return {
          result: { spec, selfStart: selfStartResult },
          steps: [{ kind: 'selfStart', text: '自启动检查：保持输入为某一固定组合，从每个无效编码出发，沿次态应能进入有效编码。' }],
        }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

function codesLine(codes: { state: string; code: string }[]): string {
  return codes.map(c => `${c.state}=${c.code}`).join('，')
}

function renderSynth(s: SynthesizeResult, lines: string[]): void {
  lines.push(`编码：${codesLine(s.codes)}`)
  for (const f of s.functions) {
    const more = f.texts.length > 1 ? `（共 ${f.texts.length} 个等价最简解：${f.texts.join('；')}）` : ''
    lines.push(`${f.name} = ${f.text}${more}`)
  }
}

function renderReduce(r: ReduceResult, lines: string[]): void {
  if (r.complete) {
    lines.push(`完全给定，等价类：${r.classes.map(c => (c.length > 1 ? `{${c.join(',')}}` : c[0])).join('，')}`)
  } else {
    lines.push(`不完全给定，最大相容类：${r.classes.map(c => `{${c.join(',')}}`).join('，')}`)
    lines.push(`最小闭覆盖：${(r.cover ?? []).map(c => `{${c.join(',')}}`).join('，')}`)
  }
  lines.push(`化简后 ${r.reducedCount} 个状态`)
  for (const t of r.reduced.transitions) lines.push(`  ${t.from} 输入 ${t.input} → ${t.to} 输出 ${t.output}`)
}

function renderSelfStart(r: SelfStartResult, lines: string[]): void {
  lines.push(r.selfStarting ? '自启动：能' : '自启动：不能')
  if (!r.selfStarting) {
    for (const row of r.rewritten) lines.push(`  无效编码 ${row.code} 的次态改为 ${row.to}`)
    lines.push(r.fixed ? '修正后自启动：能' : '修正后自启动：仍不能')
    renderSynth(r.synthesis, lines)
  }
}

export function renderFsm(value: Envelope<FsmResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  const r = value.result
  switch (value.op as FsmOp) {
    case 'reduce':
      renderReduce((r as FsmResultMap['reduce']).reduce, lines)
      break
    case 'assign': {
      const a = (r as FsmResultMap['assign']).assign
      lines.push(`相邻对：${a.pairs.map(p => `${p.a}-${p.b}`).join('，') || '无'}`)
      for (const e of a.encodings) {
        lines.push(`${e.kind}（${e.bits} 位）：${codesLine(e.codes)}；评分 ${e.score}，相邻对满足 ${e.satisfied}/${e.total}`)
      }
      lines.push(`评分最小：${a.best}`)
      break
    }
    case 'synthesize':
      renderSynth((r as FsmResultMap['synthesize']).synthesis, lines)
      break
    case 'self_start':
      renderSelfStart((r as FsmResultMap['self_start']).selfStart, lines)
      break
    default:
      lines.push('未知的 op')
  }
  return lines.join('\n')
}
