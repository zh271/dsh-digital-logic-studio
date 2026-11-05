import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeNetlist, analyzeSteps, bcdCorrection, CHIP_PINS, mapMsi, type MsiRequest } from '../src/solvers/comb.ts'
import { equivalent, specFromExpr } from '../src/solvers/bool.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { DataValue, GateSpec, MsiResult, MuxMapping, DecoderMapping, AdderMapping, ParityMapping, ComparatorMapping } from '../src/shared/comb.ts'
import { runComb, renderComb, COMB_PARAMETERS } from '../src/host/tools/comb.logic.ts'

// ───────────────────────── 辅助 ─────────────────────────

/** 由 A、B、C… 的取值得到函数值（按 minterms 集合）。 */
function fOf(vars: string[], minterms: number[], assign: Record<string, 0 | 1>): 0 | 1 {
  const n = vars.length
  let idx = 0
  for (let p = 0; p < n; p++) idx = idx * 2 + assign[vars[p]]
  return minterms.includes(idx) ? 1 : 0
}

function assignments(vars: string[]): Record<string, 0 | 1>[] {
  const out: Record<string, 0 | 1>[] = []
  for (let m = 0; m < 1 << vars.length; m++) {
    const a: Record<string, 0 | 1> = {}
    vars.forEach((v, p) => {
      a[v] = ((m >> (vars.length - 1 - p)) & 1) as 0 | 1
    })
    out.push(a)
  }
  return out
}

/** 数据端取值在给定变量取值下的电平。 */
function dataLevel(d: DataValue, a: Record<string, 0 | 1>): 0 | 1 {
  if (d.kind === 'const') return d.value
  if (d.kind === 'literal') return (d.neg ? 1 - a[d.name] : a[d.name]) as 0 | 1
  throw new Error('表达式型数据端需要单独计算')
}

function msi(req: MsiRequest): MsiResult {
  return mapMsi(req).result
}

function wireOf(stageIdx: number, r: MsiResult, pin: string): string | undefined {
  return r.stages[stageIdx]?.wiring.find(w => w.pin === pin)?.signal
}

const MAJ_GATES: GateSpec[] = [
  { out: 'n1', type: 'NAND', in: ['A', 'B'] },
  { out: 'n2', type: 'NAND', in: ['B', 'C'] },
  { out: 'n3', type: 'NAND', in: ['A', 'C'] },
  { out: 'Y', type: 'NAND', in: ['n1', 'n2', 'n3'] },
]

// ───────────────────────── analyze：门级网表 ─────────────────────────

test('analyze: 三与非门多数表决（教材例）逐级推导与真值表', () => {
  const r = analyzeNetlist({ inputs: ['A', 'B', 'C'], gates: MAJ_GATES })
  assert.deepEqual(r.outputs, ['Y'])
  assert.equal(r.depth, 2)
  const byOut = Object.fromEntries(r.gates.map(g => [g.out, g]))
  assert.equal(byOut.n1.level, 1)
  assert.equal(byOut.Y.level, 2)
  assert.equal(byOut.n1.expr, "(AB)'")
  assert.equal(byOut.Y.local, "(n1·n2·n3)'")
  assert.equal(byOut.Y.expr, "((AB)'(BC)'(AC)')'")
  const f = r.finalExprs[0]
  assert.equal(f.name, 'Y')
  assert.equal(equivalent(specFromExpr(f.simplified), specFromExpr('AB + BC + AC')).equivalent, true)
  // 真值表：三个输入中至少两个为 1 时输出 1
  assert.equal(r.truthTable.rows.length, 8)
  for (const row of r.truthTable.rows) {
    const ones = row.inputs.reduce<number>((s, x) => s + x, 0)
    assert.equal(row.outputs[0], ones >= 2 ? 1 : 0)
  }
})

test('analyze: 半加器（XOR / AND）多输出，默认输出取未被使用的门输出', () => {
  const r = analyzeNetlist({
    inputs: ['A', 'B'],
    gates: [
      { out: 'S', type: 'XOR', in: ['A', 'B'] },
      { out: 'C', type: 'AND', in: ['A', 'B'] },
    ],
  })
  assert.deepEqual(r.outputs, ['S', 'C'])
  assert.equal(r.gates.find(g => g.out === 'S')?.expr, 'A⊕B')
  assert.equal(r.finalExprs[0].simplified, "A'B + AB'")
  assert.equal(r.finalExprs[1].simplified, 'AB')
  assert.deepEqual(
    r.truthTable.rows.map(x => x.outputs),
    [
      [0, 0],
      [1, 0],
      [1, 0],
      [0, 1],
    ],
  )
})

test('analyze: 非门与同或门，显式给出 outputs', () => {
  const r = analyzeNetlist({
    inputs: ['A', 'B'],
    gates: [
      { out: 'N', type: 'NOT', in: ['A'] },
      { out: 'E', type: 'XNOR', in: ['N', 'B'] },
    ],
    outputs: ['E'],
  })
  assert.deepEqual(r.outputs, ['E'])
  assert.equal(r.gates[0].expr, "A'")
  // 同或：E = (A' ⊙ B) = (A ⊕ B)
  assert.equal(equivalent(specFromExpr(r.finalExprs[0].simplified), specFromExpr("A⊕B")).equivalent, true)
})

test('analyze: 逐级步骤与门数一致', () => {
  const r = analyzeNetlist({ inputs: ['A', 'B', 'C'], gates: MAJ_GATES })
  const steps = analyzeSteps(r)
  assert.equal(steps.filter(s => s.kind === 'gate').length, MAJ_GATES.length)
  assert.ok(steps.some(s => s.kind === 'output'))
  assert.ok(steps.some(s => s.kind === 'truth'))
})

test('analyze: 反馈回路、未定义信号、非门输入数、输入过多、门过多均报错', () => {
  assert.throws(
    () =>
      analyzeNetlist({
        inputs: ['A'],
        gates: [
          { out: 'X', type: 'AND', in: ['A', 'Y'] },
          { out: 'Y', type: 'OR', in: ['X', 'A'] },
        ],
      }),
    /反馈回路/,
  )
  assert.throws(() => analyzeNetlist({ inputs: ['A'], gates: [{ out: 'X', type: 'AND', in: ['A', 'Q'] }] }), /未定义/)
  assert.throws(() => analyzeNetlist({ inputs: ['A', 'B'], gates: [{ out: 'X', type: 'NOT', in: ['A', 'B'] }] }), /非门/)
  assert.throws(
    () => analyzeNetlist({ inputs: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], gates: [{ out: 'X', type: 'AND', in: ['A', 'B'] }] }),
    /最多支持 6 个输入/,
  )
  const many: GateSpec[] = Array.from({ length: 21 }, (_, i) => ({ out: `g${i}`, type: 'NOT' as const, in: ['A'] }))
  assert.throws(() => analyzeNetlist({ inputs: ['A'], gates: many }), /最多支持 20 个门/)
  assert.throws(
    () => analyzeNetlist({ inputs: ['A', 'B'], gates: [{ out: 'A', type: 'AND', in: ['A', 'B'] }] }),
    /重复定义/,
  )
})

test('analyze: 通过 runComb 返回信封，错误转为 ok: false', () => {
  const ok = runComb({ op: 'analyze', inputs: ['A', 'B', 'C'], gates: MAJ_GATES })
  assert.equal(ok.ok, true)
  assert.equal(ok.op, 'analyze')
  assert.ok(ok.steps.length > 0)
  const bad = runComb({ op: 'analyze', inputs: ['A'], gates: [{ out: 'X', type: 'AND', in: ['A', 'Z'] }] })
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /未定义/)
  const text = renderComb(ok)
  assert.match(text, /输出 Y = /)
})

// ───────────────────────── map_msi：74LS138 ─────────────────────────

test('138 引脚别名：地址脚不设别名（与本题变量接线冲突），仅保留使能别名', () => {
  const pins = CHIP_PINS['138']
  const byName = (n: string) => pins.find(p => p.name === n)
  // 地址脚的变量由接线决定（如 A2=A、A0=C），静态别名会与之矛盾，故删除。
  assert.deepEqual(byName('A2')?.aliases, [])
  assert.deepEqual(byName('A1')?.aliases, [])
  assert.deepEqual(byName('A0')?.aliases, [])
  assert.deepEqual(byName('S1')?.aliases, ['E1'])
  // 接线表与别名不冲突：A2 接 A、A0 接 C（A2 为最高位）。
  const r = msi({ chip: '138', variables: ['A', 'B', 'C'], minterms: [1, 2, 4, 7] })
  assert.equal(wireOf(0, r, 'A2'), 'A')
  assert.equal(wireOf(0, r, 'A0'), 'C')
})

test('138: F = Σm(1,2,4,7) 用与非门汇总低有效输出（教材例）', () => {
  const r = msi({ chip: '138', variables: ['A', 'B', 'C'], minterms: [1, 2, 4, 7] })
  assert.equal(r.chip, '138')
  const m = r.mapping as DecoderMapping
  assert.equal(m.kind, 'decoder')
  assert.equal(m.nandText, "(m1'm2'm4'm7')'")
  assert.equal(wireOf(0, r, 'A2'), 'A')
  assert.equal(wireOf(0, r, 'A1'), 'B')
  assert.equal(wireOf(0, r, 'A0'), 'C')
  assert.equal(wireOf(0, r, 'S1'), 'VCC')
  assert.equal(wireOf(0, r, 'S̄2'), 'GND')
  assert.equal(wireOf(0, r, 'S̄3'), 'GND')
  const nandInputs = r.stages[1].wiring.filter(w => w.pin.startsWith('输入')).map(w => w.signal)
  assert.deepEqual(nandInputs, ['Y̅1', 'Y̅2', 'Y̅4', 'Y̅7'])
})

test('138: 按接线表模拟芯片，与非门输出等于原函数（全部 8 组取值）', () => {
  const vars = ['A', 'B', 'C']
  const minterms = [1, 2, 4, 7]
  const r = msi({ chip: '138', variables: vars, minterms })
  const nandSignals = r.stages[1].wiring.filter(w => w.pin.startsWith('输入')).map(w => w.signal)
  const listed = nandSignals.map(s => Number(s.match(/\d+/)?.[0]))
  for (const a of assignments(vars)) {
    const idx = (a.A << 2) | (a.B << 1) | a.C
    // 译码器低有效输出：只有被选中的那一路为 0
    const yBar = (k: number): 0 | 1 => (k === idx ? 0 : 1)
    const f = listed.every(k => yBar(k) === 1) ? 0 : 1
    assert.equal(f, fOf(vars, minterms, a))
  }
})

test('139: 两变量函数 F = A\'B + AB\' 用 1 路译码器', () => {
  const r = msi({ chip: '139', variables: ['A', 'B'], minterms: [1, 2] })
  assert.equal(wireOf(0, r, '1B'), 'A')
  assert.equal(wireOf(0, r, '1A'), 'B')
  assert.equal(wireOf(0, r, '1S̄'), 'GND')
  const nandInputs = r.stages[1].wiring.filter(w => w.pin.startsWith('输入')).map(w => w.signal)
  assert.deepEqual(nandInputs, ['1Y̅1', '1Y̅2'])
})

test('138: 4 变量函数超出芯片规模，给出说明', () => {
  assert.throws(() => mapMsi({ chip: '138', variables: ['A', 'B', 'C', 'D'], minterms: [1] }), /只能直接实现 3 个变量/)
  const res = runComb({ op: 'map_msi', chip: '138', variables: ['A', 'B', 'C', 'D'], minterms: [1] })
  assert.equal(res.ok, false)
})

test('138: 由 expr 输入，恒为 0 时无需接线', () => {
  const r = msi({ chip: '138', expr: "A'B'C + ABC" })
  const m = r.mapping as DecoderMapping
  assert.deepEqual(m.minterms, [1, 7])
  const zero = msi({ chip: '138', variables: ['A'], minterms: [] })
  assert.equal((zero.mapping as DecoderMapping).constant, 0)
})

// ───────────────────────── map_msi：74LS151 / 153 降维 ─────────────────────────

test('151: 4 变量函数降维（选择端 B C D，数据端取 A 的函数）', () => {
  // F(A,B,C,D) = Σm(0,1,3,4,8,9,15)
  const minterms = [0, 1, 3, 4, 8, 9, 15]
  const r = msi({ chip: '151', variables: ['A', 'B', 'C', 'D'], minterms })
  const m = r.mapping as MuxMapping
  assert.deepEqual(m.selectVars, ['B', 'C', 'D'])
  assert.deepEqual(m.highVars, ['A'])
  const texts = m.rows.map(row => row.data.kind === 'expr' ? 'EXPR' : row.data.kind === 'const' ? String(row.data.value) : row.data.text)
  assert.deepEqual(texts, ['1', '1', '0', "A'", "A'", '0', '0', 'A'])
  assert.equal(wireOf(0, r, 'A2'), 'B')
  assert.equal(wireOf(0, r, 'A1'), 'C')
  assert.equal(wireOf(0, r, 'A0'), 'D')
  assert.equal(wireOf(0, r, 'S̄'), 'GND')
  // 按数据端取值模拟 151，与原函数逐一比对
  const vars = ['A', 'B', 'C', 'D']
  for (const a of assignments(vars)) {
    const sel = (a.B << 2) | (a.C << 1) | a.D
    const y = dataLevel(m.rows[sel].data, a)
    assert.equal(y, fOf(vars, minterms, a))
  }
})

test('151: 3 变量函数，数据端全为常数（奇偶函数）', () => {
  const r = msi({ chip: '151', variables: ['A', 'B', 'C'], minterms: [1, 2, 4, 7] })
  const m = r.mapping as MuxMapping
  assert.deepEqual(m.highVars, [])
  assert.deepEqual(
    m.rows.map(row => (row.data.kind === 'const' ? row.data.value : -1)),
    [0, 1, 1, 0, 1, 0, 0, 1],
  )
})

test('153: 3 变量函数，选择端 B C，数据端为 A 的函数（全加和）', () => {
  const r = msi({ chip: '153', variables: ['A', 'B', 'C'], minterms: [1, 2, 4, 7] })
  const m = r.mapping as MuxMapping
  assert.deepEqual(m.selectVars, ['B', 'C'])
  assert.deepEqual(
    m.rows.map(row => (row.data.kind === 'literal' ? row.data.text : String(row.data.kind === 'const' ? row.data.value : 'EXPR'))),
    ['A', "A'", "A'", 'A'],
  )
  assert.equal(wireOf(0, r, 'B'), 'B')
  assert.equal(wireOf(0, r, 'A'), 'C')
  assert.equal(wireOf(0, r, '1S̄'), 'GND')
})

test('151: 无关项参与降维，X 与 1 组合时取常数 1', () => {
  // F(A,B,C,D) = Σm(1,11) + Σd(3)；D3 的两个取值为 X 与 1
  const r = msi({ chip: '151', variables: ['A', 'B', 'C', 'D'], minterms: [1, 11], dontCares: [3] })
  const m = r.mapping as MuxMapping
  assert.equal(m.rows[3].data.kind, 'const')
  assert.equal((m.rows[3].data as { value: number }).value, 1)
  assert.equal(m.rows[1].data.kind, 'literal')
  assert.equal((m.rows[1].data as { text: string }).text, "A'")
  assert.ok(r.stages[0].wiring.length > 0)
})

test('151: 给定选择变量时使用指定顺序', () => {
  const r = msi({ chip: '151', variables: ['A', 'B', 'C'], minterms: [1, 2, 4, 7], selectVars: ['A', 'C'] })
  const m = r.mapping as MuxMapping
  assert.deepEqual(m.selectVars, ['A', 'C'])
  assert.deepEqual(m.highVars, ['B'])
  // 选择码只有 2 位，高位地址 A0 之上接地，只用前 4 个数据端
  assert.equal(wireOf(0, r, 'A2'), 'GND')
  assert.equal(m.rows.length, 4)
})

// ───────────────────────── map_msi：74LS283 加法器 ─────────────────────────

test('283: 4 位加法接线与进位引脚，BCD 修正给出两片接线', () => {
  const plain = msi({ chip: '283' })
  assert.equal(plain.stages.length, 1)
  assert.equal(wireOf(0, plain, 'C0'), 'Cin')
  const bcd = msi({ chip: '283', bcd: true })
  assert.equal(bcd.stages.length, 2)
  assert.equal(wireOf(1, bcd, 'B2'), 'K')
  assert.equal(wireOf(1, bcd, 'B3'), 'K')
  assert.equal(wireOf(1, bcd, 'B1'), 'GND')
  const a = bcd.mapping as AdderMapping
  assert.equal(a.correctionText, 'K = C4 + S4S3 + S4S2')
  // 引脚名与有效电平
  assert.equal(bcd.pins.find(p => p.name === 'C0')?.aliases[0], 'Cin')
  assert.equal(bcd.pins.find(p => p.name === 'Σ4')?.activeLevel, 'high')
})

test('283: BCD 修正判断式对 0～19 全部正确，并得到 8421 码结果', () => {
  for (let s = 0; s <= 19; s++) {
    const k = bcdCorrection(s)
    assert.equal(k, s >= 10 ? 1 : 0, `和 ${s}`)
    const digit = (s + 6 * k) & 15
    assert.equal(digit, s >= 10 ? s - 10 : s, `和 ${s} 修正后的个位`)
  }
})

// ───────────────────────── map_msi：74LS85 比较器 ─────────────────────────

test('85: 8 位级联，低位片级联输入为 0、0、1，高位片接低位片输出', () => {
  const r = msi({ chip: '85', bits: 8 })
  assert.equal(r.stages.length, 2)
  assert.equal(wireOf(0, r, 'I(A=B)'), 'VCC')
  assert.equal(wireOf(0, r, 'I(A>B)'), 'GND')
  assert.equal(wireOf(1, r, 'I(A>B)'), 'G0')
  assert.equal(wireOf(1, r, 'I(A<B)'), 'L0')
  assert.equal(wireOf(1, r, 'I(A=B)'), 'E0')
  assert.equal(wireOf(1, r, 'A3'), 'A7')
  assert.equal((r.mapping as ComparatorMapping).stages, 2)
})

test('85: 单片使用时级联输入接 0、0、1；位数非法时报错', () => {
  const r = msi({ chip: '85' })
  assert.equal(r.stages.length, 1)
  assert.equal(wireOf(0, r, 'I(A=B)'), 'VCC')
  assert.throws(() => mapMsi({ chip: '85', bits: 5 }), /4、8、12 或 16/)
})

// ───────────────────────── map_msi：74LS280 奇偶 ─────────────────────────

test('280: 4 变量奇校验（A⊕B⊕C⊕D）接 Σ_O，未用输入接地', () => {
  const r = msi({ chip: '280', variables: ['A', 'B', 'C', 'D'], minterms: [1, 2, 4, 7, 8, 11, 13, 14] })
  const m = r.mapping as ParityMapping
  assert.equal(m.kind, 'parity')
  assert.equal(m.odd, true)
  assert.equal(m.outputPin, 'Σ_O')
  assert.equal(wireOf(0, r, 'A'), 'A')
  assert.equal(wireOf(0, r, 'D'), 'D')
  assert.equal(wireOf(0, r, 'E'), 'GND')
  assert.equal(wireOf(0, r, 'Σ_O'), 'F')
})

test('280: 偶校验函数接 Σ_E；非奇偶函数报错', () => {
  const even = msi({ chip: '280', variables: ['A', 'B'], minterms: [0, 3] })
  assert.equal((even.mapping as ParityMapping).odd, false)
  assert.equal(wireOf(0, even, 'Σ_E'), 'F')
  assert.throws(() => mapMsi({ chip: '280', expr: 'AB' }), /奇偶函数/)
  const bad = runComb({ op: 'map_msi', chip: '280', expr: 'AB' })
  assert.equal(bad.ok, false)
})

// ───────────────────────── map_msi：74LS148 ─────────────────────────

test('148: 给出引脚与优先级说明，并提示不直接实现任意函数', () => {
  const out = mapMsi({ chip: '148' })
  assert.equal(out.result.mapping.kind, 'encoder')
  assert.ok(out.result.pins.some(p => p.name === 'EI̅' && p.activeLevel === 'low'))
  assert.ok(out.warnings.length > 0)
})

// ───────────────────────── 宿主信封与文本 ─────────────────────────

test('map_msi 通过 runComb 返回信封，渲染文本不含提示语', () => {
  const res = runComb({ op: 'map_msi', chip: '151', variables: ['A', 'B', 'C', 'D'], minterms: [0, 1, 3, 4, 8, 9, 15] })
  assert.equal(res.ok, true)
  assert.equal(res.op, 'map_msi')
  const text = renderComb(res)
  assert.match(text, /D0（选择码 000）= 1/)
  assert.doesNotMatch(text, /工具|核对|引擎/)
})

test('runComb: 未知 op 与缺少必要参数时 ok 为 false', () => {
  const unknown = runComb({ op: 'simulate' as never })
  assert.equal(unknown.ok, false)
  const noChip = runComb({ op: 'map_msi' })
  assert.equal(noChip.ok, false)
  const noFunc = runComb({ op: 'map_msi', chip: '138' })
  assert.equal(noFunc.ok, false)
  assert.match(noFunc.error ?? '', /缺少函数/)
})

test('参数定义包含两个 op 与全部芯片', () => {
  assert.deepEqual(COMB_PARAMETERS.op.enum, ['analyze', 'map_msi', 'draw'])
  assert.deepEqual(COMB_PARAMETERS.chip.enum, ['138', '139', '148', '151', '153', '85', '283', '280'])
  assert.ok(DlogicInputError)
})
