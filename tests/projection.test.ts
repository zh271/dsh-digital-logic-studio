import { test } from 'node:test'
import assert from 'node:assert/strict'
import { treeProjectionDefinition } from '../src/host/projection.ts'
import { runCard, type CardArgs } from '../src/host/tools/card.logic.ts'
import { TREE_PROJECTION_KEY } from '../src/shared/contracts.ts'
import { EMPTY_TREE } from '../src/shared/tree.ts'

const def = treeProjectionDefinition

function cardArgs(over: Partial<CardArgs> = {}): CardArgs {
  return {
    title: '卡诺图化简',
    kind: 'solution',
    summary: '用卡诺图化简三变量函数。',
    knowledgeIds: ['k1.5.2'],
    followups: [
      { question: '为什么相邻格只差一位？', angle: 'principle', why: '理解格雷码', knowledgeId: 'k1.5.1' },
      { question: '无关项怎么圈？', angle: 'variant', why: '换个条件', knowledgeId: 'k1.3.1' },
      { question: '圈组时常见错误？', angle: 'pitfall', why: '易错点', knowledgeId: 'k1.5' },
    ],
    parentId: null,
    ...over,
  }
}

/** 构造一个真实的 dlogic_card tool/result 事件（meta 与 host 工具写入的格式一致）。 */
function cardEvent(callId: string, args: CardArgs = cardArgs(), seq = 1) {
  const value = runCard(args, callId)
  return {
    type: 'tool/result',
    seq,
    data: { callId, name: 'dlogic_card', content: [], isError: false, meta: { v: 1, tool: 'dlogic_card', value } },
  }
}

test('projection is registered under the tree key with the expected initial state', () => {
  assert.equal(def.key, TREE_PROJECTION_KEY)
  assert.equal(def.stateVersion, 2)
  assert.deepEqual(def.init(), EMPTY_TREE)
})

test('a dlogic_card tool/result appends a node; schemas accept init and the result', () => {
  const init = def.init()
  const next = def.apply(init, cardEvent('call-aaa-1'))
  assert.equal(next.nodes.length, 1)
  assert.equal(next.nodes[0].callId, 'call-aaa-1')
  assert.equal(next.nodes[0].title, '卡诺图化简')
  assert.equal(def.stateSchema.parse(init), init)
  assert.equal(def.stateSchema.parse(next), next)
})

test('view is reference-stable for an unchanged state and matches the state', () => {
  const state = def.apply(def.init(), cardEvent('call-aaa-2'))
  const v1 = def.wire.view(state)
  const v2 = def.wire.view(state)
  assert.equal(v1, v2)
  assert.equal(v1.v, 1)
  assert.equal(v1.nodes, state.nodes)
  assert.equal(def.wire.viewSchema.parse(v1), v1)
})

test('unrelated events return the same state reference', () => {
  const state = def.apply(def.init(), cardEvent('call-aaa-3'))
  const other = { type: 'tool/result', seq: 9, data: { callId: 'x', name: 'dlogic_num', meta: { v: 1, tool: 'dlogic_num', value: { ok: true } } } }
  assert.equal(def.apply(state, other), state)
  assert.equal(def.apply(state, { type: 'message', seq: 10, data: {} }), state)
})

test('the same callId is not appended twice', () => {
  const ev = cardEvent('call-aaa-4')
  const once = def.apply(def.init(), ev)
  assert.equal(def.apply(once, ev), once)
})

test('a failed card envelope is ignored', () => {
  const failed = {
    type: 'tool/result',
    seq: 2,
    data: {
      callId: 'call-bad',
      name: 'dlogic_card',
      meta: { v: 1, tool: 'dlogic_card', value: { ok: false, op: 'register', result: null, steps: [], warnings: [], error: 'x' } },
    },
  }
  const init = def.init()
  assert.equal(def.apply(init, failed), init)
})
