import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import type { CardRecord } from '../src/shared/contracts.ts'
import { answerSummary, randomToken } from '../src/client/ask/entries.ts'
import {
  BRANCH_PREFIX,
  branchMarkdown,
  buildSynthEntry,
  buildSynthQuestion,
  cardPath,
  type SynthKind,
} from '../src/client/ask/synth.ts'
import { setAskLlmRemote } from '../src/client/ask/api.ts'

// synthesize.ts 经 ask/store.ts 导入 'react'（只为钩子）；本项目的 node_modules 中没有 react 运行时，
// 因此在测试进程内注册一个解析钩子，把 'react' 指向一个桩模块。仅影响本文件，不改动源码。
const REACT_STUB =
  'data:text/javascript,' +
  encodeURIComponent('export const useCallback = (fn) => fn; export const useSyncExternalStore = () => undefined;')
const HOOK_SOURCE =
  'export async function resolve(specifier, context, next) {' +
  `  if (specifier === 'react') return { url: ${JSON.stringify(REACT_STUB)}, shortCircuit: true };` +
  '  return next(specifier, context);' +
  '}'
register('data:text/javascript,' + encodeURIComponent(HOOK_SOURCE))
const { synthesize, OUTLINE_CAP } = await import('../src/client/tree/synthesize.ts')
const { loadAskEntries } = await import('../src/client/ask/store.ts')

type Src = { nodeId: string; title: string; knowledgeIds: string[]; knowledgeNames?: string[]; summary: string; callId: string }

function src(over: Partial<Src> & { title: string }): Pick<CardRecord, 'nodeId' | 'knowledgeIds' | 'knowledgeNames' | 'title'> {
  return {
    nodeId: over.nodeId ?? 'n-' + over.title,
    title: over.title,
    knowledgeIds: over.knowledgeIds ?? ['k1.2'],
    ...(over.knowledgeNames ? { knowledgeNames: over.knowledgeNames } : {}),
  }
}

function card(over: Partial<CardRecord> & { nodeId: string }): CardRecord {
  return {
    callId: `llm-${over.nodeId}`,
    title: `标题${over.nodeId}`,
    summary: `摘要${over.nodeId}`,
    kind: 'concept',
    knowledgeIds: ['k1.2'],
    followups: [],
    parentId: null,
    ...over,
  } as CardRecord
}

// ---------- buildSynthQuestion ----------

const CARDS = [
  { title: '卡诺图', summary: '用于化简' },
  { title: '格雷码', summary: '相邻只差一位' },
]

test('buildSynthQuestion: 三种类型各自的指令与编号卡片列表', () => {
  const kinds: [SynthKind, string][] = [
    ['compare', '对比'],
    ['summary', '总结'],
    ['outline', '复习提纲'],
  ]
  for (const [kind, keyword] of kinds) {
    const q = buildSynthQuestion(kind, CARDS)
    assert.ok(q.includes(keyword), `${kind} 应包含 "${keyword}"`)
    assert.ok(q.includes('1. 卡诺图：用于化简\n2. 格雷码：相邻只差一位'), `${kind} 应按序编号列出卡片`)
  }
})

test('buildSynthQuestion: 各类型的字数上限提示不同', () => {
  assert.ok(buildSynthQuestion('compare', CARDS).includes('400 字'))
  assert.ok(buildSynthQuestion('summary', CARDS).includes('300 字'))
  assert.ok(buildSynthQuestion('outline', CARDS).includes('600 字'))
})

test('buildSynthQuestion: 空卡片列表仍生成指令且不带编号行', () => {
  const q = buildSynthQuestion('summary', [])
  assert.ok(q.includes('卡片：'))
  assert.ok(!/\n1\. /.test(q))
})

test('buildSynthQuestion: 三种类型都要求用卡片标题引用，且禁止“卡1”“卡片1”编号', () => {
  const kinds: SynthKind[] = ['compare', 'summary', 'outline']
  for (const kind of kinds) {
    const q = buildSynthQuestion(kind, CARDS)
    assert.ok(q.includes('引用卡片时必须使用卡片标题（可加书名号），不要使用“卡1”“卡片1”这类编号。'), `${kind} 应包含标题引用规则`)
  }
})

test('buildSynthQuestion: 三种类型都要求纯文本、不用 LaTeX', () => {
  const kinds: SynthKind[] = ['compare', 'summary', 'outline']
  for (const kind of kinds) {
    const q = buildSynthQuestion(kind, CARDS)
    assert.ok(q.includes('用纯文本作答，不要使用 LaTeX'), `${kind} 应要求纯文本`)
  }
})

test('buildSynthQuestion: 摘要超过 80 字截断并加省略号，80 字以内原样保留', () => {
  const exact = '甲'.repeat(80)
  const q = buildSynthQuestion('outline', [
    { title: 'A', summary: exact },
    { title: 'B', summary: '乙'.repeat(81) },
  ])
  assert.ok(q.includes(`1. A：${exact}\n`))
  assert.ok(q.includes(`2. B：${'乙'.repeat(79)}…`))
  assert.ok(!q.includes('乙'.repeat(80)))
})

test('buildSynthQuestion: 40 张卡片的综合问题不超过 10000 字符', () => {
  const cards = Array.from({ length: 40 }, (_, i) => ({ title: `卡${i}`, summary: '摘'.repeat(500) }))
  for (const kind of ['compare', 'summary', 'outline'] as SynthKind[]) {
    const q = buildSynthQuestion(kind, cards)
    assert.ok(q.length <= 10000, `${kind} 长度 ${q.length}`)
    assert.ok(q.includes('1. 卡0：'), `${kind} 应保留首张卡片`)
  }
})

test('buildSynthQuestion: 标题过长时摘要收缩到 0 后截断标题，40 张卡片仍全部列出', () => {
  const cards = Array.from({ length: 40 }, (_, i) => ({ title: `${i}` + '标'.repeat(400), summary: '摘' }))
  const q = buildSynthQuestion('outline', cards)
  assert.ok(q.length <= 10000, `长度 ${q.length}`)
  assert.ok(!q.includes('未列出'))
  assert.ok(q.includes('40. 39' + '标'.repeat(27) + '…'))
  assert.ok(q.includes('1. 0' + '标'.repeat(28) + '…'))
})

test('buildSynthQuestion: 卡片多到连截断标题也超预算时丢弃末尾卡片并注明数量', () => {
  const cards = Array.from({ length: 400 }, (_, i) => ({ title: '题'.repeat(40), summary: `${i}` }))
  const q = buildSynthQuestion('summary', cards)
  assert.ok(q.length <= 10000, `长度 ${q.length}`)
  assert.match(q, /…（另有 \d+ 张卡片未列出）/)
  assert.ok(q.includes('1. ' + '题'.repeat(29) + '…'))
})

test('buildSynthQuestion: 摘要收缩顺序 80 → 40 → 20 → 0，只在需要时收缩', () => {
  // 40 张各 80 字摘要的短标题卡片远小于预算：保持 80 字。
  const small = Array.from({ length: 40 }, (_, i) => ({ title: `T${i}`, summary: '摘'.repeat(80) }))
  assert.ok(buildSynthQuestion('outline', small).includes('摘'.repeat(80)))
  assert.ok(buildSynthQuestion('outline', small).length < 10000)
})

// ---------- buildSynthEntry ----------

const NOW = 1_700_000_000_000

test('buildSynthEntry: kind 映射 compare->compare，summary 与 outline->summary', () => {
  const sources = [src({ title: 'A' })]
  const base = { sources, answer: '回答', now: NOW, token: 'tk' }
  assert.equal(buildSynthEntry({ ...base, kind: 'compare' }).card.kind, 'compare')
  assert.equal(buildSynthEntry({ ...base, kind: 'summary' }).card.kind, 'summary')
  assert.equal(buildSynthEntry({ ...base, kind: 'outline' }).card.kind, 'summary')
})

test('buildSynthEntry: 标题前缀与 outline 固定标题', () => {
  const sources = [src({ title: '卡诺图' }), src({ title: '格雷码' })]
  const base = { sources, answer: '回答', now: NOW, token: 'tk' }
  assert.equal(buildSynthEntry({ ...base, kind: 'compare' }).card.title, '对比：卡诺图、格雷码')
  assert.equal(buildSynthEntry({ ...base, kind: 'summary' }).card.title, '总结：卡诺图、格雷码')
  assert.equal(buildSynthEntry({ ...base, kind: 'outline' }).card.title, '复习提纲')
})

test('buildSynthEntry: 拼接标题超过 30 字符时截断并加省略号', () => {
  const long = '甲'.repeat(40)
  const e = buildSynthEntry({ sources: [src({ title: long })], answer: 'x', now: NOW, token: 'tk', kind: 'summary' })
  assert.equal(e.card.title, '总结：' + '甲'.repeat(30) + '…')
})

test('buildSynthEntry: 恰好 30 字符不加省略号', () => {
  const e = buildSynthEntry({ sources: [src({ title: '乙'.repeat(30) })], answer: 'x', now: NOW, token: 'tk', kind: 'summary' })
  assert.equal(e.card.title, '总结：' + '乙'.repeat(30))
})

test('buildSynthEntry: 截断按拼接后的字符串计算，分隔符“、”也计入', () => {
  const sources = [src({ title: 'a'.repeat(15) }), src({ title: 'b'.repeat(15) })]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  // 拼接后为 15 个 a + “、” + 15 个 b，共 31 字符，截取前 30 字符。
  assert.equal(e.card.title, '对比：' + 'a'.repeat(15) + '、' + 'b'.repeat(14) + '…')
})

test('buildSynthEntry: knowledgeIds 取并集并去重，保持首次出现顺序', () => {
  const sources = [
    src({ title: 'A', knowledgeIds: ['k1.2', 'k1.3'] }),
    src({ title: 'B', knowledgeIds: ['k1.3', 'k2.1', 'k1.2'] }),
  ]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.deepEqual(e.card.knowledgeIds, ['k1.2', 'k1.3', 'k2.1'])
})

test('buildSynthEntry: 所有知识点都有名称时才写入 knowledgeNames，并与 knowledgeIds 一一对应', () => {
  const sources = [
    src({ title: 'A', knowledgeIds: ['k1.2', 'k1.3'], knowledgeNames: ['二', '三'] }),
    src({ title: 'B', knowledgeIds: ['k1.3', 'k2.1'], knowledgeNames: ['三', '四'] }),
  ]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.deepEqual(e.card.knowledgeIds, ['k1.2', 'k1.3', 'k2.1'])
  assert.deepEqual(e.card.knowledgeNames, ['二', '三', '四'])
})

test('buildSynthEntry: 任一来源缺少名称时不写 knowledgeNames', () => {
  const sources = [
    src({ title: 'A', knowledgeIds: ['k1.2'], knowledgeNames: ['二'] }),
    src({ title: 'B', knowledgeIds: ['k2.1'] }),
  ]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.deepEqual(e.card.knowledgeIds, ['k1.2', 'k2.1'])
  assert.equal('knowledgeNames' in e.card, false)
})

test('buildSynthEntry: 名称数组长度与 knowledgeIds 不符时忽略名称', () => {
  const sources = [src({ title: 'A', knowledgeIds: ['k1.2', 'k1.3'], knowledgeNames: ['二'] })]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.equal('knowledgeNames' in e.card, false)
})

test('buildSynthEntry: 某个名称为空字符串时视为缺失', () => {
  const sources = [src({ title: 'A', knowledgeIds: ['k1.2', 'k1.3'], knowledgeNames: ['二', ''] })]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.equal('knowledgeNames' in e.card, false)
})

test('buildSynthEntry: 无知识点时 knowledgeIds 为空且不写名称', () => {
  const sources = [src({ title: 'A', knowledgeIds: [] })]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'summary' })
  assert.deepEqual(e.card.knowledgeIds, [])
  assert.equal('knowledgeNames' in e.card, false)
})

test('buildSynthEntry: sources 记录各来源卡片的 nodeId（按传入顺序）', () => {
  const sources = [src({ title: 'A', nodeId: 'na' }), src({ title: 'B', nodeId: 'nb' })]
  const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'tk', kind: 'compare' })
  assert.deepEqual(e.card.sources, ['na', 'nb'])
})

test('buildSynthEntry: 没有来源时不写 sources 字段', () => {
  const e = buildSynthEntry({ sources: [], answer: 'x', now: NOW, token: 'tk', kind: 'outline' })
  assert.equal('sources' in e.card, false)
})

test('buildSynthEntry: 根卡片、无追问，完整回答保留，摘要由 answerSummary 生成', () => {
  const answer = '  第一行\n第二行  '
  const e = buildSynthEntry({ sources: [src({ title: 'A' })], answer, now: NOW, token: 'tk', kind: 'summary' })
  assert.equal(e.answer, answer)
  assert.equal(e.card.summary, answerSummary(answer))
  assert.equal(e.card.summary, '第一行 第二行')
  assert.equal(e.card.parentId, null)
  assert.deepEqual(e.card.followups, [])
  assert.equal('parentFollowup' in e.card, false)
})

test('buildSynthEntry: 同一 now 与 token 派生的 id 确定；不同 token 得到不同 nodeId/callId', () => {
  const sources = [src({ title: 'A' })]
  const a = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'aaa', kind: 'summary' })
  const again = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'aaa', kind: 'summary' })
  const b = buildSynthEntry({ sources, answer: 'x', now: NOW, token: 'bbb', kind: 'summary' })
  assert.equal(a.card.nodeId, again.card.nodeId)
  assert.equal(a.card.callId, again.card.callId)
  assert.notEqual(a.card.nodeId, b.card.nodeId)
  assert.notEqual(a.card.callId, b.card.callId)
  assert.equal(a.card.callId, `llm-${NOW}-aaa`)
  assert.ok(a.card.nodeId.startsWith('s'))
})

test('buildSynthEntry: 真实随机 token 批量生成的 nodeId 与 callId 基本唯一', () => {
  const sources = [src({ title: 'A' })]
  const nodeIds = new Set<string>()
  const callIds = new Set<string>()
  for (let i = 0; i < 200; i++) {
    const e = buildSynthEntry({ sources, answer: 'x', now: NOW, token: randomToken(), kind: 'summary' })
    nodeIds.add(e.card.nodeId)
    callIds.add(e.card.callId)
  }
  assert.equal(nodeIds.size, 200)
  assert.equal(callIds.size, 200)
})

// ---------- cardPath ----------

test('cardPath: 不存在的 nodeId 返回空数组', () => {
  assert.deepEqual(cardPath([card({ nodeId: 'a' })], 'zzz'), [])
  assert.deepEqual(cardPath([], 'a'), [])
})

test('cardPath: 根卡片只返回自身', () => {
  const a = card({ nodeId: 'a' })
  assert.deepEqual(cardPath([a], 'a'), [a])
})

test('cardPath: 沿 parentId 向上，返回从根到自身的顺序', () => {
  const root = card({ nodeId: 'root' })
  const mid = card({ nodeId: 'mid', parentId: 'root' })
  const leaf = card({ nodeId: 'leaf', parentId: 'mid' })
  // 输入顺序打乱，结果仍应按 root -> mid -> leaf。
  const path = cardPath([leaf, root, mid], 'leaf')
  assert.deepEqual(path.map((c) => c.nodeId), ['root', 'mid', 'leaf'])
})

test('cardPath: 父卡片缺失时停止，只返回已知部分', () => {
  const leaf = card({ nodeId: 'leaf', parentId: 'ghost' })
  assert.deepEqual(cardPath([leaf], 'leaf').map((c) => c.nodeId), ['leaf'])
})

test('cardPath: 两节点成环时终止', () => {
  const a = card({ nodeId: 'a', parentId: 'b' })
  const b = card({ nodeId: 'b', parentId: 'a' })
  const path = cardPath([a, b], 'a')
  assert.deepEqual(path.map((c) => c.nodeId), ['b', 'a'])
})

test('cardPath: 自环时终止', () => {
  const a = card({ nodeId: 'a', parentId: 'a' })
  assert.deepEqual(cardPath([a], 'a').map((c) => c.nodeId), ['a'])
})

test('cardPath: 重复 nodeId 时以第一条为准', () => {
  const first = card({ nodeId: 'dup', title: '第一条' })
  const second = card({ nodeId: 'dup', title: '第二条' })
  const path = cardPath([first, second], 'dup')
  assert.equal(path.length, 1)
  assert.equal(path[0]!.title, '第一条')
})

// ---------- branchMarkdown ----------

test('branchMarkdown: 第一行为固定前缀', () => {
  const md = branchMarkdown([card({ nodeId: 'a' })], new Map())
  assert.equal(md.split('\n')[0], BRANCH_PREFIX)
  assert.equal(BRANCH_PREFIX, '以下是我在学习树中的一条学习分支，请基于它继续：')
})

test('branchMarkdown: 空路径只输出前缀', () => {
  assert.equal(branchMarkdown([], new Map()), BRANCH_PREFIX)
})

test('branchMarkdown: 有完整回答时使用完整回答（按 callId 索引）', () => {
  const c = card({ nodeId: 'a', callId: 'call-1', title: '卡诺图', summary: '摘要', knowledgeIds: ['k1.5.2'] })
  const md = branchMarkdown([c], new Map([['call-1', '  完整回答\n第二段  ']]))
  assert.equal(md, BRANCH_PREFIX + '\n\n### 1. 卡诺图\n知识点：k1.5.2\n\n完整回答\n第二段')
})

test('branchMarkdown: 缺少完整回答时回退为摘要', () => {
  const c = card({ nodeId: 'a', callId: 'call-1', title: '卡诺图', summary: '摘要文本', knowledgeIds: ['k1.5.2'] })
  const md = branchMarkdown([c], new Map([['other', '无关']]))
  assert.equal(md, BRANCH_PREFIX + '\n\n### 1. 卡诺图\n知识点：k1.5.2\n\n摘要文本')
})

test('branchMarkdown: 知识点有名称时显示名称，否则显示编号；无知识点显示“无”', () => {
  const named = card({ nodeId: 'a', callId: 'c1', knowledgeIds: ['k1.2', 'k1.3'], knowledgeNames: ['二', '三'] })
  const plain = card({ nodeId: 'b', callId: 'c2', knowledgeIds: ['k2.1'] })
  const none = card({ nodeId: 'c', callId: 'c3', knowledgeIds: [] })
  const md = branchMarkdown([named, plain, none], new Map())
  assert.ok(md.includes('知识点：二、三\n'))
  assert.ok(md.includes('知识点：k2.1\n'))
  assert.ok(md.includes('知识点：无\n'))
})

test('branchMarkdown: 多张卡片按顺序编号并以空行分隔', () => {
  const md = branchMarkdown(
    [card({ nodeId: 'a', callId: 'c1', title: 'A' }), card({ nodeId: 'b', callId: 'c2', title: 'B' })],
    new Map([['c1', '答1'], ['c2', '答2']]),
  )
  assert.ok(md.includes('### 1. A\n知识点：k1.2\n\n答1\n\n### 2. B\n知识点：k1.2\n\n答2'))
})

// ---------- synthesize (side effects, react stubbed; remote mocked) ----------

function remoteReturning(text: string, calls: string[]) {
  setAskLlmRemote(async (_sid, cmd) => {
    calls.push(cmd)
    return { ok: true, value: { result: { kind: 'success', text } } }
  })
}

test('synthesize: 成功时新增一条综合卡片并返回 ok', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  t.mock.method(console, 'warn', () => {})
  const calls: string[] = []
  remoteReturning('这是对比结论', calls)
  const sid = 'sess-success-' + randomToken()
  const cards = [card({ nodeId: 'a', title: '卡诺图', knowledgeIds: ['k1.5.2'] }), card({ nodeId: 'b', title: '格雷码', knowledgeIds: ['k1.5.1'] })]
  const r = await synthesize(sid, 'compare', cards)
  assert.equal(r.ok, true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0]!.startsWith('/dlogic-ask-llm '))
  assert.ok(calls[0]!.includes('对比'))
  const entries = loadAskEntries(sid)
  assert.equal(entries.length, 1)
  assert.equal(entries[0]!.answer, '这是对比结论')
  assert.equal(entries[0]!.card.title, '对比：卡诺图、格雷码')
  assert.equal(entries[0]!.card.kind, 'compare')
  assert.deepEqual(entries[0]!.card.knowledgeIds, ['k1.5.2', 'k1.5.1'])
  assert.equal(entries[0]!.card.parentId, null)
  assert.equal(r.ok && r.nodeId, entries[0]!.card.nodeId)
  assert.deepEqual(entries[0]!.card.sources, ['a', 'b'])
})

test('synthesize: outline 最多只纳入 OUTLINE_CAP 张卡片', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  const calls: string[] = []
  remoteReturning('提纲', calls)
  const sid = 'sess-outline-' + randomToken()
  const cards = Array.from({ length: OUTLINE_CAP + 5 }, (_, i) => card({ nodeId: 'n' + i, title: 't' + i }))
  const r = await synthesize(sid, 'outline', cards)
  assert.equal(r.ok, true)
  const payload = JSON.parse(calls[0]!.slice(calls[0]!.indexOf(' ') + 1)) as { path: unknown[] }
  assert.equal(payload.path.length, OUTLINE_CAP)
  const entry = loadAskEntries(sid)[0]!
  assert.equal(entry.card.title, '复习提纲')
  assert.equal(entry.card.kind, 'summary')
})

test('synthesize: 模型返回失败时给出其错误文本，且不新增卡片', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  setAskLlmRemote(async () => ({ ok: true, value: { result: { kind: 'error', text: '模型超时' } } }))
  const sid = 'sess-fail-' + randomToken()
  const r = await synthesize(sid, 'summary', [card({ nodeId: 'a' })])
  assert.deepEqual(r, { ok: false, error: '模型超时' })
  assert.equal(loadAskEntries(sid).length, 0)
})

test('synthesize: 远程调用抛出异常时返回中文错误，且不新增卡片', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  t.mock.method(console, 'warn', () => {})
  setAskLlmRemote(async () => {
    throw new Error('boom')
  })
  const sid = 'sess-throw-' + randomToken()
  // askFollowupLlm 自身会捕获异常并返回通用失败文本，因此这里应得到 ok:false。
  const r = await synthesize(sid, 'compare', [card({ nodeId: 'a' })])
  assert.deepEqual(r, { ok: false, error: '追问未能发送，请重试。' })
  assert.equal(loadAskEntries(sid).length, 0)
})

test('synthesize: 没有卡片时直接失败且不调用模型', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  const calls: string[] = []
  remoteReturning('x', calls)
  const sid = 'sess-empty-' + randomToken()
  const r = await synthesize(sid, 'summary', [])
  assert.deepEqual(r, { ok: false, error: '没有可用的卡片。' })
  assert.equal(calls.length, 0)
  assert.equal(loadAskEntries(sid).length, 0)
})

test('synthesize: 未注入远程执行函数时返回未就绪', async (t) => {
  t.after(() => setAskLlmRemote(undefined))
  setAskLlmRemote(undefined)
  const sid = 'sess-noremote-' + randomToken()
  const r = await synthesize(sid, 'summary', [card({ nodeId: 'a' })])
  assert.deepEqual(r, { ok: false, error: '追问服务尚未就绪' })
  assert.equal(loadAskEntries(sid).length, 0)
})
