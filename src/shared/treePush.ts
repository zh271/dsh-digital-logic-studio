// 学习树的“推开”：拖动卡片时，与之重叠的其他卡片沿最小穿透方向被推开（实时预览），
// 松手后推开的位置作为普通位移保存。纯函数，不依赖 DOM。
import type { TreeNodeVM } from './tree.ts'
import type { Box, Layout, NodeOffsets } from './treeLayout.ts'

/** 推开后相邻盒子之间保留的最小间距（px）。 */
export const PUSH_GAP = 12

const finite = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0)
const hasOwn = (o: NodeOffsets, id: string): boolean => Object.prototype.hasOwnProperty.call(o, id)

interface Item {
  id: string
  base: Box
  /** 绝对左上角坐标（基础盒子 + 自身与祖先的位移之和，不做负坐标归一化）。 */
  x: number
  y: number
  /** 子树内（含自身）的条目下标，用于整棵子树刚性平移。 */
  sub: number[]
}

/**
 * 解析拖动后的位移：`offsets` 已包含被拖节点的新位移。
 * 被拖节点及其子树固定不动；与之重叠（间距不足 gap）的其他节点被推开：
 * 普通节点连同子树刚性平移，祖先节点（子树含被拖节点）只平移自身。
 * 返回的位移以绝对坐标反推，结果可直接交给 applyOffsets 复现。
 * 无重叠时原样返回 offsets；被拖节点不在布局中、或出现异常时也原样返回。
 */
export function resolveOffsets(
  base: Layout,
  roots: TreeNodeVM[],
  offsets: NodeOffsets,
  dragId: string | null,
  opts: { gap?: number } = {},
): NodeOffsets {
  try {
    return resolve(base, roots, offsets, dragId, opts.gap ?? PUSH_GAP)
  } catch {
    return offsets
  }
}

function resolve(base: Layout, roots: TreeNodeVM[], offsets: NodeOffsets, dragId: string | null, gap: number): NodeOffsets {
  // 第一遍：先序遍历，收集布局中的节点并计算绝对坐标与子树下标。
  const items: Item[] = []
  const itemOf = new Map<string, number>()
  const walk = (n: TreeNodeVM, pdx: number, pdy: number): number[] => {
    const o = hasOwn(offsets, n.id) ? offsets[n.id] : undefined
    const cdx = pdx + finite(o?.dx)
    const cdy = pdy + finite(o?.dy)
    const b = base.boxes.get(n.id)
    let idx = -1
    if (b) {
      idx = items.length
      items.push({ id: n.id, base: b, x: b.x + cdx, y: b.y + cdy, sub: [] })
      itemOf.set(n.id, idx)
    }
    const sub: number[] = idx >= 0 ? [idx] : []
    for (const c of n.children) for (const i of walk(c, cdx, cdy)) sub.push(i)
    if (idx >= 0) items[idx].sub = sub
    return sub
  }
  for (const r of roots) walk(r, 0, 0)

  // dragId 为 null 时是“整理”模式：没有固定的拖动节点，重叠时布局顺序靠后的节点被推开
  // （用于树增删卡片、卡片展开收起后，已保存的位移与自动布局产生重叠的情况）。
  const dragIdx = dragId === null ? undefined : itemOf.get(dragId)
  if (dragId !== null && dragIdx === undefined) return offsets
  // 被拖节点及其后代固定（先占位）；其余节点按先序依次摆放：与已摆放的盒子冲突（间距不足 gap）时，
  // 在“紧贴任一已摆放盒子四边”的候选位置中取离原位最近且不冲突的一个，找不到就放到所有盒子下方。
  // 因此一定收敛且结果无重叠。移动一个节点时，它尚未摆放的后代跟随同样的位移（子树刚性平移）。
  const pinned = new Set(dragIdx === undefined ? [] : items[dragIdx].sub)
  const placed: number[] = [...pinned]
  const done = new Set<number>(pinned)
  const conflicts = (x: number, y: number, w: number, h: number, skip: number): boolean => {
    for (const j of placed) {
      if (j === skip) continue
      const o = items[j]
      const gx = Math.max(o.x - (x + w), x - (o.x + o.base.w))
      const gy = Math.max(o.y - (y + h), y - (o.y + o.base.h))
      // 容差 1px：布局坐标可能带 0.5，位移取整后间距会比 gap 少最多 1。
      if (gx < gap - 1 && gy < gap - 1) return true
    }
    return false
  }

  let movedAny = false
  for (let i = 0; i < items.length; i++) {
    if (done.has(i)) continue
    const it = items[i]
    const w = it.base.w
    const h = it.base.h
    if (conflicts(it.x, it.y, w, h, -1)) {
      let bestX = it.x
      let bestY = it.y
      let best = Number.POSITIVE_INFINITY
      const cand = (nx: number, ny: number): void => {
        const d = Math.abs(nx - it.x) + Math.abs(ny - it.y)
        if (d < best && !conflicts(nx, ny, w, h, -1)) {
          best = d
          bestX = nx
          bestY = ny
        }
      }
      let bottom = Number.NEGATIVE_INFINITY
      for (const j of placed) {
        const o = items[j]
        bottom = Math.max(bottom, o.y + o.base.h)
        cand(o.x + o.base.w + gap, it.y)
        cand(o.x - w - gap, it.y)
        cand(it.x, o.y + o.base.h + gap)
        cand(it.x, o.y - h - gap)
      }
      if (best === Number.POSITIVE_INFINITY) {
        bestX = it.x
        bestY = bottom + gap
      }
      const dx = bestX - it.x
      const dy = bestY - it.y
      // 本节点及其尚未摆放的后代整体平移。
      for (const k of it.sub) {
        if (!done.has(k)) {
          items[k].x += dx
          items[k].y += dy
        }
      }
      movedAny = true
    }
    done.add(i)
    placed.push(i)
  }
  if (!movedAny) return offsets
  // 第二遍：由绝对坐标反推各节点相对父节点的位移；未在布局中的条目保持原样。
  const out: NodeOffsets = { ...offsets }
  const rebuild = (n: TreeNodeVM, pdx: number, pdy: number): void => {
    const idx = itemOf.get(n.id)
    let cdx: number
    let cdy: number
    if (idx !== undefined) {
      const it = items[idx]
      cdx = Math.round(it.x - it.base.x)
      cdy = Math.round(it.y - it.base.y)
      const odx = cdx - pdx
      const ody = cdy - pdy
      if ((dragId !== null && n.id === dragId) || odx !== 0 || ody !== 0) out[n.id] = { dx: odx, dy: ody }
      else delete out[n.id]
    } else {
      const o = hasOwn(offsets, n.id) ? offsets[n.id] : undefined
      cdx = pdx + finite(o?.dx)
      cdy = pdy + finite(o?.dy)
    }
    for (const c of n.children) rebuild(c, cdx, cdy)
  }
  for (const r of roots) rebuild(r, 0, 0)
  return out
}
