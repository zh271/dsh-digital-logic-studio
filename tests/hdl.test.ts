import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDumpRoot,
  buildWatchdog,
  checkSafety,
  detectTop,
  formatCompileErrors,
  hasDumpvars,
  maskSource,
  parseIverilogOutput,
  parseVcd,
  ruleLint,
  timescaleOf,
} from '../src/solvers/hdl.ts'
import {
  busText,
  formatSimTime,
  normalizeUnit,
  simDisplayUnit,
  simFinishLabel,
  timeUnitOf,
  toWaveSignals,
  type SimSignal,
} from '../src/shared/hdl.ts'
import { DlogicInputError } from '../src/shared/contracts.ts'
import { childEnv, findIverilogDir, toolFile } from '../src/host/tools/hdl.exec.ts'
import { parseFinish, renderHdl, runHdl } from '../src/host/tools/hdl.logic.ts'
import type { Envelope } from '../src/shared/contracts.ts'
import type { LintResult, SimulateResult } from '../src/shared/hdl.ts'
import path from 'node:path'

const IVERILOG_DIR = findIverilogDir()
const NO_IVERILOG = IVERILOG_DIR === null ? 'iverilog 未安装，跳过真实调用测试' : false

// ───────────────────────── 源码预处理 ─────────────────────────

test('maskSource: 注释与字符串被屏蔽，行数与换行保持不变', () => {
  const src = 'a // $system\n/* $fopen\n */ b "x;y" c'
  const m = maskSource(src)
  assert.equal(m.length, src.length)
  assert.equal(m.split('\n').length, src.split('\n').length)
  assert.ok(!m.includes('$system'))
  assert.ok(!m.includes('$fopen'))
  assert.ok(!m.includes('x;y'))
  assert.ok(m.includes('b'))
  assert.ok(m.includes('c'))
})

test('maskSource keepStrings: 保留字符串内容', () => {
  assert.ok(maskSource('$dumpfile("w.vcd");', true).includes('w.vcd'))
})

// ───────────────────────── 安全检查 ─────────────────────────

test('checkSafety: 拒绝 $system', () => {
  assert.throws(() => checkSafety('module t; initial $system("rm -rf x"); endmodule'), (e: unknown) => {
    assert.ok(e instanceof DlogicInputError)
    assert.match((e as Error).message, /\$system/)
    return true
  })
})

test('checkSafety: 拒绝 $fopen 与文件读写类任务', () => {
  for (const task of ['$fopen("a.txt","w")', '$fdisplay(fd, "x")', '$readmemh("m.hex", mem)', '$fwrite(1,"x")']) {
    assert.throws(() => checkSafety(`module t; initial ${task}; endmodule`), DlogicInputError, task)
  }
})

test('checkSafety: 字符串或注释中的任务名不算调用', () => {
  assert.doesNotThrow(() => checkSafety('module t; initial $display("$system is banned"); // $fopen\nendmodule'))
})

test('checkSafety: 拒绝 `include 与带路径的 $dumpfile', () => {
  assert.throws(() => checkSafety('`include "/etc/passwd"\nmodule t; endmodule'), DlogicInputError)
  assert.throws(() => checkSafety('module t; initial $dumpfile("../x.vcd"); endmodule'), DlogicInputError)
  assert.throws(() => checkSafety('module t; initial $dumpfile("C:/x.vcd"); endmodule'), DlogicInputError)
})

test('checkSafety: $dumpfile 的参数必须是字符串字面量', () => {
  assert.throws(() => checkSafety('module t; reg [8*8:1] f; initial $dumpfile(f); endmodule'), DlogicInputError)
  assert.doesNotThrow(() => checkSafety('module t; initial begin $dumpfile("wave.vcd"); $dumpvars; end endmodule'))
})

// ───────────────────────── 顶层识别 ─────────────────────────

test('detectTop: 自动选取未被实例化的 testbench', () => {
  const src = maskSource('module adder; endmodule\nmodule tb; adder u(); endmodule')
  const r = detectTop(src)
  assert.equal(r.top, 'tb')
  assert.equal(r.warning, null)
})

test('detectTop: 指定的 top 必须存在', () => {
  const src = maskSource('module a; endmodule')
  assert.equal(detectTop(src, 'a').top, 'a')
  assert.throws(() => detectTop(src, 'zzz'), DlogicInputError)
})

test('detectTop: 多个候选时给出提示', () => {
  const r = detectTop(maskSource('module a; endmodule\nmodule b; endmodule'))
  assert.ok(r.warning)
  assert.match(r.warning ?? '', /多个顶层候选/)
})

test('timescaleOf: 读取第一个 timescale 指令', () => {
  assert.equal(timescaleOf(maskSource('`timescale 1ns/1ps\nmodule t; endmodule')), '1ns/1ps')
  assert.equal(timescaleOf(maskSource('module t; endmodule')), null)
})

test('buildWatchdog: 生成带时间上限的根模块', () => {
  const w = buildWatchdog(500, '1ns/1ps')
  assert.match(w, /^`timescale 1ns\/1ps/)
  assert.match(w, /#500;/)
  assert.match(w, /DLOGIC_WATCHDOG_TIMEOUT/)
  assert.match(w, /module dlogic_watchdog/)
})

test('hasDumpvars: 注释与字符串中的 $dumpvars 不算', () => {
  assert.equal(hasDumpvars(maskSource('module tb; initial $dumpvars(0, tb); endmodule')), true)
  assert.equal(hasDumpvars(maskSource('module tb; // $dumpvars\nendmodule')), false)
  assert.equal(hasDumpvars(maskSource('module tb; initial $display("$dumpvars"); endmodule')), false)
})

test('buildDumpRoot: 生成写入固定文件名并记录顶层的根模块', () => {
  const d = buildDumpRoot('tb', '1ns/1ps')
  assert.match(d, /^`timescale 1ns\/1ps/)
  assert.match(d, /module dlogic_dump/)
  assert.match(d, /\$dumpfile\("dlogic_wave\.vcd"\);/)
  assert.match(d, /\$dumpvars\(0, tb\);/)
  assert.doesNotMatch(buildDumpRoot('tb', null), /timescale/)
})

// ───────────────────────── 规则匹配 ─────────────────────────

const RULE_LATCH = `module m(input a, input b, output reg y);
  always @(*) begin
    if (a) y = b;
  end
endmodule`

const RULE_CASE = `module m(input [1:0] s, output reg y);
  always @(*) begin
    case (s)
      2'b00: y = 0;
      2'b01: y = 1;
    endcase
  end
endmodule`

test('ruleLint: 组合块中 if 无 else 推断锁存器', () => {
  const hits = ruleLint(RULE_LATCH)
  const latch = hits.filter(h => h.rule === 'latch')
  assert.equal(latch.length, 1)
  assert.equal(latch[0].line, 3)
})

test('ruleLint: 有 else 且完整赋值时不报锁存器', () => {
  const src = `module m(input a, input b, output reg y);
  always @(*) begin
    if (a) y = b; else y = 0;
  end
endmodule`
  assert.equal(ruleLint(src).filter(h => h.rule === 'latch').length, 0)
})

test('ruleLint: else-if 链末尾缺少 else 仍报告', () => {
  const src = `module m(input a, input b, output reg y);
  always @(*) begin
    if (a) y = 1;
    else if (b) y = 0;
  end
endmodule`
  assert.equal(ruleLint(src).filter(h => h.rule === 'latch').length, 1)
})

test('ruleLint: case 无 default 推断锁存器', () => {
  const hits = ruleLint(RULE_CASE)
  assert.equal(hits.filter(h => h.rule === 'case-default').length, 1)
  assert.equal(hits.filter(h => h.rule === 'case-default')[0].line, 3)
})

test('ruleLint: 组合块用 <=', () => {
  const src = `module m(input a, output reg y);
  always @(*) begin
    y <= a;
  end
endmodule`
  const hits = ruleLint(src).filter(h => h.rule === 'nba-in-comb')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].line, 3)
})

test('ruleLint: 组合块中的比较 <= 不算非阻塞赋值', () => {
  const src = `module m(input [3:0] a, input [3:0] b, output reg y);
  always @(*) begin
    if (a <= b) y = 1; else y = 0;
  end
endmodule`
  assert.equal(ruleLint(src).filter(h => h.rule === 'nba-in-comb').length, 0)
})

test('ruleLint: 时序块用 =', () => {
  const src = `module m(input clk, input d, output reg q);
  always @(posedge clk) begin
    q = d;
  end
endmodule`
  const hits = ruleLint(src).filter(h => h.rule === 'blocking-in-seq')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].line, 3)
})

test('ruleLint: 时序块用 <= 与 if 无 else 不报', () => {
  const src = `module m(input clk, input en, input d, output reg q);
  always @(posedge clk) begin
    if (en) q <= d;
  end
endmodule`
  const hits = ruleLint(src)
  assert.equal(hits.filter(h => h.rule === 'blocking-in-seq').length, 0)
  assert.equal(hits.filter(h => h.rule === 'latch').length, 0)
})

test('ruleLint: 同一信号被两个 always 驱动为多驱动', () => {
  const src = `module m(input clk, input a, input b, output reg q);
  always @(posedge clk) q <= a;
  always @(posedge clk) q <= b;
endmodule`
  const hits = ruleLint(src).filter(h => h.rule === 'multi-driver')
  assert.equal(hits.length, 1)
  assert.equal(hits[0].severity, 'error')
  assert.match(hits[0].message, /q/)
})

test('ruleLint: assign 与 always 驱动同一信号为多驱动；同一块内多次赋值不算', () => {
  const src = `module m(input a, input b, output reg y, output z);
  always @(*) begin
    if (a) y = 1; else y = 0;
  end
  assign z = a;
  assign z = b;
endmodule`
  const hits = ruleLint(src).filter(h => h.rule === 'multi-driver')
  assert.equal(hits.length, 1)
  assert.match(hits[0].message, /z/)
})

test('ruleLint: 测试平台中的时钟发生器（always #5）不参与检查', () => {
  const src = `module tb; reg clk = 0; always #5 clk = ~clk; endmodule`
  assert.deepEqual(ruleLint(src), [])
})

test('ruleLint: 规范的组合与时序电路没有提示', () => {
  const src = `module m(input clk, input rst, input d, output reg q, output reg y);
  always @(posedge clk) begin
    if (rst) q <= 1'b0;
    else q <= d;
  end
  always @(*) begin
    y = 1'b0;
    if (d) y = 1'b1;
  end
endmodule`
  assert.deepEqual(ruleLint(src), [])
})

// ───────────────────────── iverilog 诊断解析 ─────────────────────────

test('parseIverilogOutput: 解析错误、警告、续行，忽略其他文件与汇总行', () => {
  const text = [
    'design.v:5: error: Cannot perform procedural assignment to variable \'z\'.',
    'design.v:5:      : \'z\' is declared here.',
    'design.v:9: warning: implicit definition of wire \'w\'.',
    'other.v:3: warning: 不属于本文件',
    'design.v:12: syntax error',
    'warning: something without a line',
    '1 error(s) during elaboration.',
    '',
  ].join('\r\n')
  const issues = parseIverilogOutput(text, 'design.v')
  assert.equal(issues.length, 4)
  assert.equal(issues[0].line, 5)
  assert.equal(issues[0].severity, 'error')
  assert.match(issues[0].message, /declared here/)
  assert.equal(issues[1].severity, 'warning')
  assert.equal(issues[2].severity, 'error')
  assert.equal(issues[2].message, 'syntax error')
  assert.equal(issues[3].line, null)
  assert.equal(issues[3].severity, 'warning')
})

test('parseIverilogOutput: 带绝对路径的文件名也能匹配', () => {
  const issues = parseIverilogOutput('C:\\tmp\\x\\design.v:2: warning: w', 'design.v')
  assert.equal(issues.length, 1)
  assert.equal(issues[0].line, 2)
})

test('formatCompileErrors: 只列错误，超过 5 条时注明其余条数', () => {
  const issues = Array.from({ length: 7 }, (_, i) => ({ line: i + 1, severity: 'error' as const, message: `e${i}` }))
  const s = formatCompileErrors(issues)
  assert.match(s, /第 1 行：e0/)
  assert.match(s, /另有 2 条/)
  assert.equal(formatCompileErrors([]), '编译未通过')
})

// ───────────────────────── VCD 解析 ─────────────────────────

const VCD = `$date today $end
$version iverilog $end
$timescale 1ns $end
$scope module tb $end
$var reg 1 ! clk $end
$scope module dut $end
$var reg 4 " q [3:0] $end
$upscope $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
0!
bx "
$end
#5
1!
#10
0!
b0101 "
#15
1!
`

test('parseVcd: 解析作用域、标量与向量变化，时间单位为 timescale 精度', () => {
  const r = parseVcd(VCD)
  assert.equal(r.timescale, '1ns')
  assert.equal(r.truncated, false)
  assert.equal(r.signals.length, 2)
  const clk = r.signals[0]
  assert.equal(clk.name, 'tb.clk')
  assert.equal(clk.width, 1)
  assert.deepEqual(clk.changes.map(c => [c.time, c.value]), [[0, '0'], [5, '1'], [10, '0'], [15, '1']])
  const q = r.signals[1]
  assert.equal(q.name, 'tb.dut.q')
  assert.equal(q.width, 4)
  assert.deepEqual(q.changes.map(c => [c.time, c.value]), [[0, 'x'], [10, '0101']])
})

test('parseVcd: 超过上限时截断并标记', () => {
  const r = parseVcd(VCD, { maxChanges: 2 })
  assert.equal(r.truncated, true)
  assert.equal(r.signals[0].changes.length, 2)
  const r2 = parseVcd(VCD, { maxSignals: 1 })
  assert.equal(r2.signals.length, 1)
  assert.equal(r2.truncated, true)
})

test('toWaveSignals: 单比特信号按变化时刻采样，多比特信号画成总线', () => {
  const signals: SimSignal[] = [
    { name: 'tb.clk', width: 1, changes: [{ time: 0, value: '0' }, { time: 5, value: '1' }, { time: 10, value: '0' }] },
    { name: 'tb.en', width: 1, changes: [{ time: 0, value: '1' }, { time: 10, value: 'x' }] },
    { name: 'tb.q', width: 4, changes: [{ time: 0, value: '0000' }, { time: 5, value: '0001' }, { time: 10, value: '1010' }] },
  ]
  const w = toWaveSignals(signals)
  assert.equal(w.steps, 3)
  assert.deepEqual(w.times, [0, 5, 10])
  assert.equal(w.total, 3)
  assert.equal(w.truncated, false)
  assert.equal(w.signals.length, 3)
  assert.equal(w.signals[0].name, 'clk')
  assert.equal(w.signals[0].wave, '010')
  assert.equal(w.signals[0].role, 'clock')
  assert.equal(w.signals[1].wave, '11x')
  assert.equal(w.signals[2].name, 'q')
  assert.deepEqual(w.signals[2].values, ['0', '1', 'a'])
})

test('toWaveSignals: 空闲时刻不占列，只保留有变化的时刻', () => {
  const signals: SimSignal[] = [
    { name: 'tb.a', width: 1, changes: [{ time: 0, value: '0' }, { time: 100, value: '1' }] },
    { name: 'tb.b', width: 1, changes: [{ time: 0, value: '1' }, { time: 300, value: '0' }] },
  ]
  const w = toWaveSignals(signals)
  assert.deepEqual(w.times, [0, 100, 300])
  assert.equal(w.signals[0].wave, '011')
  assert.equal(w.signals[1].wave, '110')
})

test('toWaveSignals: 总线含 x/z 时显示 x，段内取值十六进制', () => {
  const signals: SimSignal[] = [
    { name: 'tb.q', width: 4, changes: [{ time: 0, value: 'xxxx' }, { time: 5, value: '0101' }, { time: 10, value: '1z00' }] },
  ]
  const w = toWaveSignals(signals)
  assert.deepEqual(w.signals[0].values, ['x', '5', 'x'])
  assert.equal(w.signals[0].wave, 'xdx')
})

test('toWaveSignals: 时刻超过上限时均匀抽样，复位变化优先保留', () => {
  const clk = Array.from({ length: 200 }, (_, i) => ({ time: i * 2 + 1, value: i % 2 ? '0' : '1' }))
  const rst = [{ time: 0, value: '1' }, { time: 7, value: '0' }, { time: 399, value: '1' }]
  const w = toWaveSignals(
    [
      { name: 'tb.clk', width: 1, changes: clk },
      { name: 'tb.rst', width: 1, changes: rst },
    ],
    20,
  )
  assert.equal(w.steps, 20)
  assert.equal(w.truncated, true)
  assert.equal(w.total, 201)
  assert.ok(w.times.includes(7), '复位释放时刻应保留')
  assert.ok(w.times.includes(399), '复位再次变化应保留')
  assert.ok(w.times.includes(0))
  assert.deepEqual(w.times, [...w.times].sort((a, b) => a - b))
})

test('toWaveSignals: 默认上限为 160 列', () => {
  const changes = Array.from({ length: 170 }, (_, i) => ({ time: i + 1, value: i % 2 ? '1' : '0' }))
  const w = toWaveSignals([{ name: 'a', width: 1, changes }])
  assert.equal(w.steps, 160)
  assert.equal(w.truncated, true)
})

test('toWaveSignals: 时刻过多时截断', () => {
  const changes = Array.from({ length: 10 }, (_, i) => ({ time: i + 1, value: i % 2 ? '1' : '0' }))
  const w = toWaveSignals([{ name: 'a', width: 1, changes }], 4)
  assert.equal(w.steps, 4)
  assert.equal(w.truncated, true)
})

test('busText: 十六进制补齐位宽，含 x/z 为 x，实数文本原样', () => {
  assert.equal(busText('1010', 4), 'a')
  assert.equal(busText('101', 5), '05')
  assert.equal(busText('1', 1), '1')
  assert.equal(busText('x', 4), 'x')
  assert.equal(busText('11111111', 8), 'ff')
  assert.equal(busText('3.5', 64), '3.5')
})

test('formatSimTime: $finish 的 ps 刻度换算为 timescale 的 ns', () => {
  assert.equal(timeUnitOf('1ns/1ps'), 'ns')
  assert.equal(timeUnitOf('10ns/1ps'), '10ns')
  assert.equal(timeUnitOf(null), null)
  assert.equal(normalizeUnit('1ps'), 'ps')
  assert.equal(formatSimTime(276000, 'ps', 'ns'), '276 ns')
  assert.equal(formatSimTime(2500, 'ps', 'ns'), '2.5 ns')
  assert.equal(formatSimTime(276, 'ns', null), '276 ns')
  assert.equal(formatSimTime(7, null, null), '7')
  const r = {
    timescale: '1ns/1ps',
    tickUnit: 'ps',
    finishTime: 276000,
  }
  assert.equal(simFinishLabel(r), '276 ns')
  assert.equal(simDisplayUnit({ timescale: null, tickUnit: 'ps' }), 'ps')
  assert.equal(simFinishLabel({ ...r, finishTime: null }), null)
})

test('parseFinish: 读取 $finish 时刻与括号内的单位', () => {
  assert.deepEqual(parseFinish('tb.v:9: $finish called at 276000 (1ps)\n'), { time: 276000, unit: 'ps' })
  assert.deepEqual(parseFinish('$finish called at 12'), { time: 12, unit: null })
  assert.equal(parseFinish('no finish here'), null)
})

// ───────────────────────── 进程层（不调用 iverilog） ─────────────────────────

test('findIverilogDir: 依次查找环境变量、默认目录与 PATH', () => {
  const sep = path.delimiter
  const onlyIn = (dir: string) => (p: string) => p === toolFile(dir, 'iverilog')
  assert.equal(findIverilogDir({ DLOGIC_IVERILOG_DIR: 'D:\\ivl' }, onlyIn('D:\\ivl')), 'D:\\ivl')
  assert.equal(findIverilogDir({}, onlyIn('C:\\msys64\\ucrt64\\bin')), 'C:\\msys64\\ucrt64\\bin')
  assert.equal(findIverilogDir({ PATH: ['E:\\x', 'F:\\y'].join(sep) }, onlyIn('F:\\y')), 'F:\\y')
  assert.equal(findIverilogDir({ PATH: 'E:\\x' }, () => false), null)
})

test('childEnv: 把目录放到 PATH 最前，并去掉重复的 PATH 键', () => {
  const env = childEnv('C:\\msys64\\ucrt64\\bin', { Path: 'C:\\Windows', FOO: '1' })
  assert.ok(env.PATH.startsWith('C:\\msys64\\ucrt64\\bin' + path.delimiter))
  assert.equal(env.FOO, '1')
  assert.equal(Object.keys(env).filter(k => k.toUpperCase() === 'PATH').length, 1)
})

// ───────────────────────── 降级路径（不调用 iverilog） ─────────────────────────

test('runHdl lint: 无 iverilog 时 engine 为 rules 并附降级说明，规则匹配照常', async () => {
  const r = (await runHdl({ op: 'lint', code: RULE_LATCH }, null)) as Envelope<LintResult>
  assert.equal(r.ok, true)
  assert.equal(r.result?.engine, 'rules')
  assert.equal(r.result?.iverilogVersion, null)
  assert.ok(r.result?.notice && /降级/.test(r.result.notice))
  assert.deepEqual(r.result?.issues, [])
  assert.equal(r.result?.ruleHits.filter(h => h.rule === 'latch').length, 1)
  assert.match(renderHdl(r), /能力降级/)
})

test('runHdl simulate: 无 iverilog 时返回中文错误', async () => {
  const r = await runHdl({ op: 'simulate', code: 'module tb; initial $display("hi"); endmodule' }, null)
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /未找到 iverilog/)
})

test('runHdl: 危险源码被拒绝，op 与参数错误返回 ok:false', async () => {
  const bad = await runHdl({ op: 'simulate', code: 'module tb; initial $system("x"); endmodule' }, null)
  assert.equal(bad.ok, false)
  assert.match(bad.error ?? '', /\$system/)
  const op = await runHdl({ op: 'synth', code: 'module tb; endmodule' }, null)
  assert.equal(op.ok, false)
  assert.match(op.error ?? '', /未知的 op/)
  const mt = await runHdl({ op: 'simulate', code: 'module tb; endmodule', maxTimeUnits: 0 }, null)
  assert.equal(mt.ok, false)
})

// ───────────────────────── 真实调用 iverilog（找不到时跳过） ─────────────────────────

const COUNTER_TB = `\`timescale 1ns/1ps
module counter(input clk, input rst, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 0;
    else q <= q + 1;
  end
endmodule

module tb;
  reg clk = 0, rst = 1;
  wire [3:0] q;
  counter u(.clk(clk), .rst(rst), .q(q));
  always #5 clk = ~clk;
  initial begin
    $dumpfile("wave.vcd");
    $dumpvars(0, tb);
    #12 rst = 0;
    #40 $display("q=%d", q);
    $finish;
  end
endmodule
`

test('iverilog 真实调用: lint 报告语法错误并保留规则提示', { skip: NO_IVERILOG }, async () => {
  const code = `module bad(input a, output reg y);
  always @(*) begin
    if (a) y <= a
  end
endmodule
`
  const r = (await runHdl({ op: 'lint', code })) as Envelope<LintResult>
  assert.equal(r.ok, true)
  assert.equal(r.result?.engine, 'iverilog')
  assert.ok((r.result?.issues ?? []).some(i => i.severity === 'error' && i.line !== null))
})

test('iverilog 真实调用: simulate 运行 testbench，返回输出与 VCD 波形', { skip: NO_IVERILOG }, async () => {
  const r = (await runHdl({ op: 'simulate', code: COUNTER_TB })) as Envelope<SimulateResult>
  assert.equal(r.ok, true, r.error)
  const s = r.result as SimulateResult
  assert.equal(s.top, 'tb')
  assert.equal(s.end, 'finish')
  assert.equal(s.timescale, '1ns/1ps')
  assert.ok(s.output.some(l => l.includes('q=') && /q=\s*4/.test(l)))
  assert.ok(s.signals.some(x => x.name === 'tb.clk' && x.changes.length > 3))
  assert.equal(s.vcdTruncated, false)
})

test('iverilog 真实调用: 没有 $finish 的仿真由看门狗在上限时间结束', { skip: NO_IVERILOG }, async () => {
  const code = 'module tb; reg c = 0; always #5 c = ~c; initial $display("tick"); endmodule'
  const r = (await runHdl({ op: 'simulate', code, maxTimeUnits: 100 })) as Envelope<SimulateResult>
  assert.equal(r.ok, true, r.error)
  assert.equal(r.result?.end, 'timeout')
  assert.ok(r.warnings.some(w => /时间上限/.test(w)))
})

test('iverilog 真实调用: 编译错误返回中文说明', { skip: NO_IVERILOG }, async () => {
  const r = await runHdl({ op: 'simulate', code: 'module tb; initial begin $display("x") endmodule' })
  assert.equal(r.ok, false)
  assert.match(r.error ?? '', /编译失败/)
})

test('iverilog 真实调用: 源码没有 $dumpvars 时自动记录波形，不必由 testbench 声明', { skip: NO_IVERILOG }, async () => {
  const code = `\`timescale 1ns/1ps
module counter(input clk, input rst, output reg [3:0] q);
  always @(posedge clk) begin
    if (rst) q <= 0;
    else q <= q + 1;
  end
endmodule

module tb;
  reg clk = 0, rst = 1;
  wire [3:0] q;
  counter u(.clk(clk), .rst(rst), .q(q));
  always #5 clk = ~clk;
  initial begin
    #12 rst = 0;
    #40 $display("q=%d", q);
    $finish;
  end
endmodule
`
  const r = (await runHdl({ op: 'simulate', code })) as Envelope<SimulateResult>
  assert.equal(r.ok, true, r.error)
  assert.equal(r.result?.top, 'tb')
  assert.ok((r.result?.signals.length ?? 0) > 0, '应得到非空波形')
  assert.ok(r.result?.signals.some(x => x.name === 'tb.clk' && x.changes.length > 3))
})
