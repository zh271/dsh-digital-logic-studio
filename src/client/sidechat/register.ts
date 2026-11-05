// 侧边追问的注册与 DSH 运行时对接：实现 askFollowup，并提供子代理 id / 保留句柄的 React 钩子。
import { useEffect, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { CardRecord, TreeView } from '../../shared/contracts.ts'
import { buildFollowupPrompt, FOLLOWUP_COMMAND, type FollowupContext } from '../../shared/sidechat.ts'
import { setAskFollowupImpl, type AskResult } from './api.ts'
import { buildContextPath, PATH_CAP, selectAllFollowupChildren, type CatalogSnapshot } from './context.ts'

const FAIL_TEXT = '追问未能发送，请重试。'

/** 保存 DSH 上下文，供 React 钩子与打开全屏使用。 */
let services: Context | null = null

export function sidechatServices(): Context | null {
  return services
}

/** 当前目录快照中主会话的全部追问子代理 id，旧到新（读取失败时为空数组）。 */
function currentChildIds(parentId: string): string[] {
  try {
    const s = services
    if (!s) return []
    return selectAllFollowupChildren(s.sessions.list.getSnapshot() as CatalogSnapshot, parentId)
  } catch {
    return []
  }
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
}

/** 同一主会话的追问串行执行，避免并发首问创建出两个子代理。 */
const queues = new Map<string, Promise<unknown>>()

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve()
  const next = prev.then(task, task)
  const settled = next.catch(() => undefined)
  queues.set(key, settled)
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key)
  })
  return next
}

async function createChild(ctx: Context, sessionId: string, prompt: string): Promise<AskResult> {
  try {
    const payload = JSON.stringify({ v: 1, prompt })
    const r = await ctx.remote.commands.execute(sessionId, `/${FOLLOWUP_COMMAND} ${payload}`, [])
    if (r && r.ok && r.value !== undefined && r.value.result && r.value.result.kind === 'success') return { ok: true }
    console.warn('[dlogic] follow-up command rejected:', r && (r.ok ? r.value : r.error))
    return { ok: false, error: r?.ok && r.value?.result?.text ? String(r.value.result.text) : FAIL_TEXT }
  } catch (error) {
    console.warn('[dlogic] follow-up command failed:', error)
    return { ok: false, error: FAIL_TEXT }
  }
}

/** 刷新父会话的子代理目录：新版本 DSH 用 refreshSubagents，0.2.x 用 refreshProjections。 */
async function refreshCatalog(ctx: Context, sessionId: string): Promise<void> {
  const sessions = ctx.sessions
  if (typeof sessions.refreshSubagents === 'function') await sessions.refreshSubagents(sessionId)
  else if (typeof sessions.refreshProjections === 'function') await sessions.refreshProjections(sessionId)
}

async function runAsk(ctx: Context, sessionId: string, prompt: string): Promise<AskResult> {
  try {
    await refreshCatalog(ctx, sessionId)
  } catch {
    // 刷新失败时仍用现有快照判断。
  }
  // 每个追问都新开一个子代理：不复用旧子代理，避免后续追问唤醒主对话重答。
  return createChild(ctx, sessionId, prompt)
}

/** 注册追问实现。绝不抛出：任何失败都返回 { ok: false, error }。 */
export function registerSidechat(ctx: Context): void {
  services = ctx
  setAskFollowupImpl(async (sessionId, card: CardRecord, index: number, tree: TreeView | undefined): Promise<AskResult> => {
    try {
      const followup = card.followups?.[index]
      if (!sessionId || !followup) return { ok: false, error: FAIL_TEXT }
      const fctx: FollowupContext = {
        path: buildContextPath(tree, card, PATH_CAP),
        parentNodeId: card.nodeId,
        followupIndex: index,
        question: followup.question,
      }
      const prompt = buildFollowupPrompt(fctx)
      return await enqueue(sessionId, () => runAsk(ctx, sessionId, prompt))
    } catch {
      return { ok: false, error: FAIL_TEXT }
    }
  })
}

/**
 * 当前主会话的全部追问子代理 id（旧到新，最新的是最后一个）；挂载时刷新一次目录，并订阅目录变化。
 * 未绑定 DSH 上下文时为空数组。返回值引用只在内容变化时更新。
 */
export function useFollowupChildIds(sessionId: string | undefined): string[] {
  const [childIds, setChildIds] = useState<string[]>(() => (sessionId ? currentChildIds(sessionId) : []))
  useEffect(() => {
    const s = services
    if (!s || !sessionId) {
      setChildIds(EMPTY_IDS)
      return
    }
    let alive = true
    const update = (): void => {
      if (!alive) return
      const next = currentChildIds(sessionId)
      setChildIds((prev) => (sameIds(prev, next) ? prev : next))
    }
    update()
    let unsubscribe: unknown
    try {
      unsubscribe = s.sessions.list.subscribe(update)
    } catch {
      unsubscribe = undefined
    }
    try {
      void refreshCatalog(s, sessionId).then(update, update)
    } catch {
      // 刷新失败时保留当前快照。
    }
    return () => {
      alive = false
      if (typeof unsubscribe === 'function') unsubscribe()
      else if (unsubscribe && typeof (unsubscribe as { unsubscribe?: unknown }).unsubscribe === 'function') {
        ;(unsubscribe as { unsubscribe: () => void }).unsubscribe()
      }
    }
  }, [sessionId])
  return childIds
}

const EMPTY_IDS: string[] = []

/**
 * 保留子会话的句柄（渲染子会话视图所需）。子 id 变化时释放旧句柄、保留新句柄。
 * 返回值可直接传给 SessionProvider。
 */
export function useRetainedChild(parentId: string | undefined, childId: string | undefined): unknown {
  const [handle, setHandle] = useState<unknown>(undefined)
  useEffect(() => {
    const s = services
    if (!s || !parentId || !childId) {
      setHandle(undefined)
      return
    }
    let ref: { release?: () => void } | undefined
    try {
      ref = s.sessions.retain(
        { parentSessionId: parentId, childSessionId: childId, mode: 'continuable' },
        { source: 'dlogicSidechatView', signal: new AbortController().signal },
      )
    } catch {
      ref = undefined
    }
    setHandle(ref)
    return () => {
      try {
        ref?.release?.()
      } catch {
        // 已释放时忽略。
      }
      setHandle(undefined)
    }
  }, [parentId, childId])
  return handle
}

/** 在主区域全屏打开追问子会话。失败时返回 false。 */
export function openSideChatFullscreen(parentId: string, childId: string): boolean {
  try {
    const s = services
    if (!s) return false
    const address = { parentSessionId: parentId, childSessionId: childId, mode: 'continuable' }
    // 新版本 DSH：sessions.openSubagent；0.2.x：uiWorkspace.openSession（ui-subagent 即如此打开子会话）。
    if (typeof s.sessions.openSubagent === 'function') {
      void Promise.resolve(s.sessions.openSubagent(address)).catch(() => undefined)
      return true
    }
    const workspace = typeof s.get === 'function' ? s.get('uiWorkspace') : undefined
    if (workspace && typeof workspace.openSession === 'function') {
      workspace.openSession(address)
      return true
    }
    return false
  } catch {
    return false
  }
}
