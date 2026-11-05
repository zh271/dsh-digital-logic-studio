// 直接回答的存储：按主会话 id 分键，写入 localStorage；所有存取都 try/catch，失败时只用内存缓存。
import { useCallback, useSyncExternalStore } from 'react'
import { addAskEntry, askStorageKey, parseAskEntries, serializeAskEntries, type AskEntry } from './entries.ts'

const EMPTY: readonly AskEntry[] = []
const cache = new Map<string, readonly AskEntry[]>()
const listeners = new Map<string, Set<() => void>>()

function readStored(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // 存储不可用（隐私窗口、配额等）时只保留内存缓存。
  }
}

/** 读取某主会话的全部直接回答（旧到新）。 */
export function loadAskEntries(sessionId: string): readonly AskEntry[] {
  if (!sessionId) return EMPTY
  const hit = cache.get(sessionId)
  if (hit) return hit
  const list = parseAskEntries(readStored(askStorageKey(sessionId)))
  cache.set(sessionId, list)
  return list
}

/** 追加一条直接回答并通知订阅者；重复 callId 不写入。 */
export function addAskAnswer(sessionId: string, entry: AskEntry): void {
  if (!sessionId) return
  const cur = loadAskEntries(sessionId)
  const next = addAskEntry(cur, entry)
  if (next === cur) return
  cache.set(sessionId, next)
  writeStored(askStorageKey(sessionId), serializeAskEntries(next))
  listeners.get(sessionId)?.forEach((fn) => fn())
}

export function subscribeAskEntries(sessionId: string, listener: () => void): () => void {
  let set = listeners.get(sessionId)
  if (!set) {
    set = new Set()
    listeners.set(sessionId, set)
  }
  const bucket = set
  bucket.add(listener)
  return () => {
    bucket.delete(listener)
  }
}

/** React 钩子：订阅某主会话的直接回答列表。 */
export function useAskEntries(sessionId: string | undefined): readonly AskEntry[] {
  const sid = sessionId ?? ''
  const subscribe = useCallback((listener: () => void) => subscribeAskEntries(sid, listener), [sid])
  return useSyncExternalStore(
    subscribe,
    () => loadAskEntries(sid),
    () => EMPTY,
  )
}
