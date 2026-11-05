// 图示区的注册入口：会话事件定义、文案、样式与 conversation.chat.turnTail 槽位。
// 由 src/client/index.tsx 调用 registerFigures(ctx)。
import type { Context } from '@deepseek-ai/cordis'
import { askFollowup } from '../sidechat/api.ts'
import { figuresEventDefinition } from './definition.ts'
import { FiguresTail } from './FiguresTail.tsx'
import { FIGURES_NS, figuresEn, figuresZh } from './locale.ts'
import { injectFigureStyles } from './styles.ts'

export const FIGURES_SLOT_ID = 'dsh-digital-logic-studio/figures'

export function registerFigures(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(FIGURES_NS, { zh: figuresZh, en: figuresEn }), 'dlogic-figures: dictionaries')
  ctx.effect(() => injectFigureStyles(), 'dlogic-figures: styles')
  ctx.effect(() => ctx.uiConversation.events.register(figuresEventDefinition), 'dlogic-figures: conversation events')
  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register(
      {
        name: 'conversation.chat.turnTail',
        id: FIGURES_SLOT_ID,
        locale: FIGURES_NS,
        inject: (sessionId: string) => ({
          ask: (card: Parameters<typeof askFollowup>[1], index: number, tree: Parameters<typeof askFollowup>[3]) =>
            askFollowup(sessionId, card, index, tree),
        }),
      },
      FiguresTail,
    ),
  )
}
