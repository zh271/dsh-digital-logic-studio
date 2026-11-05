// 直接模型追问（原型）：不开子代理，由 Host 直接调用 ctx.llm 回答一个追问。
// 纯逻辑（提示词、消息、解析、askOnce）与 DSH 注册分开，便于单测。只用可擦除语法。
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { FollowupContext } from '../shared/sidechat.ts'
import { ASK_LLM_COMMAND, parseAskAnswer, type AskFollowupSuggestion, type AskLlmCommandInput } from '../shared/ask.ts'

export { parseAskAnswer }
export type { AskFollowupSuggestion }

export const ASK_MAX_TOKENS = 4096
/** 追问回答请求的推理强度：关闭。不支持时退回模型默认（见 askOnce）。 */
export const ASK_REASONING_EFFORT = 'off'
/** 原始输出调试日志的文件名（位于系统临时目录）与超过此大小（字节）时清空重写。 */
export const ASK_RAW_LOG_NAME = 'dlogic-ask-raw.log'
const ASK_RAW_LOG_MAX_BYTES = 200 * 1024
// 综合（复习提纲等）问题可能列出 40 张卡片，因此问题与路径上限较大。
const MAX_QUESTION_LENGTH = 12000
const MAX_PATH_LENGTH = 60
/**
 * 路径中每个节点的摘要统一截断到此长度。与路径长度无关，保证同一节点的行在任何追问里都完全相同，
 * 这样父卡与子卡的提示词共享前缀，能命中模型的前缀缓存。
 */
const PATH_SUMMARY_MAX = 160
const MAX_LOCAL_FACTS_LENGTH = 4000
const CANCELLED_TEXT = '追问已取消。'

// ───────────────────────── 注入接口 ─────────────────────────

/** 流式 chunk 的最小形状（与 dsh-llm 的 StreamChunk 兼容，测试可用假数据）。 */
export interface AskChunk {
  type: string
  [extra: string]: unknown
}

/** 终止原因（dsh-llm 的 FinishReason 子集）。 */
export interface AskFinishReason {
  kind: string
  failure?: { code?: string; message?: string }
}

/** BlockAssembler 的最小接口。 */
export interface AskAssembler {
  push(chunk: AskChunk): void
  blocks(): Array<{ type: string; text?: string }>
  readonly finish: AskFinishReason | undefined
}

export interface AskCall {
  config: Readonly<Record<string, unknown>>
  stream(options: Record<string, unknown>): AsyncIterable<AskChunk>
}

/** ctx.llm 中本模块用到的部分。 */
export interface AskLlmPort {
  prepareCall(
    config: { provider: string; model: string; maxTokens: number; reasoningEffort?: string },
    signal: AbortSignal,
  ): Promise<AskCall>
}

/** ctx.agentDefaultModel 中本模块用到的部分。 */
export interface AskModelPort {
  currentSelection(): { provider: string; model: string; reasoningEffort?: string }
}

/** askOnce 需要的依赖。llm / agentDefaultModel 缺失时返回中文错误。 */
export interface AskContext {
  llm?: AskLlmPort
  agentDefaultModel?: AskModelPort
  /** 可选：测试注入假的 assembler；缺省时使用 dsh-llm 的 BlockAssembler。 */
  createAssembler?: () => AskAssembler | Promise<AskAssembler>
  /** 可选：每次成功回答后写一行 JSON 调试日志；缺省时写入系统临时目录（测试应注入假的）。 */
  log?: (line: string) => void
}

export type AskOutcome = { ok: true; text: string; followups: AskFollowupSuggestion[]; raw: string } | { ok: false; error: string }

// ───────────────────────── 纯函数 ─────────────────────────

/**
 * 系统提示词：只回答这一个追问，简短，末行给结论；正文之后附“追问：”块，按问题内容列出 1 到 4 条启发式追问。
 * 追问块由 shared/ask 的 parseAskAnswer 拆出。
 */
export function buildAskSystemPrompt(): string {
  return [
    '你是数字逻辑课程的助教。',
    '只回答用户这一个追问，不要展开其他知识点。',
    '回答不超过 120 个字，用直接的陈述句。',
    '不要提及工具、核对、自我纠正或你的推理过程。',
    '正文最后一行单独写“结论：”加一句话的结论。',
    '用纯文本回答，不要使用 LaTeX、\\(\\)、\\[\\]、$ 等数学标记。',
    "非（取反）写作 A'，与写作 AB 或 A·B，或写作 +，异或写作 ⊕，下标写作 m_i 或 Unicode 下标（如 m₀），最小项写作 m3 等。",
    "信号名与代码用反引号包裹，例如 `Y`、`A'`。",
    '',
    '正文之后，空一行，再写一行只含“追问：”的标记行，然后列出追问，每条一行，格式为“- 问题 | 角度 | 理由”。',
    '追问条数按本问题的内容决定：问题窄、已是很细的小知识点时写 1 条；一般的概念或原理问题写 2 条；',
    '问题宽、可以向多个方向展开（原理、变式、易错、验证各有话说）时写 3 到 4 条。角度只选真正适合本回答的，不要为凑数而写。',
    '角度只能是 principle、variant、pitfall、prerequisite、verify、practice、free 之一。',
    '问题不超过 30 个字，必须是围绕本回答本身的启发式联想问题（为什么、如果…会怎样、与…有何不同、什么时候会出错），',
    '不要问“X是什么”这类定义题（定义由正文中的术语链接承担）。理由不超过 20 个字。',
    '追问块不计入上面的 120 字限制；追问块之后不要再输出任何内容。',
    '格式示例（只示范格式，内容不要照抄）：',
    '  相邻格只差一位，所以可以圈在一起。',
    '  结论：相邻圈法成立。',
    '',
    '  追问：',
    '  - 若两格不相邻，圈法还成立吗 | variant | 检验相邻性',
    '  - 圈的格数不是 2 的幂会怎样 | pitfall | 圈法失效',
  ].join('\n')
}

/**
 * 把底层错误文本转为可给用户看的中文细节：只有含中文、较短且不像 JSON 的文本才原样保留，
 * 否则返回空串（调用方改用通用中文说明），避免英文或 JSON 原文直接出现在界面上。
 */
export function llmDetail(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (s === '' || s.length > 80) return ''
  if (/[{}\[\]"]/.test(s)) return ''
  return /[一-鿿]/.test(s) ? s : ''
}

/** 拼出“前缀：细节”；细节不可用时给通用的“请稍后重试”。 */
function llmFailure(prefix: string, raw: unknown): string {
  const detail = llmDetail(raw)
  return detail !== '' ? `${prefix}：${detail}` : `${prefix}，请稍后重试。`
}

/** 摘要超过 max 字符（按代码点计）时截断并加省略号；max 为 Infinity 时原样返回。 */
export function clipSummary(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text
}

/**
 * 生成发给模型的消息（单条 user 消息）。
 * path 为从根到当前卡片的路径；localFacts 为本地求解器算好的事实，可为空。
 */
export function buildAskMessages(
  path: FollowupContext['path'],
  question: string,
  localFacts: string,
): Array<{ role: 'user'; content: Array<{ type: 'text'; text: string }> }> {
  const summaryMax = PATH_SUMMARY_MAX
  const pathLines =
    path.length === 0
      ? ['（无）']
      : path.map(
          (n, i) =>
            `${i + 1}. ${n.title}：${clipSummary(n.summary, summaryMax)}（知识点 ${n.knowledgeIds.join('、') || '无'}）`,
        )
  const text = [
    '【学习树路径】从根到当前卡片：',
    ...pathLines,
    '',
    '【本地求解结果】',
    localFacts.trim() === '' ? '无' : localFacts.trim(),
    '',
    '【追问】',
    question.trim(),
  ].join('\n')
  return [{ role: 'user', content: [{ type: 'text', text }] }]
}

/** 解析并校验命令的 rawInput。失败时抛出中文 Error。 */
export function parseAskInput(raw: string): AskLlmCommandInput {
  const text = raw.trim()
  if (text === '') throw new Error('追问参数为空。')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('追问参数不是合法的 JSON。')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('追问参数必须是一个对象。')
  }
  const obj = data as Record<string, unknown>
  if (obj.v !== 1) throw new Error('追问参数版本不受支持（需要 v: 1）。')
  if (typeof obj.question !== 'string' || obj.question.trim() === '') throw new Error('追问内容不能为空。')
  if (obj.question.length > MAX_QUESTION_LENGTH) throw new Error(`追问内容过长（上限 ${MAX_QUESTION_LENGTH} 字符）。`)
  if (!Array.isArray(obj.path) || obj.path.length > MAX_PATH_LENGTH) throw new Error('追问路径无效。')
  const path = obj.path.map((n: unknown) => {
    const node = n as Record<string, unknown> | null
    if (typeof node !== 'object' || node === null) throw new Error('追问路径无效。')
    if (typeof node.nodeId !== 'string' || typeof node.title !== 'string' || typeof node.summary !== 'string') {
      throw new Error('追问路径无效。')
    }
    if (!Array.isArray(node.knowledgeIds) || !node.knowledgeIds.every(k => typeof k === 'string')) {
      throw new Error('追问路径无效。')
    }
    return { nodeId: node.nodeId, title: node.title, summary: node.summary, knowledgeIds: node.knowledgeIds as string[] }
  })
  if (obj.localFacts !== undefined && typeof obj.localFacts !== 'string') throw new Error('localFacts 必须是字符串。')
  if (typeof obj.localFacts === 'string' && obj.localFacts.length > MAX_LOCAL_FACTS_LENGTH) throw new Error('localFacts 过长。')
  return {
    v: 1,
    path,
    question: obj.question,
    ...(typeof obj.localFacts === 'string' ? { localFacts: obj.localFacts } : {}),
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 最小的块拼装器：只收集正文（text-delta / block-end 的 text 块）与结束原因，不依赖 dsh-llm 包。 */
export class TextAssembler implements AskAssembler {
  private texts = new Map<unknown, string>()
  private closed = new Map<unknown, string>()
  private order: unknown[] = []
  finish: AskFinishReason | undefined = undefined

  push(chunk: AskChunk): void {
    const index = chunk.index
    if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
      if (this.closed.has(index)) return
      if (!this.texts.has(index)) this.order.push(index)
      this.texts.set(index, (this.texts.get(index) ?? '') + chunk.text)
    } else if (chunk.type === 'block-end') {
      const block = chunk.block as { type?: string; text?: string } | undefined
      if (block && block.type === 'text' && typeof block.text === 'string' && !this.closed.has(index)) {
        if (!this.texts.has(index)) this.order.push(index)
        this.closed.set(index, block.text)
      }
    } else if (chunk.type === 'finish') {
      this.finish = chunk.reason as AskFinishReason
    }
  }

  blocks(): Array<{ type: string; text?: string }> {
    return this.order.map(i => ({ type: 'text', text: this.closed.get(i) ?? this.texts.get(i) ?? '' }))
  }
}

function defaultAssembler(): AskAssembler {
  return new TextAssembler()
}

/**
 * 默认的原始输出日志：追加一行 JSON 到系统临时目录的 dlogic-ask-raw.log。
 * 文件超过 200 KB 时先清空再写。任何错误都吞掉，绝不影响追问本身。
 */
export function appendRawLogToTmp(line: string): void {
  try {
    const file = path.join(os.tmpdir(), ASK_RAW_LOG_NAME)
    let size = 0
    try {
      size = fs.statSync(file).size
    } catch {
      size = 0
    }
    if (size > ASK_RAW_LOG_MAX_BYTES) fs.writeFileSync(file, '')
    fs.appendFileSync(file, line + '\n', 'utf8')
  } catch {
    // 调试日志失败不影响回答。
  }
}

/**
 * 直接调用模型回答一个追问。返回最终文本；任何失败都返回 { ok: false, error }（中文），不抛出。
 * 使用 agentDefaultModel 当前选择的 provider/model；只发一条 user 消息，不带工具。
 */
export async function askOnce(ctx: AskContext, input: AskLlmCommandInput, signal?: AbortSignal): Promise<AskOutcome> {
  const fail = (error: string): AskOutcome => ({ ok: false, error })
  if (signal?.aborted) return fail(CANCELLED_TEXT)
  if (!ctx.llm || !ctx.agentDefaultModel) return fail('当前 DSH 未提供模型服务。')

  const controller = new AbortController()
  const onAbort = (): void => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const selection = ctx.agentDefaultModel.currentSelection()
    let call: AskCall
    try {
      const base = { provider: selection.provider, model: selection.model, maxTokens: ASK_MAX_TOKENS }
      try {
        // 120 字的追问回答不需要推理：先请求关闭推理（省 token 与时间）；
        // 模型不支持 'off'（UNSUPPORTED_REASONING_EFFORT 等）时退回模型默认强度。
        call = await ctx.llm.prepareCall({ ...base, reasoningEffort: ASK_REASONING_EFFORT }, controller.signal)
      } catch (error) {
        if (controller.signal.aborted) throw error
        call = await ctx.llm.prepareCall(base, controller.signal)
      }
    } catch (error) {
      return fail(controller.signal.aborted ? CANCELLED_TEXT : llmFailure('模型调用准备失败', errorMessage(error)))
    }

    const assembler = await (ctx.createAssembler ? ctx.createAssembler() : defaultAssembler())
    try {
      const stream = call.stream({
        ...call.config,
        system: buildAskSystemPrompt(),
        messages: buildAskMessages(input.path, input.question, input.localFacts ?? ''),
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (controller.signal.aborted) return fail(CANCELLED_TEXT)
        assembler.push(chunk)
      }
    } catch (error) {
      return fail(controller.signal.aborted ? CANCELLED_TEXT : llmFailure('模型调用失败', errorMessage(error)))
    }

    const finish = assembler.finish
    if (finish === undefined) return fail('模型流未正常结束。')
    switch (finish.kind) {
      case 'stop':
        break
      case 'error':
        return fail(llmFailure('模型调用失败', finish.failure?.message || finish.failure?.code))
      case 'aborted':
        return fail(CANCELLED_TEXT)
      case 'max-tokens':
        return fail('模型输出长度用尽，未能生成回答。')
      default:
        return fail('模型返回了意外的结束状态：' + finish.kind)
    }

    const text = assembler
      .blocks()
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text as string)
      .join('')
      .trim()
    if (text === '') return fail('模型没有返回内容。')
    const parsed = parseAskAnswer(text)
    // 调试：记录模型原始输出与解析出的追问条数，便于检查真实输出格式。日志失败不影响结果。
    try {
      const write = ctx.log ?? appendRawLogToTmp
      write(JSON.stringify({ t: Date.now(), raw: text, parsedFollowups: parsed.followups.length }))
    } catch {
      // 忽略日志错误。
    }
    return { ok: true, text: parsed.answer, followups: parsed.followups, raw: text }
  } finally {
    signal?.removeEventListener('abort', onAbort)
    controller.abort()
  }
}

// ───────────────────────── 注册 ─────────────────────────

/**
 * 注册 `dlogic-ask-llm` 命令。依赖 commands / llm / agentDefaultModel 任一缺失时整体跳过，不影响插件加载。
 * 结果：成功为 { kind: 'success', text: 回答正文, followups: 后续追问 }，失败为 { kind: 'error', text: 中文原因 }。
 */
export function registerAskLlmCommand(ctx: Context, createAssembler?: AskContext['createAssembler']): void {
  ctx.inject(['commands', 'llm', 'agentDefaultModel'], (child: any) => {
    child.effect(
      () =>
        child.commands.register({
          name: ASK_LLM_COMMAND,
          description: '直接调用模型回答追问',
          input: { hint: '<json>' },
          handler: async ({ rawInput, signal }: { rawInput: unknown; signal?: AbortSignal }) => {
            let input: AskLlmCommandInput
            try {
              input = parseAskInput(typeof rawInput === 'string' ? rawInput : '')
            } catch (error) {
              return { kind: 'error', text: errorMessage(error) }
            }
            const outcome = await askOnce(
              { llm: child.get('llm'), agentDefaultModel: child.get('agentDefaultModel'), createAssembler },
              input,
              signal,
            )
            return outcome.ok
              ? // DSH 命令层只保证透传 text，额外字段会被丢弃：把含“追问：”块的原文放进 text，由前端 parseAskAnswer 拆分。
                { kind: 'success', text: outcome.raw, followups: outcome.followups }
              : { kind: 'error', text: outcome.error }
          },
        }),
      ASK_LLM_COMMAND,
    )
  })
}
