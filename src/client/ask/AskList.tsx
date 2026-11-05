// 直接回答的显示：抽屉中的问答列表（按时间顺序，最新在下）与卡片展开时的完整回答。
import { Fragment, useEffect, useRef } from 'react'
import { c } from '../styles.ts'
import type { AskEntry } from './entries.ts'
import { linkify } from './links.ts'
import { plainMath } from './plainMath.ts'

/** 知识点链接的上下文（仅树中展开的卡片使用）。 */
export interface AnswerLinks {
  /** 卡片自身的知识点：同名歧义时用于选择最近的知识点。 */
  focusIds: readonly string[]
  /** 已探索的知识点（路径上与卡片自身）：不再链接。 */
  exploredIds: ReadonlySet<string>
  /** 正在加载的知识点 id（该卡片的链接显示忙碌状态）。 */
  busyNodeId?: string | null
  /** 点击链接：参数为知识点 id 与被点击的词，据此发起“「词」是什么？”。 */
  onLink: (nodeId: string, title: string) => void
}

/** 已转为纯文本的文字，其中的知识点词渲染为可点击链接（键盘可用，阻止冒泡以免触发卡片拖动与折叠）。 */
export function LinkedText({ text, links }: { text: string; links: AnswerLinks }) {
  const segs = linkify(text, { focusIds: links.focusIds, exploredIds: links.exploredIds })
  return (
    <>
      {segs.map((s, i) => {
        if (!('nodeId' in s)) return <Fragment key={i}>{s.text}</Fragment>
        const busy = links.busyNodeId === s.nodeId
        // 用被点击的词本身作为提问与卡片标题；知识点 id 只用来收窄卡片的知识点。
        const fire = (): void => links.onLink(s.nodeId, s.text)
        return (
          <a
            key={i}
            role="button"
            tabIndex={0}
            title={s.title}
            aria-busy={busy || undefined}
            className={c('ask-link') + (busy ? ' ' + c('ask-link-busy') : '')}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              fire()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                fire()
              }
            }}
          >
            {s.text}
          </a>
        )
      })}
    </>
  )
}

/**
 * 回答正文：保留换行（段落），残留的 LaTeX 显示前转为纯文本，不做 Markdown 渲染。
 * 传入 links 时，知识点词渲染为可点击链接；否则与原来一致。
 */
export function AnswerText({ text, links }: { text: string; links?: AnswerLinks }) {
  const plain = plainMath(text)
  return <div className={c('ask-a')}>{links ? <LinkedText text={plain} links={links} /> : plain}</div>
}

export function AskList({ entries }: { entries: readonly AskEntry[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  // 新回答追加后滚动到底部，让最新的一条可见。
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries.length])
  return (
    <div ref={ref} className={c('ask-list')}>
      {entries.map((e) => (
        <div key={e.card.callId} className={c('ask-item')}>
          <div className={c('ask-q')}>{plainMath(e.card.title)}</div>
          <AnswerText text={e.answer} />
        </div>
      ))}
    </div>
  )
}
