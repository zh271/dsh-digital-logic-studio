// 学习树画布的平移（纯函数，不依赖 DOM，可单测）：指针位移换算为滚动位置，以及开始平移的阈值判断。

/** 超过此距离（px）才视为平移，否则仍是点击。 */
export const PAN_THRESHOLD = 4

/** 位移是否已超过阈值（欧氏距离 >= threshold）。 */
export function exceedsPanThreshold(dx: number, dy: number, threshold: number = PAN_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * 指针从按下时的位置移动了 (dx, dy)，内容应跟随指针移动，因此滚动位置向反方向变化。
 * start 为按下时的 scrollLeft / scrollTop；max 为可滚动的最大值（scrollWidth - clientWidth 等，负值按 0 处理）。
 * 非有限数值时保持起点。
 */
export function panScroll(
  start: { left: number; top: number },
  dx: number,
  dy: number,
  max: { x: number; y: number },
): { left: number; top: number } {
  const left = Number.isFinite(dx) ? start.left - dx : start.left
  const top = Number.isFinite(dy) ? start.top - dy : start.top
  return {
    left: clamp(left, 0, Math.max(0, max.x)),
    top: clamp(top, 0, Math.max(0, max.y)),
  }
}

/** 画布在滚动方向上额外留出的空白占容器尺寸的比例：保证任何布局下都能把树拖离原点再拖回。 */
export const PAN_SLACK_RATIO = 0.6

/**
 * 树画布（.tree-canvas）的盒子尺寸。内容盒（layoutW/layoutH）加两侧留白（padX/padY），再加滚动余量：
 * 左到右布局在宽、高两个方向都加 paneW/paneH × PAN_SLACK_RATIO，使面板很宽、树装得下时仍有可拖动的滚动范围；
 * 大纲式（indented）布局不加宽度余量（避免横向滚动条），只加纵向余量。
 * paneW/paneH 为滚动容器的内容区尺寸；未测量（0）、负值或非有限值按 0 处理。
 * 只改画布盒，不改 SVG 连线层与节点位置。
 */
export function canvasSize(
  layoutW: number,
  layoutH: number,
  padX: number,
  padY: number,
  paneW: number,
  paneH: number,
  indented: boolean,
): { width: number; height: number } {
  const pw = Number.isFinite(paneW) && paneW > 0 ? paneW : 0
  const ph = Number.isFinite(paneH) && paneH > 0 ? paneH : 0
  const slackX = indented ? 0 : Math.round(pw * PAN_SLACK_RATIO)
  const slackY = Math.round(ph * PAN_SLACK_RATIO)
  return {
    width: layoutW + padX * 2 + slackX,
    height: layoutH + padY * 2 + slackY,
  }
}
