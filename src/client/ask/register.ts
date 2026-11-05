// 直接模型追问的注册：把 DSH 远程命令交给 api.ts，并把追问入口切换为“直接回答”。
// 由 src/client/index.tsx 在 registerSidechat 之后调用，覆盖 sidechat 的 askFollowup 实现。
// 旧子代理流程的文件保持不动（回退用）。
import type { Context } from '@deepseek-ai/cordis'
import type { CardRecord, TreeView } from '../../shared/contracts.ts'
import { setAskFollowupImpl, type AskResult } from '../sidechat/api.ts'
import { buildContextPath } from '../sidechat/context.ts'
import { askFollowupLlm, setAskLlmRemote } from './api.ts'
import { buildAskEntry, randomToken } from './entries.ts'
import { addAskAnswer } from './store.ts'

const NO_QUESTION_TEXT = '追问未能发送，请重试。'

export function registerAskLlm(ctx: Context): void {
  setAskLlmRemote((sessionId, commandText) => ctx.remote.commands.execute(sessionId, commandText, []))
  setAskFollowupImpl(async (sessionId: string, card: CardRecord, index: number, tree: TreeView | undefined): Promise<AskResult> => {
    try {
      const question = card.followups[index]?.question
      if (typeof question !== 'string' || question.trim() === '') return { ok: false, error: NO_QUESTION_TEXT }
      const path = buildContextPath(tree, card, Number.POSITIVE_INFINITY)
      const r = await askFollowupLlm(sessionId, buildContextPath(tree, card), question)
      if (!r.ok) return { ok: false, error: r.error }
      addAskAnswer(
        sessionId,
        buildAskEntry({
          parent: card,
          index,
          followup: card.followups[index],
          explored: path.flatMap((n) => n.knowledgeIds),
          question,
          answer: r.text,
          followups: r.followups,
          now: Date.now(),
          token: randomToken(),
        }),
      )
      return { ok: true }
    } catch (error) {
      console.warn('[dlogic] direct follow-up failed:', error)
      return { ok: false, error: NO_QUESTION_TEXT }
    }
  })
}
