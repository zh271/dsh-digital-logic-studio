import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canvasSize, PAN_SLACK_RATIO } from '../src/client/tree/pan.ts'

test('canvasSize 宽布局：宽高都在内容加留白之上加 60% 面板尺寸的余量', () => {
  assert.equal(PAN_SLACK_RATIO, 0.6)
  // 内容 500x300，留白 16，面板 1000x600：宽 500+32+600，高 300+32+360
  assert.deepEqual(canvasSize(500, 300, 16, 16, 1000, 600, false), { width: 1132, height: 692 })
})

test('canvasSize 宽布局：面板比内容还小时仍有余量（可拖动）', () => {
  // 面板 300x200，内容 900x800：余量 180 / 120
  assert.deepEqual(canvasSize(900, 800, 16, 16, 300, 200, false), { width: 900 + 32 + 180, height: 800 + 32 + 120 })
})

test('canvasSize 大纲式布局：不加宽度余量，纵向余量照常', () => {
  assert.deepEqual(canvasSize(264, 1000, 8, 16, 280, 500, true), { width: 264 + 16, height: 1000 + 32 + 300 })
})

test('canvasSize 未测量（面板尺寸为 0）时只保留留白', () => {
  assert.deepEqual(canvasSize(500, 300, 16, 16, 0, 0, false), { width: 532, height: 332 })
})

test('canvasSize 非法面板尺寸按 0 处理', () => {
  assert.deepEqual(canvasSize(100, 100, 16, 16, -50, Number.NaN, false), { width: 132, height: 132 })
  assert.deepEqual(canvasSize(100, 100, 16, 16, Number.POSITIVE_INFINITY, -1, true), { width: 132, height: 132 })
})

test('canvasSize 余量取整为整数像素', () => {
  const s = canvasSize(0, 0, 0, 0, 333, 101, false)
  assert.equal(Number.isInteger(s.width), true)
  assert.equal(Number.isInteger(s.height), true)
  assert.deepEqual(s, { width: 200, height: 61 })
})

test('canvasSize 余量随面板变大而增大，内容尺寸不变', () => {
  const small = canvasSize(400, 400, 16, 16, 500, 300, false)
  const big = canvasSize(400, 400, 16, 16, 1500, 900, false)
  assert.ok(big.width > small.width)
  assert.ok(big.height > small.height)
  assert.equal(big.width - small.width, 600)
  assert.equal(big.height - small.height, 360)
})
