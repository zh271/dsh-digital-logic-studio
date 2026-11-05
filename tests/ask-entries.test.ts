import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CardRecord } from '../src/shared/contracts.ts'
import {
  ASK_MAX_ENTRIES,
  ASK_SUMMARY_MAX,
  addAskEntry,
  answerSummary,
  atomFollowups,
  askStorageKey,
  buildAskEntry,
  parseAskEntries,
  sanitizeSources,
  serializeAskEntries,
  type AskEntry,
} from '../src/client/ask/entries.ts'

const PARENT = { nodeId: 'n1', knowledgeIds: ['k1.2', 'k1.3'] }

function entry(i: number): AskEntry {
  return buildAskEntry({ parent: PARENT, index: 0, question: `问题${i}`, answer: `回答${i}`, now: 1000 + i, token: `t${i}` })
}

test('buildAskEntry 生成概念卡片，继承知识点并挂到父卡片', () => {
  const e = buildAskEntry({ parent: PARENT, index: 2, question: '为什么？', answer: '因为。\n结论：是。', now: 42, token: 'abc' })
  assert.equal(e.card.title, '为什么？')
  assert.equal(e.card.kind, 'concept')
  assert.deepEqual(e.card.knowledgeIds, ['k1.2', 'k1.3'])
  // 追问桩由知识图谱确定性生成（k1.2、k1.3 的未探索子知识点）。
  assert.deepEqual(e.card.followups, atomFollowups(PARENT.knowledgeIds, new Set(PARENT.knowledgeIds)))
  assert.ok(e.card.followups.length > 0)
  assert.equal(e.card.parentId, 'n1')
  assert.equal(e.card.parentFollowup, 2)
  assert.equal(e.card.callId, 'llm-42-abc')
  assert.notEqual(e.card.nodeId, PARENT.nodeId)
  assert.equal(e.answer, '因为。\n结论：是。')
  assert.equal(e.card.summary, '因为。 结论：是。')
  // 知识点是副本，不与父卡片共享数组。
  assert.notEqual(e.card.knowledgeIds, PARENT.knowledgeIds)
})

test('buildAskEntry 追问桩优先用模型给出的 followups，为空时才用知识图谱的', () => {
  const model = [{ question: '如果不相邻呢', angle: 'variant' as const, why: '检验' }]
  const withModel = buildAskEntry({ parent: PARENT, index: 0, question: '问', answer: '答', followups: model, now: 1, token: 'a' })
  assert.deepEqual(withModel.card.followups, [{ question: '如果不相邻呢', angle: 'variant', why: '检验' }])
  const withEmpty = buildAskEntry({ parent: PARENT, index: 0, question: '问', answer: '答', followups: [], now: 2, token: 'b' })
  assert.deepEqual(withEmpty.card.followups, atomFollowups(PARENT.knowledgeIds, new Set(PARENT.knowledgeIds)))
})

test('answerSummary 压缩空白并按字符截断到 200', () => {
  assert.equal(answerSummary('  甲\n\n乙  '), '甲 乙')
  const long = '字'.repeat(ASK_SUMMARY_MAX + 5)
  const s = answerSummary(long)
  assert.equal(Array.from(s).length, ASK_SUMMARY_MAX + 1)
  assert.ok(s.endsWith('…'))
  assert.equal(answerSummary('短'), '短')
})

test('addAskEntry 按 callId 去重，返回同一数组引用', () => {
  const list = [entry(1)]
  const same = addAskEntry(list, entry(1))
  assert.equal(same, list)
  const next = addAskEntry(list, entry(2))
  assert.equal(next.length, 2)
  assert.equal(list.length, 1)
})

test('addAskEntry 超过 100 条时丢弃最旧的', () => {
  let list: readonly AskEntry[] = []
  for (let i = 0; i < ASK_MAX_ENTRIES + 3; i++) list = addAskEntry(list, entry(i))
  assert.equal(list.length, ASK_MAX_ENTRIES)
  assert.equal(list[0].answer, `回答${3}`)
  assert.equal(list[list.length - 1].answer, `回答${ASK_MAX_ENTRIES + 2}`)
})

test('序列化后可原样解析', () => {
  const list = [entry(1), entry(2)]
  const back = parseAskEntries(serializeAskEntries(list))
  assert.deepEqual(back, list)
})

test('parseAskEntries 对坏数据返回空或丢弃坏条目', () => {
  assert.deepEqual(parseAskEntries(null), [])
  assert.deepEqual(parseAskEntries(''), [])
  assert.deepEqual(parseAskEntries('{不是json'), [])
  assert.deepEqual(parseAskEntries(JSON.stringify({ v: 1 })), [])
  const good = entry(1)
  const bad = { card: { nodeId: '', callId: 'x' }, answer: 'a' }
  const noAnswer = { card: good.card }
  const raw = JSON.stringify({ v: 1, items: [bad, noAnswer, good, 7, null] })
  assert.deepEqual(parseAskEntries(raw), [good])
})

test('parseAskEntries 对重复 callId 只保留第一条', () => {
  const a = entry(1)
  const dup: AskEntry = { card: { ...a.card, title: '另一个' } as CardRecord, answer: '另一回答' }
  const raw = JSON.stringify({ v: 1, items: [a, dup] })
  const out = parseAskEntries(raw)
  assert.equal(out.length, 1)
  assert.equal(out[0].answer, a.answer)
})

test('parseAskEntries 超过上限时保留最新的', () => {
  const items = Array.from({ length: ASK_MAX_ENTRIES + 5 }, (_, i) => entry(i))
  const out = parseAskEntries(JSON.stringify({ v: 1, items }))
  assert.equal(out.length, ASK_MAX_ENTRIES)
  assert.equal(out[out.length - 1].answer, items[items.length - 1].answer)
})

test('存储键按主会话 id 分开', () => {
  assert.equal(askStorageKey('s1'), 'dlogic.ask.s1')
  assert.notEqual(askStorageKey('s1'), askStorageKey('s2'))
})

test('buildAskEntry 继承父卡片的知识点名称（有则带上，无则不加字段）', () => {
  const named = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.2'], knowledgeNames: ['二进制系统'] },
    index: 0,
    question: '问',
    answer: '答',
    now: 1,
    token: 'x',
  })
  assert.deepEqual(named.card.knowledgeNames, ['二进制系统'])
  const legacy = buildAskEntry({ parent: PARENT, index: 0, question: '问', answer: '答', now: 2, token: 'y' })
  assert.equal('knowledgeNames' in legacy.card, false)
})

test('综合卡片的 sources 序列化后保留', () => {
  const e = entry(1)
  const synth = { ...e, card: { ...e.card, sources: ['na', 'nb'] } }
  const back = parseAskEntries(serializeAskEntries([synth]))
  assert.deepEqual(back, [synth])
  assert.deepEqual(back[0]!.card.sources, ['na', 'nb'])
})

test('sources 形状不对时只丢弃该字段，卡片保留', () => {
  const e = entry(2)
  const raw = JSON.stringify({ v: 1, items: [{ answer: e.answer, card: { ...e.card, sources: 'na' } }] })
  const back = parseAskEntries(raw)
  assert.equal(back.length, 1)
  assert.equal('sources' in back[0]!.card, false)
  assert.equal(back[0]!.card.callId, e.card.callId)
})

test('sanitizeSources 对合法 sources 与无 sources 的卡片原样返回', () => {
  const e = entry(3)
  assert.equal(sanitizeSources(e.card), e.card)
  const ok = { ...e.card, sources: ['x'] }
  assert.equal(sanitizeSources(ok), ok)
  const bad = { ...e.card, sources: [1 as unknown as string] }
  assert.equal('sources' in sanitizeSources(bad), false)
  assert.equal('sources' in bad, true)
})
