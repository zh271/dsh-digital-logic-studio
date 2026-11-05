// 卡片手动位移的持久化（按主会话分别保存在 localStorage）。
import type { NodeOffsets } from '../../shared/treeLayout.ts'

/** localStorage 键。 */
export function offsetsKey(sessionId: string): string {
  return `dlogic.tree.offsets.${sessionId}`
}

/** 解析持久化的位移 JSON；结构不符的条目被丢弃，永不抛出。 */
export function parseOffsets(raw: unknown): NodeOffsets {
  let v: unknown = raw
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
  const out: NodeOffsets = {}
  for (const [id, o] of Object.entries(v as Record<string, unknown>)) {
    if (typeof o !== 'object' || o === null) continue
    const dx = (o as { dx?: unknown }).dx
    const dy = (o as { dy?: unknown }).dy
    if (typeof dx === 'number' && Number.isFinite(dx) && typeof dy === 'number' && Number.isFinite(dy)) {
      out[id] = { dx: Math.round(dx), dy: Math.round(dy) }
    }
  }
  return out
}

export function loadOffsets(sessionId: string): NodeOffsets {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return {}
    return parseOffsets(localStorage.getItem(offsetsKey(sessionId)))
  } catch {
    return {}
  }
}

export function saveOffsets(sessionId: string, offsets: NodeOffsets): void {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return
    if (Object.keys(offsets).length === 0) localStorage.removeItem(offsetsKey(sessionId))
    else localStorage.setItem(offsetsKey(sessionId), JSON.stringify(offsets))
  } catch {
    // 存储不可用（隐私模式等）时忽略：位移只在本次会话内有效。
  }
}
