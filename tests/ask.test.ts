import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  askOnce,
  buildAskMessages,
  buildAskSystemPrompt,
  clipSummary,
  parseAskInput,
  registerAskLlmCommand,
  type AskAssembler,
  type AskChunk,
  type AskContext,
} from '../src/host/ask.ts'
import { ASK_LLM_COMMAND } from '../src/shared/ask.ts'

const PATH = [
  { nodeId: 'n1', title: '卡诺图', summary: '相邻格只差一位', knowledgeIds: ['k1'] },
  { nodeId: 'n2', title: '圈法', summary: '2 的幂次方格圈在一起', knowledgeIds: [] },
]

/** 与 BlockAssembler 同接口的假 assembler：只拼 text-delta，记录 finish。 */
function fakeAssembler(): AskAssembler {
  let text = ''
  let finish: { kind: string; failure?: { code?: string; message?: string } } | undefined
  return {
    push(chunk: AskChunk) {
      if (chunk.type === 'text-delta') text += String(chunk.text)
      if (chunk.type === 'finish') finish = chunk.reason as typeof finish
    },
    blocks: () => (text === '' ? [] : [{ type: 'text', text }]),
    get finish() {
      return finish
    },
  }
}

interface FakeLlmOpts {
  chunks?: AskChunk[]
  prepareError?: Error
  streamError?: Error
  /** 每个 chunk 之后触发（用于模拟中途取消）。 */
  onChunk?: () => void
}

function fakeCtx(opts: FakeLlmOpts = {}) {
  const calls: { config: unknown; options: Record<string, unknown>[] } = { config: undefined, options: [] }
  let prepared = 0
  const ctx: AskContext = {
    agentDefaultModel: {
      currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
    },
    llm: {
      async prepareCall(config, signal) {
        prepared++
        calls.config = { ...config, signalAborted: signal.aborted }
        if (opts.prepareError) throw opts.prepareError
        return {
          config: { provider: config.provider, model: config.model, maxTokens: config.maxTokens },
          stream(options) {
            calls.options.push(options)
            return (async function* () {
              for (const chunk of opts.chunks ?? []) {
                yield chunk
                opts.onChunk?.()
              }
              if (opts.streamError) throw opts.streamError
            })()
          },
        }
      },
    },
    createAssembler: fakeAssembler,
  }
  return { ctx, calls, preparedCount: () => prepared }
}

const STOP_CHUNKS: AskChunk[] = [
  { type: 'text-delta', index: 0, text: '相邻格只差一位，所以可以圈在一起。' },
  { type: 'text-delta', index: 0, text: '\n结论：相邻圈法成立。' },
  { type: 'finish', reason: { kind: 'stop' } },
]

test('buildAskSystemPrompt states the one-question, length and conclusion rules', () => {
  const s = buildAskSystemPrompt()
  assert.match(s, /只回答.*这一个追问/)
  assert.match(s, /120/)
  assert.match(s, /结论：/)
  assert.doesNotMatch(s, /[?？]/)
})

test('buildAskMessages builds one user text message with path, facts and question', () => {
  const [msg] = buildAskMessages(PATH, '  为什么能圈？ ', '卡诺图 2 格合并')
  assert.equal(msg.role, 'user')
  const text = msg.content[0].text
  assert.match(text, /1\. 卡诺图：相邻格只差一位（知识点 k1）/)
  assert.match(text, /2\. 圈法：2 的幂次方格圈在一起（知识点 无）/)
  assert.match(text, /卡诺图 2 格合并/)
  assert.ok(text.endsWith('为什么能圈？'))
})

test('buildAskMessages writes 无 for empty local facts and 无 path entries', () => {
  const [msg] = buildAskMessages([], 'q', '   ')
  const text = msg.content[0].text
  assert.match(text, /【学习树路径】[\s\S]*（无）/)
  assert.match(text, /【本地求解结果】\n无\n/)
})

/** 生成 n 个路径节点（摘要长度固定为 summaryLength）。 */
function pathOf(n: number, summaryLength = 10): Array<{ nodeId: string; title: string; summary: string; knowledgeIds: string[] }> {
  return Array.from({ length: n }, (_, i) => ({
    nodeId: `n${i}`,
    title: `卡${i}`,
    summary: 'a'.repeat(summaryLength),
    knowledgeIds: [],
  }))
}

test('parseAskInput accepts a 12000-character question and a 60-node path', () => {
  const ok = parseAskInput(JSON.stringify({ v: 1, question: 'x'.repeat(12000), path: pathOf(60) }))
  assert.equal(ok.question.length, 12000)
  assert.equal(ok.path.length, 60)
})

test('buildAskMessages keeps short summaries intact', () => {
  const s = 'b'.repeat(100)
  const path = [{ nodeId: 'n1', title: 'T', summary: s, knowledgeIds: [] }]
  const [msg] = buildAskMessages(path, 'q', '')
  assert.ok(msg.content[0].text.includes(`1. T：${s}（知识点 无）`))
})

test('buildAskMessages clips every summary to 160 characters regardless of path length', () => {
  const long = 'c'.repeat(300)
  for (const n of [1, 12, 13]) {
    const path = pathOf(n, 0).map((x) => ({ ...x, summary: long }))
    const [msg] = buildAskMessages(path, 'q', '')
    const text = msg.content[0].text
    assert.ok(text.includes(`1. 卡0：${'c'.repeat(159)}…（知识点 无）`))
    assert.ok(!text.includes('c'.repeat(160)))
  }
})

test('buildAskMessages: a parent path prompt is a prefix of the child path prompt', () => {
  const long = 'e'.repeat(300)
  const full = pathOf(15, 0).map((x) => ({ ...x, summary: long }))
  const parent = buildAskMessages(full.slice(0, 11), 'q', 'facts')[0].content[0].text
  const child = buildAskMessages(full.slice(0, 14), 'q', 'facts')[0].content[0].text
  const head = parent.split('\n\n【本地求解结果】')[0]
  assert.ok(child.startsWith(head))
})

test('clipSummary: counts code points, adds an ellipsis only when clipped', () => {
  assert.equal(clipSummary('甲乙丙', 3), '甲乙丙')
  assert.equal(clipSummary('甲乙丙丁', 3), '甲乙…')
  assert.equal(clipSummary('abc', Infinity), 'abc')
})

test('parseAskInput accepts valid input and rejects bad shapes', () => {
  const ok = parseAskInput(JSON.stringify({ v: 1, question: 'q', path: PATH, localFacts: 'f' }))
  assert.equal(ok.question, 'q')
  assert.equal(ok.localFacts, 'f')
  assert.equal(parseAskInput(JSON.stringify({ v: 1, question: 'q', path: [] })).localFacts, undefined)
  assert.throws(() => parseAskInput(''), /为空/)
  assert.throws(() => parseAskInput('{bad'), /JSON/)
  assert.throws(() => parseAskInput('[]'), /对象/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 2, question: 'q', path: [] })), /版本/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: ' ', path: [] })), /不能为空/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: 'x'.repeat(12001), path: [] })), /过长/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: 'q', path: pathOf(61) })), /路径/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: 'q', path: 'no' })), /路径/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: 'q', path: [{ title: 't' }] })), /路径/)
  assert.throws(() => parseAskInput(JSON.stringify({ v: 1, question: 'q', path: [], localFacts: 3 })), /localFacts/)
})

test('askOnce returns the assembled text on a normal stop', async () => {
  const { ctx, calls } = fakeCtx({ chunks: STOP_CHUNKS })
  const r = await askOnce(ctx, { v: 1, path: PATH, question: '为什么能圈？', localFacts: '' })
  assert.deepEqual({ ...r, raw: undefined }, { ok: true, text: '相邻格只差一位，所以可以圈在一起。\n结论：相邻圈法成立。', followups: [], raw: undefined })
  const opts = calls.options[0]
  assert.equal(opts.system, buildAskSystemPrompt())
  assert.ok(opts.signal instanceof AbortSignal)
  assert.deepEqual(opts.messages, buildAskMessages(PATH, '为什么能圈？', ''))
})

test('askOnce passes provider and model from the default selection and asks for reasoning off', async () => {
  const { ctx, calls } = fakeCtx({ chunks: STOP_CHUNKS })
  ctx.agentDefaultModel = {
    currentSelection: () => ({ provider: 'p', model: 'm', reasoningEffort: 'high' }),
  }
  await askOnce(ctx, { v: 1, path: [], question: 'q' })
  assert.deepEqual(calls.config, { provider: 'p', model: 'm', maxTokens: 4096, reasoningEffort: 'off', signalAborted: false })
})

test('askOnce reports a provider error finish with its message', async () => {
  const { ctx } = fakeCtx({
    chunks: [{ type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: '请求过于频繁' } } }],
  })
  const r = await askOnce(ctx, { v: 1, path: [], question: 'q' })
  assert.deepEqual(r, { ok: false, error: '模型调用失败：请求过于频繁' })
})

test('askOnce reports max-tokens truncation, empty text and a missing finish', async () => {
  const truncated = fakeCtx({ chunks: [{ type: 'text-delta', index: 0, text: '半句' }, { type: 'finish', reason: { kind: 'max-tokens' } }] })
  const r1 = await askOnce(truncated.ctx, { v: 1, path: [], question: 'q' })
  assert.equal(r1.ok, false)
  assert.match((r1 as { error: string }).error, /长度用尽/)

  const empty = fakeCtx({ chunks: [{ type: 'finish', reason: { kind: 'stop' } }] })
  assert.deepEqual(await askOnce(empty.ctx, { v: 1, path: [], question: 'q' }), { ok: false, error: '模型没有返回内容。' })

  const noFinish = fakeCtx({ chunks: [{ type: 'text-delta', index: 0, text: 'x' }] })
  assert.deepEqual(await askOnce(noFinish.ctx, { v: 1, path: [], question: 'q' }), { ok: false, error: '模型流未正常结束。' })
})

test('askOnce returns a Chinese error when the stream throws or prepareCall fails', async () => {
  const thrown = fakeCtx({ streamError: new Error('网络断开') })
  assert.deepEqual(await askOnce(thrown.ctx, { v: 1, path: [], question: 'q' }), { ok: false, error: '模型调用失败：网络断开' })

  const prep = fakeCtx({ prepareError: new Error('no adapter') })
  // 英文原文不直接显示，改用通用中文说明。
  assert.deepEqual(await askOnce(prep.ctx, { v: 1, path: [], question: 'q' }), { ok: false, error: '模型调用准备失败，请稍后重试。' })
})

test('askOnce fails without calling the model when llm or the default model is missing', async () => {
  const { ctx, preparedCount } = fakeCtx({ chunks: STOP_CHUNKS })
  const noLlm = { ...ctx, llm: undefined }
  assert.deepEqual(await askOnce(noLlm, { v: 1, path: [], question: 'q' }), { ok: false, error: '当前 DSH 未提供模型服务。' })
  const noModel = { ...ctx, agentDefaultModel: undefined }
  assert.deepEqual(await askOnce(noModel, { v: 1, path: [], question: 'q' }), { ok: false, error: '当前 DSH 未提供模型服务。' })
  assert.equal(preparedCount(), 0)
})

test('askOnce does nothing when the signal is already aborted', async () => {
  const { ctx, preparedCount } = fakeCtx({ chunks: STOP_CHUNKS })
  const ac = new AbortController()
  ac.abort()
  assert.deepEqual(await askOnce(ctx, { v: 1, path: [], question: 'q' }, ac.signal), { ok: false, error: '追问已取消。' })
  assert.equal(preparedCount(), 0)
})

test('askOnce stops mid-stream when the signal aborts and reports cancellation', async () => {
  const ac = new AbortController()
  const { ctx } = fakeCtx({
    chunks: STOP_CHUNKS,
    onChunk: () => ac.abort(),
  })
  const r = await askOnce(ctx, { v: 1, path: [], question: 'q' }, ac.signal)
  assert.deepEqual(r, { ok: false, error: '追问已取消。' })
})

test('askOnce maps an aborted finish to cancellation', async () => {
  const { ctx } = fakeCtx({ chunks: [{ type: 'finish', reason: { kind: 'aborted', failure: { code: 'ABORTED', message: 'x' } } }] })
  assert.deepEqual(await askOnce(ctx, { v: 1, path: [], question: 'q' }), { ok: false, error: '追问已取消。' })
})

test('registerAskLlmCommand injects commands, llm and agentDefaultModel and returns success text', async () => {
  let injected: unknown
  let captured: { name?: string; handler?: (a: { rawInput: unknown }) => Promise<{ kind: string; text: string }> } = {}
  const { ctx: askCtx } = fakeCtx({ chunks: STOP_CHUNKS })
  const fake = {
    inject(deps: unknown, cb: (c: unknown) => void) {
      injected = deps
      cb(child)
    },
    effect(fn: () => unknown) {
      return fn()
    },
  }
  const child = {
    effect: fake.effect,
    commands: {
      register(def: typeof captured) {
        captured = def
        return () => {}
      },
    },
    get(name: string) {
      if (name === 'llm') return askCtx.llm
      if (name === 'agentDefaultModel') return askCtx.agentDefaultModel
      throw new Error('unexpected ' + name)
    },
  }
  registerAskLlmCommand({ inject: fake.inject, effect: fake.effect } as never, fakeAssembler)
  assert.deepEqual(injected, ['commands', 'llm', 'agentDefaultModel'])
  assert.equal(captured.name, ASK_LLM_COMMAND)
  const ok = await captured.handler!({ rawInput: JSON.stringify({ v: 1, path: [], question: 'q' }) })
  assert.equal(ok.kind, 'success')
  assert.match(ok.text, /结论：相邻圈法成立。/)
  const bad = await captured.handler!({ rawInput: '{' })
  assert.deepEqual(bad.kind, 'error')
})

test('buildAskSystemPrompt forbids LaTeX and gives plain-text notation for complement, OR, XOR and subscripts', () => {
  const s = buildAskSystemPrompt()
  assert.match(s, /纯文本/)
  assert.match(s, /LaTeX/)
  assert.match(s, /A'/)
  assert.match(s, /⊕/)
  assert.match(s, /m₀/)
  assert.match(s, /反引号/)
})
