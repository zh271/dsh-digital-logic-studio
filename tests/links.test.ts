import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createKnowledgeBase, defaultKnowledgeBase } from '../src/solvers/knowledge.ts'
import type { KnowledgeNode } from '../src/shared/contracts.ts'
import {
  buildTermIndex,
  conceptQuestion,
  linkify,
  STOPWORDS,
  type Segment,
} from '../src/client/ask/links.ts'

function node(over: Partial<KnowledgeNode> & { id: string }): KnowledgeNode {
  return { title: '节点', chapter: 1, prereqs: [], related: [], keywords: ['测试'], ...over }
}

const kb = createKnowledgeBase([
  node({ id: 'k1', title: '第1章 测试', chapter: 1, keywords: ['测试章'] }),
  node({ id: 'k1.1', title: '甲概念', keywords: ['甲词', '甲词扩展', '输入', 'IC'] }),
  node({ id: 'k1.2', title: '乙概念', keywords: ['共用词', '深浅词'] }),
  node({ id: 'k1.2.1', title: '乙细节', keywords: ['深浅词'] }),
  node({ id: 'k2.1', title: '丙概念', chapter: 2, keywords: ['共用词'] }),
])

const idx = buildTermIndex(kb)

/** 取出所有链接片段的文本与节点。 */
function links(segs: Segment[]): { text: string; nodeId: string }[] {
  return segs.flatMap((s) => ('nodeId' in s ? [{ text: s.text, nodeId: s.nodeId }] : []))
}

/** 拼回纯文本，用于确认切分没有丢字。 */
function joined(segs: Segment[]): string {
  return segs.map((s) => s.text).join('')
}

const none = { focusIds: [], exploredIds: new Set<string>() }

test('buildTermIndex keeps titles and keywords, drops single characters and stopwords', () => {
  assert.deepEqual(idx.terms.get('甲词'), ['k1.1'])
  assert.equal(idx.terms.has('输入'), false)
  assert.equal(idx.terms.has('IC'.toLowerCase()), true)
  assert.equal(idx.titles.get('k1.1'), '甲概念')
})

test('longest match wins over a shorter keyword at the same position', () => {
  const segs = linkify('甲词扩展很好', { ...none, index: idx })
  assert.deepEqual(segs[0], { text: '甲词扩展', nodeId: 'k1.1', title: '甲概念' })
  assert.equal(joined(segs), '甲词扩展很好')
  assert.equal(links(segs).length, 1)
})

test('stopwords are never linked', () => {
  const segs = linkify('输入信号经过电路', { ...none, index: idx })
  assert.deepEqual(links(segs), [])
  assert.equal(joined(segs), '输入信号经过电路')
  assert.ok(STOPWORDS.has('实现'))
  assert.ok(STOPWORDS.has('电平'))
})

test('each node is linked only at its first occurrence', () => {
  const segs = linkify('甲词很重要，甲词再次出现', { ...none, index: idx })
  assert.deepEqual(segs, [
    { text: '甲词', nodeId: 'k1.1', title: '甲概念' },
    { text: '很重要，甲词再次出现' },
  ])
})

test('explored nodes stay plain text', () => {
  const segs = linkify('甲词与乙概念', { focusIds: [], exploredIds: new Set(['k1.1']), index: idx })
  assert.deepEqual(links(segs), [{ text: '乙概念', nodeId: 'k1.2' }])
  assert.equal(joined(segs), '甲词与乙概念')
})

test('ambiguous term prefers the id closest to focus: same chapter first', () => {
  const inCh2 = linkify('共用词', { focusIds: ['k2.3'], exploredIds: new Set(), index: idx })
  assert.deepEqual(links(inCh2), [{ text: '共用词', nodeId: 'k2.1' }])
  const inCh1 = linkify('共用词', { focusIds: ['k1.1.1'], exploredIds: new Set(), index: idx })
  assert.deepEqual(links(inCh1), [{ text: '共用词', nodeId: 'k1.2' }])
})

test('ambiguous term without focus prefers the deeper id, then the smaller id', () => {
  const deep = linkify('深浅词', { ...none, index: idx })
  assert.deepEqual(links(deep), [{ text: '深浅词', nodeId: 'k1.2.1' }])
  const shallow = linkify('共用词', { ...none, index: idx })
  assert.deepEqual(links(shallow), [{ text: '共用词', nodeId: 'k1.2' }])
})

test('backtick code spans are not linked', () => {
  const segs = linkify('`甲词` 与 甲词', { ...none, index: idx })
  assert.deepEqual(segs, [
    { text: '`甲词` 与 ' },
    { text: '甲词', nodeId: 'k1.1', title: '甲概念' },
  ])
})

test('ASCII terms need word boundaries', () => {
  assert.deepEqual(links(linkify('PICS', { ...none, index: idx })), [])
  assert.deepEqual(links(linkify('IC 芯片', { ...none, index: idx })), [{ text: 'IC', nodeId: 'k1.1' }])
})

test('empty and non-linkable text returns no links and never throws', () => {
  assert.deepEqual(linkify('', { ...none, index: idx }), [])
  assert.deepEqual(linkify('没有任何术语', { ...none, index: idx }), [{ text: '没有任何术语' }])
})

test('segments keep the original text exactly', () => {
  const text = '甲词扩展与共用词，`代码`，甲词。'
  assert.equal(joined(linkify(text, { ...none, index: idx })), text)
})

test('conceptQuestion wraps the title', () => {
  assert.equal(conceptQuestion('卡诺图'), '「卡诺图」是什么？')
})

test('real map: 最简与或式 sentence links 与或式 and 卡诺图', () => {
  const segs = linkify('最简与或式不唯一：卡诺图有两种圈法，都是三项六个文字', {
    focusIds: [],
    exploredIds: new Set(),
    index: buildTermIndex(defaultKnowledgeBase()),
  })
  const texts = links(segs).map((l) => l.text)
  assert.ok(texts.includes('与或式'), texts.join(','))
  assert.ok(texts.includes('卡诺图'), texts.join(','))
  assert.equal(joined(segs), '最简与或式不唯一：卡诺图有两种圈法，都是三项六个文字')
})

test('real map: 译码器 sentence links 译码器, 与非门, 最小项 but not 实现 or 电平', () => {
  const text = '译码器74138输出低电平有效，用与非门把最小项相加就能实现任意逻辑函数'
  const segs = linkify(text, { focusIds: [], exploredIds: new Set(), index: buildTermIndex(defaultKnowledgeBase()) })
  const texts = links(segs).map((l) => l.text)
  assert.ok(texts.includes('译码器'), texts.join(','))
  assert.ok(texts.includes('与非门'), texts.join(','))
  assert.ok(texts.includes('最小项'), texts.join(','))
  assert.ok(!texts.includes('实现'))
  assert.ok(!texts.includes('电平'))
  assert.equal(joined(segs), text)
})

test('real map: sample real terms are not stopped', () => {
  const real = buildTermIndex(defaultKnowledgeBase())
  for (const t of ['卡诺图', '最小项', '译码器', '与非门', '结合律', '与或式']) {
    assert.ok(real.terms.has(t), `${t} should be indexed`)
  }
})
