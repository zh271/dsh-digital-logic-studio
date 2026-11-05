// 所有 dlogic_* 工具共用的返回信封。
import { DlogicInputError, type Envelope, type Step } from '../shared/contracts.ts'

/** 所有 dlogic_* 工具共用的输出 schema。 */
export const ENVELOPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', required: true },
    op: { type: 'string', required: true },
    result: { type: 'json', description: 'op 专属的结构化结果；ok 为 false 时为 null' },
    error: { type: 'string', description: 'ok 为 false 时的原因' },
    steps: { type: 'array', required: true, items: { type: 'json' } },
    warnings: { type: 'array', required: true, items: { type: 'string' } },
  },
} as const

export interface EnvelopeRun<R> {
  result: R
  steps?: Step[]
  warnings?: string[]
}

/** 输入错误变成 ok: false 的领域结果；其他异常照常抛出。 */
export function envelope<R>(op: string, run: () => EnvelopeRun<R>): Envelope<R> {
  try {
    const { result, steps = [], warnings = [] } = run()
    // 宿主要求输出可无损序列化为 JSON：去掉值为 undefined 的键。
    const clean = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))
    return { ok: true, op, result: clean(result), steps: clean(steps), warnings }
  } catch (error) {
    if (error instanceof DlogicInputError) {
      return { ok: false, op, result: null, error: error.message, steps: [], warnings: [] }
    }
    throw error
  }
}
