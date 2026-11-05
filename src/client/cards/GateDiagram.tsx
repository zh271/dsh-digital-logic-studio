// 门级逻辑图（纯 SVG）：门符号（与、或、非、与非、或非、异或、同或），连线与分支点由 shared/gateLayout 给出。
// 每个门的输出连线上方标注信号名；输入名写在左侧，输出名写在右侧。宽图可横向滚动。
// 颜色只引用 DSH 主题变量，深色模式下同样可读。供 CombCard 与图示区复用，不依赖 DSH。
import type { ReactElement } from 'react'
import type { GateType } from '../../shared/comb.ts'
import { layoutGateDiagram, type GateBox, type GateLayoutNetlist } from '../../shared/gateLayout.ts'

const INK = 'var(--dsw-alias-label-primary)'
const CAPTION = 'var(--dsw-alias-label-secondary)'
/** 反相小圆圈的直径。 */
const BUB = 8

/** 带反相圆圈的门类型。 */
function inverting(type: GateType): boolean {
  return type === 'NOT' || type === 'NAND' || type === 'NOR' || type === 'XNOR'
}

/** 与门的外形：平直的后端加半椭圆形的前端。 */
function andPath(x0: number, right: number, top: number, bot: number): string {
  const rx = (right - x0) / 2
  const ry = (bot - top) / 2
  return `M${x0} ${top} H${x0 + rx} A${rx} ${ry} 0 0 1 ${x0 + rx} ${bot} H${x0} Z`
}

/** 或门的外形：内凹的后端与尖的前端。 */
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

/** 异或门附加的后端弧线（紧贴输入端）。 */
function xorBackPath(x0: number, right: number, top: number, bot: number): string {
  const mid = (top + bot) / 2
  const bw = right - x0
  return `M${x0} ${top} Q${x0 + bw * 0.3} ${mid} ${x0} ${bot}`
}

function GateSymbol({ g }: { g: GateBox }) {
  const top = g.y + 6
  const bot = g.y + g.h - 6
  const mid = g.y + g.h / 2
  const inv = inverting(g.type)
  const right = g.x + g.w - (inv ? BUB : 0)
  const stroke = { stroke: INK, strokeWidth: 1.2, fill: 'none' } as const

  let body: ReactElement
  if (g.type === 'NOT') {
    body = <path d={`M${g.x} ${top} L${right} ${mid} L${g.x} ${bot} Z`} {...stroke} />
  } else if (g.type === 'AND' || g.type === 'NAND') {
    body = <path d={andPath(g.x, right, top, bot)} {...stroke} />
  } else if (g.type === 'OR' || g.type === 'NOR') {
    body = <path d={orPath(g.x, right, top, bot)} {...stroke} />
  } else {
    // 异或与同或：或门外形向右让出 4 px，原输入端处再画一条后端弧线。
    body = (
      <>
        <path d={orPath(g.x + 4, right, top, bot)} {...stroke} />
        <path d={xorBackPath(g.x, right, top, bot)} {...stroke} />
      </>
    )
  }

  return (
    <g>
      {body}
      {inv && <circle cx={g.x + g.w - BUB / 2} cy={mid} r={BUB / 2} {...stroke} />}
    </g>
  )
}

/** 门级逻辑图。netlist 为门的输入名、门列表与输出名（与 AnalyzeResult 同形）。 */
export function GateDiagram({ netlist }: { netlist: GateLayoutNetlist }) {
  const lay = layoutGateDiagram(netlist)
  const ink = { stroke: INK, strokeWidth: 1.2, fill: 'none' } as const
  return (
    <div style={{ maxWidth: '100%' }}>
      {/* 卡片宽度由 DSH 决定：图按卡片宽度等比缩小以完整显示（不超过原始大小），不再横向滚动。 */}
      <svg
        width="100%"
        viewBox={`0 0 ${lay.width} ${lay.height}`}
        style={{ display: 'block', overflow: 'visible', maxWidth: lay.width, height: 'auto' }}
        role="img"
        aria-label="门级逻辑图"
      >
        {lay.wires.map((w, i) => (
          <path
            key={`w${i}`}
            d={w.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')}
            {...ink}
          />
        ))}
        {lay.gates.map(g => (
          <GateSymbol key={`g${g.out}`} g={g} />
        ))}
        {lay.dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={2.6} style={{ fill: INK }} />
        ))}
        {lay.inputs.map(p => (
          <text key={`i${p.name}`} x={p.x - 6} y={p.y + 4} textAnchor="end" fontSize={12} style={{ fill: INK }}>
            {p.name}
          </text>
        ))}
        {lay.outputs.map(p => (
          <text key={`o${p.name}`} x={p.x + 6} y={p.y + 4} textAnchor="start" fontSize={12} style={{ fill: INK }}>
            {p.name}
          </text>
        ))}
        {lay.gates.map(g => (
          <text
            key={`l${g.out}`}
            x={g.outPin.x + 3}
            y={g.outPin.y - 4}
            fontSize={11}
            style={{ fill: CAPTION }}
          >
            {g.out}
          </text>
        ))}
      </svg>
    </div>
  )
}
