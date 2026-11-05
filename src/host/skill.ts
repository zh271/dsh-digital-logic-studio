// 随包教学技能的 provider。
// 注意：构建后本文件位于 lib/index.js，因此技能目录相对于 lib/index.js 解析。
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill'

const SKILL_DIR = new URL('../skills/digital-logic-tutor/', import.meta.url)
const SKILL_BODY_URL = new URL('SKILL.md', SKILL_DIR)
export const PROVIDER_NAME = 'dlogic-studio'
const RESOURCE_BASE = { kind: 'directory', path: fileURLToPath(SKILL_DIR) }

export const CANDIDATE = {
  name: 'digital-logic-tutor',
  description:
    '《数字逻辑》课程助教：数制与编码、布尔代数与卡诺图、组合逻辑与 74 系列 MSI 芯片、触发器与时序电路、' +
    '状态机设计、存储器扩展、可编程逻辑、Verilog HDL、数字系统与小型控制器、A/D 与 D/A 转换。' +
    '用户问到这些内容、做相关习题或课程设计时使用。',
  invocation: { modelInvocable: true, userInvocable: true },
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: RESOURCE_BASE,
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_BODY_URL,
}

export const skillProvider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get() {
    return {
      name: CANDIDATE.name,
      description: CANDIDATE.description,
      invocation: CANDIDATE.invocation,
      provider: CANDIDATE.provider,
      source: CANDIDATE.source,
      resourceBase: RESOURCE_BASE,
      content: await readFile(SKILL_BODY_URL, 'utf8'),
    }
  },
}
