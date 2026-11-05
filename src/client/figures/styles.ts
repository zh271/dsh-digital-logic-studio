// 图示区样式（只引用 DSH 主题变量；class 前缀 dlf-）。

export const FIG_PREFIX = 'dlf'

/** 带前缀的 class 名，例如 fc("cap") → "dlf-cap"。 */
export const fc = (name: string): string => `${FIG_PREFIX}-${name}`

export const figuresCss = `
.${FIG_PREFIX}-wrap{margin-top:8px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:10px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:13px}
.${FIG_PREFIX}-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;min-width:0}
.${FIG_PREFIX}-fig{min-width:0;display:flex;flex-direction:column;gap:6px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block)}
.${FIG_PREFIX}-cap{font-size:12px;color:var(--dsw-alias-label-caption)}
.${FIG_PREFIX}-body{min-width:0;overflow-x:auto}
.${FIG_PREFIX}-body .dlogic-step{padding:4px 0}
.${FIG_PREFIX}-body .dlogic-step+.dlogic-step{border-top:.5px solid var(--dsw-alias-border-l2)}
.${FIG_PREFIX}-verdict{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;font-size:13px;color:var(--dsw-alias-label-primary)}
.${FIG_PREFIX}-verdict-bad{color:var(--dsw-alias-state-error-primary)}
.${FIG_PREFIX}-verdict-ce{font-size:12px;color:var(--dsw-alias-label-caption)}
.${FIG_PREFIX}-fu{display:flex;flex-direction:column;gap:6px;min-width:0}
.${FIG_PREFIX}-fu-title{font-size:12px;color:var(--dsw-alias-label-caption)}
.${FIG_PREFIX}-chips{display:flex;flex-wrap:wrap;gap:6px}
.${FIG_PREFIX}-chip{display:inline-flex;align-items:baseline;gap:6px;margin:0;padding:3px 8px;max-width:100%;height:auto;min-height:0;white-space:normal;overflow:visible;text-overflow:clip;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;line-height:1.5;text-align:left;cursor:pointer}
.${FIG_PREFIX}-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.${FIG_PREFIX}-chip:disabled{cursor:default;opacity:.6}
.${FIG_PREFIX}-chip-angle{font-size:12px;color:var(--dsw-alias-label-caption);flex:none}
.${FIG_PREFIX}-chip-q{min-width:0;white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word}
.${FIG_PREFIX}-chip-status{font-size:12px;color:var(--dsw-alias-label-caption);flex:none}
.${FIG_PREFIX}-note{font-size:12px;color:var(--dsw-alias-label-caption)}
.${FIG_PREFIX}-err{font-size:12px;color:var(--dsw-alias-state-error-primary)}
.${FIG_PREFIX}-btn{align-self:flex-start;margin:0;padding:2px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.${FIG_PREFIX}-btn:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
`

const STYLE_TAG_ID = 'dsh-digital-logic-studio/figures.css'

/** 把图示区样式注入一次到文档头部（重复加载时不重复注入）。 */
export function injectFigureStyles(): void {
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_TAG_ID) + ']') === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-digital-logic-studio'
    tag.dataset.pluginCss = STYLE_TAG_ID
    tag.textContent = figuresCss
    document.head.appendChild(tag)
  }
}
