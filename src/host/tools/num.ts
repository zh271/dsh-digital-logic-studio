// dlogic_num：进制转换工具。
import { defineTool } from '@deepseek-ai/dsh-tools'
import { convertBase, type ConvertMethod, type ConvertResult, type NumStep } from '../../solvers/num.ts'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA, envelope } from '../envelope.ts'

type NumResult = Omit<ConvertResult, 'steps'>

interface NumArgs {
  op: string
  value: string
  from: number
  to: number
  precision?: number
}

const METHOD_TEXT: Record<ConvertMethod, string> = {
  identity: '源进制与目标进制相同',
  grouping: '二进制分组法',
  'expansion-division': '按权展开 + 除基取余 / 乘基取整',
}

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉'
const sub = (n: number | string): string => String(n).replace(/\d/g, d => SUB_DIGITS[Number(d)])

function renderNum(value: Envelope<NumResult>): string {
  if (!value.ok) return `输入有误：${value.error}`
  const r = value.result as NumResult
  const lines = [
    `(${r.input.value})${sub(r.input.from)} = (${r.result})${sub(r.input.to)}`,
    `十进制值：${r.decimal}`,
    `方法：${METHOD_TEXT[r.method]}${r.exact ? '' : `；小数部分未除尽，已保留 ${r.input.precision} 位`}`,
    '',
    '步骤：',
  ]
  for (const step of value.steps as NumStep[]) {
    lines.push(`- ${step.text}`)
    if (step.kind === 'weighted-expansion') lines.push(`  ${step.terms.join(' + ') || '0'} = ${step.result}`)
    if (step.kind === 'expand-bits') lines.push(`  ${step.binary}`)
    if (step.kind === 'group-bits') {
      lines.push(`  ${step.intGroups.join(' ')}${step.fracGroups.length ? ' . ' + step.fracGroups.join(' ') : ''}`)
    }
    if (step.kind === 'int-division') {
      for (const row of step.rows) lines.push(`  ${row.dividend} ÷ ${r.input.to} = ${row.quotient} …… ${row.digit}`)
    }
    if (step.kind === 'frac-multiplication') {
      for (const row of step.rows) lines.push(`  ${row.value} × ${r.input.to} = ${row.product} → ${row.digit}`)
    }
  }
  return lines.join('\n')
}

export const dlogicNum = defineTool({
  name: 'dlogic_num',
  description: [
    '数字逻辑：数制与编码的确定性计算引擎。',
    '当前支持 op=convert：任意 2～36 进制之间的数值转换（含小数和负数），返回结果和教材格式的分步过程',
    '（按权展开、除基取余、乘基取整、二进制分组）。',
    '凡是进制转换都必须调用本工具，不要心算。',
  ].join(''),
  parameters: {
    op: { type: 'string', enum: ['convert'], required: true, description: '子功能' },
    value: { type: 'string', required: true, description: '待转换的数，例如 "1011.101"、"-25"、"3AF"' },
    from: { type: 'integer', required: true, description: '源进制，2～36' },
    to: { type: 'integer', required: true, description: '目标进制，2～36' },
    precision: { type: 'integer', description: '小数部分最多保留的位数，默认 8，上限 32' },
  },
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: NumArgs, value: Envelope<NumResult>) => [{ type: 'text', text: renderNum(value) }],
    presentationMeta: (_args: NumArgs, value: Envelope<NumResult>) => ({ v: 1, tool: 'dlogic_num', value }),
  },
  async execute(args: NumArgs) {
    return envelope<NumResult>(args.op, () => {
      const r = convertBase({ value: args.value, from: args.from, to: args.to, precision: args.precision ?? 8 })
      const { steps, ...result } = r
      return { result, steps }
    })
  },
})
