// dlogic_fsm 的类型定义：状态机规范、化简、编码、综合与自启动结果。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace）。
import type { Implicant } from './contracts.ts'

export type FsmType = 'mealy' | 'moore'
export type FfType = 'D' | 'JK' | 'T'
export type EncodingKind = 'binary' | 'gray' | 'onehot'

/**
 * 一条转移。input 为 inputs 位的 0/1/x 串（x 表示该位任意）；
 * output 为 outputs 位的 0/1/x 串；to 为 'x' 表示次态未给定。
 * 省略的 (状态, 输入) 组合视为未给定。摩尔机的输出由现态决定（同一现态的各转移输出须相容）。
 */
export interface FsmTransition {
  from: string
  input: string
  to: string
  output: string
}

export interface FsmSpec {
  type: FsmType
  states: string[]
  inputs: number
  outputs: number
  transitions: FsmTransition[]
}

export interface StateCode {
  state: string
  code: string
}

/** 隐含表中的一对状态。 */
export interface ImplicationPair {
  a: string
  b: string
  status: 'equivalent' | 'distinct'
  /** 判定依据的一句话。 */
  reason: string
  /** 输出相容时，需要继续检查的次态对（输入为判定所在的输入组合）。 */
  implied: { a: string; b: string; input: string }[]
}

export interface ReduceResult {
  /** 完全给定：隐含表；不完全给定：相容类。 */
  complete: boolean
  method: 'implication' | 'compatible'
  /** 完全给定时的隐含表。 */
  implication?: ImplicationPair[]
  /** 完全给定：等价类；不完全给定：全部最大相容类（状态名）。 */
  classes: string[][]
  /** 不完全给定：一个最小闭覆盖（状态名）。 */
  cover?: string[][]
  /** 原状态 → 化简后的状态（不完全给定时一个状态可能属于多个闭覆盖类）。 */
  stateMap: { state: string; groups: string[] }[]
  /** 化简后的状态表。 */
  reduced: FsmSpec
  reducedCount: number
}

export interface AdjacencyPair {
  a: string
  b: string
  /** 1：同一现态在不同输入下的次态；2：同一输入下同一次态的现态。 */
  rules: number[]
}

export interface EncodingScore {
  kind: EncodingKind | 'custom'
  bits: number
  codes: StateCode[]
  /** 相邻状态对的汉明距离之和，越小越好。 */
  score: number
  /** 距离恰为 1 的相邻对数。 */
  satisfied: number
  total: number
}

export interface AssignResult {
  pairs: AdjacencyPair[]
  encodings: EncodingScore[]
  best: EncodingKind | 'custom'
}

/** 激励表的一行：一个（寄存器编码, 输入）组合。未使用的编码 state 为 null。 */
export interface ExcitationRow {
  code: string
  state: string | null
  input: string
  /** null 表示次态未给定（该行全部为无关项）。 */
  next: string | null
  nextCode: string | null
  output: string
  /** 各触发器输入的取值（'0' | '1' | 'x'），键为函数名。 */
  excitation: Record<string, string>
}

export interface SynthFunction {
  name: string
  role: 'excitation' | 'output'
  variables: string[]
  minterms: number[]
  dontCares: number[]
  /** 第一个最简解（SOP）。 */
  text: string
  /** 全部等价最简解。 */
  texts: string[]
  latex: string[]
  cost: { terms: number; literals: number }
  /** 第一个最简解的蕴涵项（用于校验与展示）。 */
  implicants: Implicant[]
}

export interface SynthesizeResult {
  ff: FfType
  encoding: EncodingKind | 'custom'
  codes: StateCode[]
  stateBits: string[]
  inputNames: string[]
  outputNames: string[]
  excitationNames: string[]
  table: ExcitationRow[]
  functions: SynthFunction[]
}

export interface SelfStartCheck {
  code: string
  input: string
  /** 经过的编码序列，最后一个为有效编码（或循环中的编码）。 */
  trace: string[]
  ok: boolean
}

export interface SelfStartResult {
  selfStarting: boolean
  checks: SelfStartCheck[]
  fixed: boolean
  /** 改写了次态取值的无效编码及其改写到的状态。 */
  rewritten: { code: string; to: string }[]
  after: SelfStartCheck[]
  synthesis: SynthesizeResult
}

export type FsmOp = 'reduce' | 'assign' | 'synthesize' | 'self_start'

/** dlogic_fsm 各 op 的 result 结构（Envelope.result）。每个结果都带上输入规范。 */
export interface FsmResultMap {
  reduce: { spec: FsmSpec; reduce: ReduceResult }
  assign: { spec: FsmSpec; assign: AssignResult }
  synthesize: { spec: FsmSpec; synthesis: SynthesizeResult }
  self_start: { spec: FsmSpec; selfStart: SelfStartResult }
}

