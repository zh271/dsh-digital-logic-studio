import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { CardInput, Followup } from '../src/shared/contracts.ts'
import { defaultKnowledgeBase } from '../src/solvers/knowledge.ts'
import { shortId, validateCard } from '../src/solvers/card.ts'

const kb = defaultKnowledgeBase()

// k1.5.2 的邻域包含 k1.5.1、k1.3.1、k1.5 等，下面的追问都落在邻域内。
function followups(): Followup[] {
  return [
    { question: '为什么相邻格只差一位？', angle: 'principle', why: '理解格雷码', knowledgeId: 'k1.5.1' },
    { question: '无关项怎么圈？', angle: 'variant', why: '换个条件', knowledgeId: 'k1.3.1' },
    { question: '圈组时常见错误？', angle: 'pitfall', why: '易错点', knowledgeId: 'k1.5' },
  ]
}

function validInput(over: Partial<CardInput> = {}): CardInput {
  return {
    title: '卡诺图化简示例',
    kind: 'solution',
    summary: '用卡诺图化简三变量函数。',
    knowledgeIds: ['k1.5.2'],
    followups: followups(),
    parentId: null,
    ...over,
  }
}

function expectFatal(input: unknown, pattern: RegExp = /./): void {
  assert.throws(
    () => validateCard(input as CardInput, kb),
    (err: unknown) => err instanceof DlogicInputError && pattern.test(err.message),
  )
}

test('shortId is deterministic and matches the pattern', () => {
  const a = shortId('call-abc-123')
  assert.equal(a, shortId('call-abc-123'))
  assert.match(a, /^c[0-9A-Za-z]{4}$/)
  assert.equal(a.length, 5)
  assert.notEqual(shortId('call-1'), shortId('call-2'))
})

test('valid card passes with no warnings', () => {
  const { card, warnings } = validateCard(validInput(), kb)
  assert.deepEqual(warnings, [])
  assert.equal(card.title, '卡诺图化简示例')
  assert.equal(card.followups.length, 3)
  assert.equal(card.parentId, null)
  assert.equal('parentFollowup' in card, false)
})

test('repeated follow-up angles produce a warning', () => {
  const fs = followups()
  fs[1] = { ...fs[1], angle: 'principle' }
  const { warnings } = validateCard(validInput({ followups: fs }), kb)
  assert.ok(warnings.some((w) => w.includes('角度重复') && w.includes('principle')))
})

test('trims strings', () => {
  const { card } = validateCard(
    validInput({ title: '  标题  ', summary: ' 摘要 ', knowledgeIds: [' k1.5.2 '] }),
    kb,
  )
  assert.equal(card.title, '标题')
  assert.equal(card.summary, '摘要')
  assert.deepEqual(card.knowledgeIds, ['k1.5.2'])
})

test('fatal: empty title', () => {
  expectFatal(validInput({ title: '   ' }), /标题/)
})

test('fatal: empty summary', () => {
  expectFatal(validInput({ summary: '' }), /摘要/)
})

test('fatal: zero followups', () => {
  expectFatal(validInput({ followups: [] }), /至少/)
})

test('fatal: more than six followups', () => {
  const many = Array.from({ length: 7 }, (_, i) => ({ question: `问题${i}`, angle: 'free' as const, why: '' }))
  expectFatal(validInput({ followups: many }), /最多 6/)
})

test('unknown followup angle falls back to free with a warning', () => {
  const bad = followups()
  bad[0] = { ...bad[0], angle: 'compare' as never }
  const { card, warnings } = validateCard(validInput({ followups: bad }), kb)
  assert.equal(card.followups[0].angle, 'free')
  assert.ok(warnings.some(w => /角度/.test(w) && /compare/.test(w)))
})

test('fatal: unknown kind', () => {
  expectFatal(validInput({ kind: 'nonsense' as never }), /卡片类型/)
})

test('fatal: negative parentFollowup', () => {
  expectFatal(validInput({ parentId: 'c7K2Q', parentFollowup: -1 }), /非负整数/)
})

test('fatal: fractional parentFollowup', () => {
  expectFatal(validInput({ parentId: 'c7K2Q', parentFollowup: 1.5 }), /非负整数/)
})

test('fatal: parentFollowup without parentId', () => {
  expectFatal(validInput({ parentId: null, parentFollowup: 0 }), /parentId/)
})

test('valid expansion keeps parentId and parentFollowup', () => {
  const { card, warnings } = validateCard(validInput({ parentId: 'c7K2Q', parentFollowup: 1 }), kb)
  assert.equal(card.parentId, 'c7K2Q')
  assert.equal(card.parentFollowup, 1)
  assert.deepEqual(warnings, [])
})

test('unknown knowledgeId is removed with a warning', () => {
  const { card, warnings } = validateCard(validInput({ knowledgeIds: ['k1.5.2', 'k9.9.9'] }), kb)
  assert.deepEqual(card.knowledgeIds, ['k1.5.2'])
  assert.ok(warnings.some((w) => w.includes('k9.9.9')), warnings.join(' | '))
})

test('unknown followup knowledgeId is removed with a warning', () => {
  const list = followups()
  list[2] = { ...list[2], knowledgeId: 'k42' }
  const { card, warnings } = validateCard(validInput({ followups: list }), kb)
  assert.equal(card.followups[2].knowledgeId, undefined)
  assert.ok(warnings.some((w) => w.includes('k42')))
})

test('five followups produce a count warning', () => {
  const list: Followup[] = [
    ...followups(),
    { question: '第四问', angle: 'verify', why: '', knowledgeId: 'k1.5.1' },
    { question: '第五问', angle: 'practice', why: '', knowledgeId: 'k1.3.1' },
  ]
  const { card, warnings } = validateCard(validInput({ followups: list }), kb)
  assert.equal(card.followups.length, 5)
  assert.ok(warnings.some((w) => w.includes('2–4')), warnings.join(' | '))
})

test('duplicate followup questions keep the first', () => {
  const list = followups()
  list.push({ ...list[0], why: '重复项' })
  const { card, warnings } = validateCard(validInput({ followups: list }), kb)
  assert.equal(card.followups.length, 3)
  assert.equal(card.followups[0].why, '理解格雷码')
  assert.ok(warnings.some((w) => w.includes('重复')))
})

test('fewer than two followups in the neighborhood warns', () => {
  const list = followups().map((f) => ({ ...f, knowledgeId: 'k7.1' }))
  const { warnings } = validateCard(validInput({ followups: list }), kb)
  assert.ok(warnings.some((w) => w.includes('邻域')), warnings.join(' | '))
})

test('malformed parentId warns but is kept', () => {
  const { card, warnings } = validateCard(validInput({ parentId: 'xyz', parentFollowup: 0 }), kb)
  assert.equal(card.parentId, 'xyz')
  assert.ok(warnings.some((w) => w.includes('xyz')))
})

test('knowledge names resolve to ids; id-shaped unknowns are still removed', () => {
  const r = validateCard(validInput({ knowledgeIds: ['卡诺图', 'k9.9.9'] }), kb)
  const card = (r as { card?: { knowledgeIds: string[] } }).card ?? (r as unknown as { knowledgeIds: string[] })
  assert.ok(card.knowledgeIds.length >= 1 && card.knowledgeIds.every((id) => kb.has(id)), JSON.stringify(card.knowledgeIds))
  const warnings = (r as { warnings?: string[] }).warnings ?? []
  assert.ok(warnings.some((w) => w.includes('k9.9.9')), warnings.join(' | '))
})
test('knowledge name matching ignores generic words (组合逻辑电路设计 → k2.2) and still finds 逻辑图', () => {
  const ids = (name: string): string[] => {
    const r = validateCard(validInput({ knowledgeIds: [name] }), kb)
    return ((r as { card?: { knowledgeIds: string[] } }).card ?? (r as unknown as { knowledgeIds: string[] })).knowledgeIds
  }
  assert.deepEqual(ids('组合逻辑电路设计'), ['k2.2'])
  assert.deepEqual(ids('逻辑图'), ['k1.3.2'])
  assert.deepEqual(ids('卡诺图'), ['k1.5'])
  assert.deepEqual(ids('完全无关的东西'), [])
})