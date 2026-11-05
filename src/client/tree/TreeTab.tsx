// 右侧栏“学习树”标签页：合并主会话、直接回答与旧追问子会话的卡片，底部为侧边追问抽屉。
// 追问经 askFollowup（已在 register.ts 切换为直接回答），绝不写入主会话。
// 多选（仅内存）后可对比、总结；全图可生成复习提纲；综合结果与追问一样写入直接回答存储。
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { TREE_PROJECTION_KEY, type CardRecord, type TreeView } from '../../shared/contracts.ts'
import { askFollowup } from '../sidechat/api.ts'
import { AskList } from '../ask/AskList.tsx'
import { askFollowupLlm } from '../ask/api.ts'
import { buildAskEntry, randomToken } from '../ask/entries.ts'
import { addAskAnswer, useAskEntries } from '../ask/store.ts'
import { conceptQuestion } from '../ask/links.ts'
import { branchMarkdown, cardPath, type SynthKind } from '../ask/synth.ts'
import { buildContextPath } from '../sidechat/context.ts'
import { openSideChatFullscreen, useFollowupChildIds, useRetainedChild } from '../sidechat/register.ts'
import type { TFn } from '../locale.ts'
import type { UseProjection } from '../meta.ts'
import { c } from '../styles.ts'
import { childOnlyCallIds, mergeCards, pendingSlotKeys, sameCards } from './merge.ts'
import { copyText, synthesize } from './synthesize.ts'
import { jumpToChat, slotKey, TreeCanvas } from './TreeCanvas.tsx'
import { readDrawerOpen, SideChatDrawer, writeDrawerOpen } from './SideChatDrawer.tsx'

export interface TreeTabProps {
  t: TFn
  sessionId?: string
  useTabInfo: () => void
  useProjection?: UseProjection
  /** DSH 注入：渲染插槽。 */
  renderSlot?: (name: string, owner: Record<string, unknown>) => unknown
  /** DSH 注入：会话上下文提供者。 */
  SessionProvider?: (props: { session: unknown; children?: ReactNode }) => ReactNode
}

type SessionProviderComp = NonNullable<TreeTabProps['SessionProvider']>
type RenderSlotFn = NonNullable<TreeTabProps['renderSlot']>

const NO_PROJECTION = (): undefined => undefined
const EMPTY_CARDS: CardRecord[] = []
/** “回答中…”的超时：超过此时长仍无卡片，视为子代理已结束却没产出卡片，不再转圈。 */
const ANSWER_TIMEOUT_MS = 5 * 60 * 1000
const ANSWER_TICK_MS = 15 * 1000

interface ChildCollectorProps {
  parentId: string
  childId: string
  SessionProvider: SessionProviderComp
  renderSlot: RenderSlotFn
  onNodes: (childId: string, nodes: CardRecord[]) => void
}

/** 单个追问子代理的采集器：各自保留句柄、各自 SessionProvider，卡片按子代理 id 上报。 */
function ChildCollector(props: ChildCollectorProps) {
  const { parentId, childId, SessionProvider, renderSlot, onNodes } = props
  const handle = useRetainedChild(parentId, childId)
  const report = useCallback((nodes: CardRecord[]) => onNodes(childId, nodes), [onNodes, childId])
  if (!handle) return null
  return <SessionProvider session={handle}>{renderSlot('dlogic.sidechat.collector', { onNodes: report }) as ReactNode}</SessionProvider>
}

export function TreeTab(props: TreeTabProps) {
  const { t, sessionId, useTabInfo, renderSlot, SessionProvider } = props
  useTabInfo()
  const project = props.useProjection ?? NO_PROJECTION
  const view = project(TREE_PROJECTION_KEY) as TreeView | undefined
  const mainNodes = Array.isArray(view?.nodes) ? view.nodes : EMPTY_CARDS

  // 直接回答（本地存储）生成的卡片与完整回答。
  const askEntries = useAskEntries(sessionId)
  const askCards = useMemo(() => askEntries.map((e) => e.card), [askEntries])
  const answers = useMemo(() => new Map(askEntries.map((e) => [e.card.callId, e.answer] as const)), [askEntries])
  const hasDirect = askEntries.length > 0

  // 同一主会话下的全部追问子代理（旧到新）；最新的一个供抽屉与全屏使用。
  const childIds = useFollowupChildIds(sessionId)
  const childId = childIds.length > 0 ? childIds[childIds.length - 1] : undefined
  const childRef = useRetainedChild(sessionId, childId)

  // 每个子代理各自上报的卡片，按子代理 id 保存；合并时按目录顺序拼接。
  const [nodesById, setNodesById] = useState<Record<string, CardRecord[]>>({})
  const onChildNodes = useCallback((id: string, nodes: CardRecord[]) => {
    setNodesById((prev) => {
      const old = prev[id]
      if (old && sameCards(old, nodes)) return prev
      return { ...prev, [id]: nodes }
    })
  }, [])
  const childNodes = useMemo(() => childIds.flatMap((id) => nodesById[id] ?? EMPTY_CARDS), [childIds, nodesById])

  // 点击知识点链接后、模型回答到达前的占位卡片：立刻出现在树里，给出即时反馈；回答到达或失败时移除。
  const [pendingCard, setPendingCard] = useState<CardRecord | null>(null)
  const pendingList = useMemo(() => (pendingCard ? [pendingCard] : EMPTY_CARDS), [pendingCard])
  const merged = useMemo(
    () => mergeCards(mergeCards(mergeCards(mainNodes, askCards), childNodes), pendingList),
    [mainNodes, askCards, childNodes, pendingList],
  )
  const childCallIds = useMemo(() => childOnlyCallIds(mainNodes, [...askCards, ...childNodes]), [mainNodes, askCards, childNodes])
  const mergedView: TreeView = useMemo(() => ({ v: 1, nodes: merged }), [merged])
  const filled = useMemo(() => {
    const s = new Set<string>()
    for (const n of merged) if (n.parentId && typeof n.parentFollowup === 'number') s.add(slotKey(n.parentId, n.parentFollowup))
    return s
  }, [merged])

  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 多选的卡片 nodeId（仅内存）。卡片消失或切换会话时剔除。
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev
      const alive = new Set(merged.map((n) => n.nodeId))
      const next = new Set(Array.from(prev).filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [merged])
  useEffect(() => {
    setSelected((prev) => (prev.size === 0 ? prev : new Set()))
  }, [sessionId])
  const onToggleSelect = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const onClearSelect = (): void => setSelected(new Set())

  // 综合操作（对比/总结/复习提纲）：生成中时禁用全部综合按钮。
  const [synthBusy, setSynthBusy] = useState<SynthKind | null>(null)
  // 刚生成的综合卡片：TreeCanvas 据此滚动定位，定位后清空。
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const onSynth = async (kind: SynthKind): Promise<void> => {
    if (synthBusy !== null) return
    if (!sessionId) {
      setError(t('learn.askUnavailable'))
      return
    }
    // 所选卡片按树中的出现顺序排列。
    const picked = merged.filter((n) => selected.has(n.nodeId))
    const cards = kind === 'outline' ? merged : picked
    if (kind === 'outline' && cards.length < 2) {
      setError(t('tree.needTwoTree'))
      return
    }
    if (kind === 'compare' && picked.length < 2) {
      setError(t('tree.needTwo'))
      return
    }
    if (kind === 'summary' && picked.length < 1) {
      setError(t('tree.needOne'))
      return
    }
    setSynthBusy(kind)
    try {
      const r = await synthesize(sessionId, kind, cards)
      if (r.ok) {
        setError(null)
        setFocusNodeId(r.nodeId)
      } else setError(r.error || t('tree.synthFailed'))
    } catch {
      setError(t('tree.synthFailed'))
    } finally {
      setSynthBusy(null)
    }
  }

  // 复制分支上下文：从根到该卡片；完整回答优先，缺失时用摘要。
  const onCopyBranch = async (card: CardRecord): Promise<boolean> => {
    const text = branchMarkdown(cardPath(merged, card.nodeId), answers)
    const ok = await copyText(text)
    if (!ok) setError(t('tree.copyFailed'))
    return ok
  }
  // 已发出的追问槽位 -> 发出时刻；尚未登记卡片且未超时的显示“回答中…”。
  const [sentAt, setSentAt] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    if (sentAt.size === 0) return
    const timer = window.setInterval(() => setNow(Date.now()), ANSWER_TICK_MS)
    return () => window.clearInterval(timer)
  }, [sentAt])
  const answering = useMemo(() => pendingSlotKeys(sentAt, filled, now, ANSWER_TIMEOUT_MS), [sentAt, filled, now])

  const [open, setOpen] = useState<boolean>(() => readDrawerOpen(sessionId))
  useEffect(() => {
    setOpen(readDrawerOpen(sessionId))
  }, [sessionId])

  const onAsk = async (card: CardRecord, index: number): Promise<void> => {
    if (busyKey !== null) return
    const key = slotKey(card.nodeId, index)
    setBusyKey(key)
    try {
      if (!sessionId) {
        setError(t('learn.askUnavailable'))
        return
      }
      const r = await askFollowup(sessionId, card, index, mergedView)
      if (r && r.ok) {
        setError(null)
        const at = Date.now()
        setNow(at)
        setSentAt((prev) => (prev.has(key) ? prev : new Map(prev).set(key, at)))
      } else setError(r?.error ?? t('tree.askFailed'))
    } catch {
      setError(t('tree.askFailed'))
    } finally {
      setBusyKey(null)
    }
  }

  // 展开卡片底部的自由追问：以该卡片为父卡片，结果作为子卡片挂上（不占用任何追问桩）。
  // 失败时返回中文错误，同时显示在红色错误行中，直到下一次成功操作。
  const onFreeAsk = async (card: CardRecord, question: string): Promise<string | null> => {
    if (!sessionId) {
      setError(t('learn.askUnavailable'))
      return t('learn.askUnavailable')
    }
    const path = buildContextPath(mergedView, card, Number.POSITIVE_INFINITY)
    const r = await askFollowupLlm(sessionId, buildContextPath(mergedView, card), question)
    if (!r.ok) {
      setError(r.error)
      return r.error
    }
    setError(null)
    addAskAnswer(
      sessionId,
      buildAskEntry({
        parent: card,
        explored: path.flatMap((n) => n.knowledgeIds),
        question,
        answer: r.text,
        followups: r.followups,
        now: Date.now(),
        token: randomToken(),
      }),
    )
    return null
  }

  // 回答中的知识点链接：以该卡片为父卡片发起“「X」是什么？”，X 是被点击的词（title 参数），卡片标题也用它。
  // 去重：该卡片已有同一知识点的同名子卡片时不再调用模型，直接定位到它。
  const [conceptBusy, setConceptBusy] = useState<{ cardId: string; nodeId: string } | null>(null)
  const onConceptLink = async (card: CardRecord, nodeId: string, title: string): Promise<void> => {
    const question = conceptQuestion(title)
    const existing = merged.find(
      (n) =>
        n.parentId === card.nodeId &&
        (n.title === title || n.title === question) &&
        n.knowledgeIds.length === 1 &&
        n.knowledgeIds[0] === nodeId,
    )
    // 已有同名子卡片：不再调用模型。聚焦定位在这里不做（位置不可靠，见 SPEC 第 28 条）。
    if (existing) return
    if (!sessionId) {
      setError(t('learn.askUnavailable'))
      return
    }
    if (conceptBusy !== null) return
    setConceptBusy({ cardId: card.nodeId, nodeId })
    try {
      const path = buildContextPath(mergedView, card, Number.POSITIVE_INFINITY)
      // 立刻放一张占位卡片并滚过去；回答到达后由真正的卡片替换。
      const placeholder = buildAskEntry({
        parent: card,
        followup: { question, angle: 'principle', why: '', knowledgeId: nodeId },
        question,
        title,
        answer: t('tree.asking'),
        now: Date.now(),
        token: randomToken(),
      }).card
      setPendingCard({ ...placeholder, summary: t('tree.asking'), followups: [] })
      setFocusNodeId(placeholder.nodeId)
      const r = await askFollowupLlm(sessionId, buildContextPath(mergedView, card), question)
      if (!r.ok) {
        setError(r.error)
        return
      }
      setError(null)
      const entry = buildAskEntry({
        parent: card,
        explored: path.flatMap((n) => n.knowledgeIds),
        followup: { question, angle: 'principle', why: '', knowledgeId: nodeId },
        question,
        title,
        answer: r.text,
        followups: r.followups,
        now: Date.now(),
        token: randomToken(),
      })
      addAskAnswer(sessionId, entry)
      setFocusNodeId(entry.card.nodeId)
    } catch {
      setError(t('tree.askFailed'))
    } finally {
      setPendingCard(null)
      setConceptBusy(null)
    }
  }

  const setDrawer = (next: boolean): void => {
    setOpen(next)
    writeDrawerOpen(sessionId, next)
  }

  const onLocateChild = (callId: string): void => {
    if (!open) setDrawer(true)
    // 抽屉刚展开时子会话视图需要一帧时间挂载。
    window.setTimeout(() => jumpToChat(callId), 80)
  }

  // 有直接回答时只显示直接回答；没有时沿用旧子代理的对话（保留以便回退）。
  const legacyReady = Boolean(childId && childRef && SessionProvider && renderSlot)
  const canOpen = hasDirect || legacyReady
  const conversation: ReactNode = !open
    ? null
    : hasDirect
      ? <AskList entries={askEntries} />
      : legacyReady && SessionProvider && renderSlot ? (
          <SessionProvider session={childRef}>{renderSlot('dlogic.sidechat.conversation', {}) as ReactNode}</SessionProvider>
        ) : null
  // 每个追问子代理各挂一个采集器，卡片全部收集。
  const collector: ReactNode =
    SessionProvider && renderSlot && sessionId ? (
      <>
        {childIds.map((id) => (
          <ChildCollector
            key={id}
            parentId={sessionId}
            childId={id}
            SessionProvider={SessionProvider}
            renderSlot={renderSlot}
            onNodes={onChildNodes}
          />
        ))}
      </>
    ) : null

  const footer = (
    <SideChatDrawer
      t={t}
      open={open}
      canOpen={canOpen}
      canFullscreen={!hasDirect && legacyReady}
      turns={hasDirect ? askEntries.length : childNodes.length}
      answering={answering.size > 0}
      onToggle={() => setDrawer(!open)}
      onFullscreen={() => {
        if (sessionId && childId) openSideChatFullscreen(sessionId, childId)
      }}
      conversation={conversation}
      collector={collector}
    />
  )

  if (merged.length === 0) {
    return (
      <div className={c('treepane')}>
        <div className={c('tree-empty')}>
          <h3>{t('tree.title')}</h3>
          <p>{t('tree.empty')}</p>
        </div>
        {footer}
      </div>
    )
  }

  return (
    <TreeCanvas
      view={mergedView}
      t={t}
      sessionId={sessionId ?? ''}
      error={error}
      childCallIds={childCallIds}
      answering={answering}
      answers={answers}
      busyKey={busyKey}
      onAsk={(card, index) => void onAsk(card, index)}
      onLocateChild={onLocateChild}
      onFreeAsk={onFreeAsk}
      onConceptLink={(card, nodeId, title) => void onConceptLink(card, nodeId, title)}
      conceptBusy={conceptBusy}
      footer={footer}
      selected={selected}
      onToggleSelect={onToggleSelect}
      onClearSelect={onClearSelect}
      onSynth={(kind) => void onSynth(kind)}
      synthBusy={synthBusy}
      onCopyBranch={onCopyBranch}
      focusNodeId={focusNodeId}
      onFocusDone={() => setFocusNodeId(null)}
    />
  )
}
