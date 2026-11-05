// 侧边追问的共享约定：Host 命令、子代理标签、上下文包格式。
// Host（src/host/followup.ts）与前端（src/client/sidechat/**、figures/**、tree/**）都依赖这里。
// 修改前先与负责人确认。只用可擦除语法。

import type { CardRecord } from './contracts.ts'
import { followupPrefix } from './contracts.ts'

/** Host 命令名：前端执行 `/${FOLLOWUP_COMMAND} <json>`。 */
export const FOLLOWUP_COMMAND = 'dlogic-ask'

/** 追问子代理的显示标签（每个主会话一个）。前端靠它在子会话目录里找到它。 */
export const FOLLOWUP_CHILD_LABEL = '数字逻辑追问'

/** 命令的 rawInput（JSON 字符串）。 */
export interface FollowupCommandInput {
  v: 1
  /** 发给子代理的完整文本（含上下文包与追问前缀），由 buildFollowupPrompt 生成。 */
  prompt: string
}

/** 从根到父卡片的一条路径，用于给子代理补上下文。 */
export interface FollowupContext {
  /** 从根卡片到被追问卡片（含）的路径，按顺序。 */
  path: Pick<CardRecord, 'nodeId' | 'title' | 'summary' | 'knowledgeIds'>[]
  /** 被追问卡片的 nodeId。 */
  parentNodeId: string
  /** 第几个追问（从 0 开始）。 */
  followupIndex: number
  question: string
}

/**
 * 生成发给追问子代理的消息。首条和后续追问都用同一格式，
 * 因为子代理看不到主对话之后新出现的卡片。
 */
export function buildFollowupPrompt(c: FollowupContext): string {
  const lines = [
    followupPrefix(c.parentNodeId, c.followupIndex) + c.question,
    '',
    '【背景】这是主对话学习树上的追问。主对话中的相关卡片如下（从根到当前）：',
    ...c.path.map((n, i) => `${i + 1}. ${n.title}：${n.summary}（知识点 ${n.knowledgeIds.join('、') || '无'}；卡片 ${n.nodeId}）`),
    '',
    `【要求】按 digital-logic-tutor 技能只回答上面这一个追问；回答结束时调用 dlogic_card，parentId 为 ${c.parentNodeId}，parentFollowup 为 ${c.followupIndex}。`,
  ]
  return lines.join('\n')
}

/** 子代理的首条系统式开场（Host 在 startContinuable 时作为 prompt 的前缀）。 */
export const FOLLOWUP_OPENING =
  '你是《数字逻辑》学习树的追问助手，只负责回答学生从学习树点开的追问。' +
  '先加载 digital-logic-tutor 技能并严格遵守；每条消息都包含背景与要求，按要求回答并登记卡片。'
