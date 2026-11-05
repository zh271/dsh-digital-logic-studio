// dlogic_bool 的纯逻辑：参数结构、求解分派与中文渲染。不依赖 DSH，便于测试。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { BoolOp, BoolResultMap, BoolSpec, Envelope } from '../../shared/contracts.ts'
import {
  canonical,
  complementExpr,
  dualExpr,
  equivalent,
  gateForms,
  hazard,
  kmap,
  minimize,
  minimizeSteps,
  specFromExpr,
  truthTable,
  type Form,
} from '../../solvers/bool.ts'
import { envelope } from '../envelope.ts'

export const BOOL_OPS: BoolOp[] = [
  'parse',
  'truth_table',
  'canonical',
  'minimize',
  'kmap',
  'hazard',
  'complement',
  'dual',
  'gate_form',
  'equivalent',
]

export const BOOL_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: [...BOOL_OPS],
    description: '子功能：parse | truth_table | canonical | minimize | kmap | hazard | complement | dual | gate_form | equivalent',
  },
  expr: {
    type: 'string',
    description: `布尔表达式，例如 "A'B + AB'"、"!A&B|C"、"A⊕B"。与 minterms 二选一。`,
  },
  variables: {
    type: 'array',
    items: { type: 'string' },
    description: '变量名（按书写顺序，variables[0] 为最高位）。给出 expr 时可省略（按字母序自动确定）；使用 minterms 时必填。',
  },
  minterms: {
    type: 'array',
    items: { type: 'integer' },
    description: '最小项编号（0 起），与 variables 一起使用。与 expr 二选一。',
  },
  dontCares: {
    type: 'array',
    items: { type: 'integer' },
    description: '无关项编号，可与 minterms 一起使用。',
  },
  form: {
    type: 'string',
    enum: ['SOP', 'POS'],
    description: 'minimize / kmap 的形式，默认 SOP（与或式）；POS 为或与式。',
  },
  other: {
    type: 'string',
    description: 'op=equivalent 时的第二个表达式（与 expr 或 minterms 对比）。',
  },
} as const

export interface BoolArgs {
  op: BoolOp
  expr?: string
  variables?: string[]
  minterms?: number[]
  dontCares?: number[]
  form?: Form
  other?: string
}

export type BoolResult = BoolResultMap[BoolOp]

const TRUTH_TABLE_LIMIT = 32
const LIST_LIMIT = 12

/** 由 expr（可配 variables）或 minterms + dontCares + variables 构造规范。 */
export function specFromArgs(
  args: { expr?: string; variables?: string[]; minterms?: number[]; dontCares?: number[] },
  what = '函数',
): BoolSpec {
  if (typeof args.expr === 'string' && args.expr.trim() !== '') {
    return specFromExpr(args.expr, args.variables)
  }
  if (args.minterms !== undefined) {
    if (!Array.isArray(args.variables) || args.variables.length === 0) {
      throw new DlogicInputError('使用 minterms 时必须同时提供 variables（variables[0] 为最高位）。')
    }
    return {
      variables: args.variables.slice(),
      minterms: args.minterms.slice(),
      dontCares: Array.isArray(args.dontCares) ? args.dontCares.slice() : [],
    }
  }
  throw new DlogicInputError(`缺少${what}：请提供 expr，或同时提供 minterms 与 variables。`)
}

function requireExpr(args: BoolArgs): string {
  if (typeof args.expr !== 'string' || args.expr.trim() === '') {
    throw new DlogicInputError(`${args.op} 需要提供 expr 参数。`)
  }
  return args.expr
}

/** 等价比较时使用的变量顺序（与求解器一致：同序则保持，否则取并集按字母序）。 */
export function unionVars(left: string[], right: string[]): string[] {
  const same = left.length === right.length && left.every((v, i) => v === right[i])
  return same ? left.slice() : [...new Set([...left, ...right])].sort()
}

/** "A=0,B=1,C=1"：反例的取值描述。 */
export function describeAssignment(vars: string[], inputs: (0 | 1)[]): string {
  return vars.map((v, i) => `${v}=${inputs[i]}`).join(',')
}

export function runBool(args: BoolArgs): Envelope<BoolResult> {
  return envelope<BoolResult>(String(args.op), () => {
    const form: Form = args.form ?? 'SOP'
    switch (args.op) {
      case 'parse': {
        const spec = specFromArgs(args)
        return { result: { spec, input: args.expr ?? `Σm(${spec.minterms.join(',')})` } }
      }
      case 'truth_table': {
        const spec = specFromArgs(args)
        return { result: { spec, table: truthTable(spec) } }
      }
      case 'canonical': {
        const spec = specFromArgs(args)
        return { result: { spec, canonical: canonical(spec) } }
      }
      case 'minimize': {
        const spec = specFromArgs(args)
        return { result: { spec, minimize: minimize(spec, form) }, steps: minimizeSteps(spec, form) }
      }
      case 'kmap': {
        const spec = specFromArgs(args)
        const layout = kmap(spec, form)
        return { result: { spec, kmap: layout, minimize: minimize(spec, form) }, steps: minimizeSteps(spec, form) }
      }
      case 'hazard': {
        const spec = specFromArgs(args)
        return { result: { spec, hazard: hazard(spec) } }
      }
      case 'complement': {
        const expr = requireExpr(args)
        return { result: { input: expr, ...complementExpr(expr, args.variables) } }
      }
      case 'dual': {
        const expr = requireExpr(args)
        return { result: { input: expr, ...dualExpr(expr, args.variables) } }
      }
      case 'gate_form': {
        const spec = specFromArgs(args)
        return { result: { spec, gates: gateForms(spec) } }
      }
      case 'equivalent': {
        if (typeof args.other !== 'string' || args.other.trim() === '') {
          throw new DlogicInputError('equivalent 需要提供 other（第二个表达式）。')
        }
        const left = specFromArgs(args, '左侧函数')
        const right = specFromExpr(args.other, args.variables)
        return { result: { left, right, equivalence: equivalent(left, right) } }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

function listLines(lines: string[], items: string[], indent = '  '): void {
  const shown = items.slice(0, LIST_LIMIT)
  for (const it of shown) lines.push(`${indent}${it}`)
  if (items.length > LIST_LIMIT) lines.push(`${indent}……另有 ${items.length - LIST_LIMIT} 项`)
}

function primeText(p: { mask: string; text: string }[], mask: string): string {
  return p.find(x => x.mask === mask)?.text ?? mask
}

export function renderBool(value: Envelope<BoolResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  const r = value.result
  switch (value.op as BoolOp) {
    case 'parse': {
      const { spec, input } = r as BoolResultMap['parse']
      lines.push(`输入：${input}`, `变量：${spec.variables.join(', ')}`, `最小项：Σm(${spec.minterms.join(',')})`)
      if (spec.dontCares.length) lines.push(`无关项：Σd(${spec.dontCares.join(',')})`)
      break
    }
    case 'truth_table': {
      const { table } = r as BoolResultMap['truth_table']
      lines.push(`真值表（变量顺序：${table.variables.join(' ')}）`, `${table.variables.join(' ')} | F`)
      if (table.rows.length <= TRUTH_TABLE_LIMIT) {
        for (const row of table.rows) lines.push(`${row.inputs.join(' ')} | ${row.output}`)
      } else {
        lines.push(`共 ${table.rows.length} 行，超过 ${TRUTH_TABLE_LIMIT} 行，逐行略去。`)
      }
      break
    }
    case 'canonical': {
      const { canonical: c } = r as BoolResultMap['canonical']
      lines.push(`标准和：F = ${c.sigma}`, `标准积：F = ${c.pi}`, `标准与或式：F = ${c.sopText}`, `标准或与式：F = ${c.posText}`)
      break
    }
    case 'minimize': {
      const { minimize: m } = r as BoolResultMap['minimize']
      lines.push(
        `${m.form} 最简式：共 ${m.solutions.length} 个等价解，代价 ${m.cost.terms} 项 ${m.cost.literals} 个文字`,
      )
      m.texts.forEach((t, i) => lines.push(`  解${i + 1}：F = ${t}`))
      lines.push(`质蕴涵项：${m.primeImplicants.map(p => p.text).join('、') || '无'}`)
      lines.push(
        `本质质蕴涵项：${m.essential.map(x => primeText(m.primeImplicants, x)).join('、') || '无'}`,
      )
      break
    }
    case 'kmap': {
      const { kmap: k, minimize: m } = r as BoolResultMap['kmap']
      lines.push(
        `卡诺图：行变量 ${k.rowVars.join('') || '-'}，列变量 ${k.colVars.join('') || '-'}` +
          (k.planeVar ? `，平面变量 ${k.planeVar}` : ''),
      )
      lines.push(`圈组（共 ${k.groups.length} 个）：`)
      k.groups.forEach((g, i) => lines.push(`  圈${i + 1}：${g.text}，覆盖 ${g.cells.map(c => `m${c}`).join(',')}`))
      if (m.texts.length > 1) {
        m.texts.forEach((t, i) => lines.push(`化简结果（解 ${i + 1}）：F = ${t}（${m.form}，${m.cost.terms} 项 ${m.cost.literals} 个文字）`))
      } else {
        lines.push(`化简结果：F = ${m.texts[0] ?? '0'}（${m.form}，${m.cost.terms} 项 ${m.cost.literals} 个文字）`)
      }
      break
    }
    case 'hazard': {
      const { hazard: h } = r as BoolResultMap['hazard']
      if (h.static1.length === 0 && h.static0.length === 0) lines.push('静态险象：无。')
      const pairs = (label: string, list: BoolResultMap['hazard']['hazard']['static1']) => {
        if (list.length === 0) return
        lines.push(`${label}（${list.length} 对）：`)
        listLines(
          lines,
          list.map(x => `m${x.a} 与 m${x.b} 相邻（变量 ${x.variable} 变化），未被同一圈覆盖；消去项 ${x.consensus.text}`),
        )
      }
      pairs('静态1型险象', h.static1)
      pairs('静态0型险象', h.static0)
      lines.push(`消除险象后的与或式：F = ${h.hazardFreeSop}`)
      break
    }
    case 'complement': {
      const { input, text } = r as BoolResultMap['complement']
      lines.push(`${input} 的反函数：${text}`)
      break
    }
    case 'dual': {
      const { input, text } = r as BoolResultMap['dual']
      lines.push(`${input} 的对偶式：${text}`)
      break
    }
    case 'gate_form': {
      const { gates: g } = r as BoolResultMap['gate_form']
      lines.push(`与非-与非式：F = ${g.nandNand}`, `或非-或非式：F = ${g.norNor}`, `与或非式：F = ${g.andOrInvert}`)
      break
    }
    case 'equivalent': {
      const { left, right, equivalence: e } = r as BoolResultMap['equivalent']
      if (e.equivalent) {
        lines.push('两式等价：在所有取值上输出一致。')
      } else if (e.counterexample) {
        const vars = unionVars(left.variables, right.variables)
        const ce = e.counterexample
        lines.push(`两式不等价。反例：当 ${describeAssignment(vars, ce.inputs)} 时，左式为 ${ce.left}，右式为 ${ce.right}。`)
      } else {
        lines.push('两式不等价。')
      }
      break
    }
    default:
      lines.push('（无可显示的结果）')
  }
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
