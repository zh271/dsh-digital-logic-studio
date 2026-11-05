// dlogic_fsm：同步时序状态机的确定性计算工具。纯逻辑见 fsm.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { FSM_PARAMETERS, renderFsm, runFsm, type FsmArgs, type FsmResult } from './fsm.logic.ts'

const DESCRIPTION = [
  '同步时序状态机的确定性计算引擎。状态化简、状态编码、激励与输出函数综合、自启动检查均以计算结果为准，不得心算。',
  'op 取值：reduce 状态化简（完全给定用隐含表，不完全给定用相容类与最小闭覆盖）；',
  'assign 状态编码（二进制、格雷、独热，并按相邻编码原则评分）；',
  'synthesize 按 D/JK/T 触发器生成激励表与各激励、输出函数的最简表达式（全部等价解）；',
  'self_start 检查无效编码能否进入有效循环，不能时改写无关项取值并重新化简。',
  '状态机以 JSON 描述：type（mealy 或 moore）、states（状态名，至多 16 个）、inputs 与 outputs（位数，至多 2）、',
  'transitions（每项 {from, input, to, output}，input 与 output 为 0/1/x 串，to 写 x 表示次态未给定，省略的组合视为未给定）。',
].join('')

export const dlogicFsm = defineTool({
  name: 'dlogic_fsm',
  description: DESCRIPTION,
  parameters: FSM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: FsmArgs, value: Envelope<FsmResult>) => [{ type: 'text', text: renderFsm(value) }],
    presentationMeta: (_args: FsmArgs, value: Envelope<FsmResult>) => ({ v: 1, tool: 'dlogic_fsm', value }),
  },
  async execute(args: FsmArgs) {
    return runFsm(args)
  },
})
