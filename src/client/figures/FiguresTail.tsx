// 回答下方的图示区：本轮的图（卡诺图、真值表、化简结果、进制转换等）、验证结论与“继续追问”芯片。
// 挂在 conversation.chat.turnTail 槽位上；出错或无内容时不渲染任何东西。
import { useState } from 'react'
import { TREE_PROJECTION_KEY, type BoolOp, type BoolResultMap, type CardRecord, type TreeView } from '../../shared/contracts.ts'
import type { NumStep } from '../../solvers/num.ts'
import { Boundary } from '../cards/Frame.tsx'
import { NumBody, type NumResult } from '../cards/NumCard.tsx'
import { OpBody } from '../cards/BoolCard.tsx'
import { CombBody } from '../cards/CombCard.tsx'
import { SeqBody } from '../cards/SeqCard.tsx'
import { FsmBody } from '../cards/FsmCard.tsx'
import { MemBody } from '../cards/MemCard.tsx'
import { AddaBody } from '../cards/AddaCard.tsx'
import { SystemBody } from '../cards/SystemCard.tsx'
import { LintBody, SimBody } from '../cards/HdlCard.tsx'
import type { LintResult, SimulateResult } from '../../shared/hdl.ts'
import { fmt, type TFn } from '../locale.ts'
import { angleLabelKey, isObj, type UseProjection } from '../meta.ts'
import { FIGURES_LOCATION_KEY } from './definition.ts'
import type { FiguresItem as FigureItem } from './definition.ts'
import { selectFigures, type Figure, type VerdictLine } from './select.ts'
import { fc } from './styles.ts'

/** 点击追问：与 sidechat 的 askFollowup 同形（会话已绑定）。 */
export type FigureFollowupAsk = (
  card: CardRecord,
  index: number,
  tree: TreeView | undefined,
) => Promise<{ ok: boolean; error?: string } | undefined>

export interface FiguresTailProps {
  /** DSH 注入的轮次对象：turn.data.get(key) 返回本轮的位置数据。 */
  turn?: { data?: { get?: (key: string) => unknown } }
  /** 本轮回答的序号；只使用 seq 不晚于它的结果。 */
  seq?: number
  t: TFn
  sessionId?: string
  useProjection?: UseProjection
  ask?: FigureFollowupAsk
}

const NO_PROJECTION = (): undefined => undefined

/** 从位置数据中取出结果条目；形状不符的条目丢弃。 */
function readItems(stored: unknown): FigureItem[] {
  if (!isObj(stored) || !Array.isArray(stored.items)) return []
  const out: FigureItem[] = []
  for (const it of stored.items) {
    if (isObj(it) && typeof it.seq === 'number') {
      out.push({ seq: it.seq, callId: typeof it.callId === 'string' ? it.callId : '', meta: it.meta })
    }
  }
  return out
}

type CombBodyResult = Parameters<typeof CombBody>[0]['r']
type SeqBodyResult = Parameters<typeof SeqBody>[0]['r']
type FsmBodyResult = Parameters<typeof FsmBody>[0]['r']
type MemBodyResult = Parameters<typeof MemBody>[0]['r']
type AddaBodyResult = Parameters<typeof AddaBody>[0]['r']
type SystemBodyResult = Parameters<typeof SystemBody>[0]['r']

function captionKeyOf(f: Figure): string {
  switch (f.tool) {
    case 'dlogic_num':
      return 'figures.cap.convert'
    case 'dlogic_comb':
      return 'figures.cap.comb'
    case 'dlogic_seq':
      return 'figures.cap.seq'
    case 'dlogic_fsm':
      return 'figures.cap.fsm'
    case 'dlogic_mem':
      return 'figures.cap.mem'
    case 'dlogic_adda':
      return 'figures.cap.adda'
    case 'dlogic_system':
      return 'figures.cap.system'
    case 'dlogic_hdl':
      return f.op === 'simulate' ? 'figures.cap.simulate' : 'figures.cap.lint'
    default:
      return `figures.cap.${f.op}`
  }
}

function FigureBody({ f, t }: { f: Figure; t: TFn }) {
  switch (f.tool) {
    case 'dlogic_num':
      return <NumBody r={f.result as NumResult} steps={f.steps as NumStep[]} t={t} />
    case 'dlogic_comb':
      return <CombBody op={f.op} r={f.result as CombBodyResult} t={t} />
    case 'dlogic_seq':
      return <SeqBody op={f.op} r={f.result as SeqBodyResult} t={t} />
    case 'dlogic_fsm':
      return <FsmBody op={f.op} r={f.result as FsmBodyResult} t={t} />
    case 'dlogic_mem':
      return <MemBody op={f.op} r={f.result as MemBodyResult} t={t} />
    case 'dlogic_adda':
      return <AddaBody op={f.op} r={f.result as AddaBodyResult} t={t} />
    case 'dlogic_system':
      return <SystemBody op={f.op} r={f.result as SystemBodyResult} t={t} />
    case 'dlogic_hdl':
      // 与 HdlCard 同一套子组件：仿真显示输出与波形，静态检查显示问题列表（无源码，故不带代码视图）。
      return f.op === 'simulate' ? (
        <SimBody r={f.result as SimulateResult} t={t} />
      ) : (
        <LintBody r={f.result as LintResult} t={t} />
      )
    default:
      return <OpBody op={f.op} r={f.result as BoolResultMap[BoolOp]} t={t} fallbackText="" />
  }
}

function FigureCell({ figure, t }: { figure: Figure; t: TFn }) {
  return (
    <div className={fc('fig')}>
      <div className={fc('cap')}>{t(captionKeyOf(figure))}</div>
      <div className={fc('body')}>
        <Boundary fallback={null}>
          <FigureBody f={figure} t={t} />
        </Boundary>
      </div>
    </div>
  )
}

/** 一行结论：等价 · 最简 / 不等价 + 反例。 */
function VerdictView({ v, t }: { v: VerdictLine; t: TFn }) {
  const parts: string[] = [v.equivalent ? t('verify.equivalent') : t('verify.notEquivalent')]
  if (v.equivalent && v.minimal !== undefined) {
    parts.push(v.minimal === true ? t('verify.minimal') : v.minimal === false ? t('verify.notMinimal') : t('verify.unknown'))
  }
  const ce = v.equivalent ? undefined : v.counterexample
  let ceText = ''
  if (ce) {
    const assign = v.variables.map((name, i) => `${name}=${ce.inputs[i] ?? ''}`).join(' ') || ce.inputs.join('')
    ceText = `${t('verify.counter')} ${assign} · ${t('verify.leftOut')} ${ce.left} / ${t('verify.rightOut')} ${ce.right}`
  }
  return (
    <div className={v.equivalent ? fc('verdict') : `${fc('verdict')} ${fc('verdict-bad')}`}>
      <span>{parts.join(' · ')}</span>
      {ceText && <span className={fc('verdict-ce')}>{ceText}</span>}
    </div>
  )
}

/** 继续追问：角度标签 + 问题；已展开的槽位禁用并标注。 */
function FollowupRow({
  card,
  tree,
  ask,
  t,
}: {
  card: CardRecord
  tree: TreeView | undefined
  ask?: FigureFollowupAsk
  t: TFn
}) {
  const [pending, setPending] = useState<number | null>(null)
  const [sent, setSent] = useState<number[]>([])
  const [err, setErr] = useState<string | null>(null)

  const expanded = new Set<number>()
  if (tree && Array.isArray(tree.nodes)) {
    for (const n of tree.nodes) {
      if (n.parentId === card.nodeId && typeof n.parentFollowup === 'number') expanded.add(n.parentFollowup)
    }
  }

  const onAsk = async (index: number): Promise<void> => {
    if (pending !== null) return
    if (!ask) {
      setErr(t('figures.askUnavailable'))
      return
    }
    setPending(index)
    setErr(null)
    try {
      const r = await ask(card, index, tree)
      if (r && r.ok) setSent((prev) => (prev.includes(index) ? prev : [...prev, index]))
      else setErr(r?.error || t('figures.askFailed'))
    } catch {
      setErr(t('figures.askFailed'))
    } finally {
      setPending(null)
    }
  }

  const showNote = pending !== null || sent.length > 0
  return (
    <div className={fc('fu')}>
      <div className={fc('fu-title')}>{t('figures.followups')}</div>
      <div className={fc('chips')}>
        {card.followups.map((f, i) => {
          if (!f || typeof f.question !== 'string') return null
          const done = expanded.has(i)
          const isSent = sent.includes(i)
          return (
            <button
              key={i}
              type="button"
              className={fc('chip')}
              title={f.why}
              disabled={pending !== null || done || isSent}
              onClick={() => void onAsk(i)}
            >
              <span className={fc('chip-angle')}>{t(angleLabelKey(f.angle))}</span>
              <span className={fc('chip-q')}>{f.question}</span>
              {done && <span className={fc('chip-status')}>{t('figures.expanded')}</span>}
            </button>
          )
        })}
      </div>
      {showNote && <div className={fc('note')}>{t('figures.sent')}</div>}
      {err && <div className={fc('err')}>{err}</div>}
    </div>
  )
}

function FiguresBody(props: FiguresTailProps) {
  const { turn, seq, t, ask, useProjection } = props
  const [showAll, setShowAll] = useState(false)
  const project = useProjection ?? NO_PROJECTION
  const tree = project(TREE_PROJECTION_KEY) as TreeView | undefined
  const stored = turn?.data?.get?.(FIGURES_LOCATION_KEY)
  const sel = selectFigures(readItems(stored), seq)

  const card = sel.card && sel.card.followups.length > 0 ? sel.card : null
  const nothing = sel.figures.length === 0 && sel.hidden.length === 0 && !sel.verdict && !card
  if (nothing) return null

  const shown = showAll ? [...sel.figures, ...sel.hidden] : sel.figures
  return (
    <div className={fc('wrap')}>
      {shown.length > 0 && (
        <div className={fc('grid')}>
          {shown.map((f) => (
            <FigureCell key={f.key} figure={f} t={t} />
          ))}
        </div>
      )}
      {sel.hidden.length > 0 && (
        <button type="button" className={fc('btn')} onClick={() => setShowAll((v) => !v)}>
          {showAll ? t('figures.less') : fmt(t, 'figures.more', { n: sel.hidden.length })}
        </button>
      )}
      {sel.verdict && <VerdictView v={sel.verdict} t={t} />}
      {card && <FollowupRow card={card} tree={tree} ask={ask} t={t} />}
    </div>
  )
}

/** 槽位组件：内部出错时整体不渲染，不影响聊天区。 */
export function FiguresTail(props: FiguresTailProps) {
  return (
    <Boundary fallback={null}>
      <FiguresBody {...props} />
    </Boundary>
  )
}
