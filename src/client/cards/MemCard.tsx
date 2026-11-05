// dlogic_mem 工具卡片：存储器扩展表（芯片、片选、地址映射）、ROM 地址表与点阵、PLA / PAL 点阵、LUT 掩码。
import type { ReactNode } from 'react'
import type { ExpandResult, LutResult, PlaResult, RomResult } from '../../shared/mem.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { Expr } from '../logic.tsx'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_mem'
const KNOWN_OPS: string[] = ['expand', 'rom_func', 'pla', 'pal', 'lut']
const ROW_LIMIT = 64

type MemValue = ExpandResult | RomResult | PlaResult | LutResult

function opTitle(op: string, t: TFn): string {
  return KNOWN_OPS.includes(op) ? t(`mem.op.${op}`) : t('mem.title')
}

export function MemCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('mem.title')} text={t('mem.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['op'])
    return <MutedRow tool={TOOL} title={t('mem.title')} text={`${t('mem.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<MemValue>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('mem.title')} summary={firstArgText(parseArgs(argsRawOf(block)), ['op'])} isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('mem.title')} text={`${t('mem.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const r = value.result as MemValue
  const fallback = <TextBody text={resultText(block)} />
  return (
    <Card
      tool={TOOL}
      title={opTitle(op, t)}
      summary={<Boundary fallback={null}>{summaryOf(op, r, t)}</Boundary>}
    >
      <Boundary fallback={fallback}>
        <div>
          <MemBody op={op} r={r} t={t} />
          {value.warnings.length > 0 && (
            <div className={c('step')}>
              {value.warnings.map((w, i) => (
                <div key={i} className={c('muted')}>
                  {t('mem.warn')}：{w}
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
export function MemBody({ op, r, t }: { op: string; r: MemValue; t: TFn }) {
  switch (op) {
    case 'expand':
      return <ExpandBody r={r as ExpandResult} t={t} />
    case 'rom_func':
      return <RomBody r={r as RomResult} t={t} />
    case 'pla':
    case 'pal':
      return <PlaBody r={r as PlaResult} t={t} />
    case 'lut':
      return <LutBody r={r as LutResult} t={t} />
    default:
      return null
  }
}

/** 卡片标题行的摘要。 */
function summaryOf(op: string, r: MemValue, t: TFn): ReactNode {
  if (op === 'expand') {
    const e = r as ExpandResult
    return `${fmt(t, 'mem.chips', { n: e.chipCount })} · ${t(`mem.mode.${e.mode}`)}`
  }
  if (op === 'rom_func') {
    const rom = r as RomResult
    return `${rom.size.words}×${rom.size.bits}`
  }
  if (op === 'pla' || op === 'pal') {
    const p = r as PlaResult
    return fmt(t, 'mem.terms', { n: p.cost.terms })
  }
  const l = r as LutResult
  return l.kind === 'single' ? `${l.hex}H` : t('mem.lut.split')
}

// ───────────────────────── 小部件 ─────────────────────────

function Title({ text }: { text: string }) {
  return <div className={c('step-text')}>{text}</div>
}

function Tbl({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className={c('tt-wrap')}>
      <table className={c('tt')}>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 点阵图：有点处为实心圆，行、列标签在边上。 */
function DotGrid({ rowLabels, colLabels, dots }: { rowLabels: string[]; colLabels: string[]; dots: boolean[][] }) {
  const cw = 26
  const rh = 22
  const lx = 72
  const ty = 36
  const w = lx + colLabels.length * cw + 12
  const h = ty + rowLabels.length * rh + 8
  const bottom = ty + rowLabels.length * rh
  const right = lx + colLabels.length * cw
  return (
    <div className={c('tt-wrap')}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ maxWidth: '100%', height: 'auto' }} role="img">
        {colLabels.map((l, j) => (
          <text key={`c${j}`} x={lx + j * cw + cw / 2} y={ty - 10} textAnchor="middle" fontSize={12} fill="currentColor">
            {l}
          </text>
        ))}
        {rowLabels.map((l, i) => (
          <text key={`r${i}`} x={lx - 10} y={ty + i * rh + rh / 2 + 4} textAnchor="end" fontSize={12} fill="currentColor">
            {l}
          </text>
        ))}
        {colLabels.map((_, j) => (
          <line
            key={`vl${j}`}
            x1={lx + j * cw + cw / 2}
            x2={lx + j * cw + cw / 2}
            y1={ty}
            y2={bottom}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
        ))}
        {rowLabels.map((_, i) => (
          <line
            key={`hl${i}`}
            x1={lx}
            x2={right}
            y1={ty + i * rh + rh / 2}
            y2={ty + i * rh + rh / 2}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
        ))}
        {dots.map((row, i) =>
          row.map((on, j) =>
            on ? (
              <circle key={`d${i}-${j}`} cx={lx + j * cw + cw / 2} cy={ty + i * rh + rh / 2} r={4.5} fill="currentColor" />
            ) : null,
          ),
        )}
      </svg>
    </div>
  )
}

/** 16 位掩码每 4 位空一格，便于读数。 */
function groupMask(mask: string): string {
  return mask.match(/.{1,4}/g)?.join(' ') ?? mask
}

// ───────────────────────── expand ─────────────────────────

function ExpandBody({ r, t }: { r: ExpandResult; t: TFn }) {
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('mem.exp.target')}</span>
          <span>
            {r.target.words}×{r.target.bits}（{fmt(t, 'mem.exp.capacity', { n: r.target.capacity })}）
          </span>
          <span className={c('line-label')}>{t('mem.exp.chip')}</span>
          <span>
            {r.chip.words}×{r.chip.bits}
          </span>
        </div>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('mem.exp.count')}</span>
          <span>{fmt(t, 'mem.exp.countVal', { total: r.chipCount, w: r.wordGroups, b: r.bitGroups })}</span>
        </div>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('mem.exp.addr')}</span>
          <span>{r.chipAddressLines.join('、')}</span>
          {r.selectLines.length > 0 && (
            <span>
              {t('mem.exp.select')}：{r.selectLines.join('、')}
            </span>
          )}
        </div>
      </div>

      {r.decoder && (
        <div className={c('step')}>
          <Title text={t('mem.exp.decoder')} />
          <Tbl
            head={[t('mem.wiring.pin'), t('mem.wiring.signal'), t('mem.wiring.note')]}
            rows={r.decoder.wiring.map(w => [w.pin, w.signal, w.note ?? ''])}
          />
        </div>
      )}

      <div className={c('step')}>
        <Title text={t('mem.exp.chips')} />
        <Tbl
          head={[t('mem.exp.col.chip'), t('mem.exp.col.group'), t('mem.exp.col.data'), t('mem.exp.col.select')]}
          rows={r.chips.map(ch => [
            String(ch.index),
            String(ch.wordGroup),
            ch.dataLow === ch.dataHigh ? `D${ch.dataLow}` : `D${ch.dataHigh}～D${ch.dataLow}`,
            ch.select,
          ])}
        />
      </div>

      <div className={c('step')}>
        <Title text={t('mem.exp.map')} />
        <Tbl
          head={[t('mem.exp.col.group'), t('mem.exp.col.chips'), t('mem.exp.col.range')]}
          rows={r.addressMap.map(a => [String(a.wordGroup), a.chips.join('、'), `${a.lowHex}～${a.highHex}`])}
        />
      </div>

      {r.decode && (
        <div className={c('step')}>
          <Title text={t('mem.exp.decode')} />
          <div className={c('step-text')}>{r.decode.note}</div>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('mem.exp.decodeLines')}</span>
            <span>
              {r.decode.decoderLines}
              {r.decode.mode === 'double' ? `（${r.decode.rows} + ${r.decode.cols}）` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── rom_func ─────────────────────────

function RomBody({ r, t }: { r: RomResult; t: TFn }) {
  const rows = r.rows.slice(0, ROW_LIMIT)
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('mem.rom.size')}</span>
          <span>
            {r.size.words}×{r.size.bits}（{fmt(t, 'mem.exp.capacity', { n: r.size.capacity })}）
          </span>
        </div>
        {r.functions.map(f => (
          <div key={f.name} className={c('line')}>
            <span className={c('mono')}>{f.text}</span>
          </div>
        ))}
      </div>

      <div className={c('step')}>
        <Title text={t('mem.rom.table')} />
        <Tbl
          head={[t('mem.rom.col.addr'), t('mem.rom.col.bits'), ...r.outputNames, t('mem.rom.col.hex')]}
          rows={rows.map(row => [
            String(row.address),
            row.addressBits,
            ...row.data.map(d => String(d)),
            `${row.hex}H`,
          ])}
        />
        {r.rows.length > ROW_LIMIT && <div className={c('muted')}>{fmt(t, 'mem.rom.more', { n: r.rows.length })}</div>}
      </div>

      <div className={c('step')}>
        <Title text={t('mem.rom.matrix')} />
        <DotGrid
          rowLabels={rows.map(row => row.addressBits)}
          colLabels={r.outputNames}
          dots={rows.map(row => row.data.map(d => d === 1))}
        />
      </div>
    </div>
  )
}

// ───────────────────────── pla / pal ─────────────────────────

function PlaBody({ r, t }: { r: PlaResult; t: TFn }) {
  const outNames = r.outputs.map(o => o.name)
  return (
    <div>
      <div className={c('step')}>
        <div className={c('line')}>
          <span className={c('line-label')}>{t(r.kind === 'pla' ? 'mem.pla.kind' : 'mem.pal.kind')}</span>
          <span>{fmt(t, 'mem.pla.cost', { terms: r.cost.terms, literals: r.cost.literals })}</span>
          {r.termsPerOutput !== null ? (
            <span className={c('muted')}>{fmt(t, 'mem.pal.fixed', { k: r.termsPerOutput })}</span>
          ) : (
            <span className={c('muted')}>{fmt(t, 'mem.pla.share', { sep: r.separateTerms, n: r.cost.terms })}</span>
          )}
        </div>
      </div>

      <div className={c('step')}>
        <Title text={t('mem.pla.outputs')} />
        {r.outputs.map(o => (
          <div key={o.name} className={c('line')}>
            <span>{o.name} = </span>
            <Expr text={o.text} variables={r.variables} />
            {o.overflow && <span className={c('muted')}>{t('mem.pal.overflow')}</span>}
          </div>
        ))}
      </div>

      <div className={c('step')}>
        <Title text={t('mem.pla.terms')} />
        <Tbl
          head={[t('mem.pla.col.term'), t('mem.pla.col.expr'), t('mem.pla.col.used')]}
          rows={r.terms.map(p => [p.label, <Expr key="e" text={p.text} variables={r.variables} />, p.usedBy.join('、')])}
        />
      </div>

      <div className={c('step')}>
        <Title text={t('mem.pla.and')} />
        <DotGrid rowLabels={r.terms.map(p => p.label)} colLabels={r.andColumns} dots={r.andDots} />
      </div>

      <div className={c('step')}>
        <Title text={t('mem.pla.or')} />
        <DotGrid rowLabels={r.terms.map(p => p.label)} colLabels={outNames} dots={r.orDots} />
      </div>
    </div>
  )
}

// ───────────────────────── lut ─────────────────────────

function LutBody({ r, t }: { r: LutResult; t: TFn }) {
  if (r.kind === 'single') {
    return (
      <div>
        <div className={c('step')}>
          <div className={c('line')}>
            <span className={c('line-label')}>{t('mem.lut.mask')}</span>
            <span className={c('mono')}>{groupMask(r.mask)}</span>
            <span className={c('line-label')}>{t('mem.lut.hex')}</span>
            <span className={c('mono')}>{r.hex}H</span>
          </div>
          <div className={c('step-text')}>{r.functionText}</div>
        </div>

        <div className={c('step')}>
          <Title text={t('mem.lut.pins')} />
          <Tbl
            head={[t('mem.wiring.pin'), t('mem.wiring.signal'), t('mem.wiring.note')]}
            rows={r.pins.map(p => [p.pin, p.signal, p.note ?? ''])}
          />
        </div>

        <div className={c('step')}>
          <Title text={t('mem.lut.table')} />
          <Tbl
            head={[t('mem.lut.col.addr'), t('mem.lut.col.bits'), t('mem.lut.col.value')]}
            rows={r.rows.map(row => [String(row.address), row.addressBits || '—', String(row.value)])}
          />
        </div>
      </div>
    )
  }
  return (
    <div>
      <div className={c('step')}>
        <div className={c('step-text')}>{r.functionText}</div>
        <div className={c('line')}>
          <span className={c('line-label')}>{t('mem.lut.split')}</span>
          <span>{fmt(t, 'mem.lut.splitVars', { s: r.splitVars.join('、'), l: r.lutVars.join('、') })}</span>
        </div>
      </div>

      <div className={c('step')}>
        <Title text={t('mem.lut.pins')} />
        <Tbl
          head={[t('mem.wiring.pin'), t('mem.wiring.signal'), t('mem.wiring.note')]}
          rows={r.pins.map(p => [p.pin, p.signal, p.note ?? ''])}
        />
      </div>

      <div className={c('step')}>
        <Title text={t('mem.lut.cofactors')} />
        <Tbl
          head={[t('mem.lut.col.assign'), t('mem.lut.col.mask'), t('mem.lut.col.hex')]}
          rows={r.cofactors.map(cf => [cf.assignment, <span key="m" className={c('mono')}>{groupMask(cf.mask)}</span>, `${cf.hex}H`])}
        />
      </div>
    </div>
  )
}
