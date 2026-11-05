// dlogic_mem 的数据契约：存储器扩展（expand）、ROM 实现函数（rom_func）、PLA / PAL 阵列（pla / pal）、LUT 掩码（lut）。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace），以便 Node 直接运行测试。

import type { MsiWire } from './comb.ts'

export type MemOp = 'expand' | 'rom_func' | 'pla' | 'pal' | 'lut'

// ───────────────────────── 存储器扩展（expand） ─────────────────────────

/** 规格：字数 × 位数。 */
export interface MemSize {
  words: number
  bits: number
  /** 容量（位）= 字数 × 位数。 */
  capacity: number
  /** 地址线位数 = log2(字数)。 */
  addressBits: number
}

/** 扩展方式：bit 位扩展、word 字扩展、both 字位扩展。 */
export type ExpandMode = 'bit' | 'word' | 'both'

export interface ExpandChip {
  /** 片号，从 1 开始。 */
  index: number
  /** 字组号（从 0 开始）：同一字组的芯片共享一个片选。 */
  wordGroup: number
  /** 位组号（从 0 开始）：同一位组的芯片数据位不同、地址线并联。 */
  bitGroup: number
  /** 本片接入的系统数据位范围（闭区间 D_low ～ D_high）。 */
  dataLow: number
  dataHigh: number
  /** 片选来源：138 的低有效输出（如 "Y̅1"），或 "GND"（字向不扩展时常选通）。 */
  select: string
}

/** 某字组的地址区间（闭区间，十进制与十六进制）。 */
export interface AddressRange {
  wordGroup: number
  chips: number[]
  low: number
  high: number
  lowHex: string
  highHex: string
}

/** 存储器阵列的译码结构（单译码或双译码）。 */
export interface DecodeInfo {
  mode: 'single' | 'double'
  addressBits: number
  /** 单译码时等于地址位数；双译码时为行译码位数。 */
  rowBits: number
  /** 双译码时为列译码位数，单译码时为 0。 */
  colBits: number
  rows: number
  cols: number
  /** 译码器输出线数：单译码为 2^n，双译码为 2^r + 2^c。 */
  decoderLines: number
  /** 每一位的存储单元数（2^n）。 */
  cellsPerBit: number
  note: string
}

export interface ExpandResult {
  mode: ExpandMode
  target: MemSize
  chip: MemSize
  wordGroups: number
  bitGroups: number
  chipCount: number
  /** 系统地址线中直接并接到各片的低位（A0 ～ A(k-1)）。 */
  chipAddressLines: string[]
  /** 进入片选译码的高位地址线（高位在前）；字向不扩展时为空。 */
  selectLines: string[]
  /** 片选译码用的 74LS138 接线；字向不扩展时为 null。 */
  decoder: { chip: '138'; wiring: MsiWire[]; outputs: string[] } | null
  chips: ExpandChip[]
  addressMap: AddressRange[]
  decode: DecodeInfo | null
}

// ───────────────────────── ROM 实现函数（rom_func） ─────────────────────────

export interface RomRow {
  /** 地址（十进制）。 */
  address: number
  /** 地址的二进制，variables[0] 在最左。 */
  addressBits: string
  /** 各输出位（与 outputNames 同序）。 */
  data: (0 | 1)[]
  /** 数据字的二进制写法，第一个输出在最左（高位）。 */
  word: string
  /** 数据字的十六进制（不带 H）。 */
  hex: string
}

export interface RomResult {
  variables: string[]
  outputNames: string[]
  /** 容量：字数 2^n，位数为输出个数。 */
  size: MemSize
  functions: { name: string; text: string; latex: string }[]
  rows: RomRow[]
}

// ───────────────────────── PLA / PAL 阵列（pla / pal） ─────────────────────────

export interface PlaTerm {
  /** 乘积项编号，P1、P2 …… */
  label: string
  /** 每个变量：'1' 原变量，'0' 反变量，'-' 不出现（与 variables 同序）。 */
  mask: string
  text: string
  latex: string
  literals: number
  /** 使用本乘积项的输出名。 */
  usedBy: string[]
}

export interface PlaOutput {
  name: string
  text: string
  latex: string
  /** 本输出接入的乘积项编号。 */
  termLabels: string[]
  /** PAL 时：接入的项数超过每输出固定的项数。 */
  overflow: boolean
}

export interface PlaResult {
  kind: 'pla' | 'pal'
  variables: string[]
  terms: PlaTerm[]
  outputs: PlaOutput[]
  /** 与阵列的列标签：每个变量两列（原变量、反变量）。 */
  andColumns: string[]
  /** 与阵列点阵：行为乘积项，列为 andColumns。 */
  andDots: boolean[][]
  /** 或阵列点阵：行为乘积项，列为输出。 */
  orDots: boolean[][]
  /** PAL：每个输出固定的乘积项数；PLA 为 null。 */
  termsPerOutput: number | null
  cost: { terms: number; literals: number }
  /** 各输出分别化简时的项数之和（用于说明共用节省）。 */
  separateTerms: number
}

// ───────────────────────── LUT 掩码（lut） ─────────────────────────

export interface LutSingle {
  kind: 'single'
  variables: string[]
  /** 16 位配置掩码，高地址在前（最左为地址 15）。 */
  mask: string
  /** 4 位十六进制（不带 H）。 */
  hex: string
  /** LUT 输入 I3 ～ I0 的接线。 */
  pins: MsiWire[]
  rows: { address: number; addressBits: string; value: 0 | 1 }[]
  functionText: string
  functionLatex: string
}

export interface LutCofactor {
  /** 高位变量的取值，例如 "A=0 B=1"。 */
  assignment: string
  /** 子函数的变量（4 个）。 */
  variables: string[]
  mask: string
  hex: string
}

export interface LutSplit {
  kind: 'split'
  variables: string[]
  /** 用于香农展开的高位变量。 */
  splitVars: string[]
  /** 子函数 LUT 的输入变量（4 个）。 */
  lutVars: string[]
  pins: MsiWire[]
  cofactors: LutCofactor[]
  functionText: string
  functionLatex: string
}

export type LutResult = LutSingle | LutSplit

// ───────────────────────── 工具结果 ─────────────────────────

export interface MemResultMap {
  expand: ExpandResult
  rom_func: RomResult
  pla: PlaResult
  pal: PlaResult
  lut: LutResult
}
