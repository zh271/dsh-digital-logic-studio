import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CardRecord, Followup } from '../src/shared/contracts.ts'
import { EMPTY_TREE, applyTreeEvent, buildForest, knowledgeLabels, treeView } from '../src/shared/tree.ts'
import type { TreeNodeVM, TreeState } from '../src/shared/tree.ts'
import {
  collapsedKey,
  isCardOpen,
  loadCollapsed,
  parseCollapsed,
  saveCollapsed,
  toggleCollapsed,
} from '../src/client/tree/collapsed.ts'
import { COL_GAP, INDENT, ROOT_GAP, applyOffsets, layoutForest, layoutIndented, sourceEdgePath, sourceEdges, type Box } from '../src/shared/treeLayout.ts'
import { mergeCards, childOnlyCallIds, pendingSlotKeys, sameCards } from '../src/client/tree/merge.ts'
import { parseOffsets, offsetsKey } from '../src/client/tree/offsets.ts'

function fu(question: string): Followup {
  return { question, angle: 'principle', why: '理由' }
}

function rec(over: Partial<CardRecord> & { nodeId: string; callId: string }): CardRecord {
  return {
    title: '标题',
    kind: 'concept',
    summary: '摘要',
    knowledgeIds: ['k1.5.2'],
    followups: [fu('问0'), fu('问1'), fu('问2')],
    parentId: null,
    ...over,
  }
}

/** 与 DSH 真实 tool/result 事件同形：不带工具名，callId 在 message.source 下。 */
function cardEvent(result: unknown): unknown {
  const callId = (result as { callId?: string }).callId ?? 'call-x'
  return {
    type: 'tool/result',
    seq: 1,
    data: {
      message: { role: 'tool', source: { kind: 'tool', callId }, content: [{ type: 'text', text: '已登记' }], isError: false },
      meta: { v: 1, tool: 'dlogic_card', value: { ok: true, result } },
    },
  }
}

function applyAll(events: unknown[], start: TreeState = EMPTY_TREE): TreeState {
  return events.reduce<TreeState>((s, e) => applyTreeEvent(s, e), start)
}

test('unrelated events return the same reference', () => {
  const s0 = applyAll([cardEvent(rec({ nodeId: 'cA001', callId: 'call-1' }))])
  assert.equal(applyTreeEvent(s0, { type: 'text', data: 'hi' }), s0)
  assert.equal(applyTreeEvent(s0, { type: 'tool/result', data: { name: 'dlogic_num' } }), s0)
  assert.equal(applyTreeEvent(s0, null), s0)
  assert.equal(applyTreeEvent(EMPTY_TREE, { type: 'tool/result', data: { name: 'dlogic_card' } }), EMPTY_TREE)
})

test('a dlogic_card result appends the record', () => {
  const s = applyTreeEvent(EMPTY_TREE, cardEvent(rec({ nodeId: 'cA001', callId: 'call-1' })))
  assert.equal(s.nodes.length, 1)
  assert.equal(s.nodes[0].nodeId, 'cA001')
  assert.equal(s.nodes[0].callId, 'call-1')
})

test('duplicate callId is ignored', () => {
  const s1 = applyAll([cardEvent(rec({ nodeId: 'cA001', callId: 'call-1' }))])
  const s2 = applyTreeEvent(s1, cardEvent(rec({ nodeId: 'cB002', callId: 'call-1' })))
  assert.equal(s2, s1)
  assert.equal(s2.nodes.length, 1)
})

test('nodeId collision is renamed with a numeric suffix', () => {
  const s = applyAll([
    cardEvent(rec({ nodeId: 'cA001', callId: 'call-1' })),
    cardEvent(rec({ nodeId: 'cA001', callId: 'call-2' })),
    cardEvent(rec({ nodeId: 'cA001', callId: 'call-3' })),
  ])
  assert.deepEqual(
    s.nodes.map((n) => n.nodeId),
    ['cA001', 'cA001-2', 'cA001-3'],
  )
})

test('malformed events are ignored without throwing', () => {
  const bad: unknown[] = [
    { type: 'tool/result', data: { name: 'dlogic_card', meta: { v: 2, tool: 'dlogic_card', value: { ok: true, result: rec({ nodeId: 'cA001', callId: 'x' }) } } } },
    { type: 'tool/result', data: { name: 'dlogic_card', meta: { v: 1, tool: 'dlogic_num', value: { ok: true, result: rec({ nodeId: 'cA001', callId: 'x' }) } } } },
    { type: 'tool/result', data: { name: 'dlogic_card', meta: { v: 1, tool: 'dlogic_card', value: { ok: false, result: null } } } },
    { type: 'tool/result', data: { name: 'dlogic_card', meta: { v: 1, tool: 'dlogic_card', value: { ok: true, result: { nodeId: 'cA001' } } } } },
    { type: 'tool/result', data: { name: 'dlogic_card', meta: 'oops' } },
    { type: 'tool/result', data: null },
    { type: 'tool/result' },
    'not an event',
  ]
  for (const e of bad) {
    assert.equal(applyTreeEvent(EMPTY_TREE, e), EMPTY_TREE)
  }
})

test('treeView is memoized per state', () => {
  const s = applyAll([cardEvent(rec({ nodeId: 'cA001', callId: 'call-1' }))])
  const v1 = treeView(s)
  assert.equal(treeView(s), v1)
  assert.equal(v1.v, 1)
  assert.equal(v1.nodes, s.nodes)
  assert.notEqual(treeView(EMPTY_TREE), v1)
})

// 结构：A(cA001) 有三个追问；B 展开追问 1；D 无槽位地挂在 A 下；C 的 parentId 未知，作为根。
function sampleView() {
  const s = applyAll([
    cardEvent(rec({ nodeId: 'cA001', callId: 'call-A' })),
    cardEvent(rec({ nodeId: 'cB001', callId: 'call-B', parentId: 'cA001', parentFollowup: 1 })),
    cardEvent(rec({ nodeId: 'cD001', callId: 'call-D', parentId: 'cA001' })),
    cardEvent(rec({ nodeId: 'cC001', callId: 'call-C', parentId: 'cNONE' })),
  ])
  return treeView(s)
}

test('buildForest makes stubs for unexpanded followups and places expanded child in its slot', () => {
  const forest = buildForest(sampleView())
  assert.deepEqual(forest.map((n) => n.id), ['cA001', 'cC001'])

  const a = forest[0]
  assert.equal(a.kind, 'card')
  assert.equal(a.parentId, null)
  assert.deepEqual(
    a.children.map((c) => c.id),
    ['cA001#0', 'cB001', 'cA001#2', 'cD001'],
  )

  const stub0 = a.children[0]
  assert.equal(stub0.kind, 'stub')
  assert.equal(stub0.followupIndex, 0)
  assert.equal(stub0.followup?.question, '问0')
  assert.equal(stub0.parentId, 'cA001')
  assert.equal(stub0.card, undefined)

  const b = a.children[1]
  assert.equal(b.kind, 'card')
  assert.equal(b.followupIndex, 1)
  assert.equal(b.followup?.question, '问1')
  assert.equal(b.parentId, 'cA001')
  assert.equal(b.card?.nodeId, 'cB001')

  const stub2 = a.children[2]
  assert.equal(stub2.followup?.question, '问2')

  assert.equal(a.children[3].id, 'cD001')
  assert.equal(a.children[3].followupIndex, undefined)
})

test('expanded card suppresses the matching stub', () => {
  const forest = buildForest(sampleView())
  const ids = (n: TreeNodeVM): string[] => [n.id, ...n.children.flatMap(ids)]
  assert.ok(!ids(forest[0]).includes('cA001#1'))
})

test('layout: no overlaps, children right of parents, roots stacked', () => {
  const forest = buildForest(sampleView())
  const sizeOf = (id: string) => (id.includes('#') ? { w: 90, h: 28 } : { w: 160, h: 64 })
  const layout = layoutForest(forest, sizeOf)

  const ids = [...layout.boxes.keys()]
  // 4 张卡片 + 11 个 stub（A 有 2 个、B/C/D 各 3 个）。
  assert.equal(ids.length, 15)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout.boxes.get(ids[i])!
      const b = layout.boxes.get(ids[j])!
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      assert.equal(overlap, false, `${ids[i]} overlaps ${ids[j]}`)
    }
  }

  for (const e of layout.edges) {
    const p = layout.boxes.get(e.from)!
    const c = layout.boxes.get(e.to)!
    assert.ok(c.x > p.x, `${e.to} should be right of ${e.from}`)
    assert.equal(c.x, p.x + p.w + COL_GAP)
    assert.match(e.path, /^M .* C .* /)
  }
  // 每个非根节点恰有一条入边：15 - 2 个根 = 13。
  assert.equal(layout.edges.length, 13)

  const a = layout.boxes.get('cA001')!
  const c = layout.boxes.get('cC001')!
  assert.equal(a.x, 0)
  assert.ok(a.y >= 0)
  assert.equal(c.x, 0)
  // 根 A 的整棵子树底部 + ROOT_GAP 即为根 C 的起点。
  const subtreeBottom = Math.max(
    ...[...layout.boxes.entries()]
      .filter(([id]) => id === 'cA001' || id.startsWith('cA001#') || id === 'cB001' || id.startsWith('cB001#') || id === 'cD001' || id.startsWith('cD001#'))
      .map(([, b]) => b.y + b.h),
  )
  assert.ok(c.y >= subtreeBottom + ROOT_GAP, 'root C starts below root A subtree plus ROOT_GAP')
  assert.ok(layout.width >= 2 * 160 + COL_GAP)
  assert.ok(layout.height > 0)
})

test('layout: mind-map style, parent is vertically centred on its children', () => {
  const forest = buildForest(sampleView())
  const layout = layoutForest(forest, () => ({ w: 100, h: 40 }))
  for (const n of forest.flatMap((r) => [r, ...r.children])) {
    if (n.children.length === 0) continue
    const p = layout.boxes.get(n.id)!
    const kids = n.children.map((c) => layout.boxes.get(c.id)!)
    const first = kids[0]
    const last = kids[kids.length - 1]
    const mid = (first.y + first.h / 2 + last.y + last.h / 2) / 2
    // 允许被限制在子树带内而略有偏差：父节点中心不超出首尾子节点中心之间。
    assert.ok(p.y + p.h / 2 >= first.y + first.h / 2 - 1e-6 || Math.abs(p.y + p.h / 2 - mid) < 1e-6, `${n.id} near centre`)
    assert.ok(p.y + p.h / 2 <= last.y + last.h / 2 + 1e-6 || Math.abs(p.y + p.h / 2 - mid) < 1e-6, `${n.id} near centre`)
  }
})

test('layout: empty forest has zero size', () => {
  const layout = layoutForest([], () => ({ w: 1, h: 1 }))
  assert.equal(layout.boxes.size, 0)
  assert.equal(layout.edges.length, 0)
  assert.equal(layout.width, 0)
  assert.equal(layout.height, 0)
})

function preorder(forest: TreeNodeVM[]): TreeNodeVM[] {
  const out: TreeNodeVM[] = []
  const walk = (n: TreeNodeVM): void => {
    out.push(n)
    n.children.forEach(walk)
  }
  forest.forEach(walk)
  return out
}

test('indented layout: no overlaps, children below and indented by INDENT', () => {
  const forest = buildForest(sampleView())
  const layout = layoutIndented(forest, () => ({ w: 0, h: 30 }), { width: 300 })
  const ids = [...layout.boxes.keys()]
  assert.equal(ids.length, 15)
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = layout.boxes.get(ids[i])!
      const b = layout.boxes.get(ids[j])!
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      assert.equal(overlap, false, `${ids[i]} overlaps ${ids[j]}`)
    }
  }
  assert.equal(layout.edges.length, 13)
  for (const e of layout.edges) {
    const p = layout.boxes.get(e.from)!
    const c = layout.boxes.get(e.to)!
    assert.ok(c.y >= p.y + p.h, `${e.to} should be below ${e.from}`)
    assert.equal(c.x, p.x + INDENT)
    assert.match(e.path, /^M .* V .* H .*$/)
  }
})

test('indented layout: widths shrink with depth and right edges align to width', () => {
  const forest = buildForest(sampleView())
  const layout = layoutIndented(forest, () => ({ w: 0, h: 30 }), { width: 400 })
  for (const b of layout.boxes.values()) assert.equal(b.x + b.w, 400)
  for (const e of layout.edges) {
    const p = layout.boxes.get(e.from)!
    const c = layout.boxes.get(e.to)!
    assert.equal(c.w, p.w - INDENT)
  }
  assert.equal(layout.boxes.get('cA001')!.w, 400)
})

test('indented layout: rows follow pre-order with 8px row gap and 16px before roots', () => {
  const forest = buildForest(sampleView())
  const layout = layoutIndented(forest, () => ({ w: 0, h: 30 }), { width: 300 })
  const order = preorder(forest)
  const rootIds = new Set(forest.map((r) => r.id))
  for (let i = 1; i < order.length; i++) {
    const prev = layout.boxes.get(order[i - 1].id)!
    const cur = layout.boxes.get(order[i].id)!
    const gap = cur.y - (prev.y + prev.h)
    assert.equal(gap, rootIds.has(order[i].id) ? 16 : 8, `gap before ${order[i].id}`)
  }
  assert.equal(layout.boxes.get(order[0].id)!.y, 0)
})

test('indented layout: width clamps to the minimum and empty forest has zero size', () => {
  const forest = buildForest(sampleView())
  const layout = layoutIndented(forest, () => ({ w: 0, h: 30 }), { width: 100 })
  for (const b of layout.boxes.values()) assert.ok(b.w >= 160)
  const empty = layoutIndented([], () => ({ w: 0, h: 0 }), { width: 300 })
  assert.equal(empty.boxes.size, 0)
  assert.equal(empty.width, 0)
  assert.equal(empty.height, 0)
})

test('applyOffsets: empty offsets return the same layout object', () => {
  const forest = buildForest(sampleView())
  const layout = layoutForest(forest, () => ({ w: 280, h: 60 }))
  assert.equal(applyOffsets(layout, forest, {}), layout)
})

test('applyOffsets: moving a card carries its subtree, not its siblings', () => {
  const forest = buildForest(sampleView())
  const base = layoutForest(forest, () => ({ w: 280, h: 60 }))
  const moved = applyOffsets(base, forest, { cA001: { dx: 40, dy: 10 } })
  for (const id of ['cA001', 'cA001#0', 'cB001', 'cB001#0', 'cD001', 'cD001#1']) {
    const a = base.boxes.get(id)!
    const b = moved.boxes.get(id)!
    assert.equal(b.x - a.x, 40, `${id} x`)
    assert.equal(b.y - a.y, 10, `${id} y`)
  }
  // 根 C 不属于 A 的子树，保持不动。
  assert.equal(moved.boxes.get('cC001')!.x, base.boxes.get('cC001')!.x)
  assert.equal(moved.boxes.get('cC001')!.y, base.boxes.get('cC001')!.y)
})

test('applyOffsets: child offsets add to ancestor offsets and edges are re-routed', () => {
  const forest = buildForest(sampleView())
  const base = layoutForest(forest, () => ({ w: 280, h: 60 }))
  const moved = applyOffsets(base, forest, { cA001: { dx: 0, dy: 30 }, cB001: { dx: 5, dy: -5 } })
  const b = moved.boxes.get('cB001')!
  assert.equal(b.y - base.boxes.get('cB001')!.y, 25)
  for (const e of moved.edges) {
    const p = moved.boxes.get(e.from)!
    assert.ok(e.path.startsWith(`M ${p.x + p.w} `), `${e.from}>${e.to} starts at parent right edge`)
    assert.match(e.path, /^M .* C .* /)
  }
})

test('applyOffsets: negative positions are normalized to the origin', () => {
  const forest = buildForest(sampleView())
  const base = layoutForest(forest, () => ({ w: 280, h: 60 }))
  const moved = applyOffsets(base, forest, { cA001: { dx: -100, dy: -50 } })
  let minX = Infinity
  let minY = Infinity
  for (const b of moved.boxes.values()) {
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
  }
  assert.equal(minX, 0)
  assert.equal(minY, 0)
  assert.ok(moved.width > 0 && moved.height > 0)
})

test('applyOffsets: indented style uses elbow paths', () => {
  const forest = buildForest(sampleView())
  const base = layoutIndented(forest, () => ({ w: 0, h: 30 }), { width: 300 })
  const moved = applyOffsets(base, forest, { cD001: { dx: 4, dy: 0 } }, 'indented')
  for (const e of moved.edges) assert.match(e.path, /^M .* V .* H .*$/)
})

test('applyOffsets: a stub offset (id `${parent}#${i}`) moves only that stub, not its parent or siblings', () => {
  const forest = buildForest(sampleView())
  const base = layoutForest(forest, () => ({ w: 280, h: 60 }))
  const moved = applyOffsets(base, forest, { 'cA001#0': { dx: 30, dy: 6 } })
  const stub = moved.boxes.get('cA001#0')!
  assert.equal(stub.x - base.boxes.get('cA001#0')!.x, 30)
  assert.equal(stub.y - base.boxes.get('cA001#0')!.y, 6)
  // 父卡与同级的其他追问桩/子卡不动。
  assert.equal(moved.boxes.get('cA001')!.y, base.boxes.get('cA001')!.y)
  assert.equal(moved.boxes.get('cA001#2')!.y, base.boxes.get('cA001#2')!.y)
  // 连线跟随移动后的桩。
  const edge = moved.edges.find((e) => e.to === 'cA001#0')!
  assert.ok(edge.path.endsWith(`${stub.x} ${stub.y + stub.h / 2}`))
})

test('applyOffsets: a stub offset whose slot has become a real card (stale id) is ignored', () => {
  // 桩 cA001#1 已被展开的子卡占据：forest 中不再有该 id，陈旧位移不影响布局。
  const view = sampleView()
  const forest = buildForest(view)
  const base = layoutForest(forest, () => ({ w: 280, h: 60 }))
  const withStale = applyOffsets(base, forest, { 'cA001#1': { dx: 500, dy: 500 } })
  assert.equal(withStale.width, base.width)
  assert.equal(withStale.height, base.height)
  for (const [id, b] of base.boxes) assert.deepEqual(withStale.boxes.get(id), b, id)
  // 只有陈旧位移时仍可按无位移处理（不抛出、结构一致）。
  assert.equal(withStale.edges.length, base.edges.length)
})

test('mergeCards: main first, then child, deduped by callId', () => {
  const a = rec({ nodeId: 'cA001', callId: 'call-A' })
  const b = rec({ nodeId: 'cB001', callId: 'call-B', parentId: 'cA001' })
  const bDup = rec({ nodeId: 'cX001', callId: 'call-B' })
  const c = rec({ nodeId: 'cC001', callId: 'call-C', parentId: 'cA001', parentFollowup: 0 })
  const merged = mergeCards([a, b], [bDup, c])
  assert.deepEqual(merged.map((n) => n.callId), ['call-A', 'call-B', 'call-C'])
  assert.equal(merged[1], b)
  assert.deepEqual([...childOnlyCallIds([a, b], [bDup, c])], ['call-C'])
})

test('mergeCards: empty inputs and sameCards', () => {
  assert.deepEqual(mergeCards([], []), [])
  const a = rec({ nodeId: 'cA001', callId: 'call-A' })
  assert.equal(sameCards([a], [a]), true)
  assert.equal(sameCards([a], []), false)
  assert.equal(sameCards([a], [rec({ nodeId: 'cA001', callId: 'call-Z' })]), false)
})

test('parseOffsets keeps only finite dx/dy pairs and never throws', () => {
  assert.deepEqual(parseOffsets('{"cA001":{"dx":3.6,"dy":-2},"bad":{"dx":"1","dy":2},"nan":{"dx":1}}'), {
    cA001: { dx: 4, dy: -2 },
  })
  assert.deepEqual(parseOffsets('not json'), {})
  assert.deepEqual(parseOffsets('[1,2]'), {})
  assert.deepEqual(parseOffsets(null), {})
  assert.equal(offsetsKey('s1'), 'dlogic.tree.offsets.s1')
})

test('mergeCards: colliding child nodeId is renamed so its slot is filled, not re-shown as a stub', () => {
  const main = [rec({ nodeId: 'c0001', callId: 'call-A' })]
  // 子会话独立生成 nodeId，与主会话的 c0001 重名。
  const child = [rec({ nodeId: 'c0001', callId: 'call-C', parentId: 'c0001', parentFollowup: 1 })]
  const merged = mergeCards(main, child)
  assert.equal(merged[0], main[0])
  assert.deepEqual(merged.map((n) => n.nodeId), ['c0001', 'c0001-2'])
  assert.equal(merged[1].parentId, 'c0001')
  assert.equal(merged[1].callId, 'call-C')

  const forest = buildForest(treeView({ nodes: merged }))
  assert.equal(forest.length, 1)
  const root = forest[0]
  const ids = root.children.map((c) => c.id)
  // 槽位 1 已有子卡片，不再有 c0001#1 桩；槽位 0、2 仍是桩。
  assert.deepEqual(ids, ['c0001#0', 'c0001-2', 'c0001#2'])
  assert.equal(root.children[1].kind, 'card')
})

test('mergeCards: child with a unique nodeId is passed through unchanged', () => {
  const child = rec({ nodeId: 'c0002', callId: 'call-C', parentId: 'c0001', parentFollowup: 0 })
  const merged = mergeCards([rec({ nodeId: 'c0001', callId: 'call-A' })], [child])
  assert.equal(merged[1], child)
})

test('pendingSlotKeys keeps unfilled slots sent within the timeout and drops filled or expired ones', () => {
  const sent = new Map<string, number>([
    ['a#0', 1000],
    ['a#1', 1000],
    ['b#0', 5000],
  ])
  const filled = new Set<string>(['a#1'])
  assert.deepEqual([...pendingSlotKeys(sent, filled, 6000, 10000)].sort(), ['a#0', 'b#0'])
  // 超时（发出满 10 秒）后 a#0 不再转圈，b#0 仍在等待。
  assert.deepEqual([...pendingSlotKeys(sent, filled, 11000, 10000)], ['b#0'])
  assert.deepEqual([...pendingSlotKeys(new Map(), filled, 0, 10000)], [])
})

test('knowledgeLabels prefers names and falls back to ids for old cards or mismatched counts', () => {
  assert.deepEqual(knowledgeLabels({ knowledgeIds: ['k1.5.2', 'k1.3'], knowledgeNames: ['卡诺图', '逻辑函数'] }), ['卡诺图', '逻辑函数'])
  // 旧卡片没有名称：回退为编号。
  assert.deepEqual(knowledgeLabels({ knowledgeIds: ['k1.5.2'] }), ['k1.5.2'])
  // 数量不符或含空名：回退为编号，避免错位。
  assert.deepEqual(knowledgeLabels({ knowledgeIds: ['k1.5.2', 'k1.3'], knowledgeNames: ['卡诺图'] }), ['k1.5.2', 'k1.3'])
  assert.deepEqual(knowledgeLabels({ knowledgeIds: ['k1.5.2'], knowledgeNames: [''] }), ['k1.5.2'])
})

test('applyTreeEvent keeps knowledgeNames on the stored record', () => {
  const s = applyTreeEvent(EMPTY_TREE, cardEvent(rec({ nodeId: 'cN001', callId: 'call-n', knowledgeNames: ['卡诺图'] })))
  assert.deepEqual(s.nodes[0].knowledgeNames, ['卡诺图'])
})

test('collapsed: new cards are open by default; toggling twice restores the state', () => {
  const none = new Set<string>()
  assert.equal(isCardOpen(none, 'cA001'), true)
  const once = toggleCollapsed(none, 'cA001')
  assert.equal(isCardOpen(once, 'cA001'), false)
  assert.equal(none.size, 0, 'toggle must not mutate its input')
  const twice = toggleCollapsed(once, 'cA001')
  assert.equal(isCardOpen(twice, 'cA001'), true)
  assert.equal(twice.size, 0)
})

test('collapsed: saved collapse state wins over the default; other cards stay open', () => {
  const saved = parseCollapsed(JSON.stringify(['cA001', 7, '', 'cB002']))
  assert.deepEqual([...saved].sort(), ['cA001', 'cB002'])
  assert.equal(isCardOpen(saved, 'cA001'), false)
  assert.equal(isCardOpen(saved, 'cC003'), true)
})

test('parseCollapsed never throws on bad input', () => {
  assert.equal(parseCollapsed('not json').size, 0)
  assert.equal(parseCollapsed('{"a":1}').size, 0)
  assert.equal(parseCollapsed(null).size, 0)
  assert.equal(parseCollapsed(['x', 1, null]).size, 1)
  assert.equal(collapsedKey('s1'), 'dlogic.tree.collapsed.s1')
})

test('collapsed: load and save round-trip without storage and tolerate a missing localStorage', () => {
  // Node 没有 localStorage：读取回退为空集合，保存不抛出。
  assert.equal(loadCollapsed('s1').size, 0)
  assert.doesNotThrow(() => saveCollapsed('s1', new Set(['cA001'])))
  assert.equal(loadCollapsed('s1').size, 0)
})

test('sourceEdgePath: 从来源右边中点到目标左边中点的三次贝塞尔', () => {
  const src: Box = { x: 0, y: 0, w: 100, h: 40 }
  const dst: Box = { x: 300, y: 100, w: 100, h: 60 }
  // 起点 (100,20)，终点 (300,130)；控制点水平偏移 max(24, (300-100)/2) = 100。
  assert.equal(sourceEdgePath(src, dst), 'M 100 20 C 200 20 200 130 300 130')
})

test('sourceEdgePath: 目标很近时控制点偏移至少 24', () => {
  const src: Box = { x: 0, y: 0, w: 100, h: 40 }
  const dst: Box = { x: 110, y: 0, w: 100, h: 40 }
  assert.equal(sourceEdgePath(src, dst), 'M 100 20 C 124 20 86 20 110 20')
})

test('sourceEdges: 每个来源连一条线，缺失的盒子跳过，重复来源只连一次', () => {
  const boxes = new Map<string, Box>([
    ['a', { x: 0, y: 0, w: 100, h: 40 }],
    ['b', { x: 0, y: 60, w: 100, h: 40 }],
    ['s', { x: 300, y: 0, w: 100, h: 40 }],
  ])
  const cards = [
    { nodeId: 'a' },
    { nodeId: 's', sources: ['a', 'b', 'ghost', 'a', 's'] },
  ]
  const edges = sourceEdges(cards, boxes)
  assert.deepEqual(
    edges.map((e) => [e.from, e.to]),
    [
      ['a', 's'],
      ['b', 's'],
    ],
  )
  assert.equal(edges[0]!.path, sourceEdgePath(boxes.get('a')!, boxes.get('s')!))
})

test('sourceEdges: 没有 sources 或综合卡片本身不在布局中时不产生连线', () => {
  const boxes = new Map<string, Box>([['a', { x: 0, y: 0, w: 100, h: 40 }]])
  assert.deepEqual(sourceEdges([{ nodeId: 'a' }, { nodeId: 'a', sources: [] }], boxes), [])
  assert.deepEqual(sourceEdges([{ nodeId: 'missing', sources: ['a'] }], boxes), [])
})
