// 侧边追问的纯逻辑（不依赖 DSH 运行时，可单测）：上下文路径与追问子代理的选取。
import type { CardRecord, TreeView } from '../../shared/contracts.ts'
import { FOLLOWUP_CHILD_LABEL } from '../../shared/sidechat.ts'

/** 上下文路径最多保留的卡片数（取离被追问卡片最近的若干张）。 */
export const PATH_CAP = 6

export type PathEntry = Pick<CardRecord, 'nodeId' | 'title' | 'summary' | 'knowledgeIds'>

/**
 * 从根到 card 的路径（含 card 本身），最多 cap 条，保留最靠近 card 的。
 * 沿 parentId 向上走；遇到未知或成环的 parentId 即停止。
 */
export function buildContextPath(tree: TreeView | undefined, card: CardRecord, cap: number = PATH_CAP): PathEntry[] {
  const byId = new Map<string, CardRecord>()
  for (const n of tree?.nodes ?? []) byId.set(n.nodeId, n)
  const chain: CardRecord[] = [card]
  const seen = new Set<string>([card.nodeId])
  let cur: CardRecord = card
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    cur = byId.get(cur.parentId)!
    seen.add(cur.nodeId)
    chain.unshift(cur)
  }
  const kept = chain.slice(-Math.max(1, cap))
  return kept.map((n) => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: n.knowledgeIds }))
}

/** 子代理目录快照的最小结构（与 ctx.sessions.list.getSnapshot() 对应的字段）。 */
export interface CatalogSnapshot {
  /** 较新版本 DSH 的字段。 */
  subagentsByParent?: Record<string, { state?: string; entries?: CatalogEntry[] } | undefined>
  /** DSH 0.2.x：父会话的子代理目录在其投影值 subagentCatalog 里（ui-subagent 即如此读取）。 */
  projectionsBySession?: Record<string, { values?: { subagentCatalog?: CatalogEntry[] } } | undefined>
  byId?: Record<string, { projectionValues?: { subagent?: { label?: unknown } } } | undefined>
}

export interface CatalogEntry {
  kind?: string
  id?: string
  mode?: string
  /** 子代理标签直接在目录条目上（DSH ui-subagent 读取 entry.label）。 */
  label?: unknown
}

/**
 * 在目录快照中列出主会话 parentId 的全部追问子代理（kind 为 child、mode 为 continuable，
 * 且标签等于 FOLLOWUP_CHILD_LABEL），按目录顺序（旧到新）返回，去重。找不到返回空数组。
 */
export function selectAllFollowupChildren(snapshot: CatalogSnapshot | undefined | null, parentId: string): string[] {
  if (!snapshot || !parentId) return []
  const group = snapshot.subagentsByParent?.[parentId]
  const projected = snapshot.projectionsBySession?.[parentId]?.values?.subagentCatalog
  const entries = Array.isArray(group?.entries) ? group!.entries! : Array.isArray(projected) ? projected : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    // 0.2.x 的目录条目没有 kind 字段；有 kind 时只认 child。
    if (!e || (e.kind !== undefined && e.kind !== 'child') || e.mode !== 'continuable' || typeof e.id !== 'string') continue
    // 目录条目自带 label；byId 的投影值只有子会话被打开过才有，仅作后备。
    const label = e.label ?? snapshot.byId?.[e.id]?.projectionValues?.subagent?.label
    if (label !== FOLLOWUP_CHILD_LABEL || seen.has(e.id)) continue
    seen.add(e.id)
    out.push(e.id)
  }
  return out
}

/**
 * 在目录快照中找出主会话 parentId 的最新追问子代理（即 selectAllFollowupChildren 的最后一个）。
 * 抽屉与全屏只针对它。找不到返回 undefined。
 */
export function selectFollowupChild(snapshot: CatalogSnapshot | undefined | null, parentId: string): string | undefined {
  const all = selectAllFollowupChildren(snapshot, parentId)
  return all.length > 0 ? all[all.length - 1] : undefined
}
