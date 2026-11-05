// 把残留的 LaTeX 转为可读的纯文本（不引入数学渲染器，纯函数，可单测）。
// 只处理含 \ 或 $ 的文本；代码片段（反引号包裹）原样保留；任何异常都返回原文。

const SYMBOLS: Record<string, string> = {
  cdot: '·',
  oplus: '⊕',
  times: '×',
  land: '∧',
  lor: '∨',
  neg: '¬',
  lnot: '¬',
  leq: '≤',
  geq: '≥',
  neq: '≠',
  rightarrow: '→',
  to: '→',
  Rightarrow: '⇒',
  sum: 'Σ',
  prod: '∏',
  ldots: '…',
  cdots: '…',
  dots: '…',
  quad: ' ',
  qquad: ' ',
}

/** 仅透传内容、丢弃命令名的字体/文本命令。 */
const WRAPPERS = new Set(['text', 'mathrm', 'mathbf', 'mathit', 'textbf', 'mathsf', 'texttt', 'operatorname'])

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}
const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
}

/** 读取一个参数：花括号组（支持嵌套）或单个字符。失败返回 null。 */
function readArg(s: string, i: number): { arg: string; next: number } | null {
  if (i >= s.length) return null
  if (s[i] !== '{') return { arg: s[i]!, next: i + 1 }
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '{') depth++
    else if (s[j] === '}') {
      depth--
      if (depth === 0) return { arg: s.slice(i + 1, j), next: j + 1 }
    }
  }
  return null
}

/** 上划线（非）：单个变量或变量加下标写作 X'，其余写作 (X)'。 */
function negate(inner: string): string {
  const t = inner.trim().replace(/_\{([A-Za-z0-9]+)\}/g, '_$1')
  if (/^[A-Za-z](?:[0-9]+|_[A-Za-z0-9]+)?$/.test(t)) return t + "'"
  return `(${t})'`
}

/** LaTeX 规则：命令名后紧随的一个空格不输出。 */
function skipOneSpace(s: string, i: number): number {
  return s[i] === ' ' ? i + 1 : i
}

/** 转换命令（\frac、\overline、符号、字体命令等），递归处理参数。 */
function convertCommands(s: string): string {
  let out = ''
  let i = 0
  while (i < s.length) {
    const ch = s[i]!
    if (ch !== '\\') {
      out += ch
      i++
      continue
    }
    const next = s[i + 1]
    if (next === undefined) {
      i++
      continue
    }
    if (next === ',' || next === ';' || next === ' ') {
      out += ' '
      i += 2
      continue
    }
    if (next === '!') {
      i += 2
      continue
    }
    if (next === '{' || next === '}' || next === '_' || next === '%' || next === '&' || next === '#') {
      // 转义的字符：用占位符保护，最后再还原（避免被当作分组符号删除）。
      out += next === '{' ? '\u0001' : next === '}' ? '\u0002' : next
      i += 2
      continue
    }
    const m = /^[A-Za-z]+/.exec(s.slice(i + 1))
    if (!m) {
      // 其余孤立的反斜杠：丢弃。
      i++
      continue
    }
    const name = m[0]
    const after = i + 1 + name.length
    if (name === 'frac') {
      const a = readArg(s, after)
      const b = a ? readArg(s, a.next) : null
      if (a && b) {
        out += `(${convertCommands(a.arg)})/(${convertCommands(b.arg)})`
        i = b.next
        continue
      }
    } else if (name === 'overline' || name === 'bar') {
      const a = readArg(s, after)
      if (a) {
        out += negate(convertCommands(a.arg))
        i = a.next
        continue
      }
    } else if (WRAPPERS.has(name)) {
      const a = readArg(s, after)
      if (a) {
        out += convertCommands(a.arg)
        i = a.next
        continue
      }
    } else if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
      out += SYMBOLS[name]
      i = skipOneSpace(s, after)
      continue
    }
    // 未知命令：丢弃命令名（同样吞掉紧随的一个空格），其后的花括号内容保留（花括号稍后去掉）。
    i = skipOneSpace(s, after)
  }
  return out
}

/** 下标与上标：纯数字时转 Unicode 字符，其余保留 _x / ^x 形式。 */
function convertScripts(s: string): string {
  const sub = (content: string): string =>
    /^\d+$/.test(content) ? Array.from(content, (d) => SUBSCRIPT[d]).join('') : `_${content}`
  const sup = (content: string): string =>
    /^\d+$/.test(content) ? Array.from(content, (d) => SUPERSCRIPT[d]).join('') : `^${content}`
  return s
    .replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_m, a: string | undefined, b: string | undefined) => sub(a ?? b ?? ''))
    .replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9])/g, (_m, a: string | undefined, b: string | undefined) => sup(a ?? b ?? ''))
}

/** 转换一段非代码文本。 */
function convertSegment(seg: string): string {
  const stripped = seg.replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\[()[\]]/g, '')
  if (!stripped.includes('\\') && !/[_^]/.test(stripped)) return stripped
  let s = convertCommands(stripped)
  s = convertScripts(s)
  s = s.replace(/[{}]/g, '')
  return s.replace(/\u0001/g, '{').replace(/\u0002/g, '}')
}

/**
 * 将残留的 LaTeX 转为可读纯文本。
 * 去掉 \( \) \[ \] $ $$ 定界符；\overline{X} 与 \bar{X} 写作 X'（多字符时 (X)'）；
 * 常用符号（\cdot \oplus \land 等）转 Unicode；\frac{a}{b} 写作 (a)/(b)；纯数字下标与上标转 Unicode。
 * 不含 \ 或 $ 的文本原样返回；反引号代码片段原样保留；出错时返回原文。
 */
export function plainMath(text: string): string {
  try {
    if (typeof text !== 'string' || (!text.includes('\\') && !text.includes('$'))) return text
    // 按反引号代码片段切分：奇数下标为代码片段，保持不变。
    const parts = text.split(/(`[^`]*`)/)
    return parts.map((p, idx) => (idx % 2 === 1 ? p : convertSegment(p))).join('')
  } catch {
    return text
  }
}
