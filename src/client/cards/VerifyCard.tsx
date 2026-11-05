// dlogic_verify 工具卡片：等价性、最简性、反例、代价；参考答案只在工具给出时显示。
import type { VerifyResult } from '../../shared/contracts.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_verify'

function Verdict({ ok, text }: { ok: boolean | null; text: string }) {
  const cls = ok === false ? `${c('verdict')} ${c('verdict-bad')}` : c('verdict')
  return <span className={cls}>{text}</span>
}

export function VerifyCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('verify.title')} text={t('verify.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['candidate', 'expression', 'expr'])
    return <MutedRow tool={TOOL} title={t('verify.title')} text={`${t('verify.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<VerifyResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('verify.title')} summary="" isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('verify.title')} text={`${t('verify.failed')}：${value.error ?? ''}`} isError />
  }
  const v = value.result as VerifyResult
  const eqText = v.equivalent ? t('verify.equivalent') : t('verify.notEquivalent')
  const minimalText =
    v.minimal === undefined ? '' : v.minimal === true ? t('verify.minimal') : v.minimal === false ? t('verify.notMinimal') : t('verify.unknown')
  const summary = (
    <Boundary fallback={null}>
      <>
        {eqText}
        {minimalText ? ' · ' + minimalText : ''}
      </>
    </Boundary>
  )
  return (
    <Card tool={TOOL} title={t('verify.title')} summary={summary} isError={false}>
      <Boundary fallback={<TextBody text={resultText(block)} />}>
        <VerifyBody v={v} t={t} />
      </Boundary>
    </Card>
  )
}

function VerifyBody({ v, t }: { v: VerifyResult; t: TFn }) {
  const variables = v.variables ?? []
  const ce = v.counterexample
  return (
    <div>
      <div className={c('step')}>
        <div className={c('chips')}>
          <Verdict ok={v.equivalent} text={v.equivalent ? t('verify.equivalent') : t('verify.notEquivalent')} />
          {v.minimal !== undefined && (
            <Verdict
              ok={v.minimal === null ? null : v.minimal}
              text={v.minimal === true ? t('verify.minimal') : v.minimal === false ? t('verify.notMinimal') : t('verify.unknown')}
            />
          )}
        </div>
      </div>

      {!v.equivalent && ce && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('verify.counter')}</div>
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  {variables.map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                  <th>{t('verify.leftOut')}</th>
                  <th>{t('verify.rightOut')}</th>
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

      {(v.candidateCost || v.minimalCost) && (
        <div className={c('step')}>
          {v.candidateCost && (
            <div className={c('line')}>
              <span className={c('line-label')}>{t('verify.candidate')}</span>
              <span>{fmt(t, 'verify.cost', { terms: v.candidateCost.terms, literals: v.candidateCost.literals })}</span>
            </div>
          )}
          {v.minimalCost && (
            <div className={c('line')}>
              <span className={c('line-label')}>{t('verify.minimalCost')}</span>
              <span>{fmt(t, 'verify.cost', { terms: v.minimalCost.terms, literals: v.minimalCost.literals })}</span>
            </div>
          )}
        </div>
      )}

      {v.reference && Array.isArray(v.reference.texts) && v.reference.texts.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('verify.reference')}</div>
          {v.reference.texts.map((s, i) => (
            <div key={i} className={c('line')}>
              <Expr text={s} variables={variables} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
