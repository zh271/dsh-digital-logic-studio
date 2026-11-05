import { test } from 'node:test'
import assert from 'node:assert/strict'
import { expandMemory, lutMap, plaFunction, romFunction } from '../src/solvers/mem.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { ExpandResult, LutSingle } from '../src/shared/mem.ts'
import { MEM_PARAMETERS, renderMem, runMem } from '../src/host/tools/mem.logic.ts'

// ───────────────────────── 存储器扩展（expand） ─────────────────────────

test('expand: 2K×8 扩展为 8K×16（字位扩展，8 片，A12A11 经 138 选片）', () => {
  const { result: r, steps } = expandMemory({ targetWords: 8192, targetBits: 16, chipWords: 2048, chipBits: 8 })
  assert.equal(r.mode, 'both')
  assert.equal(r.wordGroups, 4)
  assert.equal(r.bitGroups, 2)
  assert.equal(r.chipCount, 8)
  assert.deepEqual(r.chipAddressLines, ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'])
  assert.deepEqual(r.selectLines, ['A12', 'A11'])
  assert.ok(r.decoder !== null)
  const w = r.decoder!.wiring
  assert.equal(w.find(x => x.pin === 'A2')?.signal, 'GND')
  assert.equal(w.find(x => x.pin === 'A1')?.signal, 'A12')
  assert.equal(w.find(x => x.pin === 'A0')?.signal, 'A11')
  assert.equal(r.decoder!.outputs.length, 4)
  // 第 1 片：字组 0，数据位 D0～D7，片选接 138 的第 0 路
  assert.deepEqual(
    { index: r.chips[0].index, wg: r.chips[0].wordGroup, lo: r.chips[0].dataLow, hi: r.chips[0].dataHigh },
    { index: 1, wg: 0, lo: 0, hi: 7 },
  )
  assert.equal(r.chips[0].select, r.decoder!.outputs[0])
  assert.equal(r.chips[1].dataLow, 8)
  assert.equal(r.chips[1].dataHigh, 15)
  // 地址映射：0000H～07FFH，0800H～0FFFH，…，1800H～1FFFH
  assert.equal(r.addressMap[0].lowHex, '0000H')
  assert.equal(r.addressMap[0].highHex, '07FFH')
  assert.equal(r.addressMap[1].lowHex, '0800H')
  assert.equal(r.addressMap[3].highHex, '1FFFH')
  assert.deepEqual(r.addressMap[2].chips, [5, 6])
  assert.ok(steps.some(s => s.kind === 'address'))
})

test('expand: 1K×4 扩展为 4K×8（字位扩展，8 片，A11A10 经 138 选片）', () => {
  const { result: r } = expandMemory({ targetWords: 4096, targetBits: 8, chipWords: 1024, chipBits: 4 })
  assert.equal(r.mode, 'both')
  assert.equal(r.chipCount, 8)
  assert.deepEqual(r.selectLines, ['A11', 'A10'])
  assert.equal(r.decoder!.wiring.find(x => x.pin === 'A1')?.signal, 'A11')
  assert.equal(r.decoder!.wiring.find(x => x.pin === 'A0')?.signal, 'A10')
  assert.equal(r.addressMap[1].lowHex, '400H')
  assert.equal(r.addressMap[1].highHex, '7FFH')
  assert.equal(r.addressMap[3].highHex, 'FFFH')
  assert.deepEqual(r.addressMap[0].chips, [1, 2])
  assert.equal(r.chips[1].dataLow, 4)
  assert.equal(r.chips[1].dataHigh, 7)
})

test('expand: 仅位扩展（1K×4 → 1K×8）：地址并联、片选接地，不用译码器', () => {
  const { result: r, warnings } = expandMemory({ targetWords: 1024, targetBits: 8, chipWords: 1024, chipBits: 4 })
  assert.equal(r.mode, 'bit')
  assert.equal(r.chipCount, 2)
  assert.equal(r.decoder, null)
  assert.deepEqual(r.selectLines, [])
  assert.equal(r.chips[0].select, 'GND')
  assert.equal(r.addressMap.length, 1)
  assert.equal(r.addressMap[0].highHex, '3FFH')
  assert.equal(warnings.length, 1)
})

test('expand: 仅字扩展（2K×8 → 8K×8）：数据线并联，4 片，高位经 138 选片', () => {
  const { result: r } = expandMemory({ targetWords: 8192, targetBits: 8, chipWords: 2048, chipBits: 8 })
  assert.equal(r.mode, 'word')
  assert.equal(r.chipCount, 4)
  assert.equal(r.chips[3].dataLow, 0)
  assert.equal(r.chips[3].dataHigh, 7)
  assert.equal(r.addressMap[3].lowHex, '1800H')
})

test('expand: 双译码与单译码的译码线数（4K×8 容量）', () => {
  const dbl = expandMemory({ targetWords: 4096, targetBits: 8, chipWords: 1024, chipBits: 8, decode: 'double' }).result
  assert.ok(dbl.decode !== null)
  assert.equal(dbl.decode!.mode, 'double')
  assert.equal(dbl.decode!.rowBits, 6)
  assert.equal(dbl.decode!.colBits, 6)
  assert.equal(dbl.decode!.rows, 64)
  assert.equal(dbl.decode!.cols, 64)
  assert.equal(dbl.decode!.decoderLines, 128)
  const sgl = expandMemory({ targetWords: 4096, targetBits: 8, chipWords: 1024, chipBits: 8, decode: 'single' }).result
  assert.equal(sgl.decode!.decoderLines, 4096)
  const custom = expandMemory({
    targetWords: 4096,
    targetBits: 8,
    chipWords: 1024,
    chipBits: 8,
    decode: 'double',
    rowBits: 4,
  }).result
  assert.equal(custom.decode!.rows, 16)
  assert.equal(custom.decode!.cols, 256)
})

test('expand: 芯片扩展题未明确要求译码结构时不输出译码块（结果、步骤、文字均无）', () => {
  const { result: r, steps } = expandMemory({ targetWords: 8192, targetBits: 16, chipWords: 2048, chipBits: 8 })
  assert.equal(r.decode, null)
  assert.equal(steps.some(s => s.kind === 'decode-structure'), false)
  const text = renderMem(runMem({ op: 'expand', targetWords: 8192, targetBits: 16, chipWords: 2048, chipBits: 8 }))
  assert.doesNotMatch(text, /译码结构|译码输出线数|字线/)
  assert.match(text, /138 A2 ← GND/)
})

test('expand: 明确要求译码结构时输出译码块，文字与结果一致', () => {
  const env = runMem({ op: 'expand', targetWords: 8192, targetBits: 16, chipWords: 2048, chipBits: 8, decode: 'double' })
  const r = env.result as ExpandResult
  assert.ok(r.decode !== null)
  assert.equal(r.decode!.mode, 'double')
  const text = renderMem(env)
  assert.match(text, /双译码：高 6 位译出 64 根行线/)
})

test('expand: 非法规格与超规模给出中文原因', () => {
  assert.throws(
    () => expandMemory({ targetWords: 1024, targetBits: 8, chipWords: 2048, chipBits: 8 }),
    /大于目标字数/,
  )
  assert.throws(
    () => expandMemory({ targetWords: 16384, targetBits: 8, chipWords: 1024, chipBits: 8 }),
    /超过 8 组/,
  )
  assert.throws(() => expandMemory({ targetWords: 3000, targetBits: 8, chipWords: 1024, chipBits: 8 }), DlogicInputError)
  assert.throws(() => expandMemory({ targetWords: 1024, targetBits: 8, chipWords: 1024, chipBits: 8 }), /无需扩展/)
  const bad = runMem({ op: 'expand', targetWords: 1024, targetBits: 8, chipWords: 1024 })
  assert.equal(bad.ok, false)
})

// ───────────────────────── ROM 实现函数（rom_func） ─────────────────────────

test('rom_func: 用 ROM 实现全加器（A 为最高地址位，S 与 C 两个输出）', () => {
  const { result: r } = romFunction(['A', 'B', 'Ci'], [
    { name: 'S', minterms: [1, 2, 4, 7] },
    { name: 'C', minterms: [3, 5, 6, 7] },
  ])
  assert.equal(r.size.words, 8)
  assert.equal(r.size.bits, 2)
  assert.equal(r.size.capacity, 16)
  assert.equal(r.rows.length, 8)
  const word = (a: number) => r.rows[a].word
  // 0 + 1 + 1 = 10 (S=0, C=1)
  assert.equal(word(3), '01')
  // 1 + 1 + 1 = 11 (S=1, C=1)
  assert.equal(word(7), '11')
  assert.equal(word(0), '00')
  assert.equal(r.rows[7].hex, '3')
  assert.equal(r.rows[7].addressBits, '111')
  assert.equal(r.functions[0].text, 'S = Σm(1,2,4,7)')
})

test('rom_func: 由表达式给出输出，无关项被忽略并给出提示', () => {
  const { result: r, warnings } = romFunction(['A', 'B'], [{ name: 'X', expr: 'AB', dontCares: [0] }])
  assert.deepEqual(
    r.rows.map(x => x.word),
    ['0', '0', '0', '1'],
  )
  assert.equal(warnings.length, 1)
})

// ───────────────────────── PLA / PAL 阵列（pla / pal） ─────────────────────────

test('pla: 两个函数共用乘积项 AB，合并后 3 项（分别化简需 4 项）', () => {
  const { result: r } = plaFunction(['A', 'B', 'C'], [
    { name: 'F1', minterms: [5, 6, 7] },
    { name: 'F2', minterms: [3, 6, 7] },
  ], 'pla', 8)
  assert.equal(r.kind, 'pla')
  assert.equal(r.cost.terms, 3)
  assert.equal(r.separateTerms, 4)
  assert.equal(r.termsPerOutput, null)
  const shared = r.terms.find(t => t.mask === '11-')
  assert.ok(shared !== undefined)
  assert.deepEqual(shared!.usedBy, ['F1', 'F2'])
  assert.equal(shared!.text, 'AB')
  assert.equal(r.outputs[0].text.includes('AB'), true)
  assert.equal(r.outputs[0].text.includes('AC'), true)
  // 与阵列：3 项 × 6 列（A、A̅、B、B̅、C、C̅）；或阵列：3 项 × 2 输出
  assert.equal(r.andDots.length, 3)
  assert.equal(r.andDots[0].length, 6)
  assert.equal(r.orDots[0].length, 2)
  assert.equal(r.orDots.filter(row => row[0]).length, 2)
  assert.equal(r.orDots.filter(row => row[1]).length, 2)
})

test('pal: 每输出固定项数，超出时给出警告', () => {
  const { result: r, warnings } = plaFunction(['A', 'B', 'C'], [{ name: 'F1', minterms: [5, 6, 7] }], 'pal', 1)
  assert.equal(r.kind, 'pal')
  assert.equal(r.termsPerOutput, 1)
  assert.equal(r.outputs[0].overflow, true)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /超过每输出固定的 1 个/)
  const ok = plaFunction(['A', 'B', 'C'], [{ name: 'F1', minterms: [5, 6, 7] }], 'pal', 8)
  assert.equal(ok.result.outputs[0].overflow, false)
  assert.equal(ok.warnings.length, 0)
})

test('pla: 常数输出（恒 0、恒 1）', () => {
  const { result: r } = plaFunction(['A', 'B'], [
    { name: 'Z', minterms: [] },
    { name: 'O', minterms: [0, 1, 2, 3] },
  ], 'pla', 8)
  assert.equal(r.outputs[0].text, '0')
  assert.equal(r.outputs[1].text, '1')
  assert.equal(r.cost.terms, 1)
})

// ───────────────────────── LUT 掩码（lut） ─────────────────────────

test('lut: 4 变量 Σm(0,5,10,15) 的掩码为 0x8421', () => {
  const { result } = lutMap({ variables: ['A', 'B', 'C', 'D'], minterms: [0, 5, 10, 15] })
  assert.equal(result.kind, 'single')
  const r = result as LutSingle
  assert.equal(r.hex, '8421')
  assert.equal(r.mask, '1000010000100001')
  assert.equal(r.pins[0].pin, 'I3')
  assert.equal(r.pins[0].signal, 'A')
  assert.equal(r.pins[3].signal, 'D')
  assert.equal(r.rows.length, 16)
  assert.equal(r.rows[5].value, 1)
})

test('lut: 2 变量异或的掩码按周期重复，为 0x6666', () => {
  const { result } = lutMap({ variables: ['A', 'B'], minterms: [1, 2] })
  const r = result as LutSingle
  assert.equal(r.hex, '6666')
  assert.equal(r.mask, '0110011001100110')
  assert.equal(r.pins[0].signal, 'GND')
  assert.equal(r.pins[2].signal, 'A')
  assert.equal(r.pins[3].signal, 'B')
})

test('lut: 由表达式给出，变量由表达式推定（A⊕B 同 0x6666）', () => {
  const { result } = lutMap({ expr: 'A⊕B' })
  assert.equal((result as LutSingle).hex, '6666')
})

test('lut: 5 变量超出 LUT4，按最高变量香农展开为两个子函数', () => {
  const { result, warnings } = lutMap({ variables: ['A', 'B', 'C', 'D', 'E'], minterms: [0, 17, 31] })
  assert.equal(result.kind, 'split')
  if (result.kind !== 'split') return
  assert.deepEqual(result.splitVars, ['A'])
  assert.deepEqual(result.lutVars, ['B', 'C', 'D', 'E'])
  assert.equal(result.cofactors.length, 2)
  assert.equal(result.cofactors[0].assignment, 'A=0')
  assert.equal(result.cofactors[0].hex, '0001')
  assert.equal(result.cofactors[1].assignment, 'A=1')
  assert.equal(result.cofactors[1].hex, '8002')
  assert.equal(warnings.length, 1)
})

test('lut: 7 变量等超出规模的情况返回 ok 为 false', () => {
  const res = runMem({ op: 'lut', variables: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], minterms: [0] })
  assert.equal(res.ok, false)
  assert.match(res.error ?? '', /最多支持 6 个变量/)
})

// ───────────────────────── 宿主信封与文本 ─────────────────────────

test('runMem: 各 op 返回信封，文本不含提示语', () => {
  const ex = runMem({ op: 'expand', targetWords: 8192, targetBits: 16, chipWords: 2048, chipBits: 8, decode: 'double' })
  assert.equal(ex.ok, true)
  assert.equal(ex.op, 'expand')
  const rom = runMem({ op: 'rom_func', variables: ['A', 'B'], outputs: [{ minterms: [1, 2] }] })
  assert.equal(rom.ok, true)
  const pla = runMem({ op: 'pla', variables: ['A', 'B'], outputs: [{ name: 'X', expr: 'A⊕B' }] })
  assert.equal(pla.ok, true)
  const pal = runMem({ op: 'pal', variables: ['A', 'B'], outputs: [{ name: 'X', expr: 'A⊕B' }], termsPerOutput: 2 })
  assert.equal(pal.ok, true)
  const lut = runMem({ op: 'lut', expr: "A'B + AB'" })
  assert.equal(lut.ok, true)
  for (const v of [ex, rom, pla, pal, lut]) {
    const text = renderMem(v)
    assert.ok(text.length > 0)
    assert.doesNotMatch(text, /工具|核对|引擎/)
  }
  assert.match(renderMem(ex), /字组 0/)
  assert.match(renderMem(pla), /X = /)
  assert.match(renderMem(lut), /掩码（高位在前）：0110011001100110/)
})

test('runMem: 未知 op 与缺少函数时 ok 为 false', () => {
  assert.equal(runMem({ op: 'simulate' as never }).ok, false)
  const noFunc = runMem({ op: 'lut', variables: ['A'] })
  assert.equal(noFunc.ok, false)
  assert.match(noFunc.error ?? '', /缺少函数/)
})

test('参数定义包含五个 op', () => {
  assert.deepEqual(MEM_PARAMETERS.op.enum, ['expand', 'rom_func', 'pla', 'pal', 'lut'])
})
