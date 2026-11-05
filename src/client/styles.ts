// 样式（只引用 DSH 主题变量）。

export const PREFIX = 'dlogic'

/** 带前缀的 class 名，例如 c("row") → "dlogic-row"。 */
export const c = (name: string): string => `${PREFIX}-${name}`

export const css = `
.${PREFIX}-card{display:flex;flex-direction:column}
.${PREFIX}-row{display:flex;align-items:center;gap:6px;min-width:0;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:var(--dsh-content-font-size-secondary,13px)}
.${PREFIX}-row:hover{color:var(--dsw-alias-label-secondary)}
.${PREFIX}-row[data-static]{cursor:default}
.${PREFIX}-title{flex:none}
.${PREFIX}-dot{flex:none;width:2px;height:2px;border-radius:1px;background:var(--dsw-alias-label-caption)}
.${PREFIX}-summary{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${PREFIX}-error{color:var(--dsw-alias-state-error-primary)}
.${PREFIX}-body{margin:4px 0 4px 4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);overflow:hidden}
.${PREFIX}-head{padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-markdown-code-block-banner);color:var(--dsw-alias-label-primary);font-size:15px;font-weight:500}
.${PREFIX}-head sub{font-size:11px}
.${PREFIX}-meta{padding:6px 12px 0;color:var(--dsw-alias-label-caption);font-size:12px}
.${PREFIX}-step{padding:8px 12px}
.${PREFIX}-step+.${PREFIX}-step{border-top:.5px solid var(--dsw-alias-border-l2)}
.${PREFIX}-step-text{color:var(--dsw-alias-label-secondary);font-size:13px;margin-bottom:6px}
.${PREFIX}-mono{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}
.${PREFIX}-table{border-collapse:collapse;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary)}
.${PREFIX}-table td{padding:1px 10px 1px 0;text-align:right}
.${PREFIX}-table td.${PREFIX}-digit{color:var(--dsw-alias-label-primary);font-weight:600;padding-left:12px}
.${PREFIX}-groups{display:flex;flex-wrap:wrap;gap:6px;font:var(--dsw-font-markdown-code-block-small)}
.${PREFIX}-group{padding:1px 6px;border:.5px solid var(--dsw-alias-border-l1);border-radius:4px;color:var(--dsw-alias-label-secondary)}

.${PREFIX}-expr{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.${PREFIX}-neg{text-decoration:overline;text-decoration-thickness:1px}
.${PREFIX}-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:2px 0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.${PREFIX}-line-label{color:var(--dsw-alias-label-caption);font-size:12px;flex:none}
.${PREFIX}-muted{color:var(--dsw-alias-label-caption)}
.${PREFIX}-ok{color:var(--dsw-alias-label-primary);font-weight:500}
.${PREFIX}-bad{color:var(--dsw-alias-state-error-primary);font-weight:500}
.${PREFIX}-chips{display:flex;flex-wrap:wrap;gap:6px}
.${PREFIX}-chip{display:inline-flex;align-items:baseline;gap:6px;margin:0;padding:3px 8px;max-width:100%;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.${PREFIX}-chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-chip:disabled{cursor:default;opacity:.6}
.${PREFIX}-chip-ess{border-width:1px;color:var(--dsw-alias-label-primary);font-weight:600}
.${PREFIX}-chip-angle{font-size:12px;color:var(--dsw-alias-label-caption);flex:none}
.${PREFIX}-chip-q{min-width:0;overflow-wrap:anywhere}
.${PREFIX}-btn{margin:0;padding:2px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.${PREFIX}-btn:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-btn:disabled{cursor:default;opacity:.6}
.${PREFIX}-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.${PREFIX}-list li{display:flex;gap:8px;align-items:baseline;min-width:0;font-size:13px;color:var(--dsw-alias-label-secondary)}
.${PREFIX}-id{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-caption);flex:none}

.${PREFIX}-tt-wrap{overflow-x:auto;max-width:100%}
.${PREFIX}-tt{border-collapse:collapse;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary)}
.${PREFIX}-tt th{font-weight:500;color:var(--dsw-alias-label-caption);padding:2px 10px;border-bottom:.5px solid var(--dsw-alias-border-l2);text-align:center}
.${PREFIX}-tt td{padding:2px 10px;text-align:center;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.${PREFIX}-tt td.${PREFIX}-tt-m{color:var(--dsw-alias-label-caption)}
.${PREFIX}-tt td.${PREFIX}-tt-out{color:var(--dsw-alias-label-primary);font-weight:600}
.${PREFIX}-tt td.${PREFIX}-muted{color:var(--dsw-alias-label-caption);font-weight:400}

.${PREFIX}-kmap-planes{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
.${PREFIX}-kmap-plane{flex:0 0 auto;display:flex;flex-direction:column;gap:4px}
.${PREFIX}-kmap-label{font-size:12px;color:var(--dsw-alias-label-caption)}
.${PREFIX}-kmap-grid{display:grid;align-items:stretch}
.${PREFIX}-kmap-corner{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-caption);padding:0 6px 2px 0;white-space:nowrap;text-align:right;border-bottom:.5px solid var(--dsw-alias-border-l2);border-right:.5px solid var(--dsw-alias-border-l2)}
.${PREFIX}-kmap-hdr{font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-caption);display:flex;align-items:center;justify-content:center;padding:2px}
.${PREFIX}-kmap-hdr-row{justify-content:flex-end;padding-right:6px}
.${PREFIX}-kmap-cell{position:relative;width:40px;height:34px;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);display:flex;align-items:center;justify-content:center;font:var(--dsw-font-markdown-code-block-small);font-size:13px;color:var(--dsw-alias-label-primary)}
.${PREFIX}-kmap-cell.${PREFIX}-muted{color:var(--dsw-alias-label-caption)}
.${PREFIX}-kmap-idx{position:absolute;top:1px;right:3px;font-size:12px;line-height:1;color:var(--dsw-alias-label-caption);z-index:1}
.${PREFIX}-kmap-val{position:relative;z-index:1}
.${PREFIX}-kmap-grp{position:absolute;box-sizing:border-box;border-width:1px;border-style:solid;pointer-events:none}
.${PREFIX}-legend{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.${PREFIX}-legend-item{display:flex;align-items:baseline;gap:8px;font-size:13px;color:var(--dsw-alias-label-secondary)}
.${PREFIX}-swatch{flex:none;width:10px;height:10px;border-radius:2px;align-self:center}

.${PREFIX}-verdict{display:inline-flex;align-items:center;padding:1px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:12px;color:var(--dsw-alias-label-primary)}
.${PREFIX}-verdict-bad{color:var(--dsw-alias-state-error-primary)}

.${PREFIX}-treepane{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-secondary);font-size:13px}
.${PREFIX}-tree-empty{display:flex;flex-direction:column;gap:8px;padding:16px;color:var(--dsw-alias-label-secondary);font-size:13px}
.${PREFIX}-tree-empty h3{margin:0;font-size:15px;font-weight:500;color:var(--dsw-alias-label-primary)}
.${PREFIX}-tree-empty p{margin:0;line-height:1.5}
.${PREFIX}-tree-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-caption);font-size:12px}
.${PREFIX}-tree-err{padding:4px 12px;color:var(--dsw-alias-state-error-primary);font-size:12px}
.${PREFIX}-tree-scroll{position:relative;flex:1;min-height:0;overflow:auto}
.${PREFIX}-tree-canvas{position:relative}
.${PREFIX}-tree-edges{position:absolute;pointer-events:none;overflow:visible}
.${PREFIX}-tree-synth{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;padding:4px 12px;border-bottom:.5px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-caption);font-size:12px}
.${PREFIX}-tnode-sel{outline:.5px solid var(--dsw-alias-label-secondary);outline-offset:2px}
.${PREFIX}-tree-edge{fill:none;stroke:var(--dsw-alias-border-l1);stroke-width:1}
.${PREFIX}-tree-edge-src{fill:none;stroke:var(--dsw-alias-label-caption);stroke-width:.5px;stroke-dasharray:3 3}
.${PREFIX}-tree-synth-hint{color:var(--dsw-alias-label-tertiary)}
.${PREFIX}-tnode{position:absolute;box-sizing:border-box;width:280px;margin:0;padding:8px 10px;display:flex;flex-direction:column;gap:4px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;text-align:left;cursor:pointer}
.${PREFIX}-tnode:hover:not(:disabled):not([aria-disabled="true"]){background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-tnode:disabled{cursor:default}
.${PREFIX}-tnode-stub{border-style:dashed;background:transparent}
.${PREFIX}-tnode-stub-off{opacity:.6;cursor:default}
.${PREFIX}-tnode-title{color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.${PREFIX}-tnode-sum{font-size:12px;color:var(--dsw-alias-label-tertiary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.${PREFIX}-tnode-q{font-size:12px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.${PREFIX}-tnode-tag{font-size:12px;color:var(--dsw-alias-label-caption)}
.${PREFIX}-tnode{width:280px;cursor:pointer;user-select:none}
.${PREFIX}-tnode-title{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
.${PREFIX}-tnode-sum{font-size:12px;line-height:1.4;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;overflow-wrap:anywhere}
.${PREFIX}-tnode-open{cursor:default;z-index:2;box-shadow:0 2px 10px rgba(0,0,0,.14)}
.${PREFIX}-tnode-open .${PREFIX}-tnode-title,.${PREFIX}-tnode-open .${PREFIX}-tnode-sum{display:block;-webkit-line-clamp:none;overflow:visible}
.${PREFIX}-tnode-child{border-left-width:2px}
.${PREFIX}-tnode-drag{cursor:grabbing;opacity:.85;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.${PREFIX}-tnode-detail{display:flex;flex-direction:column;gap:6px;margin-top:6px;padding-top:6px;border-top:.5px solid var(--dsw-alias-border-l2);cursor:auto}
.${PREFIX}-tnode-kn{font-size:12px;color:var(--dsw-alias-label-caption);overflow-wrap:anywhere}
.${PREFIX}-tnode-section{font-size:12px;color:var(--dsw-alias-label-caption)}
.${PREFIX}-tnode-fus{display:flex;flex-direction:column;gap:4px}
.${PREFIX}-tnode-fu{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;width:100%;margin:0;padding:4px 6px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;text-align:left;cursor:pointer}
.${PREFIX}-tnode-fu:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-tnode-fu:disabled{cursor:default;opacity:.6}
.${PREFIX}-tnode-fu-q{min-width:0;overflow-wrap:anywhere}
.${PREFIX}-tnode-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}
.${PREFIX}-tree-bar-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.${PREFIX}-tree-scroll{cursor:grab}
.${PREFIX}-tree-panning,.${PREFIX}-tree-panning *{cursor:grabbing!important;user-select:none}
.${PREFIX}-ask-free{display:flex;flex-direction:column;gap:4px;cursor:auto}
.${PREFIX}-ask-free-row{display:flex;align-items:center;gap:6px}
.${PREFIX}-ask-free-input{flex:1;min-width:0;box-sizing:border-box;padding:4px 8px;border:.5px solid var(--dsw-alias-border-l1);border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}
.${PREFIX}-ask-free-input:disabled{opacity:.6}
.${PREFIX}-side{flex:none;display:flex;flex-direction:column;min-height:0;border-top:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}
.${PREFIX}-side-split{flex:none;height:6px;cursor:row-resize;touch-action:none}
.${PREFIX}-side-split:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-side-bar{flex:none;display:flex;align-items:center;gap:8px;padding:6px 12px;cursor:pointer;color:var(--dsw-alias-label-secondary);font-size:12px;user-select:none}
.${PREFIX}-side-bar:hover:not([aria-disabled="true"]){background:var(--dsw-alias-interactive-bg-hover-solid)}
.${PREFIX}-side-bar[aria-disabled="true"]{cursor:default;opacity:.7}
.${PREFIX}-side-chev{flex:none;width:12px;color:var(--dsw-alias-label-caption)}
.${PREFIX}-side-title{flex:none;color:var(--dsw-alias-label-primary);font-weight:500}
.${PREFIX}-side-meta{flex:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-caption)}
.${PREFIX}-side-body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.${PREFIX}-ask-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:8px 12px}
.${PREFIX}-ask-item{display:flex;flex-direction:column;gap:4px;padding-bottom:10px;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.${PREFIX}-ask-item:last-child{border-bottom:none}
.${PREFIX}-ask-q{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.${PREFIX}-ask-a{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere}
.${PREFIX}-ask-link{color:var(--dsw-alias-label-primary);text-decoration:underline dotted;text-decoration-color:var(--dsw-alias-label-caption);text-underline-offset:3px;cursor:pointer;border-radius:2px}
.${PREFIX}-ask-link:hover{text-decoration-style:solid}
.${PREFIX}-ask-link:focus-visible{outline:1px solid var(--dsw-alias-label-caption);outline-offset:2px}
.${PREFIX}-ask-link-busy{opacity:.55;cursor:progress}
.${PREFIX}-code{max-height:360px;overflow:auto;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary)}
.${PREFIX}-code-line{display:flex;gap:10px;white-space:pre;min-width:max-content;padding-right:12px}
.${PREFIX}-code-no{flex:none;width:2.5em;text-align:right;color:var(--dsw-alias-label-caption);user-select:none}
.${PREFIX}-code-error{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent)}
.${PREFIX}-code-warning{background:color-mix(in srgb,var(--dsw-alias-border-l1) 50%,transparent)}
`

const STYLE_TAG_ID = 'dsh-digital-logic-studio/client.css'

/** 把样式注入一次到文档头部（重复加载时不重复注入）。 */
export function injectStyles(): void {
  if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(STYLE_TAG_ID) + ']') === null) {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-digital-logic-studio'
    tag.dataset.pluginCss = STYLE_TAG_ID
    tag.textContent = css
    document.head.appendChild(tag)
  }
}
