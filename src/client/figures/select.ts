// 图示区的纯选择逻辑：从一轮的工具结果中挑出要展示的图、验证结论与追问卡片。不依赖 React。
import type { CardRecord, VerifyResult } from '../../shared/contracts.ts'
import type { HdlResult } from '../../shared/hdl.ts'
import { readMeta } from '../meta.ts'
import type { FiguresItem } from './definition.ts'

/** 作为图示展示的 dlogic_bool 操作（minimize 另行处理）。 */
export const FIGURE_OPS: readonly string[] = [
  'kmap',
  'truth_table',
  'hazard',
  'gate_form',
  'canonical',
  'equivalent',
  'complement',
  'dual',
  'parse',
  'minimize',
]

/** 超过此数量时折叠。 */
export const MAX_FIGURES = 4
/** 折叠时先显示的数量。 */
export const VISIBLE_FIGURES = 3

const BOOL_TOOL = 'dlogic_bool'
const NUM_TOOL = 'dlogic_num'
const VERIFY_TOOL = 'dlogic_verify'
const CARD_TOOL = 'dlogic_card'
const HDL_TOOL = 'dlogic_hdl'
/** 与主卡片同形的三类工具：结果按 op 渲染为单张主图（无外框主体）。 */
const PROGRAM_TOOLS = ['dlogic_comb', 'dlogic_seq', 'dlogic_fsm', 'dlogic_mem', 'dlogic_adda', 'dlogic_system'] as const
type ProgramTool = (typeof PROGRAM_TOOLS)[number]

export type FigureItem = FiguresItem

export interface Figure {
  tool: 'dlogic_bool' | 'dlogic_num' | 'dlogic_hdl' | ProgramTool
  /** dlogic_bool 为 op；dlogic_num 的 op 原样保留；其他工具为各自的 op。 */
  op: string
  /** 去重键：tool + op + 规格 JSON。 */
  key: string
  /** 规格 JSON（用于 minimize 与 kmap 的对比）。 */
  specKey: string
  seq: number
  /** 工具结果：dlogic_bool 为 BoolResultMap[op]，dlogic_num 为换算结果（不含 steps），其余为各自的结果。 */
  result: unknown
  /** dlogic_num 的过程步骤；其他工具为空数组。 */
  steps: unknown[]
}

export interface VerdictLine {
  equivalent: boolean
  /** 同 VerifyResult.minimal：true / false / null（无法判断）/ undefined（未给出）。 */
  minimal: boolean | null | undefined
  counterexample?: NonNullable<VerifyResult['counterexample']>
  variables: string[]
}

export interface FigureSelection {
  /** 直接展示的图。 */
  figures: Figure[]
  /** 折叠在“展开其余”之后的图。 */
  hidden: Figure[]
  verdict: VerdictLine | null
  card: CardRecord | null
}

/** 规格的 JSON 键：有 spec 用 spec；等价判断用左右两侧；求反等用 input；否则整个结果。 */
export function specKeyOf(result: unknown): string {
  if (typeof result !== 'object' || result === null) return ''
  const r = result as Record<string, unknown>
  if ('spec' in r) return JSON.stringify(r.spec)
  if ('left' in r) return JSON.stringify({ left: r.left, right: r.right })
  if ('input' in r) return JSON.stringify(r.input)
  return JSON.stringify(r)
}

function toVerdict(v: VerifyResult): VerdictLine {
  return {
    equivalent: v.equivalent === true,
    minimal: v.minimal,
    counterexample: v.counterexample,
    variables: Array.isArray(v.variables) ? v.variables : [],
  }
}

function isCard(v: CardRecord | null | undefined): v is CardRecord {
  return !!v && typeof v.nodeId === 'string' && Array.isArray(v.followups)
}

/**
 * 从本轮结果中选出图示。
 * - items 按 seq 升序处理；maxSeq 给出时忽略更晚的结果。
 * - 去重：同 tool + op + 规格 JSON 只保留最后一次，位置取最后一次的位置。
 * - minimize 在本轮有同一规格的 kmap 时被压掉（卡诺图已包含化简结果）。
 * - verify 不作为图，化为一行结论（取最后一次）；card 取最后一张（用于追问）。
 * - knowledge 与失败结果忽略。
 */
export function selectFigures(items: readonly FigureItem[], maxSeq?: number): FigureSelection {
  const ordered = items
    .filter((item) => maxSeq === undefined || item.seq <= maxSeq)
    .slice()
    .sort((a, b) => a.seq - b.seq)

  const candidates: Figure[] = []
  let verdict: VerdictLine | null = null
  let card: CardRecord | null = null

  for (const item of ordered) {
    const bool = readMeta<unknown>(item, BOOL_TOOL)
    if (bool) {
      if (bool.ok && FIGURE_OPS.includes(bool.op)) {
        const specKey = specKeyOf(bool.result)
        candidates.push({
          tool: BOOL_TOOL,
          op: bool.op,
          key: `${BOOL_TOOL}|${bool.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: bool.result,
          steps: [],
        })
      }
      continue
    }

    const num = readMeta<unknown>(item, NUM_TOOL)
    if (num) {
      if (num.ok) {
        const specKey = specKeyOf(num.result)
        candidates.push({
          tool: NUM_TOOL,
          op: num.op,
          key: `${NUM_TOOL}|${num.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: num.result,
          steps: num.steps,
        })
      }
      continue
    }

    const hdl = readMeta<HdlResult>(item, HDL_TOOL)
    if (hdl) {
      // 仿真与静态检查各保留最后一次：键只含 op，后出现的同类结果覆盖先前的。
      if (hdl.ok && (hdl.op === 'simulate' || hdl.op === 'lint')) {
        candidates.push({
          tool: HDL_TOOL,
          op: hdl.op,
          key: `${HDL_TOOL}|${hdl.op}`,
          specKey: '',
          seq: item.seq,
          result: hdl.result,
          steps: [],
        })
      }
      continue
    }

    let program = false
    for (const tool of PROGRAM_TOOLS) {
      const env = readMeta<unknown>(item, tool)
      if (!env) continue
      program = true
      if (env.ok) {
        const specKey = specKeyOf(env.result)
        candidates.push({
          tool,
          op: env.op,
          key: `${tool}|${env.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: env.result,
          steps: [],
        })
      }
      break
    }
    if (program) continue

    const verify = readMeta<VerifyResult>(item, VERIFY_TOOL)
    if (verify) {
      if (verify.ok && verify.result) verdict = toVerdict(verify.result)
      continue
    }

    const cardEnv = readMeta<CardRecord>(item, CARD_TOOL)
    if (cardEnv) {
      if (cardEnv.ok && isCard(cardEnv.result)) card = cardEnv.result
      continue
    }
  }

  // minimize 被同规格的 kmap 压掉。
  const kmapSpecs = new Set(candidates.filter((f) => f.tool === BOOL_TOOL && f.op === 'kmap').map((f) => f.specKey))

  // 去重：保留每个键的最后一次出现。
  const lastIndex = new Map<string, number>()
  candidates.forEach((f, i) => lastIndex.set(f.key, i))
  const kept = candidates.filter(
    (f, i) => lastIndex.get(f.key) === i && !(f.tool === BOOL_TOOL && f.op === 'minimize' && kmapSpecs.has(f.specKey)),
  )

  const many = kept.length > MAX_FIGURES
  return {
    figures: many ? kept.slice(0, VISIBLE_FIGURES) : kept,
    hidden: many ? kept.slice(VISIBLE_FIGURES) : [],
    verdict,
    card: isCard(card) ? card : null,
  }
}
