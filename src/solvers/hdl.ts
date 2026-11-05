// dlogic_hdl 的纯逻辑（不做 I/O，不依赖 DSH）：源码预处理、安全检查、顶层识别、规则匹配、
// iverilog 诊断解析、VCD 解析与看门狗模块生成。只使用可擦除的 TypeScript 语法。
import { DlogicInputError } from '../shared/contracts.ts'
import type { HdlOp, LintIssue, RuleHit, SimChange, SimSignal } from '../shared/hdl.ts'

export const HDL_OPS: HdlOp[] = ['lint', 'simulate']

export const HDL_LIMITS = {
  /** 源码上限（字节）。 */
  codeBytes: 64 * 1024,
  /** 仿真墙钟上限（毫秒）。 */
  wallMs: 10_000,
  /** 编译墙钟上限（毫秒）。 */
  compileMs: 10_000,
  /** testbench 输出上限（字节）。 */
  outputBytes: 20 * 1024,
  /** VCD 文件上限（字节）。 */
  vcdBytes: 1024 * 1024,
  /** 默认仿真时间上限（时间单位）。 */
  defaultMaxTime: 10_000,
  /** 仿真时间上限的最大值。 */
  maxTimeLimit: 1_000_000,
  /** 返回的信号数上限。 */
  signals: 16,
  /** 每个信号保留的变化次数上限。 */
  changesPerSignal: 300,
} as const

export function checkHdlOp(op: unknown): HdlOp {
  if (typeof op === 'string' && (HDL_OPS as string[]).includes(op)) return op as HdlOp
  if (op === undefined || op === null || op === '') throw new DlogicInputError('缺少 op：必须明确给出 "lint" 或 "simulate"。')
  throw new DlogicInputError(`未知的 op：${String(op)}，可选 lint、simulate。`)
}

export function checkCode(code: unknown): string {
  if (typeof code !== 'string' || code.trim() === '') throw new DlogicInputError('缺少 code：请提供 Verilog 源码（设计与 testbench）。')
  if (Buffer.byteLength(code, 'utf8') > HDL_LIMITS.codeBytes) {
    throw new DlogicInputError(`源码超过 ${HDL_LIMITS.codeBytes / 1024} KB，请精简后再提交。`)
  }
  return code
}

export function checkMaxTime(v: unknown): number {
  if (v === undefined) return HDL_LIMITS.defaultMaxTime
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > HDL_LIMITS.maxTimeLimit) {
    throw new DlogicInputError(`maxTimeUnits 须为 1～${HDL_LIMITS.maxTimeLimit} 之间的整数。`)
  }
  return v
}

// ───────────────────────── 源码预处理 ─────────────────────────

/**
 * 屏蔽注释（以及字符串内容，除非 keepStrings）。长度与换行保持不变，使行号与偏移量仍对应原文。
 */
export function maskSource(src: string, keepStrings = false): string {
  let out = ''
  let i = 0
  const n = src.length
  const blank = (ch: string) => (ch === '\n' || ch === '\r' ? ch : ' ')
  while (i < n) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') {
        out += blank(src[i])
        i++
      }
    } else if (ch === '/' && next === '*') {
      out += '  '
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += blank(src[i])
        i++
      }
      if (i < n) {
        out += '  '
        i += 2
      }
    } else if (ch === '"') {
      out += '"'
      i++
      while (i < n && src[i] !== '"' && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < n) {
          out += keepStrings ? src[i] + src[i + 1] : '  '
          i += 2
          continue
        }
        out += keepStrings ? src[i] : blank(src[i])
        i++
      }
      if (i < n && src[i] === '"') {
        out += '"'
        i++
      }
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** 行号（从 1 开始）。 */
export function lineAt(src: string, index: number): number {
  let line = 1
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i])) i++
  return i
}

/** 从 i（应为 "("）起，返回配对 ")" 之后的位置；不配对时返回 s.length。 */
function matchParen(s: string, i: number): number {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    if (s[j] === '(') depth++
    else if (s[j] === ')') {
      depth--
      if (depth === 0) return j + 1
    }
  }
  return s.length
}

const BLOCK_TOKEN = /\b(begin|fork|case[xz]?|end|endcase|join)\b/g
const BLOCK_OPEN = new Set(['begin', 'fork', 'case', 'casex', 'casez'])

/** 从 i 处的 begin/fork/case 起，返回与之配对的 end/endcase/join 之后的位置。 */
function blockEnd(s: string, i: number): number {
  const re = new RegExp(BLOCK_TOKEN.source, 'g')
  re.lastIndex = i
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    if (BLOCK_OPEN.has(m[1])) depth++
    else {
      depth--
      if (depth === 0) return m.index + m[0].length
    }
  }
  return s.length
}

/** 从语句起点 i 起，返回该语句结束后的位置（块语句到配对 end，否则到顶层分号）。 */
function stmtEnd(s: string, i: number): number {
  const j = skipWs(s, i)
  if (/^(begin|fork|case[xz]?)\b/.test(s.slice(j, j + 6))) return blockEnd(s, j)
  let depth = 0
  for (let k = j; k < s.length; k++) {
    if (s[k] === '(') depth++
    else if (s[k] === ')') depth--
    else if (s[k] === ';' && depth <= 0) return k + 1
  }
  return s.length
}

// ───────────────────────── 安全检查 ─────────────────────────

/** 禁止的系统任务：执行外部命令、读写文件或读取文件内容。 */
const BANNED_TASK = /\$(system|f(open|close|write\w*|display\w*|monitor\w*|strobe\w*|flush|scanf|gets|getc|read|seek|tell|eof|error)|sscanf|readmem[bh]|writemem[bh]|rewind)\b/

/**
 * 拒绝可能访问宿主文件系统或执行外部命令的源码。通过时返回；否则抛出带中文说明的 DlogicInputError。
 */
export function checkSafety(code: string): void {
  const masked = maskSource(code)
  const banned = BANNED_TASK.exec(masked)
  if (banned) {
    throw new DlogicInputError(
      `源码包含不允许的系统任务 ${banned[0]}（会访问文件或外部命令），已拒绝执行。仿真可使用 $display、$monitor、$dumpvars 等输出类任务。`,
    )
  }
  if (/`\s*include\b/.test(masked)) {
    throw new DlogicInputError('源码包含 `include，会读取宿主文件，已拒绝执行。请把所有代码写在同一段源码中。')
  }
  const withStrings = maskSource(code, true)
  const literal = /\$dumpfile\s*\(\s*"([^"]*)"\s*\)/g
  const calls = withStrings.match(/\$dumpfile\b/g)?.length ?? 0
  let ok = 0
  let m: RegExpExecArray | null
  while ((m = literal.exec(withStrings)) !== null) {
    const name = m[1]
    if (name === '' || /[\\/:]/.test(name) || name.includes('..')) {
      throw new DlogicInputError('$dumpfile 的文件名只能是当前目录下的简单文件名（不含路径）。')
    }
    ok++
  }
  if (calls !== ok) throw new DlogicInputError('$dumpfile 的文件名必须是字符串字面量，例如 $dumpfile("wave.vcd")。')
}

// ───────────────────────── 顶层模块识别 ─────────────────────────

export interface TopChoice {
  top: string
  warning: string | null
}

/** 指定 requested 时直接使用；否则选取未被其他模块实例化的模块，优先名字含 tb/test/bench 的。 */
export function detectTop(masked: string, requested?: string): TopChoice {
  const names: string[] = []
  for (const m of masked.matchAll(/\bmodule\s+([A-Za-z_]\w*)/g)) if (!names.includes(m[1])) names.push(m[1])
  if (names.length === 0) throw new DlogicInputError('源码中未找到 module 定义。')
  if (requested !== undefined) {
    if (!names.includes(requested)) {
      throw new DlogicInputError(`未找到顶层模块 ${requested}，源码中的模块有：${names.join('、')}。`)
    }
    return { top: requested, warning: null }
  }
  let roots = names.filter(n => (masked.match(new RegExp(`\\b${n}\\b`, 'g'))?.length ?? 0) <= 1)
  if (roots.length === 0) roots = [names[names.length - 1]]
  const preferred = roots.filter(n => /tb|test|bench/i.test(n))
  const top = preferred.length > 0 ? preferred[0] : roots[0]
  const warning = roots.length > 1 ? `检测到多个顶层候选模块（${roots.join('、')}），已选 ${top}；可用 top 参数指定。` : null
  return { top, warning }
}

/** 第一个 `timescale 指令，形如 "1ns/1ps"；没有时为 null。 */
export function timescaleOf(masked: string): string | null {
  const m = /`timescale\s+(\S+?)\s*\/\s*(\S+)/.exec(masked)
  return m ? `${m[1]}/${m[2]}` : null
}

/** 看门狗模块：独立文件，与设计一起编译为根模块；到达时间上限后输出标记并结束仿真。 */
export function buildWatchdog(maxTimeUnits: number, timescale: string | null): string {
  const lines: string[] = []
  if (timescale) lines.push('`timescale ' + timescale)
  lines.push(
    'module dlogic_watchdog;',
    '  initial begin',
    `    #${maxTimeUnits};`,
    '    $display("DLOGIC_WATCHDOG_TIMEOUT");',
    '    $finish;',
    '  end',
    'endmodule',
    '',
  )
  return lines.join('\n')
}

/** 自动注入的波形文件名（位于临时目录内，固定不变）。 */
export const AUTO_DUMP_FILE = 'dlogic_wave.vcd'

/** 屏蔽后的源码中是否已含 $dumpvars；已含时不再自动注入波形记录。 */
export function hasDumpvars(masked: string): boolean {
  return /\$dumpvars\b/.test(masked)
}

/** 自动波形记录的根模块：源码没有 $dumpvars 时与设计一起编译，记录顶层 testbench 的全部信号。top 须为已识别的模块名。 */
export function buildDumpRoot(top: string, timescale: string | null): string {
  const lines: string[] = []
  if (timescale) lines.push('`timescale ' + timescale)
  lines.push(
    'module dlogic_dump;',
    '  initial begin',
    `    $dumpfile("${AUTO_DUMP_FILE}");`,
    `    $dumpvars(0, ${top});`,
    '  end',
    'endmodule',
    '',
  )
  return lines.join('\n')
}

// ───────────────────────── 规则匹配 ─────────────────────────

/** 赋值号左侧紧邻的标识符（忽略位选择）。 */
function targetBefore(s: string, opIndex: number): string | null {
  const head = s.slice(Math.max(0, opIndex - 80), opIndex)
  const m = /([A-Za-z_]\w*)\s*(\[[^[\]]*\]\s*)?$/.exec(head)
  return m ? m[1] : null
}

interface AssignOp {
  kind: 'blocking' | 'nba'
  index: number
  target: string | null
}

/**
 * 扫描块体中括号外的赋值。同一语句内第二个赋值号视为比较（如 y = a <= b），不计入。
 */
function scanAssigns(body: string): AssignOp[] {
  const ops: AssignOp[] = []
  let depth = 0
  let seen = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ';' && depth <= 0) {
      seen = false
      depth = 0
    } else if (depth === 0) {
      if (ch === '<' && body[i + 1] === '=' && body[i - 1] !== '<') {
        if (!seen) ops.push({ kind: 'nba', index: i, target: targetBefore(body, i) })
        seen = true
        i++
      } else if (ch === '=' && body[i + 1] !== '=' && !'=!<>+-*/%&|^'.includes(body[i - 1] ?? '')) {
        if (!seen) ops.push({ kind: 'blocking', index: i, target: targetBefore(body, i) })
        seen = true
      }
    }
  }
  return ops
}

function hasAssignment(text: string): boolean {
  return /(^|[^=!<>])=(?!=)/.test(text) || /<=/.test(text)
}

function targetsOf(text: string): Set<string> {
  const out = new Set<string>()
  for (const op of scanAssigns(text)) if (op.target) out.add(op.target)
  return out
}

/**
 * 分支内赋值的信号，若在分支之前已在本块中赋过值（如先给默认值），则分支缺 else 不会推断锁存器。
 */
function latchRisk(body: string, at: number, branch: string): boolean {
  const assigned = targetsOf(branch)
  if (assigned.size === 0) return false
  const before = unconditionalTargets(body.slice(0, at))
  return [...assigned].some(name => !before.has(name))
}

/** 块中无条件执行的赋值目标：不位于 if / else / case 分支内的赋值。 */
function unconditionalTargets(text: string): Set<string> {
  const out = new Set<string>()
  for (const op of scanAssigns(text)) {
    if (!op.target) continue
    const head = text.slice(0, op.index)
    let start = 0
    let kind = ''
    let kindAt = -1
    for (const m of head.matchAll(/;|\bbegin\b|\bend\b|\belse\b/g)) {
      start = (m.index ?? 0) + m[0].length
      kind = m[0]
      kindAt = m.index ?? -1
    }
    const seg = head.slice(start)
    let conditional = kind === 'else' || /\b(if|case[xz]?)\b|:\s*$/.test(seg)
    if (kind === 'begin') {
      const pre = head.slice(0, kindAt).trimEnd()
      if (/[):]$|\belse$/.test(pre)) conditional = true
    }
    if (!conditional) out.add(op.target)
  }
  return out
}

/**
 * 规则匹配（不依赖 iverilog）：
 * - latch：组合 always / always_comb 中 if 无 else、case 无 default，且分支内有赋值，可能推断锁存器；
 * - nba-in-comb：组合块中使用非阻塞赋值 <=；
 * - blocking-in-seq：时序块（posedge/negedge）中使用阻塞赋值 =；
 * - multi-driver：同一信号被多个 always / assign 驱动。
 * 测试平台中不带敏感表的 always（如 always #5 clk = ~clk）不参与检查。
 */
export function ruleLint(code: string): RuleHit[] {
  const src = maskSource(code)
  const hits: RuleHit[] = []
  const drivers = new Map<string, { id: number; line: number }[]>()
  let blockId = 0

  const addDriver = (name: string, id: number, line: number) => {
    const list = drivers.get(name) ?? []
    list.push({ id, line })
    drivers.set(name, list)
  }

  for (const m of src.matchAll(/\bassign\s+([A-Za-z_]\w*)/g)) {
    blockId++
    addDriver(m[1], blockId, lineAt(src, m.index ?? 0))
  }

  for (const m of src.matchAll(/\balways(_comb|_ff|_latch)?\b/g)) {
    if (m[1] === '_latch') continue
    let i = skipWs(src, (m.index ?? 0) + m[0].length)
    let kind: 'comb' | 'seq' | null = null
    if (src[i] === '@') {
      i = skipWs(src, i + 1)
      let content = '*'
      if (src[i] === '(') {
        const close = matchParen(src, i)
        content = src.slice(i + 1, close - 1).trim()
        i = close
      } else if (src[i] === '*') {
        i++
      }
      kind = /posedge|negedge/.test(content) ? 'seq' : 'comb'
    } else if (m[1] === '_comb') kind = 'comb'
    else if (m[1] === '_ff') kind = 'seq'
    if (kind === null) continue

    i = skipWs(src, i)
    const end = stmtEnd(src, i)
    const body = src.slice(i, end)
    blockId++
    const id = blockId

    for (const op of scanAssigns(body)) {
      const line = lineAt(src, i + op.index)
      if (op.target) addDriver(op.target, id, line)
      if (kind === 'comb' && op.kind === 'nba') {
        hits.push({ rule: 'nba-in-comb', line, severity: 'warning', message: '组合逻辑块中使用了非阻塞赋值 <=，建议改用阻塞赋值 =。' })
      }
      if (kind === 'seq' && op.kind === 'blocking') {
        hits.push({ rule: 'blocking-in-seq', line, severity: 'warning', message: '时序逻辑块（posedge/negedge）中使用了阻塞赋值 =，建议改用非阻塞赋值 <=。' })
      }
    }

    if (kind === 'comb') {
      for (const m2 of body.matchAll(/\bif\b/g)) {
        const at = m2.index ?? 0
        let j = skipWs(body, at + 2)
        if (body[j] !== '(') continue
        j = skipWs(body, matchParen(body, j))
        const after = stmtEnd(body, j)
        const stmt = body.slice(j, after)
        const elseRe = /else\b/y
        elseRe.lastIndex = skipWs(body, after)
        if (!elseRe.test(body) && hasAssignment(stmt) && latchRisk(body, at, stmt)) {
          hits.push({
            rule: 'latch',
            line: lineAt(src, i + at),
            severity: 'warning',
            message: 'if 没有 else 分支，组合逻辑块中可能推断出锁存器；请在每个分支赋予明确的值，或在 always 开头给默认值。',
          })
        }
      }
      for (const m2 of body.matchAll(/\bcase[xz]?\b/g)) {
        const at = m2.index ?? 0
        const endRe = /\bendcase\b/g
        endRe.lastIndex = at
        const e = endRe.exec(body)
        const span = body.slice(at, e ? e.index : body.length)
        if (!/\bdefault\b/.test(span) && hasAssignment(span) && latchRisk(body, at, span)) {
          hits.push({
            rule: 'case-default',
            line: lineAt(src, i + at),
            severity: 'warning',
            message: 'case 没有 default 分支，组合逻辑块中可能推断出锁存器；建议补充 default 并给出赋值。',
          })
        }
      }
    }
  }

  for (const [name, list] of drivers) {
    const firstId = list[0].id
    const other = list.find(d => d.id !== firstId)
    if (other) {
      hits.push({
        rule: 'multi-driver',
        line: other.line,
        severity: 'error',
        message: `信号 ${name} 被多个 always 或 assign 驱动，综合时会产生多驱动冲突。`,
      })
    }
  }

  // 同一行、同一规则只保留一条，避免刷屏
  const seen = new Set<string>()
  return hits
    .sort((a, b) => a.line - b.line)
    .filter(h => {
      const key = `${h.rule}:${h.line}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// ───────────────────────── iverilog 诊断解析 ─────────────────────────

/**
 * 解析 iverilog 的输出（stderr 与 stdout 合并后的文本）。只保留 fileName 对应文件的诊断；
 * 以 ":" 开头的续行并入上一条诊断。
 */
export function parseIverilogOutput(text: string, fileName = 'design.v'): LintIssue[] {
  const issues: LintIssue[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd()
    if (line === '') continue
    const m = /^(?:(.+?):)?(\d+):\s*(.*)$/.exec(line)
    if (m) {
      const file = m[1]
      if (file !== undefined && !file.endsWith(fileName)) continue
      const rest = m[3]
      if (rest.startsWith(':')) {
        const last = issues[issues.length - 1]
        if (last) last.message = `${last.message} ${rest.slice(1).trim()}`.trim()
        continue
      }
      issues.push(toIssue(Number(m[2]), rest))
      continue
    }
    const bare = /^(error|warning|sorry):\s*(.*)$/.exec(line)
    if (bare) issues.push({ line: null, severity: bare[1] === 'error' ? 'error' : 'warning', message: bare[2] })
  }
  return issues
}

function toIssue(line: number, rest: string): LintIssue {
  const tagged = /^(error|warning|sorry):\s*(.*)$/.exec(rest)
  if (tagged) return { line, severity: tagged[1] === 'error' ? 'error' : 'warning', message: tagged[2] }
  // "design.v:5: syntax error" 等无前缀的诊断视为错误
  return { line, severity: 'error', message: rest }
}

/** 编译失败时的简短中文说明（最多 5 条）。 */
export function formatCompileErrors(issues: LintIssue[]): string {
  const errs = issues.filter(i => i.severity === 'error')
  const shown = errs.slice(0, 5).map(i => (i.line === null ? i.message : `第 ${i.line} 行：${i.message}`))
  const more = errs.length > 5 ? `；另有 ${errs.length - 5} 条` : ''
  return shown.length ? shown.join('；') + more : '编译未通过'
}

// ───────────────────────── VCD 解析 ─────────────────────────

export interface VcdParse {
  timescale: string | null
  signals: SimSignal[]
  /** 信号数或变化数超过上限时为 true。 */
  truncated: boolean
}

const BARE_KEYWORDS = new Set(['$end', '$enddefinitions', '$dumpvars', '$dumpall', '$dumpon', '$dumpoff'])

/**
 * 解析 VCD 文本。只保留前 maxSignals 个变量，每个变量保留前 maxChanges 次变化（相同取值的连续变化合并）。
 * 名称为作用域路径加变量名，例如 "tb.dut.q"。
 */
export function parseVcd(text: string, opts: { maxSignals?: number; maxChanges?: number } = {}): VcdParse {
  const maxSignals = opts.maxSignals ?? HDL_LIMITS.signals
  const maxChanges = opts.maxChanges ?? HDL_LIMITS.changesPerSignal
  const tokens = text.split(/\s+/).filter(t => t !== '')
  const scope: string[] = []
  const byId = new Map<string, SimSignal | null>()
  const signals: SimSignal[] = []
  let timescale: string | null = null
  let truncated = false
  let time = 0

  const pushChange = (sig: SimSignal, value: string) => {
    const last = sig.changes[sig.changes.length - 1]
    if (last && last.value === value) return
    if (sig.changes.length >= maxChanges) {
      truncated = true
      return
    }
    const change: SimChange = { time, value }
    sig.changes.push(change)
  }

  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (tok === '$timescale') {
      const parts: string[] = []
      i++
      while (i < tokens.length && tokens[i] !== '$end') parts.push(tokens[i++])
      if (timescale === null && parts.length) timescale = parts.join('')
      i++
    } else if (tok === '$scope') {
      // $scope <type> <name> $end
      scope.push(tokens[i + 2] ?? '')
      while (i < tokens.length && tokens[i] !== '$end') i++
      i++
    } else if (tok === '$upscope') {
      scope.pop()
      while (i < tokens.length && tokens[i] !== '$end') i++
      i++
    } else if (tok === '$var') {
      // $var <type> <size> <id> <reference> [range] $end
      const parts: string[] = []
      i++
      while (i < tokens.length && tokens[i] !== '$end') parts.push(tokens[i++])
      i++
      const width = Number(parts[1])
      const id = parts[2]
      const ref = parts[3] ?? ''
      if (id !== undefined && !byId.has(id)) {
        if (signals.length < maxSignals) {
          const sig: SimSignal = {
            name: [...scope, ref].filter(Boolean).join('.'),
            width: Number.isFinite(width) && width > 0 ? width : 1,
            changes: [],
          }
          signals.push(sig)
          byId.set(id, sig)
        } else {
          truncated = true
          byId.set(id, null)
        }
      }
    } else if (BARE_KEYWORDS.has(tok)) {
      // 无内容的关键字（$end、$dumpvars 等）：只跳过本身，其后的取值照常解析
      i++
    } else if (tok.startsWith('$')) {
      // $dumpvars、$date、$comment 等：跳过到 $end
      while (i < tokens.length && tokens[i] !== '$end') i++
      i++
    } else if (tok.startsWith('#')) {
      const t = Number(tok.slice(1))
      if (Number.isFinite(t)) time = t
      i++
    } else if (/^[01xzXZ]/.test(tok) && tok.length > 1) {
      const sig = byId.get(tok.slice(1))
      if (sig) pushChange(sig, tok[0].toLowerCase())
      i++
    } else if (/^[bBrR]/.test(tok)) {
      const sig = i + 1 < tokens.length ? byId.get(tokens[i + 1]) : undefined
      if (sig) pushChange(sig, tok.slice(1).toLowerCase())
      i += 2
    } else {
      i++
    }
  }
  return { timescale, signals, truncated }
}
