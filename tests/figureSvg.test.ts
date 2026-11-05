import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { renderCombFigureSvg } from '../src/shared/figureSvg.ts'
import { analyzeNetlist, drawExpr } from '../src/solvers/comb.ts'
import { renderCombForHost, runComb } from '../src/host/tools/comb.logic.ts'

/** 简单的标签平衡检查：忽略自闭合标签与 XML 声明。 */
function assertBalancedTags(svg: string): void {
  const stack: string[] = []
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(svg)) !== null) {
    const [, closing, name, selfClose] = m
    if (selfClose) continue
    if (closing) {
      assert.equal(stack.pop(), name, `mismatched closing tag </${name}>`)
    } else {
      stack.push(name)
    }
  }
  assert.deepEqual(stack, [], 'unclosed tags')
}

function assertCommonSvg(svg: string): void {
  assert.ok(svg.startsWith('<svg'), 'starts with <svg')
  assert.ok(svg.includes('xmlns'), 'has xmlns')
  assert.ok(svg.includes('viewBox'), 'has viewBox')
  assert.ok(!svg.includes('var('), 'no CSS variables')
  assert.ok(!svg.includes('currentColor'), 'no currentColor')
  assert.ok(!svg.includes('<script'), 'no script')
  assertBalancedTags(svg)
}

test('figureSvg: draw X = AB\' + BC\' + CA\' 生成完整独立 SVG，含输入名与输出名', () => {
  const r = drawExpr({ expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'], outputName: 'X' }).result
  const svg = renderCombFigureSvg(r)
  assertCommonSvg(svg)
  for (const name of ['A', 'B', 'C', 'X']) {
    assert.ok(svg.includes(`>${name}</text>`), `contains label ${name}`)
  }
  // 三变量：门图与 8 列波形都应出现（波形轴上有列号 7）。
  assert.ok(svg.includes('>7</text>'), 'waveform axis present')
})

test('figureSvg: 两级门 analyze 生成 SVG，含各输入名与输出名', () => {
  const r = analyzeNetlist({
    inputs: ['P', 'Q', 'R'],
    gates: [
      { out: 'Y1', type: 'AND', in: ['P', 'Q'] },
      { out: 'Y2', type: 'NOR', in: ['Y1', 'R'] },
    ],
    outputs: ['Y2'],
  })
  const svg = renderCombFigureSvg(r)
  assertCommonSvg(svg)
  for (const name of ['P', 'Q', 'R', 'Y2']) {
    assert.ok(svg.includes(`>${name}</text>`), `contains label ${name}`)
  }
})

test('figureSvg: 输入超过 5 个时不画波形，仅门图', () => {
  const r = analyzeNetlist({
    inputs: ['A', 'B', 'C', 'D', 'E', 'F'],
    gates: [{ out: 'Y', type: 'AND', in: ['A', 'B'] }],
    outputs: ['Y'],
  })
  const svg = renderCombFigureSvg(r)
  assertCommonSvg(svg)
  assert.ok(!svg.includes('>32</text>') && !svg.includes('>63</text>'), 'no waveform axis')
})

test('figureSvg: 文字中的 XML 特殊字符被转义', () => {
  // 求解器只接受合法名字，这里直接构造结果以检验渲染层的转义。
  const r = {
    inputs: ['A&B'],
    gates: [{ out: 'Y<1>', type: 'NOT', in: ['A&B'] }],
    outputs: ['Y<1>'],
    truthTable: { variables: ['A&B'], outputs: ['Y<1>'], rows: [] },
  }
  const svg = renderCombFigureSvg(r as never)
  assertCommonSvg(svg)
  assert.ok(svg.includes('Y&lt;1&gt;'))
  assert.ok(svg.includes('A&amp;B'))
})

test('figureSvg: 无网表或无效结果返回空串', () => {
  assert.equal(renderCombFigureSvg(null as never), '')
  assert.equal(renderCombFigureSvg({} as never), '')
  assert.equal(renderCombFigureSvg({ inputs: ['A'], gates: [], outputs: [] } as never), '')
  assert.equal(renderCombFigureSvg({ inputs: 'bad', gates: 'bad' } as never), '')
})

test('host: draw 的结果文本包含图文件行，且文件内容是该 SVG', () => {
  const value = runComb({ op: 'draw', expr: "AB' + BC' + CA'", variables: ['A', 'B', 'C'], outputName: 'X' })
  const text = renderCombForHost(value)
  const line = text.split('\n').find(l => l.startsWith('图文件（'))
  assert.ok(line, 'has 图文件 line')
  const file = line!.slice(line!.indexOf('：') + 1)
  assert.ok(file.endsWith('.svg'))
  assert.ok(file.includes('dlogic-figs'))
  const content = fs.readFileSync(file, 'utf8')
  assert.ok(content.startsWith('<svg'))
  // 同一输入输出稳定：再次渲染得到相同文本。
  assert.equal(renderCombForHost(value), text)
})

test('host: map_msi 不追加图文件行', () => {
  const value = runComb({ op: 'map_msi', chip: '151', expr: "A'B + AB'", variables: ['A', 'B'] })
  assert.ok(!renderCombForHost(value).includes('图文件'))
})
