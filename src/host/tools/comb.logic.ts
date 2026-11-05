// dlogic_comb 的纯逻辑：参数结构、求解分派与中文渲染。不依赖 DSH，便于测试。
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope } from '../../shared/contracts.ts'
import { renderCombFigureSvg } from '../../shared/figureSvg.ts'
import type { CombOp, CombResultMap, GateSpec, MsiChip, MsiResult } from '../../shared/comb.ts'
import {
  analyzeNetlist,
  analyzeSteps,
  drawExpr,
  GATE_TYPES,
  mapMsi,
  MSI_CHIPS,
  type MsiRequest,
} from '../../solvers/comb.ts'
import { envelope } from '../envelope.ts'

export const COMB_OPS: CombOp[] = ['analyze', 'map_msi', 'draw']

export const COMB_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...COMB_OPS],
    description: 'analyze 门级网表分析；draw 由表达式画门级逻辑图（两级门）并分析；map_msi 用 MSI 芯片实现函数或功能。',
  },
  inputs: {
    type: 'array',
    items: { type: 'string' },
    description: 'analyze：原始输入名列表（最多 6 个），inputs[0] 为真值表的最高位。',
  },
  gates: {
    type: 'array',
    description:
      'analyze：门列表（最多 20 个），每个为 {out, type, in}。type 取 AND / OR / NOT / NAND / NOR / XOR / XNOR；NOT 只有 1 个输入，其余至少 2 个。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        out: { type: 'string', required: true, description: '输出信号名。' },
        type: { type: 'string', required: true, enum: [...GATE_TYPES], description: '门类型。' },
        in: { type: 'array', required: true, items: { type: 'string' }, description: '输入信号名（原始输入或其他门的输出）。' },
      },
    },
  },
  outputs: {
    type: 'array',
    items: { type: 'string' },
    description: 'analyze：要分析的输出信号；省略时取未被其他门使用的门输出。',
  },
  chip: {
    type: 'string',
    enum: [...MSI_CHIPS],
    description: 'map_msi：芯片型号，取 138 / 139 / 148 / 151 / 153 / 85 / 283 / 280。',
  },
  expr: {
    type: 'string',
    description:
      'map_msi：待实现的函数表达式，例如 "A\'B + AB\'"。与 minterms 二选一。draw：要画图的表达式；与或式按原样建网表，否则取最简与或式并给出提示。',
  },
  outputName: {
    type: 'string',
    description: 'draw：输出信号名，默认 F。',
  },
  variables: {
    type: 'array',
    items: { type: 'string' },
    description: '函数变量（按书写顺序，variables[0] 为最高位）。使用 minterms 时必填。',
  },
  minterms: {
    type: 'array',
    items: { type: 'integer' },
    description: 'map_msi：函数的最小项编号（0 起），与 variables 一起使用。',
  },
  dontCares: {
    type: 'array',
    items: { type: 'integer' },
    description: 'map_msi：无关项编号。',
  },
  selectVars: {
    type: 'array',
    items: { type: 'string' },
    description: 'map_msi 用 151 / 153 时：作为选择端的变量（MSB 在前）；省略时取最低位的变量。',
  },
  bits: {
    type: 'integer',
    description: 'map_msi 用 85 时的比较位数，4 的倍数，4～16，默认 4。',
  },
  bcd: {
    type: 'boolean',
    description: 'map_msi 用 283 时：是否做 8421 码（BCD）加法修正。',
  },
} as const

export interface CombArgs {
  op: CombOp
  inputs?: string[]
  gates?: GateSpec[]
  outputs?: string[]
  chip?: string
  expr?: string
  outputName?: string
  variables?: string[]
  minterms?: number[]
  dontCares?: number[]
  selectVars?: string[]
  bits?: number
  bcd?: boolean
}

export type CombResult = CombResultMap[CombOp]

export function runComb(args: CombArgs): Envelope<CombResult> {
  return envelope<CombResult>(String(args.op), () => {
    switch (args.op) {
      case 'analyze': {
        if (!Array.isArray(args.inputs)) throw new DlogicInputError('analyze 需要提供 inputs（输入名列表）。')
        if (!Array.isArray(args.gates)) throw new DlogicInputError('analyze 需要提供 gates（门列表）。')
        const result = analyzeNetlist({
          inputs: args.inputs,
          gates: args.gates,
          outputs: args.outputs,
        })
        return { result, steps: analyzeSteps(result) }
      }
      case 'draw': {
        if (typeof args.expr !== 'string') throw new DlogicInputError('draw 需要提供 expr（表达式）。')
        const out = drawExpr({ expr: args.expr, variables: args.variables, outputName: args.outputName })
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      case 'map_msi': {
        if (typeof args.chip !== 'string') throw new DlogicInputError('map_msi 需要提供 chip（芯片型号）。')
        const req: MsiRequest = {
          chip: args.chip as MsiChip,
          expr: args.expr,
          variables: args.variables,
          minterms: args.minterms,
          dontCares: args.dontCares,
          selectVars: args.selectVars,
          bits: args.bits,
          bcd: args.bcd,
        }
        const out = mapMsi(req)
        return { result: out.result, steps: out.steps, warnings: out.warnings }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

const TRUTH_LIMIT = 32

function renderAnalyze(r: CombResultMap['analyze'], lines: string[]): void {
  lines.push(`输入：${r.inputs.join(', ')}；共 ${r.gates.length} 个门，${r.depth} 级`)
  for (const g of r.gates) {
    const tail = g.expr !== null ? `；代入输入：${g.out} = ${g.expr}` : ''
    lines.push(`第 ${g.level} 级 ${g.out}（${g.type}）：${g.out} = ${g.local}${tail}`)
  }
  for (const f of r.finalExprs) {
    lines.push(`输出 ${f.name} = ${f.expr ?? '（展开式过长，略）'}`)
    lines.push(`化简：${f.name} = ${f.simplified}（${f.cost.terms} 项，${f.cost.literals} 个文字）`)
  }
  const tt = r.truthTable
  lines.push(`真值表（${tt.variables.join(' ')} | ${tt.outputs.join(' ')}）`)
  if (tt.rows.length <= TRUTH_LIMIT) {
    for (const row of tt.rows) lines.push(`${row.inputs.join(' ')} | ${row.outputs.join(' ')}`)
  } else {
    lines.push(`共 ${tt.rows.length} 行，超过 ${TRUTH_LIMIT} 行，逐行略去。`)
  }
}

function renderMsi(r: MsiResult, lines: string[]): void {
  lines.push(`芯片：${r.chipName}`, `功能：${r.functionText}`)
  lines.push('引脚：')
  for (const p of r.pins) {
    const alias = p.aliases.length ? `（别名 ${p.aliases.join('、')}）` : ''
    const level = p.activeLevel === 'low' ? '低电平有效' : p.activeLevel === 'high' ? '高电平有效' : ''
    lines.push(`  ${p.name}${alias} ${level}${p.note ? '，' + p.note : ''}`)
  }
  for (const st of r.stages) {
    lines.push(`接线：${st.label}`)
    for (const w of st.wiring) lines.push(`  ${w.pin} ← ${w.signal}${w.note ? `（${w.note}）` : ''}`)
  }
  const m = r.mapping
  if (m.kind === 'decoder') {
    lines.push(m.constant === null ? `与非式：F = ${m.nandText}` : `函数恒为 ${m.constant}`)
  } else if (m.kind === 'mux') {
    lines.push(`降维：选择变量 ${m.selectVars.join(' ')}，数据端变量 ${m.highVars.join(' ') || '无'}`)
    for (const row of m.rows) lines.push(`  ${row.dataPin}（选择码 ${row.selectBits.join('')}）= ${row.data.text}`)
  } else if (m.kind === 'adder' && m.correctionText) {
    lines.push(`修正：${m.correctionText}`)
  }
}

export function renderComb(value: Envelope<CombResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  if (value.op === 'analyze' || value.op === 'draw') renderAnalyze(value.result as CombResultMap['analyze'], lines)
  else if (value.op === 'map_msi') renderMsi(value.result as MsiResult, lines)
  else lines.push('（无可显示的结果）')
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}

/**
 * 把 draw / analyze 的图写成独立 SVG 文件，返回绝对路径；无图或写入失败时返回 null（不抛出）。
 * 文件名取 SVG 内容 SHA-1 的前 12 位，同一输入得到同一路径；已存在则不重写。
 */
export function writeCombFigure(value: Envelope<CombResult>): string | null {
  try {
    if (!value.ok || value.result === null) return null
    if (value.op !== 'analyze' && value.op !== 'draw') return null
    const svg = renderCombFigureSvg(value.result)
    if (!svg) return null
    const hash = createHash('sha1').update(svg, 'utf8').digest('hex').slice(0, 12)
    const dir = path.join(os.tmpdir(), 'dlogic-figs')
    const file = path.join(dir, `${hash}.svg`)
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(file, svg, 'utf8')
    }
    return file
  } catch {
    return null
  }
}

/** 宿主用的文本结果：renderComb 的文本，并在有图文件时追加图文件路径行。 */
export function renderCombForHost(value: Envelope<CombResult>): string {
  const text = renderComb(value)
  const file = writeCombFigure(value)
  if (!file) return text
  return `${text}\n图文件（请在最终回答里用 Markdown 图片语法引用，路径原样照抄）：${file}`
}
