// 文案（统一中文；en 为 zh 的别名，保证任何语言设置下都显示中文）。

export const NS = 'dlogicStudio'

import { zh as combZh } from './cards/comb.locale.ts'
import { zh as seqZh } from './cards/seq.locale.ts'
import { zh as fsmZh } from './cards/fsm.locale.ts'
import { zh as memZh } from './cards/mem.locale.ts'
import { zh as addaZh } from './cards/adda.locale.ts'
import { zh as systemZh } from './cards/system.locale.ts'
import { zh as hdlZh } from './cards/hdl.locale.ts'

const baseZh: Record<string, string> = {
  'num.title': '进制转换',
  'num.preparing': '准备进制转换',
  'num.running': '正在计算',
  'num.failed': '输入有误',
  'num.decimal': '十进制值 {value}',
  'num.inexact': '小数部分未除尽，已保留 {precision} 位',

  'bool.title': '布尔函数',
  'bool.preparing': '准备布尔函数运算',
  'bool.running': '正在计算',
  'bool.failed': '计算失败',
  'bool.op.parse': '解析',
  'bool.op.truth_table': '真值表',
  'bool.op.canonical': '标准形式',
  'bool.op.minimize': '化简',
  'bool.op.kmap': '卡诺图',
  'bool.op.hazard': '险象分析',
  'bool.op.complement': '求反',
  'bool.op.dual': '对偶式',
  'bool.op.gate_form': '门电路形式',
  'bool.op.equivalent': '等价判断',
  'bool.minimal': '最简表达式',
  'bool.multi': '共 {n} 个等价最简解',
  'bool.solutions': '{n} 个最简解',
  'bool.cost': '代价：{terms} 项，{literals} 个文字',
  'bool.primes': '质蕴涵项（粗体为本质质蕴涵项）',
  'bool.rows': '{n} 行',
  'bool.truth.all': '显示全部 {n} 行',
  'bool.truth.collapse': '收起',
  'bool.canonical.sigma': 'Σm',
  'bool.canonical.pi': 'ΠM',
  'bool.canonical.sopForm': '标准与或式',
  'bool.canonical.posForm': '标准或与式',
  'bool.hazard.none': '无静态险象',
  'bool.hazard.count': '{n} 组相邻最小项',
  'bool.hazard.static1': '静态 1 型险象',
  'bool.hazard.static0': '静态 0 型险象',
  'bool.hazard.pair': 'm{a} ↔ m{b}',
  'bool.hazard.var': '变化变量 {v}',
  'bool.hazard.add': '加入项',
  'bool.hazard.freeSop': '消除险象后的 SOP',
  'bool.input': '输入',
  'bool.result': '结果',
  'bool.gate.nandNand': '与非-与非',
  'bool.gate.norNor': '或非-或非',
  'bool.gate.andOrInvert': '与或非',
  'bool.equiv.yes': '等价',
  'bool.equiv.no': '不等价',
  'bool.counter': '反例',
  'bool.parse.vars': '变量',
  'bool.parse.minterms': '最小项',
  'bool.parse.dontcares': '无关项',
  'bool.none': '无',
  'bool.kmap.groups': '圈组',
  'bool.kmap.minimal': '化简结果',
  'bool.kmap.noGroups': '无圈组',
  'bool.kmap.cells': '{n} 格',
  'bool.kmap.plane': '{v}={p}',
  'bool.kmap.solution': '解 {n}',

  'verify.title': '等价与最简性',
  'verify.preparing': '准备验证',
  'verify.running': '正在验证',
  'verify.failed': '验证失败',
  'verify.equivalent': '等价',
  'verify.notEquivalent': '不等价',
  'verify.minimal': '最简',
  'verify.notMinimal': '不是最简',
  'verify.unknown': '无法判断',
  'verify.candidate': '候选式代价',
  'verify.minimalCost': '最简代价',
  'verify.cost': '{terms} 项，{literals} 个文字',
  'verify.counter': '反例',
  'verify.leftOut': '候选式',
  'verify.rightOut': '原函数',
  'verify.reference': '参考答案',

  'know.title': '知识点',
  'know.preparing': '准备查询知识点',
  'know.running': '正在查询',
  'know.failed': '查询失败',
  'know.count': '{n} 个知识点',
  'know.missing': '未找到：{ids}',
  'know.sec.nodes': '知识点',
  'know.sec.search': '搜索结果',
  'know.sec.self': '本节',
  'know.sec.parent': '上级',
  'know.sec.children': '下级',
  'know.sec.prereqs': '前置',
  'know.sec.related': '相关',
  'know.sec.dependents': '后续',

  'learn.title': '学习卡片',
  'learn.preparing': '准备整理学习卡片',
  'learn.running': '正在整理',
  'learn.failed': '卡片数据有误',
  'learn.expanded': '已展开',
  'learn.sent': '已发送',
  'learn.askFailed': '追问未能发送，请重试。',
  'learn.askUnavailable': '当前无法发送追问。',

  'angle.principle': '原理',
  'angle.variant': '变式',
  'angle.pitfall': '易错',
  'angle.prerequisite': '前置',
  'angle.verify': '验证',
  'angle.practice': '练习',
  'angle.free': '延伸',

  'tree.title': '学习树',
  'tree.guideDescription': '把每次回答和追问整理成一棵知识树',
  'tree.empty': '开始提问后，每次回答会成为一张卡片，点击卡片下的追问即可向右展开。',
  'tree.count': '{n} 张卡片',
  'tree.latest': '回到最新',
  'tree.asking': '回答中…',
  'tree.askFailed': '追问未能发送，请重试。',
  'tree.knowledge': '知识点',
  'tree.followups': '追问',
  'tree.locate': '定位到对话',
  'tree.reset': '重置布局',
  'tree.select': '选择',
  'tree.deselect': '取消选择',
  'tree.selectedCount': '已选 {n} 张',
  'tree.compare': '对比所选',
  'tree.summarize': '总结所选',
  'tree.clearSelect': '清除选择',
  'tree.outline': '复习提纲',
  'tree.synthBusy': '生成中…',
  'tree.synthHint': '正在生成，约需 10–15 秒',
  'tree.needTwo': '至少选择 2 张卡片才能对比。',
  'tree.needOne': '请先选择卡片。',
  'tree.needTwoTree': '卡片不足 2 张，无法生成复习提纲。',
  'tree.synthFailed': '生成失败，请重试。',
  'tree.copyBranch': '复制分支上下文',
  'tree.copied': '已复制',
  'tree.copyFailed': '复制失败，请重试。',
  'tree.freeAskPlaceholder': '继续追问…',
  'tree.freeAskSend': '发送',
  'tree.freeAskTooLong': '追问内容过长（上限 {n} 字符）。',

  'side.title': '侧边追问',
  'side.hint': '点击卡片下的追问，回答会出现在这里',
  'side.turns': '{n} 条回答',
  'side.answering': '回答中…',
  'side.fullscreen': '全屏查看',
  'learn.sentSide': '已发送到侧边追问',
}

export const zh: Record<string, string> = { ...baseZh, ...combZh, ...seqZh, ...fsmZh, ...memZh, ...addaZh, ...systemZh, ...hdlZh }

/** 界面文案统一使用中文：en 与 zh 为同一份字典，无论 DSH 语言设置为何都显示中文。key 结构保留。 */
export const en: Record<string, string> = zh

/** 翻译函数：按 key 取文案。 */
export type TFn = (key: string) => string

/** 把 {name} 占位符替换为 vars 中的值。 */
export function fmt(t: TFn, key: string, vars?: Record<string, unknown>): string {
  let s = t(key)
  for (const [k, v] of Object.entries(vars ?? {})) s = s.split(`{${k}}`).join(String(v))
  return s
}
