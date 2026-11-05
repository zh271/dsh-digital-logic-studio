// dlogic_system：数字系统（ASM 图与小型控制器）的确定性计算。纯逻辑见 system.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { SYSTEM_PARAMETERS, renderSystem, runSystem, type SystemArgs, type SystemResult } from './system.logic.ts'

const DESCRIPTION = [
  '数字系统的确定性计算。op 取值：asm 校验 ASM 图（状态框、判断框的出口与条件输出框），检查出口条件互斥与完备（缺少 else）、不可达状态与悬空状态，并给出等价的状态转移表；',
  'controller 按计数器型（状态编码为计数序列，计数器加 1 或置数，给出译码输出与计数、置数条件）、多路选择器型（每个状态位的次态由 MUX 选择，给出数据端表达式）、',
  '定序型（一态一位，给出次态表达式）三种方案设计控制器，给出状态编码表、控制信号真值表、次态表达式（全部等价最简解）与所需器件清单。',
  'ASM 图以 JSON 描述：states（至多 12 个，每项含 name、outputs 与 conditionals）与 transitions（每项 {from, cond, to}，cond 为条件表达式，或 else / 1）；条件变量至多 4 个。',
  '未通过校验的 ASM 图不生成控制器。',
].join('')

export const dlogicSystem = defineTool({
  name: 'dlogic_system',
  description: DESCRIPTION,
  parameters: SYSTEM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: SystemArgs, value: Envelope<SystemResult>) => [{ type: 'text', text: renderSystem(value) }],
    presentationMeta: (_args: SystemArgs, value: Envelope<SystemResult>) => ({ v: 1, tool: 'dlogic_system', value }),
  },
  async execute(args: SystemArgs) {
    return runSystem(args)
  },
})
