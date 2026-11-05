import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { TreeNodeVM } from '../src/shared/tree.ts'
import { applyOffsets, layoutForest, type Box, type Layout, type NodeOffsets } from '../src/shared/treeLayout.ts'
import { PUSH_GAP, resolveOffsets } from '../src/shared/treePush.ts'

const size = (): { w: number; h: number } => ({ w: 280, h: 84 })

function node(id: string, children: TreeNodeVM[] = []): TreeNodeVM {
  return { id, kind: 'card', parentId: null, children }
}

/** 两两间距小于 gap（两轴同时小于）即视为重叠。 */
function overlapping(layout: Layout, gap = PUSH_GAP): string[] {
  const ids = [...layout.boxes.keys()].sort()
  const out: string[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout.boxes.get(ids[i])!
      const b = layout.boxes.get(ids[j])!
      const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
      const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
      if (gx < gap && gy < gap) out.push(`${ids[i]}/${ids[j]}`)
    }
  }
  return out
}

/** 不做负坐标归一化的绝对盒子（基础盒子 + 自身与祖先位移之和）。 */
function absBoxes(base: Layout, roots: TreeNodeVM[], offsets: NodeOffsets): Map<string, Box> {
  const m = new Map<string, Box>()
  const walk = (n: TreeNodeVM, dx: number, dy: number): void => {
    const o = offsets[n.id]
    const cdx = dx + (o?.dx ?? 0)
    const cdy = dy + (o?.dy ?? 0)
    const b = base.boxes.get(n.id)!
    m.set(n.id, { x: b.x + cdx, y: b.y + cdy, w: b.w, h: b.h })
    for (const c of n.children) walk(c, cdx, cdy)
  }
  for (const r of roots) walk(r, 0, 0)
  return m
}

// 基础布局（左到右）：
//   R1 (0,0) ─ A1 (328,0), A2 (328,96)
//   R2 (0,204) ─ B1 (328,204)
function sample(): { roots: TreeNodeVM[]; base: Layout } {
  const roots = [node('R1', [node('A1'), node('A2')]), node('R2', [node('B1')])]
  return { roots, base: layoutForest(roots, size) }
}

test('base layout of the sample has no overlaps', () => {
  const { base } = sample()
  assert.deepEqual(overlapping(base), [])
  assert.equal(base.boxes.get('A2')!.y, 96)
  assert.equal(base.boxes.get('R2')!.y, 204)
})

test('dragging a leaf onto its sibling pushes the sibling and leaves no overlap', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { A2: { dx: 0, dy: -96 } }
  const resolved = resolveOffsets(base, roots, offsets, 'A2')
  const applied = applyOffsets(base, roots, resolved)
  assert.deepEqual(overlapping(applied), [])
  // 被拖的叶子保持在被拖位置。
  assert.equal(applied.boxes.get('A2')!.y, 0)
  // 兄弟节点被推开，不再与被拖叶子重叠。
  assert.ok(applied.boxes.get('A1')!.y >= 84 + PUSH_GAP)
})

test('dragging a parent subtree onto another root pushes that root', () => {
  const { roots, base } = sample()
  // R1 整棵子树下移 150：与 R2 (y=204) 重叠。
  const offsets: NodeOffsets = { R1: { dx: 0, dy: 150 } }
  const resolved = resolveOffsets(base, roots, offsets, 'R1')
  const applied = applyOffsets(base, roots, resolved)
  assert.deepEqual(overlapping(applied), [])
  assert.notEqual(applied.boxes.get('R2')!.y, 204)
  assert.ok(applied.boxes.get('R2')!.y > applied.boxes.get('R1')!.y)
})

test('pinned subtree boxes keep their absolute positions', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { R1: { dx: 0, dy: 150 } }
  const resolved = resolveOffsets(base, roots, offsets, 'R1')
  const applied = applyOffsets(base, roots, resolved)
  for (const id of ['R1', 'A1', 'A2']) {
    const b = base.boxes.get(id)!
    assert.deepEqual(applied.boxes.get(id), { x: b.x, y: b.y + 150, w: b.w, h: b.h }, id)
  }
})

test('a pushed subtree moves rigidly: descendants keep their relative positions', () => {
  // R1 为叶子（R2 基础 y=108），R2 有子节点 B1：把 R1 拖到 R2 上，R2 整体下移，B1 跟随。
  const roots = [node('R1'), node('R2', [node('B1')])]
  const base = layoutForest(roots, size)
  assert.equal(base.boxes.get('R2')!.y, 108)
  const offsets: NodeOffsets = { R1: { dx: 0, dy: 108 } }
  const resolved = resolveOffsets(base, roots, offsets, 'R1')
  const applied = applyOffsets(base, roots, resolved)
  assert.deepEqual(overlapping(applied), [])
  const r2 = applied.boxes.get('R2')!
  const b1 = applied.boxes.get('B1')!
  const baseR2 = base.boxes.get('R2')!
  const baseB1 = base.boxes.get('B1')!
  assert.notEqual(r2.y, baseR2.y)
  assert.equal(b1.x - r2.x, baseB1.x - baseR2.x)
  assert.equal(b1.y - r2.y, baseB1.y - baseR2.y)
})

test('an ancestor of the dragged node is moved alone', () => {
  // R1 → M → L1 同一行；把 L1 拖到 M 上：M 被推开，但 L1 与 R1 不动。
  const roots = [node('R1', [node('M', [node('L1')])])]
  const base = layoutForest(roots, size)
  const offsets: NodeOffsets = { L1: { dx: -328, dy: 0 } }
  const resolved = resolveOffsets(base, roots, offsets, 'L1')
  const applied = applyOffsets(base, roots, resolved)
  assert.deepEqual(overlapping(applied), [])
  assert.deepEqual(applied.boxes.get('L1'), { ...base.boxes.get('M')!, x: 328, y: 0 })
  assert.deepEqual(applied.boxes.get('R1'), base.boxes.get('R1'))
  assert.notEqual(applied.boxes.get('M')!.y, 0)
  assert.equal(applied.boxes.get('M')!.x, 328)
})

test('resolved offsets reproduce the absolute boxes up to a uniform translation', () => {
  // R2 拖到负坐标区域并与 R1 重叠，applyOffsets 会整体平移。
  const roots = [node('R1', [node('A1')]), node('R2', [node('B1')])]
  const base = layoutForest(roots, size)
  const offsets: NodeOffsets = { R2: { dx: 0, dy: -250 } }
  const resolved = resolveOffsets(base, roots, offsets, 'R2')
  const applied = applyOffsets(base, roots, resolved)
  const abs = absBoxes(base, roots, resolved)
  assert.deepEqual(overlapping(applied), [])
  const shifts = new Set<string>()
  for (const [id, b] of abs) {
    const a = applied.boxes.get(id)!
    shifts.add(`${a.x - b.x},${a.y - b.y}`)
  }
  assert.equal(shifts.size, 1)
  // 没有负坐标时完全相等。
  const offsetsPositive = resolveOffsets(base, roots, { A1: { dx: 0, dy: 96 } }, 'A1')
  const absPos = absBoxes(base, roots, offsetsPositive)
  const appliedPos = applyOffsets(base, roots, offsetsPositive)
  for (const [id, b] of absPos) assert.deepEqual(appliedPos.boxes.get(id), b, id)
})

test('running resolveOffsets again on its own output changes nothing', () => {
  const { roots, base } = sample()
  const once = resolveOffsets(base, roots, { A2: { dx: 0, dy: -96 } }, 'A2')
  const twice = resolveOffsets(base, roots, once, 'A2')
  assert.deepEqual(twice, once)
})

test('no overlap means the offsets come back unchanged', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { A1: { dx: 10, dy: 0 } }
  assert.deepEqual(resolveOffsets(base, roots, offsets, 'A1'), offsets)
  assert.deepEqual(resolveOffsets(base, roots, {}, 'A1'), {})
})

test('an id that is not in the layout returns the input', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { A2: { dx: 0, dy: -96 } }
  assert.equal(resolveOffsets(base, roots, offsets, 'missing'), offsets)
})

test('the result is deterministic', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { A2: { dx: 0, dy: -96 } }
  const a = resolveOffsets(base, roots, offsets, 'A2')
  const b = resolveOffsets(base, roots, offsets, 'A2')
  assert.deepEqual(a, b)
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort())
})

test('zero offsets are dropped except for the dragged node', () => {
  const { roots, base } = sample()
  const offsets: NodeOffsets = { A2: { dx: 0, dy: -96 }, A1: { dx: 0, dy: 0 } }
  const resolved = resolveOffsets(base, roots, offsets, 'A2')
  assert.deepEqual(resolved.A2, { dx: 0, dy: -96 })
  assert.equal(Object.values(resolved).some((o) => o.dx === 0 && o.dy === 0 && o !== resolved.A2), false)
})

// ───── 随机压力测试：任意位移与拖动之后都不应有重叠 ─────
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function randomForest(r: () => number): { roots: TreeNodeVM[]; ids: string[] } {
  const ids: string[] = []
  let n = 0
  const make = (depth: number): TreeNodeVM => {
    const id = `n${n++}`
    ids.push(id)
    const kids: TreeNodeVM[] = []
    if (depth < 3) {
      const k = Math.floor(r() * 4)
      for (let i = 0; i < k; i++) kids.push(make(depth + 1))
    }
    return node(id, kids)
  }
  const roots: TreeNodeVM[] = []
  const rc = 1 + Math.floor(r() * 3)
  for (let i = 0; i < rc; i++) roots.push(make(0))
  return { roots, ids }
}

test('fuzz: after a random drag the layout has no overlaps', () => {
  const r = rng(12345)
  for (let iter = 0; iter < 300; iter++) {
    const { roots, ids } = randomForest(r)
    const base = layoutForest(roots, () => ({ w: 280, h: 54 + Math.floor(r() * 200) }))
    const dragId = ids[Math.floor(r() * ids.length)]
    const offsets: NodeOffsets = { [dragId]: { dx: Math.round((r() - 0.5) * 900), dy: Math.round((r() - 0.5) * 900) } }
    const resolved = resolveOffsets(base, roots, offsets, dragId)
    const applied = absBoxes(base, roots, resolved)
    const layout: Layout = { boxes: applied, edges: [], width: 0, height: 0 }
    assert.deepEqual(overlapping(layout, PUSH_GAP - 2), [], `iter ${iter} drag ${dragId}`)
  }
})

test('fuzz: tidy mode (dragId null) removes overlaps from arbitrary saved offsets', () => {
  const r = rng(777)
  for (let iter = 0; iter < 300; iter++) {
    const { roots, ids } = randomForest(r)
    const base = layoutForest(roots, () => ({ w: 280, h: 54 + Math.floor(r() * 200) }))
    const offsets: NodeOffsets = {}
    for (const id of ids) {
      if (r() < 0.4) offsets[id] = { dx: Math.round((r() - 0.5) * 500), dy: Math.round((r() - 0.5) * 500) }
    }
    const resolved = resolveOffsets(base, roots, offsets, null)
    const layout: Layout = { boxes: absBoxes(base, roots, resolved), edges: [], width: 0, height: 0 }
    assert.deepEqual(overlapping(layout, PUSH_GAP - 2), [], `iter ${iter}`)
  }
})
