// 直接回答的纯逻辑（不依赖 React 与 DSH 运行时，可单测）：卡片构造、去重、容量上限、序列化。
import type { CardRecord, Followup, KnowledgeNode } from '../../shared/contracts.ts'
import type { AskFollowupSuggestion } from '../../shared/ask.ts'
import { defaultKnowledgeBase, type KnowledgeBase } from '../../solvers/knowledge.ts'

/** 模型没有给出理由时的悬停提示。 */
export const ASK_FOLLOWUP_WHY = '继续深入这一点'

/** 每个主会话最多保存的直接回答条数（超出时丢弃最旧的）。 */
export const ASK_MAX_ENTRIES = 100
/** 卡片摘要的最大字符数；完整回答另存在 AskEntry.answer 中。 */
export const ASK_SUMMARY_MAX = 200

/** 一条直接回答：生成的学习卡片 + 完整回答文本。 */
export interface AskEntry {
  card: CardRecord
  answer: string
}

export function askStorageKey(sessionId: string): string {
  return `dlogic.ask.${sessionId}`
}

/** 卡片摘要：压缩空白并截断到 ASK_SUMMARY_MAX 个字符。 */
export function answerSummary(answer: string): string {
  const flat = answer.replace(/\s+/g, ' ').trim()
  const chars = Array.from(flat)
  return chars.length > ASK_SUMMARY_MAX ? chars.slice(0, ASK_SUMMARY_MAX).join('') + '…' : flat
}

/** 随机短串（用于 nodeId / callId 的唯一性）。 */
export function randomToken(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** 把模型给出的后续追问转为卡片上的 Followup（理由为空时用默认提示）。 */
export function toFollowups(list: readonly AskFollowupSuggestion[] | undefined): Followup[] {
  return (list ?? []).map((s) => ({ question: s.question, angle: s.angle, why: s.why || ASK_FOLLOWUP_WHY }))
}

/** 追问问题的字符上限（与模型给出的追问一致）。 */
const FOLLOWUP_QUESTION_MAX = 30

/** 按代码点截断标题到 max 个字符，超出时以省略号结尾。 */
function clipTitle(title: string, max: number): string {
  const chars = Array.from(title)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : title
}

/**
 * 由知识图谱确定性地生成追问桩（不依赖模型输出），让追问逐层细化直到知识原子。
 * - 有未探索的子知识点：按 knowledgeIds 顺序收集，最多 3 条，角度为 principle（细化）。
 * - 没有（已到原子或子知识点都已探索）：从第一个已知知识点取未探索的前置（最多 2 条），
 *   不足时再取相关知识点，凑够 2 条，角度分别为 prerequisite 与 variant。
 * explored 为已经探索过的知识点 id；未知 id 忽略；无可用追问时返回空数组。
 */
export function atomFollowups(
  knowledgeIds: readonly string[],
  explored: ReadonlySet<string>,
  kb: KnowledgeBase = defaultKnowledgeBase(),
): Followup[] {
  const refine: Followup[] = []
  for (const id of knowledgeIds) {
    const parent = kb.get(id)
    if (!parent) continue
    for (const child of kb.neighbors(id).children) {
      if (explored.has(child.id) || refine.length >= 3) continue
      // 「」与“具体是什么？”共占 8 个字符，标题预算为 22。
      refine.push({
        question: `「${clipTitle(child.title, FOLLOWUP_QUESTION_MAX - 8)}」具体是什么？`,
        angle: 'principle',
        why: `细化：${parent.title}`,
        knowledgeId: child.id,
      })
    }
  }
  if (refine.length > 0) return refine

  const first = knowledgeIds.map((id) => kb.get(id)).find((n): n is KnowledgeNode => n !== undefined)
  if (!first) return []
  const { prereqs, related } = kb.neighbors(first.id)
  const lateral: Followup[] = []
  const used = new Set<string>()
  const push = (node: KnowledgeNode, question: string, angle: Followup['angle'], why: string): void => {
    if (lateral.length >= 2 || explored.has(node.id) || used.has(node.id)) return
    used.add(node.id)
    lateral.push({ question, angle, why, knowledgeId: node.id })
  }
  for (const p of prereqs) {
    // 学、「」、要先懂什么？共 9 个字符，标题预算为 21。
    push(p, `学「${clipTitle(p.title, FOLLOWUP_QUESTION_MAX - 9)}」要先懂什么？`, 'prerequisite', `${first.title}的前置知识`)
  }
  for (const r of related) {
    // 「」、和它有什么联系？共 10 个字符，标题预算为 20。
    push(r, `「${clipTitle(r.title, FOLLOWUP_QUESTION_MAX - 10)}」和它有什么联系？`, 'variant', `与${first.title}相关`)
  }
  return lateral
}

export interface BuildAskInput {
  /** 被追问的卡片（只需 nodeId 与 knowledgeIds）。 */
  parent: Pick<CardRecord, 'nodeId' | 'knowledgeIds' | 'knowledgeNames'>
  /**
   * 预设追问的序号（从 0 开始）：展开父卡片的第几个追问桩。
   * 用户自由提问时省略：新卡片作为子卡片挂在父卡片下，不占用任何追问桩。
   */
  index?: number
  /** 被点击的追问桩；若其 knowledgeId 在知识图谱中，新卡片聚焦到该知识点（细化）。 */
  followup?: Followup
  /** 路径上已探索过的全部知识点 id（根到父卡片）。 */
  explored?: readonly string[]
  question: string
  /** 卡片标题；省略时用 question（知识点链接生成的卡片用知识点名称）。 */
  title?: string
  answer: string
  /** 模型给出的后续追问（可省略，视为没有）；非空时优先作为新卡片的追问桩，为空时才用知识图谱的追问。 */
  followups?: readonly AskFollowupSuggestion[]
  now: number
  token: string
}

/**
 * 由一次直接回答生成 AskEntry。kind 为 concept。
 * 知识点：若 followup 指向图谱中的知识点则聚焦到它，否则继承父卡片。
 * 追问桩：优先用模型给出的追问（followups）；为空时才由知识图谱确定性生成（atomFollowups）。
 */
export function buildAskEntry(input: BuildAskInput): AskEntry {
  const kb = defaultKnowledgeBase()
  const focus = input.followup?.knowledgeId !== undefined ? kb.get(input.followup.knowledgeId) : undefined
  const knowledgeIds = focus ? [focus.id] : [...input.parent.knowledgeIds]
  const knowledgeNames = focus ? [focus.title] : input.parent.knowledgeNames
  const explored = new Set([...(input.explored ?? []), ...input.parent.knowledgeIds, ...knowledgeIds])
  // 追问桩优先用模型给出的追问；模型没有给出时才退回知识图谱确定性生成的追问。
  const modelFollowups = toFollowups(input.followups)
  const generated = modelFollowups.length > 0 ? [] : atomFollowups(knowledgeIds, explored, kb)
  return {
    answer: input.answer,
    card: {
      nodeId: `q${input.now.toString(36)}${input.token}`,
      callId: `llm-${input.now}-${input.token}`,
      title: input.title ?? input.question,
      summary: answerSummary(input.answer),
      kind: 'concept',
      knowledgeIds,
      ...(knowledgeNames ? { knowledgeNames: [...knowledgeNames] } : {}),
      followups: modelFollowups.length > 0 ? modelFollowups : generated,
      parentId: input.parent.nodeId,
      ...(input.index === undefined ? {} : { parentFollowup: input.index }),
    },
  }
}

/**
 * 追加一条：callId 已存在则原样返回同一数组（去重）；超过上限时丢弃最旧的。
 */
export function addAskEntry(list: readonly AskEntry[], entry: AskEntry): readonly AskEntry[] {
  if (list.some((e) => e.card.callId === entry.card.callId)) return list
  const next = [...list, entry]
  return next.length > ASK_MAX_ENTRIES ? next.slice(next.length - ASK_MAX_ENTRIES) : next
}

export function serializeAskEntries(list: readonly AskEntry[]): string {
  return JSON.stringify({ v: 1, items: list })
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isCard(x: unknown): x is CardRecord {
  if (!isObj(x)) return false
  return (
    typeof x.nodeId === 'string' &&
    x.nodeId !== '' &&
    typeof x.callId === 'string' &&
    x.callId !== '' &&
    typeof x.title === 'string' &&
    typeof x.summary === 'string' &&
    typeof x.kind === 'string' &&
    Array.isArray(x.knowledgeIds) &&
    Array.isArray(x.followups) &&
    (x.parentId === null || typeof x.parentId === 'string')
  )
}

/** 来源列表形状不对时只丢弃 sources 字段，卡片本身保留。 */
export function sanitizeSources(card: CardRecord): CardRecord {
  const s: unknown = card.sources
  if (s === undefined || (Array.isArray(s) && s.every((x) => typeof x === 'string'))) return card
  const copy: CardRecord = { ...card }
  delete copy.sources
  return copy
}

/** 反序列化：坏数据、形状不符的条目丢弃；callId 重复只保留第一条；超过上限保留最新的。 */
export function parseAskEntries(raw: string | null | undefined): AskEntry[] {
  if (typeof raw !== 'string' || raw === '') return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  const items: unknown[] = isObj(data) && Array.isArray(data.items) ? data.items : []
  const out: AskEntry[] = []
  const seen = new Set<string>()
  for (const it of items) {
    if (!isObj(it) || typeof it.answer !== 'string' || !isCard(it.card)) continue
    if (seen.has(it.card.callId)) continue
    seen.add(it.card.callId)
    out.push({ card: sanitizeSources(it.card), answer: it.answer })
  }
  return out.length > ASK_MAX_ENTRIES ? out.slice(out.length - ASK_MAX_ENTRIES) : out
}
