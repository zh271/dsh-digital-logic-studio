// 学习树的左到右 tidy-tree 布局。纯函数：输入树与尺寸函数，输出各节点盒子与连线路径。
import type { TreeNodeVM } from './tree.ts'

/** 父节点右边与子节点左边之间的水平间距。 */
export const COL_GAP = 48
/** 同一父节点下相邻兄弟子树之间的垂直间距。 */
export const ROW_GAP = 12
/** 根节点之间的垂直间距。 */
export const ROOT_GAP = 24
/** 连线锚点相对节点顶部的最大偏移。 */
export const EDGE_ANCHOR_MAX = 20
/** 贝塞尔控制点的最小水平偏移。 */
export const EDGE_CTRL_MIN = 24

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutEdge {
  from: string
  to: string
  /** SVG 三次贝塞尔路径。 */
  path: string
}

export interface Layout {
  boxes: Map<string, Box>
  edges: LayoutEdge[]
  width: number
  height: number
}

/** 父盒子与子盒子之间的连线：从父右边中点到子左边中点（思维导图式，分支从节点中间延伸）。 */
export function edgePath(parent: Box, child: Box): string {
  const sx = parent.x + parent.w
  const sy = parent.y + parent.h / 2
  const ex = child.x
  const ey = child.y + child.h / 2
  const off = Math.max(EDGE_CTRL_MIN, (ex - sx) / 2)
  return `M ${sx} ${sy} C ${sx + off} ${sy} ${ex - off} ${ey} ${ex} ${ey}`
}

export function layoutForest(
  roots: TreeNodeVM[],
  sizeOf: (id: string) => { w: number; h: number },
): Layout {
  const sizes = new Map<string, { w: number; h: number }>()
  const sizeFor = (n: TreeNodeVM): { w: number; h: number } => {
    let s = sizes.get(n.id)
    if (!s) {
      const r = sizeOf(n.id)
      s = { w: Math.max(0, Number(r.w) || 0), h: Math.max(0, Number(r.h) || 0) }
      sizes.set(n.id, s)
    }
    return s
  }

  // 子树高度 = max(自身高度, 子节点纵向堆叠高度)。
  const heights = new Map<TreeNodeVM, number>()
  const subtreeHeight = (n: TreeNodeVM): number => {
    const cached = heights.get(n)
    if (cached !== undefined) return cached
    let stack = 0
    n.children.forEach((c, i) => {
      stack += (i > 0 ? ROW_GAP : 0) + subtreeHeight(c)
    })
    const h = Math.max(sizeFor(n).h, stack)
    heights.set(n, h)
    return h
  }

  const boxes = new Map<string, Box>()
  const edges: LayoutEdge[] = []

  // 子节点纵向堆叠的总高度。
  const stackHeight = (n: TreeNodeVM): number => {
    let stack = 0
    n.children.forEach((c, i) => {
      stack += (i > 0 ? ROW_GAP : 0) + subtreeHeight(c)
    })
    return stack
  }

  // 思维导图式：y 是本子树带的顶部。先放子节点（堆叠块在带内居中），再让父节点的中心
  // 对准第一个与最后一个子节点中心的中点（限制在本子树带内，保证不与相邻子树重叠）。
  const place = (n: TreeNodeVM, x: number, y: number): void => {
    const s = sizeFor(n)
    const band = subtreeHeight(n)
    const box: Box = { x, y: y + (band - s.h) / 2, w: s.w, h: s.h }
    boxes.set(n.id, box)
    const childX = x + s.w + COL_GAP
    let cy = y + (band - stackHeight(n)) / 2
    for (const c of n.children) {
      place(c, childX, cy)
      cy += subtreeHeight(c) + ROW_GAP
    }
    if (n.children.length > 0) {
      const first = boxes.get(n.children[0].id)!
      const last = boxes.get(n.children[n.children.length - 1].id)!
      const mid = (first.y + first.h / 2 + last.y + last.h / 2) / 2
      box.y = Math.min(Math.max(mid - s.h / 2, y), y + band - s.h)
    }
    for (const c of n.children) edges.push({ from: n.id, to: c.id, path: edgePath(box, boxes.get(c.id)!) })
  }

  let ry = 0
  for (const r of roots) {
    place(r, 0, ry)
    ry += subtreeHeight(r) + ROOT_GAP
  }

  let width = 0
  let height = 0
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w)
    height = Math.max(height, b.y + b.h)
  }
  return { boxes, edges, width, height }
}

/** 大纲式：每层缩进。 */
export const INDENT = 16
/** 大纲式：同一棵树中相邻节点之间的垂直间距。 */
export const INDENT_ROW_GAP = 8
/** 大纲式：根节点之间的垂直间距（总计，含 INDENT_ROW_GAP）。 */
export const INDENT_ROOT_GAP = 16
/** 大纲式：节点最小宽度。 */
export const INDENT_MIN_W = 160
/** 大纲式：连线进入子节点左边的锚点相对顶部的最大偏移。 */
export const INDENT_ANCHOR_MAX = 18

/** 大纲式连线：从父节点左边 +8 向下，再向右进入子节点左边。 */
export function elbowPath(parent: Box, child: Box): string {
  const sx = parent.x + 8
  const sy = parent.y + parent.h
  const ex = child.x
  const ey = child.y + Math.min(child.h / 2, INDENT_ANCHOR_MAX)
  return `M ${sx} ${sy} V ${ey} H ${ex}`
}

/**
 * 大纲式布局（窄面板用）：节点按先序逐行排列，子节点缩进 INDENT。
 * 节点宽度 = width - depth*INDENT（不小于 INDENT_MIN_W），右边界对齐 width。
 */
export function layoutIndented(
  roots: TreeNodeVM[],
  sizeOf: (id: string) => { w: number; h: number },
  opts: { width: number },
): Layout {
  const hOf = (n: TreeNodeVM): number => Math.max(0, Number(sizeOf(n.id).h) || 0)
  const boxes = new Map<string, Box>()
  const edges: LayoutEdge[] = []
  let y = 0

  const place = (n: TreeNodeVM, depth: number, parent: { id: string; box: Box } | null): void => {
    const x = depth * INDENT
    const w = Math.max(INDENT_MIN_W, opts.width - x)
    const box: Box = { x, y, w, h: hOf(n) }
    boxes.set(n.id, box)
    if (parent) edges.push({ from: parent.id, to: n.id, path: elbowPath(parent.box, box) })
    y += box.h + INDENT_ROW_GAP
    for (const c of n.children) place(c, depth + 1, { id: n.id, box })
  }

  roots.forEach((r, i) => {
    if (i > 0) y += INDENT_ROOT_GAP - INDENT_ROW_GAP
    place(r, 0, null)
  })

  let width = 0
  let height = 0
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w)
    height = Math.max(height, b.y + b.h)
  }
  return { boxes, edges, width, height }
}

/** 综合卡片来源虚线：从来源盒子右边中点到综合卡片左边中点的贝塞尔路径（与 edgePath 同形）。 */
export function sourceEdgePath(src: Box, dst: Box): string {
  const sx = src.x + src.w
  const sy = src.y + src.h / 2
  const ex = dst.x
  const ey = dst.y + dst.h / 2
  const off = Math.max(EDGE_CTRL_MIN, (ex - sx) / 2)
  return `M ${sx} ${sy} C ${sx + off} ${sy} ${ex - off} ${ey} ${ex} ${ey}`
}

/**
 * 综合卡片到各来源卡片的连线。缺失的盒子（来源或卡片不在布局中）跳过；
 * 同一卡片重复的来源只连一次；指向自身的来源忽略。
 */
export function sourceEdges(
  cards: readonly { nodeId: string; sources?: readonly string[] }[],
  boxes: ReadonlyMap<string, Box>,
): LayoutEdge[] {
  const out: LayoutEdge[] = []
  for (const card of cards) {
    if (!card.sources || card.sources.length === 0) continue
    const dst = boxes.get(card.nodeId)
    if (!dst) continue
    for (const s of new Set(card.sources)) {
      if (s === card.nodeId) continue
      const src = boxes.get(s)
      if (!src) continue
      out.push({ from: s, to: card.nodeId, path: sourceEdgePath(src, dst) })
    }
  }
  return out
}

/** 节点的手动位移（相对自动布局的偏移，单位像素）。 */
export interface NodeOffset {
  dx: number
  dy: number
}

export type NodeOffsets = Record<string, NodeOffset>

const finite = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0)

/**
 * 应用手动位移：节点移动时带动整棵子树（子节点的位移 = 自身与所有祖先的位移之和）。
 * 连线按新盒子重算。若结果出现负坐标，整体平移到左上角为 0。无位移时原样返回。
 * style 决定连线形状：forest 为左到右贝塞尔，indented 为大纲式折线。
 */
export function applyOffsets(
  layout: Layout,
  roots: TreeNodeVM[],
  offsets: NodeOffsets,
  style: 'forest' | 'indented' = 'forest',
): Layout {
  if (Object.keys(offsets).length === 0) return layout

  const shift = new Map<string, { dx: number; dy: number }>()
  const walk = (n: TreeNodeVM, dx: number, dy: number): void => {
    const o = Object.prototype.hasOwnProperty.call(offsets, n.id) ? offsets[n.id] : undefined
    const total = { dx: dx + finite(o?.dx), dy: dy + finite(o?.dy) }
    shift.set(n.id, total)
    for (const c of n.children) walk(c, total.dx, total.dy)
  }
  for (const r of roots) walk(r, 0, 0)

  const boxes = new Map<string, Box>()
  let minX = 0
  let minY = 0
  for (const [id, b] of layout.boxes) {
    const s = shift.get(id) ?? { dx: 0, dy: 0 }
    const box: Box = { x: b.x + s.dx, y: b.y + s.dy, w: b.w, h: b.h }
    boxes.set(id, box)
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
  }
  if (minX < 0 || minY < 0) {
    for (const [id, b] of boxes) boxes.set(id, { ...b, x: b.x - minX, y: b.y - minY })
  }

  const edges: LayoutEdge[] = layout.edges.map((e) => {
    const p = boxes.get(e.from)!
    const c = boxes.get(e.to)!
    return { from: e.from, to: e.to, path: style === 'indented' ? elbowPath(p, c) : edgePath(p, c) }
  })

  let width = 0
  let height = 0
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w)
    height = Math.max(height, b.y + b.h)
  }
  return { boxes, edges, width, height }
}
