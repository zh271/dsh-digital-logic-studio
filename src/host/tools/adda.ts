// dlogic_adda：D/A、A/D 转换与量化、采样判断的确定性计算。纯逻辑见 adda.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { ADDA_PARAMETERS, renderAdda, runAdda, type AddaArgs } from './adda.logic.ts'
import type { AddaResult } from '../../shared/adda.ts'

const DESCRIPTION = [
  '数模与模数转换的确定性计算。op 取值：dac 由数字量求输出电压（权电阻、R-2R T 型、R-2R 倒 T 型，给出公式、代入式、1LSB 与满量程）；',
  'adc_sar 逐次逼近过程表（每次试探码、DAC 输出、比较结果、保留或清除）；adc_flash 并行比较器参考电压与温度计码；',
  'adc_dual 双积分的 T2、计数值、最大转换时间与工频抗干扰；quantize 量化等级、数字码、误差范围，',
  '可按误差要求反求最少位数，并按采样定理判断采样频率。舍尾法 Δ = VREF/2^n，四舍五入法 Δ = 2VREF/(2^(n+1)-1)。位数 n 不超过 16。',
].join('')

export const dlogicAdda = defineTool({
  name: 'dlogic_adda',
  description: DESCRIPTION,
  parameters: ADDA_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: AddaArgs, value: Envelope<AddaResult>) => [{ type: 'text', text: renderAdda(value) }],
    presentationMeta: (_args: AddaArgs, value: Envelope<AddaResult>) => ({ v: 1, tool: 'dlogic_adda', value }),
  },
  async execute(args: AddaArgs) {
    return runAdda(args)
  },
})
