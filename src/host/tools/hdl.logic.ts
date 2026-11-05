// dlogic_hdl 的逻辑：参数结构、静态检查与仿真的编排、中文渲染。纯解析在 solvers/hdl.ts；进程调用在 hdl.exec.ts。
import fs from 'node:fs'
import path from 'node:path'
import { DlogicInputError, type Envelope, type Step } from '../../shared/contracts.ts'
import type { HdlResult, LintIssue, LintResult, SimEnd, SimSignal, SimulateResult } from '../../shared/hdl.ts'
import { normalizeUnit, simFinishLabel, timeUnitOf } from '../../shared/hdl.ts'
import {
  HDL_LIMITS,
  buildDumpRoot,
  buildWatchdog,
  checkCode,
  checkHdlOp,
  checkMaxTime,
  checkSafety,
  detectTop,
  formatCompileErrors,
  hasDumpvars,
  maskSource,
  parseIverilogOutput,
  parseVcd,
  ruleLint,
  timescaleOf,
} from '../../solvers/hdl.ts'
import { childEnv, findIverilogDir, firstVcd, iverilogVersion, runProcess, toolFile, vcdBytesIn, withTempDir } from './hdl.exec.ts'

export const HDL_PARAMETERS = {
  op: {
    type: 'string',
    required: true,
    enum: ['lint', 'simulate'],
    description: 'lint 静态检查（iverilog 诊断加规则匹配）；simulate 编译运行 testbench，返回输出与波形。',
  },
  code: {
    type: 'string',
    required: true,
    description: 'Verilog 源码。设计与 testbench 放在同一段代码中，不超过 64 KB。禁止 $system、文件读写类系统任务与 `include。',
  },
  top: {
    type: 'string',
    description: 'simulate：顶层 testbench 模块名。缺省时自动识别未被其他模块实例化的模块。',
  },
  maxTimeUnits: {
    type: 'integer',
    description: `simulate：仿真时间上限（testbench 的时间单位），默认 ${HDL_LIMITS.defaultMaxTime}，最大 ${HDL_LIMITS.maxTimeLimit}；到达后强制结束。`,
  },
} as const

export interface HdlArgs {
  op: string
  code?: string
  top?: string
  maxTimeUnits?: number
}

const NOTICE_RULES_ONLY =
  '本机未找到 iverilog，只完成了规则匹配，未做编译检查，检查能力已降级。安装 Icarus Verilog 后可启用完整检查；若已安装，设置环境变量 DLOGIC_IVERILOG_DIR 指向其所在目录。'

const ERR_NO_IVERILOG =
  '未找到 iverilog，无法仿真。请安装 Icarus Verilog（MSYS2 下可用 pacman -S mingw-w64-ucrt-x86_64-iverilog），并设置环境变量 DLOGIC_IVERILOG_DIR 指向其所在目录。'

const END_TEXT: Record<SimEnd, string> = {
  finish: '遇到 $finish 正常结束',
  timeout: '达到时间上限，已强制结束',
  idle: '事件耗尽，自行结束（未调用 $finish）',
  wall_clock: `运行超过 ${HDL_LIMITS.wallMs / 1000} 秒，已强制结束`,
  output_limit: `输出超过 ${HDL_LIMITS.outputBytes / 1024} KB，已截断并结束`,
  vcd_limit: `VCD 超过 ${HDL_LIMITS.vcdBytes / 1024 / 1024} MB，已结束`,
}

const WATCHDOG_MARKER = 'DLOGIC_WATCHDOG_TIMEOUT'

interface Outcome {
  result: HdlResult
  steps: Step[]
  warnings: string[]
}

/** iverilogDir 缺省时自动查找；传 null 可模拟未安装 iverilog 的降级路径（测试用）。 */
export async function runHdl(args: HdlArgs, iverilogDir: string | null = findIverilogDir()): Promise<Envelope<HdlResult>> {
  let op: string = String(args.op)
  try {
    op = checkHdlOp(args.op)
    const out = op === 'lint' ? await lint(args, iverilogDir) : await simulate(args, iverilogDir)
    // 宿主要求输出可无损序列化为 JSON：去掉值为 undefined 的键。
    const clean = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T
    return { ok: true, op, result: clean(out.result), steps: clean(out.steps), warnings: out.warnings }
  } catch (error) {
    if (error instanceof DlogicInputError) return { ok: false, op, result: null, error: error.message, steps: [], warnings: [] }
    throw error
  }
}

// ───────────────────────── 静态检查 ─────────────────────────

async function lint(args: HdlArgs, dir: string | null): Promise<Outcome> {
  const code = checkCode(args.code)
  checkSafety(code)
  const ruleHits = ruleLint(code)
  if (dir === null) {
    const result: LintResult = { engine: 'rules', iverilogVersion: null, issues: [], ruleHits, notice: NOTICE_RULES_ONLY }
    return { result, steps: [{ kind: 'lint', text: `规则匹配：${ruleHits.length} 条提示（未运行 iverilog）` }], warnings: [NOTICE_RULES_ONLY] }
  }
  const issues = await withTempDir(async tmp => {
    fs.writeFileSync(path.join(tmp, 'design.v'), code, 'utf8')
    const r = await runProcess(toolFile(dir, 'iverilog'), ['-Wall', '-g2012', '-o', 'lint.vvp', 'design.v'], {
      cwd: tmp,
      env: childEnv(dir),
      timeoutMs: HDL_LIMITS.compileMs,
    })
    if (r.spawnError) return [{ line: null, severity: 'error', message: `无法运行 iverilog：${r.spawnError}` } as LintIssue]
    if (r.killed) return [{ line: null, severity: 'error', message: 'iverilog 运行超时' } as LintIssue]
    return parseIverilogOutput(`${r.stdout}\n${r.stderr}`)
  })
  const errors = issues.filter(i => i.severity === 'error').length
  const warns = issues.filter(i => i.severity === 'warning').length
  const result: LintResult = { engine: 'iverilog', iverilogVersion: iverilogVersion(dir), issues, ruleHits, notice: null }
  return {
    result,
    steps: [{ kind: 'lint', text: `iverilog：错误 ${errors} 个，警告 ${warns} 个；规则提示 ${ruleHits.length} 条` }],
    warnings: [],
  }
}

// ───────────────────────── 仿真 ─────────────────────────

async function simulate(args: HdlArgs, dir: string | null): Promise<Outcome> {
  const code = checkCode(args.code)
  checkSafety(code)
  const maxTime = checkMaxTime(args.maxTimeUnits)
  const masked = maskSource(code)
  const requested = typeof args.top === 'string' && args.top !== '' ? args.top : undefined
  const { top, warning } = detectTop(masked, requested)
  const timescale = timescaleOf(masked)
  if (dir === null) throw new DlogicInputError(ERR_NO_IVERILOG)
  const version = iverilogVersion(dir)
  const env = childEnv(dir)
  const warnings: string[] = warning ? [warning] : []

  // 源码没有 $dumpvars 时自动注入波形记录根模块（不经 checkSafety：内容由宿主生成）。
  const autoDump = !hasDumpvars(masked)

  return withTempDir(async tmp => {
    fs.writeFileSync(path.join(tmp, 'design.v'), code, 'utf8')
    fs.writeFileSync(path.join(tmp, 'dlogic_watchdog.v'), buildWatchdog(maxTime, timescale), 'utf8')
    const extraFiles: string[] = []
    const extraRoots: string[] = []
    if (autoDump) {
      fs.writeFileSync(path.join(tmp, 'dlogic_dump.v'), buildDumpRoot(top, timescale), 'utf8')
      extraFiles.push('dlogic_dump.v')
      extraRoots.push('-s', 'dlogic_dump')
    }

    const compile = await runProcess(
      toolFile(dir, 'iverilog'),
      ['-g2012', '-s', top, '-s', 'dlogic_watchdog', ...extraRoots, '-o', 'sim.vvp', 'design.v', 'dlogic_watchdog.v', ...extraFiles],
      { cwd: tmp, env, timeoutMs: HDL_LIMITS.compileMs },
    )
    if (compile.spawnError) throw new DlogicInputError(`无法运行 iverilog：${compile.spawnError}`)
    if (compile.killed) throw new DlogicInputError('编译超时，请精简源码后重试。')
    const diags = parseIverilogOutput(`${compile.stdout}\n${compile.stderr}`)
    if (compile.code !== 0 || diags.some(d => d.severity === 'error')) {
      throw new DlogicInputError(`编译失败：${formatCompileErrors(diags)}`)
    }
    for (const d of diags.filter(x => x.severity === 'warning').slice(0, 3)) {
      warnings.push(`编译警告${d.line === null ? '' : `（第 ${d.line} 行）`}：${d.message}`)
    }

    const run = await runProcess(toolFile(dir, 'vvp'), ['sim.vvp'], {
      cwd: tmp,
      env,
      timeoutMs: HDL_LIMITS.wallMs,
      maxStdoutBytes: HDL_LIMITS.outputBytes,
      watch: () => (vcdBytesIn(tmp) > HDL_LIMITS.vcdBytes ? 'vcd_limit' : null),
    })
    if (run.spawnError) throw new DlogicInputError(`无法运行 vvp：${run.spawnError}`)

    const timedOut = run.stdout.includes(WATCHDOG_MARKER)
    const output = run.stdout
      .split(/\r?\n/)
      .filter(l => l !== '' && !l.startsWith('VCD info:') && l !== WATCHDOG_MARKER)
    const finish = parseFinish(run.stdout)
    const finishTime = finish ? finish.time : null
    const end: SimEnd = timedOut ? 'timeout' : (run.killed ?? (finishTime !== null ? 'finish' : 'idle'))

    const vcd = readVcd(tmp)
    // 刻度单位：$finish 输出中括号内的单位，其次是 VCD 头部的 $timescale，最后是源码 timescale 的精度部分。
    const precision = (timescale ?? '').split('/')[1] ?? null
    const sim: SimulateResult = {
      engine: 'iverilog',
      iverilogVersion: version,
      top,
      maxTimeUnits: maxTime,
      timescale: timescale ?? vcd.timescale,
      tickUnit: normalizeUnit(finish?.unit ?? vcd.timescale ?? precision),
      end,
      finishTime,
      output,
      outputTruncated: run.killed === 'output_limit',
      signals: vcd.signals,
      vcdTruncated: vcd.truncated,
    }
    const unit = timeUnitOf(sim.timescale) ?? sim.tickUnit
    if (end === 'timeout') {
      warnings.push(`已达到时间上限 ${maxTime}${unit ? ' ' + unit : ''}，仿真被强制结束；如需更长时间可调大 maxTimeUnits。`)
    }
    if (end === 'wall_clock' || end === 'output_limit' || end === 'vcd_limit') warnings.push(END_TEXT[end] + '。')
    if (vcd.truncated) warnings.push('VCD 波形数据已截断，只保留前若干路信号。')
    const label = simFinishLabel(sim)
    const when = label !== null ? `，$finish 于 ${label}` : ''
    return {
      result: sim,
      steps: [{ kind: 'simulate', text: `顶层 ${top}：${END_TEXT[end]}${when}` }],
      warnings,
    }
  })
}

function readVcd(dir: string): { signals: SimSignal[]; timescale: string | null; truncated: boolean } {
  const f = firstVcd(dir)
  if (!f) return { signals: [], timescale: null, truncated: false }
  const n = Math.min(f.size, HDL_LIMITS.vcdBytes)
  const buf = Buffer.alloc(n)
  const fd = fs.openSync(f.file, 'r')
  try {
    fs.readSync(fd, buf, 0, n, 0)
  } finally {
    fs.closeSync(fd)
  }
  const parsed = parseVcd(buf.toString('utf8'))
  return { signals: parsed.signals, timescale: parsed.timescale, truncated: f.size > HDL_LIMITS.vcdBytes || parsed.truncated }
}

// ───────────────────────── 中文渲染（给模型看的文本） ─────────────────────────

const SHOW = 30

function renderLint(r: LintResult, lines: string[]): void {
  lines.push(r.engine === 'iverilog' ? `检查引擎：iverilog ${r.iverilogVersion ?? ''}`.trim() : '检查引擎：仅规则匹配（能力降级）')
  if (r.notice) lines.push(r.notice)
  if (r.issues.length === 0 && r.engine === 'iverilog') lines.push('iverilog 未报告错误或警告。')
  for (const i of r.issues.slice(0, SHOW)) {
    lines.push(`${i.line === null ? '' : `第 ${i.line} 行 `}${i.severity === 'error' ? '错误' : i.severity === 'warning' ? '警告' : '提示'}：${i.message}`)
  }
  for (const h of r.ruleHits.slice(0, SHOW)) lines.push(`规则 ${h.rule}，第 ${h.line} 行：${h.message}`)
  if (r.issues.length === 0 && r.ruleHits.length === 0) lines.push('未发现问题。')
}

/** 解析 $finish 输出，例如 "$finish called at 276000 (1ps)"：时刻与括号内的单位（无单位时为 null）。 */
export function parseFinish(stdout: string): { time: number; unit: string | null } | null {
  const m = /\$finish called at (\d+)(?: \((\w+)\))?/.exec(stdout)
  return m ? { time: Number(m[1]), unit: normalizeUnit(m[2] ?? null) } : null
}

function renderSim(r: SimulateResult, lines: string[]): void {
  const label = simFinishLabel(r)
  lines.push(`顶层 ${r.top}；${END_TEXT[r.end]}${label !== null ? `；结束于 ${label}` : ''}`)
  for (const l of r.output.slice(0, 60)) lines.push(l)
  if (r.output.length > 60) lines.push(`其余 ${r.output.length - 60} 行略去`)
  for (const s of r.signals.slice(0, SHOW)) lines.push(`信号 ${s.name}（${s.width} 位）：${s.changes.length} 次变化`)
}

export function renderHdl(value: Envelope<HdlResult>): string {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? '未知错误'}`
  const lines: string[] = []
  if (value.op === 'lint') renderLint(value.result as LintResult, lines)
  else if (value.op === 'simulate') renderSim(value.result as SimulateResult, lines)
  else lines.push('（无可显示的结果）')
  if (value.warnings.length) lines.push(...value.warnings.map(w => `注意：${w}`))
  return lines.join('\n')
}
