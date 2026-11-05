// 知识图谱：校验 knowledge-map.json 并构建只读索引，提供查询、搜索与邻域计算。纯函数。
import type { KnowledgeNode } from '../shared/contracts.ts'
import mapData from '../../skills/digital-logic-tutor/references/knowledge-map.json' with { type: 'json' }

export interface Neighbors {
  node: KnowledgeNode | null
  parent: KnowledgeNode | null
  children: KnowledgeNode[]
  /** 本节点依赖的前置知识。 */
  prereqs: KnowledgeNode[]
  /** 把本节点列为前置的知识点。 */
  dependents: KnowledgeNode[]
  /** 双向的相关知识（任一方声明即算）。 */
  related: KnowledgeNode[]
}

export interface KnowledgeBase {
  readonly nodes: KnowledgeNode[]
  get(id: string): KnowledgeNode | undefined
  has(id: string): boolean
  lookup(ids: string[]): { found: KnowledgeNode[]; missing: string[] }
  neighbors(id: string): Neighbors
  search(query: string, limit?: number): KnowledgeNode[]
  /** ids 本身，加上它们的前置、后继、相关、父节点与子节点。 */
  neighborhood(ids: string[]): Set<string>
}

const ID_RE = /^k\d+(\.\d+)*$/
const WHITE = 0
const GRAY = 1
const BLACK = 2

/** "k1.5.2" -> "k1.5"；"k1.5" -> "k1"；"k1" -> null。 */
function parentIdOf(id: string): string | null {
  const i = id.lastIndexOf('.')
  return i > 0 ? id.slice(0, i) : null
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function createKnowledgeBase(input: KnowledgeNode[]): KnowledgeBase {
  if (!Array.isArray(input)) throw new Error('知识图谱必须是数组。')

  const byId = new Map<string, KnowledgeNode>()
  for (const n of input) {
    if (!n || typeof n.id !== 'string' || n.id === '') throw new Error('知识点缺少 id。')
    if (byId.has(n.id)) throw new Error(`知识点 id 重复：${n.id}`)
    byId.set(n.id, n)
  }

  for (const n of input) {
    if (!ID_RE.test(n.id)) throw new Error(`知识点 id 格式不正确：${n.id}`)
    if (typeof n.title !== 'string' || n.title.trim() === '') throw new Error(`知识点 ${n.id} 缺少标题。`)
    if (n.id.split('.')[0] !== `k${n.chapter}`) {
      throw new Error(`知识点 ${n.id} 的章节号 ${n.chapter} 与 id 不一致。`)
    }
    if (!Array.isArray(n.keywords)) throw new Error(`知识点 ${n.id} 的 keywords 必须是数组。`)
    for (const field of ['prereqs', 'related'] as const) {
      const refs = n[field]
      if (!Array.isArray(refs)) throw new Error(`知识点 ${n.id} 的 ${field} 必须是数组。`)
      for (const ref of refs) {
        if (ref === n.id) throw new Error(`知识点 ${n.id} 的 ${field} 不能指向自身。`)
        if (!byId.has(ref)) throw new Error(`知识点 ${n.id} 的 ${field} 引用了不存在的 id：${ref}`)
      }
    }
  }

  // 前置关系必须无环（DFS 三色标记，发现回边时报出完整环路）。
  const color = new Map<string, number>()
  const path: string[] = []
  const visit = (id: string): void => {
    color.set(id, GRAY)
    path.push(id)
    for (const p of byId.get(id)!.prereqs) {
      const c = color.get(p) ?? WHITE
      if (c === GRAY) {
        const cycle = path.slice(path.indexOf(p)).concat(p)
        throw new Error(`前置知识存在循环：${cycle.join(' -> ')}`)
      }
      if (c === WHITE) visit(p)
    }
    path.pop()
    color.set(id, BLACK)
  }
  for (const n of input) if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id)

  const dependentsOf = new Map<string, string[]>()
  const relatedInverse = new Map<string, string[]>()
  const childrenOf = new Map<string, string[]>()
  for (const n of input) {
    for (const p of n.prereqs) push(dependentsOf, p, n.id)
    for (const r of n.related) push(relatedInverse, r, n.id)
    const pid = parentIdOf(n.id)
    if (pid && byId.has(pid)) push(childrenOf, pid, n.id)
  }

  const pick = (ids: string[] | undefined): KnowledgeNode[] =>
    (ids ?? []).map((id) => byId.get(id)).filter((n): n is KnowledgeNode => n !== undefined)

  const relatedIds = (id: string): string[] => {
    const own = byId.get(id)?.related ?? []
    return [...new Set([...own, ...(relatedInverse.get(id) ?? [])])]
  }

  const get = (id: string): KnowledgeNode | undefined => byId.get(id)

  const has = (id: string): boolean => byId.has(id)

  const lookup = (ids: string[]): { found: KnowledgeNode[]; missing: string[] } => {
    const found: KnowledgeNode[] = []
    const missing: string[] = []
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) continue
      seen.add(id)
      const node = byId.get(id)
      if (node) found.push(node)
      else missing.push(id)
    }
    return { found, missing }
  }

  const neighbors = (id: string): Neighbors => {
    const node = byId.get(id)
    if (!node) return { node: null, parent: null, children: [], prereqs: [], dependents: [], related: [] }
    const pid = parentIdOf(id)
    return {
      node,
      parent: pid ? (byId.get(pid) ?? null) : null,
      children: pick(childrenOf.get(id)),
      prereqs: pick(node.prereqs),
      dependents: pick(dependentsOf.get(id)),
      related: pick(relatedIds(id)),
    }
  }

  const search = (query: string, limit = 10): KnowledgeNode[] => {
    const terms = String(query ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean)
    if (terms.length === 0 || limit <= 0) return []

    const scored: { node: KnowledgeNode; index: number; titleHits: number; hits: number }[] = []
    input.forEach((node, index) => {
      const title = node.title.toLowerCase()
      const keywords = node.keywords.map((k) => k.toLowerCase())
      let titleHits = 0
      let hits = 0
      for (const term of terms) {
        const inTitle = title.includes(term)
        if (inTitle) titleHits++
        if (inTitle || keywords.some((k) => k.includes(term))) hits++
      }
      if (hits > 0) scored.push({ node, index, titleHits, hits })
    })

    scored.sort(
      (a, b) =>
        b.titleHits - a.titleHits ||
        b.hits - a.hits ||
        a.node.title.length - b.node.title.length ||
        a.index - b.index,
    )
    return scored.slice(0, limit).map((s) => s.node)
  }

  const neighborhood = (ids: string[]): Set<string> => {
    const out = new Set<string>()
    if (!Array.isArray(ids)) return out
    for (const id of ids) {
      out.add(id)
      const nb = neighbors(id)
      if (!nb.node) continue
      for (const n of [nb.parent, ...nb.children, ...nb.prereqs, ...nb.dependents, ...nb.related]) {
        if (n) out.add(n.id)
      }
    }
    return out
  }

  return { nodes: [...input], get, has, lookup, neighbors, search, neighborhood }
}

let cached: KnowledgeBase | undefined

/** 由随包的 knowledge-map.json 构建的知识图谱（首次调用时校验并缓存）。 */
export function defaultKnowledgeBase(): KnowledgeBase {
  if (!cached) cached = createKnowledgeBase(mapData as unknown as KnowledgeNode[])
  return cached
}
