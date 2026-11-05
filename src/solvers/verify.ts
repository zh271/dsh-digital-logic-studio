// 候选答案核对：等价判断、标准形代价与最简性判断。纯函数，不做 I/O。
import { DlogicInputError } from '../shared/contracts.ts'
import type { BoolSpec, VerifyResult } from '../shared/contracts.ts'
import { equivalent, minimize, parseExpr, specFromExpr, type BoolExpr, type Form } from './bool.ts'

export interface CheckInput {
  candidate: string
  reference: BoolSpec
  requireMinimal?: boolean
  form?: Form
  reveal?: boolean
}

type Cost = { terms: number; literals: number }
interface Lit {
  name: string
  neg: boolean
}

/** 纯文字的积（可嵌套的与）展开为文字列表；否则返回 null。 */
function productLits(e: BoolExpr): Lit[] | null {
  switch (e.k) {
    case 'var':
      return [{ name: e.name, neg: false }]
    case 'not':
      return e.x.k === 'var' ? [{ name: e.x.name, neg: true }] : null
    case 'and': {
      const out: Lit[] = []
      for (const x of e.xs) {
        const l = productLits(x)
        if (l === null) return null
        out.push(...l)
      }
      return out
    }
    default:
      return null
  }
}

/** 纯文字的和（可嵌套的或）展开为文字列表；否则返回 null。 */
function sumLits(e: BoolExpr): Lit[] | null {
  if (e.k === 'or') {
    const out: Lit[] = []
    for (const x of e.xs) {
      const l = sumLits(x)
      if (l === null) return null
      out.push(...l)
    }
    return out
  }
  return productLits(e)
}

/**
 * 若候选式是 form 指定的标准形（SOP：乘积项之和；POS：和项之积），返回其代价；否则返回 null。
 * 常量：SOP 中 1 计 1 项 0 文字、0 计 0 项；POS 中 0 计 1 项 0 文字、1 计 0 项（与 minimize 的约定一致）。
 */
function flatCost(e: BoolExpr, form: Form): Cost | null {
  if (e.k === 'const') {
    const one = e.v === 1
    if (form === 'SOP') return one ? { terms: 1, literals: 0 } : { terms: 0, literals: 0 }
    return one ? { terms: 0, literals: 0 } : { terms: 1, literals: 0 }
  }
  const groups: Lit[][] = []
  if (form === 'SOP') {
    const items = e.k === 'or' ? e.xs : [e]
    for (const x of items) {
      const l = productLits(x)
      if (l === null) return null
      groups.push(l)
    }
  } else {
    const items = e.k === 'and' ? e.xs : [e]
    for (const x of items) {
      const l = sumLits(x)
      if (l === null) return null
      groups.push(l)
    }
  }
  return {
    terms: groups.length,
    literals: groups.reduce((s, g) => s + g.length, 0),
  }
}

/**
 * 核对候选答案。候选式只能使用参考函数的变量；等价判断时参考函数的无关项可取任意值。
 * minimal：仅 requireMinimal 时给出。候选式不是标准形时为 null（无法比较代价）。
 */
export function checkAnswer(input: CheckInput): VerifyResult {
  if (typeof input.candidate !== 'string' || input.candidate.trim() === '') {
    throw new DlogicInputError('候选答案不能为空')
  }
  const form: Form = input.form ?? 'SOP'
  if (form !== 'SOP' && form !== 'POS') throw new DlogicInputError('形式必须是 SOP 或 POS')

  const refVars = input.reference.variables
  const unknown = parseExpr(input.candidate).variables.filter(v => !refVars.includes(v))
  if (unknown.length > 0) {
    throw new DlogicInputError(`候选答案使用了参考函数中没有的变量：${unknown.join('、')}`)
  }

  const candSpec = specFromExpr(input.candidate, refVars)
  const eq = equivalent(candSpec, input.reference)
  const result: VerifyResult = { equivalent: eq.equivalent, variables: refVars.slice() }
  if (eq.counterexample) result.counterexample = eq.counterexample

  const { ast } = parseExpr(input.candidate, refVars)
  const cost = flatCost(ast, form)
  if (cost) result.candidateCost = cost

  if (input.requireMinimal === true) {
    const best = minimize(input.reference, form).cost
    result.minimalCost = best
    if (!eq.equivalent) result.minimal = false
    else if (cost === null) result.minimal = null
    else result.minimal = cost.terms === best.terms && cost.literals === best.literals
  }

  if (input.reveal === true) {
    const m = minimize(input.reference, form)
    result.reference = { texts: m.texts.slice(), latex: m.latex.slice() }
  }
  return result
}
