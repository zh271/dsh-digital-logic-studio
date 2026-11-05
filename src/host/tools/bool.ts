// dlogic_bool：布尔函数的确定性计算工具。纯逻辑见 bool.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { BOOL_PARAMETERS, renderBool, runBool, type BoolArgs, type BoolResult } from './bool.logic.ts'

const DESCRIPTION = [
  '布尔函数的确定性计算引擎。凡是 3 变量及以上的化简、真值表、卡诺图、险象判断、等价判断，以及 2 变量的化简核对，',
  '都必须调用本工具，不得心算或手写。op 取值：parse 解析并列出最小项；truth_table 真值表；canonical 标准与或式与标准或与式；',
  'minimize 全部最简解与代价（form 选 SOP 或 POS）；kmap 卡诺图布局与圈组；hazard 静态 0/1 型险象与消去项；',
  'complement 反演式；dual 对偶式；gate_form 与非-与非、或非-或非、与或非形式；equivalent 判断 expr 与 other 是否等价。',
  '表达式语法：非号用后缀 \' 或前缀 ! ~ ¬；与可并列书写或用 * · &；或用 +；异或用 ⊕ 或 ^；同或用 ⊙；括号 ( )。',
  '例如 "A\'B + AB\'"。函数输入二选一：expr（可配 variables），或 minterms + dontCares + variables（variables[0] 为最高位）。',
].join('')

export const dlogicBool = defineTool({
  name: 'dlogic_bool',
  description: DESCRIPTION,
  parameters: BOOL_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: BoolArgs, value: Envelope<BoolResult>) => [{ type: 'text', text: renderBool(value) }],
    presentationMeta: (_args: BoolArgs, value: Envelope<BoolResult>) => ({ v: 1, tool: 'dlogic_bool', value }),
  },
  async execute(args: BoolArgs) {
    return runBool(args)
  },
})
