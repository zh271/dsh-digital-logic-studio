// 学习树追问命令：前端执行 `/${FOLLOWUP_COMMAND} <json>`，Host 据此新开一个可继续的侧边子代理。
// 命令名、标签与开场白由 src/shared/sidechat.ts 约定，这里只负责解析与派生子代理。
import type { Context } from '@deepseek-ai/cordis'
import {
  FOLLOWUP_CHILD_LABEL,
  FOLLOWUP_COMMAND,
  FOLLOWUP_OPENING,
  type FollowupCommandInput,
} from '../shared/sidechat.ts'

const MAX_PROMPT_LENGTH = 8000

/** 解析并校验命令的 rawInput（JSON 字符串）。失败时抛出中文 Error。 */
export function parseFollowupInput(raw: string): FollowupCommandInput {
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
  const { v, prompt } = data as { v?: unknown; prompt?: unknown }
  if (v !== 1) throw new Error('追问参数版本不受支持（需要 v: 1）。')
  if (typeof prompt !== 'string' || prompt.trim() === '') throw new Error('追问内容 prompt 不能为空。')
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error(`追问内容过长（上限 ${MAX_PROMPT_LENGTH} 字符）。`)
  return { v: 1, prompt }
}

interface FollowupHandlerArgs {
  agent: unknown
  rawInput: unknown
  signal?: AbortSignal
}

interface StartOptions {
  provider: 'spawn'
  label: string
  request: { parent: unknown; prompt: { type: 'text'; text: string }[] }
  signal?: AbortSignal
  /** 'caller'：子代理完成后不给父代理（主对话）发通知，主对话的模型上下文不受影响。 */
  delivery?: 'caller' | 'parent'
}

interface FollowupSubagents {
  /** DSH 0.2.x 的接口：子代理被接受后即返回，不等待它答完。 */
  startActivation?(opts: StartOptions): Promise<unknown>
  /** 较新版本 DSH 的接口名（dsh-side-session 使用）。 */
  startContinuable?(opts: StartOptions): Promise<unknown>
}

/** 按宿主版本选用可用的启动方法。 */
async function startFollowupChild(subagents: FollowupSubagents, opts: StartOptions): Promise<void> {
  if (typeof subagents.startActivation === 'function') {
    await subagents.startActivation(opts)
    return
  }
  if (typeof subagents.startContinuable === 'function') {
    await subagents.startContinuable(opts)
    return
  }
  throw new Error('当前 DSH 版本不支持可继续的子代理')
}

/** 注册 `dlogic-ask` 命令。命令服务或子代理服务缺失时整体跳过，不影响插件加载。 */
export function registerFollowupCommand(ctx: Context): void {
  ctx.inject(['commands', 'subagents'], (ctx: any) => {
    ctx.effect(
      () =>
        ctx.commands.register(
          {
            name: FOLLOWUP_COMMAND,
            description: '侧边追问',
            input: { hint: '<json>' },
            handler: async ({ agent, rawInput, signal }: FollowupHandlerArgs) => {
              let input: FollowupCommandInput
              try {
                input = parseFollowupInput(typeof rawInput === 'string' ? rawInput : '')
              } catch (error) {
                return { kind: 'error', text: (error as Error).message }
              }
              try {
                await startFollowupChild(ctx.get('subagents') as FollowupSubagents, {
                  provider: 'spawn',
                  label: FOLLOWUP_CHILD_LABEL,
                  request: {
                    parent: agent,
                    prompt: [{ type: 'text', text: FOLLOWUP_OPENING + '\n\n' + input.prompt }],
                  },
                  signal,
                  delivery: 'caller',
                })
                return { kind: 'success', text: '已发送到侧边追问' }
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                return { kind: 'error', text: '创建追问失败：' + message }
              }
            },
          },
        ),
      FOLLOWUP_COMMAND,
    )
  })
}
