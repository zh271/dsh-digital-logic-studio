// dlogic_card 的纯逻辑：参数结构、登记（校验 + 分配 nodeId）与中文渲染。不依赖 DSH。
import type { CardInput, CardRecord, Envelope } from '../../shared/contracts.ts'
import { shortId, validateCard } from '../../solvers/card.ts'
import { defaultKnowledgeBase } from '../../solvers/knowledge.ts'
import { envelope } from '../envelope.ts'

const ANGLES = ['principle', 'variant', 'pitfall', 'prerequisite', 'verify', 'practice', 'free']
const KINDS = ['solution', 'concept', 'tutor', 'practice', 'compare', 'summary']

export const CARD_PARAMETERS = {
  title: {
    type: 'string',
    required: true,
    description: '卡片标题，例如 "四变量卡诺图化简"。',
  },
  kind: {
    type: 'string',
    required: true,
    enum: KINDS,
    description: '卡片类型：solution 解题核验；tutor 苏格拉底导学；practice 练习或系统设计；concept 概念；compare 比较；summary 小结。',
  },
  summary: {
    type: 'string',
    required: true,
    description: '一两句话概括本卡片回答了什么。',
  },
  knowledgeIds: {
    type: 'array',
    required: true,
    items: { type: 'string' },
    description: '知识点 id 列表，例如 ["k1.5.2"]，取自 dlogic_knowledge。',
  },
  followups: {
    type: 'array',
    required: true,
    description: '2～4 个追问，按题目内容定（最多 6 个），每个为 {question, angle, why, knowledgeId?}。追问必须紧扣本卡片的题目与结论，不得沿用前面卡片的追问或写无关话题。',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string', required: true, description: '学生会点击的问句，不超过 30 个汉字。' },
        angle: {
          type: 'string',
          required: true,
          enum: ANGLES,
          description: '角度：principle 原理 | variant 变式 | pitfall 易错 | prerequisite 前置 | verify 验证 | practice 练习 | free 自拟',
        },
        why: { type: 'string', required: true, description: '半句推荐理由。' },
        knowledgeId: { type: 'string', description: '对应的知识点 id。' },
      },
    },
  },
  parentId: {
    type: 'json',
    required: true,
    description: '父卡片的 nodeId（字符串）；全新问题或换话题时填 null。',
  },
  parentFollowup: {
    type: 'integer',
    description: '展开的是父卡片的第几个追问（从 0 开始）；用户自由提问时省略。',
  },
} as const

export interface CardArgs {
  title: string
  kind: CardInput['kind']
  summary: string
  knowledgeIds: string[]
  followups: CardInput['followups']
  parentId: unknown
  parentFollowup?: number
}

/** 登记一张卡片：校验后分配由 callId 派生的 nodeId。 */
export function runCard(args: CardArgs, callId: string): Envelope<CardRecord> {
  return envelope<CardRecord>('register', () => {
    const kb = defaultKnowledgeBase()
    const { card, warnings } = validateCard(args as unknown as CardInput, kb)
    const knowledgeNames = card.knowledgeIds.map((id) => kb.get(id)?.title ?? id)
    const record: CardRecord = { ...card, nodeId: shortId(callId), callId, knowledgeNames }
    return { result: record, warnings }
  })
}

export function renderCard(value: Envelope<CardRecord>): string {
  if (!value.ok || value.result === null) return `登记失败：${value.error ?? '未知错误'}`
  const r = value.result
  const lines = [`已登记卡片 ${r.nodeId}`]
  if (value.warnings.length) {
    lines.push('注意（本次不要重复登记，请在之后的卡片中修正）：')
    for (const w of value.warnings) lines.push(`- ${w}`)
  }
  return lines.join('\n')
}
