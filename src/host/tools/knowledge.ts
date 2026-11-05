// dlogic_knowledge：知识图谱查询工具。纯逻辑见 knowledge.logic.ts。
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { Envelope } from '../../shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../envelope.ts'
import {
  KNOWLEDGE_PARAMETERS,
  renderKnowledge,
  runKnowledge,
  type KnowledgeArgs,
  type KnowledgeResult,
} from './knowledge.logic.ts'

const DESCRIPTION = [
  '数字逻辑知识图谱（教材 k 编号体系，如 k1.5.2 表示“用卡诺图简化逻辑函数”）。',
  'lookup 按 id 取知识点；neighbors 取某知识点的父节点、子节点、前置、后继与相关知识；search 按关键词搜索。',
  '登记学习树卡片前，knowledgeIds 应从本工具结果中选取；不确定 id 时先用 search。',
].join('')

export const dlogicKnowledge = defineTool({
  name: 'dlogic_knowledge',
  description: DESCRIPTION,
  parameters: KNOWLEDGE_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args: KnowledgeArgs, value: Envelope<KnowledgeResult>) => [
      { type: 'text', text: renderKnowledge(value) },
    ],
    presentationMeta: (_args: KnowledgeArgs, value: Envelope<KnowledgeResult>) => ({
      v: 1,
      tool: 'dlogic_knowledge',
      value,
    }),
  },
  async execute(args: KnowledgeArgs) {
    return runKnowledge(args)
  },
})
