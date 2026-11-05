import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drawExpr } from '../src/solvers/comb.ts'
import { specFromExpr } from '../src/solvers/bool.ts'
import { layoutGateDiagram } from '../src/shared/gateLayout.ts'
import { runComb, renderComb, COMB_OPS, COMB_PARAMETERS } from '../src/host/tools/comb.logic.ts'

function countType(gates: { type: string }[], type: string): number {
  return gates.filter(g => g.type === type).length
}

// ───────────────────────── 求解器：draw ─────────────────────────

test('draw: X = AB\' + BC\' + CA\' 按原样建网表：3 个非门、3 个与门、1 个或门', () => {
  const out = drawExpr({ expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'], outputName: 'X' })
  const r = out.result
  assert.deepEqual(r.inputs, ['A', 'B', 'C'])
  assert.deepEqual(r.outputs, ['X'])
  assert.equal(countType(r.gates, 'NOT'), 3)
  assert.equal(countType(r.gates, 'AND'), 3)
  assert.equal(countType(r.gates, 'OR'), 1)
  assert.equal(r.gates.length, 7)
  // 取反门占一级：非门（1）→ 与门（2）→ 或门（3）。
  assert.equal(r.depth, 3)
  assert.deepEqual(out.warnings, [])
  // 取反变量共用非门：B'、C'、A' 各一个。
  const notIns = r.gates.filter(g => g.type === 'NOT').map(g => g.in[0]).sort()
  assert.deepEqual(notIns, ['A', 'B', 'C'])
  // 输出门的输入是三个与项。
  const or = r.gates.find(g => g.type === 'OR')!
  assert.equal(or.out, 'X')
  assert.equal(or.in.length, 3)
})

test('draw: 真值表与 AB\' + BC\' + CA\' 的最小项 1..6 一致', () => {
  const r = drawExpr({ expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'] }).result
  const ones = r.truthTable.rows.filter(row => row.outputs[0] === 1).map(row => row.index)
  assert.deepEqual(ones, [1, 2, 3, 4, 5, 6])
  assert.equal(r.finalExprs[0].name, 'F')
  assert.ok(r.finalExprs[0].simplified.length > 0)
})

test('draw: 默认输出名为 F，outputName 可改名', () => {
  const dflt = drawExpr({ expr: 'AB + C' }).result
  assert.deepEqual(dflt.outputs, ['F'])
  const named = drawExpr({ expr: 'AB + C', outputName: 'Y' }).result
  assert.deepEqual(named.outputs, ['Y'])
})

test('draw: 单项多文字为一个与门直接作输出；单文字取反为一个非门', () => {
  const and = drawExpr({ expr: 'AB', variables: ['A', 'B'] }).result
  assert.equal(and.gates.length, 1)
  assert.equal(and.gates[0].type, 'AND')
  assert.equal(and.gates[0].out, 'F')
  const not = drawExpr({ expr: "A'" }).result
  assert.equal(not.gates.length, 1)
  assert.equal(not.gates[0].type, 'NOT')
  assert.equal(not.gates[0].out, 'F')
})

test('draw: 单文字项直接接到或门（不加门）', () => {
  const r = drawExpr({ expr: 'A + BC', variables: ['A', 'B', 'C'] }).result
  assert.equal(countType(r.gates, 'AND'), 1)
  assert.equal(countType(r.gates, 'OR'), 1)
  assert.equal(countType(r.gates, 'NOT'), 0)
  const or = r.gates.find(g => g.type === 'OR')!
  assert.ok(or.in.includes('A'))
})

test('draw: 非与或式（POS）取第一个最简与或式，并给出提示，真值表与原式一致', () => {
  const expr = '(A + B)(A\' + C)'
  const out = drawExpr({ expr, variables: ['A', 'B', 'C'] })
  assert.equal(out.warnings.length, 1)
  assert.match(out.warnings[0], /最简与或式/)
  const want = specFromExpr(expr, ['A', 'B', 'C']).minterms
  const got = out.result.truthTable.rows.filter(row => row.outputs[0] === 1).map(row => row.index)
  assert.deepEqual(got, want)
})

test('draw: 含异或的表达式同样走最简与或式路径', () => {
  const out = drawExpr({ expr: 'A ⊕ B', variables: ['A', 'B'] })
  assert.equal(out.warnings.length, 1)
  const got = out.result.truthTable.rows.filter(row => row.outputs[0] === 1).map(row => row.index)
  assert.deepEqual(got, [1, 2])
})

test('draw: 恒为 0 或恒为 1 的非与或式没有门可画，给出中文说明', () => {
  assert.throws(() => drawExpr({ expr: "(A + A')(B + B')", variables: ['A', 'B'] }), /恒为 0 或恒为 1/)
})

test('draw: 只有一个正文字的输出没有门可画', () => {
  assert.throws(() => drawExpr({ expr: 'A', variables: ['A'] }), /没有门可画/)
})

test('draw: 变量超过 6 个时以中文报错', () => {
  const res = runComb({ op: 'draw', expr: 'A + B + C + D + E + F + G' })
  assert.equal(res.ok, false)
  assert.match(res.error ?? '', /最多支持 6 个变量/)
})

test('draw: 输出名与输入名冲突时报错；取反门名避开已有输入名', () => {
  assert.throws(() => drawExpr({ expr: 'AB', variables: ['A', 'B'], outputName: 'A' }))
  const r = drawExpr({ expr: "A'B + AB'", variables: ['A', 'B', 'A_n'] }).result
  const names = r.gates.map(g => g.out)
  assert.equal(new Set(names).size, names.length)
  assert.ok(!names.includes('A_n'))
})

test('draw: 结果的网表可直接交给布局（门列表与输出齐全）', () => {
  const r = drawExpr({ expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'] }).result
  const lay = layoutGateDiagram({
    inputs: r.inputs,
    gates: r.gates.map(g => ({ out: g.out, type: g.type, in: g.in })),
    outputs: r.outputs,
  })
  assert.equal(lay.gates.length, 7)
  assert.equal(lay.outputs.length, 1)
})

// ───────────────────────── 宿主：信封、文本与参数 ─────────────────────────

test('runComb(draw) 返回信封，渲染文本含门级分析与真值表，且不含提示语', () => {
  const res = runComb({ op: 'draw', expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'] })
  assert.equal(res.ok, true)
  assert.equal(res.op, 'draw')
  assert.ok(res.steps.length > 0)
  const text = renderComb(res)
  assert.match(text, /真值表/)
  assert.match(text, /输出 F = /)
  assert.doesNotMatch(text, /工具|核对|引擎/)
})

test('runComb(draw) 缺少 expr 时 ok 为 false', () => {
  const res = runComb({ op: 'draw' })
  assert.equal(res.ok, false)
  assert.match(res.error ?? '', /expr/)
})

test('draw 出现在 op 列表与参数定义中', () => {
  assert.ok(COMB_OPS.includes('draw'))
  assert.deepEqual(COMB_PARAMETERS.op.enum, ['analyze', 'map_msi', 'draw'])
  assert.ok('outputName' in COMB_PARAMETERS)
})
