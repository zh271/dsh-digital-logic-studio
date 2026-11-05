// 侧边追问的两个子会话插槽组件：会话对话面板（dlogic.sidechat.conversation）与卡片采集器（dlogic.sidechat.collector）。
// 二者都运行在子会话的 SessionProvider 之内，由学习树标签页通过 renderSlot 渲染。
import { useEffect } from 'react'
import { TREE_PROJECTION_KEY, type CardRecord, type TreeView } from '../../shared/contracts.ts'

/** 固定只显示对话视图的包装，供 conversation.content 的 views 插槽使用。 */
export function FixedChatView(props: { renderSlot: (name: string, owner: Record<string, unknown>) => unknown }) {
  return props.renderSlot('conversation.session', { view: 'chat' }) as never
}

/** 嵌入式对话面板：沿用 DSH 子代理侧栏的渲染方式（conversation.content，embedded 变体）。 */
export function SideChatPanel(props: {
  sessionId?: string
  useSession: (selector: (v: any) => any) => any
  useConversation: (selector: (v: any) => any) => any
  useSessions: (selector: (v: any) => any) => any
  renderFactorySlot: (name: string, owner: Record<string, unknown>, extra?: Record<string, unknown>) => unknown
}) {
  const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props
  const session = useSession((v: any) => v)
  const shellPhase =
    useConversation((v: any) => v).activeTargets.size > 0 || (!session.blank && !session.awaitingFirstTurn) || session.running
      ? 'active'
      : session.promptAttempted
        ? 'engaging'
        : 'blank'
  const summaryBlank = useSessions((s: any) => s.byId[sessionId ?? '']?.blank)
  const settling = shellPhase === 'blank' && session.openState === 'loading' && summaryBlank !== true
  const hero = shellPhase === 'blank' && (session.openState === 'open' || summaryBlank === true)
  return renderFactorySlot(
    'conversation.content',
    { variant: 'embedded', phase: settling ? 'settling' : hero ? 'hero' : 'active', hero },
    { slots: { views: FixedChatView } },
  )
}

/** 采集子会话的学习卡片，经 onNodes 上报给标签页（无可见输出）。 */
export function SideChatCollector(props: {
  useProjection?: (key: string) => unknown
  onNodes?: (nodes: CardRecord[]) => void
}) {
  const project = props.useProjection
  const view = project ? (project(TREE_PROJECTION_KEY) as TreeView | undefined) : undefined
  const onNodes = props.onNodes
  useEffect(() => {
    onNodes?.(Array.isArray(view?.nodes) ? view.nodes : [])
  }, [view, onNodes])
  return null
}
