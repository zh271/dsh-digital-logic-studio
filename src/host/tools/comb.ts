// dlogic_comb：组合逻辑的确定性计算（门级网表分析、MSI 芯片映射）。纯逻辑见 comb.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { COMB_PARAMETERS, renderCombForHost, runComb, type CombArgs, type CombResult } from './comb.logic.ts'

const DESCRIPTION = [
  '组合逻辑的确定性计算。op 取值：analyze 由门级网表（inputs 与 gates，最多 6 个输入、20 个门）逐级推导每个门的式子，',
  '给出各输出的最终式、真值表与化简结果；draw 由表达式（expr，可配 variables 与 outputName）画两级门逻辑图并同样分析，',
  '非与或式时取最简与或式（结果中给出提示）；map_msi 用 74LS138/139/148/151/153/85/283/280 实现指定函数或功能，',
  '给出国标引脚名、别名、有效电平与接线表；151/153 另给出降维真值表与数据端取值（0、1、变量或其反变量）。',
  '门 type 取 AND/OR/NOT/NAND/NOR/XOR/XNOR。函数输入二选一：expr（可配 variables），或 minterms + dontCares + variables（variables[0] 为最高位）。',
].join('')

export const dlogicComb = defineTool({
  name: 'dlogic_comb',
  description: DESCRIPTION,
  parameters: COMB_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: CombArgs, value: Envelope<CombResult>) => [{ type: 'text', text: renderCombForHost(value) }],
    presentationMeta: (_args: CombArgs, value: Envelope<CombResult>) => ({ v: 1, tool: 'dlogic_comb', value }),
  },
  async execute(args: CombArgs) {
    return runComb(args)
  },
})
