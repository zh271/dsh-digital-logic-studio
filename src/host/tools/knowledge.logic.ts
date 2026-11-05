// dlogic_knowledge 的纯逻辑：查询分派与中文渲染。不依赖 DSH。
import { DlogicInputError } from '../../shared/contracts.ts'
import type { Envelope, KnowledgeNode, KnowledgeResultMap } from '../../shared/contracts.ts'
import { defaultKnowledgeBase } from '../../solvers/knowledge.ts'
import { envelope } from '../envelope.ts'

export const KNOWLEDGE_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: ['lookup', 'neighbors', 'search'],
    description: '子功能：lookup 按 id 取知识点；neighbors 取邻域；search 关键词搜索',
  },
  ids: {
    type: 'array',
    items: { type: 'string' },
    description: 'lookup 使用的知识点 id 列表，例如 ["k1.5.2"]。',
  },
  id: {
    type: 'string',
    description: 'neighbors 使用的知识点 id，例如 "k1.5.2"。',
  },
  query: {
    type: 'string',
    description: 'search 使用的关键词，可用空格分隔多个词。',
  },
  limit: {
    type: 'integer',
    description: 'search 返回的最多条数，默认 10。',
  },
} as const

export interface KnowledgeArgs {
  op: string
  ids?: string[]
  id?: string
  query?: string
  limit?: number
}

export type KnowledgeResult = KnowledgeResultMap[keyof KnowledgeResultMap]

export function runKnowledge(args: KnowledgeArgs): Envelope<KnowledgeResult> {
  return envelope<KnowledgeResult>(String(args.op), () => {
    const kb = defaultKnowledgeBase()
    switch (args.op) {
      case 'lookup': {
        const ids = Array.isArray(args.ids) ? args.ids : args.id ? [args.id] : []
        if (ids.length === 0) throw new DlogicInputError('lookup 需要提供 ids（或 id）。')
        const { found, missing } = kb.lookup(ids)
        return { result: { nodes: found, missing } }
      }
      case 'neighbors': {
        const id = args.id ?? (Array.isArray(args.ids) ? args.ids[0] : undefined)
        if (!id) throw new DlogicInputError('neighbors 需要提供 id。')
        const nb = kb.neighbors(id)
        if (!nb.node) throw new DlogicInputError(`未找到知识点“${id}”。`)
        return {
          result: {
            node: nb.node,
            parent: nb.parent,
            children: nb.children,
            prereqs: nb.prereqs,
            dependents: nb.dependents,
            related: nb.related,
          },
        }
      }
      case 'search': {
        if (typeof args.query !== 'string' || args.query.trim() === '') {
          throw new DlogicInputError('search 需要提供 query。')
        }
        return { result: { query: args.query, nodes: kb.search(args.query, args.limit ?? 10) } }
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`)
    }
  })
}

const line = (n: KnowledgeNode): string => `${n.id} ${n.title}`

export function renderKnowledge(value: Envelope<KnowledgeResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const r = value.result
  const lines: string[] = []
  switch (value.op) {
    case 'lookup': {
      const { nodes, missing } = r as KnowledgeResultMap['lookup']
      for (const n of nodes) lines.push(line(n))
      if (missing.length) lines.push(`未找到：${missing.join('、')}`)
      break
    }
    case 'neighbors': {
      const nb = r as KnowledgeResultMap['neighbors']
      lines.push(`${line(nb.node)} 的关联知识：`)
      const section = (label: string, list: KnowledgeNode[]) => {
        if (list.length === 0) return
        lines.push(`${label}：`)
        for (const n of list) lines.push(`  ${line(n)}`)
      }
      section('父节点', nb.parent ? [nb.parent] : [])
      section('子节点', nb.children)
      section('前置知识', nb.prereqs)
      section('后继知识（依赖本节点）', nb.dependents)
      section('相关知识', nb.related)
      break
    }
    case 'search': {
      const { query, nodes } = r as KnowledgeResultMap['search']
      if (nodes.length === 0) {
        lines.push(`未找到与「${query}」相关的知识点。`)
      } else {
        lines.push(`与「${query}」相关的知识点（${nodes.length} 个）：`)
        for (const n of nodes) lines.push(`  ${line(n)}`)
      }
      break
    }
    default:
      lines.push('（无可显示的结果）')
  }
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
