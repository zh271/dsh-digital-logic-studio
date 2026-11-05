// SVG 状态图：节点按圆周均匀排布，有向边为二次贝塞尔弧线并带箭头；双向边向两侧弯开；自环画在节点外侧。
// 无效状态虚线描边，初态双圈。供 SeqCard 与 fsm 卡片复用，不依赖 DSH。
import { useId } from 'react'
import type { StateGraph } from '../../shared/seq.ts'

const NODE_R = 15

interface Pt {
  x: number
  y: number
}

export function StateGraphView({ graph }: { graph: StateGraph }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const n = graph.nodes.length
  const R = n <= 1 ? 0 : Math.max(58, 30 + n * 10)
  const half = R + NODE_R + 40
  const cx = half
  const cy = half
  const pos = new Map<string, Pt>()
  graph.nodes.forEach((nd, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1)
    pos.set(nd.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) })
  })
  const pairs = new Set(graph.edges.map(e => `${e.from}>${e.to}`))
  const edgeColor = { stroke: 'var(--dsw-alias-label-caption)', fill: 'none', strokeWidth: 1 } as const
  const textStyle = { fill: 'var(--dsw-alias-label-secondary)' } as const

  return (
    <svg
      viewBox={`0 0 ${2 * half} ${2 * half}`}
      width="100%"
      style={{ display: 'block', maxWidth: 2 * half + 40 }}
      role="img"
      aria-label="状态图"
    >
      <defs>
        <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--dsw-alias-label-secondary)' }} />
        </marker>
      </defs>
      {graph.edges.map((e, i) => {
        const A = pos.get(e.from)
        const B = pos.get(e.to)
        if (!A || !B) return null
        if (e.from === e.to) {
          const dx = A.x - cx
          const dy = A.y - cy
          const len = Math.hypot(dx, dy) || 1
          const ox = dx / len
          const oy = dy / len
          const tx = -oy
          const ty = ox
          const s = { x: A.x + ox * NODE_R + tx * 5, y: A.y + oy * NODE_R + ty * 5 }
          const en = { x: A.x + ox * NODE_R - tx * 5, y: A.y + oy * NODE_R - ty * 5 }
          const c1 = { x: A.x + ox * (NODE_R + 30) + tx * 14, y: A.y + oy * (NODE_R + 30) + ty * 14 }
          const c2 = { x: A.x + ox * (NODE_R + 30) - tx * 14, y: A.y + oy * (NODE_R + 30) - ty * 14 }
          const lab = { x: A.x + ox * (NODE_R + 40), y: A.y + oy * (NODE_R + 40) }
          return (
            <g key={`e${i}`}>
              <path
                d={`M${s.x} ${s.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${en.x} ${en.y}`}
                {...edgeColor}
                markerEnd={`url(#${uid}-arrow)`}
              />
              {e.label && (
                <text x={lab.x} y={lab.y + 3} textAnchor="middle" fontSize={10} style={textStyle}>
                  {e.label}
                </text>
              )}
            </g>
          )
        }
        const dx = B.x - A.x
        const dy = B.y - A.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const nx = -uy
        const ny = ux
        const bent = pairs.has(`${e.to}>${e.from}`)
        const sign = e.from < e.to ? 1 : -1
        const off = bent ? 20 * sign : 0
        const P0 = { x: A.x + ux * NODE_R, y: A.y + uy * NODE_R }
        const P1 = { x: B.x - ux * (NODE_R + 4), y: B.y - uy * (NODE_R + 4) }
        const C = { x: (P0.x + P1.x) / 2 + nx * off, y: (P0.y + P1.y) / 2 + ny * off }
        const lab = {
          x: 0.25 * P0.x + 0.5 * C.x + 0.25 * P1.x + nx * (off === 0 ? 10 : 0),
          y: 0.25 * P0.y + 0.5 * C.y + 0.25 * P1.y + ny * (off === 0 ? 10 : 0),
        }
        return (
          <g key={`e${i}`}>
            <path d={`M${P0.x} ${P0.y} Q${C.x} ${C.y} ${P1.x} ${P1.y}`} {...edgeColor} markerEnd={`url(#${uid}-arrow)`} />
            {e.label && (
              <text x={lab.x} y={lab.y + 3} textAnchor="middle" fontSize={10} style={textStyle}>
                {e.label}
              </text>
            )}
          </g>
        )
      })}
      {graph.nodes.map(nd => {
        const p = pos.get(nd.id)
        if (!p) return null
        const stroke = nd.valid ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-caption)'
        return (
          <g key={`n${nd.id}`}>
            {nd.initial && (
              <circle cx={p.x} cy={p.y} r={NODE_R + 3} style={{ stroke, fill: 'none' }} strokeWidth={1} />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={NODE_R}
              strokeWidth={nd.valid ? 1.2 : 1}
              strokeDasharray={nd.valid ? undefined : '3 3'}
              style={{ stroke, fill: 'var(--dsw-alias-bg-l1, transparent)' }}
            />
            <text
              x={p.x}
              y={p.y + 3.5}
              textAnchor="middle"
              fontSize={nd.label.length > 3 ? 9 : 11}
              style={{ fill: nd.valid ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-caption)' }}
            >
              {nd.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
