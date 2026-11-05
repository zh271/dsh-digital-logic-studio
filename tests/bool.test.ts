import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canonical,
  complementExpr,
  dualExpr,
  equivalent,
  gateForms,
  hazard,
  kmap,
  minimize,
  minimizeSteps,
  parseExpr,
  specFromExpr,
  truthTable,
} from '../src/solvers/bool.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { BoolSpec, Implicant } from '../src/shared/contracts.ts'

const ABCD = ['A', 'B', 'C', 'D']
const ABC = ['A', 'B', 'C']

/** 把若干“掩码集合”各自排序，再整体排序，便于与期望值比较（与顺序无关）。 */
function sortSets(sets: string[][]): string[][] {
  return sets.map(s => s.slice().sort()).sort((x, y) => (x.join('|') < y.join('|') ? -1 : 1))
}

/** 每个解的掩码集合（与解的顺序、掩码顺序无关）。 */
function solutionMaskSets(sols: Implicant[][]): string[][] {
  return sortSets(sols.map(sol => sol.map(i => i.mask)))
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ───────────────────────── 解析 ─────────────────────────

test("parse: 'F = ' prefix is stripped; A'B+AB' equals A⊕B", () => {
  assert.equal(equivalent(specFromExpr("F = A'B + AB'"), specFromExpr('A⊕B')).equivalent, true)
  assert.equal(equivalent(specFromExpr("F = A'B + AB'"), specFromExpr("AB'+A'B")).equivalent, true)
})

test('parse: f(A,B,C)= and Y= prefixes are stripped (variables still come from the expression)', () => {
  assert.deepEqual(specFromExpr('f(A,B,C)=AB').variables, ['A', 'B'])
  assert.deepEqual(specFromExpr('f(A,B,C)=AB').minterms, [3])
  assert.deepEqual(specFromExpr('f(A,B,C)=AB', ABC).minterms, [6, 7])
  assert.deepEqual(specFromExpr('Y=AB').minterms, [3])
})

test("parse: !A&B|C equals A'B+C", () => {
  const spec = specFromExpr('!A&B|C')
  assert.deepEqual(spec.variables, ['A', 'B', 'C'])
  assert.equal(equivalent(spec, specFromExpr("A'B+C")).equivalent, true)
})

test('parse: A+BC is not (A+B)C, with a counterexample at A=1,B=0,C=0', () => {
  const r = equivalent(specFromExpr('A+BC'), specFromExpr('(A+B)C'))
  assert.equal(r.equivalent, false)
  assert.ok(r.counterexample)
  assert.equal(r.counterexample.index, 4)
  assert.deepEqual(r.counterexample.inputs, [1, 0, 0])
  assert.equal(r.counterexample.left, 1)
  assert.equal(r.counterexample.right, 0)
})

test('parse: distributive law A+BC = (A+B)(A+C)', () => {
  assert.equal(equivalent(specFromExpr('A+BC'), specFromExpr('(A+B)(A+C)')).equivalent, true)
})

test('parse: precedence NOT > AND > XOR > OR', () => {
  assert.equal(equivalent(specFromExpr('A+B⊕CD'), specFromExpr('A+(B⊕(CD))')).equivalent, true)
  assert.equal(equivalent(specFromExpr('A+B⊕C'), specFromExpr('(A+B)⊕C')).equivalent, false)
})

test('parse: explicit variable list uses greedy longest match', () => {
  const spec = specFromExpr('A1A2', ['A1', 'A2'])
  assert.deepEqual(spec.variables, ['A1', 'A2'])
  assert.deepEqual(spec.minterms, [3])
})

test('parse: unknown character throws DlogicInputError', () => {
  assert.throws(() => specFromExpr('A#B'), DlogicInputError)
})

test('parse: unknown variable with explicit list throws DlogicInputError', () => {
  assert.throws(() => specFromExpr('AC', ['A', 'B']), DlogicInputError)
})

test('parse: syntax errors throw DlogicInputError and name the position', () => {
  assert.throws(() => parseExpr('A+'), DlogicInputError)
  assert.throws(() => parseExpr('(A+B'), DlogicInputError)
  assert.throws(() => parseExpr('A)B'), DlogicInputError)
  assert.throws(() => parseExpr(''), DlogicInputError)
  assert.throws(() => parseExpr("F = "), DlogicInputError)
  assert.throws(() => parseExpr('A+*B'), (e: unknown) => e instanceof DlogicInputError && /位置 3/.test((e as Error).message))
})

test('parse: seven variables throw DlogicInputError', () => {
  assert.throws(() => specFromExpr('A+B+C+D+E+F+G'), DlogicInputError)
  assert.throws(
    () => minimize({ variables: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], minterms: [0], dontCares: [] }),
    DlogicInputError,
  )
})

test('spec validation: out-of-range minterm and minterm/dontCare overlap throw', () => {
  assert.throws(() => minimize({ variables: ABC, minterms: [8], dontCares: [] }), DlogicInputError)
  assert.throws(() => minimize({ variables: ABC, minterms: [1], dontCares: [1] }), DlogicInputError)
})

test('constants and default variable sorting', () => {
  assert.deepEqual(specFromExpr('1').minterms, [0])
  assert.deepEqual(specFromExpr('C+A').variables, ['A', 'C'])
})

// ───────────────────────── 真值表与标准形 ─────────────────────────

test("truthTable: MSB-first inputs and X for don't-care", () => {
  const t = truthTable({ variables: ['A', 'B'], minterms: [1], dontCares: [2] })
  assert.equal(t.rows.length, 4)
  assert.deepEqual(t.rows[1].inputs, [0, 1])
  assert.equal(t.rows[1].output, 1)
  assert.equal(t.rows[2].output, 'X')
  assert.equal(t.rows[0].output, 0)
})

test('canonical: sigma, pi, SOP and POS texts', () => {
  const c = canonical({ variables: ABC, minterms: [1, 3, 5], dontCares: [] })
  assert.equal(c.sigma, 'Σm(1,3,5)')
  assert.equal(c.pi, 'ΠM(0,2,4,6,7)')
  assert.equal(c.sopText, "A'B'C + A'BC + AB'C")
  assert.equal(c.posText, "(A+B+C)(A+B'+C)(A'+B+C)(A'+B'+C)(A'+B'+C')")
  assert.equal(canonical({ variables: ABC, minterms: [1], dontCares: [2] }).sigma, 'Σm(1) + Σd(2)')
})

test('canonical: constant functions', () => {
  assert.equal(canonical({ variables: ABC, minterms: [], dontCares: [] }).sopText, '0')
  assert.equal(canonical({ variables: ABC, minterms: [0, 1, 2, 3, 4, 5, 6, 7], dontCares: [] }).posText, '1')
})

// ───────────────────────── 最简化 ─────────────────────────

test("minimize: Σm(0,2,5,7,8,10,13,15) SOP is BD + B'D' (single solution)", () => {
  const r = minimize({ variables: ABCD, minterms: [0, 2, 5, 7, 8, 10, 13, 15], dontCares: [] }, 'SOP')
  assert.deepEqual(solutionMaskSets(r.solutions), [['-0-0', '-1-1']])
  assert.deepEqual(r.cost, { terms: 2, literals: 4 })
  assert.equal(r.texts.length, 1)
  assert.equal(r.texts[0], "B'D' + BD")
})

test("minimize: same function POS is (B'+D)(B+D') (single solution)", () => {
  const r = minimize({ variables: ABCD, minterms: [0, 2, 5, 7, 8, 10, 13, 15], dontCares: [] }, 'POS')
  // POS masks are complement-function masks: (B'+D) -> "-1-0", (B+D') -> "-0-1"
  assert.deepEqual(solutionMaskSets(r.solutions), [['-0-1', '-1-0']])
  assert.equal(r.solutions.length, 1)
  assert.equal(r.texts.length, 1)
  assert.ok(r.texts[0] === "(B+D')(B'+D)" || r.texts[0] === "(B'+D)(B+D')")
})

test("minimize: Σm(1,3,7,11,15)+d(0,2,5) has exactly {CD, A'B'} and {CD, A'D}", () => {
  const r = minimize({ variables: ABCD, minterms: [1, 3, 7, 11, 15], dontCares: [0, 2, 5] }, 'SOP')
  assert.deepEqual(solutionMaskSets(r.solutions), sortSets([
    ['--11', '00--'],
    ['--11', '0--1'],
  ]))
  assert.deepEqual(r.texts, ["A'B' + CD", "A'D + CD"])
  assert.deepEqual(r.cost, { terms: 2, literals: 4 })
  assert.deepEqual(r.essential, ['--11'])
})

test("minimize: cyclic Σm(0,1,2,5,6,7) has exactly two 3-term/6-literal solutions and no essentials", () => {
  const r = minimize({ variables: ABC, minterms: [0, 1, 2, 5, 6, 7], dontCares: [] }, 'SOP')
  assert.deepEqual(solutionMaskSets(r.solutions), sortSets([
    ['-10', '00-', '1-1'],
    ['-01', '0-0', '11-'],
  ]))
  assert.deepEqual(r.cost, { terms: 3, literals: 6 })
  assert.deepEqual(r.essential, [])
  for (const sol of r.solutions) {
    assert.equal(sol.length, 3)
    assert.equal(sol.reduce((s, i) => s + i.literals, 0), 6)
  }
  assert.deepEqual(r.texts, ["A'B' + AC + BC'", "A'C' + AB + B'C"])
})

test('minimize: Σm(0..7) over three variables is 1', () => {
  const r = minimize({ variables: ABC, minterms: [0, 1, 2, 3, 4, 5, 6, 7], dontCares: [] })
  assert.deepEqual(r.texts, ['1'])
  assert.deepEqual(r.cost, { terms: 1, literals: 0 })
})

test('minimize: no minterms is 0', () => {
  const r = minimize({ variables: ABC, minterms: [], dontCares: [] })
  assert.deepEqual(r.texts, ['0'])
  assert.deepEqual(r.solutions, [[]])
})

test('minimize: POS of constant 0 is 0 and POS of constant 1 is 1', () => {
  assert.deepEqual(minimize({ variables: ABC, minterms: [], dontCares: [] }, 'POS').texts, ['0'])
  assert.deepEqual(minimize({ variables: ABC, minterms: [0, 1, 2, 3, 4, 5, 6, 7], dontCares: [] }, 'POS').texts, ['1'])
})

test('minimize: POS of single-literal function has no parentheses', () => {
  // F(A) = A; zeros are A=0, so the POS is A
  const r = minimize({ variables: ['A'], minterms: [1], dontCares: [] }, 'POS')
  assert.deepEqual(r.texts, ['A'])
})

test('minimize: primes include covers that absorb don\'t-cares', () => {
  const r = minimize({ variables: ABC, minterms: [1], dontCares: [3] }, 'SOP')
  assert.deepEqual(r.texts, ["A'C"])
  assert.equal(r.solutions[0].length, 1)
  assert.equal(r.solutions[0][0].mask, '0-1')
  assert.deepEqual(r.solutions[0][0].covers, [1, 3])
})

test('minimizeSteps: four teaching step kinds in order', () => {
  const steps = minimizeSteps({ variables: ABC, minterms: [0, 1, 2, 5, 6, 7], dontCares: [] }, 'SOP')
  assert.deepEqual(steps.map(s => s.kind), ['qm-columns', 'pi-chart', 'essential', 'petrick'])
  for (const s of steps) assert.equal(typeof s.text, 'string')
  const pi = steps[1] as unknown as { cover: Record<string, number[]>; minterms: number[] }
  assert.deepEqual(pi.minterms, [0, 1, 2, 5, 6, 7])
  assert.equal(Object.keys(pi.cover).length, 6)
  const pet = steps[3] as unknown as { solutions: string[][] }
  assert.equal(pet.solutions.length, 2)
  assert.equal(minimizeSteps({ variables: ABC, minterms: [], dontCares: [] })[0].kind, 'constant')
})

// ───────────────────────── 卡诺图 ─────────────────────────

test('kmap: 5-variable function has 2 planes, 32 cells, planeVar A', () => {
  const k = kmap({ variables: ['A', 'B', 'C', 'D', 'E'], minterms: [0, 5, 17, 31], dontCares: [8] })
  assert.equal(k.planes, 2)
  assert.equal(k.cells.length, 32)
  assert.equal(k.planeVar, 'A')
  assert.deepEqual(k.colCodes, ['00', '01', '11', '10'])
  assert.deepEqual(k.rowCodes, ['00', '01', '11', '10'])
  assert.deepEqual(k.rowVars, ['B', 'C'])
  assert.deepEqual(k.colVars, ['D', 'E'])
  assert.equal(k.cells.filter(c => c.plane === 1).length, 16)
  assert.equal(k.cells.find(c => c.minterm === 17)?.value, 1)
  assert.equal(k.cells.find(c => c.minterm === 8)?.value, 'X')
})

test('kmap: 4-variable cell for minterm 13 is at AB=11, CD=01', () => {
  const k = kmap({ variables: ABCD, minterms: [13], dontCares: [] })
  const cell = k.cells.find(c => c.minterm === 13)
  assert.ok(cell)
  assert.equal(k.rowCodes[cell.row], '11')
  assert.equal(k.colCodes[cell.col], '01')
  assert.equal(cell.value, 1)
  assert.equal(k.planes, 1)
  assert.equal(k.planeVar, null)
})

test('kmap: groups list the covered cells of solution 0', () => {
  const k = kmap({ variables: ABCD, minterms: [0, 2, 5, 7, 8, 10, 13, 15], dontCares: [] })
  assert.equal(k.groups.length, 2)
  const cellSets = k.groups.map(g => g.cells.slice().sort((a, b) => a - b).join(','))
  assert.deepEqual(cellSets.sort(), ['0,2,8,10', '5,7,13,15'])
})

test('kmap: rejects 6 variables', () => {
  assert.throws(() => kmap({ variables: ['A', 'B', 'C', 'D', 'E', 'F'], minterms: [0], dontCares: [] }), DlogicInputError)
})

// ───────────────────────── 险象 ─────────────────────────

test("hazard: AB'+BC has one static-1 pair (m5,m7), variable B, consensus AC", () => {
  const h = hazard(specFromExpr("AB'+BC", ABC))
  assert.equal(h.static1.length, 1)
  assert.equal(h.static1[0].a, 5)
  assert.equal(h.static1[0].b, 7)
  assert.equal(h.static1[0].variable, 'B')
  assert.equal(h.static1[0].consensus.text, 'AC')
  const terms = h.hazardFreeSop.split(' + ')
  assert.ok(terms.includes("AB'"))
  assert.ok(terms.includes('BC'))
  assert.ok(terms.includes('AC'))
})

test("hazard: AB'+BC also has one static-0 pair (m0,m2) on B with consensus (A+C)", () => {
  // POS of AB'+BC is (A+B)(B'+C); the pair 000/010 is not covered by one sum term
  const h = hazard(specFromExpr("AB'+BC", ABC))
  assert.equal(h.static0.length, 1)
  assert.equal(h.static0[0].a, 0)
  assert.equal(h.static0[0].b, 2)
  assert.equal(h.static0[0].variable, 'B')
  assert.equal(h.static0[0].consensus.text, '(A+C)')
})

test('hazard: F = A\' (minterms 0..3) has no hazards and hazard-free SOP A\'', () => {
  const h = hazard({ variables: ABC, minterms: [0, 1, 2, 3], dontCares: [] })
  assert.equal(h.static1.length, 0)
  assert.equal(h.static0.length, 0)
  assert.equal(h.hazardFreeSop, "A'")
})

// ───────────────────────── 反演与对偶 ─────────────────────────

test("complementExpr and dualExpr of A(B+C') match the textbook forms", () => {
  assert.equal(complementExpr("A(B+C')").text, "A'+B'C")
  assert.equal(dualExpr("A(B+C')").text, "A+BC'")
})

test('complementExpr truth table equals NOT of the original', () => {
  const src = "A(B+C')+D'E"
  const orig = specFromExpr(src)
  const comp = specFromExpr(complementExpr(src).text, orig.variables)
  const on = new Set(orig.minterms)
  const expected: number[] = []
  for (let m = 0; m < 1 << orig.variables.length; m++) if (!on.has(m)) expected.push(m)
  assert.deepEqual(comp.minterms, expected)
})

test("complementExpr: AB+CD gives (A'+B')(C'+D'); (AB)' gives AB", () => {
  assert.equal(complementExpr('AB+CD').text, "(A'+B')(C'+D')")
  assert.equal(complementExpr("(AB)'").text, 'AB')
  assert.equal(complementExpr("(AB)'").latex, 'AB')
})

test('dualExpr: keeps literals and swaps AND/OR', () => {
  assert.equal(dualExpr('AB+CD').text, '(A+B)(C+D)')
  assert.equal(dualExpr("A'B").text, "A'+B")
})

// ───────────────────────── 门电路形式 ─────────────────────────

test("gateForms: AB+CD nandNand is ((AB)'(CD)')'", () => {
  const g = gateForms(specFromExpr('AB+CD', ABCD))
  assert.equal(g.nandNand, "((AB)'(CD)')'")
  assert.equal(g.nandNandLatex, '\\overline{\\overline{AB}\\overline{CD}}')
})

test("gateForms: norNor of (A+B)(C+D) is ((A+B)'+(C+D)')'", () => {
  const g = gateForms(specFromExpr('(A+B)(C+D)', ABCD))
  assert.equal(g.norNor, "((A+B)'+(C+D)')'")
})

test("gateForms: andOrInvert of AB+CD is (G)' with G the SOP of the complement", () => {
  const g = gateForms(specFromExpr('AB+CD', ABCD))
  assert.equal(g.andOrInvert, "(A'C'+A'D'+B'C'+B'D')'")
})

test('gateForms: single-term function keeps its NAND form', () => {
  assert.equal(gateForms({ variables: ['A', 'B'], minterms: [3], dontCares: [] }).nandNand, "((AB)')'")
})

// ───────────────────────── 等价 ─────────────────────────

test('equivalent: different variable orders and variable sets', () => {
  const a: BoolSpec = { variables: ['A', 'B'], minterms: [1, 3], dontCares: [] } // F = B
  const b: BoolSpec = { variables: ['B', 'A'], minterms: [2, 3], dontCares: [] } // F = B
  assert.equal(equivalent(a, b).equivalent, true)
  assert.equal(equivalent(a, { variables: ['B'], minterms: [1], dontCares: [] }).equivalent, true)
  assert.equal(equivalent(a, { variables: ['A'], minterms: [1], dontCares: [] }).equivalent, false)
})

test("equivalent: a don't-care on either side matches anything", () => {
  assert.equal(
    equivalent({ variables: ['A'], minterms: [1], dontCares: [0] }, { variables: ['A'], minterms: [1], dontCares: [] })
      .equivalent,
    true,
  )
  // F = A with row A=0 as don't-care vs. constant 0 with row A=1 as don't-care
  assert.equal(
    equivalent({ variables: ['A'], minterms: [], dontCares: [1] }, { variables: ['A'], minterms: [], dontCares: [] })
      .equivalent,
    true,
  )
  assert.equal(
    equivalent({ variables: ['A'], minterms: [], dontCares: [1] }, { variables: ['A'], minterms: [0], dontCares: [] })
      .equivalent,
    false,
  )
})

// ───────────────────────── 随机交叉验证 ─────────────────────────

test("random cross-check: 200 four-variable functions with don't-cares", () => {
  const rand = mulberry32(20261104)
  for (let iter = 0; iter < 200; iter++) {
    const minterms: number[] = []
    const dontCares: number[] = []
    for (let m = 0; m < 16; m++) {
      const r = rand()
      if (r < 0.4) minterms.push(m)
      else if (r < 0.55) dontCares.push(m)
    }
    const spec: BoolSpec = { variables: ABCD, minterms, dontCares }
    for (const form of ['SOP', 'POS'] as const) {
      const res = minimize(spec, form)
      const tag = `iter ${iter} ${form}`
      assert.equal(res.texts.length, res.solutions.length, `${tag}: text count`)
      assert.ok(res.solutions.length >= 1, `${tag}: no solution`)
      for (let s = 0; s < res.solutions.length; s++) {
        const sol = res.solutions[s]
        assert.equal(sol.length, res.cost.terms, `${tag} sol ${s}: term count differs from cost`)
        assert.equal(
          sol.reduce((t, i) => t + i.literals, 0),
          res.cost.literals,
          `${tag} sol ${s}: literal count differs from cost`,
        )
        // the printed expression must implement the spec on all non-don't-care rows
        const eq = equivalent(spec, specFromExpr(res.texts[s], ABCD))
        assert.equal(eq.equivalent, true, `${tag} sol ${s}: "${res.texts[s]}" ${JSON.stringify(eq.counterexample)}`)
      }
    }
  }
})

test('minimize: multiple minimal solutions each carry their own covers (for per-solution K-map)', () => {
  const r = minimize({ variables: ABCD, minterms: [0, 1, 2, 5, 6, 7], dontCares: [] }, 'SOP')
  assert.equal(r.solutions.length, 2)
  assert.equal(r.texts.length, 2)
  for (const sol of r.solutions) {
    const covered = new Set(sol.flatMap(imp => imp.covers))
    assert.deepEqual([...covered].sort((a, b) => a - b), [0, 1, 2, 5, 6, 7])
  }
})
