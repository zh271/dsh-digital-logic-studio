// dlogic_seq 的共享类型：触发器、时序电路分析、计数器、移位寄存器与波形数据。
// StateGraph 同时供 dlogic_fsm 与前端 StateGraphView 使用。只允许可擦除的 TypeScript 语法。

/** 触发器与锁存器类型。SR_LATCH 为与非门基本 SR 锁存器（低电平有效）；GATED_* 为 CP 高电平有效的门控锁存器。 */
export type FfKind = 'SR' | 'D' | 'JK' | 'T' | 'SR_LATCH' | 'GATED_SR' | 'GATED_D'

/** 时序分析支持的触发器类型（边沿触发）。 */
export type ClockedFfKind = 'SR' | 'D' | 'JK' | 'T'

export type Bit = 0 | 1

/** 次态取值：'X' 表示禁止（×）。 */
export type NextBit = Bit | 'X'

/** 状态图节点。无效状态 valid 为 false；initial 标出初态。 */
export interface StateNode {
  id: string
  label: string
  valid: boolean
  initial?: boolean
}

/** 状态图有向边。label 形如 "1/0"（输入/输出）；同一对节点的多条边合并，标签以 ", " 连接。 */
export interface StateEdge {
  from: string
  to: string
  label: string
}

export interface StateGraph {
  nodes: StateNode[]
  edges: StateEdge[]
}

// ───────────────────────── 触发器（op = ff） ─────────────────────────

export interface FfRow {
  /** 现态 Qn。 */
  q: Bit
  /** 输入取值（按 FfResult.inputs 顺序）。 */
  inputs: Record<string, Bit>
  /** 次态 Qn+1；'X' 为禁止。 */
  next: NextBit
}

export interface FfExcitation {
  from: Bit
  to: Bit
  /** 实现该转换所需的输入；'X' 表示任意取值（无关项）。 */
  drive: Record<string, NextBit>
}

export interface FfResult {
  kind: FfKind
  title: string
  /** edge 边沿触发；level 电平触发（门控）；none 无时钟（基本锁存器）。 */
  trigger: 'edge' | 'level' | 'none'
  inputs: string[]
  /** 特性方程，纯文本，例如 "Q* = JQ' + K'Q"。 */
  characteristic: string
  latex: string
  constraint: string | null
  table: FfRow[]
  excitation: FfExcitation[]
}

// ───────────────────────── 时序电路分析（op = analyze） ─────────────────────────

export interface FlipFlopSpec {
  /** 触发器的 Q 名，例如 "Q1"；也作为表达式中的变量名。 */
  name: string
  kind: ClockedFfKind
  /** 各输入端的驱动表达式，例如 [{pin:"J", expr:"X"}, {pin:"K", expr:"Q0"}]。 */
  drives: { pin: string; expr: string }[]
}

export interface OutputSpec {
  name: string
  expr: string
}

export interface AnalyzeResult {
  /** 触发器 Q 名，按书写顺序；状态字符串的第 i 位对应第 i 个触发器。 */
  stateNames: string[]
  inputNames: string[]
  drives: { ff: string; kind: ClockedFfKind; pin: string; expr: string }[]
  stateEquations: { ff: string; text: string; latex: string }[]
  outputs: { name: string; expr: string; type: 'Moore' | 'Mealy' }[]
  /** 初态字符串。 */
  initial: string
  /** 状态表：每个现态与每种输入一行。 */
  table: {
    state: string
    input: string
    next: string
    outputs: { name: string; value: Bit }[]
    valid: boolean
  }[]
  /** 有效状态（从初态出发进入的循环上的状态）。 */
  validStates: string[]
  /** 各输入取值下，从初态进入的有效循环。 */
  cycles: { input: string; states: string[] }[]
  selfStart: boolean
  /** 无效状态的流向：从无效状态出发，经最短路径进入有效状态（reached 为 true）；无法进入时 path 仅含该状态。 */
  invalidPaths: { from: string; path: string[]; reached: boolean }[]
  graph: StateGraph
}

// ───────────────────────── 计数器（op = counter） ─────────────────────────

export type CounterModel = '160' | '161' | '163'
export type CounterMethod = 'reset' | 'preset'

export interface CounterResult {
  model: CounterModel
  method: CounterMethod
  N: number
  /** 1 片或 2 片级联。 */
  chips: 1 | 2
  /** 芯片自然模（1 片为 10 或 16，2 片为 100 或 256）。 */
  modulus: number
  natural: boolean
  /** 输出位的名称，从最高位到最低位；级联时高片为 H，低片为 L。 */
  bitNames: string[]
  feedback: {
    /** async 异步清零；sync 同步清零或同步置数；none 无反馈。 */
    kind: 'async' | 'sync' | 'none'
    /** 控制信号名：CR̄ 或 LD̄；无反馈时为 null。 */
    signal: string | null
    /** 反馈译码的状态（位串）；无反馈时为 null。 */
    decode: string | null
    /** 反馈表达式，例如 "CR̄ = (Q2Q1)'"；无反馈时为空串。 */
    expr: string
  }
  /** 置数法的预置数据 D（位串）；清零法为 null。 */
  load: { value: number; bits: string } | null
  /** 状态序列：一个完整循环，异步清零时在末尾给出过渡态（transient 为 true）。 */
  sequence: { index: number; value: number; bits: string; transient: boolean }[]
  /** 是否存在毛刺（过渡态）。 */
  glitch: boolean
  transient: string | null
}

// ───────────────────────── 移位寄存器与环形、扭环计数器（op = shift） ─────────────────────────

export type ShiftKind = '194' | 'ring' | 'johnson'

export interface ShiftResult {
  kind: ShiftKind
  bits: number
  direction: 'left' | 'right' | null
  /** 初态字符串，从 Q(n-1) 到 Q0。 */
  init: string
  /** 驱动关系，纯文本。 */
  feedback: string
  /** 状态序列：从初态开始，到第一次重复为止。valid 表示是否在有效循环上。 */
  sequence: { step: number; state: string; valid: boolean }[]
  /** 有效循环的模（实际），无法计算时为 null。 */
  modulus: number | null
  /** 标准模：环形为 n，扭环为 2n；194 为 null。 */
  expectedModulus: number | null
  validCycle: string[] | null
  /** 全部循环（含有效与无效）。194 为 null。 */
  cycles: { states: string[]; valid: boolean }[] | null
  selfStart: boolean | null
  invalidPaths: { from: string; path: string[]; reached: boolean }[]
  graph: StateGraph | null
}

// ───────────────────────── 时序波形（op = waveform） ─────────────────────────

export type WaveTarget = 'ff' | 'analyze' | 'counter' | 'shift'

export interface WaveSignal {
  name: string
  /** 每个时钟周期一个字符：'0' '1' 为电平，'x' 为不定，'p' 为时钟（CP）。 */
  wave: string
  role: 'clock' | 'input' | 'state' | 'output'
}

export interface WaveformResult {
  target: WaveTarget
  steps: number
  signals: WaveSignal[]
}

// ───────────────────────── 工具分派 ─────────────────────────

export type SeqOp = 'ff' | 'analyze' | 'counter' | 'shift' | 'waveform'

export interface SeqResultMap {
  ff: FfResult
  analyze: AnalyzeResult
  counter: CounterResult
  shift: ShiftResult
  waveform: WaveformResult
}
