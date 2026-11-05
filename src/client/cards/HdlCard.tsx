// dlogic_hdl 卡片：Verilog 源码（等宽，标出问题行）、静态检查列表、仿真输出与波形。
// 无 iverilog 时检查降级、仿真不可用，卡片给出降级提示。
import type { ReactNode } from 'react'
import {
  formatSimTime,
  simDisplayUnit,
  simFinishLabel,
  simTimeValue,
  toWaveSignals,
  type HdlResult,
  type HdlSeverity,
  type LintResult,
  type RuleHit,
  type SimulateResult,
} from '../../shared/hdl.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'
import { Waveform } from './Waveform.tsx'

const TOOL = 'dlogic_hdl'

export function HdlCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('hdl.title')} text={t('hdl.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op'])
    return <MutedRow tool={TOOL} title={t('hdl.title')} text={`${t('hdl.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const args = parseArgs(argsRawOf(block))
  const value = readMeta<HdlResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('hdl.title')} summary={firstArgText(args, ['op'])} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('hdl.title')} text={`${t('hdl.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const title = op === 'simulate' ? t('hdl.op.simulate') : t('hdl.op.lint')
  const code = typeof args.code === 'string' ? args.code : null
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card tool={TOOL} title={title} summary={<Boundary fallback={null}>{summaryOf(op, value.result, t)}</Boundary>}>
      <Boundary fallback={fallback}>
        <div>
          {code !== null && <CodeView code={code} marks={marksOf(op, value.result)} t={t} />}
          {op === 'simulate' ? (
            <SimBody r={value.result as SimulateResult} t={t} />
          ) : (
            <LintBody r={value.result as LintResult} t={t} />
          )}
          {value.warnings.length > 0 && (
            <div className={c('step')}>
              {value.warnings.map((w, i) => (
                <div key={i} className={c('muted')}>
                  {t('hdl.warn')}：{w}
                </div>
              ))}
            </div>
          )}
        </div>
      </Boundary>
    </Card>
  )
}

function summaryOf(op: string, result: HdlResult | null, t: TFn): ReactNode {
  if (result === null) return ''
  if (op === 'simulate') {
    const r = result as SimulateResult
    const label = simFinishLabel(r)
    return label !== null ? fmt(t, 'hdl.summary.sim', { top: r.top, t: label }) : fmt(t, 'hdl.summary.simNoFinish', { top: r.top })
  }
  const r = result as LintResult
  if (r.engine === 'rules') return t('hdl.summary.rules')
  const e = r.issues.filter(i => i.severity === 'error').length
  const w = r.issues.filter(i => i.severity === 'warning').length
  return fmt(t, 'hdl.summary.lint', { e, w, r: r.ruleHits.length })
}

/** 行号到问题级别的映射，用于在源码中标色。 */
function marksOf(op: string, result: HdlResult | null): Map<number, HdlSeverity> {
  const marks = new Map<number, HdlSeverity>()
  if (op !== 'lint' || result === null) return marks
  const r = result as LintResult
  const add = (line: number | null, sev: HdlSeverity) => {
    if (line === null) return
    const prev = marks.get(line)
    if (prev === undefined || rank(sev) > rank(prev)) marks.set(line, sev)
  }
  for (const i of r.issues) add(i.line, i.severity)
  for (const h of r.ruleHits) add(h.line, h.severity)
  return marks
}

function rank(s: HdlSeverity): number {
  return s === 'error' ? 2 : s === 'warning' ? 1 : 0
}

function CodeView({ code, marks, t }: { code: string; marks: Map<number, HdlSeverity>; t: TFn }) {
  const lines = code.split(/\r?\n/)
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>{t('hdl.code')}</div>
      <div className={c('code')}>
        {lines.map((ln, i) => {
          const sev = marks.get(i + 1)
          const cls = sev === 'error' ? ` ${c('code-error')}` : sev === 'warning' ? ` ${c('code-warning')}` : ''
          return (
            <div key={i} className={`${c('code-line')}${cls}`}>
              <span className={c('code-no')}>{i + 1}</span>
              <span>{ln === '' ? ' ' : ln}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className={c('line')}>
      <span className={c('line-label')}>{label}</span>
      <span>{children}</span>
    </div>
  )
}

function sevLabel(s: HdlSeverity, t: TFn): string {
  return s === 'error' ? t('hdl.sev.error') : s === 'warning' ? t('hdl.sev.warning') : t('hdl.sev.info')
}

function sevClass(s: HdlSeverity): string {
  return s === 'error' ? c('bad') : c('muted')
}

export function LintBody({ r, t }: { r: LintResult; t: TFn }) {
  const issues = [...r.issues].sort((a, b) => rank(b.severity) - rank(a.severity))
  const hits: RuleHit[] = r.ruleHits
  return (
    <div>
      <div className={c('step')}>
        {r.engine === 'iverilog' ? (
          <Row label={t('hdl.engine')}>{`iverilog ${r.iverilogVersion ?? ''}`.trim()}</Row>
        ) : (
          <Row label={t('hdl.engine')}>{t('hdl.summary.rules')}</Row>
        )}
        {r.notice && <div className={c('muted')}>{r.notice}</div>}
      </div>
      {issues.length === 0 && hits.length === 0 && r.engine === 'iverilog' && (
        <div className={c('step')}>
          <span className={c('ok')}>{t('hdl.lint.none')}</span>
        </div>
      )}
      {issues.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('hdl.lint.issues')}</div>
          <ul className={c('list')}>
            {issues.map((i, k) => (
              <li key={k}>
                <span className={c('id')}>{i.line === null ? '' : fmt(t, 'hdl.line', { n: i.line })}</span>
                <span className={sevClass(i.severity)}>{sevLabel(i.severity, t)}</span>
                <span>{i.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hits.length > 0 && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('hdl.lint.rules')}</div>
          <ul className={c('list')}>
            {hits.map((h, k) => (
              <li key={k}>
                <span className={c('id')}>{fmt(t, 'hdl.line', { n: h.line })}</span>
                <span className={sevClass(h.severity)}>{t(`hdl.rule.${h.rule}`)}</span>
                <span>{h.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function SimBody({ r, t }: { r: SimulateResult; t: TFn }) {
  const displayUnit = simDisplayUnit(r)
  const unit = displayUnit ?? ''
  const wave = toWaveSignals(r.signals)
  const times = wave.times.map(x => simTimeValue(x, r.tickUnit, displayUnit))
  const endLabel =
    simFinishLabel(r) ?? (r.end === 'timeout' ? formatSimTime(r.maxTimeUnits, displayUnit, displayUnit) : null)
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('hdl.sim.timescale')}>{r.timescale ?? t('hdl.sim.noTimescale')}</Row>
        <Row label={t('hdl.sim.endTime')}>{endLabel ?? t('hdl.sim.noEndTime')}</Row>
        <Row label={t('hdl.sim.end')}>{t(`hdl.end.${r.end}`)}</Row>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('hdl.sim.output')}</div>
        {r.output.length > 0 ? <div className={c('mono')}>{r.output.join('\n')}</div> : <div className={c('muted')}>{t('hdl.sim.noOutput')}</div>}
        {r.outputTruncated && <div className={c('muted')}>{t('hdl.end.output_limit')}</div>}
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('hdl.sim.wave')}</div>
        {r.signals.length === 0 ? (
          <div className={c('muted')}>{t('hdl.sim.noVcd')}</div>
        ) : wave.signals.length === 0 ? (
          <div className={c('muted')}>{t('hdl.sim.noWave')}</div>
        ) : (
          <Waveform signals={wave.signals} steps={wave.steps} times={times} unit={unit} scrollable />
        )}
        {wave.truncated && (
          <div className={c('muted')}>{fmt(t, 'hdl.sim.waveTruncated', { n: wave.total, cols: wave.steps })}</div>
        )}
      </div>
    </div>
  )
}
