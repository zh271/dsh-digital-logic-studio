// dlogic_bool 工具卡片：按 Envelope.op 分派到对应视图。
import type { ReactNode } from 'react'
import type { BoolOp, BoolResultMap, CanonicalResult, HazardResult, MinimizeResult } from '../../shared/contracts.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'
import { KMapView } from './KMapView.tsx'
import { TruthTableView } from './TruthTableView.tsx'

const TOOL = 'dlogic_bool'
const KNOWN_OPS: string[] = [
  'parse',
  'truth_table',
  'canonical',
  'minimize',
  'kmap',
  'hazard',
  'complement',
  'dual',
  'gate_form',
  'equivalent',
]
type BoolResult = BoolResultMap[BoolOp]

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`bool.op.${op}`) : t('bool.title')
}

export function BoolCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('bool.title')} text={t('bool.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['expression', 'expr', 'input', 'op'])
    return <MutedRow tool={TOOL} title={t('bool.title')} text={`${t('bool.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<BoolResult>(block, TOOL)
  if (isError || value === null) {
    const head = firstArgText(parseArgs(argsRawOf(block)), ['expression', 'expr', 'input'])
    return (
      <Card tool={TOOL} title={t('bool.title')} summary={head} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('bool.title')} text={`${t('bool.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as BoolResult
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card tool={TOOL} title={opTitle(op, t)} summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}>
      <Boundary fallback={fallback}>
        <OpBody op={op} r={r} t={t} fallbackText={resultText(block)} />
      </Boundary>
    </Card>
  )
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: BoolResult, t: TFn): ReactNode {
  switch (op) {
    case 'truth_table': {
      const x = r as BoolResultMap['truth_table']
      return fmt(t, 'bool.rows', { n: x.table.rows.length }) + ' · ' + x.table.variables.join(' ')
    }
    case 'minimize': {
      const x = r as BoolResultMap['minimize']
      const texts = x.minimize.texts ?? []
      return (
        <>
          <Expr text={texts[0] ?? ''} variables={x.spec.variables} />
          {texts.length > 1 ? ' · ' + fmt(t, 'bool.solutions', { n: texts.length }) : ''}
        </>
      )
    }
    case 'kmap': {
      const x = r as BoolResultMap['kmap']
      return <Expr text={x.minimize.texts[0] ?? ''} variables={x.spec.variables} />
    }
    case 'canonical':
      return (r as BoolResultMap['canonical']).canonical.sigma
    case 'hazard': {
      const h = (r as BoolResultMap['hazard']).hazard
      const n = (h.static1?.length ?? 0) + (h.static0?.length ?? 0)
      return n === 0 ? t('bool.hazard.none') : fmt(t, 'bool.hazard.count', { n })
    }
    case 'complement':
    case 'dual':
      return <Expr text={(r as BoolResultMap['complement']).text} />
    case 'gate_form':
      return <Expr text={(r as BoolResultMap['gate_form']).gates.nandNand} variables={(r as BoolResultMap['gate_form']).spec.variables} />
    case 'equivalent':
      return (r as BoolResultMap['equivalent']).equivalence.equivalent ? t('bool.equiv.yes') : t('bool.equiv.no')
    case 'parse':
      return (r as BoolResultMap['parse']).spec.variables.join(' ')
    default:
      return ''
  }
}

/** 按 op 渲染卡片主体；也被图示区（figures）复用。 */
export function OpBody({ op, r, t, fallbackText }: { op: string; r: BoolResult; t: TFn; fallbackText: string }) {
  switch (op) {
    case 'truth_table':
      return <TruthTableView table={(r as BoolResultMap['truth_table']).table} t={t} />
    case 'minimize': {
      const x = r as BoolResultMap['minimize']
      return <MinimizeBody variables={x.spec.variables} m={x.minimize} t={t} />
    }
    case 'kmap': {
      const x = r as BoolResultMap['kmap']
      return <KMapView layout={x.kmap} minimize={x.minimize} t={t} />
    }
    case 'canonical':
      return <CanonicalBody x={(r as BoolResultMap['canonical']).canonical} t={t} />
    case 'hazard': {
      const x = r as BoolResultMap['hazard']
      return <HazardBody h={x.hazard} variables={x.spec.variables} t={t} />
    }
    case 'complement':
    case 'dual': {
      const x = r as BoolResultMap['complement']
      return (
        <div className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('bool.input')}</span>
            <Expr text={x.input} />
          </div>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('bool.result')}</span>
            <Expr text={x.text} />
          </div>
        </div>
      )
    }
    case 'gate_form': {
      const x = r as BoolResultMap['gate_form']
      return (
        <div className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('bool.gate.nandNand')}</span>
            <Expr text={x.gates.nandNand} variables={x.spec.variables} />
          </div>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('bool.gate.norNor')}</span>
            <Expr text={x.gates.norNor} variables={x.spec.variables} />
          </div>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('bool.gate.andOrInvert')}</span>
            <Expr text={x.gates.andOrInvert} variables={x.spec.variables} />
          </div>
        </div>
      )
    }
    case 'equivalent':
      return <EquivalentBody x={r as BoolResultMap['equivalent']} t={t} />
    case 'parse':
      return <ParseBody x={r as BoolResultMap['parse']} t={t} />
    default:
      return <TextBody text={fallbackText} />
  }
}

function MinimizeBody({ variables, m, t }: { variables: string[]; m: MinimizeResult; t: TFn }) {
  const texts = m.texts ?? []
  const essential = new Set(m.essential ?? [])
  const primes = m.primeImplicants ?? []
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{texts.length > 1 ? fmt(t, 'bool.multi', { n: texts.length }) : t('bool.minimal')}</div>
        {texts.map((s, i) => (
          <div key={i} className={c('line')}>
            <Expr text={s} variables={variables} />
          </div>
        ))}
        <div className={c('line')}>
          <span className={c('muted')}>{fmt(t, 'bool.cost', { terms: m.cost.terms, literals: m.cost.literals })}</span>
        </div>
      </div>
      {primes.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('bool.primes')}</div>
          <div className={c('chips')}>
            {primes.map((p, i) => (
              <span key={i} className={essential.has(p.mask) ? `${c('chip')} ${c('chip-ess')}` : c('chip')}>
                <Expr text={p.text} variables={variables} />
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CanonicalBody({ x, t }: { x: CanonicalResult; t: TFn }) {
  return (
    <div className={c('step')}>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.canonical.sigma')}</span>
        <span>{x.sigma}</span>
      </div>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.canonical.pi')}</span>
        <span>{x.pi}</span>
      </div>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.canonical.sopForm')}</span>
        <Expr text={x.sopText} />
      </div>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.canonical.posForm')}</span>
        <Expr text={x.posText} />
      </div>
    </div>
  )
}

function HazardBody({ h, variables, t }: { h: HazardResult; variables: string[]; t: TFn }) {
  const pairs = [
    ...(h.static1 ?? []).map((p) => ({ ...p, label: t('bool.hazard.static1') })),
    ...(h.static0 ?? []).map((p) => ({ ...p, label: t('bool.hazard.static0') })),
  ]
  return (
    <div>
      {pairs.length === 0 ? (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('bool.hazard.none')}</div>
        </div>
      ) : (
        <div className={c('step')}>
          {pairs.map((p, i) => (
            <div key={i} className={c('line')}>
              <span className={c('line-label')}>{p.label}</span>
              <span>{fmt(t, 'bool.hazard.pair', { a: p.a, b: p.b })}</span>
              <span className={c('muted')}>{fmt(t, 'bool.hazard.var', { v: p.variable })}</span>
              <span>
                {t('bool.hazard.add')} <Expr text={p.consensus.text} variables={variables} />
              </span>
            </div>
          ))}
        </div>
      )}
      <div className={c('step')}>
        <div className={c('step-text')}>{t('bool.hazard.freeSop')}</div>
        <Expr text={h.hazardFreeSop} variables={variables} />
      </div>
    </div>
  )
}

function EquivalentBody({ x, t }: { x: BoolResultMap['equivalent']; t: TFn }) {
  const e = x.equivalence
  const variables = x.left.variables
  const ce = e.counterexample
  return (
    <div>
      <div className={c('step')}>
        <span className={e.equivalent ? c('verdict') : `${c('verdict')} ${c('verdict-bad')}`}>
          {e.equivalent ? t('bool.equiv.yes') : t('bool.equiv.no')}
        </span>
      </div>
      {!e.equivalent && ce && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('bool.counter')}</div>
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  {variables.map((v) => (
                    <th key={v}>{v}</th>
                  ))}
                  <th>L</th>
                  <th>R</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {ce.inputs.map((b, i) => (
                    <td key={i}>{b}</td>
                  ))}
                  <td className={c('tt-out')}>{ce.left}</td>
                  <td className={c('tt-out')}>{ce.right}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function ParseBody({ x, t }: { x: BoolResultMap['parse']; t: TFn }) {
  const s = x.spec
  return (
    <div className={c('step')}>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.input')}</span>
        <Expr text={x.input} variables={s.variables} />
      </div>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.parse.vars')}</span>
        <span>{s.variables.join(' ') || t('bool.none')}</span>
      </div>
      <div className={c('line')}>
        <span className={c('line-label')}>{t('bool.parse.minterms')}</span>
        <span>{`Σm(${s.minterms.join(', ')})`}</span>
      </div>
      {s.dontCares.length > 0 && (
        <div className={c('line')}>
          <span className={c('line-label')}>{t('bool.parse.dontcares')}</span>
          <span>{`d(${s.dontCares.join(', ')})`}</span>
        </div>
      )}
    </div>
  )
}
