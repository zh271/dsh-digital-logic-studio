// Host 侧入口：注册确定性工具、随包技能与学习树会话投影。
import type { Context } from '@deepseek-ai/cordis'
import { dlogicNum } from './tools/num.ts'
import { dlogicBool } from './tools/bool.ts'
import { dlogicVerify } from './tools/verify.ts'
import { dlogicKnowledge } from './tools/knowledge.ts'
import { dlogicCard } from './tools/card.ts'
import { dlogicComb } from './tools/comb.ts'
import { dlogicSeq } from './tools/seq.ts'
import { dlogicFsm } from './tools/fsm.ts'
import { dlogicMem } from './tools/mem.ts'
import { dlogicAdda } from './tools/adda.ts'
import { dlogicSystem } from './tools/system.ts'
import { dlogicHdl } from './tools/hdl.ts'
import { registerTreeProjection } from './projection.ts'
import { registerFollowupCommand } from './followup.ts'
import { registerAskLlmCommand } from './ask.ts'
import { skillProvider } from './skill.ts'

export const name = 'dsh-digital-logic-studio'
export const inject = ['tools', 'skills']

export function apply(ctx: Context): void {
  ctx.tools.register(dlogicNum)
  ctx.tools.register(dlogicBool)
  ctx.tools.register(dlogicVerify)
  ctx.tools.register(dlogicKnowledge)
  ctx.tools.register(dlogicCard)
  ctx.tools.register(dlogicComb)
  ctx.tools.register(dlogicSeq)
  ctx.tools.register(dlogicFsm)
  ctx.tools.register(dlogicMem)
  ctx.tools.register(dlogicAdda)
  ctx.tools.register(dlogicSystem)
  ctx.tools.register(dlogicHdl)
  ctx.skills.registerProvider(() => skillProvider)
  ctx.inject(['sessionProjections'], (inner: Parameters<typeof registerTreeProjection>[0]) => {
    registerTreeProjection(inner)
  })
  registerFollowupCommand(ctx)
  registerAskLlmCommand(ctx)
}
