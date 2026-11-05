import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { KnowledgeNode } from '../src/shared/contracts.ts'
import { createKnowledgeBase, defaultKnowledgeBase } from '../src/solvers/knowledge.ts'
import { ASK_FOLLOWUP_WHY, atomFollowups, buildAskEntry } from '../src/client/ask/entries.ts'

function node(id: string, title: string, extra: Partial<KnowledgeNode> = {}): KnowledgeNode {
  return {
    id,
    title,
    chapter: Number(id.slice(1).split('.')[0]),
    prereqs: [],
    related: [],
    keywords: [],
    ...extra,
  }
}

// 手工小图谱：k1.1 有 4 个子知识点；k1.2 是原子（两个前置、一个相关）；k1.6 的子知识点标题很长。
const KB = createKnowledgeBase([
  node('k1', '第一章'),
  node('k1.1', '甲'),
  node('k1.1.1', '甲一'),
  node('k1.1.2', '甲二'),
  node('k1.1.3', '甲三'),
  node('k1.1.4', '甲四'),
  node('k1.2', '乙', { prereqs: ['k1.1', 'k1.4'], related: ['k1.3'] }),
  node('k1.3', '丙'),
  node('k1.4', '丁'),
  node('k1.5', '戊', { related: ['k1.4'] }),
  node('k1.6', '己'),
  node('k1.6.1', '这是一个非常非常长的知识点标题用来测试截断功能是否正常工作'),
])

test('atomFollowups 有子知识点时按图谱顺序细化，最多 3 条，角度为 principle', () => {
  const out = atomFollowups(['k1.1'], new Set(), KB)
  assert.deepEqual(
    out.map((f) => f.knowledgeId),
    ['k1.1.1', 'k1.1.2', 'k1.1.3'],
  )
  for (const f of out) {
    assert.equal(f.angle, 'principle')
    assert.equal(f.why, '细化：甲')
    assert.equal(f.question, `「${KB.get(f.knowledgeId!)!.title}」具体是什么？`)
  }
})

test('atomFollowups 跳过已探索的子知识点', () => {
  const out = atomFollowups(['k1.1'], new Set(['k1.1.1']), KB)
  assert.deepEqual(
    out.map((f) => f.knowledgeId),
    ['k1.1.2', 'k1.1.3', 'k1.1.4'],
  )
  assert.deepEqual(
    atomFollowups(['k1.1'], new Set(['k1.1.1', 'k1.1.2', 'k1.1.3', 'k1.1.4']), KB),
    // 子知识点全部探索过：退回到横向追问（k1.1 没有前置与相关，故为空）。
    [],
  )
})

test('atomFollowups 多个知识点按 knowledgeIds 顺序收集，总数仍不超过 3 条', () => {
  const out = atomFollowups(['k1.6', 'k1.1'], new Set(), KB)
  assert.deepEqual(
    out.map((f) => f.knowledgeId),
    ['k1.6.1', 'k1.1.1', 'k1.1.2'],
  )
})

test('atomFollowups 子标题过长时截断，问题仍不超过 30 个字符', () => {
  const [f] = atomFollowups(['k1.6'], new Set(), KB)
  assert.ok(Array.from(f.question).length <= 30)
  assert.ok(f.question.includes('…'))
  assert.ok(f.question.endsWith('具体是什么？'))
})

test('atomFollowups 原子知识点：前置最多 2 条（prerequisite），不足再取相关（variant）', () => {
  const out = atomFollowups(['k1.2'], new Set(), KB)
  assert.deepEqual(
    out.map((f) => [f.angle, f.knowledgeId, f.question]),
    [
      ['prerequisite', 'k1.1', '学「甲」要先懂什么？'],
      ['prerequisite', 'k1.4', '学「丁」要先懂什么？'],
    ],
  )
  const withRelated = atomFollowups(['k1.5'], new Set(), KB)
  assert.deepEqual(withRelated.map((f) => [f.angle, f.knowledgeId]), [['variant', 'k1.4']])
  assert.equal(withRelated[0].question, '「丁」和它有什么联系？')
  assert.equal(withRelated[0].why, '与戊相关')
})

test('atomFollowups 横向追问跳过已探索的知识点，不足 2 条时继续取相关', () => {
  // k1.1 已探索：前置只剩 k1.4，再补一条相关 k1.3。
  const out = atomFollowups(['k1.2'], new Set(['k1.1']), KB)
  assert.deepEqual(out.map((f) => [f.angle, f.knowledgeId]), [['prerequisite', 'k1.4'], ['variant', 'k1.3']])
})

test('atomFollowups 未知 id 被忽略，全部未知或无可用追问时返回空数组', () => {
  assert.deepEqual(atomFollowups(['k9.9', 'k1.2'], new Set(), KB), atomFollowups(['k1.2'], new Set(), KB))
  assert.deepEqual(atomFollowups(['k9.9'], new Set(), KB), [])
  assert.deepEqual(atomFollowups([], new Set(), KB), [])
  // k1.6.1 没有子知识点、前置或相关。
  assert.deepEqual(atomFollowups(['k1.6.1'], new Set(), KB), [])
})

test('真实图谱：从 k1.5 沿第一个追问逐层细化，几步内到达原子，之后只剩横向追问或为空', () => {
  const kb = defaultKnowledgeBase()
  const explored = new Set<string>()
  let ids = ['k1.5']
  let steps = 0
  while (kb.neighbors(ids[0]).children.length > 0 && steps < 5) {
    const fs = atomFollowups(ids, explored, kb)
    assert.ok(fs.length > 0, `第 ${steps} 步应有细化追问`)
    assert.equal(fs[0].angle, 'principle')
    ids = [fs[0].knowledgeId!]
    explored.add(ids[0])
    steps++
  }
  assert.ok(kb.neighbors(ids[0]).children.length === 0, `5 步内未到达原子（停在 ${ids[0]}）`)
  for (const f of atomFollowups(ids, explored, kb)) {
    assert.ok(f.angle === 'prerequisite' || f.angle === 'variant')
  }
})

test('buildAskEntry 点击细化追问时知识点聚焦到子知识点', () => {
  const kb = defaultKnowledgeBase()
  const e = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.5'], knowledgeNames: ['卡诺图'] },
    index: 0,
    followup: { question: '「卡诺图的结构与特点」具体是什么？', angle: 'principle', why: '细化：卡诺图', knowledgeId: 'k1.5.1' },
    explored: ['k1.5'],
    question: '「卡诺图的结构与特点」具体是什么？',
    answer: '答',
    followups: [],
    now: 7,
    token: 'r',
  })
  assert.deepEqual(e.card.knowledgeIds, ['k1.5.1'])
  assert.deepEqual(e.card.knowledgeNames, [kb.get('k1.5.1')!.title])
  assert.equal(e.card.parentId, 'n1')
  assert.equal(e.card.parentFollowup, 0)
  // k1.5.1 是原子：追问只能是横向的。
  assert.ok(e.card.followups.length > 0)
  for (const f of e.card.followups) assert.ok(f.angle === 'prerequisite' || f.angle === 'variant')
})

test('buildAskEntry 追问指向未知知识点时继承父卡片的知识点', () => {
  const e = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.5'], knowledgeNames: ['卡诺图'] },
    followup: { question: '问', angle: 'free', why: '', knowledgeId: 'k9.9' },
    question: '问',
    answer: '答',
    now: 8,
    token: 's',
  })
  assert.deepEqual(e.card.knowledgeIds, ['k1.5'])
  assert.deepEqual(e.card.knowledgeNames, ['卡诺图'])
})

test('buildAskEntry 自由提问（无 followup）时，新卡片的追问桩跳过已探索的子知识点', () => {
  const e = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.5'] },
    explored: ['k1.5.1'],
    question: '问',
    answer: '答',
    now: 9,
    token: 't',
  })
  assert.deepEqual(e.card.knowledgeIds, ['k1.5'])
  assert.equal('knowledgeNames' in e.card, false)
  assert.deepEqual(e.card.followups.map((f) => f.knowledgeId), ['k1.5.2'])
})

test('buildAskEntry 模型追问为空且知识图谱也无追问时，新卡片没有追问桩', () => {
  // k1.6.1 在真实图谱中是原子且无前置、无相关，确定性追问为空。
  const e = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.6.1'] },
    question: '问',
    answer: '答',
    followups: [],
    now: 10,
    token: 'u',
  })
  assert.deepEqual(e.card.followups, [])
})

test('buildAskEntry 模型追问非空时优先于知识图谱（原子知识点也用模型的）', () => {
  // k1.6.1 是原子：若走图谱会得到空；模型追问应直接生效。
  const e = buildAskEntry({
    parent: { nodeId: 'n1', knowledgeIds: ['k1.6.1'] },
    question: '问',
    answer: '答',
    followups: [{ question: '模型问的问题', angle: 'variant', why: '' }],
    now: 11,
    token: 'v',
  })
  assert.deepEqual(e.card.followups, [{ question: '模型问的问题', angle: 'variant', why: ASK_FOLLOWUP_WHY }])
})

test('buildAskEntry: title overrides the question as the card title', () => {
  const e = buildAskEntry({
    parent: { nodeId: 'p', knowledgeIds: ['k1.5'], knowledgeNames: ['卡诺图'] },
    question: '「卡诺图」是什么？',
    title: '卡诺图',
    answer: 'a',
    now: 1,
    token: 't',
  })
  assert.equal(e.card.title, '卡诺图')
})
