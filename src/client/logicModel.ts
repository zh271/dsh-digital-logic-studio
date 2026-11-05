// 表达式渲染的纯模型（不依赖 React）：把 "AC'"、"((AB)'(CD)')'" 或三值掩码解析为节点树，
// 取反用节点标记，由 logic.tsx 用 text-decoration: overline 绘制。

export type ExprNode =
  | { k: 't'; s: string }
  | { k: 'v'; name: string; neg: boolean }
  | { k: 'g'; children: ExprNode[]; neg: boolean }

/** 按长度从长到短匹配变量名；未命中时单个字母也视作变量。 */
function matchVar(s: string, pos: number, vars: string[]): string | null {
  const sorted = [...vars].sort((a, b) => b.length - a.length)
  for (const v of sorted) {
    if (v !== '' && s.startsWith(v, pos)) return v
  }
  return /^[A-Za-z]$/.test(s[pos] ?? '') ? s[pos] : null
}

function parseSeq(s: string, start: number, vars: string[], inGroup: boolean): { nodes: ExprNode[]; pos: number } {
  const nodes: ExprNode[] = []
  let pos = start
  while (pos < s.length) {
    const ch = s[pos]
    if (ch === ')' && inGroup) return { nodes, pos }
    if (ch === '(') {
      const inner = parseSeq(s, pos + 1, vars, true)
      pos = inner.pos
      if (s[pos] === ')') pos++
      let neg = false
      while (s[pos] === "'") {
        neg = !neg
        pos++
      }
      nodes.push({ k: 'g', children: inner.nodes, neg })
      continue
    }
    const name = matchVar(s, pos, vars)
    if (name !== null) {
      pos += name.length
      let neg = false
      while (s[pos] === "'") {
        neg = !neg
        pos++
      }
      nodes.push({ k: 'v', name, neg })
      continue
    }
    nodes.push({ k: 't', s: ch })
    pos++
  }
  return { nodes, pos }
}

/** 解析表达式文本。顶层多余的 ")" 与未匹配的字符按文本保留。 */
export function parseExpr(text: string, variables: string[] = []): ExprNode[] {
  return parseSeq(text, 0, variables, false).nodes
}

/**
 * 三值掩码（SOP 约定）转节点：'1' 为原变量，'0' 为反变量，'-' 省略。
 * 全为 '-' 时结果为常量 1。
 */
export function termNodes(mask: string, variables: string[]): ExprNode[] {
  const nodes: ExprNode[] = []
  for (let i = 0; i < mask.length; i++) {
    const bit = mask[i]
    if (bit === '-') continue
    const name = variables[i] ?? `x${i}`
    nodes.push({ k: 'v', name, neg: bit === '0' })
  }
  return nodes.length === 0 ? [{ k: 't', s: '1' }] : nodes
}

/** 节点还原为纯文本（取反写作 '），用于测试与复制。 */
export function plainOf(nodes: ExprNode[]): string {
  return nodes
    .map((n) => {
      if (n.k === 't') return n.s
      if (n.k === 'v') return n.name + (n.neg ? "'" : '')
      return '(' + plainOf(n.children) + ')' + (n.neg ? "'" : '')
    })
    .join('')
}
