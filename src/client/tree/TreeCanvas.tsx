// 学习树画布：卡片框与追问桩（stub）绝对定位，连线用一层 SVG。
// 面板较宽时用左到右布局（卡片可拖动，位移持久化）；较窄时用大纲式缩进布局（不可拖动）。
// 卡片默认展开，点击收起/再展开（收起状态按会话保存）；高度由 ResizeObserver 实测。
// 展开卡片可选择（多选，选中态由 TreeTab 保存）、复制分支上下文；树顶部提供对比/总结/复习提纲按钮。
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { CardRecord, TreeView } from '../../shared/contracts.ts'
import { buildForest, knowledgeLabels, type TreeNodeVM } from '../../shared/tree.ts'
import { applyOffsets, layoutForest, layoutIndented, sourceEdges, type Box, type Layout, type NodeOffsets } from '../../shared/treeLayout.ts'
import { AnswerText, LinkedText, type AnswerLinks } from '../ask/AskList.tsx'
import { FreeAskInput } from '../ask/FreeAskInput.tsx'
import { plainMath } from '../ask/plainMath.ts'
import type { SynthKind } from '../ask/synth.ts'
import { angleLabelKey } from '../meta.ts'
import { buildContextPath } from '../sidechat/context.ts'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { isCardOpen, loadCollapsed, saveCollapsed, toggleCollapsed } from './collapsed.ts'
import { loadOffsets, saveOffsets } from './offsets.ts'
import { canvasSize, exceedsPanThreshold, panScroll } from './pan.ts'
import { resolveOffsets } from '../../shared/treePush.ts'

const BOX_W = 280
const CARD_H = 84
const STUB_H = 44
/** 左到右布局所需的最小宽度；低于此值改用大纲式。 */
const WIDE_MIN = 600
/** 左到右布局的画布留白。 */
const PAD = 16
/** 大纲式布局的画布留白。 */
const INDENT_PAD_X = 8
const INDENT_PAD_Y = 16
/** 超过此距离（px）才视为拖动，否则仍是点击。 */
const DRAG_THRESHOLD = 4

/** 追问槽位的键：`${父卡 nodeId}#${序号}`，与追问桩的 id 一致。 */
export function slotKey(parentId: string, index: number): string {
  return `${parentId}#${index}`
}

function indexForest(forest: TreeNodeVM[]): Map<string, TreeNodeVM> {
  const m = new Map<string, TreeNodeVM>()
  const walk = (n: TreeNodeVM): void => {
    m.set(n.id, n)
    n.children.forEach(walk)
  }
  forest.forEach(walk)
  return m
}

/** 滚动聊天区到对应工具调用。 */
export function jumpToChat(callId: string): void {
  try {
    const el = document.querySelector(`[data-chat-call-id="${CSS.escape(callId)}"]`)
    if (el instanceof HTMLElement) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  } catch {
    // 找不到对应消息（例如已被折叠或清空）时忽略。
  }
}

interface DragState {
  id: string
  sx: number
  sy: number
  bx: number
  by: number
  moved: boolean
}

/** 画布空白处按下后的平移状态（仅左到右与大纲式布局都使用滚动容器）。 */
interface PanState {
  pointerId: number
  sx: number
  sy: number
  left: number
  top: number
  /** 位移超过阈值后才为 true；之前仍视为点击。 */
  active: boolean
}

/** 指针落在卡片、按钮、输入框等可交互元素上时不平移。 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true
  return target.closest('[data-tree-node], button, input, textarea, select, a, label, [contenteditable="true"]') !== null
}

export interface TreeCanvasProps {
  /** 合并后的视图（主会话 + 子会话卡片）。 */
  view: TreeView
  t: TFn
  sessionId: string
  error: string | null
  /** 来自子会话的卡片 callId（点定位时在抽屉中查找）。 */
  childCallIds: ReadonlySet<string>
  /** 已发送、等待回答的追问槽位键。 */
  answering: ReadonlySet<string>
  /** 正在发送的槽位键；为 null 表示空闲。 */
  busyKey: string | null
  onAsk: (card: CardRecord, index: number) => void
  onLocateChild: (callId: string) => void
  /** 面板底部的侧边追问抽屉。 */
  footer?: ReactNode
  /** 直接回答卡片的完整回答文本，按 callId 索引（卡片摘要只是截断版）。 */
  answers?: ReadonlyMap<string, string>
  /** 已选中的卡片 nodeId（多选对比、总结用，仅内存）。 */
  selected: ReadonlySet<string>
  onToggleSelect: (id: string) => void
  onClearSelect: () => void
  /** 发起综合操作：对比/总结所选，或全图复习提纲。 */
  onSynth: (kind: SynthKind) => void
  /** 正在生成的综合操作；为 null 表示空闲。 */
  synthBusy: SynthKind | null
  /** 复制从根到该卡片的分支上下文；成功返回 true（用于按钮的“已复制”提示）。 */
  onCopyBranch: (card: CardRecord) => Promise<boolean>
  /** 需要滚动定位的卡片（刚生成的综合卡片）；进入布局后滚动过去，然后调用 onFocusDone。 */
  focusNodeId?: string | null
  onFocusDone?: () => void
  /** 展开卡片底部的自由追问（直接回答与主会话卡片）；成功返回 null，失败返回中文错误。 */
  onFreeAsk?: (card: CardRecord, question: string) => Promise<string | null>
  /** 点击回答中的知识点链接：以该知识点发起概念追问（去重与发送由调用方处理）。 */
  onConceptLink?: (card: CardRecord, nodeId: string, title: string) => void
  /** 正在加载的概念追问：所属卡片与知识点；为 null 表示空闲。 */
  conceptBusy?: { cardId: string; nodeId: string } | null
}

/** “已复制”提示的显示时长（ms）。 */
const COPIED_MS = 1500
export function TreeCanvas(props: TreeCanvasProps) {
  const { view, t, sessionId, error, childCallIds, answering, busyKey, onAsk, onLocateChild, footer, answers } = props
  const { selected, onToggleSelect, onClearSelect, onSynth, synthBusy, onCopyBranch, focusNodeId, onFocusDone, onFreeAsk } = props
  const { onConceptLink, conceptBusy } = props
  const forest = useMemo(() => buildForest(view), [view])
  const nodeMap = useMemo(() => indexForest(forest), [forest])
  // 最近一次复制成功的卡片（对象每次新建，以便重复点击时重新计时）。
  const [copied, setCopied] = useState<{ id: string } | null>(null)
  useEffect(() => {
    if (copied === null) return
    const timer = window.setTimeout(() => setCopied(null), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])
  const copyBranch = async (card: CardRecord): Promise<void> => {
    const ok = await onCopyBranch(card)
    if (ok) setCopied({ id: card.nodeId })
  }

  // 高度按布局键分别保存：大纲式的宽度随面板变化，换宽度后需重新实测。
  const [heights, setHeights] = useState<Map<string, number>>(() => new Map())
  const [paneW, setPaneW] = useState(0)
  const [paneH, setPaneH] = useState(0)
  // 只记录手动收起的卡片；新卡片默认展开。
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => loadCollapsed(sessionId))
  const [offsets, setOffsets] = useState<NodeOffsets>(() => loadOffsets(sessionId))
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    setOffsets(loadOffsets(sessionId))
    setCollapsed(loadCollapsed(sessionId))
  }, [sessionId])

  // 0 表示尚未测量：按宽布局处理，测量后再切换。
  const indented = paneW > 0 && paneW < WIDE_MIN
  const indentW = Math.max(160, paneW - INDENT_PAD_X * 2)
  const layoutKey = indented ? `i${indentW}` : 'f'
  const padX = indented ? INDENT_PAD_X : PAD
  const padY = indented ? INDENT_PAD_Y : PAD

  const hOf = (id: string): number => {
    const vm = nodeMap.get(id)
    return heights.get(`${layoutKey}|${id}`) ?? (vm?.kind === 'stub' ? STUB_H : CARD_H)
  }

  // 左到右的基础布局（未加手动位移）；大纲式为 null，不参与拖动与推开。
  const base: Layout | null = useMemo(
    () => (indented ? null : layoutForest(forest, (id) => ({ w: BOX_W, h: hOf(id) }))),
    [forest, nodeMap, heights, layoutKey, indented],
  )

  // 拖动中：被拖节点用实时位移，其余与之重叠的节点被推开（预览与松手后的结果一致）。
  const layout: Layout = useMemo(() => {
    if (!base) return layoutIndented(forest, (id) => ({ w: 0, h: hOf(id) }), { width: indentW })
    const live: NodeOffsets = drag ? { ...offsets, [drag.id]: { dx: drag.dx, dy: drag.dy } } : offsets
    // 无拖动时也整理一遍（仅用于显示，不保存）：已保存的位移与自动布局（卡片展开收起、新卡片加入）
    // 之后可能重叠，保证任何时候都不会有卡片叠在一起。
    const resolved = resolveOffsets(base, forest, live, drag ? drag.id : null)
    return applyOffsets(base, forest, resolved, 'forest')
  }, [base, forest, offsets, drag, indentW, nodeMap, heights, layoutKey])

  // 面板宽高：宽度决定布局模式；宽高共同决定画布的滚动余量（见 canvasSize）。
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width)
        const h = Math.round(e.contentRect.height)
        setPaneW((prev) => (prev === w ? prev : w))
        setPaneH((prev) => (prev === h ? prev : h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 节点高度（每个元素带 data-layout-key，写入对应布局键下的高度）。
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next: Map<string, number> | null = null
        for (const e of entries) {
          const el = e.target as HTMLElement
          const id = el.dataset.treeNode
          const key = el.dataset.layoutKey
          if (!id || !key) continue
          const h = Math.round(el.offsetHeight)
          if (h <= 0) continue
          const k = `${key}|${id}`
          if ((next ?? prev).get(k) !== h) {
            if (next === null) next = new Map(prev)
            next.set(k, h)
          }
        }
        return next ?? prev
      })
    })
    roRef.current = ro
    return () => {
      ro.disconnect()
      roRef.current = null
    }
  }, [])

  // 每次渲染后把当前节点元素加入观察（重复 observe 无副作用）。
  useEffect(() => {
    const ro = roRef.current
    const root = scrollRef.current
    if (!ro || !root) return
    root.querySelectorAll<HTMLElement>('[data-tree-node]').forEach((el) => ro.observe(el))
  })

  const toggle = (id: string): void => {
    const next = toggleCollapsed(collapsed, id)
    setCollapsed(next)
    saveCollapsed(sessionId, next)
  }

  // 卡片与追问桩共用：按下、移动、松开。桩的 id 为 `${父卡}#${序号}`，位移与卡片一样按 id 保存。
  const onCardPointerDown = (e: ReactPointerEvent<HTMLElement>, id: string): void => {
    if (indented || e.button !== 0) return
    suppressClick.current = false
    const cur = offsets[id]
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, bx: cur?.dx ?? 0, by: cur?.dy ?? 0, moved: false }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 不支持捕获时仍可拖动到指针离开前。
    }
  }

  const onCardPointerMove = (e: ReactPointerEvent<HTMLElement>): void => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    d.moved = true
    setDrag({ id: d.id, dx: Math.round(d.bx + dx), dy: Math.round(d.by + dy) })
  }

  const onCardPointerEnd = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean): void => {
    const d = dragRef.current
    dragRef.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // 已释放时忽略。
    }
    if (!d) return
    if (!d.moved || cancelled) {
      setDrag(null)
      return
    }
    suppressClick.current = true
    const withDrag: NodeOffsets = {
      ...offsets,
      [d.id]: { dx: Math.round(d.bx + e.clientX - d.sx), dy: Math.round(d.by + e.clientY - d.sy) },
    }
    // 保存时一并保存被推开节点的位移（与拖动中的预览一致）。
    const next = base ? resolveOffsets(base, forest, withDrag, d.id) : withDrag
    setOffsets(next)
    saveOffsets(sessionId, next)
    setDrag(null)
  }

  const resetLayout = (): void => {
    setOffsets({})
    saveOffsets(sessionId, {})
    setDrag(null)
  }

  // 画布空白处拖动平移滚动容器（左到右与大纲式布局都适用）。位移超过阈值才开始平移，并捕获指针。
  const [panning, setPanning] = useState(false)
  const panRef = useRef<PanState | null>(null)
  const onPanDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const el = scrollRef.current
    if (!el || e.button !== 0 || isInteractiveTarget(e.target)) return
    panRef.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, left: el.scrollLeft, top: el.scrollTop, active: false }
  }
  const onPanMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const p = panRef.current
    const el = scrollRef.current
    if (!p || !el || e.pointerId !== p.pointerId) return
    const dx = e.clientX - p.sx
    const dy = e.clientY - p.sy
    if (!p.active) {
      if (!exceedsPanThreshold(dx, dy)) return
      p.active = true
      setPanning(true)
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // 不支持捕获时仍可平移到指针离开前。
      }
    }
    const next = panScroll(
      { left: p.left, top: p.top },
      dx,
      dy,
      { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight },
    )
    el.scrollLeft = next.left
    el.scrollTop = next.top
  }
  const onPanEnd = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const p = panRef.current
    if (!p || e.pointerId !== p.pointerId) return
    panRef.current = null
    if (!p.active) return
    setPanning(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // 已释放时忽略。
    }
  }

  // 把盒子放到视口中间（盒子比视口还高时顶部对齐）；所有聚焦（新卡片、回到最新）都用它。
  // 大纲式只需纵向滚动。
  const centerBox = (box: Box): void => {
    const el = scrollRef.current
    if (!el) return
    const left = indented ? 0 : Math.max(0, box.x + padX + box.w / 2 - el.clientWidth / 2)
    const top = Math.max(0, box.h >= el.clientHeight ? box.y + padY - 16 : box.y + padY + box.h / 2 - el.clientHeight / 2)
    // 平滑滚动：布局还在重排时每次调用会改变目标，浏览器从当前位置重新出发，不会追过期目标。
    el.scrollTo({ left, top, behavior: 'smooth' })
  }

  const goLatest = (): void => {
    const last = view.nodes[view.nodes.length - 1]
    const box = last ? layout.boxes.get(last.nodeId) : undefined
    if (box) centerBox(box)
  }

  // 刚生成的综合卡片：等它进入布局后滚动过去（布局随数据更新，直到找到为止）。
  useEffect(() => {
    if (!focusNodeId) return
    const box = layout.boxes.get(focusNodeId)
    if (!box) return
    // 新卡片先按预估高度布局，实测高度后整棵树会重排（父节点居中于子节点）。
    // 所以每次布局变化都重新滚向最新位置（平滑，新调用覆盖旧目标），直到它自己和它的追问桩都测出高度才结束。
    centerBox(box)
    const vm = nodeMap.get(focusNodeId)
    const ids = [focusNodeId, ...(vm ? vm.children.map((c) => c.id) : [])]
    if (indented || ids.every((id) => heights.has(`${layoutKey}|${id}`))) onFocusDone?.()
  }, [focusNodeId, layout])

  // 综合卡片到来源卡片的虚线（仅左到右布局）。
  const canvas =canvasSize(layout.width, layout.height, padX, padY, paneW, paneH, indented)

  const srcEdges = useMemo(() => (indented ? [] : sourceEdges(view.nodes, layout.boxes)), [indented, view.nodes, layout])

  // 展开卡片的知识点链接上下文：焦点为卡片自身的知识点，已探索为根到该卡片的整条路径。
  const linksFor = (card: CardRecord): AnswerLinks | undefined => {
    if (!onConceptLink) return undefined
    return {
      focusIds: card.knowledgeIds,
      exploredIds: new Set(buildContextPath(view, card, Number.POSITIVE_INFINITY).flatMap((n) => n.knowledgeIds)),
      busyNodeId: conceptBusy?.cardId === card.nodeId ? conceptBusy.nodeId : null,
      onLink: (nodeId, title) => onConceptLink(card, nodeId, title),
    }
  }

  const boxes = Array.from(layout.boxes.entries()).map(([id, box]) => {
    const vm = nodeMap.get(id)
    if (!vm) return null
    const pos = { left: box.x + padX, top: box.y + padY, width: box.w }
    if (vm.kind === 'card' && vm.card) {
      const card = vm.card
      const isOpen = isCardOpen(collapsed, id)
      const full = answers?.get(card.callId)
      const links = isOpen ? linksFor(card) : undefined
      const fromChild = childCallIds.has(card.callId)
      const isSel = selected.has(card.nodeId)
      const cls = [
        c('tnode'),
        isOpen ? c('tnode-open') : '',
        drag?.id === id ? c('tnode-drag') : '',
        fromChild ? c('tnode-child') : '',
        isSel ? c('tnode-sel') : '',
      ]
        .filter(Boolean)
        .join(' ')
      return (
        <div
          key={id}
          className={cls}
          data-tree-node={id}
          data-layout-key={layoutKey}
          style={pos}
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          title={isOpen ? undefined : card.summary}
          onPointerDown={(e) => onCardPointerDown(e, id)}
          onPointerMove={onCardPointerMove}
          onPointerUp={(e) => onCardPointerEnd(e, false)}
          onPointerCancel={(e) => onCardPointerEnd(e, true)}
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false
              return
            }
            toggle(id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggle(id)
            }
          }}
        >
          {vm.followup && <span className={c('tnode-tag')}>{t(angleLabelKey(vm.followup.angle))}</span>}
          <span className={c('tnode-title')}>{plainMath(card.title)}</span>
          {/* 展开且有完整回答时，完整回答已在下方显示，不再重复摘要。 */}
          {(!isOpen || !full) && (
            <span className={c('tnode-sum')}>
              {links ? <LinkedText text={plainMath(card.summary)} links={links} /> : plainMath(card.summary)}
            </span>
          )}
          {isOpen && (
            <div className={c('tnode-detail')} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              {full && <AnswerText text={full} links={links} />}
              {card.knowledgeIds.length > 0 && (
                <div className={c('tnode-kn')}>
                  {t('tree.knowledge')}：{knowledgeLabels(card).join('、')}
                </div>
              )}
              <div className={c('tnode-actions')}>
                <button
                  type="button"
                  className={c('btn')}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleSelect(card.nodeId)
                  }}
                >
                  {isSel ? t('tree.deselect') : t('tree.select')}
                </button>
                <button
                  type="button"
                  className={c('btn')}
                  onClick={(e) => {
                    e.stopPropagation()
                    void copyBranch(card)
                  }}
                >
                  {copied?.id === card.nodeId ? t('tree.copied') : t('tree.copyBranch')}
                </button>
                <button
                  type="button"
                  className={c('btn')}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (fromChild) onLocateChild(card.callId)
                    else jumpToChat(card.callId)
                  }}
                >
                  {t('tree.locate')}
                </button>
              </div>
              {!fromChild && onFreeAsk && <FreeAskInput t={t} onSend={(q) => onFreeAsk(card, q)} />}
            </div>
          )}
        </div>
      )
    }
    const f = vm.followup
    const sent = answering.has(id)
    const busy = busyKey === id
    const text = busy ? t('tree.asking') : sent ? t('side.answering') : (f?.question ?? '')
    // 追问桩始终可拖动（不用 disabled，否则不接收指针事件）；不可追问时用 aria-disabled 并变暗，点击被忽略。
    const askable = busyKey === null && !sent && f !== undefined && !!vm.parentId
    const stubCls = [
      c('tnode'),
      c('tnode-stub'),
      drag?.id === id ? c('tnode-drag') : '',
      askable ? '' : c('tnode-stub-off'),
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <button
        key={id}
        type="button"
        className={stubCls}
        data-tree-node={id}
        data-layout-key={layoutKey}
        style={pos}
        aria-disabled={askable ? undefined : true}
        onPointerDown={(e) => onCardPointerDown(e, id)}
        onPointerMove={onCardPointerMove}
        onPointerUp={(e) => onCardPointerEnd(e, false)}
        onPointerCancel={(e) => onCardPointerEnd(e, true)}
        onClick={() => {
          // 拖动结束后的那次点击不追问。
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          if (!askable) return
          const parent = vm.parentId ? nodeMap.get(vm.parentId)?.card : undefined
          if (parent && vm.followupIndex !== undefined) onAsk(parent, vm.followupIndex)
        }}
      >
        <span className={c('tnode-tag')}>{f ? t(angleLabelKey(f.angle)) : ''}</span>
        <span className={c('tnode-q')}>{text}</span>
      </button>
    )
  })

  return (
    // minWidth:0 让面板在父级 flex 行中不会被画布的固定宽度撑大（否则内容被侧栏裁掉）。
    <div className={c('treepane')} style={{ minWidth: 0 }}>
      <div className={c('tree-bar')}>
        <span>{fmt(t, 'tree.count', { n: view.nodes.length })}</span>
        <span className={c('tree-bar-actions')}>
          {!indented && (
            <button type="button" className={c('btn')} onClick={resetLayout}>
              {t('tree.reset')}
            </button>
          )}
          <button type="button" className={c('btn')} onClick={goLatest}>
            {t('tree.latest')}
          </button>
        </span>
      </div>
      <div className={c('tree-synth')}>
        <span>
          {selected.size > 0 ? fmt(t, 'tree.selectedCount', { n: selected.size }) : ''}
          {synthBusy !== null && (
            <span className={c('tree-synth-hint')}>
              {selected.size > 0 ? '  ' : ''}
              {t('tree.synthHint')}
            </span>
          )}
        </span>
        <span className={c('tree-bar-actions')}>
          {selected.size >= 2 && (
            <button type="button" className={c('btn')} disabled={synthBusy !== null} onClick={() => onSynth('compare')}>
              {synthBusy === 'compare' ? t('tree.synthBusy') : t('tree.compare')}
            </button>
          )}
          {selected.size >= 1 && (
            <button type="button" className={c('btn')} disabled={synthBusy !== null} onClick={() => onSynth('summary')}>
              {synthBusy === 'summary' ? t('tree.synthBusy') : t('tree.summarize')}
            </button>
          )}
          {selected.size >= 1 && (
            <button type="button" className={c('btn')} disabled={synthBusy !== null} onClick={onClearSelect}>
              {t('tree.clearSelect')}
            </button>
          )}
          <button
            type="button"
            className={c('btn')}
            disabled={synthBusy !== null || view.nodes.length < 2}
            onClick={() => onSynth('outline')}
          >
            {synthBusy === 'outline' ? t('tree.synthBusy') : t('tree.outline')}
          </button>
        </span>
      </div>
      {error && <div className={c('tree-err')}>{error}</div>}
      {/* contain: inline-size 使滚动区宽度只由面板决定；画布超宽时在此区域内横向滚动。 */}
      <div
        className={panning ? `${c('tree-scroll')} ${c('tree-panning')}` : c('tree-scroll')}
        ref={scrollRef}
        style={{ overflowX: 'auto', overflowY: 'auto', minWidth: 0, contain: 'inline-size' }}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanEnd}
        onPointerCancel={onPanEnd}
      >
        <div className={c('tree-canvas')} style={{ width: canvas.width, height: canvas.height }}>
          <svg className={c('tree-edges')} width={layout.width} height={layout.height} style={{ left: padX, top: padY }}>
            {layout.edges.map((e) => (
              <path key={`${e.from}>${e.to}`} className={c('tree-edge')} d={e.path} />
            ))}
            {srcEdges.map((e) => (
              <path key={`src:${e.from}>${e.to}`} className={c('tree-edge-src')} d={e.path} />
            ))}
          </svg>
          {boxes}
        </div>
      </div>
      {footer}
    </div>
  )
}
