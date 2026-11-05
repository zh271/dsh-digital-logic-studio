// 门级逻辑图的纯布局（不依赖 React / DSH，便于测试）。
// 思路：按逻辑级数分列（输入在第 0 列，门在其级数列，输出在最右一列）；列内按重心排序后纵向堆叠；
// 跨越多列的连线在中间列插入“占位行”（虚拟节点），使每一跳只在相邻两列之间的间隙中转向，不穿过门体。
// 奇偶约定：第 L 列的所有纵坐标都与 L 同奇偶，相邻两列的水平走线因此不会重合；同一列内各项之间留有间隔。
// 只使用可擦除的 TypeScript 语法。
import type { GateType } from './comb.ts'

export interface GateLayoutNetlist {
  inputs: string[]
  gates: { out: string; type: GateType; in: string[] }[]
  outputs: string[]
}

export interface GatePoint {
  x: number
  y: number
}

export interface GateBox {
  out: string
  type: GateType
  /** 左上角；输入引脚位于 x，输出引脚位于 x + w。 */
  x: number
  y: number
  w: number
  h: number
  /** 与 gate.in 同序。 */
  inPins: GatePoint[]
  outPin: GatePoint
}

export interface GateWire {
  /** 所连信号名（原始输入或门输出）。 */
  signal: string
  /** 正交折线：首点为信号源引脚（输入端或门输出引脚），末点为终点。 */
  points: GatePoint[]
  /** 终点：某门的第 pin 个输入引脚，或某个输出标签。 */
  to: { gate: string; pin: number } | { output: string }
}

export interface GateDiagramLayout {
  width: number
  height: number
  /** 输入信号的连线起点（名称写在其左侧）。 */
  inputs: { name: string; x: number; y: number }[]
  gates: GateBox[]
  wires: GateWire[]
  /** 分支点：信号连到 2 个及以上引脚时，在源端画实心点。 */
  dots: GatePoint[]
  /** 输出信号的连线终点（名称写在其右侧）。 */
  outputs: { name: string; x: number; y: number }[]
}

// ───────────────────────── 尺寸常量 ─────────────────────────

/** 输入起点的横坐标（左侧留给输入名）。 */
const INPUT_X = 44
/** 第一行的纵坐标（偶数）。 */
const TOP = 24
/** 同列相邻两项之间的间距（偶数）。 */
const ITEM_GAP = 16
/** 门体上下留白（偶数）。 */
const PAD_V = 14
/** 相邻输入引脚的间距（偶数）。 */
const PIN_GAP = 20
/** 占位行与输入/输出节点的高度；节点中心位于 top + LANE_H / 2。 */
const LANE_H = 16
/** 间隙中每条连线占用的横向宽度与两侧留白。 */
const CH_STEP = 8
const CH_MARGIN = 10
/** 没有连线穿过的间隙宽度。 */
const MIN_GAP = 28
/** 输出标签占用的宽度。 */
const OUT_LABEL_W = 56
const PAD_R = 12
const PAD_B = 16

const GATE_W: Record<GateType, number> = {
  NOT: 36,
  AND: 56,
  NAND: 56,
  OR: 56,
  NOR: 56,
  XOR: 60,
  XNOR: 60,
}

/** 一条连线：从信号源到一个终点，中间经过的列各有一个占位行。 */
interface Chain {
  signal: string
  /** 起点列：输入为 0，门输出为其级数。 */
  c0: number
  /** 终点列：门引脚所在列，或输出列。 */
  c1: number
  /** 起点：输入名或门输出名。 */
  fromInput: boolean
  /** 终点：门输入引脚，或输出标签。 */
  dest: { gate: string; pin: number } | { output: string }
  /** 经过的中间列（占位行所在列），按列号递增。 */
  lanes: number[]
}

/** 门的级数：输入为 0，门输出为 1 + max(输入级数)。 */
function levelsOf(nl: GateLayoutNetlist): Map<string, number> {
  const level = new Map<string, number>()
  for (const i of nl.inputs) level.set(i, 0)
  const byOut = new Map(nl.gates.map(g => [g.out, g]))
  const visit = (name: string, stack: Set<string>): number => {
    const known = level.get(name)
    if (known !== undefined) return known
    const g = byOut.get(name)
    if (!g || stack.has(name)) return 0
    stack.add(name)
    const lv = 1 + Math.max(0, ...g.in.map(i => visit(i, stack)))
    stack.delete(name)
    level.set(name, lv)
    return lv
  }
  for (const g of nl.gates) visit(g.out, new Set())
  return level
}

/** 计算门级逻辑图的几何布局。输入应已通过求解器的网表校验。 */
export function layoutGateDiagram(nl: GateLayoutNetlist): GateDiagramLayout {
  const level = levelsOf(nl)
  const inputSet = new Set(nl.inputs)
  const lvOf = (name: string): number => (inputSet.has(name) ? 0 : level.get(name) ?? 0)
  const maxLevel = Math.max(1, ...nl.gates.map(g => lvOf(g.out)))
  const OUT_COL = maxLevel + 1

  // 门盒子：按级数分列，列内保持网表顺序。
  const colGates: GateBox[][] = Array.from({ length: maxLevel + 1 }, () => [])
  const gateOf = new Map<string, GateBox>()
  for (const g of nl.gates) {
    const n = Math.max(1, g.in.length)
    const box: GateBox = {
      out: g.out,
      type: g.type,
      x: 0,
      y: 0,
      w: GATE_W[g.type],
      h: 2 * PAD_V + PIN_GAP * (n - 1),
      inPins: [],
      outPin: { x: 0, y: 0 },
    }
    colGates[lvOf(g.out)].push(box)
    gateOf.set(g.out, box)
  }

  // 连线：每个（信号，终点）一条。
  const chains: Chain[] = []
  const addChain = (signal: string, dest: Chain['dest'], c1: number): void => {
    const fromInput = inputSet.has(signal)
    const c0 = lvOf(signal)
    const lanes: number[] = []
    for (let c = c0 + 1; c < c1; c++) lanes.push(c)
    chains.push({ signal, c0, c1, fromInput, dest, lanes })
  }
  for (const g of nl.gates) {
    g.in.forEach((sig, pin) => addChain(sig, { gate: g.out, pin }, lvOf(g.out)))
  }
  for (const o of nl.outputs) addChain(o, { output: o }, OUT_COL)

  // 各间隙（第 c 列与第 c+1 列之间）的连线数，决定间隙宽度。
  const gapCount = new Array<number>(OUT_COL + 1).fill(0)
  for (const ch of chains) for (let c = ch.c0; c < ch.c1; c++) gapCount[c] += 1

  // 列宽与横坐标。第 0 列为输入（宽 0），第 OUT_COL 列为输出标签的锚点。
  const maxW = new Array<number>(OUT_COL + 1).fill(0)
  for (let c = 1; c <= maxLevel; c++) maxW[c] = Math.max(0, ...colGates[c].map(g => g.w))
  const colX = new Array<number>(OUT_COL + 1).fill(0)
  colX[0] = INPUT_X
  for (let c = 0; c < OUT_COL; c++) {
    const gs = colX[c] + maxW[c]
    const n = gapCount[c]
    colX[c + 1] = gs + (n > 0 ? 2 * CH_MARGIN + n * CH_STEP : MIN_GAP)
  }

  // 间隙内通道的横坐标：每条连线在间隙 c 中占一条竖线，按连线顺序分配，互不重合。
  const chanX = new Map<string, number>()
  {
    const used = new Array<number>(OUT_COL + 1).fill(0)
    chains.forEach((ch, ci) => {
      for (let c = ch.c0; c < ch.c1; c++) {
        const gs = colX[c] + maxW[c]
        chanX.set(`${ci}:${c}`, gs + CH_MARGIN + used[c] * CH_STEP + CH_STEP / 2)
        used[c] += 1
      }
    })
  }

  // 纵坐标：各节点的 y 存入 yOf（输入 `i:名`，门输出 `g:名`，占位行 `d:连线号:列`，输出 `o:名`）。
  // 门的 y 为输出引脚所在纵坐标；门输入引脚的纵坐标在堆叠门时确定。
  const yOf = new Map<string, number>()
  const inputs: GateDiagramLayout['inputs'] = []
  const outputs: GateDiagramLayout['outputs'] = []

  let cursor = TOP
  for (const name of nl.inputs) {
    const y = cursor + LANE_H / 2
    yOf.set(`i:${name}`, y)
    inputs.push({ name, x: colX[0], y })
    cursor += LANE_H + ITEM_GAP
  }
  let bottom = cursor

  // 连线在第 c 列前一个节点的纵坐标（占位行或信号源）。
  const prevY = (ci: number, c: number): number => {
    const ch = chains[ci]
    const idx = ch.lanes.indexOf(c)
    if (idx > 0) return yOf.get(`d:${ci}:${ch.lanes[idx - 1]}`) ?? 0
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0
  }
  // 终点（门引脚或输出）之前的最后一个节点的纵坐标，用于排序重心。
  const lastPrevY = (ci: number): number => {
    const ch = chains[ci]
    if (ch.lanes.length > 0) return yOf.get(`d:${ci}:${ch.lanes[ch.lanes.length - 1]}`) ?? 0
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0
  }

  for (let c = 1; c <= OUT_COL; c++) {
    type Item = { key: string; bary: number; order: number; kind: 'gate' | 'lane' | 'out'; gate?: GateBox; ci?: number; name?: string }
    const items: Item[] = []
    let order = 0
    if (c <= maxLevel) {
      for (const g of colGates[c]) {
        const ins = chains.map((ch, ci) => ({ ch, ci })).filter(({ ch }) => 'gate' in ch.dest && ch.dest.gate === g.out)
        const bary = ins.length ? ins.reduce((s, { ci }) => s + lastPrevY(ci), 0) / ins.length : 0
        items.push({ key: `g:${g.out}`, bary, order: order++, kind: 'gate', gate: g })
      }
    }
    chains.forEach((ch, ci) => {
      if (!ch.lanes.includes(c)) return
      items.push({ key: `d:${ci}:${c}`, bary: prevY(ci, c), order: order++, kind: 'lane', ci })
    })
    if (c === OUT_COL) {
      nl.outputs.forEach((name) => {
        const ci = chains.findIndex(ch => 'output' in ch.dest && ch.dest.output === name)
        items.push({ key: `o:${name}`, bary: ci >= 0 ? lastPrevY(ci) : 0, order: order++, kind: 'out', name })
      })
    }
    items.sort((a, b) => a.bary - b.bary || a.order - b.order)

    let y = TOP + (c % 2)
    for (const it of items) {
      if (it.kind === 'gate') {
        const g = it.gate as GateBox
        const n = (g.h - 2 * PAD_V) / PIN_GAP + 1
        g.x = colX[c]
        g.y = y
        g.inPins = Array.from({ length: n }, (_, i) => ({ x: g.x, y: y + PAD_V + PIN_GAP * i }))
        g.outPin = { x: g.x + g.w, y: y + PAD_V + (PIN_GAP * (n - 1)) / 2 }
        yOf.set(it.key, g.outPin.y)
        y += g.h + ITEM_GAP
      } else if (it.kind === 'lane') {
        yOf.set(it.key, y + LANE_H / 2)
        y += LANE_H + ITEM_GAP
      } else {
        const name = it.name as string
        const oy = y + LANE_H / 2
        yOf.set(it.key, oy)
        outputs.push({ name, x: colX[OUT_COL], y: oy })
        y += LANE_H + ITEM_GAP
      }
    }
    bottom = Math.max(bottom, y)
  }

  // 每条连线的折线：源端 → 逐列经过占位行 → 终点。
  const wires: GateWire[] = chains.map((ch, ci) => {
    const start: GatePoint = ch.fromInput
      ? { x: INPUT_X, y: yOf.get(`i:${ch.signal}`) ?? 0 }
      : { x: (gateOf.get(ch.signal) as GateBox).outPin.x, y: (gateOf.get(ch.signal) as GateBox).outPin.y }
    const endY = 'gate' in ch.dest
      ? (gateOf.get(ch.dest.gate) as GateBox).inPins[ch.dest.pin].y
      : yOf.get(`o:${ch.dest.output}`) ?? 0
    const pts: GatePoint[] = [start]
    let curY = start.y
    let prevCol = ch.c0
    const targets = [...ch.lanes, ch.c1]
    for (const c of targets) {
      const isLane = c !== ch.c1
      const nextY = isLane ? (yOf.get(`d:${ci}:${c}`) ?? 0) : endY
      const xch = chanX.get(`${ci}:${prevCol}`) ?? colX[prevCol]
      pts.push({ x: xch, y: curY }, { x: xch, y: nextY })
      if (isLane) {
        // 占位行贯穿整列：从列左沿走到列右沿，之后进入下一个间隙。
        pts.push({ x: colX[c], y: nextY }, { x: colX[c] + maxW[c], y: nextY })
      } else {
        pts.push({ x: colX[c], y: nextY })
      }
      curY = nextY
      prevCol = c
    }
    const clean: GatePoint[] = []
    for (const p of pts) {
      const last = clean[clean.length - 1]
      if (last && last.x === p.x && last.y === p.y) continue
      clean.push(p)
    }
    const to: GateWire['to'] = 'gate' in ch.dest ? { gate: ch.dest.gate, pin: ch.dest.pin } : { output: ch.dest.output }
    return { signal: ch.signal, points: clean, to }
  })

  // 分支点：信号连到 2 个及以上引脚（门引脚或输出）。
  const fanout = new Map<string, number>()
  for (const ch of chains) fanout.set(ch.signal, (fanout.get(ch.signal) ?? 0) + 1)
  const dots: GatePoint[] = []
  for (const [sig, n] of fanout) {
    if (n < 2) continue
    if (inputSet.has(sig)) {
      const p = inputs.find(i => i.name === sig)
      if (p) dots.push({ x: p.x, y: p.y })
    } else {
      const g = gateOf.get(sig)
      if (g) dots.push({ x: g.outPin.x, y: g.outPin.y })
    }
  }

  return {
    width: colX[OUT_COL] + OUT_LABEL_W + PAD_R,
    height: bottom + PAD_B,
    inputs,
    gates: nl.gates.map(g => gateOf.get(g.out) as GateBox),
    wires,
    dots,
    outputs,
  }
}
