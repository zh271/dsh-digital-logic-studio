// dlogic_hdl：Verilog 静态检查与仿真。纯逻辑与进程编排见 hdl.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import type { HdlResult } from '../../shared/hdl.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { HDL_PARAMETERS, renderHdl, runHdl, type HdlArgs } from './hdl.logic.ts'

const DESCRIPTION = [
  'Verilog 的静态检查与仿真。op 取值：lint 静态检查，先用 iverilog 的 -Wall 取错误与警告，再做规则匹配（推断锁存器、组合块用 <=、时序块用 =、多驱动）；',
  '未安装 iverilog 时只做规则匹配，结果中 engine 为 rules 并附降级说明。simulate 在临时目录编译运行 testbench（需要 iverilog），返回 $display 输出与信号变化，',
  '有上限：墙钟约 10 秒、输出约 20 KB、VCD 约 1 MB，禁止 $system、文件读写类任务与 `include。',
  '设计与 testbench 放在同一段 code 中；top 缺省时自动识别顶层。无需在 testbench 里写 $dumpfile/$dumpvars，仿真会自动记录波形。',
].join('')

export const dlogicHdl = defineTool({
  name: 'dlogic_hdl',
  description: DESCRIPTION,
  parameters: HDL_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: HdlArgs, value: Envelope<HdlResult>) => [{ type: 'text', text: renderHdl(value) }],
    presentationMeta: (_args: HdlArgs, value: Envelope<HdlResult>) => ({ v: 1, tool: 'dlogic_hdl', value }),
  },
  async execute(args: HdlArgs) {
    return runHdl(args)
  },
})
