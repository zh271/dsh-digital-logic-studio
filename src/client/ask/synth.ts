// 多选对比、总结、全图复习提纲与分支复制的纯逻辑（不依赖 React 与 DSH 运行时，可单测）。
// 模型调用与写入直接回答存储在 tree/synthesize.ts 中完成，这里只构造问题文本、卡片与 Markdown。
import type { CardRecord } from '../../shared/contracts.ts'
import { knowledgeLabels } from '../../shared/tree.ts'
import type { AskFollowupSuggestion } from '../../shared/ask.ts'
import { answerSummary, toFollowups, type AskEntry } from './entries.ts'

export type SynthKind = 'compare' | 'summary' | 'outline'

/** 标题中拼接的卡片标题最大字符数（超出截断并加省略号）。 */
const TITLE_JOIN_MAX = 30

/** 问题列表中每张卡片摘要的最大字符数（超出截断并加省略号）。 */
export const SYNTH_SUMMARY_MAX = 80
/** 摘要逐级收缩的档位：先 80，超出总预算时依次收缩。 */
const SUMMARY_STEPS = [SYNTH_SUMMARY_MAX, 40, 20, 0]
/** 超出预算仍需收缩时，标题的最大字符数。 */
const TITLE_LINE_MAX = 30
/** 发给模型的综合问题总长度预算（宿主上限 12000，留有余量）。 */
export const SYNTH_QUESTION_BUDGET = 10000

/** 按代码点截断文本，超出时加省略号；max 不大于 0 时返回空串。 */
function clipChars(text: string, max: number): string {
  if (max <= 0) return ''
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text
}

function cardLine(index: number, title: string, summary: string, summaryMax: number): string {
  const s = clipChars(summary, summaryMax)
  return s === '' ? `${index + 1}. ${title}` : `${index + 1}. ${title}：${s}`
}

/**
 * 生成编号卡片列表，使 前缀长度 + 列表长度 不超过 SYNTH_QUESTION_BUDGET：
 * 先按 80/40/20/0 字收缩摘要；仍超出则标题截断到 30 字并从末尾丢弃卡片（附说明）。
 */
function cardLines(cards: readonly { title: string; summary: string }[], prefixLength: number): string {
  const fits = (text: string): boolean => prefixLength + text.length <= SYNTH_QUESTION_BUDGET
  for (const max of SUMMARY_STEPS) {
    const text = cards.map((c, i) => cardLine(i, c.title, c.summary, max)).join('\n')
    if (fits(text)) return text
  }
  const lines = cards.map((c, i) => cardLine(i, clipChars(c.title, TITLE_LINE_MAX), '', 0))
  for (let n = lines.length; n > 0; n--) {
    const dropped = lines.length - n
    const text = lines.slice(0, n).join('\n') + (dropped > 0 ? `\n…（另有 ${dropped} 张卡片未列出）` : '')
    if (fits(text)) return text
  }
  return `…（另有 ${cards.length} 张卡片未列出）`
}

/** 引用卡片与纯文本的约束（三种综合都附带）。 */
export const SYNTH_RULES =
  '引用卡片时必须使用卡片标题（可加书名号），不要使用“卡1”“卡片1”这类编号。用纯文本作答，不要使用 LaTeX、\\(\\)、$ 等数学标记。'

const SYNTH_INSTRUCTIONS: Record<SynthKind, string> = {
  compare: '请对比以下卡片涉及的知识点：列出相同点、不同点、各自适用场合与易混淆处，条理清晰，不超过 400 字。',
  summary: '请用简洁的语言总结以下卡片的核心内容，不超过 300 字。',
  outline: '请为以下全部卡片生成一份复习提纲：按知识点分层的要点列表，指出重点、易错点和建议复习顺序，不超过 600 字。',
}

/**
 * 发给模型的中文指令（作为直接回答命令的 question）。卡片摘要按 SYNTH_SUMMARY_MAX 截断，
 * 整体不超过 SYNTH_QUESTION_BUDGET 字符。
 */
export function buildSynthQuestion(kind: SynthKind, cards: readonly { title: string; summary: string }[]): string {
  const head = `${SYNTH_INSTRUCTIONS[kind]}${SYNTH_RULES}卡片：\n`
  return head + cardLines(cards, head.length)
}

export interface BuildSynthInput {
  kind: SynthKind
  sources: readonly Pick<CardRecord, 'nodeId' | 'knowledgeIds' | 'knowledgeNames' | 'title'>[]
  answer: string
  /** 模型给出的后续追问（可省略）。 */
  followups?: readonly AskFollowupSuggestion[]
  now: number
  token: string
}

function synthTitle(kind: SynthKind, sources: readonly { title: string }[]): string {
  if (kind === 'outline') return '复习提纲'
  const chars = Array.from(sources.map((s) => s.title).join('、'))
  const joined = chars.length > TITLE_JOIN_MAX ? chars.slice(0, TITLE_JOIN_MAX).join('') + '…' : chars.join('')
  return kind === 'compare' ? `对比：${joined}` : `总结：${joined}`
}

/**
 * 由一次综合回答生成 AskEntry（新的根卡片，无追问）。
 * 知识点取各来源的并集（去重）；名称仅在每个知识点都有名称时才写入，保持与 knowledgeIds 一一对应。
 */
export function buildSynthEntry(input: BuildSynthInput): AskEntry {
  const ids: string[] = []
  const names = new Map<string, string>()
  for (const s of input.sources) {
    s.knowledgeIds.forEach((id, i) => {
      if (!ids.includes(id)) ids.push(id)
      const name = s.knowledgeNames?.length === s.knowledgeIds.length ? s.knowledgeNames[i] : undefined
      if (typeof name === 'string' && name !== '' && !names.has(id)) names.set(id, name)
    })
  }
  const allNamed = ids.length > 0 && ids.every((id) => names.has(id))
  return {
    answer: input.answer,
    card: {
      nodeId: `s${input.now.toString(36)}${input.token}`,
      callId: `llm-${input.now}-${input.token}`,
      title: synthTitle(input.kind, input.sources),
      summary: answerSummary(input.answer),
      kind: input.kind === 'compare' ? 'compare' : 'summary',
      knowledgeIds: ids,
      ...(allNamed ? { knowledgeNames: ids.map((id) => names.get(id) as string) } : {}),
      followups: toFollowups(input.followups),
      parentId: null,
      ...(input.sources.length > 0 ? { sources: input.sources.map((s) => s.nodeId) } : {}),
    },
  }
}

/**
 * 从根到 nodeId 的卡片路径（含自身），沿 parentId 向上走；父卡片缺失或成环即停止。
 * nodeId 不存在时返回空数组。
 */
export function cardPath(cards: readonly CardRecord[], nodeId: string): CardRecord[] {
  const byId = new Map<string, CardRecord>()
  for (const c of cards) if (!byId.has(c.nodeId)) byId.set(c.nodeId, c)
  const start = byId.get(nodeId)
  if (!start) return []
  const chain: CardRecord[] = [start]
  const seen = new Set<string>([start.nodeId])
  let cur = start
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    cur = byId.get(cur.parentId) as CardRecord
    seen.add(cur.nodeId)
    chain.unshift(cur)
  }
  return chain
}

export const BRANCH_PREFIX = '以下是我在学习树中的一条学习分支，请基于它继续：'

/**
 * 分支上下文的 Markdown：每张卡片给出标题、知识点与完整回答（answers 按 callId 索引，缺失时用摘要）。
 */
export function branchMarkdown(path: readonly CardRecord[], answers: ReadonlyMap<string, string>): string {
  const parts: string[] = [BRANCH_PREFIX]
  path.forEach((card, i) => {
    const kn = card.knowledgeIds.length > 0 ? knowledgeLabels(card).join('、') : '无'
    const body = (answers.get(card.callId) ?? card.summary).trim()
    parts.push('', `### ${i + 1}. ${card.title}`, `知识点：${kn}`, '', body)
  })
  return parts.join('\n')
}
