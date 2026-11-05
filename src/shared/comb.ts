// dlogic_comb 的数据契约：门级网表分析（analyze）与 MSI 芯片映射（map_msi）。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace），以便 Node 直接运行测试。

// ───────────────────────── 门级网表（analyze） ─────────────────────────

export type GateType = 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR'

export interface GateSpec {
  /** 输出信号名。 */
  out: string
  type: GateType
  /** 输入信号名：原始输入或其他门的输出。NOT 恰好 1 个，其余至少 2 个。 */
  in: string[]
}

export interface Netlist {
  /** 原始输入名，最多 6 个；inputs[0] 为真值表的最高位。 */
  inputs: string[]
  gates: GateSpec[]
  /** 省略时取未被其他门使用的门输出。 */
  outputs?: string[]
}

export interface GateDerivation {
  out: string
  type: GateType
  in: string[]
  /** 逻辑级数：原始输入为 0，门输出为 1 + max(输入级数)。 */
  level: number
  /** 只用本门输入名表示的式子，例如 "(Y1Y2)'"。 */
  local: string
  localLatex: string
  /** 代入原始输入后的式子；展开过长时为 null。 */
  expr: string | null
  latex: string | null
}

export interface OutputExpr {
  name: string
  /** 代入原始输入后的未化简式；展开过长时为 null。 */
  expr: string | null
  latex: string | null
  /** 由真值表得到的最简与或式。 */
  simplified: string
  simplifiedLatex: string
  cost: { terms: number; literals: number }
}

export interface CombTruthTable {
  variables: string[]
  outputs: string[]
  rows: { index: number; inputs: (0 | 1)[]; outputs: (0 | 1)[] }[]
}

export interface AnalyzeResult {
  inputs: string[]
  outputs: string[]
  /** 按拓扑顺序（先输入后输出）排列的逐级推导。 */
  gates: GateDerivation[]
  finalExprs: OutputExpr[]
  truthTable: CombTruthTable
  /** 最大逻辑级数。 */
  depth: number
}

// ───────────────────────── MSI 芯片（map_msi） ─────────────────────────

export type MsiChip = '138' | '139' | '148' | '151' | '153' | '85' | '283' | '280'

/** 有效电平：高电平有效、低电平有效；none 表示不适用。 */
export type ActiveLevel = 'high' | 'low' | 'none'

export type PinRole = 'input' | 'output' | 'select' | 'enable' | 'data' | 'cascade' | 'carry'

export interface MsiPin {
  /** 国标引脚名，低电平有效的名字带上划线（如 S̄2）。 */
  name: string
  /** 别名（教材或手册中的其他写法）。 */
  aliases: string[]
  activeLevel: ActiveLevel
  role: PinRole
  note?: string
}

/** 一条接线：芯片引脚 ← 信号。signal 为 VCC / GND / 变量名 / 门电路输出等。 */
export interface MsiWire {
  pin: string
  signal: string
  note?: string
}

/** 一片芯片（或一个门）的接线表。多片或多级时给出多个 stage。 */
export interface MsiStage {
  label: string
  wiring: MsiWire[]
}

/** 数据端取值：常量 0/1，单个变量或其反变量（X、X̄），或需要外加门电路的表达式。 */
export type DataValue =
  | { kind: 'const'; value: 0 | 1; text: string }
  | { kind: 'literal'; name: string; neg: boolean; text: string; latex: string }
  | { kind: 'expr'; text: string; latex: string }

/** 降维真值表的一行：一个选择码对应的数据端。 */
export interface MuxRow {
  /** 选择码（十进制），即 D 端编号。 */
  index: number
  /** 选择码各位（与 selectVars 同序，MSB 在前）。 */
  selectBits: (0 | 1)[]
  dataPin: string
  /** F 在各组高位变量取值下的值（与 highAssignments 对齐）；X 为无关项。 */
  cofactor: (0 | 1 | 'X')[]
  data: DataValue
}

export interface DecoderMapping {
  kind: 'decoder'
  chip: '138' | '139'
  /** 函数变量（MSB 在前），即译码器的地址。 */
  addressVars: string[]
  minterms: number[]
  /** 与非门输入对应的最小项名，例如 "m1"。 */
  outputNames: string[]
  nandText: string
  nandLatex: string
  /** 函数恒为 0 或恒为 1 时为 0 或 1，否则为 null。 */
  constant: 0 | 1 | null
}

export interface MuxMapping {
  kind: 'mux'
  chip: '151' | '153'
  /** 作为选择端的变量（MSB 在前）。 */
  selectVars: string[]
  /** 余下的变量，即数据端函数的变量（MSB 在前）。 */
  highVars: string[]
  highAssignments: (0 | 1)[][]
  rows: MuxRow[]
}

export interface AdderMapping {
  kind: 'adder'
  bcd: boolean
  /** BCD 修正信号 K 的表达式，仅 bcd 为 true 时给出。 */
  correctionText: string | null
  correctionLatex: string | null
}

export interface ComparatorMapping {
  kind: 'comparator'
  bits: number
  stages: number
}

export interface ParityMapping {
  kind: 'parity'
  variables: string[]
  odd: boolean
  outputPin: string
}

export interface EncoderMapping {
  kind: 'encoder'
}

export type MsiMapping =
  | DecoderMapping
  | MuxMapping
  | AdderMapping
  | ComparatorMapping
  | ParityMapping
  | EncoderMapping

export interface MsiResult {
  chip: MsiChip
  chipName: string
  pins: MsiPin[]
  stages: MsiStage[]
  mapping: MsiMapping
  /** 所实现函数或功能的文字描述。 */
  functionText: string
  functionLatex: string | null
}

// ───────────────────────── 工具结果 ─────────────────────────

/** draw：由表达式生成门级网表并分析，结果与 analyze 同形（网表可由 gates 的 in / out / type 还原）。 */
export type CombOp = 'analyze' | 'map_msi' | 'draw'

export interface CombResultMap {
  analyze: AnalyzeResult
  map_msi: MsiResult
  draw: AnalyzeResult
}
