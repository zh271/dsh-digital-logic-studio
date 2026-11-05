// 学习树卡片的收起状态（按主会话分别保存在 localStorage）。
// 新卡片默认展开；只记录用户手动收起的卡片 nodeId，已保存的收起状态优先于默认展开。

/** localStorage 键。 */
export function collapsedKey(sessionId: string): string {
  return `dlogic.tree.collapsed.${sessionId}`
}

/** 解析持久化的收起列表（JSON 数组）；结构不符的条目被丢弃，永不抛出。 */
export function parseCollapsed(raw: unknown): Set<string> {
  let v: unknown = raw
  if (typeof raw === 'string') {
    try {
      v = JSON.parse(raw)
    } catch {
      return new Set()
    }
  }
  if (!Array.isArray(v)) return new Set()
  return new Set(v.filter((id): id is string => typeof id === 'string' && id !== ''))
}

/** 卡片是否展开：未在收起集合中即展开（新卡片默认展开）。 */
export function isCardOpen(collapsed: ReadonlySet<string>, nodeId: string): boolean {
  return !collapsed.has(nodeId)
}

/** 切换一张卡片的收起状态，返回新集合（不修改入参）。 */
export function toggleCollapsed(collapsed: ReadonlySet<string>, nodeId: string): Set<string> {
  const next = new Set(collapsed)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  return next
}

export function loadCollapsed(sessionId: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return new Set()
    return parseCollapsed(localStorage.getItem(collapsedKey(sessionId)))
  } catch {
    return new Set()
  }
}

export function saveCollapsed(sessionId: string, collapsed: ReadonlySet<string>): void {
  try {
    if (typeof localStorage === 'undefined' || !sessionId) return
    if (collapsed.size === 0) localStorage.removeItem(collapsedKey(sessionId))
    else localStorage.setItem(collapsedKey(sessionId), JSON.stringify([...collapsed]))
  } catch {
    // 存储不可用时忽略：收起状态只在本次会话内有效。
  }
}
