import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Envelope } from '../src/shared/contracts.ts'
import { ENVELOPE_SCHEMA } from '../src/host/envelope.ts'
import { BOOL_PARAMETERS, renderBool, runBool, type BoolArgs } from '../src/host/tools/bool.logic.ts'
import { CARD_PARAMETERS, renderCard, runCard, type CardArgs } from '../src/host/tools/card.logic.ts'
import { KNOWLEDGE_PARAMETERS, renderKnowledge, runKnowledge } from '../src/host/tools/knowledge.logic.ts'
import { renderVerify, runVerify, VERIFY_PARAMETERS } from '../src/host/tools/verify.logic.ts'
import { shortId } from '../src/solvers/card.ts'
import { defaultKnowledgeBase } from '../src/solvers/knowledge.ts'

const F4 = { variables: ['A', 'B', 'C', 'D'], minterms: [0, 2, 5, 7, 8, 10, 13, 15], dontCares: [] }
const F4_ARGS = { variables: F4.variables, minterms: F4.minterms, dontCares: [] }

function run(args: BoolArgs): Envelope<unknown> {
  return runBool(args) as Envelope<unknown>
}

// ───────────────────────── dlogic_bool：每个 op 各一次 ─────────────────────────

test('bool parse: expr gives variables and minterms', () => {
  const r = run({ op: 'parse', expr: "A'B + AB'" })
  assert.equal(r.ok, true)
  const spec = (r.result as { spec: { variables: string[]; minterms: number[] } }).spec
  assert.deepEqual(spec.variables, ['A', 'B'])
  assert.deepEqual(spec.minterms, [1, 2])
})

test('bool truth_table: AB with explicit variables', () => {
  const r = run({ op: 'truth_table', expr: 'AB', variables: ['A', 'B'] })
  assert.equal(r.ok, true)
  const rows = (r.result as { table: { rows: { output: unknown }[] } }).table.rows
  assert.deepEqual(rows.map(x => x.output), [0, 0, 0, 1])
})

test('bool canonical: minterms 1,2 over [A,B]', () => {
  const r = run({ op: 'canonical', minterms: [1, 2], variables: ['A', 'B'] })
  assert.equal(r.ok, true)
  const c = (r.result as { canonical: { sopText: string; sigma: string } }).canonical
  assert.equal(c.sopText, "A'B + AB'")
  assert.equal(c.sigma, 'Σm(1,2)')
})

test('bool minimize: 4-variable function has 2 terms and 4 literals, with steps', () => {
  const r = run({ op: 'minimize', ...F4_ARGS })
  assert.equal(r.ok, true)
  const m = (r.result as { minimize: { cost: { terms: number; literals: number } } }).minimize
  assert.deepEqual(m.cost, { terms: 2, literals: 4 })
  assert.equal(r.steps.length, 4)
})

test('bool kmap: two groups and steps', () => {
  const r = run({ op: 'kmap', ...F4_ARGS })
  assert.equal(r.ok, true)
  const k = (r.result as { kmap: { groups: unknown[] } }).kmap
  assert.equal(k.groups.length, 2)
  assert.equal(r.steps.length, 4)
})

test('bool hazard: A\'B + AC has one static-1 hazard on A', () => {
  const r = run({ op: 'hazard', variables: ['A', 'B', 'C'], minterms: [2, 3, 5, 7] })
  assert.equal(r.ok, true)
  const h = (r.result as { hazard: { static1: { variable: string }[] } }).hazard
  assert.equal(h.static1.length, 1)
  assert.equal(h.static1[0].variable, 'A')
})

test('bool complement: A + BC gives A\'(B\'+C\')', () => {
  const r = run({ op: 'complement', expr: 'A + BC' })
  assert.equal(r.ok, true)
  assert.equal((r.result as { text: string }).text, "A'(B'+C')")
})

test('bool dual: A + BC gives A(B+C)', () => {
  const r = run({ op: 'dual', expr: 'A + BC' })
  assert.equal(r.ok, true)
  assert.equal((r.result as { text: string }).text, 'A(B+C)')
})

test('bool gate_form: returns all three forms as text', () => {
  const r = run({ op: 'gate_form', ...F4_ARGS })
  assert.equal(r.ok, true)
  const g = (r.result as { gates: Record<string, string> }).gates
  for (const key of ['nandNand', 'norNor', 'andOrInvert']) assert.ok(g[key].length > 0)
})

test('bool equivalent: A⊕B vs A\'B+AB\' is equal; vs A+B gives a counterexample', () => {
  const same = run({ op: 'equivalent', expr: 'A⊕B', other: "A'B+AB'" })
  assert.equal(same.ok, true)
  assert.equal((same.result as { equivalence: { equivalent: boolean } }).equivalence.equivalent, true)

  const diff = run({ op: 'equivalent', expr: 'A⊕B', other: 'A+B' })
  assert.equal(diff.ok, true)
  const eq = (diff.result as { equivalence: { equivalent: boolean; counterexample?: unknown } }).equivalence
  assert.equal(eq.equivalent, false)
  assert.ok(eq.counterexample)
})

test('bool errors become ok:false with a Chinese message', () => {
  const missingVars = run({ op: 'minimize', minterms: [1] })
  assert.equal(missingVars.ok, false)
  assert.equal(missingVars.result, null)
  assert.match(missingVars.error ?? '', /variables/)

  const missingExpr = run({ op: 'complement', minterms: [1], variables: ['A'] })
  assert.equal(missingExpr.ok, false)

  const badEquiv = run({ op: 'equivalent', expr: 'A' })
  assert.equal(badEquiv.ok, false)
})

test('bool render: non-empty text for every op and for errors', () => {
  const cases: BoolArgs[] = [
    { op: 'parse', expr: "A'B + AB'" },
    { op: 'truth_table', expr: 'AB', variables: ['A', 'B'] },
    { op: 'canonical', minterms: [1, 2], variables: ['A', 'B'] },
    { op: 'minimize', ...F4_ARGS },
    { op: 'kmap', ...F4_ARGS },
    { op: 'hazard', variables: ['A', 'B', 'C'], minterms: [2, 3, 5, 7] },
    { op: 'complement', expr: 'A + BC' },
    { op: 'dual', expr: 'A + BC' },
    { op: 'gate_form', ...F4_ARGS },
    { op: 'equivalent', expr: 'A⊕B', other: 'A+B' },
    { op: 'minimize', minterms: [1] },
  ]
  for (const args of cases) {
    const text = renderBool(run(args) as Envelope<never>)
    assert.equal(typeof text, 'string')
    assert.ok(text.trim().length > 0, args.op)
    assert.ok(text.split('\n').length <= 60, `${args.op} render too long`)
  }
})

test('bool render: truth table is shown compactly and minimize lists the best solutions', () => {
  const table = renderBool(run({ op: 'truth_table', expr: 'AB', variables: ['A', 'B'] }) as Envelope<never>)
  assert.match(table, /0 0 \| 0/)
  assert.match(table, /1 1 \| 1/)
  const min = renderBool(run({ op: 'minimize', ...F4_ARGS }) as Envelope<never>)
  assert.match(min, /代价 2 项 4 个文字/)
  assert.doesNotMatch(min, /分步：/)
})

// ───────────────────────── dlogic_verify ─────────────────────────

test('verify: minimal correct answer', () => {
  const r = runVerify({ op: 'check', candidate: "BD + B'D'", expr: undefined, minterms: F4.minterms, variables: F4.variables, requireMinimal: true })
  assert.equal(r.ok, true)
  const v = r.result as { equivalent: boolean; minimal: boolean; reference?: unknown }
  assert.equal(v.equivalent, true)
  assert.equal(v.minimal, true)
  assert.equal(v.reference, undefined)
})

test('verify: wrong answer returns a counterexample and render names the assignment', () => {
  const r = runVerify({ op: 'check', candidate: 'BD', minterms: F4.minterms, variables: F4.variables })
  assert.equal(r.ok, true)
  assert.equal((r.result as { equivalent: boolean }).equivalent, false)
  const text = renderVerify(r as Envelope<never>)
  assert.match(text, /当 A=0,B=0,C=0,D=0 时，候选式为 0，原函数为 1/)
})

test('verify: reveal only when requested; render shows reference then', () => {
  const hidden = runVerify({ op: 'check', candidate: "BD + B'D'", expr: undefined, minterms: F4.minterms, variables: F4.variables })
  assert.equal(renderVerify(hidden as Envelope<never>).includes('参考答案'), false)
  const shown = runVerify({ op: 'check', candidate: "BD + B'D'", minterms: F4.minterms, variables: F4.variables, reveal: true })
  assert.match(renderVerify(shown as Envelope<never>), /参考答案/)
})

test('verify: unknown variable and missing reference are ok:false', () => {
  const bad = runVerify({ op: 'check', candidate: 'BD + E', minterms: F4.minterms, variables: F4.variables })
  assert.equal(bad.ok, false)
  const noRef = runVerify({ op: 'check', candidate: 'A' })
  assert.equal(noRef.ok, false)
})

test('verify render: non-empty for ok and error results', () => {
  const ok = renderVerify(runVerify({ op: 'check', candidate: 'BD', minterms: F4.minterms, variables: F4.variables, requireMinimal: true }) as Envelope<never>)
  const err = renderVerify(runVerify({ op: 'check', candidate: 'E', minterms: F4.minterms, variables: F4.variables }) as Envelope<never>)
  assert.ok(ok.trim().length > 0)
  assert.ok(err.trim().length > 0)
})

// ───────────────────────── dlogic_knowledge ─────────────────────────

test('knowledge search finds 卡诺图 nodes including k1.5.2', () => {
  const r = runKnowledge({ op: 'search', query: '卡诺图', limit: 20 })
  assert.equal(r.ok, true)
  const nodes = (r.result as { nodes: { id: string }[] }).nodes
  assert.ok(nodes.some(n => n.id === 'k1.5.2'))
  const text = renderKnowledge(r as Envelope<never>)
  assert.match(text, /k1\.5\.2 用卡诺图简化逻辑函数/)
})

test('knowledge lookup reports missing ids', () => {
  const r = runKnowledge({ op: 'lookup', ids: ['k1.5.2', 'k9.9'] })
  assert.equal(r.ok, true)
  const res = r.result as { nodes: unknown[]; missing: string[] }
  assert.equal(res.nodes.length, 1)
  assert.deepEqual(res.missing, ['k9.9'])
})

test('knowledge neighbors of k1.5.2 include prerequisites k1.5.1', () => {
  const r = runKnowledge({ op: 'neighbors', id: 'k1.5.2' })
  assert.equal(r.ok, true)
  const nb = r.result as { prereqs: { id: string }[] }
  assert.ok(nb.prereqs.some(n => n.id === 'k1.5.1'))
  assert.match(renderKnowledge(r as Envelope<never>), /前置知识：/)
})

test('knowledge errors: missing args and unknown neighbors id', () => {
  assert.equal(runKnowledge({ op: 'search' }).ok, false)
  assert.equal(runKnowledge({ op: 'neighbors', id: 'k9.9.9' }).ok, false)
  assert.equal(runKnowledge({ op: 'lookup' }).ok, false)
})

test('knowledge render: non-empty for every op and for errors', () => {
  const cases = [
    runKnowledge({ op: 'lookup', ids: ['k1'] }),
    runKnowledge({ op: 'neighbors', id: 'k1.5.2' }),
    runKnowledge({ op: 'search', query: '不存在的关键词xyz' }),
    runKnowledge({ op: 'search' }),
  ]
  for (const r of cases) {
    const text = renderKnowledge(r as Envelope<never>)
    assert.ok(text.trim().length > 0)
  }
})

// ───────────────────────── dlogic_card ─────────────────────────

function cardArgs(over: Partial<CardArgs> = {}): CardArgs {
  return {
    title: '四变量卡诺图化简',
    kind: 'solution',
    summary: '用卡诺图化简四变量函数。',
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

test('card: nodeId is derived from callId and the record carries callId', () => {
  const r = runCard(cardArgs(), 'call-xyz-42')
  assert.equal(r.ok, true)
  const rec = r.result as { nodeId: string; callId: string; title: string }
  assert.equal(rec.nodeId, shortId('call-xyz-42'))
  assert.match(rec.nodeId, /^c[0-9A-Z]{4}$/)
  assert.equal(rec.callId, 'call-xyz-42')
  assert.equal(rec.title, '四变量卡诺图化简')
  assert.deepEqual(r.warnings, [])
})

test('card: warnings from validation are propagated into the envelope', () => {
  const r = runCard(
    cardArgs({
      knowledgeIds: ['k1.5.2', 'k9.9'],
      followups: [{ question: '只有一个追问', angle: 'free', why: '测试' }],
    }),
    'call-warn',
  )
  assert.equal(r.ok, true)
  assert.ok(r.warnings.some(w => w.includes('k9.9')))
  assert.ok(r.warnings.some(w => w.includes('追问数量')))
})

test('card: invalid input is ok:false', () => {
  const r = runCard(cardArgs({ title: '   ' }), 'call-bad')
  assert.equal(r.ok, false)
  assert.equal(r.result, null)
})

test('card render: confirmation line is just the nodeId, warnings are listed', () => {
  const ok = runCard(cardArgs(), 'call-render-ok')
  const { nodeId } = ok.result as { nodeId: string }
  assert.equal(renderCard(ok as Envelope<never>), `已登记卡片 ${nodeId}`)
  const r = runCard(cardArgs({ knowledgeIds: ['k9.9'] }), 'call-render')
  const text = renderCard(r as Envelope<never>)
  assert.match(text, new RegExp(`^已登记卡片 ${(r.result as { nodeId: string }).nodeId}\\n`))
  assert.match(text, /k9\.9/)
})

test('model-facing renders carry no tool-provenance or meta chatter', () => {
  const texts: string[] = [
    renderBool(run({ op: 'minimize', ...F4_ARGS }) as Envelope<never>),
    renderBool(run({ op: 'kmap', ...F4_ARGS }) as Envelope<never>),
    renderBool(run({ op: 'truth_table', expr: 'AB', variables: ['A', 'B'] }) as Envelope<never>),
    renderBool(run({ op: 'equivalent', expr: 'A⊕B', other: 'A+B' }) as Envelope<never>),
    renderVerify(runVerify({ op: 'check', candidate: 'BD', minterms: F4.minterms, variables: F4.variables }) as Envelope<never>),
    renderKnowledge(runKnowledge({ op: 'neighbors', id: 'k1.5.2' }) as Envelope<never>),
    renderCard(runCard(cardArgs({ knowledgeIds: ['k9.9'] }), 'call-chatter') as Envelope<never>),
  ]
  for (const text of texts) {
    for (const banned of ['引擎', '工具', '可直接引用', '【追问']) {
      assert.equal(text.includes(banned), false, `"${banned}" leaked into: ${text}`)
    }
  }
})

test('card render: failed registration is non-empty text', () => {
  const r = runCard(cardArgs({ title: '' }), 'call-fail')
  assert.ok(renderCard(r as Envelope<never>).trim().length > 0)
})

// ───────────────────────── schema hygiene ─────────────────────────

interface SchemaNode {
  type?: unknown
  additionalProperties?: unknown
  properties?: Record<string, unknown>
  items?: unknown
}

/** 遍历 schema，收集违反“object 节点必须声明布尔 additionalProperties”的路径。 */
function objectProblems(node: unknown, path: string, out: string[], counter: { objects: number }): void {
  if (typeof node !== 'object' || node === null) return
  const n = node as SchemaNode
  if (n.type === 'object') {
    counter.objects++
    if (typeof n.additionalProperties !== 'boolean') out.push(path)
    for (const [key, child] of Object.entries(n.properties ?? {})) {
      objectProblems(child, `${path}.${key}`, out, counter)
    }
  }
  if (n.items !== undefined) objectProblems(n.items, `${path}[]`, out, counter)
}

test('every object node in every tool parameter and output schema declares additionalProperties', () => {
  const parameterSets: [string, Record<string, unknown>][] = [
    ['bool', BOOL_PARAMETERS],
    ['verify', VERIFY_PARAMETERS],
    ['knowledge', KNOWLEDGE_PARAMETERS],
    ['card', CARD_PARAMETERS],
  ]
  const out: string[] = []
  const counter = { objects: 0 }
  for (const [tool, params] of parameterSets) {
    for (const [key, desc] of Object.entries(params)) objectProblems(desc, `${tool}.${key}`, out, counter)
  }
  objectProblems(ENVELOPE_SCHEMA, 'envelope', out, counter)
  assert.deepEqual(out, [])
  // 至少确认 card.followups.items 与 envelope 两处对象节点被检查到。
  assert.ok(counter.objects >= 2, `only ${counter.objects} object nodes checked`)
})

test('parameter names match the names the tutor skill tells the model to use', () => {
  assert.deepEqual(
    ['op', 'expr', 'variables', 'minterms', 'dontCares', 'form', 'other'].every(k => k in BOOL_PARAMETERS),
    true,
  )
  assert.deepEqual(
    ['candidate', 'requireMinimal', 'form', 'reveal'].every(k => k in VERIFY_PARAMETERS),
    true,
  )
  assert.deepEqual(['op', 'ids', 'id', 'query'].every(k => k in KNOWLEDGE_PARAMETERS), true)
  assert.deepEqual(
    ['title', 'kind', 'summary', 'knowledgeIds', 'followups', 'parentId', 'parentFollowup'].every(k => k in CARD_PARAMETERS),
    true,
  )
})

test('信封输出是无损 JSON：值为 undefined 的键被去掉', async () => {
  const { envelope } = await import('../src/host/envelope.ts')
  const env = envelope('x', () => ({ result: { a: 1, b: undefined, c: { d: undefined, e: 2 } } }))
  assert.deepEqual(env.result, { a: 1, c: { e: 2 } })
  assert.equal('b' in (env.result as object), false)
})

test('card: knowledgeNames resolves each id to its node title, aligned with knowledgeIds', () => {
  const r = runCard(cardArgs({ knowledgeIds: ['k1.5.2', 'k1.3'] }), 'call-names')
  const rec = r.result as { knowledgeIds: string[]; knowledgeNames: string[] }
  assert.deepEqual(rec.knowledgeIds, ['k1.5.2', 'k1.3'])
  assert.equal(rec.knowledgeNames.length, 2)
  assert.equal(rec.knowledgeNames[0], defaultKnowledgeBase().get('k1.5.2')?.title)
  assert.equal(rec.knowledgeNames[1], defaultKnowledgeBase().get('k1.3')?.title)
  assert.notEqual(rec.knowledgeNames[0], 'k1.5.2')
})
