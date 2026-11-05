import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CardRecord, Followup, TreeView } from '../src/shared/contracts.ts'
import { buildFollowupPrompt, FOLLOWUP_CHILD_LABEL } from '../src/shared/sidechat.ts'
import { buildContextPath, PATH_CAP, selectAllFollowupChildren, selectFollowupChild } from '../src/client/sidechat/context.ts'
import { followupDisplayText } from '../src/client/sidechat/display.ts'

function fu(question: string): Followup {
  return { question, angle: 'principle', why: '理由' }
}

function rec(over: Partial<CardRecord> & { nodeId: string }): CardRecord {
  return {
    callId: `call-${over.nodeId}`,
    title: `标题${over.nodeId}`,
    kind: 'concept',
    summary: `摘要${over.nodeId}`,
    knowledgeIds: ['k1.5.2'],
    followups: [fu('问0'), fu('问1')],
    parentId: null,
    ...over,
  }
}

function view(nodes: CardRecord[]): TreeView {
  return { v: 1, nodes }
}

test('buildContextPath returns root-to-card order including the card itself', () => {
  const a = rec({ nodeId: 'cA' })
  const b = rec({ nodeId: 'cB', parentId: 'cA', parentFollowup: 0 })
  const c = rec({ nodeId: 'cC', parentId: 'cB', parentFollowup: 1 })
  const path = buildContextPath(view([a, b, c]), c)
  assert.deepEqual(path.map((p) => p.nodeId), ['cA', 'cB', 'cC'])
  assert.deepEqual(path[0], { nodeId: 'cA', title: '标题cA', summary: '摘要cA', knowledgeIds: ['k1.5.2'] })
})

test('buildContextPath keeps the nearest entries when the chain is longer than the cap', () => {
  const chain: CardRecord[] = []
  for (let i = 0; i < 9; i++) {
    chain.push(rec({ nodeId: `c${i}`, parentId: i === 0 ? null : `c${i - 1}` }))
  }
  const path = buildContextPath(view(chain), chain[8])
  assert.equal(path.length, PATH_CAP)
  assert.deepEqual(path.map((p) => p.nodeId), ['c3', 'c4', 'c5', 'c6', 'c7', 'c8'])
})

test('buildContextPath stops at unknown parents and cycles', () => {
  const x = rec({ nodeId: 'cX', parentId: 'cMISSING' })
  assert.deepEqual(buildContextPath(view([x]), x).map((p) => p.nodeId), ['cX'])

  const p = rec({ nodeId: 'cP', parentId: 'cQ' })
  const q = rec({ nodeId: 'cQ', parentId: 'cP' })
  const path = buildContextPath(view([p, q]), p)
  assert.deepEqual(path.map((n) => n.nodeId), ['cQ', 'cP'])
})

test('buildContextPath works without a tree and for a card that is not in the tree', () => {
  const c = rec({ nodeId: 'cZ', parentId: 'cA' })
  assert.deepEqual(buildContextPath(undefined, c).map((n) => n.nodeId), ['cZ'])
})

test('buildFollowupPrompt over a built path carries the prefix and the parent reference', () => {
  const a = rec({ nodeId: 'cA' })
  const b = rec({ nodeId: 'cB', parentId: 'cA', parentFollowup: 1 })
  const prompt = buildFollowupPrompt({
    path: buildContextPath(view([a, b]), b),
    parentNodeId: 'cB',
    followupIndex: 0,
    question: '为什么？',
  })
  assert.ok(prompt.startsWith('【追问 cB#0】为什么？'))
  assert.ok(prompt.includes('parentId 为 cB'))
  assert.ok(prompt.includes('1. 标题cA'))
  assert.ok(prompt.includes('2. 标题cB'))
})

const snapshot = {
  subagentsByParent: {
    s1: {
      state: 'ready',
      entries: [
        { kind: 'child', id: 'other', mode: 'continuable' },
        { kind: 'child', id: 'side-1', mode: 'continuable' },
        { kind: 'child', id: 'side-2', mode: 'continuable' },
      ],
    },
    s2: { state: 'ready', entries: [{ kind: 'child', id: 'side-x', mode: 'once' }] },
  },
  byId: {
    other: { projectionValues: { subagent: { label: '别的子代理' } } },
    'side-1': { projectionValues: { subagent: { label: FOLLOWUP_CHILD_LABEL } } },
    'side-2': { projectionValues: { subagent: { label: FOLLOWUP_CHILD_LABEL } } },
    'side-x': { projectionValues: { subagent: { label: FOLLOWUP_CHILD_LABEL } } },
  },
}

test('selectFollowupChild picks the latest (last in catalog order) continuable child with the follow-up label', () => {
  assert.equal(selectFollowupChild(snapshot, 's1'), 'side-2')
})

test('selectFollowupChild ignores non-continuable children, other labels and other parents', () => {
  assert.equal(selectFollowupChild(snapshot, 's2'), undefined)
  assert.equal(selectFollowupChild(snapshot, 'nobody'), undefined)
  assert.equal(selectFollowupChild({ subagentsByParent: { s1: { entries: [{ kind: 'child', id: 'other', mode: 'continuable' }] } }, byId: { other: { projectionValues: { subagent: { label: '别的子代理' } } } } }, 's1'), undefined)
})

test('selectFollowupChild reads the label from the catalog entry (real DSH shape, no byId data)', () => {
  const real = { subagentsByParent: { p: { state: 'ready', entries: [{ kind: 'child', id: 'c1', mode: 'continuable', label: FOLLOWUP_CHILD_LABEL }] } } }
  assert.equal(selectFollowupChild(real, 'p'), 'c1')
})

test('selectFollowupChild reads DSH 0.2.x projectionsBySession.subagentCatalog (entries without kind)', () => {
  const v02 = { projectionsBySession: { p: { values: { subagentCatalog: [{ id: 'x', mode: 'one-shot', label: FOLLOWUP_CHILD_LABEL }, { id: 'c2', mode: 'continuable', label: FOLLOWUP_CHILD_LABEL }] } } } }
  assert.equal(selectFollowupChild(v02, 'p'), 'c2')
})

test('selectFollowupChild tolerates missing or malformed snapshots', () => {
  assert.equal(selectFollowupChild(undefined, 's1'), undefined)
  assert.equal(selectFollowupChild(null, 's1'), undefined)
  assert.equal(selectFollowupChild({}, 's1'), undefined)
  assert.equal(selectFollowupChild({ subagentsByParent: { s1: { entries: [{ kind: 'child' }, { kind: 'child', mode: 'continuable' }] } } }, 's1'), undefined)
  assert.equal(selectFollowupChild(snapshot, ''), undefined)
})

test('selectAllFollowupChildren lists every continuable follow-up child of the parent, oldest first', () => {
  assert.deepEqual(selectAllFollowupChildren(snapshot, 's1'), ['side-1', 'side-2'])
  assert.deepEqual(selectAllFollowupChildren(snapshot, 's2'), [])
  assert.deepEqual(selectAllFollowupChildren(snapshot, 'nobody'), [])
  assert.deepEqual(selectAllFollowupChildren(undefined, 's1'), [])
  assert.deepEqual(selectAllFollowupChildren({}, 's1'), [])
})

test('selectAllFollowupChildren reads DSH 0.2.x catalog and de-duplicates ids', () => {
  const v02 = {
    projectionsBySession: {
      p: {
        values: {
          subagentCatalog: [
            { id: 'a', mode: 'continuable', label: FOLLOWUP_CHILD_LABEL },
            { id: 'b', mode: 'one-shot', label: FOLLOWUP_CHILD_LABEL },
            { id: 'a', mode: 'continuable', label: FOLLOWUP_CHILD_LABEL },
            { id: 'c', mode: 'continuable', label: FOLLOWUP_CHILD_LABEL },
          ],
        },
      },
    },
  }
  assert.deepEqual(selectAllFollowupChildren(v02, 'p'), ['a', 'c'])
  assert.equal(selectFollowupChild(v02, 'p'), 'c')
})

test('selectFollowupChild is the last element of selectAllFollowupChildren', () => {
  assert.equal(selectFollowupChild(snapshot, 's1'), selectAllFollowupChildren(snapshot, 's1').at(-1))
})

test('followupDisplayText keeps only the question line of a follow-up prompt', () => {
  const prompt = `【追问 n7#0】为什么相邻格只差一位？

【背景】这是主对话学习树上的追问。
1. 标题：摘要（知识点 k1.5.2；卡片 n7）

【要求】按 digital-logic-tutor 技能只回答上面这一个追问。`
  assert.equal(followupDisplayText(prompt), '为什么相邻格只差一位？')
})

test('followupDisplayText handles CRLF, a question with no background, and surrounding whitespace', () => {
  assert.equal(followupDisplayText('【追问 cB#2】  如何验证？  \r\n\r\n【背景】x'), '如何验证？')
  assert.equal(followupDisplayText('【追问 cB#2】只有一行'), '只有一行')
})

test('followupDisplayText leaves ordinary user text unchanged', () => {
  assert.equal(followupDisplayText('用卡诺图化简 F'), '用卡诺图化简 F')
  assert.equal(followupDisplayText(''), '')
})
