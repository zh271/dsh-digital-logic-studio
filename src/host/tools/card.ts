// dlogic_card：学习树卡片登记工具。纯逻辑见 card.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { CardRecord, Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import { CARD_PARAMETERS, renderCard, runCard, type CardArgs } from './card.logic.ts'

const DESCRIPTION = [
  '登记一张学习树卡片。每次实质性回答（解题、讲概念、导学、核验）只调用一次，并与计算工具在同一步并行调用（不要等正文写完再登记）；summary 只写题目与思路要点，不写要靠计算结果才知道的具体数字；寒暄、确认类短句不登记。',
  'parentId：用户消息以【追问 nodeId#序号】开头时填该 nodeId，并把 parentFollowup 设为序号，然后只回答前缀之后的问题；',
  '用户自由追问且仍是同一话题时填最近一张卡片的 nodeId（省略 parentFollowup）；换话题或全新问题填 null。',
  'knowledgeIds 与追问的 knowledgeId 可写知识图谱 id（如 k1.5.2）或知识点名称（如“卡诺图化简”，登记时自动匹配 id），不必先查 dlogic_knowledge。',
  'followups 按题目内容给 2～4 个（窄题 2、常规 3、宽题 4），angle 互不相同；至少 2 个（只有 2 个时至少 1 个）knowledgeId 落在本卡片知识点的前置或相关知识上。',
  '导学模式下追问只能是分级提示，不得含答案。正文中不要提及登记、nodeId 或学习树。若返回 warnings，不要重复登记，在之后的卡片中修正。',
].join('')

export const dlogicCard = defineTool({
  name: 'dlogic_card',
  description: DESCRIPTION,
  parameters: CARD_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: CardArgs, value: Envelope<CardRecord>) => [{ type: 'text', text: renderCard(value) }],
    presentationMeta: (_args: CardArgs, value: Envelope<CardRecord>) => ({ v: 1, tool: 'dlogic_card', value }),
  },
  async execute(args: CardArgs, exec: { callId: string }) {
    return runCard(args, exec.callId)
  },
})
