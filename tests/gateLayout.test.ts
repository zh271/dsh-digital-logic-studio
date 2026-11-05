import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutGateDiagram, type GateDiagramLayout, type GateLayoutNetlist, type GatePoint } from '../src/shared/gateLayout.ts'

// ───────────────────────── 样例网表 ─────────────────────────

/** 三与非门多数表决（教材例）。 */
const MAJ: GateLayoutNetlist = {
  inputs: ['A', 'B', 'C'],
  gates: [
    { out: 'n1', type: 'NAND', in: ['A', 'B'] },
    { out: 'n2', type: 'NAND', in: ['B', 'C'] },
    { out: 'n3', type: 'NAND', in: ['A', 'C'] },
    { out: 'Y', type: 'NAND', in: ['n1', 'n2', 'n3'] },
  ],
  outputs: ['Y'],
}

/** X = AB' + BC' + CA'：三个非门、三个与门、一个或门。 */
const SOP: GateLayoutNetlist = {
  inputs: ['A', 'B', 'C'],
  gates: [
    { out: 'B_n', type: 'NOT', in: ['B'] },
    { out: 'C_n', type: 'NOT', in: ['C'] },
    { out: 'A_n', type: 'NOT', in: ['A'] },
    { out: 'P1', type: 'AND', in: ['A', 'B_n'] },
    { out: 'P2', type: 'AND', in: ['B', 'C_n'] },
    { out: 'P3', type: 'AND', in: ['C', 'A_n'] },
    { out: 'F', type: 'OR', in: ['P1', 'P2', 'P3'] },
  ],
  outputs: ['F'],
}

/** 长连线：输入 A 直接连到第 4 级的门，中间经过多级。 */
const LONG: GateLayoutNetlist = {
  inputs: ['A', 'B'],
  gates: [
    { out: 'g1', type: 'NOT', in: ['B'] },
    { out: 'g2', type: 'AND', in: ['g1', 'B'] },
    { out: 'g3', type: 'OR', in: ['g2', 'g1'] },
    { out: 'Z', type: 'XOR', in: ['g3', 'A'] },
    { out: 'W', type: 'NAND', in: ['A', 'g2'] },
  ],
  outputs: ['Z', 'W'],
}

const SAMPLES: [string, GateLayoutNetlist][] = [
  ['majority', MAJ],
  ['sop', SOP],
  ['long', LONG],
]

// ───────────────────────── 辅助 ─────────────────────────

/** 信号源引脚：输入端或门输出引脚。 */
function sourceOf(lay: GateDiagramLayout, signal: string): GatePoint {
  const inp = lay.inputs.find(i => i.name === signal)
  if (inp) return { x: inp.x, y: inp.y }
  const g = lay.gates.find(x => x.out === signal)
  if (!g) throw new Error(`未知信号 ${signal}`)
  return g.outPin
}

/** 终点引脚：门输入引脚或输出标签。 */
function destOf(lay: GateDiagramLayout, to: { gate: string; pin: number } | { output: string }): GatePoint {
  if ('output' in to) {
    const o = lay.outputs.find(x => x.name === to.output)
    if (!o) throw new Error(`未知输出 ${to.output}`)
    return { x: o.x, y: o.y }
  }
  const g = lay.gates.find(x => x.out === to.gate)
  if (!g) throw new Error(`未知门 ${to.gate}`)
  return g.inPins[to.pin]
}

interface Seg {
  signal: string
  a: GatePoint
  b: GatePoint
}

function segmentsOf(lay: GateDiagramLayout): Seg[] {
  const out: Seg[] = []
  for (const w of lay.wires) {
    for (let i = 0; i + 1 < w.points.length; i++) out.push({ signal: w.signal, a: w.points[i], b: w.points[i + 1] })
  }
  return out
}

// ───────────────────────── 测试 ─────────────────────────

for (const [name, nl] of SAMPLES) {
  test(`布局（${name}）：每条连线从信号源引脚出发，到达正确的终点引脚`, () => {
    const lay = layoutGateDiagram(nl)
    const expected = nl.gates.reduce((s, g) => s + g.in.length, 0) + nl.outputs.length
    assert.equal(lay.wires.length, expected)
    for (const w of lay.wires) {
      const src = sourceOf(lay, w.signal)
      const dst = destOf(lay, w.to)
      assert.deepEqual(w.points[0], src, `${w.signal} 的起点`)
      assert.deepEqual(w.points[w.points.length - 1], dst, `${w.signal} 的终点`)
    }
    // 每个门输入引脚恰好接一条线。
    for (const g of nl.gates) {
      const box = lay.gates.find(x => x.out === g.out)!
      assert.equal(box.inPins.length, g.in.length)
      g.in.forEach((sig, pin) => {
        const hits = lay.wires.filter(w => 'gate' in w.to && w.to.gate === g.out && w.to.pin === pin)
        assert.equal(hits.length, 1, `${g.out} 的第 ${pin} 个输入`)
        assert.equal(hits[0].signal, sig)
      })
    }
  })

  test(`布局（${name}）：门盒子两两不重叠，连线全部正交`, () => {
    const lay = layoutGateDiagram(nl)
    for (let i = 0; i < lay.gates.length; i++) {
      for (let j = i + 1; j < lay.gates.length; j++) {
        const p = lay.gates[i]
        const q = lay.gates[j]
        const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h
        assert.equal(overlap, false, `${p.out} 与 ${q.out} 重叠`)
      }
    }
    for (const w of lay.wires) {
      for (let i = 0; i + 1 < w.points.length; i++) {
        const a = w.points[i]
        const b = w.points[i + 1]
        assert.ok(a.x === b.x || a.y === b.y, `${w.signal} 有斜线段`)
      }
    }
  })

  test(`布局（${name}）：连线不穿过门体（只在间隙与占位行中转向）`, () => {
    const lay = layoutGateDiagram(nl)
    for (const s of segmentsOf(lay)) {
      for (const g of lay.gates) {
        // 严格位于门体内部才算穿过；端点恰在门边界上（引脚）是允许的。
        const minX = Math.min(s.a.x, s.b.x)
        const maxX = Math.max(s.a.x, s.b.x)
        const minY = Math.min(s.a.y, s.b.y)
        const maxY = Math.max(s.a.y, s.b.y)
        const hitX = minX < g.x + g.w && maxX > g.x
        const hitY = minY < g.y + g.h && maxY > g.y
        const inside = hitX && hitY
        assert.equal(inside, false, `${s.signal} 的线段穿过门 ${g.out}`)
      }
    }
  })

  test(`布局（${name}）：不同信号的连线不在同一条直线上重叠`, () => {
    const lay = layoutGateDiagram(nl)
    const segs = segmentsOf(lay)
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const p = segs[i]
        const q = segs[j]
        if (p.signal === q.signal) continue
        const horiz = p.a.y === p.b.y && q.a.y === q.b.y && p.a.y === q.a.y
        if (horiz) {
          const lo = Math.max(Math.min(p.a.x, p.b.x), Math.min(q.a.x, q.b.x))
          const hi = Math.min(Math.max(p.a.x, p.b.x), Math.max(q.a.x, q.b.x))
          assert.ok(hi - lo <= 0, `${p.signal} 与 ${q.signal} 在 y=${p.a.y} 重叠`)
        }
        const vert = p.a.x === p.b.x && q.a.x === q.b.x && p.a.x === q.a.x
        if (vert) {
          const lo = Math.max(Math.min(p.a.y, p.b.y), Math.min(q.a.y, q.b.y))
          const hi = Math.min(Math.max(p.a.y, p.b.y), Math.max(q.a.y, q.b.y))
          assert.ok(hi - lo <= 0, `${p.signal} 与 ${q.signal} 在 x=${p.a.x} 重叠`)
        }
      }
    }
  })
}

test('布局：门按级数分列，级数越高横坐标越靠右', () => {
  const lay = layoutGateDiagram(SOP)
  const x = (out: string): number => lay.gates.find(g => g.out === out)!.x
  assert.ok(x('B_n') < x('P1'))
  assert.ok(x('P1') < x('F'))
  assert.equal(x('B_n'), x('C_n'))
})

test('布局：分支信号在源端给出分支点，单扇出没有', () => {
  const lay = layoutGateDiagram(SOP)
  // 输入 A 连到 P1 与 A_n（扇出 2）：应有一个分支点位于 A 的起点。
  const a = lay.inputs.find(i => i.name === 'A')!
  assert.ok(lay.dots.some(d => d.x === a.x && d.y === a.y))
  // 输入 B 同样扇出两路（B_n 与 P2）。
  const b = lay.inputs.find(i => i.name === 'B')!
  assert.ok(lay.dots.some(d => d.x === b.x && d.y === b.y))
  // 门输出 P1 只连到 F：不画分支点。
  const p1 = lay.gates.find(g => g.out === 'P1')!
  assert.ok(!lay.dots.some(d => d.x === p1.outPin.x && d.y === p1.outPin.y))
})

test('布局：级数增加时画布变宽，结果确定', () => {
  const one: GateLayoutNetlist = { inputs: ['A'], gates: [{ out: 'F', type: 'NOT', in: ['A'] }], outputs: ['F'] }
  const two: GateLayoutNetlist = {
    inputs: ['A'],
    gates: [
      { out: 'G', type: 'NOT', in: ['A'] },
      { out: 'F', type: 'NOT', in: ['G'] },
    ],
    outputs: ['F'],
  }
  const three: GateLayoutNetlist = {
    inputs: ['A'],
    gates: [
      { out: 'G', type: 'NOT', in: ['A'] },
      { out: 'H', type: 'NOT', in: ['G'] },
      { out: 'F', type: 'NOT', in: ['H'] },
    ],
    outputs: ['F'],
  }
  const w1 = layoutGateDiagram(one).width
  const w2 = layoutGateDiagram(two).width
  const w3 = layoutGateDiagram(three).width
  assert.ok(w1 < w2 && w2 < w3, `宽度 ${w1} ${w2} ${w3}`)
  assert.deepEqual(layoutGateDiagram(SOP), layoutGateDiagram(SOP))
})

test('布局：各门类的引脚数与宽度匹配（非门一个输入，其余按输入端数）', () => {
  const nl: GateLayoutNetlist = {
    inputs: ['A', 'B', 'C'],
    gates: [
      { out: 'N', type: 'NOT', in: ['A'] },
      { out: 'X', type: 'XNOR', in: ['A', 'B', 'C'] },
    ],
    outputs: ['N', 'X'],
  }
  const lay = layoutGateDiagram(nl)
  const n = lay.gates.find(g => g.out === 'N')!
  const x = lay.gates.find(g => g.out === 'X')!
  assert.equal(n.inPins.length, 1)
  assert.equal(x.inPins.length, 3)
  assert.ok(x.h > n.h)
  assert.equal(x.outPin.x, x.x + x.w)
})
