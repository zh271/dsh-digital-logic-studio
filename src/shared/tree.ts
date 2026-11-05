// 学习树状态：从工具事件累积卡片，并投影为前端视图与树形结构。纯函数，供 Host 投影与浏览器共用。
import type { CardRecord, Followup, TreeView } from './contracts.ts'

export interface TreeState {
  nodes: CardRecord[]
}

export const EMPTY_TREE: TreeState = { nodes: [] }

export interface TreeNodeVM {
  id: string
  kind: 'card' | 'stub'
  card?: CardRecord
  followup?: Followup
  followupIndex?: number
  parentId: string | null
  children: TreeNodeVM[]
}

type Obj = Record<string, unknown>

function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function isFollowupLike(x: unknown): x is Followup {
  return isObj(x) && typeof x.question === 'string'
}

function isCardRecord(x: unknown): x is CardRecord {
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
    x.followups.every(isFollowupLike) &&
    (x.parentId === null || typeof x.parentId === 'string')
  )
}

/**
 * 从 tool/result 事件中取出 dlogic_card 的卡片记录；形状不符时返回 null。
 * 注意：DSH 的 tool/result 事件不带工具名（只有 data.message.source.callId 与 data.meta），
 * 所以这里只凭本插件写入的 meta.tool 识别。
 */
function extractCard(event: unknown): CardRecord | null {
  if (!isObj(event) || event.type !== 'tool/result') return null
  const data = event.data
  if (!isObj(data)) return null
  const meta = data.meta
  if (!isObj(meta) || meta.v !== 1 || meta.tool !== 'dlogic_card') return null
  const value = meta.value
  if (!isObj(value) || value.ok !== true) return null
  return isCardRecord(value.result) ? value.result : null
}

export function applyTreeEvent(state: TreeState, event: any): TreeState {
  const record = extractCard(event)
  if (!record) return state
  if (state.nodes.some((n) => n.callId === record.callId)) return state

  const taken = new Set(state.nodes.map((n) => n.nodeId))
  let nodeId = record.nodeId
  if (taken.has(nodeId)) {
    let k = 2
    while (taken.has(`${record.nodeId}-${k}`)) k++
    nodeId = `${record.nodeId}-${k}`
  }
  return { nodes: [...state.nodes, { ...record, nodeId }] }
}

/** 卡片上显示的知识点文字：优先名称；旧卡片没有名称（或数量不符）时回退为编号。 */
export function knowledgeLabels(card: Pick<CardRecord, 'knowledgeIds' | 'knowledgeNames'>): string[] {
  const names = card.knowledgeNames
  if (Array.isArray(names) && names.length === card.knowledgeIds.length && names.every((n) => typeof n === 'string' && n !== '')) {
    return names
  }
  return card.knowledgeIds
}

const viewCache = new WeakMap<TreeState, TreeView>()

export function treeView(state: TreeState): TreeView {
  let view = viewCache.get(state)
  if (!view) {
    view = { v: 1, nodes: state.nodes }
    viewCache.set(state, view)
  }
  return view
}

/**
 * 构造前端树。每张卡片都是节点；卡片的追问若没有子卡片展开，则生成 stub 节点（id 为 `${nodeId}#${i}`）。
 * 子节点顺序：先按追问序号放入对应槽位，再放没有追问槽位的子卡片（按出现顺序）。
 * parentId 为 null 或未知的卡片作为根，按出现顺序排列。
 */
export function buildForest(view: TreeView): TreeNodeVM[] {
  const seen = new Set<string>()
  const uniq: CardRecord[] = []
  for (const c of view.nodes) {
    if (seen.has(c.nodeId)) continue
    seen.add(c.nodeId)
    uniq.push(c)
  }
  const byId = new Map(uniq.map((c) => [c.nodeId, c] as const))

  const kids = new Map<string, CardRecord[]>()
  const roots: CardRecord[] = []
  for (const c of uniq) {
    if (c.parentId && c.parentId !== c.nodeId && byId.has(c.parentId)) {
      const list = kids.get(c.parentId)
      if (list) list.push(c)
      else kids.set(c.parentId, [c])
    } else {
      roots.push(c)
    }
  }

  const placed = new Set<string>()

  const build = (card: CardRecord, parentId: string | null, slot?: { index: number; followup: Followup }): TreeNodeVM => {
    placed.add(card.nodeId)
    const followups = card.followups
    const slotted = new Map<number, CardRecord[]>()
    const unslotted: CardRecord[] = []
    for (const k of kids.get(card.nodeId) ?? []) {
      if (placed.has(k.nodeId)) continue
      const pf = k.parentFollowup
      if (typeof pf === 'number' && Number.isInteger(pf) && pf >= 0 && pf < followups.length) {
        const list = slotted.get(pf)
        if (list) list.push(k)
        else slotted.set(pf, [k])
      } else {
        unslotted.push(k)
      }
    }

    const children: TreeNodeVM[] = []
    for (let i = 0; i < followups.length; i++) {
      const expanded = slotted.get(i)
      if (expanded && expanded.length > 0) {
        for (const k of expanded) children.push(build(k, card.nodeId, { index: i, followup: followups[i] }))
      } else {
        children.push({
          id: `${card.nodeId}#${i}`,
          kind: 'stub',
          followup: followups[i],
          followupIndex: i,
          parentId: card.nodeId,
          children: [],
        })
      }
    }
    for (const k of unslotted) children.push(build(k, card.nodeId))

    const vm: TreeNodeVM = { id: card.nodeId, kind: 'card', card, parentId, children }
    if (slot) {
      vm.followup = slot.followup
      vm.followupIndex = slot.index
    }
    return vm
  }

  const forest: TreeNodeVM[] = []
  for (const r of roots) {
    if (!placed.has(r.nodeId)) forest.push(build(r, null))
  }
  // 兜底：父子关系成环的卡片无法从根到达，作为根补入，避免丢失。
  for (const c of uniq) {
    if (!placed.has(c.nodeId)) forest.push(build(c, null))
  }
  return forest
}
