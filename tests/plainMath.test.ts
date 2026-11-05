import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plainMath } from '../src/client/ask/plainMath.ts'

test('plainMath: 不含 \\ 或 $ 的文本原样返回（下标也不转换）', () => {
  assert.equal(plainMath(''), '')
  assert.equal(plainMath('A+B = m_2'), 'A+B = m_2')
  assert.equal(plainMath('普通中文，无数学标记。'), '普通中文，无数学标记。')
})

test('plainMath: 去掉 \\( \\) \\[ \\] 与 $ $$ 定界符', () => {
  assert.equal(plainMath('\\(m_i\\)'), 'm_i')
  assert.equal(plainMath('\\[A+B\\]'), 'A+B')
  assert.equal(plainMath('$A+B$'), 'A+B')
  assert.equal(plainMath('$$A+B$$'), 'A+B')
})

test('plainMath: \\overline 与 \\bar 写作后缀撇号；多字符时加括号', () => {
  assert.equal(plainMath('\\overline{A}'), "A'")
  assert.equal(plainMath('\\bar{A}'), "A'")
  assert.equal(plainMath('\\overline{M_i}'), "M_i'")
  assert.equal(plainMath('\\overline{M_{i}}'), "M_i'")
  assert.equal(plainMath('\\overline{AB}'), "(AB)'")
  assert.equal(plainMath('\\overline{A+B}'), "(A+B)'")
})

test('plainMath: 常用符号转 Unicode', () => {
  assert.equal(plainMath('$A\\cdot B$'), 'A·B')
  assert.equal(plainMath('\\oplus'), '⊕')
  assert.equal(plainMath('\\times'), '×')
  assert.equal(plainMath('$A \\land B \\lor \\neg C$'), 'A ∧B ∨¬C')
  assert.equal(plainMath('$A\\land B$'), 'A∧B')
  assert.equal(plainMath('\\lnot A'), '¬A')
  assert.equal(plainMath('\\leq \\geq \\neq'), '≤≥≠')
  assert.equal(plainMath('\\rightarrow \\to \\Rightarrow'), '→→⇒')
  assert.equal(plainMath('\\sum'), 'Σ')
  assert.equal(plainMath('\\prod'), '∏')
  assert.equal(plainMath('1, \\ldots, n'), '1, …, n')
  assert.equal(plainMath('\\cdots'), '…')
})

test('plainMath: \\frac 写作 (a)/(b)', () => {
  assert.equal(plainMath('\\frac{a}{b}'), '(a)/(b)')
  assert.equal(plainMath('\\frac{A+B}{C}'), '(A+B)/(C)')
})

test('plainMath: 纯数字下标与上标转 Unicode，其余保留', () => {
  assert.equal(plainMath('\\(m_{0}\\)'), 'm₀')
  assert.equal(plainMath('\\(x_{12}\\)'), 'x₁₂')
  assert.equal(plainMath('\\(m_2\\)'), 'm₂')
  assert.equal(plainMath('$x^{10}$'), 'x¹⁰')
  assert.equal(plainMath('$x^2$'), 'x²')
  assert.equal(plainMath('$x_{i}$'), 'x_i')
  assert.equal(plainMath('$x^{n}$'), 'x^n')
})

test('plainMath: \\text \\mathrm \\mathbf 只保留内容', () => {
  assert.equal(plainMath('\\text{Y}'), 'Y')
  assert.equal(plainMath('\\mathrm{XOR}'), 'XOR')
  assert.equal(plainMath('\\mathbf{F}'), 'F')
  assert.equal(plainMath('$\\text{ 且 }$'), ' 且 ')
})

test('plainMath: 未知命令去掉命令名，保留花括号内容；\\left \\right 去掉', () => {
  assert.equal(plainMath('\\foo{abc}'), 'abc')
  assert.equal(plainMath('\\left(A\\right)'), '(A)')
})

test('plainMath: 转义的花括号按字面保留', () => {
  assert.equal(plainMath('\\{A\\}'), '{A}')
})

test('plainMath: 间距命令转为空格', () => {
  assert.equal(plainMath('$a\\,b$'), 'a b')
})

test('plainMath: 反引号代码片段原样保留', () => {
  assert.equal(plainMath("`\\overline{A}` 与 $\\overline{B}$"), "`\\overline{A}` 与 B'")
  assert.equal(plainMath('`A\\cdot B`'), '`A\\cdot B`')
})

test('plainMath: 不完整的 LaTeX 不抛出异常', () => {
  for (const s of ['\\frac{a', '\\overline{', '$x^{', '\\', '$', '\\text']) {
    assert.equal(typeof plainMath(s), 'string')
  }
})

test('plainMath: 非字符串输入原样返回且不抛出', () => {
  assert.equal(plainMath(undefined as unknown as string), undefined)
})
