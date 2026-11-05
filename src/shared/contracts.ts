// 各模块之间的共享数据契约。Host、求解器、前端都只依赖这里的类型。
// 修改本文件前先与负责人确认：它是并行开发的“接口合同”。
// 只允许可擦除的 TypeScript 语法（不用 enum / namespace），以便 Node 直接运行测试。

// ───────────────────────── 通用 ─────────────────────────

/** 所有 dlogic_* 工具返回的信封。 */
export interface Envelope<R> {
  ok: boolean
  op: string
  /** ok 为 false 时为 null。 */
  result: R | null
  /** ok 为 false 时的原因（中文，给用户看）。 */
  error?: string
  /** 分步过程，给模型讲解、给前端渲染。 */
  steps: Step[]
  warnings: string[]
}

export interface Step {
  /** 步骤类型，前端按 kind 选择渲染方式；未知 kind 只显示 text。 */
  kind: string
  /** 一句话说明（中文）。 */
  text: string
  [extra: string]: unknown
}

/** 求解器遇到非法输入时抛出；工具层把它转成 ok: false。 */
export class DlogicInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DlogicInputError'
  }
}

/** 工具写入 presentationMeta 的统一格式；前端据此回放卡片。 */
export interface ToolMeta<R> {
  v: 1
  tool: string
  value: Envelope<R>
}

// ───────────────────────── 布尔函数（dlogic_bool） ─────────────────────────

/**
 * 一个布尔函数的规范描述。
 * 最小项编号约定：variables[0] 是最高位（MSB）。例如变量 [A,B,C] 时 m5 = A·B'·C。
 */
export interface BoolSpec {
  variables: string[]
  minterms: number[]
  dontCares: number[]
}

/** 蕴涵项（乘积项或和项）。 */
export interface Implicant {
  /** 按 variables 顺序的三值掩码，例如 "1-0" 表示 A·C'（SOP）。 */
  mask: string
  /** 覆盖的最小项（SOP）或最大项（POS）编号，升序。 */
  covers: number[]
  /** 文字（literal）个数。 */
  literals: number
  /** 纯文本写法：SOP 项如 "AC'"，POS 项如 "(A+C')"；全 "-" 时为 "1"（SOP）或 "0"（POS）。 */
  text: string
  /** KaTeX 写法：如 "A\\overline{C}"。 */
  latex: string
}

export interface MinimizeResult {
  form: 'SOP' | 'POS'
  primeImplicants: Implicant[]
  /** 本质质蕴涵项的 mask 列表。 */
  essential: string[]
  /** 全部等价的最简解；每个解是若干蕴涵项。按 (项数, 文字数) 代价排序后，只保留代价最小的那些。 */
  solutions: Implicant[][]
  /** 与 solutions 一一对应的完整表达式。 */
  texts: string[]
  latex: string[]
  cost: { terms: number; literals: number }
}

export interface TruthTableRow {
  index: number
  inputs: (0 | 1)[]
  output: 0 | 1 | 'X'
}

export interface TruthTable {
  variables: string[]
  rows: TruthTableRow[]
}

/**
 * 卡诺图布局。2～4 变量：单个平面。5 变量：两个 4 变量平面，
 * 由 variables[0] 区分（plane 0 表示该变量为 0）。
 * 行、列都按格雷码顺序排列。
 */
export interface KMapLayout {
  variables: string[]
  /** 行变量与列变量（不含 5 变量时的平面变量）。 */
  rowVars: string[]
  colVars: string[]
  /** 行、列的格雷码标签，例如 ["00","01","11","10"]。 */
  rowCodes: string[]
  colCodes: string[]
  planes: number
  /** 平面变量名（5 变量时为 variables[0]，否则为 null）。 */
  planeVar: string | null
  cells: { plane: number; row: number; col: number; minterm: number; value: 0 | 1 | 'X' }[]
  /** 化简后的圈组：每个圈对应一个蕴涵项，列出它覆盖的格子（最小项编号）。 */
  groups: { mask: string; text: string; latex: string; cells: number[] }[]
}

export interface HazardResult {
  /** 静态 1 型险象（基于最简 SOP）：相邻的两个 1 格不在同一个圈里。 */
  static1: { a: number; b: number; variable: string; consensus: Implicant }[]
  /** 静态 0 型险象（基于最简 POS）。 */
  static0: { a: number; b: number; variable: string; consensus: Implicant }[]
  /** 消除险象后的 SOP（加入冗余项）。 */
  hazardFreeSop: string
  hazardFreeSopLatex: string
}

export interface GateForms {
  /** 与非-与非形式，例如 "((AB)'(CD)')'"。 */
  nandNand: string
  nandNandLatex: string
  /** 或非-或非形式。 */
  norNor: string
  norNorLatex: string
  /** 与或非形式：F = (Σ 反函数的最简与或)'。 */
  andOrInvert: string
  andOrInvertLatex: string
}

export interface EquivalenceResult {
  equivalent: boolean
  /** 不等价时给出一个反例：输入编号及两边的取值。 */
  counterexample?: { index: number; inputs: (0 | 1)[]; left: 0 | 1; right: 0 | 1 }
}

export interface CanonicalResult {
  sigma: string
  pi: string
  sopText: string
  sopLatex: string
  posText: string
  posLatex: string
}

export type BoolOp =
  | 'parse'
  | 'truth_table'
  | 'canonical'
  | 'minimize'
  | 'kmap'
  | 'hazard'
  | 'complement'
  | 'dual'
  | 'gate_form'
  | 'equivalent'

/** dlogic_bool 各 op 的 result 结构（Envelope.result）。每个结果都带上所用的函数 spec。 */
export interface BoolResultMap {
  parse: { spec: BoolSpec; input: string }
  truth_table: { spec: BoolSpec; table: TruthTable }
  canonical: { spec: BoolSpec; canonical: CanonicalResult }
  minimize: { spec: BoolSpec; minimize: MinimizeResult }
  kmap: { spec: BoolSpec; kmap: KMapLayout; minimize: MinimizeResult }
  hazard: { spec: BoolSpec; hazard: HazardResult }
  complement: { input: string; text: string; latex: string }
  dual: { input: string; text: string; latex: string }
  gate_form: { spec: BoolSpec; gates: GateForms }
  equivalent: { left: BoolSpec; right: BoolSpec; equivalence: EquivalenceResult }
}

/** dlogic_verify（op = check）的 result。 */
export interface VerifyResult {
  equivalent: boolean
  counterexample?: EquivalenceResult['counterexample']
  variables: string[]
  /** candidate 是 SOP/POS 形式时给出代价。 */
  candidateCost?: { terms: number; literals: number }
  /** requireMinimal 时：是否达到最简代价；无法判断时为 null。 */
  minimal?: boolean | null
  minimalCost?: { terms: number; literals: number }
  /** 只有 reveal 为 true 时才给出参考答案。 */
  reference?: { texts: string[]; latex: string[] }
}

/** dlogic_knowledge 的 result。 */
export interface KnowledgeResultMap {
  lookup: { nodes: KnowledgeNode[]; missing: string[] }
  neighbors: {
    node: KnowledgeNode
    parent: KnowledgeNode | null
    children: KnowledgeNode[]
    prereqs: KnowledgeNode[]
    dependents: KnowledgeNode[]
    related: KnowledgeNode[]
  }
  search: { query: string; nodes: KnowledgeNode[] }
}

// ───────────────────────── 学习树（dlogic_card / dlogic_knowledge） ─────────────────────────

export type CardKind = 'solution' | 'concept' | 'tutor' | 'practice' | 'compare' | 'summary'

export type FollowupAngle =
  | 'principle' // 原理：为什么
  | 'variant' // 变式：换个条件
  | 'pitfall' // 易错
  | 'prerequisite' // 前置知识
  | 'verify' // 用工具验证
  | 'practice' // 出一道练习
  | 'free' // 模型自拟

export interface Followup {
  question: string
  angle: FollowupAngle
  /** 半句话推荐理由。 */
  why: string
  /** 对应的知识点 id（来自知识图谱）。 */
  knowledgeId?: string
}

/** 模型调用 dlogic_card 时传入的参数。 */
export interface CardInput {
  title: string
  kind: CardKind
  /** 一两句话概括本卡片回答了什么。 */
  summary: string
  knowledgeIds: string[]
  followups: Followup[]
  /** 由哪张卡片的追问展开；根卡片为 null。 */
  parentId: string | null
  /** 展开的是父卡片的第几个追问（从 0 开始）；用户自由提问时省略。 */
  parentFollowup?: number
}

/** 工具执行后的卡片记录（Host 分配 nodeId）。 */
export interface CardRecord extends CardInput {
  /** 由 callId 派生的短 id，形如 "c7K2Q"。 */
  nodeId: string
  callId: string
  /** 与 knowledgeIds 一一对应的知识点名称（Host 登记时从知识图谱解析）；旧卡片没有此字段，显示时回退为编号。 */
  knowledgeNames?: string[]
  /** 综合卡片（对比/总结/复习提纲）的来源卡片 nodeId 列表；普通卡片没有此字段。 */
  sources?: string[]
}

/** 学习树投影的前端视图（会话投影 key = TREE_PROJECTION_KEY）。 */
export interface TreeView {
  v: 1
  /** 按出现顺序排列的全部卡片。 */
  nodes: CardRecord[]
}

export const TREE_PROJECTION_KEY = 'dlogicTree'

/**
 * 点击追问时发送的提问前缀，例如 "【追问 c7K2Q#1】"。
 * 技能要求模型据此填写 parentId 与 parentFollowup。
 */
export function followupPrefix(nodeId: string, index: number): string {
  return `【追问 ${nodeId}#${index}】`
}

/** 知识图谱中的一个知识点。 */
export interface KnowledgeNode {
  /** 形如 "k1.5.2"，对应教材小节号；章节级为 "k1"、"k1.5"。 */
  id: string
  title: string
  chapter: number
  /** 前置知识 id。 */
  prereqs: string[]
  /** 相关知识 id（双向关系只需在一侧写）。 */
  related: string[]
  keywords: string[]
}
