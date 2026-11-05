// 浏览器侧入口（DSH client module）。
// 只使用平台共享模块 react 与 react/jsx-runtime。
import type { Context } from '@deepseek-ai/cordis'
import type { CardRecord, TreeView } from '../shared/contracts.ts'
import { BoolCard } from './cards/BoolCard.tsx'
import { KnowledgeCard } from './cards/KnowledgeCard.tsx'
import { LearnCard } from './cards/LearnCard.tsx'
import { CombCard } from './cards/CombCard.tsx'
import { SeqCard } from './cards/SeqCard.tsx'
import { FsmCard } from './cards/FsmCard.tsx'
import { MemCard } from './cards/MemCard.tsx'
import { AddaCard } from './cards/AddaCard.tsx'
import { SystemCard } from './cards/SystemCard.tsx'
import { HdlCard } from './cards/HdlCard.tsx'
import { NumCard } from './cards/NumCard.tsx'
import { VerifyCard } from './cards/VerifyCard.tsx'
import { registerFigures } from './figures/register.ts'
import { registerAskLlm } from './ask/register.ts'
import { askFollowup } from './sidechat/api.ts'
import { registerSidechat } from './sidechat/register.ts'
import { SideChatCollector, SideChatPanel } from './sidechat/SideChatPanel.tsx'
import { en, NS, zh, type TFn } from './locale.ts'
import { injectStyles } from './styles.ts'
import { TreeTab } from './tree/TreeTab.tsx'

injectStyles()

// ---------- 右侧栏：学习树 ----------
const TREE_ID = 'dsh-digital-logic-studio/learning-tree'
const TREE_KIND = 'dlogic-learning-tree'

/** 子会话（侧边追问）的插槽名：标签页内以 SessionProvider 渲染。 */
const SLOT_CONVERSATION = 'dlogic.sidechat.conversation'
const SLOT_COLLECTOR = 'dlogic.sidechat.collector'

// ---------- 插件入口 ----------
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sessions', 'remote', 'remote.commands', 'uiConversation']

export function apply(ctx: Context): void {
  const t: TFn = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dlogic-studio: dictionaries')
  registerSidechat(ctx)
  // 追问改为直接调用模型（覆盖 sidechat 的 askFollowup 实现）；旧子代理代码保留以便回退。
  registerAskLlm(ctx)
  registerFigures(ctx)
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_num', locale: NS }, NumCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_bool', locale: NS }, BoolCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_verify', locale: NS }, VerifyCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_comb', locale: NS }, CombCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_seq', locale: NS }, SeqCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_fsm', locale: NS }, FsmCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_mem', locale: NS }, MemCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_adda', locale: NS }, AddaCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_system', locale: NS }, SystemCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_hdl', locale: NS }, HdlCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: 'dlogic_knowledge', locale: NS }, KnowledgeCard),
  )
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register(
      {
        name: 'tool.call.toolview',
        key: 'dlogic_card',
        locale: NS,
        // 追问一律发往侧边追问子会话（askFollowup），不再向主会话 prompt。
        inject: (sessionId: string) => ({
          ask: (card: CardRecord, index: number, tree: TreeView | undefined) => askFollowup(sessionId, card, index, tree),
        }),
      },
      LearnCard,
    ),
  )
  ctx.effect(
    () =>
      ctx.sidebarRightTabs.register({
        id: TREE_ID,
        kind: TREE_KIND,
        title: () => t('tree.title'),
        guide: [
          {
            id: 'learning-tree',
            order: 50,
            title: () => t('tree.title'),
            description: () => t('tree.guideDescription'),
          },
        ],
      }),
    'dlogic-studio: learning tree type',
  )
  ctx.effect(
    () =>
      ctx.slots.inject('sidebar.right.pane.tab', () =>
        ctx.slots.register(
          {
            name: 'sidebar.right.pane.tab',
            key: TREE_ID,
            locale: NS,
            children: {
              [SLOT_CONVERSATION]: { kind: 'single', scope: 'session' },
              [SLOT_COLLECTOR]: { kind: 'single', scope: 'session' },
            },
          },
          TreeTab,
        ),
      ),
    'dlogic-studio: learning tree body',
  )
  ctx.effect(
    () =>
      ctx.slots.inject(SLOT_CONVERSATION, () =>
        ctx.slots.register({ name: SLOT_CONVERSATION, key: 'dlogic-sidechat', locale: NS }, SideChatPanel),
      ),
    'dlogic-studio: side chat conversation',
  )
  ctx.effect(
    () =>
      ctx.slots.inject(SLOT_COLLECTOR, () =>
        ctx.slots.register({ name: SLOT_COLLECTOR, key: 'dlogic-sidechat', locale: NS }, SideChatCollector),
      ),
    'dlogic-studio: side chat collector',
  )
}
