// 直接模型追问的共享约定：Host 命令名、命令 rawInput 格式，以及模型回答中“追问”段落的解析。
// Host（src/host/ask.ts）与前端（src/client/ask/**）都依赖这里。只用可擦除语法。

import type { FollowupAngle } from './contracts.ts'
import type { FollowupContext } from './sidechat.ts'

/** Host 命令名：前端执行 `/${ASK_LLM_COMMAND} <json>`，结果文本放在 result.text，追问放在 result.followups。 */
export const ASK_LLM_COMMAND = 'dlogic-ask-llm'

/** 命令的 rawInput（JSON 字符串）。 */
export interface AskLlmCommandInput {
  v: 1
  /** 从根到被追问卡片（含）的路径。 */
  path: FollowupContext['path']
  /** 学生的追问原文。 */
  question: string
  /** 本地求解器预先算好的事实文本，可省略。 */
  localFacts?: string
}

/** 追问段落的标记行（独立成行）：模型回答的正文之后，以它开头列出后续追问。 */
export const FOLLOWUP_MARK = '追问：'
/** 每次回答最多保留的后续追问条数。 */
export const MAX_ASK_FOLLOWUPS = 3
/** 后续追问问题的最大字符数（含省略号）。 */
export const ASK_FOLLOWUP_QUESTION_MAX = 30
/** 理由的最大字符数。 */
export const ASK_FOLLOWUP_WHY_MAX = 40

export const FOLLOWUP_ANGLES: readonly FollowupAngle[] = [
  'principle',
  'variant',
  'pitfall',
  'prerequisite',
  'verify',
  'practice',
  'free',
]

/** 模型可能写出的中文角度名，映射到机器角度。 */
const ANGLE_ALIASES: Record<string, FollowupAngle> = {
  原理: 'principle',
  变式: 'variant',
  易错: 'pitfall',
  前置: 'prerequisite',
  验证: 'verify',
  练习: 'practice',
  延伸: 'free',
}

/** 一条后续追问建议（与 Followup 同形，但 why 可为空，由调用方补默认值）。 */
export interface AskFollowupSuggestion {
  question: string
  angle: FollowupAngle
  why: string
}

export interface ParsedAskAnswer {
  /** 正文（不含追问段落，已 trim）；没有可用的追问段落时为原文（已 trim）。 */
  answer: string
  followups: AskFollowupSuggestion[]
}

/** 按字符（非 UTF-16 单元）截断，超出时在末尾加省略号，结果总长不超过 max。 */
function clipChars(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : text
}

function angleOf(raw: unknown): FollowupAngle {
  if (typeof raw !== 'string') return 'free'
  // 去掉模型可能加的括号与强调符号，如 [principle]、（原理）、**原理**。
  const trimmed = raw.replace(/[()（）[\]【】*_`]/g, '').trim()
  const key = trimmed.toLowerCase()
  if ((FOLLOWUP_ANGLES as readonly string[]).includes(key)) return key as FollowupAngle
  return ANGLE_ALIASES[trimmed] ?? 'free'
}

/**
 * 校验并规范化后续追问（用于解析结果与前端收到的数据）：
 * 接受字符串（视为仅问题、角度 free）或对象；问题压缩空白并截断到 30 字符；角度不合法时为 free；
 * 去掉空问题与重复问题；最多保留 3 条。非数组返回空数组。纯函数，不抛出。
 */
export function sanitizeFollowups(raw: unknown): AskFollowupSuggestion[] {
  if (!Array.isArray(raw)) return []
  const out: AskFollowupSuggestion[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    let question: unknown
    let angle: unknown
    let why: unknown
    if (typeof item === 'string') question = item
    else if (typeof item === 'object' && item !== null) {
      const o = item as Record<string, unknown>
      question = o.question
      angle = o.angle
      why = o.why
    } else continue
    if (typeof question !== 'string') continue
    const q = clipChars(question.replace(/\s+/g, ' ').trim(), ASK_FOLLOWUP_QUESTION_MAX)
    if (q === '' || seen.has(q)) continue
    seen.add(q)
    const w = typeof why === 'string' ? clipChars(why.replace(/\s+/g, ' ').trim(), ASK_FOLLOWUP_WHY_MAX) : ''
    out.push({ question: q, angle: angleOf(angle), why: w })
    if (out.length >= MAX_ASK_FOLLOWUPS) break
  }
  return out
}

/**
 * 判断一行是否为追问标记行。容忍的写法：`追问：`、`追问:`、`**追问：**`、`### 追问`、`【追问】`、`**追问**：`。
 * 冒号之后若还有文字（如“追问：为什么…”）不是标记行。纯函数，不抛出。
 */
function isFollowupMark(line: string): boolean {
  const core = line.replace(/[*_`#>[\]【】]/g, '').trim()
  return /^追问\s*[：:]?$/.test(core)
}

/** 去掉列表前缀：- * • · – 或 1. 1、 1) 1） 等。 */
const LIST_PREFIX = /^(?:[-–—·•*●]|\d+\s*[.、)）])\s*/

/** 分隔符：| 或全角 ｜（前后可有空格）。 */
const FIELD_SEP = /\s*[|｜]\s*/

/**
 * 把追问段落的一行拆成 问题 | 角度 | 理由。
 * 没有分隔符时整行作为问题，角度为 free，理由为空。空行或只有符号的行返回 null。纯函数，不抛出。
 */
function parseFollowupLine(raw: string): AskFollowupSuggestion | null {
  let line = raw.trim().replace(LIST_PREFIX, '').replace(/\*\*/g, '').trim()
  // 只有横线、等号等装饰符的行（如 ---）不是追问。
  if (line === '' || /^[\s\-–—_=~*]+$/.test(line)) return null
  if (!FIELD_SEP.test(line)) return { question: line, angle: 'free', why: '' }
  const [question, angle, ...rest] = line.split(FIELD_SEP)
  return { question: question ?? '', angle: angleOf(angle), why: rest.join(' ') }
}

/**
 * 解析模型回答：找到最后一个标记行（见 isFollowupMark），其前为正文，其后每个非空行为一条追问，
 * 格式为“- 问题 | 角度 | 理由”（角度与理由可省略，也可以没有分隔符，整行即问题）。
 * 没有标记行、或标记后没有任何可用追问时，返回整段原文（已 trim）且追问为空，即“解析失败时文本不变”。
 * 纯函数，不抛出。
 */
export function parseAskAnswer(text: string): ParsedAskAnswer {
  try {
    const source = String(text ?? '')
    const whole = source.trim()
    const lines = source.replace(/\r\n?/g, '\n').split('\n')
    let mark = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      if (isFollowupMark(lines[i].trim())) {
        mark = i
        break
      }
    }
    if (mark < 0) return { answer: whole, followups: [] }
    const followups = sanitizeFollowups(
      lines
        .slice(mark + 1)
        .map(parseFollowupLine)
        .filter((x): x is AskFollowupSuggestion => x !== null),
    )
    const answer = lines.slice(0, mark).join('\n').trim()
    if (followups.length === 0 || answer === '') return { answer: whole, followups: [] }
    return { answer, followups }
  } catch {
    return { answer: String(text ?? '').trim(), followups: [] }
  }
}
