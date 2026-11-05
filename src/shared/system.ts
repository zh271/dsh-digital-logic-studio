// dlogic_system 的类型定义：ASM 图规范、校验结果、状态转移表与控制器设计结果。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace）。

/** 条件输出框：name 为输出名，expr 为使其有效的条件（条件变量的布尔表达式）。 */
export interface AsmConditional {
  name: string
  expr: string
}

/** ASM 状态框：outputs 为 Moore 型输出（进入本状态即有效），conditionals 为条件输出框。 */
export interface AsmState {
  name: string
  outputs: string[]
  conditionals: AsmConditional[]
}

/** 判断框的一个出口。cond 为表达式，或 'else' / '1'（无条件）。 */
export interface AsmTransition {
  from: string
  cond: string
  to: string
}

export interface AsmSpec {
  states: AsmState[]
  transitions: AsmTransition[]
  /** 初始状态，省略时取 states 的第一个。 */
  initial?: string
  /** 条件变量的排列顺序（可选）；省略时按表达式中首次出现的顺序。 */
  conditionVars?: string[]
}

export type AsmIssueKind = 'overlap' | 'missing-else' | 'multi-else' | 'dead-else' | 'unreachable' | 'dangling'

export interface AsmIssue {
  level: 'error' | 'warning'
  kind: AsmIssueKind
  state: string
  message: string
}

/** 状态转移表的一格：某状态在某组条件取值下的次态，以及此时有效的条件输出名。 */
export interface AsmCell {
  next: string | null
  active: string[]
}

export interface AsmTableRow {
  state: string
  outputs: string[]
  cells: AsmCell[]
}

export interface AsmTable {
  vars: string[]
  /** 每列的条件取值说明，例如 "X=0 Y=1"；无条件变量时为 "（无条件）"。 */
  combos: string[]
  rows: AsmTableRow[]
}

export interface AsmResult {
  states: string[]
  initial: string
  conditionVars: string[]
  valid: boolean
  issues: AsmIssue[]
  table: AsmTable
}

export type ControllerScheme = 'counter' | 'mux' | 'sequence'

/**
 * 一个控制函数的化简结果。variables 为化简后实际用到的变量（已去掉不影响取值的变量），
 * minterms 与 dontCares 按 variables 编号（variables[0] 为最高位）。
 */
export interface CtrlFunction {
  name: string
  role: 'count' | 'load' | 'load-data' | 'mux-data' | 'next'
  variables: string[]
  minterms: number[]
  dontCares: number[]
  /** 第一个最简解。 */
  text: string
  /** 全部等价最简解。 */
  texts: string[]
  latex: string[]
  cost: { terms: number; literals: number }
  /** false 表示变量过多未化简，texts 为最小项和式。 */
  minimized: boolean
}

export interface DecoderRow {
  state: string
  code: string
  line: string
}

export interface MuxRow {
  code: string
  state: string | null
  data: string
}

export interface MuxDesign {
  bit: string
  select: string[]
  rows: MuxRow[]
}

export interface SchemeDesign {
  scheme: ControllerScheme
  /** 状态寄存器位名，高位在前。 */
  bits: string[]
  codes: { state: string; code: string }[]
  decoder?: DecoderRow[]
  muxes?: MuxDesign[]
  functions: CtrlFunction[]
  devices: string[]
  notes: string[]
}

export interface ControllerResult {
  states: string[]
  initial: string
  conditionVars: string[]
  signals: string[]
  /** 状态 → 各控制信号（与 signals 一一对应）：'1' 有效、'0' 无效，条件输出给出条件表达式。 */
  controlTable: { state: string; values: string[] }[]
  schemes: SchemeDesign[]
}

export type SystemOp = 'asm' | 'controller'

/** dlogic_system 各 op 的 result 结构（Envelope.result）。都带上输入的 ASM 规范。 */
export interface SystemResultMap {
  asm: { spec: AsmSpec; asm: AsmResult }
  controller: { spec: AsmSpec; controller: ControllerResult }
}
