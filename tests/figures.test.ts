import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectFigures, MAX_FIGURES, VISIBLE_FIGURES, type FigureItem } from '../src/client/figures/select.ts'
import {
  figuresBuildLocationData,
  figuresEventDefinition,
  figuresMatch,
  figuresStart,
  figuresUpdate,
  type FiguresEvent,
  type FiguresState,
} from '../src/client/figures/definition.ts'

const SPEC_AB = { variables: ['A', 'B'], minterms: [1, 3], dontCares: [] }
const SPEC_C = { variables: ['A', 'B', 'C'], minterms: [0, 5], dontCares: [] }

function boolMeta(op: string, result: Record<string, unknown>, ok = true) {
  return {
    v: 1,
    tool: 'dlogic_bool',
    value: ok
      ? { ok: true, op, result, steps: [], warnings: [] }
      : { ok: false, op, result: null, error: '输入有误', steps: [], warnings: [] },
  }
}

function numMeta(input: Record<string, unknown>) {
  return {
    v: 1,
    tool: 'dlogic_num',
    value: { ok: true, op: 'convert', result: { input, result: 'FF', decimal: '255', exact: true }, steps: [{ kind: 'expand-bits', text: 't' }], warnings: [] },
  }
}

function verifyMeta(result: Record<string, unknown>) {
  return { v: 1, tool: 'dlogic_verify', value: { ok: true, op: 'check', result, steps: [], warnings: [] } }
}

function cardMeta(card: Record<string, unknown>) {
  return { v: 1, tool: 'dlogic_card', value: { ok: true, op: 'card', result: card, steps: [], warnings: [] } }
}

let seqNo = 0
function item(meta: unknown): FigureItem {
  seqNo += 1
  return { seq: seqNo, callId: `call${seqNo}`, meta }
}

test('selectFigures keeps first-seen order of distinct figures and skips failures and knowledge', () => {
  seqNo = 0
  const items = [
    item(boolMeta('truth_table', { spec: SPEC_AB, table: { variables: ['A', 'B'], rows: [] } })),
    item(boolMeta('parse', { spec: SPEC_AB, input: 'AB' })),
    item(boolMeta('kmap', { spec: SPEC_C, kmap: {}, minimize: {} }, false)),
    item({ v: 1, tool: 'dlogic_knowledge', value: { ok: true, op: 'lookup', result: { nodes: [] }, steps: [], warnings: [] } }),
  ]
  const sel = selectFigures(items)
  assert.deepEqual(
    sel.figures.map((f) => f.op),
    ['truth_table', 'parse'],
  )
  assert.equal(sel.hidden.length, 0)
  assert.equal(sel.verdict, null)
  assert.equal(sel.card, null)
})

test('selectFigures dedupes same tool, op and spec and keeps the last occurrence', () => {
  seqNo = 0
  const first = { spec: SPEC_AB, table: { variables: ['A', 'B'], rows: [{ index: 0 }] }, marker: 'first' }
  const last = { spec: SPEC_AB, table: { variables: ['A', 'B'], rows: [{ index: 0 }] }, marker: 'last' }
  const other = { spec: SPEC_C, table: { variables: ['A', 'B', 'C'], rows: [] } }
  const items = [
    item(boolMeta('truth_table', first)),
    item(boolMeta('truth_table', other)),
    item(boolMeta('truth_table', last)),
  ]
  const sel = selectFigures(items)
  assert.equal(sel.figures.length, 2)
  // 保留最后一次出现的结果，位置随之后移。
  assert.equal((sel.figures[0].result as { marker?: string }).marker, undefined)
  assert.equal((sel.figures[1].result as { marker?: string }).marker, 'last')
})

test('selectFigures suppresses minimize when the turn has a kmap for the same spec', () => {
  seqNo = 0
  const items = [
    item(boolMeta('minimize', { spec: SPEC_AB, minimize: { texts: ['B'] } })),
    item(boolMeta('kmap', { spec: SPEC_AB, kmap: {}, minimize: { texts: ['B'] } })),
    item(boolMeta('minimize', { spec: SPEC_C, minimize: { texts: ['A'] } })),
  ]
  const sel = selectFigures(items)
  assert.deepEqual(
    sel.figures.map((f) => f.op),
    ['kmap', 'minimize'],
  )
  assert.equal(sel.figures[1].specKey, JSON.stringify(SPEC_C))
})

test('selectFigures keeps minimize when there is no kmap for its spec', () => {
  seqNo = 0
  const sel = selectFigures([item(boolMeta('minimize', { spec: SPEC_AB, minimize: { texts: ['B'] } }))])
  assert.deepEqual(sel.figures.map((f) => f.op), ['minimize'])
})

test('selectFigures includes conversion results as figures', () => {
  seqNo = 0
  const sel = selectFigures([item(numMeta({ value: 'FF', from: 16, to: 2 }))])
  assert.equal(sel.figures.length, 1)
  assert.equal(sel.figures[0].tool, 'dlogic_num')
  assert.equal(sel.figures[0].steps.length, 1)
})

function programMeta(tool: string, op: string, result: Record<string, unknown>, ok = true) {
  return {
    v: 1,
    tool,
    value: ok
      ? { ok: true, op, result, warnings: [] }
      : { ok: false, op, result: null, error: '失败', warnings: [] },
  }
}

test('selectFigures shows dlogic_comb, dlogic_seq and dlogic_fsm results as figures, dedupes and skips failures', () => {
  seqNo = 0
  const comb = { op: 'analyze', inputs: ['A', 'B'], gates: [] }
  const seq = { op: 'counter', model: 'async', N: 4 }
  const fsm = { spec: SPEC_AB, reduce: {} }
  const items = [
    item(programMeta('dlogic_comb', 'analyze', comb)),
    item(programMeta('dlogic_seq', 'counter', { spec: SPEC_AB, model: 'async', N: 3 })),
    item(programMeta('dlogic_fsm', 'reduce', fsm)),
    item(programMeta('dlogic_seq', 'counter', seq, false)),
    item(programMeta('dlogic_comb', 'analyze', comb)),
  ]
  const sel = selectFigures(items)
  // 与第 1 条同键的 comb 去重，位置移到最后；失败结果不出图。
  assert.deepEqual(
    sel.figures.map((f) => f.tool),
    ['dlogic_seq', 'dlogic_fsm', 'dlogic_comb'],
  )
  assert.deepEqual(
    sel.figures.map((f) => f.op),
    ['counter', 'reduce', 'analyze'],
  )
  assert.equal(sel.verdict, null)
})

test('selectFigures dedupes program-tool results with the same key, keeping the last', () => {
  seqNo = 0
  const a = { spec: SPEC_AB, marker: 'first' }
  const b = { spec: SPEC_AB, marker: 'last' }
  const sel = selectFigures([item(programMeta('dlogic_fsm', 'assign', a)), item(programMeta('dlogic_fsm', 'assign', b))])
  assert.equal(sel.figures.length, 1)
  assert.equal((sel.figures[0].result as { marker?: string }).marker, 'last')
})

test('selectFigures caps at MAX_FIGURES: 4 stay whole, 5 show 3 and hide 2', () => {
  assert.equal(MAX_FIGURES, 4)
  assert.equal(VISIBLE_FIGURES, 3)
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => item(numMeta({ value: String(i), from: 10, to: 2 })))

  seqNo = 0
  const four = selectFigures(mk(4))
  assert.equal(four.figures.length, 4)
  assert.equal(four.hidden.length, 0)

  seqNo = 0
  const five = selectFigures(mk(5))
  assert.equal(five.figures.length, 3)
  assert.equal(five.hidden.length, 2)
  assert.deepEqual(
    [...five.figures, ...five.hidden].map((f) => (f.result as { input: { value: string } }).input.value),
    ['0', '1', '2', '3', '4'],
  )
})

test('selectFigures reduces verify to a verdict line and takes the last one', () => {
  seqNo = 0
  const items = [
    item(verifyMeta({ equivalent: true, variables: ['A'], minimal: false })),
    item(verifyMeta({
      equivalent: false,
      variables: ['A', 'B'],
      counterexample: { index: 2, inputs: [1, 0], left: 1, right: 0 },
      minimal: null,
    })),
  ]
  const sel = selectFigures(items)
  assert.equal(sel.figures.length, 0)
  assert.ok(sel.verdict)
  assert.equal(sel.verdict.equivalent, false)
  assert.equal(sel.verdict.minimal, null)
  assert.deepEqual(sel.verdict.variables, ['A', 'B'])
  assert.deepEqual(sel.verdict.counterexample?.inputs, [1, 0])
})

test('selectFigures uses the last valid card for follow-up chips', () => {
  seqNo = 0
  const card = (nodeId: string) => ({
    nodeId,
    callId: 'x',
    title: 't',
    kind: 'concept',
    summary: 's',
    knowledgeIds: [],
    parentId: null,
    followups: [{ question: 'q', angle: 'variant', why: 'w', knowledgeId: undefined }],
  })
  const sel = selectFigures([
    item(cardMeta(card('c1'))),
    item(cardMeta(card('c2'))),
    item({ v: 1, tool: 'dlogic_card', value: { ok: false, op: 'card', result: null, error: 'bad', steps: [], warnings: [] } }),
  ])
  assert.equal(sel.card?.nodeId, 'c2')
})

test('selectFigures honours maxSeq', () => {
  seqNo = 0
  const a = item(boolMeta('parse', { spec: SPEC_AB, input: 'AB' }))
  const b = item(boolMeta('kmap', { spec: SPEC_C, kmap: {}, minimize: {} }))
  const sel = selectFigures([a, b], a.seq)
  assert.deepEqual(sel.figures.map((f) => f.op), ['parse'])
})

test('definition match: turn/start starts, our tool/result updates, others and errors are ignored', () => {
  const start: FiguresEvent = { type: 'turn/start', seq: 1, data: { turn: 3 } }
  assert.equal(figuresMatch(start)?.role, 'start')
  assert.equal(figuresMatch(start)?.id, '3')

  const ours: FiguresEvent = {
    type: 'tool/result',
    seq: 2,
    data: { turn: 3, message: { source: { callId: 'a' }, isError: false }, meta: numMeta({ value: '1', from: 10, to: 2 }) },
  }
  assert.equal(figuresMatch(ours)?.role, 'update')

  const foreign: FiguresEvent = {
    type: 'tool/result',
    seq: 3,
    data: { turn: 3, message: { source: { callId: 'b' } }, meta: { v: 1, tool: 'other_tool', value: {} } },
  }
  assert.equal(figuresMatch(foreign), null)

  const failed: FiguresEvent = {
    type: 'tool/result',
    seq: 4,
    data: { turn: 3, message: { source: { callId: 'c' }, isError: true }, meta: numMeta({}) },
  }
  assert.equal(figuresMatch(failed), null)

  assert.equal(figuresMatch({ type: 'message/delta', seq: 5, data: { turn: 3 } }), null)
})

test('definition update appends items and returns the same reference when nothing changes', () => {
  const match = (seq: number, callId: string, turn = 3) =>
    figuresMatch({
      type: 'tool/result',
      seq,
      data: { turn, message: { source: { callId } }, meta: numMeta({ value: '1', from: 10, to: 2 }) },
    })!

  const s0 = figuresStart({}, figuresMatch({ type: 'turn/start', seq: 1, data: { turn: 3 } })!)
  assert.deepEqual(s0, { turn: 3, items: [] })

  const s1 = figuresUpdate({ state: s0 }, match(2, 'a'))!
  assert.equal(s1.items.length, 1)
  assert.equal(s1.items[0].seq, 2)
  assert.equal(s1.items[0].callId, 'a')
  assert.notEqual(s1, s0)

  // 重复 callId：同一引用。
  const s2 = figuresUpdate({ state: s1 }, match(3, 'a'))
  assert.equal(s2, s1)

  // 其他轮：同一引用。
  const s3 = figuresUpdate({ state: s1 }, match(4, 'z', 9))
  assert.equal(s3, s1)

  // 没有 state：保持 undefined。
  assert.equal(figuresUpdate({ state: undefined }, match(5, 'q')), undefined)
})

test('definition buildLocationData returns the same object for the same turn and items reference', () => {
  const state: FiguresState = { turn: 7, items: [{ seq: 1, callId: 'a', meta: {} }] }
  assert.equal(figuresBuildLocationData({ state: undefined }, 'turn', undefined), null)
  assert.equal(figuresBuildLocationData({ state }, 'message', undefined), null)

  const first = figuresBuildLocationData({ state }, 'turn', undefined)
  // key 必须等于定义的 kind（DSH 的硬性要求）
  assert.deepEqual(first, { kind: 'turn', turn: 7, key: 'dlogic-figures', value: { items: state.items } })

  // 同一 items 引用：返回 previous 本身。
  const again = figuresBuildLocationData({ state }, 'turn', first)
  assert.equal(again, first)

  // items 引用变化：返回新对象。
  const nextState: FiguresState = { turn: 7, items: [...state.items, { seq: 2, callId: 'b', meta: {} }] }
  const changed = figuresBuildLocationData({ state: nextState }, 'turn', first)
  assert.notEqual(changed, first)
  assert.equal(changed?.value.items.length, 2)

  // 不同轮：返回新对象。
  const otherTurn = figuresBuildLocationData({ state: { turn: 8, items: state.items } }, 'turn', first)
  assert.notEqual(otherTurn, first)
})

test('event definition exposes the registered kind and callbacks', () => {
  assert.equal(figuresEventDefinition.kind, 'dlogic-figures')
  assert.equal(typeof figuresEventDefinition.match, 'function')
  assert.equal(typeof figuresEventDefinition.start, 'function')
  assert.equal(typeof figuresEventDefinition.update, 'function')
  assert.equal(typeof figuresEventDefinition.buildLocationData, 'function')
})

// ───────────────────────── dlogic_hdl ─────────────────────────

function hdlMeta(op: 'simulate' | 'lint', result: Record<string, unknown> | null, ok = true) {
  return {
    v: 1,
    tool: 'dlogic_hdl',
    value: ok
      ? { ok: true, op, result, warnings: [] }
      : { ok: false, op, result: null, error: '编译失败', warnings: [] },
  }
}

function simResult(marker: string) {
  return {
    engine: 'iverilog',
    iverilogVersion: '13.0',
    top: 'tb',
    maxTimeUnits: 100,
    timescale: '1ns/1ps',
    tickUnit: 'ps',
    end: 'finish',
    finishTime: 10,
    output: [marker],
    outputTruncated: false,
    signals: [],
    vcdTruncated: false,
  }
}

function lintResult(marker: string) {
  return {
    engine: 'rules',
    iverilogVersion: null,
    issues: [],
    ruleHits: [{ rule: 'latch', line: 3, severity: 'warning', message: marker }],
    notice: null,
  }
}

test('selectFigures shows dlogic_hdl simulate and lint results as figures', () => {
  seqNo = 0
  const sel = selectFigures([
    item(hdlMeta('simulate', simResult('s1'))),
    item(hdlMeta('lint', lintResult('l1'))),
  ])
  assert.deepEqual(
    sel.figures.map((f) => [f.tool, f.op]),
    [
      ['dlogic_hdl', 'simulate'],
      ['dlogic_hdl', 'lint'],
    ],
  )
  assert.equal((sel.figures[0].result as { output: string[] }).output[0], 's1')
})

test('selectFigures keeps only the last simulate and the last lint of the turn', () => {
  seqNo = 0
  const sel = selectFigures([
    item(hdlMeta('simulate', simResult('s1'))),
    item(hdlMeta('lint', lintResult('l1'))),
    item(hdlMeta('simulate', simResult('s2'))),
    item(hdlMeta('lint', lintResult('l2'))),
    item(hdlMeta('simulate', simResult('s3'))),
  ])
  assert.equal(sel.figures.length, 2)
  const byOp = Object.fromEntries(sel.figures.map((f) => [f.op, f]))
  assert.deepEqual((byOp.simulate.result as { output: string[] }).output, ['s3'])
  assert.equal((byOp.lint.result as { ruleHits: { message: string }[] }).ruleHits[0].message, 'l2')
  // 位置按最后一次出现排序：lint 的最后一次在 simulate 之前。
  assert.deepEqual(sel.figures.map((f) => f.op), ['lint', 'simulate'])
})

test('selectFigures skips failed dlogic_hdl results', () => {
  seqNo = 0
  const sel = selectFigures([item(hdlMeta('simulate', null, false))])
  assert.equal(sel.figures.length, 0)
})

test('selectFigures keeps hdl figures alongside bool figures and does not treat them as verdicts', () => {
  seqNo = 0
  const sel = selectFigures([
    item(boolMeta('truth_table', { spec: SPEC_AB, table: { variables: ['A', 'B'], rows: [] } })),
    item(hdlMeta('simulate', simResult('s'))),
  ])
  assert.deepEqual(sel.figures.map((f) => f.tool), ['dlogic_bool', 'dlogic_hdl'])
  assert.equal(sel.verdict, null)
})
