window.__ModuleLoader__.load({
	id: "dsh-digital-logic-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/meta.ts
function isObj(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isSettled(block) {
  return isObj(block) && "kind" in block;
}
function readMeta(block, tool) {
  if (!isObj(block)) return null;
  const meta = block.meta;
  if (!isObj(meta) || meta.v !== 1 || meta.tool !== tool) return null;
  const value = meta.value;
  if (!isObj(value) || typeof value.ok !== "boolean") return null;
  if (value.ok && !isObj(value.result)) return null;
  return {
    ok: value.ok,
    op: typeof value.op === "string" ? value.op : "",
    result: value.result ?? null,
    error: typeof value.error === "string" ? value.error : void 0,
    steps: Array.isArray(value.steps) ? value.steps : [],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((w) => typeof w === "string") : []
  };
}
function argsRawOf(block) {
  if (!isObj(block)) return void 0;
  if (isObj(block.call) && typeof block.call.argsRaw === "string") return block.call.argsRaw;
  return typeof block.argsRaw === "string" ? block.argsRaw : void 0;
}
function parseArgs(raw) {
  try {
    const v = JSON.parse(raw ?? "");
    return isObj(v) ? v : {};
  } catch {
    return {};
  }
}
function firstArgText(args, keys) {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return "";
}
function resultText(block) {
  if (!isObj(block) || !Array.isArray(block.content)) return "";
  const parts = [];
  for (const item of block.content) {
    if (!isObj(item)) continue;
    parts.push(item.type === "text" && typeof item.text === "string" ? item.text : JSON.stringify(item));
  }
  return parts.join("\n");
}
var ANGLES = ["principle", "variant", "pitfall", "prerequisite", "verify", "practice", "free"];
function angleLabelKey(angle) {
  return typeof angle === "string" && ANGLES.includes(angle) ? `angle.${angle}` : "angle.free";
}

// src/client/styles.ts
var PREFIX = "dlogic";
var c = (name) => `${PREFIX}-${name}`;
var css = `
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
`;
var STYLE_TAG_ID = "dsh-digital-logic-studio/client.css";
function injectStyles() {
  if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]") === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-digital-logic-studio";
    tag.dataset.pluginCss = STYLE_TAG_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }
}

// src/client/logicModel.ts
function matchVar(s, pos, vars) {
  const sorted = [...vars].sort((a, b) => b.length - a.length);
  for (const v of sorted) {
    if (v !== "" && s.startsWith(v, pos)) return v;
  }
  return /^[A-Za-z]$/.test(s[pos] ?? "") ? s[pos] : null;
}
function parseSeq(s, start, vars, inGroup) {
  const nodes = [];
  let pos = start;
  while (pos < s.length) {
    const ch = s[pos];
    if (ch === ")" && inGroup) return { nodes, pos };
    if (ch === "(") {
      const inner = parseSeq(s, pos + 1, vars, true);
      pos = inner.pos;
      if (s[pos] === ")") pos++;
      let neg = false;
      while (s[pos] === "'") {
        neg = !neg;
        pos++;
      }
      nodes.push({ k: "g", children: inner.nodes, neg });
      continue;
    }
    const name = matchVar(s, pos, vars);
    if (name !== null) {
      pos += name.length;
      let neg = false;
      while (s[pos] === "'") {
        neg = !neg;
        pos++;
      }
      nodes.push({ k: "v", name, neg });
      continue;
    }
    nodes.push({ k: "t", s: ch });
    pos++;
  }
  return { nodes, pos };
}
function parseExpr(text, variables = []) {
  return parseSeq(text, 0, variables, false).nodes;
}

// src/client/logic.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function renderNodes(nodes) {
  return nodes.map((n, i) => {
    if (n.k === "t") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: n.s }, i);
    if (n.k === "v") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: n.neg ? c("neg") : void 0, children: n.name }, i);
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: n.neg ? c("neg") : void 0, children: [
      "(",
      renderNodes(n.children),
      ")"
    ] }, i);
  });
}
function Expr({ text, variables }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: c("expr"), children: renderNodes(parseExpr(text, variables ?? [])) });
}

// src/client/cards/comb.locale.ts
var zh = {
  "comb.title": "\u7EC4\u5408\u903B\u8F91",
  "comb.preparing": "\u51C6\u5907\u7EC4\u5408\u903B\u8F91\u8FD0\u7B97",
  "comb.running": "\u6B63\u5728\u8BA1\u7B97",
  "comb.failed": "\u8BA1\u7B97\u5931\u8D25",
  "comb.op.analyze": "\u95E8\u7EA7\u5206\u6790",
  "comb.op.map_msi": "\u82AF\u7247\u5B9E\u73B0",
  "comb.op.draw": "\u903B\u8F91\u56FE",
  "comb.diagram.title": "\u95E8\u7EA7\u903B\u8F91\u56FE",
  "comb.wave.title": "\u6CE2\u5F62\uFF08\u8F93\u5165\u6309\u771F\u503C\u8868\u987A\u5E8F\u8BA1\u6570\uFF09",
  "comb.wave.hidden": "\u8F93\u5165\u8D85\u8FC7 5 \u4E2A\uFF0C\u7565\u53BB\u6CE2\u5F62\u56FE",
  "comb.levels": "{n} \u7EA7",
  "comb.gates": "{n} \u4E2A\u95E8",
  "comb.none": "\u65E0",
  "comb.warn": "\u6CE8\u610F",
  "comb.analyze.inputs": "\u8F93\u5165",
  "comb.analyze.steps": "\u9010\u7EA7\u63A8\u5BFC",
  "comb.analyze.col.gate": "\u95E8\u8F93\u51FA",
  "comb.analyze.col.type": "\u7C7B\u578B",
  "comb.analyze.col.level": "\u7EA7",
  "comb.analyze.col.local": "\u672C\u7EA7\u5F0F",
  "comb.analyze.col.expr": "\u4EE3\u5165\u8F93\u5165",
  "comb.analyze.final": "\u8F93\u51FA\u8868\u8FBE\u5F0F",
  "comb.analyze.simplified": "\u5316\u7B80\u7ED3\u679C",
  "comb.analyze.cost": "{terms} \u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "comb.analyze.noExpr": "\u5C55\u5F00\u5F0F\u8FC7\u957F\uFF0C\u7565",
  "comb.analyze.truth": "\u771F\u503C\u8868",
  "comb.analyze.truthMore": "\u5171 {n} \u884C\uFF0C\u9010\u884C\u7565\u53BB",
  "comb.pins.title": "\u56FD\u6807\u5F15\u811A\u4E0E\u522B\u540D",
  "comb.pins.name": "\u5F15\u811A",
  "comb.pins.alias": "\u522B\u540D",
  "comb.pins.level": "\u6709\u6548\u7535\u5E73",
  "comb.pins.note": "\u8BF4\u660E",
  "comb.active.high": "\u9AD8\u7535\u5E73\u6709\u6548",
  "comb.active.low": "\u4F4E\u7535\u5E73\u6709\u6548",
  "comb.active.none": "\u2014",
  "comb.wiring.title": "\u63A5\u7EBF\u8868",
  "comb.wiring.pin": "\u82AF\u7247\u5F15\u811A",
  "comb.wiring.signal": "\u8FDE\u63A5",
  "comb.wiring.note": "\u8BF4\u660E",
  "comb.func": "\u5B9E\u73B0\u51FD\u6570",
  "comb.decoder.nand": "\u4E0E\u975E\u95E8\u5B9E\u73B0",
  "comb.decoder.constant": "\u51FD\u6570\u6052\u4E3A {v}",
  "comb.mux.reduced": "\u964D\u7EF4\u771F\u503C\u8868",
  "comb.mux.select": "\u9009\u62E9\u7AEF",
  "comb.mux.high": "\u6570\u636E\u7AEF\u53D8\u91CF",
  "comb.mux.code": "\u9009\u62E9\u7801",
  "comb.mux.dataPin": "\u6570\u636E\u7AEF",
  "comb.mux.value": "\u6570\u636E\u7AEF\u53D6\u503C",
  "comb.mux.noHigh": "\u51FD\u6570\u53D8\u91CF\u5168\u90E8\u4F5C\u4E3A\u9009\u62E9\u7AEF\uFF0C\u6570\u636E\u7AEF\u4E3A\u5E38\u6570",
  "comb.adder.correction": "BCD \u4FEE\u6B63\u4FE1\u53F7",
  "comb.adder.bcd": "8421 \u7801\u4FEE\u6B63",
  "comb.parity.output": "\u8F93\u51FA\u5F15\u811A",
  "comb.encoder.note": "\u4F18\u5148\u7F16\u7801\u5668\uFF0C\u4E0D\u76F4\u63A5\u5B9E\u73B0\u4EFB\u610F\u51FD\u6570"
};

// src/client/cards/seq.locale.ts
var zh2 = {
  "seq.title": "\u65F6\u5E8F\u903B\u8F91",
  "seq.preparing": "\u51C6\u5907\u65F6\u5E8F\u903B\u8F91\u8FD0\u7B97",
  "seq.running": "\u6B63\u5728\u8BA1\u7B97",
  "seq.failed": "\u8BA1\u7B97\u5931\u8D25",
  "seq.op.ff": "\u89E6\u53D1\u5668",
  "seq.op.analyze": "\u65F6\u5E8F\u7535\u8DEF\u5206\u6790",
  "seq.op.counter": "\u8BA1\u6570\u5668\u8BBE\u8BA1",
  "seq.op.shift": "\u79FB\u4F4D\u4E0E\u5FAA\u73AF\u8BA1\u6570\u5668",
  "seq.op.waveform": "\u65F6\u5E8F\u6CE2\u5F62",
  "seq.col.q": "Qn",
  "seq.col.next": "Qn+1",
  "seq.col.input": "\u8F93\u5165",
  "seq.col.output": "\u8F93\u51FA",
  "seq.col.state": "\u73B0\u6001",
  "seq.col.nextState": "\u6B21\u6001",
  "seq.col.index": "\u5E8F\u53F7",
  "seq.col.bits": "\u72B6\u6001",
  "seq.col.value": "\u5341\u8FDB\u5236",
  "seq.col.note": "\u8BF4\u660E",
  "seq.ff.characteristic": "\u7279\u6027\u65B9\u7A0B",
  "seq.ff.constraint": "\u7EA6\u675F\u6761\u4EF6",
  "seq.ff.table": "\u7279\u6027\u8868",
  "seq.ff.excitation": "\u6FC0\u52B1\u8868",
  "seq.ff.any": "X \u4E3A\u65E0\u5173\u9879",
  "seq.ff.forbidden": "\u7981\u6B62",
  "seq.ff.trigger.edge": "\u8FB9\u6CBF\u89E6\u53D1",
  "seq.ff.trigger.level": "\u7535\u5E73\u89E6\u53D1",
  "seq.ff.trigger.none": "\u65E0\u65F6\u949F",
  "seq.analyze.drives": "\u9A71\u52A8\u65B9\u7A0B",
  "seq.analyze.state": "\u72B6\u6001\u65B9\u7A0B",
  "seq.analyze.outputs": "\u8F93\u51FA\u65B9\u7A0B",
  "seq.analyze.table": "\u72B6\u6001\u8868",
  "seq.analyze.graph": "\u72B6\u6001\u56FE",
  "seq.analyze.valid": "\u6709\u6548\u72B6\u6001",
  "seq.analyze.noValid": "\u65E0",
  "seq.analyze.invalid": "\u65E0\u6548\u72B6\u6001\u6D41\u5411",
  "seq.analyze.reach": "\u8FDB\u5165\u6709\u6548\u72B6\u6001",
  "seq.analyze.noReach": "\u65E0\u6CD5\u8FDB\u5165\u6709\u6548\u72B6\u6001",
  "seq.analyze.invalidRow": "\u65E0\u6548",
  "seq.analyze.initial": "\u521D\u6001",
  "seq.analyze.cycles": "\u4ECE\u521D\u6001\u8FDB\u5165\u7684\u5FAA\u73AF",
  "seq.analyze.moore": "Moore \u578B",
  "seq.analyze.mealy": "Mealy \u578B",
  "seq.self.yes": "\u80FD\u81EA\u542F\u52A8",
  "seq.self.no": "\u4E0D\u80FD\u81EA\u542F\u52A8",
  "seq.counter.model": "{model} \u6A21 {n}",
  "seq.counter.reset": "\u6E05\u96F6\u6CD5",
  "seq.counter.preset": "\u7F6E\u6570\u6CD5",
  "seq.counter.single": "\u5355\u7247",
  "seq.counter.cascade": "\u4E24\u7247\u7EA7\u8054",
  "seq.counter.feedback": "\u53CD\u9988",
  "seq.counter.none": "\u65E0\u53CD\u9988\uFF08\u82AF\u7247\u81EA\u7136\u6A21\uFF09",
  "seq.counter.async": "\u5F02\u6B65\u6E05\u96F6",
  "seq.counter.sync": "\u540C\u6B65\u63A7\u5236",
  "seq.counter.load": "\u9884\u7F6E\u6570\u636E D",
  "seq.counter.transient": "\u8FC7\u6E21\u6001",
  "seq.counter.glitch": "\u6BDB\u523A",
  "seq.counter.sequence": "\u72B6\u6001\u5E8F\u5217",
  "seq.counter.bitNames": "\u4F4D\u540D\uFF08\u9AD8\u4F4D\u5728\u5DE6\uFF09",
  "seq.shift.194": "\u79FB\u4F4D\u5BC4\u5B58\u5668 194",
  "seq.shift.ring": "\u73AF\u5F62\u8BA1\u6570\u5668",
  "seq.shift.johnson": "\u626D\u73AF\u8BA1\u6570\u5668",
  "seq.shift.feedback": "\u9A71\u52A8",
  "seq.shift.modulus": "\u6A21 {n}",
  "seq.shift.sequence": "\u72B6\u6001\u5E8F\u5217\uFF08Q(n-1)\u2026Q0\uFF09",
  "seq.shift.valid": "\u6709\u6548\u5FAA\u73AF",
  "seq.shift.invalid": "\u65E0\u6548\u5FAA\u73AF",
  "seq.shift.invalidFlow": "\u65E0\u6548\u72B6\u6001\u6D41\u5411",
  "seq.shift.noCycle": "\u65E0\u5FAA\u73AF",
  "seq.shift.invalidState": "\u65E0\u6548",
  "seq.wave.steps": "{n} \u4E2A\u65F6\u949F\u5468\u671F",
  "seq.wave.signals": "{n} \u8DEF\u4FE1\u53F7",
  "seq.none": "\u65E0",
  "seq.states": "{n} \u4E2A\u72B6\u6001",
  "seq.rows": "{n} \u884C",
  "seq.stateGraph.nodes": "{n} \u4E2A\u8282\u70B9\uFF0C{m} \u6761\u8FB9"
};

// src/client/cards/fsm.locale.ts
var zh3 = {
  "fsm.title": "\u72B6\u6001\u673A",
  "fsm.preparing": "\u51C6\u5907\u72B6\u6001\u673A\u8BA1\u7B97",
  "fsm.running": "\u6B63\u5728\u8BA1\u7B97",
  "fsm.failed": "\u8BA1\u7B97\u5931\u8D25",
  "fsm.none": "\u65E0",
  "fsm.op.reduce": "\u72B6\u6001\u5316\u7B80",
  "fsm.op.assign": "\u72B6\u6001\u7F16\u7801",
  "fsm.op.synthesize": "\u6FC0\u52B1\u51FD\u6570\u7EFC\u5408",
  "fsm.op.self_start": "\u81EA\u542F\u52A8\u68C0\u67E5",
  "fsm.type.mealy": "\u7C73\u5229\u578B",
  "fsm.type.moore": "\u6469\u5C14\u578B",
  "fsm.states": "{n} \u4E2A\u72B6\u6001",
  "fsm.reduce.complete": "\u5B8C\u5168\u7ED9\u5B9A\uFF0C\u9690\u542B\u8868\u6CD5",
  "fsm.reduce.incomplete": "\u4E0D\u5B8C\u5168\u7ED9\u5B9A\uFF0C\u76F8\u5BB9\u7C7B\u6CD5",
  "fsm.reduce.reduced": "\u5316\u7B80\u540E {n} \u4E2A\u72B6\u6001\uFF08\u539F {m} \u4E2A\uFF09",
  "fsm.reduce.classes": "\u7B49\u4EF7\u7C7B",
  "fsm.reduce.compatibles": "\u6700\u5927\u76F8\u5BB9\u7C7B",
  "fsm.reduce.cover": "\u6700\u5C0F\u95ED\u8986\u76D6",
  "fsm.reduce.stateMap": "\u72B6\u6001\u5BF9\u5E94",
  "fsm.reduce.reducedTable": "\u5316\u7B80\u540E\u7684\u72B6\u6001\u8868",
  "fsm.reduce.reducedDiagram": "\u5316\u7B80\u540E\u7684\u72B6\u6001\u56FE",
  "fsm.reduce.noMerge": "\u65E0\u53EF\u5408\u5E76\u7684\u72B6\u6001",
  "fsm.implication.title": "\u9690\u542B\u8868",
  "fsm.implication.pair": "\u72B6\u6001\u5BF9",
  "fsm.implication.result": "\u7ED3\u8BBA",
  "fsm.implication.reason": "\u4F9D\u636E",
  "fsm.implication.equivalent": "\u7B49\u4EF7",
  "fsm.implication.distinct": "\u4E0D\u7B49\u4EF7",
  "fsm.implication.implied": "\u8574\u542B\u6B21\u6001\u5BF9\uFF1A{pairs}",
  "fsm.assign.pairs": "\u76F8\u90BB\u72B6\u6001\u5BF9",
  "fsm.assign.rule": "\u89C4\u5219 {r}",
  "fsm.assign.none": "\u65E0\u76F8\u90BB\u72B6\u6001\u5BF9",
  "fsm.assign.encoding": "\u7F16\u7801\u65B9\u5F0F",
  "fsm.assign.bits": "\u4F4D\u6570",
  "fsm.assign.score": "\u8BC4\u5206",
  "fsm.assign.satisfied": "\u6EE1\u8DB3",
  "fsm.assign.codes": "\u72B6\u6001\u7F16\u7801",
  "fsm.assign.best": "\u8BC4\u5206\u6700\u5C0F",
  "fsm.assign.summary": "\u8BC4\u5206\u6700\u5C0F\uFF1A{kind}\uFF08\u8BC4\u5206 {score}\uFF09",
  "fsm.encoding.binary": "\u4E8C\u8FDB\u5236",
  "fsm.encoding.gray": "\u683C\u96F7\u7801",
  "fsm.encoding.onehot": "\u72EC\u70ED\u7801",
  "fsm.encoding.custom": "\u81EA\u5B9A\u4E49",
  "fsm.synth.summary": "{ff} \u89E6\u53D1\u5668 \xB7 {n} \u4E2A\u51FD\u6570",
  "fsm.synth.codes": "\u72B6\u6001\u7F16\u7801",
  "fsm.synth.table": "\u6FC0\u52B1\u8868",
  "fsm.synth.functions": "\u6FC0\u52B1\u4E0E\u8F93\u51FA\u51FD\u6570",
  "fsm.synth.solution": "\u89E3 {n}",
  "fsm.synth.multi": "\u5171 {n} \u4E2A\u7B49\u4EF7\u6700\u7B80\u89E3",
  "fsm.synth.cost": "{terms} \u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "fsm.synth.role.excitation": "\u6FC0\u52B1",
  "fsm.synth.role.output": "\u8F93\u51FA",
  "fsm.synth.unused": "\u65E0\u6548\u7F16\u7801\uFF08\u65E0\u5173\u9879\uFF09",
  "fsm.table.state": "\u73B0\u6001",
  "fsm.table.input": "\u8F93\u5165",
  "fsm.table.next": "\u6B21\u6001",
  "fsm.table.output": "\u8F93\u51FA",
  "fsm.table.code": "\u7F16\u7801",
  "fsm.table.unused": "\u65E0\u6548",
  "fsm.table.stateTable": "\u72B6\u6001\u8868\uFF08\u6B21\u6001/\u8F93\u51FA\uFF09",
  "fsm.diagram": "\u72B6\u6001\u56FE",
  "fsm.diagram.empty": "\u65E0\u8F6C\u79FB",
  "fsm.selfStart.yes": "\u80FD\u81EA\u542F\u52A8",
  "fsm.selfStart.fixed": "\u4E0D\u80FD\u81EA\u542F\u52A8\uFF0C\u5DF2\u4FEE\u6B63",
  "fsm.selfStart.stillNo": "\u4E0D\u80FD\u81EA\u542F\u52A8\uFF0C\u4FEE\u6B63\u540E\u4ECD\u4E0D\u80FD",
  "fsm.selfStart.check": "\u65E0\u6548\u7F16\u7801 {code}\uFF0C\u8F93\u5165 {input}\uFF1A{trace}",
  "fsm.selfStart.rewrite": "\u65E0\u6548\u7F16\u7801 {code} \u7684\u6B21\u6001\u6539\u4E3A {to}",
  "fsm.selfStart.before": "\u539F\u51FD\u6570\u7684\u65E0\u6548\u7F16\u7801\u68C0\u67E5",
  "fsm.selfStart.after": "\u4FEE\u6B63\u540E\u7684\u51FD\u6570",
  "fsm.selfStart.allOk": "\u5168\u90E8\u65E0\u6548\u7F16\u7801\u5747\u80FD\u8FDB\u5165\u6709\u6548\u7F16\u7801"
};

// src/client/cards/mem.locale.ts
var zh4 = {
  "mem.title": "\u5B58\u50A8\u5668\u4E0E\u53EF\u7F16\u7A0B\u903B\u8F91",
  "mem.preparing": "\u51C6\u5907\u5B58\u50A8\u5668\u8BA1\u7B97",
  "mem.running": "\u6B63\u5728\u8BA1\u7B97",
  "mem.failed": "\u8BA1\u7B97\u5931\u8D25",
  "mem.warn": "\u6CE8\u610F",
  "mem.bits": "\u4F4D",
  "mem.chips": "{n} \u7247",
  "mem.terms": "{n} \u4E2A\u4E58\u79EF\u9879",
  "mem.op.expand": "\u5B58\u50A8\u5668\u6269\u5C55",
  "mem.op.rom_func": "ROM \u5B9E\u73B0\u51FD\u6570",
  "mem.op.pla": "PLA \u9635\u5217",
  "mem.op.pal": "PAL \u9635\u5217",
  "mem.op.lut": "LUT4 \u63A9\u7801",
  "mem.mode.bit": "\u4F4D\u6269\u5C55",
  "mem.mode.word": "\u5B57\u6269\u5C55",
  "mem.mode.both": "\u5B57\u4F4D\u6269\u5C55",
  "mem.exp.target": "\u76EE\u6807",
  "mem.exp.chip": "\u82AF\u7247",
  "mem.exp.capacity": "\u5BB9\u91CF {n} \u4F4D",
  "mem.exp.count": "\u82AF\u7247\u6570",
  "mem.exp.countVal": "\u5171 {total} \u7247\uFF08\u5B57\u5411 {w} \u7EC4\uFF0C\u4F4D\u5411 {b} \u7EC4\uFF09",
  "mem.exp.addr": "\u82AF\u7247\u5730\u5740\u7EBF",
  "mem.exp.select": "\u7247\u9009\u8BD1\u7801\u8F93\u5165",
  "mem.exp.decoder": "\u7247\u9009\u8BD1\u7801\uFF0874LS138\uFF09\u63A5\u7EBF",
  "mem.exp.chips": "\u82AF\u7247\u6570\u636E\u4F4D\u4E0E\u7247\u9009",
  "mem.exp.map": "\u5730\u5740\u6620\u5C04\u8868",
  "mem.exp.decode": "\u8BD1\u7801\u7ED3\u6784",
  "mem.exp.decodeLines": "\u8BD1\u7801\u8F93\u51FA\u7EBF\u6570",
  "mem.exp.col.chip": "\u7247\u53F7",
  "mem.exp.col.group": "\u5B57\u7EC4",
  "mem.exp.col.data": "\u6570\u636E\u4F4D",
  "mem.exp.col.select": "\u7247\u9009",
  "mem.exp.col.chips": "\u82AF\u7247",
  "mem.exp.col.range": "\u5730\u5740\u8303\u56F4",
  "mem.wiring.pin": "\u5F15\u811A",
  "mem.wiring.signal": "\u8FDE\u63A5",
  "mem.wiring.note": "\u8BF4\u660E",
  "mem.rom.size": "\u5BB9\u91CF",
  "mem.rom.table": "\u5730\u5740\u2014\u6570\u636E\u8868",
  "mem.rom.matrix": "ROM \u70B9\u9635\uFF08\u5730\u5740 \xD7 \u8F93\u51FA\u4F4D\uFF0C\u5B9E\u5FC3\u70B9\u4E3A 1\uFF09",
  "mem.rom.col.addr": "\u5730\u5740",
  "mem.rom.col.bits": "\u4E8C\u8FDB\u5236\u5730\u5740",
  "mem.rom.col.hex": "\u5341\u516D\u8FDB\u5236",
  "mem.rom.more": "\u5171 {n} \u884C\uFF0C\u9010\u884C\u7565\u53BB",
  "mem.pla.kind": "PLA\uFF08\u5171\u7528\u4E58\u79EF\u9879\uFF09",
  "mem.pal.kind": "PAL\uFF08\u6216\u9635\u5217\u56FA\u5B9A\uFF09",
  "mem.pla.cost": "{terms} \u4E2A\u4E58\u79EF\u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "mem.pla.share": "\u5206\u522B\u5316\u7B80\u9700 {sep} \u9879\uFF0C\u5171\u7528\u540E {n} \u9879",
  "mem.pal.fixed": "\u6BCF\u8F93\u51FA\u56FA\u5B9A {k} \u4E2A\u4E58\u79EF\u9879",
  "mem.pal.overflow": "\uFF08\u8D85\u51FA\u56FA\u5B9A\u9879\u6570\uFF09",
  "mem.pla.outputs": "\u8F93\u51FA\u8868\u8FBE\u5F0F",
  "mem.pla.terms": "\u4E58\u79EF\u9879",
  "mem.pla.col.term": "\u9879",
  "mem.pla.col.expr": "\u4E58\u79EF\u9879",
  "mem.pla.col.used": "\u63A5\u5165\u8F93\u51FA",
  "mem.pla.and": "\u4E0E\u9635\u5217\uFF08\u884C\u4E3A\u4E58\u79EF\u9879\uFF0C\u5217\u4E3A\u539F\u53D8\u91CF\u4E0E\u53CD\u53D8\u91CF\uFF09",
  "mem.pla.or": "\u6216\u9635\u5217\uFF08\u884C\u4E3A\u4E58\u79EF\u9879\uFF0C\u5217\u4E3A\u8F93\u51FA\uFF09",
  "mem.lut.mask": "\u63A9\u7801\uFF08\u9AD8\u4F4D\u5728\u524D\uFF09",
  "mem.lut.hex": "\u5341\u516D\u8FDB\u5236",
  "mem.lut.pins": "LUT \u8F93\u5165\u63A5\u7EBF",
  "mem.lut.table": "\u63A9\u7801\u9010\u4F4D\uFF08\u5730\u5740 \u2192 \u8F93\u51FA\uFF09",
  "mem.lut.col.addr": "\u5730\u5740",
  "mem.lut.col.bits": "\u4E8C\u8FDB\u5236",
  "mem.lut.col.value": "\u8F93\u51FA",
  "mem.lut.split": "\u62C6\u5206",
  "mem.lut.splitVars": "\u9AD8\u4F4D\u53D8\u91CF {s} \u9999\u519C\u5C55\u5F00\uFF0C\u5B50\u51FD\u6570\u8F93\u5165 {l}",
  "mem.lut.cofactors": "\u5B50\u51FD\u6570\u63A9\u7801",
  "mem.lut.col.assign": "\u9AD8\u4F4D\u53D8\u91CF\u53D6\u503C",
  "mem.lut.col.mask": "\u63A9\u7801",
  "mem.lut.col.hex": "\u5341\u516D\u8FDB\u5236"
};

// src/client/cards/adda.locale.ts
var zh5 = {
  "adda.title": "\u6A21\u6570\u4E0E\u6570\u6A21\u8F6C\u6362",
  "adda.preparing": "\u51C6\u5907 A/D\u3001D/A \u8F6C\u6362\u8BA1\u7B97",
  "adda.running": "\u6B63\u5728\u8BA1\u7B97",
  "adda.failed": "\u8BA1\u7B97\u5931\u8D25",
  "adda.warn": "\u6CE8\u610F",
  "adda.derivation": "\u63A8\u5BFC\u8FC7\u7A0B",
  "adda.op.dac": "D/A \u8F6C\u6362",
  "adda.op.adc_sar": "\u9010\u6B21\u903C\u8FD1 A/D",
  "adda.op.adc_flash": "\u5E76\u884C\u6BD4\u8F83 A/D",
  "adda.op.adc_dual": "\u53CC\u79EF\u5206 A/D",
  "adda.op.quantize": "\u91CF\u5316\u4E0E\u91C7\u6837",
  "adda.common.vin": "\u8F93\u5165 Vin",
  "adda.common.vref": "\u53C2\u8003\u7535\u538B VREF",
  "adda.common.delta": "\u91CF\u5316\u5355\u4F4D \u0394",
  "adda.common.result": "\u8F6C\u6362\u7ED3\u679C",
  "adda.common.quantized": "\u6A21\u62DF\u503C",
  "adda.common.error": "\u91CF\u5316\u8BEF\u5DEE",
  "adda.common.errorRange": "\u8BEF\u5DEE\u8303\u56F4",
  "adda.common.mode": "\u91CF\u5316\u65B9\u5F0F",
  "adda.common.truncate": "\u820D\u5C3E\u6CD5",
  "adda.common.round": "\u56DB\u820D\u4E94\u5165\u6CD5",
  "adda.dac.type": "\u7C7B\u578B",
  "adda.dac.input": "\u8F93\u5165\u6570\u5B57\u91CF D",
  "adda.dac.formula": "\u8F93\u51FA\u516C\u5F0F",
  "adda.dac.substituted": "\u4EE3\u5165",
  "adda.dac.fraction": "D/2^k",
  "adda.dac.rf": "Rf/R",
  "adda.dac.lsb": "\u5206\u8FA8\u7387 1LSB",
  "adda.dac.fullScale": "\u6EE1\u91CF\u7A0B",
  "adda.dac.output": "\u8F93\u51FA\u7535\u538B Vo",
  "adda.dac.branches": "\u6743\u7535\u963B\u652F\u8DEF\uFF08\u81EA\u9AD8\u4F4D\u5230\u4F4E\u4F4D\uFF09",
  "adda.dac.col.bit": "\u4F4D",
  "adda.dac.col.value": "\u53D6\u503C",
  "adda.dac.col.resistor": "\u652F\u8DEF\u7535\u963B",
  "adda.sar.process": "\u9010\u6B21\u903C\u8FD1\u8FC7\u7A0B",
  "adda.sar.col.step": "\u6B21\u5E8F",
  "adda.sar.col.bit": "\u8BD5\u63A2\u4F4D",
  "adda.sar.col.trial": "\u8BD5\u63A2\u7801",
  "adda.sar.col.dac": "DAC \u8F93\u51FA Vo",
  "adda.sar.col.compare": "\u6BD4\u8F83",
  "adda.sar.col.kept": "\u5224\u51B3",
  "adda.sar.col.partial": "\u90E8\u5206\u7ED3\u679C",
  "adda.sar.geq": "Vin \u2265 Vo",
  "adda.sar.lt": "Vin < Vo",
  "adda.sar.keep": "\u4FDD\u7559 1",
  "adda.sar.clear": "\u6E05\u9664 0",
  "adda.sar.final": "\u8F6C\u6362\u7ED3\u679C {code}",
  "adda.flash.refs": "\u53C2\u8003\u7535\u538B",
  "adda.flash.count": "\u6BD4\u8F83\u5668\u4E2A\u6570",
  "adda.flash.countValue": "{n} \u4E2A",
  "adda.flash.col.index": "\u6BD4\u8F83\u5668",
  "adda.flash.col.ref": "\u53C2\u8003\u7535\u538B Vref",
  "adda.flash.col.out": "\u8F93\u51FA",
  "adda.flash.omitted": "\u6BD4\u8F83\u5668\u4E2A\u6570\u8F83\u591A\uFF0C\u9010\u4E2A\u5217\u8868\u7565\u53BB",
  "adda.flash.thermo": "\u6E29\u5EA6\u8BA1\u7801\uFF08\u81EA\u9AD8\u5230\u4F4E\uFF09",
  "adda.flash.code": "\u7F16\u7801\u8F93\u51FA {code}",
  "adda.dual.t1": "T1\uFF08\u5B9A\u65F6\u79EF\u5206\uFF09",
  "adda.dual.t2": "T2\uFF08\u53CD\u5411\u79EF\u5206\uFF09",
  "adda.dual.n2": "\u8BA1\u6570\u503C N2",
  "adda.dual.tmax": "\u6700\u5927\u8F6C\u6362\u65F6\u95F4",
  "adda.dual.res": "\u5206\u8FA8\u7387 VREF/N1",
  "adda.dual.mains": "\u5DE5\u9891\u5468\u671F\u6570",
  "adda.dual.mainsOk": "\u662F\u6574\u6570\u500D\uFF0C\u53EF\u6291\u5236\u5DE5\u9891\u5E72\u6270",
  "adda.dual.mainsNo": "\u4E0D\u662F\u6574\u6570\u500D\uFF0C\u5DE5\u9891\u5E72\u6270\u4E0D\u80FD\u5B8C\u5168\u6291\u5236",
  "adda.quant.levels": "\u91CF\u5316\u7B49\u7EA7\u6570 2^n",
  "adda.quant.levelsValue": "{n} \u7EA7",
  "adda.quant.rangeTruncate": "0 \u2264 e < \u0394",
  "adda.quant.rangeRound": "-\u0394/2 \u2264 e \u2264 \u0394/2",
  "adda.quant.result": "\u8F93\u5165 {v} V \u2192 \u6570\u5B57\u7801 {code}",
  "adda.quant.minBits": "\u8BEF\u5DEE\u8981\u6C42",
  "adda.quant.minBitsValue": "|e| \u2264 {e} V\uFF0C\u81F3\u5C11 {n} \u4F4D",
  "adda.quant.minBitsNone": "|e| \u2264 {e} V\uFF0C{n} \u4F4D\u4EE5\u5185\u65E0\u6CD5\u6EE1\u8DB3",
  "adda.quant.sampling": "\u91C7\u6837\u5B9A\u7406",
  "adda.quant.minFs": "\u6700\u5C0F\u91C7\u6837\u9891\u7387 2fmax"
};

// src/client/cards/system.locale.ts
var zh6 = {
  "system.title": "\u6570\u5B57\u7CFB\u7EDF",
  "system.preparing": "\u51C6\u5907\u6570\u5B57\u7CFB\u7EDF\u8BA1\u7B97",
  "system.running": "\u6B63\u5728\u8BA1\u7B97",
  "system.failed": "\u8BA1\u7B97\u5931\u8D25",
  "system.op.asm": "ASM \u56FE\u6821\u9A8C",
  "system.op.controller": "\u63A7\u5236\u5668\u8BBE\u8BA1",
  "system.asm.valid": "ASM \u56FE\u6821\u9A8C\u901A\u8FC7",
  "system.asm.invalid": "ASM \u56FE\u5B58\u5728 {n} \u5904\u9519\u8BEF",
  "system.asm.issues": "\u95EE\u9898\u5217\u8868",
  "system.asm.error": "\u9519\u8BEF",
  "system.asm.warning": "\u63D0\u793A",
  "system.asm.diagram": "ASM \u56FE",
  "system.asm.table": "\u72B6\u6001\u8F6C\u79FB\u8868\uFF08\u4E0E ASM \u56FE\u7B49\u4EF7\uFF09",
  "system.asm.outputs": "Moore \u8F93\u51FA",
  "system.asm.empty": "\u65E0",
  "system.asm.vars": "\u6761\u4EF6\u53D8\u91CF",
  "system.asm.when": "\u5F53",
  "system.asm.uncond": "\u65E0\u6761\u4EF6",
  "system.asm.yes": "\u662F",
  "system.asm.no": "\u5426",
  "system.asm.elseLabel": "\u5176\u4F59",
  "system.table.state": "\u72B6\u6001",
  "system.table.code": "\u7F16\u7801",
  "system.table.line": "\u8BD1\u7801\u8F93\u51FA",
  "system.table.data": "\u6570\u636E\u7AEF\u8F93\u5165",
  "system.table.unused": "\u672A\u7528\u7F16\u7801",
  "system.controller.summary": "{n} \u4E2A\u72B6\u6001 \xB7 \u4E09\u79CD\u63A7\u5236\u5668\u65B9\u6848",
  "system.controller.initial": "\u521D\u59CB\u72B6\u6001",
  "system.controller.signals": "\u63A7\u5236\u4FE1\u53F7\u771F\u503C\u8868\uFF08\u72B6\u6001 \u2192 \u5404\u63A7\u5236\u4FE1\u53F7\uFF09",
  "system.scheme.counter": "\u65B9\u6848\u4E00\uFF1A\u8BA1\u6570\u5668\u578B",
  "system.scheme.mux": "\u65B9\u6848\u4E8C\uFF1A\u591A\u8DEF\u9009\u62E9\u5668\u578B",
  "system.scheme.sequence": "\u65B9\u6848\u4E09\uFF1A\u5B9A\u5E8F\u578B",
  "system.scheme.bits": "\u72B6\u6001\u5BC4\u5B58\u5668\u4F4D\uFF08\u9AD8\u4F4D\u5728\u524D\uFF09",
  "system.scheme.functions": "\u6B21\u6001\u4E0E\u63A7\u5236\u51FD\u6570\uFF08\u5DF2\u5316\u7B80\uFF09",
  "system.scheme.minimized": "\u672A\u5316\u7B80\uFF08\u53D8\u91CF\u8D85\u8FC7 6 \u4E2A\uFF0C\u5217\u51FA\u6700\u5C0F\u9879\u548C\u5F0F\uFF09",
  "system.scheme.cost": "{terms} \u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "system.scheme.solution": "\u89E3 {n}",
  "system.mux.title": "\u591A\u8DEF\u9009\u62E9\u5668 MUX\uFF08\u6B21\u6001\u4F4D {bit}\uFF09",
  "system.mux.select": "\u5730\u5740\u7AEF",
  "system.role.count": "\u8BA1\u6570\u6761\u4EF6",
  "system.role.load": "\u7F6E\u6570\u6761\u4EF6",
  "system.role.load-data": "\u7F6E\u6570\u503C",
  "system.role.mux-data": "\u6570\u636E\u7AEF",
  "system.role.next": "\u6B21\u6001"
};

// src/client/cards/hdl.locale.ts
var zh7 = {
  "hdl.title": "Verilog \u68C0\u67E5\u4E0E\u4EFF\u771F",
  "hdl.preparing": "\u51C6\u5907 Verilog \u68C0\u67E5",
  "hdl.running": "\u6B63\u5728\u8FD0\u884C",
  "hdl.failed": "\u8FD0\u884C\u5931\u8D25",
  "hdl.op.lint": "Verilog \u9759\u6001\u68C0\u67E5",
  "hdl.op.simulate": "Verilog \u4EFF\u771F",
  "hdl.summary.lint": "\u9519\u8BEF {e} \xB7 \u8B66\u544A {w} \xB7 \u89C4\u5219\u63D0\u793A {r}",
  "hdl.summary.rules": "\u4EC5\u89C4\u5219\u5339\u914D\uFF08\u68C0\u67E5\u80FD\u529B\u964D\u7EA7\uFF09",
  "hdl.summary.sim": "\u9876\u5C42 {top} \xB7 \u7ED3\u675F\u4E8E {t}",
  "hdl.summary.simNoFinish": "\u9876\u5C42 {top}",
  "hdl.code": "Verilog \u6E90\u7801",
  "hdl.engine": "\u68C0\u67E5\u5F15\u64CE",
  "hdl.lint.none": "\u672A\u53D1\u73B0\u95EE\u9898",
  "hdl.lint.issues": "iverilog \u8BCA\u65AD",
  "hdl.lint.rules": "\u89C4\u5219\u63D0\u793A",
  "hdl.line": "\u7B2C {n} \u884C",
  "hdl.sev.error": "\u9519\u8BEF",
  "hdl.sev.warning": "\u8B66\u544A",
  "hdl.sev.info": "\u63D0\u793A",
  "hdl.rule.latch": "\u9501\u5B58\u5668",
  "hdl.rule.case-default": "case \u65E0 default",
  "hdl.rule.nba-in-comb": "\u7EC4\u5408\u5757\u7528 <=",
  "hdl.rule.blocking-in-seq": "\u65F6\u5E8F\u5757\u7528 =",
  "hdl.rule.multi-driver": "\u591A\u9A71\u52A8",
  "hdl.sim.end": "\u7ED3\u675F\u65B9\u5F0F",
  "hdl.sim.timescale": "timescale",
  "hdl.sim.noTimescale": "\u672A\u58F0\u660E\uFF08\u4F7F\u7528 iverilog \u9ED8\u8BA4\u5355\u4F4D\uFF09",
  "hdl.sim.endTime": "\u7ED3\u675F\u65F6\u523B",
  "hdl.sim.noEndTime": "\u672A\u8C03\u7528 $finish",
  "hdl.sim.output": "testbench \u8F93\u51FA",
  "hdl.sim.noOutput": "\u6CA1\u6709 $display \u8F93\u51FA",
  "hdl.sim.wave": "\u6CE2\u5F62\uFF08\u5355\u6BD4\u7279\u4E3A\u7535\u5E73\uFF0C\u591A\u6BD4\u7279\u4E3A\u603B\u7EBF\u53D6\u503C\uFF0C\u5341\u516D\u8FDB\u5236\uFF09",
  "hdl.sim.noWave": "\u6CA1\u6709\u53EF\u753B\u7684\u4FE1\u53F7",
  "hdl.sim.waveTruncated": "\u6709\u53D8\u5316\u7684\u65F6\u523B\u5171 {n} \u4E2A\uFF0C\u6CE2\u5F62\u62BD\u6837\u663E\u793A {cols} \u5217\uFF08\u590D\u4F4D\u4FE1\u53F7\u7684\u53D8\u5316\u4F18\u5148\u4FDD\u7559\uFF09",
  "hdl.sim.noVcd": "\u672A\u751F\u6210 VCD\uFF0C\u6CA1\u6709\u6CE2\u5F62",
  "hdl.end.finish": "\u9047\u5230 $finish \u6B63\u5E38\u7ED3\u675F",
  "hdl.end.timeout": "\u8FBE\u5230\u65F6\u95F4\u4E0A\u9650\uFF0C\u5DF2\u5F3A\u5236\u7ED3\u675F",
  "hdl.end.idle": "\u4E8B\u4EF6\u8017\u5C3D\uFF0C\u81EA\u884C\u7ED3\u675F",
  "hdl.end.wall_clock": "\u8FD0\u884C\u8D85\u65F6\uFF0C\u5DF2\u5F3A\u5236\u7ED3\u675F",
  "hdl.end.output_limit": "\u8F93\u51FA\u8FC7\u957F\uFF0C\u5DF2\u622A\u65AD",
  "hdl.end.vcd_limit": "VCD \u8FC7\u5927\uFF0C\u5DF2\u7ED3\u675F",
  "hdl.warn": "\u6CE8\u610F"
};

// src/client/locale.ts
var NS = "dlogicStudio";
var baseZh = {
  "num.title": "\u8FDB\u5236\u8F6C\u6362",
  "num.preparing": "\u51C6\u5907\u8FDB\u5236\u8F6C\u6362",
  "num.running": "\u6B63\u5728\u8BA1\u7B97",
  "num.failed": "\u8F93\u5165\u6709\u8BEF",
  "num.decimal": "\u5341\u8FDB\u5236\u503C {value}",
  "num.inexact": "\u5C0F\u6570\u90E8\u5206\u672A\u9664\u5C3D\uFF0C\u5DF2\u4FDD\u7559 {precision} \u4F4D",
  "bool.title": "\u5E03\u5C14\u51FD\u6570",
  "bool.preparing": "\u51C6\u5907\u5E03\u5C14\u51FD\u6570\u8FD0\u7B97",
  "bool.running": "\u6B63\u5728\u8BA1\u7B97",
  "bool.failed": "\u8BA1\u7B97\u5931\u8D25",
  "bool.op.parse": "\u89E3\u6790",
  "bool.op.truth_table": "\u771F\u503C\u8868",
  "bool.op.canonical": "\u6807\u51C6\u5F62\u5F0F",
  "bool.op.minimize": "\u5316\u7B80",
  "bool.op.kmap": "\u5361\u8BFA\u56FE",
  "bool.op.hazard": "\u9669\u8C61\u5206\u6790",
  "bool.op.complement": "\u6C42\u53CD",
  "bool.op.dual": "\u5BF9\u5076\u5F0F",
  "bool.op.gate_form": "\u95E8\u7535\u8DEF\u5F62\u5F0F",
  "bool.op.equivalent": "\u7B49\u4EF7\u5224\u65AD",
  "bool.minimal": "\u6700\u7B80\u8868\u8FBE\u5F0F",
  "bool.multi": "\u5171 {n} \u4E2A\u7B49\u4EF7\u6700\u7B80\u89E3",
  "bool.solutions": "{n} \u4E2A\u6700\u7B80\u89E3",
  "bool.cost": "\u4EE3\u4EF7\uFF1A{terms} \u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "bool.primes": "\u8D28\u8574\u6DB5\u9879\uFF08\u7C97\u4F53\u4E3A\u672C\u8D28\u8D28\u8574\u6DB5\u9879\uFF09",
  "bool.rows": "{n} \u884C",
  "bool.truth.all": "\u663E\u793A\u5168\u90E8 {n} \u884C",
  "bool.truth.collapse": "\u6536\u8D77",
  "bool.canonical.sigma": "\u03A3m",
  "bool.canonical.pi": "\u03A0M",
  "bool.canonical.sopForm": "\u6807\u51C6\u4E0E\u6216\u5F0F",
  "bool.canonical.posForm": "\u6807\u51C6\u6216\u4E0E\u5F0F",
  "bool.hazard.none": "\u65E0\u9759\u6001\u9669\u8C61",
  "bool.hazard.count": "{n} \u7EC4\u76F8\u90BB\u6700\u5C0F\u9879",
  "bool.hazard.static1": "\u9759\u6001 1 \u578B\u9669\u8C61",
  "bool.hazard.static0": "\u9759\u6001 0 \u578B\u9669\u8C61",
  "bool.hazard.pair": "m{a} \u2194 m{b}",
  "bool.hazard.var": "\u53D8\u5316\u53D8\u91CF {v}",
  "bool.hazard.add": "\u52A0\u5165\u9879",
  "bool.hazard.freeSop": "\u6D88\u9664\u9669\u8C61\u540E\u7684 SOP",
  "bool.input": "\u8F93\u5165",
  "bool.result": "\u7ED3\u679C",
  "bool.gate.nandNand": "\u4E0E\u975E-\u4E0E\u975E",
  "bool.gate.norNor": "\u6216\u975E-\u6216\u975E",
  "bool.gate.andOrInvert": "\u4E0E\u6216\u975E",
  "bool.equiv.yes": "\u7B49\u4EF7",
  "bool.equiv.no": "\u4E0D\u7B49\u4EF7",
  "bool.counter": "\u53CD\u4F8B",
  "bool.parse.vars": "\u53D8\u91CF",
  "bool.parse.minterms": "\u6700\u5C0F\u9879",
  "bool.parse.dontcares": "\u65E0\u5173\u9879",
  "bool.none": "\u65E0",
  "bool.kmap.groups": "\u5708\u7EC4",
  "bool.kmap.minimal": "\u5316\u7B80\u7ED3\u679C",
  "bool.kmap.noGroups": "\u65E0\u5708\u7EC4",
  "bool.kmap.cells": "{n} \u683C",
  "bool.kmap.plane": "{v}={p}",
  "bool.kmap.solution": "\u89E3 {n}",
  "verify.title": "\u7B49\u4EF7\u4E0E\u6700\u7B80\u6027",
  "verify.preparing": "\u51C6\u5907\u9A8C\u8BC1",
  "verify.running": "\u6B63\u5728\u9A8C\u8BC1",
  "verify.failed": "\u9A8C\u8BC1\u5931\u8D25",
  "verify.equivalent": "\u7B49\u4EF7",
  "verify.notEquivalent": "\u4E0D\u7B49\u4EF7",
  "verify.minimal": "\u6700\u7B80",
  "verify.notMinimal": "\u4E0D\u662F\u6700\u7B80",
  "verify.unknown": "\u65E0\u6CD5\u5224\u65AD",
  "verify.candidate": "\u5019\u9009\u5F0F\u4EE3\u4EF7",
  "verify.minimalCost": "\u6700\u7B80\u4EE3\u4EF7",
  "verify.cost": "{terms} \u9879\uFF0C{literals} \u4E2A\u6587\u5B57",
  "verify.counter": "\u53CD\u4F8B",
  "verify.leftOut": "\u5019\u9009\u5F0F",
  "verify.rightOut": "\u539F\u51FD\u6570",
  "verify.reference": "\u53C2\u8003\u7B54\u6848",
  "know.title": "\u77E5\u8BC6\u70B9",
  "know.preparing": "\u51C6\u5907\u67E5\u8BE2\u77E5\u8BC6\u70B9",
  "know.running": "\u6B63\u5728\u67E5\u8BE2",
  "know.failed": "\u67E5\u8BE2\u5931\u8D25",
  "know.count": "{n} \u4E2A\u77E5\u8BC6\u70B9",
  "know.missing": "\u672A\u627E\u5230\uFF1A{ids}",
  "know.sec.nodes": "\u77E5\u8BC6\u70B9",
  "know.sec.search": "\u641C\u7D22\u7ED3\u679C",
  "know.sec.self": "\u672C\u8282",
  "know.sec.parent": "\u4E0A\u7EA7",
  "know.sec.children": "\u4E0B\u7EA7",
  "know.sec.prereqs": "\u524D\u7F6E",
  "know.sec.related": "\u76F8\u5173",
  "know.sec.dependents": "\u540E\u7EED",
  "learn.title": "\u5B66\u4E60\u5361\u7247",
  "learn.preparing": "\u51C6\u5907\u6574\u7406\u5B66\u4E60\u5361\u7247",
  "learn.running": "\u6B63\u5728\u6574\u7406",
  "learn.failed": "\u5361\u7247\u6570\u636E\u6709\u8BEF",
  "learn.expanded": "\u5DF2\u5C55\u5F00",
  "learn.sent": "\u5DF2\u53D1\u9001",
  "learn.askFailed": "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "learn.askUnavailable": "\u5F53\u524D\u65E0\u6CD5\u53D1\u9001\u8FFD\u95EE\u3002",
  "angle.principle": "\u539F\u7406",
  "angle.variant": "\u53D8\u5F0F",
  "angle.pitfall": "\u6613\u9519",
  "angle.prerequisite": "\u524D\u7F6E",
  "angle.verify": "\u9A8C\u8BC1",
  "angle.practice": "\u7EC3\u4E60",
  "angle.free": "\u5EF6\u4F38",
  "tree.title": "\u5B66\u4E60\u6811",
  "tree.guideDescription": "\u628A\u6BCF\u6B21\u56DE\u7B54\u548C\u8FFD\u95EE\u6574\u7406\u6210\u4E00\u68F5\u77E5\u8BC6\u6811",
  "tree.empty": "\u5F00\u59CB\u63D0\u95EE\u540E\uFF0C\u6BCF\u6B21\u56DE\u7B54\u4F1A\u6210\u4E3A\u4E00\u5F20\u5361\u7247\uFF0C\u70B9\u51FB\u5361\u7247\u4E0B\u7684\u8FFD\u95EE\u5373\u53EF\u5411\u53F3\u5C55\u5F00\u3002",
  "tree.count": "{n} \u5F20\u5361\u7247",
  "tree.latest": "\u56DE\u5230\u6700\u65B0",
  "tree.asking": "\u56DE\u7B54\u4E2D\u2026",
  "tree.askFailed": "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "tree.knowledge": "\u77E5\u8BC6\u70B9",
  "tree.followups": "\u8FFD\u95EE",
  "tree.locate": "\u5B9A\u4F4D\u5230\u5BF9\u8BDD",
  "tree.reset": "\u91CD\u7F6E\u5E03\u5C40",
  "tree.select": "\u9009\u62E9",
  "tree.deselect": "\u53D6\u6D88\u9009\u62E9",
  "tree.selectedCount": "\u5DF2\u9009 {n} \u5F20",
  "tree.compare": "\u5BF9\u6BD4\u6240\u9009",
  "tree.summarize": "\u603B\u7ED3\u6240\u9009",
  "tree.clearSelect": "\u6E05\u9664\u9009\u62E9",
  "tree.outline": "\u590D\u4E60\u63D0\u7EB2",
  "tree.synthBusy": "\u751F\u6210\u4E2D\u2026",
  "tree.synthHint": "\u6B63\u5728\u751F\u6210\uFF0C\u7EA6\u9700 10\u201315 \u79D2",
  "tree.needTwo": "\u81F3\u5C11\u9009\u62E9 2 \u5F20\u5361\u7247\u624D\u80FD\u5BF9\u6BD4\u3002",
  "tree.needOne": "\u8BF7\u5148\u9009\u62E9\u5361\u7247\u3002",
  "tree.needTwoTree": "\u5361\u7247\u4E0D\u8DB3 2 \u5F20\uFF0C\u65E0\u6CD5\u751F\u6210\u590D\u4E60\u63D0\u7EB2\u3002",
  "tree.synthFailed": "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "tree.copyBranch": "\u590D\u5236\u5206\u652F\u4E0A\u4E0B\u6587",
  "tree.copied": "\u5DF2\u590D\u5236",
  "tree.copyFailed": "\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "tree.freeAskPlaceholder": "\u7EE7\u7EED\u8FFD\u95EE\u2026",
  "tree.freeAskSend": "\u53D1\u9001",
  "tree.freeAskTooLong": "\u8FFD\u95EE\u5185\u5BB9\u8FC7\u957F\uFF08\u4E0A\u9650 {n} \u5B57\u7B26\uFF09\u3002",
  "side.title": "\u4FA7\u8FB9\u8FFD\u95EE",
  "side.hint": "\u70B9\u51FB\u5361\u7247\u4E0B\u7684\u8FFD\u95EE\uFF0C\u56DE\u7B54\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC",
  "side.turns": "{n} \u6761\u56DE\u7B54",
  "side.answering": "\u56DE\u7B54\u4E2D\u2026",
  "side.fullscreen": "\u5168\u5C4F\u67E5\u770B",
  "learn.sentSide": "\u5DF2\u53D1\u9001\u5230\u4FA7\u8FB9\u8FFD\u95EE"
};
var zh8 = { ...baseZh, ...zh, ...zh2, ...zh3, ...zh4, ...zh5, ...zh6, ...zh7 };
var en = zh8;
function fmt(t, key, vars) {
  let s = t(key);
  for (const [k, v] of Object.entries(vars ?? {})) s = s.split(`{${k}}`).join(String(v));
  return s;
}

// src/client/cards/Frame.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
function MutedRow({ tool, title, text, isError }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: c("card"), "data-tool": tool, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: c("row"), "data-static": "", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: c("title"), children: title }),
    text ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: c("dot") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `${c("summary")}${isError ? " " + c("error") : ""}`, children: text })
    ] }) : null
  ] }) });
}
function Card({
  tool,
  title,
  summary,
  isError,
  defaultOpen = true,
  children
}) {
  const [open, setOpen] = (0, import_react.useState)(defaultOpen);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: c("card"), "data-tool": tool, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: c("row"), role: "button", "aria-expanded": open, onClick: () => setOpen((v) => !v), children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: c("title"), children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: c("dot") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `${c("summary")}${isError ? " " + c("error") : ""}`, children: summary })
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: c("body"), children })
  ] });
}
function TextBody({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: c("mono"), children: text }) });
}
var Boundary = class extends import_react.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
};

// src/client/cards/KMapView.tsx
var import_react2 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var GROUP_COLORS = ["#2f80ed", "#f2994a", "#27ae60", "#eb5757", "#9b51e0", "#00a3b8"];
function colorOf(gi) {
  return GROUP_COLORS[gi % GROUP_COLORS.length];
}
function solutionsOf(layout, minimize2) {
  const solutions = minimize2 && Array.isArray(minimize2.solutions) ? minimize2.solutions : [];
  if (solutions.length === 0) {
    return [{ text: minimize2?.texts?.[0] ?? "", groups: layout.groups.map((g) => ({ text: g.text, cells: g.cells })) }];
  }
  return solutions.map((imps, i) => ({
    text: minimize2?.texts?.[i] ?? "",
    groups: imps.map((imp) => ({ text: imp.text, cells: imp.covers }))
  }));
}
function Plane({
  layout,
  plane,
  cellAt,
  groupsOf,
  t
}) {
  const cols = layout.colCodes;
  const label = layout.planeVar ? fmt(t, "bool.kmap.plane", { v: layout.planeVar, p: plane }) : "";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: c("kmap-plane"), children: [
    label && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("kmap-label"), children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: c("kmap-grid"), style: { gridTemplateColumns: `auto repeat(${cols.length}, 40px)` }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("kmap-corner"), children: `${layout.rowVars.join("")}\\${layout.colVars.join("")}` }),
      cols.map((code, ci) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("kmap-hdr"), children: code }, `h${ci}`)),
      layout.rowCodes.map((rc, ri) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_react2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: `${c("kmap-hdr")} ${c("kmap-hdr-row")}`, children: rc }),
        cols.map((_, ci) => {
          const cell = cellAt.get(`${plane},${ri},${ci}`);
          const gids = cell ? groupsOf.get(cell.minterm) ?? [] : [];
          const value = cell?.value;
          const text = value === 1 ? "1" : value === 0 ? "0" : value === "X" ? "\xD7" : "";
          return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: value === 0 || value === "X" ? `${c("kmap-cell")} ${c("muted")}` : c("kmap-cell"), children: [
            gids.map((gi, k) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "span",
              {
                className: c("kmap-grp"),
                style: {
                  top: k * 2,
                  left: k * 2,
                  right: k * 2,
                  bottom: k * 2,
                  borderColor: colorOf(gi),
                  background: colorOf(gi) + "26"
                }
              },
              gi
            )),
            cell && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: c("kmap-idx"), children: cell.minterm }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: c("kmap-val"), children: text })
          ] }, ci);
        })
      ] }, `r${ri}`))
    ] })
  ] });
}
function SolutionMap({
  layout,
  cellAt,
  solution,
  index,
  multi,
  t
}) {
  const groupsOf = /* @__PURE__ */ new Map();
  solution.groups.forEach((g, gi) => {
    for (const m of g.cells) {
      const list = groupsOf.get(m);
      if (list) list.push(gi);
      else groupsOf.set(m, [gi]);
    }
  });
  const planes = [];
  for (let p = 0; p < layout.planes; p++) planes.push(p);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: multi ? { marginTop: index > 0 ? 14 : 0, paddingTop: index > 0 ? 10 : 0, borderTop: index > 0 ? ".5px solid var(--dsw-alias-border-l2)" : void 0 } : void 0, children: [
    multi && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("line-label"), children: fmt(t, "bool.kmap.solution", { n: index + 1 }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("kmap-planes"), children: planes.map((p) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Plane, { layout, plane: p, cellAt, groupsOf, t }, p)) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("line-label"), style: { marginTop: 10 }, children: t("bool.kmap.groups") }),
    solution.groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("legend-item"), children: t("bool.kmap.noGroups") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("legend"), children: solution.groups.map((g, gi) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: c("legend-item"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: c("swatch"), style: { background: colorOf(gi) } }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Expr, { text: g.text, variables: layout.variables }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: c("muted"), children: fmt(t, "bool.kmap.cells", { n: g.cells.length }) })
    ] }, gi)) }),
    solution.text && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginTop: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("line-label"), children: t("bool.kmap.minimal") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Expr, { text: solution.text, variables: layout.variables }) })
    ] })
  ] });
}
function KMapView({ layout, minimize: minimize2, t }) {
  const cellAt = /* @__PURE__ */ new Map();
  for (const cell of layout.cells) cellAt.set(`${cell.plane},${cell.row},${cell.col}`, cell);
  const solutions = solutionsOf(layout, minimize2);
  const multi = solutions.length > 1;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: solutions.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SolutionMap, { layout, cellAt, solution: s, index: i, multi, t }, i)) });
}

// src/client/cards/TruthTableView.tsx
var import_react3 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
var COLLAPSE_AFTER = 16;
function TruthTableView({ table, t }) {
  const [all, setAll] = (0, import_react3.useState)(false);
  const rows = table.rows;
  const shown = all ? rows : rows.slice(0, COLLAPSE_AFTER);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("table", { className: c("tt"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "m" }),
        table.variables.map((v) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: v }, v)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("th", { children: "F" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("tbody", { children: shown.map((r) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: c("tt-m"), children: r.index }),
        r.inputs.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { children: b }, i)),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("td", { className: r.output === "X" ? `${c("tt-out")} ${c("muted")}` : c("tt-out"), children: r.output === "X" ? "\xD7" : r.output })
      ] }, r.index)) })
    ] }) }),
    rows.length > COLLAPSE_AFTER && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { marginTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: c("btn"), onClick: () => setAll((v) => !v), children: all ? t("bool.truth.collapse") : fmt(t, "bool.truth.all", { n: rows.length }) }) })
  ] });
}

// src/client/cards/BoolCard.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var TOOL = "dlogic_bool";
var KNOWN_OPS = [
  "parse",
  "truth_table",
  "canonical",
  "minimize",
  "kmap",
  "hazard",
  "complement",
  "dual",
  "gate_form",
  "equivalent"
];
function opTitle(op, t) {
  return KNOWN_OPS.includes(op) ? t(`bool.op.${op}`) : t("bool.title");
}
function BoolCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MutedRow, { tool: TOOL, title: t("bool.title"), text: t("bool.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["expression", "expr", "input", "op"]);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MutedRow, { tool: TOOL, title: t("bool.title"), text: `${t("bool.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL);
  if (isError || value === null) {
    const head = firstArgText(parseArgs(argsRawOf(block)), ["expression", "expr", "input"]);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { tool: TOOL, title: t("bool.title"), summary: head, isError, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MutedRow, { tool: TOOL, title: t("bool.title"), text: `${t("bool.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { tool: TOOL, title: opTitle(op, t), summary: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Boundary, { fallback: null, children: summaryOf(op, r, t) }), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(OpBody, { op, r, t, fallbackText: resultText(block) }) }) });
}
function summaryOf(op, r, t) {
  switch (op) {
    case "truth_table": {
      const x = r;
      return fmt(t, "bool.rows", { n: x.table.rows.length }) + " \xB7 " + x.table.variables.join(" ");
    }
    case "minimize": {
      const x = r;
      const texts = x.minimize.texts ?? [];
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: texts[0] ?? "", variables: x.spec.variables }),
        texts.length > 1 ? " \xB7 " + fmt(t, "bool.solutions", { n: texts.length }) : ""
      ] });
    }
    case "kmap": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.minimize.texts[0] ?? "", variables: x.spec.variables });
    }
    case "canonical":
      return r.canonical.sigma;
    case "hazard": {
      const h = r.hazard;
      const n = (h.static1?.length ?? 0) + (h.static0?.length ?? 0);
      return n === 0 ? t("bool.hazard.none") : fmt(t, "bool.hazard.count", { n });
    }
    case "complement":
    case "dual":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: r.text });
    case "gate_form":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: r.gates.nandNand, variables: r.spec.variables });
    case "equivalent":
      return r.equivalence.equivalent ? t("bool.equiv.yes") : t("bool.equiv.no");
    case "parse":
      return r.spec.variables.join(" ");
    default:
      return "";
  }
}
function OpBody({ op, r, t, fallbackText }) {
  switch (op) {
    case "truth_table":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TruthTableView, { table: r.table, t });
    case "minimize": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MinimizeBody, { variables: x.spec.variables, m: x.minimize, t });
    }
    case "kmap": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(KMapView, { layout: x.kmap, minimize: x.minimize, t });
    }
    case "canonical":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CanonicalBody, { x: r.canonical, t });
    case "hazard": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(HazardBody, { h: x.hazard, variables: x.spec.variables, t });
    }
    case "complement":
    case "dual": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.input") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.input })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.result") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.text })
        ] })
      ] });
    }
    case "gate_form": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.gate.nandNand") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.gates.nandNand, variables: x.spec.variables })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.gate.norNor") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.gates.norNor, variables: x.spec.variables })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.gate.andOrInvert") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.gates.andOrInvert, variables: x.spec.variables })
        ] })
      ] });
    }
    case "equivalent":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EquivalentBody, { x: r, t });
    case "parse":
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ParseBody, { x: r, t });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TextBody, { text: fallbackText });
  }
}
function MinimizeBody({ variables, m, t }) {
  const texts = m.texts ?? [];
  const essential = new Set(m.essential ?? []);
  const primes = m.primeImplicants ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step-text"), children: texts.length > 1 ? fmt(t, "bool.multi", { n: texts.length }) : t("bool.minimal") }),
      texts.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: s, variables }) }, i)),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("muted"), children: fmt(t, "bool.cost", { terms: m.cost.terms, literals: m.cost.literals }) }) })
    ] }),
    primes.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step-text"), children: t("bool.primes") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("chips"), children: primes.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: essential.has(p.mask) ? `${c("chip")} ${c("chip-ess")}` : c("chip"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: p.text, variables }) }, i)) })
    ] })
  ] });
}
function CanonicalBody({ x, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.canonical.sigma") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: x.sigma })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.canonical.pi") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: x.pi })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.canonical.sopForm") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.sopText })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.canonical.posForm") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.posText })
    ] })
  ] });
}
function HazardBody({ h, variables, t }) {
  const pairs = [
    ...(h.static1 ?? []).map((p) => ({ ...p, label: t("bool.hazard.static1") })),
    ...(h.static0 ?? []).map((p) => ({ ...p, label: t("bool.hazard.static0") }))
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
    pairs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step-text"), children: t("bool.hazard.none") }) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step"), children: pairs.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: p.label }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: fmt(t, "bool.hazard.pair", { a: p.a, b: p.b }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("muted"), children: fmt(t, "bool.hazard.var", { v: p.variable }) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
        t("bool.hazard.add"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: p.consensus.text, variables })
      ] })
    ] }, i)) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step-text"), children: t("bool.hazard.freeSop") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: h.hazardFreeSop, variables })
    ] })
  ] });
}
function EquivalentBody({ x, t }) {
  const e = x.equivalence;
  const variables = x.left.variables;
  const ce = e.counterexample;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: e.equivalent ? c("verdict") : `${c("verdict")} ${c("verdict-bad")}`, children: e.equivalent ? t("bool.equiv.yes") : t("bool.equiv.no") }) }),
    !e.equivalent && ce && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("step-text"), children: t("bool.counter") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
          variables.map((v) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: v }, v)),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: "L" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { children: "R" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
          ce.inputs.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { children: b }, i)),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: c("tt-out"), children: ce.left }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: c("tt-out"), children: ce.right })
        ] }) })
      ] }) })
    ] })
  ] });
}
function ParseBody({ x, t }) {
  const s = x.spec;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.input") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Expr, { text: x.input, variables: s.variables })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.parse.vars") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: s.variables.join(" ") || t("bool.none") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.parse.minterms") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: `\u03A3m(${s.minterms.join(", ")})` })
    ] }),
    s.dontCares.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: c("line-label"), children: t("bool.parse.dontcares") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: `d(${s.dontCares.join(", ")})` })
    ] })
  ] });
}

// src/client/cards/KnowledgeCard.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var TOOL2 = "dlogic_knowledge";
function validNodes(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((n) => typeof n === "object" && n !== null && typeof n.id === "string");
}
function sectionsOf(op, r, t) {
  if (op === "neighbors") {
    const x2 = r;
    const parent = validNodes([x2.parent]);
    return {
      sections: [
        { label: t("know.sec.self"), nodes: validNodes([x2.node]) },
        { label: t("know.sec.parent"), nodes: parent },
        { label: t("know.sec.children"), nodes: validNodes(x2.children) },
        { label: t("know.sec.prereqs"), nodes: validNodes(x2.prereqs) },
        { label: t("know.sec.dependents"), nodes: validNodes(x2.dependents) },
        { label: t("know.sec.related"), nodes: validNodes(x2.related) }
      ].filter((s) => s.nodes.length > 0),
      missing: []
    };
  }
  if (op === "search") {
    const x2 = r;
    return { sections: [{ label: t("know.sec.search"), nodes: validNodes(x2.nodes) }], missing: [] };
  }
  const x = r;
  return {
    sections: [{ label: t("know.sec.nodes"), nodes: validNodes(x.nodes) }],
    missing: Array.isArray(x.missing) ? x.missing.filter((m) => typeof m === "string") : []
  };
}
function KnowledgeCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MutedRow, { tool: TOOL2, title: t("know.title"), text: t("know.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["ids", "id", "query"]);
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MutedRow, { tool: TOOL2, title: t("know.title"), text: `${t("know.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL2);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { tool: TOOL2, title: t("know.title"), summary: "", isError, defaultOpen: false, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MutedRow, { tool: TOOL2, title: t("know.title"), text: `${t("know.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const built = sectionsOf(op, value.result, t);
  const total = built.sections.reduce((n, s) => n + s.nodes.length, 0);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Card, { tool: TOOL2, title: t("know.title"), summary: fmt(t, "know.count", { n: total }), defaultOpen: false, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Boundary, { fallback: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TextBody, { text: resultText(block) }), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: c("step"), children: [
    built.sections.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginBottom: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: c("step-text"), children: s.label }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("ul", { className: c("list"), children: s.nodes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: c("id"), children: n.id }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: n.title })
      ] }, n.id)) })
    ] }, i)),
    built.missing.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: c("muted"), style: { fontSize: 12 }, children: fmt(t, "know.missing", { ids: built.missing.join(", ") }) })
  ] }) }) });
}

// src/client/cards/LearnCard.tsx
var import_react4 = require("react");

// src/shared/contracts.ts
var DlogicInputError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DlogicInputError";
  }
};
var TREE_PROJECTION_KEY = "dlogicTree";
function followupPrefix(nodeId, index) {
  return `\u3010\u8FFD\u95EE ${nodeId}#${index}\u3011`;
}

// src/client/cards/LearnCard.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
var TOOL3 = "dlogic_card";
var NO_PROJECTION = () => void 0;
function LearnCard(props) {
  const { t, phase, block, ask } = props;
  const project = props.useProjection ?? NO_PROJECTION;
  const [pending, setPending] = (0, import_react4.useState)(null);
  const [sent, setSent] = (0, import_react4.useState)([]);
  const [err, setErr] = (0, import_react4.useState)(null);
  const view = project(TREE_PROJECTION_KEY);
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MutedRow, { tool: TOOL3, title: t("learn.title"), text: t("learn.preparing") });
  if (!isSettled(block)) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MutedRow, { tool: TOOL3, title: t("learn.title"), text: t("learn.running") });
  const isError = block.isError === true;
  const value = readMeta(block, TOOL3);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Card, { tool: TOOL3, title: t("learn.title"), summary: "", isError, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok || !value.result || !Array.isArray(value.result.followups)) {
    return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MutedRow, { tool: TOOL3, title: t("learn.title"), text: `${t("learn.failed")}${value.error ? "\uFF1A" + value.error : ""}`, isError: true });
  }
  const card = value.result;
  const expanded = /* @__PURE__ */ new Set();
  for (const n of view?.nodes ?? []) {
    if (n.parentId === card.nodeId && typeof n.parentFollowup === "number") expanded.add(n.parentFollowup);
  }
  const onAsk = async (index) => {
    if (pending !== null) return;
    if (!ask) {
      setErr(t("learn.askUnavailable"));
      return;
    }
    setPending(index);
    setErr(null);
    try {
      const r = await ask(card, index, view);
      if (r && r.ok) setSent((prev) => prev.includes(index) ? prev : [...prev, index]);
      else setErr(r?.error ?? t("learn.askFailed"));
    } catch {
      setErr(t("learn.askFailed"));
    } finally {
      setPending(null);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Card, { tool: TOOL3, title: t("learn.title"), summary: String(card.title ?? ""), children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { style: { color: "var(--dsw-alias-label-primary)", fontSize: 13, fontWeight: 500, marginBottom: 4 }, children: card.title }),
    card.summary && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: c("muted"), style: { fontSize: 13, marginBottom: 8 }, children: card.summary }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: c("chips"), children: card.followups.map((f, i) => {
      const done = expanded.has(i);
      const isSent = sent.includes(i);
      const busy = pending === i;
      const status = done ? t("learn.expanded") : isSent ? t("learn.sentSide") : busy ? t("tree.asking") : "";
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
        "button",
        {
          type: "button",
          className: c("chip"),
          title: f.why,
          disabled: pending !== null || done || isSent,
          onClick: () => void onAsk(i),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: c("chip-angle"), children: t(angleLabelKey(f.angle)) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: c("chip-q"), children: f.question }),
            status && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: c("chip-angle"), children: status })
          ]
        },
        i
      );
    }) }),
    err && /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: c("bad"), style: { fontSize: 12, marginTop: 6 }, children: err })
  ] }) });
}

// src/shared/gateLayout.ts
var INPUT_X = 44;
var TOP = 24;
var ITEM_GAP = 16;
var PAD_V = 14;
var PIN_GAP = 20;
var LANE_H = 16;
var CH_STEP = 8;
var CH_MARGIN = 10;
var MIN_GAP = 28;
var OUT_LABEL_W = 56;
var PAD_R = 12;
var PAD_B = 16;
var GATE_W = {
  NOT: 36,
  AND: 56,
  NAND: 56,
  OR: 56,
  NOR: 56,
  XOR: 60,
  XNOR: 60
};
function levelsOf(nl) {
  const level = /* @__PURE__ */ new Map();
  for (const i of nl.inputs) level.set(i, 0);
  const byOut = new Map(nl.gates.map((g) => [g.out, g]));
  const visit = (name, stack) => {
    const known = level.get(name);
    if (known !== void 0) return known;
    const g = byOut.get(name);
    if (!g || stack.has(name)) return 0;
    stack.add(name);
    const lv = 1 + Math.max(0, ...g.in.map((i) => visit(i, stack)));
    stack.delete(name);
    level.set(name, lv);
    return lv;
  };
  for (const g of nl.gates) visit(g.out, /* @__PURE__ */ new Set());
  return level;
}
function layoutGateDiagram(nl) {
  const level = levelsOf(nl);
  const inputSet = new Set(nl.inputs);
  const lvOf = (name) => inputSet.has(name) ? 0 : level.get(name) ?? 0;
  const maxLevel = Math.max(1, ...nl.gates.map((g) => lvOf(g.out)));
  const OUT_COL = maxLevel + 1;
  const colGates = Array.from({ length: maxLevel + 1 }, () => []);
  const gateOf = /* @__PURE__ */ new Map();
  for (const g of nl.gates) {
    const n = Math.max(1, g.in.length);
    const box = {
      out: g.out,
      type: g.type,
      x: 0,
      y: 0,
      w: GATE_W[g.type],
      h: 2 * PAD_V + PIN_GAP * (n - 1),
      inPins: [],
      outPin: { x: 0, y: 0 }
    };
    colGates[lvOf(g.out)].push(box);
    gateOf.set(g.out, box);
  }
  const chains = [];
  const addChain = (signal, dest, c1) => {
    const fromInput = inputSet.has(signal);
    const c0 = lvOf(signal);
    const lanes = [];
    for (let c2 = c0 + 1; c2 < c1; c2++) lanes.push(c2);
    chains.push({ signal, c0, c1, fromInput, dest, lanes });
  };
  for (const g of nl.gates) {
    g.in.forEach((sig, pin) => addChain(sig, { gate: g.out, pin }, lvOf(g.out)));
  }
  for (const o of nl.outputs) addChain(o, { output: o }, OUT_COL);
  const gapCount = new Array(OUT_COL + 1).fill(0);
  for (const ch of chains) for (let c2 = ch.c0; c2 < ch.c1; c2++) gapCount[c2] += 1;
  const maxW = new Array(OUT_COL + 1).fill(0);
  for (let c2 = 1; c2 <= maxLevel; c2++) maxW[c2] = Math.max(0, ...colGates[c2].map((g) => g.w));
  const colX = new Array(OUT_COL + 1).fill(0);
  colX[0] = INPUT_X;
  for (let c2 = 0; c2 < OUT_COL; c2++) {
    const gs = colX[c2] + maxW[c2];
    const n = gapCount[c2];
    colX[c2 + 1] = gs + (n > 0 ? 2 * CH_MARGIN + n * CH_STEP : MIN_GAP);
  }
  const chanX = /* @__PURE__ */ new Map();
  {
    const used = new Array(OUT_COL + 1).fill(0);
    chains.forEach((ch, ci) => {
      for (let c2 = ch.c0; c2 < ch.c1; c2++) {
        const gs = colX[c2] + maxW[c2];
        chanX.set(`${ci}:${c2}`, gs + CH_MARGIN + used[c2] * CH_STEP + CH_STEP / 2);
        used[c2] += 1;
      }
    });
  }
  const yOf = /* @__PURE__ */ new Map();
  const inputs = [];
  const outputs = [];
  let cursor = TOP;
  for (const name of nl.inputs) {
    const y = cursor + LANE_H / 2;
    yOf.set(`i:${name}`, y);
    inputs.push({ name, x: colX[0], y });
    cursor += LANE_H + ITEM_GAP;
  }
  let bottom = cursor;
  const prevY = (ci, c2) => {
    const ch = chains[ci];
    const idx = ch.lanes.indexOf(c2);
    if (idx > 0) return yOf.get(`d:${ci}:${ch.lanes[idx - 1]}`) ?? 0;
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0;
  };
  const lastPrevY = (ci) => {
    const ch = chains[ci];
    if (ch.lanes.length > 0) return yOf.get(`d:${ci}:${ch.lanes[ch.lanes.length - 1]}`) ?? 0;
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0;
  };
  for (let c2 = 1; c2 <= OUT_COL; c2++) {
    const items = [];
    let order = 0;
    if (c2 <= maxLevel) {
      for (const g of colGates[c2]) {
        const ins = chains.map((ch, ci) => ({ ch, ci })).filter(({ ch }) => "gate" in ch.dest && ch.dest.gate === g.out);
        const bary = ins.length ? ins.reduce((s, { ci }) => s + lastPrevY(ci), 0) / ins.length : 0;
        items.push({ key: `g:${g.out}`, bary, order: order++, kind: "gate", gate: g });
      }
    }
    chains.forEach((ch, ci) => {
      if (!ch.lanes.includes(c2)) return;
      items.push({ key: `d:${ci}:${c2}`, bary: prevY(ci, c2), order: order++, kind: "lane", ci });
    });
    if (c2 === OUT_COL) {
      nl.outputs.forEach((name) => {
        const ci = chains.findIndex((ch) => "output" in ch.dest && ch.dest.output === name);
        items.push({ key: `o:${name}`, bary: ci >= 0 ? lastPrevY(ci) : 0, order: order++, kind: "out", name });
      });
    }
    items.sort((a, b) => a.bary - b.bary || a.order - b.order);
    let y = TOP + c2 % 2;
    for (const it of items) {
      if (it.kind === "gate") {
        const g = it.gate;
        const n = (g.h - 2 * PAD_V) / PIN_GAP + 1;
        g.x = colX[c2];
        g.y = y;
        g.inPins = Array.from({ length: n }, (_, i) => ({ x: g.x, y: y + PAD_V + PIN_GAP * i }));
        g.outPin = { x: g.x + g.w, y: y + PAD_V + PIN_GAP * (n - 1) / 2 };
        yOf.set(it.key, g.outPin.y);
        y += g.h + ITEM_GAP;
      } else if (it.kind === "lane") {
        yOf.set(it.key, y + LANE_H / 2);
        y += LANE_H + ITEM_GAP;
      } else {
        const name = it.name;
        const oy = y + LANE_H / 2;
        yOf.set(it.key, oy);
        outputs.push({ name, x: colX[OUT_COL], y: oy });
        y += LANE_H + ITEM_GAP;
      }
    }
    bottom = Math.max(bottom, y);
  }
  const wires = chains.map((ch, ci) => {
    const start = ch.fromInput ? { x: INPUT_X, y: yOf.get(`i:${ch.signal}`) ?? 0 } : { x: gateOf.get(ch.signal).outPin.x, y: gateOf.get(ch.signal).outPin.y };
    const endY = "gate" in ch.dest ? gateOf.get(ch.dest.gate).inPins[ch.dest.pin].y : yOf.get(`o:${ch.dest.output}`) ?? 0;
    const pts = [start];
    let curY = start.y;
    let prevCol = ch.c0;
    const targets = [...ch.lanes, ch.c1];
    for (const c2 of targets) {
      const isLane = c2 !== ch.c1;
      const nextY = isLane ? yOf.get(`d:${ci}:${c2}`) ?? 0 : endY;
      const xch = chanX.get(`${ci}:${prevCol}`) ?? colX[prevCol];
      pts.push({ x: xch, y: curY }, { x: xch, y: nextY });
      if (isLane) {
        pts.push({ x: colX[c2], y: nextY }, { x: colX[c2] + maxW[c2], y: nextY });
      } else {
        pts.push({ x: colX[c2], y: nextY });
      }
      curY = nextY;
      prevCol = c2;
    }
    const clean = [];
    for (const p of pts) {
      const last = clean[clean.length - 1];
      if (last && last.x === p.x && last.y === p.y) continue;
      clean.push(p);
    }
    const to = "gate" in ch.dest ? { gate: ch.dest.gate, pin: ch.dest.pin } : { output: ch.dest.output };
    return { signal: ch.signal, points: clean, to };
  });
  const fanout = /* @__PURE__ */ new Map();
  for (const ch of chains) fanout.set(ch.signal, (fanout.get(ch.signal) ?? 0) + 1);
  const dots = [];
  for (const [sig, n] of fanout) {
    if (n < 2) continue;
    if (inputSet.has(sig)) {
      const p = inputs.find((i) => i.name === sig);
      if (p) dots.push({ x: p.x, y: p.y });
    } else {
      const g = gateOf.get(sig);
      if (g) dots.push({ x: g.outPin.x, y: g.outPin.y });
    }
  }
  return {
    width: colX[OUT_COL] + OUT_LABEL_W + PAD_R,
    height: bottom + PAD_B,
    inputs,
    gates: nl.gates.map((g) => gateOf.get(g.out)),
    wires,
    dots,
    outputs
  };
}

// src/client/cards/GateDiagram.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var INK = "var(--dsw-alias-label-primary)";
var CAPTION = "var(--dsw-alias-label-secondary)";
var BUB = 8;
function inverting(type) {
  return type === "NOT" || type === "NAND" || type === "NOR" || type === "XNOR";
}
function andPath(x0, right, top, bot) {
  const rx = (right - x0) / 2;
  const ry = (bot - top) / 2;
  return `M${x0} ${top} H${x0 + rx} A${rx} ${ry} 0 0 1 ${x0 + rx} ${bot} H${x0} Z`;
}
function orPath(x0, right, top, bot) {
  const mid = (top + bot) / 2;
  const bw = right - x0;
  return [
    `M${x0} ${top}`,
    `Q${x0 + bw * 0.3} ${mid} ${x0} ${bot}`,
    `Q${x0 + bw * 0.65} ${bot} ${right} ${mid}`,
    `Q${x0 + bw * 0.65} ${top} ${x0} ${top}`,
    "Z"
  ].join(" ");
}
function xorBackPath(x0, right, top, bot) {
  const mid = (top + bot) / 2;
  const bw = right - x0;
  return `M${x0} ${top} Q${x0 + bw * 0.3} ${mid} ${x0} ${bot}`;
}
function GateSymbol({ g }) {
  const top = g.y + 6;
  const bot = g.y + g.h - 6;
  const mid = g.y + g.h / 2;
  const inv = inverting(g.type);
  const right = g.x + g.w - (inv ? BUB : 0);
  const stroke = { stroke: INK, strokeWidth: 1.2, fill: "none" };
  let body;
  if (g.type === "NOT") {
    body = /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: `M${g.x} ${top} L${right} ${mid} L${g.x} ${bot} Z`, ...stroke });
  } else if (g.type === "AND" || g.type === "NAND") {
    body = /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: andPath(g.x, right, top, bot), ...stroke });
  } else if (g.type === "OR" || g.type === "NOR") {
    body = /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: orPath(g.x, right, top, bot), ...stroke });
  } else {
    body = /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: orPath(g.x + 4, right, top, bot), ...stroke }),
      /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: xorBackPath(g.x, right, top, bot), ...stroke })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("g", { children: [
    body,
    inv && /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: g.x + g.w - BUB / 2, cy: mid, r: BUB / 2, ...stroke })
  ] });
}
function GateDiagram({ netlist }) {
  const lay = layoutGateDiagram(netlist);
  const ink = { stroke: INK, strokeWidth: 1.2, fill: "none" };
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("div", { style: { maxWidth: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "svg",
    {
      width: "100%",
      viewBox: `0 0 ${lay.width} ${lay.height}`,
      style: { display: "block", overflow: "visible", maxWidth: lay.width, height: "auto" },
      role: "img",
      "aria-label": "\u95E8\u7EA7\u903B\u8F91\u56FE",
      children: [
        lay.wires.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "path",
          {
            d: w.points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" "),
            ...ink
          },
          `w${i}`
        )),
        lay.gates.map((g) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(GateSymbol, { g }, `g${g.out}`)),
        lay.dots.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: d.x, cy: d.y, r: 2.6, style: { fill: INK } }, `d${i}`)),
        lay.inputs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { x: p.x - 6, y: p.y + 4, textAnchor: "end", fontSize: 12, style: { fill: INK }, children: p.name }, `i${p.name}`)),
        lay.outputs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("text", { x: p.x + 6, y: p.y + 4, textAnchor: "start", fontSize: 12, style: { fill: INK }, children: p.name }, `o${p.name}`)),
        lay.gates.map((g) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
          "text",
          {
            x: g.outPin.x + 3,
            y: g.outPin.y - 4,
            fontSize: 11,
            style: { fill: CAPTION },
            children: g.out
          },
          `l${g.out}`
        ))
      ]
    }
  ) });
}

// src/client/cards/Waveform.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
var CELL = 18;
var ROW = 26;
var LABEL_W = 64;
var PAD = 6;
var HIGH = 5;
var LOW = 19;
var AXIS = 14;
var BUS_SLANT = 3;
var CHAR_W = 6;
function Waveform({
  signals,
  steps,
  times,
  unit,
  scrollable = false
}) {
  const T = Math.max(steps ?? 0, ...signals.map((s) => s.wave.length), 1);
  const width = LABEL_W + T * CELL + PAD * 2;
  const height = AXIS + signals.length * ROW + PAD;
  const ink = { stroke: "var(--dsw-alias-label-primary)", strokeWidth: 1.2 };
  const labels = axisLabels(T, times);
  const svg = /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(
    "svg",
    {
      viewBox: `0 0 ${width} ${height}`,
      width: scrollable ? width : "100%",
      height: scrollable ? height : void 0,
      style: { display: "block", maxWidth: scrollable ? void 0 : width, overflow: "visible" },
      role: "img",
      "aria-label": "\u65F6\u5E8F\u6CE2\u5F62",
      children: [
        unit && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("text", { x: PAD, y: AXIS - 4, fontSize: 9, style: { fill: "var(--dsw-alias-label-caption)" }, children: `t (${unit})` }),
        labels.map((l) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          "text",
          {
            x: l.x,
            y: AXIS - 4,
            textAnchor: "middle",
            fontSize: 9,
            style: { fill: "var(--dsw-alias-label-caption)" },
            children: l.text
          },
          `ax${l.t}`
        )),
        signals.map((sig, row) => {
          const y0 = AXIS + row * ROW;
          const hi = y0 + HIGH;
          const lo = y0 + LOW;
          const mid = (hi + lo) / 2;
          const label = /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("text", { x: PAD, y: y0 + ROW / 2 + 3, fontSize: 11, style: { fill: "var(--dsw-alias-label-secondary)" }, children: sig.name });
          if (sig.values) {
            return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("g", { children: [
              label,
              busRuns(sig.values, T).map((r, i) => {
                const x0 = LABEL_W + r.a * CELL;
                const x1 = LABEL_W + (r.b + 1) * CELL;
                const unknown = r.v === "x";
                const d = [
                  `M${x0} ${mid}`,
                  `L${x0 + BUS_SLANT} ${hi}`,
                  `L${x1 - BUS_SLANT} ${hi}`,
                  `L${x1} ${mid}`,
                  `L${x1 - BUS_SLANT} ${lo}`,
                  `L${x0 + BUS_SLANT} ${lo}`,
                  "Z"
                ].join(" ");
                const fits = x1 - x0 - 2 * BUS_SLANT >= r.v.length * CHAR_W + 2;
                return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("g", { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "path",
                    {
                      d,
                      stroke: ink.stroke,
                      strokeWidth: ink.strokeWidth,
                      style: { fill: unknown ? "var(--dsw-alias-border-l2)" : "none" },
                      children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("title", { children: r.v })
                    }
                  ),
                  fits && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
                    "text",
                    {
                      x: (x0 + x1) / 2,
                      y: mid + 3,
                      textAnchor: "middle",
                      fontSize: 10,
                      style: { fill: "var(--dsw-alias-label-primary)" },
                      children: r.v
                    }
                  )
                ] }, `b${i}`);
              })
            ] }, `s${row}`);
          }
          const parts = [];
          let lastY = null;
          let prev = "0";
          const rects = [];
          for (let t = 0; t < T; t++) {
            const raw = sig.wave[t] ?? ".";
            const ch = raw === "." ? prev : raw;
            const x0 = LABEL_W + t * CELL;
            const x1 = x0 + CELL;
            if (ch === "x") {
              rects.push({ x: x0 });
              lastY = null;
              prev = "x";
              continue;
            }
            if (ch === "p") {
              const midX = x0 + CELL / 2;
              if (lastY === null) parts.push(`M${x0} ${lo}`);
              else if (lastY !== lo) parts.push(`L${x0} ${lo}`);
              parts.push(`L${x0} ${hi}`, `L${midX} ${hi}`, `L${midX} ${lo}`, `L${x1} ${lo}`);
              lastY = lo;
              prev = "0";
              continue;
            }
            const y = ch === "1" ? hi : lo;
            if (lastY === null) parts.push(`M${x0} ${y}`);
            else if (lastY !== y) parts.push(`L${x0} ${y}`);
            parts.push(`L${x1} ${y}`);
            lastY = y;
            prev = ch === "1" ? "1" : "0";
          }
          return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("g", { children: [
            label,
            rects.map((r, i) => /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
              "rect",
              {
                x: r.x,
                y: hi,
                width: CELL,
                height: lo - hi,
                style: { fill: "var(--dsw-alias-border-l2)" }
              },
              `x${i}`
            )),
            parts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("path", { d: parts.join(" "), fill: "none", ...ink })
          ] }, `s${row}`);
        })
      ]
    }
  );
  return scrollable ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { overflowX: "auto", maxWidth: "100%" }, children: svg }) : svg;
}
function axisLabels(T, times) {
  const out = [];
  let freeAt = -Infinity;
  for (let t = 0; t < T; t++) {
    const text = String(times?.[t] ?? t);
    const x = LABEL_W + t * CELL + CELL / 2;
    const half = text.length * 5.5 / 2;
    if (x - half < freeAt) continue;
    out.push({ t, x, text });
    freeAt = x + half + 3;
  }
  return out;
}
function busRuns(values, T) {
  const runs = [];
  for (let t = 0; t < T; t++) {
    const v = values[t] ?? "x";
    const last = runs[runs.length - 1];
    if (last && last.v === v) last.b = t;
    else runs.push({ a: t, b: t, v });
  }
  return runs;
}

// src/client/cards/CombCard.tsx
var import_jsx_runtime10 = require("react/jsx-runtime");
var TOOL4 = "dlogic_comb";
var KNOWN_OPS2 = ["analyze", "map_msi", "draw"];
var WAVE_MAX_INPUTS = 5;
function opTitle2(op, t) {
  return KNOWN_OPS2.includes(op) ? t(`comb.op.${op}`) : t("comb.title");
}
function CombCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(MutedRow, { tool: TOOL4, title: t("comb.title"), text: t("comb.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op", "chip"]);
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(MutedRow, { tool: TOOL4, title: t("comb.title"), text: `${t("comb.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL4);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Card, { tool: TOOL4, title: t("comb.title"), summary: firstArgText(parseArgs(argsRawOf(block)), ["op", "chip"]), isError, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(MutedRow, { tool: TOOL4, title: t("comb.title"), text: `${t("comb.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    Card,
    {
      tool: TOOL4,
      title: opTitle2(op, t),
      summary: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Boundary, { fallback: null, children: summaryOf2(op, r, t) }),
      children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(CombBody, { op, r, t }),
        value.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: value.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("muted"), children: [
          t("comb.warn"),
          "\uFF1A",
          w
        ] }, i)) })
      ] }) })
    }
  );
}
function CombBody({ op, r, t }) {
  return op === "analyze" || op === "draw" ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(AnalyzeBody, { r, t }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(MsiBody, { r, t });
}
function summaryOf2(op, r, t) {
  if (op === "analyze" || op === "draw") {
    const a = r;
    const first = a.finalExprs[0];
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
      first ? `${first.name} = ` : "",
      first ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: first.simplified, variables: a.inputs }) : null,
      " \xB7 ",
      fmt(t, "comb.levels", { n: a.depth })
    ] });
  }
  return r.chipName;
}
function truthWaves(r) {
  const rows = r.truthTable.rows;
  const inWaves = r.inputs.map((name, i) => ({
    name,
    role: "input",
    wave: rows.map((row) => String(row.inputs[i])).join("")
  }));
  const outWaves = r.outputs.map((name, j) => ({
    name,
    role: "output",
    wave: rows.map((row) => String(row.outputs[j])).join("")
  }));
  return [...inWaves, ...outWaves];
}
function AnalyzeBody({ r, t }) {
  const allNames = [...r.inputs, ...r.gates.map((g) => g.out)];
  const tt = r.truthTable;
  const netlist = {
    inputs: r.inputs,
    gates: r.gates.map((g) => ({ out: g.out, type: g.type, in: g.in })),
    outputs: r.outputs
  };
  const waveOk = r.inputs.length >= 1 && r.inputs.length <= WAVE_MAX_INPUTS;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.diagram.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(GateDiagram, { netlist })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.wave.title") }),
      waveOk ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Waveform, { signals: truthWaves(r), steps: tt.rows.length, scrollable: true }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("muted"), children: t("comb.wave.hidden") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.analyze.inputs") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: r.inputs.join(" ") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("muted"), children: fmt(t, "comb.gates", { n: r.gates.length }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.analyze.steps") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.analyze.col.gate") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.analyze.col.type") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.analyze.col.level") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.analyze.col.local") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.analyze.col.expr") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: r.gates.map((g) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: g.out }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: g.type }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: g.level }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: `${g.out} = ${g.local}`, variables: allNames }) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: g.expr !== null ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: g.expr, variables: r.inputs }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("muted"), children: t("comb.analyze.noExpr") }) })
        ] }, g.out)) })
      ] }) })
    ] }),
    r.finalExprs.map((f) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.analyze.final") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { children: [
          f.name,
          " = "
        ] }),
        f.expr !== null ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: f.expr, variables: r.inputs }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("muted"), children: t("comb.analyze.noExpr") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.analyze.simplified") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { children: [
          f.name,
          " = "
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: f.simplified, variables: r.inputs }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("muted"), children: fmt(t, "comb.analyze.cost", { terms: f.cost.terms, literals: f.cost.literals }) })
      ] })
    ] }, f.name)),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.analyze.truth") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          tt.variables.map((v) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: v }, v)),
          tt.outputs.map((o) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: o }, o))
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: tt.rows.slice(0, 64).map((row) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          row.inputs.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: b }, `i${i}`)),
          row.outputs.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: c("tt-out"), children: b }, `o${i}`))
        ] }, row.index)) })
      ] }) }),
      tt.rows.length > 64 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("muted"), children: fmt(t, "comb.analyze.truthMore", { n: tt.rows.length }) })
    ] })
  ] });
}
function activeText(p, t) {
  if (p.activeLevel === "high") return t("comb.active.high");
  if (p.activeLevel === "low") return t("comb.active.low");
  return t("comb.active.none");
}
function variablesOf(m) {
  switch (m.kind) {
    case "decoder":
      return m.addressVars;
    case "mux":
      return [...m.selectVars, ...m.highVars];
    case "parity":
      return m.variables;
    default:
      return [];
  }
}
function MsiBody({ r, t }) {
  const vars = variablesOf(r.mapping);
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: r.chipName }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.func") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: r.functionText })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.pins.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.pins.name") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.pins.alias") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.pins.level") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.pins.note") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: r.pins.map((p) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: p.name }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: p.aliases.join("\u3001") }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: activeText(p, t) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: c("muted"), children: p.note ?? "" })
        ] }, p.name)) })
      ] }) })
    ] }),
    r.stages.map((st, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(StageBody, { stage: st, vars, t }, i)),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(MappingBody, { m: r.mapping, t })
  ] });
}
function StageBody({ stage, vars, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step-text"), children: [
      t("comb.wiring.title"),
      "\uFF1A",
      stage.label
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: c("tt"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.wiring.pin") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.wiring.signal") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.wiring.note") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: stage.wiring.map((w, j) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: w.pin }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: w.signal, variables: vars }) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: c("muted"), children: w.note ?? "" })
      ] }, j)) })
    ] }) })
  ] });
}
function dataText(d, vars) {
  if (d.kind === "const") return d.text;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: d.text, variables: vars });
}
function MappingBody({ m, t }) {
  switch (m.kind) {
    case "decoder":
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: m.constant !== null ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: fmt(t, "comb.decoder.constant", { v: m.constant }) }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.decoder.nand") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Expr, { text: m.nandText, variables: m.outputNames })
      ] }) });
    case "mux": {
      const high = m.highVars;
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("step-text"), children: [
          t("comb.mux.reduced"),
          "\uFF08",
          t("comb.mux.select"),
          "\uFF1A",
          m.selectVars.join(" "),
          high.length ? `\uFF1B${t("comb.mux.high")}\uFF1A${high.join(" ")}` : `\uFF1B${t("comb.mux.noHigh")}`,
          "\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("table", { className: c("tt"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.mux.code") }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.mux.dataPin") }),
            m.highAssignments.map((hv, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: high.map((v, j) => `${v}=${hv[j]}`).join(" ") }, i)),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("th", { children: t("comb.mux.value") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("tbody", { children: m.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: row.selectBits.join("") }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: row.dataPin }),
            row.cofactor.map((v, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { children: v }, i)),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("td", { className: c("tt-out"), children: dataText(row.data, high) })
          ] }, row.index)) })
        ] }) })
      ] });
    }
    case "adder":
      return m.bcd && m.correctionText ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.adder.correction") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: m.correctionText })
      ] }) }) : null;
    case "parity":
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: c("line-label"), children: t("comb.parity.output") }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: m.outputPin })
      ] }) });
    case "encoder":
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: c("step-text"), children: t("comb.encoder.note") }) });
    default:
      return null;
  }
}

// src/client/cards/StateGraph.tsx
var import_react5 = require("react");
var import_jsx_runtime11 = require("react/jsx-runtime");
var NODE_R = 15;
function StateGraphView({ graph }) {
  const uid = (0, import_react5.useId)().replace(/[^A-Za-z0-9_-]/g, "");
  const n = graph.nodes.length;
  const R = n <= 1 ? 0 : Math.max(58, 30 + n * 10);
  const half = R + NODE_R + 40;
  const cx = half;
  const cy = half;
  const pos = /* @__PURE__ */ new Map();
  graph.nodes.forEach((nd, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * i / Math.max(n, 1);
    pos.set(nd.id, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  });
  const pairs = new Set(graph.edges.map((e) => `${e.from}>${e.to}`));
  const edgeColor = { stroke: "var(--dsw-alias-label-caption)", fill: "none", strokeWidth: 1 };
  const textStyle = { fill: "var(--dsw-alias-label-secondary)" };
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
    "svg",
    {
      viewBox: `0 0 ${2 * half} ${2 * half}`,
      width: "100%",
      style: { display: "block", maxWidth: 2 * half + 40 },
      role: "img",
      "aria-label": "\u72B6\u6001\u56FE",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("marker", { id: `${uid}-arrow`, viewBox: "0 0 10 10", refX: "9", refY: "5", markerWidth: "6", markerHeight: "6", orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("path", { d: "M0,0 L10,5 L0,10 z", style: { fill: "var(--dsw-alias-label-secondary)" } }) }) }),
        graph.edges.map((e, i) => {
          const A = pos.get(e.from);
          const B = pos.get(e.to);
          if (!A || !B) return null;
          if (e.from === e.to) {
            const dx2 = A.x - cx;
            const dy2 = A.y - cy;
            const len2 = Math.hypot(dx2, dy2) || 1;
            const ox = dx2 / len2;
            const oy = dy2 / len2;
            const tx = -oy;
            const ty = ox;
            const s = { x: A.x + ox * NODE_R + tx * 5, y: A.y + oy * NODE_R + ty * 5 };
            const en2 = { x: A.x + ox * NODE_R - tx * 5, y: A.y + oy * NODE_R - ty * 5 };
            const c1 = { x: A.x + ox * (NODE_R + 30) + tx * 14, y: A.y + oy * (NODE_R + 30) + ty * 14 };
            const c2 = { x: A.x + ox * (NODE_R + 30) - tx * 14, y: A.y + oy * (NODE_R + 30) - ty * 14 };
            const lab2 = { x: A.x + ox * (NODE_R + 40), y: A.y + oy * (NODE_R + 40) };
            return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("g", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                "path",
                {
                  d: `M${s.x} ${s.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${en2.x} ${en2.y}`,
                  ...edgeColor,
                  markerEnd: `url(#${uid}-arrow)`
                }
              ),
              e.label && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("text", { x: lab2.x, y: lab2.y + 3, textAnchor: "middle", fontSize: 10, style: textStyle, children: e.label })
            ] }, `e${i}`);
          }
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const nx = -uy;
          const ny = ux;
          const bent = pairs.has(`${e.to}>${e.from}`);
          const sign = e.from < e.to ? 1 : -1;
          const off = bent ? 20 * sign : 0;
          const P0 = { x: A.x + ux * NODE_R, y: A.y + uy * NODE_R };
          const P1 = { x: B.x - ux * (NODE_R + 4), y: B.y - uy * (NODE_R + 4) };
          const C = { x: (P0.x + P1.x) / 2 + nx * off, y: (P0.y + P1.y) / 2 + ny * off };
          const lab = {
            x: 0.25 * P0.x + 0.5 * C.x + 0.25 * P1.x + nx * (off === 0 ? 10 : 0),
            y: 0.25 * P0.y + 0.5 * C.y + 0.25 * P1.y + ny * (off === 0 ? 10 : 0)
          };
          return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("g", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("path", { d: `M${P0.x} ${P0.y} Q${C.x} ${C.y} ${P1.x} ${P1.y}`, ...edgeColor, markerEnd: `url(#${uid}-arrow)` }),
            e.label && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("text", { x: lab.x, y: lab.y + 3, textAnchor: "middle", fontSize: 10, style: textStyle, children: e.label })
          ] }, `e${i}`);
        }),
        graph.nodes.map((nd) => {
          const p = pos.get(nd.id);
          if (!p) return null;
          const stroke = nd.valid ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-caption)";
          return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("g", { children: [
            nd.initial && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("circle", { cx: p.x, cy: p.y, r: NODE_R + 3, style: { stroke, fill: "none" }, strokeWidth: 1 }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "circle",
              {
                cx: p.x,
                cy: p.y,
                r: NODE_R,
                strokeWidth: nd.valid ? 1.2 : 1,
                strokeDasharray: nd.valid ? void 0 : "3 3",
                style: { stroke, fill: "var(--dsw-alias-bg-l1, transparent)" }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              "text",
              {
                x: p.x,
                y: p.y + 3.5,
                textAnchor: "middle",
                fontSize: nd.label.length > 3 ? 9 : 11,
                style: { fill: nd.valid ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-label-caption)" },
                children: nd.label
              }
            )
          ] }, `n${nd.id}`);
        })
      ]
    }
  );
}

// src/client/cards/SeqCard.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var TOOL5 = "dlogic_seq";
var KNOWN_OPS3 = ["ff", "analyze", "counter", "shift", "waveform"];
function opTitle3(op, t) {
  return KNOWN_OPS3.includes(op) ? t(`seq.op.${op}`) : t("seq.title");
}
function SeqCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MutedRow, { tool: TOOL5, title: t("seq.title"), text: t("seq.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op", "ffKind", "shiftKind", "model"]);
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MutedRow, { tool: TOOL5, title: t("seq.title"), text: `${t("seq.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL5);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { tool: TOOL5, title: t("seq.title"), summary: firstArgText(parseArgs(argsRawOf(block)), ["op"]), isError, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(MutedRow, { tool: TOOL5, title: t("seq.title"), text: `${t("seq.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Card, { tool: TOOL5, title: opTitle3(op, t), summary: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Boundary, { fallback: null, children: summaryOf3(op, r, t) }), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(SeqBody, { op, r, t }) }) });
}
function summaryOf3(op, r, t) {
  switch (op) {
    case "ff": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: x.characteristic, variables: x.inputs });
    }
    case "analyze": {
      const x = r;
      return `${x.stateNames.join(" ")} \xB7 ${x.selfStart ? t("seq.self.yes") : t("seq.self.no")}`;
    }
    case "counter": {
      const x = r;
      return fmt(t, "seq.counter.model", { model: x.model, n: x.N }) + (x.feedback.expr ? " \xB7 " + x.feedback.expr : "");
    }
    case "shift": {
      const x = r;
      const name = shiftName(x.kind, t);
      return x.modulus !== null ? `${name} \xB7 ${fmt(t, "seq.shift.modulus", { n: x.modulus })}` : name;
    }
    case "waveform": {
      const x = r;
      return fmt(t, "seq.wave.steps", { n: x.steps });
    }
    default:
      return "";
  }
}
function shiftName(kind, t) {
  if (kind === "194") return t("seq.shift.194");
  if (kind === "ring") return t("seq.shift.ring");
  return t("seq.shift.johnson");
}
function SeqBody({ op, r, t }) {
  switch (op) {
    case "ff":
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(FfBody, { x: r, t });
    case "analyze":
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(AnalyzeBody2, { x: r, t });
    case "counter":
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(CounterBody, { x: r, t });
    case "shift":
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(ShiftBody, { x: r, t });
    case "waveform":
      return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(WaveBody, { x: r, t });
    default:
      return null;
  }
}
function Verdict({ ok, yes, no }) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: ok ? c("verdict") : `${c("verdict")} ${c("verdict-bad")}`, children: ok ? yes : no });
}
function FfBody({ x, t }) {
  const trig = t(`seq.ff.trigger.${x.trigger}`);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.ff.characteristic") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: x.characteristic, variables: x.inputs })
      ] }),
      x.constraint && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.ff.constraint") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: x.constraint })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: trig }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.ff.table") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          x.inputs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: p }, p)),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.q") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.next") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: x.table.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          x.inputs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.inputs[p] }, p)),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.q }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: c("tt-out"), children: row.next === "X" ? t("seq.ff.forbidden") : row.next })
        ] }, i)) })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.ff.excitation") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.q") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.next") }),
          x.inputs.filter((p) => p !== "CP").map((p) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: p }, p))
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: x.excitation.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: e.from }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: e.to }),
          x.inputs.filter((p) => p !== "CP").map((p) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { className: e.drive[p] === "X" ? c("muted") : c("tt-out"), children: e.drive[p] === "X" ? "X" : e.drive[p] }, p))
        ] }, i)) })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: t("seq.ff.any") }) })
    ] })
  ] });
}
function AnalyzeBody2({ x, t }) {
  const vars = [...x.stateNames, ...x.inputNames];
  const hasInputs = x.inputNames.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.drives") }),
      x.drives.map((d, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: `${d.ff}.${d.pin}` }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: d.expr, variables: vars })
      ] }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.state") }),
      x.stateEquations.map((e, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: `${e.ff}*` }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: e.text, variables: vars })
      ] }, i))
    ] }),
    x.outputs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.outputs") }),
      x.outputs.map((o, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: o.name }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: o.expr, variables: vars }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: o.type === "Moore" ? t("seq.analyze.moore") : t("seq.analyze.mealy") })
      ] }, i))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.table") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.state") }),
          hasInputs && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.input") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.nextState") }),
          x.outputs.map((o) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: o.name }, o.name))
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: x.table.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { className: row.valid ? void 0 : c("muted"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.state }),
          hasInputs && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.input }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("td", { className: c("tt-out"), children: [
            row.next,
            !row.valid && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("span", { className: c("muted"), children: [
              " ",
              t("seq.analyze.invalidRow")
            ] })
          ] }),
          row.outputs.map((o) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: o.value }, o.name))
        ] }, i)) })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.analyze.valid") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: x.validStates.join(" ") || t("seq.analyze.noValid") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Verdict, { ok: x.selfStart, yes: t("seq.self.yes"), no: t("seq.self.no") }) }),
      x.invalidPaths.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("list"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.invalid") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("ul", { className: c("list"), children: x.invalidPaths.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("li", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("id"), children: p.from }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: p.path.join(" \u2192 ") }),
          !p.reached && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("bad"), children: t("seq.analyze.noReach") })
        ] }, i)) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.graph") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(StateGraphView, { graph: x.graph })
    ] })
  ] });
}
function CounterBody({ x, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.counter.feedback") }),
        x.feedback.expr ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Expr, { text: x.feedback.expr }) : /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: t("seq.counter.none") }),
        x.feedback.kind !== "none" && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: x.feedback.kind === "async" ? t("seq.counter.async") : t("seq.counter.sync") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: `${x.method === "preset" ? t("seq.counter.preset") : t("seq.counter.reset")} \xB7 ${x.chips === 2 ? t("seq.counter.cascade") : t("seq.counter.single")}` }) }),
      x.load && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.counter.load") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: `${x.load.value}\uFF08${x.load.bits}\uFF09` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.counter.bitNames") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: x.bitNames.join(" ") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.counter.sequence") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.index") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.bits") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.value") }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("th", { children: t("seq.col.note") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("tbody", { children: x.sequence.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("tr", { className: row.transient ? c("muted") : void 0, children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.index }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.bits }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.value }),
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("td", { children: row.transient ? `${t("seq.counter.transient")}\uFF08${t("seq.counter.glitch")}\uFF09` : "" })
        ] }, i)) })
      ] }) })
    ] })
  ] });
}
function ShiftBody({ x, t }) {
  const invalid = x.cycles ? x.cycles.filter((cy) => !cy.valid) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: t("seq.shift.feedback") }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: x.feedback })
      ] }),
      x.modulus !== null && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("line-label"), children: fmt(t, "seq.shift.modulus", { n: x.modulus }) }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: x.validCycle?.join(" \u2192 ") })
      ] }),
      x.selfStart !== null && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Verdict, { ok: x.selfStart, yes: t("seq.self.yes"), no: t("seq.self.no") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.shift.sequence") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("ul", { className: c("list"), children: x.sequence.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("id"), children: s.step }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: s.valid ? void 0 : c("muted"), children: s.state }),
        !s.valid && /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { className: c("muted"), children: t("seq.shift.invalidState") })
      ] }, i)) })
    ] }),
    invalid.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.shift.invalid") }),
      invalid.map((cy, i) => /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("span", { children: cy.states.join(" \u2192 ") }) }, i))
    ] }),
    x.graph && /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step-text"), children: t("seq.analyze.graph") }),
      /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(StateGraphView, { graph: x.graph })
    ] })
  ] });
}
function WaveBody({ x, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(Waveform, { signals: x.signals, steps: x.steps }) });
}

// src/client/cards/FsmCard.tsx
var import_react6 = require("react");

// src/solvers/fsm.ts
var MAX_STATES = 16;
var MAX_BITS = 2;
function isUnspecifiedName(s) {
  return s === "x" || s === "X" || s === "-" || s === "";
}
function normPattern(s) {
  return s.replace(/X/g, "x").replace(/-/g, "x");
}
function bitsOf(v, width) {
  return v.toString(2).padStart(width, "0");
}
function matchesPattern(pattern, combo, m) {
  for (let i = 0; i < m; i++) {
    const ch = pattern[i];
    if (ch === "x") continue;
    const bit = combo >> m - 1 - i & 1;
    if (Number(ch) !== bit) return false;
  }
  return true;
}
function mergeOut(a, b) {
  let r = "";
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === "x") r += y;
    else if (y === "x" || y === x) r += x;
    else throw new DlogicInputError(`\u540C\u4E00\u8F6C\u79FB\u7684\u8F93\u51FA\u76F8\u4E92\u77DB\u76FE\uFF1A${a} \u4E0E ${b}\u3002`);
  }
  return r;
}
function validateSpec(spec) {
  if (spec.type !== "mealy" && spec.type !== "moore") throw new DlogicInputError("\u72B6\u6001\u673A\u7C7B\u578B\u987B\u4E3A mealy\uFF08\u7C73\u5229\u578B\uFF09\u6216 moore\uFF08\u6469\u5C14\u578B\uFF09\u3002");
  if (!Array.isArray(spec.states) || spec.states.length === 0) throw new DlogicInputError("\u72B6\u6001\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (spec.states.length > MAX_STATES) {
    throw new DlogicInputError(`\u72B6\u6001\u6570\u6700\u591A ${MAX_STATES} \u4E2A\uFF0C\u5F53\u524D\u4E3A ${spec.states.length} \u4E2A\u3002`);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const s of spec.states) {
    if (typeof s !== "string" || s.trim() === "") throw new DlogicInputError("\u72B6\u6001\u540D\u4E0D\u80FD\u4E3A\u7A7A\u3002");
    if (isUnspecifiedName(s)) throw new DlogicInputError(`\u72B6\u6001\u540D\u4E0D\u80FD\u4E3A\u201C${s}\u201D\uFF08\u8BE5\u5199\u6CD5\u8868\u793A\u672A\u7ED9\u5B9A\uFF09\u3002`);
    if (seen.has(s)) throw new DlogicInputError(`\u72B6\u6001\u540D\u91CD\u590D\uFF1A${s}`);
    seen.add(s);
  }
  if (!Number.isInteger(spec.inputs) || spec.inputs < 1 || spec.inputs > MAX_BITS) {
    throw new DlogicInputError("\u8F93\u5165\u4F4D\u6570\u987B\u4E3A 1\uFF5E2\u3002");
  }
  if (!Number.isInteger(spec.outputs) || spec.outputs < 1 || spec.outputs > MAX_BITS) {
    throw new DlogicInputError("\u8F93\u51FA\u4F4D\u6570\u987B\u4E3A 1\uFF5E2\u3002");
  }
  if (!Array.isArray(spec.transitions)) throw new DlogicInputError("transitions \u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  for (const t of spec.transitions) {
    if (!seen.has(t.from)) throw new DlogicInputError(`\u8F6C\u79FB\u7684\u73B0\u6001\u201C${t.from}\u201D\u4E0D\u5728\u72B6\u6001\u5217\u8868\u4E2D\u3002`);
    if (!isUnspecifiedName(t.to) && !seen.has(t.to)) throw new DlogicInputError(`\u8F6C\u79FB\u7684\u6B21\u6001\u201C${t.to}\u201D\u4E0D\u5728\u72B6\u6001\u5217\u8868\u4E2D\u3002`);
    if (typeof t.input !== "string" || !/^[01xX-]+$/.test(t.input) || t.input.length !== spec.inputs) {
      throw new DlogicInputError(`\u8F93\u5165\u201C${String(t.input)}\u201D\u987B\u4E3A ${spec.inputs} \u4F4D\u7684 0/1/x \u4E32\u3002`);
    }
    if (typeof t.output !== "string" || !/^[01xX-]+$/.test(t.output) || t.output.length !== spec.outputs) {
      throw new DlogicInputError(`\u8F93\u51FA\u201C${String(t.output)}\u201D\u987B\u4E3A ${spec.outputs} \u4F4D\u7684 0/1/x \u4E32\u3002`);
    }
  }
}
function buildTable(spec) {
  validateSpec(spec);
  const n = spec.states.length;
  const m = spec.inputs;
  const o = spec.outputs;
  const combos = 1 << m;
  const idx = new Map(spec.states.map((s, i) => [s, i]));
  const next = Array.from({ length: n }, () => new Array(combos).fill(-1));
  const out = Array.from({ length: n }, () => new Array(combos).fill("x".repeat(o)));
  const stateOut = new Array(n).fill("x".repeat(o));
  for (const t of spec.transitions) {
    const s = idx.get(t.from);
    const d = isUnspecifiedName(t.to) ? -1 : idx.get(t.to);
    const pattern = normPattern(t.input);
    const outPat = normPattern(t.output);
    for (let c2 = 0; c2 < combos; c2++) {
      if (!matchesPattern(pattern, c2, m)) continue;
      if (d >= 0) {
        if (next[s][c2] >= 0 && next[s][c2] !== d) {
          throw new DlogicInputError(`\u72B6\u6001 ${t.from} \u5728\u8F93\u5165 ${bitsOf(c2, m)} \u4E0B\u7684\u6B21\u6001\u4E0D\u552F\u4E00\u3002`);
        }
        next[s][c2] = d;
      }
      if (spec.type === "mealy") out[s][c2] = mergeOut(out[s][c2], outPat);
    }
    if (spec.type === "moore") stateOut[s] = mergeOut(stateOut[s], outPat);
  }
  if (spec.type === "moore") {
    for (let s = 0; s < n; s++) for (let c2 = 0; c2 < combos; c2++) out[s][c2] = stateOut[s];
  }
  return { type: spec.type, states: spec.states.slice(), inputs: m, outputs: o, next, out };
}

// src/client/cards/FsmCard.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var TOOL6 = "dlogic_fsm";
var KNOWN_OPS4 = ["reduce", "assign", "synthesize", "self_start"];
var KINDS = ["binary", "gray", "onehot", "custom"];
function opTitle4(op, t) {
  return KNOWN_OPS4.includes(op) ? t(`fsm.op.${op}`) : t("fsm.title");
}
function kindLabel(kind, t) {
  return KINDS.includes(kind) ? t(`fsm.encoding.${kind}`) : kind;
}
function bitsOf2(v, width) {
  return v.toString(2).padStart(width, "0");
}
function FsmCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(MutedRow, { tool: TOOL6, title: t("fsm.title"), text: t("fsm.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op"]);
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(MutedRow, { tool: TOOL6, title: t("fsm.title"), text: `${t("fsm.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL6);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Card, { tool: TOOL6, title: t("fsm.title"), summary: "", isError, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(MutedRow, { tool: TOOL6, title: t("fsm.title"), text: `${t("fsm.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Card, { tool: TOOL6, title: opTitle4(op, t), summary: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Boundary, { fallback: null, children: summaryOf4(op, r, t) }), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(FsmBody, { op, r, t }) }) });
}
function summaryOf4(op, r, t) {
  switch (op) {
    case "reduce": {
      const x = r;
      const head = x.reduce.complete ? t("fsm.reduce.complete") : t("fsm.reduce.incomplete");
      return `${head} \xB7 ${fmt(t, "fsm.reduce.reduced", { n: x.reduce.reducedCount, m: x.spec.states.length })}`;
    }
    case "assign": {
      const a = r.assign;
      const best = a.encodings.find((e) => e.kind === a.best) ?? a.encodings[0];
      return fmt(t, "fsm.assign.summary", { kind: kindLabel(a.best, t), score: best.score });
    }
    case "synthesize": {
      const s = r.synthesis;
      return fmt(t, "fsm.synth.summary", { ff: s.ff, n: s.functions.length });
    }
    case "self_start": {
      const x = r.selfStart;
      if (x.selfStarting) return t("fsm.selfStart.yes");
      return x.fixed ? t("fsm.selfStart.fixed") : t("fsm.selfStart.stillNo");
    }
    default:
      return "";
  }
}
function FsmBody({ op, r, t }) {
  switch (op) {
    case "reduce": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ReduceBody, { spec: x.spec, reduce: x.reduce, t });
    }
    case "assign": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(AssignBody, { spec: x.spec, assign: x.assign, t });
    }
    case "synthesize": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(SynthBody, { spec: x.spec, s: x.synthesis, t });
    }
    case "self_start": {
      const x = r;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(SelfStartBody, { spec: x.spec, sc: x.selfStart, t });
    }
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(TextBody, { text: "" });
  }
}
function StateTable({ spec, t }) {
  const T = buildTable(spec);
  const combos = 1 << T.inputs;
  const moore = T.type === "moore";
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: c("tt"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.state") }),
      moore && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.output") }),
      Array.from({ length: combos }, (_, k) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: `${t("fsm.table.input")} ${bitsOf2(k, T.inputs)}` }, k))
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: T.states.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: s }),
      moore && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: c("tt-out"), children: T.out[i][0] }),
      Array.from({ length: combos }, (_, k) => {
        const nx = T.next[i][k];
        const text = moore ? nx < 0 ? "x" : T.states[nx] : `${nx < 0 ? "x" : T.states[nx]}/${T.out[i][k]}`;
        return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: text }, k);
      })
    ] }, `${s}-${i}`)) })
  ] }) });
}
var NODE_R2 = 16;
function StateDiagram({ spec, t }) {
  const uid = (0, import_react6.useId)().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = spec.states.length;
  const R = n <= 4 ? 70 : n <= 8 ? 100 : 130;
  const pad = 58;
  const size = 2 * (R + pad);
  const cx = size / 2;
  const cy = size / 2;
  const pos = spec.states.map((_, i) => {
    const a = -Math.PI / 2 + 2 * Math.PI * i / n;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const index = new Map(spec.states.map((s, i) => [s, i]));
  const groups = /* @__PURE__ */ new Map();
  for (const tr of spec.transitions) {
    if (tr.to === "x" || tr.to === "" || tr.to === "-") continue;
    const a = index.get(tr.from);
    const b = index.get(tr.to);
    if (a === void 0 || b === void 0) continue;
    const key = `${a}>${b}`;
    if (!groups.has(key)) groups.set(key, { from: a, to: b, labels: [] });
    const label = `${tr.input}/${tr.output}`;
    const g = groups.get(key);
    if (g && !g.labels.includes(label)) g.labels.push(label);
  }
  const style = { stroke: "var(--dsw-alias-label-secondary)", fill: "none", strokeWidth: 1 };
  const textStyle = { fill: "var(--dsw-alias-label-secondary)" };
  const edges = [...groups.values()].map((g, k) => {
    const label = g.labels.join("  ");
    if (g.from === g.to) {
      const p = pos[g.from];
      const ux = (p.x - cx) / (Math.hypot(p.x - cx, p.y - cy) || 1);
      const uy = (p.y - cy) / (Math.hypot(p.x - cx, p.y - cy) || 1);
      const rot = (ang) => [
        ux * Math.cos(ang) - uy * Math.sin(ang),
        ux * Math.sin(ang) + uy * Math.cos(ang)
      ];
      const [ax, ay] = rot(0.6);
      const [bx, by] = rot(-0.6);
      const A = [p.x + ax * NODE_R2, p.y + ay * NODE_R2];
      const B = [p.x + bx * NODE_R2, p.y + by * NODE_R2];
      const lx = p.x + ux * (NODE_R2 + 26);
      const ly = p.y + uy * (NODE_R2 + 26);
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("g", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("path", { d: `M${A[0]},${A[1]} A22,22 0 1,1 ${B[0]},${B[1]}`, style, markerEnd: `url(#${uid}-arrow)` }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("text", { x: lx, y: ly, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, style: textStyle, children: label })
      ] }, k);
    }
    const p0 = pos[g.from];
    const p2 = pos[g.to];
    const dx = p2.x - p0.x;
    const dy = p2.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len;
    const vy = dy / len;
    const px = -vy;
    const py = vx;
    const start = [p0.x + vx * NODE_R2, p0.y + vy * NODE_R2];
    const end = [p2.x - vx * NODE_R2, p2.y - vy * NODE_R2];
    const bend = len * 0.18;
    const ctrl = [(start[0] + end[0]) / 2 + px * bend, (start[1] + end[1]) / 2 + py * bend];
    const mid = [0.25 * start[0] + 0.5 * ctrl[0] + 0.25 * end[0], 0.25 * start[1] + 0.5 * ctrl[1] + 0.25 * end[1]];
    return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("g", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
        "path",
        {
          d: `M${start[0]},${start[1]} Q${ctrl[0]},${ctrl[1]} ${end[0]},${end[1]}`,
          style,
          markerEnd: `url(#${uid}-arrow)`
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("text", { x: mid[0] + px * 8, y: mid[1] + py * 8, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, style: textStyle, children: label })
    ] }, k);
  });
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.diagram") }),
    groups.size === 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("muted"), children: t("fsm.diagram.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("svg", { viewBox: `0 0 ${size} ${size}`, style: { width: "100%", maxWidth: 360, height: "auto", display: "block" }, role: "img", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("marker", { id: `${uid}-arrow`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("path", { d: "M0,0 L10,5 L0,10 z", style: { fill: "var(--dsw-alias-label-secondary)" } }) }) }),
      edges,
      spec.states.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("g", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("circle", { cx: pos[i].x, cy: pos[i].y, r: NODE_R2, style }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("text", { x: pos[i].x, y: pos[i].y, textAnchor: "middle", dominantBaseline: "middle", fontSize: 11, style: { fill: "var(--dsw-alias-label-primary)" }, children: s })
      ] }, `${s}-${i}`))
    ] })
  ] });
}
function ReduceBody({ spec, reduce, t }) {
  const merged = reduce.classes.some((cls) => cls.length > 1);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: reduce.complete ? t("fsm.reduce.complete") : t("fsm.reduce.incomplete") }),
      reduce.complete && reduce.implication && reduce.implication.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.implication.pair") }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.implication.result") }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.implication.reason") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: reduce.implication.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: `(${p.a}, ${p.b})` }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: p.status === "equivalent" ? c("ok") : c("bad"), children: p.status === "equivalent" ? t("fsm.implication.equivalent") : t("fsm.implication.distinct") }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("td", { style: { textAlign: "left" }, children: [
            p.reason,
            p.implied.length > 0 && p.status === "equivalent" && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("muted"), children: fmt(t, "fsm.implication.implied", {
              pairs: p.implied.map((q) => `(${q.a}, ${q.b})`).join(" ")
            }) })
          ] })
        ] }, i)) })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("line-label"), children: t("fsm.reduce.classes") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("chips"), children: reduce.classes.map((cls, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("chip"), children: cls.length > 1 ? `{${cls.join(",")}}` : cls[0] }, i)) })
      ] }),
      !reduce.complete && reduce.cover && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("line-label"), children: t("fsm.reduce.cover") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("chips"), children: reduce.cover.map((cls, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: `${c("chip")} ${c("chip-ess")}`, children: cls.length > 1 ? `{${cls.join(",")}}` : cls[0] }, i)) })
      ] }),
      !merged && reduce.complete && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("muted"), children: t("fsm.reduce.noMerge") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("line-label"), children: t("fsm.reduce.stateMap") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: reduce.stateMap.map((m) => `${m.state}\u2192${m.groups.join("/")}`).join("\uFF0C") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.reduce.reducedTable") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(StateTable, { spec: reduce.reduced, t })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(StateDiagram, { spec: reduce.reduced, t })
  ] });
}
function AssignBody({ spec, assign, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.assign.pairs") }),
      assign.pairs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("muted"), children: t("fsm.assign.none") }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("ul", { className: c("list"), children: assign.pairs.map((p, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("id"), children: `${p.a}-${p.b}` }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: p.rules.map((r) => fmt(t, "fsm.assign.rule", { r })).join("\uFF0C") })
      ] }, i)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: c("tt"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.assign.encoding") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.assign.bits") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.assign.score") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.assign.satisfied") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.assign.codes") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: assign.encodings.map((e, i) => {
        const isBest = e.kind === assign.best;
        return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("td", { className: isBest ? c("ok") : void 0, children: [
            kindLabel(e.kind, t),
            isBest ? `\uFF08${t("fsm.assign.best")}\uFF09` : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: e.bits }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: e.score }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { children: `${e.satisfied}/${e.total}` }),
          /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { style: { textAlign: "left" }, children: e.codes.map((x) => `${x.state}=${x.code}`).join("  ") })
        ] }, i);
      }) })
    ] }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(StateDiagram, { spec, t })
  ] });
}
function SynthBody({ spec, s, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.synth.codes") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("chips"), children: s.codes.map((x) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("chip"), children: `${x.state} = ${x.code}` }, x.state)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.synth.table") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(ExcitationTable, { s, t })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(FunctionList, { fns: s.functions, t, title: t("fsm.synth.functions") }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(StateDiagram, { spec, t })
  ] });
}
function ExcitationTable({ s, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("table", { className: c("tt"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.code") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.state") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.input") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.next") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: t("fsm.table.output") }),
      s.excitationNames.map((name) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("th", { children: name }, name))
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("tbody", { children: s.table.map((row, i) => {
      const cls = row.state === null ? c("muted") : void 0;
      return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.code }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.state ?? t("fsm.table.unused") }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.input }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.next === null ? "x" : `${row.next}\uFF08${row.nextCode}\uFF09` }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.output }),
        s.excitationNames.map((name) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("td", { className: cls, children: row.excitation[name] ?? "x" }, name))
      ] }, i);
    }) })
  ] }) });
}
function FunctionList({ fns, t, title }) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("ul", { className: c("list"), children: fns.map((f) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("li", { style: { flexDirection: "column", gap: 2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("id"), children: f.name }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("muted"), children: f.role === "excitation" ? t("fsm.synth.role.excitation") : t("fsm.synth.role.output") }),
        "  ",
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Expr, { text: f.text, variables: f.variables }),
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("muted"), children: `  ${fmt(t, "fsm.synth.cost", { terms: f.cost.terms, literals: f.cost.literals })}` })
      ] }),
      f.texts.length > 1 && f.texts.slice(1).map((x, k) => /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: { paddingLeft: 24 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("muted"), children: fmt(t, "fsm.synth.solution", { n: k + 2 }) }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(Expr, { text: x, variables: f.variables })
      ] }, k))
    ] }, f.name)) })
  ] });
}
function SelfStartBody({ spec, sc, t }) {
  const verdict = sc.selfStarting ? t("fsm.selfStart.yes") : sc.fixed ? t("fsm.selfStart.fixed") : t("fsm.selfStart.stillNo");
  const failing = sc.checks.filter((ch) => !ch.ok);
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: sc.selfStarting ? c("verdict") : `${c("verdict")} ${c("verdict-bad")}`, children: verdict }) }),
    !sc.selfStarting && /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { className: c("step-text"), children: t("fsm.selfStart.before") }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("ul", { className: c("list"), children: failing.map((ch, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { className: c("bad"), children: fmt(t, "fsm.selfStart.check", { code: ch.code, input: ch.input, trace: ch.trace.join(" \u2192 ") }) }) }, i)) }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("ul", { className: c("list"), children: sc.rewritten.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: fmt(t, "fsm.selfStart.rewrite", { code: row.code, to: row.to }) }) }, i)) })
    ] }),
    !sc.selfStarting && sc.fixed && /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(FunctionList, { fns: sc.synthesis.functions, t, title: t("fsm.selfStart.after") }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(StateDiagram, { spec, t })
  ] });
}

// src/client/cards/MemCard.tsx
var import_jsx_runtime14 = require("react/jsx-runtime");
var TOOL7 = "dlogic_mem";
var KNOWN_OPS5 = ["expand", "rom_func", "pla", "pal", "lut"];
var ROW_LIMIT = 64;
function opTitle5(op, t) {
  return KNOWN_OPS5.includes(op) ? t(`mem.op.${op}`) : t("mem.title");
}
function MemCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MutedRow, { tool: TOOL7, title: t("mem.title"), text: t("mem.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op"]);
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MutedRow, { tool: TOOL7, title: t("mem.title"), text: `${t("mem.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL7);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Card, { tool: TOOL7, title: t("mem.title"), summary: firstArgText(parseArgs(argsRawOf(block)), ["op"]), isError, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MutedRow, { tool: TOOL7, title: t("mem.title"), text: `${t("mem.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
    Card,
    {
      tool: TOOL7,
      title: opTitle5(op, t),
      summary: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Boundary, { fallback: null, children: summaryOf5(op, r, t) }),
      children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(MemBody, { op, r, t }),
        value.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step"), children: value.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("muted"), children: [
          t("mem.warn"),
          "\uFF1A",
          w
        ] }, i)) })
      ] }) })
    }
  );
}
function MemBody({ op, r, t }) {
  switch (op) {
    case "expand":
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(ExpandBody, { r, t });
    case "rom_func":
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(RomBody, { r, t });
    case "pla":
    case "pal":
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(PlaBody, { r, t });
    case "lut":
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(LutBody, { r, t });
    default:
      return null;
  }
}
function summaryOf5(op, r, t) {
  if (op === "expand") {
    const e = r;
    return `${fmt(t, "mem.chips", { n: e.chipCount })} \xB7 ${t(`mem.mode.${e.mode}`)}`;
  }
  if (op === "rom_func") {
    const rom = r;
    return `${rom.size.words}\xD7${rom.size.bits}`;
  }
  if (op === "pla" || op === "pal") {
    const p = r;
    return fmt(t, "mem.terms", { n: p.cost.terms });
  }
  const l = r;
  return l.kind === "single" ? `${l.hex}H` : t("mem.lut.split");
}
function Title({ text }) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step-text"), children: text });
}
function Tbl({ head, rows }) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("table", { className: c("tt"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("tr", { children: head.map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("th", { children: h }, i)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("tbody", { children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("tr", { children: row.map((cell, j) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("td", { children: cell }, j)) }, i)) })
  ] }) });
}
function DotGrid({ rowLabels, colLabels, dots }) {
  const cw = 26;
  const rh = 22;
  const lx = 72;
  const ty = 36;
  const w = lx + colLabels.length * cw + 12;
  const h = ty + rowLabels.length * rh + 8;
  const bottom = ty + rowLabels.length * rh;
  const right = lx + colLabels.length * cw;
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: { maxWidth: "100%", height: "auto" }, role: "img", children: [
    colLabels.map((l, j) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("text", { x: lx + j * cw + cw / 2, y: ty - 10, textAnchor: "middle", fontSize: 12, fill: "currentColor", children: l }, `c${j}`)),
    rowLabels.map((l, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("text", { x: lx - 10, y: ty + i * rh + rh / 2 + 4, textAnchor: "end", fontSize: 12, fill: "currentColor", children: l }, `r${i}`)),
    colLabels.map((_, j) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "line",
      {
        x1: lx + j * cw + cw / 2,
        x2: lx + j * cw + cw / 2,
        y1: ty,
        y2: bottom,
        stroke: "currentColor",
        strokeOpacity: 0.15
      },
      `vl${j}`
    )),
    rowLabels.map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      "line",
      {
        x1: lx,
        x2: right,
        y1: ty + i * rh + rh / 2,
        y2: ty + i * rh + rh / 2,
        stroke: "currentColor",
        strokeOpacity: 0.15
      },
      `hl${i}`
    )),
    dots.map(
      (row, i) => row.map(
        (on, j) => on ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("circle", { cx: lx + j * cw + cw / 2, cy: ty + i * rh + rh / 2, r: 4.5, fill: "currentColor" }, `d${i}-${j}`) : null
      )
    )
  ] }) });
}
function groupMask(mask) {
  return mask.match(/.{1,4}/g)?.join(" ") ?? mask;
}
function ExpandBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.exp.target") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          r.target.words,
          "\xD7",
          r.target.bits,
          "\uFF08",
          fmt(t, "mem.exp.capacity", { n: r.target.capacity }),
          "\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.exp.chip") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          r.chip.words,
          "\xD7",
          r.chip.bits
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.exp.count") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: fmt(t, "mem.exp.countVal", { total: r.chipCount, w: r.wordGroups, b: r.bitGroups }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.exp.addr") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: r.chipAddressLines.join("\u3001") }),
        r.selectLines.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          t("mem.exp.select"),
          "\uFF1A",
          r.selectLines.join("\u3001")
        ] })
      ] })
    ] }),
    r.decoder && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.exp.decoder") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.wiring.pin"), t("mem.wiring.signal"), t("mem.wiring.note")],
          rows: r.decoder.wiring.map((w) => [w.pin, w.signal, w.note ?? ""])
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.exp.chips") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.exp.col.chip"), t("mem.exp.col.group"), t("mem.exp.col.data"), t("mem.exp.col.select")],
          rows: r.chips.map((ch) => [
            String(ch.index),
            String(ch.wordGroup),
            ch.dataLow === ch.dataHigh ? `D${ch.dataLow}` : `D${ch.dataHigh}\uFF5ED${ch.dataLow}`,
            ch.select
          ])
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.exp.map") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.exp.col.group"), t("mem.exp.col.chips"), t("mem.exp.col.range")],
          rows: r.addressMap.map((a) => [String(a.wordGroup), a.chips.join("\u3001"), `${a.lowHex}\uFF5E${a.highHex}`])
        }
      )
    ] }),
    r.decode && /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.exp.decode") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step-text"), children: r.decode.note }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.exp.decodeLines") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          r.decode.decoderLines,
          r.decode.mode === "double" ? `\uFF08${r.decode.rows} + ${r.decode.cols}\uFF09` : ""
        ] })
      ] })
    ] })
  ] });
}
function RomBody({ r, t }) {
  const rows = r.rows.slice(0, ROW_LIMIT);
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.rom.size") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          r.size.words,
          "\xD7",
          r.size.bits,
          "\uFF08",
          fmt(t, "mem.exp.capacity", { n: r.size.capacity }),
          "\uFF09"
        ] })
      ] }),
      r.functions.map((f) => /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("mono"), children: f.text }) }, f.name))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.rom.table") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.rom.col.addr"), t("mem.rom.col.bits"), ...r.outputNames, t("mem.rom.col.hex")],
          rows: rows.map((row) => [
            String(row.address),
            row.addressBits,
            ...row.data.map((d) => String(d)),
            `${row.hex}H`
          ])
        }
      ),
      r.rows.length > ROW_LIMIT && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("muted"), children: fmt(t, "mem.rom.more", { n: r.rows.length }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.rom.matrix") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        DotGrid,
        {
          rowLabels: rows.map((row) => row.addressBits),
          colLabels: r.outputNames,
          dots: rows.map((row) => row.data.map((d) => d === 1))
        }
      )
    ] })
  ] });
}
function PlaBody({ r, t }) {
  const outNames = r.outputs.map((o) => o.name);
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t(r.kind === "pla" ? "mem.pla.kind" : "mem.pal.kind") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: fmt(t, "mem.pla.cost", { terms: r.cost.terms, literals: r.cost.literals }) }),
      r.termsPerOutput !== null ? /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("muted"), children: fmt(t, "mem.pal.fixed", { k: r.termsPerOutput }) }) : /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("muted"), children: fmt(t, "mem.pla.share", { sep: r.separateTerms, n: r.cost.terms }) })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.pla.outputs") }),
      r.outputs.map((o) => /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { children: [
          o.name,
          " = "
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Expr, { text: o.text, variables: r.variables }),
        o.overflow && /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("muted"), children: t("mem.pal.overflow") })
      ] }, o.name))
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.pla.terms") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.pla.col.term"), t("mem.pla.col.expr"), t("mem.pla.col.used")],
          rows: r.terms.map((p) => [p.label, /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Expr, { text: p.text, variables: r.variables }, "e"), p.usedBy.join("\u3001")])
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.pla.and") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(DotGrid, { rowLabels: r.terms.map((p) => p.label), colLabels: r.andColumns, dots: r.andDots })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.pla.or") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(DotGrid, { rowLabels: r.terms.map((p) => p.label), colLabels: outNames, dots: r.orDots })
    ] })
  ] });
}
function LutBody({ r, t }) {
  if (r.kind === "single") {
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.lut.mask") }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("mono"), children: groupMask(r.mask) }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.lut.hex") }),
          /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("span", { className: c("mono"), children: [
            r.hex,
            "H"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step-text"), children: r.functionText })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.lut.pins") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          Tbl,
          {
            head: [t("mem.wiring.pin"), t("mem.wiring.signal"), t("mem.wiring.note")],
            rows: r.pins.map((p) => [p.pin, p.signal, p.note ?? ""])
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.lut.table") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          Tbl,
          {
            head: [t("mem.lut.col.addr"), t("mem.lut.col.bits"), t("mem.lut.col.value")],
            rows: r.rows.map((row) => [String(row.address), row.addressBits || "\u2014", String(row.value)])
          }
        )
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("div", { className: c("step-text"), children: r.functionText }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("line-label"), children: t("mem.lut.split") }),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: fmt(t, "mem.lut.splitVars", { s: r.splitVars.join("\u3001"), l: r.lutVars.join("\u3001") }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.lut.pins") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.wiring.pin"), t("mem.wiring.signal"), t("mem.wiring.note")],
          rows: r.pins.map((p) => [p.pin, p.signal, p.note ?? ""])
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(Title, { text: t("mem.lut.cofactors") }),
      /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
        Tbl,
        {
          head: [t("mem.lut.col.assign"), t("mem.lut.col.mask"), t("mem.lut.col.hex")],
          rows: r.cofactors.map((cf) => [cf.assignment, /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { className: c("mono"), children: groupMask(cf.mask) }, "m"), `${cf.hex}H`])
        }
      )
    ] })
  ] });
}

// src/shared/adda.ts
function fmtNum(x, digits = 6) {
  if (!Number.isFinite(x)) return String(x);
  if (x === 0) return "0";
  if (Math.abs(x) < 1e-3) return String(Number(x.toPrecision(4)));
  return String(Number(x.toFixed(digits)));
}
function fmtTime(s) {
  const a = Math.abs(s);
  if (a >= 1) return `${fmtNum(s)} s`;
  if (a >= 1e-3) return `${fmtNum(s * 1e3)} ms`;
  if (a >= 1e-6) return `${fmtNum(s * 1e6)} \u03BCs`;
  return `${fmtNum(s * 1e9)} ns`;
}

// src/client/cards/AddaCard.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
var TOOL8 = "dlogic_adda";
var KNOWN_OPS6 = ["dac", "adc_sar", "adc_flash", "adc_dual", "quantize"];
function opTitle6(op, t) {
  return KNOWN_OPS6.includes(op) ? t(`adda.op.${op}`) : t("adda.title");
}
function AddaCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MutedRow, { tool: TOOL8, title: t("adda.title"), text: t("adda.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op", "bits"]);
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MutedRow, { tool: TOOL8, title: t("adda.title"), text: `${t("adda.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL8);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Card, { tool: TOOL8, title: t("adda.title"), summary: firstArgText(parseArgs(argsRawOf(block)), ["op"]), isError, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(MutedRow, { tool: TOOL8, title: t("adda.title"), text: `${t("adda.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    Card,
    {
      tool: TOOL8,
      title: opTitle6(op, t),
      summary: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Boundary, { fallback: null, children: summaryOf6(op, r) }),
      children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(AddaBody, { op, r, t }),
        value.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step"), children: value.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("muted"), children: [
          t("adda.warn"),
          "\uFF1A",
          w
        ] }, i)) })
      ] }) })
    }
  );
}
function AddaBody({ op, r, t }) {
  switch (op) {
    case "dac":
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DacBody, { r, t });
    case "adc_sar":
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(SarBody, { r, t });
    case "adc_flash":
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(FlashBody, { r, t });
    case "adc_dual":
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(DualBody, { r, t });
    case "quantize":
      return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(QuantBody, { r, t });
    default:
      return null;
  }
}
function summaryOf6(op, r) {
  switch (op) {
    case "dac": {
      const d = r;
      return `${d.typeName} \xB7 Vo = ${fmtNum(d.vout)} V`;
    }
    case "adc_sar": {
      const s = r;
      return `${s.codeBinary}\uFF08${s.code}\uFF09`;
    }
    case "adc_flash": {
      const f = r;
      return `${f.codeBinary}\uFF08${f.code}\uFF09`;
    }
    case "adc_dual": {
      const d = r;
      return `T2 = ${fmtTime(d.t2)}\uFF0CN2 = ${d.n2}`;
    }
    case "quantize": {
      const q = r;
      return `\u0394 = ${fmtNum(q.delta)} V`;
    }
    default:
      return "";
  }
}
function Row({ label, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("line"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { className: c("line-label"), children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { children })
  ] });
}
function Notes({ items }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step"), children: items.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("muted"), children: s }, i)) });
}
function Derivation({ items, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step-text"), children: t("adda.derivation") }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Notes, { items })
  ] });
}
function DacBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.type"), children: r.typeName }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.input"), children: `${r.code}\uFF08${r.codeBinary}\uFF09` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.formula"), children: r.formula }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.substituted"), children: r.substituted }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.fraction"), children: r.fraction }),
      r.rfRatio !== null && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.rf"), children: fmtNum(r.rfRatio) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.lsb"), children: `${fmtNum(r.lsb)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.fullScale"), children: `${fmtNum(r.fullScale)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dac.output"), children: `${fmtNum(r.vout)} V` })
    ] }),
    r.branches && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step-text"), children: t("adda.dac.branches") }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.dac.col.bit") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.dac.col.value") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.dac.col.resistor") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("tbody", { children: r.branches.map((b) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: b.bit }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { className: c("tt-out"), children: b.value }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: b.resistor })
        ] }, b.bit)) })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Derivation, { items: r.derivation, t })
  ] });
}
function SarBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.vin"), children: `${fmtNum(r.vin)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.vref"), children: `${fmtNum(r.vref)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.delta"), children: `${fmtNum(r.delta)} V` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step-text"), children: t("adda.sar.process") }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.step") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.bit") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.trial") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.dac") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.compare") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.kept") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.sar.col.partial") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("tbody", { children: r.steps.map((s) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: s.step }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: `2^${s.bit}` }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: s.trialBinary }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: fmtNum(s.dacVoltage) }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: s.geq ? t("adda.sar.geq") : t("adda.sar.lt") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { className: c("tt-out"), children: s.geq ? t("adda.sar.keep") : t("adda.sar.clear") }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: s.partialBinary })
        ] }, s.step)) })
      ] }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.result"), children: fmt(t, "adda.sar.final", { code: `${r.codeBinary}\uFF08${r.code}\uFF09` }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.quantized"), children: `${fmtNum(r.quantized)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.error"), children: `${fmtNum(r.error)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.errorRange"), children: "0 \u2264 e < \u0394" })
    ] })
  ] });
}
function FlashBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.mode"), children: r.mode === "truncate" ? t("adda.common.truncate") : t("adda.common.round") }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.vin"), children: `${fmtNum(r.vin)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.delta"), children: `${fmtNum(r.delta)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.flash.refs"), children: r.refFormula }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.flash.count"), children: fmt(t, "adda.flash.countValue", { n: r.comparatorCount }) })
    ] }),
    r.comparators.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("table", { className: c("tt"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.flash.col.index") }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.flash.col.ref") }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("th", { children: t("adda.flash.col.out") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("tbody", { children: r.comparators.map((k) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: k.index }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { children: `${fmtNum(k.ref)} V` }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("td", { className: c("tt-out"), children: k.output })
      ] }, k.index)) })
    ] }) }) }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("muted"), children: t("adda.flash.omitted") }) }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      r.thermometer !== null && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.flash.thermo"), children: r.thermometer }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.result"), children: fmt(t, "adda.flash.code", { code: `${r.codeBinary}\uFF08${r.code}\uFF09` }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.quantized"), children: `${fmtNum(r.quantized)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.error"), children: `${fmtNum(r.error)} V` })
    ] })
  ] });
}
function DualBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dual.t1"), children: `${fmtTime(r.t1)}\uFF08N1 = ${r.n1}\uFF09` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dual.t2"), children: fmtTime(r.t2) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dual.n2"), children: String(r.n2) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dual.tmax"), children: fmtTime(r.convMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.dual.res"), children: `${fmtNum(r.resolution)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Row, { label: t("adda.dual.mains"), children: [
        `${fmtNum(r.mainsPeriods)}\uFF08${r.mainsHz} Hz\uFF09`,
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { className: c("muted"), children: [
          " ",
          r.mainsMultiple ? t("adda.dual.mainsOk") : t("adda.dual.mainsNo")
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Derivation, { items: r.derivation, t })
  ] });
}
function QuantBody({ r, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.quant.levels"), children: fmt(t, "adda.quant.levelsValue", { n: r.levels }) }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.delta"), children: `${r.deltaFormula} = ${fmtNum(r.delta)} V` }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.common.errorRange"), children: r.mode === "truncate" ? t("adda.quant.rangeTruncate") : t("adda.quant.rangeRound") }),
      r.vin !== null && r.codeBinary !== null && r.quantized !== null && r.error !== null && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(Row, { label: t("adda.common.result"), children: [
        fmt(t, "adda.quant.result", { v: fmtNum(r.vin), code: `${r.codeBinary}\uFF08${r.code}\uFF09` }),
        `\uFF0C${fmtNum(r.quantized)} V\uFF0Ce = ${fmtNum(r.error)} V`
      ] })
    ] }),
    r.minBits && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.quant.minBits"), children: r.minBits.bits === null ? fmt(t, "adda.quant.minBitsNone", { n: 16, e: fmtNum(r.minBits.maxError) }) : fmt(t, "adda.quant.minBitsValue", { e: fmtNum(r.minBits.maxError), n: r.minBits.bits }) }) }),
    r.sampling && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.quant.sampling"), children: r.sampling.verdict }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Row, { label: t("adda.quant.minFs"), children: `${fmtNum(r.sampling.minFs)} Hz` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(Derivation, { items: r.derivation, t })
  ] });
}

// src/client/cards/SystemCard.tsx
var import_react7 = require("react");
var import_jsx_runtime16 = require("react/jsx-runtime");
var TOOL9 = "dlogic_system";
var KNOWN_OPS7 = ["asm", "controller"];
var CX = 170;
var BOX_W = 160;
var ELL_RX = 62;
var ELL_RY = 14;
var DIA_W = 170;
var DIA_H = 40;
var DIAG_WIDTH = 440;
function opTitle7(op, t) {
  return KNOWN_OPS7.includes(op) ? t(`system.op.${op}`) : t("system.title");
}
function SystemCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MutedRow, { tool: TOOL9, title: t("system.title"), text: t("system.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op"]);
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MutedRow, { tool: TOOL9, title: t("system.title"), text: `${t("system.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL9);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Card, { tool: TOOL9, title: t("system.title"), summary: "", isError, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(MutedRow, { tool: TOOL9, title: t("system.title"), text: `${t("system.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const r = value.result;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Card, { tool: TOOL9, title: opTitle7(op, t), summary: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Boundary, { fallback: null, children: summaryOf7(op, r, t) }), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SystemBody, { op, r, t }) }) });
}
function summaryOf7(op, r, t) {
  if (op === "asm") {
    const a = r.asm;
    const errors = a.issues.filter((i) => i.level === "error").length;
    return a.valid ? t("system.asm.valid") : fmt(t, "system.asm.invalid", { n: errors });
  }
  if (op === "controller") {
    const x = r.controller;
    return fmt(t, "system.controller.summary", { n: x.states.length });
  }
  return "";
}
function SystemBody({ op, r, t }) {
  if (op === "asm") {
    const x = r;
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AsmBody, { spec: x.spec, asm: x.asm, t });
  }
  if (op === "controller") {
    const x = r;
    return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(ControllerBody, { ctl: x.controller, t });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(TextBody, { text: "" });
}
function isElseCond(cond) {
  return cond.trim().toLowerCase() === "else";
}
function isAlwaysCond(cond) {
  return cond.trim() === "1";
}
function AsmBody({ spec, asm, t }) {
  const errors = asm.issues.filter((i) => i.level === "error").length;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: asm.valid ? c("verdict") : `${c("verdict")} ${c("verdict-bad")}`, children: asm.valid ? t("system.asm.valid") : fmt(t, "system.asm.invalid", { n: errors }) }) }),
    asm.issues.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t("system.asm.issues") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: c("list"), children: asm.issues.map((issue, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: issue.level === "error" ? c("bad") : c("muted"), children: `${issue.level === "error" ? t("system.asm.error") : t("system.asm.warning")}\uFF1A${issue.message}` }) }, k)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t("system.asm.diagram") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(AsmDiagram, { spec, t })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t("system.asm.table") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(TransitionTable, { asm, t })
    ] })
  ] });
}
function TransitionTable({ asm, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("table", { className: c("tt"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.state") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.asm.outputs") }),
      asm.table.combos.map((label, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: label }, k))
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("tbody", { children: asm.table.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.state }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.outputs.join("\u3001") || t("system.asm.empty") }),
      row.cells.map((cell, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("td", { children: [
        cell.next ?? "\u2014",
        cell.active.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("muted"), children: cell.active.join("\u3001") })
      ] }, k))
    ] }, row.state)) })
  ] }) });
}
function AsmDiagram({ spec, t }) {
  const uid = (0, import_react7.useId)().replace(/[^a-zA-Z0-9_-]/g, "");
  const stroke = { stroke: "var(--dsw-alias-label-secondary)", fill: "none", strokeWidth: 1 };
  const labelFill = { fill: "var(--dsw-alias-label-primary)" };
  const subFill = { fill: "var(--dsw-alias-label-secondary)" };
  const nodes = [];
  const add = (el) => {
    nodes.push(/* @__PURE__ */ (0, import_jsx_runtime16.jsx)("g", { children: el }, nodes.length));
  };
  const arrow = (x1, y1, x2, y2) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("line", { x1, y1, x2, y2, style: stroke, markerEnd: `url(#${uid}-arrow)` });
  let y = 10;
  for (const st of spec.states) {
    const hasOut = st.outputs.length > 0;
    const h = hasOut ? 42 : 28;
    add(
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("rect", { x: CX - BOX_W / 2, y, width: BOX_W, height: h, rx: 3, style: stroke }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX, y: hasOut ? y + 14 : y + h / 2, textAnchor: "middle", dominantBaseline: "middle", fontSize: 12, style: labelFill, children: st.name }),
        hasOut && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX, y: y + 31, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, style: subFill, children: st.outputs.join("\uFF0C") })
      ] })
    );
    let cursor = y + h;
    for (const co of st.conditionals) {
      const cy = cursor + 22;
      add(
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
          arrow(CX, cursor, CX, cy - ELL_RY),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ellipse", { cx: CX, cy, rx: ELL_RX, ry: ELL_RY, style: stroke }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX, y: cy, textAnchor: "middle", dominantBaseline: "middle", fontSize: 11, style: labelFill, children: co.name }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX + ELL_RX + 8, y: cy, dominantBaseline: "middle", fontSize: 10, style: subFill, children: `${t("system.asm.when")} ${co.expr}` })
        ] })
      );
      cursor = cy + ELL_RY;
    }
    const exits = spec.transitions.filter((tr) => tr.from === st.name);
    const conds = exits.filter((tr) => !isElseCond(tr.cond));
    const elses = exits.filter((tr) => isElseCond(tr.cond));
    conds.forEach((tr, k) => {
      if (isAlwaysCond(tr.cond)) {
        const ny = cursor + 18;
        add(
          /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
            arrow(CX, cursor, CX, ny),
            /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX + 8, y: (cursor + ny) / 2, dominantBaseline: "middle", fontSize: 10, style: subFill, children: `${t("system.asm.uncond")} \u2192 ${tr.to}` })
          ] })
        );
        cursor = ny;
        return;
      }
      const cy = cursor + 12 + DIA_H / 2;
      add(
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
          arrow(CX, cursor, CX, cy - DIA_H / 2),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("polygon", { points: `${CX},${cy - DIA_H / 2} ${CX + DIA_W / 2},${cy} ${CX},${cy + DIA_H / 2} ${CX - DIA_W / 2},${cy}`, style: stroke }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX, y: cy, textAnchor: "middle", dominantBaseline: "middle", fontSize: 10, style: labelFill, children: tr.cond }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("line", { x1: CX + DIA_W / 2, y1: cy, x2: CX + DIA_W / 2 + 26, y2: cy, style: stroke }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX + DIA_W / 2 + 30, y: cy, dominantBaseline: "middle", fontSize: 10, style: subFill, children: `${t("system.asm.yes")} \u2192 ${tr.to}` }),
          k > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX + 6, y: cursor + 8, dominantBaseline: "middle", fontSize: 10, style: subFill, children: t("system.asm.no") })
        ] })
      );
      cursor = cy + DIA_H / 2;
    });
    if (elses.length > 0) {
      const ny = cursor + 18;
      add(
        /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_jsx_runtime16.Fragment, { children: [
          arrow(CX, cursor, CX, ny),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("text", { x: CX + 8, y: (cursor + ny) / 2, dominantBaseline: "middle", fontSize: 10, style: subFill, children: `${t("system.asm.elseLabel")} \u2192 ${elses[0].to}` })
        ] })
      );
      cursor = ny;
    }
    y = cursor + 20;
  }
  const height = y + 4;
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("svg", { viewBox: `0 0 ${DIAG_WIDTH} ${height}`, style: { width: "100%", maxWidth: DIAG_WIDTH, height: "auto", display: "block" }, role: "img", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("marker", { id: `${uid}-arrow`, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("path", { d: "M0,0 L10,5 L0,10 z", style: { fill: "var(--dsw-alias-label-secondary)" } }) }) }),
    nodes
  ] });
}
function ControllerBody({ ctl, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("line-label"), children: t("system.controller.initial") }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: ctl.initial })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("line-label"), children: t("system.asm.vars") }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: ctl.conditionVars.join("\u3001") || t("system.asm.empty") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t("system.controller.signals") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.state") }),
          ctl.signals.map((sig) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: sig }, sig))
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("tbody", { children: ctl.controlTable.map((row) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.state }),
          row.values.map((v, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { className: v === "0" ? c("muted") : void 0, children: v === "0" || v === "1" ? v : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Expr, { text: v, variables: ctl.conditionVars }) }, k))
        ] }, row.state)) })
      ] }) })
    ] }),
    ctl.schemes.map((s) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(SchemeSection, { s, condVars: ctl.conditionVars, t }, s.scheme))
  ] });
}
function SchemeSection({ s, condVars, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t(`system.scheme.${s.scheme}`) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("line"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("line-label"), children: t("system.scheme.bits") }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: s.bits.join("\u3001") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("table", { className: c("tt"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.state") }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.code") }),
        s.decoder && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.line") })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("tbody", { children: s.codes.map((row, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.state }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.code }),
        s.decoder && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: s.decoder[k].line })
      ] }, row.state)) })
    ] }) }),
    s.muxes && s.muxes.map((mx) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("line-label"), children: fmt(t, "system.mux.title", { bit: mx.bit }) }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("muted"), children: `${t("system.mux.select")}\uFF1A${mx.select.join("\u3001")}` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.code") }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.state") }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("th", { children: t("system.table.data") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("tbody", { children: mx.rows.map((row, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("tr", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.code }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.state ?? t("system.table.unused") }),
          /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("td", { children: row.state === null ? row.data : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FnText, { text: row.data, variables: condVars }) })
        ] }, k)) })
      ] }) })
    ] }, mx.bit)),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FunctionList2, { fns: s.functions, t }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: c("list"), children: s.devices.map((d, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: d }) }, `d${k}`)) }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: c("list"), children: s.notes.map((n, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("muted"), children: n }) }, `n${k}`)) })
  ] });
}
function FnText({ text, variables }) {
  if (text === "0" || text === "1" || variables.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: text });
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(Expr, { text, variables });
}
function FunctionList2({ fns, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { className: c("step-text"), children: t("system.scheme.functions") }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ul", { className: c("list"), children: fns.map((f) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("li", { style: { flexDirection: "column", gap: 2 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("id"), children: f.name }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("muted"), children: t(`system.role.${f.role}`) }),
        "  ",
        f.minimized ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FnText, { text: f.texts[0], variables: f.variables }) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { children: f.texts[0] }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("muted"), children: f.minimized ? `  ${fmt(t, "system.scheme.cost", { terms: f.cost.terms, literals: f.cost.literals })}` : `  ${t("system.scheme.minimized")}` })
      ] }),
      f.minimized && f.texts.length > 1 && f.texts.slice(1).map((x, k) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { paddingLeft: 24 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { className: c("muted"), children: fmt(t, "system.scheme.solution", { n: k + 2 }) }),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(FnText, { text: x, variables: f.variables })
      ] }, k))
    ] }, f.name)) })
  ] });
}

// src/shared/hdl.ts
var SIM_WAVE_COLUMNS = 160;
var FS_PER_UNIT = { fs: 1, ps: 1e3, ns: 1e6, us: 1e9, ms: 1e12, s: 1e15 };
var UNIT_RE = /^(\d*)\s*(fs|ps|ns|us|ms|s)$/i;
function unitSpec(spec) {
  if (!spec) return null;
  const m = UNIT_RE.exec(spec.trim());
  if (!m) return null;
  const mul = m[1] === "" ? 1 : Number(m[1]);
  const name = m[2].toLowerCase();
  return { fs: mul * FS_PER_UNIT[name], name };
}
function normalizeUnit(spec) {
  const u = unitSpec(spec);
  if (!u || !spec) return null;
  return u.fs === FS_PER_UNIT[u.name] ? u.name : spec.trim();
}
function timeUnitOf(timescale) {
  if (!timescale) return null;
  return normalizeUnit(timescale.split("/")[0]);
}
function simDisplayUnit(r) {
  return timeUnitOf(r.timescale) ?? r.tickUnit;
}
function simTimeValue(ticks, tickUnit, displayUnit) {
  const a = unitSpec(tickUnit);
  const b = unitSpec(displayUnit);
  if (!a || !b) return ticks;
  return Number((ticks * a.fs / b.fs).toPrecision(12));
}
function formatSimTime(ticks, tickUnit, displayUnit) {
  const convertible = unitSpec(displayUnit) !== null && unitSpec(tickUnit) !== null;
  const value = convertible ? simTimeValue(ticks, tickUnit, displayUnit) : ticks;
  const unit = convertible ? displayUnit : tickUnit;
  return unit ? `${value} ${unit}` : String(value);
}
function simFinishLabel(r) {
  return r.finishTime === null ? null : formatSimTime(r.finishTime, r.tickUnit, simDisplayUnit(r));
}
function busText(value, width) {
  if (/[xz]/i.test(value)) return "x";
  if (!/^[01]+$/.test(value)) return value;
  const v = value.length < width ? "0".repeat(width - value.length) + value : value;
  const bits = "0".repeat((4 - v.length % 4) % 4) + v;
  let out = "";
  for (let i = 0; i < bits.length; i += 4) out += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return out;
}
var RESET_NAME = /rst|reset/i;
function leafOf(name) {
  return name.split(".").pop() ?? name;
}
function sampleEvenly(arr, k) {
  if (k <= 0) return [];
  if (arr.length <= k) return arr.slice();
  if (k === 1) return [arr[0]];
  const out = [];
  for (let i = 0; i < k; i++) out.push(arr[Math.round(i * (arr.length - 1) / (k - 1))]);
  return out;
}
function pickColumns(signals, all, maxColumns) {
  if (all.length <= maxColumns) return all;
  const prio = /* @__PURE__ */ new Set([0]);
  for (const s of signals) {
    if (!RESET_NAME.test(leafOf(s.name))) continue;
    for (const c2 of s.changes) prio.add(c2.time);
  }
  if (prio.size >= maxColumns) return sampleEvenly([...prio].sort((a, b) => a - b), maxColumns);
  const others = all.filter((t) => !prio.has(t));
  return [...prio, ...sampleEvenly(others, maxColumns - prio.size)].sort((a, b) => a - b);
}
function toWaveSignals(signals, maxColumns = SIM_WAVE_COLUMNS) {
  const timeSet = /* @__PURE__ */ new Set([0]);
  for (const s of signals) for (const c2 of s.changes) timeSet.add(c2.time);
  const all = [...timeSet].sort((a, b) => a - b);
  const times = pickColumns(signals, all, maxColumns);
  const rows = signals.map((s) => {
    let idx = 0;
    let cur = "x";
    const chars = [];
    const values = [];
    for (const t of times) {
      while (idx < s.changes.length && s.changes[idx].time <= t) {
        cur = s.changes[idx].value;
        idx++;
      }
      const v = busText(cur, s.width);
      if (s.width === 1) chars.push(v === "1" ? "1" : v === "0" ? "0" : "x");
      else {
        chars.push(v === "x" ? "x" : "d");
        values.push(v);
      }
    }
    const leaf = leafOf(s.name);
    const row = { name: leaf, wave: chars.join(""), role: /^(clk|clock)$/i.test(leaf) ? "clock" : "output" };
    if (s.width > 1) row.values = values;
    return row;
  });
  return { steps: times.length, times, signals: rows, truncated: all.length > maxColumns, total: all.length };
}

// src/client/cards/HdlCard.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var TOOL10 = "dlogic_hdl";
function HdlCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MutedRow, { tool: TOOL10, title: t("hdl.title"), text: t("hdl.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["op"]);
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MutedRow, { tool: TOOL10, title: t("hdl.title"), text: `${t("hdl.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const args = parseArgs(argsRawOf(block));
  const value = readMeta(block, TOOL10);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Card, { tool: TOOL10, title: t("hdl.title"), summary: firstArgText(args, ["op"]), isError, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(MutedRow, { tool: TOOL10, title: t("hdl.title"), text: `${t("hdl.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const op = value.op;
  const title = op === "simulate" ? t("hdl.op.simulate") : t("hdl.op.lint");
  const code = typeof args.code === "string" ? args.code : null;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(TextBody, { text: resultText(block) });
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Card, { tool: TOOL10, title, summary: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Boundary, { fallback: null, children: summaryOf8(op, value.result, t) }), children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Boundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { children: [
    code !== null && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(CodeView, { code, marks: marksOf(op, value.result), t }),
    op === "simulate" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(SimBody, { r: value.result, t }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(LintBody, { r: value.result, t }),
    value.warnings.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step"), children: value.warnings.map((w, i) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("muted"), children: [
      t("hdl.warn"),
      "\uFF1A",
      w
    ] }, i)) })
  ] }) }) });
}
function summaryOf8(op, result, t) {
  if (result === null) return "";
  if (op === "simulate") {
    const r2 = result;
    const label = simFinishLabel(r2);
    return label !== null ? fmt(t, "hdl.summary.sim", { top: r2.top, t: label }) : fmt(t, "hdl.summary.simNoFinish", { top: r2.top });
  }
  const r = result;
  if (r.engine === "rules") return t("hdl.summary.rules");
  const e = r.issues.filter((i) => i.severity === "error").length;
  const w = r.issues.filter((i) => i.severity === "warning").length;
  return fmt(t, "hdl.summary.lint", { e, w, r: r.ruleHits.length });
}
function marksOf(op, result) {
  const marks = /* @__PURE__ */ new Map();
  if (op !== "lint" || result === null) return marks;
  const r = result;
  const add = (line, sev) => {
    if (line === null) return;
    const prev = marks.get(line);
    if (prev === void 0 || rank(sev) > rank(prev)) marks.set(line, sev);
  };
  for (const i of r.issues) add(i.line, i.severity);
  for (const h of r.ruleHits) add(h.line, h.severity);
  return marks;
}
function rank(s) {
  return s === "error" ? 2 : s === "warning" ? 1 : 0;
}
function CodeView({ code, marks, t }) {
  const lines = code.split(/\r?\n/);
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step-text"), children: t("hdl.code") }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("code"), children: lines.map((ln, i) => {
      const sev = marks.get(i + 1);
      const cls = sev === "error" ? ` ${c("code-error")}` : sev === "warning" ? ` ${c("code-warning")}` : "";
      return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: `${c("code-line")}${cls}`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: c("code-no"), children: i + 1 }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: ln === "" ? " " : ln })
      ] }, i);
    }) })
  ] });
}
function Row2({ label, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("line"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: c("line-label"), children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children })
  ] });
}
function sevLabel(s, t) {
  return s === "error" ? t("hdl.sev.error") : s === "warning" ? t("hdl.sev.warning") : t("hdl.sev.info");
}
function sevClass(s) {
  return s === "error" ? c("bad") : c("muted");
}
function LintBody({ r, t }) {
  const issues = [...r.issues].sort((a, b) => rank(b.severity) - rank(a.severity));
  const hits = r.ruleHits;
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      r.engine === "iverilog" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row2, { label: t("hdl.engine"), children: `iverilog ${r.iverilogVersion ?? ""}`.trim() }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row2, { label: t("hdl.engine"), children: t("hdl.summary.rules") }),
      r.notice && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: r.notice })
    ] }),
    issues.length === 0 && hits.length === 0 && r.engine === "iverilog" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: c("ok"), children: t("hdl.lint.none") }) }),
    issues.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step-text"), children: t("hdl.lint.issues") }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("ul", { className: c("list"), children: issues.map((i, k) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: c("id"), children: i.line === null ? "" : fmt(t, "hdl.line", { n: i.line }) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: sevClass(i.severity), children: sevLabel(i.severity, t) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: i.message })
      ] }, k)) })
    ] }),
    hits.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step-text"), children: t("hdl.lint.rules") }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("ul", { className: c("list"), children: hits.map((h, k) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("li", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: c("id"), children: fmt(t, "hdl.line", { n: h.line }) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { className: sevClass(h.severity), children: t(`hdl.rule.${h.rule}`) }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: h.message })
      ] }, k)) })
    ] })
  ] });
}
function SimBody({ r, t }) {
  const displayUnit = simDisplayUnit(r);
  const unit = displayUnit ?? "";
  const wave = toWaveSignals(r.signals);
  const times = wave.times.map((x) => simTimeValue(x, r.tickUnit, displayUnit));
  const endLabel = simFinishLabel(r) ?? (r.end === "timeout" ? formatSimTime(r.maxTimeUnits, displayUnit, displayUnit) : null);
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row2, { label: t("hdl.sim.timescale"), children: r.timescale ?? t("hdl.sim.noTimescale") }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row2, { label: t("hdl.sim.endTime"), children: endLabel ?? t("hdl.sim.noEndTime") }),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Row2, { label: t("hdl.sim.end"), children: t(`hdl.end.${r.end}`) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step-text"), children: t("hdl.sim.output") }),
      r.output.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("mono"), children: r.output.join("\n") }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: t("hdl.sim.noOutput") }),
      r.outputTruncated && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: t("hdl.end.output_limit") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("step-text"), children: t("hdl.sim.wave") }),
      r.signals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: t("hdl.sim.noVcd") }) : wave.signals.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: t("hdl.sim.noWave") }) : /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(Waveform, { signals: wave.signals, steps: wave.steps, times, unit, scrollable: true }),
      wave.truncated && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { className: c("muted"), children: fmt(t, "hdl.sim.waveTruncated", { n: wave.total, cols: wave.steps }) })
    ] })
  ] });
}

// src/client/cards/NumCard.tsx
var import_react8 = require("react");
var import_jsx_runtime18 = require("react/jsx-runtime");
function readNumValue(block) {
  const meta = block.meta;
  if (typeof meta !== "object" || meta === null) return null;
  const m = meta;
  if (m.tool !== "dlogic_num" || m.v !== 1) return null;
  const value = m.value;
  if (typeof value !== "object" || value === null || typeof value.ok !== "boolean") return null;
  return value;
}
function resultText2(block) {
  const parts = [];
  for (const item of block.content ?? []) parts.push(item.type === "text" ? item.text ?? "" : JSON.stringify(item));
  return parts.join("\n");
}
function parseArgs2(raw) {
  try {
    const v = JSON.parse(raw ?? "");
    return typeof v === "object" && v !== null ? v : {};
  } catch {
    return {};
  }
}
function Num({ value, base }) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
    "(",
    value,
    ")",
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("sub", { children: base })
  ] });
}
function Step({ step, to }) {
  let body = null;
  if (step.kind === "weighted-expansion") {
    body = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("mono"), children: `${(step.terms ?? []).join(" + ") || "0"} = ${step.result}` });
  } else if (step.kind === "expand-bits") {
    body = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("mono"), children: step.binary });
  } else if (step.kind === "group-bits") {
    const groups = [...step.intGroups ?? [], ...(step.fracGroups ?? []).length ? ["."] : [], ...step.fracGroups ?? []];
    body = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("groups"), children: groups.map(
      (g, i) => g === "." ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { children: "." }, i) : /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("group"), children: g }, i)
    ) });
  } else if (step.kind === "int-division") {
    body = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("table", { className: c("table"), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("tbody", { children: (step.rows ?? []).map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: `${row.dividend} \xF7 ${to}` }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: `= ${row.quotient}` }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: "\u4F59" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { className: c("digit"), children: row.digit })
    ] }, i)) }) });
  } else if (step.kind === "frac-multiplication") {
    body = /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("table", { className: c("table"), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("tbody", { children: (step.rows ?? []).map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: `${row.value} \xD7 ${to}` }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: `= ${row.product}` }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { children: "\u53D6\u6574" }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("td", { className: c("digit"), children: row.digit })
    ] }, i)) }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("step"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("step-text"), children: step.text }),
    body
  ] });
}
function NumBody({ r, steps, t, withHead = true }) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_jsx_runtime18.Fragment, { children: [
    withHead && /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("head"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Num, { value: r.input.value, base: r.input.from }),
      " = ",
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Num, { value: r.result, base: r.input.to })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("meta"), children: [fmt(t, "num.decimal", { value: r.decimal }), r.exact ? "" : `\uFF0C${fmt(t, "num.inexact", { precision: r.input.precision })}`].join("") }),
    steps.map((step, i) => /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Step, { step, to: r.input.to }, i))
  ] });
}
function NumCard(props) {
  const { t } = props;
  const [open, setOpen] = (0, import_react8.useState)(true);
  if (props.phase === "preparing") {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("card"), "data-tool": "dlogic_num", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("row"), "data-static": "", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("title"), children: t("num.preparing") }) }) });
  }
  const block = props.block;
  const settled = "kind" in block;
  const args = parseArgs2(settled ? block.call?.argsRaw : block.argsRaw);
  const head = args.value !== void 0 ? `${args.value} (${args.from} \u2192 ${args.to})` : "";
  if (!settled) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("card"), "data-tool": "dlogic_num", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("row"), "data-static": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("title"), children: t("num.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("dot") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("summary"), children: `${t("num.running")} ${head}` })
    ] }) });
  }
  const value = readNumValue(block);
  if (value === null || block.isError) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("card"), "data-tool": "dlogic_num", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("row"), onClick: () => setOpen((v) => !v), children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("title"), children: t("num.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("dot") }),
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: `${c("summary")} ${block.isError ? c("error") : ""}`, children: head })
      ] }),
      open && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("body"), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("mono"), children: resultText2(block) }) }) })
    ] });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("card"), "data-tool": "dlogic_num", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("row"), "data-static": "", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("title"), children: t("num.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("dot") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: `${c("summary")} ${c("error")}`, children: `${t("num.failed")}\uFF1A${value.error}` })
    ] }) });
  }
  const r = value.result;
  const steps = value.steps ?? [];
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("card"), "data-tool": "dlogic_num", children: [
    /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("div", { className: c("row"), onClick: () => setOpen((v) => !v), children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("title"), children: t("num.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("span", { className: c("dot") }),
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)("span", { className: c("summary"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Num, { value: r.input.value, base: r.input.from }),
        " = ",
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(Num, { value: r.result, base: r.input.to })
      ] })
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime18.jsx)("div", { className: c("body"), children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(NumBody, { r, steps, t }) })
  ] });
}

// src/client/cards/VerifyCard.tsx
var import_jsx_runtime19 = require("react/jsx-runtime");
var TOOL11 = "dlogic_verify";
function Verdict2({ ok, text }) {
  const cls = ok === false ? `${c("verdict")} ${c("verdict-bad")}` : c("verdict");
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: cls, children: text });
}
function VerifyCard({ t, phase, block }) {
  if (phase === "preparing") return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MutedRow, { tool: TOOL11, title: t("verify.title"), text: t("verify.preparing") });
  if (!isSettled(block)) {
    const hint = firstArgText(parseArgs(argsRawOf(block)), ["candidate", "expression", "expr"]);
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MutedRow, { tool: TOOL11, title: t("verify.title"), text: `${t("verify.running")} ${hint}`.trim() });
  }
  const isError = block.isError === true;
  const value = readMeta(block, TOOL11);
  if (isError || value === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Card, { tool: TOOL11, title: t("verify.title"), summary: "", isError, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(TextBody, { text: resultText(block) }) });
  }
  if (!value.ok) {
    return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(MutedRow, { tool: TOOL11, title: t("verify.title"), text: `${t("verify.failed")}\uFF1A${value.error ?? ""}`, isError: true });
  }
  const v = value.result;
  const eqText = v.equivalent ? t("verify.equivalent") : t("verify.notEquivalent");
  const minimalText = v.minimal === void 0 ? "" : v.minimal === true ? t("verify.minimal") : v.minimal === false ? t("verify.notMinimal") : t("verify.unknown");
  const summary = /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Boundary, { fallback: null, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_jsx_runtime19.Fragment, { children: [
    eqText,
    minimalText ? " \xB7 " + minimalText : ""
  ] }) });
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Card, { tool: TOOL11, title: t("verify.title"), summary, isError: false, children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Boundary, { fallback: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(TextBody, { text: resultText(block) }), children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(VerifyBody, { v, t }) }) });
}
function VerifyBody({ v, t }) {
  const variables = v.variables ?? [];
  const ce = v.counterexample;
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: c("step"), children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("chips"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Verdict2, { ok: v.equivalent, text: v.equivalent ? t("verify.equivalent") : t("verify.notEquivalent") }),
      v.minimal !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(
        Verdict2,
        {
          ok: v.minimal === null ? null : v.minimal,
          text: v.minimal === true ? t("verify.minimal") : v.minimal === false ? t("verify.notMinimal") : t("verify.unknown")
        }
      )
    ] }) }),
    !v.equivalent && ce && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: c("step-text"), children: t("verify.counter") }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: c("tt-wrap"), children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("table", { className: c("tt"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("tr", { children: [
          variables.map((name) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("th", { children: name }, name)),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("th", { children: t("verify.leftOut") }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("th", { children: t("verify.rightOut") })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("tbody", { children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("tr", { children: [
          ce.inputs.map((b, i) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("td", { children: b }, i)),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("td", { className: c("tt-out"), children: ce.left }),
          /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("td", { className: c("tt-out"), children: ce.right })
        ] }) })
      ] }) })
    ] }),
    (v.candidateCost || v.minimalCost) && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("step"), children: [
      v.candidateCost && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: c("line-label"), children: t("verify.candidate") }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { children: fmt(t, "verify.cost", { terms: v.candidateCost.terms, literals: v.candidateCost.literals }) })
      ] }),
      v.minimalCost && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("line"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { className: c("line-label"), children: t("verify.minimalCost") }),
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("span", { children: fmt(t, "verify.cost", { terms: v.minimalCost.terms, literals: v.minimalCost.literals }) })
      ] })
    ] }),
    v.reference && Array.isArray(v.reference.texts) && v.reference.texts.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)("div", { className: c("step"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: c("step-text"), children: t("verify.reference") }),
      v.reference.texts.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime19.jsx)("div", { className: c("line"), children: /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(Expr, { text: s, variables }) }, i))
    ] })
  ] });
}

// src/client/sidechat/api.ts
var impl = async () => ({ ok: false, error: "\u8FFD\u95EE\u529F\u80FD\u5C1A\u672A\u5C31\u7EEA" });
function setAskFollowupImpl(next) {
  impl = next;
}
var askFollowup = (sessionId, card, index, tree) => impl(sessionId, card, index, tree);

// src/client/figures/definition.ts
var FIGURES_EVENT_KIND = "dlogic-figures";
var FIGURES_LOCATION_KEY = FIGURES_EVENT_KIND;
function isDlogicToolMeta(meta) {
  if (typeof meta !== "object" || meta === null) return false;
  const m = meta;
  return m.v === 1 && typeof m.tool === "string" && m.tool.startsWith("dlogic_");
}
function figuresMatch(event) {
  if (event.type === "turn/start") {
    return { id: String(event.data.turn), role: "start", event };
  }
  if (event.type === "tool/result") {
    if (event.data.message?.isError === true) return null;
    if (!isDlogicToolMeta(event.data.meta)) return null;
    return { id: String(event.data.turn), role: "update", event };
  }
  return null;
}
function figuresStart(_context, match) {
  return { turn: match.event.data.turn, items: [] };
}
function figuresUpdate(context, match) {
  const state = context.state;
  if (state === void 0) return state;
  const event = match.event;
  if (String(state.turn) !== String(event.data.turn)) return state;
  const callId = typeof event.data.message?.source?.callId === "string" ? event.data.message.source.callId : "";
  if (callId !== "" && state.items.some((item) => item.callId === callId)) return state;
  return {
    ...state,
    items: [...state.items, { seq: event.seq, callId, meta: event.data.meta }]
  };
}
function figuresBuildLocationData(context, scope, previous) {
  if (scope !== "turn" || context.state === void 0) return null;
  const state = context.state;
  if (previous?.kind === "turn" && previous.turn === state.turn && previous.key === FIGURES_LOCATION_KEY && previous.value?.items === state.items) {
    return previous;
  }
  return { kind: "turn", turn: state.turn, key: FIGURES_LOCATION_KEY, value: { items: state.items } };
}
var figuresEventDefinition = {
  kind: FIGURES_EVENT_KIND,
  match: figuresMatch,
  start: figuresStart,
  update: figuresUpdate,
  buildLocationData: figuresBuildLocationData
};

// src/client/figures/FiguresTail.tsx
var import_react9 = require("react");

// src/client/figures/select.ts
var FIGURE_OPS = [
  "kmap",
  "truth_table",
  "hazard",
  "gate_form",
  "canonical",
  "equivalent",
  "complement",
  "dual",
  "parse",
  "minimize"
];
var MAX_FIGURES = 4;
var VISIBLE_FIGURES = 3;
var BOOL_TOOL = "dlogic_bool";
var NUM_TOOL = "dlogic_num";
var VERIFY_TOOL = "dlogic_verify";
var CARD_TOOL = "dlogic_card";
var HDL_TOOL = "dlogic_hdl";
var PROGRAM_TOOLS = ["dlogic_comb", "dlogic_seq", "dlogic_fsm", "dlogic_mem", "dlogic_adda", "dlogic_system"];
function specKeyOf(result) {
  if (typeof result !== "object" || result === null) return "";
  const r = result;
  if ("spec" in r) return JSON.stringify(r.spec);
  if ("left" in r) return JSON.stringify({ left: r.left, right: r.right });
  if ("input" in r) return JSON.stringify(r.input);
  return JSON.stringify(r);
}
function toVerdict(v) {
  return {
    equivalent: v.equivalent === true,
    minimal: v.minimal,
    counterexample: v.counterexample,
    variables: Array.isArray(v.variables) ? v.variables : []
  };
}
function isCard(v) {
  return !!v && typeof v.nodeId === "string" && Array.isArray(v.followups);
}
function selectFigures(items, maxSeq) {
  const ordered = items.filter((item) => maxSeq === void 0 || item.seq <= maxSeq).slice().sort((a, b) => a.seq - b.seq);
  const candidates = [];
  let verdict = null;
  let card = null;
  for (const item of ordered) {
    const bool = readMeta(item, BOOL_TOOL);
    if (bool) {
      if (bool.ok && FIGURE_OPS.includes(bool.op)) {
        const specKey = specKeyOf(bool.result);
        candidates.push({
          tool: BOOL_TOOL,
          op: bool.op,
          key: `${BOOL_TOOL}|${bool.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: bool.result,
          steps: []
        });
      }
      continue;
    }
    const num = readMeta(item, NUM_TOOL);
    if (num) {
      if (num.ok) {
        const specKey = specKeyOf(num.result);
        candidates.push({
          tool: NUM_TOOL,
          op: num.op,
          key: `${NUM_TOOL}|${num.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: num.result,
          steps: num.steps
        });
      }
      continue;
    }
    const hdl = readMeta(item, HDL_TOOL);
    if (hdl) {
      if (hdl.ok && (hdl.op === "simulate" || hdl.op === "lint")) {
        candidates.push({
          tool: HDL_TOOL,
          op: hdl.op,
          key: `${HDL_TOOL}|${hdl.op}`,
          specKey: "",
          seq: item.seq,
          result: hdl.result,
          steps: []
        });
      }
      continue;
    }
    let program = false;
    for (const tool of PROGRAM_TOOLS) {
      const env = readMeta(item, tool);
      if (!env) continue;
      program = true;
      if (env.ok) {
        const specKey = specKeyOf(env.result);
        candidates.push({
          tool,
          op: env.op,
          key: `${tool}|${env.op}|${specKey}`,
          specKey,
          seq: item.seq,
          result: env.result,
          steps: []
        });
      }
      break;
    }
    if (program) continue;
    const verify = readMeta(item, VERIFY_TOOL);
    if (verify) {
      if (verify.ok && verify.result) verdict = toVerdict(verify.result);
      continue;
    }
    const cardEnv = readMeta(item, CARD_TOOL);
    if (cardEnv) {
      if (cardEnv.ok && isCard(cardEnv.result)) card = cardEnv.result;
      continue;
    }
  }
  const kmapSpecs = new Set(candidates.filter((f) => f.tool === BOOL_TOOL && f.op === "kmap").map((f) => f.specKey));
  const lastIndex = /* @__PURE__ */ new Map();
  candidates.forEach((f, i) => lastIndex.set(f.key, i));
  const kept = candidates.filter(
    (f, i) => lastIndex.get(f.key) === i && !(f.tool === BOOL_TOOL && f.op === "minimize" && kmapSpecs.has(f.specKey))
  );
  const many = kept.length > MAX_FIGURES;
  return {
    figures: many ? kept.slice(0, VISIBLE_FIGURES) : kept,
    hidden: many ? kept.slice(VISIBLE_FIGURES) : [],
    verdict,
    card: isCard(card) ? card : null
  };
}

// src/client/figures/styles.ts
var FIG_PREFIX = "dlf";
var fc = (name) => `${FIG_PREFIX}-${name}`;
var figuresCss = `
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
`;
var STYLE_TAG_ID2 = "dsh-digital-logic-studio/figures.css";
function injectFigureStyles() {
  if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID2) + "]") === null) {
    const tag = document.createElement("style");
    tag.dataset.plugin = "dsh-digital-logic-studio";
    tag.dataset.pluginCss = STYLE_TAG_ID2;
    tag.textContent = figuresCss;
    document.head.appendChild(tag);
  }
}

// src/client/figures/FiguresTail.tsx
var import_jsx_runtime20 = require("react/jsx-runtime");
var NO_PROJECTION2 = () => void 0;
function readItems(stored) {
  if (!isObj(stored) || !Array.isArray(stored.items)) return [];
  const out = [];
  for (const it of stored.items) {
    if (isObj(it) && typeof it.seq === "number") {
      out.push({ seq: it.seq, callId: typeof it.callId === "string" ? it.callId : "", meta: it.meta });
    }
  }
  return out;
}
function captionKeyOf(f) {
  switch (f.tool) {
    case "dlogic_num":
      return "figures.cap.convert";
    case "dlogic_comb":
      return "figures.cap.comb";
    case "dlogic_seq":
      return "figures.cap.seq";
    case "dlogic_fsm":
      return "figures.cap.fsm";
    case "dlogic_mem":
      return "figures.cap.mem";
    case "dlogic_adda":
      return "figures.cap.adda";
    case "dlogic_system":
      return "figures.cap.system";
    case "dlogic_hdl":
      return f.op === "simulate" ? "figures.cap.simulate" : "figures.cap.lint";
    default:
      return `figures.cap.${f.op}`;
  }
}
function FigureBody({ f, t }) {
  switch (f.tool) {
    case "dlogic_num":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(NumBody, { r: f.result, steps: f.steps, t });
    case "dlogic_comb":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(CombBody, { op: f.op, r: f.result, t });
    case "dlogic_seq":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SeqBody, { op: f.op, r: f.result, t });
    case "dlogic_fsm":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FsmBody, { op: f.op, r: f.result, t });
    case "dlogic_mem":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(MemBody, { op: f.op, r: f.result, t });
    case "dlogic_adda":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(AddaBody, { op: f.op, r: f.result, t });
    case "dlogic_system":
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SystemBody, { op: f.op, r: f.result, t });
    case "dlogic_hdl":
      return f.op === "simulate" ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(SimBody, { r: f.result, t }) : /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(LintBody, { r: f.result, t });
    default:
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(OpBody, { op: f.op, r: f.result, t, fallbackText: "" });
  }
}
function FigureCell({ figure, t }) {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: fc("fig"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("cap"), children: t(captionKeyOf(figure)) }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("body"), children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Boundary, { fallback: null, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FigureBody, { f: figure, t }) }) })
  ] });
}
function VerdictView({ v, t }) {
  const parts = [v.equivalent ? t("verify.equivalent") : t("verify.notEquivalent")];
  if (v.equivalent && v.minimal !== void 0) {
    parts.push(v.minimal === true ? t("verify.minimal") : v.minimal === false ? t("verify.notMinimal") : t("verify.unknown"));
  }
  const ce = v.equivalent ? void 0 : v.counterexample;
  let ceText = "";
  if (ce) {
    const assign = v.variables.map((name, i) => `${name}=${ce.inputs[i] ?? ""}`).join(" ") || ce.inputs.join("");
    ceText = `${t("verify.counter")} ${assign} \xB7 ${t("verify.leftOut")} ${ce.left} / ${t("verify.rightOut")} ${ce.right}`;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: v.equivalent ? fc("verdict") : `${fc("verdict")} ${fc("verdict-bad")}`, children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { children: parts.join(" \xB7 ") }),
    ceText && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: fc("verdict-ce"), children: ceText })
  ] });
}
function FollowupRow({
  card,
  tree,
  ask,
  t
}) {
  const [pending, setPending] = (0, import_react9.useState)(null);
  const [sent, setSent] = (0, import_react9.useState)([]);
  const [err, setErr] = (0, import_react9.useState)(null);
  const expanded = /* @__PURE__ */ new Set();
  if (tree && Array.isArray(tree.nodes)) {
    for (const n of tree.nodes) {
      if (n.parentId === card.nodeId && typeof n.parentFollowup === "number") expanded.add(n.parentFollowup);
    }
  }
  const onAsk = async (index) => {
    if (pending !== null) return;
    if (!ask) {
      setErr(t("figures.askUnavailable"));
      return;
    }
    setPending(index);
    setErr(null);
    try {
      const r = await ask(card, index, tree);
      if (r && r.ok) setSent((prev) => prev.includes(index) ? prev : [...prev, index]);
      else setErr(r?.error || t("figures.askFailed"));
    } catch {
      setErr(t("figures.askFailed"));
    } finally {
      setPending(null);
    }
  };
  const showNote = pending !== null || sent.length > 0;
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: fc("fu"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("fu-title"), children: t("figures.followups") }),
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("chips"), children: card.followups.map((f, i) => {
      if (!f || typeof f.question !== "string") return null;
      const done = expanded.has(i);
      const isSent = sent.includes(i);
      return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(
        "button",
        {
          type: "button",
          className: fc("chip"),
          title: f.why,
          disabled: pending !== null || done || isSent,
          onClick: () => void onAsk(i),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: fc("chip-angle"), children: t(angleLabelKey(f.angle)) }),
            /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: fc("chip-q"), children: f.question }),
            done && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("span", { className: fc("chip-status"), children: t("figures.expanded") })
          ]
        },
        i
      );
    }) }),
    showNote && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("note"), children: t("figures.sent") }),
    err && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("err"), children: err })
  ] });
}
function FiguresBody(props) {
  const { turn, seq, t, ask, useProjection } = props;
  const [showAll, setShowAll] = (0, import_react9.useState)(false);
  const project = useProjection ?? NO_PROJECTION2;
  const tree = project(TREE_PROJECTION_KEY);
  const stored = turn?.data?.get?.(FIGURES_LOCATION_KEY);
  const sel = selectFigures(readItems(stored), seq);
  const card = sel.card && sel.card.followups.length > 0 ? sel.card : null;
  const nothing = sel.figures.length === 0 && sel.hidden.length === 0 && !sel.verdict && !card;
  if (nothing) return null;
  const shown = showAll ? [...sel.figures, ...sel.hidden] : sel.figures;
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)("div", { className: fc("wrap"), children: [
    shown.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("div", { className: fc("grid"), children: shown.map((f) => /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FigureCell, { figure: f, t }, f.key)) }),
    sel.hidden.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)("button", { type: "button", className: fc("btn"), onClick: () => setShowAll((v) => !v), children: showAll ? t("figures.less") : fmt(t, "figures.more", { n: sel.hidden.length }) }),
    sel.verdict && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(VerdictView, { v: sel.verdict, t }),
    card && /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FollowupRow, { card, tree, ask, t })
  ] });
}
function FiguresTail(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(Boundary, { fallback: null, children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(FiguresBody, { ...props }) });
}

// src/client/figures/locale.ts
var FIGURES_NS = "dlogicFigures";
var figZh = {
  "figures.cap.kmap": "\u5361\u8BFA\u56FE",
  "figures.cap.truth_table": "\u771F\u503C\u8868",
  "figures.cap.minimize": "\u5316\u7B80\u7ED3\u679C",
  "figures.cap.hazard": "\u9669\u8C61\u5206\u6790",
  "figures.cap.canonical": "\u6807\u51C6\u5F62\u5F0F",
  "figures.cap.equivalent": "\u7B49\u4EF7\u5224\u65AD",
  "figures.cap.complement": "\u6C42\u53CD",
  "figures.cap.dual": "\u5BF9\u5076\u5F0F",
  "figures.cap.gate_form": "\u95E8\u7535\u8DEF\u5F62\u5F0F",
  "figures.cap.parse": "\u89E3\u6790",
  "figures.cap.convert": "\u8FDB\u5236\u8F6C\u6362",
  "figures.cap.comb": "\u7EC4\u5408\u903B\u8F91",
  "figures.cap.mem": "\u5B58\u50A8\u4E0E\u53EF\u7F16\u7A0B\u903B\u8F91",
  "figures.cap.adda": "A/D \u4E0E D/A",
  "figures.cap.system": "\u6570\u5B57\u7CFB\u7EDF",
  "figures.cap.seq": "\u65F6\u5E8F\u903B\u8F91",
  "figures.cap.fsm": "\u6709\u9650\u72B6\u6001\u673A",
  "figures.cap.simulate": "Verilog \u4EFF\u771F",
  "figures.cap.lint": "Verilog \u9759\u6001\u68C0\u67E5",
  "figures.more": "\u5C55\u5F00\u5176\u4F59 {n} \u4E2A",
  "figures.less": "\u6536\u8D77",
  "figures.followups": "\u7EE7\u7EED\u8FFD\u95EE",
  "figures.sent": "\u5DF2\u53D1\u9001\u5230\u4FA7\u8FB9\u8FFD\u95EE",
  "figures.expanded": "\u5DF2\u5C55\u5F00",
  "figures.askFailed": "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002",
  "figures.askUnavailable": "\u5F53\u524D\u65E0\u6CD5\u53D1\u9001\u8FFD\u95EE\u3002"
};
var figuresZh = { ...zh8, ...figZh };
var figuresEn = figuresZh;

// src/client/figures/register.ts
var FIGURES_SLOT_ID = "dsh-digital-logic-studio/figures";
function registerFigures(ctx) {
  ctx.effect(() => ctx.locale.register(FIGURES_NS, { zh: figuresZh, en: figuresEn }), "dlogic-figures: dictionaries");
  ctx.effect(() => injectFigureStyles(), "dlogic-figures: styles");
  ctx.effect(() => ctx.uiConversation.events.register(figuresEventDefinition), "dlogic-figures: conversation events");
  ctx.slots.inject(
    "conversation.chat.turnTail",
    () => ctx.slots.register(
      {
        name: "conversation.chat.turnTail",
        id: FIGURES_SLOT_ID,
        locale: FIGURES_NS,
        inject: (sessionId) => ({
          ask: (card, index, tree) => askFollowup(sessionId, card, index, tree)
        })
      },
      FiguresTail
    )
  );
}

// src/shared/sidechat.ts
var FOLLOWUP_COMMAND = "dlogic-ask";
var FOLLOWUP_CHILD_LABEL = "\u6570\u5B57\u903B\u8F91\u8FFD\u95EE";
function buildFollowupPrompt(c2) {
  const lines = [
    followupPrefix(c2.parentNodeId, c2.followupIndex) + c2.question,
    "",
    "\u3010\u80CC\u666F\u3011\u8FD9\u662F\u4E3B\u5BF9\u8BDD\u5B66\u4E60\u6811\u4E0A\u7684\u8FFD\u95EE\u3002\u4E3B\u5BF9\u8BDD\u4E2D\u7684\u76F8\u5173\u5361\u7247\u5982\u4E0B\uFF08\u4ECE\u6839\u5230\u5F53\u524D\uFF09\uFF1A",
    ...c2.path.map((n, i) => `${i + 1}. ${n.title}\uFF1A${n.summary}\uFF08\u77E5\u8BC6\u70B9 ${n.knowledgeIds.join("\u3001") || "\u65E0"}\uFF1B\u5361\u7247 ${n.nodeId}\uFF09`),
    "",
    `\u3010\u8981\u6C42\u3011\u6309 digital-logic-tutor \u6280\u80FD\u53EA\u56DE\u7B54\u4E0A\u9762\u8FD9\u4E00\u4E2A\u8FFD\u95EE\uFF1B\u56DE\u7B54\u7ED3\u675F\u65F6\u8C03\u7528 dlogic_card\uFF0CparentId \u4E3A ${c2.parentNodeId}\uFF0CparentFollowup \u4E3A ${c2.followupIndex}\u3002`
  ];
  return lines.join("\n");
}

// src/client/sidechat/context.ts
var PATH_CAP = 6;
function buildContextPath(tree, card, cap = PATH_CAP) {
  const byId = /* @__PURE__ */ new Map();
  for (const n of tree?.nodes ?? []) byId.set(n.nodeId, n);
  const chain = [card];
  const seen = /* @__PURE__ */ new Set([card.nodeId]);
  let cur = card;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    cur = byId.get(cur.parentId);
    seen.add(cur.nodeId);
    chain.unshift(cur);
  }
  const kept = chain.slice(-Math.max(1, cap));
  return kept.map((n) => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: n.knowledgeIds }));
}
function selectAllFollowupChildren(snapshot, parentId) {
  if (!snapshot || !parentId) return [];
  const group = snapshot.subagentsByParent?.[parentId];
  const projected = snapshot.projectionsBySession?.[parentId]?.values?.subagentCatalog;
  const entries = Array.isArray(group?.entries) ? group.entries : Array.isArray(projected) ? projected : [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const e of entries) {
    if (!e || e.kind !== void 0 && e.kind !== "child" || e.mode !== "continuable" || typeof e.id !== "string") continue;
    const label = e.label ?? snapshot.byId?.[e.id]?.projectionValues?.subagent?.label;
    if (label !== FOLLOWUP_CHILD_LABEL || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e.id);
  }
  return out;
}

// src/shared/ask.ts
var ASK_LLM_COMMAND = "dlogic-ask-llm";
var MAX_ASK_FOLLOWUPS = 3;
var ASK_FOLLOWUP_QUESTION_MAX = 30;
var ASK_FOLLOWUP_WHY_MAX = 40;
var FOLLOWUP_ANGLES = [
  "principle",
  "variant",
  "pitfall",
  "prerequisite",
  "verify",
  "practice",
  "free"
];
var ANGLE_ALIASES = {
  \u539F\u7406: "principle",
  \u53D8\u5F0F: "variant",
  \u6613\u9519: "pitfall",
  \u524D\u7F6E: "prerequisite",
  \u9A8C\u8BC1: "verify",
  \u7EC3\u4E60: "practice",
  \u5EF6\u4F38: "free"
};
function clipChars(text, max) {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "\u2026" : text;
}
function angleOf(raw) {
  if (typeof raw !== "string") return "free";
  const trimmed = raw.replace(/[()（）[\]【】*_`]/g, "").trim();
  const key = trimmed.toLowerCase();
  if (FOLLOWUP_ANGLES.includes(key)) return key;
  return ANGLE_ALIASES[trimmed] ?? "free";
}
function sanitizeFollowups(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of raw) {
    let question;
    let angle;
    let why;
    if (typeof item === "string") question = item;
    else if (typeof item === "object" && item !== null) {
      const o = item;
      question = o.question;
      angle = o.angle;
      why = o.why;
    } else continue;
    if (typeof question !== "string") continue;
    const q = clipChars(question.replace(/\s+/g, " ").trim(), ASK_FOLLOWUP_QUESTION_MAX);
    if (q === "" || seen.has(q)) continue;
    seen.add(q);
    const w = typeof why === "string" ? clipChars(why.replace(/\s+/g, " ").trim(), ASK_FOLLOWUP_WHY_MAX) : "";
    out.push({ question: q, angle: angleOf(angle), why: w });
    if (out.length >= MAX_ASK_FOLLOWUPS) break;
  }
  return out;
}
function isFollowupMark(line) {
  const core = line.replace(/[*_`#>[\]【】]/g, "").trim();
  return /^追问\s*[：:]?$/.test(core);
}
var LIST_PREFIX = /^(?:[-–—·•*●]|\d+\s*[.、)）])\s*/;
var FIELD_SEP = /\s*[|｜]\s*/;
function parseFollowupLine(raw) {
  let line = raw.trim().replace(LIST_PREFIX, "").replace(/\*\*/g, "").trim();
  if (line === "" || /^[\s\-–—_=~*]+$/.test(line)) return null;
  if (!FIELD_SEP.test(line)) return { question: line, angle: "free", why: "" };
  const [question, angle, ...rest] = line.split(FIELD_SEP);
  return { question: question ?? "", angle: angleOf(angle), why: rest.join(" ") };
}
function parseAskAnswer(text) {
  try {
    const source = String(text ?? "");
    const whole = source.trim();
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    let mark = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (isFollowupMark(lines[i].trim())) {
        mark = i;
        break;
      }
    }
    if (mark < 0) return { answer: whole, followups: [] };
    const followups = sanitizeFollowups(
      lines.slice(mark + 1).map(parseFollowupLine).filter((x) => x !== null)
    );
    const answer = lines.slice(0, mark).join("\n").trim();
    if (followups.length === 0 || answer === "") return { answer: whole, followups: [] };
    return { answer, followups };
  } catch {
    return { answer: String(text ?? "").trim(), followups: [] };
  }
}

// src/client/ask/api.ts
var FAIL_TEXT = "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002";
var GATEWAY_MESSAGE_MAX = 80;
var remote;
function setAskLlmRemote(next) {
  remote = next;
}
function isObj2(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function clip(text, max) {
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max).join("") + "\u2026" : text;
}
function gatewayError(err) {
  const message = isObj2(err) && typeof err.message === "string" ? err.message : typeof err === "string" ? err : "";
  const trimmed = message.trim();
  if (trimmed === "" || !/[一-鿿]/.test(trimmed)) return FAIL_TEXT;
  return `\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF1A${clip(trimmed, GATEWAY_MESSAGE_MAX)}`;
}
function readResult(r) {
  const resp = isObj2(r) ? r : void 0;
  if (resp && resp.ok === false) {
    console.warn("[dlogic] ask-llm gateway error response:", r);
    return { ok: false, error: gatewayError(resp.error) };
  }
  const value = resp && isObj2(resp.value) ? resp.value : void 0;
  const result = value && isObj2(value.result) ? value.result : void 0;
  if (!result) {
    console.warn("[dlogic] ask-llm unexpected response:", r);
    return { ok: false, error: FAIL_TEXT };
  }
  const text = typeof result.text === "string" ? result.text : "";
  if (result.kind === "success" && text.trim() !== "") {
    const parsed = parseAskAnswer(text.trim());
    const extra = sanitizeFollowups(result.followups);
    return { ok: true, text: parsed.answer, followups: extra.length > 0 ? extra : parsed.followups };
  }
  if (text.trim() === "") console.warn("[dlogic] ask-llm failed without text:", r);
  return { ok: false, error: text.trim() !== "" ? text.trim() : FAIL_TEXT };
}
async function askFollowupLlm(sessionId, path, question, onChunk) {
  if (!remote || !sessionId) return { ok: false, error: "\u8FFD\u95EE\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA" };
  const input = {
    v: 1,
    path: path.map((n) => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: [...n.knowledgeIds] })),
    question
  };
  try {
    const r = await remote(sessionId, `/${ASK_LLM_COMMAND} ${JSON.stringify(input)}`);
    const result = readResult(r);
    if (result.ok) onChunk?.(result.text);
    return result;
  } catch (error) {
    console.warn("[dlogic] ask-llm command failed:", error);
    return { ok: false, error: FAIL_TEXT };
  }
}

// skills/digital-logic-tutor/references/knowledge-map.json
var knowledge_map_default = [
  { id: "k1", title: "\u7B2C1\u7AE0 \u5F00\u5173\u7406\u8BBA\u57FA\u7840", chapter: 1, prereqs: [], related: [], keywords: ["\u5F00\u5173\u7406\u8BBA", "\u6570\u5236", "\u903B\u8F91\u4EE3\u6570"] },
  { id: "k1.1", title: "\u4E8C\u8FDB\u5236\u7CFB\u7EDF", chapter: 1, prereqs: [], related: [], keywords: ["\u4E8C\u8FDB\u5236", "\u6570\u5B57\u7CFB\u7EDF", "\u79BB\u6563\u91CF"] },
  { id: "k1.1.1", title: "\u8FDE\u7EED\u91CF\u548C\u79BB\u6563\u91CF", chapter: 1, prereqs: [], related: [], keywords: ["\u6A21\u62DF\u91CF", "\u6570\u5B57\u91CF", "\u8FDE\u7EED\u91CF", "\u79BB\u6563\u91CF"] },
  { id: "k1.1.2", title: "\u5F00\u5173\u91CF", chapter: 1, prereqs: ["k1.1.1"], related: [], keywords: ["\u5F00\u5173\u91CF", "\u9AD8\u4F4E\u7535\u5E73", "\u4E8C\u503C\u903B\u8F91", "0\u548C1"] },
  { id: "k1.1.3", title: "\u6570\u5B57\u6CE2\u5F62", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["\u6570\u5B57\u6CE2\u5F62", "\u65F6\u5E8F\u56FE", "\u8109\u51B2", "\u4E0A\u5347\u6CBF"] },
  { id: "k1.2", title: "\u6570\u5236\u4E0E\u7801\u5236", chapter: 1, prereqs: ["k1.1"], related: [], keywords: ["\u6570\u5236", "\u7801\u5236", "\u8FDB\u5236"] },
  { id: "k1.2.1", title: "\u8FDB\u4F4D\u8BA1\u6570\u5236", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["\u5341\u8FDB\u5236", "\u4E8C\u8FDB\u5236", "\u516B\u8FDB\u5236", "\u5341\u516D\u8FDB\u5236", "\u4F4D\u6743"] },
  { id: "k1.2.2", title: "\u8FDB\u4F4D\u8BA1\u6570\u5236\u7684\u76F8\u4E92\u8F6C\u6362", chapter: 1, prereqs: ["k1.2.1"], related: [], keywords: ["\u8FDB\u5236\u8F6C\u6362", "\u6309\u6743\u5C55\u5F00", "\u9664\u57FA\u53D6\u4F59", "\u5C0F\u6570\u8F6C\u6362"] },
  { id: "k1.2.3", title: "\u4E8C\u8FDB\u5236\u7F16\u7801", chapter: 1, prereqs: ["k1.2.1"], related: [], keywords: ["BCD\u7801", "8421\u7801", "\u683C\u96F7\u7801", "\u4E8C\u8FDB\u5236\u7F16\u7801"] },
  { id: "k1.3", title: "\u903B\u8F91\u51FD\u6570\u53CA\u5176\u63CF\u8FF0\u5DE5\u5177", chapter: 1, prereqs: ["k1.2"], related: [], keywords: ["\u903B\u8F91\u51FD\u6570", "\u771F\u503C\u8868", "\u903B\u8F91\u8868\u8FBE\u5F0F"] },
  { id: "k1.3.1", title: "\u903B\u8F91\u51FD\u6570\u7684\u57FA\u672C\u6982\u5FF5", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["\u903B\u8F91\u51FD\u6570", "\u903B\u8F91\u53D8\u91CF", "\u81EA\u53D8\u91CF", "\u56E0\u53D8\u91CF"] },
  { id: "k1.3.2", title: "\u903B\u8F91\u51FD\u6570\u7684\u63CF\u8FF0\u5DE5\u5177", chapter: 1, prereqs: ["k1.3.1"], related: [], keywords: ["\u771F\u503C\u8868", "\u903B\u8F91\u8868\u8FBE\u5F0F", "\u903B\u8F91\u56FE", "\u6700\u5C0F\u9879"] },
  { id: "k1.3.3", title: "\u57FA\u672C\u903B\u8F91\u8FD0\u7B97", chapter: 1, prereqs: ["k1.3.1"], related: [], keywords: ["\u4E0E\u8FD0\u7B97", "\u6216\u8FD0\u7B97", "\u975E\u8FD0\u7B97", "\u4E0E\u975E", "\u6216\u975E", "\u5F02\u6216"] },
  { id: "k1.3.4", title: "\u6B63\u903B\u8F91\u3001\u8D1F\u903B\u8F91\u3001\u4E09\u6001\u95E8", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["\u6B63\u903B\u8F91", "\u8D1F\u903B\u8F91", "\u4E09\u6001\u95E8", "\u9AD8\u963B\u6001"] },
  { id: "k1.4", title: "\u5E03\u5C14\u4EE3\u6570", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["\u5E03\u5C14\u4EE3\u6570", "\u903B\u8F91\u4EE3\u6570", "\u4EE3\u6570\u5316\u7B80"] },
  { id: "k1.4.1", title: "\u5E03\u5C14\u4EE3\u6570\u7684\u57FA\u672C\u5B9A\u5F8B", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["\u4EA4\u6362\u5F8B", "\u7ED3\u5408\u5F8B", "\u5206\u914D\u5F8B", "\u6469\u6839\u5B9A\u5F8B", "\u5438\u6536\u5F8B"] },
  { id: "k1.4.2", title: "\u5E03\u5C14\u4EE3\u6570\u8FD0\u7B97\u7684\u57FA\u672C\u89C4\u5219", chapter: 1, prereqs: ["k1.4.1"], related: [], keywords: ["\u4EE3\u5165\u89C4\u5219", "\u53CD\u6F14\u89C4\u5219", "\u5BF9\u5076\u89C4\u5219"] },
  { id: "k1.4.3", title: "\u7528\u5E03\u5C14\u4EE3\u6570\u7B80\u5316\u903B\u8F91\u51FD\u6570", chapter: 1, prereqs: ["k1.4.2"], related: [], keywords: ["\u903B\u8F91\u51FD\u6570\u5316\u7B80", "\u516C\u5F0F\u5316\u7B80", "\u4E0E\u6216\u5F0F", "\u4EE3\u6570\u5316\u7B80"] },
  { id: "k1.5", title: "\u5361\u8BFA\u56FE", chapter: 1, prereqs: ["k1.3.2"], related: [], keywords: ["\u5361\u8BFA\u56FE", "\u683C\u96F7\u7801", "\u76F8\u90BB\u9879", "\u5708\u7EC4"] },
  { id: "k1.5.1", title: "\u5361\u8BFA\u56FE\u7684\u7ED3\u6784\u4E0E\u7279\u70B9", chapter: 1, prereqs: ["k1.3.2"], related: [], keywords: ["\u5361\u8BFA\u56FE", "\u683C\u96F7\u7801\u6392\u5217", "\u76F8\u90BB\u6027", "\u6700\u5C0F\u9879\u65B9\u683C"] },
  { id: "k1.5.2", title: "\u7528\u5361\u8BFA\u56FE\u7B80\u5316\u903B\u8F91\u51FD\u6570", chapter: 1, prereqs: ["k1.5.1", "k1.3.1"], related: [], keywords: ["\u5361\u8BFA\u56FE\u5316\u7B80", "\u5708\u7EC4", "\u65E0\u5173\u9879", "\u5361\u8BFA\u56FE"] },
  { id: "k1.6", title: "\u6570\u5B57\u96C6\u6210\u7535\u8DEF", chapter: 1, prereqs: ["k1.3.4"], related: [], keywords: ["\u96C6\u6210\u7535\u8DEF", "IC", "TTL", "CMOS"] },
  { id: "k1.6.1", title: "\u96C6\u6210\u7535\u8DEF\u7684\u5236\u9020\u6280\u672F\u7C7B\u578B", chapter: 1, prereqs: [], related: [], keywords: ["\u53CC\u6781\u578B", "MOS\u578B", "TTL", "CMOS"] },
  { id: "k1.6.2", title: "\u96C6\u6210\u7535\u8DEF\u7684\u5C01\u88C5\u7C7B\u578B", chapter: 1, prereqs: ["k1.6.1"], related: [], keywords: ["DIP\u5C01\u88C5", "SOP\u5C01\u88C5", "\u5C01\u88C5", "\u5F15\u811A"] },
  { id: "k1.6.3", title: "\u96C6\u6210\u7535\u8DEF\u7684\u89C4\u6A21\u7C7B\u578B", chapter: 1, prereqs: ["k1.6.1"], related: [], keywords: ["SSI", "MSI", "LSI", "VLSI", "\u96C6\u6210\u5EA6"] },
  { id: "k1.6.4", title: "\u96C6\u6210\u7535\u8DEF\u7684\u4F7F\u7528\u7279\u6027", chapter: 1, prereqs: ["k1.6.2", "k1.6.3"], related: [], keywords: ["\u6247\u51FA\u7CFB\u6570", "\u566A\u58F0\u5BB9\u9650", "\u4F20\u8F93\u5EF6\u8FDF", "\u529F\u8017"] },
  { id: "k2", title: "\u7B2C2\u7AE0 \u7EC4\u5408\u903B\u8F91", chapter: 2, prereqs: ["k1"], related: [], keywords: ["\u7EC4\u5408\u903B\u8F91", "\u7EC4\u5408\u7535\u8DEF", "\u65E0\u8BB0\u5FC6"] },
  { id: "k2.1", title: "\u7EC4\u5408\u903B\u8F91\u5206\u6790", chapter: 2, prereqs: ["k1.4.3"], related: [], keywords: ["\u7EC4\u5408\u903B\u8F91\u5206\u6790", "\u903B\u8F91\u7535\u8DEF", "\u8868\u8FBE\u5F0F"] },
  { id: "k2.1.1", title: "\u9010\u7EA7\u7535\u5E73\u63A8\u5BFC\u6CD5", chapter: 2, prereqs: ["k1.3.2"], related: [], keywords: ["\u9010\u7EA7\u63A8\u5BFC", "\u7535\u5E73", "\u95E8\u7535\u8DEF"] },
  { id: "k2.1.2", title: "\u5217\u5199\u5E03\u5C14\u8868\u8FBE\u5F0F\u6CD5", chapter: 2, prereqs: ["k1.4.2"], related: [], keywords: ["\u5E03\u5C14\u8868\u8FBE\u5F0F", "\u903B\u8F91\u8868\u8FBE\u5F0F", "\u8868\u8FBE\u5F0F\u5316\u7B80"] },
  { id: "k2.1.3", title: "\u6570\u5B57\u6CE2\u5F62\u56FE\u5206\u6790\u6CD5", chapter: 2, prereqs: ["k1.1.3", "k2.1.2"], related: [], keywords: ["\u6CE2\u5F62\u56FE", "\u65F6\u5E8F\u5206\u6790", "\u8F93\u5165\u6CE2\u5F62"] },
  { id: "k2.1.4", title: "\u5217\u5199\u903B\u8F91\u7535\u8DEF\u771F\u503C\u8868\u6CD5", chapter: 2, prereqs: ["k1.3.2", "k2.1.2"], related: [], keywords: ["\u771F\u503C\u8868", "\u903B\u8F91\u529F\u80FD", "\u529F\u80FD\u5224\u5B9A"] },
  { id: "k2.1.5", title: "\u7EC4\u5408\u903B\u8F91\u4E2D\u7684\u7ADE\u4E89\u5192\u9669", chapter: 2, prereqs: ["k2.1.3"], related: ["k1.5.2"], keywords: ["\u7ADE\u4E89\u5192\u9669", "\u6BDB\u523A", "\u9669\u8C61", "\u5192\u9669\u6D88\u9664"] },
  { id: "k2.2", title: "\u7EC4\u5408\u903B\u8F91\u8BBE\u8BA1", chapter: 2, prereqs: ["k2.1", "k1.4.3"], related: [], keywords: ["\u7EC4\u5408\u903B\u8F91\u8BBE\u8BA1", "\u8BBE\u8BA1\u6B65\u9AA4", "\u771F\u503C\u8868"] },
  { id: "k2.2.1", title: "\u7EC4\u5408\u903B\u8F91\u8BBE\u8BA1\u6B65\u9AA4", chapter: 2, prereqs: ["k2.1"], related: [], keywords: ["\u8BBE\u8BA1\u6B65\u9AA4", "\u771F\u503C\u8868", "\u6700\u7B80\u8868\u8FBE\u5F0F", "\u95E8\u7535\u8DEF\u5B9E\u73B0"] },
  { id: "k2.2.2", title: "\u903B\u8F91\u95EE\u9898\u7684\u63CF\u8FF0", chapter: 2, prereqs: ["k1.3.2"], related: [], keywords: ["\u6587\u5B57\u63CF\u8FF0", "\u903B\u8F91\u8D4B\u503C", "\u771F\u503C\u8868"] },
  { id: "k2.2.3", title: "\u5229\u7528\u4EFB\u610F\u9879\u7684\u903B\u8F91\u8BBE\u8BA1", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["\u4EFB\u610F\u9879", "\u65E0\u5173\u9879", "\u7EA6\u675F\u6761\u4EF6", "\u5361\u8BFA\u56FE"] },
  { id: "k2.3", title: "\u7EC4\u5408\u903B\u8F91\u7535\u8DEF\u7684\u7B49\u4EF7\u53D8\u6362", chapter: 2, prereqs: ["k1.4.1", "k2.2"], related: [], keywords: ["\u7B49\u4EF7\u53D8\u6362", "\u4E0E\u975E\u95E8", "\u6216\u975E\u95E8"] },
  { id: "k2.3.1", title: "\u6469\u6839\u5B9A\u7406\u7684\u5E94\u7528", chapter: 2, prereqs: ["k1.4.1"], related: [], keywords: ["\u6469\u6839\u5B9A\u7406", "\u53CD\u6F14", "\u5FB7\u6469\u6839"] },
  { id: "k2.3.2", title: "\u4E0E\u975E\u95E8\u3001\u6216\u975E\u95E8\u4F5C\u4E3A\u901A\u7528\u4EF6", chapter: 2, prereqs: ["k2.3.1"], related: [], keywords: ["\u901A\u7528\u95E8", "\u4E0E\u975E\u95E8", "\u6216\u975E\u95E8", "NAND", "NOR"] },
  { id: "k2.3.3", title: "\u5229\u7528\u4E0E\u975E\u95E8/\u6216\u975E\u95E8\u8FDB\u884C\u7B49\u4EF7\u53D8\u6362", chapter: 2, prereqs: ["k2.3.2"], related: [], keywords: ["\u4E0E\u975E-\u4E0E\u975E", "\u6216\u975E-\u6216\u975E", "\u7B49\u4EF7\u53D8\u6362", "NAND"] },
  { id: "k2.3.4", title: '\u903B\u8F91\u51FD\u6570\u7684"\u4E0E\u6216\u975E"\u95E8\u5B9E\u73B0', chapter: 2, prereqs: ["k2.3.3"], related: [], keywords: ["\u4E0E\u6216\u975E\u95E8", "AOI", "\u53CD\u51FD\u6570", "\u903B\u8F91\u5B9E\u73B0"] },
  { id: "k2.4", title: "\u6570\u636E\u9009\u62E9\u5668\u4E0E\u5206\u914D\u5668", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["\u6570\u636E\u9009\u62E9\u5668", "\u6570\u636E\u5206\u914D\u5668", "\u591A\u8DEF\u5F00\u5173"] },
  { id: "k2.4.1", title: "\u6570\u636E\u9009\u62E9\u5668", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["\u6570\u636E\u9009\u62E9\u5668", "MUX", "74LS151", "\u591A\u8DEF\u9009\u62E9"] },
  { id: "k2.4.2", title: "\u6570\u636E\u5206\u914D\u5668", chapter: 2, prereqs: ["k2.4.1"], related: ["k2.5.1"], keywords: ["\u6570\u636E\u5206\u914D\u5668", "DMUX", "\u5206\u8DEF", "\u8BD1\u7801"] },
  { id: "k2.5", title: "\u8BD1\u7801\u5668\u548C\u7F16\u7801\u5668", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["\u8BD1\u7801\u5668", "\u7F16\u7801\u5668", "\u8BD1\u7801", "\u7F16\u7801"] },
  { id: "k2.5.1", title: "\u8BD1\u7801\u5668", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["\u8BD1\u7801\u5668", "74LS138", "\u5730\u5740\u8BD1\u7801", "\u6700\u5C0F\u9879\u8BD1\u7801"] },
  { id: "k2.5.2", title: "\u7F16\u7801\u5668", chapter: 2, prereqs: ["k1.2.3"], related: ["k1.2.3"], keywords: ["\u7F16\u7801\u5668", "74LS148", "\u4F18\u5148\u7F16\u7801", "8\u7EBF3\u7EBF"] },
  { id: "k2.6", title: "\u6570\u636E\u6BD4\u8F83\u5668\u548C\u52A0\u6CD5\u5668", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["\u6BD4\u8F83\u5668", "\u52A0\u6CD5\u5668", "\u7B97\u672F\u8FD0\u7B97"] },
  { id: "k2.6.1", title: "\u6570\u636E\u6BD4\u8F83\u5668", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["\u6570\u636E\u6BD4\u8F83\u5668", "74LS85", "\u5927\u5C0F\u6BD4\u8F83", "\u7EA7\u8054\u6269\u5C55"] },
  { id: "k2.6.2", title: "\u52A0\u6CD5\u5668", chapter: 2, prereqs: ["k2.2.1", "k1.2.2"], related: [], keywords: ["\u52A0\u6CD5\u5668", "\u534A\u52A0\u5668", "\u5168\u52A0\u5668", "74LS283", "\u8FDB\u4F4D"] },
  { id: "k2.7", title: "\u5947\u5076\u6821\u9A8C\u5668", chapter: 2, prereqs: ["k2.1"], related: [], keywords: ["\u5947\u5076\u6821\u9A8C", "\u6821\u9A8C\u4F4D", "\u6821\u9A8C\u5668"] },
  { id: "k2.7.1", title: "\u5947\u5076\u6821\u9A8C\u7684\u57FA\u672C\u539F\u7406", chapter: 2, prereqs: ["k1.2.3", "k2.2.1"], related: [], keywords: ["\u5947\u6821\u9A8C", "\u5076\u6821\u9A8C", "74LS280", "\u6821\u9A8C\u7801"] },
  { id: "k2.7.2", title: "\u5177\u6709\u5947\u5076\u6821\u9A8C\u7684\u6570\u636E\u4F20\u8F93", chapter: 2, prereqs: ["k2.7.1"], related: [], keywords: ["\u6570\u636E\u4F20\u8F93", "\u5DEE\u9519\u68C0\u6D4B", "\u53D1\u9001\u6821\u9A8C", "\u63A5\u6536\u6821\u9A8C"] },
  { id: "k3", title: "\u7B2C3\u7AE0 \u65F6\u5E8F\u903B\u8F91", chapter: 3, prereqs: ["k2"], related: [], keywords: ["\u65F6\u5E8F\u903B\u8F91", "\u65F6\u5E8F\u7535\u8DEF", "\u72B6\u6001", "\u8BB0\u5FC6"] },
  { id: "k3.1", title: "\u9501\u5B58\u5668", chapter: 3, prereqs: ["k2.3.2"], related: [], keywords: ["\u9501\u5B58\u5668", "latch", "\u53CD\u9988", "\u7535\u5E73\u89E6\u53D1"] },
  { id: "k3.1.1", title: "\u9501\u5B58\u5668\u7684\u57FA\u672C\u7279\u6027", chapter: 3, prereqs: ["k2.3.2"], related: [], keywords: ["\u9501\u5B58\u5668", "\u8BB0\u5FC6\u7279\u6027", "\u53CC\u7A33\u6001", "\u53CD\u9988"] },
  { id: "k3.1.2", title: "\u57FA\u672CSR\u9501\u5B58\u5668", chapter: 3, prereqs: ["k3.1.1"], related: [], keywords: ["\u57FA\u672CSR\u9501\u5B58\u5668", "\u4E0E\u975E\u95E8\u9501\u5B58\u5668", "\u7F6E\u4F4D\u590D\u4F4D", "SR"] },
  { id: "k3.1.3", title: "\u95E8\u63A7SR\u9501\u5B58\u5668", chapter: 3, prereqs: ["k3.1.2"], related: [], keywords: ["\u95E8\u63A7SR", "\u4F7F\u80FD", "\u63A7\u5236\u7AEF"] },
  { id: "k3.1.4", title: "\u95E8\u63A7D\u9501\u5B58\u5668", chapter: 3, prereqs: ["k3.1.3"], related: [], keywords: ["\u95E8\u63A7D\u9501\u5B58\u5668", "\u900F\u660E", "D\u9501\u5B58"] },
  { id: "k3.2", title: "\u89E6\u53D1\u5668", chapter: 3, prereqs: ["k3.1"], related: [], keywords: ["\u89E6\u53D1\u5668", "flip-flop", "\u8FB9\u6CBF\u89E6\u53D1"] },
  { id: "k3.2.1", title: "SR\u89E6\u53D1\u5668", chapter: 3, prereqs: ["k3.1.3"], related: [], keywords: ["SR\u89E6\u53D1\u5668", "\u8FB9\u6CBF", "\u7279\u6027\u65B9\u7A0B"] },
  { id: "k3.2.2", title: "D\u89E6\u53D1\u5668", chapter: 3, prereqs: ["k3.1.4", "k3.2.1"], related: [], keywords: ["D\u89E6\u53D1\u5668", "\u8FB9\u6CBF\u89E6\u53D1", "74LS74", "\u7279\u6027\u65B9\u7A0B"] },
  { id: "k3.2.3", title: "JK\u89E6\u53D1\u5668", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["JK\u89E6\u53D1\u5668", "74LS112", "\u7FFB\u8F6C", "\u7279\u6027\u65B9\u7A0B"] },
  { id: "k3.2.4", title: "\u89E6\u53D1\u5668\u7684\u5E94\u7528\u548C\u65F6\u95F4\u53C2\u6570", chapter: 3, prereqs: ["k3.2.2"], related: ["k1.1.3"], keywords: ["\u5EFA\u7ACB\u65F6\u95F4", "\u4FDD\u6301\u65F6\u95F4", "\u4F20\u8F93\u5EF6\u8FDF", "\u65F6\u95F4\u53C2\u6570"] },
  { id: "k3.3", title: "\u5BC4\u5B58\u5668\u548C\u79FB\u4F4D\u5BC4\u5B58\u5668", chapter: 3, prereqs: ["k3.2"], related: [], keywords: ["\u5BC4\u5B58\u5668", "\u79FB\u4F4D\u5BC4\u5B58\u5668", "\u6570\u636E\u5B58\u653E"] },
  { id: "k3.3.1", title: "\u5BC4\u5B58\u5668", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["\u6570\u636E\u5BC4\u5B58\u5668", "\u5E76\u884C\u5B58\u53D6", "\u6E05\u96F6", "74LS175"] },
  { id: "k3.3.2", title: "\u79FB\u4F4D\u5BC4\u5B58\u5668", chapter: 3, prereqs: ["k3.3.1"], related: [], keywords: ["\u79FB\u4F4D\u5BC4\u5B58\u5668", "\u4E32\u884C\u8F93\u5165", "74LS194", "\u5DE6\u79FB\u53F3\u79FB"] },
  { id: "k3.4", title: "\u8BA1\u6570\u5668", chapter: 3, prereqs: ["k3.2.3"], related: [], keywords: ["\u8BA1\u6570\u5668", "\u8BA1\u6570", "\u6A21\u503C"] },
  { id: "k3.4.1", title: "\u540C\u6B65\u8BA1\u6570\u5668", chapter: 3, prereqs: ["k3.2.3"], related: [], keywords: ["\u540C\u6B65\u8BA1\u6570\u5668", "\u6A21N\u8BA1\u6570", "\u540C\u65F6\u7FFB\u8F6C", "\u7EA7\u8054"] },
  { id: "k3.4.2", title: "\u5F02\u6B65\u8BA1\u6570\u5668", chapter: 3, prereqs: ["k3.2.3"], related: ["k3.4.1"], keywords: ["\u5F02\u6B65\u8BA1\u6570\u5668", "\u884C\u6CE2\u8BA1\u6570", "\u7EB9\u6CE2", "\u7EA7\u8054\u5EF6\u8FDF"] },
  { id: "k3.4.3", title: "\u4E2D\u89C4\u6A21\u96C6\u6210\u8BA1\u6570\u5668\u53CA\u5E94\u7528", chapter: 3, prereqs: ["k3.4.1", "k3.3.2"], related: ["k3.6.2"], keywords: ["74LS161", "74LS160", "\u540C\u6B65\u6E05\u96F6", "\u4EFB\u610F\u8FDB\u5236"] },
  { id: "k3.5", title: "\u5B9A\u65F6\u8109\u51B2\u4EA7\u751F\u5668", chapter: 3, prereqs: ["k3.4"], related: [], keywords: ["\u5B9A\u65F6", "\u8109\u51B2\u4EA7\u751F", "\u65F6\u949F"] },
  { id: "k3.5.1", title: "\u65F6\u949F\u8109\u51B2\u6E90\u7535\u8DEF", chapter: 3, prereqs: ["k1.1.3"], related: [], keywords: ["\u65F6\u949F\u6E90", "\u632F\u8361\u5668", "555\u5B9A\u65F6\u5668", "\u6676\u632F"] },
  { id: "k3.5.2", title: "\u8282\u62CD\u8109\u51B2\u4EA7\u751F\u5668", chapter: 3, prereqs: ["k3.4.3", "k3.5.1"], related: [], keywords: ["\u8282\u62CD\u8109\u51B2", "\u73AF\u5F62\u8BA1\u6570\u5668", "\u626D\u73AF\u8BA1\u6570\u5668", "\u8282\u62CD"] },
  { id: "k3.5.3", title: "\u6570\u5B57\u949F", chapter: 3, prereqs: ["k3.5.2", "k3.4.3"], related: [], keywords: ["\u6570\u5B57\u949F", "\u79D2\u5206\u65F6", "\u8BA1\u65F6", "\u8BD1\u7801\u663E\u793A"] },
  { id: "k3.6", title: "\u540C\u6B65\u65F6\u5E8F\u903B\u8F91\u5206\u6790", chapter: 3, prereqs: ["k3.2", "k3.3"], related: [], keywords: ["\u65F6\u5E8F\u5206\u6790", "\u540C\u6B65\u65F6\u5E8F", "\u65F6\u5E8F\u7535\u8DEF\u5206\u6790"] },
  { id: "k3.6.1", title: "\u540C\u6B65\u65F6\u5E8F\u903B\u8F91\u7535\u8DEF\u7684\u63CF\u8FF0\u5DE5\u5177", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["\u72B6\u6001\u56FE", "\u72B6\u6001\u8868", "\u65F6\u5E8F\u56FE", "\u63CF\u8FF0\u5DE5\u5177"] },
  { id: "k3.6.2", title: "\u540C\u6B65\u65F6\u5E8F\u903B\u8F91\u7535\u8DEF\u5206\u6790\u7684\u4E00\u822C\u65B9\u6CD5", chapter: 3, prereqs: ["k3.6.1", "k3.2"], related: [], keywords: ["\u65F6\u5E8F\u5206\u6790", "\u72B6\u6001\u8F6C\u6362", "\u6FC0\u52B1\u65B9\u7A0B", "\u8F93\u51FA\u65B9\u7A0B"] },
  { id: "k3.7", title: "\u540C\u6B65\u65F6\u5E8F\u903B\u8F91\u8BBE\u8BA1", chapter: 3, prereqs: ["k3.6"], related: [], keywords: ["\u65F6\u5E8F\u8BBE\u8BA1", "\u540C\u6B65\u8BBE\u8BA1", "\u72B6\u6001\u673A\u8BBE\u8BA1"] },
  { id: "k3.7.1", title: "\u540C\u6B65\u65F6\u5E8F\u903B\u8F91\u8BBE\u8BA1\u65B9\u6CD5\u548C\u6B65\u9AA4", chapter: 3, prereqs: ["k3.6.2"], related: [], keywords: ["\u8BBE\u8BA1\u6B65\u9AA4", "\u65F6\u5E8F\u8BBE\u8BA1", "\u72B6\u6001\u673A"] },
  { id: "k3.7.2", title: "\u5EFA\u7ACB\u539F\u59CB\u72B6\u6001\u8868\u7684\u65B9\u6CD5", chapter: 3, prereqs: ["k3.7.1"], related: [], keywords: ["\u539F\u59CB\u72B6\u6001\u8868", "\u72B6\u6001\u8868", "\u72B6\u6001\u7B80\u5316"] },
  { id: "k3.7.3", title: "\u72B6\u6001\u7F16\u7801", chapter: 3, prereqs: ["k3.7.2"], related: [], keywords: ["\u72B6\u6001\u7F16\u7801", "\u72EC\u70ED\u7801", "\u4E8C\u8FDB\u5236\u7F16\u7801", "\u683C\u96F7\u7801"] },
  { id: "k4", title: "\u7B2C4\u7AE0 \u5B58\u50A8\u903B\u8F91", chapter: 4, prereqs: ["k3"], related: [], keywords: ["\u5B58\u50A8\u5668", "\u5B58\u50A8\u903B\u8F91", "\u5B58\u50A8\u5355\u5143"] },
  { id: "k4.1", title: "\u7279\u6B8A\u5B58\u50A8\u90E8\u4EF6", chapter: 4, prereqs: ["k3.3"], related: [], keywords: ["\u5B58\u50A8\u90E8\u4EF6", "\u5BC4\u5B58\u5668\u5806", "\u4E13\u7528\u5B58\u50A8"] },
  { id: "k4.1.1", title: "\u5BC4\u5B58\u5668\u5806", chapter: 4, prereqs: ["k3.3.1"], related: [], keywords: ["\u5BC4\u5B58\u5668\u5806", "\u8BFB\u5199\u7AEF\u53E3", "\u591A\u7AEF\u53E3"] },
  { id: "k4.1.2", title: "\u5BC4\u5B58\u5668\u9635\u5217", chapter: 4, prereqs: ["k4.1.1"], related: [], keywords: ["\u5BC4\u5B58\u5668\u9635\u5217", "\u5B57", "\u5B58\u50A8\u9635\u5217"] },
  { id: "k4.1.3", title: "\u5BC4\u5B58\u5668\u5806\u6808", chapter: 4, prereqs: ["k4.1.1", "k3.3.2"], related: [], keywords: ["\u5BC4\u5B58\u5668\u5806\u6808", "\u5806\u6808", "\u5148\u8FDB\u540E\u51FA", "\u6808\u6307\u9488"] },
  { id: "k4.2", title: "\u968F\u673A\u8BFB\u5199\u5B58\u50A8\u5668RAM", chapter: 4, prereqs: ["k4.1", "k2.5.1"], related: [], keywords: ["RAM", "\u968F\u673A\u8BFB\u5199", "\u5B58\u50A8\u5668"] },
  { id: "k4.2.1", title: "RAM\u7684\u903B\u8F91\u7ED3\u6784", chapter: 4, prereqs: ["k4.1.2", "k2.5.1"], related: [], keywords: ["RAM\u7ED3\u6784", "\u5730\u5740\u7EBF", "\u6570\u636E\u7EBF", "\u8BFB\u5199\u63A7\u5236"] },
  { id: "k4.2.2", title: "\u5730\u5740\u8BD1\u7801\u65B9\u6CD5", chapter: 4, prereqs: ["k4.2.1", "k2.5.1"], related: [], keywords: ["\u5730\u5740\u8BD1\u7801", "74LS138", "\u884C\u8BD1\u7801", "\u5217\u8BD1\u7801"] },
  { id: "k4.2.3", title: "SRAM\u5B58\u50A8\u5668", chapter: 4, prereqs: ["k4.2.1", "k3.1.4"], related: [], keywords: ["SRAM", "\u9759\u6001\u5B58\u50A8", "\u516D\u7BA1", "\u9501\u5B58"] },
  { id: "k4.2.4", title: "DRAM\u5B58\u50A8\u5668", chapter: 4, prereqs: ["k4.2.3"], related: [], keywords: ["DRAM", "\u52A8\u6001\u5B58\u50A8", "\u5237\u65B0", "\u7535\u5BB9"] },
  { id: "k4.3", title: "\u53EA\u8BFB\u5B58\u50A8\u5668ROM", chapter: 4, prereqs: ["k4.2.2", "k2.2"], related: [], keywords: ["ROM", "\u53EA\u8BFB\u5B58\u50A8\u5668", "\u67E5\u627E\u8868"] },
  { id: "k4.3.1", title: "\u63A9\u6A21ROM", chapter: 4, prereqs: ["k2.1.2", "k1.3.2"], related: [], keywords: ["\u63A9\u6A21ROM", "\u56FA\u5316", "\u5B58\u50A8\u9635\u5217"] },
  { id: "k4.3.2", title: "\u53EF\u7F16\u7A0BROM", chapter: 4, prereqs: ["k4.3.1"], related: ["k5.1.1"], keywords: ["PROM", "EPROM", "\u53EF\u7F16\u7A0BROM", "\u7194\u4E1D"] },
  { id: "k4.4", title: "FLASH\u5B58\u50A8\u5668", chapter: 4, prereqs: ["k4.3.2"], related: [], keywords: ["FLASH", "\u95EA\u5B58", "\u975E\u6613\u5931"] },
  { id: "k4.4.1", title: "FLASH\u5B58\u50A8\u5143", chapter: 4, prereqs: ["k4.3.2"], related: ["k4.2.3"], keywords: ["\u6D6E\u6805", "\u5B58\u50A8\u5143", "NOR\u578B", "NAND\u578B"] },
  { id: "k4.4.2", title: "FLASH\u5B58\u50A8\u5668\u7684\u57FA\u672C\u64CD\u4F5C", chapter: 4, prereqs: ["k4.4.1"], related: [], keywords: ["\u64E6\u9664", "\u7F16\u7A0B", "\u8BFB\u53D6", "FLASH\u64CD\u4F5C"] },
  { id: "k4.4.3", title: "FLASH\u5B58\u50A8\u5668\u7684\u9635\u5217\u7ED3\u6784", chapter: 4, prereqs: ["k4.4.2", "k4.2.2"], related: [], keywords: ["\u9635\u5217\u7ED3\u6784", "NOR\u9635\u5217", "NAND\u9635\u5217", "\u5B57\u7EBF\u4F4D\u7EBF"] },
  { id: "k4.5", title: "\u5B58\u50A8\u5668\u5BB9\u91CF\u7684\u6269\u5C55", chapter: 4, prereqs: ["k4.2.2", "k2.5.1"], related: [], keywords: ["\u5BB9\u91CF\u6269\u5C55", "\u7247\u9009", "\u4F4D\u6269\u5C55", "\u5B57\u6269\u5C55"] },
  { id: "k4.5.1", title: "\u5B57\u957F\u4F4D\u6570\u6269\u5C55", chapter: 4, prereqs: ["k4.2.1"], related: [], keywords: ["\u4F4D\u6269\u5C55", "\u5B57\u957F", "\u5E76\u8054"] },
  { id: "k4.5.2", title: "\u5B57\u5B58\u50A8\u5BB9\u91CF\u6269\u5C55", chapter: 4, prereqs: ["k4.5.1", "k2.5.1"], related: [], keywords: ["\u5B57\u6269\u5C55", "\u7247\u9009", "74LS138", "\u5730\u5740\u8BD1\u7801"] },
  { id: "k5", title: "\u7B2C5\u7AE0 \u53EF\u7F16\u7A0B\u903B\u8F91", chapter: 5, prereqs: ["k4"], related: [], keywords: ["\u53EF\u7F16\u7A0B\u903B\u8F91", "PLD", "FPGA"] },
  { id: "k5.1", title: "PLD\u7684\u57FA\u672C\u6982\u5FF5", chapter: 5, prereqs: ["k4.3.2", "k2.1.2"], related: [], keywords: ["PLD", "\u53EF\u7F16\u7A0B\u903B\u8F91\u5668\u4EF6", "\u4E0E\u6216\u9635\u5217"] },
  { id: "k5.1.1", title: "\u53EF\u7F16\u7A0B\u9635\u5217", chapter: 5, prereqs: ["k4.3.2"], related: [], keywords: ["PAL", "GAL", "\u4E0E\u9635\u5217", "\u6216\u9635\u5217"] },
  { id: "k5.1.2", title: "PLD\u7684\u7C7B\u578B", chapter: 5, prereqs: ["k5.1.1"], related: [], keywords: ["PAL", "GAL", "CPLD", "FPGA"] },
  { id: "k5.2", title: "\u73B0\u573A\u53EF\u7F16\u7A0B\u95E8\u9635\u5217FPGA", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["FPGA", "\u95E8\u9635\u5217", "\u73B0\u573A\u53EF\u7F16\u7A0B"] },
  { id: "k5.2.1", title: "FPGA\u7684\u57FA\u672C\u7ED3\u6784", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["FPGA\u7ED3\u6784", "CLB", "\u5E03\u7EBF\u8D44\u6E90", "IOB"] },
  { id: "k5.2.2", title: "\u53EF\u7EC4\u6001\u903B\u8F91\u5757CLB", chapter: 5, prereqs: ["k5.2.1"], related: [], keywords: ["CLB", "\u67E5\u627E\u8868", "LUT", "\u89E6\u53D1\u5668"] },
  { id: "k5.2.3", title: "SRAM\u4E3A\u57FA\u7840\u7684FPGA", chapter: 5, prereqs: ["k5.2.2", "k4.2.3"], related: [], keywords: ["SRAM\u578BFPGA", "\u914D\u7F6E\u5B58\u50A8", "\u6613\u5931", "\u6BD4\u7279\u6D41"] },
  { id: "k5.3", title: "\u5728\u7CFB\u7EDF\u53EF\u7F16\u7A0BISP", chapter: 5, prereqs: ["k5.2", "k4.4"], related: [], keywords: ["ISP", "\u5728\u7CFB\u7EDF\u7F16\u7A0B", "JTAG"] },
  { id: "k5.3.1", title: "ispLSI\u5668\u4EF6\u7684\u4F53\u7CFB\u7ED3\u6784", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["ispLSI", "\u5168\u5C40\u5E03\u7EBF\u533A", "\u5728\u7CFB\u7EDF\u53EF\u7F16\u7A0B"] },
  { id: "k5.3.2", title: "EPM7128\u5668\u4EF6\u7684\u4F53\u7CFB\u7ED3\u6784", chapter: 5, prereqs: ["k5.3.1"], related: [], keywords: ["EPM7128", "CPLD", "\u5B8F\u5355\u5143", "\u903B\u8F91\u9635\u5217\u5757"] },
  { id: "k5.3.3", title: "\u5728\u7CFB\u7EDF\u7F16\u7A0B\u539F\u7406", chapter: 5, prereqs: ["k4.4.2", "k5.3.1"], related: [], keywords: ["\u5728\u7CFB\u7EDF\u7F16\u7A0B", "JTAG", "\u8FB9\u754C\u626B\u63CF", "\u7F16\u7A0B\u539F\u7406"] },
  { id: "k5.4", title: "\u53EF\u7F16\u7A0B\u903B\u8F91\u7684\u539F\u7406\u56FE\u65B9\u5F0F\u8BBE\u8BA1", chapter: 5, prereqs: ["k5.1"], related: [], keywords: ["\u539F\u7406\u56FE\u8F93\u5165", "\u539F\u7406\u56FE\u8BBE\u8BA1", "\u56FE\u5F62\u5316\u8BBE\u8BA1"] },
  { id: "k5.4.1", title: "\u7F16\u7A0B\u73AF\u5883\u548C\u8BBE\u8BA1\u6D41\u7A0B\u56FE", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["\u8BBE\u8BA1\u6D41\u7A0B", "\u5F00\u53D1\u73AF\u5883", "\u8BBE\u8BA1\u6D41\u7A0B\u56FE"] },
  { id: "k5.4.2", title: "\u8BBE\u8BA1\u8F93\u5165", chapter: 5, prereqs: ["k5.4.1", "k2.2.1"], related: [], keywords: ["\u8BBE\u8BA1\u8F93\u5165", "\u539F\u7406\u56FE", "\u7B26\u53F7\u5E93"] },
  { id: "k5.4.3", title: "\u529F\u80FD\u6A21\u62DF", chapter: 5, prereqs: ["k5.4.2"], related: [], keywords: ["\u529F\u80FD\u4EFF\u771F", "\u529F\u80FD\u6A21\u62DF", "\u4EFF\u771F\u6CE2\u5F62"] },
  { id: "k5.4.4", title: "\u7EFC\u5408\u548C\u5B9E\u73B0(\u8F6F\u4EF6)", chapter: 5, prereqs: ["k5.4.3"], related: [], keywords: ["\u7EFC\u5408", "\u5B9E\u73B0", "\u5E03\u5C40\u5E03\u7EBF"] },
  { id: "k5.4.5", title: "\u65F6\u5E8F\u6A21\u62DF", chapter: 5, prereqs: ["k5.4.4", "k3.2.4"], related: [], keywords: ["\u65F6\u5E8F\u4EFF\u771F", "\u65F6\u5E8F\u6A21\u62DF", "\u5EFA\u7ACB\u4FDD\u6301", "\u5EF6\u8FDF"] },
  { id: "k5.4.6", title: "\u5668\u4EF6\u4E0B\u8F7D", chapter: 5, prereqs: ["k5.4.4", "k5.3.3"], related: [], keywords: ["\u5668\u4EF6\u4E0B\u8F7D", "\u7F16\u7A0B\u6587\u4EF6", "\u4E0B\u8F7D", "JTAG"] },
  { id: "k5.5", title: "\u53EF\u7F16\u7A0B\u903B\u8F91\u7684HDL\u6587\u672C\u65B9\u5F0F\u8BBE\u8BA1", chapter: 5, prereqs: ["k5.4.1"], related: [], keywords: ["HDL", "Verilog", "\u6587\u672C\u8BBE\u8BA1"] },
  { id: "k5.5.1", title: "HDL\u7684\u57FA\u672C\u6982\u5FF5", chapter: 5, prereqs: ["k5.5"], related: [], keywords: ["Verilog", "HDL", "\u6A21\u5757", "always"] },
  { id: "k5.5.2", title: "HDL\u7684\u7EC4\u5408\u903B\u8F91\u8BBE\u8BA1", chapter: 5, prereqs: ["k5.5.1", "k2.2.1"], related: [], keywords: ["Verilog", "\u7EC4\u5408\u903B\u8F91", "assign", "always\u7EC4\u5408"] },
  { id: "k5.5.3", title: "HDL\u7684\u65F6\u5E8F\u903B\u8F91\u8BBE\u8BA1", chapter: 5, prereqs: ["k5.5.2", "k3.2.2"], related: [], keywords: ["Verilog", "\u65F6\u5E8F\u903B\u8F91", "always\u65F6\u5E8F", "\u975E\u963B\u585E\u8D4B\u503C"] },
  { id: "k6", title: "\u7B2C6\u7AE0 \u6570\u5B57\u7CFB\u7EDF", chapter: 6, prereqs: ["k5"], related: [], keywords: ["\u6570\u5B57\u7CFB\u7EDF", "\u5B50\u7CFB\u7EDF", "\u63A7\u5236\u5668"] },
  { id: "k6.1", title: "\u6570\u5B57\u7CFB\u7EDF\u7684\u57FA\u672C\u6982\u5FF5", chapter: 6, prereqs: ["k3.7", "k2.2"], related: [], keywords: ["\u6570\u5B57\u7CFB\u7EDF", "\u7CFB\u7EDF\u6A21\u578B", "\u57FA\u672C\u6982\u5FF5"] },
  { id: "k6.1.1", title: "\u4E00\u4E2A\u6570\u5B57\u7CFB\u7EDF\u5B9E\u4F8B", chapter: 6, prereqs: ["k3.4.3"], related: [], keywords: ["\u6570\u5B57\u7CFB\u7EDF\u5B9E\u4F8B", "\u7CFB\u7EDF\u793A\u4F8B", "\u6570\u5B57\u949F"] },
  { id: "k6.1.2", title: "\u6570\u5B57\u7CFB\u7EDF\u7684\u57FA\u672C\u6A21\u578B", chapter: 6, prereqs: ["k6.1.1"], related: [], keywords: ["\u6570\u636E\u90E8\u5206", "\u63A7\u5236\u90E8\u5206", "\u57FA\u672C\u6A21\u578B"] },
  { id: "k6.1.3", title: "\u6570\u5B57\u7CFB\u7EDF\u4E0E\u903B\u8F91\u529F\u80FD\u90E8\u4EF6\u7684\u533A\u522B", chapter: 6, prereqs: ["k6.1.2"], related: [], keywords: ["\u6570\u5B57\u7CFB\u7EDF", "\u529F\u80FD\u90E8\u4EF6", "\u533A\u522B"] },
  { id: "k6.2", title: "\u6570\u636E\u901A\u8DEF", chapter: 6, prereqs: ["k6.1.2", "k2.4.1"], related: [], keywords: ["\u6570\u636E\u901A\u8DEF", "\u6570\u636E\u8DEF\u5F84", "\u5BC4\u5B58\u5668\u4F20\u8F93"] },
  { id: "k6.2.1", title: "\u603B\u7EBF\u7ED3\u6784", chapter: 6, prereqs: ["k6.1.2", "k1.3.4"], related: [], keywords: ["\u603B\u7EBF", "\u4E09\u6001", "\u603B\u7EBF\u7ED3\u6784"] },
  { id: "k6.2.2", title: "\u6570\u636E\u901A\u8DEF\u5B9E\u4F8B", chapter: 6, prereqs: ["k6.2.1"], related: [], keywords: ["\u6570\u636E\u901A\u8DEF\u5B9E\u4F8B", "\u7D2F\u52A0\u5668", "\u591A\u8DEF\u9009\u62E9"] },
  { id: "k6.3", title: "\u7531\u9876\u5411\u4E0B\u7684\u8BBE\u8BA1\u65B9\u6CD5", chapter: 6, prereqs: ["k6.1", "k6.2"], related: [], keywords: ["\u81EA\u9876\u5411\u4E0B", "\u5C42\u6B21\u8BBE\u8BA1", "\u7531\u9876\u5411\u4E0B"] },
  { id: "k6.3.1", title: "\u6570\u5B57\u7CFB\u7EDF\u7684\u8BBE\u8BA1\u4EFB\u52A1", chapter: 6, prereqs: ["k6.1.3"], related: [], keywords: ["\u8BBE\u8BA1\u4EFB\u52A1", "\u9700\u6C42\u5206\u6790", "\u529F\u80FD\u5212\u5206"] },
  { id: "k6.3.2", title: "\u7B97\u6CD5\u72B6\u6001\u673A\u548C\u7B97\u6CD5\u6D41\u7A0B\u56FE", chapter: 6, prereqs: ["k6.3.1", "k3.7.1"], related: [], keywords: ["ASM", "\u7B97\u6CD5\u6D41\u7A0B\u56FE", "\u72B6\u6001\u673A", "ASM\u56FE"] },
  { id: "k6.4", title: "\u5C0F\u578B\u63A7\u5236\u5668\u7684\u8BBE\u8BA1", chapter: 6, prereqs: ["k6.3.2"], related: [], keywords: ["\u5C0F\u578B\u63A7\u5236\u5668", "\u63A7\u5236\u5668\u8BBE\u8BA1"] },
  { id: "k6.4.1", title: "\u63A7\u5236\u5668\u7684\u57FA\u672C\u6982\u5FF5", chapter: 6, prereqs: ["k6.3.2"], related: [], keywords: ["\u63A7\u5236\u5668", "\u63A7\u5236\u4FE1\u53F7", "\u63A7\u5236\u5355\u5143"] },
  { id: "k6.4.2", title: "\u8BA1\u6570\u5668\u578B\u63A7\u5236\u5668", chapter: 6, prereqs: ["k6.4.1", "k3.4.1"], related: [], keywords: ["\u8BA1\u6570\u5668\u578B\u63A7\u5236\u5668", "\u987A\u5E8F\u8109\u51B2", "\u8BA1\u6570\u5668"] },
  { id: "k6.4.3", title: "\u591A\u8DEF\u9009\u62E9\u5668\u578B\u63A7\u5236\u5668", chapter: 6, prereqs: ["k6.4.1", "k2.4.1"], related: [], keywords: ["\u591A\u8DEF\u9009\u62E9\u5668\u578B", "74LS151", "\u63A7\u5236\u5668", "\u9009\u62E9\u5668"] },
  { id: "k6.4.4", title: "\u5B9A\u5E8F\u578B\u63A7\u5236\u5668", chapter: 6, prereqs: ["k6.4.1", "k3.3.2"], related: [], keywords: ["\u5B9A\u5E8F\u578B\u63A7\u5236\u5668", "\u79FB\u4F4D\u5BC4\u5B58\u5668", "\u5E8F\u5217"] },
  { id: "k6.5", title: "\u6570\u5B57\u7CFB\u7EDF\u8BBE\u8BA1\u5B9E\u4F8B", chapter: 6, prereqs: ["k6.4", "k6.3"], related: [], keywords: ["\u8BBE\u8BA1\u5B9E\u4F8B", "\u7EFC\u5408\u5B9E\u4F8B", "\u7CFB\u7EDF\u8BBE\u8BA1"] },
  { id: "k6.5.1", title: "\u7531\u9876\u5411\u4E0B\u2014\u2014\u5B50\u7CFB\u7EDF\u7684\u5212\u5206", chapter: 6, prereqs: ["k6.3.1"], related: [], keywords: ["\u5B50\u7CFB\u7EDF\u5212\u5206", "\u81EA\u9876\u5411\u4E0B", "\u529F\u80FD\u5212\u5206"] },
  { id: "k6.5.2", title: "\u5C0F\u578B\u63A7\u5236\u5668\u7684\u5B9E\u73B0\u65B9\u6848", chapter: 6, prereqs: ["k6.5.1", "k6.4.4"], related: [], keywords: ["\u63A7\u5236\u5668\u5B9E\u73B0", "\u5B9E\u73B0\u65B9\u6848", "\u65B9\u6848\u5BF9\u6BD4"] },
  { id: "k7", title: "\u7B2C7\u7AE0 A/D\u8F6C\u6362\u3001D/A\u8F6C\u6362", chapter: 7, prereqs: ["k1"], related: [], keywords: ["A/D\u8F6C\u6362", "D/A\u8F6C\u6362", "\u6570\u6A21\u8F6C\u6362", "\u6A21\u6570\u8F6C\u6362"] },
  { id: "k7.1", title: "\u6570\u5B57\u4FE1\u53F7\u5904\u7406\u7684\u57FA\u672C\u6982\u5FF5", chapter: 7, prereqs: ["k1.1.1"], related: [], keywords: ["\u6570\u5B57\u4FE1\u53F7\u5904\u7406", "\u6570\u5B57\u4FE1\u53F7", "\u6A21\u62DF\u4FE1\u53F7"] },
  { id: "k7.2", title: "A/D\u8F6C\u6362", chapter: 7, prereqs: ["k7.1"], related: [], keywords: ["A/D\u8F6C\u6362", "ADC", "\u6A21\u6570\u8F6C\u6362"] },
  { id: "k7.2.1", title: "\u91C7\u6837\u5B9A\u7406", chapter: 7, prereqs: ["k7.1"], related: [], keywords: ["\u91C7\u6837\u5B9A\u7406", "\u5948\u594E\u65AF\u7279", "\u91C7\u6837\u9891\u7387", "\u6DF7\u53E0"] },
  { id: "k7.2.2", title: "\u6A21\u6570\u8F6C\u6362\u8FC7\u7A0B", chapter: 7, prereqs: ["k7.2.1", "k1.2.3"], related: [], keywords: ["\u91C7\u6837", "\u4FDD\u6301", "\u91CF\u5316", "\u7F16\u7801"] },
  { id: "k7.2.3", title: "A/D\u8F6C\u6362\u5668", chapter: 7, prereqs: ["k7.2.2"], related: [], keywords: ["ADC", "\u9010\u6B21\u903C\u8FD1", "\u53CC\u79EF\u5206", "\u5E76\u884C\u6BD4\u8F83"] },
  { id: "k7.2.4", title: "ADC\u7684\u6027\u80FD\u53C2\u6570", chapter: 7, prereqs: ["k7.2.3"], related: [], keywords: ["\u5206\u8FA8\u7387", "\u8F6C\u6362\u901F\u5EA6", "\u91CF\u5316\u8BEF\u5DEE", "ADC\u53C2\u6570"] },
  { id: "k7.3", title: "D/A\u8F6C\u6362", chapter: 7, prereqs: ["k7.1", "k1.2.2"], related: [], keywords: ["D/A\u8F6C\u6362", "DAC", "\u6570\u6A21\u8F6C\u6362"] },
  { id: "k7.3.1", title: "\u6743\u7535\u963BDAC", chapter: 7, prereqs: [], related: [], keywords: ["\u6743\u7535\u963B", "DAC", "\u52A0\u6743\u6C42\u548C"] },
  { id: "k7.3.2", title: "R-2R T\u578BDAC", chapter: 7, prereqs: ["k7.3.1"], related: [], keywords: ["R-2R", "T\u578B", "DAC", "\u7535\u963B\u7F51\u7EDC"] },
  { id: "k7.3.3", title: "R-2R\u5012T\u578BDAC", chapter: 7, prereqs: ["k7.3.2"], related: [], keywords: ["\u5012T\u578B", "R-2R", "DAC", "\u7535\u6D41\u8F93\u51FA"] },
  { id: "k7.3.4", title: "DAC\u7684\u6027\u80FD\u53C2\u6570", chapter: 7, prereqs: ["k7.3.3"], related: [], keywords: ["\u5206\u8FA8\u7387", "\u5EFA\u7ACB\u65F6\u95F4", "\u7EBF\u6027\u5EA6", "DAC\u53C2\u6570"] }
];

// src/solvers/knowledge.ts
var ID_RE = /^k\d+(\.\d+)*$/;
var WHITE = 0;
var GRAY = 1;
var BLACK = 2;
function parentIdOf(id) {
  const i = id.lastIndexOf(".");
  return i > 0 ? id.slice(0, i) : null;
}
function push(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
function createKnowledgeBase(input) {
  if (!Array.isArray(input)) throw new Error("\u77E5\u8BC6\u56FE\u8C31\u5FC5\u987B\u662F\u6570\u7EC4\u3002");
  const byId = /* @__PURE__ */ new Map();
  for (const n of input) {
    if (!n || typeof n.id !== "string" || n.id === "") throw new Error("\u77E5\u8BC6\u70B9\u7F3A\u5C11 id\u3002");
    if (byId.has(n.id)) throw new Error(`\u77E5\u8BC6\u70B9 id \u91CD\u590D\uFF1A${n.id}`);
    byId.set(n.id, n);
  }
  for (const n of input) {
    if (!ID_RE.test(n.id)) throw new Error(`\u77E5\u8BC6\u70B9 id \u683C\u5F0F\u4E0D\u6B63\u786E\uFF1A${n.id}`);
    if (typeof n.title !== "string" || n.title.trim() === "") throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7F3A\u5C11\u6807\u9898\u3002`);
    if (n.id.split(".")[0] !== `k${n.chapter}`) {
      throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7684\u7AE0\u8282\u53F7 ${n.chapter} \u4E0E id \u4E0D\u4E00\u81F4\u3002`);
    }
    if (!Array.isArray(n.keywords)) throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7684 keywords \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
    for (const field of ["prereqs", "related"]) {
      const refs = n[field];
      if (!Array.isArray(refs)) throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7684 ${field} \u5FC5\u987B\u662F\u6570\u7EC4\u3002`);
      for (const ref of refs) {
        if (ref === n.id) throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7684 ${field} \u4E0D\u80FD\u6307\u5411\u81EA\u8EAB\u3002`);
        if (!byId.has(ref)) throw new Error(`\u77E5\u8BC6\u70B9 ${n.id} \u7684 ${field} \u5F15\u7528\u4E86\u4E0D\u5B58\u5728\u7684 id\uFF1A${ref}`);
      }
    }
  }
  const color = /* @__PURE__ */ new Map();
  const path = [];
  const visit = (id) => {
    color.set(id, GRAY);
    path.push(id);
    for (const p of byId.get(id).prereqs) {
      const c2 = color.get(p) ?? WHITE;
      if (c2 === GRAY) {
        const cycle = path.slice(path.indexOf(p)).concat(p);
        throw new Error(`\u524D\u7F6E\u77E5\u8BC6\u5B58\u5728\u5FAA\u73AF\uFF1A${cycle.join(" -> ")}`);
      }
      if (c2 === WHITE) visit(p);
    }
    path.pop();
    color.set(id, BLACK);
  };
  for (const n of input) if ((color.get(n.id) ?? WHITE) === WHITE) visit(n.id);
  const dependentsOf = /* @__PURE__ */ new Map();
  const relatedInverse = /* @__PURE__ */ new Map();
  const childrenOf = /* @__PURE__ */ new Map();
  for (const n of input) {
    for (const p of n.prereqs) push(dependentsOf, p, n.id);
    for (const r of n.related) push(relatedInverse, r, n.id);
    const pid = parentIdOf(n.id);
    if (pid && byId.has(pid)) push(childrenOf, pid, n.id);
  }
  const pick = (ids) => (ids ?? []).map((id) => byId.get(id)).filter((n) => n !== void 0);
  const relatedIds = (id) => {
    const own = byId.get(id)?.related ?? [];
    return [.../* @__PURE__ */ new Set([...own, ...relatedInverse.get(id) ?? []])];
  };
  const get = (id) => byId.get(id);
  const has = (id) => byId.has(id);
  const lookup = (ids) => {
    const found = [];
    const missing = [];
    const seen = /* @__PURE__ */ new Set();
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const node = byId.get(id);
      if (node) found.push(node);
      else missing.push(id);
    }
    return { found, missing };
  };
  const neighbors = (id) => {
    const node = byId.get(id);
    if (!node) return { node: null, parent: null, children: [], prereqs: [], dependents: [], related: [] };
    const pid = parentIdOf(id);
    return {
      node,
      parent: pid ? byId.get(pid) ?? null : null,
      children: pick(childrenOf.get(id)),
      prereqs: pick(node.prereqs),
      dependents: pick(dependentsOf.get(id)),
      related: pick(relatedIds(id))
    };
  };
  const search = (query, limit = 10) => {
    const terms = String(query ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0 || limit <= 0) return [];
    const scored = [];
    input.forEach((node, index) => {
      const title = node.title.toLowerCase();
      const keywords = node.keywords.map((k) => k.toLowerCase());
      let titleHits = 0;
      let hits = 0;
      for (const term of terms) {
        const inTitle = title.includes(term);
        if (inTitle) titleHits++;
        if (inTitle || keywords.some((k) => k.includes(term))) hits++;
      }
      if (hits > 0) scored.push({ node, index, titleHits, hits });
    });
    scored.sort(
      (a, b) => b.titleHits - a.titleHits || b.hits - a.hits || a.node.title.length - b.node.title.length || a.index - b.index
    );
    return scored.slice(0, limit).map((s) => s.node);
  };
  const neighborhood = (ids) => {
    const out = /* @__PURE__ */ new Set();
    if (!Array.isArray(ids)) return out;
    for (const id of ids) {
      out.add(id);
      const nb = neighbors(id);
      if (!nb.node) continue;
      for (const n of [nb.parent, ...nb.children, ...nb.prereqs, ...nb.dependents, ...nb.related]) {
        if (n) out.add(n.id);
      }
    }
    return out;
  };
  return { nodes: [...input], get, has, lookup, neighbors, search, neighborhood };
}
var cached;
function defaultKnowledgeBase() {
  if (!cached) cached = createKnowledgeBase(knowledge_map_default);
  return cached;
}

// src/client/ask/entries.ts
var ASK_FOLLOWUP_WHY = "\u7EE7\u7EED\u6DF1\u5165\u8FD9\u4E00\u70B9";
var ASK_MAX_ENTRIES = 100;
var ASK_SUMMARY_MAX = 200;
function askStorageKey(sessionId) {
  return `dlogic.ask.${sessionId}`;
}
function answerSummary(answer) {
  const flat = answer.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  return chars.length > ASK_SUMMARY_MAX ? chars.slice(0, ASK_SUMMARY_MAX).join("") + "\u2026" : flat;
}
function randomToken() {
  return Math.random().toString(36).slice(2, 8);
}
function toFollowups(list) {
  return (list ?? []).map((s) => ({ question: s.question, angle: s.angle, why: s.why || ASK_FOLLOWUP_WHY }));
}
var FOLLOWUP_QUESTION_MAX = 30;
function clipTitle(title, max) {
  const chars = Array.from(title);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "\u2026" : title;
}
function atomFollowups(knowledgeIds, explored, kb = defaultKnowledgeBase()) {
  const refine = [];
  for (const id of knowledgeIds) {
    const parent = kb.get(id);
    if (!parent) continue;
    for (const child of kb.neighbors(id).children) {
      if (explored.has(child.id) || refine.length >= 3) continue;
      refine.push({
        question: `\u300C${clipTitle(child.title, FOLLOWUP_QUESTION_MAX - 8)}\u300D\u5177\u4F53\u662F\u4EC0\u4E48\uFF1F`,
        angle: "principle",
        why: `\u7EC6\u5316\uFF1A${parent.title}`,
        knowledgeId: child.id
      });
    }
  }
  if (refine.length > 0) return refine;
  const first = knowledgeIds.map((id) => kb.get(id)).find((n) => n !== void 0);
  if (!first) return [];
  const { prereqs, related } = kb.neighbors(first.id);
  const lateral = [];
  const used = /* @__PURE__ */ new Set();
  const push2 = (node, question, angle, why) => {
    if (lateral.length >= 2 || explored.has(node.id) || used.has(node.id)) return;
    used.add(node.id);
    lateral.push({ question, angle, why, knowledgeId: node.id });
  };
  for (const p of prereqs) {
    push2(p, `\u5B66\u300C${clipTitle(p.title, FOLLOWUP_QUESTION_MAX - 9)}\u300D\u8981\u5148\u61C2\u4EC0\u4E48\uFF1F`, "prerequisite", `${first.title}\u7684\u524D\u7F6E\u77E5\u8BC6`);
  }
  for (const r of related) {
    push2(r, `\u300C${clipTitle(r.title, FOLLOWUP_QUESTION_MAX - 10)}\u300D\u548C\u5B83\u6709\u4EC0\u4E48\u8054\u7CFB\uFF1F`, "variant", `\u4E0E${first.title}\u76F8\u5173`);
  }
  return lateral;
}
function buildAskEntry(input) {
  const kb = defaultKnowledgeBase();
  const focus = input.followup?.knowledgeId !== void 0 ? kb.get(input.followup.knowledgeId) : void 0;
  const knowledgeIds = focus ? [focus.id] : [...input.parent.knowledgeIds];
  const knowledgeNames = focus ? [focus.title] : input.parent.knowledgeNames;
  const explored = /* @__PURE__ */ new Set([...input.explored ?? [], ...input.parent.knowledgeIds, ...knowledgeIds]);
  const modelFollowups = toFollowups(input.followups);
  const generated = modelFollowups.length > 0 ? [] : atomFollowups(knowledgeIds, explored, kb);
  return {
    answer: input.answer,
    card: {
      nodeId: `q${input.now.toString(36)}${input.token}`,
      callId: `llm-${input.now}-${input.token}`,
      title: input.title ?? input.question,
      summary: answerSummary(input.answer),
      kind: "concept",
      knowledgeIds,
      ...knowledgeNames ? { knowledgeNames: [...knowledgeNames] } : {},
      followups: modelFollowups.length > 0 ? modelFollowups : generated,
      parentId: input.parent.nodeId,
      ...input.index === void 0 ? {} : { parentFollowup: input.index }
    }
  };
}
function addAskEntry(list, entry) {
  if (list.some((e) => e.card.callId === entry.card.callId)) return list;
  const next = [...list, entry];
  return next.length > ASK_MAX_ENTRIES ? next.slice(next.length - ASK_MAX_ENTRIES) : next;
}
function serializeAskEntries(list) {
  return JSON.stringify({ v: 1, items: list });
}
function isObj3(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isCard2(x) {
  if (!isObj3(x)) return false;
  return typeof x.nodeId === "string" && x.nodeId !== "" && typeof x.callId === "string" && x.callId !== "" && typeof x.title === "string" && typeof x.summary === "string" && typeof x.kind === "string" && Array.isArray(x.knowledgeIds) && Array.isArray(x.followups) && (x.parentId === null || typeof x.parentId === "string");
}
function sanitizeSources(card) {
  const s = card.sources;
  if (s === void 0 || Array.isArray(s) && s.every((x) => typeof x === "string")) return card;
  const copy = { ...card };
  delete copy.sources;
  return copy;
}
function parseAskEntries(raw) {
  if (typeof raw !== "string" || raw === "") return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = isObj3(data) && Array.isArray(data.items) ? data.items : [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const it of items) {
    if (!isObj3(it) || typeof it.answer !== "string" || !isCard2(it.card)) continue;
    if (seen.has(it.card.callId)) continue;
    seen.add(it.card.callId);
    out.push({ card: sanitizeSources(it.card), answer: it.answer });
  }
  return out.length > ASK_MAX_ENTRIES ? out.slice(out.length - ASK_MAX_ENTRIES) : out;
}

// src/client/ask/store.ts
var import_react10 = require("react");
var EMPTY = [];
var cache = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Map();
function readStored(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key, value) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
  }
}
function loadAskEntries(sessionId) {
  if (!sessionId) return EMPTY;
  const hit = cache.get(sessionId);
  if (hit) return hit;
  const list = parseAskEntries(readStored(askStorageKey(sessionId)));
  cache.set(sessionId, list);
  return list;
}
function addAskAnswer(sessionId, entry) {
  if (!sessionId) return;
  const cur = loadAskEntries(sessionId);
  const next = addAskEntry(cur, entry);
  if (next === cur) return;
  cache.set(sessionId, next);
  writeStored(askStorageKey(sessionId), serializeAskEntries(next));
  listeners.get(sessionId)?.forEach((fn) => fn());
}
function subscribeAskEntries(sessionId, listener) {
  let set = listeners.get(sessionId);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    listeners.set(sessionId, set);
  }
  const bucket = set;
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
}
function useAskEntries(sessionId) {
  const sid = sessionId ?? "";
  const subscribe = (0, import_react10.useCallback)((listener) => subscribeAskEntries(sid, listener), [sid]);
  return (0, import_react10.useSyncExternalStore)(
    subscribe,
    () => loadAskEntries(sid),
    () => EMPTY
  );
}

// src/client/ask/register.ts
var NO_QUESTION_TEXT = "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002";
function registerAskLlm(ctx) {
  setAskLlmRemote((sessionId, commandText) => ctx.remote.commands.execute(sessionId, commandText, []));
  setAskFollowupImpl(async (sessionId, card, index, tree) => {
    try {
      const question = card.followups[index]?.question;
      if (typeof question !== "string" || question.trim() === "") return { ok: false, error: NO_QUESTION_TEXT };
      const path = buildContextPath(tree, card, Number.POSITIVE_INFINITY);
      const r = await askFollowupLlm(sessionId, buildContextPath(tree, card), question);
      if (!r.ok) return { ok: false, error: r.error };
      addAskAnswer(
        sessionId,
        buildAskEntry({
          parent: card,
          index,
          followup: card.followups[index],
          explored: path.flatMap((n) => n.knowledgeIds),
          question,
          answer: r.text,
          followups: r.followups,
          now: Date.now(),
          token: randomToken()
        })
      );
      return { ok: true };
    } catch (error) {
      console.warn("[dlogic] direct follow-up failed:", error);
      return { ok: false, error: NO_QUESTION_TEXT };
    }
  });
}

// src/client/sidechat/register.ts
var import_react11 = require("react");
var FAIL_TEXT2 = "\u8FFD\u95EE\u672A\u80FD\u53D1\u9001\uFF0C\u8BF7\u91CD\u8BD5\u3002";
var services = null;
function currentChildIds(parentId) {
  try {
    const s = services;
    if (!s) return [];
    return selectAllFollowupChildren(s.sessions.list.getSnapshot(), parentId);
  } catch {
    return [];
  }
}
function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
var queues = /* @__PURE__ */ new Map();
function enqueue(key, task) {
  const prev = queues.get(key) ?? Promise.resolve();
  const next = prev.then(task, task);
  const settled = next.catch(() => void 0);
  queues.set(key, settled);
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key);
  });
  return next;
}
async function createChild(ctx, sessionId, prompt) {
  try {
    const payload = JSON.stringify({ v: 1, prompt });
    const r = await ctx.remote.commands.execute(sessionId, `/${FOLLOWUP_COMMAND} ${payload}`, []);
    if (r && r.ok && r.value !== void 0 && r.value.result && r.value.result.kind === "success") return { ok: true };
    console.warn("[dlogic] follow-up command rejected:", r && (r.ok ? r.value : r.error));
    return { ok: false, error: r?.ok && r.value?.result?.text ? String(r.value.result.text) : FAIL_TEXT2 };
  } catch (error) {
    console.warn("[dlogic] follow-up command failed:", error);
    return { ok: false, error: FAIL_TEXT2 };
  }
}
async function refreshCatalog(ctx, sessionId) {
  const sessions = ctx.sessions;
  if (typeof sessions.refreshSubagents === "function") await sessions.refreshSubagents(sessionId);
  else if (typeof sessions.refreshProjections === "function") await sessions.refreshProjections(sessionId);
}
async function runAsk(ctx, sessionId, prompt) {
  try {
    await refreshCatalog(ctx, sessionId);
  } catch {
  }
  return createChild(ctx, sessionId, prompt);
}
function registerSidechat(ctx) {
  services = ctx;
  setAskFollowupImpl(async (sessionId, card, index, tree) => {
    try {
      const followup = card.followups?.[index];
      if (!sessionId || !followup) return { ok: false, error: FAIL_TEXT2 };
      const fctx = {
        path: buildContextPath(tree, card, PATH_CAP),
        parentNodeId: card.nodeId,
        followupIndex: index,
        question: followup.question
      };
      const prompt = buildFollowupPrompt(fctx);
      return await enqueue(sessionId, () => runAsk(ctx, sessionId, prompt));
    } catch {
      return { ok: false, error: FAIL_TEXT2 };
    }
  });
}
function useFollowupChildIds(sessionId) {
  const [childIds, setChildIds] = (0, import_react11.useState)(() => sessionId ? currentChildIds(sessionId) : []);
  (0, import_react11.useEffect)(() => {
    const s = services;
    if (!s || !sessionId) {
      setChildIds(EMPTY_IDS);
      return;
    }
    let alive = true;
    const update = () => {
      if (!alive) return;
      const next = currentChildIds(sessionId);
      setChildIds((prev) => sameIds(prev, next) ? prev : next);
    };
    update();
    let unsubscribe;
    try {
      unsubscribe = s.sessions.list.subscribe(update);
    } catch {
      unsubscribe = void 0;
    }
    try {
      void refreshCatalog(s, sessionId).then(update, update);
    } catch {
    }
    return () => {
      alive = false;
      if (typeof unsubscribe === "function") unsubscribe();
      else if (unsubscribe && typeof unsubscribe.unsubscribe === "function") {
        ;
        unsubscribe.unsubscribe();
      }
    };
  }, [sessionId]);
  return childIds;
}
var EMPTY_IDS = [];
function useRetainedChild(parentId, childId) {
  const [handle, setHandle] = (0, import_react11.useState)(void 0);
  (0, import_react11.useEffect)(() => {
    const s = services;
    if (!s || !parentId || !childId) {
      setHandle(void 0);
      return;
    }
    let ref;
    try {
      ref = s.sessions.retain(
        { parentSessionId: parentId, childSessionId: childId, mode: "continuable" },
        { source: "dlogicSidechatView", signal: new AbortController().signal }
      );
    } catch {
      ref = void 0;
    }
    setHandle(ref);
    return () => {
      try {
        ref?.release?.();
      } catch {
      }
      setHandle(void 0);
    };
  }, [parentId, childId]);
  return handle;
}
function openSideChatFullscreen(parentId, childId) {
  try {
    const s = services;
    if (!s) return false;
    const address = { parentSessionId: parentId, childSessionId: childId, mode: "continuable" };
    if (typeof s.sessions.openSubagent === "function") {
      void Promise.resolve(s.sessions.openSubagent(address)).catch(() => void 0);
      return true;
    }
    const workspace = typeof s.get === "function" ? s.get("uiWorkspace") : void 0;
    if (workspace && typeof workspace.openSession === "function") {
      workspace.openSession(address);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// src/client/sidechat/SideChatPanel.tsx
var import_react12 = require("react");
function FixedChatView(props) {
  return props.renderSlot("conversation.session", { view: "chat" });
}
function SideChatPanel(props) {
  const { sessionId, useSession, useConversation, useSessions, renderFactorySlot } = props;
  const session = useSession((v) => v);
  const shellPhase = useConversation((v) => v).activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
  const summaryBlank = useSessions((s) => s.byId[sessionId ?? ""]?.blank);
  const settling = shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true;
  const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
  return renderFactorySlot(
    "conversation.content",
    { variant: "embedded", phase: settling ? "settling" : hero ? "hero" : "active", hero },
    { slots: { views: FixedChatView } }
  );
}
function SideChatCollector(props) {
  const project = props.useProjection;
  const view = project ? project(TREE_PROJECTION_KEY) : void 0;
  const onNodes = props.onNodes;
  (0, import_react12.useEffect)(() => {
    onNodes?.(Array.isArray(view?.nodes) ? view.nodes : []);
  }, [view, onNodes]);
  return null;
}

// src/client/tree/TreeTab.tsx
var import_react17 = require("react");

// src/client/ask/AskList.tsx
var import_react13 = require("react");

// src/client/ask/links.ts
var STOPWORDS = /* @__PURE__ */ new Set([
  "\u5B9E\u73B0",
  "\u7535\u5E73",
  "\u7EA7\u8054",
  "\u8F93\u5165",
  "\u8F93\u51FA",
  "\u4FE1\u53F7",
  "\u7535\u8DEF",
  "\u65B9\u6CD5",
  "\u7ED3\u679C",
  "\u6761\u4EF6",
  "\u53D8\u5316",
  "\u529F\u80FD",
  "\u63CF\u8FF0",
  "\u57FA\u672C",
  "\u6982\u5FF5",
  "\u7CFB\u7EDF",
  "\u8BBE\u8BA1",
  "\u5206\u6790",
  "\u5E94\u7528",
  "\u539F\u7406",
  "\u6570\u636E",
  "\u63A7\u5236"
]);
var MIN_TERM = 2;
var cachedIndex;
function buildTermIndex(kb = defaultKnowledgeBase()) {
  const terms = /* @__PURE__ */ new Map();
  const titles = /* @__PURE__ */ new Map();
  let maxLen = 0;
  for (const node of kb.nodes) {
    titles.set(node.id, node.title);
    const words = [node.title, ...node.keywords];
    for (const raw of words) {
      const word = typeof raw === "string" ? raw.trim() : "";
      if (word.length < MIN_TERM || STOPWORDS.has(word)) continue;
      const key = word.toLowerCase();
      const ids = terms.get(key);
      if (!ids) terms.set(key, [node.id]);
      else if (!ids.includes(node.id)) ids.push(node.id);
      maxLen = Math.max(maxLen, key.length);
    }
  }
  return { terms, titles, maxLen };
}
function defaultTermIndex() {
  if (!cachedIndex) cachedIndex = buildTermIndex();
  return cachedIndex;
}
function conceptQuestion(title) {
  return `\u300C${title}\u300D\u662F\u4EC0\u4E48\uFF1F`;
}
function isAsciiWord(ch) {
  return ch !== void 0 && /[A-Za-z0-9]/.test(ch);
}
function sharedSegments(a, b) {
  const sa = a.split(".");
  const sb = b.split(".");
  let n = 0;
  while (n < sa.length && n < sb.length && sa[n] === sb[n]) n++;
  return n;
}
function pickId(ids, focusIds) {
  const chapterOf = (id) => id.split(".")[0];
  const rank2 = (id) => ({
    otherChapter: focusIds.some((f) => chapterOf(f) === chapterOf(id)) ? 0 : 1,
    shared: focusIds.reduce((m, f) => Math.max(m, sharedSegments(f, id)), 0),
    depth: id.split(".").length
  });
  const sorted = [...ids].sort((a, b) => {
    const ra = rank2(a);
    const rb = rank2(b);
    return ra.otherChapter - rb.otherChapter || rb.shared - ra.shared || rb.depth - ra.depth || (a < b ? -1 : a > b ? 1 : 0);
  });
  return sorted[0];
}
function linkify(text, ctx) {
  try {
    if (typeof text !== "string" || text === "") return [];
    const index = ctx.index ?? defaultTermIndex();
    const focusIds = ctx.focusIds ?? [];
    const explored = ctx.exploredIds ?? /* @__PURE__ */ new Set();
    const out = [];
    const linked = /* @__PURE__ */ new Set();
    const pushPlain = (s) => {
      if (s === "") return;
      const last = out[out.length - 1];
      if (last && !("nodeId" in last)) last.text += s;
      else out.push({ text: s });
    };
    const scan = (seg) => {
      const lower = seg.toLowerCase().length === seg.length ? seg.toLowerCase() : seg;
      let buf = "";
      let i = 0;
      while (i < seg.length) {
        const hit = matchAt(lower, seg, i, index);
        if (!hit) {
          buf += seg[i];
          i++;
          continue;
        }
        pushPlain(buf);
        buf = "";
        const span = seg.slice(i, i + hit.len);
        const nodeId = pickId(hit.ids, focusIds);
        if (!explored.has(nodeId) && !linked.has(nodeId)) {
          out.push({ text: span, nodeId, title: index.titles.get(nodeId) ?? span });
          linked.add(nodeId);
        } else {
          pushPlain(span);
        }
        i += hit.len;
      }
      pushPlain(buf);
    };
    text.split(/(`[^`]*`)/).forEach((part, idx) => {
      if (idx % 2 === 1) pushPlain(part);
      else scan(part);
    });
    return out;
  } catch {
    return [{ text }];
  }
}
function matchAt(lower, seg, i, index) {
  const max = Math.min(index.maxLen, seg.length - i);
  for (let len = max; len >= MIN_TERM; len--) {
    const ids = index.terms.get(lower.slice(i, i + len));
    if (!ids) continue;
    const first = seg[i];
    const last = seg[i + len - 1];
    if (isAsciiWord(first) && isAsciiWord(seg[i - 1])) continue;
    if (isAsciiWord(last) && isAsciiWord(seg[i + len])) continue;
    return { len, ids };
  }
  return null;
}

// src/client/ask/plainMath.ts
var SYMBOLS = {
  cdot: "\xB7",
  oplus: "\u2295",
  times: "\xD7",
  land: "\u2227",
  lor: "\u2228",
  neg: "\xAC",
  lnot: "\xAC",
  leq: "\u2264",
  geq: "\u2265",
  neq: "\u2260",
  rightarrow: "\u2192",
  to: "\u2192",
  Rightarrow: "\u21D2",
  sum: "\u03A3",
  prod: "\u220F",
  ldots: "\u2026",
  cdots: "\u2026",
  dots: "\u2026",
  quad: " ",
  qquad: " "
};
var WRAPPERS = /* @__PURE__ */ new Set(["text", "mathrm", "mathbf", "mathit", "textbf", "mathsf", "texttt", "operatorname"]);
var SUPERSCRIPT = {
  "0": "\u2070",
  "1": "\xB9",
  "2": "\xB2",
  "3": "\xB3",
  "4": "\u2074",
  "5": "\u2075",
  "6": "\u2076",
  "7": "\u2077",
  "8": "\u2078",
  "9": "\u2079"
};
var SUBSCRIPT = {
  "0": "\u2080",
  "1": "\u2081",
  "2": "\u2082",
  "3": "\u2083",
  "4": "\u2084",
  "5": "\u2085",
  "6": "\u2086",
  "7": "\u2087",
  "8": "\u2088",
  "9": "\u2089"
};
function readArg(s, i) {
  if (i >= s.length) return null;
  if (s[i] !== "{") return { arg: s[i], next: i + 1 };
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "{") depth++;
    else if (s[j] === "}") {
      depth--;
      if (depth === 0) return { arg: s.slice(i + 1, j), next: j + 1 };
    }
  }
  return null;
}
function negate(inner) {
  const t = inner.trim().replace(/_\{([A-Za-z0-9]+)\}/g, "_$1");
  if (/^[A-Za-z](?:[0-9]+|_[A-Za-z0-9]+)?$/.test(t)) return t + "'";
  return `(${t})'`;
}
function skipOneSpace(s, i) {
  return s[i] === " " ? i + 1 : i;
}
function convertCommands(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      i++;
      continue;
    }
    const next = s[i + 1];
    if (next === void 0) {
      i++;
      continue;
    }
    if (next === "," || next === ";" || next === " ") {
      out += " ";
      i += 2;
      continue;
    }
    if (next === "!") {
      i += 2;
      continue;
    }
    if (next === "{" || next === "}" || next === "_" || next === "%" || next === "&" || next === "#") {
      out += next === "{" ? "" : next === "}" ? "" : next;
      i += 2;
      continue;
    }
    const m = /^[A-Za-z]+/.exec(s.slice(i + 1));
    if (!m) {
      i++;
      continue;
    }
    const name = m[0];
    const after = i + 1 + name.length;
    if (name === "frac") {
      const a = readArg(s, after);
      const b = a ? readArg(s, a.next) : null;
      if (a && b) {
        out += `(${convertCommands(a.arg)})/(${convertCommands(b.arg)})`;
        i = b.next;
        continue;
      }
    } else if (name === "overline" || name === "bar") {
      const a = readArg(s, after);
      if (a) {
        out += negate(convertCommands(a.arg));
        i = a.next;
        continue;
      }
    } else if (WRAPPERS.has(name)) {
      const a = readArg(s, after);
      if (a) {
        out += convertCommands(a.arg);
        i = a.next;
        continue;
      }
    } else if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) {
      out += SYMBOLS[name];
      i = skipOneSpace(s, after);
      continue;
    }
    i = skipOneSpace(s, after);
  }
  return out;
}
function convertScripts(s) {
  const sub = (content) => /^\d+$/.test(content) ? Array.from(content, (d) => SUBSCRIPT[d]).join("") : `_${content}`;
  const sup = (content) => /^\d+$/.test(content) ? Array.from(content, (d) => SUPERSCRIPT[d]).join("") : `^${content}`;
  return s.replace(/_\{([^{}]*)\}|_([A-Za-z0-9])/g, (_m, a, b) => sub(a ?? b ?? "")).replace(/\^\{([^{}]*)\}|\^([A-Za-z0-9])/g, (_m, a, b) => sup(a ?? b ?? ""));
}
function convertSegment(seg) {
  const stripped = seg.replace(/\$\$/g, "").replace(/\$/g, "").replace(/\\[()[\]]/g, "");
  if (!stripped.includes("\\") && !/[_^]/.test(stripped)) return stripped;
  let s = convertCommands(stripped);
  s = convertScripts(s);
  s = s.replace(/[{}]/g, "");
  return s.replace(/\u0001/g, "{").replace(/\u0002/g, "}");
}
function plainMath(text) {
  try {
    if (typeof text !== "string" || !text.includes("\\") && !text.includes("$")) return text;
    const parts = text.split(/(`[^`]*`)/);
    return parts.map((p, idx) => idx % 2 === 1 ? p : convertSegment(p)).join("");
  } catch {
    return text;
  }
}

// src/client/ask/AskList.tsx
var import_jsx_runtime21 = require("react/jsx-runtime");
function LinkedText({ text, links }) {
  const segs = linkify(text, { focusIds: links.focusIds, exploredIds: links.exploredIds });
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_jsx_runtime21.Fragment, { children: segs.map((s, i) => {
    if (!("nodeId" in s)) return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(import_react13.Fragment, { children: s.text }, i);
    const busy = links.busyNodeId === s.nodeId;
    const fire = () => links.onLink(s.nodeId, s.text);
    return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(
      "a",
      {
        role: "button",
        tabIndex: 0,
        title: s.title,
        "aria-busy": busy || void 0,
        className: c("ask-link") + (busy ? " " + c("ask-link-busy") : ""),
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          fire();
        },
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            fire();
          }
        },
        children: s.text
      },
      i
    );
  }) });
}
function AnswerText({ text, links }) {
  const plain = plainMath(text);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: c("ask-a"), children: links ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(LinkedText, { text: plain, links }) : plain });
}
function AskList({ entries }) {
  const ref = (0, import_react13.useRef)(null);
  (0, import_react13.useEffect)(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { ref, className: c("ask-list"), children: entries.map((e) => /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)("div", { className: c("ask-item"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { className: c("ask-q"), children: plainMath(e.card.title) }),
    /* @__PURE__ */ (0, import_jsx_runtime21.jsx)(AnswerText, { text: e.answer })
  ] }, e.card.callId)) });
}

// src/shared/tree.ts
function knowledgeLabels(card) {
  const names = card.knowledgeNames;
  if (Array.isArray(names) && names.length === card.knowledgeIds.length && names.every((n) => typeof n === "string" && n !== "")) {
    return names;
  }
  return card.knowledgeIds;
}
function buildForest(view) {
  const seen = /* @__PURE__ */ new Set();
  const uniq = [];
  for (const c2 of view.nodes) {
    if (seen.has(c2.nodeId)) continue;
    seen.add(c2.nodeId);
    uniq.push(c2);
  }
  const byId = new Map(uniq.map((c2) => [c2.nodeId, c2]));
  const kids = /* @__PURE__ */ new Map();
  const roots = [];
  for (const c2 of uniq) {
    if (c2.parentId && c2.parentId !== c2.nodeId && byId.has(c2.parentId)) {
      const list = kids.get(c2.parentId);
      if (list) list.push(c2);
      else kids.set(c2.parentId, [c2]);
    } else {
      roots.push(c2);
    }
  }
  const placed = /* @__PURE__ */ new Set();
  const build = (card, parentId, slot) => {
    placed.add(card.nodeId);
    const followups = card.followups;
    const slotted = /* @__PURE__ */ new Map();
    const unslotted = [];
    for (const k of kids.get(card.nodeId) ?? []) {
      if (placed.has(k.nodeId)) continue;
      const pf = k.parentFollowup;
      if (typeof pf === "number" && Number.isInteger(pf) && pf >= 0 && pf < followups.length) {
        const list = slotted.get(pf);
        if (list) list.push(k);
        else slotted.set(pf, [k]);
      } else {
        unslotted.push(k);
      }
    }
    const children = [];
    for (let i = 0; i < followups.length; i++) {
      const expanded = slotted.get(i);
      if (expanded && expanded.length > 0) {
        for (const k of expanded) children.push(build(k, card.nodeId, { index: i, followup: followups[i] }));
      } else {
        children.push({
          id: `${card.nodeId}#${i}`,
          kind: "stub",
          followup: followups[i],
          followupIndex: i,
          parentId: card.nodeId,
          children: []
        });
      }
    }
    for (const k of unslotted) children.push(build(k, card.nodeId));
    const vm = { id: card.nodeId, kind: "card", card, parentId, children };
    if (slot) {
      vm.followup = slot.followup;
      vm.followupIndex = slot.index;
    }
    return vm;
  };
  const forest = [];
  for (const r of roots) {
    if (!placed.has(r.nodeId)) forest.push(build(r, null));
  }
  for (const c2 of uniq) {
    if (!placed.has(c2.nodeId)) forest.push(build(c2, null));
  }
  return forest;
}

// src/client/ask/synth.ts
var TITLE_JOIN_MAX = 30;
var SYNTH_SUMMARY_MAX = 80;
var SUMMARY_STEPS = [SYNTH_SUMMARY_MAX, 40, 20, 0];
var TITLE_LINE_MAX = 30;
var SYNTH_QUESTION_BUDGET = 1e4;
function clipChars2(text, max) {
  if (max <= 0) return "";
  const chars = Array.from(text);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "\u2026" : text;
}
function cardLine(index, title, summary, summaryMax) {
  const s = clipChars2(summary, summaryMax);
  return s === "" ? `${index + 1}. ${title}` : `${index + 1}. ${title}\uFF1A${s}`;
}
function cardLines(cards, prefixLength) {
  const fits = (text) => prefixLength + text.length <= SYNTH_QUESTION_BUDGET;
  for (const max of SUMMARY_STEPS) {
    const text = cards.map((c2, i) => cardLine(i, c2.title, c2.summary, max)).join("\n");
    if (fits(text)) return text;
  }
  const lines = cards.map((c2, i) => cardLine(i, clipChars2(c2.title, TITLE_LINE_MAX), "", 0));
  for (let n = lines.length; n > 0; n--) {
    const dropped = lines.length - n;
    const text = lines.slice(0, n).join("\n") + (dropped > 0 ? `
\u2026\uFF08\u53E6\u6709 ${dropped} \u5F20\u5361\u7247\u672A\u5217\u51FA\uFF09` : "");
    if (fits(text)) return text;
  }
  return `\u2026\uFF08\u53E6\u6709 ${cards.length} \u5F20\u5361\u7247\u672A\u5217\u51FA\uFF09`;
}
var SYNTH_RULES = "\u5F15\u7528\u5361\u7247\u65F6\u5FC5\u987B\u4F7F\u7528\u5361\u7247\u6807\u9898\uFF08\u53EF\u52A0\u4E66\u540D\u53F7\uFF09\uFF0C\u4E0D\u8981\u4F7F\u7528\u201C\u53611\u201D\u201C\u5361\u72471\u201D\u8FD9\u7C7B\u7F16\u53F7\u3002\u7528\u7EAF\u6587\u672C\u4F5C\u7B54\uFF0C\u4E0D\u8981\u4F7F\u7528 LaTeX\u3001\\(\\)\u3001$ \u7B49\u6570\u5B66\u6807\u8BB0\u3002";
var SYNTH_INSTRUCTIONS = {
  compare: "\u8BF7\u5BF9\u6BD4\u4EE5\u4E0B\u5361\u7247\u6D89\u53CA\u7684\u77E5\u8BC6\u70B9\uFF1A\u5217\u51FA\u76F8\u540C\u70B9\u3001\u4E0D\u540C\u70B9\u3001\u5404\u81EA\u9002\u7528\u573A\u5408\u4E0E\u6613\u6DF7\u6DC6\u5904\uFF0C\u6761\u7406\u6E05\u6670\uFF0C\u4E0D\u8D85\u8FC7 400 \u5B57\u3002",
  summary: "\u8BF7\u7528\u7B80\u6D01\u7684\u8BED\u8A00\u603B\u7ED3\u4EE5\u4E0B\u5361\u7247\u7684\u6838\u5FC3\u5185\u5BB9\uFF0C\u4E0D\u8D85\u8FC7 300 \u5B57\u3002",
  outline: "\u8BF7\u4E3A\u4EE5\u4E0B\u5168\u90E8\u5361\u7247\u751F\u6210\u4E00\u4EFD\u590D\u4E60\u63D0\u7EB2\uFF1A\u6309\u77E5\u8BC6\u70B9\u5206\u5C42\u7684\u8981\u70B9\u5217\u8868\uFF0C\u6307\u51FA\u91CD\u70B9\u3001\u6613\u9519\u70B9\u548C\u5EFA\u8BAE\u590D\u4E60\u987A\u5E8F\uFF0C\u4E0D\u8D85\u8FC7 600 \u5B57\u3002"
};
function buildSynthQuestion(kind, cards) {
  const head = `${SYNTH_INSTRUCTIONS[kind]}${SYNTH_RULES}\u5361\u7247\uFF1A
`;
  return head + cardLines(cards, head.length);
}
function synthTitle(kind, sources) {
  if (kind === "outline") return "\u590D\u4E60\u63D0\u7EB2";
  const chars = Array.from(sources.map((s) => s.title).join("\u3001"));
  const joined = chars.length > TITLE_JOIN_MAX ? chars.slice(0, TITLE_JOIN_MAX).join("") + "\u2026" : chars.join("");
  return kind === "compare" ? `\u5BF9\u6BD4\uFF1A${joined}` : `\u603B\u7ED3\uFF1A${joined}`;
}
function buildSynthEntry(input) {
  const ids = [];
  const names = /* @__PURE__ */ new Map();
  for (const s of input.sources) {
    s.knowledgeIds.forEach((id, i) => {
      if (!ids.includes(id)) ids.push(id);
      const name = s.knowledgeNames?.length === s.knowledgeIds.length ? s.knowledgeNames[i] : void 0;
      if (typeof name === "string" && name !== "" && !names.has(id)) names.set(id, name);
    });
  }
  const allNamed = ids.length > 0 && ids.every((id) => names.has(id));
  return {
    answer: input.answer,
    card: {
      nodeId: `s${input.now.toString(36)}${input.token}`,
      callId: `llm-${input.now}-${input.token}`,
      title: synthTitle(input.kind, input.sources),
      summary: answerSummary(input.answer),
      kind: input.kind === "compare" ? "compare" : "summary",
      knowledgeIds: ids,
      ...allNamed ? { knowledgeNames: ids.map((id) => names.get(id)) } : {},
      followups: toFollowups(input.followups),
      parentId: null,
      ...input.sources.length > 0 ? { sources: input.sources.map((s) => s.nodeId) } : {}
    }
  };
}
function cardPath(cards, nodeId) {
  const byId = /* @__PURE__ */ new Map();
  for (const c2 of cards) if (!byId.has(c2.nodeId)) byId.set(c2.nodeId, c2);
  const start = byId.get(nodeId);
  if (!start) return [];
  const chain = [start];
  const seen = /* @__PURE__ */ new Set([start.nodeId]);
  let cur = start;
  while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.parentId)) {
    cur = byId.get(cur.parentId);
    seen.add(cur.nodeId);
    chain.unshift(cur);
  }
  return chain;
}
var BRANCH_PREFIX = "\u4EE5\u4E0B\u662F\u6211\u5728\u5B66\u4E60\u6811\u4E2D\u7684\u4E00\u6761\u5B66\u4E60\u5206\u652F\uFF0C\u8BF7\u57FA\u4E8E\u5B83\u7EE7\u7EED\uFF1A";
function branchMarkdown(path, answers) {
  const parts = [BRANCH_PREFIX];
  path.forEach((card, i) => {
    const kn = card.knowledgeIds.length > 0 ? knowledgeLabels(card).join("\u3001") : "\u65E0";
    const body = (answers.get(card.callId) ?? card.summary).trim();
    parts.push("", `### ${i + 1}. ${card.title}`, `\u77E5\u8BC6\u70B9\uFF1A${kn}`, "", body);
  });
  return parts.join("\n");
}

// src/client/tree/merge.ts
function mergeCards(main, child) {
  const seen = /* @__PURE__ */ new Set();
  const usedIds = /* @__PURE__ */ new Set();
  const out = [];
  for (const card of main) {
    if (seen.has(card.callId)) continue;
    seen.add(card.callId);
    usedIds.add(card.nodeId);
    out.push(card);
  }
  for (const card of child) {
    if (seen.has(card.callId)) continue;
    seen.add(card.callId);
    let nodeId = card.nodeId;
    if (usedIds.has(nodeId)) {
      let k = 2;
      while (usedIds.has(`${card.nodeId}-${k}`)) k++;
      nodeId = `${card.nodeId}-${k}`;
    }
    usedIds.add(nodeId);
    out.push(nodeId === card.nodeId ? card : { ...card, nodeId });
  }
  return out;
}
function childOnlyCallIds(main, child) {
  const mainIds = new Set(main.map((c2) => c2.callId));
  const out = /* @__PURE__ */ new Set();
  for (const c2 of child) if (!mainIds.has(c2.callId)) out.add(c2.callId);
  return out;
}
function sameCards(a, b) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i].callId !== b[i].callId || a[i].nodeId !== b[i].nodeId) return false;
  return true;
}
function pendingSlotKeys(sent, filled, now, timeoutMs) {
  const out = /* @__PURE__ */ new Set();
  for (const [key, at] of sent) {
    if (filled.has(key)) continue;
    if (now - at < timeoutMs) out.add(key);
  }
  return out;
}

// src/client/tree/synthesize.ts
var OUTLINE_CAP = 40;
async function synthesize(sessionId, kind, cards) {
  const used = kind === "outline" ? cards.slice(0, OUTLINE_CAP) : cards.slice();
  if (used.length === 0) return { ok: false, error: "\u6CA1\u6709\u53EF\u7528\u7684\u5361\u7247\u3002" };
  const question = buildSynthQuestion(kind, used);
  const path = used.map((n) => ({ nodeId: n.nodeId, title: n.title, summary: n.summary, knowledgeIds: n.knowledgeIds }));
  try {
    const r = await askFollowupLlm(sessionId, path, question);
    if (!r.ok) return { ok: false, error: r.error };
    const entry = buildSynthEntry({ kind, sources: used, answer: r.text, followups: r.followups, now: Date.now(), token: randomToken() });
    addAskAnswer(sessionId, entry);
    return { ok: true, nodeId: entry.card.nodeId };
  } catch (error) {
    console.warn("[dlogic] synth failed:", error);
    return { ok: false, error: "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002" };
  }
}
async function copyText(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  try {
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    if (ta.parentNode) ta.parentNode.removeChild(ta);
  }
}

// src/client/tree/TreeCanvas.tsx
var import_react15 = require("react");

// src/shared/treeLayout.ts
var COL_GAP = 48;
var ROW_GAP = 12;
var ROOT_GAP = 24;
var EDGE_CTRL_MIN = 24;
function edgePath(parent, child) {
  const sx = parent.x + parent.w;
  const sy = parent.y + parent.h / 2;
  const ex = child.x;
  const ey = child.y + child.h / 2;
  const off = Math.max(EDGE_CTRL_MIN, (ex - sx) / 2);
  return `M ${sx} ${sy} C ${sx + off} ${sy} ${ex - off} ${ey} ${ex} ${ey}`;
}
function layoutForest(roots, sizeOf) {
  const sizes = /* @__PURE__ */ new Map();
  const sizeFor = (n) => {
    let s = sizes.get(n.id);
    if (!s) {
      const r = sizeOf(n.id);
      s = { w: Math.max(0, Number(r.w) || 0), h: Math.max(0, Number(r.h) || 0) };
      sizes.set(n.id, s);
    }
    return s;
  };
  const heights = /* @__PURE__ */ new Map();
  const subtreeHeight = (n) => {
    const cached2 = heights.get(n);
    if (cached2 !== void 0) return cached2;
    let stack = 0;
    n.children.forEach((c2, i) => {
      stack += (i > 0 ? ROW_GAP : 0) + subtreeHeight(c2);
    });
    const h = Math.max(sizeFor(n).h, stack);
    heights.set(n, h);
    return h;
  };
  const boxes = /* @__PURE__ */ new Map();
  const edges = [];
  const stackHeight = (n) => {
    let stack = 0;
    n.children.forEach((c2, i) => {
      stack += (i > 0 ? ROW_GAP : 0) + subtreeHeight(c2);
    });
    return stack;
  };
  const place = (n, x, y) => {
    const s = sizeFor(n);
    const band = subtreeHeight(n);
    const box = { x, y: y + (band - s.h) / 2, w: s.w, h: s.h };
    boxes.set(n.id, box);
    const childX = x + s.w + COL_GAP;
    let cy = y + (band - stackHeight(n)) / 2;
    for (const c2 of n.children) {
      place(c2, childX, cy);
      cy += subtreeHeight(c2) + ROW_GAP;
    }
    if (n.children.length > 0) {
      const first = boxes.get(n.children[0].id);
      const last = boxes.get(n.children[n.children.length - 1].id);
      const mid = (first.y + first.h / 2 + last.y + last.h / 2) / 2;
      box.y = Math.min(Math.max(mid - s.h / 2, y), y + band - s.h);
    }
    for (const c2 of n.children) edges.push({ from: n.id, to: c2.id, path: edgePath(box, boxes.get(c2.id)) });
  };
  let ry = 0;
  for (const r of roots) {
    place(r, 0, ry);
    ry += subtreeHeight(r) + ROOT_GAP;
  }
  let width = 0;
  let height = 0;
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w);
    height = Math.max(height, b.y + b.h);
  }
  return { boxes, edges, width, height };
}
var INDENT = 16;
var INDENT_ROW_GAP = 8;
var INDENT_ROOT_GAP = 16;
var INDENT_MIN_W = 160;
var INDENT_ANCHOR_MAX = 18;
function elbowPath(parent, child) {
  const sx = parent.x + 8;
  const sy = parent.y + parent.h;
  const ex = child.x;
  const ey = child.y + Math.min(child.h / 2, INDENT_ANCHOR_MAX);
  return `M ${sx} ${sy} V ${ey} H ${ex}`;
}
function layoutIndented(roots, sizeOf, opts) {
  const hOf = (n) => Math.max(0, Number(sizeOf(n.id).h) || 0);
  const boxes = /* @__PURE__ */ new Map();
  const edges = [];
  let y = 0;
  const place = (n, depth, parent) => {
    const x = depth * INDENT;
    const w = Math.max(INDENT_MIN_W, opts.width - x);
    const box = { x, y, w, h: hOf(n) };
    boxes.set(n.id, box);
    if (parent) edges.push({ from: parent.id, to: n.id, path: elbowPath(parent.box, box) });
    y += box.h + INDENT_ROW_GAP;
    for (const c2 of n.children) place(c2, depth + 1, { id: n.id, box });
  };
  roots.forEach((r, i) => {
    if (i > 0) y += INDENT_ROOT_GAP - INDENT_ROW_GAP;
    place(r, 0, null);
  });
  let width = 0;
  let height = 0;
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w);
    height = Math.max(height, b.y + b.h);
  }
  return { boxes, edges, width, height };
}
function sourceEdgePath(src, dst) {
  const sx = src.x + src.w;
  const sy = src.y + src.h / 2;
  const ex = dst.x;
  const ey = dst.y + dst.h / 2;
  const off = Math.max(EDGE_CTRL_MIN, (ex - sx) / 2);
  return `M ${sx} ${sy} C ${sx + off} ${sy} ${ex - off} ${ey} ${ex} ${ey}`;
}
function sourceEdges(cards, boxes) {
  const out = [];
  for (const card of cards) {
    if (!card.sources || card.sources.length === 0) continue;
    const dst = boxes.get(card.nodeId);
    if (!dst) continue;
    for (const s of new Set(card.sources)) {
      if (s === card.nodeId) continue;
      const src = boxes.get(s);
      if (!src) continue;
      out.push({ from: s, to: card.nodeId, path: sourceEdgePath(src, dst) });
    }
  }
  return out;
}
var finite = (x) => typeof x === "number" && Number.isFinite(x) ? x : 0;
function applyOffsets(layout, roots, offsets, style = "forest") {
  if (Object.keys(offsets).length === 0) return layout;
  const shift = /* @__PURE__ */ new Map();
  const walk = (n, dx, dy) => {
    const o = Object.prototype.hasOwnProperty.call(offsets, n.id) ? offsets[n.id] : void 0;
    const total = { dx: dx + finite(o?.dx), dy: dy + finite(o?.dy) };
    shift.set(n.id, total);
    for (const c2 of n.children) walk(c2, total.dx, total.dy);
  };
  for (const r of roots) walk(r, 0, 0);
  const boxes = /* @__PURE__ */ new Map();
  let minX = 0;
  let minY = 0;
  for (const [id, b] of layout.boxes) {
    const s = shift.get(id) ?? { dx: 0, dy: 0 };
    const box = { x: b.x + s.dx, y: b.y + s.dy, w: b.w, h: b.h };
    boxes.set(id, box);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
  }
  if (minX < 0 || minY < 0) {
    for (const [id, b] of boxes) boxes.set(id, { ...b, x: b.x - minX, y: b.y - minY });
  }
  const edges = layout.edges.map((e) => {
    const p = boxes.get(e.from);
    const c2 = boxes.get(e.to);
    return { from: e.from, to: e.to, path: style === "indented" ? elbowPath(p, c2) : edgePath(p, c2) };
  });
  let width = 0;
  let height = 0;
  for (const b of boxes.values()) {
    width = Math.max(width, b.x + b.w);
    height = Math.max(height, b.y + b.h);
  }
  return { boxes, edges, width, height };
}

// src/client/ask/FreeAskInput.tsx
var import_react14 = require("react");
var import_jsx_runtime22 = require("react/jsx-runtime");
var FREE_ASK_MAX = 1e3;
function FreeAskInput({ t, onSend }) {
  const [value, setValue] = (0, import_react14.useState)("");
  const [busy, setBusy] = (0, import_react14.useState)(false);
  const [error, setError] = (0, import_react14.useState)(null);
  const send = async () => {
    const text = value.trim();
    if (busy || text === "") return;
    if (text.length > FREE_ASK_MAX) {
      setError(fmt(t, "tree.freeAskTooLong", { n: FREE_ASK_MAX }));
      return;
    }
    setBusy(true);
    setError(null);
    let err;
    try {
      err = await onSend(text);
    } catch {
      err = t("tree.askFailed");
    }
    setBusy(false);
    if (err) setError(err);
    else setValue("");
  };
  return (
    // 卡片本身可点击展开/收起且响应空格、回车，这里阻止冒泡，避免输入时误触，也避免拖动卡片。
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(
      "div",
      {
        className: c("ask-free"),
        onClick: (e) => e.stopPropagation(),
        onPointerDown: (e) => e.stopPropagation(),
        onKeyDown: (e) => e.stopPropagation(),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)("div", { className: c("ask-free-row"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(
              "input",
              {
                className: c("ask-free-input"),
                type: "text",
                value,
                disabled: busy,
                placeholder: t("tree.freeAskPlaceholder"),
                "aria-label": t("tree.freeAskPlaceholder"),
                onChange: (e) => setValue(e.target.value),
                onKeyDown: (e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("button", { type: "button", className: c("btn"), disabled: busy || value.trim() === "", onClick: () => void send(), children: busy ? t("tree.asking") : t("tree.freeAskSend") })
          ] }),
          error && /* @__PURE__ */ (0, import_jsx_runtime22.jsx)("div", { className: c("tree-err"), children: error })
        ]
      }
    )
  );
}

// src/client/tree/collapsed.ts
function collapsedKey(sessionId) {
  return `dlogic.tree.collapsed.${sessionId}`;
}
function parseCollapsed(raw) {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return /* @__PURE__ */ new Set();
    }
  }
  if (!Array.isArray(v)) return /* @__PURE__ */ new Set();
  return new Set(v.filter((id) => typeof id === "string" && id !== ""));
}
function isCardOpen(collapsed, nodeId) {
  return !collapsed.has(nodeId);
}
function toggleCollapsed(collapsed, nodeId) {
  const next = new Set(collapsed);
  if (next.has(nodeId)) next.delete(nodeId);
  else next.add(nodeId);
  return next;
}
function loadCollapsed(sessionId) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return /* @__PURE__ */ new Set();
    return parseCollapsed(localStorage.getItem(collapsedKey(sessionId)));
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
function saveCollapsed(sessionId, collapsed) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return;
    if (collapsed.size === 0) localStorage.removeItem(collapsedKey(sessionId));
    else localStorage.setItem(collapsedKey(sessionId), JSON.stringify([...collapsed]));
  } catch {
  }
}

// src/client/tree/offsets.ts
function offsetsKey(sessionId) {
  return `dlogic.tree.offsets.${sessionId}`;
}
function parseOffsets(raw) {
  let v = raw;
  if (typeof raw === "string") {
    try {
      v = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
  const out = {};
  for (const [id, o] of Object.entries(v)) {
    if (typeof o !== "object" || o === null) continue;
    const dx = o.dx;
    const dy = o.dy;
    if (typeof dx === "number" && Number.isFinite(dx) && typeof dy === "number" && Number.isFinite(dy)) {
      out[id] = { dx: Math.round(dx), dy: Math.round(dy) };
    }
  }
  return out;
}
function loadOffsets(sessionId) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return {};
    return parseOffsets(localStorage.getItem(offsetsKey(sessionId)));
  } catch {
    return {};
  }
}
function saveOffsets(sessionId, offsets) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return;
    if (Object.keys(offsets).length === 0) localStorage.removeItem(offsetsKey(sessionId));
    else localStorage.setItem(offsetsKey(sessionId), JSON.stringify(offsets));
  } catch {
  }
}

// src/client/tree/pan.ts
var PAN_THRESHOLD = 4;
function exceedsPanThreshold(dx, dy, threshold = PAN_THRESHOLD) {
  return Math.hypot(dx, dy) >= threshold;
}
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
function panScroll(start, dx, dy, max) {
  const left = Number.isFinite(dx) ? start.left - dx : start.left;
  const top = Number.isFinite(dy) ? start.top - dy : start.top;
  return {
    left: clamp(left, 0, Math.max(0, max.x)),
    top: clamp(top, 0, Math.max(0, max.y))
  };
}
var PAN_SLACK_RATIO = 0.6;
function canvasSize(layoutW, layoutH, padX, padY, paneW, paneH, indented) {
  const pw = Number.isFinite(paneW) && paneW > 0 ? paneW : 0;
  const ph = Number.isFinite(paneH) && paneH > 0 ? paneH : 0;
  const slackX = indented ? 0 : Math.round(pw * PAN_SLACK_RATIO);
  const slackY = Math.round(ph * PAN_SLACK_RATIO);
  return {
    width: layoutW + padX * 2 + slackX,
    height: layoutH + padY * 2 + slackY
  };
}

// src/shared/treePush.ts
var PUSH_GAP = 12;
var finite2 = (x) => typeof x === "number" && Number.isFinite(x) ? x : 0;
var hasOwn = (o, id) => Object.prototype.hasOwnProperty.call(o, id);
function resolveOffsets(base, roots, offsets, dragId, opts = {}) {
  try {
    return resolve(base, roots, offsets, dragId, opts.gap ?? PUSH_GAP);
  } catch {
    return offsets;
  }
}
function resolve(base, roots, offsets, dragId, gap) {
  const items = [];
  const itemOf = /* @__PURE__ */ new Map();
  const walk = (n, pdx, pdy) => {
    const o = hasOwn(offsets, n.id) ? offsets[n.id] : void 0;
    const cdx = pdx + finite2(o?.dx);
    const cdy = pdy + finite2(o?.dy);
    const b = base.boxes.get(n.id);
    let idx = -1;
    if (b) {
      idx = items.length;
      items.push({ id: n.id, base: b, x: b.x + cdx, y: b.y + cdy, sub: [] });
      itemOf.set(n.id, idx);
    }
    const sub = idx >= 0 ? [idx] : [];
    for (const c2 of n.children) for (const i of walk(c2, cdx, cdy)) sub.push(i);
    if (idx >= 0) items[idx].sub = sub;
    return sub;
  };
  for (const r of roots) walk(r, 0, 0);
  const dragIdx = dragId === null ? void 0 : itemOf.get(dragId);
  if (dragId !== null && dragIdx === void 0) return offsets;
  const pinned = new Set(dragIdx === void 0 ? [] : items[dragIdx].sub);
  const placed = [...pinned];
  const done = new Set(pinned);
  const conflicts = (x, y, w, h, skip) => {
    for (const j of placed) {
      if (j === skip) continue;
      const o = items[j];
      const gx = Math.max(o.x - (x + w), x - (o.x + o.base.w));
      const gy = Math.max(o.y - (y + h), y - (o.y + o.base.h));
      if (gx < gap - 1 && gy < gap - 1) return true;
    }
    return false;
  };
  let movedAny = false;
  for (let i = 0; i < items.length; i++) {
    if (done.has(i)) continue;
    const it = items[i];
    const w = it.base.w;
    const h = it.base.h;
    if (conflicts(it.x, it.y, w, h, -1)) {
      let bestX = it.x;
      let bestY = it.y;
      let best = Number.POSITIVE_INFINITY;
      const cand = (nx, ny) => {
        const d = Math.abs(nx - it.x) + Math.abs(ny - it.y);
        if (d < best && !conflicts(nx, ny, w, h, -1)) {
          best = d;
          bestX = nx;
          bestY = ny;
        }
      };
      let bottom = Number.NEGATIVE_INFINITY;
      for (const j of placed) {
        const o = items[j];
        bottom = Math.max(bottom, o.y + o.base.h);
        cand(o.x + o.base.w + gap, it.y);
        cand(o.x - w - gap, it.y);
        cand(it.x, o.y + o.base.h + gap);
        cand(it.x, o.y - h - gap);
      }
      if (best === Number.POSITIVE_INFINITY) {
        bestX = it.x;
        bestY = bottom + gap;
      }
      const dx = bestX - it.x;
      const dy = bestY - it.y;
      for (const k of it.sub) {
        if (!done.has(k)) {
          items[k].x += dx;
          items[k].y += dy;
        }
      }
      movedAny = true;
    }
    done.add(i);
    placed.push(i);
  }
  if (!movedAny) return offsets;
  const out = { ...offsets };
  const rebuild = (n, pdx, pdy) => {
    const idx = itemOf.get(n.id);
    let cdx;
    let cdy;
    if (idx !== void 0) {
      const it = items[idx];
      cdx = Math.round(it.x - it.base.x);
      cdy = Math.round(it.y - it.base.y);
      const odx = cdx - pdx;
      const ody = cdy - pdy;
      if (dragId !== null && n.id === dragId || odx !== 0 || ody !== 0) out[n.id] = { dx: odx, dy: ody };
      else delete out[n.id];
    } else {
      const o = hasOwn(offsets, n.id) ? offsets[n.id] : void 0;
      cdx = pdx + finite2(o?.dx);
      cdy = pdy + finite2(o?.dy);
    }
    for (const c2 of n.children) rebuild(c2, cdx, cdy);
  };
  for (const r of roots) rebuild(r, 0, 0);
  return out;
}

// src/client/tree/TreeCanvas.tsx
var import_jsx_runtime23 = require("react/jsx-runtime");
var BOX_W2 = 280;
var CARD_H = 84;
var STUB_H = 44;
var WIDE_MIN = 600;
var PAD2 = 16;
var INDENT_PAD_X = 8;
var INDENT_PAD_Y = 16;
var DRAG_THRESHOLD = 4;
function slotKey(parentId, index) {
  return `${parentId}#${index}`;
}
function indexForest(forest) {
  const m = /* @__PURE__ */ new Map();
  const walk = (n) => {
    m.set(n.id, n);
    n.children.forEach(walk);
  };
  forest.forEach(walk);
  return m;
}
function jumpToChat(callId) {
  try {
    const el = document.querySelector(`[data-chat-call-id="${CSS.escape(callId)}"]`);
    if (el instanceof HTMLElement) el.scrollIntoView({ block: "center", behavior: "smooth" });
  } catch {
  }
}
function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return true;
  return target.closest('[data-tree-node], button, input, textarea, select, a, label, [contenteditable="true"]') !== null;
}
var COPIED_MS = 1500;
function TreeCanvas(props) {
  const { view, t, sessionId, error, childCallIds, answering, busyKey, onAsk, onLocateChild, footer, answers } = props;
  const { selected, onToggleSelect, onClearSelect, onSynth, synthBusy, onCopyBranch, focusNodeId, onFocusDone, onFreeAsk } = props;
  const { onConceptLink, conceptBusy } = props;
  const forest = (0, import_react15.useMemo)(() => buildForest(view), [view]);
  const nodeMap = (0, import_react15.useMemo)(() => indexForest(forest), [forest]);
  const [copied, setCopied] = (0, import_react15.useState)(null);
  (0, import_react15.useEffect)(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const copyBranch = async (card) => {
    const ok = await onCopyBranch(card);
    if (ok) setCopied({ id: card.nodeId });
  };
  const [heights, setHeights] = (0, import_react15.useState)(() => /* @__PURE__ */ new Map());
  const [paneW, setPaneW] = (0, import_react15.useState)(0);
  const [paneH, setPaneH] = (0, import_react15.useState)(0);
  const [collapsed, setCollapsed] = (0, import_react15.useState)(() => loadCollapsed(sessionId));
  const [offsets, setOffsets] = (0, import_react15.useState)(() => loadOffsets(sessionId));
  const [drag, setDrag] = (0, import_react15.useState)(null);
  const scrollRef = (0, import_react15.useRef)(null);
  const roRef = (0, import_react15.useRef)(null);
  const dragRef = (0, import_react15.useRef)(null);
  const suppressClick = (0, import_react15.useRef)(false);
  (0, import_react15.useEffect)(() => {
    setOffsets(loadOffsets(sessionId));
    setCollapsed(loadCollapsed(sessionId));
  }, [sessionId]);
  const indented = paneW > 0 && paneW < WIDE_MIN;
  const indentW = Math.max(160, paneW - INDENT_PAD_X * 2);
  const layoutKey = indented ? `i${indentW}` : "f";
  const padX = indented ? INDENT_PAD_X : PAD2;
  const padY = indented ? INDENT_PAD_Y : PAD2;
  const hOf = (id) => {
    const vm = nodeMap.get(id);
    return heights.get(`${layoutKey}|${id}`) ?? (vm?.kind === "stub" ? STUB_H : CARD_H);
  };
  const base = (0, import_react15.useMemo)(
    () => indented ? null : layoutForest(forest, (id) => ({ w: BOX_W2, h: hOf(id) })),
    [forest, nodeMap, heights, layoutKey, indented]
  );
  const layout = (0, import_react15.useMemo)(() => {
    if (!base) return layoutIndented(forest, (id) => ({ w: 0, h: hOf(id) }), { width: indentW });
    const live = drag ? { ...offsets, [drag.id]: { dx: drag.dx, dy: drag.dy } } : offsets;
    const resolved = resolveOffsets(base, forest, live, drag ? drag.id : null);
    return applyOffsets(base, forest, resolved, "forest");
  }, [base, forest, offsets, drag, indentW, nodeMap, heights, layoutKey]);
  (0, import_react15.useEffect)(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width);
        const h = Math.round(e.contentRect.height);
        setPaneW((prev) => prev === w ? prev : w);
        setPaneH((prev) => prev === h ? prev : h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  (0, import_react15.useEffect)(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((prev) => {
        let next = null;
        for (const e of entries) {
          const el = e.target;
          const id = el.dataset.treeNode;
          const key = el.dataset.layoutKey;
          if (!id || !key) continue;
          const h = Math.round(el.offsetHeight);
          if (h <= 0) continue;
          const k = `${key}|${id}`;
          if ((next ?? prev).get(k) !== h) {
            if (next === null) next = new Map(prev);
            next.set(k, h);
          }
        }
        return next ?? prev;
      });
    });
    roRef.current = ro;
    return () => {
      ro.disconnect();
      roRef.current = null;
    };
  }, []);
  (0, import_react15.useEffect)(() => {
    const ro = roRef.current;
    const root = scrollRef.current;
    if (!ro || !root) return;
    root.querySelectorAll("[data-tree-node]").forEach((el) => ro.observe(el));
  });
  const toggle = (id) => {
    const next = toggleCollapsed(collapsed, id);
    setCollapsed(next);
    saveCollapsed(sessionId, next);
  };
  const onCardPointerDown = (e, id) => {
    if (indented || e.button !== 0) return;
    suppressClick.current = false;
    const cur = offsets[id];
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, bx: cur?.dx ?? 0, by: cur?.dy ?? 0, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
  };
  const onCardPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setDrag({ id: d.id, dx: Math.round(d.bx + dx), dy: Math.round(d.by + dy) });
  };
  const onCardPointerEnd = (e, cancelled) => {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }
    if (!d) return;
    if (!d.moved || cancelled) {
      setDrag(null);
      return;
    }
    suppressClick.current = true;
    const withDrag = {
      ...offsets,
      [d.id]: { dx: Math.round(d.bx + e.clientX - d.sx), dy: Math.round(d.by + e.clientY - d.sy) }
    };
    const next = base ? resolveOffsets(base, forest, withDrag, d.id) : withDrag;
    setOffsets(next);
    saveOffsets(sessionId, next);
    setDrag(null);
  };
  const resetLayout = () => {
    setOffsets({});
    saveOffsets(sessionId, {});
    setDrag(null);
  };
  const [panning, setPanning] = (0, import_react15.useState)(false);
  const panRef = (0, import_react15.useRef)(null);
  const onPanDown = (e) => {
    const el = scrollRef.current;
    if (!el || e.button !== 0 || isInteractiveTarget(e.target)) return;
    panRef.current = { pointerId: e.pointerId, sx: e.clientX, sy: e.clientY, left: el.scrollLeft, top: el.scrollTop, active: false };
  };
  const onPanMove = (e) => {
    const p = panRef.current;
    const el = scrollRef.current;
    if (!p || !el || e.pointerId !== p.pointerId) return;
    const dx = e.clientX - p.sx;
    const dy = e.clientY - p.sy;
    if (!p.active) {
      if (!exceedsPanThreshold(dx, dy)) return;
      p.active = true;
      setPanning(true);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
      }
    }
    const next = panScroll(
      { left: p.left, top: p.top },
      dx,
      dy,
      { x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight }
    );
    el.scrollLeft = next.left;
    el.scrollTop = next.top;
  };
  const onPanEnd = (e) => {
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    panRef.current = null;
    if (!p.active) return;
    setPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }
  };
  const centerBox = (box) => {
    const el = scrollRef.current;
    if (!el) return;
    const left = indented ? 0 : Math.max(0, box.x + padX + box.w / 2 - el.clientWidth / 2);
    const top = Math.max(0, box.h >= el.clientHeight ? box.y + padY - 16 : box.y + padY + box.h / 2 - el.clientHeight / 2);
    el.scrollTo({ left, top, behavior: "smooth" });
  };
  const goLatest = () => {
    const last = view.nodes[view.nodes.length - 1];
    const box = last ? layout.boxes.get(last.nodeId) : void 0;
    if (box) centerBox(box);
  };
  (0, import_react15.useEffect)(() => {
    if (!focusNodeId) return;
    const box = layout.boxes.get(focusNodeId);
    if (!box) return;
    centerBox(box);
    const vm = nodeMap.get(focusNodeId);
    const ids = [focusNodeId, ...vm ? vm.children.map((c2) => c2.id) : []];
    if (indented || ids.every((id) => heights.has(`${layoutKey}|${id}`))) onFocusDone?.();
  }, [focusNodeId, layout]);
  const canvas = canvasSize(layout.width, layout.height, padX, padY, paneW, paneH, indented);
  const srcEdges = (0, import_react15.useMemo)(() => indented ? [] : sourceEdges(view.nodes, layout.boxes), [indented, view.nodes, layout]);
  const linksFor = (card) => {
    if (!onConceptLink) return void 0;
    return {
      focusIds: card.knowledgeIds,
      exploredIds: new Set(buildContextPath(view, card, Number.POSITIVE_INFINITY).flatMap((n) => n.knowledgeIds)),
      busyNodeId: conceptBusy?.cardId === card.nodeId ? conceptBusy.nodeId : null,
      onLink: (nodeId, title) => onConceptLink(card, nodeId, title)
    };
  };
  const boxes = Array.from(layout.boxes.entries()).map(([id, box]) => {
    const vm = nodeMap.get(id);
    if (!vm) return null;
    const pos = { left: box.x + padX, top: box.y + padY, width: box.w };
    if (vm.kind === "card" && vm.card) {
      const card = vm.card;
      const isOpen = isCardOpen(collapsed, id);
      const full = answers?.get(card.callId);
      const links = isOpen ? linksFor(card) : void 0;
      const fromChild = childCallIds.has(card.callId);
      const isSel = selected.has(card.nodeId);
      const cls = [
        c("tnode"),
        isOpen ? c("tnode-open") : "",
        drag?.id === id ? c("tnode-drag") : "",
        fromChild ? c("tnode-child") : "",
        isSel ? c("tnode-sel") : ""
      ].filter(Boolean).join(" ");
      return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
        "div",
        {
          className: cls,
          "data-tree-node": id,
          "data-layout-key": layoutKey,
          style: pos,
          role: "button",
          tabIndex: 0,
          "aria-expanded": isOpen,
          title: isOpen ? void 0 : card.summary,
          onPointerDown: (e) => onCardPointerDown(e, id),
          onPointerMove: onCardPointerMove,
          onPointerUp: (e) => onCardPointerEnd(e, false),
          onPointerCancel: (e) => onCardPointerEnd(e, true),
          onClick: () => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            toggle(id);
          },
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(id);
            }
          },
          children: [
            vm.followup && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: c("tnode-tag"), children: t(angleLabelKey(vm.followup.angle)) }),
            /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: c("tnode-title"), children: plainMath(card.title) }),
            (!isOpen || !full) && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: c("tnode-sum"), children: links ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(LinkedText, { text: plainMath(card.summary), links }) : plainMath(card.summary) }),
            isOpen && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tnode-detail"), onClick: (e) => e.stopPropagation(), onPointerDown: (e) => e.stopPropagation(), children: [
              full && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(AnswerText, { text: full, links }),
              card.knowledgeIds.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tnode-kn"), children: [
                t("tree.knowledge"),
                "\uFF1A",
                knowledgeLabels(card).join("\u3001")
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tnode-actions"), children: [
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
                  "button",
                  {
                    type: "button",
                    className: c("btn"),
                    onClick: (e) => {
                      e.stopPropagation();
                      onToggleSelect(card.nodeId);
                    },
                    children: isSel ? t("tree.deselect") : t("tree.select")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
                  "button",
                  {
                    type: "button",
                    className: c("btn"),
                    onClick: (e) => {
                      e.stopPropagation();
                      void copyBranch(card);
                    },
                    children: copied?.id === card.nodeId ? t("tree.copied") : t("tree.copyBranch")
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
                  "button",
                  {
                    type: "button",
                    className: c("btn"),
                    onClick: (e) => {
                      e.stopPropagation();
                      if (fromChild) onLocateChild(card.callId);
                      else jumpToChat(card.callId);
                    },
                    children: t("tree.locate")
                  }
                )
              ] }),
              !fromChild && onFreeAsk && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(FreeAskInput, { t, onSend: (q) => onFreeAsk(card, q) })
            ] })
          ]
        },
        id
      );
    }
    const f = vm.followup;
    const sent = answering.has(id);
    const busy = busyKey === id;
    const text = busy ? t("tree.asking") : sent ? t("side.answering") : f?.question ?? "";
    const askable = busyKey === null && !sent && f !== void 0 && !!vm.parentId;
    const stubCls = [
      c("tnode"),
      c("tnode-stub"),
      drag?.id === id ? c("tnode-drag") : "",
      askable ? "" : c("tnode-stub-off")
    ].filter(Boolean).join(" ");
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
      "button",
      {
        type: "button",
        className: stubCls,
        "data-tree-node": id,
        "data-layout-key": layoutKey,
        style: pos,
        "aria-disabled": askable ? void 0 : true,
        onPointerDown: (e) => onCardPointerDown(e, id),
        onPointerMove: onCardPointerMove,
        onPointerUp: (e) => onCardPointerEnd(e, false),
        onPointerCancel: (e) => onCardPointerEnd(e, true),
        onClick: () => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          if (!askable) return;
          const parent = vm.parentId ? nodeMap.get(vm.parentId)?.card : void 0;
          if (parent && vm.followupIndex !== void 0) onAsk(parent, vm.followupIndex);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: c("tnode-tag"), children: f ? t(angleLabelKey(f.angle)) : "" }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { className: c("tnode-q"), children: text })
        ]
      },
      id
    );
  });
  return (
    // minWidth:0 让面板在父级 flex 行中不会被画布的固定宽度撑大（否则内容被侧栏裁掉）。
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("treepane"), style: { minWidth: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tree-bar"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("span", { children: fmt(t, "tree.count", { n: view.nodes.length }) }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: c("tree-bar-actions"), children: [
          !indented && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: c("btn"), onClick: resetLayout, children: t("tree.reset") }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: c("btn"), onClick: goLatest, children: t("tree.latest") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tree-synth"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { children: [
          selected.size > 0 ? fmt(t, "tree.selectedCount", { n: selected.size }) : "",
          synthBusy !== null && /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: c("tree-synth-hint"), children: [
            selected.size > 0 ? "  " : "",
            t("tree.synthHint")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("span", { className: c("tree-bar-actions"), children: [
          selected.size >= 2 && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: c("btn"), disabled: synthBusy !== null, onClick: () => onSynth("compare"), children: synthBusy === "compare" ? t("tree.synthBusy") : t("tree.compare") }),
          selected.size >= 1 && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: c("btn"), disabled: synthBusy !== null, onClick: () => onSynth("summary"), children: synthBusy === "summary" ? t("tree.synthBusy") : t("tree.summarize") }),
          selected.size >= 1 && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("button", { type: "button", className: c("btn"), disabled: synthBusy !== null, onClick: onClearSelect, children: t("tree.clearSelect") }),
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
            "button",
            {
              type: "button",
              className: c("btn"),
              disabled: synthBusy !== null || view.nodes.length < 2,
              onClick: () => onSynth("outline"),
              children: synthBusy === "outline" ? t("tree.synthBusy") : t("tree.outline")
            }
          )
        ] })
      ] }),
      error && /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("div", { className: c("tree-err"), children: error }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
        "div",
        {
          className: panning ? `${c("tree-scroll")} ${c("tree-panning")}` : c("tree-scroll"),
          ref: scrollRef,
          style: { overflowX: "auto", overflowY: "auto", minWidth: 0, contain: "inline-size" },
          onPointerDown: onPanDown,
          onPointerMove: onPanMove,
          onPointerUp: onPanEnd,
          onPointerCancel: onPanEnd,
          children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("div", { className: c("tree-canvas"), style: { width: canvas.width, height: canvas.height }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)("svg", { className: c("tree-edges"), width: layout.width, height: layout.height, style: { left: padX, top: padY }, children: [
              layout.edges.map((e) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("path", { className: c("tree-edge"), d: e.path }, `${e.from}>${e.to}`)),
              srcEdges.map((e) => /* @__PURE__ */ (0, import_jsx_runtime23.jsx)("path", { className: c("tree-edge-src"), d: e.path }, `src:${e.from}>${e.to}`))
            ] }),
            boxes
          ] })
        }
      ),
      footer
    ] })
  );
}

// src/client/tree/SideChatDrawer.tsx
var import_react16 = require("react");
var import_jsx_runtime24 = require("react/jsx-runtime");
var DEFAULT_FRAC = 0.55;
var FRAC_MIN = 0.2;
var FRAC_MAX = 0.85;
function openKey(sessionId) {
  return `dlogic.sidechat.open.${sessionId}`;
}
function readDrawerOpen(sessionId) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return false;
    return localStorage.getItem(openKey(sessionId)) === "1";
  } catch {
    return false;
  }
}
function writeDrawerOpen(sessionId, open) {
  try {
    if (typeof localStorage === "undefined" || !sessionId) return;
    localStorage.setItem(openKey(sessionId), open ? "1" : "0");
  } catch {
  }
}
function SideChatDrawer(props) {
  const { t, open, canOpen, canFullscreen, turns, answering, onToggle, onFullscreen, conversation, collector } = props;
  const [frac, setFrac] = (0, import_react16.useState)(DEFAULT_FRAC);
  const dragRef = (0, import_react16.useRef)(null);
  const expanded = open && canOpen;
  const onSplitDown = (e) => {
    const pane = e.currentTarget.closest(`.${c("treepane")}`);
    const height = pane?.getBoundingClientRect().height ?? 0;
    if (!height) return;
    dragRef.current = { startY: e.clientY, startFrac: frac, height };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
    }
  };
  const onSplitMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const next = d.startFrac - (e.clientY - d.startY) / d.height;
    setFrac(Math.min(FRAC_MAX, Math.max(FRAC_MIN, next)));
  };
  const onSplitEnd = () => {
    dragRef.current = null;
  };
  const status = canOpen ? answering ? t("side.answering") : fmt(t, "side.turns", { n: turns }) : t("side.hint");
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)("div", { className: c("side") + (expanded ? " " + c("side-open") : ""), style: expanded ? { height: `${Math.round(frac * 100)}%` } : void 0, children: [
    expanded && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      "div",
      {
        className: c("side-split"),
        role: "separator",
        "aria-orientation": "horizontal",
        onPointerDown: onSplitDown,
        onPointerMove: onSplitMove,
        onPointerUp: onSplitEnd,
        onPointerCancel: onSplitEnd
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(
      "div",
      {
        className: c("side-bar"),
        role: "button",
        tabIndex: canOpen ? 0 : -1,
        "aria-expanded": expanded,
        "aria-disabled": !canOpen,
        onClick: () => {
          if (canOpen) onToggle();
        },
        onKeyDown: (e) => {
          if (canOpen && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onToggle();
          }
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: c("side-chev"), "aria-hidden": "true", children: expanded ? "\u25BE" : "\u25B8" }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: c("side-title"), children: t("side.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("span", { className: c("side-meta"), children: status }),
          canOpen && canFullscreen && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
            "button",
            {
              type: "button",
              className: c("btn"),
              onClick: (e) => {
                e.stopPropagation();
                onFullscreen();
              },
              children: t("side.fullscreen")
            }
          )
        ]
      }
    ),
    expanded && /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { className: c("side-body"), children: conversation }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)("div", { style: { display: "none" }, children: collector })
  ] });
}

// src/client/tree/TreeTab.tsx
var import_jsx_runtime25 = require("react/jsx-runtime");
var NO_PROJECTION3 = () => void 0;
var EMPTY_CARDS = [];
var ANSWER_TIMEOUT_MS = 5 * 60 * 1e3;
var ANSWER_TICK_MS = 15 * 1e3;
function ChildCollector(props) {
  const { parentId, childId, SessionProvider, renderSlot, onNodes } = props;
  const handle = useRetainedChild(parentId, childId);
  const report = (0, import_react17.useCallback)((nodes) => onNodes(childId, nodes), [onNodes, childId]);
  if (!handle) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(SessionProvider, { session: handle, children: renderSlot("dlogic.sidechat.collector", { onNodes: report }) });
}
function TreeTab(props) {
  const { t, sessionId, useTabInfo, renderSlot, SessionProvider } = props;
  useTabInfo();
  const project = props.useProjection ?? NO_PROJECTION3;
  const view = project(TREE_PROJECTION_KEY);
  const mainNodes = Array.isArray(view?.nodes) ? view.nodes : EMPTY_CARDS;
  const askEntries = useAskEntries(sessionId);
  const askCards = (0, import_react17.useMemo)(() => askEntries.map((e) => e.card), [askEntries]);
  const answers = (0, import_react17.useMemo)(() => new Map(askEntries.map((e) => [e.card.callId, e.answer])), [askEntries]);
  const hasDirect = askEntries.length > 0;
  const childIds = useFollowupChildIds(sessionId);
  const childId = childIds.length > 0 ? childIds[childIds.length - 1] : void 0;
  const childRef = useRetainedChild(sessionId, childId);
  const [nodesById, setNodesById] = (0, import_react17.useState)({});
  const onChildNodes = (0, import_react17.useCallback)((id, nodes) => {
    setNodesById((prev) => {
      const old = prev[id];
      if (old && sameCards(old, nodes)) return prev;
      return { ...prev, [id]: nodes };
    });
  }, []);
  const childNodes = (0, import_react17.useMemo)(() => childIds.flatMap((id) => nodesById[id] ?? EMPTY_CARDS), [childIds, nodesById]);
  const [pendingCard, setPendingCard] = (0, import_react17.useState)(null);
  const pendingList = (0, import_react17.useMemo)(() => pendingCard ? [pendingCard] : EMPTY_CARDS, [pendingCard]);
  const merged = (0, import_react17.useMemo)(
    () => mergeCards(mergeCards(mergeCards(mainNodes, askCards), childNodes), pendingList),
    [mainNodes, askCards, childNodes, pendingList]
  );
  const childCallIds = (0, import_react17.useMemo)(() => childOnlyCallIds(mainNodes, [...askCards, ...childNodes]), [mainNodes, askCards, childNodes]);
  const mergedView = (0, import_react17.useMemo)(() => ({ v: 1, nodes: merged }), [merged]);
  const filled = (0, import_react17.useMemo)(() => {
    const s = /* @__PURE__ */ new Set();
    for (const n of merged) if (n.parentId && typeof n.parentFollowup === "number") s.add(slotKey(n.parentId, n.parentFollowup));
    return s;
  }, [merged]);
  const [busyKey, setBusyKey] = (0, import_react17.useState)(null);
  const [error, setError] = (0, import_react17.useState)(null);
  const [selected, setSelected] = (0, import_react17.useState)(() => /* @__PURE__ */ new Set());
  (0, import_react17.useEffect)(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set(merged.map((n) => n.nodeId));
      const next = new Set(Array.from(prev).filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [merged]);
  (0, import_react17.useEffect)(() => {
    setSelected((prev) => prev.size === 0 ? prev : /* @__PURE__ */ new Set());
  }, [sessionId]);
  const onToggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const onClearSelect = () => setSelected(/* @__PURE__ */ new Set());
  const [synthBusy, setSynthBusy] = (0, import_react17.useState)(null);
  const [focusNodeId, setFocusNodeId] = (0, import_react17.useState)(null);
  const onSynth = async (kind) => {
    if (synthBusy !== null) return;
    if (!sessionId) {
      setError(t("learn.askUnavailable"));
      return;
    }
    const picked = merged.filter((n) => selected.has(n.nodeId));
    const cards = kind === "outline" ? merged : picked;
    if (kind === "outline" && cards.length < 2) {
      setError(t("tree.needTwoTree"));
      return;
    }
    if (kind === "compare" && picked.length < 2) {
      setError(t("tree.needTwo"));
      return;
    }
    if (kind === "summary" && picked.length < 1) {
      setError(t("tree.needOne"));
      return;
    }
    setSynthBusy(kind);
    try {
      const r = await synthesize(sessionId, kind, cards);
      if (r.ok) {
        setError(null);
        setFocusNodeId(r.nodeId);
      } else setError(r.error || t("tree.synthFailed"));
    } catch {
      setError(t("tree.synthFailed"));
    } finally {
      setSynthBusy(null);
    }
  };
  const onCopyBranch = async (card) => {
    const text = branchMarkdown(cardPath(merged, card.nodeId), answers);
    const ok = await copyText(text);
    if (!ok) setError(t("tree.copyFailed"));
    return ok;
  };
  const [sentAt, setSentAt] = (0, import_react17.useState)(() => /* @__PURE__ */ new Map());
  const [now, setNow] = (0, import_react17.useState)(() => Date.now());
  (0, import_react17.useEffect)(() => {
    if (sentAt.size === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), ANSWER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [sentAt]);
  const answering = (0, import_react17.useMemo)(() => pendingSlotKeys(sentAt, filled, now, ANSWER_TIMEOUT_MS), [sentAt, filled, now]);
  const [open, setOpen] = (0, import_react17.useState)(() => readDrawerOpen(sessionId));
  (0, import_react17.useEffect)(() => {
    setOpen(readDrawerOpen(sessionId));
  }, [sessionId]);
  const onAsk = async (card, index) => {
    if (busyKey !== null) return;
    const key = slotKey(card.nodeId, index);
    setBusyKey(key);
    try {
      if (!sessionId) {
        setError(t("learn.askUnavailable"));
        return;
      }
      const r = await askFollowup(sessionId, card, index, mergedView);
      if (r && r.ok) {
        setError(null);
        const at = Date.now();
        setNow(at);
        setSentAt((prev) => prev.has(key) ? prev : new Map(prev).set(key, at));
      } else setError(r?.error ?? t("tree.askFailed"));
    } catch {
      setError(t("tree.askFailed"));
    } finally {
      setBusyKey(null);
    }
  };
  const onFreeAsk = async (card, question) => {
    if (!sessionId) {
      setError(t("learn.askUnavailable"));
      return t("learn.askUnavailable");
    }
    const path = buildContextPath(mergedView, card, Number.POSITIVE_INFINITY);
    const r = await askFollowupLlm(sessionId, buildContextPath(mergedView, card), question);
    if (!r.ok) {
      setError(r.error);
      return r.error;
    }
    setError(null);
    addAskAnswer(
      sessionId,
      buildAskEntry({
        parent: card,
        explored: path.flatMap((n) => n.knowledgeIds),
        question,
        answer: r.text,
        followups: r.followups,
        now: Date.now(),
        token: randomToken()
      })
    );
    return null;
  };
  const [conceptBusy, setConceptBusy] = (0, import_react17.useState)(null);
  const onConceptLink = async (card, nodeId, title) => {
    const question = conceptQuestion(title);
    const existing = merged.find(
      (n) => n.parentId === card.nodeId && (n.title === title || n.title === question) && n.knowledgeIds.length === 1 && n.knowledgeIds[0] === nodeId
    );
    if (existing) return;
    if (!sessionId) {
      setError(t("learn.askUnavailable"));
      return;
    }
    if (conceptBusy !== null) return;
    setConceptBusy({ cardId: card.nodeId, nodeId });
    try {
      const path = buildContextPath(mergedView, card, Number.POSITIVE_INFINITY);
      const placeholder = buildAskEntry({
        parent: card,
        followup: { question, angle: "principle", why: "", knowledgeId: nodeId },
        question,
        title,
        answer: t("tree.asking"),
        now: Date.now(),
        token: randomToken()
      }).card;
      setPendingCard({ ...placeholder, summary: t("tree.asking"), followups: [] });
      setFocusNodeId(placeholder.nodeId);
      const r = await askFollowupLlm(sessionId, buildContextPath(mergedView, card), question);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      const entry = buildAskEntry({
        parent: card,
        explored: path.flatMap((n) => n.knowledgeIds),
        followup: { question, angle: "principle", why: "", knowledgeId: nodeId },
        question,
        title,
        answer: r.text,
        followups: r.followups,
        now: Date.now(),
        token: randomToken()
      });
      addAskAnswer(sessionId, entry);
      setFocusNodeId(entry.card.nodeId);
    } catch {
      setError(t("tree.askFailed"));
    } finally {
      setPendingCard(null);
      setConceptBusy(null);
    }
  };
  const setDrawer = (next) => {
    setOpen(next);
    writeDrawerOpen(sessionId, next);
  };
  const onLocateChild = (callId) => {
    if (!open) setDrawer(true);
    window.setTimeout(() => jumpToChat(callId), 80);
  };
  const legacyReady = Boolean(childId && childRef && SessionProvider && renderSlot);
  const canOpen = hasDirect || legacyReady;
  const conversation = !open ? null : hasDirect ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(AskList, { entries: askEntries }) : legacyReady && SessionProvider && renderSlot ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(SessionProvider, { session: childRef, children: renderSlot("dlogic.sidechat.conversation", {}) }) : null;
  const collector = SessionProvider && renderSlot && sessionId ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_jsx_runtime25.Fragment, { children: childIds.map((id) => /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    ChildCollector,
    {
      parentId: sessionId,
      childId: id,
      SessionProvider,
      renderSlot,
      onNodes: onChildNodes
    },
    id
  )) }) : null;
  const footer = /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    SideChatDrawer,
    {
      t,
      open,
      canOpen,
      canFullscreen: !hasDirect && legacyReady,
      turns: hasDirect ? askEntries.length : childNodes.length,
      answering: answering.size > 0,
      onToggle: () => setDrawer(!open),
      onFullscreen: () => {
        if (sessionId && childId) openSideChatFullscreen(sessionId, childId);
      },
      conversation,
      collector
    }
  );
  if (merged.length === 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: c("treepane"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)("div", { className: c("tree-empty"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("h3", { children: t("tree.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime25.jsx)("p", { children: t("tree.empty") })
      ] }),
      footer
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
    TreeCanvas,
    {
      view: mergedView,
      t,
      sessionId: sessionId ?? "",
      error,
      childCallIds,
      answering,
      answers,
      busyKey,
      onAsk: (card, index) => void onAsk(card, index),
      onLocateChild,
      onFreeAsk,
      onConceptLink: (card, nodeId, title) => void onConceptLink(card, nodeId, title),
      conceptBusy,
      footer,
      selected,
      onToggleSelect,
      onClearSelect,
      onSynth: (kind) => void onSynth(kind),
      synthBusy,
      onCopyBranch,
      focusNodeId,
      onFocusDone: () => setFocusNodeId(null)
    }
  );
}

// src/client/index.tsx
injectStyles();
var TREE_ID = "dsh-digital-logic-studio/learning-tree";
var TREE_KIND = "dlogic-learning-tree";
var SLOT_CONVERSATION = "dlogic.sidechat.conversation";
var SLOT_COLLECTOR = "dlogic.sidechat.collector";
var inject = ["slots", "locale", "sidebarRightTabs", "sessions", "remote", "remote.commands", "uiConversation"];
function apply(ctx) {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh: zh8, en }), "dlogic-studio: dictionaries");
  registerSidechat(ctx);
  registerAskLlm(ctx);
  registerFigures(ctx);
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_num", locale: NS }, NumCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_bool", locale: NS }, BoolCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_verify", locale: NS }, VerifyCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_comb", locale: NS }, CombCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_seq", locale: NS }, SeqCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_fsm", locale: NS }, FsmCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_mem", locale: NS }, MemCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_adda", locale: NS }, AddaCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_system", locale: NS }, SystemCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_hdl", locale: NS }, HdlCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register({ name: "tool.call.toolview", key: "dlogic_knowledge", locale: NS }, KnowledgeCard)
  );
  ctx.slots.inject(
    "tool.call.toolview",
    () => ctx.slots.register(
      {
        name: "tool.call.toolview",
        key: "dlogic_card",
        locale: NS,
        // 追问一律发往侧边追问子会话（askFollowup），不再向主会话 prompt。
        inject: (sessionId) => ({
          ask: (card, index, tree) => askFollowup(sessionId, card, index, tree)
        })
      },
      LearnCard
    )
  );
  ctx.effect(
    () => ctx.sidebarRightTabs.register({
      id: TREE_ID,
      kind: TREE_KIND,
      title: () => t("tree.title"),
      guide: [
        {
          id: "learning-tree",
          order: 50,
          title: () => t("tree.title"),
          description: () => t("tree.guideDescription")
        }
      ]
    }),
    "dlogic-studio: learning tree type"
  );
  ctx.effect(
    () => ctx.slots.inject(
      "sidebar.right.pane.tab",
      () => ctx.slots.register(
        {
          name: "sidebar.right.pane.tab",
          key: TREE_ID,
          locale: NS,
          children: {
            [SLOT_CONVERSATION]: { kind: "single", scope: "session" },
            [SLOT_COLLECTOR]: { kind: "single", scope: "session" }
          }
        },
        TreeTab
      )
    ),
    "dlogic-studio: learning tree body"
  );
  ctx.effect(
    () => ctx.slots.inject(
      SLOT_CONVERSATION,
      () => ctx.slots.register({ name: SLOT_CONVERSATION, key: "dlogic-sidechat", locale: NS }, SideChatPanel)
    ),
    "dlogic-studio: side chat conversation"
  );
  ctx.effect(
    () => ctx.slots.inject(
      SLOT_COLLECTOR,
      () => ctx.slots.register({ name: SLOT_COLLECTOR, key: "dlogic-sidechat", locale: NS }, SideChatCollector)
    ),
    "dlogic-studio: side chat collector"
  );
}
		return module.exports;
	}
});
