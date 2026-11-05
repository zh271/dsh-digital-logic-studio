// dlogic_comb 的图文件（独立 SVG）：draw / analyze 结果的门级逻辑图在上、时序波形在下。
// 纯字符串生成，不依赖 React / DSH；不用 CSS 变量、currentColor 或脚本，白底黑线，供宿主写成文件后经 Markdown 图片引用。
// 门符号与连线几何取自 shared/gateLayout（与 client/cards/GateDiagram.tsx 一致）；波形逻辑与 client/cards/Waveform.tsx、CombCard.tsx 一致。
import type { AnalyzeResult, CombOp, CombResultMap, GateType } from './comb.ts'
import { layoutGateDiagram, type GateBox, type GateDiagramLayout } from './gateLayout.ts'

/** 与 CombCard 相同：输入个数在此范围内才画波形。 */
const WAVE_MAX_INPUTS = 5
const INK = '#000000'
const STROKE = 1.2
/** 反相小圆圈的直径（与 GateDiagram 相同）。 */
const BUB = 8
const SECTION_GAP = 24

const WAVE_CELL = 18
const WAVE_ROW = 26
const WAVE_LABEL_W = 64
const WAVE_PAD = 6
const WAVE_HIGH = 5
const WAVE_LOW = 19
const WAVE_AXIS = 14

export type CombFigureResult = CombResultMap[CombOp]

interface Piece {
  body: string
  width: number
  height: number
}

interface WaveRow {
  name: string
  wave: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function text(x: number, y: number, size: number, anchor: 'start' | 'middle' | 'end', content: string): string {
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${INK}">${esc(content)}</text>`
}

// ───────────────────────── 门级逻辑图 ─────────────────────────

function inverting(type: GateType): boolean {
  return type === 'NOT' || type === 'NAND' || type === 'NOR' || type === 'XNOR'
}

function andPath(x0: number, right: number, top: number, bot: number): string {
  const rx = (right - x0) / 2
  const ry = (bot - top) / 2
  return `M${x0} ${top} H${x0 + rx} A${rx} ${ry} 0 0 1 ${x0 + rx} ${bot} H${x0} Z`
}

function orPath(x0: number, right: number, top: number, bot: number): string {
  const mid = (top + bot) / 2
  const bw = right - x0
  return [
    `M${x0} ${top}`,
    `Q${x0 + bw * 0.3} ${mid} ${x0} ${bot}`,
    `Q${x0 + bw * 0.65} ${bot} ${right} ${mid}`,
    `Q${x0 + bw * 0.65} ${top} ${x0} ${top}`,
    'Z',
  ].join(' ')
}

function xorBackPath(x0: number, right: number, top: number, bot: number): string {
  const mid = (top + bot) / 2
  const bw = right - x0
  return `M${x0} ${top} Q${x0 + bw * 0.3} ${mid} ${x0} ${bot}`
}

/** 单个门符号（与 GateDiagram.tsx 的 GateSymbol 同形）。 */
function gateSymbol(g: GateBox): string {
  const top = g.y + 6
  const bot = g.y + g.h - 6
  const mid = g.y + g.h / 2
  const inv = inverting(g.type)
  const right = g.x + g.w - (inv ? BUB : 0)
  const attr = `fill="none" stroke="${INK}" stroke-width="${STROKE}"`
  let body: string
  if (g.type === 'NOT') {
    body = `<path d="M${g.x} ${top} L${right} ${mid} L${g.x} ${bot} Z" ${attr}/>`
  } else if (g.type === 'AND' || g.type === 'NAND') {
    body = `<path d="${andPath(g.x, right, top, bot)}" ${attr}/>`
  } else if (g.type === 'OR' || g.type === 'NOR') {
    body = `<path d="${orPath(g.x, right, top, bot)}" ${attr}/>`
  } else {
    body = `<path d="${orPath(g.x + 4, right, top, bot)}" ${attr}/><path d="${xorBackPath(g.x, right, top, bot)}" ${attr}/>`
  }
  const bubble = inv ? `<circle cx="${g.x + g.w - BUB / 2}" cy="${mid}" r="${BUB / 2}" ${attr}/>` : ''
  return body + bubble
}

function diagramPiece(lay: GateDiagramLayout): Piece {
  const out: string[] = []
  for (const w of lay.wires) {
    const d = w.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
    out.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE}"/>`)
  }
  for (const g of lay.gates) out.push(gateSymbol(g))
  for (const d of lay.dots) out.push(`<circle cx="${d.x}" cy="${d.y}" r="2.6" fill="${INK}"/>`)
  for (const p of lay.inputs) out.push(text(p.x - 6, p.y + 4, 12, 'end', p.name))
  for (const p of lay.outputs) out.push(text(p.x + 6, p.y + 4, 12, 'start', p.name))
  for (const g of lay.gates) out.push(text(g.outPin.x + 3, g.outPin.y - 4, 11, 'start', g.out))
  return { body: out.join(''), width: lay.width, height: lay.height }
}

// ───────────────────────── 时序波形 ─────────────────────────

/** 真值表波形：每个输入按二进制顺序（MSB 最慢）取值，每行一列；输出为对应取值。 */
function truthRows(r: AnalyzeResult): WaveRow[] {
  const rows = r.truthTable.rows
  const ins: WaveRow[] = r.inputs.map((name, i) => ({ name, wave: rows.map(row => String(row.inputs[i])).join('') }))
  const outs: WaveRow[] = r.outputs.map((name, j) => ({ name, wave: rows.map(row => String(row.outputs[j])).join('') }))
  return [...ins, ...outs]
}

/** 单比特波形（与 Waveform.tsx 的单比特分支一致：'0' 低、'1' 高、'.' 保持、'x' 不定、'p' 脉冲）。 */
function wavePiece(rows: WaveRow[], steps: number): Piece {
  const T = Math.max(steps, ...rows.map(r => r.wave.length), 1)
  const width = WAVE_LABEL_W + T * WAVE_CELL + WAVE_PAD * 2
  const height = WAVE_AXIS + rows.length * WAVE_ROW + WAVE_PAD
  const out: string[] = []

  // 坐标轴文字：每列一个候选，跳过放不下的列（与 Waveform.tsx 的 axisLabels 一致）。
  let freeAt = -Infinity
  for (let t = 0; t < T; t++) {
    const label = String(t)
    const x = WAVE_LABEL_W + t * WAVE_CELL + WAVE_CELL / 2
    const half = (label.length * 5.5) / 2
    if (x - half < freeAt) continue
    out.push(`<text x="${x}" y="${WAVE_AXIS - 4}" text-anchor="middle" font-size="9" fill="${INK}">${esc(label)}</text>`)
    freeAt = x + half + 3
  }

  rows.forEach((sig, row) => {
    const y0 = WAVE_AXIS + row * WAVE_ROW
    const hi = y0 + WAVE_HIGH
    const lo = y0 + WAVE_LOW
    out.push(text(WAVE_PAD, y0 + WAVE_ROW / 2 + 3, 11, 'start', sig.name))
    const parts: string[] = []
    const unknownX: number[] = []
    let lastY: number | null = null
    let prev = '0'
    for (let t = 0; t < T; t++) {
      const raw = sig.wave[t] ?? '.'
      const ch = raw === '.' ? prev : raw
      const x0 = WAVE_LABEL_W + t * WAVE_CELL
      const x1 = x0 + WAVE_CELL
      if (ch === 'x') {
        unknownX.push(x0)
        lastY = null
        prev = 'x'
        continue
      }
      if (ch === 'p') {
        const midX = x0 + WAVE_CELL / 2
        if (lastY === null) parts.push(`M${x0} ${lo}`)
        else if (lastY !== lo) parts.push(`L${x0} ${lo}`)
        parts.push(`L${x0} ${hi}`, `L${midX} ${hi}`, `L${midX} ${lo}`, `L${x1} ${lo}`)
        lastY = lo
        prev = '0'
        continue
      }
      const y = ch === '1' ? hi : lo
      if (lastY === null) parts.push(`M${x0} ${y}`)
      else if (lastY !== y) parts.push(`L${x0} ${y}`)
      parts.push(`L${x1} ${y}`)
      lastY = y
      prev = ch === '1' ? '1' : '0'
    }
    for (const x0 of unknownX) {
      out.push(`<rect x="${x0}" y="${hi}" width="${WAVE_CELL}" height="${lo - hi}" fill="#cccccc"/>`)
    }
    if (parts.length > 0) out.push(`<path d="${parts.join(' ')}" fill="none" stroke="${INK}" stroke-width="${STROKE}"/>`)
  })
  return { body: out.join(''), width, height }
}

// ───────────────────────── 整图 ─────────────────────────

/**
 * 把 draw / analyze 的结果渲染为独立 SVG 文档字符串（门级图在上，波形在下）。
 * 没有门网表时返回空串；任何异常也返回空串，不抛出。
 */
export function renderCombFigureSvg(result: CombFigureResult): string {
  try {
    const r = result as unknown as AnalyzeResult | null
    if (!r || typeof r !== 'object' || !Array.isArray(r.inputs) || !Array.isArray(r.gates) || r.gates.length === 0) {
      return ''
    }
    const outputs = Array.isArray(r.outputs) ? r.outputs : []
    const lay = layoutGateDiagram({
      inputs: r.inputs,
      gates: r.gates.map(g => ({ out: g.out, type: g.type, in: g.in })),
      outputs,
    })
    const sections: Piece[] = [diagramPiece(lay)]
    const tt = r.truthTable
    if (r.inputs.length >= 1 && r.inputs.length <= WAVE_MAX_INPUTS && tt && Array.isArray(tt.rows)) {
      sections.push(wavePiece(truthRows(r), tt.rows.length))
    }
    const W = Math.max(...sections.map(s => s.width))
    let y = 0
    const parts: string[] = []
    sections.forEach((s, i) => {
      if (i > 0) y += SECTION_GAP
      parts.push(`<g transform="translate(0 ${y})">${s.body}</g>`)
      y += s.height
    })
    const H = y
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`,
      ...parts,
      '</svg>',
    ].join('')
  } catch {
    return ''
  }
}
