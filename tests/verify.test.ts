import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DlogicInputError } from '../src/shared/contracts.ts'
import type { BoolSpec } from '../src/shared/contracts.ts'
import { checkAnswer } from '../src/solvers/verify.ts'

const ABCD = ['A', 'B', 'C', 'D']
// F(A,B,C,D) = Σm(0,2,5,7,8,10,13,15)，最简 SOP 为 BD + B'D'（2 项 4 文字）。
const REF: BoolSpec = { variables: ABCD, minterms: [0, 2, 5, 7, 8, 10, 13, 15], dontCares: [] }

test('minimal correct answer is equivalent and minimal', () => {
  const r = checkAnswer({ candidate: "BD + B'D'", reference: REF, requireMinimal: true })
  assert.equal(r.equivalent, true)
  assert.equal(r.minimal, true)
  assert.deepEqual(r.candidateCost, { terms: 2, literals: 4 })
  assert.deepEqual(r.minimalCost, { terms: 2, literals: 4 })
  assert.equal(r.reference, undefined)
})

test('equivalent but non-minimal answer is flagged', () => {
  const r = checkAnswer({ candidate: "A'B'D' + BD + B'D'", reference: REF, requireMinimal: true })
  assert.equal(r.equivalent, true)
  assert.equal(r.minimal, false)
  assert.deepEqual(r.candidateCost, { terms: 3, literals: 7 })
})

test('wrong answer gives a counterexample and is not minimal', () => {
  const r = checkAnswer({ candidate: 'BD', reference: REF, requireMinimal: true })
  assert.equal(r.equivalent, false)
  assert.equal(r.minimal, false)
  assert.ok(r.counterexample)
  assert.equal(r.counterexample.index, 0)
  assert.deepEqual(r.counterexample.inputs, [0, 0, 0, 0])
  assert.equal(r.counterexample.left, 0)
  assert.equal(r.counterexample.right, 1)
})

test('reveal false omits the reference; reveal true includes it', () => {
  const hidden = checkAnswer({ candidate: "BD + B'D'", reference: REF })
  assert.equal('reference' in hidden, false)
  const shown = checkAnswer({ candidate: "BD + B'D'", reference: REF, reveal: true })
  assert.ok(shown.reference)
  assert.ok(shown.reference.texts.length >= 1)
  assert.ok(shown.reference.latex.length >= 1)
})

test('non-flat candidate has no cost and minimal is null', () => {
  const r = checkAnswer({ candidate: "B(D + A) + B'D'", reference: REF, requireMinimal: true })
  assert.equal(r.equivalent, false)
  assert.equal(r.candidateCost, undefined)
  assert.equal(r.minimal, false)

  const eqNonFlat = checkAnswer({ candidate: "(BD)''+B'D'", reference: REF, requireMinimal: true })
  assert.equal(eqNonFlat.minimal, null)
})

test('candidate with a variable outside the reference throws in Chinese', () => {
  assert.throws(
    () => checkAnswer({ candidate: 'BD + E', reference: REF }),
    (err: unknown) => err instanceof DlogicInputError && /E/.test(err.message),
  )
})

test('POS form: (B+D\')(B\'+D) is minimal POS for F', () => {
  const r = checkAnswer({ candidate: "(B+D')(B'+D)", reference: REF, requireMinimal: true, form: 'POS' })
  assert.equal(r.equivalent, true)
  assert.equal(r.minimal, true)
  assert.deepEqual(r.candidateCost, { terms: 2, literals: 4 })
})

test('empty candidate throws', () => {
  assert.throws(() => checkAnswer({ candidate: '  ', reference: REF }), DlogicInputError)
})
