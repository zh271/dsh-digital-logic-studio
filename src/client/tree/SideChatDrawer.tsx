// 学习树底部的“侧边追问”抽屉：默认收起，展开后占面板约 55%，可用分隔条调整高度。
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'

const DEFAULT_FRAC = 0.55
const FRAC_MIN = 0.2
const FRAC_MAX = 0.85

function openKey(sessionId: string): string {
  return `dlogic.sidechat.open.${sessionId}`
}

/** 读取抽屉展开状态；默认收起。 */
export function readDrawerOpen(sessionId: string | undefined): boolean {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return false
    return localStorage.getItem(openKey(sessionId)) === '1'
  } catch {
    return false
  }
}

export function writeDrawerOpen(sessionId: string | undefined, open: boolean): void {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return
    localStorage.setItem(openKey(sessionId), open ? '1' : '0')
  } catch {
    // 存储不可用时忽略：本次会话内仍可用。
  }
}

export interface SideChatDrawerProps {
  t: TFn
  open: boolean
  /** 是否有内容可显示（没有时抽屉禁用）。 */
  canOpen: boolean
  /** 全屏按钮只对旧子代理对话有效。 */
  canFullscreen: boolean
  turns: number
  answering: boolean
  onToggle: () => void
  onFullscreen: () => void
  /** 展开时显示的内容（直接回答列表，或旧子代理对话；由标签页决定）。 */
  conversation: ReactNode
  /** 始终挂载的隐藏采集器（上报子会话卡片）。 */
  collector: ReactNode
}

export function SideChatDrawer(props: SideChatDrawerProps) {
  const { t, open, canOpen, canFullscreen, turns, answering, onToggle, onFullscreen, conversation, collector } = props
  const [frac, setFrac] = useState(DEFAULT_FRAC)
  const dragRef = useRef<{ startY: number; startFrac: number; height: number } | null>(null)
  const expanded = open && canOpen

  const onSplitDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const pane = e.currentTarget.closest(`.${c('treepane')}`) as HTMLElement | null
    const height = pane?.getBoundingClientRect().height ?? 0
    if (!height) return
    dragRef.current = { startY: e.clientY, startFrac: frac, height }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // 不支持捕获时仍按移动事件调整。
    }
  }

  const onSplitMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const d = dragRef.current
    if (!d) return
    const next = d.startFrac - (e.clientY - d.startY) / d.height
    setFrac(Math.min(FRAC_MAX, Math.max(FRAC_MIN, next)))
  }

  const onSplitEnd = (): void => {
    dragRef.current = null
  }

  const status = canOpen
    ? answering
      ? t('side.answering')
      : fmt(t, 'side.turns', { n: turns })
    : t('side.hint')

  return (
    <div className={c('side') + (expanded ? ' ' + c('side-open') : '')} style={expanded ? { height: `${Math.round(frac * 100)}%` } : undefined}>
      {expanded && (
        <div
          className={c('side-split')}
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={onSplitDown}
          onPointerMove={onSplitMove}
          onPointerUp={onSplitEnd}
          onPointerCancel={onSplitEnd}
        />
      )}
      <div
        className={c('side-bar')}
        role="button"
        tabIndex={canOpen ? 0 : -1}
        aria-expanded={expanded}
        aria-disabled={!canOpen}
        onClick={() => {
          if (canOpen) onToggle()
        }}
        onKeyDown={(e) => {
          if (canOpen && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <span className={c('side-chev')} aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
        <span className={c('side-title')}>{t('side.title')}</span>
        <span className={c('side-meta')}>{status}</span>
        {canOpen && canFullscreen && (
          <button
            type="button"
            className={c('btn')}
            onClick={(e) => {
              e.stopPropagation()
              onFullscreen()
            }}
          >
            {t('side.fullscreen')}
          </button>
        )}
      </div>
      {expanded && <div className={c('side-body')}>{conversation}</div>}
      <div style={{ display: 'none' }}>{collector}</div>
    </div>
  )
}
