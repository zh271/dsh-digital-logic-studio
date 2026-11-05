// 会话事件定义：按轮次累积本轮的 dlogic_* 工具结果，供图示区（FiguresTail）读取。
// 纯逻辑，不依赖 React，便于单元测试。

export const FIGURES_EVENT_KIND = 'dlogic-figures'
// DSH 要求 Location data 的 key 与定义的 kind 相同，否则会抛错并让整个对话无法渲染。
export const FIGURES_LOCATION_KEY = FIGURES_EVENT_KIND

/** 本轮累积的一条工具结果。 */
export interface FiguresItem {
  seq: number
  callId: string
  meta: unknown
}

export interface FiguresState {
  turn: unknown
  items: FiguresItem[]
}

/** 会话事件的最小形状（只声明本模块用到的字段）。 */
export interface FiguresEvent {
  type: string
  seq: number
  data: {
    turn?: unknown
    message?: { source?: { callId?: unknown }; isError?: unknown }
    meta?: unknown
  }
}

export interface FiguresMatch {
  id: string
  role: 'start' | 'update'
  event: FiguresEvent
}

export interface FiguresLocation {
  kind: 'turn'
  turn: unknown
  key: typeof FIGURES_LOCATION_KEY
  value: { items: FiguresItem[] }
}

/** 是否为本插件的工具结果 meta（v1 信封，工具名以 dlogic_ 开头）。 */
export function isDlogicToolMeta(meta: unknown): boolean {
  if (typeof meta !== 'object' || meta === null) return false
  const m = meta as { v?: unknown; tool?: unknown }
  return m.v === 1 && typeof m.tool === 'string' && m.tool.startsWith('dlogic_')
}

export function figuresMatch(event: FiguresEvent): FiguresMatch | null {
  if (event.type === 'turn/start') {
    return { id: String(event.data.turn), role: 'start', event }
  }
  if (event.type === 'tool/result') {
    if (event.data.message?.isError === true) return null
    if (!isDlogicToolMeta(event.data.meta)) return null
    return { id: String(event.data.turn), role: 'update', event }
  }
  return null
}

export function figuresStart(_context: unknown, match: FiguresMatch): FiguresState {
  return { turn: match.event.data.turn, items: [] }
}

/**
 * 追加一条结果。不属于当前轮、或 callId 已存在时返回原 state（同一引用），
 * 使 buildLocationData 能识别“无变化”。
 */
export function figuresUpdate(context: { state: FiguresState | undefined }, match: FiguresMatch): FiguresState | undefined {
  const state = context.state
  if (state === undefined) return state
  const event = match.event
  if (String(state.turn) !== String(event.data.turn)) return state
  const callId = typeof event.data.message?.source?.callId === 'string' ? event.data.message.source.callId : ''
  if (callId !== '' && state.items.some((item) => item.callId === callId)) return state
  return {
    ...state,
    items: [...state.items, { seq: event.seq, callId, meta: event.data.meta }],
  }
}

export function figuresBuildLocationData(
  context: { state: FiguresState | undefined },
  scope: string,
  previous: Partial<FiguresLocation> | null | undefined,
): FiguresLocation | null {
  if (scope !== 'turn' || context.state === undefined) return null
  const state = context.state
  // 同一轮、同一 items 引用：返回上次的对象，避免无谓刷新。
  if (
    previous?.kind === 'turn' &&
    previous.turn === state.turn &&
    previous.key === FIGURES_LOCATION_KEY &&
    previous.value?.items === state.items
  ) {
    return previous as FiguresLocation
  }
  return { kind: 'turn', turn: state.turn, key: FIGURES_LOCATION_KEY, value: { items: state.items } }
}

/** 传给 ctx.uiConversation.events.register 的定义。 */
export const figuresEventDefinition = {
  kind: FIGURES_EVENT_KIND,
  match: figuresMatch,
  start: figuresStart,
  update: figuresUpdate,
  buildLocationData: figuresBuildLocationData,
}
