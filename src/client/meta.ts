// 工具回放的纯函数（不依赖 React，便于单元测试）：读取 presentationMeta、解析参数、取纯文本结果。
import type { Envelope } from '../shared/contracts.ts'
import type { TFn } from './locale.ts'

/** 工具调用块：运行中只有 argsRaw；结束后带 kind、call、content、meta 等。全部字段按不可信数据处理。 */
export interface ToolBlock {
  kind?: unknown
  content?: unknown
  meta?: unknown
  isError?: unknown
  argsRaw?: unknown
  call?: unknown
}

/** 工具视图的通用 props（DSH 注入）。 */
export interface ToolViewProps {
  t: TFn
  phase?: string
  block: ToolBlock
  sessionId?: string
  useProjection?: UseProjection
}

/** 会话投影读取钩子：返回投影当前值，未就绪时为 undefined。 */
export type UseProjection = (key: string) => unknown

/** 点击追问：把文本作为一条排队的用户消息发送。 */
export type AskFn = (text: string) => Promise<{ ok: boolean } | undefined>

type Obj = Record<string, unknown>

export function isObj(x: unknown): x is Obj {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** 块是否已结束（有 kind 字段）。 */
export function isSettled(block: unknown): boolean {
  return isObj(block) && 'kind' in block
}

/** 从持久化 meta 中取出 Envelope；版本、工具名或形状不符时返回 null，调用方走文本回退。 */
export function readMeta<R = unknown>(block: unknown, tool: string): Envelope<R> | null {
  if (!isObj(block)) return null
  const meta = block.meta
  if (!isObj(meta) || meta.v !== 1 || meta.tool !== tool) return null
  const value = meta.value
  if (!isObj(value) || typeof value.ok !== 'boolean') return null
  // 成功时 result 必须是对象；失败时 result 为 null。
  if (value.ok && !isObj(value.result)) return null
  return {
    ok: value.ok,
    op: typeof value.op === 'string' ? value.op : '',
    result: (value.result ?? null) as R | null,
    error: typeof value.error === 'string' ? value.error : undefined,
    steps: Array.isArray(value.steps) ? (value.steps as Envelope<R>['steps']) : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((w): w is string => typeof w === 'string') : [],
  }
}

/** 取调用参数的原始 JSON 字符串；结束后优先 call.argsRaw，运行中用 argsRaw。 */
export function argsRawOf(block: unknown): string | undefined {
  if (!isObj(block)) return undefined
  if (isObj(block.call) && typeof block.call.argsRaw === 'string') return block.call.argsRaw
  return typeof block.argsRaw === 'string' ? block.argsRaw : undefined
}

/** 解析参数 JSON；失败或非对象时返回空对象。 */
export function parseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw ?? '')
    return isObj(v) ? v : {}
  } catch {
    return {}
  }
}

/** 取第一个非空字符串形式的参数，用于运行中的摘要行。 */
export function firstArgText(args: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = args[k]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return ''
}

/** 块内容拼成纯文本（回退显示用）。 */
export function resultText(block: unknown): string {
  if (!isObj(block) || !Array.isArray(block.content)) return ''
  const parts: string[] = []
  for (const item of block.content) {
    if (!isObj(item)) continue
    parts.push(item.type === 'text' && typeof item.text === 'string' ? item.text : JSON.stringify(item))
  }
  return parts.join('\n')
}

const ANGLES = ['principle', 'variant', 'pitfall', 'prerequisite', 'verify', 'practice', 'free']

/** 追问角度对应的文案 key；未知角度归入 "延伸"。 */
export function angleLabelKey(angle: unknown): string {
  return typeof angle === 'string' && ANGLES.includes(angle) ? `angle.${angle}` : 'angle.free'
}
