// 回答文本中的知识点链接（纯函数，可单测）：把回答里出现的知识点词替换为可点击的链接片段。
// 词表来自知识图谱的标题与关键词；贪心最长匹配、从左到右、互不重叠；反引号代码片段不链接。
import { defaultKnowledgeBase, type KnowledgeBase } from '../../solvers/knowledge.ts'

/** 不作为链接的泛用词（过于常见，链接会干扰阅读）。 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  '实现',
  '电平',
  '级联',
  '输入',
  '输出',
  '信号',
  '电路',
  '方法',
  '结果',
  '条件',
  '变化',
  '功能',
  '描述',
  '基本',
  '概念',
  '系统',
  '设计',
  '分析',
  '应用',
  '原理',
  '数据',
  '控制',
])

/** 文本片段：普通文字，或指向某个知识点的链接。 */
export type Segment = { text: string } | { text: string; nodeId: string; title: string }

export interface TermIndex {
  /** 小写词 -> 命中的知识点 id 列表（去重）。 */
  readonly terms: ReadonlyMap<string, readonly string[]>
  /** 知识点 id -> 标题。 */
  readonly titles: ReadonlyMap<string, string>
  /** 最长词的长度（UTF-16 单元）。 */
  readonly maxLen: number
}

/** 最短可链接词长度。 */
const MIN_TERM = 2

let cachedIndex: TermIndex | undefined

/** 由知识图谱构建词表：所有标题与关键词（长度 >= 2，且不在 STOPWORDS 中）。 */
export function buildTermIndex(kb: KnowledgeBase = defaultKnowledgeBase()): TermIndex {
  const terms = new Map<string, string[]>()
  const titles = new Map<string, string>()
  let maxLen = 0
  for (const node of kb.nodes) {
    titles.set(node.id, node.title)
    const words = [node.title, ...node.keywords]
    for (const raw of words) {
      const word = typeof raw === 'string' ? raw.trim() : ''
      if (word.length < MIN_TERM || STOPWORDS.has(word)) continue
      const key = word.toLowerCase()
      const ids = terms.get(key)
      if (!ids) terms.set(key, [node.id])
      else if (!ids.includes(node.id)) ids.push(node.id)
      maxLen = Math.max(maxLen, key.length)
    }
  }
  return { terms, titles, maxLen }
}

function defaultTermIndex(): TermIndex {
  if (!cachedIndex) cachedIndex = buildTermIndex()
  return cachedIndex
}

/** 概念追问的问题文本。 */
export function conceptQuestion(title: string): string {
  return `「${title}」是什么？`
}

/** 是否为 ASCII 字母或数字（ASCII 词需要两侧是词边界，避免 IC 命中 PIC 之类）。 */
function isAsciiWord(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9]/.test(ch)
}

/** 两个知识点 id 按段（k1 / 5 / 2）共享的前缀段数。 */
function sharedSegments(a: string, b: string): number {
  const sa = a.split('.')
  const sb = b.split('.')
  let n = 0
  while (n < sa.length && n < sb.length && sa[n] === sb[n]) n++
  return n
}

/**
 * 同一词命中多个知识点时选一个：同章优先，其次与焦点共享的前缀段数更多，
 * 再次更深（段数多）的优先，最后按 id 字典序。
 */
function pickId(ids: readonly string[], focusIds: readonly string[]): string {
  const chapterOf = (id: string): string => id.split('.')[0]!
  const rank = (id: string) => ({
    otherChapter: focusIds.some((f) => chapterOf(f) === chapterOf(id)) ? 0 : 1,
    shared: focusIds.reduce((m, f) => Math.max(m, sharedSegments(f, id)), 0),
    depth: id.split('.').length,
  })
  const sorted = [...ids].sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return (
      ra.otherChapter - rb.otherChapter ||
      rb.shared - ra.shared ||
      rb.depth - ra.depth ||
      (a < b ? -1 : a > b ? 1 : 0)
    )
  })
  return sorted[0]!
}

export interface LinkContext {
  /** 当前卡片（及其路径）相关的知识点，用于在同名歧义时选择最近的节点。 */
  focusIds: readonly string[]
  /** 已探索的知识点（路径上的节点与卡片自身的知识点）：不再链接。 */
  exploredIds: ReadonlySet<string>
  index?: TermIndex
}

/**
 * 把文本切分为普通片段与知识点链接片段。
 * - 贪心最长匹配，从左到右，互不重叠；
 * - 命中已探索、已链接（同一文本中每个节点只链接一次，取第一次出现）或泛用词时保持普通文字；
 * - 反引号代码片段原样保留；ASCII 词两侧不能紧邻字母或数字。
 * 纯函数，不抛错；空文本返回空数组。
 */
export function linkify(text: string, ctx: LinkContext): Segment[] {
  try {
    if (typeof text !== 'string' || text === '') return []
    const index = ctx.index ?? defaultTermIndex()
    const focusIds = ctx.focusIds ?? []
    const explored = ctx.exploredIds ?? new Set<string>()
    const out: Segment[] = []
    const linked = new Set<string>()

    const pushPlain = (s: string): void => {
      if (s === '') return
      const last = out[out.length - 1]
      if (last && !('nodeId' in last)) last.text += s
      else out.push({ text: s })
    }

    const scan = (seg: string): void => {
      const lower = seg.toLowerCase().length === seg.length ? seg.toLowerCase() : seg
      let buf = ''
      let i = 0
      while (i < seg.length) {
        const hit = matchAt(lower, seg, i, index)
        if (!hit) {
          buf += seg[i]
          i++
          continue
        }
        pushPlain(buf)
        buf = ''
        const span = seg.slice(i, i + hit.len)
        const nodeId = pickId(hit.ids, focusIds)
        if (!explored.has(nodeId) && !linked.has(nodeId)) {
          out.push({ text: span, nodeId, title: index.titles.get(nodeId) ?? span })
          linked.add(nodeId)
        } else {
          pushPlain(span)
        }
        i += hit.len
      }
      pushPlain(buf)
    }

    // 奇数下标为反引号代码片段，原样保留。
    text.split(/(`[^`]*`)/).forEach((part, idx) => {
      if (idx % 2 === 1) pushPlain(part)
      else scan(part)
    })
    return out
  } catch {
    return [{ text }]
  }
}

/** 在位置 i 处做最长词匹配；返回匹配长度与候选 id，无匹配返回 null。 */
function matchAt(
  lower: string,
  seg: string,
  i: number,
  index: TermIndex,
): { len: number; ids: readonly string[] } | null {
  const max = Math.min(index.maxLen, seg.length - i)
  for (let len = max; len >= MIN_TERM; len--) {
    const ids = index.terms.get(lower.slice(i, i + len))
    if (!ids) continue
    const first = seg[i]
    const last = seg[i + len - 1]
    if (isAsciiWord(first) && isAsciiWord(seg[i - 1])) continue
    if (isAsciiWord(last) && isAsciiWord(seg[i + len])) continue
    return { len, ids }
  }
  return null
}
