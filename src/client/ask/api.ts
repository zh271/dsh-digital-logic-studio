// 直接模型追问的前端封装：经 Host 命令 dlogic-ask-llm 调用模型，等待完整回答后返回。
// 命令通道不支持流式，onChunk 在成功时只被调用一次，参数为完整回答正文（不含追问段落）。
// 远程执行函数由 register.ts 在插件 apply 时注入（见 setAskLlmRemote）。

import { ASK_LLM_COMMAND, parseAskAnswer, sanitizeFollowups, type AskFollowupSuggestion, type AskLlmCommandInput } from '../../shared/ask.ts'
import type { FollowupContext } from '../../shared/sidechat.ts'

/** 成功时 text 为正文，followups 为模型给出的后续追问（可能为空）。失败时 error 为中文说明。 */
export type AskLlmResult =
  | { ok: true; text: string; followups: AskFollowupSuggestion[] }
  | { ok: false; error: string }

const FAIL_TEXT = '追问未能发送，请重试。'
/** 网关返回的错误信息最多附上的字符数。 */
const GATEWAY_MESSAGE_MAX = 80

/** 执行一条 Host 命令（文本形如 `/command json`），返回 DSH 远程命令的原始响应。 */
export type AskLlmRemote = (sessionId: string, commandText: string) => Promise<unknown>

let remote: AskLlmRemote | undefined

/** 注入远程执行函数（由 register.ts 调用）。 */
export function setAskLlmRemote(next: AskLlmRemote | undefined): void {
  remote = next
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max).join('') + '…' : text
}

/** 网关（DSH 自身）返回的错误：只有含中文的消息才附上，否则用通用中文文本。 */
function gatewayError(err: unknown): string {
  const message = isObj(err) && typeof err.message === 'string' ? err.message : typeof err === 'string' ? err : ''
  const trimmed = message.trim()
  if (trimmed === '' || !/[一-鿿]/.test(trimmed)) return FAIL_TEXT
  return `追问未能发送：${clip(trimmed, GATEWAY_MESSAGE_MAX)}`
}

/** 从远程响应中取出结果；形状不符时给出通用失败文本。纯函数（除记录告警外），导出以便单测。 */
export function readResult(r: unknown): AskLlmResult {
  const resp = isObj(r) ? r : undefined
  if (resp && resp.ok === false) {
    console.warn('[dlogic] ask-llm gateway error response:', r)
    return { ok: false, error: gatewayError(resp.error) }
  }
  const value = resp && isObj(resp.value) ? resp.value : undefined
  const result = value && isObj(value.result) ? value.result : undefined
  if (!result) {
    console.warn('[dlogic] ask-llm unexpected response:', r)
    return { ok: false, error: FAIL_TEXT }
  }
  const text = typeof result.text === 'string' ? result.text : ''
  if (result.kind === 'success' && text.trim() !== '') {
    // 追问块随 text 一起传回（DSH 会丢弃额外字段）；有独立 followups 字段时优先用它。
    const parsed = parseAskAnswer(text.trim())
    const extra = sanitizeFollowups(result.followups)
    return { ok: true, text: parsed.answer, followups: extra.length > 0 ? extra : parsed.followups }
  }
  if (text.trim() === '') console.warn('[dlogic] ask-llm failed without text:', r)
  return { ok: false, error: text.trim() !== '' ? text.trim() : FAIL_TEXT }
}

/**
 * 直接调用模型回答一个追问。path 为从根到被追问卡片的路径（与 FollowupContext.path 相同）。
 * 任何失败都返回 { ok: false, error }（中文），不抛出。
 */
export async function askFollowupLlm(
  sessionId: string,
  path: FollowupContext['path'],
  question: string,
  onChunk?: (text: string) => void,
): Promise<AskLlmResult> {
  if (!remote || !sessionId) return { ok: false, error: '追问服务尚未就绪' }
  const input: AskLlmCommandInput = {
    v: 1,
    path: path.map(n => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: [...n.knowledgeIds] })),
    question,
  }
  try {
    const r = await remote(sessionId, `/${ASK_LLM_COMMAND} ${JSON.stringify(input)}`)
    const result = readResult(r)
    if (result.ok) onChunk?.(result.text)
    return result
  } catch (error) {
    console.warn('[dlogic] ask-llm command failed:', error)
    return { ok: false, error: FAIL_TEXT }
  }
}
