// dlogic_knowledge 工具卡片：把 lookup / search / neighbors 的结果整理为分组列表，默认折叠。
import type { KnowledgeNode, KnowledgeResultMap } from '../../shared/contracts.ts'
import { argsRawOf, firstArgText, isSettled, parseArgs, readMeta, resultText, type ToolViewProps } from '../meta.ts'
import { fmt, type TFn } from '../locale.ts'
import { c } from '../styles.ts'
import { Boundary, Card, MutedRow, TextBody } from './Frame.tsx'

const TOOL = 'dlogic_knowledge'
type KnowledgeResult = KnowledgeResultMap[keyof KnowledgeResultMap]

interface Section {
  label: string
  nodes: KnowledgeNode[]
}

function validNodes(list: unknown): KnowledgeNode[] {
  if (!Array.isArray(list)) return []
  return list.filter((n): n is KnowledgeNode => typeof n === 'object' && n !== null && typeof (n as KnowledgeNode).id === 'string')
}

/** 把三种 op 的结果统一为分组列表；未知结构返回空。 */
function sectionsOf(op: string, r: KnowledgeResult, t: TFn): { sections: Section[]; missing: string[] } {
  if (op === 'neighbors') {
    const x = r as KnowledgeResultMap['neighbors']
    const parent = validNodes([x.parent])
    return {
      sections: [
        { label: t('know.sec.self'), nodes: validNodes([x.node]) },
        { label: t('know.sec.parent'), nodes: parent },
        { label: t('know.sec.children'), nodes: validNodes(x.children) },
        { label: t('know.sec.prereqs'), nodes: validNodes(x.prereqs) },
        { label: t('know.sec.dependents'), nodes: validNodes(x.dependents) },
        { label: t('know.sec.related'), nodes: validNodes(x.related) },
      ].filter((s) => s.nodes.length > 0),
      missing: [],
    }
  }
  if (op === 'search') {
    const x = r as KnowledgeResultMap['search']
    return { sections: [{ label: t('know.sec.search'), nodes: validNodes(x.nodes) }], missing: [] }
  }
  const x = r as KnowledgeResultMap['lookup']
  return {
    sections: [{ label: t('know.sec.nodes'), nodes: validNodes(x.nodes) }],
    missing: Array.isArray(x.missing) ? x.missing.filter((m): m is string => typeof m === 'string') : [],
  }
}

export function KnowledgeCard({ t, phase, block }: ToolViewProps) {
  if (phase === 'preparing') return <MutedRow tool={TOOL} title={t('know.title')} text={t('know.preparing')} />
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ['ids', 'id', 'query'])
    return <MutedRow tool={TOOL} title={t('know.title')} text={`${t('know.running')} ${hint}`.trim()} />
  }
  const isError = block.isError === true
  const value = readMeta<KnowledgeResult>(block, TOOL)
  if (isError || value === null) {
    return (
      <Card tool={TOOL} title={t('know.title')} summary="" isError={isError} defaultOpen={false}>
        <TextBody text={resultText(block)} />
      </Card>
    )
  }
  if (!value.ok) {
    return <MutedRow tool={TOOL} title={t('know.title')} text={`${t('know.failed')}：${value.error ?? ''}`} isError />
  }
  const op = value.op
  const built = sectionsOf(op, value.result as KnowledgeResult, t)
  const total = built.sections.reduce((n, s) => n + s.nodes.length, 0)
  return (
    <Card tool={TOOL} title={t('know.title')} summary={fmt(t, 'know.count', { n: total })} defaultOpen={false}>
      <Boundary fallback={<TextBody text={resultText(block)} />}>
        <div className={c('step')}>
          {built.sections.map((s, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div className={c('step-text')}>{s.label}</div>
              <ul className={c('list')}>
                {s.nodes.map((n) => (
                  <li key={n.id}>
                    <span className={c('id')}>{n.id}</span>
                    <span>{n.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {built.missing.length > 0 && (
            <div className={c('muted')} style={{ fontSize: 12 }}>
              {fmt(t, 'know.missing', { ids: built.missing.join(', ') })}
            </div>
          )}
        </div>
      </Boundary>
    </Card>
  )
}
