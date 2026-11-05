// dlogic_system 的纯逻辑：参数结构、ASM 校验与控制器设计的分派、中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope, Step } from '../../shared/contracts.ts'
import type { AsmSpec, SystemOp, SystemResultMap } from '../../shared/system.ts'
import { analyzeAsm, designController } from '../../solvers/system.ts'
import { envelope } from '../envelope.ts'

export const SYSTEM_OPS: SystemOp[] = ['asm', 'controller']

export const SYSTEM_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...SYSTEM_OPS],
    description: '子功能：asm 校验 ASM 图并给出状态转移表；controller 按计数器型、多路选择器型、定序型三种方案设计控制器',
  },
  states: {
    type: 'array',
    required: true,
    description: '状态框列表（至多 12 个）。顺序即编码顺序；默认第一个为初始状态。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string', required: true, description: '状态名，例如 "S0"' },
        outputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Moore 型输出（寄存器操作或控制信号名），进入本状态即有效',
        },
        conditionals: {
          type: 'array',
          description: '条件输出框：name 为输出名，expr 为使其有效的条件表达式',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', required: true, description: '条件输出名' },
              expr: { type: 'string', required: true, description: '条件表达式，变量须为条件变量' },
            },
          },
        },
      },
    },
  },
  transitions: {
    type: 'array',
    required: true,
    description: '判断框的出口列表。同一现态的各出口条件须互斥且完备；可用 else 表示其余情况，1 表示无条件。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        from: { type: 'string', required: true, description: '现态' },
        cond: { type: 'string', required: true, description: '条件表达式（变量间用 * 或 · 或 & 连接，取反用 \' 或 ! 前缀），或 else / 1' },
        to: { type: 'string', required: true, description: '次态' },
      },
    },
  },
  initial: {
    type: 'string',
    description: '初始状态名，省略时取 states 的第一个',
  },
  conditionVars: {
    type: 'array',
    items: { type: 'string' },
    description: '条件变量的排列顺序（至多 4 个），省略时按表达式中首次出现的顺序',
  },
} as const

export interface SystemArgs {
  op: SystemOp
  states: { name: string; outputs?: string[]; conditionals?: { name: string; expr: string }[] }[]
  transitions: { from: string; cond: string; to: string }[]
  initial?: string
  conditionVars?: string[]
}

export type SystemResult = SystemResultMap[SystemOp]

export function specFromSystemArgs(args: SystemArgs): AsmSpec {
  if (!Array.isArray(args.states)) throw new DlogicInputError('states 必须是数组')
  if (!Array.isArray(args.transitions)) throw new DlogicInputError('transitions 必须是数组')
  return {
    states: args.states.map(s => ({
      name: s.name,
      outputs: Array.isArray(s.outputs) ? s.outputs : [],
      conditionals: Array.isArray(s.conditionals) ? s.conditionals : [],
    })),
    transitions: args.transitions,
    initial: args.initial,
    conditionVars: args.conditionVars,
  }
}

const ASM_STEPS: Step[] = [
  { kind: 'asmCheck', text: '逐状态检查出口条件：两两互斥，并覆盖全部取值（else 补足其余取值）。' },
  { kind: 'asmReach', text: '从初始状态出发检查可达性，并检查是否存在没有出口的悬空状态。' },
  { kind: 'asmTable', text: '按条件变量的全部取值列出状态转移表，与 ASM 图等价。' },
]

const CONTROLLER_STEPS: Step[] = [
  { kind: 'controllerEncode', text: '三种方案：计数器型按计数序列编码，多路选择器型用二进制编码，定序型一态一位。' },
  { kind: 'controllerMinimize', text: '次态与控制函数以最小项表示，未用编码作无关项，用 minimize 化简并列出全部等价最简解。' },
]

export function runSystem(args: SystemArgs): Envelope<SystemResult> {
  return envelope<SystemResult>(String(args.op), () => {
    const spec = specFromSystemArgs(args)
    switch (args.op) {
      case 'asm': {
        const asm = analyzeAsm(spec)
        return { result: { spec, asm }, steps: ASM_STEPS }
      }
      case 'controller': {
        const controller = designController(spec)
        return { result: { spec, controller }, steps: CONTROLLER_STEPS }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

function renderAsm(value: Envelope<SystemResultMap['asm']>, lines: string[]): void {
  const a = value.result as SystemResultMap['asm']
  const r = a.asm
  lines.push(r.valid ? 'ASM 图校验通过' : `ASM 图存在 ${r.issues.filter(i => i.level === 'error').length} 处错误`)
  for (const issue of r.issues) lines.push(`${issue.level === 'error' ? '错误' : '提示'}：${issue.message}`)
  lines.push(`条件变量：${r.conditionVars.join('、') || '无'}；初始状态：${r.initial}`)
  const head = ['状态', ...r.table.combos]
  lines.push(head.join(' | '))
  for (const row of r.table.rows) {
    const cells = row.cells.map(c => {
      const tail = c.active.length > 0 ? `（${c.active.join('、')}）` : ''
      return `${c.next ?? '—'}${tail}`
    })
    lines.push([row.state, ...cells].join(' | '))
  }
}

function renderController(value: Envelope<SystemResultMap['controller']>, lines: string[]): void {
  const x = value.result as SystemResultMap['controller']
  const c = x.controller
  lines.push(`状态：${c.states.join('、')}；初始状态：${c.initial}；条件变量：${c.conditionVars.join('、') || '无'}`)
  lines.push(`控制信号：${c.signals.join('、') || '无'}`)
  for (const row of c.controlTable) lines.push(`${row.state}：${row.values.map((v, i) => `${c.signals[i]}=${v}`).join('，')}`)
  for (const s of c.schemes) {
    lines.push(`【${s.scheme}】寄存器位：${s.bits.join(' ')}；编码：${s.codes.map(k => `${k.state}=${k.code}`).join('，')}`)
    for (const f of s.functions) lines.push(`${f.name} = ${f.texts[0]}${f.texts.length > 1 ? `（另 ${f.texts.length - 1} 个等价解）` : ''}`)
    for (const d of s.devices) lines.push(`器件：${d}`)
  }
}

export function renderSystem(value: Envelope<SystemResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  if (value.op === 'asm') renderAsm(value as Envelope<SystemResultMap['asm']>, lines)
  else if (value.op === 'controller') renderController(value as Envelope<SystemResultMap['controller']>, lines)
  else lines.push('未知的 op')
  return lines.join('\n')
}
