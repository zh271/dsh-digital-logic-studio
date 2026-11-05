// dlogic_adda 卡片：D/A 公式与支路、逐次逼近过程表、并行比较表、双积分参数、量化与采样。公式用普通文本。
import type { ReactNode } from 'react'
import type {
  AddaResult,
  DacResult,
  DualSlopeResult,
  FlashResult,
  QuantizeResult,
  SarResult,
} from '../../shared/adda.ts'
import { fmtNum, fmtTime } from '../../shared/adda.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_adda'
const KNOWN_OPS: string[] = ['dac', 'adc_sar', 'adc_flash', 'adc_dual', 'quantize']

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`adda.op.${op}`) : t('adda.title')
}

export function AddaCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('adda.title')} text={t('adda.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op', 'bits'])
    return <MutedRow tool={TOOL} title={t('adda.title')} text={`${t('adda.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<AddaResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('adda.title')} summary={firstArgText(parseArgs(argsRawOf(block)), ['op'])} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('adda.title')} text={`${t('adda.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as AddaResult
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card
      tool={TOOL}
      title={opTitle(op, t)}
      summary={<Boundary fallback={null}>{summaryOf(op, r)}</Boundary>}
    >
      <Boundary fallback={fallback}>
        <div>
          <AddaBody op={op} r={r} t={t} />
          {value.warnings.length > 0 && (
            <div className={c('step')}>
              {value.warnings.map((w, i) => (
                <div key={i} className={c('muted')}>
                  {t('adda.warn')}：{w}
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
export function AddaBody({ op, r, t }: { op: string; r: AddaResult; t: TFn }) {
  switch (op) {
    case 'dac':
      return <DacBody r={r as DacResult} t={t} />
    case 'adc_sar':
      return <SarBody r={r as SarResult} t={t} />
    case 'adc_flash':
      return <FlashBody r={r as FlashResult} t={t} />
    case 'adc_dual':
      return <DualBody r={r as DualSlopeResult} t={t} />
    case 'quantize':
      return <QuantBody r={r as QuantizeResult} t={t} />
    default:
      return null
  }
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: AddaResult): ReactNode {
  switch (op) {
    case 'dac': {
      const d = r as DacResult
      return `${d.typeName} · Vo = ${fmtNum(d.vout)} V`
    }
    case 'adc_sar': {
      const s = r as SarResult
      return `${s.codeBinary}（${s.code}）`
    }
    case 'adc_flash': {
      const f = r as FlashResult
      return `${f.codeBinary}（${f.code}）`
    }
    case 'adc_dual': {
      const d = r as DualSlopeResult
      return `T2 = ${fmtTime(d.t2)}，N2 = ${d.n2}`
    }
    case 'quantize': {
      const q = r as QuantizeResult
      return `Δ = ${fmtNum(q.delta)} V`
    }
    default:
      return ''
  }
}

// ───────────────────────── 小组件 ─────────────────────────

function Row({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className={c('line')}>
      <span className={c('line-label')}>{label}</span>
      <span>{children}</span>
    </div>
  )
}

function Notes({ items }: { items: string[] }) {
  return (
    <div className={c('step')}>
      {items.map((s, i) => (
        <div key={i} className={c('muted')}>
          {s}
        </div>
      ))}
    </div>
  )
}

function Derivation({ items, t }: { items: string[]; t: TFn }) {
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>{t('adda.derivation')}</div>
      <Notes items={items} />
    </div>
  )
}

// ───────────────────────── dac ─────────────────────────

function DacBody({ r, t }: { r: DacResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('adda.dac.type')}>{r.typeName}</Row>
        <Row label={t('adda.dac.input')}>{`${r.code}（${r.codeBinary}）`}</Row>
        <Row label={t('adda.dac.formula')}>{r.formula}</Row>
        <Row label={t('adda.dac.substituted')}>{r.substituted}</Row>
        <Row label={t('adda.dac.fraction')}>{r.fraction}</Row>
        {r.rfRatio !== null && <Row label={t('adda.dac.rf')}>{fmtNum(r.rfRatio)}</Row>}
        <Row label={t('adda.dac.lsb')}>{`${fmtNum(r.lsb)} V`}</Row>
        <Row label={t('adda.dac.fullScale')}>{`${fmtNum(r.fullScale)} V`}</Row>
        <Row label={t('adda.dac.output')}>{`${fmtNum(r.vout)} V`}</Row>
      </div>
      {r.branches && (
        <div className={c('step')}>
          <div className={c('step-text')}>{t('adda.dac.branches')}</div>
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  <th>{t('adda.dac.col.bit')}</th>
                  <th>{t('adda.dac.col.value')}</th>
                  <th>{t('adda.dac.col.resistor')}</th>
                </tr>
              </thead>
              <tbody>
                {r.branches.map(b => (
                  <tr key={b.bit}>
                    <td>{b.bit}</td>
                    <td className={c('tt-out')}>{b.value}</td>
                    <td>{b.resistor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Derivation items={r.derivation} t={t} />
    </div>
  )
}

// ───────────────────────── adc_sar ─────────────────────────

function SarBody({ r, t }: { r: SarResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('adda.common.vin')}>{`${fmtNum(r.vin)} V`}</Row>
        <Row label={t('adda.common.vref')}>{`${fmtNum(r.vref)} V`}</Row>
        <Row label={t('adda.common.delta')}>{`${fmtNum(r.delta)} V`}</Row>
      </div>
      <div className={c('step')}>
        <div className={c('step-text')}>{t('adda.sar.process')}</div>
        <div className={c('tt-wrap')}>
          <table className={c('tt')}>
            <thead>
              <tr>
                <th>{t('adda.sar.col.step')}</th>
                <th>{t('adda.sar.col.bit')}</th>
                <th>{t('adda.sar.col.trial')}</th>
                <th>{t('adda.sar.col.dac')}</th>
                <th>{t('adda.sar.col.compare')}</th>
                <th>{t('adda.sar.col.kept')}</th>
                <th>{t('adda.sar.col.partial')}</th>
              </tr>
            </thead>
            <tbody>
              {r.steps.map(s => (
                <tr key={s.step}>
                  <td>{s.step}</td>
                  <td>{`2^${s.bit}`}</td>
                  <td>{s.trialBinary}</td>
                  <td>{fmtNum(s.dacVoltage)}</td>
                  <td>{s.geq ? t('adda.sar.geq') : t('adda.sar.lt')}</td>
                  <td className={c('tt-out')}>{s.geq ? t('adda.sar.keep') : t('adda.sar.clear')}</td>
                  <td>{s.partialBinary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={c('step')}>
        <Row label={t('adda.common.result')}>{fmt(t, 'adda.sar.final', { code: `${r.codeBinary}（${r.code}）` })}</Row>
        <Row label={t('adda.common.quantized')}>{`${fmtNum(r.quantized)} V`}</Row>
        <Row label={t('adda.common.error')}>{`${fmtNum(r.error)} V`}</Row>
        <Row label={t('adda.common.errorRange')}>{'0 ≤ e < Δ'}</Row>
      </div>
    </div>
  )
}

// ───────────────────────── adc_flash ─────────────────────────

function FlashBody({ r, t }: { r: FlashResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('adda.common.mode')}>{r.mode === 'truncate' ? t('adda.common.truncate') : t('adda.common.round')}</Row>
        <Row label={t('adda.common.vin')}>{`${fmtNum(r.vin)} V`}</Row>
        <Row label={t('adda.common.delta')}>{`${fmtNum(r.delta)} V`}</Row>
        <Row label={t('adda.flash.refs')}>{r.refFormula}</Row>
        <Row label={t('adda.flash.count')}>{fmt(t, 'adda.flash.countValue', { n: r.comparatorCount })}</Row>
      </div>
      {r.comparators.length > 0 ? (
        <div className={c('step')}>
          <div className={c('tt-wrap')}>
            <table className={c('tt')}>
              <thead>
                <tr>
                  <th>{t('adda.flash.col.index')}</th>
                  <th>{t('adda.flash.col.ref')}</th>
                  <th>{t('adda.flash.col.out')}</th>
                </tr>
              </thead>
              <tbody>
                {r.comparators.map(k => (
                  <tr key={k.index}>
                    <td>{k.index}</td>
                    <td>{`${fmtNum(k.ref)} V`}</td>
                    <td className={c('tt-out')}>{k.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={c('step')}>
          <div className={c('muted')}>{t('adda.flash.omitted')}</div>
        </div>
      )}
      <div className={c('step')}>
        {r.thermometer !== null && <Row label={t('adda.flash.thermo')}>{r.thermometer}</Row>}
        <Row label={t('adda.common.result')}>{fmt(t, 'adda.flash.code', { code: `${r.codeBinary}（${r.code}）` })}</Row>
        <Row label={t('adda.common.quantized')}>{`${fmtNum(r.quantized)} V`}</Row>
        <Row label={t('adda.common.error')}>{`${fmtNum(r.error)} V`}</Row>
      </div>
    </div>
  )
}

// ───────────────────────── adc_dual ─────────────────────────

function DualBody({ r, t }: { r: DualSlopeResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('adda.dual.t1')}>{`${fmtTime(r.t1)}（N1 = ${r.n1}）`}</Row>
        <Row label={t('adda.dual.t2')}>{fmtTime(r.t2)}</Row>
        <Row label={t('adda.dual.n2')}>{String(r.n2)}</Row>
        <Row label={t('adda.dual.tmax')}>{fmtTime(r.convMax)}</Row>
        <Row label={t('adda.dual.res')}>{`${fmtNum(r.resolution)} V`}</Row>
        <Row label={t('adda.dual.mains')}>
          {`${fmtNum(r.mainsPeriods)}（${r.mainsHz} Hz）`}
          <span className={c('muted')}>{' '}{r.mainsMultiple ? t('adda.dual.mainsOk') : t('adda.dual.mainsNo')}</span>
        </Row>
      </div>
      <Derivation items={r.derivation} t={t} />
    </div>
  )
}

// ───────────────────────── quantize ─────────────────────────

function QuantBody({ r, t }: { r: QuantizeResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <Row label={t('adda.quant.levels')}>{fmt(t, 'adda.quant.levelsValue', { n: r.levels })}</Row>
        <Row label={t('adda.common.delta')}>{`${r.deltaFormula} = ${fmtNum(r.delta)} V`}</Row>
        <Row label={t('adda.common.errorRange')}>
          {r.mode === 'truncate' ? t('adda.quant.rangeTruncate') : t('adda.quant.rangeRound')}
        </Row>
        {r.vin !== null && r.codeBinary !== null && r.quantized !== null && r.error !== null && (
          <Row label={t('adda.common.result')}>
            {fmt(t, 'adda.quant.result', { v: fmtNum(r.vin), code: `${r.codeBinary}（${r.code}）` })}
            {`，${fmtNum(r.quantized)} V，e = ${fmtNum(r.error)} V`}
          </Row>
        )}
      </div>
      {r.minBits && (
        <div className={c('step')}>
          <Row label={t('adda.quant.minBits')}>
            {r.minBits.bits === null
              ? fmt(t, 'adda.quant.minBitsNone', { n: 16, e: fmtNum(r.minBits.maxError) })
              : fmt(t, 'adda.quant.minBitsValue', { e: fmtNum(r.minBits.maxError), n: r.minBits.bits })}
          </Row>
        </div>
      )}
      {r.sampling && (
        <div className={c('step')}>
          <Row label={t('adda.quant.sampling')}>{r.sampling.verdict}</Row>
          <Row label={t('adda.quant.minFs')}>{`${fmtNum(r.sampling.minFs)} Hz`}</Row>
        </div>
      )}
      <Derivation items={r.derivation} t={t} />
    </div>
  )
}
