// 卡片校验：把模型传入的 dlogic_card 参数规整为可入树的 CardInput，并给出中文警告。纯函数。
import { DlogicInputError } from '../shared/contracts.ts'
import type { CardInput, CardKind, Followup, FollowupAngle } from '../shared/contracts.ts'
import type { KnowledgeBase } from './knowledge.ts'

const CARD_KINDS: readonly CardKind[] = ['solution', 'concept', 'tutor', 'practice', 'compare', 'summary']
const ANGLES: readonly FollowupAngle[] = [
  'principle',
  'variant',
  'pitfall',
  'prerequisite',
  'verify',
  'practice',
  'free',
]
const PARENT_ID_RE = /^c[0-9A-Za-z]{4}(-\d+)?$/
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193
const SHORT_SPACE = 36 ** 4

/** 由 callId 派生的确定性短 id，形如 "c7K2Q"（32 位 FNV-1a，取 4 位 base-36 大写）。 */
export function shortId(callId: string): string {
  const s = String(callId)
  let h = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  h >>>= 0
  return 'c' + (h % SHORT_SPACE).toString(36).toUpperCase().padStart(4, '0')
}

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function trimStr(x: unknown): string {
  return typeof x === 'string' ? x.trim() : ''
}

/**
 * 知识点解析：先按 id 精确匹配；不是 id 形状（k1.5.2）时按名称在知识图谱里搜索，取最佳匹配。
 * 这样模型可以直接写“卡诺图化简”之类的名称，省去先调用一次 dlogic_knowledge search 的往返。
 * 匹配不到返回 undefined。
 */
function resolveKnowledge(kb: KnowledgeBase, token: string): string | undefined {
  if (kb.has(token)) return token
  if (/^k\d/i.test(token)) return undefined
  return fuzzyKnowledge(kb, token) ?? kb.search(token, 1)[0]?.id
}

// 名称匹配前先去掉不影响含义的泛词，再按字符二元组重叠度（Dice）打分：
// “组合逻辑电路设计” → “组合逻辑设计”，能匹配到标题「组合逻辑设计」。
const GENERIC_WORDS = ['电路', '方法', '问题', '基本', '相关', '内容', '知识', '的']
const FUZZY_MIN_SCORE = 0.6

function squash(s: string): string {
  let t = s.toLowerCase().replace(/\s+/g, '')
  for (const w of GENERIC_WORDS) t = t.split(w).join('')
  return t
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>()
  if (s.length === 1) out.add(s)
  for (let i = 0; i + 1 < s.length; i++) out.add(s.slice(i, i + 2))
  return out
}

function dice(a: string, b: string): number {
  if (a === '' || b === '') return 0
  if (a === b) return 1
  const x = bigrams(a)
  const y = bigrams(b)
  let hit = 0
  for (const g of x) if (y.has(g)) hit++
  return (2 * hit) / (x.size + y.size)
}

function fuzzyKnowledge(kb: KnowledgeBase, token: string): string | undefined {
  const q = squash(token)
  if (q === '') return undefined
  let best: { id: string; score: number } | undefined
  for (const node of kb.nodes) {
    let score = dice(q, squash(node.title))
    for (const k of node.keywords) score = Math.max(score, dice(q, squash(k)) - 0.05)
    if (score >= FUZZY_MIN_SCORE && (!best || score > best.score)) best = { id: node.id, score }
  }
  return best?.id
}

export function validateCard(
  input: CardInput,
  kb: KnowledgeBase,
): { card: CardInput; warnings: string[] } {
  if (!isObj(input)) throw new DlogicInputError('卡片参数必须是一个对象。')
  const raw = input as unknown as Obj
  const warnings: string[] = []

  const title = trimStr(raw.title)
  if (!title) throw new DlogicInputError('卡片标题不能为空。')

  const summary = trimStr(raw.summary)
  if (!summary) throw new DlogicInputError('卡片摘要不能为空。')

  if (!CARD_KINDS.includes(raw.kind as CardKind)) {
    throw new DlogicInputError(`未知的卡片类型「${String(raw.kind)}」，应为 ${CARD_KINDS.join(' / ')} 之一。`)
  }
  const kind = raw.kind as CardKind

  if (!Array.isArray(raw.followups)) throw new DlogicInputError('追问必须是数组。')
  const rawFollowups: unknown[] = raw.followups
  if (rawFollowups.length === 0) throw new DlogicInputError('每张卡片至少需要 1 个追问。')
  if (rawFollowups.length > 6) {
    throw new DlogicInputError(`追问最多 6 个，当前为 ${rawFollowups.length} 个。`)
  }

  const followups: Followup[] = []
  const seenQuestions = new Set<string>()
  for (let i = 0; i < rawFollowups.length; i++) {
    const f = rawFollowups[i]
    if (!isObj(f)) throw new DlogicInputError(`第 ${i + 1} 个追问格式不正确。`)
    const question = trimStr(f.question)
    if (!question) throw new DlogicInputError(`第 ${i + 1} 个追问的问题不能为空。`)
    let angle = f.angle as FollowupAngle
    if (!ANGLES.includes(angle)) {
      // 容错：角度不合法时按「自拟」登记，并提醒下次改用合法取值。
      warnings.push(`第 ${i + 1} 个追问的角度「${String(f.angle)}」无效，已按 free 登记；应为 ${ANGLES.join(' / ')} 之一。`)
      angle = 'free'
    }
    if (seenQuestions.has(question)) {
      warnings.push(`追问重复，已去掉：「${question}」。`)
      continue
    }
    seenQuestions.add(question)

    const followup: Followup = { question, angle, why: trimStr(f.why) }
    const knowledgeId = trimStr(f.knowledgeId)
    if (knowledgeId) {
      const resolved = resolveKnowledge(kb, knowledgeId)
      if (resolved) followup.knowledgeId = resolved
      else warnings.push(`追问「${question}」的知识点「${knowledgeId}」不在知识图谱中，已移除。`)
    }
    followups.push(followup)
  }

  if (followups.length < 2 || followups.length > 4) {
    warnings.push(`追问数量为 ${followups.length}，建议为 2–4 个（窄题少、宽题多）。`)
  }

  const angleCount = new Map<string, number>()
  for (const f of followups) angleCount.set(f.angle, (angleCount.get(f.angle) ?? 0) + 1)
  const repeated = [...angleCount].filter(([, n]) => n > 1).map(([a]) => a)
  if (repeated.length > 0) {
    warnings.push(`追问角度重复（${repeated.join('、')}），下次请让每个追问换一个角度。`)
  }

  const knowledgeIds: string[] = []
  const rawIds: unknown[] = Array.isArray(raw.knowledgeIds) ? raw.knowledgeIds : []
  for (const x of rawIds) {
    const token = trimStr(x)
    if (!token) continue
    const id = resolveKnowledge(kb, token)
    if (!id) warnings.push(`知识点「${token}」不在知识图谱中，已移除。`)
    else if (!knowledgeIds.includes(id)) knowledgeIds.push(id)
  }

  const hood = kb.neighborhood(knowledgeIds)
  const inHood = followups.filter((f) => f.knowledgeId !== undefined && hood.has(f.knowledgeId)).length
  if (inHood < 2) {
    warnings.push(`只有 ${inHood} 个追问的知识点落在本卡片知识点的邻域内（至少需要 2 个）。`)
  }

  let parentId: string | null = null
  if (raw.parentId !== undefined && raw.parentId !== null) {
    if (typeof raw.parentId !== 'string') throw new DlogicInputError('parentId 必须是字符串或 null。')
    const pid = raw.parentId.trim()
    if (pid) {
      parentId = pid
      if (!PARENT_ID_RE.test(pid)) {
        warnings.push(`父卡片编号「${pid}」不符合 cXXXX 格式，请核对。`)
      }
    }
  }

  let parentFollowup: number | undefined
  if (raw.parentFollowup !== undefined && raw.parentFollowup !== null) {
    const pf = raw.parentFollowup
    if (typeof pf !== 'number' || !Number.isInteger(pf) || pf < 0) {
      throw new DlogicInputError('parentFollowup 必须是非负整数。')
    }
    if (parentId === null) {
      throw new DlogicInputError('指定了 parentFollowup 时必须同时提供 parentId。')
    }
    parentFollowup = pf
  }

  const card: CardInput = { title, kind, summary, knowledgeIds, followups, parentId }
  if (parentFollowup !== undefined) card.parentFollowup = parentFollowup
  return { card, warnings }
}
