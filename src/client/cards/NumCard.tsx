// dlogic_num 工具卡片（toolview）。
import { useState, type ReactNode } from 'react'
import type { Envelope } from '../../shared/contracts.ts'
import type { ConvertResult, NumStep } from '../../solvers/num.ts'
import { c } from '../styles.ts'
import { fmt, type TFn } from '../locale.ts'

export type NumResult = Omit<ConvertResult, 'steps'>
type NumValue = Envelope<NumResult>

/** 工具调用块：运行中只有 argsRaw；结束后带 call、content、meta 等。 */
interface ToolBlock {
  kind?: string
  content?: { type: string; text?: string }[]
  meta?: unknown
  isError?: boolean
  argsRaw?: string
  call?: { argsRaw?: string }
}

interface NumCardProps {
  t: TFn
  phase?: string
  block: ToolBlock
}

/** 从持久化 meta 中取出工具返回值；格式不符时返回 null，走文本回退。 */
function readNumValue(block: ToolBlock): NumValue | null {
  const meta = block.meta
  if (typeof meta !== 'object' || meta === null) return null
  const m = meta as { tool?: unknown; v?: unknown; value?: unknown }
  if (m.tool !== 'dlogic_num' || m.v !== 1) return null
  const value = m.value
  if (typeof value !== 'object' || value === null || typeof (value as { ok?: unknown }).ok !== 'boolean') return null
  return value as NumValue
}

function resultText(block: ToolBlock): string {
  const parts: string[] = []
  for (const item of block.content ?? []) parts.push(item.type === 'text' ? (item.text ?? '') : JSON.stringify(item))
  return parts.join('\n')
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw ?? '')
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function Num({ value, base }: { value: string | number; base: number }) {
  return (
    <>
      ({value})<sub>{base}</sub>
    </>
  )
}

function Step({ step, to }: { step: NumStep; to: number }) {
  let body: ReactNode = null
  if (step.kind === 'weighted-expansion') {
    body = <div className={c('mono')}>{`${(step.terms ?? []).join(' + ') || '0'} = ${step.result}`}</div>
  } else if (step.kind === 'expand-bits') {
    body = <div className={c('mono')}>{step.binary}</div>
  } else if (step.kind === 'group-bits') {
    const groups = [...(step.intGroups ?? []), ...((step.fracGroups ?? []).length ? ['.'] : []), ...(step.fracGroups ?? [])]
    body = (
      <div className={c('groups')}>
        {groups.map((g, i) =>
          g === '.' ? <span key={i}>.</span> : <span key={i} className={c('group')}>{g}</span>,
        )}
      </div>
    )
  } else if (step.kind === 'int-division') {
    body = (
      <table className={c('table')}>
        <tbody>
          {(step.rows ?? []).map((row, i) => (
            <tr key={i}>
              <td>{`${row.dividend} ÷ ${to}`}</td>
              <td>{`= ${row.quotient}`}</td>
              <td>余</td>
              <td className={c('digit')}>{row.digit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  } else if (step.kind === 'frac-multiplication') {
    body = (
      <table className={c('table')}>
        <tbody>
          {(step.rows ?? []).map((row, i) => (
            <tr key={i}>
              <td>{`${row.value} × ${to}`}</td>
              <td>{`= ${row.product}`}</td>
              <td>取整</td>
              <td className={c('digit')}>{row.digit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  return (
    <div className={c('step')}>
      <div className={c('step-text')}>{step.text}</div>
      {body}
    </div>
  )
}

/** 换算主体：算式、十进制值与逐步过程；卡片展开体与图示区共用。withHead 为 false 时不显示顶部算式行。 */
export function NumBody({ r, steps, t, withHead = true }: { r: NumResult; steps: NumStep[]; t: TFn; withHead?: boolean }) {
  return (
    <>
      {withHead && (
        <div className={c('head')}>
          <Num value={r.input.value} base={r.input.from} /> = <Num value={r.result} base={r.input.to} />
        </div>
      )}
      <div className={c('meta')}>
        {[fmt(t, 'num.decimal', { value: r.decimal }), r.exact ? '' : `，${fmt(t, 'num.inexact', { precision: r.input.precision })}`].join('')}
      </div>
      {steps.map((step, i) => (
        <Step key={i} step={step} to={r.input.to} />
      ))}
    </>
  )
}

export function NumCard(props: NumCardProps) {
  const { t } = props
  const [open, setOpen] = useState(true)
  if (props.phase === 'preparing') {
    return (
      <div className={c('card')} data-tool="dlogic_num">
        <div className={c('row')} data-static="">
          <span className={c('title')}>{t('num.preparing')}</span>
        </div>
      </div>
    )
  }
  const block = props.block
  const settled = 'kind' in block
  const args = parseArgs(settled ? block.call?.argsRaw : block.argsRaw)
  const head = args.value !== undefined ? `${args.value} (${args.from} → ${args.to})` : ''
  if (!settled) {
    return (
      <div className={c('card')} data-tool="dlogic_num">
        <div className={c('row')} data-static="">
          <span className={c('title')}>{t('num.title')}</span>
          <span className={c('dot')} />
          <span className={c('summary')}>{`${t('num.running')} ${head}`}</span>
        </div>
      </div>
    )
  }
  const value = readNumValue(block)
  if (value === null || block.isError) {
    // 回退：显示纯文本结果。
    return (
      <div className={c('card')} data-tool="dlogic_num">
        <div className={c('row')} onClick={() => setOpen(v => !v)}>
          <span className={c('title')}>{t('num.title')}</span>
          <span className={c('dot')} />
          <span className={`${c('summary')} ${block.isError ? c('error') : ''}`}>{head}</span>
        </div>
        {open && (
          <div className={c('body')}>
            <div className={c('step')}>
              <div className={c('mono')}>{resultText(block)}</div>
            </div>
          </div>
        )}
      </div>
    )
  }
  if (!value.ok) {
    return (
      <div className={c('card')} data-tool="dlogic_num">
        <div className={c('row')} data-static="">
          <span className={c('title')}>{t('num.title')}</span>
          <span className={c('dot')} />
          <span className={`${c('summary')} ${c('error')}`}>{`${t('num.failed')}：${value.error}`}</span>
        </div>
      </div>
    )
  }
  const r = value.result as NumResult
  const steps = (value.steps ?? []) as NumStep[]
  return (
    <div className={c('card')} data-tool="dlogic_num">
      <div className={c('row')} onClick={() => setOpen(v => !v)}>
        <span className={c('title')}>{t('num.title')}</span>
        <span className={c('dot')} />
        <span className={c('summary')}>
          <Num value={r.input.value} base={r.input.from} /> = <Num value={r.result} base={r.input.to} />
        </span>
      </div>
      {open && (
        <div className={c('body')}>
          <NumBody r={r} steps={steps} t={t} />
        </div>
      )}
    </div>
  )
}
