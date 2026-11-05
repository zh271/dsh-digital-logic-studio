// dlogic_verify：候选答案核对工具。纯逻辑见 verify.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope, VerifyResult } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { renderVerify, runVerify, VERIFY_PARAMETERS, type VerifyArgs } from './verify.logic.ts'

const DESCRIPTION = [
  '核对候选答案（学生或模型给出的表达式）：判断它与参考函数是否等价，给出反例；requireMinimal 为 true 时还判断是否达到最简。',
  '参考函数用 expr，或 minterms + variables（与 dlogic_bool 相同）。候选式只能使用参考函数的变量。',
  '最终结论前必须以 requireMinimal: true 核对。',
  '导学（苏格拉底）模式下 reveal 必须为 false：参考答案不得透露给学生，只用 counterexample 引导思考。',
  '只有解题核验模式下，学生明确要求看答案时才可设 reveal: true。',
].join('')

export const dlogicVerify = defineTool({
  name: 'dlogic_verify',
  description: DESCRIPTION,
  parameters: VERIFY_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: VerifyArgs, value: Envelope<VerifyResult>) => [{ type: 'text', text: renderVerify(value) }],
    presentationMeta: (_args: VerifyArgs, value: Envelope<VerifyResult>) => ({ v: 1, tool: 'dlogic_verify', value }),
  },
  async execute(args: VerifyArgs) {
    return runVerify(args)
  },
})
