import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { AnalyzeResult, CounterResult, FfResult, ShiftResult, WaveformResult } from '../src/shared/seq.ts'
import {
  analyzeMachine,
  counterDesign,
  ffCharacteristic,
  shiftDesign,
  waveformDesign,
} from '../src/solvers/seq.ts'
import { renderSeq, runSeq } from '../src/host/tools/seq.logic.ts'

// ───────────────────────── 触发器 ─────────────────────────

test('ff JK: characteristic equation and excitation table (textbook)', () => {
  const r = ffCharacteristic('JK')
  assert.equal(r.characteristic, "Q* = JQ' + K'Q")
  const byKey = new Map(r.excitation.map(e => [`${e.from}${e.to}`, e.drive]))
  assert.deepEqual(byKey.get('00'), { J: 0, K: 'X' })
  assert.deepEqual(byKey.get('01'), { J: 1, K: 'X' })
  assert.deepEqual(byKey.get('10'), { J: 'X', K: 1 })
  assert.deepEqual(byKey.get('11'), { J: 'X', K: 0 })
})

test('ff JK: characteristic table has 8 rows and J=K=1 toggles', () => {
  const r = ffCharacteristic('JK')
  assert.equal(r.table.length, 8)
  const toggle = r.table.filter(row => row.inputs.J === 1 && row.inputs.K === 1)
  assert.deepEqual(toggle.map(row => [row.q, row.next]), [[0, 1], [1, 0]])
})

test('ff SR: S=R=1 is forbidden; T and D behave as specified', () => {
  const sr = ffCharacteristic('SR')
  const forbidden = sr.table.filter(row => row.inputs.S === 1 && row.inputs.R === 1)
  assert.ok(forbidden.every(row => row.next === 'X'))
  assert.match(sr.constraint ?? '', /SR = 0/)
  const d = ffCharacteristic('D')
  assert.ok(d.table.every(row => row.next === row.inputs.D))
  const t = ffCharacteristic('T')
  assert.ok(t.table.every(row => row.next === (row.inputs.T === 1 ? 1 - row.q : row.q)))
})

test('ff SR_LATCH: S̄=R̄=0 forbidden, S̄=0 sets, R̄=0 resets', () => {
  const r = ffCharacteristic('SR_LATCH')
  const both0 = r.table.filter(row => row.inputs['S̄'] === 0 && row.inputs['R̄'] === 0)
  assert.ok(both0.every(row => row.next === 'X'))
  const set = r.table.filter(row => row.inputs['S̄'] === 0 && row.inputs['R̄'] === 1)
  assert.ok(set.every(row => row.next === 1))
  const reset = r.table.filter(row => row.inputs['S̄'] === 1 && row.inputs['R̄'] === 0)
  assert.ok(reset.every(row => row.next === 0))
})

test('ff GATED_D: holds when CP=0, follows D when CP=1', () => {
  const r = ffCharacteristic('GATED_D')
  assert.ok(r.table.filter(row => row.inputs.CP === 0).every(row => row.next === row.q))
  assert.ok(r.table.filter(row => row.inputs.CP === 1).every(row => row.next === row.inputs.D))
})

test('ff: unknown kind is rejected by the solver', () => {
  assert.throws(() => ffCharacteristic('XX' as never), DlogicInputError)
})

// ───────────────────────── 计数器 ─────────────────────────

test('counter 161 mod 10, reset method: async clear with CR̄ = (Q3Q1)', () => {
  const r = counterDesign('161', 'reset', 10)
  assert.equal(r.feedback.kind, 'async')
  assert.equal(r.feedback.expr, "CR̄ = (Q3Q1)'")
  assert.equal(r.glitch, true)
  assert.equal(r.transient, '1010')
  const valid = r.sequence.filter(s => !s.transient).map(s => s.value)
  assert.deepEqual(valid, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(r.sequence.at(-1)?.transient, true)
})

test('counter 161 mod 6, preset method: D = 10, LD̄ = (Q3Q2Q1Q0), states 10..15', () => {
  const r = counterDesign('161', 'preset', 6)
  assert.equal(r.feedback.kind, 'sync')
  assert.equal(r.feedback.expr, "LD̄ = (Q3Q2Q1Q0)'")
  assert.deepEqual(r.load, { value: 10, bits: '1010' })
  assert.deepEqual(r.sequence.map(s => s.value), [10, 11, 12, 13, 14, 15])
  assert.equal(r.glitch, false)
})

test('counter 163 mod 6, reset method: synchronous clear decodes N-1 = 5, no glitch', () => {
  const r = counterDesign('163', 'reset', 6)
  assert.equal(r.feedback.kind, 'sync')
  assert.equal(r.feedback.expr, "CR̄ = (Q2Q0)'")
  assert.equal(r.glitch, false)
  assert.deepEqual(r.sequence.map(s => s.value), [0, 1, 2, 3, 4, 5])
})

test('counter 160 mod 6, reset method: async clear decodes 0110', () => {
  const r = counterDesign('160', 'reset', 6)
  assert.equal(r.feedback.expr, "CR̄ = (Q2Q1)'")
  assert.equal(r.glitch, true)
  assert.equal(r.modulus, 10)
})

test('counter 161 mod 100: two-chip cascade, CR̄ decodes 100 = 0110 0100', () => {
  const r = counterDesign('161', 'reset', 100)
  assert.equal(r.chips, 2)
  assert.equal(r.modulus, 256)
  assert.equal(r.feedback.expr, "CR̄ = (H2H1L2)'")
  assert.equal(r.sequence.filter(s => !s.transient).length, 100)
})

test('counter: natural modulus has no feedback', () => {
  const r = counterDesign('161', 'reset', 16)
  assert.equal(r.natural, true)
  assert.equal(r.feedback.kind, 'none')
  assert.equal(r.glitch, false)
})

test('counter: out-of-range N is rejected', () => {
  assert.throws(() => counterDesign('161', 'reset', 1), DlogicInputError)
  assert.throws(() => counterDesign('161', 'reset', 257), DlogicInputError)
  assert.throws(() => counterDesign('160', 'reset', 101), DlogicInputError)
})

// ───────────────────────── 移位寄存器与循环计数器 ─────────────────────────

test('johnson 3-bit (modulus 6): valid cycle found, 010/101 form an invalid loop, not self-starting', () => {
  const r = shiftDesign('johnson', 3, '000', undefined, undefined)
  assert.equal(r.modulus, 6)
  assert.equal(r.expectedModulus, 6)
  assert.deepEqual(r.sequence.map(s => s.state), ['000', '001', '011', '111', '110', '100'])
  const invalid = r.cycles?.filter(c => !c.valid) ?? []
  assert.equal(invalid.length, 1)
  assert.deepEqual([...invalid[0].states].sort(), ['010', '101'])
  assert.equal(r.selfStart, false)
  assert.ok(r.invalidPaths.every(p => !p.reached))
})

test('ring 4-bit from 0001: modulus 4 and a 0000 self-loop', () => {
  const r = shiftDesign('ring', 4, '0001', undefined, undefined)
  assert.equal(r.modulus, 4)
  assert.deepEqual(r.sequence.map(s => s.state), ['0001', '0010', '0100', '1000'])
  assert.ok(r.cycles?.some(c => !c.valid && c.states.length === 1 && c.states[0] === '0000'))
  assert.equal(r.selfStart, false)
})

test('194 right shift with serial input 1011 from 0000', () => {
  const r: ShiftResult = shiftDesign('194', undefined, '0000', 'right', [1, 0, 1, 1])
  assert.deepEqual(r.sequence.map(s => s.state), ['0000', '1000', '0100', '1010', '1101'])
  assert.equal(r.graph, null)
})

test('shift: wrong bit count for 194 is rejected', () => {
  assert.throws(() => shiftDesign('194', 3, undefined, undefined, undefined), DlogicInputError)
})

// ───────────────────────── 同步时序电路分析 ─────────────────────────

test('analyze: 2-bit synchronous counter with enable X (JK flip-flops)', () => {
  const r: AnalyzeResult = analyzeMachine(
    [
      { name: 'Q0', kind: 'JK', drives: [{ pin: 'J', expr: 'X' }, { pin: 'K', expr: 'X' }] },
      { name: 'Q1', kind: 'JK', drives: [{ pin: 'J', expr: 'XQ0' }, { pin: 'K', expr: 'XQ0' }] },
    ],
    ['X'],
    [{ name: 'Y', expr: 'Q1Q0X' }],
    undefined,
  )
  const row = (state: string, input: string) => r.table.find(x => x.state === state && x.input === input)
  // 状态字符串按触发器顺序书写：第一位为 Q0。X=1 时按 00→10→01→11→00 计数。
  assert.equal(row('00', '1')?.next, '10')
  assert.equal(row('10', '1')?.next, '01')
  assert.equal(row('01', '1')?.next, '11')
  assert.equal(row('11', '1')?.next, '00')
  assert.equal(row('11', '0')?.next, '11')
  assert.equal(row('11', '1')?.outputs[0].value, 1)
  assert.equal(r.outputs[0].type, 'Mealy')
  assert.equal(r.selfStart, true)
  assert.equal(r.validStates.length, 4)
  assert.equal(r.stateEquations[0].text, "Q0'X + Q0X'")
})

test('analyze: invalid state 11 self-loops, not self-starting', () => {
  const r = analyzeMachine(
    [
      { name: 'Q1', kind: 'D', drives: [{ pin: 'D', expr: 'Q0' }] },
      { name: 'Q0', kind: 'D', drives: [{ pin: 'D', expr: 'Q1⊙Q0' }] },
    ],
    [],
    [],
    undefined,
  )
  assert.equal(r.stateEquations[0].text, 'Q0')
  assert.equal(r.stateEquations[1].text, "Q1'Q0' + Q1Q0")
  assert.deepEqual(r.table.map(x => `${x.state}>${x.next}`), ['00>01', '01>10', '10>00', '11>11'])
  assert.deepEqual(r.validStates, ['00', '01', '10'])
  assert.equal(r.selfStart, false)
  const p = r.invalidPaths.find(x => x.from === '11')
  assert.ok(p)
  assert.equal(p.reached, false)
})

test('analyze: invalid state 10 enters the valid cycle 00 ⇄ 01, so the circuit self-starts', () => {
  // Q1* = 0，Q0* = Q1'Q0'：00 → 01 → 00 为有效循环；10、11 均进入 00。
  const r = analyzeMachine(
    [
      { name: 'Q1', kind: 'D', drives: [{ pin: 'D', expr: '0' }] },
      { name: 'Q0', kind: 'D', drives: [{ pin: 'D', expr: "Q1'Q0'" }] },
    ],
    [],
    [],
    '00',
  )
  assert.deepEqual(r.validStates, ['00', '01'])
  assert.equal(r.selfStart, true)
  const p = r.invalidPaths.find(x => x.from === '10')
  assert.deepEqual(p?.path, ['10', '00'])
  assert.equal(p?.reached, true)
})

test('analyze: asynchronous request is only a warning in the host layer', () => {
  const out = runSeq({
    op: 'analyze',
    asynchronous: true,
    flipflops: [{ name: 'Q0', kind: 'T', drives: [{ pin: 'T', expr: '1' }] }],
  })
  assert.equal(out.ok, true)
  assert.ok(out.warnings.some(w => w.includes('异步电路')))
})

test('analyze: a driving expression that uses an unknown name is rejected', () => {
  const out = runSeq({
    op: 'analyze',
    flipflops: [{ name: 'Q0', kind: 'D', drives: [{ pin: 'D', expr: 'Z' }] }],
  })
  assert.equal(out.ok, false)
  assert.match(out.error ?? '', /未知变量|无法识别/)
})

// ───────────────────────── 波形 ─────────────────────────

test('waveform JK: Q follows J and K sampled each period', () => {
  const r: WaveformResult = waveformDesign('ff', {
    ffKind: 'JK',
    init: '0',
    waves: [
      { name: 'J', wave: '1100' },
      { name: 'K', wave: '0011' },
    ],
  })
  const q = r.signals.find(s => s.name === 'Q')
  assert.equal(q?.wave, '0110')
  assert.equal(r.signals.find(s => s.name === 'CP')?.wave, 'pppp')
})

test('waveform counter 161 mod 6, reset method: Q0 toggles over 8 periods', () => {
  const r = waveformDesign('counter', { model: '161', method: 'reset', N: 6, steps: 8 })
  assert.equal(r.signals.find(s => s.name === 'Q0')?.wave, '01010101')
  assert.equal(r.signals.find(s => s.name === 'Q1')?.wave, '00110000')
  assert.equal(r.signals.find(s => s.name === 'Q2')?.wave, '00001100')
})

test('waveform: mismatched wave lengths and non-binary characters are rejected', () => {
  assert.throws(
    () => waveformDesign('ff', { ffKind: 'D', waves: [{ name: 'D', wave: '10' }, { name: 'CP', wave: '1' }] }),
    DlogicInputError,
  )
  assert.throws(() => waveformDesign('ff', { ffKind: 'D', waves: [{ name: 'D', wave: '1x' }] }), DlogicInputError)
})

test('waveform shift 194: serial input is sampled and shifted into Q3', () => {
  const r = waveformDesign('shift', { shiftKind: '194', init: '0000', waves: [{ name: 'D', wave: '1011' }] })
  assert.equal(r.signals.find(s => s.name === 'Q3')?.wave, '0101')
})

// ───────────────────────── 宿主逻辑 ─────────────────────────

test('runSeq: counter returns steps and an async glitch warning', () => {
  const out = runSeq({ op: 'counter', model: '161', N: 10 })
  assert.equal(out.ok, true)
  const r = out.result as CounterResult
  assert.equal(r.glitch, true)
  assert.ok(out.steps.some(s => s.kind === 'feedback'))
  assert.ok(out.warnings.some(w => w.includes('过渡态')))
})

test('runSeq: missing parameters become ok: false', () => {
  const out = runSeq({ op: 'shift' })
  assert.equal(out.ok, false)
  assert.match(out.error ?? '', /shiftKind/)
})

test('runSeq: ff result and renderSeq text', () => {
  const out = runSeq({ op: 'ff', ffKind: 'D' })
  assert.equal(out.ok, true)
  assert.equal((out.result as FfResult).characteristic, 'Q* = D')
  const text = renderSeq(out)
  assert.match(text, /Q\* = D/)
  assert.doesNotMatch(text, /工具|核对|引擎计算/)
})

test('runSeq: shift warns on non-standard modulus and reports non-self-starting', () => {
  const out = runSeq({ op: 'shift', shiftKind: 'johnson', bits: 3, init: '000' })
  assert.equal(out.ok, true)
  assert.ok(out.warnings.some(w => w.includes('不能自启动')))
  const r = out.result as ShiftResult
  assert.equal(r.modulus, 6)
})

test('runSeq: analyze text rendering lists state table rows', () => {
  const out = runSeq({
    op: 'analyze',
    flipflops: [
      { name: 'Q1', kind: 'D', drives: [{ pin: 'D', expr: 'Q0' }] },
      { name: 'Q0', kind: 'D', drives: [{ pin: 'D', expr: 'Q1⊙Q0' }] },
    ],
  })
  assert.equal(out.ok, true)
  const text = renderSeq(out)
  assert.match(text, /状态表/)
  assert.match(text, /不能自启动/)
})
