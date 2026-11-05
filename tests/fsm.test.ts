import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FsmSpec, FsmTransition } from '../src/shared/fsm.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import { assignStates, buildTable, evalCover, reduceFsm, selfStart, synthesize } from '../src/solvers/fsm.ts'
import { FSM_PARAMETERS, renderFsm, runFsm, type FsmArgs } from '../src/host/tools/fsm.logic.ts'

// ───────────────────────── 教材例题 ─────────────────────────

/** 米利型 110 序列检测器（可重叠）：输入 X，检测到 110 时输出 Z=1。 */
const MEALY_110: FsmSpec = {
  type: 'mealy',
  states: ['S0', 'S1', 'S2', 'S3'],
  inputs: 1,
  outputs: 1,
  transitions: [
    { from: 'S0', input: '0', to: 'S0', output: '0' },
    { from: 'S0', input: '1', to: 'S1', output: '0' },
    { from: 'S1', input: '0', to: 'S0', output: '0' },
    { from: 'S1', input: '1', to: 'S2', output: '0' },
    { from: 'S2', input: '0', to: 'S3', output: '1' },
    { from: 'S2', input: '1', to: 'S2', output: '0' },
    { from: 'S3', input: '0', to: 'S0', output: '0' },
    { from: 'S3', input: '1', to: 'S1', output: '0' },
  ],
}

/** 摩尔型 110 序列检测器：状态 D 为检测到 110，输出为 1。 */
const MOORE_110: FsmSpec = {
  type: 'moore',
  states: ['A', 'B', 'C', 'D'],
  inputs: 1,
  outputs: 1,
  transitions: [
    { from: 'A', input: '0', to: 'A', output: '0' },
    { from: 'A', input: '1', to: 'B', output: '0' },
    { from: 'B', input: '0', to: 'A', output: '0' },
    { from: 'B', input: '1', to: 'C', output: '0' },
    { from: 'C', input: '0', to: 'D', output: '0' },
    { from: 'C', input: '1', to: 'C', output: '0' },
    { from: 'D', input: '0', to: 'A', output: '1' },
    { from: 'D', input: '1', to: 'B', output: '1' },
  ],
}

/** 不完全给定的状态表（P、Q 相容，可合并为一类）。 */
const INCOMPLETE: FsmSpec = {
  type: 'mealy',
  states: ['P', 'Q', 'R', 'T'],
  inputs: 1,
  outputs: 1,
  transitions: [
    { from: 'P', input: '0', to: 'R', output: '0' },
    { from: 'P', input: '1', to: 'T', output: '1' },
    { from: 'Q', input: '0', to: 'R', output: '0' },
    { from: 'R', input: '0', to: 'P', output: '1' },
    { from: 'R', input: '1', to: 'Q', output: '0' },
    { from: 'T', input: '0', to: 'Q', output: '1' },
    { from: 'T', input: '1', to: 'T', output: 'x' },
  ],
}

/** 3 个状态、二进制编码时 11 为无效编码，且原函数不能自启动（D 触发器）。 */
const NOT_SELF_STARTING: FsmSpec = {
  type: 'mealy',
  states: ['A', 'B', 'C'],
  inputs: 1,
  outputs: 1,
  transitions: [
    { from: 'A', input: '0', to: 'B', output: '0' },
    { from: 'A', input: '1', to: 'C', output: '0' },
    { from: 'B', input: '0', to: 'C', output: '0' },
    { from: 'B', input: '1', to: 'B', output: '0' },
    { from: 'C', input: '0', to: 'B', output: '1' },
    { from: 'C', input: '1', to: 'B', output: '0' },
  ],
}

/** 把规范展开为完全的 (现态, 输入) → (次态, 输出) 映射，便于断言。 */
function expandTable(spec: FsmSpec): { state: string; input: string; next: string; output: string }[] {
  const T = buildTable(spec)
  const rows: { state: string; input: string; next: string; output: string }[] = []
  T.states.forEach((s, i) => {
    for (let c = 0; c < 1 << T.inputs; c++) {
      const nx = T.next[i][c]
      rows.push({
        state: s,
        input: c.toString(2).padStart(T.inputs, '0'),
        next: nx < 0 ? 'x' : T.states[nx],
        output: T.out[i][c],
      })
    }
  })
  return rows
}

function sorted(sets: string[][]): string[][] {
  return sets.map(s => s.slice().sort()).sort((a, b) => (a.join(',') < b.join(',') ? -1 : 1))
}

// ───────────────────────── 状态化简 ─────────────────────────

test('reduce: 米利型 110 检测器，S0 与 S3 等价并合并为 S0', () => {
  const r = reduceFsm(MEALY_110)
  assert.equal(r.complete, true)
  assert.equal(r.method, 'implication')
  assert.deepEqual(sorted(r.classes), [['S0', 'S3'], ['S1'], ['S2']])
  assert.equal(r.reducedCount, 3)
  assert.equal(r.reduced.states.length, 3)
  const s0 = r.stateMap.find(m => m.state === 'S3')
  assert.deepEqual(s0?.groups, ['S0'])
  // 合并后 S0 在输入 1 下转向 S1，输出 0；S2 在输入 0 下转向 S0、输出 1
  const rows = expandTable(r.reduced)
  assert.deepEqual(rows.find(x => x.state === 'S0' && x.input === '1'), { state: 'S0', input: '1', next: 'S1', output: '0' })
  assert.deepEqual(rows.find(x => x.state === 'S2' && x.input === '0'), { state: 'S2', input: '0', next: 'S0', output: '1' })
})

test('reduce: 隐含表给出每一对状态的结论与依据', () => {
  const r = reduceFsm(MEALY_110)
  assert.ok(r.implication)
  assert.equal(r.implication.length, 6)
  const s03 = r.implication.find(p => p.a === 'S0' && p.b === 'S3')
  assert.equal(s03?.status, 'equivalent')
  const s01 = r.implication.find(p => p.a === 'S0' && p.b === 'S1')
  assert.equal(s01?.status, 'distinct')
  const s12 = r.implication.find(p => p.a === 'S1' && p.b === 'S2')
  assert.equal(s12?.status, 'distinct')
})

test('reduce: 摩尔型 110 检测器的四个状态互不等价（输出不同），不能合并', () => {
  const r = reduceFsm(MOORE_110)
  assert.equal(r.complete, true)
  assert.equal(r.reducedCount, 4)
  assert.deepEqual(sorted(r.classes), [['A'], ['B'], ['C'], ['D']])
  assert.equal(r.implication?.find(p => p.a === 'A' && p.b === 'D')?.status, 'distinct')
})

test('reduce: 不完全给定时用相容类，P 与 Q 相容，最小闭覆盖为 {P,Q}、R、T', () => {
  const r = reduceFsm(INCOMPLETE)
  assert.equal(r.complete, false)
  assert.equal(r.method, 'compatible')
  assert.ok(r.cover)
  assert.deepEqual(sorted(r.cover), [['P', 'Q'], ['R'], ['T']])
  assert.equal(r.reducedCount, 3)
  assert.ok(sorted(r.classes).some(c => c.join(',') === 'P,Q'))
  // 闭覆盖中的每一类在各输入下的次态都落在某一类中（化简后的状态表没有缺失的次态）
  const rows = expandTable(r.reduced)
  assert.ok(rows.every(x => x.next !== 'x'))
})

test('reduce: 相容类超过 8 个状态时报错', () => {
  const states = Array.from({ length: 9 }, (_, i) => `s${i}`)
  const spec: FsmSpec = {
    type: 'mealy',
    states,
    inputs: 1,
    outputs: 1,
    transitions: states.map(s => ({ from: s, input: '0', to: 'x', output: '0' })),
  }
  assert.throws(() => reduceFsm(spec), DlogicInputError)
})

// ───────────────────────── 状态编码 ─────────────────────────

test('assign: 110 检测器（化简后 3 个状态）的相邻状态对与评分', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  const a = assignStates(reduced)
  // 规则 1：S0 在两种输入下的次态 S0、S1 相邻；S1 的次态 S0、S2 相邻
  // 规则 2：输入 0 下 S0、S1、S2 的次态都是 S0；输入 1 下 S1、S2 的次态都是 S2
  const pairKeys = a.pairs.map(p => `${p.a}${p.b}:${p.rules.join('')}`).sort()
  assert.deepEqual(pairKeys, ['S0S1:12', 'S0S2:12', 'S1S2:2'])
  const byKind = Object.fromEntries(a.encodings.map(e => [e.kind, e]))
  // 二进制 S0=00 S1=01 S2=10：距离 1+1+2
  assert.equal(byKind.binary.score, 4)
  assert.equal(byKind.binary.satisfied, 2)
  // 格雷 S0=00 S1=01 S2=11：距离 1+2+1
  assert.equal(byKind.gray.score, 4)
  // 独热：每对距离均为 2
  assert.equal(byKind.onehot.score, 6)
  assert.equal(byKind.onehot.satisfied, 0)
  assert.equal(byKind.onehot.bits, 3)
  assert.equal(a.best, 'binary')
})

test('assign: 自定义编码参与评分', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  const a = assignStates(reduced, { S0: '00', S1: '10', S2: '11' })
  const custom = a.encodings.find(e => e.kind === 'custom')
  assert.ok(custom)
  assert.equal(custom.score, 4)
  assert.throws(() => assignStates(reduced, { S0: '00', S1: '00', S2: '11' }), DlogicInputError)
})

// ───────────────────────── 综合（激励与输出函数） ─────────────────────────

/** 检查综合结果：对激励表每一个确定的取值，化简后的函数都给出相同的值。 */
function assertSynthesisMatchesTable(result: ReturnType<typeof synthesize>): void {
  const byName = new Map(result.functions.map(f => [f.name, f]))
  for (const row of result.table) {
    const bits = [...row.code.split(''), ...row.input.split('')].map(Number)
    for (const name of result.excitationNames) {
      const v = row.excitation[name]
      if (v === 'x') continue
      const f = byName.get(name)
      assert.ok(f, `缺少函数 ${name}`)
      assert.equal(evalCover(f.implicants, bits), Number(v), `${name} 在编码 ${row.code} 输入 ${row.input} 下取值不符`)
    }
    if (row.state !== null && row.output !== 'x') {
      for (let j = 0; j < result.outputNames.length; j++) {
        if (row.output[j] === 'x') continue
        const f = byName.get(result.outputNames[j])
        assert.ok(f)
        assert.equal(evalCover(f.implicants, bits), Number(row.output[j]), `输出 ${f.name} 不符`)
      }
    }
  }
}

test('synthesize: 110 检测器（化简后）二进制编码、D 触发器，激励函数与表一致', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  const r = synthesize(reduced, 'D', 'binary')
  assert.deepEqual(r.excitationNames, ['D1', 'D0'])
  assert.deepEqual(r.functions.map(f => f.name), ['D1', 'D0', 'Z'])
  // D1 = 次态为 S1、S2 时为 1（即 Q1 与 Q0 不同且 X=1，或 Q1=1 且 X=0 时）
  const d1 = r.functions.find(f => f.name === 'D1')
  assert.ok(d1)
  assert.equal(d1.text, 'Q1X + Q0X')
  assertSynthesisMatchesTable(r)
})

test('synthesize: JK 与 T 触发器的激励函数与表一致', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  for (const ff of ['JK', 'T'] as const) {
    const r = synthesize(reduced, ff, 'binary')
    assert.equal(r.excitationNames.length, ff === 'JK' ? 4 : 2)
    assertSynthesisMatchesTable(r)
  }
})

test('synthesize: 格雷与独热编码的激励函数与表一致', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  assertSynthesisMatchesTable(synthesize(reduced, 'D', 'gray'))
  assertSynthesisMatchesTable(synthesize(reduced, 'D', 'onehot'))
})

test('synthesize: 摩尔型输出只依赖状态位，且与状态表一致', () => {
  const r = synthesize(MOORE_110, 'D', 'binary')
  const z = r.functions.find(f => f.name === 'Z')
  assert.ok(z)
  assert.deepEqual(z.variables, ['Q1', 'Q0'])
  // 4 个状态 00,01,10,11 中只有 D（编码 11）输出 1
  assert.equal(z.text, 'Q1Q0')
  assertSynthesisMatchesTable(r)
})

test('synthesize: 同一函数的全部等价最简解都被列出', () => {
  const r = synthesize(reduceFsm(MEALY_110).reduced, 'D', 'binary')
  for (const f of r.functions) {
    assert.ok(f.texts.length >= 1)
    assert.equal(f.texts[0], f.text)
  }
})

test('synthesize: 独热编码超过 6 个变量时报错', () => {
  const states = ['s0', 's1', 's2', 's3', 's4']
  const spec: FsmSpec = {
    type: 'mealy',
    states,
    inputs: 2,
    outputs: 1,
    transitions: states.map(s => ({ from: s, input: '0x', to: s, output: '0' })),
  }
  assert.throws(() => synthesize(spec, 'D', 'onehot'), /超过化简上限/)
})

// ───────────────────────── 自启动 ─────────────────────────

test('self_start: 110 检测器（化简后）二进制编码能自启动', () => {
  const reduced = reduceFsm(MEALY_110).reduced
  const r = selfStart(reduced, 'D', 'binary')
  assert.equal(r.selfStarting, true)
  assert.equal(r.checks.every(c => c.ok), true)
  assert.deepEqual(r.rewritten, [])
})

test('self_start: 原函数不能自启动时，改写无关项后修正（无效编码 11 直接进入有效状态）', () => {
  const r = selfStart(NOT_SELF_STARTING, 'D', 'binary')
  assert.equal(r.selfStarting, false)
  const bad = r.checks.filter(c => !c.ok)
  assert.ok(bad.length > 0)
  assert.equal(bad[0].code, '11')
  assert.equal(r.fixed, true)
  assert.deepEqual(r.rewritten, [{ code: '11', to: 'B' }])
  assert.equal(r.after.every(c => c.ok), true)
  // 修正后的函数仍与状态表一致
  assertSynthesisMatchesTable(r.synthesis)
  const rows = expandTable(NOT_SELF_STARTING)
  assert.ok(rows.length > 0)
})

test('self_start: JK 触发器下无效编码的次态取值不同，结果同样满足自启动', () => {
  const r = selfStart(NOT_SELF_STARTING, 'JK', 'binary')
  assert.equal(r.selfStarting || r.fixed, true)
  assert.equal(r.after.every(c => c.ok), true)
  assertSynthesisMatchesTable(r.synthesis)
})

// ───────────────────────── 输入校验与宿主层 ─────────────────────────

test('validate: 状态数超过 16 个、位数超限、转移冲突时报错', () => {
  const many = Array.from({ length: 17 }, (_, i) => `s${i}`)
  assert.throws(
    () => reduceFsm({ type: 'mealy', states: many, inputs: 1, outputs: 1, transitions: [] }),
    /最多 16/,
  )
  assert.throws(() => reduceFsm({ ...MOORE_110, inputs: 3 }), /输入位数/)
  assert.throws(
    () =>
      reduceFsm({
        ...MEALY_110,
        transitions: [...MEALY_110.transitions, { from: 'S0', input: '0', to: 'S2', output: '0' } as FsmTransition],
      }),
    /次态不唯一/,
  )
  assert.throws(
    () => reduceFsm({ ...MEALY_110, transitions: [{ from: 'S0', input: '00', to: 'S0', output: '0' }] }),
    /须为 1 位/,
  )
})

test('host: runFsm 给出 ok 的信封，renderFsm 输出中文结果', () => {
  const args: FsmArgs = { op: 'reduce', ...MEALY_110 }
  const env = runFsm(args)
  assert.equal(env.ok, true)
  assert.equal(env.op, 'reduce')
  const text = renderFsm(env)
  assert.match(text, /等价类：\{S0,S3\}/)
  assert.match(text, /化简后 3 个状态/)

  const synth = runFsm({ op: 'synthesize', ...MEALY_110, ff: 'JK', encoding: 'binary' })
  assert.equal(synth.ok, true)
  assert.match(renderFsm(synth), /J1 = /)

  const bad = runFsm({ op: 'reduce', ...MEALY_110, states: ['S0', 'S0'] })
  assert.equal(bad.ok, false)
  assert.match(renderFsm(bad), /输入有误/)
})

test('host: 参数表包含四个 op 与状态机字段', () => {
  const ops = FSM_PARAMETERS.op.enum
  assert.deepEqual([...ops], ['reduce', 'assign', 'synthesize', 'self_start'])
  for (const key of ['type', 'states', 'inputs', 'outputs', 'transitions']) {
    assert.ok(key in FSM_PARAMETERS)
  }
})
