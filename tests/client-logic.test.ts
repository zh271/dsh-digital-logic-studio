import { test } from 'node:test'
import assert from 'node:assert/strict'
import { angleLabelKey, argsRawOf, isSettled, parseArgs, readMeta, resultText } from '../src/client/meta.ts'
import { parseExpr, plainOf, termNodes } from '../src/client/logicModel.ts'

const ok = { ok: true, op: 'minimize', result: { spec: {} }, steps: [], warnings: [] }

test('readMeta returns the envelope for a well-formed block', () => {
  const env = readMeta<{ spec: unknown }>({ meta: { v: 1, tool: 'dlogic_bool', value: ok } }, 'dlogic_bool')
  assert.ok(env)
  assert.equal(env.ok, true)
  assert.equal(env.op, 'minimize')
  assert.deepEqual(env.steps, [])
})

test('readMeta rejects wrong tool, wrong version, and missing meta', () => {
  assert.equal(readMeta({ meta: { v: 1, tool: 'dlogic_num', value: ok } }, 'dlogic_bool'), null)
  assert.equal(readMeta({ meta: { v: 2, tool: 'dlogic_bool', value: ok } }, 'dlogic_bool'), null)
  assert.equal(readMeta({ meta: 'oops' }, 'dlogic_bool'), null)
  assert.equal(readMeta({}, 'dlogic_bool'), null)
  assert.equal(readMeta(null, 'dlogic_bool'), null)
  assert.equal(readMeta('text', 'dlogic_bool'), null)
})

test('readMeta rejects a successful envelope without a result object', () => {
  const block = (value: unknown) => ({ meta: { v: 1, tool: 'dlogic_card', value } })
  assert.equal(readMeta(block({ ok: true, op: 'x', result: null, steps: [], warnings: [] }), 'dlogic_card'), null)
  assert.equal(readMeta(block({ ok: true, op: 'x', steps: [] }), 'dlogic_card'), null)
  assert.equal(readMeta(block({ ok: 'yes', op: 'x', result: {} }), 'dlogic_card'), null)
})

test('readMeta keeps failed envelopes and sanitizes optional fields', () => {
  const env = readMeta(
    { meta: { v: 1, tool: 'dlogic_verify', value: { ok: false, op: 'check', result: null, error: '输入有误', steps: 'x', warnings: ['w', 3] } } },
    'dlogic_verify',
  )
  assert.ok(env)
  assert.equal(env.ok, false)
  assert.equal(env.result, null)
  assert.equal(env.error, '输入有误')
  assert.deepEqual(env.steps, [])
  assert.deepEqual(env.warnings, ['w'])
})

test('argsRawOf prefers call.argsRaw for settled blocks and argsRaw while running', () => {
  assert.equal(argsRawOf({ kind: 'done', call: { argsRaw: '{"a":1}' }, argsRaw: '{"a":2}' }), '{"a":1}')
  assert.equal(argsRawOf({ argsRaw: '{"a":2}' }), '{"a":2}')
  assert.equal(argsRawOf({ kind: 'done', argsRaw: '{"a":3}' }), '{"a":3}')
  assert.equal(argsRawOf(undefined), undefined)
  assert.equal(isSettled({ kind: 'x' }), true)
  assert.equal(isSettled({ argsRaw: '{}' }), false)
})

test('parseArgs tolerates bad JSON and non-object values', () => {
  assert.deepEqual(parseArgs('{"op":"kmap"}'), { op: 'kmap' })
  assert.deepEqual(parseArgs('not json'), {})
  assert.deepEqual(parseArgs('[1,2]'), {})
  assert.deepEqual(parseArgs(undefined), {})
})

test('resultText joins text items and stringifies other items', () => {
  assert.equal(
    resultText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }),
    'a\nb',
  )
  assert.equal(resultText({ content: [{ type: 'image', data: 'x' }] }), '{"type":"image","data":"x"}')
  assert.equal(resultText({}), '')
})

test('angleLabelKey maps known angles and falls back to free', () => {
  assert.equal(angleLabelKey('pitfall'), 'angle.pitfall')
  assert.equal(angleLabelKey('prerequisite'), 'angle.prerequisite')
  assert.equal(angleLabelKey('something-new'), 'angle.free')
  assert.equal(angleLabelKey(undefined), 'angle.free')
})

test('parseExpr renders a single complement as a negated variable, not an apostrophe', () => {
  const nodes = parseExpr("AC'", ['A', 'B', 'C'])
  assert.deepEqual(nodes, [
    { k: 'v', name: 'A', neg: false },
    { k: 'v', name: 'C', neg: true },
  ])
  assert.equal(plainOf(nodes), "AC'")
})

test('parseExpr handles nested NAND-style groups with complemented groups', () => {
  const text = "((AB)'(CD)')'"
  const nodes = parseExpr(text, ['A', 'B', 'C', 'D'])
  assert.equal(nodes.length, 1)
  const outer = nodes[0]
  assert.equal(outer.k, 'g')
  if (outer.k !== 'g') return
  assert.equal(outer.neg, true)
  assert.equal(outer.children.length, 2)
  for (const child of outer.children) {
    assert.equal(child.k, 'g')
    if (child.k === 'g') assert.equal(child.neg, true)
  }
  assert.equal(plainOf(nodes), text)
})

test('parseExpr keeps OR, parentheses, constants and double complements', () => {
  assert.equal(plainOf(parseExpr("(A+C')", ['A', 'B', 'C'])), "(A+C')")
  // 双重取反相消。
  assert.equal(plainOf(parseExpr("A''B", ['A', 'B'])), 'AB')
  assert.deepEqual(parseExpr("A''", ['A']), [{ k: 'v', name: 'A', neg: false }])
  assert.equal(plainOf(parseExpr('1')), '1')
  assert.equal(plainOf(parseExpr('0')), '0')
})

test('parseExpr matches multi-letter variable names before single letters', () => {
  const nodes = parseExpr("x1x2'", ['x1', 'x2'])
  assert.deepEqual(nodes, [
    { k: 'v', name: 'x1', neg: false },
    { k: 'v', name: 'x2', neg: true },
  ])
})

test('termNodes follows the SOP mask convention', () => {
  assert.equal(plainOf(termNodes('1-0', ['A', 'B', 'C'])), "AC'")
  assert.equal(plainOf(termNodes('0--', ['A', 'B', 'C'])), "A'")
  assert.equal(plainOf(termNodes('---', ['A', 'B', 'C'])), '1')
})
