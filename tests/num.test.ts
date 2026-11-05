import { test } from 'node:test'
import assert from 'node:assert/strict'
import { convertBase, type NumStep } from '../src/solvers/num.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'

const conv = (value: string, from: number, to: number, precision?: number) =>
  convertBase({ value, from, to, precision })

type DivisionStep = Extract<NumStep, { kind: 'int-division' }>

test('十进制整数转二进制（除 2 取余）', () => {
  const r = conv('25', 10, 2)
  assert.equal(r.result, '11001')
  assert.equal(r.method, 'expansion-division')
  const div = r.steps.find(s => s.kind === 'int-division') as DivisionStep
  assert.deepEqual(div.rows.map(x => x.remainder), [1, 0, 0, 1, 1])
})

test('十进制小数转二进制（乘 2 取整，能除尽）', () => {
  const r = conv('0.625', 10, 2)
  assert.equal(r.result, '0.101')
  assert.equal(r.exact, true)
})

test('十进制小数转二进制（除不尽，按精度截断）', () => {
  const r = conv('0.1', 10, 2, 8)
  assert.equal(r.result, '0.00011001')
  assert.equal(r.exact, false)
})

test('二进制转十进制（按权展开）', () => {
  const r = conv('1011.101', 2, 10)
  assert.equal(r.result, '11.625')
  assert.equal(r.decimal, '11.625')
  assert.ok(r.steps.some(s => s.kind === 'weighted-expansion'))
})

test('二进制转十六进制（4 位分组，小数位右侧补 0）', () => {
  const r = conv('1101011.101', 2, 16)
  assert.equal(r.result, '6B.A')
  assert.equal(r.method, 'grouping')
})

test('十六进制转八进制（经二进制分组）', () => {
  const r = conv('3AF', 16, 8)
  assert.equal(r.result, '1657')
  assert.deepEqual(r.steps.map(s => s.kind), ['expand-bits', 'group-bits'])
})

test('二进制源不出现“展开”步骤，二进制目标不出现“分组”步骤', () => {
  assert.deepEqual(conv('1011.101', 2, 16).steps.map(s => s.kind), ['group-bits'])
  const r = conv('B.A', 16, 2)
  assert.equal(r.result, '1011.101')
  assert.deepEqual(r.steps.map(s => s.kind), ['expand-bits'])
})

test('负数与零', () => {
  assert.equal(conv('-10', 10, 2).result, '-1010')
  assert.equal(conv('-0', 10, 2).result, '0')
  assert.equal(conv('0', 2, 16).result, '0')
})

test('非法数字报错', () => {
  assert.throws(() => conv('102', 2, 10), DlogicInputError)
  assert.throws(() => conv('1.2.3', 10, 2), DlogicInputError)
  assert.throws(() => conv('10', 1, 2), DlogicInputError)
})

test('整数部分为 0 时不出现整数除法步骤，只保留小数乘法', () => {
  const r = conv('0.1', 10, 2, 4)
  assert.equal(r.result, '0.0001')
  assert.deepEqual(r.steps.map(s => s.kind), ['frac-multiplication'])
})

test('小数部分为 0 时不出现小数乘法步骤，只保留整数除法', () => {
  const r = conv('25', 10, 2)
  assert.deepEqual(r.steps.map(s => s.kind), ['int-division'])
})
