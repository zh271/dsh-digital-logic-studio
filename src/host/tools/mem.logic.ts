// dlogic_mem 的纯逻辑：参数结构、求解分派与中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope } from '../../shared/contracts.ts'
import type { MemOp, MemResultMap, LutResult, PlaResult, ExpandResult, RomResult } from '../../shared/mem.ts'
import {
  expandMemory,
  lutMap,
  plaFunction,
  romFunction,
  type OutputRequest,
} from '../../solvers/mem.ts'
import { envelope } from '../envelope.ts'

export const MEM_OPS: MemOp[] = ['expand', 'rom_func', 'pla', 'pal', 'lut']

const OUTPUT_ITEM = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', description: '输出名，省略时依次为 F1、F2 ……' },
    expr: { type: 'string', description: '函数表达式，例如 "AB + A\'C"；与 minterms 二选一。' },
    minterms: { type: 'array', items: { type: 'integer' }, description: '最小项编号（variables[0] 为最高位）。' },
    dontCares: { type: 'array', items: { type: 'integer' }, description: '无关项编号（ROM 与 LUT 不利用，按 0 处理）。' },
  },
} as const

export const MEM_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...MEM_OPS],
    description:
      'expand 存储器位/字/字位扩展；rom_func 用 ROM 实现多输出函数；pla / pal 用可编程阵列实现多输出函数；lut 求 LUT4 的 16 位配置掩码。',
  },
  targetWords: { type: 'integer', description: 'expand：目标存储器字数（2 的幂）。' },
  targetBits: { type: 'integer', description: 'expand：目标存储器位数（每字的位数）。' },
  chipWords: { type: 'integer', description: 'expand：芯片字数（2 的幂，不大于目标字数）。' },
  chipBits: { type: 'integer', description: 'expand：芯片位数（整除目标位数）。' },
  decode: {
    type: 'string',
    enum: ['single', 'double'],
    description:
      'expand：仅当用户明确要求单译码或双译码结构时才传；纯芯片扩展题（只问用几片、地址怎么接、片选怎么译）不要传，结果中不会出现“译码结构”块。',
  },
  rowBits: { type: 'integer', description: 'expand 双译码：行译码位数，默认取地址位数的一半。' },
  variables: {
    type: 'array',
    items: { type: 'string' },
    description: 'rom_func / pla / pal / lut：变量列表（variables[0] 为最高位）。使用 minterms 时必填。',
  },
  outputs: {
    type: 'array',
    items: OUTPUT_ITEM,
    description: 'rom_func / pla / pal：输出函数列表（至多 8 个），每个给 expr 或 minterms。',
  },
  termsPerOutput: {
    type: 'integer',
    description: 'pal：每个输出固定的乘积项数，1 到 8，默认 8。',
  },
  expr: { type: 'string', description: 'lut：4 变量以内的函数表达式。与 minterms 二选一。' },
  minterms: { type: 'array', items: { type: 'integer' }, description: 'lut：最小项编号，与 variables 一起使用。' },
  dontCares: { type: 'array', items: { type: 'integer' }, description: 'lut：无关项编号（按 0 处理）。' },
} as const

export interface MemArgs {
  op: MemOp
  targetWords?: number
  targetBits?: number
  chipWords?: number
  chipBits?: number
  decode?: 'single' | 'double'
  rowBits?: number
  variables?: string[]
  outputs?: OutputRequest[]
  termsPerOutput?: number
  expr?: string
  minterms?: number[]
  dontCares?: number[]
}

export type MemResult = MemResultMap[MemOp]

export function runMem(args: MemArgs): Envelope<MemResult> {
  return envelope<MemResult>(String(args.op), () => {
    switch (args.op) {
      case 'expand': {
        const { targetWords, targetBits, chipWords, chipBits } = args
        if (
          typeof targetWords !== 'number' ||
          typeof targetBits !== 'number' ||
          typeof chipWords !== 'number' ||
          typeof chipBits !== 'number'
        ) {
          throw new DlogicInputError('expand 需要提供 targetWords、targetBits、chipWords、chipBits（均为正整数）。')
        }
        const out = expandMemory({
          targetWords,
          targetBits,
          chipWords,
          chipBits,
          decode: args.decode,
          rowBits: args.rowBits,
        })
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      case 'rom_func': {
        const out = romFunction(args.variables, args.outputs)
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      case 'pla':
      case 'pal': {
        const out = plaFunction(args.variables, args.outputs, args.op, args.op === 'pal' ? (args.termsPerOutput ?? 8) : 0)
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      case 'lut': {
        const out = lutMap({ variables: args.variables, expr: args.expr, minterms: args.minterms, dontCares: args.dontCares })
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

const ROW_LIMIT = 64

function renderExpand(r: ExpandResult, lines: string[]): void {
  lines.push(
    `目标 ${r.target.words}×${r.target.bits}（${r.target.capacity} 位），芯片 ${r.chip.words}×${r.chip.bits}，共 ${r.chipCount} 片（字向 ${r.wordGroups} 组，位向 ${r.bitGroups} 组）`,
  )
  lines.push(`芯片地址线：${r.chipAddressLines.join('、')}`)
  if (r.selectLines.length) lines.push(`片选译码输入：${r.selectLines.join('、')}`)
  for (const c of r.chips) {
    lines.push(`第 ${c.index} 片：字组 ${c.wordGroup}，数据位 D${c.dataHigh}～D${c.dataLow}，片选 ${c.select}`)
  }
  for (const a of r.addressMap) {
    lines.push(`字组 ${a.wordGroup}（第 ${a.chips.join('、')} 片）：${a.lowHex}～${a.highHex}`)
  }
  if (r.decoder) {
    for (const w of r.decoder.wiring) lines.push(`138 ${w.pin} ← ${w.signal}`)
  }
  if (r.decode) lines.push(r.decode.note)
}

function renderRom(r: RomResult, lines: string[]): void {
  lines.push(`容量 ${r.size.words}×${r.size.bits}（${r.size.capacity} 位），输出 ${r.outputNames.join('、')}`)
  for (const f of r.functions) lines.push(f.text)
  lines.push(`地址（${r.variables.join(' ')}）| 数据（${r.outputNames.join(' ')}）| 十六进制`)
  for (const row of r.rows.slice(0, ROW_LIMIT)) lines.push(`${row.addressBits} | ${row.word} | ${row.hex}H`)
  if (r.rows.length > ROW_LIMIT) lines.push(`共 ${r.rows.length} 行，逐行略去。`)
}

function renderPla(r: PlaResult, lines: string[]): void {
  lines.push(`变量：${r.variables.join(' ')}；乘积项 ${r.cost.terms} 个，文字 ${r.cost.literals} 个`)
  if (r.termsPerOutput !== null) lines.push(`或阵列固定：每输出 ${r.termsPerOutput} 个乘积项`)
  for (const t of r.terms) lines.push(`${t.label} = ${t.text}（接入 ${t.usedBy.join('、')}）`)
  for (const o of r.outputs) lines.push(`${o.name} = ${o.text}`)
}

function renderLut(r: LutResult, lines: string[]): void {
  if (r.kind === 'single') {
    lines.push(`掩码（高位在前）：${r.mask}`, `十六进制：${r.hex}H`)
    for (const p of r.pins) lines.push(`${p.pin} ← ${p.signal}`)
    return
  }
  lines.push(`拆分：按 ${r.splitVars.join('、')} 展开，子函数输入 ${r.lutVars.join('、')}`)
  for (const cf of r.cofactors) lines.push(`${cf.assignment}：${cf.mask}（${cf.hex}H）`)
}

export function renderMem(value: Envelope<MemResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  if (value.op === 'expand') renderExpand(value.result as ExpandResult, lines)
  else if (value.op === 'rom_func') renderRom(value.result as RomResult, lines)
  else if (value.op === 'pla' || value.op === 'pal') renderPla(value.result as PlaResult, lines)
  else if (value.op === 'lut') renderLut(value.result as LutResult, lines)
  else lines.push('（无可显示的结果）')
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
