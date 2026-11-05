// 侧边追问抽屉的显示文本（纯函数，可单测）：隐藏发给子代理的协议文字，只留学生的问题。

const FOLLOWUP_MARK = '【追问 '
const FOLLOWUP_PREFIX = /^【追问 [^】]*】/

/**
 * 若文本含“【追问 ”前缀，只返回前缀之后、到第一个空行之前的那一行问题文字（不含“【追问 id#n】”前缀）。
 * 其余文本原样返回。例如：
 *   "【追问 n7#0】为什么？\n\n【背景】……\n【要求】……" -> "为什么？"
 */
export function followupDisplayText(text: string): string {
  const at = text.indexOf(FOLLOWUP_MARK)
  if (at < 0) return text
  const tail = text.slice(at).replace(FOLLOWUP_PREFIX, '')
  const firstBlank = tail.search(/\r?\n[ \t]*\r?\n/)
  const line = firstBlank >= 0 ? tail.slice(0, firstBlank) : tail
  return line.trim()
}
