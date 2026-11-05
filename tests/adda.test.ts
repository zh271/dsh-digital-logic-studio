import { test } from 'node:test'
import assert from 'node:assert/strict'
import { solveDac, solveSar, solveFlash, solveDual, solveQuantize, FLASH_LIST_LIMIT } from '../src/solvers/adda.ts'
import { fmtNum, fmtTime } from '../src/shared/adda.ts'
import type { DacResult, FlashResult, DualSlopeResult, QuantizeResult, SarResult } from '../src/shared/adda.ts'
import { runAdda, renderAdda, ADDA_PARAMETERS } from '../src/host/tools/adda.logic.ts'

// ───────────────────────── D/A ─────────────────────────

test('dac: 8 位 T 型 DAC，输入 10110101（D = 181），VREF = 5 V，Vo = VREF·D/2^8 = 905/256 V', () => {
  const r = solveDac({ bits: 8, vref: 5, binary: '10110101', dacType: 'r2r_t' }).result as DacResult
  assert.equal(r.code, 181)
  assert.equal(r.codeBinary, '10110101')
  assert.ok(Math.abs(r.vout - 905 / 256) < 1e-12)
  assert.equal(r.fraction, '181/256')
  assert.equal(r.inverting, false)
  assert.equal(r.rfRatio, null)
  assert.equal(r.branches, null)
  assert.ok(Math.abs(r.lsb - 5 / 256) < 1e-12)
  assert.ok(Math.abs(r.fullScale - (5 * 255) / 256) < 1e-12)
  assert.equal(fmtNum(r.vout), '3.535156')
})

test('dac: 倒 T 型，Rf = R 时 Vo = -VREF·D/2^n（反相输出为负）', () => {
  const r = solveDac({ bits: 8, vref: 5, binary: '10110101', dacType: 'r2r_inverted' }).result as DacResult
  assert.ok(Math.abs(r.vout + 905 / 256) < 1e-12)
  assert.equal(r.inverting, true)
  assert.equal(r.rfRatio, 1)
  assert.match(r.formula, /-\(Rf\/R\)/)
  assert.equal(r.fraction, '181/256')
})

test('dac: 权电阻型默认 Rf = R/2（标准比例），Vo = -VREF·D/2^n；支路 MSB 为 R，LSB 为 128R', () => {
  const r = solveDac({ bits: 8, vref: 5, code: 181, dacType: 'weighted' }).result as DacResult
  assert.ok(Math.abs(r.vout + 905 / 256) < 1e-12)
  assert.equal(r.rfRatio, 0.5)
  assert.equal(r.fraction, '181/128')
  assert.ok(r.branches)
  assert.equal(r.branches.length, 8)
  assert.deepEqual(r.branches[0], { bit: 7, value: 1, resistor: 'R' })
  assert.deepEqual(r.branches[7], { bit: 0, value: 1, resistor: '128R' })
  assert.equal(r.branches[1].value, 0)
})

test('dac: 权电阻型 Rf/R = 1 时输出按比例放大为两倍', () => {
  const r = solveDac({ bits: 8, vref: 5, code: 181, dacType: 'weighted', rfRatio: 1 }).result as DacResult
  assert.ok(Math.abs(r.vout + (2 * 905) / 256) < 1e-12)
  assert.ok(Math.abs(r.lsb - 2 * (5 / 256)) < 1e-12)
})

test('dac: code 与 binary 等价；满量程与 1LSB 的关系', () => {
  const a = solveDac({ bits: 4, vref: 8, code: 9, dacType: 'r2r_t' }).result as DacResult
  const b = solveDac({ bits: 4, vref: 8, binary: '1001', dacType: 'r2r_t' }).result as DacResult
  assert.deepEqual(a.vout, b.vout)
  assert.ok(Math.abs(a.vout - 4.5) < 1e-12)
  const max = solveDac({ bits: 4, vref: 8, code: 15, dacType: 'r2r_t' }).result as DacResult
  assert.ok(Math.abs(max.fullScale - 8 * 15 / 16) < 1e-12)
  assert.ok(Math.abs(max.lsb * 15 - max.fullScale) < 1e-12)
})

test('dac: 输入错误返回中文原因', () => {
  assert.throws(() => solveDac({ bits: 4, vref: 8, binary: '101', dacType: 'r2r_t' }), /须等于位数 4/)
  assert.throws(() => solveDac({ bits: 4, vref: 8, code: 16, dacType: 'r2r_t' }), /须为 0～15/)
  assert.throws(() => solveDac({ bits: 4, vref: 8, dacType: 'r2r_t' }), /需要提供 code/)
  assert.throws(() => solveDac({ bits: 17, vref: 8, code: 1, dacType: 'r2r_t' }), /1～16/)
  const bad = runAdda({ op: 'dac', bits: 4, vref: 8, code: 3 })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /dacType/)
})

// ───────────────────────── 逐次逼近 ADC ─────────────────────────

test('adc_sar: 3 位，VREF = 8 V，Vin = 5.3 V 的过程表：100 → 110 → 101，结果 101', () => {
  const r = solveSar({ bits: 3, vref: 8, vin: 5.3 }).result as SarResult
  assert.deepEqual(
    r.steps.map(s => s.trialBinary),
    ['100', '110', '101'],
  )
  assert.deepEqual(
    r.steps.map(s => s.dacVoltage),
    [4, 6, 5],
  )
  assert.deepEqual(
    r.steps.map(s => s.geq),
    [true, false, true],
  )
  assert.deepEqual(
    r.steps.map(s => s.kept),
    [1, 0, 1],
  )
  assert.deepEqual(
    r.steps.map(s => s.partialBinary),
    ['100', '100', '101'],
  )
  assert.equal(r.codeBinary, '101')
  assert.equal(r.code, 5)
  assert.equal(r.delta, 1)
  assert.ok(Math.abs(r.error - 0.3) < 1e-9)
  assert.deepEqual(r.errorRange, [0, 1])
})

test('adc_sar: 与 floor(Vin/Δ) 一致（扫描 1～8 位与多个输入）', () => {
  for (let n = 1; n <= 8; n++) {
    for (let i = 0; i < 97; i++) {
      const vref = 7
      const vin = (i * vref) / 97 + 0.0123
      const r = solveSar({ bits: n, vref, vin }).result as SarResult
      const expect = Math.min(Math.floor((vin * 2 ** n) / vref + 1e-12), 2 ** n - 1)
      assert.equal(r.code, expect, `n=${n} vin=${vin}`)
    }
  }
})

test('adc_sar: 输入超出量程返回中文原因', () => {
  const bad = runAdda({ op: 'adc_sar', bits: 3, vref: 8, vin: 9 })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /超出量程/)
  const big = runAdda({ op: 'adc_sar', bits: 17, vref: 8, vin: 1 })
  assert.equal(big.ok, false)
})

// ───────────────────────── 并行比较 ADC ─────────────────────────

test('adc_flash: 3 位舍尾法，VREF = 8 V：7 个比较器参考 1～7 V，Vin = 5.3 V 输出温度计码 0011111，编码 101', () => {
  const r = solveFlash({ bits: 3, vref: 8, vin: 5.3, mode: 'truncate' }).result as FlashResult
  assert.equal(r.comparatorCount, 7)
  assert.equal(r.comparators.length, 7)
  assert.deepEqual(
    r.comparators.map(c => c.ref),
    [1, 2, 3, 4, 5, 6, 7],
  )
  assert.deepEqual(
    r.comparators.map(c => c.output),
    [1, 1, 1, 1, 1, 0, 0],
  )
  assert.equal(r.thermometer, '0011111')
  assert.equal(r.codeBinary, '101')
  assert.equal(r.code, 5)
  assert.equal(r.delta, 1)
  assert.ok(Math.abs(r.error - 0.3) < 1e-9)
})

test('adc_flash: 3 位四舍五入法，Δ = 2VREF/15，参考电压为 (2k-1)VREF/15', () => {
  const r = solveFlash({ bits: 3, vref: 8, vin: 5.3, mode: 'round' }).result as FlashResult
  assert.ok(Math.abs(r.delta - 16 / 15) < 1e-12)
  assert.ok(Math.abs(r.comparators[0].ref - 8 / 15) < 1e-12)
  assert.ok(Math.abs(r.comparators[6].ref - (13 * 8) / 15) < 1e-12)
  assert.equal(r.code, 5)
  assert.equal(r.codeBinary, '101')
  assert.ok(Math.abs(r.error - (5.3 - (5 * 16) / 15)) < 1e-9)
  assert.deepEqual(r.errorRange, [-8 / 15, 8 / 15])
})

test('adc_flash: 位数较多时不逐个列出比较器，仍给出数字码', () => {
  const r = solveFlash({ bits: 16, vref: 8, vin: 4, mode: 'truncate' }).result as FlashResult
  assert.equal(r.comparatorCount, 65535)
  assert.ok(65535 > FLASH_LIST_LIMIT)
  assert.deepEqual(r.comparators, [])
  assert.equal(r.thermometer, null)
  assert.equal(r.codeBinary, '1000000000000000')
  assert.equal(r.code, 32768)
})

// ───────────────────────── 双积分 ADC ─────────────────────────

test('adc_dual: T1 = 20 ms（1 MHz 时钟，N1 = 20000），VREF = 5 V，Vin = 2 V：T2 = 8 ms，N2 = 8000，Tmax = 40 ms', () => {
  const { result: r, warnings } = solveDual({ t1: 0.02, clockHz: 1e6, vref: 5, vin: 2, vfs: 5 })
  assert.equal(r.n1, 20000)
  assert.ok(Math.abs(r.t2 - 0.008) < 1e-12)
  assert.equal(r.n2, 8000)
  assert.ok(Math.abs(r.t2Max - 0.02) < 1e-12)
  assert.ok(Math.abs(r.convMax - 0.04) < 1e-12)
  assert.ok(Math.abs(r.resolution - 0.00025) < 1e-12)
  assert.equal(r.mainsMultiple, true)
  assert.deepEqual(warnings, [])
  assert.equal(fmtTime(r.t2), '8 ms')
})

test('adc_dual: T1 不是工频周期整数倍时给出注意事项', () => {
  const { result: r, warnings } = solveDual({ t1: 0.025, clockHz: 1e6, vref: 5, vin: 2 })
  assert.equal(r.mainsMultiple, false)
  assert.ok(warnings.some(w => /不是工频周期/.test(w)))
})

test('adc_dual: 输入超出 Vfs 返回中文原因', () => {
  const bad = runAdda({ op: 'adc_dual', t1: 0.02, clockHz: 1e6, vref: 5, vin: 6, vfs: 5 })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /0～Vfs/)
})

// ───────────────────────── 量化与采样 ─────────────────────────

test('quantize: 3 位舍尾法，FS = 8 V，Vin = 5.3 V：Δ = 1 V，码 101，误差 0.3 V，范围 [0, Δ)', () => {
  const r = solveQuantize({ bits: 3, fullScale: 8, vin: 5.3, mode: 'truncate' }).result as QuantizeResult
  assert.equal(r.delta, 1)
  assert.equal(r.levels, 8)
  assert.equal(r.codeBinary, '101')
  assert.ok(Math.abs((r.error ?? 0) - 0.3) < 1e-9)
  assert.deepEqual(r.errorRange, [0, 1])
  assert.equal(r.maxAbsError, 1)
})

test('quantize: 3 位四舍五入法，Δ = 16/15 V，码 101，误差 -1/30 V', () => {
  const r = solveQuantize({ bits: 3, fullScale: 8, vin: 5.3, mode: 'round' }).result as QuantizeResult
  assert.ok(Math.abs(r.delta - 16 / 15) < 1e-12)
  assert.equal(r.codeBinary, '101')
  assert.ok(Math.abs((r.error ?? 0) - -1 / 30) < 1e-9)
  assert.ok(Math.abs(r.maxAbsError - 8 / 15) < 1e-12)
})

test('quantize: 误差要求反求最少位数（舍尾 8 位，四舍五入 7 位）', () => {
  const trunc = solveQuantize({ bits: 4, fullScale: 8, maxError: 0.05, mode: 'truncate' }).result as QuantizeResult
  assert.deepEqual(trunc.minBits, { maxError: 0.05, bits: 8, delta: 8 / 256 })
  const round = solveQuantize({ bits: 4, fullScale: 8, maxError: 0.05, mode: 'round' }).result as QuantizeResult
  assert.equal(round.minBits?.bits, 7)
})

test('quantize: 误差要求过严时 16 位以内无法满足，给出注意事项', () => {
  const { result, warnings } = solveQuantize({ bits: 4, fullScale: 1, maxError: 1e-9 })
  assert.equal(result.minBits?.bits, null)
  assert.ok(warnings.some(w => /无法满足/.test(w)))
})

test('quantize: 采样定理判断（欠采样给出混叠频率，fs = 2fmax 满足）', () => {
  const under = solveQuantize({ bits: 4, fullScale: 8, fmax: 4000, fs: 7000 }).result as QuantizeResult
  assert.equal(under.sampling?.minFs, 8000)
  assert.equal(under.sampling?.ok, false)
  assert.equal(under.sampling?.aliasFreq, 3000)
  const ok = solveQuantize({ bits: 4, fullScale: 8, fmax: 4000, fs: 8000 }).result as QuantizeResult
  assert.equal(ok.sampling?.ok, true)
  const none = solveQuantize({ bits: 4, fullScale: 8, fmax: 4000 }).result as QuantizeResult
  assert.equal(none.sampling?.ok, null)
  assert.equal(none.sampling?.minFs, 8000)
})

// ───────────────────────── 入口与渲染 ─────────────────────────

test('入口: op 枚举、位数限制与 fullScale 回退到 vref', () => {
  assert.deepEqual(ADDA_PARAMETERS.op.enum, ['dac', 'adc_sar', 'adc_flash', 'adc_dual', 'quantize'])
  const env = runAdda({ op: 'quantize', bits: 3, vref: 8, vin: 5.3 })
  assert.equal(env.ok, true)
  assert.equal((env.result as QuantizeResult).fullScale, 8)
  const bad = runAdda({ op: 'quantize', bits: 0, fullScale: 8 })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /1～16/)
})

test('渲染: 结果文字为中文，不含提示语，包含公式与数值', () => {
  const env = runAdda({ op: 'dac', bits: 8, vref: 5, binary: '10110101', dacType: 'r2r_t' })
  const text = renderAdda(env)
  assert.match(text, /Vo = 5 × 181 \/ 256 = 3\.535156 V/)
  assert.match(text, /1LSB = VREF\/2\^8 = 0\.019531 V/)
  for (const bad of ['工具', '核对', '引擎']) assert.ok(!text.includes(bad), bad)
  const sar = renderAdda(runAdda({ op: 'adc_sar', bits: 3, vref: 8, vin: 5.3 }))
  assert.match(sar, /第 2 次：试探 110/)
  const dual = renderAdda(runAdda({ op: 'adc_dual', t1: 0.025, clockHz: 1e6, vref: 5, vin: 2 }))
  assert.match(dual, /注意：T1 不是工频周期/)
})
