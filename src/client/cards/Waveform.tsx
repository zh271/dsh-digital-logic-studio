// 纯 SVG 时序波形。单比特行：每个字符对应一列，'0' 低、'1' 高、'.' 保持前值、'x' 不定（灰色填充）、'p' 时钟脉冲。
// 总线行（带 values）：每列一个取值文本（如十六进制），相邻且取值相同的列合并为一段总线，段内写出取值，'x' 为灰色段。
// times 为每列的时刻（缺省时标列号），unit 为时间单位（标在坐标轴左侧）；scrollable 时超宽横向滚动而不缩小。
// 供其他卡片复用，不依赖 DSH。
import type { WaveSignal } from '../../shared/seq.ts'

export interface WaveTrace extends WaveSignal {
  /** 总线行：每列的取值文本（与 wave 等长）。 */
  values?: string[]
}

const CELL = 18
const ROW = 26
const LABEL_W = 64
const PAD = 6
const HIGH = 5
const LOW = 19
const AXIS = 14
const BUS_SLANT = 3
const CHAR_W = 6

export function Waveform({
  signals,
  steps,
  times,
  unit,
  scrollable = false,
}: {
  signals: WaveTrace[]
  steps?: number
  times?: number[]
  unit?: string
  scrollable?: boolean
}) {
  const T = Math.max(steps ?? 0, ...signals.map(s => s.wave.length), 1)
  const width = LABEL_W + T * CELL + PAD * 2
  const height = AXIS + signals.length * ROW + PAD
  const ink = { stroke: 'var(--dsw-alias-label-primary)', strokeWidth: 1.2 } as const
  const labels = axisLabels(T, times)
  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={scrollable ? width : '100%'}
      height={scrollable ? height : undefined}
      style={{ display: 'block', maxWidth: scrollable ? undefined : width, overflow: 'visible' }}
      role="img"
      aria-label="时序波形"
    >
      {unit && (
        <text x={PAD} y={AXIS - 4} fontSize={9} style={{ fill: 'var(--dsw-alias-label-caption)' }}>
          {`t (${unit})`}
        </text>
      )}
      {labels.map(l => (
        <text
          key={`ax${l.t}`}
          x={l.x}
          y={AXIS - 4}
          textAnchor="middle"
          fontSize={9}
          style={{ fill: 'var(--dsw-alias-label-caption)' }}
        >
          {l.text}
        </text>
      ))}
      {signals.map((sig, row) => {
        const y0 = AXIS + row * ROW
        const hi = y0 + HIGH
        const lo = y0 + LOW
        const mid = (hi + lo) / 2
        const label = (
          <text x={PAD} y={y0 + ROW / 2 + 3} fontSize={11} style={{ fill: 'var(--dsw-alias-label-secondary)' }}>
            {sig.name}
          </text>
        )
        if (sig.values) {
          return (
            <g key={`s${row}`}>
              {label}
              {busRuns(sig.values, T).map((r, i) => {
                const x0 = LABEL_W + r.a * CELL
                const x1 = LABEL_W + (r.b + 1) * CELL
                const unknown = r.v === 'x'
                const d = [
                  `M${x0} ${mid}`,
                  `L${x0 + BUS_SLANT} ${hi}`,
                  `L${x1 - BUS_SLANT} ${hi}`,
                  `L${x1} ${mid}`,
                  `L${x1 - BUS_SLANT} ${lo}`,
                  `L${x0 + BUS_SLANT} ${lo}`,
                  'Z',
                ].join(' ')
                const fits = x1 - x0 - 2 * BUS_SLANT >= r.v.length * CHAR_W + 2
                return (
                  <g key={`b${i}`}>
                    <path
                      d={d}
                      stroke={ink.stroke}
                      strokeWidth={ink.strokeWidth}
                      style={{ fill: unknown ? 'var(--dsw-alias-border-l2)' : 'none' }}
                    >
                      <title>{r.v}</title>
                    </path>
                    {fits && (
                      <text
                        x={(x0 + x1) / 2}
                        y={mid + 3}
                        textAnchor="middle"
                        fontSize={10}
                        style={{ fill: 'var(--dsw-alias-label-primary)' }}
                      >
                        {r.v}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        }
        const parts: string[] = []
        let lastY: number | null = null
        let prev = '0'
        const rects: { x: number }[] = []
        for (let t = 0; t < T; t++) {
          const raw = sig.wave[t] ?? '.'
          const ch = raw === '.' ? prev : raw
          const x0 = LABEL_W + t * CELL
          const x1 = x0 + CELL
          if (ch === 'x') {
            rects.push({ x: x0 })
            lastY = null
            prev = 'x'
            continue
          }
          if (ch === 'p') {
            const midX = x0 + CELL / 2
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
        return (
          <g key={`s${row}`}>
            {label}
            {rects.map((r, i) => (
              <rect
                key={`x${i}`}
                x={r.x}
                y={hi}
                width={CELL}
                height={lo - hi}
                style={{ fill: 'var(--dsw-alias-border-l2)' }}
              />
            ))}
            {parts.length > 0 && <path d={parts.join(' ')} fill="none" {...ink} />}
          </g>
        )
      })}
    </svg>
  )
  return scrollable ? <div style={{ overflowX: 'auto', maxWidth: '100%' }}>{svg}</div> : svg
}

/** 坐标轴文字：每列一个候选，避免相邻文字重叠（跳过放不下的列）。 */
function axisLabels(T: number, times?: number[]): { t: number; x: number; text: string }[] {
  const out: { t: number; x: number; text: string }[] = []
  let freeAt = -Infinity
  for (let t = 0; t < T; t++) {
    const text = String(times?.[t] ?? t)
    const x = LABEL_W + t * CELL + CELL / 2
    const half = (text.length * 5.5) / 2
    if (x - half < freeAt) continue
    out.push({ t, x, text })
    freeAt = x + half + 3
  }
  return out
}

/** 总线行的连续段：相同取值的相邻列合并；缺失的列按 'x' 处理。 */
function busRuns(values: string[], T: number): { a: number; b: number; v: string }[] {
  const runs: { a: number; b: number; v: string }[] = []
  for (let t = 0; t < T; t++) {
    const v = values[t] ?? 'x'
    const last = runs[runs.length - 1]
    if (last && last.v === v) last.b = t
    else runs.push({ a: t, b: t, v })
  }
  return runs
}
