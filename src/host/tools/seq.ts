// dlogic_seq：触发器、时序电路分析、计数器、移位寄存器与时序波形的确定性计算工具。纯逻辑见 seq.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { SEQ_PARAMETERS, renderSeq, runSeq, type SeqArgs, type SeqResult } from './seq.logic.ts'

const DESCRIPTION = [
  '时序逻辑的确定性计算引擎。触发器特性方程、特性表与激励表，同步时序电路的分析，160/161/163 计数器设计，',
  '移位寄存器与环形、扭环计数器，以及时序波形，都必须通过本函数计算，不得心算或手写。',
  'op 取值：ff 触发器（ffKind：SR、D、JK、T、SR_LATCH、GATED_SR、GATED_D）；analyze 同步时序电路分析（flipflops、inputs、outputs、init，',
  '驱动表达式的变量为 Q 名与输入名，输出状态方程、状态表、状态图、有效循环、自启动与无效状态流向，最多 4 个触发器、2 个输入）；',
  'counter 模 N 计数器（model、method、N，超过一片时自动两片级联）；shift 移位寄存器与环形、扭环计数器（shiftKind、bits、init、direction、serial）；',
  'waveform 时序波形（target 指定电路类型，其余参数同对应 op，waves 给出输入波形）。',
  '表达式语法：非号用后缀 \' 或前缀 ! ~；与可并列书写或用 * ·；或用 +；异或用 ⊕ 或 ^；同或用 ⊙；括号 ( )。',
].join('')

export const dlogicSeq = defineTool({
  name: 'dlogic_seq',
  description: DESCRIPTION,
  parameters: SEQ_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: SeqArgs, value: Envelope<SeqResult>) => [{ type: 'text', text: renderSeq(value) }],
    presentationMeta: (_args: SeqArgs, value: Envelope<SeqResult>) => ({ v: 1, tool: 'dlogic_seq', value }),
  },
  async execute(args: SeqArgs) {
    return runSeq(args)
  },
})
