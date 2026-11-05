import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFollowupInput, registerFollowupCommand } from '../src/host/followup.ts'
import { FOLLOWUP_CHILD_LABEL, FOLLOWUP_COMMAND, FOLLOWUP_OPENING } from '../src/shared/sidechat.ts'

test('parseFollowupInput accepts valid input and trims surrounding whitespace', () => {
  const r = parseFollowupInput(`  ${JSON.stringify({ v: 1, prompt: '为什么相邻格只差一位？' })}  `)
  assert.deepEqual(r, { v: 1, prompt: '为什么相邻格只差一位？' })
})

test('parseFollowupInput rejects bad JSON, non-object, wrong version, empty and oversized prompt', () => {
  assert.throws(() => parseFollowupInput(''), /为空/)
  assert.throws(() => parseFollowupInput('{not json'), /JSON/)
  assert.throws(() => parseFollowupInput('[1,2]'), /对象/)
  assert.throws(() => parseFollowupInput('null'), /对象/)
  assert.throws(() => parseFollowupInput(JSON.stringify({ v: 2, prompt: 'x' })), /版本/)
  assert.throws(() => parseFollowupInput(JSON.stringify({ prompt: 'x' })), /版本/)
  assert.throws(() => parseFollowupInput(JSON.stringify({ v: 1, prompt: '   ' })), /prompt/)
  assert.throws(() => parseFollowupInput(JSON.stringify({ v: 1, prompt: 42 })), /prompt/)
  assert.throws(() => parseFollowupInput(JSON.stringify({ v: 1, prompt: 'x'.repeat(8001) })), /过长/)
  assert.doesNotThrow(() => parseFollowupInput(JSON.stringify({ v: 1, prompt: 'x'.repeat(8000) })))
})

interface Captured {
  name?: string
  description?: string
  input?: unknown
  handler?: (args: { agent: unknown; rawInput: unknown; signal?: AbortSignal }) => Promise<{ kind: string; text: string }>
}

function fakeCtx(startContinuable: (opts: unknown) => Promise<unknown>) {
  const captured: Captured = {}
  let injectedDeps: unknown
  const fake = {
    inject(deps: unknown, cb: (c: unknown) => void) {
      injectedDeps = deps
      cb(fake)
    },
    effect(fn: () => unknown) {
      return fn()
    },
    commands: {
      register(def: Captured) {
        Object.assign(captured, def)
        return () => {}
      },
    },
    get(name: string) {
      assert.equal(name, 'subagents')
      return { startContinuable }
    },
  }
  return { ctx: fake, captured, deps: () => injectedDeps }
}

test('DSH 0.2.x: prefers startActivation and never notifies the parent (delivery caller)', async () => {
  let opts: any
  let legacyCalled = false
  const captured: Captured = {}
  const fake = {
    inject: (_deps: unknown, cb: (c: unknown) => void) => cb(fake),
    effect: (fn: () => unknown) => fn(),
    commands: { register: (def: Captured) => { Object.assign(captured, def); return () => {} } },
    get: () => ({
      startActivation: async (o: unknown) => { opts = o; return { childId: 'child-1' } },
      startContinuable: async () => { legacyCalled = true },
    }),
  }
  registerFollowupCommand(fake as never)
  const result = await captured.handler!({ agent: {}, rawInput: JSON.stringify({ v: 1, prompt: 'q' }) })
  assert.equal(result.kind, 'success')
  assert.equal(legacyCalled, false)
  assert.equal(opts.delivery, 'caller')
  assert.equal(opts.label, FOLLOWUP_CHILD_LABEL)
})

test('registerFollowupCommand registers the command and injects commands and subagents', () => {
  const { ctx, captured, deps } = fakeCtx(async () => ({}))
  registerFollowupCommand(ctx as never)
  assert.deepEqual(deps(), ['commands', 'subagents'])
  assert.equal(captured.name, FOLLOWUP_COMMAND)
  assert.equal(captured.description, '侧边追问')
  assert.deepEqual(captured.input, { hint: '<json>' })
})

test('followup handler spawns a continuable child with the opening and the prompt', async () => {
  let opts: any
  const agent = { id: 'parent-agent' }
  const signal = new AbortController().signal
  const { ctx, captured } = fakeCtx(async o => {
    opts = o
    return {}
  })
  registerFollowupCommand(ctx as never)
  const result = await captured.handler!({
    agent,
    rawInput: JSON.stringify({ v: 1, prompt: '卡诺图怎么圈？' }),
    signal,
  })
  assert.deepEqual(result, { kind: 'success', text: '已发送到侧边追问' })
  assert.equal(opts.provider, 'spawn')
  assert.equal(opts.label, FOLLOWUP_CHILD_LABEL)
  assert.equal(opts.request.parent, agent)
  assert.equal(opts.signal, signal)
  assert.equal(opts.request.prompt.length, 1)
  assert.equal(opts.request.prompt[0].type, 'text')
  assert.ok(opts.request.prompt[0].text.startsWith(FOLLOWUP_OPENING))
  assert.ok(opts.request.prompt[0].text.endsWith('卡诺图怎么圈？'))
})

test('followup handler returns error kind for bad rawInput without spawning', async () => {
  let called = false
  const { ctx, captured } = fakeCtx(async () => {
    called = true
    return {}
  })
  registerFollowupCommand(ctx as never)
  const result = await captured.handler!({ agent: {}, rawInput: '{"v":1,"prompt":""}' })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /prompt/)
  const nonString = await captured.handler!({ agent: {}, rawInput: 123 })
  assert.equal(nonString.kind, 'error')
  assert.equal(called, false)
})

test('followup handler returns error kind when startContinuable throws', async () => {
  const { ctx, captured } = fakeCtx(async () => {
    throw new Error('子代理服务不可用')
  })
  registerFollowupCommand(ctx as never)
  const result = await captured.handler!({ agent: {}, rawInput: JSON.stringify({ v: 1, prompt: 'x' }) })
  assert.equal(result.kind, 'error')
  assert.equal(result.text, '创建追问失败：子代理服务不可用')
})
