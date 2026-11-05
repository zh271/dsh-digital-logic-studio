// 合并主会话与追问子会话的卡片（纯函数，可单测）。
import type { CardRecord } from '../../shared/contracts.ts'

/**
 * 按 callId 去重合并：主会话卡片在前，子会话卡片按出现顺序在后。
 * 同一 callId 只保留先出现的一条。
 * 子会话各自生成 nodeId，可能与主会话（或更早的子卡片）重名；重名的子卡片改为 `${nodeId}-k`，
 * 否则树构建时会被静默丢弃，其追问槽位又会重新显示为未展开的桩。
 * 主会话卡片保持原样（同一对象引用）。
 */
export function mergeCards(main: readonly CardRecord[], child: readonly CardRecord[]): CardRecord[] {
  const seen = new Set<string>()
  const usedIds = new Set<string>()
  const out: CardRecord[] = []
  for (const card of main) {
    if (seen.has(card.callId)) continue
    seen.add(card.callId)
    usedIds.add(card.nodeId)
    out.push(card)
  }
  for (const card of child) {
    if (seen.has(card.callId)) continue
    seen.add(card.callId)
    let nodeId = card.nodeId
    if (usedIds.has(nodeId)) {
      let k = 2
      while (usedIds.has(`${card.nodeId}-${k}`)) k++
      nodeId = `${card.nodeId}-${k}`
    }
    usedIds.add(nodeId)
    out.push(nodeId === card.nodeId ? card : { ...card, nodeId })
  }
  return out
}

/** 子会话卡片的 callId 集合（不在主会话中出现的）。用于判断一张卡片来自哪边。 */
export function childOnlyCallIds(main: readonly CardRecord[], child: readonly CardRecord[]): Set<string> {
  const mainIds = new Set(main.map((c) => c.callId))
  const out = new Set<string>()
  for (const c of child) if (!mainIds.has(c.callId)) out.add(c.callId)
  return out
}

/** 两个卡片列表是否按 callId 逐项相同（用于避免无变化时的重复 setState）。 */
export function sameCards(a: readonly CardRecord[], b: readonly CardRecord[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i].callId !== b[i].callId || a[i].nodeId !== b[i].nodeId) return false
  return true
}

/**
 * 仍处于“回答中…”的追问槽位：已发出、尚未登记卡片（不在 filled 中），且发出未超过 timeoutMs。
 * 超时后视为子代理已结束却没产出卡片，不再转圈。sent 为 槽位键 -> 发出时刻（毫秒）。
 */
export function pendingSlotKeys(
  sent: ReadonlyMap<string, number>,
  filled: ReadonlySet<string>,
  now: number,
  timeoutMs: number,
): Set<string> {
  const out = new Set<string>()
  for (const [key, at] of sent) {
    if (filled.has(key)) continue
    if (now - at < timeoutMs) out.add(key)
  }
  return out
}
