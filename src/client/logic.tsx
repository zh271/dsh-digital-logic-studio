// 布尔表达式的渲染：取反用 overline，而不是 '。
import type { ReactNode } from 'react'
import { c } from './styles.ts'
import { parseExpr, termNodes, type ExprNode } from './logicModel.ts'

function renderNodes(nodes: ExprNode[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.k === 't') return <span key={i}>{n.s}</span>
    if (n.k === 'v') {
      return (
        <span key={i} className={n.neg ? c('neg') : undefined}>
          {n.name}
        </span>
      )
    }
    return (
      <span key={i} className={n.neg ? c('neg') : undefined}>
        {'('}
        {renderNodes(n.children)}
        {')'}
      </span>
    )
  })
}

/** 按文本渲染表达式，例如 "AC'" 显示为 AC 上方加横线；"((AB)'(CD)')'" 中的括号式取反同样处理。 */
export function Expr({ text, variables }: { text: string; variables?: string[] }) {
  return <span className={c('expr')}>{renderNodes(parseExpr(text, variables ?? []))}</span>
}

/** 按三值掩码（SOP 约定）渲染一个乘积项。 */
export function Term({ mask, variables }: { mask: string; variables: string[] }) {
  return <span className={c('expr')}>{renderNodes(termNodes(mask, variables))}</span>
}
