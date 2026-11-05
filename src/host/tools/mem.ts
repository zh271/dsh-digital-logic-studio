// dlogic_mem：存储器扩展、ROM 实现函数、PLA / PAL 阵列、LUT 掩码。纯逻辑见 mem.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { MEM_PARAMETERS, renderMem, runMem, type MemArgs, type MemResult } from './mem.logic.ts'

const DESCRIPTION = [
  '存储器与可编程逻辑的确定性计算。op 取值：',
  'expand 位扩展、字扩展、字位扩展（给出目标 targetWords×targetBits 与芯片 chipWords×chipBits，',
  '返回芯片数、地址线分配、138 片选接线与地址映射表；仅当用户明确要求单译码或双译码结构时才传 decode）；',
  'rom_func 用 ROM 实现多输出函数，返回地址—数据表；',
  'pla 用 PLA 实现多输出函数，共用乘积项，返回与阵列、或阵列点阵；pal 同理但或阵列每输出固定项数（termsPerOutput）；',
  'lut 求 LUT4 的 16 位配置掩码（4 变量以内），5～6 变量时给出香农展开的拆分方案。',
  '函数输入：rom_func、pla、pal 用 variables（variables[0] 为最高位）加 outputs；lut 用 expr 或 variables 加 minterms。',
].join('')

export const dlogicMem = defineTool({
  name: 'dlogic_mem',
  description: DESCRIPTION,
  parameters: MEM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: MemArgs, value: Envelope<MemResult>) => [{ type: 'text', text: renderMem(value) }],
    presentationMeta: (_args: MemArgs, value: Envelope<MemResult>) => ({ v: 1, tool: 'dlogic_mem', value }),
  },
  async execute(args: MemArgs) {
    return runMem(args)
  },
})
