import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AsmSpec, CtrlFunction } from '../src/shared/system.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import { specFromExpr } from '../src/solvers/bool.ts'
import { analyzeAsm, designController } from '../src/solvers/system.ts'
import { SYSTEM_PARAMETERS, renderSystem, runSystem } from '../src/host/tools/system.logic.ts'

// ───────────────────────── 教材例题：乘法控制器（4 状态） ─────────────────────────

/**
 * 简化的移位相加乘法控制器。
 * S0 空闲：Start 为 1 时进入 S1，否则原地等待；输出 Clr。
 * S1 装入：无条件进入 S2；输出 Load。
 * S2 判断：Zero 为 1 结束回 S0；否则进入 S3。条件输出 Add 在 A0 为 1 时有效。
 * S3 移位：无条件回到 S2；输出 Shift、Dec。
 * 条件变量：Start、Zero、A0。
 */
const MULT: AsmSpec = {
  states: [
    { name: 'S0', outputs: ['Clr'], conditionals: [] },
    { name: 'S1', outputs: ['Load'], conditionals: [] },
    { name: 'S2', outputs: [], conditionals: [{ name: 'Add', expr: 'A0' }] },
    { name: 'S3', outputs: ['Shift', 'Dec'], conditionals: [] },
  ],
  transitions: [
    { from: 'S0', cond: 'Start', to: 'S1' },
    { from: 'S0', cond: 'else', to: 'S0' },
    { from: 'S1', cond: '1', to: 'S2' },
    { from: 'S2', cond: 'Zero', to: 'S0' },
    { from: 'S2', cond: 'else', to: 'S3' },
    { from: 'S3', cond: '1', to: 'S2' },
  ],
}

/** 在给定赋值下求函数值（用化简结果的第一个最简解）。 */
function evalFn(f: CtrlFunction, env: Record<string, number>): number {
  if (f.variables.length === 0) return f.texts[0] === '1' ? 1 : 0
  const minterms = specFromExpr(f.texts[0], f.variables).minterms
  let m = 0
  for (const v of f.variables) m = (m << 1) | (env[v] as number)
  return minterms.includes(m) ? 1 : 0
}

/** 所有等价解在每个赋值下取值相同。 */
function assertAllEquivalent(f: CtrlFunction, vars: string[]): void {
  if (!f.minimized) return
  const base = f.texts[0]
  for (let m = 0; m < 1 << vars.length; m++) {
    const env: Record<string, number> = {}
    vars.forEach((v, i) => {
      env[v] = (m >> (vars.length - 1 - i)) & 1
    })
    const want = evalFn(f, env)
    for (const text of f.texts) {
      const g: CtrlFunction = { ...f, texts: [text], text }
      assert.equal(evalFn(g, env), want, `${f.name}: 等价解 ${text} 与 ${base} 不一致`)
    }
  }
}

test('ASM 例题：校验通过，状态转移表与 ASM 图等价', () => {
  const r = analyzeAsm(MULT)
  assert.equal(r.valid, true)
  assert.deepEqual(r.issues, [])
  assert.deepEqual(r.conditionVars, ['Start', 'Zero', 'A0'])
  assert.equal(r.table.combos.length, 8)
  assert.equal(r.table.rows.length, 4)
  // 组合编号：Start 为最高位，Zero 次之，A0 为最低位。
  const s2 = r.table.rows[2]
  assert.equal(s2.cells[2].next, 'S0') // Zero=1
  assert.equal(s2.cells[0].next, 'S3') // Zero=0
  assert.deepEqual(s2.cells[1].active, ['Add']) // A0=1 时 Add 有效
  assert.deepEqual(s2.cells[0].active, [])
  assert.equal(r.table.rows[0].cells[4].next, 'S1') // Start=1
  assert.equal(r.table.rows[0].cells[0].next, 'S0') // 其余情况
})

test('ASM 例题：计数器型控制器的 CE、LD 与置数值', () => {
  const c = designController(MULT)
  const counter = c.schemes.find(s => s.scheme === 'counter')
  assert.ok(counter)
  assert.deepEqual(counter.codes.map(x => x.code), ['00', '01', '10', '11'])
  const byName = new Map(counter.functions.map(f => [f.name, f]))
  for (let code = 0; code < 4; code++) {
    for (const start of [0, 1]) {
      for (const zero of [0, 1]) {
        const env = { Q1: code >> 1, Q0: code & 1, Start: start, Zero: zero }
        // 计数：00 在 Start 时计数；01 计数；10 在 Zero=0 时计数；11 不计数
        const wantCE = [start, 1, 1 - zero, 0][code]
        // 置数：10 在 Zero=1 时回到 00；11 回到 10
        const wantLD = [0, 0, zero, 1][code]
        assert.equal(evalFn(byName.get('CE') as CtrlFunction, env), wantCE, `CE 在编码 ${code} Start=${start} Zero=${zero}`)
        assert.equal(evalFn(byName.get('LD') as CtrlFunction, env), wantLD, `LD 在编码 ${code} Start=${start} Zero=${zero}`)
        if (wantLD === 1) {
          // 置数值：11 → 10（D1=1，D0=0）；10 → 00（D1=0，D0=0）
          const d1 = [0, 0, 0, 1][code]
          assert.equal(evalFn(byName.get('D_Q1') as CtrlFunction, env), d1, `D_Q1 在编码 ${code}`)
          assert.equal(evalFn(byName.get('D_Q0') as CtrlFunction, env), 0, `D_Q0 在编码 ${code}`)
        }
      }
    }
  }
  for (const f of counter.functions) assertAllEquivalent(f, [...f.variables])
  assert.ok(counter.decoder)
  assert.deepEqual(counter.decoder.map(d => d.line), ['Y0', 'Y1', 'Y2', 'Y3'])
  assert.ok(counter.devices.some(d => d.includes('74161')))
})

test('ASM 例题：多路选择器型控制器的 MUX 数据端', () => {
  const c = designController(MULT)
  const mux = c.schemes.find(s => s.scheme === 'mux')
  assert.ok(mux && mux.muxes)
  assert.equal(mux.muxes.length, 2)
  const byName = new Map(mux.functions.map(f => [f.name, f]))
  // S2 的次态：Zero=1 → S0（00），Zero=0 → S3（11）
  const q1s2 = byName.get('Q1|S2') as CtrlFunction
  const q0s2 = byName.get('Q0|S2') as CtrlFunction
  assert.equal(evalFn(q1s2, { Zero: 0 }), 1)
  assert.equal(evalFn(q1s2, { Zero: 1 }), 0)
  assert.equal(evalFn(q0s2, { Zero: 0 }), 1)
  assert.equal(evalFn(q0s2, { Zero: 1 }), 0)
  // S0 的次态：Start=1 → S1（01），否则留在 S0（00）
  assert.equal(evalFn(byName.get('Q0|S0') as CtrlFunction, { Start: 1 }), 1)
  assert.equal(evalFn(byName.get('Q0|S0') as CtrlFunction, { Start: 0 }), 0)
  assert.equal(evalFn(byName.get('Q1|S0') as CtrlFunction, { Start: 1 }), 0)
  // 数据端表：编码 11 为 S3，其数据端对两位都是常量
  const q1Row = mux.muxes[0].rows[3]
  assert.equal(q1Row.state, 'S3')
  assert.equal(q1Row.data, '1')
  for (const f of mux.functions) assertAllEquivalent(f, [...f.variables])
})

test('ASM 例题：定序型控制器（一态一位）的次态表达式', () => {
  const c = designController(MULT)
  const seq = c.schemes.find(s => s.scheme === 'sequence')
  assert.ok(seq)
  assert.deepEqual(seq.bits, ['Q3', 'Q2', 'Q1', 'Q0'])
  assert.deepEqual(seq.codes.map(x => x.code), ['0001', '0010', '0100', '1000'])
  const byName = new Map(seq.functions.map(f => [f.name, f]))
  const expected: Record<string, (e: Record<string, number>) => number> = {
    'Q0⁺': e => (e.Q0 & (1 - e.Start)) | (e.Q2 & e.Zero),
    'Q1⁺': e => e.Q0 & e.Start,
    'Q2⁺': e => e.Q1 | e.Q3,
    'Q3⁺': e => e.Q2 & (1 - e.Zero),
  }
  // 只检查有效码（恰好一位为 1），无效码为无关项
  for (const pat of [0b0001, 0b0010, 0b0100, 0b1000]) {
    for (const start of [0, 1]) {
      for (const zero of [0, 1]) {
        const env = { Q3: (pat >> 3) & 1, Q2: (pat >> 2) & 1, Q1: (pat >> 1) & 1, Q0: pat & 1, Start: start, Zero: zero, A0: 0 }
        for (const [name, fn] of Object.entries(expected)) {
          const f = byName.get(name) as CtrlFunction
          assert.equal(evalFn(f, env), fn(env), `${name} 在 ${pat.toString(2)} Start=${start} Zero=${zero}`)
        }
      }
    }
  }
  for (const f of seq.functions) assertAllEquivalent(f, [...f.variables])
})

test('控制信号真值表：状态 → 各控制信号', () => {
  const c = designController(MULT)
  assert.deepEqual(c.signals, ['Clr', 'Load', 'Add', 'Shift', 'Dec'])
  const rowOf = (s: string) => c.controlTable.find(r => r.state === s)?.values
  assert.deepEqual(rowOf('S0'), ['1', '0', '0', '0', '0'])
  assert.deepEqual(rowOf('S1'), ['0', '1', '0', '0', '0'])
  assert.deepEqual(rowOf('S2'), ['0', '0', 'A0', '0', '0'])
  assert.deepEqual(rowOf('S3'), ['0', '0', '0', '1', '1'])
})

// ───────────────────────── 错误 ASM ─────────────────────────

test('错误 ASM：条件不互斥（overlap）', () => {
  const spec: AsmSpec = {
    states: [
      { name: 'A', outputs: [], conditionals: [] },
      { name: 'B', outputs: [], conditionals: [] },
      { name: 'C', outputs: [], conditionals: [] },
    ],
    transitions: [
      { from: 'A', cond: 'X', to: 'B' },
      { from: 'A', cond: 'Y', to: 'C' },
      { from: 'A', cond: 'else', to: 'A' },
      { from: 'B', cond: '1', to: 'A' },
      { from: 'C', cond: '1', to: 'A' },
    ],
  }
  const r = analyzeAsm(spec)
  assert.equal(r.valid, false)
  const hit = r.issues.find(i => i.kind === 'overlap')
  assert.ok(hit)
  assert.equal(hit.state, 'A')
  assert.throws(() => designController(spec), (e: unknown) => e instanceof DlogicInputError && e.message.includes('未通过校验'))
})

test('错误 ASM：不可达状态（unreachable）', () => {
  const spec: AsmSpec = {
    states: [
      { name: 'A', outputs: [], conditionals: [] },
      { name: 'B', outputs: [], conditionals: [] },
      { name: 'C', outputs: [], conditionals: [] },
    ],
    transitions: [
      { from: 'A', cond: '1', to: 'B' },
      { from: 'B', cond: '1', to: 'A' },
      { from: 'C', cond: '1', to: 'A' },
    ],
  }
  const r = analyzeAsm(spec)
  assert.equal(r.valid, false)
  const hit = r.issues.filter(i => i.kind === 'unreachable')
  assert.deepEqual(hit.map(i => i.state), ['C'])
})

test('错误 ASM：缺少 else（missing-else）与悬空状态（dangling）', () => {
  const missing: AsmSpec = {
    states: [
      { name: 'A', outputs: [], conditionals: [] },
      { name: 'B', outputs: [], conditionals: [] },
    ],
    transitions: [
      { from: 'A', cond: 'X', to: 'B' },
      { from: 'B', cond: '1', to: 'A' },
    ],
  }
  const r1 = analyzeAsm(missing)
  assert.equal(r1.valid, false)
  assert.ok(r1.issues.some(i => i.kind === 'missing-else' && i.state === 'A'))

  const dangling: AsmSpec = {
    states: [
      { name: 'A', outputs: [], conditionals: [] },
      { name: 'B', outputs: [], conditionals: [] },
    ],
    transitions: [{ from: 'A', cond: '1', to: 'B' }],
  }
  const r2 = analyzeAsm(dangling)
  assert.equal(r2.valid, false)
  assert.ok(r2.issues.some(i => i.kind === 'dangling' && i.state === 'B'))
})

test('ASM 提示：else 永远不执行时只给出警告，仍可设计控制器', () => {
  const spec: AsmSpec = {
    states: [
      { name: 'A', outputs: ['Go'], conditionals: [] },
      { name: 'B', outputs: [], conditionals: [] },
      { name: 'C', outputs: [], conditionals: [] },
      { name: 'D', outputs: [], conditionals: [] },
    ],
    transitions: [
      { from: 'A', cond: 'X', to: 'B' },
      { from: 'A', cond: "X'", to: 'C' },
      { from: 'A', cond: 'else', to: 'D' },
      { from: 'B', cond: '1', to: 'A' },
      { from: 'C', cond: '1', to: 'A' },
      { from: 'D', cond: '1', to: 'A' },
    ],
  }
  const r = analyzeAsm(spec)
  assert.equal(r.valid, true)
  assert.ok(r.issues.some(i => i.kind === 'dead-else' && i.level === 'warning'))
  assert.doesNotThrow(() => designController(spec))
})

test('规模限制：状态数超过 12 或条件变量超过 4 时报错', () => {
  const many: AsmSpec = {
    states: Array.from({ length: 13 }, (_, i) => ({ name: `T${i}`, outputs: [], conditionals: [] })),
    transitions: Array.from({ length: 13 }, (_, i) => ({ from: `T${i}`, cond: '1', to: `T${(i + 1) % 13}` })),
  }
  assert.throws(() => analyzeAsm(many), DlogicInputError)

  const vars: AsmSpec = {
    states: [{ name: 'A', outputs: [], conditionals: [] }],
    transitions: [
      { from: 'A', cond: 'P1 * P2 * P3 * P4 * P5', to: 'A' },
      { from: 'A', cond: 'else', to: 'A' },
    ],
  }
  assert.throws(() => analyzeAsm(vars), (e: unknown) => e instanceof DlogicInputError && e.message.includes('条件变量最多'))
})

// ───────────────────────── 工具层 ─────────────────────────

test('工具层：参数结构与两个 op 的信封', () => {
  assert.deepEqual(Object.keys(SYSTEM_PARAMETERS).sort(), ['conditionVars', 'initial', 'op', 'states', 'transitions'])
  const args = {
    op: 'asm' as const,
    states: MULT.states.map(s => ({ name: s.name, outputs: s.outputs, conditionals: s.conditionals })),
    transitions: MULT.transitions,
  }
  const asm = runSystem(args)
  assert.equal(asm.ok, true)
  assert.match(renderSystem(asm), /校验通过/)

  const ctl = runSystem({ ...args, op: 'controller' })
  assert.equal(ctl.ok, true)
  const text = renderSystem(ctl)
  assert.match(text, /【counter】/)
  assert.match(text, /【mux】/)
  assert.match(text, /【sequence】/)

  const bad = runSystem({ ...args, op: 'controller', transitions: [{ from: 'S0', cond: 'X', to: 'S1' }] })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /未通过校验/)

  const unknown = runSystem({ ...args, op: 'nope' as 'asm' })
  assert.equal(unknown.ok, false)
})
