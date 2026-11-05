import { test } from 'node:test'
import assert from 'node:assert/strict'
import mapData from '../skills/digital-logic-tutor/references/knowledge-map.json' with { type: 'json' }
import { createKnowledgeBase, defaultKnowledgeBase } from '../src/solvers/knowledge.ts'
import type { KnowledgeNode } from '../src/shared/contracts.ts'

const raw = mapData as unknown as KnowledgeNode[]

function node(over: Partial<KnowledgeNode> & { id: string }): KnowledgeNode {
  return { title: '节点', chapter: 1, prereqs: [], related: [], keywords: ['测试'], ...over }
}

test('knowledge map loads and validates', () => {
  const kb = createKnowledgeBase(raw)
  assert.ok(kb.nodes.length >= 100, `node count ${kb.nodes.length}`)
  assert.equal(defaultKnowledgeBase().nodes.length, kb.nodes.length)
})

test('every chapter 1-7 exists', () => {
  const kb = defaultKnowledgeBase()
  for (let c = 1; c <= 7; c++) {
    const ch = kb.get(`k${c}`)
    assert.ok(ch, `chapter k${c} missing`)
    assert.equal(ch.chapter, c)
  }
})

test('search finds 卡诺图 chapter 1 section first', () => {
  const top = defaultKnowledgeBase().search('卡诺图')[0]
  assert.ok(top)
  assert.ok(top.id === 'k1.5' || top.id.startsWith('k1.5.'), `got ${top.id}`)
  assert.equal(top.id, 'k1.5')
})

test('search finds chip 74LS161 under k3.4.3', () => {
  const ids = defaultKnowledgeBase().search('74LS161').map((n) => n.id)
  assert.ok(ids.includes('k3.4.3'), `got ${ids.join(',')}`)
})

test('search is case-insensitive and ignores empty query', () => {
  const kb = defaultKnowledgeBase()
  assert.deepEqual(kb.search('   '), [])
  assert.ok(kb.search('verilog').some((n) => n.id === 'k5.5'))
  assert.ok(kb.search('VERILOG').length > 0)
})

test('neighbors of k1.5.2 include prerequisite k1.5.1', () => {
  const nb = defaultKnowledgeBase().neighbors('k1.5.2')
  assert.equal(nb.node?.id, 'k1.5.2')
  assert.equal(nb.parent?.id, 'k1.5')
  assert.ok(nb.prereqs.some((n) => n.id === 'k1.5.1'))
})

test('related links are symmetric in neighbors', () => {
  const kb = defaultKnowledgeBase()
  assert.ok(kb.neighbors('k1.5.2').related.some((n) => n.id === 'k2.1.5'))
  assert.ok(kb.neighbors('k2.1.5').related.some((n) => n.id === 'k1.5.2'))
  assert.ok(kb.neighbors('k5.1.1').related.some((n) => n.id === 'k4.3.2'))
})

test('dependents and children are derived', () => {
  const kb = defaultKnowledgeBase()
  assert.ok(kb.neighbors('k2.2.1').dependents.some((n) => n.id === 'k2.4.1'))
  assert.ok(kb.neighbors('k1.5').children.some((n) => n.id === 'k1.5.2'))
})

test('lookup splits found and missing ids', () => {
  const r = defaultKnowledgeBase().lookup(['k1.5.1', 'k9.9', 'k1.5.1'])
  assert.deepEqual(r.found.map((n) => n.id), ['k1.5.1'])
  assert.deepEqual(r.missing, ['k9.9'])
})

test('neighborhood contains ids and their graph neighbors', () => {
  const hood = defaultKnowledgeBase().neighborhood(['k1.5.2'])
  for (const id of ['k1.5.2', 'k1.5.1', 'k1.3.1', 'k1.5', 'k2.1.5']) {
    assert.ok(hood.has(id), `missing ${id}`)
  }
})

test('validation rejects duplicate ids', () => {
  assert.throws(() => createKnowledgeBase([node({ id: 'k1' }), node({ id: 'k1' })]), /重复/)
})

test('validation rejects unknown references', () => {
  assert.throws(
    () => createKnowledgeBase([node({ id: 'k1', prereqs: ['k1.9'] })]),
    /不存在的 id/,
  )
})

test('validation rejects prerequisite cycles', () => {
  assert.throws(
    () =>
      createKnowledgeBase([
        node({ id: 'k1.1', prereqs: ['k1.2'] }),
        node({ id: 'k1.2', prereqs: ['k1.1'] }),
      ]),
    /循环/,
  )
})
