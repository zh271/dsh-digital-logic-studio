// 数字系统卡片文案（统一中文）。键均以 system. 开头。
export const zh: Record<string, string> = {
  'system.title': '数字系统',
  'system.preparing': '准备数字系统计算',
  'system.running': '正在计算',
  'system.failed': '计算失败',

  'system.op.asm': 'ASM 图校验',
  'system.op.controller': '控制器设计',

  'system.asm.valid': 'ASM 图校验通过',
  'system.asm.invalid': 'ASM 图存在 {n} 处错误',
  'system.asm.issues': '问题列表',
  'system.asm.error': '错误',
  'system.asm.warning': '提示',
  'system.asm.diagram': 'ASM 图',
  'system.asm.table': '状态转移表（与 ASM 图等价）',
  'system.asm.outputs': 'Moore 输出',
  'system.asm.empty': '无',
  'system.asm.vars': '条件变量',
  'system.asm.when': '当',
  'system.asm.uncond': '无条件',
  'system.asm.yes': '是',
  'system.asm.no': '否',
  'system.asm.elseLabel': '其余',

  'system.table.state': '状态',
  'system.table.code': '编码',
  'system.table.line': '译码输出',
  'system.table.data': '数据端输入',
  'system.table.unused': '未用编码',

  'system.controller.summary': '{n} 个状态 · 三种控制器方案',
  'system.controller.initial': '初始状态',
  'system.controller.signals': '控制信号真值表（状态 → 各控制信号）',

  'system.scheme.counter': '方案一：计数器型',
  'system.scheme.mux': '方案二：多路选择器型',
  'system.scheme.sequence': '方案三：定序型',
  'system.scheme.bits': '状态寄存器位（高位在前）',
  'system.scheme.functions': '次态与控制函数（已化简）',
  'system.scheme.minimized': '未化简（变量超过 6 个，列出最小项和式）',
  'system.scheme.cost': '{terms} 项，{literals} 个文字',
  'system.scheme.solution': '解 {n}',

  'system.mux.title': '多路选择器 MUX（次态位 {bit}）',
  'system.mux.select': '地址端',

  'system.role.count': '计数条件',
  'system.role.load': '置数条件',
  'system.role.load-data': '置数值',
  'system.role.mux-data': '数据端',
  'system.role.next': '次态',
}
