import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CardRecord, TreeView } from '../src/shared/contracts.ts'
import { FOLLOWUP_ANGLES, FOLLOWUP_MARK, MAX_ASK_FOLLOWUPS, parseAskAnswer, sanitizeFollowups } from '../src/shared/ask.ts'
import { askOnce, buildAskSystemPrompt, llmDetail, type AskChunk, type AskContext } from '../src/host/ask.ts'
import { readResult } from '../src/client/ask/api.ts'
import { buildAskEntry, ASK_FOLLOWUP_WHY, toFollowups } from '../src/client/ask/entries.ts'
import { buildForest } from '../src/shared/tree.ts'
import { exceedsPanThreshold, panScroll, PAN_THRESHOLD } from '../src/client/tree/pan.ts'

// ---------- parseAskAnswer / sanitizeFollowups（共享解析）----------

test('parseAskAnswer 没有追问段落时原文不变（trim 后），追问为空', () => {
  const text = '  相邻格只差一位。\n结论：可以圈。  '
  assert.deepEqual(parseAskAnswer(text), { answer: '相邻格只差一位。\n结论：可以圈。', followups: [] })
})

test('parseAskAnswer 拆出正文与追问，并解析角度与理由', () => {
  const text = [
    '相邻格只差一位，所以可以圈在一起。',
    '结论：相邻圈法成立。',
    '',
    FOLLOWUP_MARK,
    '- 为什么 2 的幂次方格能圈 | principle | 看二进制位',
    '- 若不相邻会怎样 | variant',
    '- 圈法最容易错在哪 | pitfall | 忘记取反',
  ].join('\n')
  const r = parseAskAnswer(text)
  assert.equal(r.answer, '相邻格只差一位，所以可以圈在一起。\n结论：相邻圈法成立。')
  assert.deepEqual(r.followups, [
    { question: '为什么 2 的幂次方格能圈', angle: 'principle', why: '看二进制位' },
    { question: '若不相邻会怎样', angle: 'variant', why: '' },
    { question: '圈法最容易错在哪', angle: 'pitfall', why: '忘记取反' },
  ])
})

test('parseAskAnswer 只认最后一个标记行，支持 ASCII 冒号与全角竖线', () => {
  const text = `前文\n${FOLLOWUP_MARK}\n- 旧问题\n正文二\n追问:\n- 新问题 ｜ practice ｜ 动手做`
  const r = parseAskAnswer(text)
  assert.equal(r.answer, `前文\n${FOLLOWUP_MARK}\n- 旧问题\n正文二`)
  assert.deepEqual(r.followups, [{ question: '新问题', angle: 'practice', why: '动手做' }])
})

test('parseAskAnswer 标记后没有可用条目时文本不变', () => {
  const text = `正文\n${FOLLOWUP_MARK}\n\n   `
  assert.deepEqual(parseAskAnswer(text), { answer: text.trim(), followups: [] })
})

test('parseAskAnswer 没有正文（标记在最前）时文本不变，避免吞掉回答', () => {
  const text = `${FOLLOWUP_MARK}\n- 问题 | principle`
  assert.deepEqual(parseAskAnswer(text), { answer: text, followups: [] })
})

test('parseAskAnswer 最多保留 3 条追问', () => {
  const items = ['一', '二', '三', '四'].map((q) => `- ${q} | free`).join('\n')
  const r = parseAskAnswer(`正文\n${FOLLOWUP_MARK}\n${items}`)
  assert.equal(r.followups.length, MAX_ASK_FOLLOWUPS)
  assert.deepEqual(r.followups.map((f) => f.question), ['一', '二', '三'])
})

test('sanitizeFollowups 问题截断到 30 字符（含省略号），理由截断，角度不合法时为 free', () => {
  const long = '甲'.repeat(40)
  const [a] = sanitizeFollowups([{ question: long, angle: 'bogus', why: '理'.repeat(60) }])
  assert.equal(Array.from(a.question).length, 30)
  assert.ok(a.question.endsWith('…'))
  assert.equal(a.angle, 'free')
  assert.equal(Array.from(a.why).length, 40)
  // 恰好 30 个字符不加省略号。
  assert.equal(sanitizeFollowups(['乙'.repeat(30)])[0].question, '乙'.repeat(30))
})

test('sanitizeFollowups 去重、跳过空问题、接受字符串，并把中文角度名映射为机器角度', () => {
  const r = sanitizeFollowups([
    '  问题甲  ',
    { question: '问题甲', angle: 'verify' },
    { question: '   ' },
    { question: '问题乙', angle: '易错' },
    42,
    null,
  ])
  assert.deepEqual(r, [
    { question: '问题甲', angle: 'free', why: '' },
    { question: '问题乙', angle: 'pitfall', why: '' },
  ])
})

test('sanitizeFollowups 非数组返回空数组', () => {
  assert.deepEqual(sanitizeFollowups(undefined), [])
  assert.deepEqual(sanitizeFollowups('追问'), [])
  assert.deepEqual(sanitizeFollowups({ question: 'x' }), [])
})

// ---------- 解析器容错：各种常见写法 ----------

const BODY = '相邻格只差一位。\n结论：可以圈。'

test('parseAskAnswer 容忍 Markdown 包裹的标记行：**追问：**、**追问**：、### 追问、【追问】、[追问]', () => {
  const items = '- 为什么能圈 | principle | 看位'
  for (const mark of ['**追问：**', '**追问**：', '### 追问', '### 追问：', '【追问】', '[追问]', '  追问 :  ', '追问 : ']) {
    const r = parseAskAnswer(`${BODY}\n\n${mark}\n${items}`)
    assert.equal(r.answer, BODY, `标记 ${mark}`)
    assert.deepEqual(r.followups, [{ question: '为什么能圈', angle: 'principle', why: '看位' }], `标记 ${mark}`)
  }
})

test('parseAskAnswer 标记行冒号后有同行文字时不是标记，原文不变', () => {
  const text = `${BODY}\n追问：为什么能圈\n- 另一个问题 | free`
  assert.deepEqual(parseAskAnswer(text), { answer: text.trim(), followups: [] })
})

test('parseAskAnswer 条目支持多种列表符号与编号', () => {
  const text = [
    BODY,
    '追问：',
    '* 问题一 | principle | 理由一',
    '• 问题二 | variant | 理由二',
    '· 问题三 | pitfall | 理由三',
    '– 问题四 | practice',
    '1. 问题五 | verify',
  ].join('\n')
  const r = parseAskAnswer(text)
  assert.deepEqual(
    r.followups.map((f) => f.question),
    ['问题一', '问题二', '问题三'],
    '最多保留 3 条，前三条应为 * • · 三种符号的条目',
  )
  const numbered = parseAskAnswer(`${BODY}\n追问：\n1. 甲问 | principle\n2、乙问 | variant\n3) 丙问 | pitfall\n4） 丁问 | free`)
  assert.deepEqual(numbered.followups.map((f) => [f.question, f.angle]), [
    ['甲问', 'principle'],
    ['乙问', 'variant'],
    ['丙问', 'pitfall'],
  ])
})

test('parseAskAnswer 支持全角竖线、角度带括号或加粗、CRLF 换行', () => {
  const text = `${BODY}\r\n\r\n追问：\r\n- 甲问 ｜ [原理] ｜ 理由甲\r\n- 乙问 | **变式** | 理由乙`
  const r = parseAskAnswer(text)
  assert.equal(r.answer, BODY)
  assert.deepEqual(r.followups, [
    { question: '甲问', angle: 'principle', why: '理由甲' },
    { question: '乙问', angle: 'variant', why: '理由乙' },
  ])
})

test('parseAskAnswer 条目没有分隔符时整行为问题，角度 free，理由为空', () => {
  const r = parseAskAnswer(`${BODY}\n追问：\n- 若两格不相邻会怎样\n- 圈法最容易错在哪`)
  assert.deepEqual(r.followups, [
    { question: '若两格不相邻会怎样', angle: 'free', why: '' },
    { question: '圈法最容易错在哪', angle: 'free', why: '' },
  ])
})

test('parseAskAnswer 条目里的加粗问题会去掉星号；装饰横线不算条目', () => {
  const r = parseAskAnswer(`${BODY}\n追问：\n---\n- **为什么** | principle | 看位`)
  assert.deepEqual(r.followups, [{ question: '为什么', angle: 'principle', why: '看位' }])
})

test('parseAskAnswer 标记后直接紧跟条目（无空行）也能拆出', () => {
  const r = parseAskAnswer(`${BODY}\n追问：\n- 甲问 | principle\n- 乙问 | variant`)
  assert.equal(r.answer, BODY)
  assert.equal(r.followups.length, 2)
})

test('parseAskAnswer 只认最后一个标记行（即使前面也有容忍写法的标记）', () => {
  const r = parseAskAnswer(`前文\n**追问：**\n- 旧问题 | free\n正文二\n【追问】\n- 新问题 | practice | 动手`)
  assert.equal(r.answer, '前文\n**追问：**\n- 旧问题 | free\n正文二')
  assert.deepEqual(r.followups, [{ question: '新问题', angle: 'practice', why: '动手' }])
})

test('parseAskAnswer 从不抛出：非字符串输入也返回空追问与字符串正文', () => {
  assert.deepEqual(parseAskAnswer(undefined as unknown as string), { answer: '', followups: [] })
  assert.deepEqual(parseAskAnswer(42 as unknown as string), { answer: '42', followups: [] })
})

// ---------- 调试日志：注入的 log 接收原始输出 ----------

test('askOnce 成功时把原始输出以一行 JSON 写入注入的日志（含解析出的追问条数）', async () => {
  const lines: string[] = []
  const text = `${BODY}\n\n${FOLLOWUP_MARK}\n- 为什么能圈 | principle | 看位\n- 若不相邻会怎样 | variant`
  const base = ctxFromChunks([
    { type: 'text-delta', index: 0, text },
    { type: 'finish', reason: { kind: 'stop' } },
  ])
  const r = await askOnce({ ...base, log: (line) => lines.push(line) }, { v: 1, path: [], question: 'q' })
  assert.equal(r.ok, true)
  assert.equal(lines.length, 1)
  assert.ok(!lines[0].includes('\n'), '日志必须是单行')
  const obj = JSON.parse(lines[0]) as { t: number; raw: string; parsedFollowups: number }
  assert.equal(obj.raw, text)
  assert.equal(obj.parsedFollowups, 2)
  assert.equal(typeof obj.t, 'number')
})

test('askOnce 失败时不写日志；日志抛错也不影响回答', async () => {
  const lines: string[] = []
  const failed = await askOnce(
    { ...ctxFromChunks([{ type: 'finish', reason: { kind: 'error', failure: { message: 'x' } } }]), log: (l) => lines.push(l) },
    { v: 1, path: [], question: 'q' },
  )
  assert.equal(failed.ok, false)
  assert.equal(lines.length, 0)
  const ok = await askOnce(
    {
      ...ctxFromChunks([
        { type: 'text-delta', index: 0, text: '正文。' },
        { type: 'finish', reason: { kind: 'stop' } },
      ]),
      log: () => {
        throw new Error('disk full')
      },
    },
    { v: 1, path: [], question: 'q' },
  )
  assert.deepEqual({ ...ok, raw: undefined }, { ok: true, text: '正文。', followups: [], raw: undefined })
})

// ---------- 主机：提示词、错误细节、追问结果 ----------

test('buildAskSystemPrompt 要求追问块，并给出可照抄且能被解析的格式示例', () => {
  const s = buildAskSystemPrompt()
  assert.match(s, /只回答用户这一个追问/)
  assert.match(s, /结论：/)
  assert.match(s, /追问块不计入/)
  assert.match(s, /- 问题 \| 角度 \| 理由/)
  for (const angle of FOLLOWUP_ANGLES) assert.ok(s.includes(angle), `缺少角度 ${angle}`)
  // 标记行独占一行，示例之后再无内容。
  assert.match(s, new RegExp(`^ {2}${FOLLOWUP_MARK}$`, 'm'))
  // 示例行（去掉两格缩进）单独交给解析器，应拆出正文与 2 条追问。
  const lines = s.split('\n')
  const start = lines.findIndex((l) => l.startsWith('格式示例'))
  assert.ok(start >= 0)
  const example = lines.slice(start + 1).map((l) => l.replace(/^ {2}/, ''))
  const parsed = parseAskAnswer(example.join('\n'))
  assert.equal(parsed.answer, '相邻格只差一位，所以可以圈在一起。\n结论：相邻圈法成立。')
  assert.equal(parsed.followups.length, 2)
  assert.equal(parsed.followups[0].angle, 'variant')
  assert.equal(parsed.followups[1].angle, 'pitfall')
})

test('llmDetail 只保留含中文、较短且不像 JSON 的文本', () => {
  assert.equal(llmDetail('请求过于频繁'), '请求过于频繁')
  assert.equal(llmDetail('Rate limit exceeded'), '')
  assert.equal(llmDetail('{"code":500,"message":"错误"}'), '')
  assert.equal(llmDetail('错'.repeat(81)), '')
  assert.equal(llmDetail(undefined), '')
  assert.equal(llmDetail(''), '')
})

/** 只收一段假流的最小 ctx（使用默认的 TextAssembler）。 */
function ctxFromChunks(chunks: AskChunk[]): AskContext {
  return {
    // 注入空日志，避免测试写入系统临时目录。
    log: () => {},
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
    llm: {
      async prepareCall() {
        return {
          config: {},
          stream() {
            return (async function* () {
              for (const c of chunks) yield c
            })()
          },
        }
      },
    },
  }
}

test('askOnce 把追问段落从正文剥离，并随结果返回 followups', async () => {
  const body = '相邻格只差一位。\n结论：可以圈。'
  const r = await askOnce(
    ctxFromChunks([
      { type: 'text-delta', index: 0, text: `${body}\n\n${FOLLOWUP_MARK}\n- 为什么能圈 | principle | 看位` },
      { type: 'finish', reason: { kind: 'stop' } },
    ]),
    { v: 1, path: [], question: 'q' },
  )
  assert.deepEqual({ ...r, raw: undefined }, {
    ok: true,
    text: body,
    followups: [{ question: '为什么能圈', angle: 'principle', why: '看位' }],
    raw: undefined,
  })
})

test('askOnce 解析失败时正文原样返回，追问为空', async () => {
  const text = '只有正文没有追问。'
  const r = await askOnce(
    ctxFromChunks([
      { type: 'text-delta', index: 0, text },
      { type: 'finish', reason: { kind: 'stop' } },
    ]),
    { v: 1, path: [], question: 'q' },
  )
  assert.deepEqual({ ...r, raw: undefined }, { ok: true, text, followups: [], raw: undefined })
})

test('askOnce 的底层英文错误转为中文通用说明，不泄露原文', async () => {
  const prep = await askOnce(
    { llm: { async prepareCall() { throw new Error('no adapter') } }, agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) } },
    { v: 1, path: [], question: 'q' },
  )
  assert.deepEqual(prep, { ok: false, error: '模型调用准备失败，请稍后重试。' })
  const fin = await askOnce(
    ctxFromChunks([{ type: 'finish', reason: { kind: 'error', failure: { code: 'RATE_LIMIT', message: 'rate limited' } } }]),
    { v: 1, path: [], question: 'q' },
  )
  assert.deepEqual(fin, { ok: false, error: '模型调用失败，请稍后重试。' })
})

// ---------- 客户端：结果读取、追问条目 ----------

test('readResult 成功时返回正文与规范化后的追问', () => {
  const r = readResult({
    ok: true,
    value: { result: { kind: 'success', text: '  正文  ', followups: [{ question: '问一', angle: 'verify', why: '试试' }, { question: '' }] } },
  })
  assert.deepEqual(r, { ok: true, text: '正文', followups: [{ question: '问一', angle: 'verify', why: '试试' }] })
})

test('readResult 没有 followups 字段时追问为空（兼容旧结果）', () => {
  const r = readResult({ ok: true, value: { result: { kind: 'success', text: '正文' } } })
  assert.deepEqual(r, { ok: true, text: '正文', followups: [] })
})

test('readResult 网关英文错误用通用中文，含中文的错误附上前 80 字', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(readResult({ ok: false, error: { message: 'HTTP 500 internal' } }), { ok: false, error: '追问未能发送，请重试。' })
    assert.deepEqual(readResult({ ok: false, error: { message: '网关超时' } }), { ok: false, error: '追问未能发送：网关超时' })
    assert.deepEqual(readResult({ ok: false, error: 'bad' }), { ok: false, error: '追问未能发送，请重试。' })
    assert.deepEqual(readResult(undefined), { ok: false, error: '追问未能发送，请重试。' })
  } finally {
    console.warn = warn
  }
})

test('readResult 失败结果的中文文本原样作为错误', () => {
  assert.deepEqual(readResult({ ok: true, value: { result: { kind: 'error', text: '模型调用失败：网络断开' } } }), {
    ok: false,
    error: '模型调用失败：网络断开',
  })
})

test('toFollowups 理由为空时使用默认提示，角度与问题保持不变', () => {
  assert.deepEqual(toFollowups([{ question: 'q', angle: 'pitfall', why: '' }]), [
    { question: 'q', angle: 'pitfall', why: ASK_FOLLOWUP_WHY },
  ])
  assert.deepEqual(toFollowups(undefined), [])
})

const PARENT = { nodeId: 'p1', knowledgeIds: ['k1'], knowledgeNames: ['卡诺图'] }

test('buildAskEntry 模型给出的追问优先：即使知识图谱也有追问，新卡片仍用模型的', () => {
  // k1 有未探索的子知识点，确定性追问非空；模型追问应覆盖它。
  const e = buildAskEntry({
    parent: { nodeId: 'p1', knowledgeIds: ['k1.5'] },
    index: 0,
    question: '问',
    answer: '答',
    followups: [{ question: '如果换成三变量会怎样', angle: 'variant', why: '' }],
    now: 9,
    token: 'z',
  })
  assert.deepEqual(e.card.followups, [{ question: '如果换成三变量会怎样', angle: 'variant', why: ASK_FOLLOWUP_WHY }])
  assert.equal(e.card.parentFollowup, 0)
})

test('buildAskEntry 模型没有给出追问时，才使用知识图谱生成的追问', () => {
  // k1.6.1 是原子且无前置、无相关，确定性追问为空：此时只能是空。
  const leaf = buildAskEntry({ parent: { nodeId: 'p-leaf', knowledgeIds: ['k1.6.1'] }, question: '问', answer: '答', now: 1, token: 'a' })
  assert.deepEqual(leaf.card.followups, [])
  // 模型追问为空数组视为没有：k1.5 的确定性子知识点追问生效。
  const fallback = buildAskEntry({
    parent: { nodeId: 'p2', knowledgeIds: ['k1.5'] },
    question: '问',
    answer: '答',
    followups: [],
    now: 2,
    token: 'b',
  })
  assert.ok(fallback.card.followups.length > 0)
  assert.ok(fallback.card.followups.every((f) => f.angle === 'principle'))
})

test('buildAskEntry 省略 index 时不写 parentFollowup（自由追问不占用追问桩）', () => {
  const e = buildAskEntry({ parent: PARENT, question: '自由问', answer: '答', now: 9, token: 'z' })
  assert.equal('parentFollowup' in e.card, false)
  assert.equal(e.card.parentId, 'p1')
  assert.ok(e.card.followups.every((f) => f.angle === 'principle'))
  assert.deepEqual(e.card.knowledgeIds, ['k1'])
})

// ---------- 树：直接回答子卡片与追问桩 ----------

function cardOf(nodeId: string, over: Partial<CardRecord> = {}): CardRecord {
  return {
    nodeId,
    callId: `call-${nodeId}`,
    title: nodeId,
    summary: 's',
    kind: 'concept',
    knowledgeIds: [],
    followups: [],
    parentId: null,
    ...over,
  }
}

test('树构建：自由子卡片（无 parentFollowup）挂在父卡片下且不吃掉追问桩', () => {
  const root = cardOf('R', {
    followups: [
      { question: 'Q0', angle: 'principle', why: '' },
      { question: 'Q1', angle: 'variant', why: '' },
    ],
  })
  const slotted = cardOf('A', { parentId: 'R', parentFollowup: 0 })
  const free = cardOf('F', { parentId: 'R' })
  const view: TreeView = { v: 1, nodes: [root, slotted, free] }
  const [top] = buildForest(view)
  assert.deepEqual(top.children.map((k) => k.id), ['A', 'R#1', 'F'])
  assert.equal(top.children[1].kind, 'stub')
  assert.equal(top.children[1].followupIndex, 1)
})

test('树构建：直接回答卡片的追问桩出现在它自己的子树中，且 id 唯一', () => {
  const root = cardOf('R', { followups: [{ question: 'Q0', angle: 'principle', why: '' }] })
  const child = cardOf('A', {
    parentId: 'R',
    parentFollowup: 0,
    followups: [{ question: 'AQ', angle: 'free', why: '' }],
  })
  const freeUnderChild = cardOf('B', { parentId: 'A' })
  const forest = buildForest({ v: 1, nodes: [root, child, freeUnderChild] })
  const a = forest[0].children[0]
  assert.equal(a.id, 'A')
  assert.deepEqual(a.children.map((k) => k.id), ['A#0', 'B'])
  const ids = new Set<string>()
  const walk = (n: (typeof forest)[number]): void => {
    ids.add(n.id)
    n.children.forEach(walk)
  }
  forest.forEach(walk)
  assert.equal(ids.size, 4)
})

// ---------- 画布平移：纯函数 ----------

test('exceedsPanThreshold 以 4px 为界（欧氏距离）', () => {
  assert.equal(PAN_THRESHOLD, 4)
  assert.equal(exceedsPanThreshold(3, 0), false)
  assert.equal(exceedsPanThreshold(4, 0), true)
  assert.equal(exceedsPanThreshold(0, -4), true)
  assert.equal(exceedsPanThreshold(2.8, 2.8), false)
  assert.equal(exceedsPanThreshold(0, 0), false)
})

test('panScroll 指针向右拖动时内容跟随，滚动位置减少', () => {
  assert.deepEqual(panScroll({ left: 100, top: 50 }, 30, -20, { x: 500, y: 500 }), { left: 70, top: 70 })
})

test('panScroll 限制在 0 与最大滚动量之间', () => {
  assert.deepEqual(panScroll({ left: 10, top: 10 }, 100, 100, { x: 500, y: 500 }), { left: 0, top: 0 })
  assert.deepEqual(panScroll({ left: 490, top: 490 }, -100, -100, { x: 500, y: 500 }), { left: 500, top: 500 })
  assert.deepEqual(panScroll({ left: 0, top: 0 }, -10, -10, { x: -5, y: -5 }), { left: 0, top: 0 })
})

test('panScroll 遇到非有限位移时保持起点', () => {
  assert.deepEqual(panScroll({ left: 7, top: 9 }, Number.NaN, Number.POSITIVE_INFINITY, { x: 100, y: 100 }), { left: 7, top: 9 })
})

test('readResult: 追问块只在 text 里（DSH 丢弃额外字段）时仍能拆出 followups', () => {
  const text = '相邻格只差一位。\n结论：可以圈。\n追问：\n- 为什么能圈？ | principle | 看原理\n- 换成五变量呢？ | variant | 扩展'
  const r = readResult({ ok: true, value: { result: { kind: 'success', text } } })
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.text, '相邻格只差一位。\n结论：可以圈。')
    assert.equal(r.followups.length, 2)
    assert.equal(r.followups[0].angle, 'principle')
  }
})
test('askOnce asks for reasoningEffort off first and falls back to the model default when unsupported', async () => {
  const seen: Array<Record<string, unknown>> = []
  const mk = (rejectEffort: boolean) => ({
    log: () => {},
    agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm', reasoningEffort: 'high' }) },
    llm: {
      async prepareCall(config: Record<string, unknown>) {
        seen.push(config)
        if (rejectEffort && config.reasoningEffort !== undefined) throw new Error('UNSUPPORTED_REASONING_EFFORT')
        return {
          config: {},
          async *stream() {
            yield { type: 'text', text: '答。\n结论：好。' } as never
          },
        }
      },
    },
    createAssembler: () => ({
      push() {},
      finish: { kind: 'stop' },
      blocks: () => [{ type: 'text', text: '答。\n结论：好。' }],
    }),
  })
  const ok = await askOnce(mk(false) as never, { v: 1, path: [], question: 'q' })
  assert.equal(ok.ok, true)
  assert.equal(seen[0]!.reasoningEffort, 'off')
  seen.length = 0
  const fb = await askOnce(mk(true) as never, { v: 1, path: [], question: 'q' })
  assert.equal(fb.ok, true)
  assert.equal(seen.length, 2)
  assert.equal(seen[1]!.reasoningEffort, undefined)
})