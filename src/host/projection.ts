// 学习树会话投影：从 dlogic_card 的 tool/result 事件累积卡片，并给前端提供 TreeView。
import { TREE_PROJECTION_KEY, type TreeView } from '../shared/contracts.ts'
import { applyTreeEvent, EMPTY_TREE, treeView, type TreeState } from '../shared/tree.ts'
import { z } from 'zod'

// 使用 z.custom 而非 z.object：parse 原样返回输入，保证状态与视图的引用稳定。
function isTreeState(v: unknown): v is TreeState {
  if (typeof v !== 'object' || v === null) return false
  const nodes = (v as { nodes?: unknown }).nodes
  return Array.isArray(nodes) && nodes.every(n => typeof n === 'object' && n !== null)
}

function isTreeView(v: unknown): v is TreeView {
  if (typeof v !== 'object' || v === null) return false
  const view = v as { v?: unknown; nodes?: unknown }
  return view.v === 1 && Array.isArray(view.nodes)
}

export const treeProjectionDefinition = {
  key: TREE_PROJECTION_KEY,
  // v2：v1 按工具名识别事件（DSH 的 tool/result 不带工具名），已缓存的 v1 状态全部作废。
  stateVersion: 2,
  stateSchema: z.custom<TreeState>(isTreeState),
  init: (): TreeState => EMPTY_TREE,
  apply: applyTreeEvent,
  wire: {
    viewSchema: z.custom<TreeView>(isTreeView),
    view: treeView,
  },
}

/** 注册学习树投影。调用方应在 ctx.inject(['sessionProjections'], ...) 内调用。 */
export function registerTreeProjection(ctx: { sessionProjections: { register(def: unknown): unknown } }): void {
  ctx.sessionProjections.register(treeProjectionDefinition)
}
