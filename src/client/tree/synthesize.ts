// 学习树的综合操作：调用直接模型生成对比/总结/复习提纲并写入直接回答存储；复制分支文本到剪贴板。
// 纯逻辑在 ask/synth.ts；这里只负责副作用（模型调用、存储、剪贴板）。
import type { CardRecord } from '../../shared/contracts.ts'
import { askFollowupLlm } from '../ask/api.ts'
import { randomToken } from '../ask/entries.ts'
import { buildSynthEntry, buildSynthQuestion, type SynthKind } from '../ask/synth.ts'
import { addAskAnswer } from '../ask/store.ts'

/** 全图复习提纲最多纳入的卡片数（按树中出现顺序取前若干张）。 */
export const OUTLINE_CAP = 40

/** 成功时返回新综合卡片的 nodeId，供界面滚动定位。 */
export type SynthResult = { ok: true; nodeId: string } | { ok: false; error: string }

/**
 * 对 cards 生成一条综合回答并保存为新的根卡片。outline 只取前 OUTLINE_CAP 张。
 * 任何失败都返回 { ok: false, error }（中文），不抛出。
 */
export async function synthesize(sessionId: string, kind: SynthKind, cards: readonly CardRecord[]): Promise<SynthResult> {
  const used = kind === 'outline' ? cards.slice(0, OUTLINE_CAP) : cards.slice()
  if (used.length === 0) return { ok: false, error: '没有可用的卡片。' }
  const question = buildSynthQuestion(kind, used)
  const path = used.map((n) => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: n.knowledgeIds }))
  try {
    const r = await askFollowupLlm(sessionId, path, question)
    if (!r.ok) return { ok: false, error: r.error }
    const entry = buildSynthEntry({ kind, sources: used, answer: r.text, followups: r.followups, now: Date.now(), token: randomToken() })
    addAskAnswer(sessionId, entry)
    return { ok: true, nodeId: entry.card.nodeId }
  } catch (error) {
    console.warn('[dlogic] synth failed:', error)
    return { ok: false, error: '生成失败，请重试。' }
  }
}

/**
 * 复制文本：优先 navigator.clipboard，失败时用隐藏的 textarea + execCommand('copy')。
 * 返回是否成功。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 回退到 execCommand。
  }
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  try {
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (ta.parentNode) ta.parentNode.removeChild(ta)
  }
}
