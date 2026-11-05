// dlogic_card 工具卡片（学习卡片）：标题、摘要与可点击的追问。
// 点击追问经 askFollowup 发往侧边追问子会话，绝不发送到主会话。
import { useState } from 'react'
import { TREE_PROJECTION_KEY, type CardRecord, type TreeView } from '../../shared/contracts.ts'
import type { AskResult } from '../sidechat/api.ts'
import { angleLabelKey, isSettled, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { c } from '../styles.ts'
import { Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_card'

/** 由 index.tsx 通过 inject 工厂注入：已绑定主会话的追问函数。 */
export type LearnAsk = (card: CardRecord, index: number, tree: TreeView | undefined) => Promise<AskResult>

export interface LearnCardProps extends ToolViewProps {
  ask?: LearnAsk
}

const NO_PROJECTION = (): undefined => undefined

export function LearnCard(props: LearnCardProps) {
  const { t, phase, block, ask } = props
  const project = props.useProjection ?? NO_PROJECTION
  const [pending, setPending] = useState<number | null>(null)
  const [sent, setSent] = useState<number[]>([])
  const [err, setErr] = useState<string | null>(null)
  const view = project(TREE_PROJECTION_KEY) as TreeView | undefined

  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('learn.title')} text={t('learn.preparing')} />
  if (!isSettled(block)) return <MutedRow tool={TOOL} title={t('learn.title')} text={t('learn.running')} />

  const isError = block.isError === true
  const value = readMeta<CardRecord>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('learn.title')} summary="" isError={isError}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok || !value.result || !Array.isArray(value.result.followups)) {
    return <MutedRow tool={TOOL} title={t('learn.title')} text={`${t('learn.failed')}${value.error ? '：' + value.error : ''}`} isError />
  }

  const card = value.result
  // 已展开的追问槽位：树中存在 parentId 为本卡且 parentFollowup 为该序号的卡片。
  const expanded = new Set<number>()
  for (const n of view?.nodes ?? []) {
    if (n.parentId === card.nodeId && typeof n.parentFollowup === 'number') expanded.add(n.parentFollowup)
  }

  const onAsk = async (index: number): Promise<void> => {
    if (pending !== null) return
    if (!ask) {
      setErr(t('learn.askUnavailable'))
      return
    }
    setPending(index)
    setErr(null)
    try {
      const r = await ask(card, index, view)
      if (r && r.ok) setSent((prev) => (prev.includes(index) ? prev : [...prev, index]))
      else setErr(r?.error ?? t('learn.askFailed'))
    } catch {
      setErr(t('learn.askFailed'))
    } finally {
      setPending(null)
    }
  }

  return (
    <Card tool={TOOL} title={t('learn.title')} summary={String(card.title ?? '')}>
      <div className={c('step')}>
        <div style={{ color: 'var(--dsw-alias-label-primary)', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{card.title}</div>
        {card.summary && <div className={c('muted')} style={{ fontSize: 13, marginBottom: 8 }}>{card.summary}</div>}
        <div className={c('chips')}>
          {card.followups.map((f, i) => {
            const done = expanded.has(i)
            const isSent = sent.includes(i)
            const busy = pending === i
            const status = done ? t('learn.expanded') : isSent ? t('learn.sentSide') : busy ? t('tree.asking') : ''
            return (
              <button
                key={i}
                type="button"
                className={c('chip')}
                title={f.why}
                disabled={pending !== null || done || isSent}
                onClick={() => void onAsk(i)}
              >
                <span className={c('chip-angle')}>{t(angleLabelKey(f.angle))}</span>
                <span className={c('chip-q')}>{f.question}</span>
                {status && <span className={c('chip-angle')}>{status}</span>}
              </button>
            )
          })}
        </div>
        {err && <div className={c('bad')} style={{ fontSize: 12, marginTop: 6 }}>{err}</div>}
      </div>
    </Card>
  )
}
