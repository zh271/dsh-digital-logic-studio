// 图示区文案（统一中文；en 与 zh 相同，保证任何语言设置下都显示中文）。
// 图示区的卡片主体复用主卡片的文案（bool.*、num.*、verify.*、angle.*），因此这里的字典先合并主字典。
import { zh as mainZh } from '../locale.ts'

export const FIGURES_NS = 'dlogicFigures'

const figZh: Record<string, string> = {
  'figures.cap.kmap': '卡诺图',
  'figures.cap.truth_table': '真值表',
  'figures.cap.minimize': '化简结果',
  'figures.cap.hazard': '险象分析',
  'figures.cap.canonical': '标准形式',
  'figures.cap.equivalent': '等价判断',
  'figures.cap.complement': '求反',
  'figures.cap.dual': '对偶式',
  'figures.cap.gate_form': '门电路形式',
  'figures.cap.parse': '解析',
  'figures.cap.convert': '进制转换',
  'figures.cap.comb': '组合逻辑',
  'figures.cap.mem': '存储与可编程逻辑',
  'figures.cap.adda': 'A/D 与 D/A',
  'figures.cap.system': '数字系统',
  'figures.cap.seq': '时序逻辑',
  'figures.cap.fsm': '有限状态机',
  'figures.cap.simulate': 'Verilog 仿真',
  'figures.cap.lint': 'Verilog 静态检查',
  'figures.more': '展开其余 {n} 个',
  'figures.less': '收起',
  'figures.followups': '继续追问',
  'figures.sent': '已发送到侧边追问',
  'figures.expanded': '已展开',
  'figures.askFailed': '追问未能发送，请重试。',
  'figures.askUnavailable': '当前无法发送追问。',
}

export const figuresZh: Record<string, string> = { ...mainZh, ...figZh }
export const figuresEn: Record<string, string> = figuresZh
