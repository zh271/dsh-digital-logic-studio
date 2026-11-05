// 侧边追问的前端入口（接口由负责人定，实现由 sidechat 模块负责）。
// 图示区（figures/**）、学习树（tree/**）、对话内的学习卡片都只通过 askFollowup 发起追问，
// 绝不再向主会话 prompt。

import type { CardRecord, TreeView } from '../../shared/contracts.ts'

export interface AskResult {
  ok: boolean
  /** 失败时给用户看的一句话。 */
  error?: string
}

/**
 * 发起一次追问：在主会话 `sessionId` 的追问子代理里回答 `card` 的第 `index` 个追问。
 * 首次追问时通过 Host 命令创建子代理；之后直接向已有子代理续问。
 * `tree` 用于拼出从根到 `card` 的上下文路径（传主会话的学习树视图即可）。
 */
export type AskFollowup = (sessionId: string, card: CardRecord, index: number, tree: TreeView | undefined) => Promise<AskResult>

/** 由 sidechat 模块在 apply 时用真实实现替换。 */
let impl: AskFollowup = async () => ({ ok: false, error: '追问功能尚未就绪' })

export function setAskFollowupImpl(next: AskFollowup): void {
  impl = next
}

export const askFollowup: AskFollowup = (sessionId, card, index, tree) => impl(sessionId, card, index, tree)
