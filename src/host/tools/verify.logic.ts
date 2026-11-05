// dlogic_verify 的纯逻辑：参数结构、核对分派与中文渲染。不依赖 DSH。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope, VerifyResult } from '../../shared/contracts.ts'
import type { Form } from '../../solvers/bool.ts'
import { checkAnswer } from '../../solvers/verify.ts'
import { envelope } from '../envelope.ts'
import { describeAssignment, specFromArgs } from './bool.logic.ts'

export const VERIFY_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: ['check'],
    description: '子功能：check 核对候选答案',
  },
  candidate: {
    type: 'string',
    required: true,
    description: '待核对的表达式（学生或模型给出的答案），语法同 dlogic_bool。只能使用参考函数中的变量。',
  },
  expr: {
    type: 'string',
    description: '参考函数（原题函数）的表达式。与 minterms 二选一。',
  },
  minterms: {
    type: 'array',
    items: { type: 'integer' },
    description: '参考函数的最小项编号，需与 variables 一起使用。',
  },
  dontCares: {
    type: 'array',
    items: { type: 'integer' },
    description: '参考函数的无关项编号。',
  },
  variables: {
    type: 'array',
    items: { type: 'string' },
    description: '参考函数的变量（variables[0] 为最高位）。',
  },
  requireMinimal: {
    type: 'boolean',
    description: '为 true 时还判断候选式是否达到最简（按项数、其次文字数比较）。',
  },
  form: {
    type: 'string',
    enum: ['SOP', 'POS'],
    description: '比较代价所用的形式，默认 SOP。',
  },
  reveal: {
    type: 'boolean',
    description: '为 true 时才返回参考答案。导学（苏格拉底）模式下必须为 false。',
  },
} as const

export interface VerifyArgs {
  op: string
  candidate: string
  expr?: string
  minterms?: number[]
  dontCares?: number[]
  variables?: string[]
  requireMinimal?: boolean
  form?: Form
  reveal?: boolean
}

export function runVerify(args: VerifyArgs): Envelope<VerifyResult> {
  return envelope<VerifyResult>(String(args.op), () => {
    if (args.op !== 'check') throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    const reference = specFromArgs(args, '参考函数')
    const result = checkAnswer({
      candidate: args.candidate,
      reference,
      requireMinimal: args.requireMinimal === true,
      form: args.form ?? 'SOP',
      reveal: args.reveal === true,
    })
    return { result }
  })
}

export function renderVerify(value: Envelope<VerifyResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const r = value.result
  const lines: string[] = []

  lines.push(r.equivalent ? '结论：候选式与参考函数等价（所有取值上输出一致）。' : '结论：候选式与参考函数不等价。')
  if (!r.equivalent && r.counterexample) {
    const ce = r.counterexample
    lines.push(
      `反例：当 ${describeAssignment(r.variables, ce.inputs)} 时，候选式为 ${ce.left}，原函数为 ${ce.right}。`,
    )
  }

  if (r.minimal !== undefined) {
    const costText = r.candidateCost
      ? `${r.candidateCost.terms} 项 ${r.candidateCost.literals} 个文字`
      : '不是标准形式'
    if (r.minimal === true) {
      lines.push(`最简性：达到最简（${costText}）。`)
    } else if (r.minimal === false) {
      if (!r.equivalent) {
        lines.push('最简性：候选式不等价，无需比较代价。')
      } else {
        const best = r.minimalCost
        lines.push(
          `最简性：未达到最简。候选式为 ${costText}，最简为 ${best ? `${best.terms} 项 ${best.literals} 个文字` : '未知'}。`,
        )
      }
    } else {
      lines.push('最简性：候选式不是与或式或或与式，无法比较是否最简。')
    }
  }

  if (r.reference) {
    lines.push('参考答案：')
    for (const t of r.reference.texts) lines.push(`  F = ${t}`)
  }

  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
