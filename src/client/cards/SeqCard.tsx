// dlogic_seq 工具卡片：按 Envelope.op 分派到触发器、时序分析、计数器、移位寄存器与波形视图。
import type { ReactNode } from 'react'
import type { AnalyzeResult, CounterResult, FfResult, ShiftResult, SeqOp, SeqResultMap, WaveformResult } from '../../shared/seq.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'
import { StateGraphView } from './StateGraph.tsx'
import { Waveform } from './Waveform.tsx'

const TOOL = 'dlogic_seq'
const KNOWN_OPS: string[] = ['ff', 'analyze', 'counter', 'shift', 'waveform']

type SeqResult = SeqResultMap[SeqOp]

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`seq.op.${op}`) : t('seq.title')
}

export function SeqCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('seq.title')} text={t('seq.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op', 'ffKind', 'shiftKind', 'model'])
    return <MutedRow tool={TOOL} title={t('seq.title')} text={`${t('seq.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<SeqResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('seq.title')} summary={firstArgText(parseArgs(argsRawOf(block)), ['op'])} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('seq.title')} text={`${t('seq.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as SeqResult
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card tool={TOOL} title={opTitle(op, t)} summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}>
      <Boundary fallback={fallback}>
        <SeqBody op={op} r={r} t={t} />
      </Boundary>
    </Card>
  )
}

function summaryOf(op: string, r: SeqResult, t: TFn): ReactNode {
  switch (op) {
    case 'ff': {
      const x = r as FfResult
      return <Expr text={x.characteristic} variables={x.inputs} />
    }
    case 'analyze': {
      const x = r as AnalyzeResult
      return `${x.stateNames.join(' ')} · ${x.selfStart ? t('seq.self.yes') : t('seq.self.no')}`
    }
    case 'counter': {
      const x = r as CounterResult
      return fmt(t, 'seq.counter.model', { model: x.model, n: x.N }) + (x.feedback.expr ? ' · ' + x.feedback.expr : '')
    }
    case 'shift': {
      const x = r as ShiftResult
      const name = shiftName(x.kind, t)
      return x.modulus !== null ? `${name} · ${fmt(t, 'seq.shift.modulus', { n: x.modulus })}` : name
    }
    case 'waveform': {
      const x = r as WaveformResult
      return fmt(t, 'seq.wave.steps', { n: x.steps })
    }
    default:
      return ''
  }
}

function shiftName(kind: string, t: TFn): string {
  if (kind === '194') return t('seq.shift.194')
  if (kind === 'ring') return t('seq.shift.ring')
  return t('seq.shift.johnson')
}

export function SeqBody({ op, r, t }: { op: string; r: SeqResult; t: TFn }) {
  switch (op) {
    case 'ff':
      return <FfBody x={r as FfResult} t={t} />
    case 'analyze':
      return <AnalyzeBody x={r as AnalyzeResult} t={t} />
    case 'counter':
      return <CounterBody x={r as CounterResult} t={t} />
    case 'shift':
      return <ShiftBody x={r as ShiftResult} t={t} />
    case 'waveform':
      return <WaveBody x={r as WaveformResult} t={t} />
    default:
      return null
  }
}

function Verdict({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return <span className={ok ? c('verdict') : `${c('verdict')} ${c('verdict-bad')}`}>{ok ? yes : no}</span>
}

function FfBody({ x, t }: { x: FfResult; t: TFn }) {
  const trig = t(`seq.ff.trigger.${x.trigger}`)
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('seq.ff.characteristic')}</span>
          <Expr text={x.characteristic} variables={x.inputs} />
        </div>
        {x.constraint && (
          <div className={c('line')}>
            <span className={c('line-label')}>{t('seq.ff.constraint')}</span>
            <span>{x.constraint}</span>
          </div>
        )}
        <div className={c('line')}>
          <span className={c('muted')}>{trig}</span>
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.ff.table')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                {x.inputs.map(p => (
                  <th key={p}>{p}</th>
                ))}
                <th>{t('seq.col.q')}</th>
                <th>{t('seq.col.next')}</th>
              </tr>
            </thead>
            <tbody>
              {x.table.map((row, i) => (
                <tr key={i}>
                  {x.inputs.map(p => (
                    <td key={p}>{row.inputs[p]}</td>
                  ))}
                  <td>{row.q}</td>
                  <td className={c('tt-out')}>{row.next === 'X' ? t('seq.ff.forbidden') : row.next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.ff.excitation')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('seq.col.q')}</th>
                <th>{t('seq.col.next')}</th>
                {x.inputs.filter(p => p !== 'CP').map(p => (
                  <th key={p}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {x.excitation.map((e, i) => (
                <tr key={i}>
                  <td>{e.from}</td>
                  <td>{e.to}</td>
                  {x.inputs.filter(p => p !== 'CP').map(p => (
                    <td key={p} className={e.drive[p] === 'X' ? c('muted') : c('tt-out')}>
                      {e.drive[p] === 'X' ? 'X' : e.drive[p]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={c('line')}>
          <span className={c('muted')}>{t('seq.ff.any')}</span>
        </div>
      </div>
    </div>
  )
}

function AnalyzeBody({ x, t }: { x: AnalyzeResult; t: TFn }) {
  const vars = [...x.stateNames, ...x.inputNames]
  const hasInputs = x.inputNames.length > 0
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.analyze.drives')}</div>
        {x.drives.map((d, i) => (
          <div key={i} className={c('line')}>
            <span className={c('line-label')}>{`${d.ff}.${d.pin}`}</span>
            <Expr text={d.expr} variables={vars} />
          </div>
        ))}
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.analyze.state')}</div>
        {x.stateEquations.map((e, i) => (
          <div key={i} className={c('line')}>
            <span className={c('line-label')}>{`${e.ff}*`}</span>
            <Expr text={e.text} variables={vars} />
          </div>
        ))}
      </div>
      {x.outputs.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('seq.analyze.outputs')}</div>
          {x.outputs.map((o, i) => (
            <div key={i} className={c('line')}>
              <span className={c('line-label')}>{o.name}</span>
              <Expr text={o.expr} variables={vars} />
              <span className={c('muted')}>{o.type === 'Moore' ? t('seq.analyze.moore') : t('seq.analyze.mealy')}</span>
            </div>
          ))}
        </div>
      )}
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.analyze.table')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('seq.col.state')}</th>
                {hasInputs && <th>{t('seq.col.input')}</th>}
                <th>{t('seq.col.nextState')}</th>
                {x.outputs.map(o => (
                  <th key={o.name}>{o.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {x.table.map((row, i) => (
                <tr key={i} className={row.valid ? undefined : c('muted')}>
                  <td>{row.state}</td>
                  {hasInputs && <td>{row.input}</td>}
                  <td className={c('tt-out')}>
                    {row.next}
                    {!row.valid && <span className={c('muted')}> {t('seq.analyze.invalidRow')}</span>}
                  </td>
                  {row.outputs.map(o => (
                    <td key={o.name}>{o.value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('seq.analyze.valid')}</span>
          <span>{x.validStates.join(' ') || t('seq.analyze.noValid')}</span>
        </div>
        <div className={c('line')}>
          <Verdict ok={x.selfStart} yes={t('seq.self.yes')} no={t('seq.self.no')} />
        </div>
        {x.invalidPaths.length > 0 && (
          <div className={c('list')}>
            <div className={c('step-text')}>{t('seq.analyze.invalid')}</div>
            <ul className={c('list')}>
              {x.invalidPaths.map((p, i) => (
                <li key={i}>
                  <span className={c('id')}>{p.from}</span>
                  <span>{p.path.join(' → ')}</span>
                  {!p.reached && <span className={c('bad')}>{t('seq.analyze.noReach')}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.analyze.graph')}</div>
        <StateGraphView graph={x.graph} />
      </div>
    </div>
  )
}

function CounterBody({ x, t }: { x: CounterResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('seq.counter.feedback')}</span>
          {x.feedback.expr ? <Expr text={x.feedback.expr} /> : <span>{t('seq.counter.none')}</span>}
          {x.feedback.kind !== 'none' && (
            <span className={c('muted')}>{x.feedback.kind === 'async' ? t('seq.counter.async') : t('seq.counter.sync')}</span>
          )}
        </div>
        <div className={c('line')}>
          <span className={c('muted')}>
            {`${x.method === 'preset' ? t('seq.counter.preset') : t('seq.counter.reset')} · ${x.chips === 2 ? t('seq.counter.cascade') : t('seq.counter.single')}`}
          </span>
        </div>
        {x.load && (
          <div className={c('line')}>
            <span className={c('line-label')}>{t('seq.counter.load')}</span>
            <span>{`${x.load.value}（${x.load.bits}）`}</span>
          </div>
        )}
        <div className={c('line')}>
          <span className={c('line-label')}>{t('seq.counter.bitNames')}</span>
          <span>{x.bitNames.join(' ')}</span>
        </div>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.counter.sequence')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('seq.col.index')}</th>
                <th>{t('seq.col.bits')}</th>
                <th>{t('seq.col.value')}</th>
                <th>{t('seq.col.note')}</th>
              </tr>
            </thead>
            <tbody>
              {x.sequence.map((row, i) => (
                <tr key={i} className={row.transient ? c('muted') : undefined}>
                  <td>{row.index}</td>
                  <td>{row.bits}</td>
                  <td>{row.value}</td>
                  <td>{row.transient ? `${t('seq.counter.transient')}（${t('seq.counter.glitch')}）` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ShiftBody({ x, t }: { x: ShiftResult; t: TFn }) {
  const invalid = x.cycles ? x.cycles.filter(cy => !cy.valid) : []
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('seq.shift.feedback')}</span>
          <span>{x.feedback}</span>
        </div>
        {x.modulus !== null && (
          <div className={c('line')}>
            <span className={c('line-label')}>{fmt(t, 'seq.shift.modulus', { n: x.modulus })}</span>
            <span className={c('muted')}>{x.validCycle?.join(' → ')}</span>
          </div>
        )}
        {x.selfStart !== null && <Verdict ok={x.selfStart} yes={t('seq.self.yes')} no={t('seq.self.no')} />}
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('seq.shift.sequence')}</div>
        <ul className={c('list')}>
          {x.sequence.map((s, i) => (
            <li key={i}>
              <span className={c('id')}>{s.step}</span>
              <span className={s.valid ? undefined : c('muted')}>{s.state}</span>
              {!s.valid && <span className={c('muted')}>{t('seq.shift.invalidState')}</span>}
            </li>
          ))}
        </ul>
      </div>
      {invalid.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('seq.shift.invalid')}</div>
          {invalid.map((cy, i) => (
            <div key={i} className={c('line')}>
              <span>{cy.states.join(' → ')}</span>
            </div>
          ))}
        </div>
      )}
      {x.graph && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('seq.analyze.graph')}</div>
          <StateGraphView graph={x.graph} />
        </div>
      )}
    </div>
  )
}

function WaveBody({ x, t }: { x: WaveformResult; t: TFn }) {
  return (
    <div className={c('step')}>
      <Waveform signals={x.signals} steps={x.steps} />
    </div>
  )
}
