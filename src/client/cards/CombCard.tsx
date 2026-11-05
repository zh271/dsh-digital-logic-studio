// dlogic_comb 工具卡片：门级推导表、芯片引脚与接线表、降维真值表。
import type { ReactNode } from 'react'
import type {
  AnalyzeResult,
  DataValue,
  MsiPin,
  MsiResult,
  MsiStage,
  MsiMapping,
} from '../../shared/comb.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'
import { GateDiagram } from './GateDiagram.tsx'
import { Waveform, type WaveTrace } from './Waveform.tsx'

const TOOL = 'dlogic_comb'
const KNOWN_OPS: string[] = ['analyze', 'map_msi', 'draw']
/** 波形图最多显示的输入个数（2^5 = 32 列）。 */
const WAVE_MAX_INPUTS = 5

type CombValue = AnalyzeResult | MsiResult

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`comb.op.${op}`) : t('comb.title')
}

export function CombCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('comb.title')} text={t('comb.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op', 'chip'])
    return <MutedRow tool={TOOL} title={t('comb.title')} text={`${t('comb.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<CombValue>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('comb.title')} summary={firstArgText(parseArgs(argsRawOf(block)), ['op', 'chip'])} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('comb.title')} text={`${t('comb.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as CombValue
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card
      tool={TOOL}
      title={opTitle(op, t)}
      summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}
    >
      <Boundary fallback={fallback}>
        <div>
          <CombBody op={op} r={r} t={t} />
          {value.warnings.length > 0 && (
            <div className={c('step')}>
              {value.warnings.map((w, i) => (
                <div key={i} className={c('muted')}>
                  {t('comb.warn')}：{w}
                </div>
              ))}
            </div>
          )}
        </div>
      </Boundary>
    </Card>
  )
}

/** 无外框的主体视图（卡片与图示区共用）。 */
export function CombBody({ op, r, t }: { op: string; r: CombValue; t: TFn }) {
  return op === 'analyze' || op === 'draw' ? <AnalyzeBody r={r as AnalyzeResult} t={t} /> : <MsiBody r={r as MsiResult} t={t} />
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: CombValue, t: TFn): ReactNode {
  if (op === 'analyze' || op === 'draw') {
    const a = r as AnalyzeResult
    const first = a.finalExprs[0]
    return (
      <>
        {first ? `${first.name} = ` : ''}
        {first ? <Expr text={first.simplified} variables={a.inputs} /> : null}
        {' · '}
        {fmt(t, 'comb.levels', { n: a.depth })}
      </>
    )
  }
  return (r as MsiResult).chipName
}

// ───────────────────────── analyze ─────────────────────────

/** 波形：每个输入按真值表的二进制顺序（MSB 最慢）取值，每行一列；输出为对应取值。 */
function truthWaves(r: AnalyzeResult): WaveTrace[] {
  const rows = r.truthTable.rows
  const inWaves: WaveTrace[] = r.inputs.map((name, i) => ({
    name,
    role: 'input',
    wave: rows.map(row => String(row.inputs[i])).join(''),
  }))
  const outWaves: WaveTrace[] = r.outputs.map((name, j) => ({
    name,
    role: 'output',
    wave: rows.map(row => String(row.outputs[j])).join(''),
  }))
  return [...inWaves, ...outWaves]
}

function AnalyzeBody({ r, t }: { r: AnalyzeResult; t: TFn }) {
  const allNames = [...r.inputs, ...r.gates.map(g => g.out)]
  const tt = r.truthTable
  const netlist = {
    inputs: r.inputs,
    gates: r.gates.map(g => ({ out: g.out, type: g.type, in: g.in })),
    outputs: r.outputs,
  }
  const waveOk = r.inputs.length >= 1 && r.inputs.length <= WAVE_MAX_INPUTS
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('comb.diagram.title')}</div>
        <GateDiagram netlist={netlist} />
      </div>

      <div className={c('step')}>
        <div className={c('step-text')}>{t('comb.wave.title')}</div>
        {waveOk ? (
          <Waveform signals={truthWaves(r)} steps={tt.rows.length} scrollable />
        ) : (
          <div className={c('muted')}>{t('comb.wave.hidden')}</div>
        )}
      </div>

      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('comb.analyze.inputs')}</span>
          <span>{r.inputs.join(' ')}</span>
          <span className={c('muted')}>{fmt(t, 'comb.gates', { n: r.gates.length })}</span>
        </div>
      </div>

      <div className={c('step')}>
        <div className={c('step-text')}>{t('comb.analyze.steps')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('comb.analyze.col.gate')}</th>
                <th>{t('comb.analyze.col.type')}</th>
                <th>{t('comb.analyze.col.level')}</th>
                <th>{t('comb.analyze.col.local')}</th>
                <th>{t('comb.analyze.col.expr')}</th>
              </tr>
            </thead>
            <tbody>
              {r.gates.map((g) => (
                <tr key={g.out}>
                  <td>{g.out}</td>
                  <td>{g.type}</td>
                  <td>{g.level}</td>
                  <td>
                    <Expr text={`${g.out} = ${g.local}`} variables={allNames} />
                  </td>
                  <td>
                    {g.expr !== null ? (
                      <Expr text={g.expr} variables={r.inputs} />
                    ) : (
                      <span className={c('muted')}>{t('comb.analyze.noExpr')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.finalExprs.map((f) => (
        <div key={f.name} className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('comb.analyze.final')}</span>
            <span>{f.name} = </span>
            {f.expr !== null ? <Expr text={f.expr} variables={r.inputs} /> : <span className={c('muted')}>{t('comb.analyze.noExpr')}</span>}
          </div>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('comb.analyze.simplified')}</span>
            <span>{f.name} = </span>
            <Expr text={f.simplified} variables={r.inputs} />
            <span className={c('muted')}>{fmt(t, 'comb.analyze.cost', { terms: f.cost.terms, literals: f.cost.literals })}</span>
          </div>
        </div>
      ))}

      <div className={c('step')}>
        <div className={c('step-text')}>{t('comb.analyze.truth')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                {tt.variables.map((v) => (
                  <th key={v}>{v}</th>
                ))}
                {tt.outputs.map((o) => (
                  <th key={o}>{o}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tt.rows.slice(0, 64).map((row) => (
                <tr key={row.index}>
                  {row.inputs.map((b, i) => (
                    <td key={`i${i}`}>{b}</td>
                  ))}
                  {row.outputs.map((b, i) => (
                    <td key={`o${i}`} className={c('tt-out')}>
                      {b}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tt.rows.length > 64 && <div className={c('muted')}>{fmt(t, 'comb.analyze.truthMore', { n: tt.rows.length })}</div>}
      </div>
    </div>
  )
}

// ───────────────────────── map_msi ─────────────────────────

function activeText(p: MsiPin, t: TFn): string {
  if (p.activeLevel === 'high') return t('comb.active.high')
  if (p.activeLevel === 'low') return t('comb.active.low')
  return t('comb.active.none')
}

function variablesOf(m: MsiMapping): string[] {
  switch (m.kind) {
    case 'decoder':
      return m.addressVars
    case 'mux':
      return [...m.selectVars, ...m.highVars]
    case 'parity':
      return m.variables
    default:
      return []
  }
}

function MsiBody({ r, t }: { r: MsiResult; t: TFn }) {
  const vars = variablesOf(r.mapping)
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{r.chipName}</div>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('comb.func')}</span>
          <span>{r.functionText}</span>
        </div>
      </div>

      <div className={c('step')}>
        <div className={c('step-text')}>{t('comb.pins.title')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('comb.pins.name')}</th>
                <th>{t('comb.pins.alias')}</th>
                <th>{t('comb.pins.level')}</th>
                <th>{t('comb.pins.note')}</th>
              </tr>
            </thead>
            <tbody>
              {r.pins.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td>{p.aliases.join('、')}</td>
                  <td>{activeText(p, t)}</td>
                  <td className={c('muted')}>{p.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {r.stages.map((st, i) => (
        <StageBody key={i} stage={st} vars={vars} t={t} />
      ))}

      <MappingBody m={r.mapping} t={t} />
    </div>
  )
}

function StageBody({ stage, vars, t }: { stage: MsiStage; vars: string[]; t: TFn }) {
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>
        {t('comb.wiring.title')}：{stage.label}
      </div>
      <div className={c('tt-wrap')}>
        <table className={c('tt')}>
          <thead>
            <tr>
              <th>{t('comb.wiring.pin')}</th>
              <th>{t('comb.wiring.signal')}</th>
              <th>{t('comb.wiring.note')}</th>
            </tr>
          </thead>
          <tbody>
            {stage.wiring.map((w, j) => (
              <tr key={j}>
                <td>{w.pin}</td>
                <td>
                  <Expr text={w.signal} variables={vars} />
                </td>
                <td className={c('muted')}>{w.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function dataText(d: DataValue, vars: string[]): ReactNode {
  if (d.kind === 'const') return d.text
  return <Expr text={d.text} variables={vars} />
}

function MappingBody({ m, t }: { m: MsiMapping; t: TFn }) {
  switch (m.kind) {
    case 'decoder':
      return (
        <div className={c('step')}>
          {m.constant !== null ? (
            <div className={c('step-text')}>{fmt(t, 'comb.decoder.constant', { v: m.constant })}</div>
          ) : (
            <div className={c('line')}>
              <span className={c('line-label')}>{t('comb.decoder.nand')}</span>
              <Expr text={m.nandText} variables={m.outputNames} />
            </div>
          )}
        </div>
      )
    case 'mux': {
      const high = m.highVars
      return (
        <div className={c('step')}>
          <div className={c('step-text')}>
            {t('comb.mux.reduced')}（{t('comb.mux.select')}：{m.selectVars.join(' ')}
            {high.length ? `；${t('comb.mux.high')}：${high.join(' ')}` : `；${t('comb.mux.noHigh')}`}）
          </div>
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  <th>{t('comb.mux.code')}</th>
                  <th>{t('comb.mux.dataPin')}</th>
                  {m.highAssignments.map((hv, i) => (
                    <th key={i}>{high.map((v, j) => `${v}=${hv[j]}`).join(' ')}</th>
                  ))}
                  <th>{t('comb.mux.value')}</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((row) => (
                  <tr key={row.index}>
                    <td>{row.selectBits.join('')}</td>
                    <td>{row.dataPin}</td>
                    {row.cofactor.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                    <td className={c('tt-out')}>{dataText(row.data, high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    case 'adder':
      return m.bcd && m.correctionText ? (
        <div className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('comb.adder.correction')}</span>
            <span>{m.correctionText}</span>
          </div>
        </div>
      ) : null
    case 'parity':
      return (
        <div className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('comb.parity.output')}</span>
            <span>{m.outputPin}</span>
          </div>
        </div>
      )
    case 'encoder':
      return (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('comb.encoder.note')}</div>
        </div>
      )
    default:
      return null
  }
}
