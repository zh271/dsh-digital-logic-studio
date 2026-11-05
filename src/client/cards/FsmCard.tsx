// dlogic_fsm 工具卡片：按 Envelope.op 分派到对应视图。状态图由本文件内的 SVG 直接绘制。
import { useId, type ReactNode } from 'react'
import type { FsmOp, FsmResultMap, FsmSpec, SynthFunction, SynthesizeResult } from '../../shared/fsm.ts'
import { buildTable, type Table } from '../../solvers/fsm.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_fsm'
const KNOWN_OPS: string[] = ['reduce', 'assign', 'synthesize', 'self_start']
const KINDS: string[] = ['binary', 'gray', 'onehot', 'custom']
type FsmResult = FsmResultMap[FsmOp]

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`fsm.op.${op}`) : t('fsm.title')
}

function kindLabel(kind: string, t: TFn): string {
  return KINDS.includes(kind) ? t(`fsm.encoding.${kind}`) : kind
}

function bitsOf(v: number, width: number): string {
  return v.toString(2).padStart(width, '0')
}

export function FsmCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('fsm.title')} text={t('fsm.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op'])
    return <MutedRow tool={TOOL} title={t('fsm.title')} text={`${t('fsm.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<FsmResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('fsm.title')} summary="" isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('fsm.title')} text={`${t('fsm.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as FsmResult
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card tool={TOOL} title={opTitle(op, t)} summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}>
      <Boundary fallback={fallback}>
        <FsmBody op={op} r={r} t={t} />
      </Boundary>
    </Card>
  )
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: FsmResult, t: TFn): ReactNode {
  switch (op) {
    case 'reduce': {
      const x = r as FsmResultMap['reduce']
      const head = x.reduce.complete ? t('fsm.reduce.complete') : t('fsm.reduce.incomplete')
      return `${head} · ${fmt(t, 'fsm.reduce.reduced', { n: x.reduce.reducedCount, m: x.spec.states.length })}`
    }
    case 'assign': {
      const a = (r as FsmResultMap['assign']).assign
      const best = a.encodings.find(e => e.kind === a.best) ?? a.encodings[0]
      return fmt(t, 'fsm.assign.summary', { kind: kindLabel(a.best, t), score: best.score })
    }
    case 'synthesize': {
      const s = (r as FsmResultMap['synthesize']).synthesis
      return fmt(t, 'fsm.synth.summary', { ff: s.ff, n: s.functions.length })
    }
    case 'self_start': {
      const x = (r as FsmResultMap['self_start']).selfStart
      if (x.selfStarting) return t('fsm.selfStart.yes')
      return x.fixed ? t('fsm.selfStart.fixed') : t('fsm.selfStart.stillNo')
    }
    default:
      return ''
  }
}

export function FsmBody({ op, r, t }: { op: string; r: FsmResult; t: TFn }) {
  switch (op) {
    case 'reduce': {
      const x = r as FsmResultMap['reduce']
      return <ReduceBody spec={x.spec} reduce={x.reduce} t={t} />
    }
    case 'assign': {
      const x = r as FsmResultMap['assign']
      return <AssignBody spec={x.spec} assign={x.assign} t={t} />
    }
    case 'synthesize': {
      const x = r as FsmResultMap['synthesize']
      return <SynthBody spec={x.spec} s={x.synthesis} t={t} />
    }
    case 'self_start': {
      const x = r as FsmResultMap['self_start']
      return <SelfStartBody spec={x.spec} sc={x.selfStart} t={t} />
    }
    default:
      return <TextBody text="" />
  }
}

// ───────────────────────── 状态表与状态图 ─────────────────────────

/** 状态表：列为输入组合，单元格为“次态/输出”；摩尔型把输出单列。 */
function StateTable({ spec, t }: { spec: FsmSpec; t: TFn }) {
  const T: Table = buildTable(spec)
  const combos = 1 << T.inputs
  const moore = T.type === 'moore'
  return (
    <div className={c('tt-wrap')}>
      <table className={c('tt')}>
        <thead>
          <tr>
            <th>{t('fsm.table.state')}</th>
            {moore && <th>{t('fsm.table.output')}</th>}
            {Array.from({ length: combos }, (_, k) => (
              <th key={k}>{`${t('fsm.table.input')} ${bitsOf(k, T.inputs)}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {T.states.map((s, i) => (
            <tr key={`${s}-${i}`}>
              <td>{s}</td>
              {moore && <td className={c('tt-out')}>{T.out[i][0]}</td>}
              {Array.from({ length: combos }, (_, k) => {
                const nx = T.next[i][k]
                const text = moore ? (nx < 0 ? 'x' : T.states[nx]) : `${nx < 0 ? 'x' : T.states[nx]}/${T.out[i][k]}`
                return <td key={k}>{text}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const NODE_R = 16

/** 状态图：状态圆形排布，转移为带箭头的弧线，标注“输入/输出”；自环画在节点外侧。 */
function StateDiagram({ spec, t }: { spec: FsmSpec; t: TFn }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const n = spec.states.length
  const R = n <= 4 ? 70 : n <= 8 ? 100 : 130
  const pad = 58
  const size = 2 * (R + pad)
  const cx = size / 2
  const cy = size / 2
  const pos = spec.states.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }
  })
  const index = new Map(spec.states.map((s, i) => [s, i]))
  const groups = new Map<string, { from: number; to: number; labels: string[] }>()
  for (const tr of spec.transitions) {
    if (tr.to === 'x' || tr.to === '' || tr.to === '-') continue
    const a = index.get(tr.from)
    const b = index.get(tr.to)
    if (a === undefined || b === undefined) continue
    const key = `${a}>${b}`
    if (!groups.has(key)) groups.set(key, { from: a, to: b, labels: [] })
    const label = `${tr.input}/${tr.output}`
    const g = groups.get(key)
    if (g && !g.labels.includes(label)) g.labels.push(label)
  }
  const style = { stroke: 'var(--dsw-alias-label-secondary)', fill: 'none', strokeWidth: 1 }
  const textStyle = { fill: 'var(--dsw-alias-label-secondary)' }
  const edges = [...groups.values()].map((g, k) => {
    const label = g.labels.join('  ')
    if (g.from === g.to) {
      const p = pos[g.from]
      const ux = (p.x - cx) / (Math.hypot(p.x - cx, p.y - cy) || 1)
      const uy = (p.y - cy) / (Math.hypot(p.x - cx, p.y - cy) || 1)
      const rot = (ang: number): [number, number] => [
        ux * Math.cos(ang) - uy * Math.sin(ang),
        ux * Math.sin(ang) + uy * Math.cos(ang),
      ]
      const [ax, ay] = rot(0.6)
      const [bx, by] = rot(-0.6)
      const A = [p.x + ax * NODE_R, p.y + ay * NODE_R]
      const B = [p.x + bx * NODE_R, p.y + by * NODE_R]
      const lx = p.x + ux * (NODE_R + 26)
      const ly = p.y + uy * (NODE_R + 26)
      return (
        <g key={k}>
          <path d={`M${A[0]},${A[1]} A22,22 0 1,1 ${B[0]},${B[1]}`} style={style} markerEnd={`url(#${uid}-arrow)`} />
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10} style={textStyle}>
            {label}
          </text>
        </g>
      )
    }
    const p0 = pos[g.from]
    const p2 = pos[g.to]
    const dx = p2.x - p0.x
    const dy = p2.y - p0.y
    const len = Math.hypot(dx, dy) || 1
    const vx = dx / len
    const vy = dy / len
    const px = -vy
    const py = vx
    const start = [p0.x + vx * NODE_R, p0.y + vy * NODE_R]
    const end = [p2.x - vx * NODE_R, p2.y - vy * NODE_R]
    const bend = len * 0.18
    const ctrl = [(start[0] + end[0]) / 2 + px * bend, (start[1] + end[1]) / 2 + py * bend]
    const mid = [0.25 * start[0] + 0.5 * ctrl[0] + 0.25 * end[0], 0.25 * start[1] + 0.5 * ctrl[1] + 0.25 * end[1]]
    return (
      <g key={k}>
        <path
          d={`M${start[0]},${start[1]} Q${ctrl[0]},${ctrl[1]} ${end[0]},${end[1]}`}
          style={style}
          markerEnd={`url(#${uid}-arrow)`}
        />
        <text x={mid[0] + px * 8} y={mid[1] + py * 8} textAnchor="middle" dominantBaseline="middle" fontSize={10} style={textStyle}>
          {label}
        </text>
      </g>
    )
  })
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>{t('fsm.diagram')}</div>
      {groups.size === 0 ? (
        <div className={c('muted')}>{t('fsm.diagram.empty')}</div>
      ) : (
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block' }} role="img">
          <defs>
            <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--dsw-alias-label-secondary)' }} />
            </marker>
          </defs>
          {edges}
          {spec.states.map((s, i) => (
            <g key={`${s}-${i}`}>
              <circle cx={pos[i].x} cy={pos[i].y} r={NODE_R} style={style} />
              <text x={pos[i].x} y={pos[i].y} textAnchor="middle" dominantBaseline="middle" fontSize={11} style={{ fill: 'var(--dsw-alias-label-primary)' }}>
                {s}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}

// ───────────────────────── 各 op 的主体 ─────────────────────────

function ReduceBody({ spec, reduce, t }: { spec: FsmSpec; reduce: FsmResultMap['reduce']['reduce']; t: TFn }) {
  const merged = reduce.classes.some(cls => cls.length > 1)
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{reduce.complete ? t('fsm.reduce.complete') : t('fsm.reduce.incomplete')}</div>
        {reduce.complete && reduce.implication && reduce.implication.length > 0 && (
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  <th>{t('fsm.implication.pair')}</th>
                  <th>{t('fsm.implication.result')}</th>
                  <th>{t('fsm.implication.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {reduce.implication.map((p, i) => (
                  <tr key={i}>
                    <td>{`(${p.a}, ${p.b})`}</td>
                    <td className={p.status === 'equivalent' ? c('ok') : c('bad')}>
                      {p.status === 'equivalent' ? t('fsm.implication.equivalent') : t('fsm.implication.distinct')}
                    </td>
                    <td style={{ textAlign: 'left' }}>
                      {p.reason}
                      {p.implied.length > 0 && p.status === 'equivalent' && (
                        <div className={c('muted')}>
                          {fmt(t, 'fsm.implication.implied', {
                            pairs: p.implied.map(q => `(${q.a}, ${q.b})`).join(' '),
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('fsm.reduce.classes')}</span>
          <span className={c('chips')}>
            {reduce.classes.map((cls, i) => (
              <span key={i} className={c('chip')}>
                {cls.length > 1 ? `{${cls.join(',')}}` : cls[0]}
              </span>
            ))}
          </span>
        </div>
        {!reduce.complete && reduce.cover && (
          <div className={c('line')}>
            <span className={c('line-label')}>{t('fsm.reduce.cover')}</span>
            <span className={c('chips')}>
              {reduce.cover.map((cls, i) => (
                <span key={i} className={`${c('chip')} ${c('chip-ess')}`}>
                  {cls.length > 1 ? `{${cls.join(',')}}` : cls[0]}
                </span>
              ))}
            </span>
          </div>
        )}
        {!merged && reduce.complete && <div className={c('muted')}>{t('fsm.reduce.noMerge')}</div>}
        <div className={c('line')}>
          <span className={c('line-label')}>{t('fsm.reduce.stateMap')}</span>
          <span>
            {reduce.stateMap.map(m => `${m.state}→${m.groups.join('/')}`).join('，')}
          </span>
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('fsm.reduce.reducedTable')}</div>
        <StateTable spec={reduce.reduced} t={t} />
      </div>
      <StateDiagram spec={reduce.reduced} t={t} />
    </div>
  )
}

function AssignBody({ spec, assign, t }: { spec: FsmSpec; assign: FsmResultMap['assign']['assign']; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('fsm.assign.pairs')}</div>
        {assign.pairs.length === 0 ? (
          <div className={c('muted')}>{t('fsm.assign.none')}</div>
        ) : (
          <ul className={c('list')}>
            {assign.pairs.map((p, i) => (
              <li key={i}>
                <span className={c('id')}>{`${p.a}-${p.b}`}</span>
                <span>{p.rules.map(r => fmt(t, 'fsm.assign.rule', { r })).join('，')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={c('step')}>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('fsm.assign.encoding')}</th>
                <th>{t('fsm.assign.bits')}</th>
                <th>{t('fsm.assign.score')}</th>
                <th>{t('fsm.assign.satisfied')}</th>
                <th>{t('fsm.assign.codes')}</th>
              </tr>
            </thead>
            <tbody>
              {assign.encodings.map((e, i) => {
                const isBest = e.kind === assign.best
                return (
                  <tr key={i}>
                    <td className={isBest ? c('ok') : undefined}>
                      {kindLabel(e.kind, t)}
                      {isBest ? `（${t('fsm.assign.best')}）` : ''}
                    </td>
                    <td>{e.bits}</td>
                    <td>{e.score}</td>
                    <td>{`${e.satisfied}/${e.total}`}</td>
                    <td style={{ textAlign: 'left' }}>{e.codes.map(x => `${x.state}=${x.code}`).join('  ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <StateDiagram spec={spec} t={t} />
    </div>
  )
}

function SynthBody({ spec, s, t }: { spec: FsmSpec; s: SynthesizeResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('fsm.synth.codes')}</div>
        <div className={c('chips')}>
          {s.codes.map(x => (
            <span key={x.state} className={c('chip')}>
              {`${x.state} = ${x.code}`}
            </span>
          ))}
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('fsm.synth.table')}</div>
        <ExcitationTable s={s} t={t} />
      </div>
      <FunctionList fns={s.functions} t={t} title={t('fsm.synth.functions')} />
      <StateDiagram spec={spec} t={t} />
    </div>
  )
}

function ExcitationTable({ s, t }: { s: SynthesizeResult; t: TFn }) {
  return (
    <div className={c('tt-wrap')}>
      <table className={c('tt')}>
        <thead>
          <tr>
            <th>{t('fsm.table.code')}</th>
            <th>{t('fsm.table.state')}</th>
            <th>{t('fsm.table.input')}</th>
            <th>{t('fsm.table.next')}</th>
            <th>{t('fsm.table.output')}</th>
            {s.excitationNames.map(name => (
              <th key={name}>{name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {s.table.map((row, i) => {
            const cls = row.state === null ? c('muted') : undefined
            return (
              <tr key={i}>
                <td className={cls}>{row.code}</td>
                <td className={cls}>{row.state ?? t('fsm.table.unused')}</td>
                <td className={cls}>{row.input}</td>
                <td className={cls}>{row.next === null ? 'x' : `${row.next}（${row.nextCode}）`}</td>
                <td className={cls}>{row.output}</td>
                {s.excitationNames.map(name => (
                  <td key={name} className={cls}>
                    {row.excitation[name] ?? 'x'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FunctionList({ fns, t, title }: { fns: SynthFunction[]; t: TFn; title: string }) {
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>{title}</div>
      <ul className={c('list')}>
        {fns.map(f => (
          <li key={f.name} style={{ flexDirection: 'column', gap: 2 }}>
            <div>
              <span className={c('id')}>{f.name}</span>{' '}
              <span className={c('muted')}>{f.role === 'excitation' ? t('fsm.synth.role.excitation') : t('fsm.synth.role.output')}</span>
              {'  '}
              <Expr text={f.text} variables={f.variables} />
              <span className={c('muted')}>{`  ${fmt(t, 'fsm.synth.cost', { terms: f.cost.terms, literals: f.cost.literals })}`}</span>
            </div>
            {f.texts.length > 1 &&
              f.texts.slice(1).map((x, k) => (
                <div key={k} style={{ paddingLeft: 24 }}>
                  <span className={c('muted')}>{fmt(t, 'fsm.synth.solution', { n: k + 2 })}</span>{' '}
                  <Expr text={x} variables={f.variables} />
                </div>
              ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SelfStartBody({ spec, sc, t }: { spec: FsmSpec; sc: FsmResultMap['self_start']['selfStart']; t: TFn }) {
  const verdict = sc.selfStarting ? t('fsm.selfStart.yes') : sc.fixed ? t('fsm.selfStart.fixed') : t('fsm.selfStart.stillNo')
  const failing = sc.checks.filter(ch => !ch.ok)
  return (
    <div>
      <div className={c('step')}>
        <span className={sc.selfStarting ? c('verdict') : `${c('verdict')} ${c('verdict-bad')}`}>{verdict}</span>
      </div>
      {!sc.selfStarting && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('fsm.selfStart.before')}</div>
          <ul className={c('list')}>
            {failing.map((ch, i) => (
              <li key={i}>
                <span className={c('bad')}>{fmt(t, 'fsm.selfStart.check', { code: ch.code, input: ch.input, trace: ch.trace.join(' → ') })}</span>
              </li>
            ))}
          </ul>
          <ul className={c('list')}>
            {sc.rewritten.map((row, i) => (
              <li key={i}>
                <span>{fmt(t, 'fsm.selfStart.rewrite', { code: row.code, to: row.to })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!sc.selfStarting && sc.fixed && <FunctionList fns={sc.synthesis.functions} t={t} title={t('fsm.selfStart.after')} />}
      <StateDiagram spec={spec} t={t} />
    </div>
  )
}
