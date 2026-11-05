// src/host/tools/num.ts
import { defineTool } from "@deepseek-ai/dsh-tools";

// src/shared/contracts.ts
var DlogicInputError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DlogicInputError";
  }
};
var TREE_PROJECTION_KEY = "dlogicTree";

// src/solvers/num.ts
var DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var MAX_INPUT_LENGTH = 64;
var MAX_PRECISION = 32;
function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
function reduce(n, d) {
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
function rationalToDecimal({ n, d }, digits = 12) {
  const int = n / d;
  let rem = n % d;
  if (rem === 0n) return int.toString();
  let frac = "";
  for (let i = 0; i < digits && rem !== 0n; i++) {
    rem *= 10n;
    frac += (rem / d).toString();
    rem %= d;
  }
  return `${int}.${frac}${rem === 0n ? "" : "…"}`;
}
function digitValue(ch, base) {
  const v = DIGITS.indexOf(ch.toUpperCase());
  if (v < 0 || v >= base) throw new DlogicInputError(`“${ch}”不是 ${base} 进制的合法数字`);
  return v;
}
function checkBase(base, label) {
  if (!Number.isInteger(base) || base < 2 || base > 36) {
    throw new DlogicInputError(`${label}必须是 2～36 之间的整数`);
  }
}
function parse(value, base) {
  const text2 = String(value).trim().replace(/_/g, "");
  if (text2 === "") throw new DlogicInputError("输入为空");
  if (text2.length > MAX_INPUT_LENGTH) throw new DlogicInputError(`输入过长（上限 ${MAX_INPUT_LENGTH} 个字符）`);
  const negative = text2.startsWith("-");
  const body = negative || text2.startsWith("+") ? text2.slice(1) : text2;
  const parts = body.split(".");
  if (parts.length > 2) throw new DlogicInputError("小数点只能出现一次");
  const [intPart, fracPart = ""] = parts;
  if (intPart === "" && fracPart === "") throw new DlogicInputError("没有数字");
  const intDigits = [...intPart || "0"].map((ch) => digitValue(ch, base));
  const fracDigits = [...fracPart].map((ch) => digitValue(ch, base));
  return { negative, intDigits, fracDigits };
}
function toRational(intDigits, fracDigits, base) {
  const b = BigInt(base);
  let int = 0n;
  for (const v of intDigits) int = int * b + BigInt(v);
  let num = 0n;
  let den = 1n;
  for (const v of fracDigits) {
    num = num * b + BigInt(v);
    den *= b;
  }
  return { int, frac: reduce(num, den) };
}
function powerOfTwo(base) {
  const k = Math.log2(base);
  return Number.isInteger(k) ? k : null;
}
function convertByGrouping(parsed, from, to) {
  const kf = powerOfTwo(from);
  const kt = powerOfTwo(to);
  const toBits = (v) => v.toString(2).padStart(kf, "0");
  const intBits = parsed.intDigits.map(toBits).join("").replace(/^0+(?=.)/, "");
  const fracBits = parsed.fracDigits.map(toBits).join("").replace(/0+$/, "");
  const intPad = (kt - intBits.length % kt) % kt;
  const fracPad = (kt - fracBits.length % kt) % kt;
  const intGrouped = "0".repeat(intPad) + intBits;
  const fracGrouped = fracBits + "0".repeat(fracPad);
  const chunk = (s) => s.match(new RegExp(`.{1,${kt}}`, "g")) ?? [];
  const intGroups = chunk(intGrouped);
  const fracGroups = chunk(fracGrouped);
  const intOut = intGroups.map((g) => DIGITS[parseInt(g, 2)]).join("").replace(/^0+(?=.)/, "") || "0";
  const fracOut = fracGroups.map((g) => DIGITS[parseInt(g, 2)]).join("").replace(/0+$/, "");
  const steps = [];
  if (kf > 1) {
    steps.push({
      kind: "expand-bits",
      text: `每位${from}进制数字展开为 ${kf} 位二进制`,
      binary: fracBits ? `${intBits}.${fracBits}` : intBits
    });
  }
  if (kt > 1) {
    steps.push({
      kind: "group-bits",
      text: `从小数点向两侧每 ${kt} 位一组（整数部分在左侧补 0，小数部分在右侧补 0），每组换成一位${to}进制数字`,
      intGroups,
      fracGroups
    });
  }
  return { intOut, fracOut, exact: true, steps };
}
function convertGeneral(rational, to, precision) {
  const b = BigInt(to);
  const steps = [];
  const divisions = [];
  let q = rational.int;
  while (q > 0n) {
    const next = q / b;
    const r = Number(q % b);
    divisions.push({ dividend: q.toString(), quotient: next.toString(), remainder: r, digit: DIGITS[r] });
    q = next;
  }
  const intOut = divisions.length > 0 ? divisions.map((s) => s.digit).reverse().join("") : "0";
  if (divisions.length > 0) {
    steps.push({ kind: "int-division", text: `整数部分除 ${to} 取余，余数从下往上读`, rows: divisions });
  }
  let { n, d } = rational.frac;
  let fracOut = "";
  const multiplications = [];
  while (n !== 0n && fracOut.length < precision) {
    const product = n * b;
    const digit = Number(product / d);
    const before = rationalToDecimal({ n, d });
    n = product % d;
    multiplications.push({
      value: before,
      product: rationalToDecimal({ n: product, d }),
      digit: DIGITS[digit]
    });
    fracOut += DIGITS[digit];
  }
  const exact = n === 0n;
  if (multiplications.length > 0) {
    steps.push({
      kind: "frac-multiplication",
      text: `小数部分乘 ${to} 取整，整数位从上往下读${exact ? "" : `（保留 ${precision} 位，未除尽）`}`,
      rows: multiplications
    });
  }
  return { intOut, fracOut, exact, steps };
}
function convertBase({ value, from, to, precision = 8 }) {
  checkBase(from, "源进制");
  checkBase(to, "目标进制");
  if (!Number.isInteger(precision) || precision < 1 || precision > MAX_PRECISION) {
    throw new DlogicInputError(`精度必须是 1～${MAX_PRECISION} 之间的整数`);
  }
  const parsed = parse(value, from);
  const rational = toRational(parsed.intDigits, parsed.fracDigits, from);
  const decimal = rationalToDecimal({ n: rational.int * rational.frac.d + rational.frac.n, d: rational.frac.d });
  const steps = [];
  if (from !== 10 && !(powerOfTwo(from) && powerOfTwo(to))) {
    const digits = [
      ...parsed.intDigits.map((v, i, a) => ({ v, p: a.length - 1 - i })),
      ...parsed.fracDigits.map((v, i) => ({ v, p: -(i + 1) }))
    ];
    steps.push({
      kind: "weighted-expansion",
      text: `按权展开求十进制值`,
      terms: digits.filter((t) => t.v !== 0).map((t) => `${t.v}×${from}^${t.p}`),
      result: decimal
    });
  }
  let out;
  if (from === to) {
    out = {
      intOut: parsed.intDigits.map((v) => DIGITS[v]).join("").replace(/^0+(?=.)/, "") || "0",
      fracOut: parsed.fracDigits.map((v) => DIGITS[v]).join("").replace(/0+$/, ""),
      exact: true,
      steps: []
    };
  } else if (powerOfTwo(from) && powerOfTwo(to)) {
    out = convertByGrouping(parsed, from, to);
  } else if (to === 10) {
    const [i, f = ""] = decimal.replace("…", "").split(".");
    out = { intOut: i, fracOut: f.slice(0, precision), exact: !decimal.endsWith("…") && f.length <= precision, steps: [] };
  } else {
    out = convertGeneral(rational, to, precision);
  }
  steps.push(...out.steps);
  const isZero = rational.int === 0n && rational.frac.n === 0n;
  const sign = parsed.negative && !isZero ? "-" : "";
  const result = sign + out.intOut + (out.fracOut ? `.${out.fracOut}` : "");
  return {
    input: { value: String(value).trim(), from, to, precision },
    result,
    decimal: sign + decimal,
    exact: out.exact,
    method: from === to ? "identity" : powerOfTwo(from) && powerOfTwo(to) ? "grouping" : "expansion-division",
    steps
  };
}

// src/host/envelope.ts
var ENVELOPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ok: { type: "boolean", required: true },
    op: { type: "string", required: true },
    result: { type: "json", description: "op 专属的结构化结果；ok 为 false 时为 null" },
    error: { type: "string", description: "ok 为 false 时的原因" },
    steps: { type: "array", required: true, items: { type: "json" } },
    warnings: { type: "array", required: true, items: { type: "string" } }
  }
};
function envelope(op, run) {
  try {
    const { result, steps = [], warnings = [] } = run();
    const clean = (v) => v === void 0 ? v : JSON.parse(JSON.stringify(v));
    return { ok: true, op, result: clean(result), steps: clean(steps), warnings };
  } catch (error) {
    if (error instanceof DlogicInputError) {
      return { ok: false, op, result: null, error: error.message, steps: [], warnings: [] };
    }
    throw error;
  }
}

// src/host/tools/num.ts
var METHOD_TEXT = {
  identity: "源进制与目标进制相同",
  grouping: "二进制分组法",
  "expansion-division": "按权展开 + 除基取余 / 乘基取整"
};
var SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
var sub = (n) => String(n).replace(/\d/g, (d) => SUB_DIGITS[Number(d)]);
function renderNum(value) {
  if (!value.ok) return `输入有误：${value.error}`;
  const r = value.result;
  const lines = [
    `(${r.input.value})${sub(r.input.from)} = (${r.result})${sub(r.input.to)}`,
    `十进制值：${r.decimal}`,
    `方法：${METHOD_TEXT[r.method]}${r.exact ? "" : `；小数部分未除尽，已保留 ${r.input.precision} 位`}`,
    "",
    "步骤："
  ];
  for (const step of value.steps) {
    lines.push(`- ${step.text}`);
    if (step.kind === "weighted-expansion") lines.push(`  ${step.terms.join(" + ") || "0"} = ${step.result}`);
    if (step.kind === "expand-bits") lines.push(`  ${step.binary}`);
    if (step.kind === "group-bits") {
      lines.push(`  ${step.intGroups.join(" ")}${step.fracGroups.length ? " . " + step.fracGroups.join(" ") : ""}`);
    }
    if (step.kind === "int-division") {
      for (const row of step.rows) lines.push(`  ${row.dividend} ÷ ${r.input.to} = ${row.quotient} …… ${row.digit}`);
    }
    if (step.kind === "frac-multiplication") {
      for (const row of step.rows) lines.push(`  ${row.value} × ${r.input.to} = ${row.product} → ${row.digit}`);
    }
  }
  return lines.join("\n");
}
var dlogicNum = defineTool({
  name: "dlogic_num",
  description: [
    "数字逻辑：数制与编码的确定性计算引擎。",
    "当前支持 op=convert：任意 2～36 进制之间的数值转换（含小数和负数），返回结果和教材格式的分步过程",
    "（按权展开、除基取余、乘基取整、二进制分组）。",
    "凡是进制转换都必须调用本工具，不要心算。"
  ].join(""),
  parameters: {
    op: { type: "string", enum: ["convert"], required: true, description: "子功能" },
    value: { type: "string", required: true, description: '待转换的数，例如 "1011.101"、"-25"、"3AF"' },
    from: { type: "integer", required: true, description: "源进制，2～36" },
    to: { type: "integer", required: true, description: "目标进制，2～36" },
    precision: { type: "integer", description: "小数部分最多保留的位数，默认 8，上限 32" }
  },
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderNum(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_num", value })
  },
  async execute(args) {
    return envelope(args.op, () => {
      const r = convertBase({ value: args.value, from: args.from, to: args.to, precision: args.precision ?? 8 });
      const { steps, ...result } = r;
      return { result, steps };
    });
  }
});

// src/host/tools/bool.ts
import { defineTool as defineTool2 } from "@deepseek-ai/dsh-tools";

// src/solvers/bool.ts
var MAX_VARS = 6;
var PETRICK_CAP = 5e4;
var OPERATORS = {
  "'": "postNot",
  "’": "postNot",
  "!": "preNot",
  "~": "preNot",
  "¬": "preNot",
  "*": "and",
  "·": "and",
  "&": "and",
  "∧": "and",
  "+": "or",
  "|": "or",
  "∨": "or",
  "⊕": "xor",
  "^": "xor",
  "⊙": "xnor",
  "(": "lp",
  "[": "lp",
  ")": "rp",
  "]": "rp"
};
var PREFIX_RE = /^\s*[A-Za-z][A-Za-z0-9_]*\s*(\([^()]*\))?\s*=/;
function checkVarNames(vars) {
  const seen = /* @__PURE__ */ new Set();
  for (const v of vars) {
    if (typeof v !== "string" || v.trim() === "") throw new DlogicInputError("变量名不能为空");
    if (seen.has(v)) throw new DlogicInputError(`变量名重复：${v}`);
    seen.add(v);
  }
}
function tokenize(src, offset, names) {
  const toks = [];
  const byLength = names ? names.slice().sort((x, y) => y.length - x.length) : [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    const pos = offset + i;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (names) {
      const hit = byLength.find((nm) => src.startsWith(nm, i));
      if (hit !== void 0) {
        toks.push({ kind: "var", pos, text: hit, name: hit });
        i += hit.length;
        continue;
      }
    }
    if (ch === "0" || ch === "1") {
      toks.push({ kind: "const", pos, text: ch, v: ch === "1" ? 1 : 0 });
      i++;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      if (names) {
        throw new DlogicInputError(`未知变量“${ch}”（位置 ${pos + 1}），可用变量为：${names.join(", ")}`);
      }
      let j = i + 1;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      const name2 = src.slice(i, j);
      toks.push({ kind: "var", pos, text: name2, name: name2 });
      i = j;
      continue;
    }
    const kind = OPERATORS[ch];
    if (kind === void 0) {
      throw new DlogicInputError(`包含无法识别的字符“${ch}”（位置 ${pos + 1}）`);
    }
    toks.push({ kind, pos, text: ch });
    i++;
  }
  return toks;
}
function parseTokens(toks) {
  let p = 0;
  function kindAt() {
    return toks[p] ? toks[p].kind : void 0;
  }
  function unexpected() {
    const t = toks[p];
    if (!t) throw new DlogicInputError("语法错误：表达式在结尾处不完整");
    throw new DlogicInputError(`语法错误：位置 ${t.pos + 1} 处的“${t.text}”不符合语法`);
  }
  function parseOr() {
    const xs = [parseXor()];
    while (kindAt() === "or") {
      p++;
      xs.push(parseXor());
    }
    return xs.length === 1 ? xs[0] : { k: "or", xs };
  }
  function parseXor() {
    let node = parseAnd();
    while (kindAt() === "xor" || kindAt() === "xnor") {
      const k = kindAt() === "xor" ? "xor" : "xnor";
      p++;
      const rhs = parseAnd();
      node = { k, a: node, b: rhs };
    }
    return node;
  }
  function parseAnd() {
    const xs = [parseUnary()];
    for (; ; ) {
      const kd = kindAt();
      if (kd === "and") {
        p++;
        xs.push(parseUnary());
      } else if (kd === "var" || kd === "const" || kd === "lp" || kd === "preNot") {
        xs.push(parseUnary());
      } else {
        break;
      }
    }
    return xs.length === 1 ? xs[0] : { k: "and", xs };
  }
  function parseUnary() {
    if (kindAt() === "preNot") {
      p++;
      return { k: "not", x: parseUnary() };
    }
    return parsePostfix();
  }
  function parsePostfix() {
    let node = parseAtom();
    while (kindAt() === "postNot") {
      p++;
      node = { k: "not", x: node };
    }
    return node;
  }
  function parseAtom() {
    const t = toks[p];
    if (!t) unexpected();
    if (t.kind === "var") {
      p++;
      return { k: "var", name: t.name };
    }
    if (t.kind === "const") {
      p++;
      return { k: "const", v: t.v };
    }
    if (t.kind === "lp") {
      p++;
      const inner = parseOr();
      if (kindAt() !== "rp") {
        throw new DlogicInputError(`括号不匹配：位置 ${t.pos + 1} 处的“${t.text}”缺少对应的闭括号`);
      }
      p++;
      return inner;
    }
    return unexpected();
  }
  if (toks.length === 0) throw new DlogicInputError("表达式为空");
  const ast = parseOr();
  if (p < toks.length) unexpected();
  return ast;
}
function parseExpr(expr, variables) {
  if (typeof expr !== "string") throw new DlogicInputError("表达式必须是字符串");
  const m = PREFIX_RE.exec(expr);
  const offset = m ? m[0].length : 0;
  const body = expr.slice(offset);
  if (body.trim() === "") throw new DlogicInputError("表达式为空");
  let names = null;
  if (variables !== void 0) {
    if (!Array.isArray(variables)) throw new DlogicInputError("variables 必须是字符串数组");
    checkVarNames(variables);
    names = variables.slice();
  }
  const toks = tokenize(body, offset, names);
  const ast = parseTokens(toks);
  let vars;
  if (names) {
    vars = names;
  } else {
    const set = /* @__PURE__ */ new Set();
    for (const t of toks) if (t.kind === "var" && t.name) set.add(t.name);
    vars = [...set].sort();
  }
  if (vars.length > MAX_VARS) {
    throw new DlogicInputError(`最多支持 ${MAX_VARS} 个变量，当前为 ${vars.length} 个`);
  }
  return { ast, variables: vars };
}
function evalExpr(e, env) {
  switch (e.k) {
    case "var": {
      const v = env.get(e.name);
      if (v === void 0) throw new DlogicInputError(`未知变量“${e.name}”`);
      return v;
    }
    case "const":
      return e.v;
    case "not":
      return evalExpr(e.x, env) === 1 ? 0 : 1;
    case "and":
      return e.xs.every((x) => evalExpr(x, env) === 1) ? 1 : 0;
    case "or":
      return e.xs.some((x) => evalExpr(x, env) === 1) ? 1 : 0;
    case "xor":
      return evalExpr(e.a, env) ^ evalExpr(e.b, env) ? 1 : 0;
    case "xnor":
      return evalExpr(e.a, env) ^ evalExpr(e.b, env) ? 0 : 1;
  }
}
function astMinterms(ast, vars) {
  const n = vars.length;
  const out = [];
  for (let m = 0; m < 1 << n; m++) {
    const env = /* @__PURE__ */ new Map();
    for (let i = 0; i < n; i++) env.set(vars[i], bitOf(m, i, n));
    if (evalExpr(ast, env) === 1) out.push(m);
  }
  return out;
}
function specFromExpr(expr, variables) {
  const parsed = parseExpr(expr, variables);
  return { variables: parsed.variables, minterms: astMinterms(parsed.ast, parsed.variables), dontCares: [] };
}
function checkSpec(spec) {
  if (!spec || !Array.isArray(spec.variables) || !Array.isArray(spec.minterms)) {
    throw new DlogicInputError("布尔函数规范不完整：需要 variables 与 minterms 数组");
  }
  checkVarNames(spec.variables);
  const n = spec.variables.length;
  if (n > MAX_VARS) throw new DlogicInputError(`最多支持 ${MAX_VARS} 个变量，当前为 ${n} 个`);
  const total = 1 << n;
  const minterms = normalizeList(spec.minterms, "最小项", total);
  const dontCares = normalizeList(Array.isArray(spec.dontCares) ? spec.dontCares : [], "无关项", total);
  const dcSet = new Set(dontCares);
  for (const m of minterms) {
    if (dcSet.has(m)) throw new DlogicInputError(`编号 ${m} 同时出现在最小项与无关项中`);
  }
  return { n, minterms, dontCares };
}
function normalizeList(list, label, total) {
  const set = /* @__PURE__ */ new Set();
  for (const m of list) {
    if (!Number.isInteger(m)) throw new DlogicInputError(`${label}中含有非整数：${String(m)}`);
    if (m < 0 || m >= total) {
      throw new DlogicInputError(`${label}编号 ${m} 超出范围（0～${total - 1}）`);
    }
    set.add(m);
  }
  return [...set].sort((a, b) => a - b);
}
function checkForm(form) {
  if (form !== "SOP" && form !== "POS") throw new DlogicInputError("形式必须是 SOP 或 POS");
}
function bitOf(m, i, n) {
  return m >> n - 1 - i & 1;
}
function binString(m, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += bitOf(m, i, n) ? "1" : "0";
  return s;
}
function coversOf(mask, n) {
  const out = [];
  for (let m = 0; m < 1 << n; m++) {
    let ok = true;
    for (let i = 0; i < n; i++) {
      const c = mask[i];
      if (c !== "-" && Number(c) !== bitOf(m, i, n)) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(m);
  }
  return out;
}
function literalCount(mask) {
  let c = 0;
  for (const ch of mask) if (ch !== "-") c++;
  return c;
}
function onesOf(mask) {
  let c = 0;
  for (const ch of mask) if (ch === "1") c++;
  return c;
}
function isAllDash(mask) {
  return !/[01]/.test(mask);
}
function maskKey(mask) {
  return mask.replace(/-/g, "z");
}
function cmpImplicant(a, b) {
  if (a.literals !== b.literals) return a.literals - b.literals;
  const ka = maskKey(a.mask);
  const kb = maskKey(b.mask);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
function combineMasks(a, b) {
  let diff = -1;
  for (let k = 0; k < a.length; k++) {
    if (a[k] === b[k]) continue;
    if (a[k] === "-" || b[k] === "-" || diff >= 0) return null;
    diff = k;
  }
  if (diff < 0) return null;
  return a.slice(0, diff) + "-" + a.slice(diff + 1);
}
function popNum(x) {
  let c = 0;
  let y = x;
  while (y) {
    c += y & 1;
    y >>= 1;
  }
  return c;
}
function popBig(x) {
  let c = 0;
  let y = x;
  while (y !== 0n) {
    if ((y & 1n) === 1n) c++;
    y >>= 1n;
  }
  return c;
}
function latexName(name2) {
  const m = /^([A-Za-z])(\d+)$/.exec(name2);
  return m ? m[1] + "_{" + m[2] + "}" : name2;
}
function litOf(name2, neg, latex) {
  const base = latex ? latexName(name2) : name2;
  if (!neg) return base;
  return latex ? "\\overline{" + base + "}" : base + "'";
}
function makeImplicant(mask, vars, form) {
  const covers = coversOf(mask, vars.length);
  const literals = literalCount(mask);
  if (isAllDash(mask)) {
    const c = form === "SOP" ? "1" : "0";
    return { mask, covers, literals, text: c, latex: c };
  }
  const t = [];
  const l = [];
  for (let i = 0; i < vars.length; i++) {
    const bit = mask[i];
    if (bit === "-") continue;
    const neg = form === "SOP" ? bit === "0" : bit === "1";
    t.push(litOf(vars[i], neg, false));
    l.push(litOf(vars[i], neg, true));
  }
  if (form === "SOP") return { mask, covers, literals, text: t.join(""), latex: l.join("") };
  return { mask, covers, literals, text: "(" + t.join("+") + ")", latex: "(" + l.join("+") + ")" };
}
function joinExpr(impls, form, latex) {
  if (impls.length === 0) return form === "SOP" ? "0" : "1";
  const pick = (i) => latex ? i.latex : i.text;
  if (form === "SOP") return impls.map(pick).join(" + ");
  if (impls.length === 1 && impls[0].literals === 1) return pick(impls[0]).slice(1, -1);
  return impls.map(pick).join("");
}
function precOf(e) {
  switch (e.k) {
    case "or":
      return 1;
    case "xor":
    case "xnor":
      return 2;
    case "and":
      return 3;
    default:
      return 4;
  }
}
function wrapText(x, parentPrec) {
  const t = renderText(x);
  return precOf(x) <= parentPrec ? "(" + t + ")" : t;
}
function renderText(e) {
  switch (e.k) {
    case "var":
      return e.name;
    case "const":
      return String(e.v);
    case "not": {
      const inner = renderText(e.x);
      return precOf(e.x) < 4 ? "(" + inner + ")'" : inner + "'";
    }
    case "and": {
      let s = "";
      for (const x of e.xs) {
        const t = wrapText(x, 3);
        if (s !== "" && /^[01]/.test(t)) s += "·";
        s += t;
      }
      return s;
    }
    case "or":
      return e.xs.map((x) => wrapText(x, 1)).join("+");
    case "xor":
      return wrapText(e.a, 2) + "⊕" + wrapText(e.b, 2);
    case "xnor":
      return wrapText(e.a, 2) + "⊙" + wrapText(e.b, 2);
  }
}
function wrapLatex(x, parentPrec) {
  const t = renderLatex(x);
  return precOf(x) <= parentPrec ? "(" + t + ")" : t;
}
function renderLatex(e) {
  switch (e.k) {
    case "var":
      return latexName(e.name);
    case "const":
      return String(e.v);
    case "not":
      return "\\overline{" + renderLatex(e.x) + "}";
    case "and":
      return e.xs.map((x) => wrapLatex(x, 3)).join("");
    case "or":
      return e.xs.map((x) => wrapLatex(x, 1)).join(" + ");
    case "xor":
      return wrapLatex(e.a, 2) + " \\oplus " + wrapLatex(e.b, 2);
    case "xnor":
      return wrapLatex(e.a, 2) + " \\odot " + wrapLatex(e.b, 2);
  }
}
function complementAst(e) {
  switch (e.k) {
    case "var":
      return { k: "not", x: e };
    case "const":
      return { k: "const", v: e.v === 1 ? 0 : 1 };
    case "not":
      return e.x;
    case "and":
      return { k: "or", xs: e.xs.map(complementAst) };
    case "or":
      return { k: "and", xs: e.xs.map(complementAst) };
    case "xor":
      return { k: "xnor", a: complementAst(e.a), b: complementAst(e.b) };
    case "xnor":
      return { k: "xor", a: complementAst(e.a), b: complementAst(e.b) };
  }
}
function dualAst(e) {
  switch (e.k) {
    case "var":
      return e;
    case "const":
      return { k: "const", v: e.v === 1 ? 0 : 1 };
    case "not":
      return { k: "not", x: dualAst(e.x) };
    case "and":
      return { k: "or", xs: e.xs.map(dualAst) };
    case "or":
      return { k: "and", xs: e.xs.map(dualAst) };
    case "xor":
      return { k: "xnor", a: dualAst(e.a), b: dualAst(e.b) };
    case "xnor":
      return { k: "xor", a: dualAst(e.a), b: dualAst(e.b) };
  }
}
function complementExpr(expr, variables) {
  const { ast } = parseExpr(expr, variables);
  const out = complementAst(ast);
  return { text: renderText(out), latex: renderLatex(out) };
}
function dualExpr(expr, variables) {
  const { ast } = parseExpr(expr, variables);
  const out = dualAst(ast);
  return { text: renderText(out), latex: renderLatex(out) };
}
function truthTable(spec) {
  const { n, minterms, dontCares } = checkSpec(spec);
  const on = new Set(minterms);
  const dc = new Set(dontCares);
  const rows = [];
  for (let m = 0; m < 1 << n; m++) {
    const inputs = [];
    for (let i = 0; i < n; i++) inputs.push(bitOf(m, i, n));
    const output = on.has(m) ? 1 : dc.has(m) ? "X" : 0;
    rows.push({ index: m, inputs, output });
  }
  return { variables: spec.variables.slice(), rows };
}
function canonical(spec) {
  const { n, minterms, dontCares } = checkSpec(spec);
  const vars = spec.variables.slice();
  const on = new Set(minterms);
  const dc = new Set(dontCares);
  const maxterms = [];
  for (let m = 0; m < 1 << n; m++) if (!on.has(m) && !dc.has(m)) maxterms.push(m);
  let sigma = `Σm(${minterms.join(",")})`;
  if (dontCares.length) sigma += ` + Σd(${dontCares.join(",")})`;
  let pi = `ΠM(${maxterms.join(",")})`;
  if (dontCares.length) pi += ` · Πd(${dontCares.join(",")})`;
  const prodTerm = (m, latex) => {
    let s = "";
    for (let i = 0; i < n; i++) s += litOf(vars[i], bitOf(m, i, n) === 0, latex);
    return s === "" ? "1" : s;
  };
  const sumTerm = (m, latex) => {
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(litOf(vars[i], bitOf(m, i, n) === 1, latex));
    return parts.length ? "(" + parts.join("+") + ")" : "0";
  };
  return {
    sigma,
    pi,
    sopText: minterms.length ? minterms.map((m) => prodTerm(m, false)).join(" + ") : "0",
    sopLatex: minterms.length ? minterms.map((m) => prodTerm(m, true)).join(" + ") : "0",
    posText: maxterms.length ? maxterms.map((m) => sumTerm(m, false)).join("") : "1",
    posLatex: maxterms.length ? maxterms.map((m) => sumTerm(m, true)).join("") : "1"
  };
}
function qmPrimes(n, seed) {
  let cur = [...new Set(seed.map((m) => binString(m, n)))].sort();
  const primes = [];
  const passes = [];
  while (cur.length > 0) {
    const used = /* @__PURE__ */ new Set();
    const next = /* @__PURE__ */ new Set();
    for (let i = 0; i < cur.length; i++) {
      for (let j = i + 1; j < cur.length; j++) {
        const c = combineMasks(cur[i], cur[j]);
        if (c !== null) {
          used.add(cur[i]);
          used.add(cur[j]);
          next.add(c);
        }
      }
    }
    passes.push(cur.map((mask) => ({ mask, covers: coversOf(mask, n), combined: used.has(mask) })));
    for (const mask of cur) if (!used.has(mask)) primes.push(mask);
    cur = [...next].sort();
  }
  return { primes, passes };
}
function absorb(set) {
  const arr = [...set].map((x) => ({ x, c: popBig(x) })).sort((a, b) => a.c - b.c);
  const kept = [];
  for (const { x } of arr) {
    if (!kept.some((k) => (k & x) === k)) kept.push(x);
  }
  return kept;
}
function solve(spec, form) {
  const { n, minterms, dontCares } = checkSpec(spec);
  const vars = spec.variables.slice();
  const total = 1 << n;
  const dcSet = new Set(dontCares);
  const mset = new Set(minterms);
  let on = minterms;
  if (form === "POS") {
    on = [];
    for (let m = 0; m < total; m++) if (!mset.has(m) && !dcSet.has(m)) on.push(m);
  }
  if (on.length === 0) {
    const c = form === "SOP" ? "0" : "1";
    return {
      n,
      vars,
      form,
      on,
      passes: [],
      primes: [],
      onCovers: {},
      essential: [],
      solutions: [[]],
      texts: [c],
      latex: [c],
      cost: { terms: 0, literals: 0 }
    };
  }
  const onSet = new Set(on);
  const qm = qmPrimes(n, [...on, ...dontCares]);
  const allPrimes = qm.primes.map((mask) => ({
    mask,
    literals: literalCount(mask),
    onCovers: coversOf(mask, n).filter((m) => onSet.has(m))
  })).filter((p) => p.onCovers.length > 0).sort(cmpImplicant);
  const essentialSet = /* @__PURE__ */ new Set();
  for (const m of on) {
    const cov = allPrimes.filter((p) => p.onCovers.includes(m));
    if (cov.length === 1) essentialSet.add(cov[0].mask);
  }
  const essentialPrimes = allPrimes.filter((p) => essentialSet.has(p.mask));
  const coveredByEss = /* @__PURE__ */ new Set();
  for (const p of essentialPrimes) for (const m of p.onCovers) coveredByEss.add(m);
  const remaining = on.filter((m) => !coveredByEss.has(m));
  const cand = allPrimes.filter((p) => !essentialSet.has(p.mask) && p.onCovers.some((m) => !coveredByEss.has(m)));
  let products = [0n];
  for (const m of remaining) {
    let clause = 0n;
    cand.forEach((p, j) => {
      if (p.onCovers.includes(m)) clause |= 1n << BigInt(j);
    });
    const next = /* @__PURE__ */ new Set();
    for (const pr of products) {
      if ((pr & clause) !== 0n) {
        next.add(pr);
        continue;
      }
      for (let j = 0; j < cand.length; j++) {
        if ((clause >> BigInt(j) & 1n) !== 0n) next.add(pr | 1n << BigInt(j));
      }
    }
    if (next.size > PETRICK_CAP) {
      throw new DlogicInputError(`Petrick 法的中间乘积项超过 ${PETRICK_CAP} 个，问题规模过大`);
    }
    products = absorb(next);
  }
  const essLits = essentialPrimes.reduce((s, p) => s + p.literals, 0);
  const scored = products.map((pr) => {
    let terms = essentialPrimes.length;
    let lits = essLits;
    for (let j = 0; j < cand.length; j++) {
      if ((pr >> BigInt(j) & 1n) !== 0n) {
        terms++;
        lits += cand[j].literals;
      }
    }
    return { pr, terms, lits };
  });
  let best = scored[0];
  for (const s of scored) {
    if (s.terms < best.terms || s.terms === best.terms && s.lits < best.lits) best = s;
  }
  const chosen = scored.filter((s) => s.terms === best.terms && s.lits === best.lits);
  const solutions = chosen.map((s) => {
    const picks = [];
    cand.forEach((p, j) => {
      if ((s.pr >> BigInt(j) & 1n) !== 0n) picks.push(p);
    });
    return [...essentialPrimes, ...picks].sort(cmpImplicant).map((p) => makeImplicant(p.mask, vars, form));
  });
  const keyOf2 = (sol) => sol.map((i) => maskKey(i.mask)).join("|");
  solutions.sort((x, y) => {
    const kx = keyOf2(x);
    const ky = keyOf2(y);
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
  const first = solutions[0];
  const onCovers = {};
  for (const p of allPrimes) onCovers[p.mask] = p.onCovers;
  return {
    n,
    vars,
    form,
    on,
    passes: qm.passes,
    primes: allPrimes.map((p) => makeImplicant(p.mask, vars, form)),
    onCovers,
    essential: essentialPrimes.map((p) => p.mask),
    solutions,
    texts: solutions.map((s) => joinExpr(s, form, false)),
    latex: solutions.map((s) => joinExpr(s, form, true)),
    cost: { terms: first.length, literals: first.reduce((s, i) => s + i.literals, 0) }
  };
}
function minimize(spec, form = "SOP") {
  checkForm(form);
  const s = solve(spec, form);
  return {
    form,
    primeImplicants: s.primes,
    essential: s.essential,
    solutions: s.solutions,
    texts: s.texts,
    latex: s.latex,
    cost: s.cost
  };
}
function textOfMask(s, mask) {
  const p = s.primes.find((q) => q.mask === mask);
  return p ? p.text : mask;
}
function minimizeSteps(spec, form = "SOP") {
  checkForm(form);
  const s = solve(spec, form);
  if (s.on.length === 0) {
    return [
      {
        kind: "constant",
        text: form === "SOP" ? "没有最小项（函数恒为 0），SOP 结果为 0。" : "没有最大项（所有非无关项都为 1），POS 结果为 1。"
      }
    ];
  }
  const sideName = form === "SOP" ? "最小项（取值为 1 的格）" : "最大项（取值为 0 的格，对补函数化简）";
  const steps = [];
  steps.push({
    kind: "qm-columns",
    text: `Quine-McCluskey 列表法：以${sideName}及无关项为起点，按 1 的个数分组，逐轮合并相邻组中只差一位的项；打勾的项已被合并，未打勾的即为质蕴涵项。`,
    columns: s.passes.map(
      (pass) => pass.slice().sort((a, b) => onesOf(a.mask) - onesOf(b.mask) || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0)).map((e) => ({ mask: e.mask, covers: e.covers, combined: e.combined }))
    )
  });
  steps.push({
    kind: "pi-chart",
    text: `质蕴涵项表：行为质蕴涵项，列为${sideName}，标出每个质蕴涵项覆盖的编号。`,
    primes: s.primes.map((p) => p.mask),
    minterms: s.on.slice(),
    cover: Object.fromEntries(s.primes.map((p) => [p.mask, s.onCovers[p.mask]]))
  });
  steps.push({
    kind: "essential",
    text: s.essential.length > 0 ? `本质质蕴涵项（唯一覆盖某个编号的质蕴涵项，必须选入）：${s.essential.map((m) => textOfMask(s, m)).join("、")}` : "没有本质质蕴涵项，需要进一步比较各覆盖方案。",
    essential: s.essential.slice()
  });
  steps.push({
    kind: "petrick",
    text: `Petrick 法：对剩余未被本质质蕴涵项覆盖的编号求乘积和式，取项数最少、其次文字数最少的覆盖，共 ${s.solutions.length} 个最简解。`,
    solutions: s.solutions.map((sol) => sol.map((i) => i.mask))
  });
  return steps;
}
function grayCodes(k) {
  const out = [];
  for (let i = 0; i < 1 << k; i++) {
    const g = i ^ i >> 1;
    out.push(g.toString(2).padStart(k, "0"));
  }
  return out;
}
function kmap(spec, form = "SOP") {
  checkForm(form);
  const { n, minterms, dontCares } = checkSpec(spec);
  if (n < 2 || n > 5) throw new DlogicInputError(`卡诺图仅支持 2～5 个变量，当前为 ${n} 个`);
  const vars = spec.variables.slice();
  const planeVar = n === 5 ? vars[0] : null;
  const body = n === 5 ? vars.slice(1) : vars;
  const rowCount = Math.floor(body.length / 2);
  const rowVars = body.slice(0, rowCount);
  const colVars = body.slice(rowCount);
  const rowCodes = grayCodes(rowVars.length);
  const colCodes = grayCodes(colVars.length);
  const planes = n === 5 ? 2 : 1;
  const on = new Set(minterms);
  const dc = new Set(dontCares);
  const cells = [];
  for (let p = 0; p < planes; p++) {
    for (let r = 0; r < rowCodes.length; r++) {
      for (let c = 0; c < colCodes.length; c++) {
        const bits = (planeVar !== null ? String(p) : "") + rowCodes[r] + colCodes[c];
        const minterm = parseInt(bits, 2);
        const value = on.has(minterm) ? 1 : dc.has(minterm) ? "X" : 0;
        cells.push({ plane: p, row: r, col: c, minterm, value });
      }
    }
  }
  const solved2 = solve(spec, form);
  const groups = solved2.solutions[0].map((imp) => ({
    mask: imp.mask,
    text: imp.text,
    latex: imp.latex,
    cells: imp.covers.slice()
  }));
  return {
    variables: vars,
    rowVars,
    colVars,
    rowCodes,
    colCodes,
    planes,
    planeVar,
    cells,
    groups
  };
}
function findHazards(cells, n, vars, solved2) {
  const out = [];
  const base = solved2.solutions[0];
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i];
      const b = cells[j];
      const diff = a ^ b;
      if (popNum(diff) !== 1) continue;
      const covered = base.some((imp) => imp.covers.includes(a) && imp.covers.includes(b));
      if (covered) continue;
      let consensus = null;
      for (const p of solved2.primes) {
        if (!p.covers.includes(a) || !p.covers.includes(b)) continue;
        if (consensus === null || p.literals < consensus.literals) consensus = p;
      }
      if (consensus === null) continue;
      const pbit = Math.round(Math.log2(diff));
      out.push({ a, b, variable: vars[n - 1 - pbit], consensus });
    }
  }
  return out;
}
function hazard(spec) {
  const { n, minterms, dontCares } = checkSpec(spec);
  const vars = spec.variables.slice();
  const sop = solve(spec, "SOP");
  const pos = solve(spec, "POS");
  const mset = new Set(minterms);
  const dcSet = new Set(dontCares);
  const zeros = [];
  for (let m = 0; m < 1 << n; m++) if (!mset.has(m) && !dcSet.has(m)) zeros.push(m);
  const static1 = findHazards(minterms, n, vars, sop);
  const static0 = findHazards(zeros, n, vars, pos);
  const baseTerms = sop.solutions[0];
  const texts = baseTerms.map((i) => i.text);
  const latex = baseTerms.map((i) => i.latex);
  const masks = new Set(baseTerms.map((i) => i.mask));
  for (const h of static1) {
    if (masks.has(h.consensus.mask)) continue;
    masks.add(h.consensus.mask);
    texts.push(h.consensus.text);
    latex.push(h.consensus.latex);
  }
  return {
    static1,
    static0,
    hazardFreeSop: texts.length ? texts.join(" + ") : "0",
    hazardFreeSopLatex: latex.length ? latex.join(" + ") : "0"
  };
}
function gateForms(spec) {
  const { n, minterms, dontCares } = checkSpec(spec);
  const vars = spec.variables.slice();
  const sop = solve(spec, "SOP");
  const pos = solve(spec, "POS");
  const mset = new Set(minterms);
  const dcSet = new Set(dontCares);
  const zeros = [];
  for (let m = 0; m < 1 << n; m++) if (!mset.has(m) && !dcSet.has(m)) zeros.push(m);
  const comp = solve({ variables: vars, minterms: zeros, dontCares }, "SOP");
  const nand = sop.solutions[0];
  let nandNand = { text: "0", latex: "0" };
  if (nand.length === 0) {
    nandNand = { text: "0", latex: "0" };
  } else if (nand.length === 1 && isAllDash(nand[0].mask)) {
    nandNand = { text: "1", latex: "1" };
  } else {
    const items = nand.map((imp) => {
      if (imp.literals === 1) {
        const i = imp.mask.search(/[01]/);
        const neg = imp.mask[i] === "1";
        return { t: litOf(vars[i], neg, false), l: litOf(vars[i], neg, true) };
      }
      return { t: "(" + imp.text + ")'", l: "\\overline{" + imp.latex + "}" };
    });
    nandNand = {
      text: "(" + items.map((x) => x.t).join("") + ")'",
      latex: "\\overline{" + items.map((x) => x.l).join("") + "}"
    };
  }
  const nor = pos.solutions[0];
  let norNor = { text: "1", latex: "1" };
  if (nor.length === 0) {
    norNor = { text: "1", latex: "1" };
  } else if (nor.length === 1 && isAllDash(nor[0].mask)) {
    norNor = { text: "0", latex: "0" };
  } else {
    const items = nor.map((imp) => {
      if (imp.literals === 1) {
        const i = imp.mask.search(/[01]/);
        const neg = imp.mask[i] === "0";
        return { t: litOf(vars[i], neg, false), l: litOf(vars[i], neg, true) };
      }
      return { t: imp.text + "'", l: "\\overline{" + imp.latex + "}" };
    });
    norNor = {
      text: "(" + items.map((x) => x.t).join("+") + ")'",
      latex: "\\overline{" + items.map((x) => x.l).join("+") + "}"
    };
  }
  const g = comp.solutions[0];
  let andOrInvert = { text: "1", latex: "1" };
  if (g.length === 0) {
    andOrInvert = { text: "1", latex: "1" };
  } else if (g.length === 1 && isAllDash(g[0].mask)) {
    andOrInvert = { text: "0", latex: "0" };
  } else {
    andOrInvert = {
      text: "(" + g.map((i) => i.text).join("+") + ")'",
      latex: "\\overline{" + g.map((i) => i.latex).join("+") + "}"
    };
  }
  return {
    nandNand: nandNand.text,
    nandNandLatex: nandNand.latex,
    norNor: norNor.text,
    norNorLatex: norNor.latex,
    andOrInvert: andOrInvert.text,
    andOrInvertLatex: andOrInvert.latex
  };
}
function equivalent(a, b) {
  checkSpec(a);
  checkSpec(b);
  const sameOrder = a.variables.length === b.variables.length && a.variables.every((v, i) => v === b.variables[i]);
  const vars = sameOrder ? a.variables.slice() : [.../* @__PURE__ */ new Set([...a.variables, ...b.variables])].sort();
  if (vars.length > MAX_VARS) {
    throw new DlogicInputError(`比较两个函数时变量并集最多 ${MAX_VARS} 个，当前为 ${vars.length} 个`);
  }
  const n = vars.length;
  const lookup = (spec) => {
    const pos = spec.variables.map((v) => vars.indexOf(v));
    const on = new Set(spec.minterms);
    const dc = new Set(spec.dontCares ?? []);
    const k = spec.variables.length;
    return (m) => {
      let idx = 0;
      for (let i = 0; i < k; i++) idx = idx << 1 | bitOf(m, pos[i], n);
      return on.has(idx) ? 1 : dc.has(idx) ? "X" : 0;
    };
  };
  const va = lookup(a);
  const vb = lookup(b);
  for (let m = 0; m < 1 << n; m++) {
    const l = va(m);
    const r = vb(m);
    if (l === "X" || r === "X") continue;
    if (l !== r) {
      const inputs = [];
      for (let i = 0; i < n; i++) inputs.push(bitOf(m, i, n));
      return { equivalent: false, counterexample: { index: m, inputs, left: l, right: r } };
    }
  }
  return { equivalent: true };
}

// src/host/tools/bool.logic.ts
var BOOL_OPS = [
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
var BOOL_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...BOOL_OPS],
    description: "子功能：parse | truth_table | canonical | minimize | kmap | hazard | complement | dual | gate_form | equivalent"
  },
  expr: {
    type: "string",
    description: `布尔表达式，例如 "A'B + AB'"、"!A&B|C"、"A⊕B"。与 minterms 二选一。`
  },
  variables: {
    type: "array",
    items: { type: "string" },
    description: "变量名（按书写顺序，variables[0] 为最高位）。给出 expr 时可省略（按字母序自动确定）；使用 minterms 时必填。"
  },
  minterms: {
    type: "array",
    items: { type: "integer" },
    description: "最小项编号（0 起），与 variables 一起使用。与 expr 二选一。"
  },
  dontCares: {
    type: "array",
    items: { type: "integer" },
    description: "无关项编号，可与 minterms 一起使用。"
  },
  form: {
    type: "string",
    enum: ["SOP", "POS"],
    description: "minimize / kmap 的形式，默认 SOP（与或式）；POS 为或与式。"
  },
  other: {
    type: "string",
    description: "op=equivalent 时的第二个表达式（与 expr 或 minterms 对比）。"
  }
};
var TRUTH_TABLE_LIMIT = 32;
var LIST_LIMIT = 12;
function specFromArgs(args, what = "函数") {
  if (typeof args.expr === "string" && args.expr.trim() !== "") {
    return specFromExpr(args.expr, args.variables);
  }
  if (args.minterms !== void 0) {
    if (!Array.isArray(args.variables) || args.variables.length === 0) {
      throw new DlogicInputError("使用 minterms 时必须同时提供 variables（variables[0] 为最高位）。");
    }
    return {
      variables: args.variables.slice(),
      minterms: args.minterms.slice(),
      dontCares: Array.isArray(args.dontCares) ? args.dontCares.slice() : []
    };
  }
  throw new DlogicInputError(`缺少${what}：请提供 expr，或同时提供 minterms 与 variables。`);
}
function requireExpr(args) {
  if (typeof args.expr !== "string" || args.expr.trim() === "") {
    throw new DlogicInputError(`${args.op} 需要提供 expr 参数。`);
  }
  return args.expr;
}
function unionVars(left, right) {
  const same = left.length === right.length && left.every((v, i) => v === right[i]);
  return same ? left.slice() : [.../* @__PURE__ */ new Set([...left, ...right])].sort();
}
function describeAssignment(vars, inputs) {
  return vars.map((v, i) => `${v}=${inputs[i]}`).join(",");
}
function runBool(args) {
  return envelope(String(args.op), () => {
    const form = args.form ?? "SOP";
    switch (args.op) {
      case "parse": {
        const spec = specFromArgs(args);
        return { result: { spec, input: args.expr ?? `Σm(${spec.minterms.join(",")})` } };
      }
      case "truth_table": {
        const spec = specFromArgs(args);
        return { result: { spec, table: truthTable(spec) } };
      }
      case "canonical": {
        const spec = specFromArgs(args);
        return { result: { spec, canonical: canonical(spec) } };
      }
      case "minimize": {
        const spec = specFromArgs(args);
        return { result: { spec, minimize: minimize(spec, form) }, steps: minimizeSteps(spec, form) };
      }
      case "kmap": {
        const spec = specFromArgs(args);
        const layout = kmap(spec, form);
        return { result: { spec, kmap: layout, minimize: minimize(spec, form) }, steps: minimizeSteps(spec, form) };
      }
      case "hazard": {
        const spec = specFromArgs(args);
        return { result: { spec, hazard: hazard(spec) } };
      }
      case "complement": {
        const expr = requireExpr(args);
        return { result: { input: expr, ...complementExpr(expr, args.variables) } };
      }
      case "dual": {
        const expr = requireExpr(args);
        return { result: { input: expr, ...dualExpr(expr, args.variables) } };
      }
      case "gate_form": {
        const spec = specFromArgs(args);
        return { result: { spec, gates: gateForms(spec) } };
      }
      case "equivalent": {
        if (typeof args.other !== "string" || args.other.trim() === "") {
          throw new DlogicInputError("equivalent 需要提供 other（第二个表达式）。");
        }
        const left = specFromArgs(args, "左侧函数");
        const right = specFromExpr(args.other, args.variables);
        return { result: { left, right, equivalence: equivalent(left, right) } };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
function listLines(lines, items, indent = "  ") {
  const shown = items.slice(0, LIST_LIMIT);
  for (const it of shown) lines.push(`${indent}${it}`);
  if (items.length > LIST_LIMIT) lines.push(`${indent}……另有 ${items.length - LIST_LIMIT} 项`);
}
function primeText(p, mask) {
  return p.find((x) => x.mask === mask)?.text ?? mask;
}
function renderBool(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  const r = value.result;
  switch (value.op) {
    case "parse": {
      const { spec, input } = r;
      lines.push(`输入：${input}`, `变量：${spec.variables.join(", ")}`, `最小项：Σm(${spec.minterms.join(",")})`);
      if (spec.dontCares.length) lines.push(`无关项：Σd(${spec.dontCares.join(",")})`);
      break;
    }
    case "truth_table": {
      const { table } = r;
      lines.push(`真值表（变量顺序：${table.variables.join(" ")}）`, `${table.variables.join(" ")} | F`);
      if (table.rows.length <= TRUTH_TABLE_LIMIT) {
        for (const row of table.rows) lines.push(`${row.inputs.join(" ")} | ${row.output}`);
      } else {
        lines.push(`共 ${table.rows.length} 行，超过 ${TRUTH_TABLE_LIMIT} 行，逐行略去。`);
      }
      break;
    }
    case "canonical": {
      const { canonical: c } = r;
      lines.push(`标准和：F = ${c.sigma}`, `标准积：F = ${c.pi}`, `标准与或式：F = ${c.sopText}`, `标准或与式：F = ${c.posText}`);
      break;
    }
    case "minimize": {
      const { minimize: m } = r;
      lines.push(
        `${m.form} 最简式：共 ${m.solutions.length} 个等价解，代价 ${m.cost.terms} 项 ${m.cost.literals} 个文字`
      );
      m.texts.forEach((t, i) => lines.push(`  解${i + 1}：F = ${t}`));
      lines.push(`质蕴涵项：${m.primeImplicants.map((p) => p.text).join("、") || "无"}`);
      lines.push(
        `本质质蕴涵项：${m.essential.map((x) => primeText(m.primeImplicants, x)).join("、") || "无"}`
      );
      break;
    }
    case "kmap": {
      const { kmap: k, minimize: m } = r;
      lines.push(
        `卡诺图：行变量 ${k.rowVars.join("") || "-"}，列变量 ${k.colVars.join("") || "-"}` + (k.planeVar ? `，平面变量 ${k.planeVar}` : "")
      );
      lines.push(`圈组（共 ${k.groups.length} 个）：`);
      k.groups.forEach((g, i) => lines.push(`  圈${i + 1}：${g.text}，覆盖 ${g.cells.map((c) => `m${c}`).join(",")}`));
      if (m.texts.length > 1) {
        m.texts.forEach((t, i) => lines.push(`化简结果（解 ${i + 1}）：F = ${t}（${m.form}，${m.cost.terms} 项 ${m.cost.literals} 个文字）`));
      } else {
        lines.push(`化简结果：F = ${m.texts[0] ?? "0"}（${m.form}，${m.cost.terms} 项 ${m.cost.literals} 个文字）`);
      }
      break;
    }
    case "hazard": {
      const { hazard: h } = r;
      if (h.static1.length === 0 && h.static0.length === 0) lines.push("静态险象：无。");
      const pairs = (label, list) => {
        if (list.length === 0) return;
        lines.push(`${label}（${list.length} 对）：`);
        listLines(
          lines,
          list.map((x) => `m${x.a} 与 m${x.b} 相邻（变量 ${x.variable} 变化），未被同一圈覆盖；消去项 ${x.consensus.text}`)
        );
      };
      pairs("静态1型险象", h.static1);
      pairs("静态0型险象", h.static0);
      lines.push(`消除险象后的与或式：F = ${h.hazardFreeSop}`);
      break;
    }
    case "complement": {
      const { input, text: text2 } = r;
      lines.push(`${input} 的反函数：${text2}`);
      break;
    }
    case "dual": {
      const { input, text: text2 } = r;
      lines.push(`${input} 的对偶式：${text2}`);
      break;
    }
    case "gate_form": {
      const { gates: g } = r;
      lines.push(`与非-与非式：F = ${g.nandNand}`, `或非-或非式：F = ${g.norNor}`, `与或非式：F = ${g.andOrInvert}`);
      break;
    }
    case "equivalent": {
      const { left, right, equivalence: e } = r;
      if (e.equivalent) {
        lines.push("两式等价：在所有取值上输出一致。");
      } else if (e.counterexample) {
        const vars = unionVars(left.variables, right.variables);
        const ce = e.counterexample;
        lines.push(`两式不等价。反例：当 ${describeAssignment(vars, ce.inputs)} 时，左式为 ${ce.left}，右式为 ${ce.right}。`);
      } else {
        lines.push("两式不等价。");
      }
      break;
    }
    default:
      lines.push("（无可显示的结果）");
  }
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/bool.ts
var DESCRIPTION = [
  "布尔函数的确定性计算引擎。凡是 3 变量及以上的化简、真值表、卡诺图、险象判断、等价判断，以及 2 变量的化简核对，",
  "都必须调用本工具，不得心算或手写。op 取值：parse 解析并列出最小项；truth_table 真值表；canonical 标准与或式与标准或与式；",
  "minimize 全部最简解与代价（form 选 SOP 或 POS）；kmap 卡诺图布局与圈组；hazard 静态 0/1 型险象与消去项；",
  "complement 反演式；dual 对偶式；gate_form 与非-与非、或非-或非、与或非形式；equivalent 判断 expr 与 other 是否等价。",
  "表达式语法：非号用后缀 ' 或前缀 ! ~ ¬；与可并列书写或用 * · &；或用 +；异或用 ⊕ 或 ^；同或用 ⊙；括号 ( )。",
  `例如 "A'B + AB'"。函数输入二选一：expr（可配 variables），或 minterms + dontCares + variables（variables[0] 为最高位）。`
].join("");
var dlogicBool = defineTool2({
  name: "dlogic_bool",
  description: DESCRIPTION,
  parameters: BOOL_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderBool(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_bool", value })
  },
  async execute(args) {
    return runBool(args);
  }
});

// src/host/tools/verify.ts
import { defineTool as defineTool3 } from "@deepseek-ai/dsh-tools";

// src/solvers/verify.ts
function productLits(e) {
  switch (e.k) {
    case "var":
      return [{ name: e.name, neg: false }];
    case "not":
      return e.x.k === "var" ? [{ name: e.x.name, neg: true }] : null;
    case "and": {
      const out = [];
      for (const x of e.xs) {
        const l = productLits(x);
        if (l === null) return null;
        out.push(...l);
      }
      return out;
    }
    default:
      return null;
  }
}
function sumLits(e) {
  if (e.k === "or") {
    const out = [];
    for (const x of e.xs) {
      const l = sumLits(x);
      if (l === null) return null;
      out.push(...l);
    }
    return out;
  }
  return productLits(e);
}
function flatCost(e, form) {
  if (e.k === "const") {
    const one = e.v === 1;
    if (form === "SOP") return one ? { terms: 1, literals: 0 } : { terms: 0, literals: 0 };
    return one ? { terms: 0, literals: 0 } : { terms: 1, literals: 0 };
  }
  const groups = [];
  if (form === "SOP") {
    const items = e.k === "or" ? e.xs : [e];
    for (const x of items) {
      const l = productLits(x);
      if (l === null) return null;
      groups.push(l);
    }
  } else {
    const items = e.k === "and" ? e.xs : [e];
    for (const x of items) {
      const l = sumLits(x);
      if (l === null) return null;
      groups.push(l);
    }
  }
  return {
    terms: groups.length,
    literals: groups.reduce((s, g) => s + g.length, 0)
  };
}
function checkAnswer(input) {
  if (typeof input.candidate !== "string" || input.candidate.trim() === "") {
    throw new DlogicInputError("候选答案不能为空");
  }
  const form = input.form ?? "SOP";
  if (form !== "SOP" && form !== "POS") throw new DlogicInputError("形式必须是 SOP 或 POS");
  const refVars = input.reference.variables;
  const unknown = parseExpr(input.candidate).variables.filter((v) => !refVars.includes(v));
  if (unknown.length > 0) {
    throw new DlogicInputError(`候选答案使用了参考函数中没有的变量：${unknown.join("、")}`);
  }
  const candSpec = specFromExpr(input.candidate, refVars);
  const eq = equivalent(candSpec, input.reference);
  const result = { equivalent: eq.equivalent, variables: refVars.slice() };
  if (eq.counterexample) result.counterexample = eq.counterexample;
  const { ast } = parseExpr(input.candidate, refVars);
  const cost = flatCost(ast, form);
  if (cost) result.candidateCost = cost;
  if (input.requireMinimal === true) {
    const best = minimize(input.reference, form).cost;
    result.minimalCost = best;
    if (!eq.equivalent) result.minimal = false;
    else if (cost === null) result.minimal = null;
    else result.minimal = cost.terms === best.terms && cost.literals === best.literals;
  }
  if (input.reveal === true) {
    const m = minimize(input.reference, form);
    result.reference = { texts: m.texts.slice(), latex: m.latex.slice() };
  }
  return result;
}

// src/host/tools/verify.logic.ts
var VERIFY_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: ["check"],
    description: "子功能：check 核对候选答案"
  },
  candidate: {
    type: "string",
    required: true,
    description: "待核对的表达式（学生或模型给出的答案），语法同 dlogic_bool。只能使用参考函数中的变量。"
  },
  expr: {
    type: "string",
    description: "参考函数（原题函数）的表达式。与 minterms 二选一。"
  },
  minterms: {
    type: "array",
    items: { type: "integer" },
    description: "参考函数的最小项编号，需与 variables 一起使用。"
  },
  dontCares: {
    type: "array",
    items: { type: "integer" },
    description: "参考函数的无关项编号。"
  },
  variables: {
    type: "array",
    items: { type: "string" },
    description: "参考函数的变量（variables[0] 为最高位）。"
  },
  requireMinimal: {
    type: "boolean",
    description: "为 true 时还判断候选式是否达到最简（按项数、其次文字数比较）。"
  },
  form: {
    type: "string",
    enum: ["SOP", "POS"],
    description: "比较代价所用的形式，默认 SOP。"
  },
  reveal: {
    type: "boolean",
    description: "为 true 时才返回参考答案。导学（苏格拉底）模式下必须为 false。"
  }
};
function runVerify(args) {
  return envelope(String(args.op), () => {
    if (args.op !== "check") throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    const reference = specFromArgs(args, "参考函数");
    const result = checkAnswer({
      candidate: args.candidate,
      reference,
      requireMinimal: args.requireMinimal === true,
      form: args.form ?? "SOP",
      reveal: args.reveal === true
    });
    return { result };
  });
}
function renderVerify(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const r = value.result;
  const lines = [];
  lines.push(r.equivalent ? "结论：候选式与参考函数等价（所有取值上输出一致）。" : "结论：候选式与参考函数不等价。");
  if (!r.equivalent && r.counterexample) {
    const ce = r.counterexample;
    lines.push(
      `反例：当 ${describeAssignment(r.variables, ce.inputs)} 时，候选式为 ${ce.left}，原函数为 ${ce.right}。`
    );
  }
  if (r.minimal !== void 0) {
    const costText = r.candidateCost ? `${r.candidateCost.terms} 项 ${r.candidateCost.literals} 个文字` : "不是标准形式";
    if (r.minimal === true) {
      lines.push(`最简性：达到最简（${costText}）。`);
    } else if (r.minimal === false) {
      if (!r.equivalent) {
        lines.push("最简性：候选式不等价，无需比较代价。");
      } else {
        const best = r.minimalCost;
        lines.push(
          `最简性：未达到最简。候选式为 ${costText}，最简为 ${best ? `${best.terms} 项 ${best.literals} 个文字` : "未知"}。`
        );
      }
    } else {
      lines.push("最简性：候选式不是与或式或或与式，无法比较是否最简。");
    }
  }
  if (r.reference) {
    lines.push("参考答案：");
    for (const t of r.reference.texts) lines.push(`  F = ${t}`);
  }
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/verify.ts
var DESCRIPTION2 = [
  "核对候选答案（学生或模型给出的表达式）：判断它与参考函数是否等价，给出反例；requireMinimal 为 true 时还判断是否达到最简。",
  "参考函数用 expr，或 minterms + variables（与 dlogic_bool 相同）。候选式只能使用参考函数的变量。",
  "最终结论前必须以 requireMinimal: true 核对。",
  "导学（苏格拉底）模式下 reveal 必须为 false：参考答案不得透露给学生，只用 counterexample 引导思考。",
  "只有解题核验模式下，学生明确要求看答案时才可设 reveal: true。"
].join("");
var dlogicVerify = defineTool3({
  name: "dlogic_verify",
  description: DESCRIPTION2,
  parameters: VERIFY_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderVerify(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_verify", value })
  },
  async execute(args) {
    return runVerify(args);
  }
});

// src/host/tools/knowledge.ts
import { defineTool as defineTool4 } from "@deepseek-ai/dsh-tools";

// skills/digital-logic-tutor/references/knowledge-map.json
var knowledge_map_default = [
  { id: "k1", title: "第1章 开关理论基础", chapter: 1, prereqs: [], related: [], keywords: ["开关理论", "数制", "逻辑代数"] },
  { id: "k1.1", title: "二进制系统", chapter: 1, prereqs: [], related: [], keywords: ["二进制", "数字系统", "离散量"] },
  { id: "k1.1.1", title: "连续量和离散量", chapter: 1, prereqs: [], related: [], keywords: ["模拟量", "数字量", "连续量", "离散量"] },
  { id: "k1.1.2", title: "开关量", chapter: 1, prereqs: ["k1.1.1"], related: [], keywords: ["开关量", "高低电平", "二值逻辑", "0和1"] },
  { id: "k1.1.3", title: "数字波形", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["数字波形", "时序图", "脉冲", "上升沿"] },
  { id: "k1.2", title: "数制与码制", chapter: 1, prereqs: ["k1.1"], related: [], keywords: ["数制", "码制", "进制"] },
  { id: "k1.2.1", title: "进位计数制", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["十进制", "二进制", "八进制", "十六进制", "位权"] },
  { id: "k1.2.2", title: "进位计数制的相互转换", chapter: 1, prereqs: ["k1.2.1"], related: [], keywords: ["进制转换", "按权展开", "除基取余", "小数转换"] },
  { id: "k1.2.3", title: "二进制编码", chapter: 1, prereqs: ["k1.2.1"], related: [], keywords: ["BCD码", "8421码", "格雷码", "二进制编码"] },
  { id: "k1.3", title: "逻辑函数及其描述工具", chapter: 1, prereqs: ["k1.2"], related: [], keywords: ["逻辑函数", "真值表", "逻辑表达式"] },
  { id: "k1.3.1", title: "逻辑函数的基本概念", chapter: 1, prereqs: ["k1.1.2"], related: [], keywords: ["逻辑函数", "逻辑变量", "自变量", "因变量"] },
  { id: "k1.3.2", title: "逻辑函数的描述工具", chapter: 1, prereqs: ["k1.3.1"], related: [], keywords: ["真值表", "逻辑表达式", "逻辑图", "最小项"] },
  { id: "k1.3.3", title: "基本逻辑运算", chapter: 1, prereqs: ["k1.3.1"], related: [], keywords: ["与运算", "或运算", "非运算", "与非", "或非", "异或"] },
  { id: "k1.3.4", title: "正逻辑、负逻辑、三态门", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["正逻辑", "负逻辑", "三态门", "高阻态"] },
  { id: "k1.4", title: "布尔代数", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["布尔代数", "逻辑代数", "代数化简"] },
  { id: "k1.4.1", title: "布尔代数的基本定律", chapter: 1, prereqs: ["k1.3.3"], related: [], keywords: ["交换律", "结合律", "分配律", "摩根定律", "吸收律"] },
  { id: "k1.4.2", title: "布尔代数运算的基本规则", chapter: 1, prereqs: ["k1.4.1"], related: [], keywords: ["代入规则", "反演规则", "对偶规则"] },
  { id: "k1.4.3", title: "用布尔代数简化逻辑函数", chapter: 1, prereqs: ["k1.4.2"], related: [], keywords: ["逻辑函数化简", "公式化简", "与或式", "代数化简"] },
  { id: "k1.5", title: "卡诺图", chapter: 1, prereqs: ["k1.3.2"], related: [], keywords: ["卡诺图", "格雷码", "相邻项", "圈组"] },
  { id: "k1.5.1", title: "卡诺图的结构与特点", chapter: 1, prereqs: ["k1.3.2"], related: [], keywords: ["卡诺图", "格雷码排列", "相邻性", "最小项方格"] },
  { id: "k1.5.2", title: "用卡诺图简化逻辑函数", chapter: 1, prereqs: ["k1.5.1", "k1.3.1"], related: [], keywords: ["卡诺图化简", "圈组", "无关项", "卡诺图"] },
  { id: "k1.6", title: "数字集成电路", chapter: 1, prereqs: ["k1.3.4"], related: [], keywords: ["集成电路", "IC", "TTL", "CMOS"] },
  { id: "k1.6.1", title: "集成电路的制造技术类型", chapter: 1, prereqs: [], related: [], keywords: ["双极型", "MOS型", "TTL", "CMOS"] },
  { id: "k1.6.2", title: "集成电路的封装类型", chapter: 1, prereqs: ["k1.6.1"], related: [], keywords: ["DIP封装", "SOP封装", "封装", "引脚"] },
  { id: "k1.6.3", title: "集成电路的规模类型", chapter: 1, prereqs: ["k1.6.1"], related: [], keywords: ["SSI", "MSI", "LSI", "VLSI", "集成度"] },
  { id: "k1.6.4", title: "集成电路的使用特性", chapter: 1, prereqs: ["k1.6.2", "k1.6.3"], related: [], keywords: ["扇出系数", "噪声容限", "传输延迟", "功耗"] },
  { id: "k2", title: "第2章 组合逻辑", chapter: 2, prereqs: ["k1"], related: [], keywords: ["组合逻辑", "组合电路", "无记忆"] },
  { id: "k2.1", title: "组合逻辑分析", chapter: 2, prereqs: ["k1.4.3"], related: [], keywords: ["组合逻辑分析", "逻辑电路", "表达式"] },
  { id: "k2.1.1", title: "逐级电平推导法", chapter: 2, prereqs: ["k1.3.2"], related: [], keywords: ["逐级推导", "电平", "门电路"] },
  { id: "k2.1.2", title: "列写布尔表达式法", chapter: 2, prereqs: ["k1.4.2"], related: [], keywords: ["布尔表达式", "逻辑表达式", "表达式化简"] },
  { id: "k2.1.3", title: "数字波形图分析法", chapter: 2, prereqs: ["k1.1.3", "k2.1.2"], related: [], keywords: ["波形图", "时序分析", "输入波形"] },
  { id: "k2.1.4", title: "列写逻辑电路真值表法", chapter: 2, prereqs: ["k1.3.2", "k2.1.2"], related: [], keywords: ["真值表", "逻辑功能", "功能判定"] },
  { id: "k2.1.5", title: "组合逻辑中的竞争冒险", chapter: 2, prereqs: ["k2.1.3"], related: ["k1.5.2"], keywords: ["竞争冒险", "毛刺", "险象", "冒险消除"] },
  { id: "k2.2", title: "组合逻辑设计", chapter: 2, prereqs: ["k2.1", "k1.4.3"], related: [], keywords: ["组合逻辑设计", "设计步骤", "真值表"] },
  { id: "k2.2.1", title: "组合逻辑设计步骤", chapter: 2, prereqs: ["k2.1"], related: [], keywords: ["设计步骤", "真值表", "最简表达式", "门电路实现"] },
  { id: "k2.2.2", title: "逻辑问题的描述", chapter: 2, prereqs: ["k1.3.2"], related: [], keywords: ["文字描述", "逻辑赋值", "真值表"] },
  { id: "k2.2.3", title: "利用任意项的逻辑设计", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["任意项", "无关项", "约束条件", "卡诺图"] },
  { id: "k2.3", title: "组合逻辑电路的等价变换", chapter: 2, prereqs: ["k1.4.1", "k2.2"], related: [], keywords: ["等价变换", "与非门", "或非门"] },
  { id: "k2.3.1", title: "摩根定理的应用", chapter: 2, prereqs: ["k1.4.1"], related: [], keywords: ["摩根定理", "反演", "德摩根"] },
  { id: "k2.3.2", title: "与非门、或非门作为通用件", chapter: 2, prereqs: ["k2.3.1"], related: [], keywords: ["通用门", "与非门", "或非门", "NAND", "NOR"] },
  { id: "k2.3.3", title: "利用与非门/或非门进行等价变换", chapter: 2, prereqs: ["k2.3.2"], related: [], keywords: ["与非-与非", "或非-或非", "等价变换", "NAND"] },
  { id: "k2.3.4", title: '逻辑函数的"与或非"门实现', chapter: 2, prereqs: ["k2.3.3"], related: [], keywords: ["与或非门", "AOI", "反函数", "逻辑实现"] },
  { id: "k2.4", title: "数据选择器与分配器", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["数据选择器", "数据分配器", "多路开关"] },
  { id: "k2.4.1", title: "数据选择器", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["数据选择器", "MUX", "74LS151", "多路选择"] },
  { id: "k2.4.2", title: "数据分配器", chapter: 2, prereqs: ["k2.4.1"], related: ["k2.5.1"], keywords: ["数据分配器", "DMUX", "分路", "译码"] },
  { id: "k2.5", title: "译码器和编码器", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["译码器", "编码器", "译码", "编码"] },
  { id: "k2.5.1", title: "译码器", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["译码器", "74LS138", "地址译码", "最小项译码"] },
  { id: "k2.5.2", title: "编码器", chapter: 2, prereqs: ["k1.2.3"], related: ["k1.2.3"], keywords: ["编码器", "74LS148", "优先编码", "8线3线"] },
  { id: "k2.6", title: "数据比较器和加法器", chapter: 2, prereqs: ["k2.2"], related: [], keywords: ["比较器", "加法器", "算术运算"] },
  { id: "k2.6.1", title: "数据比较器", chapter: 2, prereqs: ["k2.2.1"], related: [], keywords: ["数据比较器", "74LS85", "大小比较", "级联扩展"] },
  { id: "k2.6.2", title: "加法器", chapter: 2, prereqs: ["k2.2.1", "k1.2.2"], related: [], keywords: ["加法器", "半加器", "全加器", "74LS283", "进位"] },
  { id: "k2.7", title: "奇偶校验器", chapter: 2, prereqs: ["k2.1"], related: [], keywords: ["奇偶校验", "校验位", "校验器"] },
  { id: "k2.7.1", title: "奇偶校验的基本原理", chapter: 2, prereqs: ["k1.2.3", "k2.2.1"], related: [], keywords: ["奇校验", "偶校验", "74LS280", "校验码"] },
  { id: "k2.7.2", title: "具有奇偶校验的数据传输", chapter: 2, prereqs: ["k2.7.1"], related: [], keywords: ["数据传输", "差错检测", "发送校验", "接收校验"] },
  { id: "k3", title: "第3章 时序逻辑", chapter: 3, prereqs: ["k2"], related: [], keywords: ["时序逻辑", "时序电路", "状态", "记忆"] },
  { id: "k3.1", title: "锁存器", chapter: 3, prereqs: ["k2.3.2"], related: [], keywords: ["锁存器", "latch", "反馈", "电平触发"] },
  { id: "k3.1.1", title: "锁存器的基本特性", chapter: 3, prereqs: ["k2.3.2"], related: [], keywords: ["锁存器", "记忆特性", "双稳态", "反馈"] },
  { id: "k3.1.2", title: "基本SR锁存器", chapter: 3, prereqs: ["k3.1.1"], related: [], keywords: ["基本SR锁存器", "与非门锁存器", "置位复位", "SR"] },
  { id: "k3.1.3", title: "门控SR锁存器", chapter: 3, prereqs: ["k3.1.2"], related: [], keywords: ["门控SR", "使能", "控制端"] },
  { id: "k3.1.4", title: "门控D锁存器", chapter: 3, prereqs: ["k3.1.3"], related: [], keywords: ["门控D锁存器", "透明", "D锁存"] },
  { id: "k3.2", title: "触发器", chapter: 3, prereqs: ["k3.1"], related: [], keywords: ["触发器", "flip-flop", "边沿触发"] },
  { id: "k3.2.1", title: "SR触发器", chapter: 3, prereqs: ["k3.1.3"], related: [], keywords: ["SR触发器", "边沿", "特性方程"] },
  { id: "k3.2.2", title: "D触发器", chapter: 3, prereqs: ["k3.1.4", "k3.2.1"], related: [], keywords: ["D触发器", "边沿触发", "74LS74", "特性方程"] },
  { id: "k3.2.3", title: "JK触发器", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["JK触发器", "74LS112", "翻转", "特性方程"] },
  { id: "k3.2.4", title: "触发器的应用和时间参数", chapter: 3, prereqs: ["k3.2.2"], related: ["k1.1.3"], keywords: ["建立时间", "保持时间", "传输延迟", "时间参数"] },
  { id: "k3.3", title: "寄存器和移位寄存器", chapter: 3, prereqs: ["k3.2"], related: [], keywords: ["寄存器", "移位寄存器", "数据存放"] },
  { id: "k3.3.1", title: "寄存器", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["数据寄存器", "并行存取", "清零", "74LS175"] },
  { id: "k3.3.2", title: "移位寄存器", chapter: 3, prereqs: ["k3.3.1"], related: [], keywords: ["移位寄存器", "串行输入", "74LS194", "左移右移"] },
  { id: "k3.4", title: "计数器", chapter: 3, prereqs: ["k3.2.3"], related: [], keywords: ["计数器", "计数", "模值"] },
  { id: "k3.4.1", title: "同步计数器", chapter: 3, prereqs: ["k3.2.3"], related: [], keywords: ["同步计数器", "模N计数", "同时翻转", "级联"] },
  { id: "k3.4.2", title: "异步计数器", chapter: 3, prereqs: ["k3.2.3"], related: ["k3.4.1"], keywords: ["异步计数器", "行波计数", "纹波", "级联延迟"] },
  { id: "k3.4.3", title: "中规模集成计数器及应用", chapter: 3, prereqs: ["k3.4.1", "k3.3.2"], related: ["k3.6.2"], keywords: ["74LS161", "74LS160", "同步清零", "任意进制"] },
  { id: "k3.5", title: "定时脉冲产生器", chapter: 3, prereqs: ["k3.4"], related: [], keywords: ["定时", "脉冲产生", "时钟"] },
  { id: "k3.5.1", title: "时钟脉冲源电路", chapter: 3, prereqs: ["k1.1.3"], related: [], keywords: ["时钟源", "振荡器", "555定时器", "晶振"] },
  { id: "k3.5.2", title: "节拍脉冲产生器", chapter: 3, prereqs: ["k3.4.3", "k3.5.1"], related: [], keywords: ["节拍脉冲", "环形计数器", "扭环计数器", "节拍"] },
  { id: "k3.5.3", title: "数字钟", chapter: 3, prereqs: ["k3.5.2", "k3.4.3"], related: [], keywords: ["数字钟", "秒分时", "计时", "译码显示"] },
  { id: "k3.6", title: "同步时序逻辑分析", chapter: 3, prereqs: ["k3.2", "k3.3"], related: [], keywords: ["时序分析", "同步时序", "时序电路分析"] },
  { id: "k3.6.1", title: "同步时序逻辑电路的描述工具", chapter: 3, prereqs: ["k3.2.2"], related: [], keywords: ["状态图", "状态表", "时序图", "描述工具"] },
  { id: "k3.6.2", title: "同步时序逻辑电路分析的一般方法", chapter: 3, prereqs: ["k3.6.1", "k3.2"], related: [], keywords: ["时序分析", "状态转换", "激励方程", "输出方程"] },
  { id: "k3.7", title: "同步时序逻辑设计", chapter: 3, prereqs: ["k3.6"], related: [], keywords: ["时序设计", "同步设计", "状态机设计"] },
  { id: "k3.7.1", title: "同步时序逻辑设计方法和步骤", chapter: 3, prereqs: ["k3.6.2"], related: [], keywords: ["设计步骤", "时序设计", "状态机"] },
  { id: "k3.7.2", title: "建立原始状态表的方法", chapter: 3, prereqs: ["k3.7.1"], related: [], keywords: ["原始状态表", "状态表", "状态简化"] },
  { id: "k3.7.3", title: "状态编码", chapter: 3, prereqs: ["k3.7.2"], related: [], keywords: ["状态编码", "独热码", "二进制编码", "格雷码"] },
  { id: "k4", title: "第4章 存储逻辑", chapter: 4, prereqs: ["k3"], related: [], keywords: ["存储器", "存储逻辑", "存储单元"] },
  { id: "k4.1", title: "特殊存储部件", chapter: 4, prereqs: ["k3.3"], related: [], keywords: ["存储部件", "寄存器堆", "专用存储"] },
  { id: "k4.1.1", title: "寄存器堆", chapter: 4, prereqs: ["k3.3.1"], related: [], keywords: ["寄存器堆", "读写端口", "多端口"] },
  { id: "k4.1.2", title: "寄存器阵列", chapter: 4, prereqs: ["k4.1.1"], related: [], keywords: ["寄存器阵列", "字", "存储阵列"] },
  { id: "k4.1.3", title: "寄存器堆栈", chapter: 4, prereqs: ["k4.1.1", "k3.3.2"], related: [], keywords: ["寄存器堆栈", "堆栈", "先进后出", "栈指针"] },
  { id: "k4.2", title: "随机读写存储器RAM", chapter: 4, prereqs: ["k4.1", "k2.5.1"], related: [], keywords: ["RAM", "随机读写", "存储器"] },
  { id: "k4.2.1", title: "RAM的逻辑结构", chapter: 4, prereqs: ["k4.1.2", "k2.5.1"], related: [], keywords: ["RAM结构", "地址线", "数据线", "读写控制"] },
  { id: "k4.2.2", title: "地址译码方法", chapter: 4, prereqs: ["k4.2.1", "k2.5.1"], related: [], keywords: ["地址译码", "74LS138", "行译码", "列译码"] },
  { id: "k4.2.3", title: "SRAM存储器", chapter: 4, prereqs: ["k4.2.1", "k3.1.4"], related: [], keywords: ["SRAM", "静态存储", "六管", "锁存"] },
  { id: "k4.2.4", title: "DRAM存储器", chapter: 4, prereqs: ["k4.2.3"], related: [], keywords: ["DRAM", "动态存储", "刷新", "电容"] },
  { id: "k4.3", title: "只读存储器ROM", chapter: 4, prereqs: ["k4.2.2", "k2.2"], related: [], keywords: ["ROM", "只读存储器", "查找表"] },
  { id: "k4.3.1", title: "掩模ROM", chapter: 4, prereqs: ["k2.1.2", "k1.3.2"], related: [], keywords: ["掩模ROM", "固化", "存储阵列"] },
  { id: "k4.3.2", title: "可编程ROM", chapter: 4, prereqs: ["k4.3.1"], related: ["k5.1.1"], keywords: ["PROM", "EPROM", "可编程ROM", "熔丝"] },
  { id: "k4.4", title: "FLASH存储器", chapter: 4, prereqs: ["k4.3.2"], related: [], keywords: ["FLASH", "闪存", "非易失"] },
  { id: "k4.4.1", title: "FLASH存储元", chapter: 4, prereqs: ["k4.3.2"], related: ["k4.2.3"], keywords: ["浮栅", "存储元", "NOR型", "NAND型"] },
  { id: "k4.4.2", title: "FLASH存储器的基本操作", chapter: 4, prereqs: ["k4.4.1"], related: [], keywords: ["擦除", "编程", "读取", "FLASH操作"] },
  { id: "k4.4.3", title: "FLASH存储器的阵列结构", chapter: 4, prereqs: ["k4.4.2", "k4.2.2"], related: [], keywords: ["阵列结构", "NOR阵列", "NAND阵列", "字线位线"] },
  { id: "k4.5", title: "存储器容量的扩展", chapter: 4, prereqs: ["k4.2.2", "k2.5.1"], related: [], keywords: ["容量扩展", "片选", "位扩展", "字扩展"] },
  { id: "k4.5.1", title: "字长位数扩展", chapter: 4, prereqs: ["k4.2.1"], related: [], keywords: ["位扩展", "字长", "并联"] },
  { id: "k4.5.2", title: "字存储容量扩展", chapter: 4, prereqs: ["k4.5.1", "k2.5.1"], related: [], keywords: ["字扩展", "片选", "74LS138", "地址译码"] },
  { id: "k5", title: "第5章 可编程逻辑", chapter: 5, prereqs: ["k4"], related: [], keywords: ["可编程逻辑", "PLD", "FPGA"] },
  { id: "k5.1", title: "PLD的基本概念", chapter: 5, prereqs: ["k4.3.2", "k2.1.2"], related: [], keywords: ["PLD", "可编程逻辑器件", "与或阵列"] },
  { id: "k5.1.1", title: "可编程阵列", chapter: 5, prereqs: ["k4.3.2"], related: [], keywords: ["PAL", "GAL", "与阵列", "或阵列"] },
  { id: "k5.1.2", title: "PLD的类型", chapter: 5, prereqs: ["k5.1.1"], related: [], keywords: ["PAL", "GAL", "CPLD", "FPGA"] },
  { id: "k5.2", title: "现场可编程门阵列FPGA", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["FPGA", "门阵列", "现场可编程"] },
  { id: "k5.2.1", title: "FPGA的基本结构", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["FPGA结构", "CLB", "布线资源", "IOB"] },
  { id: "k5.2.2", title: "可组态逻辑块CLB", chapter: 5, prereqs: ["k5.2.1"], related: [], keywords: ["CLB", "查找表", "LUT", "触发器"] },
  { id: "k5.2.3", title: "SRAM为基础的FPGA", chapter: 5, prereqs: ["k5.2.2", "k4.2.3"], related: [], keywords: ["SRAM型FPGA", "配置存储", "易失", "比特流"] },
  { id: "k5.3", title: "在系统可编程ISP", chapter: 5, prereqs: ["k5.2", "k4.4"], related: [], keywords: ["ISP", "在系统编程", "JTAG"] },
  { id: "k5.3.1", title: "ispLSI器件的体系结构", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["ispLSI", "全局布线区", "在系统可编程"] },
  { id: "k5.3.2", title: "EPM7128器件的体系结构", chapter: 5, prereqs: ["k5.3.1"], related: [], keywords: ["EPM7128", "CPLD", "宏单元", "逻辑阵列块"] },
  { id: "k5.3.3", title: "在系统编程原理", chapter: 5, prereqs: ["k4.4.2", "k5.3.1"], related: [], keywords: ["在系统编程", "JTAG", "边界扫描", "编程原理"] },
  { id: "k5.4", title: "可编程逻辑的原理图方式设计", chapter: 5, prereqs: ["k5.1"], related: [], keywords: ["原理图输入", "原理图设计", "图形化设计"] },
  { id: "k5.4.1", title: "编程环境和设计流程图", chapter: 5, prereqs: ["k5.1.2"], related: [], keywords: ["设计流程", "开发环境", "设计流程图"] },
  { id: "k5.4.2", title: "设计输入", chapter: 5, prereqs: ["k5.4.1", "k2.2.1"], related: [], keywords: ["设计输入", "原理图", "符号库"] },
  { id: "k5.4.3", title: "功能模拟", chapter: 5, prereqs: ["k5.4.2"], related: [], keywords: ["功能仿真", "功能模拟", "仿真波形"] },
  { id: "k5.4.4", title: "综合和实现(软件)", chapter: 5, prereqs: ["k5.4.3"], related: [], keywords: ["综合", "实现", "布局布线"] },
  { id: "k5.4.5", title: "时序模拟", chapter: 5, prereqs: ["k5.4.4", "k3.2.4"], related: [], keywords: ["时序仿真", "时序模拟", "建立保持", "延迟"] },
  { id: "k5.4.6", title: "器件下载", chapter: 5, prereqs: ["k5.4.4", "k5.3.3"], related: [], keywords: ["器件下载", "编程文件", "下载", "JTAG"] },
  { id: "k5.5", title: "可编程逻辑的HDL文本方式设计", chapter: 5, prereqs: ["k5.4.1"], related: [], keywords: ["HDL", "Verilog", "文本设计"] },
  { id: "k5.5.1", title: "HDL的基本概念", chapter: 5, prereqs: ["k5.5"], related: [], keywords: ["Verilog", "HDL", "模块", "always"] },
  { id: "k5.5.2", title: "HDL的组合逻辑设计", chapter: 5, prereqs: ["k5.5.1", "k2.2.1"], related: [], keywords: ["Verilog", "组合逻辑", "assign", "always组合"] },
  { id: "k5.5.3", title: "HDL的时序逻辑设计", chapter: 5, prereqs: ["k5.5.2", "k3.2.2"], related: [], keywords: ["Verilog", "时序逻辑", "always时序", "非阻塞赋值"] },
  { id: "k6", title: "第6章 数字系统", chapter: 6, prereqs: ["k5"], related: [], keywords: ["数字系统", "子系统", "控制器"] },
  { id: "k6.1", title: "数字系统的基本概念", chapter: 6, prereqs: ["k3.7", "k2.2"], related: [], keywords: ["数字系统", "系统模型", "基本概念"] },
  { id: "k6.1.1", title: "一个数字系统实例", chapter: 6, prereqs: ["k3.4.3"], related: [], keywords: ["数字系统实例", "系统示例", "数字钟"] },
  { id: "k6.1.2", title: "数字系统的基本模型", chapter: 6, prereqs: ["k6.1.1"], related: [], keywords: ["数据部分", "控制部分", "基本模型"] },
  { id: "k6.1.3", title: "数字系统与逻辑功能部件的区别", chapter: 6, prereqs: ["k6.1.2"], related: [], keywords: ["数字系统", "功能部件", "区别"] },
  { id: "k6.2", title: "数据通路", chapter: 6, prereqs: ["k6.1.2", "k2.4.1"], related: [], keywords: ["数据通路", "数据路径", "寄存器传输"] },
  { id: "k6.2.1", title: "总线结构", chapter: 6, prereqs: ["k6.1.2", "k1.3.4"], related: [], keywords: ["总线", "三态", "总线结构"] },
  { id: "k6.2.2", title: "数据通路实例", chapter: 6, prereqs: ["k6.2.1"], related: [], keywords: ["数据通路实例", "累加器", "多路选择"] },
  { id: "k6.3", title: "由顶向下的设计方法", chapter: 6, prereqs: ["k6.1", "k6.2"], related: [], keywords: ["自顶向下", "层次设计", "由顶向下"] },
  { id: "k6.3.1", title: "数字系统的设计任务", chapter: 6, prereqs: ["k6.1.3"], related: [], keywords: ["设计任务", "需求分析", "功能划分"] },
  { id: "k6.3.2", title: "算法状态机和算法流程图", chapter: 6, prereqs: ["k6.3.1", "k3.7.1"], related: [], keywords: ["ASM", "算法流程图", "状态机", "ASM图"] },
  { id: "k6.4", title: "小型控制器的设计", chapter: 6, prereqs: ["k6.3.2"], related: [], keywords: ["小型控制器", "控制器设计"] },
  { id: "k6.4.1", title: "控制器的基本概念", chapter: 6, prereqs: ["k6.3.2"], related: [], keywords: ["控制器", "控制信号", "控制单元"] },
  { id: "k6.4.2", title: "计数器型控制器", chapter: 6, prereqs: ["k6.4.1", "k3.4.1"], related: [], keywords: ["计数器型控制器", "顺序脉冲", "计数器"] },
  { id: "k6.4.3", title: "多路选择器型控制器", chapter: 6, prereqs: ["k6.4.1", "k2.4.1"], related: [], keywords: ["多路选择器型", "74LS151", "控制器", "选择器"] },
  { id: "k6.4.4", title: "定序型控制器", chapter: 6, prereqs: ["k6.4.1", "k3.3.2"], related: [], keywords: ["定序型控制器", "移位寄存器", "序列"] },
  { id: "k6.5", title: "数字系统设计实例", chapter: 6, prereqs: ["k6.4", "k6.3"], related: [], keywords: ["设计实例", "综合实例", "系统设计"] },
  { id: "k6.5.1", title: "由顶向下——子系统的划分", chapter: 6, prereqs: ["k6.3.1"], related: [], keywords: ["子系统划分", "自顶向下", "功能划分"] },
  { id: "k6.5.2", title: "小型控制器的实现方案", chapter: 6, prereqs: ["k6.5.1", "k6.4.4"], related: [], keywords: ["控制器实现", "实现方案", "方案对比"] },
  { id: "k7", title: "第7章 A/D转换、D/A转换", chapter: 7, prereqs: ["k1"], related: [], keywords: ["A/D转换", "D/A转换", "数模转换", "模数转换"] },
  { id: "k7.1", title: "数字信号处理的基本概念", chapter: 7, prereqs: ["k1.1.1"], related: [], keywords: ["数字信号处理", "数字信号", "模拟信号"] },
  { id: "k7.2", title: "A/D转换", chapter: 7, prereqs: ["k7.1"], related: [], keywords: ["A/D转换", "ADC", "模数转换"] },
  { id: "k7.2.1", title: "采样定理", chapter: 7, prereqs: ["k7.1"], related: [], keywords: ["采样定理", "奈奎斯特", "采样频率", "混叠"] },
  { id: "k7.2.2", title: "模数转换过程", chapter: 7, prereqs: ["k7.2.1", "k1.2.3"], related: [], keywords: ["采样", "保持", "量化", "编码"] },
  { id: "k7.2.3", title: "A/D转换器", chapter: 7, prereqs: ["k7.2.2"], related: [], keywords: ["ADC", "逐次逼近", "双积分", "并行比较"] },
  { id: "k7.2.4", title: "ADC的性能参数", chapter: 7, prereqs: ["k7.2.3"], related: [], keywords: ["分辨率", "转换速度", "量化误差", "ADC参数"] },
  { id: "k7.3", title: "D/A转换", chapter: 7, prereqs: ["k7.1", "k1.2.2"], related: [], keywords: ["D/A转换", "DAC", "数模转换"] },
  { id: "k7.3.1", title: "权电阻DAC", chapter: 7, prereqs: [], related: [], keywords: ["权电阻", "DAC", "加权求和"] },
  { id: "k7.3.2", title: "R-2R T型DAC", chapter: 7, prereqs: ["k7.3.1"], related: [], keywords: ["R-2R", "T型", "DAC", "电阻网络"] },
  { id: "k7.3.3", title: "R-2R倒T型DAC", chapter: 7, prereqs: ["k7.3.2"], related: [], keywords: ["倒T型", "R-2R", "DAC", "电流输出"] },
  { id: "k7.3.4", title: "DAC的性能参数", chapter: 7, prereqs: ["k7.3.3"], related: [], keywords: ["分辨率", "建立时间", "线性度", "DAC参数"] }
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
  if (!Array.isArray(input)) throw new Error("知识图谱必须是数组。");
  const byId = /* @__PURE__ */ new Map();
  for (const n of input) {
    if (!n || typeof n.id !== "string" || n.id === "") throw new Error("知识点缺少 id。");
    if (byId.has(n.id)) throw new Error(`知识点 id 重复：${n.id}`);
    byId.set(n.id, n);
  }
  for (const n of input) {
    if (!ID_RE.test(n.id)) throw new Error(`知识点 id 格式不正确：${n.id}`);
    if (typeof n.title !== "string" || n.title.trim() === "") throw new Error(`知识点 ${n.id} 缺少标题。`);
    if (n.id.split(".")[0] !== `k${n.chapter}`) {
      throw new Error(`知识点 ${n.id} 的章节号 ${n.chapter} 与 id 不一致。`);
    }
    if (!Array.isArray(n.keywords)) throw new Error(`知识点 ${n.id} 的 keywords 必须是数组。`);
    for (const field of ["prereqs", "related"]) {
      const refs = n[field];
      if (!Array.isArray(refs)) throw new Error(`知识点 ${n.id} 的 ${field} 必须是数组。`);
      for (const ref of refs) {
        if (ref === n.id) throw new Error(`知识点 ${n.id} 的 ${field} 不能指向自身。`);
        if (!byId.has(ref)) throw new Error(`知识点 ${n.id} 的 ${field} 引用了不存在的 id：${ref}`);
      }
    }
  }
  const color = /* @__PURE__ */ new Map();
  const path5 = [];
  const visit = (id) => {
    color.set(id, GRAY);
    path5.push(id);
    for (const p of byId.get(id).prereqs) {
      const c = color.get(p) ?? WHITE;
      if (c === GRAY) {
        const cycle = path5.slice(path5.indexOf(p)).concat(p);
        throw new Error(`前置知识存在循环：${cycle.join(" -> ")}`);
      }
      if (c === WHITE) visit(p);
    }
    path5.pop();
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

// src/host/tools/knowledge.logic.ts
var KNOWLEDGE_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: ["lookup", "neighbors", "search"],
    description: "子功能：lookup 按 id 取知识点；neighbors 取邻域；search 关键词搜索"
  },
  ids: {
    type: "array",
    items: { type: "string" },
    description: 'lookup 使用的知识点 id 列表，例如 ["k1.5.2"]。'
  },
  id: {
    type: "string",
    description: 'neighbors 使用的知识点 id，例如 "k1.5.2"。'
  },
  query: {
    type: "string",
    description: "search 使用的关键词，可用空格分隔多个词。"
  },
  limit: {
    type: "integer",
    description: "search 返回的最多条数，默认 10。"
  }
};
function runKnowledge(args) {
  return envelope(String(args.op), () => {
    const kb = defaultKnowledgeBase();
    switch (args.op) {
      case "lookup": {
        const ids = Array.isArray(args.ids) ? args.ids : args.id ? [args.id] : [];
        if (ids.length === 0) throw new DlogicInputError("lookup 需要提供 ids（或 id）。");
        const { found, missing } = kb.lookup(ids);
        return { result: { nodes: found, missing } };
      }
      case "neighbors": {
        const id = args.id ?? (Array.isArray(args.ids) ? args.ids[0] : void 0);
        if (!id) throw new DlogicInputError("neighbors 需要提供 id。");
        const nb = kb.neighbors(id);
        if (!nb.node) throw new DlogicInputError(`未找到知识点“${id}”。`);
        return {
          result: {
            node: nb.node,
            parent: nb.parent,
            children: nb.children,
            prereqs: nb.prereqs,
            dependents: nb.dependents,
            related: nb.related
          }
        };
      }
      case "search": {
        if (typeof args.query !== "string" || args.query.trim() === "") {
          throw new DlogicInputError("search 需要提供 query。");
        }
        return { result: { query: args.query, nodes: kb.search(args.query, args.limit ?? 10) } };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
var line = (n) => `${n.id} ${n.title}`;
function renderKnowledge(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const r = value.result;
  const lines = [];
  switch (value.op) {
    case "lookup": {
      const { nodes, missing } = r;
      for (const n of nodes) lines.push(line(n));
      if (missing.length) lines.push(`未找到：${missing.join("、")}`);
      break;
    }
    case "neighbors": {
      const nb = r;
      lines.push(`${line(nb.node)} 的关联知识：`);
      const section = (label, list) => {
        if (list.length === 0) return;
        lines.push(`${label}：`);
        for (const n of list) lines.push(`  ${line(n)}`);
      };
      section("父节点", nb.parent ? [nb.parent] : []);
      section("子节点", nb.children);
      section("前置知识", nb.prereqs);
      section("后继知识（依赖本节点）", nb.dependents);
      section("相关知识", nb.related);
      break;
    }
    case "search": {
      const { query, nodes } = r;
      if (nodes.length === 0) {
        lines.push(`未找到与「${query}」相关的知识点。`);
      } else {
        lines.push(`与「${query}」相关的知识点（${nodes.length} 个）：`);
        for (const n of nodes) lines.push(`  ${line(n)}`);
      }
      break;
    }
    default:
      lines.push("（无可显示的结果）");
  }
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/knowledge.ts
var DESCRIPTION3 = [
  "数字逻辑知识图谱（教材 k 编号体系，如 k1.5.2 表示“用卡诺图简化逻辑函数”）。",
  "lookup 按 id 取知识点；neighbors 取某知识点的父节点、子节点、前置、后继与相关知识；search 按关键词搜索。",
  "登记学习树卡片前，knowledgeIds 应从本工具结果中选取；不确定 id 时先用 search。"
].join("");
var dlogicKnowledge = defineTool4({
  name: "dlogic_knowledge",
  description: DESCRIPTION3,
  parameters: KNOWLEDGE_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [
      { type: "text", text: renderKnowledge(value) }
    ],
    presentationMeta: (_args, value) => ({
      v: 1,
      tool: "dlogic_knowledge",
      value
    })
  },
  async execute(args) {
    return runKnowledge(args);
  }
});

// src/host/tools/card.ts
import { defineTool as defineTool5 } from "@deepseek-ai/dsh-tools";

// src/solvers/card.ts
var CARD_KINDS = ["solution", "concept", "tutor", "practice", "compare", "summary"];
var ANGLES = [
  "principle",
  "variant",
  "pitfall",
  "prerequisite",
  "verify",
  "practice",
  "free"
];
var PARENT_ID_RE = /^c[0-9A-Za-z]{4}(-\d+)?$/;
var FNV_OFFSET = 2166136261;
var FNV_PRIME = 16777619;
var SHORT_SPACE = 36 ** 4;
function shortId(callId) {
  const s = String(callId);
  let h = FNV_OFFSET;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  h >>>= 0;
  return "c" + (h % SHORT_SPACE).toString(36).toUpperCase().padStart(4, "0");
}
function isObj(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function trimStr(x) {
  return typeof x === "string" ? x.trim() : "";
}
function resolveKnowledge(kb, token) {
  if (kb.has(token)) return token;
  if (/^k\d/i.test(token)) return void 0;
  return fuzzyKnowledge(kb, token) ?? kb.search(token, 1)[0]?.id;
}
var GENERIC_WORDS = ["电路", "方法", "问题", "基本", "相关", "内容", "知识", "的"];
var FUZZY_MIN_SCORE = 0.6;
function squash(s) {
  let t = s.toLowerCase().replace(/\s+/g, "");
  for (const w of GENERIC_WORDS) t = t.split(w).join("");
  return t;
}
function bigrams(s) {
  const out = /* @__PURE__ */ new Set();
  if (s.length === 1) out.add(s);
  for (let i = 0; i + 1 < s.length; i++) out.add(s.slice(i, i + 2));
  return out;
}
function dice(a, b) {
  if (a === "" || b === "") return 0;
  if (a === b) return 1;
  const x = bigrams(a);
  const y = bigrams(b);
  let hit = 0;
  for (const g of x) if (y.has(g)) hit++;
  return 2 * hit / (x.size + y.size);
}
function fuzzyKnowledge(kb, token) {
  const q = squash(token);
  if (q === "") return void 0;
  let best;
  for (const node of kb.nodes) {
    let score = dice(q, squash(node.title));
    for (const k of node.keywords) score = Math.max(score, dice(q, squash(k)) - 0.05);
    if (score >= FUZZY_MIN_SCORE && (!best || score > best.score)) best = { id: node.id, score };
  }
  return best?.id;
}
function validateCard(input, kb) {
  if (!isObj(input)) throw new DlogicInputError("卡片参数必须是一个对象。");
  const raw = input;
  const warnings = [];
  const title = trimStr(raw.title);
  if (!title) throw new DlogicInputError("卡片标题不能为空。");
  const summary = trimStr(raw.summary);
  if (!summary) throw new DlogicInputError("卡片摘要不能为空。");
  if (!CARD_KINDS.includes(raw.kind)) {
    throw new DlogicInputError(`未知的卡片类型「${String(raw.kind)}」，应为 ${CARD_KINDS.join(" / ")} 之一。`);
  }
  const kind = raw.kind;
  if (!Array.isArray(raw.followups)) throw new DlogicInputError("追问必须是数组。");
  const rawFollowups = raw.followups;
  if (rawFollowups.length === 0) throw new DlogicInputError("每张卡片至少需要 1 个追问。");
  if (rawFollowups.length > 6) {
    throw new DlogicInputError(`追问最多 6 个，当前为 ${rawFollowups.length} 个。`);
  }
  const followups = [];
  const seenQuestions = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawFollowups.length; i++) {
    const f = rawFollowups[i];
    if (!isObj(f)) throw new DlogicInputError(`第 ${i + 1} 个追问格式不正确。`);
    const question = trimStr(f.question);
    if (!question) throw new DlogicInputError(`第 ${i + 1} 个追问的问题不能为空。`);
    let angle = f.angle;
    if (!ANGLES.includes(angle)) {
      warnings.push(`第 ${i + 1} 个追问的角度「${String(f.angle)}」无效，已按 free 登记；应为 ${ANGLES.join(" / ")} 之一。`);
      angle = "free";
    }
    if (seenQuestions.has(question)) {
      warnings.push(`追问重复，已去掉：「${question}」。`);
      continue;
    }
    seenQuestions.add(question);
    const followup = { question, angle, why: trimStr(f.why) };
    const knowledgeId = trimStr(f.knowledgeId);
    if (knowledgeId) {
      const resolved = resolveKnowledge(kb, knowledgeId);
      if (resolved) followup.knowledgeId = resolved;
      else warnings.push(`追问「${question}」的知识点「${knowledgeId}」不在知识图谱中，已移除。`);
    }
    followups.push(followup);
  }
  if (followups.length < 2 || followups.length > 4) {
    warnings.push(`追问数量为 ${followups.length}，建议为 2–4 个（窄题少、宽题多）。`);
  }
  const angleCount = /* @__PURE__ */ new Map();
  for (const f of followups) angleCount.set(f.angle, (angleCount.get(f.angle) ?? 0) + 1);
  const repeated = [...angleCount].filter(([, n]) => n > 1).map(([a]) => a);
  if (repeated.length > 0) {
    warnings.push(`追问角度重复（${repeated.join("、")}），下次请让每个追问换一个角度。`);
  }
  const knowledgeIds = [];
  const rawIds = Array.isArray(raw.knowledgeIds) ? raw.knowledgeIds : [];
  for (const x of rawIds) {
    const token = trimStr(x);
    if (!token) continue;
    const id = resolveKnowledge(kb, token);
    if (!id) warnings.push(`知识点「${token}」不在知识图谱中，已移除。`);
    else if (!knowledgeIds.includes(id)) knowledgeIds.push(id);
  }
  const hood = kb.neighborhood(knowledgeIds);
  const inHood = followups.filter((f) => f.knowledgeId !== void 0 && hood.has(f.knowledgeId)).length;
  if (inHood < 2) {
    warnings.push(`只有 ${inHood} 个追问的知识点落在本卡片知识点的邻域内（至少需要 2 个）。`);
  }
  let parentId = null;
  if (raw.parentId !== void 0 && raw.parentId !== null) {
    if (typeof raw.parentId !== "string") throw new DlogicInputError("parentId 必须是字符串或 null。");
    const pid = raw.parentId.trim();
    if (pid) {
      parentId = pid;
      if (!PARENT_ID_RE.test(pid)) {
        warnings.push(`父卡片编号「${pid}」不符合 cXXXX 格式，请核对。`);
      }
    }
  }
  let parentFollowup;
  if (raw.parentFollowup !== void 0 && raw.parentFollowup !== null) {
    const pf = raw.parentFollowup;
    if (typeof pf !== "number" || !Number.isInteger(pf) || pf < 0) {
      throw new DlogicInputError("parentFollowup 必须是非负整数。");
    }
    if (parentId === null) {
      throw new DlogicInputError("指定了 parentFollowup 时必须同时提供 parentId。");
    }
    parentFollowup = pf;
  }
  const card = { title, kind, summary, knowledgeIds, followups, parentId };
  if (parentFollowup !== void 0) card.parentFollowup = parentFollowup;
  return { card, warnings };
}

// src/host/tools/card.logic.ts
var ANGLES2 = ["principle", "variant", "pitfall", "prerequisite", "verify", "practice", "free"];
var KINDS = ["solution", "concept", "tutor", "practice", "compare", "summary"];
var CARD_PARAMETERS = {
  title: {
    type: "string",
    required: true,
    description: '卡片标题，例如 "四变量卡诺图化简"。'
  },
  kind: {
    type: "string",
    required: true,
    enum: KINDS,
    description: "卡片类型：solution 解题核验；tutor 苏格拉底导学；practice 练习或系统设计；concept 概念；compare 比较；summary 小结。"
  },
  summary: {
    type: "string",
    required: true,
    description: "一两句话概括本卡片回答了什么。"
  },
  knowledgeIds: {
    type: "array",
    required: true,
    items: { type: "string" },
    description: '知识点 id 列表，例如 ["k1.5.2"]，取自 dlogic_knowledge。'
  },
  followups: {
    type: "array",
    required: true,
    description: "2～4 个追问，按题目内容定（最多 6 个），每个为 {question, angle, why, knowledgeId?}。追问必须紧扣本卡片的题目与结论，不得沿用前面卡片的追问或写无关话题。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        question: { type: "string", required: true, description: "学生会点击的问句，不超过 30 个汉字。" },
        angle: {
          type: "string",
          required: true,
          enum: ANGLES2,
          description: "角度：principle 原理 | variant 变式 | pitfall 易错 | prerequisite 前置 | verify 验证 | practice 练习 | free 自拟"
        },
        why: { type: "string", required: true, description: "半句推荐理由。" },
        knowledgeId: { type: "string", description: "对应的知识点 id。" }
      }
    }
  },
  parentId: {
    type: "json",
    required: true,
    description: "父卡片的 nodeId（字符串）；全新问题或换话题时填 null。"
  },
  parentFollowup: {
    type: "integer",
    description: "展开的是父卡片的第几个追问（从 0 开始）；用户自由提问时省略。"
  }
};
function runCard(args, callId) {
  return envelope("register", () => {
    const kb = defaultKnowledgeBase();
    const { card, warnings } = validateCard(args, kb);
    const knowledgeNames = card.knowledgeIds.map((id) => kb.get(id)?.title ?? id);
    const record = { ...card, nodeId: shortId(callId), callId, knowledgeNames };
    return { result: record, warnings };
  });
}
function renderCard(value) {
  if (!value.ok || value.result === null) return `登记失败：${value.error ?? "未知错误"}`;
  const r = value.result;
  const lines = [`已登记卡片 ${r.nodeId}`];
  if (value.warnings.length) {
    lines.push("注意（本次不要重复登记，请在之后的卡片中修正）：");
    for (const w of value.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

// src/host/tools/card.ts
var DESCRIPTION4 = [
  "登记一张学习树卡片。每次实质性回答（解题、讲概念、导学、核验）只调用一次，并与计算工具在同一步并行调用（不要等正文写完再登记）；summary 只写题目与思路要点，不写要靠计算结果才知道的具体数字；寒暄、确认类短句不登记。",
  "parentId：用户消息以【追问 nodeId#序号】开头时填该 nodeId，并把 parentFollowup 设为序号，然后只回答前缀之后的问题；",
  "用户自由追问且仍是同一话题时填最近一张卡片的 nodeId（省略 parentFollowup）；换话题或全新问题填 null。",
  "knowledgeIds 与追问的 knowledgeId 可写知识图谱 id（如 k1.5.2）或知识点名称（如“卡诺图化简”，登记时自动匹配 id），不必先查 dlogic_knowledge。",
  "followups 按题目内容给 2～4 个（窄题 2、常规 3、宽题 4），angle 互不相同；至少 2 个（只有 2 个时至少 1 个）knowledgeId 落在本卡片知识点的前置或相关知识上。",
  "导学模式下追问只能是分级提示，不得含答案。正文中不要提及登记、nodeId 或学习树。若返回 warnings，不要重复登记，在之后的卡片中修正。"
].join("");
var dlogicCard = defineTool5({
  name: "dlogic_card",
  description: DESCRIPTION4,
  parameters: CARD_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderCard(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_card", value })
  },
  async execute(args, exec) {
    return runCard(args, exec.callId);
  }
});

// src/host/tools/comb.ts
import { defineTool as defineTool6 } from "@deepseek-ai/dsh-tools";

// src/host/tools/comb.logic.ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  const visit = (name2, stack) => {
    const known = level.get(name2);
    if (known !== void 0) return known;
    const g = byOut.get(name2);
    if (!g || stack.has(name2)) return 0;
    stack.add(name2);
    const lv = 1 + Math.max(0, ...g.in.map((i) => visit(i, stack)));
    stack.delete(name2);
    level.set(name2, lv);
    return lv;
  };
  for (const g of nl.gates) visit(g.out, /* @__PURE__ */ new Set());
  return level;
}
function layoutGateDiagram(nl) {
  const level = levelsOf(nl);
  const inputSet = new Set(nl.inputs);
  const lvOf = (name2) => inputSet.has(name2) ? 0 : level.get(name2) ?? 0;
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
    for (let c = c0 + 1; c < c1; c++) lanes.push(c);
    chains.push({ signal, c0, c1, fromInput, dest, lanes });
  };
  for (const g of nl.gates) {
    g.in.forEach((sig, pin2) => addChain(sig, { gate: g.out, pin: pin2 }, lvOf(g.out)));
  }
  for (const o of nl.outputs) addChain(o, { output: o }, OUT_COL);
  const gapCount = new Array(OUT_COL + 1).fill(0);
  for (const ch of chains) for (let c = ch.c0; c < ch.c1; c++) gapCount[c] += 1;
  const maxW = new Array(OUT_COL + 1).fill(0);
  for (let c = 1; c <= maxLevel; c++) maxW[c] = Math.max(0, ...colGates[c].map((g) => g.w));
  const colX = new Array(OUT_COL + 1).fill(0);
  colX[0] = INPUT_X;
  for (let c = 0; c < OUT_COL; c++) {
    const gs = colX[c] + maxW[c];
    const n = gapCount[c];
    colX[c + 1] = gs + (n > 0 ? 2 * CH_MARGIN + n * CH_STEP : MIN_GAP);
  }
  const chanX = /* @__PURE__ */ new Map();
  {
    const used = new Array(OUT_COL + 1).fill(0);
    chains.forEach((ch, ci) => {
      for (let c = ch.c0; c < ch.c1; c++) {
        const gs = colX[c] + maxW[c];
        chanX.set(`${ci}:${c}`, gs + CH_MARGIN + used[c] * CH_STEP + CH_STEP / 2);
        used[c] += 1;
      }
    });
  }
  const yOf = /* @__PURE__ */ new Map();
  const inputs = [];
  const outputs = [];
  let cursor = TOP;
  for (const name2 of nl.inputs) {
    const y = cursor + LANE_H / 2;
    yOf.set(`i:${name2}`, y);
    inputs.push({ name: name2, x: colX[0], y });
    cursor += LANE_H + ITEM_GAP;
  }
  let bottom = cursor;
  const prevY = (ci, c) => {
    const ch = chains[ci];
    const idx = ch.lanes.indexOf(c);
    if (idx > 0) return yOf.get(`d:${ci}:${ch.lanes[idx - 1]}`) ?? 0;
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0;
  };
  const lastPrevY = (ci) => {
    const ch = chains[ci];
    if (ch.lanes.length > 0) return yOf.get(`d:${ci}:${ch.lanes[ch.lanes.length - 1]}`) ?? 0;
    return yOf.get(ch.fromInput ? `i:${ch.signal}` : `g:${ch.signal}`) ?? 0;
  };
  for (let c = 1; c <= OUT_COL; c++) {
    const items = [];
    let order = 0;
    if (c <= maxLevel) {
      for (const g of colGates[c]) {
        const ins = chains.map((ch, ci) => ({ ch, ci })).filter(({ ch }) => "gate" in ch.dest && ch.dest.gate === g.out);
        const bary = ins.length ? ins.reduce((s, { ci }) => s + lastPrevY(ci), 0) / ins.length : 0;
        items.push({ key: `g:${g.out}`, bary, order: order++, kind: "gate", gate: g });
      }
    }
    chains.forEach((ch, ci) => {
      if (!ch.lanes.includes(c)) return;
      items.push({ key: `d:${ci}:${c}`, bary: prevY(ci, c), order: order++, kind: "lane", ci });
    });
    if (c === OUT_COL) {
      nl.outputs.forEach((name2) => {
        const ci = chains.findIndex((ch) => "output" in ch.dest && ch.dest.output === name2);
        items.push({ key: `o:${name2}`, bary: ci >= 0 ? lastPrevY(ci) : 0, order: order++, kind: "out", name: name2 });
      });
    }
    items.sort((a, b) => a.bary - b.bary || a.order - b.order);
    let y = TOP + c % 2;
    for (const it of items) {
      if (it.kind === "gate") {
        const g = it.gate;
        const n = (g.h - 2 * PAD_V) / PIN_GAP + 1;
        g.x = colX[c];
        g.y = y;
        g.inPins = Array.from({ length: n }, (_, i) => ({ x: g.x, y: y + PAD_V + PIN_GAP * i }));
        g.outPin = { x: g.x + g.w, y: y + PAD_V + PIN_GAP * (n - 1) / 2 };
        yOf.set(it.key, g.outPin.y);
        y += g.h + ITEM_GAP;
      } else if (it.kind === "lane") {
        yOf.set(it.key, y + LANE_H / 2);
        y += LANE_H + ITEM_GAP;
      } else {
        const name2 = it.name;
        const oy = y + LANE_H / 2;
        yOf.set(it.key, oy);
        outputs.push({ name: name2, x: colX[OUT_COL], y: oy });
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
    for (const c of targets) {
      const isLane = c !== ch.c1;
      const nextY = isLane ? yOf.get(`d:${ci}:${c}`) ?? 0 : endY;
      const xch = chanX.get(`${ci}:${prevCol}`) ?? colX[prevCol];
      pts.push({ x: xch, y: curY }, { x: xch, y: nextY });
      if (isLane) {
        pts.push({ x: colX[c], y: nextY }, { x: colX[c] + maxW[c], y: nextY });
      } else {
        pts.push({ x: colX[c], y: nextY });
      }
      curY = nextY;
      prevCol = c;
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

// src/shared/figureSvg.ts
var WAVE_MAX_INPUTS = 5;
var INK = "#000000";
var STROKE = 1.2;
var BUB = 8;
var SECTION_GAP = 24;
var WAVE_CELL = 18;
var WAVE_ROW = 26;
var WAVE_LABEL_W = 64;
var WAVE_PAD = 6;
var WAVE_HIGH = 5;
var WAVE_LOW = 19;
var WAVE_AXIS = 14;
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function text(x, y, size, anchor, content) {
  return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="${INK}">${esc(content)}</text>`;
}
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
function gateSymbol(g) {
  const top = g.y + 6;
  const bot = g.y + g.h - 6;
  const mid = g.y + g.h / 2;
  const inv = inverting(g.type);
  const right = g.x + g.w - (inv ? BUB : 0);
  const attr = `fill="none" stroke="${INK}" stroke-width="${STROKE}"`;
  let body;
  if (g.type === "NOT") {
    body = `<path d="M${g.x} ${top} L${right} ${mid} L${g.x} ${bot} Z" ${attr}/>`;
  } else if (g.type === "AND" || g.type === "NAND") {
    body = `<path d="${andPath(g.x, right, top, bot)}" ${attr}/>`;
  } else if (g.type === "OR" || g.type === "NOR") {
    body = `<path d="${orPath(g.x, right, top, bot)}" ${attr}/>`;
  } else {
    body = `<path d="${orPath(g.x + 4, right, top, bot)}" ${attr}/><path d="${xorBackPath(g.x, right, top, bot)}" ${attr}/>`;
  }
  const bubble = inv ? `<circle cx="${g.x + g.w - BUB / 2}" cy="${mid}" r="${BUB / 2}" ${attr}/>` : "";
  return body + bubble;
}
function diagramPiece(lay) {
  const out = [];
  for (const w of lay.wires) {
    const d = w.points.map((p, j) => `${j === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    out.push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${STROKE}"/>`);
  }
  for (const g of lay.gates) out.push(gateSymbol(g));
  for (const d of lay.dots) out.push(`<circle cx="${d.x}" cy="${d.y}" r="2.6" fill="${INK}"/>`);
  for (const p of lay.inputs) out.push(text(p.x - 6, p.y + 4, 12, "end", p.name));
  for (const p of lay.outputs) out.push(text(p.x + 6, p.y + 4, 12, "start", p.name));
  for (const g of lay.gates) out.push(text(g.outPin.x + 3, g.outPin.y - 4, 11, "start", g.out));
  return { body: out.join(""), width: lay.width, height: lay.height };
}
function truthRows(r) {
  const rows = r.truthTable.rows;
  const ins = r.inputs.map((name2, i) => ({ name: name2, wave: rows.map((row) => String(row.inputs[i])).join("") }));
  const outs = r.outputs.map((name2, j) => ({ name: name2, wave: rows.map((row) => String(row.outputs[j])).join("") }));
  return [...ins, ...outs];
}
function wavePiece(rows, steps) {
  const T = Math.max(steps, ...rows.map((r) => r.wave.length), 1);
  const width = WAVE_LABEL_W + T * WAVE_CELL + WAVE_PAD * 2;
  const height = WAVE_AXIS + rows.length * WAVE_ROW + WAVE_PAD;
  const out = [];
  let freeAt = -Infinity;
  for (let t = 0; t < T; t++) {
    const label = String(t);
    const x = WAVE_LABEL_W + t * WAVE_CELL + WAVE_CELL / 2;
    const half = label.length * 5.5 / 2;
    if (x - half < freeAt) continue;
    out.push(`<text x="${x}" y="${WAVE_AXIS - 4}" text-anchor="middle" font-size="9" fill="${INK}">${esc(label)}</text>`);
    freeAt = x + half + 3;
  }
  rows.forEach((sig, row) => {
    const y0 = WAVE_AXIS + row * WAVE_ROW;
    const hi = y0 + WAVE_HIGH;
    const lo = y0 + WAVE_LOW;
    out.push(text(WAVE_PAD, y0 + WAVE_ROW / 2 + 3, 11, "start", sig.name));
    const parts = [];
    const unknownX = [];
    let lastY = null;
    let prev = "0";
    for (let t = 0; t < T; t++) {
      const raw = sig.wave[t] ?? ".";
      const ch = raw === "." ? prev : raw;
      const x0 = WAVE_LABEL_W + t * WAVE_CELL;
      const x1 = x0 + WAVE_CELL;
      if (ch === "x") {
        unknownX.push(x0);
        lastY = null;
        prev = "x";
        continue;
      }
      if (ch === "p") {
        const midX = x0 + WAVE_CELL / 2;
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
    for (const x0 of unknownX) {
      out.push(`<rect x="${x0}" y="${hi}" width="${WAVE_CELL}" height="${lo - hi}" fill="#cccccc"/>`);
    }
    if (parts.length > 0) out.push(`<path d="${parts.join(" ")}" fill="none" stroke="${INK}" stroke-width="${STROKE}"/>`);
  });
  return { body: out.join(""), width, height };
}
function renderCombFigureSvg(result) {
  try {
    const r = result;
    if (!r || typeof r !== "object" || !Array.isArray(r.inputs) || !Array.isArray(r.gates) || r.gates.length === 0) {
      return "";
    }
    const outputs = Array.isArray(r.outputs) ? r.outputs : [];
    const lay = layoutGateDiagram({
      inputs: r.inputs,
      gates: r.gates.map((g) => ({ out: g.out, type: g.type, in: g.in })),
      outputs
    });
    const sections = [diagramPiece(lay)];
    const tt = r.truthTable;
    if (r.inputs.length >= 1 && r.inputs.length <= WAVE_MAX_INPUTS && tt && Array.isArray(tt.rows)) {
      sections.push(wavePiece(truthRows(r), tt.rows.length));
    }
    const W = Math.max(...sections.map((s) => s.width));
    let y = 0;
    const parts = [];
    sections.forEach((s, i) => {
      if (i > 0) y += SECTION_GAP;
      parts.push(`<g transform="translate(0 ${y})">${s.body}</g>`);
      y += s.height;
    });
    const H = y;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">`,
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`,
      ...parts,
      "</svg>"
    ].join("");
  } catch {
    return "";
  }
}

// src/solvers/comb.ts
var NAME_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
var MAX_INPUTS = 6;
var MAX_GATES = 20;
var MAX_FANIN = 8;
var EXPAND_LIMIT = 300;
var MAX_FUNC_VARS = 6;
var GATE_TYPES = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"];
var MSI_CHIPS = ["138", "139", "148", "151", "153", "85", "283", "280"];
var TYPE_NAME = {
  AND: "与门",
  OR: "或门",
  NOT: "非门",
  NAND: "与非门",
  NOR: "或非门",
  XOR: "异或门",
  XNOR: "同或门"
};
var CHIP_NAME = {
  "138": "74LS138（3 线-8 线译码器）",
  "139": "74LS139（双 2 线-4 线译码器）",
  "148": "74LS148（8 线-3 线优先编码器）",
  "151": "74LS151（8 选 1 数据选择器）",
  "153": "74LS153（双 4 选 1 数据选择器）",
  "85": "74LS85（4 位数值比较器）",
  "283": "74LS283（4 位二进制全加器）",
  "280": "74LS280（9 位奇偶产生/校验器）"
};
function range(n) {
  return Array.from({ length: n }, (_, i) => i);
}
function buildGate(type, ins) {
  switch (type) {
    case "AND":
      return { k: "and", xs: ins };
    case "OR":
      return { k: "or", xs: ins };
    case "NOT":
      return { k: "not", x: ins[0] };
    case "NAND":
      return { k: "not", x: { k: "and", xs: ins } };
    case "NOR":
      return { k: "not", x: { k: "or", xs: ins } };
    case "XOR":
      return { k: "xor", xs: ins };
    case "XNOR":
      return { k: "not", x: { k: "xor", xs: ins } };
  }
}
var sizeMemo = /* @__PURE__ */ new WeakMap();
function treeSize(a) {
  const hit = sizeMemo.get(a);
  if (hit !== void 0) return hit;
  let s;
  if (a.k === "var") s = 1;
  else if (a.k === "not") s = 1 + treeSize(a.x);
  else s = 1 + a.xs.reduce((acc, x) => acc + treeSize(x), 0);
  sizeMemo.set(a, s);
  return s;
}
function renderText2(a, sep) {
  switch (a.k) {
    case "var":
      return a.name;
    case "not":
      return a.x.k === "var" ? a.x.name + "'" : "(" + renderText2(a.x, sep) + ")'";
    case "and":
      return a.xs.map((x) => x.k === "or" || x.k === "xor" ? "(" + renderText2(x, sep) + ")" : renderText2(x, sep)).join(sep);
    case "or":
      return a.xs.map((x) => renderText2(x, sep)).join(" + ");
    case "xor":
      return a.xs.map((x) => x.k === "or" ? "(" + renderText2(x, sep) + ")" : renderText2(x, sep)).join("⊕");
  }
}
function latexName2(name2) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(name2);
  return m ? `${m[1]}_{${m[2]}}` : name2;
}
function renderLatex2(a, sep) {
  const lsep = sep === "" ? "" : "\\cdot ";
  switch (a.k) {
    case "var":
      return latexName2(a.name);
    case "not":
      return a.x.k === "var" ? "\\overline{" + latexName2(a.x.name) + "}" : "\\overline{" + renderLatex2(a.x, sep) + "}";
    case "and":
      return a.xs.map((x) => x.k === "or" || x.k === "xor" ? "\\left(" + renderLatex2(x, sep) + "\\right)" : renderLatex2(x, sep)).join(lsep);
    case "or":
      return a.xs.map((x) => renderLatex2(x, sep)).join(" + ");
    case "xor":
      return a.xs.map((x) => x.k === "or" ? "\\left(" + renderLatex2(x, sep) + "\\right)" : renderLatex2(x, sep)).join(" \\oplus ");
  }
}
function checkNames(names, label) {
  const seen = /* @__PURE__ */ new Set();
  for (const s of names) {
    if (typeof s !== "string" || !NAME_RE.test(s)) {
      throw new DlogicInputError(`${label}“${String(s)}”不合法：信号名应以字母开头，只含字母、数字与下划线。`);
    }
    if (seen.has(s)) throw new DlogicInputError(`${label}“${s}”重复。`);
    seen.add(s);
  }
}
function validateNetlist(nl) {
  if (!nl || !Array.isArray(nl.inputs) || nl.inputs.length === 0) {
    throw new DlogicInputError("门级网表需要至少一个输入（inputs）。");
  }
  if (nl.inputs.length > MAX_INPUTS) {
    throw new DlogicInputError(`最多支持 ${MAX_INPUTS} 个输入，当前为 ${nl.inputs.length} 个。`);
  }
  checkNames(nl.inputs, "输入");
  if (!Array.isArray(nl.gates) || nl.gates.length === 0) throw new DlogicInputError("门列表为空（gates）。");
  if (nl.gates.length > MAX_GATES) {
    throw new DlogicInputError(`最多支持 ${MAX_GATES} 个门，当前为 ${nl.gates.length} 个。`);
  }
  const inputSet = new Set(nl.inputs);
  const outSet = /* @__PURE__ */ new Set();
  for (const g of nl.gates) {
    if (!g || typeof g.out !== "string") throw new DlogicInputError("每个门都需要 out（输出信号名）。");
    if (!GATE_TYPES.includes(g.type)) {
      throw new DlogicInputError(`门 ${g.out} 的类型“${String(g.type)}”不支持，可用：${GATE_TYPES.join("、")}。`);
    }
    checkNames([g.out], "门输出");
    if (inputSet.has(g.out) || outSet.has(g.out)) throw new DlogicInputError(`信号“${g.out}”被重复定义。`);
    outSet.add(g.out);
    if (!Array.isArray(g.in)) throw new DlogicInputError(`门 ${g.out} 的输入（in）必须是数组。`);
    if (g.type === "NOT") {
      if (g.in.length !== 1) throw new DlogicInputError(`非门 ${g.out} 只能有 1 个输入，当前为 ${g.in.length} 个。`);
    } else if (g.in.length < 2 || g.in.length > MAX_FANIN) {
      throw new DlogicInputError(
        `${TYPE_NAME[g.type]} ${g.out} 的输入端数应在 2 到 ${MAX_FANIN} 之间，当前为 ${g.in.length} 个。`
      );
    }
  }
  for (const g of nl.gates) {
    for (const i of g.in) {
      if (!inputSet.has(i) && !outSet.has(i)) {
        throw new DlogicInputError(`门 ${g.out} 的输入“${i}”未定义（既不是原始输入，也不是门输出）。`);
      }
    }
  }
  if (nl.outputs !== void 0) {
    if (!Array.isArray(nl.outputs) || nl.outputs.length === 0) throw new DlogicInputError("outputs 若给出，不能为空。");
    checkNames(nl.outputs, "输出");
    for (const o of nl.outputs) {
      if (!inputSet.has(o) && !outSet.has(o)) throw new DlogicInputError(`输出“${o}”未定义。`);
    }
  }
}
function topoOrder(gates) {
  const byOut = /* @__PURE__ */ new Map();
  for (const g of gates) byOut.set(g.out, g);
  const state = /* @__PURE__ */ new Map();
  const order = [];
  const visit = (name2) => {
    const g = byOut.get(name2);
    if (!g) return;
    const s = state.get(name2);
    if (s === 2) return;
    if (s === 1) throw new DlogicInputError(`网表中存在反馈回路（经过信号 ${name2}）；组合电路不能有环。`);
    state.set(name2, 1);
    for (const i of g.in) visit(i);
    state.set(name2, 2);
    order.push(g);
  };
  for (const g of gates) visit(g.out);
  return order;
}
function evalGate(type, vals) {
  const all = vals.every((v) => v === 1);
  const any = vals.some((v) => v === 1);
  const par = vals.reduce((acc, v) => acc ^ v, 0);
  switch (type) {
    case "AND":
      return all ? 1 : 0;
    case "OR":
      return any ? 1 : 0;
    case "NOT":
      return vals[0] === 1 ? 0 : 1;
    case "NAND":
      return all ? 0 : 1;
    case "NOR":
      return any ? 0 : 1;
    case "XOR":
      return par === 1 ? 1 : 0;
    case "XNOR":
      return par === 1 ? 0 : 1;
  }
}
function simplifyColumn(inputs, rows, oi) {
  const n = inputs.length;
  const minterms = rows.filter((r) => r.outputs[oi] === 1).map((r) => r.index);
  if (minterms.length === 0) {
    return { simplified: "0", simplifiedLatex: "0", cost: { terms: 0, literals: 0 } };
  }
  if (minterms.length === 1 << n) {
    return { simplified: "1", simplifiedLatex: "1", cost: { terms: 0, literals: 0 } };
  }
  const m = minimize({ variables: inputs.slice(), minterms, dontCares: [] }, "SOP");
  return { simplified: m.texts[0] ?? "0", simplifiedLatex: m.latex[0] ?? "0", cost: m.cost };
}
function analyzeNetlist(nl) {
  validateNetlist(nl);
  const inputs = nl.inputs.slice();
  const gates = nl.gates.map((g) => ({ out: g.out, type: g.type, in: g.in.slice() }));
  const order = topoOrder(gates);
  const consumed = new Set(gates.flatMap((g) => g.in));
  const outputs = nl.outputs ? nl.outputs.slice() : gates.filter((g) => !consumed.has(g.out)).map((g) => g.out);
  if (outputs.length === 0) {
    throw new DlogicInputError("网表没有输出：请给出 outputs，或确保存在未被其他门使用的门输出。");
  }
  const sepIn = inputs.every((s) => s.length === 1) ? "" : "·";
  const sepAll = [...inputs, ...gates.map((g) => g.out)].every((s) => s.length === 1) ? "" : "·";
  const level = /* @__PURE__ */ new Map();
  const ast = /* @__PURE__ */ new Map();
  for (const i of inputs) {
    level.set(i, 0);
    ast.set(i, { k: "var", name: i });
  }
  const derivations = [];
  for (const g of order) {
    const lv = 1 + Math.max(...g.in.map((i) => level.get(i) ?? 0));
    level.set(g.out, lv);
    const full = buildGate(
      g.type,
      g.in.map((i) => ast.get(i))
    );
    ast.set(g.out, full);
    const local = buildGate(
      g.type,
      g.in.map((i) => ({ k: "var", name: i }))
    );
    const small = treeSize(full) <= EXPAND_LIMIT;
    derivations.push({
      out: g.out,
      type: g.type,
      in: g.in.slice(),
      level: lv,
      local: renderText2(local, sepAll),
      localLatex: renderLatex2(local, sepAll),
      expr: small ? renderText2(full, sepIn) : null,
      latex: small ? renderLatex2(full, sepIn) : null
    });
  }
  const n = inputs.length;
  const rows = [];
  for (let m = 0; m < 1 << n; m++) {
    const vals = /* @__PURE__ */ new Map();
    const bits = [];
    for (let i = 0; i < n; i++) {
      const b = m >> n - 1 - i & 1;
      bits.push(b);
      vals.set(inputs[i], b);
    }
    for (const g of order) {
      const ins = g.in.map((i) => vals.get(i));
      vals.set(g.out, evalGate(g.type, ins));
    }
    rows.push({ index: m, inputs: bits, outputs: outputs.map((o) => vals.get(o)) });
  }
  const truthTable2 = { variables: inputs.slice(), outputs: outputs.slice(), rows };
  const finalExprs = outputs.map((name2, oi) => {
    const a = ast.get(name2);
    const small = treeSize(a) <= EXPAND_LIMIT;
    return {
      name: name2,
      expr: small ? renderText2(a, sepIn) : null,
      latex: small ? renderLatex2(a, sepIn) : null,
      ...simplifyColumn(inputs, rows, oi)
    };
  });
  return {
    inputs,
    outputs,
    gates: derivations,
    finalExprs,
    truthTable: truthTable2,
    depth: Math.max(0, ...derivations.map((d) => d.level))
  };
}
function analyzeSteps(r) {
  const steps = [];
  steps.push({
    kind: "levels",
    text: `共 ${r.gates.length} 个门，${r.depth} 级；原始输入 ${r.inputs.join("、")}，自输入向输出逐级代入。`
  });
  for (const g of r.gates) {
    const tail = g.expr !== null ? `；代入原始输入得 ${g.out} = ${g.expr}` : "（展开式过长，略）";
    steps.push({
      kind: "gate",
      text: `第 ${g.level} 级 ${g.out}（${TYPE_NAME[g.type]}，输入 ${g.in.join("、")}）：${g.out} = ${g.local}${tail}`,
      out: g.out,
      level: g.level,
      local: g.local,
      expr: g.expr
    });
  }
  for (const f of r.finalExprs) {
    steps.push({
      kind: "output",
      text: `输出 ${f.name} = ${f.expr ?? f.simplified}`,
      name: f.name,
      expr: f.expr
    });
    steps.push({
      kind: "simplify",
      text: `由真值表化简：${f.name} = ${f.simplified}（${f.cost.terms} 项，${f.cost.literals} 个文字）`,
      name: f.name,
      simplified: f.simplified
    });
  }
  steps.push({
    kind: "truth",
    text: `真值表共 ${r.truthTable.rows.length} 行，按 ${r.inputs.join(" ")} 的二进制顺序列出。`
  });
  return steps;
}
function literalOf(a) {
  if (a.k === "var") return { name: a.name, neg: false };
  if (a.k === "not" && a.x.k === "var") return { name: a.x.name, neg: true };
  return null;
}
function productLits2(a) {
  if (a.k === "and") {
    const out = [];
    for (const x of a.xs) {
      const sub2 = productLits2(x);
      if (sub2 === null) return null;
      out.push(...sub2);
    }
    return out;
  }
  const l = literalOf(a);
  return l ? [l] : null;
}
function sopTerms(a) {
  if (a.k === "or") {
    const out = [];
    for (const x of a.xs) {
      const sub2 = sopTerms(x);
      if (sub2 === null) return null;
      out.push(...sub2);
    }
    return out;
  }
  const p = productLits2(a);
  return p === null ? null : [p];
}
function dedupeTerms(terms) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const t of terms) {
    const uniq = [];
    const keys = /* @__PURE__ */ new Set();
    for (const l of t) {
      const k = (l.neg ? "'" : "") + l.name;
      if (keys.has(k)) continue;
      keys.add(k);
      uniq.push(l);
    }
    const key = [...keys].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(uniq);
  }
  return out;
}
function sopNetlist(inputs, terms, outName) {
  const used = /* @__PURE__ */ new Set([...inputs, outName]);
  const fresh = (base) => {
    let name2 = base;
    for (let k = 2; used.has(name2); k++) name2 = `${base}_${k}`;
    used.add(name2);
    return name2;
  };
  const gates = [];
  const negOf = /* @__PURE__ */ new Map();
  const signalOf = (l) => {
    if (!l.neg) return l.name;
    let s = negOf.get(l.name);
    if (s === void 0) {
      s = fresh(`${l.name}_n`);
      negOf.set(l.name, s);
      gates.push({ out: s, type: "NOT", in: [l.name] });
    }
    return s;
  };
  if (terms.length === 1) {
    const lits = terms[0];
    if (lits.length === 1) {
      if (!lits[0].neg) throw new DlogicInputError(`函数 ${outName} = ${lits[0].name} 只是一个变量，没有门可画。`);
      gates.push({ out: outName, type: "NOT", in: [lits[0].name] });
    } else {
      gates.push({ out: outName, type: "AND", in: lits.map(signalOf) });
    }
  } else {
    const ins = terms.map((lits, i) => {
      if (lits.length === 1) return signalOf(lits[0]);
      const p = fresh(`P${i + 1}`);
      gates.push({ out: p, type: "AND", in: lits.map(signalOf) });
      return p;
    });
    gates.push({ out: outName, type: "OR", in: ins });
  }
  return { inputs: inputs.slice(), gates, outputs: [outName] };
}
function drawExpr(req) {
  if (typeof req.expr !== "string" || req.expr.trim() === "") throw new DlogicInputError("draw 需要提供 expr（表达式）。");
  const outName = req.outputName ?? "F";
  checkNames([outName], "输出名");
  const parsed = parseExpr(req.expr, req.variables);
  const inputs = parsed.variables;
  const warnings = [];
  let terms = sopTerms(parsed.ast);
  if (terms !== null) {
    terms = dedupeTerms(terms);
  } else {
    const spec = specFromExpr(req.expr, req.variables);
    if (spec.minterms.length === 0 || spec.minterms.length === 1 << inputs.length) {
      throw new DlogicInputError("函数恒为 0 或恒为 1，没有门可画。");
    }
    const m = minimize(spec, "SOP");
    const text2 = m.texts[0] ?? "";
    const reparsed = sopTerms(parseExpr(text2, inputs).ast);
    if (reparsed === null) throw new DlogicInputError("无法把函数化为与或式，因此无法画出门级图。");
    terms = dedupeTerms(reparsed);
    warnings.push(`表达式不是与或式，已改用最简与或式 ${outName} = ${text2} 画图。`);
  }
  const netlist = sopNetlist(inputs, terms, outName);
  const result = analyzeNetlist(netlist);
  return { result, steps: analyzeSteps(result), warnings };
}
function pin(name2, aliases, activeLevel, role, note) {
  return note === void 0 ? { name: name2, aliases, activeLevel, role } : { name: name2, aliases, activeLevel, role, note };
}
var CHIP_PINS = {
  "138": [
    pin("A2", [], "high", "select", "地址高位"),
    pin("A1", [], "high", "select"),
    pin("A0", [], "high", "select", "地址低位"),
    pin("S1", ["E1"], "high", "enable", "使能端"),
    pin("S̄2", ["Ē2A"], "low", "enable", "使能端"),
    pin("S̄3", ["Ē2B"], "low", "enable", "使能端"),
    ...range(8).map((i) => pin(`Y̅${i}`, [], "low", "output", `对应最小项 m${i}`))
  ],
  "139": [
    pin("1A", [], "high", "select", "地址低位"),
    pin("1B", [], "high", "select", "地址高位"),
    pin("1S̄", ["1Ē"], "low", "enable", "使能端"),
    ...range(4).map((i) => pin(`1Y̅${i}`, [], "low", "output", `对应最小项 m${i}`)),
    pin("2A", [], "high", "select", "地址低位"),
    pin("2B", [], "high", "select", "地址高位"),
    pin("2S̄", ["2Ē"], "low", "enable", "使能端"),
    ...range(4).map((i) => pin(`2Y̅${i}`, [], "low", "output", `对应最小项 m${i}`))
  ],
  "148": [
    ...range(8).map((i) => pin(`I̅${i}`, [], "low", "input", i === 7 ? "优先级最高" : void 0)),
    pin("EI̅", [], "low", "enable", "输入使能"),
    pin("Y̅2", [], "low", "output", "编码输出（反码）"),
    pin("Y̅1", [], "low", "output", "编码输出（反码）"),
    pin("Y̅0", [], "low", "output", "编码输出（反码）"),
    pin("GS̅", [], "low", "output", "有输入有效时为 0"),
    pin("EO̅", [], "low", "output", "输出使能，用于扩展")
  ],
  "151": [
    ...range(8).map((i) => pin(`D${i}`, [], "high", "data")),
    pin("A2", [], "high", "select", "地址高位"),
    pin("A1", [], "high", "select"),
    pin("A0", [], "high", "select", "地址低位"),
    pin("S̄", ["Ē"], "low", "enable", "选通端"),
    pin("Y", [], "high", "output", "输出"),
    pin("W̅", ["Y̅"], "high", "output", "与 Y 互补的输出")
  ],
  "153": [
    pin("1S̄", ["1Ē"], "low", "enable", "选通端"),
    pin("2S̄", ["2Ē"], "low", "enable", "选通端"),
    pin("B", [], "high", "select", "选择端高位（两路共用）"),
    pin("A", [], "high", "select", "选择端低位（两路共用）"),
    ...range(4).map((i) => pin(`1C${i}`, [], "high", "data")),
    ...range(4).map((i) => pin(`2C${i}`, [], "high", "data")),
    pin("1Y", [], "high", "output", "第 1 路输出"),
    pin("2Y", [], "high", "output", "第 2 路输出")
  ],
  "85": [
    pin("A3", [], "high", "input", "最高位"),
    pin("A2", [], "high", "input"),
    pin("A1", [], "high", "input"),
    pin("A0", [], "high", "input", "最低位"),
    pin("B3", [], "high", "input", "最高位"),
    pin("B2", [], "high", "input"),
    pin("B1", [], "high", "input"),
    pin("B0", [], "high", "input", "最低位"),
    pin("I(A>B)", [], "high", "cascade", "级联输入"),
    pin("I(A<B)", [], "high", "cascade", "级联输入"),
    pin("I(A=B)", [], "high", "cascade", "级联输入，单片使用时接 1"),
    pin("F(A>B)", [], "high", "output", "比较输出"),
    pin("F(A<B)", [], "high", "output", "比较输出"),
    pin("F(A=B)", [], "high", "output", "比较输出")
  ],
  "283": [
    pin("A1", [], "high", "input", "操作数 A 的最低位"),
    pin("A2", [], "high", "input"),
    pin("A3", [], "high", "input"),
    pin("A4", [], "high", "input", "操作数 A 的最高位"),
    pin("B1", [], "high", "input", "操作数 B 的最低位"),
    pin("B2", [], "high", "input"),
    pin("B3", [], "high", "input"),
    pin("B4", [], "high", "input", "操作数 B 的最高位"),
    pin("C0", ["Cin"], "high", "carry", "低位进位输入"),
    pin("Σ1", [], "high", "output", "和的最低位"),
    pin("Σ2", [], "high", "output"),
    pin("Σ3", [], "high", "output"),
    pin("Σ4", [], "high", "output", "和的最高位"),
    pin("C4", ["Cout"], "high", "carry", "进位输出")
  ],
  "280": [
    ...["A", "B", "C", "D", "E", "F", "G", "H", "I"].map((p) => pin(p, [], "high", "input")),
    pin("Σ_E", [], "high", "output", "输入中 1 的个数为偶数时为 1"),
    pin("Σ_O", [], "high", "output", "输入中 1 的个数为奇数时为 1")
  ]
};
function specText(spec) {
  let s = `F(${spec.variables.join(",")}) = Σm(${spec.minterms.join(",")})`;
  if (spec.dontCares.length) s += ` + Σd(${spec.dontCares.join(",")})`;
  return s;
}
function specLatex(spec) {
  let s = `F(${spec.variables.join(",")}) = \\sum m(${spec.minterms.join(",")})`;
  if (spec.dontCares.length) s += ` + \\sum d(${spec.dontCares.join(",")})`;
  return s;
}
function functionSpec(req) {
  if (typeof req.expr === "string" && req.expr.trim() !== "") {
    return specFromExpr(req.expr, req.variables);
  }
  if (req.minterms !== void 0) {
    if (!Array.isArray(req.variables) || req.variables.length === 0) {
      throw new DlogicInputError("使用 minterms 时必须同时提供 variables（variables[0] 为最高位）。");
    }
    checkNames(req.variables, "变量");
    const n = req.variables.length;
    if (n > MAX_FUNC_VARS) throw new DlogicInputError(`最多支持 ${MAX_FUNC_VARS} 个变量，当前为 ${n} 个。`);
    const total = 1 << n;
    const minterms = [...new Set(req.minterms)].sort((a, b) => a - b);
    const dontCares = [...new Set(req.dontCares ?? [])].sort((a, b) => a - b);
    for (const m of [...minterms, ...dontCares]) {
      if (!Number.isInteger(m) || m < 0 || m >= total) {
        throw new DlogicInputError(`编号 ${m} 超出范围（0～${total - 1}）。`);
      }
    }
    if (minterms.some((m) => dontCares.includes(m))) {
      throw new DlogicInputError("同一编号不能同时是最小项与无关项。");
    }
    return { variables: req.variables.slice(), minterms, dontCares };
  }
  throw new DlogicInputError("缺少函数：请提供 expr，或同时提供 minterms 与 variables。");
}
function requireVars(spec) {
  if (spec.variables.length === 0) throw new DlogicInputError("函数至少需要一个变量。");
}
function decoderMap(chip, spec) {
  requireVars(spec);
  const k = chip === "138" ? 3 : 2;
  const n = spec.variables.length;
  if (n > k) {
    throw new DlogicInputError(
      `74LS${chip} 只能直接实现 ${k} 个变量的函数，当前函数有 ${n} 个变量；${n} 变量函数请用 151 / 153，或多片组合。`
    );
  }
  const addrPins = chip === "138" ? ["A2", "A1", "A0"] : ["1B", "1A"];
  const outPin = (m) => chip === "138" ? `Y̅${m}` : `1Y̅${m}`;
  const minterms = spec.minterms.slice();
  const warnings = [];
  if (spec.dontCares.length) warnings.push("译码器不能直接利用无关项，无关项按 0 处理。");
  const addrWiring = addrPins.map((p, idx) => {
    const j = idx - (k - n);
    return j < 0 ? { pin: p, signal: "GND", note: "高位地址接地" } : { pin: p, signal: spec.variables[j] };
  });
  const enableWiring = chip === "138" ? [
    { pin: "S1", signal: "VCC", note: "使能有效" },
    { pin: "S̄2", signal: "GND" },
    { pin: "S̄3", signal: "GND" }
  ] : [{ pin: "1S̄", signal: "GND", note: "使能有效" }];
  const stages = [{ label: CHIP_NAME[chip], wiring: [...addrWiring, ...enableWiring] }];
  const outputNames = minterms.map((m) => `m${m}`);
  let nandText = "0";
  let nandLatex = "0";
  let constant = null;
  let tail = "";
  if (minterms.length === 0) {
    constant = 0;
    tail = "（恒为 0）";
    stages.push({ label: "输出", wiring: [{ pin: "F", signal: "0", note: "函数恒为 0，无需接线" }] });
  } else {
    nandText = `(${outputNames.map((x) => x + "'").join("")})'`;
    nandLatex = `\\overline{${outputNames.map((x) => `\\overline{${latexName2(x)}}`).join("\\cdot ")}}`;
    if (minterms.length === 1 << n) constant = 1;
    stages.push({
      label: "与非门（输入端数等于最小项个数）",
      wiring: [
        ...minterms.map((m, j) => ({ pin: `输入 ${j + 1}`, signal: outPin(m), note: `接 m${m}` })),
        { pin: "输出", signal: "F" }
      ]
    });
  }
  if (n < k) warnings.push(`函数只有 ${n} 个变量，高位地址接地，译码器只用前 ${1 << n} 个输出。`);
  const mapping = {
    kind: "decoder",
    chip,
    addressVars: spec.variables.slice(),
    minterms,
    outputNames,
    nandText,
    nandLatex,
    constant
  };
  const steps = [
    {
      kind: "decode",
      text: minterms.length === 0 ? "函数恒为 0，无需译码器输出。" : `译码器低有效输出 Ȳ_i = m̄_i。F = Σm(${minterms.join(",")}) 等于这些最小项对应的 Ȳ 取与非。`
    },
    {
      kind: "nand",
      text: minterms.length === 0 ? "输出 F 接 0。" : `与非门的输入接 ${minterms.map((m) => outPin(m)).join("、")}，输出即为 F。`
    }
  ];
  return {
    result: {
      chip,
      chipName: CHIP_NAME[chip],
      pins: CHIP_PINS[chip],
      stages,
      mapping,
      functionText: specText(spec) + tail,
      functionLatex: specLatex(spec)
    },
    steps,
    warnings
  };
}
function assignmentsOf(k) {
  const out = [];
  for (let h = 0; h < 1 << k; h++) out.push(range(k).map((j) => h >> k - 1 - j & 1));
  return out;
}
function constData(value) {
  return { kind: "const", value, text: String(value) };
}
function reduceData(cof, highVars) {
  const hasOne = cof.some((v) => v === 1);
  const hasZero = cof.some((v) => v === 0);
  if (!hasOne) return constData(0);
  if (!hasZero) return constData(1);
  const minterms = [];
  const dontCares = [];
  cof.forEach((v, h) => {
    if (v === 1) minterms.push(h);
    else if (v === "X") dontCares.push(h);
  });
  const mini = minimize({ variables: highVars.slice(), minterms, dontCares }, "SOP");
  const first = mini.solutions[0] ?? [];
  if (first.length === 1 && first[0].literals === 1) {
    const mask = first[0].mask;
    const j = mask.split("").findIndex((ch) => ch !== "-");
    const neg = mask[j] === "0";
    const name2 = highVars[j];
    return {
      kind: "literal",
      name: name2,
      neg,
      text: name2 + (neg ? "'" : ""),
      latex: neg ? `\\overline{${latexName2(name2)}}` : latexName2(name2)
    };
  }
  return { kind: "expr", text: mini.texts[0] ?? "", latex: mini.latex[0] ?? "" };
}
function muxMap(chip, spec, selectIn) {
  requireVars(spec);
  const s = chip === "151" ? 3 : 2;
  const vars = spec.variables;
  const n = vars.length;
  const warnings = [];
  let selVars;
  if (selectIn !== void 0) {
    const maxSel = Math.min(s, n);
    if (!Array.isArray(selectIn) || selectIn.length === 0 || selectIn.length > maxSel) {
      throw new DlogicInputError(`选择变量的个数应在 1 到 ${maxSel} 之间。`);
    }
    checkNames(selectIn, "选择变量");
    for (const v of selectIn) {
      if (!vars.includes(v)) throw new DlogicInputError(`选择变量“${v}”不在变量列表中。`);
    }
    selVars = selectIn.slice();
  } else {
    selVars = vars.slice(n - Math.min(s, n));
  }
  const m = selVars.length;
  const highVars = vars.filter((v) => !selVars.includes(v));
  const k = highVars.length;
  const selPins = chip === "151" ? ["A2", "A1", "A0"] : ["B", "A"];
  const dataPins = chip === "151" ? range(8).map((i) => `D${i}`) : range(4).map((i) => `1C${i}`);
  const onSet = new Set(spec.minterms);
  const dcSet = new Set(spec.dontCares);
  const highAssignments = assignmentsOf(k);
  const rows = [];
  for (let i = 0; i < 1 << m; i++) {
    const selectBits = range(m).map((j) => i >> m - 1 - j & 1);
    const cof = highAssignments.map((hv) => {
      let idx = 0;
      for (let p = 0; p < n; p++) {
        const v = vars[p];
        const sj = selVars.indexOf(v);
        const bit = sj >= 0 ? selectBits[sj] : hv[highVars.indexOf(v)];
        idx = idx * 2 + bit;
      }
      if (dcSet.has(idx)) return "X";
      return onSet.has(idx) ? 1 : 0;
    });
    rows.push({ index: i, selectBits, dataPin: dataPins[i], cofactor: cof, data: reduceData(cof, highVars) });
  }
  if (spec.dontCares.length) warnings.push("无关项参与降维：数据端取值在 0 与 1 之间选择，以使结果最简。");
  const wiring = selPins.map((p, idx) => {
    const j = idx - (s - m);
    return j < 0 ? { pin: p, signal: "GND", note: "高位地址接地" } : { pin: p, signal: selVars[j] };
  });
  if (chip === "151") {
    wiring.push({ pin: "S̄", signal: "GND", note: "选通有效" });
  } else {
    wiring.push({ pin: "1S̄", signal: "GND", note: "选通有效" });
    wiring.push({ pin: "2S̄", signal: "VCC", note: "本例不用第 2 路" });
  }
  dataPins.forEach((p, i) => {
    if (i >= 1 << m) {
      wiring.push({ pin: p, signal: "GND", note: "地址高位接地，不会被选中" });
      return;
    }
    const d = rows[i].data;
    if (d.kind === "const") wiring.push({ pin: p, signal: d.value === 1 ? "VCC" : "GND" });
    else if (d.kind === "literal") {
      wiring.push(d.neg ? { pin: p, signal: d.name, note: "经非门反相" } : { pin: p, signal: d.name });
    } else wiring.push({ pin: p, signal: d.text, note: "需外加门电路" });
  });
  wiring.push({ pin: chip === "151" ? "Y" : "1Y", signal: "F" });
  const mapping = {
    kind: "mux",
    chip,
    selectVars: selVars.slice(),
    highVars: highVars.slice(),
    highAssignments,
    rows
  };
  const steps = [
    {
      kind: "select",
      text: `选择端：${selVars.map((v, j) => `${selPins[s - m + j]} = ${v}`).join("，")}` + (m < s ? `；其余地址端接地，只用前 ${1 << m} 个数据端。` : "。")
    },
    {
      kind: "reduce",
      text: k > 0 ? `降维：对每个选择码，把 F 按 ${highVars.join("、")} 展开，得到数据端的取值（0、1、变量或其反变量）。` : "函数变量全部作为选择端，数据端直接取 F 在各选择码下的值。"
    },
    ...rows.map((r) => ({
      kind: "data",
      text: `${r.dataPin}（选择码 ${r.selectBits.join("")}）= ${r.data.kind === "expr" ? r.data.text : r.data.kind === "const" ? String(r.data.value) : r.data.text}`
    })),
    { kind: "output", text: `Y = Σ D_i · m_i(${selVars.join(" ")})` }
  ];
  return {
    result: {
      chip,
      chipName: CHIP_NAME[chip],
      pins: CHIP_PINS[chip],
      stages: [{ label: CHIP_NAME[chip], wiring }],
      mapping,
      functionText: specText(spec),
      functionLatex: specLatex(spec)
    },
    steps,
    warnings
  };
}
function adderMap(bcd) {
  const stages = [
    {
      label: "第 1 片：A + B + Cin",
      wiring: [
        { pin: "A1", signal: "A1", note: "操作数 A 的最低位" },
        { pin: "A2", signal: "A2" },
        { pin: "A3", signal: "A3" },
        { pin: "A4", signal: "A4", note: "操作数 A 的最高位" },
        { pin: "B1", signal: "B1", note: "操作数 B 的最低位" },
        { pin: "B2", signal: "B2" },
        { pin: "B3", signal: "B3" },
        { pin: "B4", signal: "B4", note: "操作数 B 的最高位" },
        { pin: "C0", signal: "Cin", note: "无低位进位时接 GND" },
        { pin: "Σ1", signal: "S1" },
        { pin: "Σ2", signal: "S2" },
        { pin: "Σ3", signal: "S3" },
        { pin: "Σ4", signal: "S4" },
        { pin: "C4", signal: "C4", note: "进位输出" }
      ]
    }
  ];
  const steps = [{ kind: "add", text: "S = A + B + Cin，结果为 5 位 C4 S4 S3 S2 S1（二进制）。" }];
  let mapping = { kind: "adder", bcd: false, correctionText: null, correctionLatex: null };
  if (bcd) {
    stages.push({
      label: "第 2 片：加 6（0110）修正",
      wiring: [
        { pin: "A1", signal: "S1", note: "第 1 片的和" },
        { pin: "A2", signal: "S2" },
        { pin: "A3", signal: "S3" },
        { pin: "A4", signal: "S4" },
        { pin: "B1", signal: "GND", note: "6 = 0110" },
        { pin: "B2", signal: "K", note: "修正信号" },
        { pin: "B3", signal: "K", note: "修正信号" },
        { pin: "B4", signal: "GND" },
        { pin: "C0", signal: "GND" },
        { pin: "Σ1", signal: "R1", note: "个位结果" },
        { pin: "Σ2", signal: "R2" },
        { pin: "Σ3", signal: "R3" },
        { pin: "Σ4", signal: "R4" },
        { pin: "C4", signal: "不用" }
      ]
    });
    mapping = {
      kind: "adder",
      bcd: true,
      correctionText: "K = C4 + S4S3 + S4S2",
      correctionLatex: "K = C_4 + S_4S_3 + S_4S_2"
    };
    steps.push(
      {
        kind: "bcd-detect",
        text: "8421 码加法：和大于 9 时需要修正。判断式 K = C4 + S4S3 + S4S2（和为 10～19 或有进位时 K = 1）。"
      },
      {
        kind: "bcd-add",
        text: "K = 1 时第 2 片加 0110（即 6），结果为个位 R4R3R2R1；K 即为十位进位。K = 0 时第 2 片加 0，结果即为和。"
      }
    );
  }
  return {
    result: {
      chip: "283",
      chipName: CHIP_NAME["283"],
      pins: CHIP_PINS["283"],
      stages,
      mapping,
      functionText: bcd ? "4 位二进制加法，并做 8421 码（BCD）修正" : "4 位二进制加法：S = A + B + Cin，C4 为进位",
      functionLatex: null
    },
    steps,
    warnings: []
  };
}
function comparatorMap(bits) {
  if (!Number.isInteger(bits) || bits < 4 || bits > 16 || bits % 4 !== 0) {
    throw new DlogicInputError("比较位数应为 4、8、12 或 16。");
  }
  const stageCount = bits / 4;
  const stages = [];
  for (let s = 0; s < stageCount; s++) {
    const lo = 4 * s;
    const wiring = [];
    for (let j = 3; j >= 0; j--) {
      wiring.push({ pin: `A${j}`, signal: `A${lo + j}`, note: lo + j === 0 ? "最低位" : void 0 });
    }
    for (let j = 3; j >= 0; j--) {
      wiring.push({ pin: `B${j}`, signal: `B${lo + j}`, note: lo + j === 0 ? "最低位" : void 0 });
    }
    if (s === 0) {
      wiring.push({ pin: "I(A>B)", signal: "GND", note: "最低片的级联输入" });
      wiring.push({ pin: "I(A<B)", signal: "GND" });
      wiring.push({ pin: "I(A=B)", signal: "VCC", note: "最低片的级联输入" });
    } else {
      wiring.push({ pin: "I(A>B)", signal: `G${s - 1}`, note: "接低一位片的输出" });
      wiring.push({ pin: "I(A<B)", signal: `L${s - 1}` });
      wiring.push({ pin: "I(A=B)", signal: `E${s - 1}` });
    }
    wiring.push({ pin: "F(A>B)", signal: `G${s}` });
    wiring.push({ pin: "F(A<B)", signal: `L${s}` });
    wiring.push({ pin: "F(A=B)", signal: `E${s}` });
    stages.push({ label: `第 ${s + 1} 片：第 ${lo + 3} ~ ${lo} 位`, wiring });
  }
  const steps = [
    {
      kind: "compare",
      text: "比较规则：从最高位开始，第一对不相等的位决定大小；全部相等时，结果由级联输入决定。"
    },
    {
      kind: "cascade",
      text: stageCount > 1 ? `级联：低位片的 F(A>B)、F(A<B)、F(A=B) 接高位片的 I(A>B)、I(A<B)、I(A=B)；最低片的级联输入为 0、0、1。总输出取最高位片的 F。` : "单片使用：I(A>B)、I(A<B) 接 0，I(A=B) 接 1，输出直接取 F。"
    }
  ];
  return {
    result: {
      chip: "85",
      chipName: CHIP_NAME["85"],
      pins: CHIP_PINS["85"],
      stages,
      mapping: { kind: "comparator", bits, stages: stageCount },
      functionText: `${bits} 位数值比较：F(A>B)、F(A<B)、F(A=B)`,
      functionLatex: null
    },
    steps,
    warnings: []
  };
}
function parityMap(spec) {
  requireVars(spec);
  const n = spec.variables.length;
  if (n > 9) throw new DlogicInputError("74LS280 最多 9 个输入。");
  const on = new Set(spec.minterms);
  const dc = new Set(spec.dontCares);
  let oddOk = true;
  let evenOk = true;
  for (let m = 0; m < 1 << n; m++) {
    if (dc.has(m)) continue;
    let pc = 0;
    for (let x = m; x; x >>= 1) pc += x & 1;
    const p = pc & 1;
    const v = on.has(m) ? 1 : 0;
    if (v !== p) oddOk = false;
    if (v !== 1 - p) evenOk = false;
  }
  if (!oddOk && !evenOk) {
    throw new DlogicInputError(
      "该函数不是输入变量的奇偶函数（输出只取决于输入中 1 的个数的奇偶性），74LS280 无法直接实现。"
    );
  }
  const odd = oddOk;
  const outPin = odd ? "Σ_O" : "Σ_E";
  const inPins = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const wiring = inPins.map(
    (p, j) => j < n ? { pin: p, signal: spec.variables[j] } : { pin: p, signal: "GND", note: "未用输入接地" }
  );
  wiring.push({ pin: outPin, signal: "F" });
  wiring.push({ pin: odd ? "Σ_E" : "Σ_O", signal: "不用" });
  const mapping = { kind: "parity", variables: spec.variables.slice(), odd, outputPin: outPin };
  const steps = [
    {
      kind: "parity",
      text: odd ? `函数为奇校验：输入中 1 的个数为奇数时 F = 1，由 ${outPin} 输出。` : `函数为偶校验：输入中 1 的个数为偶数时 F = 1，由 ${outPin} 输出。`
    },
    {
      kind: "pad",
      text: n < 9 ? `未用的 ${9 - n} 个输入接 0（0 不改变 1 的个数的奇偶性）。` : "9 个输入全部使用。"
    }
  ];
  return {
    result: {
      chip: "280",
      chipName: CHIP_NAME["280"],
      pins: CHIP_PINS["280"],
      stages: [{ label: CHIP_NAME["280"], wiring }],
      mapping,
      functionText: odd ? `奇校验：F = ${spec.variables.join(" ⊕ ")} 的奇偶（1 的个数为奇数时为 1）` : `偶校验：F = 1 当且仅当 ${spec.variables.join("、")} 中 1 的个数为偶数`,
      functionLatex: null
    },
    steps,
    warnings: []
  };
}
function encoderMap() {
  const mapping = { kind: "encoder" };
  return {
    result: {
      chip: "148",
      chipName: CHIP_NAME["148"],
      pins: CHIP_PINS["148"],
      stages: [],
      mapping,
      functionText: "8 线-3 线优先编码：I7 优先级最高，输出为最高有效输入编号的反码",
      functionLatex: null
    },
    steps: [
      { kind: "encode", text: "同一时刻有多个输入有效时，只对优先级最高的输入编码（I7 最高，I0 最低）。" },
      { kind: "encode", text: "输出 Y̅2Y̅1Y̅0 为低有效，即编码的反码；无输入有效时 GS̅ 为 1。" }
    ],
    warnings: ["74LS148 是优先编码器，不直接实现任意逻辑函数；此处只给出引脚与优先级说明。"]
  };
}
function mapMsi(req) {
  if (!MSI_CHIPS.includes(req.chip)) {
    throw new DlogicInputError(`不支持的芯片 ${String(req.chip)}，可用：${MSI_CHIPS.join("、")}。`);
  }
  switch (req.chip) {
    case "138":
    case "139":
      return decoderMap(req.chip, functionSpec(req));
    case "151":
    case "153":
      return muxMap(req.chip, functionSpec(req), req.selectVars);
    case "148":
      return encoderMap();
    case "283":
      return adderMap(req.bcd === true);
    case "85":
      return comparatorMap(req.bits ?? 4);
    case "280":
      return parityMap(functionSpec(req));
  }
}

// src/host/tools/comb.logic.ts
var COMB_OPS = ["analyze", "map_msi", "draw"];
var COMB_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...COMB_OPS],
    description: "analyze 门级网表分析；draw 由表达式画门级逻辑图（两级门）并分析；map_msi 用 MSI 芯片实现函数或功能。"
  },
  inputs: {
    type: "array",
    items: { type: "string" },
    description: "analyze：原始输入名列表（最多 6 个），inputs[0] 为真值表的最高位。"
  },
  gates: {
    type: "array",
    description: "analyze：门列表（最多 20 个），每个为 {out, type, in}。type 取 AND / OR / NOT / NAND / NOR / XOR / XNOR；NOT 只有 1 个输入，其余至少 2 个。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        out: { type: "string", required: true, description: "输出信号名。" },
        type: { type: "string", required: true, enum: [...GATE_TYPES], description: "门类型。" },
        in: { type: "array", required: true, items: { type: "string" }, description: "输入信号名（原始输入或其他门的输出）。" }
      }
    }
  },
  outputs: {
    type: "array",
    items: { type: "string" },
    description: "analyze：要分析的输出信号；省略时取未被其他门使用的门输出。"
  },
  chip: {
    type: "string",
    enum: [...MSI_CHIPS],
    description: "map_msi：芯片型号，取 138 / 139 / 148 / 151 / 153 / 85 / 283 / 280。"
  },
  expr: {
    type: "string",
    description: `map_msi：待实现的函数表达式，例如 "A'B + AB'"。与 minterms 二选一。draw：要画图的表达式；与或式按原样建网表，否则取最简与或式并给出提示。`
  },
  outputName: {
    type: "string",
    description: "draw：输出信号名，默认 F。"
  },
  variables: {
    type: "array",
    items: { type: "string" },
    description: "函数变量（按书写顺序，variables[0] 为最高位）。使用 minterms 时必填。"
  },
  minterms: {
    type: "array",
    items: { type: "integer" },
    description: "map_msi：函数的最小项编号（0 起），与 variables 一起使用。"
  },
  dontCares: {
    type: "array",
    items: { type: "integer" },
    description: "map_msi：无关项编号。"
  },
  selectVars: {
    type: "array",
    items: { type: "string" },
    description: "map_msi 用 151 / 153 时：作为选择端的变量（MSB 在前）；省略时取最低位的变量。"
  },
  bits: {
    type: "integer",
    description: "map_msi 用 85 时的比较位数，4 的倍数，4～16，默认 4。"
  },
  bcd: {
    type: "boolean",
    description: "map_msi 用 283 时：是否做 8421 码（BCD）加法修正。"
  }
};
function runComb(args) {
  return envelope(String(args.op), () => {
    switch (args.op) {
      case "analyze": {
        if (!Array.isArray(args.inputs)) throw new DlogicInputError("analyze 需要提供 inputs（输入名列表）。");
        if (!Array.isArray(args.gates)) throw new DlogicInputError("analyze 需要提供 gates（门列表）。");
        const result = analyzeNetlist({
          inputs: args.inputs,
          gates: args.gates,
          outputs: args.outputs
        });
        return { result, steps: analyzeSteps(result) };
      }
      case "draw": {
        if (typeof args.expr !== "string") throw new DlogicInputError("draw 需要提供 expr（表达式）。");
        const out = drawExpr({ expr: args.expr, variables: args.variables, outputName: args.outputName });
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      case "map_msi": {
        if (typeof args.chip !== "string") throw new DlogicInputError("map_msi 需要提供 chip（芯片型号）。");
        const req = {
          chip: args.chip,
          expr: args.expr,
          variables: args.variables,
          minterms: args.minterms,
          dontCares: args.dontCares,
          selectVars: args.selectVars,
          bits: args.bits,
          bcd: args.bcd
        };
        const out = mapMsi(req);
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
var TRUTH_LIMIT = 32;
function renderAnalyze(r, lines) {
  lines.push(`输入：${r.inputs.join(", ")}；共 ${r.gates.length} 个门，${r.depth} 级`);
  for (const g of r.gates) {
    const tail = g.expr !== null ? `；代入输入：${g.out} = ${g.expr}` : "";
    lines.push(`第 ${g.level} 级 ${g.out}（${g.type}）：${g.out} = ${g.local}${tail}`);
  }
  for (const f of r.finalExprs) {
    lines.push(`输出 ${f.name} = ${f.expr ?? "（展开式过长，略）"}`);
    lines.push(`化简：${f.name} = ${f.simplified}（${f.cost.terms} 项，${f.cost.literals} 个文字）`);
  }
  const tt = r.truthTable;
  lines.push(`真值表（${tt.variables.join(" ")} | ${tt.outputs.join(" ")}）`);
  if (tt.rows.length <= TRUTH_LIMIT) {
    for (const row of tt.rows) lines.push(`${row.inputs.join(" ")} | ${row.outputs.join(" ")}`);
  } else {
    lines.push(`共 ${tt.rows.length} 行，超过 ${TRUTH_LIMIT} 行，逐行略去。`);
  }
}
function renderMsi(r, lines) {
  lines.push(`芯片：${r.chipName}`, `功能：${r.functionText}`);
  lines.push("引脚：");
  for (const p of r.pins) {
    const alias = p.aliases.length ? `（别名 ${p.aliases.join("、")}）` : "";
    const level = p.activeLevel === "low" ? "低电平有效" : p.activeLevel === "high" ? "高电平有效" : "";
    lines.push(`  ${p.name}${alias} ${level}${p.note ? "，" + p.note : ""}`);
  }
  for (const st of r.stages) {
    lines.push(`接线：${st.label}`);
    for (const w of st.wiring) lines.push(`  ${w.pin} ← ${w.signal}${w.note ? `（${w.note}）` : ""}`);
  }
  const m = r.mapping;
  if (m.kind === "decoder") {
    lines.push(m.constant === null ? `与非式：F = ${m.nandText}` : `函数恒为 ${m.constant}`);
  } else if (m.kind === "mux") {
    lines.push(`降维：选择变量 ${m.selectVars.join(" ")}，数据端变量 ${m.highVars.join(" ") || "无"}`);
    for (const row of m.rows) lines.push(`  ${row.dataPin}（选择码 ${row.selectBits.join("")}）= ${row.data.text}`);
  } else if (m.kind === "adder" && m.correctionText) {
    lines.push(`修正：${m.correctionText}`);
  }
}
function renderComb(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  if (value.op === "analyze" || value.op === "draw") renderAnalyze(value.result, lines);
  else if (value.op === "map_msi") renderMsi(value.result, lines);
  else lines.push("（无可显示的结果）");
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}
function writeCombFigure(value) {
  try {
    if (!value.ok || value.result === null) return null;
    if (value.op !== "analyze" && value.op !== "draw") return null;
    const svg = renderCombFigureSvg(value.result);
    if (!svg) return null;
    const hash = createHash("sha1").update(svg, "utf8").digest("hex").slice(0, 12);
    const dir = path.join(os.tmpdir(), "dlogic-figs");
    const file = path.join(dir, `${hash}.svg`);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, svg, "utf8");
    }
    return file;
  } catch {
    return null;
  }
}
function renderCombForHost(value) {
  const text2 = renderComb(value);
  const file = writeCombFigure(value);
  if (!file) return text2;
  return `${text2}
图文件（请在最终回答里用 Markdown 图片语法引用，路径原样照抄）：${file}`;
}

// src/host/tools/comb.ts
var DESCRIPTION5 = [
  "组合逻辑的确定性计算。op 取值：analyze 由门级网表（inputs 与 gates，最多 6 个输入、20 个门）逐级推导每个门的式子，",
  "给出各输出的最终式、真值表与化简结果；draw 由表达式（expr，可配 variables 与 outputName）画两级门逻辑图并同样分析，",
  "非与或式时取最简与或式（结果中给出提示）；map_msi 用 74LS138/139/148/151/153/85/283/280 实现指定函数或功能，",
  "给出国标引脚名、别名、有效电平与接线表；151/153 另给出降维真值表与数据端取值（0、1、变量或其反变量）。",
  "门 type 取 AND/OR/NOT/NAND/NOR/XOR/XNOR。函数输入二选一：expr（可配 variables），或 minterms + dontCares + variables（variables[0] 为最高位）。"
].join("");
var dlogicComb = defineTool6({
  name: "dlogic_comb",
  description: DESCRIPTION5,
  parameters: COMB_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderCombForHost(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_comb", value })
  },
  async execute(args) {
    return runComb(args);
  }
});

// src/host/tools/seq.ts
import { defineTool as defineTool7 } from "@deepseek-ai/dsh-tools";

// src/solvers/seq.ts
var SB = "S̄";
var RB = "R̄";
var FF_INFO = {
  SR: {
    title: "SR 触发器（边沿触发）",
    pins: ["S", "R"],
    trigger: "edge",
    characteristic: "Q* = S + R̄Q",
    latex: "Q^{n+1} = S + \\overline{R}Q^n",
    constraint: "SR = 0（S 与 R 不能同时为 1）"
  },
  D: {
    title: "D 触发器（边沿触发）",
    pins: ["D"],
    trigger: "edge",
    characteristic: "Q* = D",
    latex: "Q^{n+1} = D",
    constraint: null
  },
  JK: {
    title: "JK 触发器（边沿触发）",
    pins: ["J", "K"],
    trigger: "edge",
    characteristic: "Q* = JQ' + K'Q",
    latex: "Q^{n+1} = J\\overline{Q}^{n} + \\overline{K}Q^n",
    constraint: null
  },
  T: {
    title: "T 触发器（边沿触发）",
    pins: ["T"],
    trigger: "edge",
    characteristic: "Q* = T ⊕ Q = TQ' + T'Q",
    latex: "Q^{n+1} = T \\oplus Q^n",
    constraint: null
  },
  SR_LATCH: {
    title: "基本 SR 锁存器（与非门，低电平有效）",
    pins: [SB, RB],
    trigger: "none",
    characteristic: "Q* = S̄' + R̄Q",
    latex: "Q^{n+1} = \\overline{\\overline{S}} + \\overline{R}\\,Q^n",
    constraint: "S̄ + R̄ = 1（S̄ 与 R̄ 不能同时为 0）"
  },
  GATED_SR: {
    title: "门控 SR 锁存器（CP 高电平有效）",
    pins: ["S", "R", "CP"],
    trigger: "level",
    characteristic: "Q* = S + R̄Q（CP = 1 时）",
    latex: "Q^{n+1} = S + \\overline{R}Q^n \\quad (CP=1)",
    constraint: "SR = 0（CP = 1 期间）"
  },
  GATED_D: {
    title: "门控 D 锁存器（CP 高电平有效）",
    pins: ["D", "CP"],
    trigger: "level",
    characteristic: "Q* = D（CP = 1 时）",
    latex: "Q^{n+1} = D \\quad (CP=1)",
    constraint: null
  }
};
var FF_PINS_CLOCKED = {
  SR: ["S", "R"],
  D: ["D"],
  JK: ["J", "K"],
  T: ["T"]
};
function flip(q) {
  return q === 1 ? 0 : 1;
}
function setReset(q, s, r) {
  if (s === 1 && r === 1) return "X";
  if (s === 1) return 1;
  if (r === 1) return 0;
  return q;
}
function stepFf(kind, q, v) {
  switch (kind) {
    case "D":
      return v.D;
    case "T":
      return v.T === 1 ? flip(q) : q;
    case "JK":
      if (v.J === 1 && v.K === 1) return flip(q);
      if (v.J === 1) return 1;
      if (v.K === 1) return 0;
      return q;
    case "SR":
      return setReset(q, v.S, v.R);
    case "GATED_D":
      return v.CP === 1 ? v.D : q;
    case "GATED_SR":
      return v.CP === 1 ? setReset(q, v.S, v.R) : q;
    case "SR_LATCH": {
      const sb = v[SB];
      const rb = v[RB];
      if (sb === 0 && rb === 0) return "X";
      if (sb === 0) return 1;
      if (rb === 0) return 0;
      return q;
    }
  }
}
function assignments(names) {
  const out = [];
  const n = names.length;
  for (let m = 0; m < 1 << n; m++) {
    const rec = {};
    names.forEach((nm, i) => {
      rec[nm] = m >> n - 1 - i & 1;
    });
    out.push(rec);
  }
  return out;
}
function ffCharacteristic(kind) {
  const info = FF_INFO[kind];
  if (info === void 0) throw new DlogicInputError(`未知的触发器类型：${String(kind)}`);
  const inputs = info.pins;
  const table = [];
  for (const v of assignments(inputs)) {
    for (const q of [0, 1]) {
      table.push({ q, inputs: { ...v }, next: stepFf(kind, q, v) });
    }
  }
  const gated = inputs.includes("CP");
  const drivable = inputs.filter((p) => p !== "CP");
  const excitation = [];
  for (const from of [0, 1]) {
    for (const to of [0, 1]) {
      const cands = assignments(inputs).filter((v) => !gated || v.CP === 1).filter((v) => stepFf(kind, from, v) === to);
      const drive = {};
      for (const p of drivable) {
        const vals = new Set(cands.map((v) => v[p]));
        drive[p] = vals.size === 1 ? Array.from(vals)[0] : "X";
      }
      if (gated) drive.CP = 1;
      excitation.push({ from, to, drive });
    }
  }
  return {
    kind,
    title: info.title,
    trigger: info.trigger,
    inputs: inputs.slice(),
    characteristic: info.characteristic,
    latex: info.latex,
    constraint: info.constraint,
    table,
    excitation
  };
}
function bitsOf(k, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(k >> n - 1 - i & 1);
  return out;
}
function keyOf(bits) {
  let k = 0;
  for (const b of bits) k = k << 1 | b;
  return k;
}
function strOf(bits) {
  return bits.join("");
}
function parseBits(s, n, what) {
  const t = s.trim();
  if (!/^[01]+$/.test(t) || t.length !== n) {
    throw new DlogicInputError(`${what}应为 ${n} 位的 0/1 字符串，例如 "${"0".repeat(n)}"。`);
  }
  return t.split("").map((ch) => ch === "1" ? 1 : 0);
}
function cycleFrom(next, start) {
  const seen = /* @__PURE__ */ new Map();
  const path5 = [];
  let cur = start;
  while (cur !== null) {
    const at = seen.get(cur);
    if (at !== void 0) return path5.slice(at);
    seen.set(cur, path5.length);
    path5.push(cur);
    cur = next[cur];
  }
  return null;
}
function reaches(next, set, k) {
  const seen = /* @__PURE__ */ new Set();
  let cur = k;
  while (cur !== null) {
    if (set.has(cur)) return true;
    if (seen.has(cur)) return false;
    seen.add(cur);
    cur = next[cur];
  }
  return false;
}
function walkTo(next, k, set) {
  const path5 = [k];
  const seen = /* @__PURE__ */ new Set([k]);
  let cur = k;
  for (; ; ) {
    if (set.has(cur)) return { path: path5, end: "valid" };
    const nx = next[cur];
    if (nx === null) return { path: path5, end: "forbidden" };
    path5.push(nx);
    if (seen.has(nx)) return { path: path5, end: "loop" };
    seen.add(nx);
    cur = nx;
  }
}
function shortestToSet(nextAll, k, set) {
  if (set.has(k)) return [k];
  const parent = /* @__PURE__ */ new Map([[k, -1]]);
  const queue = [k];
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi];
    for (const nx of nextAll) {
      const to = nx[cur];
      if (to === null || parent.has(to)) continue;
      parent.set(to, cur);
      if (set.has(to)) {
        const path5 = [to];
        let p = cur;
        while (p !== -1) {
          path5.unshift(p);
          p = parent.get(p) ?? -1;
        }
        return path5;
      }
      queue.push(to);
    }
  }
  return null;
}
function allCycles(next) {
  const N = next.length;
  const color = new Array(N).fill(0);
  const out = [];
  for (let s = 0; s < N; s++) {
    if (color[s] !== 0) continue;
    const stack = [];
    const pos = /* @__PURE__ */ new Map();
    let cur = s;
    while (cur !== null && color[cur] === 0) {
      color[cur] = 1;
      pos.set(cur, stack.length);
      stack.push(cur);
      cur = next[cur];
    }
    if (cur !== null && color[cur] === 1) out.push(stack.slice(pos.get(cur) ?? 0));
    for (const x of stack) color[x] = 2;
  }
  return out;
}
var NAME_RE2 = /^[A-Za-z][A-Za-z0-9_]*$/;
var CLOCKED_KINDS = ["SR", "D", "JK", "T"];
function compileMachine(ffs, inputs, outputs) {
  if (!Array.isArray(ffs) || ffs.length < 1 || ffs.length > 4) {
    throw new DlogicInputError("触发器数量须为 1～4 个。");
  }
  const ins = Array.isArray(inputs) ? inputs : [];
  if (ins.length > 2) throw new DlogicInputError("外部输入最多 2 个。");
  const vars = [...ffs.map((f) => f.name), ...ins];
  const seen = /* @__PURE__ */ new Set();
  for (const v of vars) {
    if (typeof v !== "string" || !NAME_RE2.test(v)) throw new DlogicInputError(`变量名“${String(v)}”不合法，应以字母开头。`);
    if (seen.has(v)) throw new DlogicInputError(`变量名重复：${v}`);
    seen.add(v);
  }
  const compiledFfs = ffs.map((f) => {
    if (!CLOCKED_KINDS.includes(f.kind)) {
      throw new DlogicInputError(`触发器 ${f.name} 的类型应为 SR、D、JK 或 T。`);
    }
    const pins = FF_PINS_CLOCKED[f.kind];
    const drives = Array.isArray(f.drives) ? f.drives : [];
    for (const d of drives) {
      if (!pins.includes(d.pin)) throw new DlogicInputError(`触发器 ${f.name}（${f.kind}）没有 ${d.pin} 端。`);
    }
    for (const p of pins) {
      if (!drives.some((d) => d.pin === p)) throw new DlogicInputError(`触发器 ${f.name} 缺少 ${p} 端的驱动表达式。`);
    }
    return {
      name: f.name,
      kind: f.kind,
      pins: pins.map((p) => {
        const d = drives.find((x) => x.pin === p);
        const expr = d ? d.expr : "";
        return { pin: p, expr, ast: parseExpr(expr, vars).ast };
      })
    };
  });
  const compiledOuts = (Array.isArray(outputs) ? outputs : []).map((o) => {
    if (vars.includes(o.name)) throw new DlogicInputError(`输出名 ${o.name} 与变量重名。`);
    return { name: o.name, expr: o.expr, ast: parseExpr(o.expr, vars).ast };
  });
  return { ffs: compiledFfs, inputs: ins.slice(), outputs: compiledOuts, vars };
}
function evalAst(e, env) {
  switch (e.k) {
    case "var": {
      const v = env[e.name];
      if (v === void 0) throw new DlogicInputError(`未知变量“${e.name}”`);
      return v;
    }
    case "const":
      return e.v;
    case "not":
      return evalAst(e.x, env) === 1 ? 0 : 1;
    case "and":
      return e.xs.every((x) => evalAst(x, env) === 1) ? 1 : 0;
    case "or":
      return e.xs.some((x) => evalAst(x, env) === 1) ? 1 : 0;
    case "xor":
      return evalAst(e.a, env) ^ evalAst(e.b, env) ? 1 : 0;
    case "xnor":
      return evalAst(e.a, env) ^ evalAst(e.b, env) ? 0 : 1;
  }
}
function move(m, s, x) {
  const env = {};
  m.ffs.forEach((f, i) => {
    env[f.name] = s[i];
  });
  m.inputs.forEach((nm, j) => {
    env[nm] = x[j];
  });
  const next = [];
  let ok = true;
  m.ffs.forEach((f, i) => {
    const v = {};
    for (const p of f.pins) v[p.pin] = evalAst(p.ast, env);
    const nx = stepFf(f.kind, s[i], v);
    if (nx === "X") ok = false;
    else next.push(nx);
  });
  return { next: ok ? next : null, outs: m.outputs.map((o) => evalAst(o.ast, env)) };
}
function analyzeMachine(ffs, inputs, outputs, init) {
  const m = compileMachine(ffs, inputs, outputs);
  const n = m.ffs.length;
  const mi = m.inputs.length;
  const NS = 1 << n;
  const NX = 1 << mi;
  const initBits = init === void 0 || init.trim() === "" ? bitsOf(0, n) : parseBits(init, n, "初态");
  const initK = keyOf(initBits);
  const moves = [];
  for (let k = 0; k < NS; k++) {
    const row = [];
    for (let x = 0; x < NX; x++) row.push(move(m, bitsOf(k, n), bitsOf(x, mi)));
    moves.push(row);
  }
  const nextOf = (x) => moves.map((row) => row[x].next === null ? null : keyOf(row[x].next));
  const nextArr = [];
  for (let x = 0; x < NX; x++) nextArr.push(nextOf(x));
  const cyc = nextArr.map((nx) => cycleFrom(nx, initK));
  const validSet = /* @__PURE__ */ new Set();
  for (const c of cyc) if (c) for (const k of c) validSet.add(k);
  const toValid = (k) => shortestToSet(nextArr, k, validSet);
  const invalidPaths = [];
  let selfStart2 = validSet.size > 0;
  for (let k = 0; k < NS; k++) {
    if (validSet.has(k)) continue;
    const p = toValid(k);
    if (p === null) selfStart2 = false;
    invalidPaths.push({
      from: strOf(bitsOf(k, n)),
      path: (p ?? [k]).map((s) => strOf(bitsOf(s, n))),
      reached: p !== null
    });
  }
  const table = [];
  for (let k = 0; k < NS; k++) {
    for (let x = 0; x < NX; x++) {
      const mv = moves[k][x];
      table.push({
        state: strOf(bitsOf(k, n)),
        input: mi > 0 ? strOf(bitsOf(x, mi)) : "",
        next: mv.next === null ? "×" : strOf(mv.next),
        outputs: m.outputs.map((o, i) => ({ name: o.name, value: mv.outs[i] })),
        valid: validSet.has(k)
      });
    }
  }
  const stateEquations = m.ffs.map((f, i) => {
    const minterms = [];
    const dontCares = [];
    for (let k = 0; k < NS; k++) {
      for (let x = 0; x < NX; x++) {
        const idx = k * NX + x;
        const nx = moves[k][x].next;
        if (nx === null) dontCares.push(idx);
        else if (nx[i] === 1) minterms.push(idx);
      }
    }
    const r = minimize({ variables: m.vars.slice(), minterms, dontCares }, "SOP");
    return { ff: f.name, text: r.texts[0] ?? "0", latex: r.latex[0] ?? "0" };
  });
  const outs = m.outputs.map((o, oi) => {
    let mealy = false;
    for (let k = 0; k < NS; k++) {
      for (let x = 1; x < NX; x++) if (moves[k][x].outs[oi] !== moves[k][0].outs[oi]) mealy = true;
    }
    return { name: o.name, expr: o.expr, type: mealy ? "Mealy" : "Moore" };
  });
  const cycles = [];
  for (let x = 0; x < NX; x++) {
    const c = cyc[x];
    if (c) cycles.push({ input: mi > 0 ? strOf(bitsOf(x, mi)) : "", states: c.map((k) => strOf(bitsOf(k, n))) });
  }
  const nodes = [];
  for (let k = 0; k < NS; k++) {
    nodes.push({ id: strOf(bitsOf(k, n)), label: strOf(bitsOf(k, n)), valid: validSet.has(k), initial: k === initK });
  }
  const hasForbidden = moves.some((row) => row.some((mv) => mv.next === null));
  if (hasForbidden) nodes.push({ id: "×", label: "×", valid: false });
  const edgeMap = /* @__PURE__ */ new Map();
  for (let k = 0; k < NS; k++) {
    for (let x = 0; x < NX; x++) {
      const mv = moves[k][x];
      const from = strOf(bitsOf(k, n));
      const to = mv.next === null ? "×" : strOf(mv.next);
      const parts = [];
      if (mi > 0) parts.push(strOf(bitsOf(x, mi)));
      if (mv.outs.length > 0) parts.push(mv.outs.join(""));
      const label = parts.join("/");
      const key = `${from}>${to}`;
      const e = edgeMap.get(key) ?? { from, to, labels: [] };
      if (!e.labels.includes(label)) e.labels.push(label);
      edgeMap.set(key, e);
    }
  }
  const edges = [];
  for (const e of edgeMap.values()) edges.push({ from: e.from, to: e.to, label: e.labels.join(", ") });
  return {
    stateNames: m.ffs.map((f) => f.name),
    inputNames: m.inputs.slice(),
    drives: m.ffs.flatMap((f) => f.pins.map((p) => ({ ff: f.name, kind: f.kind, pin: p.pin, expr: p.expr }))),
    stateEquations,
    outputs: outs,
    initial: strOf(initBits),
    table,
    validStates: Array.from(validSet).sort((a, b) => a - b).map((k) => strOf(bitsOf(k, n))),
    cycles,
    selfStart: selfStart2,
    invalidPaths,
    graph: { nodes, edges }
  };
}
function bin4(v) {
  return v.toString(2).padStart(4, "0");
}
function counterDesign(model, method, N) {
  if (!Number.isInteger(N) || N < 2 || N > 256) throw new DlogicInputError("模 N 须为 2～256 的整数。");
  const M = model === "160" ? 10 : 16;
  if (N > M * M) throw new DlogicInputError(`${model} 两片级联的最大模为 ${M * M}。`);
  const chips = N <= M ? 1 : 2;
  const C = chips === 1 ? M : M * M;
  const bitNames = chips === 1 ? ["Q3", "Q2", "Q1", "Q0"] : ["H3", "H2", "H1", "H0", "L3", "L2", "L1", "L0"];
  const str = (v) => chips === 1 ? bin4(v) : `${bin4(Math.floor(v / M))} ${bin4(v % M)}`;
  const natural = N === C;
  let feedbackKind = "none";
  let signal = null;
  let decode = null;
  let load = null;
  let transient = null;
  let start = 0;
  if (!natural) {
    if (method === "preset") {
      const D = C - N;
      start = D;
      load = { value: D, bits: str(D) };
      decode = C - 1;
      signal = "LD̄";
      feedbackKind = "sync";
    } else if (model === "163") {
      decode = N - 1;
      signal = "CR̄";
      feedbackKind = "sync";
    } else {
      decode = N;
      signal = "CR̄";
      feedbackKind = "async";
      transient = N;
    }
  }
  const values = [];
  for (let i = 0; i < N; i++) values.push(method === "preset" && !natural ? start + i : i);
  const sequence = values.map((v, i) => ({ index: i, value: v, bits: str(v), transient: false }));
  if (transient !== null) sequence.push({ index: N, value: transient, bits: str(transient), transient: true });
  let expr = "";
  let decodeBits = null;
  if (decode !== null && signal !== null) {
    decodeBits = str(decode);
    const ones = [];
    const flat = decodeBits.replace(" ", "");
    for (let i = 0; i < flat.length; i++) if (flat[i] === "1") ones.push(bitNames[i]);
    expr = `${signal} = (${ones.join("")})'`;
  }
  return {
    model,
    method,
    N,
    chips,
    modulus: C,
    natural,
    bitNames,
    feedback: { kind: feedbackKind, signal, decode: decodeBits, expr },
    load,
    sequence,
    glitch: transient !== null,
    transient: transient === null ? null : str(transient)
  };
}
function shiftBits(k, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(k >> i & 1);
  return out;
}
function shiftKey(b) {
  let k = 0;
  for (let i = 0; i < b.length; i++) k |= b[i] << i;
  return k;
}
function shiftStr(k, n) {
  return shiftBits(k, n).reverse().join("");
}
function shiftParse(s, n) {
  const b = parseBits(s, n, "初态");
  const bits = new Array(n).fill(0);
  for (let j = 0; j < n; j++) bits[n - 1 - j] = b[j];
  return shiftKey(bits);
}
function shiftNext(kind, dir, b, serial) {
  const n = b.length;
  const out = new Array(n).fill(0);
  if (kind === "194") {
    for (let i = 0; i < n; i++) {
      if (dir === "right") out[i] = i < n - 1 ? b[i + 1] : serial;
      else out[i] = i > 0 ? b[i - 1] : serial;
    }
    return out;
  }
  for (let i = 1; i < n; i++) out[i] = b[i - 1];
  out[0] = kind === "johnson" ? b[n - 1] === 1 ? 0 : 1 : b[n - 1];
  return out;
}
function shiftDesign(kind, bits, init, direction, serial) {
  if (kind === "194") {
    if (bits !== void 0 && bits !== 4) throw new DlogicInputError("194 为 4 位移位寄存器，bits 只能为 4。");
    const n2 = 4;
    const dir = direction ?? "right";
    const initK2 = init === void 0 || init.trim() === "" ? 0 : shiftParse(init, n2);
    const seq = Array.isArray(serial) ? serial : [];
    for (const s of seq) if (s !== 0 && s !== 1) throw new DlogicInputError("串行输入只能是 0 或 1。");
    if (seq.length > 64) throw new DlogicInputError("串行输入最多 64 位。");
    let cur2 = shiftBits(initK2, n2);
    const sequence2 = [{ step: 0, state: shiftStr(initK2, n2), valid: true }];
    seq.forEach((s, i) => {
      cur2 = shiftNext("194", dir, cur2, s);
      sequence2.push({ step: i + 1, state: shiftStr(shiftKey(cur2), n2), valid: true });
    });
    const feedback2 = dir === "right" ? `右移：Q3 ← D（串行输入），Q2 ← Q3，Q1 ← Q2，Q0 ← Q1` : `左移：Q0 ← D（串行输入），Q1 ← Q0，Q2 ← Q1，Q3 ← Q2`;
    return {
      kind,
      bits: n2,
      direction: dir,
      init: shiftStr(initK2, n2),
      feedback: feedback2,
      sequence: sequence2,
      modulus: null,
      expectedModulus: null,
      validCycle: null,
      cycles: null,
      selfStart: null,
      invalidPaths: [],
      graph: null
    };
  }
  const n = bits ?? 4;
  if (!Number.isInteger(n) || n < 2 || n > 8) throw new DlogicInputError("环形与扭环计数器的位数须为 2～8。");
  const N = 1 << n;
  const defaultInit = kind === "ring" ? "0".repeat(n - 1) + "1" : "0".repeat(n);
  const initStr = init === void 0 || init.trim() === "" ? defaultInit : init.trim();
  const initK = shiftParse(initStr, n);
  const nextArr = [];
  for (let k = 0; k < N; k++) nextArr.push(shiftKey(shiftNext(kind, "right", shiftBits(k, n), 0)));
  const cyc = cycleFrom(nextArr, initK);
  const cycSet = new Set(cyc ?? []);
  const expected = kind === "ring" ? n : 2 * n;
  const walk = [];
  const seenWalk = /* @__PURE__ */ new Set();
  let cur = initK;
  while (cur !== null && !seenWalk.has(cur)) {
    seenWalk.add(cur);
    walk.push(cur);
    cur = nextArr[cur];
  }
  const sequence = walk.map((k, i) => ({ step: i, state: shiftStr(k, n), valid: cycSet.has(k) }));
  const all = allCycles(nextArr);
  const cycles = all.map((c) => ({
    states: c.map((k) => shiftStr(k, n)),
    valid: c.some((k) => cycSet.has(k))
  }));
  let selfStart2 = cyc !== null;
  if (cyc !== null) {
    for (let k = 0; k < N; k++) if (!reaches(nextArr, cycSet, k)) selfStart2 = false;
  }
  const invalidPaths = [];
  if (cyc !== null) {
    for (let k = 0; k < N && invalidPaths.length < 16; k++) {
      if (cycSet.has(k)) continue;
      const w = walkTo(nextArr, k, cycSet);
      invalidPaths.push({ from: shiftStr(k, n), path: w.path.map((p) => shiftStr(p, n)), reached: w.end === "valid" });
    }
  }
  let graph = null;
  if (N <= 16) {
    const nodes = [];
    const edges = [];
    for (let k = 0; k < N; k++) {
      nodes.push({ id: shiftStr(k, n), label: shiftStr(k, n), valid: cycSet.has(k), initial: k === initK });
    }
    for (let k = 0; k < N; k++) {
      const to = nextArr[k];
      if (to !== null) edges.push({ from: shiftStr(k, n), to: shiftStr(to, n), label: "" });
    }
    graph = { nodes, edges };
  }
  const feedback = kind === "ring" ? `Q0 ← Q${n - 1}（各位依次右移，Q0 取 Q${n - 1}），模 = ${n}` : `Q0 ← Q${n - 1}'（Q0 取 Q${n - 1} 的反相，各位依次右移），模 = ${2 * n}`;
  return {
    kind,
    bits: n,
    direction: null,
    init: initStr,
    feedback,
    sequence,
    modulus: cyc === null ? null : cyc.length,
    expectedModulus: expected,
    validCycle: cyc === null ? null : cyc.map((k) => shiftStr(k, n)),
    cycles,
    selfStart: selfStart2,
    invalidPaths,
    graph
  };
}
var MAX_STEPS = 64;
function charOf(v) {
  return v === "X" ? "x" : v === 1 ? "1" : "0";
}
function collectWaves(waves) {
  const map = /* @__PURE__ */ new Map();
  for (const w of Array.isArray(waves) ? waves : []) {
    if (!/^[01]+$/.test(w.wave)) throw new DlogicInputError(`输入 ${w.name} 的波形只能包含 0 与 1。`);
    if (map.has(w.name)) throw new DlogicInputError(`输入 ${w.name} 重复给出。`);
    map.set(w.name, w.wave);
  }
  return map;
}
function stepCount(waves, steps) {
  let len = null;
  for (const [name2, w] of waves) {
    if (len === null) len = w.length;
    else if (w.length !== len) throw new DlogicInputError(`输入 ${name2} 的波形长度与其他输入不一致。`);
  }
  const T = steps ?? len ?? 8;
  if (!Number.isInteger(T) || T < 1 || T > MAX_STEPS) throw new DlogicInputError(`波形长度须为 1～${MAX_STEPS}。`);
  if (len !== null && steps !== void 0 && steps !== len) throw new DlogicInputError("steps 与输入波形长度不一致。");
  return T;
}
function bitAt(w, t) {
  if (w === void 0) return 0;
  return w[t] === "1" ? 1 : 0;
}
function waveformDesign(target, spec) {
  const waves = collectWaves(spec.waves);
  const T = stepCount(waves, spec.steps);
  const signals = [];
  if (target === "ff") {
    if (spec.ffKind === void 0) throw new DlogicInputError("ff 波形需要 ffKind（触发器类型）。");
    const info = ffCharacteristic(spec.ffKind);
    const gated = info.inputs.includes("CP");
    const q0 = spec.init === void 0 || spec.init === "" ? 0 : spec.init === "1" ? 1 : spec.init === "0" ? 0 : -1;
    if (q0 < 0) throw new DlogicInputError("ff 的初态只能是 0 或 1。");
    if (gated) signals.push({ name: "CP", wave: cpWave(waves.get("CP"), T), role: "input" });
    else signals.push({ name: "CP", wave: "p".repeat(T), role: "clock" });
    for (const p of info.inputs.filter((x) => x !== "CP")) {
      signals.push({ name: p, wave: (waves.get(p) ?? "0".repeat(T)).slice(0, T), role: "input" });
    }
    const q = [];
    let cur = q0;
    for (let t = 0; t < T; t++) {
      q.push(cur);
      if (cur === "X") continue;
      const v = {};
      for (const p of info.inputs) v[p] = p === "CP" ? bitAt(waves.get("CP") ?? "1".repeat(T), t) : bitAt(waves.get(p), t);
      cur = stepFf(spec.ffKind, cur, v);
    }
    signals.push({ name: "Q", wave: q.map(charOf).join(""), role: "state" });
    return { target, steps: T, signals };
  }
  if (target === "analyze") {
    const m = compileMachine(spec.flipflops ?? [], spec.inputs ?? [], spec.outputs ?? []);
    const n2 = m.ffs.length;
    const mi = m.inputs.length;
    const initK = spec.init === void 0 || spec.init.trim() === "" ? 0 : keyOf(parseBits(spec.init, n2, "初态"));
    signals.push({ name: "CP", wave: "p".repeat(T), role: "clock" });
    for (const nm of m.inputs) signals.push({ name: nm, wave: (waves.get(nm) ?? "0".repeat(T)).slice(0, T), role: "input" });
    const stateCols = m.ffs.map(() => []);
    const outCols = m.outputs.map(() => []);
    let cur = initK;
    for (let t = 0; t < T; t++) {
      const x = keyOf(m.inputs.map((nm) => bitAt(waves.get(nm), t)));
      const sb = cur === null ? null : bitsOf(cur, n2);
      m.ffs.forEach((_f, i) => stateCols[i].push(sb === null ? "x" : String(sb[i])));
      if (sb === null) {
        outCols.forEach((c) => c.push("x"));
        continue;
      }
      const mv = move(m, sb, bitsOf(x, mi));
      mv.outs.forEach((o, i) => outCols[i].push(String(o)));
      cur = mv.next === null ? null : keyOf(mv.next);
    }
    m.ffs.forEach((f, i) => signals.push({ name: f.name, wave: stateCols[i].join(""), role: "state" }));
    m.outputs.forEach((o, i) => signals.push({ name: o.name, wave: outCols[i].join(""), role: "output" }));
    return { target, steps: T, signals };
  }
  if (target === "counter") {
    if (spec.model === void 0 || spec.method === void 0 || spec.N === void 0) {
      throw new DlogicInputError("counter 波形需要 model、method 与 N。");
    }
    const c = counterDesign(spec.model, spec.method, spec.N);
    const cycle = c.sequence.filter((r) => !r.transient);
    signals.push({ name: "CP", wave: "p".repeat(T), role: "clock" });
    c.bitNames.forEach((name2, bi) => {
      let w = "";
      for (let t = 0; t < T; t++) {
        const row = cycle[t % cycle.length];
        w += row.bits.replace(" ", "")[bi];
      }
      signals.push({ name: name2, wave: w, role: "state" });
    });
    return { target, steps: T, signals };
  }
  if (spec.shiftKind === void 0) throw new DlogicInputError("shift 波形需要 shiftKind。");
  const kind = spec.shiftKind;
  const n = kind === "194" ? 4 : spec.bits ?? 4;
  if (!Number.isInteger(n) || n < 2 || n > 8) throw new DlogicInputError("移位寄存器位数须为 2～8。");
  const defaultInit = kind === "ring" ? "0".repeat(n - 1) + "1" : "0".repeat(n);
  const initStr = spec.init === void 0 || spec.init.trim() === "" ? defaultInit : spec.init.trim();
  let curBits = shiftBits(shiftParse(initStr, n), n);
  signals.push({ name: "CP", wave: "p".repeat(T), role: "clock" });
  if (kind === "194") signals.push({ name: "D", wave: (waves.get("D") ?? "0".repeat(T)).slice(0, T), role: "input" });
  const cols = Array.from({ length: n }, () => []);
  const dir = spec.direction ?? "right";
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < n; i++) cols[i].push(String(curBits[i]));
    curBits = shiftNext(kind, dir, curBits, bitAt(waves.get("D"), t));
  }
  for (let i = n - 1; i >= 0; i--) signals.push({ name: `Q${i}`, wave: cols[i].join(""), role: "state" });
  return { target, steps: T, signals };
}
function cpWave(w, T) {
  return w === void 0 ? "1".repeat(T) : w.slice(0, T);
}

// src/host/tools/seq.logic.ts
var SEQ_OPS = ["ff", "analyze", "counter", "shift", "waveform"];
var FF_KINDS = ["SR", "D", "JK", "T", "SR_LATCH", "GATED_SR", "GATED_D"];
var CLOCKED_KINDS2 = ["SR", "D", "JK", "T"];
var SHIFT_KINDS = ["194", "ring", "johnson"];
var TARGETS = ["ff", "analyze", "counter", "shift"];
var SEQ_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...SEQ_OPS],
    description: "子功能：ff 触发器特性与激励；analyze 同步时序电路分析；counter 160/161/163 模 N 计数器；shift 移位寄存器、环形与扭环计数器；waveform 时序波形。"
  },
  ffKind: {
    type: "string",
    enum: [...FF_KINDS],
    description: "ff 的类型：SR、D、JK、T（边沿触发）；SR_LATCH 基本 SR 锁存器（与非门）；GATED_SR、GATED_D 门控锁存器。waveform 的 target 为 ff 时同样使用。"
  },
  flipflops: {
    type: "array",
    description: "analyze 的触发器（1～4 个），第一个为最高位。变量为 Q 名与外部输入名，例如 Q1、Q0、X。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", required: true, description: 'Q 名，例如 "Q1"。' },
        kind: { type: "string", required: true, enum: CLOCKED_KINDS2, description: "SR、D、JK 或 T。" },
        drives: {
          type: "array",
          required: true,
          description: "各输入端的驱动表达式：SR 为 S、R；D 为 D；JK 为 J、K；T 为 T。",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              pin: { type: "string", required: true, description: "端名。" },
              expr: { type: "string", required: true, description: `驱动表达式，例如 "XQ0 + X'Q0'"。` }
            }
          }
        }
      }
    }
  },
  inputs: {
    type: "array",
    items: { type: "string" },
    description: "analyze 的外部输入名（最多 2 个）。waveform 的 target 为 analyze 时同样使用。"
  },
  outputs: {
    type: "array",
    description: "analyze 的输出，每项 {name, expr}，表达式变量为 Q 名与输入名。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", required: true, description: '输出名，例如 "Y"。' },
        expr: { type: "string", required: true, description: "输出表达式。" }
      }
    }
  },
  init: {
    type: "string",
    description: 'ff：初态 "0" 或 "1"。analyze：初态，按触发器顺序的 0/1 字符串，默认全 0。shift：初态，从 Q(n-1) 写到 Q0；环形默认 "0…01"，扭环与 194 默认全 0。'
  },
  asynchronous: {
    type: "boolean",
    description: "analyze：电路是否为异步（各触发器独立时钟）。异步电路暂不支持，将按同步电路分析并给出说明。"
  },
  model: {
    type: "string",
    enum: ["160", "161", "163"],
    description: "counter 的芯片型号：160 为十进制（异步清零）；161 为四位二进制（异步清零）；163 为四位二进制（同步清零）。"
  },
  method: {
    type: "string",
    enum: ["reset", "preset"],
    description: "counter 的设计方法：reset 清零法（默认）；preset 置数法。"
  },
  N: {
    type: "integer",
    description: "counter 的模 N，2～256；超过一片的模时两片级联（160 两片最大模为 100）。"
  },
  shiftKind: {
    type: "string",
    enum: [...SHIFT_KINDS],
    description: "shift 的类型：194 移位寄存器（4 位）；ring 环形计数器（模 n）；johnson 扭环计数器（模 2n）。"
  },
  bits: {
    type: "integer",
    description: "shift 的位数：194 固定为 4；环形与扭环为 2～8，默认 4。"
  },
  direction: {
    type: "string",
    enum: ["left", "right"],
    description: "194 的移位方向，默认右移。"
  },
  serial: {
    type: "array",
    items: { type: "integer" },
    description: "194 的串行输入序列（0 或 1），每个时钟输入一位。"
  },
  target: {
    type: "string",
    enum: [...TARGETS],
    description: "waveform 的电路类型。其余参数与对应 op 相同（ffKind、flipflops、inputs、outputs、model、method、N、shiftKind、bits、direction、init）。"
  },
  waves: {
    type: "array",
    description: "waveform 的输入波形。每个输入给出由 0 和 1 组成的字符串，每个字符对应一个时钟周期；输入在周期内稳定，周期末的时钟沿更新状态。门控锁存器的 CP 按电平处理。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", required: true, description: '输入名，例如 "J"、"K"、"X"、"CP"。' },
        wave: { type: "string", required: true, description: '由 0 和 1 组成的字符串，例如 "1100"。' }
      }
    }
  },
  steps: {
    type: "integer",
    description: "waveform 的周期数（1～64）。缺省时取输入波形的长度。"
  }
};
function need(v, msg) {
  if (v === void 0) throw new DlogicInputError(msg);
  return v;
}
function bitsOfSerial(serial) {
  if (serial === void 0) return void 0;
  return serial.map((s) => {
    if (s !== 0 && s !== 1) throw new DlogicInputError("串行输入只能是 0 或 1。");
    return s;
  });
}
function waveSpecOf(args) {
  return {
    ffKind: args.ffKind,
    init: args.init,
    flipflops: args.flipflops,
    inputs: args.inputs,
    outputs: args.outputs,
    model: args.model,
    method: args.method,
    N: args.N,
    shiftKind: args.shiftKind,
    bits: args.bits,
    direction: args.direction,
    waves: args.waves,
    steps: args.steps
  };
}
function stepsOf(op, r) {
  switch (op) {
    case "ff": {
      const x = r;
      return [
        { kind: "characteristic", text: `${x.title}：${x.characteristic}${x.constraint ? `，约束 ${x.constraint}` : ""}` },
        { kind: "table", text: `特性表共 ${x.table.length} 行` },
        { kind: "excitation", text: "激励表：由 Qn 与 Qn+1 求各输入，无关项记为 X" }
      ];
    }
    case "analyze": {
      const x = r;
      return [
        ...x.drives.map((d) => ({ kind: "drive", text: `${d.ff} 的 ${d.pin} 端：${d.expr}` })),
        ...x.stateEquations.map((e) => ({ kind: "state_eq", text: `${e.ff}* = ${e.text}` })),
        { kind: "table", text: `状态表共 ${x.table.length} 行，初态 ${x.initial}` },
        { kind: "self_start", text: x.selfStart ? "能够自启动" : "不能自启动" }
      ];
    }
    case "counter": {
      const x = r;
      const steps = [];
      steps.push({ kind: "feedback", text: x.feedback.expr || "无反馈，按芯片自然模计数" });
      steps.push({ kind: "sequence", text: `状态序列共 ${x.sequence.filter((s) => !s.transient).length} 个有效状态` });
      if (x.chips === 2) steps.push({ kind: "cascade", text: "两片级联：低位片的 RCO 接高位片的 ET、EP，两片共用 CP、CR̄ 或 LD̄" });
      return steps;
    }
    case "shift": {
      const x = r;
      return [
        { kind: "feedback", text: x.feedback },
        { kind: "sequence", text: `状态序列共 ${x.sequence.length} 项` },
        ...x.selfStart === null ? [] : [{ kind: "self_start", text: x.selfStart ? "能够自启动" : "不能自启动" }]
      ];
    }
    case "waveform": {
      const x = r;
      return [{ kind: "waveform", text: `共 ${x.steps} 个时钟周期，${x.signals.length} 路信号` }];
    }
  }
}
function warningsOf(op, r, args) {
  const w = [];
  switch (op) {
    case "ff":
      break;
    case "analyze": {
      const x = r;
      if (args.asynchronous === true) {
        w.push("异步电路（各触发器独立时钟）暂不支持，本结果按同步电路（共用时钟）分析，请勿用于异步电路。");
      }
      if (x.table.some((row) => row.next === "×")) {
        w.push("某些状态与输入的组合会进入禁止状态（×），请检查驱动方程或在设计中加以约束。");
      }
      if (!x.selfStart) w.push("存在无法进入有效循环的状态，电路不能自启动。");
      break;
    }
    case "counter": {
      const x = r;
      if (x.glitch) {
        w.push(`异步清零存在过渡态 ${x.transient}：该状态只持续很短时间，输出端可能出现毛刺，不能作为有效状态使用。若需避免，改用 163 同步清零或同步置数。`);
      }
      break;
    }
    case "shift": {
      const x = r;
      if (x.modulus !== null && x.expectedModulus !== null && x.modulus !== x.expectedModulus) {
        w.push(`初态所在循环的模为 ${x.modulus}，与标准模 ${x.expectedModulus} 不同。`);
      }
      if (x.selfStart === false) w.push("存在无效循环，电路不能自启动。");
      break;
    }
    case "waveform": {
      if (!Array.isArray(args.waves) || args.waves.length === 0) {
        w.push("未给出输入波形，输入均按 0 处理。");
      }
      if (args.target === "counter" && (args.model === "161" || args.model === "160") && args.method !== "preset" && args.N !== void 0) {
        const c = counterDesign(args.model, "reset", args.N);
        if (c.glitch) w.push("异步清零的过渡态在波形中未画出，实际电路中会出现毛刺。");
      }
      break;
    }
  }
  return w;
}
function runSeq(args) {
  return envelope(String(args.op), () => {
    switch (args.op) {
      case "ff": {
        const kind = need(args.ffKind, "缺少 ffKind（触发器类型）。");
        const result = ffCharacteristic(kind);
        return { result, steps: stepsOf("ff", result), warnings: [] };
      }
      case "analyze": {
        const flipflops = need(args.flipflops, "analyze 需要 flipflops（触发器列表）。");
        if (flipflops.length === 0) throw new DlogicInputError("analyze 至少需要 1 个触发器。");
        const result = analyzeMachine(flipflops, args.inputs ?? [], args.outputs ?? [], args.init);
        return { result, steps: stepsOf("analyze", result), warnings: warningsOf("analyze", result, args) };
      }
      case "counter": {
        const model = need(args.model, "counter 需要 model（160、161 或 163）。");
        const N = need(args.N, "counter 需要 N（模）。");
        const result = counterDesign(model, args.method ?? "reset", N);
        return { result, steps: stepsOf("counter", result), warnings: warningsOf("counter", result, args) };
      }
      case "shift": {
        const kind = need(args.shiftKind, "shift 需要 shiftKind（194、ring 或 johnson）。");
        const result = shiftDesign(kind, args.bits, args.init, args.direction, bitsOfSerial(args.serial));
        return { result, steps: stepsOf("shift", result), warnings: warningsOf("shift", result, args) };
      }
      case "waveform": {
        const target = need(args.target, "waveform 需要 target（ff、analyze、counter 或 shift）。");
        const result = waveformDesign(target, waveSpecOf(args));
        return { result, steps: stepsOf("waveform", result), warnings: warningsOf("waveform", result, args) };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
var ROW_LIMIT = 32;
function bitText(v) {
  return v === "X" ? "X" : String(v);
}
function renderFf(x) {
  const lines = [`${x.title}`, `特性方程：${x.characteristic}`];
  if (x.constraint) lines.push(`约束条件：${x.constraint}`);
  lines.push(`特性表（${x.inputs.join(" ")} | Qn | Qn+1）：`);
  for (const row of x.table.slice(0, ROW_LIMIT)) {
    const ins = x.inputs.map((p) => String(row.inputs[p])).join(" ");
    lines.push(`  ${ins} | ${row.q} | ${row.next === "X" ? "×（禁止）" : row.next}`);
  }
  lines.push("激励表（Qn → Qn+1 所需输入）：");
  for (const e of x.excitation) {
    const d = Object.entries(e.drive).map(([p, v]) => `${p}=${bitText(v)}`).join("，");
    lines.push(`  ${e.from} → ${e.to}：${d}`);
  }
  return lines;
}
function renderAnalyze2(x) {
  const lines = [];
  lines.push(`状态变量：${x.stateNames.join(" ")}${x.inputNames.length ? `；输入：${x.inputNames.join(" ")}` : ""}`);
  lines.push("驱动方程：");
  for (const d of x.drives) lines.push(`  ${d.ff}.${d.pin} = ${d.expr}`);
  lines.push("状态方程：");
  for (const e of x.stateEquations) lines.push(`  ${e.ff}* = ${e.text}`);
  for (const o of x.outputs) lines.push(`输出 ${o.name} = ${o.expr}（${o.type === "Moore" ? "Moore 型" : "Mealy 型"}）`);
  lines.push(`状态表（现态 ${x.inputNames.length ? "输入 " : ""}次态 输出）：`);
  for (const row of x.table.slice(0, ROW_LIMIT)) {
    const outs = row.outputs.map((o) => `${o.name}=${o.value}`).join(" ");
    lines.push(`  ${row.state}${x.inputNames.length ? " " + row.input : ""} → ${row.next}${outs ? "  " + outs : ""}${row.valid ? "" : "  （无效）"}`);
  }
  if (x.table.length > ROW_LIMIT) lines.push(`  ……共 ${x.table.length} 行`);
  lines.push(`有效状态：${x.validStates.join(", ") || "无"}`);
  lines.push(`自启动：${x.selfStart ? "能" : "不能"}`);
  for (const p of x.invalidPaths.slice(0, 8)) {
    lines.push(`  无效状态 ${p.from} 的流向：${p.path.join(" → ")}${p.reached ? "" : "（无法进入有效状态）"}`);
  }
  lines.push(`状态图：${x.graph.nodes.length} 个节点，${x.graph.edges.length} 条边。`);
  return lines;
}
function renderCounter(x) {
  const lines = [
    `${x.model} 模 ${x.N}（${x.method === "preset" ? "置数法" : "清零法"}，${x.chips === 2 ? "两片级联" : "单片"}）`
  ];
  if (x.feedback.expr) lines.push(`反馈：${x.feedback.expr}（${x.feedback.kind === "async" ? "异步清零" : "同步控制"}）`);
  else lines.push("反馈：无（芯片自然模）");
  if (x.load) lines.push(`预置数据 D = ${x.load.value}（${x.load.bits}）`);
  lines.push(`位名：${x.bitNames.join(" ")}`);
  lines.push("状态序列：");
  for (const r of x.sequence.slice(0, ROW_LIMIT)) {
    lines.push(`  ${r.index}：${r.bits}（十进制 ${r.value}）${r.transient ? "  过渡态" : ""}`);
  }
  if (x.glitch) lines.push(`注意：过渡态 ${x.transient} 会产生毛刺。`);
  return lines;
}
function renderShift(x) {
  const lines = [`${x.kind === "194" ? "194 移位寄存器" : x.kind === "ring" ? "环形计数器" : "扭环计数器"}（${x.bits} 位，初态 ${x.init}）`, `驱动：${x.feedback}`];
  lines.push("状态序列（Q(n-1)…Q0）：");
  for (const s of x.sequence.slice(0, ROW_LIMIT)) lines.push(`  ${s.step}：${s.state}${s.valid ? "" : "  （无效）"}`);
  if (x.modulus !== null) lines.push(`有效循环模 ${x.modulus}`);
  if (x.cycles) {
    for (const c of x.cycles.filter((cy) => !cy.valid)) lines.push(`无效循环：${c.states.join(" → ")}`);
  }
  if (x.selfStart !== null) lines.push(`自启动：${x.selfStart ? "能" : "不能"}`);
  return lines;
}
function renderWave(x) {
  const lines = [`时序波形（${x.steps} 个周期）：`];
  for (const s of x.signals) lines.push(`  ${s.name}: ${s.wave}`);
  return lines;
}
function renderSeq(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const r = value.result;
  let lines;
  switch (value.op) {
    case "ff":
      lines = renderFf(r);
      break;
    case "analyze":
      lines = renderAnalyze2(r);
      break;
    case "counter":
      lines = renderCounter(r);
      break;
    case "shift":
      lines = renderShift(r);
      break;
    case "waveform":
      lines = renderWave(r);
      break;
    default:
      lines = ["（无可显示的结果）"];
  }
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/seq.ts
var DESCRIPTION6 = [
  "时序逻辑的确定性计算引擎。触发器特性方程、特性表与激励表，同步时序电路的分析，160/161/163 计数器设计，",
  "移位寄存器与环形、扭环计数器，以及时序波形，都必须通过本函数计算，不得心算或手写。",
  "op 取值：ff 触发器（ffKind：SR、D、JK、T、SR_LATCH、GATED_SR、GATED_D）；analyze 同步时序电路分析（flipflops、inputs、outputs、init，",
  "驱动表达式的变量为 Q 名与输入名，输出状态方程、状态表、状态图、有效循环、自启动与无效状态流向，最多 4 个触发器、2 个输入）；",
  "counter 模 N 计数器（model、method、N，超过一片时自动两片级联）；shift 移位寄存器与环形、扭环计数器（shiftKind、bits、init、direction、serial）；",
  "waveform 时序波形（target 指定电路类型，其余参数同对应 op，waves 给出输入波形）。",
  "表达式语法：非号用后缀 ' 或前缀 ! ~；与可并列书写或用 * ·；或用 +；异或用 ⊕ 或 ^；同或用 ⊙；括号 ( )。"
].join("");
var dlogicSeq = defineTool7({
  name: "dlogic_seq",
  description: DESCRIPTION6,
  parameters: SEQ_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderSeq(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_seq", value })
  },
  async execute(args) {
    return runSeq(args);
  }
});

// src/host/tools/fsm.ts
import { defineTool as defineTool8 } from "@deepseek-ai/dsh-tools";

// src/solvers/fsm.ts
var MAX_STATES = 16;
var MAX_COMPAT_STATES = 8;
var MAX_BITS = 2;
var MAX_VARS2 = 6;
function isUnspecifiedName(s) {
  return s === "x" || s === "X" || s === "-" || s === "";
}
function normPattern(s) {
  return s.replace(/X/g, "x").replace(/-/g, "x");
}
function bitsOf2(v, width) {
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
    else throw new DlogicInputError(`同一转移的输出相互矛盾：${a} 与 ${b}。`);
  }
  return r;
}
function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}
function validateSpec(spec) {
  if (spec.type !== "mealy" && spec.type !== "moore") throw new DlogicInputError("状态机类型须为 mealy（米利型）或 moore（摩尔型）。");
  if (!Array.isArray(spec.states) || spec.states.length === 0) throw new DlogicInputError("状态列表不能为空。");
  if (spec.states.length > MAX_STATES) {
    throw new DlogicInputError(`状态数最多 ${MAX_STATES} 个，当前为 ${spec.states.length} 个。`);
  }
  const seen = /* @__PURE__ */ new Set();
  for (const s of spec.states) {
    if (typeof s !== "string" || s.trim() === "") throw new DlogicInputError("状态名不能为空。");
    if (isUnspecifiedName(s)) throw new DlogicInputError(`状态名不能为“${s}”（该写法表示未给定）。`);
    if (seen.has(s)) throw new DlogicInputError(`状态名重复：${s}`);
    seen.add(s);
  }
  if (!Number.isInteger(spec.inputs) || spec.inputs < 1 || spec.inputs > MAX_BITS) {
    throw new DlogicInputError("输入位数须为 1～2。");
  }
  if (!Number.isInteger(spec.outputs) || spec.outputs < 1 || spec.outputs > MAX_BITS) {
    throw new DlogicInputError("输出位数须为 1～2。");
  }
  if (!Array.isArray(spec.transitions)) throw new DlogicInputError("transitions 必须是数组。");
  for (const t of spec.transitions) {
    if (!seen.has(t.from)) throw new DlogicInputError(`转移的现态“${t.from}”不在状态列表中。`);
    if (!isUnspecifiedName(t.to) && !seen.has(t.to)) throw new DlogicInputError(`转移的次态“${t.to}”不在状态列表中。`);
    if (typeof t.input !== "string" || !/^[01xX-]+$/.test(t.input) || t.input.length !== spec.inputs) {
      throw new DlogicInputError(`输入“${String(t.input)}”须为 ${spec.inputs} 位的 0/1/x 串。`);
    }
    if (typeof t.output !== "string" || !/^[01xX-]+$/.test(t.output) || t.output.length !== spec.outputs) {
      throw new DlogicInputError(`输出“${String(t.output)}”须为 ${spec.outputs} 位的 0/1/x 串。`);
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
    for (let c = 0; c < combos; c++) {
      if (!matchesPattern(pattern, c, m)) continue;
      if (d >= 0) {
        if (next[s][c] >= 0 && next[s][c] !== d) {
          throw new DlogicInputError(`状态 ${t.from} 在输入 ${bitsOf2(c, m)} 下的次态不唯一。`);
        }
        next[s][c] = d;
      }
      if (spec.type === "mealy") out[s][c] = mergeOut(out[s][c], outPat);
    }
    if (spec.type === "moore") stateOut[s] = mergeOut(stateOut[s], outPat);
  }
  if (spec.type === "moore") {
    for (let s = 0; s < n; s++) for (let c = 0; c < combos; c++) out[s][c] = stateOut[s];
  }
  return { type: spec.type, states: spec.states.slice(), inputs: m, outputs: o, next, out };
}
function isComplete(T) {
  for (let s = 0; s < T.states.length; s++) {
    for (let c = 0; c < 1 << T.inputs; c++) {
      if (T.next[s][c] < 0 || T.out[s][c].includes("x")) return false;
    }
  }
  return true;
}
function rowsToSpec(T, names, rows) {
  return {
    type: T.type,
    states: names,
    inputs: T.inputs,
    outputs: T.outputs,
    transitions: rows.map((r) => ({
      from: names[r.from],
      input: bitsOf2(r.combo, T.inputs),
      to: r.to === null ? "x" : names[r.to],
      output: r.output
    }))
  };
}
function pairKey(n, i, j) {
  return i < j ? i * n + j : j * n + i;
}
function reduceComplete(T) {
  const n = T.states.length;
  const combos = 1 << T.inputs;
  const infos = /* @__PURE__ */ new Map();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let diffCombo = -1;
      for (let c = 0; c < combos && diffCombo < 0; c++) {
        if (T.out[i][c] !== T.out[j][c]) diffCombo = c;
      }
      const info = { i, j, status: "pending", reason: "", implied: [] };
      if (diffCombo >= 0) {
        info.status = "distinct";
        info.reason = `输入 ${bitsOf2(diffCombo, T.inputs)} 下输出不同`;
      } else {
        for (let c = 0; c < combos; c++) {
          const a = T.next[i][c];
          const b = T.next[j][c];
          if (a !== b) info.implied.push({ i: a, j: b, combo: c });
        }
      }
      infos.set(pairKey(n, i, j), info);
    }
  }
  let changed = true;
  while (changed) {
    const marks = [];
    for (const info of infos.values()) {
      if (info.status !== "pending") continue;
      const hit = info.implied.find((q) => infos.get(pairKey(n, q.i, q.j))?.status === "distinct");
      if (hit) {
        info.reason = `次态对 (${T.states[hit.i]}, ${T.states[hit.j]}) 不等价（输入 ${bitsOf2(hit.combo, T.inputs)}）`;
        marks.push(info);
      }
    }
    for (const info of marks) info.status = "distinct";
    changed = marks.length > 0;
  }
  const parent = Array.from({ length: n }, (_, k) => k);
  const find = (x) => parent[x] === x ? x : parent[x] = find(parent[x]);
  const implication = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const info = infos.get(pairKey(n, i, j));
      if (info.status === "pending") {
        info.status = "equivalent";
        info.reason = info.implied.length === 0 ? "输出相同且次态相同" : "输出相同，且各次态对均等价";
        parent[find(i)] = find(j);
      }
      implication.push({
        a: T.states[i],
        b: T.states[j],
        status: info.status === "equivalent" ? "equivalent" : "distinct",
        reason: info.reason,
        implied: info.implied.map((q) => ({ a: T.states[q.i], b: T.states[q.j], input: bitsOf2(q.combo, T.inputs) }))
      });
    }
  }
  const groups = /* @__PURE__ */ new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)?.push(i);
  }
  const classes = [...groups.values()].sort((x, y) => x[0] - y[0]);
  const classOf = new Array(n).fill(-1);
  classes.forEach((cls, k) => cls.forEach((i) => classOf[i] = k));
  const names = classes.map((cls) => T.states[cls[0]]);
  const rows = [];
  classes.forEach((cls, k) => {
    const rep = cls[0];
    for (let c = 0; c < combos; c++) {
      rows.push({ from: k, to: classOf[T.next[rep][c]], combo: c, output: T.out[rep][c] });
    }
  });
  return {
    complete: true,
    method: "implication",
    implication,
    classes: classes.map((cls) => cls.map((i) => T.states[i])),
    stateMap: T.states.map((s, i) => ({ state: s, groups: [names[classOf[i]]] })),
    reduced: rowsToSpec(T, names, rows),
    reducedCount: classes.length
  };
}
function maximalCliques(n, adj) {
  const result = [];
  const expand = (R, P0, X0) => {
    if (P0.length === 0 && X0.length === 0) {
      result.push(R.slice().sort((a, b) => a - b));
      return;
    }
    let P = P0.slice();
    const X = X0.slice();
    for (const v of P0) {
      expand([...R, v], P.filter((u) => adj[v][u]), X.filter((u) => adj[v][u]));
      P = P.filter((u) => u !== v);
      X.push(v);
    }
  };
  expand([], Array.from({ length: n }, (_, k) => k), []);
  return result;
}
function reduceIncomplete(T) {
  const n = T.states.length;
  if (n > MAX_COMPAT_STATES) {
    throw new DlogicInputError(`不完全给定的状态化简最多支持 ${MAX_COMPAT_STATES} 个状态，当前为 ${n} 个。`);
  }
  const combos = 1 << T.inputs;
  const incompat = Array.from({ length: n }, () => new Array(n).fill(false));
  const outConflict = (i, j) => {
    for (let c = 0; c < combos; c++) {
      for (let b = 0; b < T.outputs; b++) {
        const x = T.out[i][c][b];
        const y = T.out[j][c][b];
        if (x !== "x" && y !== "x" && x !== y) return true;
      }
    }
    return false;
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (outConflict(i, j)) incompat[i][j] = incompat[j][i] = true;
    }
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (incompat[i][j]) continue;
        for (let c = 0; c < combos; c++) {
          const a = T.next[i][c];
          const b = T.next[j][c];
          if (a >= 0 && b >= 0 && a !== b && incompat[a][b]) {
            incompat[i][j] = incompat[j][i] = true;
            changed = true;
            break;
          }
        }
      }
    }
  }
  const adj = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_2, j) => i !== j && !incompat[i][j]));
  const cliques = maximalCliques(n, adj);
  const implied = cliques.map((cl) => {
    const sets = [];
    for (let c = 0; c < combos; c++) {
      const set = /* @__PURE__ */ new Set();
      for (const i of cl) if (T.next[i][c] >= 0) set.add(T.next[i][c]);
      sets.push([...set].sort((a, b) => a - b));
    }
    return sets;
  });
  const contains = (big, small) => small.every((v) => big.includes(v));
  const isClosedCover = (F) => F.every((ci) => implied[ci].every((S) => S.length === 0 || F.some((di) => contains(cliques[di], S))));
  const coversAll = (F) => {
    const seen = /* @__PURE__ */ new Set();
    for (const ci of F) for (const s of cliques[ci]) seen.add(s);
    return seen.size === n;
  };
  let cover = [];
  const search = (start, k, picked) => {
    if (picked.length === k) {
      if (coversAll(picked) && isClosedCover(picked)) {
        cover = picked.slice();
        return true;
      }
      return false;
    }
    for (let ci = start; ci < cliques.length; ci++) {
      if (search(ci + 1, k, [...picked, ci])) return true;
    }
    return false;
  };
  for (let k = 1; k <= cliques.length && cover.length === 0; k++) search(0, k, []);
  if (cover.length === 0) throw new DlogicInputError("未能求得闭覆盖。");
  cover.sort((a, b) => a - b);
  const coverSets2 = cover.map((ci) => cliques[ci]);
  const nameOf = (cls) => cls.length === 1 ? T.states[cls[0]] : `{${cls.map((i) => T.states[i]).join(",")}}`;
  const names = coverSets2.map(nameOf);
  const rows = [];
  cover.forEach((ci, k) => {
    for (let c = 0; c < combos; c++) {
      const S = implied[ci][c];
      const dest = S.length === 0 ? null : coverSets2.findIndex((cls) => contains(cls, S));
      const outs = [];
      for (let b = 0; b < T.outputs; b++) {
        const vals = cliques[ci].map((i) => T.out[i][c][b]);
        outs.push(vals.includes("1") ? "1" : vals.includes("0") ? "0" : "x");
      }
      const output = outs.join("");
      if (dest === null && output.split("").every((ch) => ch === "x")) continue;
      rows.push({ from: k, to: dest, combo: c, output });
    }
  });
  return {
    complete: false,
    method: "compatible",
    classes: cliques.map((cl) => cl.map((i) => T.states[i])),
    cover: coverSets2.map((cls) => cls.map((i) => T.states[i])),
    stateMap: T.states.map((s, i) => ({
      state: s,
      groups: coverSets2.flatMap((cls, k) => cls.includes(i) ? [names[k]] : [])
    })),
    reduced: rowsToSpec(T, names, rows),
    reducedCount: coverSets2.length
  };
}
function reduceFsm(spec) {
  const T = buildTable(spec);
  return isComplete(T) ? reduceComplete(T) : reduceIncomplete(T);
}
function adjacencyPairs(T) {
  const n = T.states.length;
  const combos = 1 << T.inputs;
  const rules = /* @__PURE__ */ new Map();
  const add = (i, j, rule) => {
    if (i < 0 || j < 0 || i === j) return;
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const key = `${a},${b}`;
    if (!rules.has(key)) rules.set(key, { i: a, j: b, rules: /* @__PURE__ */ new Set() });
    rules.get(key)?.rules.add(rule);
  };
  for (let s = 0; s < n; s++) {
    for (let c1 = 0; c1 < combos; c1++) {
      for (let c2 = c1 + 1; c2 < combos; c2++) add(T.next[s][c1], T.next[s][c2], 1);
    }
  }
  for (let c = 0; c < combos; c++) {
    for (let s1 = 0; s1 < n; s1++) {
      for (let s2 = s1 + 1; s2 < n; s2++) {
        const d = T.next[s1][c];
        if (d >= 0 && d === T.next[s2][c]) add(s1, s2, 2);
      }
    }
  }
  return [...rules.values()].sort((x, y) => x.i - y.i || x.j - y.j).map((p) => ({ a: T.states[p.i], b: T.states[p.j], rules: [...p.rules].sort((x, y) => x - y) }));
}
function bitsFor(n) {
  let k = 1;
  while (1 << k < n) k++;
  return k;
}
function standardCodes(n, kind) {
  if (kind === "onehot") return Array.from({ length: n }, (_, i) => "0".repeat(i) + "1" + "0".repeat(n - 1 - i));
  const k = bitsFor(n);
  if (kind === "binary") return Array.from({ length: n }, (_, i) => bitsOf2(i, k));
  return Array.from({ length: n }, (_, i) => bitsOf2(i ^ i >> 1, k));
}
function customCodes(T, custom) {
  const codes = [];
  for (const s of T.states) {
    const code = custom[s];
    if (typeof code !== "string" || !/^[01]+$/.test(code)) throw new DlogicInputError(`状态 ${s} 的编码须为 0/1 串。`);
    codes.push(code);
  }
  const width = codes[0].length;
  if (codes.some((c) => c.length !== width)) throw new DlogicInputError("自定义编码的位数必须相同。");
  if (new Set(codes).size !== codes.length) throw new DlogicInputError("自定义编码互不相同。");
  return codes;
}
function assignStates(spec, custom) {
  const T = buildTable(spec);
  const pairs = adjacencyPairs(T);
  const idxOf = new Map(T.states.map((s, i) => [s, i]));
  const make = (kind, codes) => {
    let total = 0;
    let satisfied = 0;
    for (const p of pairs) {
      const d = hamming(codes[idxOf.get(p.a)], codes[idxOf.get(p.b)]);
      total += d;
      if (d === 1) satisfied++;
    }
    return {
      kind,
      bits: codes[0].length,
      codes: T.states.map((state, i) => ({ state, code: codes[i] })),
      score: total,
      satisfied,
      total: pairs.length
    };
  };
  const encodings = [
    make("binary", standardCodes(T.states.length, "binary")),
    make("gray", standardCodes(T.states.length, "gray")),
    make("onehot", standardCodes(T.states.length, "onehot"))
  ];
  if (custom) encodings.push(make("custom", customCodes(T, custom)));
  let best = encodings[0];
  for (const e of encodings) if (e.score < best.score) best = e;
  return { pairs, encodings, best: best.kind };
}
function resolveCodes(T, encoding, custom) {
  if (encoding === "custom") {
    if (!custom) throw new DlogicInputError("选择自定义编码时必须提供 codes。");
    return { kind: "custom", codes: customCodes(T, custom) };
  }
  return { kind: encoding, codes: standardCodes(T.states.length, encoding) };
}
function makeCore(T, ff, kind, codes) {
  const k = codes[0].length;
  if (k + T.inputs > MAX_VARS2) {
    throw new DlogicInputError(
      `状态寄存器 ${k} 位加输入 ${T.inputs} 位共 ${k + T.inputs} 个变量，超过化简上限 ${MAX_VARS2} 个；请减少状态数或改用二进制/格雷编码。`
    );
  }
  const stateBits = Array.from({ length: k }, (_, p) => k === 1 ? "Q" : `Q${k - 1 - p}`);
  const inputNames = Array.from({ length: T.inputs }, (_, t) => T.inputs === 1 ? "X" : `X${T.inputs - 1 - t}`);
  const outputNames = Array.from({ length: T.outputs }, (_, j) => T.outputs === 1 ? "Z" : `Z${T.outputs - 1 - j}`);
  const suffix = (p) => stateBits[p].slice(1);
  const ffNames = stateBits.map((_, p) => {
    if (ff === "D") return [`D${suffix(p)}`];
    if (ff === "T") return [`T${suffix(p)}`];
    return [`J${suffix(p)}`, `K${suffix(p)}`];
  });
  const stateOfCode = /* @__PURE__ */ new Map();
  codes.forEach((c, i) => stateOfCode.set(parseInt(c, 2), i));
  return {
    T,
    ff,
    kind,
    k,
    codes,
    stateOfCode,
    stateBits,
    inputNames,
    outputNames,
    ffNames,
    excitationNames: ffNames.flat()
  };
}
function excitationBit(ff, cur, nb) {
  if (nb === null) return ["x", "x"];
  if (ff === "D") return [nb, "x"];
  if (ff === "T") return [cur === nb ? "0" : "1", "x"];
  if (cur === "0") return nb === "0" ? ["0", "x"] : ["1", "x"];
  return nb === "0" ? ["x", "1"] : ["x", "0"];
}
function buildRows(core, overrides) {
  const { T, k, codes } = core;
  const m = T.inputs;
  const o = T.outputs;
  const combos = 1 << m;
  const rows = [];
  for (let cv = 0; cv < 1 << k; cv++) {
    const s = core.stateOfCode.get(cv);
    const code = bitsOf2(cv, k);
    for (let c = 0; c < combos; c++) {
      let nextState = -1;
      let output = "x".repeat(o);
      if (s !== void 0) {
        nextState = T.next[s][c];
        output = T.out[s][c];
      } else if (overrides.has(cv)) {
        nextState = overrides.get(cv);
      }
      const nextCode = nextState >= 0 ? codes[nextState] : null;
      const excitation = {};
      for (let p = 0; p < k; p++) {
        const [first, second] = excitationBit(core.ff, code[p], nextCode === null ? null : nextCode[p]);
        excitation[core.ffNames[p][0]] = first;
        if (core.ff === "JK") excitation[core.ffNames[p][1]] = second;
      }
      rows.push({
        code,
        state: s === void 0 ? null : T.states[s],
        input: bitsOf2(c, m),
        next: nextState >= 0 ? T.states[nextState] : null,
        nextCode,
        output,
        excitation
      });
    }
  }
  return rows;
}
function solveFunctions(core, rows) {
  const combos = 1 << core.T.inputs;
  const implicants = /* @__PURE__ */ new Map();
  const functions = [];
  const solve2 = (name2, role, variables, minterms, dontCares) => {
    const r = minimize({ variables, minterms, dontCares }, "SOP");
    const first = r.solutions[0] ?? [];
    implicants.set(name2, first);
    functions.push({
      name: name2,
      role,
      variables,
      minterms,
      dontCares,
      text: r.texts[0] ?? "0",
      texts: r.texts,
      latex: r.latex,
      cost: r.cost,
      implicants: first
    });
  };
  const vars = [...core.stateBits, ...core.inputNames];
  for (const name2 of core.excitationNames) {
    const minterms = [];
    const dontCares = [];
    rows.forEach((row, idx) => {
      const v = row.excitation[name2];
      if (v === "1") minterms.push(idx);
      else if (v === "x") dontCares.push(idx);
    });
    solve2(name2, "excitation", vars, minterms, dontCares);
  }
  const T = core.T;
  for (let j = 0; j < T.outputs; j++) {
    const minterms = [];
    const dontCares = [];
    if (T.type === "mealy") {
      rows.forEach((row, idx) => {
        const v = row.output[j];
        if (v === "1") minterms.push(idx);
        else if (v === "x") dontCares.push(idx);
      });
      solve2(core.outputNames[j], "output", vars, minterms, dontCares);
    } else {
      for (let cv = 0; cv < 1 << core.k; cv++) {
        const v = rows[cv * combos].output[j];
        if (v === "1") minterms.push(cv);
        else if (v === "x") dontCares.push(cv);
      }
      solve2(core.outputNames[j], "output", core.stateBits, minterms, dontCares);
    }
  }
  return { implicants, functions };
}
function evalCover(imps, bits) {
  const hit = imps.some((imp) => {
    for (let j = 0; j < imp.mask.length; j++) {
      const ch = imp.mask[j];
      if (ch !== "-" && Number(ch) !== bits[j]) return false;
    }
    return true;
  });
  return hit ? 1 : 0;
}
function runSynth(T, ff, encoding, custom, overrides) {
  const { kind, codes } = resolveCodes(T, encoding, custom);
  const core = makeCore(T, ff, kind, codes);
  const rows = buildRows(core, overrides);
  const solved2 = solveFunctions(core, rows);
  const result = {
    ff,
    encoding: kind,
    codes: T.states.map((state, i) => ({ state, code: codes[i] })),
    stateBits: core.stateBits,
    inputNames: core.inputNames,
    outputNames: core.outputNames,
    excitationNames: core.excitationNames,
    table: rows,
    functions: solved2.functions
  };
  return { core, solved: solved2, result };
}
function checkFf(ff) {
  if (ff !== "D" && ff !== "JK" && ff !== "T") throw new DlogicInputError("触发器类型须为 D、JK 或 T。");
}
function synthesize(spec, ff, encoding, custom) {
  checkFf(ff);
  const T = buildTable(spec);
  return runSynth(T, ff, encoding, custom, /* @__PURE__ */ new Map()).result;
}
function nextCodeValue(run, cv, c) {
  const { core, solved: solved2 } = run;
  const k = core.k;
  const m = core.T.inputs;
  const bits = [];
  for (let j = 0; j < k; j++) bits.push(cv >> k - 1 - j & 1);
  for (let t = 0; t < m; t++) bits.push(c >> m - 1 - t & 1);
  const evalName = (name2) => evalCover(solved2.implicants.get(name2) ?? [], bits);
  let nv = 0;
  for (let p = 0; p < k; p++) {
    const cur = cv >> k - 1 - p & 1;
    let nb;
    if (core.ff === "D") nb = evalName(core.ffNames[p][0]);
    else if (core.ff === "T") nb = cur ^ evalName(core.ffNames[p][0]);
    else {
      const J = evalName(core.ffNames[p][0]);
      const K = evalName(core.ffNames[p][1]);
      nb = J === 1 && cur === 0 || K === 0 && cur === 1 ? 1 : 0;
    }
    nv |= nb << k - 1 - p;
  }
  return nv;
}
function checkSelfStart(run) {
  const { core } = run;
  const k = core.k;
  const m = core.T.inputs;
  const checks = [];
  for (let cv = 0; cv < 1 << k; cv++) {
    if (core.stateOfCode.has(cv)) continue;
    for (let c = 0; c < 1 << m; c++) {
      const trace = [bitsOf2(cv, k)];
      const seen = /* @__PURE__ */ new Set([cv]);
      let cur = cv;
      let ok = false;
      for (; ; ) {
        const nv = nextCodeValue(run, cur, c);
        trace.push(bitsOf2(nv, k));
        if (core.stateOfCode.has(nv)) {
          ok = true;
          break;
        }
        if (seen.has(nv)) break;
        seen.add(nv);
        cur = nv;
      }
      checks.push({ code: bitsOf2(cv, k), input: bitsOf2(c, m), trace, ok });
    }
  }
  return checks;
}
function nearestState(core, cv) {
  let best = 0;
  let bestD = Infinity;
  core.codes.forEach((code, i) => {
    const d = hamming(bitsOf2(cv, core.k), code);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
function selfStart(spec, ff, encoding, custom) {
  checkFf(ff);
  const T = buildTable(spec);
  const base = runSynth(T, ff, encoding, custom, /* @__PURE__ */ new Map());
  const checks = checkSelfStart(base);
  if (checks.every((ch) => ch.ok)) {
    return { selfStarting: true, checks, fixed: false, rewritten: [], after: checks, synthesis: base.result };
  }
  const unused = [];
  for (let cv = 0; cv < 1 << base.core.k; cv++) if (!base.core.stateOfCode.has(cv)) unused.push(cv);
  const failing = [...new Set(checks.filter((ch) => !ch.ok).map((ch) => parseInt(ch.code, 2)))].sort((a, b) => a - b);
  const overridesFor = (list) => new Map(list.map((cv) => [cv, nearestState(base.core, cv)]));
  let used = failing;
  let run = runSynth(T, ff, encoding, custom, overridesFor(used));
  let after = checkSelfStart(run);
  if (!after.every((ch) => ch.ok)) {
    used = unused;
    run = runSynth(T, ff, encoding, custom, overridesFor(used));
    after = checkSelfStart(run);
  }
  return {
    selfStarting: false,
    checks,
    fixed: after.every((ch) => ch.ok),
    rewritten: used.map((cv) => ({ code: bitsOf2(cv, base.core.k), to: T.states[nearestState(base.core, cv)] })),
    after,
    synthesis: run.result
  };
}

// src/host/tools/fsm.logic.ts
var FSM_OPS = ["reduce", "assign", "synthesize", "self_start"];
var FSM_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...FSM_OPS],
    description: "子功能：reduce 状态化简；assign 状态编码评分；synthesize 激励与输出函数综合；self_start 自启动检查与修正"
  },
  type: {
    type: "string",
    required: true,
    enum: ["mealy", "moore"],
    description: "状态机类型：mealy（米利型，输出由现态与输入决定）或 moore（摩尔型，输出只由现态决定）"
  },
  states: {
    type: "array",
    required: true,
    items: { type: "string" },
    description: "状态名列表（至多 16 个）。顺序即编码分配的顺序。"
  },
  inputs: {
    type: "integer",
    required: true,
    description: "输入位数，1～2"
  },
  outputs: {
    type: "integer",
    required: true,
    description: "输出位数，1～2"
  },
  transitions: {
    type: "array",
    required: true,
    description: "状态转移表。每项为 {from 现态, input 输入（位数与 inputs 相同的 0/1/x 串）, to 次态（不确定写 x）, output 输出（位数与 outputs 相同的 0/1/x 串）}。省略的 (现态, 输入) 组合视为未给定。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", required: true, description: "现态" },
        input: { type: "string", required: true, description: '输入，例如 "1"、"0x"' },
        to: { type: "string", required: true, description: '次态，未给定时写 "x"' },
        output: { type: "string", required: true, description: '输出，例如 "1"、"x"' }
      }
    }
  },
  ff: {
    type: "string",
    enum: ["D", "JK", "T"],
    description: "synthesize / self_start 使用的触发器类型，默认 D"
  },
  encoding: {
    type: "string",
    enum: ["binary", "gray", "onehot", "custom"],
    description: "synthesize / self_start 的编码方式，默认 binary；custom 时必须提供 codes"
  },
  codes: {
    type: "array",
    description: "自定义状态编码，每项 {state 状态名, code 0/1 串}；用于 assign（评分）或 encoding 为 custom 时。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        state: { type: "string", required: true, description: "状态名" },
        code: { type: "string", required: true, description: "0/1 编码串" }
      }
    }
  }
};
function specFromFsmArgs(args) {
  return {
    type: args.type,
    states: args.states,
    inputs: args.inputs,
    outputs: args.outputs,
    transitions: args.transitions
  };
}
function customOf(args) {
  if (!Array.isArray(args.codes)) return void 0;
  const map = {};
  for (const item of args.codes) {
    if (typeof item?.state !== "string" || typeof item?.code !== "string") {
      throw new DlogicInputError("codes 的每项须包含 state 与 code。");
    }
    map[item.state] = item.code;
  }
  return map;
}
function encodingOf(args) {
  if (args.encoding) return args.encoding;
  return customOf(args) ? "custom" : "binary";
}
function reduceSteps(r) {
  if (r.complete) {
    return [
      {
        kind: "implication",
        text: "完全给定：列隐含表，输出不同的状态对直接标为不等价，其余状态对逐轮按次态对的结论标记，最后未标记的状态对即为等价。"
      }
    ];
  }
  return [
    {
      kind: "compatible",
      text: "不完全给定：输出不冲突且次态对相容的状态对为相容对，求出最大相容类，再选取满足闭合条件的最小闭覆盖。"
    }
  ];
}
function runFsm(args) {
  return envelope(String(args.op), () => {
    const spec = specFromFsmArgs(args);
    switch (args.op) {
      case "reduce": {
        const reduce2 = reduceFsm(spec);
        return { result: { spec, reduce: reduce2 }, steps: reduceSteps(reduce2) };
      }
      case "assign": {
        const assign = assignStates(spec, customOf(args));
        return {
          result: { spec, assign },
          steps: [
            {
              kind: "adjacency",
              text: "相邻编码原则：规则 1 为同一现态在不同输入下的两个次态，规则 2 为同一输入下有相同次态的两个现态；评分为这些相邻对的汉明距离之和，越小越好。"
            }
          ]
        };
      }
      case "synthesize": {
        const ff = args.ff ?? "D";
        const synthesis = synthesize(spec, ff, encodingOf(args), customOf(args));
        return {
          result: { spec, synthesis },
          steps: [{ kind: "excitation", text: `按 ${ff} 触发器列激励表，化简各激励函数与输出函数；未使用的编码与未给定的项作为无关项。` }]
        };
      }
      case "self_start": {
        const ff = args.ff ?? "D";
        const selfStartResult = selfStart(spec, ff, encodingOf(args), customOf(args));
        return {
          result: { spec, selfStart: selfStartResult },
          steps: [{ kind: "selfStart", text: "自启动检查：保持输入为某一固定组合，从每个无效编码出发，沿次态应能进入有效编码。" }]
        };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
function codesLine(codes) {
  return codes.map((c) => `${c.state}=${c.code}`).join("，");
}
function renderSynth(s, lines) {
  lines.push(`编码：${codesLine(s.codes)}`);
  for (const f of s.functions) {
    const more = f.texts.length > 1 ? `（共 ${f.texts.length} 个等价最简解：${f.texts.join("；")}）` : "";
    lines.push(`${f.name} = ${f.text}${more}`);
  }
}
function renderReduce(r, lines) {
  if (r.complete) {
    lines.push(`完全给定，等价类：${r.classes.map((c) => c.length > 1 ? `{${c.join(",")}}` : c[0]).join("，")}`);
  } else {
    lines.push(`不完全给定，最大相容类：${r.classes.map((c) => `{${c.join(",")}}`).join("，")}`);
    lines.push(`最小闭覆盖：${(r.cover ?? []).map((c) => `{${c.join(",")}}`).join("，")}`);
  }
  lines.push(`化简后 ${r.reducedCount} 个状态`);
  for (const t of r.reduced.transitions) lines.push(`  ${t.from} 输入 ${t.input} → ${t.to} 输出 ${t.output}`);
}
function renderSelfStart(r, lines) {
  lines.push(r.selfStarting ? "自启动：能" : "自启动：不能");
  if (!r.selfStarting) {
    for (const row of r.rewritten) lines.push(`  无效编码 ${row.code} 的次态改为 ${row.to}`);
    lines.push(r.fixed ? "修正后自启动：能" : "修正后自启动：仍不能");
    renderSynth(r.synthesis, lines);
  }
}
function renderFsm(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  const r = value.result;
  switch (value.op) {
    case "reduce":
      renderReduce(r.reduce, lines);
      break;
    case "assign": {
      const a = r.assign;
      lines.push(`相邻对：${a.pairs.map((p) => `${p.a}-${p.b}`).join("，") || "无"}`);
      for (const e of a.encodings) {
        lines.push(`${e.kind}（${e.bits} 位）：${codesLine(e.codes)}；评分 ${e.score}，相邻对满足 ${e.satisfied}/${e.total}`);
      }
      lines.push(`评分最小：${a.best}`);
      break;
    }
    case "synthesize":
      renderSynth(r.synthesis, lines);
      break;
    case "self_start":
      renderSelfStart(r.selfStart, lines);
      break;
    default:
      lines.push("未知的 op");
  }
  return lines.join("\n");
}

// src/host/tools/fsm.ts
var DESCRIPTION7 = [
  "同步时序状态机的确定性计算引擎。状态化简、状态编码、激励与输出函数综合、自启动检查均以计算结果为准，不得心算。",
  "op 取值：reduce 状态化简（完全给定用隐含表，不完全给定用相容类与最小闭覆盖）；",
  "assign 状态编码（二进制、格雷、独热，并按相邻编码原则评分）；",
  "synthesize 按 D/JK/T 触发器生成激励表与各激励、输出函数的最简表达式（全部等价解）；",
  "self_start 检查无效编码能否进入有效循环，不能时改写无关项取值并重新化简。",
  "状态机以 JSON 描述：type（mealy 或 moore）、states（状态名，至多 16 个）、inputs 与 outputs（位数，至多 2）、",
  "transitions（每项 {from, input, to, output}，input 与 output 为 0/1/x 串，to 写 x 表示次态未给定，省略的组合视为未给定）。"
].join("");
var dlogicFsm = defineTool8({
  name: "dlogic_fsm",
  description: DESCRIPTION7,
  parameters: FSM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderFsm(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_fsm", value })
  },
  async execute(args) {
    return runFsm(args);
  }
});

// src/host/tools/mem.ts
import { defineTool as defineTool9 } from "@deepseek-ai/dsh-tools";

// src/solvers/mem.ts
var NAME_RE3 = /^[A-Za-z][A-Za-z0-9_]*$/;
var MAX_FUNC_VARS2 = 6;
var MAX_OUTPUTS = 8;
var MAX_TERMS = 64;
var MAX_WORDS = 1 << 20;
var MAX_BITS2 = 64;
var MAX_CHIPS = 128;
var MAX_SELECT_GROUPS = 8;
var MAX_PAL_TERMS = 8;
var PICK_CAP = 512;
function range2(n) {
  return Array.from({ length: n }, (_, i) => i);
}
function isPow2(x) {
  return Number.isInteger(x) && x >= 2 && (x & x - 1) === 0;
}
function log2(x) {
  let n = 0;
  while (1 << n < x) n++;
  return n;
}
function hexText(v, digits) {
  return v.toString(16).toUpperCase().padStart(digits, "0");
}
function binText(v, n) {
  return n === 0 ? "" : v.toString(2).padStart(n, "0");
}
function checkVariables(variables, max, allowEmpty) {
  if (!Array.isArray(variables)) throw new DlogicInputError("需要提供 variables（变量名列表，variables[0] 为最高位）。");
  if (variables.length === 0 && !allowEmpty) throw new DlogicInputError("变量至少需要一个。");
  if (variables.length > max) throw new DlogicInputError(`最多支持 ${max} 个变量，当前为 ${variables.length} 个。`);
  const seen = /* @__PURE__ */ new Set();
  for (const v of variables) {
    if (typeof v !== "string" || !NAME_RE3.test(v)) {
      throw new DlogicInputError(`变量“${String(v)}”不合法：变量名应以字母开头，只含字母、数字与下划线。`);
    }
    if (seen.has(v)) throw new DlogicInputError(`变量“${v}”重复。`);
    seen.add(v);
  }
  return variables.slice();
}
function normList(list, total, label) {
  if (list === void 0) return [];
  if (!Array.isArray(list)) throw new DlogicInputError(`${label}应为整数数组。`);
  const set = /* @__PURE__ */ new Set();
  for (const m of list) {
    if (!Number.isInteger(m)) throw new DlogicInputError(`${label}中含有非整数：${String(m)}。`);
    if (m < 0 || m >= total) throw new DlogicInputError(`${label}编号 ${m} 超出范围（0～${total - 1}）。`);
    set.add(m);
  }
  return [...set].sort((a, b) => a - b);
}
function specFromRequest(req, vars, allowEmptyVars, label) {
  let spec;
  if (typeof req.expr === "string" && req.expr.trim() !== "") {
    const base = specFromExpr(req.expr, vars === void 0 ? void 0 : vars);
    spec = {
      variables: base.variables,
      minterms: base.minterms,
      dontCares: normList(req.dontCares, 1 << base.variables.length, "无关项")
    };
  } else if (Array.isArray(req.minterms)) {
    const v = checkVariables(vars, MAX_FUNC_VARS2, allowEmptyVars);
    const total = 1 << v.length;
    spec = {
      variables: v,
      minterms: normList(req.minterms, total, "最小项"),
      dontCares: normList(req.dontCares, total, "无关项")
    };
  } else {
    throw new DlogicInputError(`${label}缺少函数：请提供 expr，或同时提供 minterms 与 variables。`);
  }
  if (spec.minterms.some((m) => spec.dontCares.includes(m))) {
    throw new DlogicInputError(`${label}同一编号不能同时是最小项与无关项。`);
  }
  return spec;
}
function specText2(spec) {
  let s = `F(${spec.variables.join(",")}) = Σm(${spec.minterms.join(",")})`;
  if (spec.dontCares.length) s += ` + Σd(${spec.dontCares.join(",")})`;
  return s;
}
function specLatex2(spec) {
  let s = `F(${spec.variables.join(",")}) = \\sum m(${spec.minterms.join(",")})`;
  if (spec.dontCares.length) s += ` + \\sum d(${spec.dontCares.join(",")})`;
  return s;
}
function outputSpecs(vars, outputs, label) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    throw new DlogicInputError(`${label} 至少需要一个输出函数（outputs）。`);
  }
  if (outputs.length > MAX_OUTPUTS) {
    throw new DlogicInputError(`输出函数最多 ${MAX_OUTPUTS} 个，当前为 ${outputs.length} 个。`);
  }
  const names = [];
  const specs = [];
  let hasDontCare = false;
  outputs.forEach((o, i) => {
    const name2 = typeof o?.name === "string" && o.name !== "" ? o.name : `F${i + 1}`;
    if (!NAME_RE3.test(name2)) throw new DlogicInputError(`输出名“${name2}”不合法：应以字母开头，只含字母、数字与下划线。`);
    if (names.includes(name2)) throw new DlogicInputError(`输出名“${name2}”重复。`);
    const spec = specFromRequest(o, vars, false, `输出 ${name2} `);
    if (spec.dontCares.length) hasDontCare = true;
    names.push(name2);
    specs.push(spec);
  });
  return { names, specs, hasDontCare };
}
function decodeInfo(n, mode, rowBits) {
  if (mode !== "single" && mode !== "double") {
    throw new DlogicInputError("译码方式应为 single（单译码）或 double（双译码）。");
  }
  if (n < 1) throw new DlogicInputError("地址线为 0 位，无需译码。");
  if (mode === "single") {
    return {
      mode: "single",
      addressBits: n,
      rowBits: n,
      colBits: 0,
      rows: 1 << n,
      cols: 1,
      decoderLines: 1 << n,
      cellsPerBit: 1 << n,
      note: `单译码：${n} 位地址直接译码为 ${1 << n} 根字线，每根字线选中一个字。`
    };
  }
  if (n < 2) throw new DlogicInputError("双译码至少需要 2 位地址线。");
  const r = rowBits ?? Math.floor(n / 2);
  if (!Number.isInteger(r) || r < 1 || r > n - 1) {
    throw new DlogicInputError(`行译码位数应为 1 到 ${n - 1} 之间的整数，当前为 ${String(rowBits)}。`);
  }
  const c = n - r;
  return {
    mode: "double",
    addressBits: n,
    rowBits: r,
    colBits: c,
    rows: 1 << r,
    cols: 1 << c,
    decoderLines: (1 << r) + (1 << c),
    cellsPerBit: 1 << n,
    note: `双译码：高 ${r} 位译出 ${1 << r} 根行线，低 ${c} 位译出 ${1 << c} 根列线；每位存储单元排成 ${1 << r} 行 × ${1 << c} 列，行线与列线交点选中一个单元。`
  };
}
function expandMemory(req) {
  const W = req.targetWords;
  const B = req.targetBits;
  const w = req.chipWords;
  const b = req.chipBits;
  if (!isPow2(W) || W > MAX_WORDS) {
    throw new DlogicInputError(`目标字数应为不小于 2 的 2 的幂，且不超过 ${MAX_WORDS}，当前为 ${String(W)}。`);
  }
  if (!isPow2(w)) throw new DlogicInputError(`芯片字数应为不小于 2 的 2 的幂，当前为 ${String(w)}。`);
  if (w > W) throw new DlogicInputError(`芯片字数 ${w} 大于目标字数 ${W}，无法用此芯片组成目标存储器。`);
  if (!Number.isInteger(B) || B < 1 || B > MAX_BITS2) {
    throw new DlogicInputError(`目标位数应为 1 到 ${MAX_BITS2} 之间的整数，当前为 ${String(B)}。`);
  }
  if (!Number.isInteger(b) || b < 1 || b > B) {
    throw new DlogicInputError(`芯片位数应为 1 到 ${B} 之间的整数，当前为 ${String(b)}。`);
  }
  if (B % b !== 0) throw new DlogicInputError(`目标位数 ${B} 不是芯片位数 ${b} 的整数倍，无法按位扩展。`);
  const kw = W / w;
  const kb = B / b;
  if (kw === 1 && kb === 1) throw new DlogicInputError("芯片规格与目标容量相同，无需扩展。");
  if (kw > MAX_SELECT_GROUPS) {
    throw new DlogicInputError(
      `字向需要 ${kw} 组芯片，超过 ${MAX_SELECT_GROUPS} 组：一片 74LS138 无法直接选片，需要多级译码（此处不展开）。`
    );
  }
  const chipCount = kw * kb;
  if (chipCount > MAX_CHIPS) throw new DlogicInputError(`共需 ${chipCount} 片，超过 ${MAX_CHIPS} 片的上限。`);
  const n = log2(W);
  const k = log2(w);
  const s = n - k;
  const mode = kw > 1 && kb > 1 ? "both" : kw > 1 ? "word" : "bit";
  const chipAddressLines = range2(k).map((i) => `A${i}`);
  const selectLines = range2(s).map((j) => `A${n - 1 - j}`);
  let decoder = null;
  if (kw > 1) {
    const addrPins = ["A2", "A1", "A0"];
    const addrWiring = addrPins.map((p, idx) => {
      const j = idx - (3 - s);
      return j < 0 ? { pin: p, signal: "GND", note: "高位地址接地" } : { pin: p, signal: selectLines[j] };
    });
    const enable = [
      { pin: "S1", signal: "VCC", note: "使能有效" },
      { pin: "S̄2", signal: "GND" },
      { pin: "S̄3", signal: "GND" }
    ];
    decoder = { chip: "138", wiring: [...addrWiring, ...enable], outputs: range2(kw).map((g) => `Y̅${g}`) };
  }
  const chips = [];
  for (let g = 0; g < kw; g++) {
    for (let h = 0; h < kb; h++) {
      chips.push({
        index: g * kb + h + 1,
        wordGroup: g,
        bitGroup: h,
        dataLow: h * b,
        dataHigh: h * b + b - 1,
        select: kw > 1 ? `Y̅${g}` : "GND"
      });
    }
  }
  const digits = Math.max(1, Math.ceil(n / 4));
  const addressMap = range2(kw).map((g) => {
    const low = g * w;
    const high = low + w - 1;
    return {
      wordGroup: g,
      chips: chips.filter((c) => c.wordGroup === g).map((c) => c.index),
      low,
      high,
      lowHex: hexText(low, digits) + "H",
      highHex: hexText(high, digits) + "H"
    };
  });
  const decode = req.decode === void 0 ? null : decodeInfo(n, req.decode, req.rowBits);
  const warnings = [];
  if (kw === 1) warnings.push("只做位扩展：各片片选接地（常选通），读写控制线并联。");
  const steps = [
    { kind: "capacity", text: `目标容量 ${W}×${B}＝${W * B} 位，芯片 ${w}×${b}＝${w * b} 位。` },
    {
      kind: "mode",
      text: mode === "bit" ? `位扩展：字数相同，${kb} 片地址线并联，数据线分组接入。` : mode === "word" ? `字扩展：位数相同，${kw} 组芯片按地址区间分段，高位地址经译码选片。` : `字位扩展：先字向 ${kw} 组，每组再位向 ${kb} 片，共 ${chipCount} 片。`
    },
    {
      kind: "address",
      text: s > 0 ? `芯片地址线 ${chipAddressLines.join("、")} 并接各片；高 ${s} 位 ${selectLines.join("、")} 进入 74LS138 译码选片。` : `芯片地址线 ${chipAddressLines.join("、")} 并接各片。`
    }
  ];
  if (decoder) {
    steps.push({ kind: "decode", text: `138 的 Y̅0～Y̅${kw - 1} 分别接第 0～${kw - 1} 组芯片的片选，低有效。` });
  }
  if (decode) steps.push({ kind: "decode-structure", text: decode.note });
  return {
    result: {
      mode,
      target: { words: W, bits: B, capacity: W * B, addressBits: n },
      chip: { words: w, bits: b, capacity: w * b, addressBits: k },
      wordGroups: kw,
      bitGroups: kb,
      chipCount,
      chipAddressLines,
      selectLines,
      decoder,
      chips,
      addressMap,
      decode
    },
    steps,
    warnings
  };
}
function romFunction(variables, outputs) {
  const vars = checkVariables(variables, MAX_FUNC_VARS2, false);
  const { names, specs, hasDontCare } = outputSpecs(vars, outputs, "ROM");
  const n = vars.length;
  const words = 1 << n;
  const m = names.length;
  const onSets = specs.map((sp) => new Set(sp.minterms));
  const digits = Math.max(1, Math.ceil(m / 4));
  const rows = range2(words).map((a) => {
    const data = onSets.map((on) => on.has(a) ? 1 : 0);
    const word = data.join("");
    return { address: a, addressBits: binText(a, n), data, word, hex: hexText(parseInt(word, 2), digits) };
  });
  const functions = specs.map((sp, i) => ({
    name: names[i],
    text: `${names[i]} = Σm(${sp.minterms.join(",")})`,
    latex: `${names[i]} = \\sum m(${sp.minterms.join(",")})`
  }));
  const warnings = [];
  if (hasDontCare) warnings.push("ROM 不利用无关项，无关项按 0 处理。");
  const steps = [
    { kind: "address", text: `地址线为 ${vars.join("、")}（${vars[0]} 为最高位），共 ${words} 个单元。` },
    { kind: "data", text: `每个输出在其最小项对应的地址写 1，其余写 0；数据字的最左位为第一个输出。` },
    { kind: "size", text: `ROM 容量 ${words}×${m}＝${words * m} 位。` }
  ];
  const size = { words, bits: m, capacity: words * m, addressBits: n };
  return { result: { variables: vars, outputNames: names, size, functions, rows }, steps, warnings };
}
function allDash(n) {
  return { mask: "-".repeat(n), covers: range2(1 << n), literals: 0, text: "1", latex: "1" };
}
function coverSets(spec) {
  const n = spec.variables.length;
  if (spec.minterms.length === 0) return [[]];
  if (spec.minterms.length === 1 << n) return [[allDash(n)]];
  const sols = minimize(spec, "SOP").solutions;
  return sols.length > 0 ? sols : [[]];
}
function sortImplicants(imps) {
  return imps.slice().sort((a, b) => a.literals - b.literals || (a.mask < b.mask ? -1 : a.mask > b.mask ? 1 : 0));
}
function pickCovers(sols, shared) {
  const picks = sols.map(() => 0);
  if (!shared) return picks;
  let total = 1;
  for (const s of sols) {
    total *= s.length;
    if (total > PICK_CAP) return picks;
  }
  let best = picks.slice();
  let bestCost = null;
  for (; ; ) {
    const set = /* @__PURE__ */ new Map();
    sols.forEach((s, i2) => {
      for (const imp of s[picks[i2]]) set.set(imp.mask, imp.literals);
    });
    let lits = 0;
    for (const v of set.values()) lits += v;
    const cost = [set.size, lits];
    if (bestCost === null || cost[0] < bestCost[0] || cost[0] === bestCost[0] && cost[1] < bestCost[1]) {
      bestCost = cost;
      best = picks.slice();
    }
    let i = 0;
    while (i < picks.length) {
      picks[i]++;
      if (picks[i] < sols[i].length) break;
      picks[i] = 0;
      i++;
    }
    if (i === picks.length) break;
  }
  return best;
}
function productText(mask, vars) {
  const sep = vars.every((v) => v.length === 1) ? "" : "·";
  const lsep = sep === "" ? "" : "\\cdot ";
  const txt = [];
  const tex = [];
  vars.forEach((v, i) => {
    if (mask[i] === "1") {
      txt.push(v);
      tex.push(latexName2(v));
    } else if (mask[i] === "0") {
      txt.push(v + "'");
      tex.push(`\\overline{${latexName2(v)}}`);
    }
  });
  if (txt.length === 0) return { text: "1", latex: "1" };
  return { text: txt.join(sep), latex: tex.join(lsep) };
}
function plaFunction(variables, outputs, kind, termsPerOutput) {
  const vars = checkVariables(variables, MAX_FUNC_VARS2, false);
  const label = kind === "pla" ? "PLA" : "PAL";
  const { names, specs } = outputSpecs(vars, outputs, label);
  const shared = kind === "pla";
  let K = 0;
  if (!shared) {
    if (!Number.isInteger(termsPerOutput) || termsPerOutput < 1 || termsPerOutput > MAX_PAL_TERMS) {
      throw new DlogicInputError(`PAL 每个输出的乘积项数应为 1 到 ${MAX_PAL_TERMS} 之间的整数，当前为 ${String(termsPerOutput)}。`);
    }
    K = termsPerOutput;
  }
  const sols = specs.map(coverSets);
  const picks = pickCovers(sols, shared);
  const chosen = sols.map((s, i) => sortImplicants(s[picks[i]]));
  const termIndex = /* @__PURE__ */ new Map();
  const termRecs = [];
  chosen.forEach((imps, oi) => {
    for (const imp of imps) {
      const key = shared ? imp.mask : `${oi}:${imp.mask}`;
      let ti = termIndex.get(key);
      if (ti === void 0) {
        ti = termRecs.length;
        termIndex.set(key, ti);
        termRecs.push({ mask: imp.mask, literals: imp.literals, usedBy: [] });
      }
      if (!termRecs[ti].usedBy.includes(oi)) termRecs[ti].usedBy.push(oi);
    }
  });
  if (termRecs.length > MAX_TERMS) {
    throw new DlogicInputError(`乘积项共 ${termRecs.length} 个，超过 ${MAX_TERMS} 个的上限。`);
  }
  const terms = termRecs.map((r, ti) => {
    const pt = productText(r.mask, vars);
    return {
      label: `P${ti + 1}`,
      mask: r.mask,
      text: pt.text,
      latex: pt.latex,
      literals: r.literals,
      usedBy: r.usedBy.map((i) => names[i])
    };
  });
  const outs = names.map((name2, oi) => {
    const hit = termRecs.map((r, ti) => r.usedBy.includes(oi) ? ti : -1).filter((ti) => ti >= 0);
    const parts = hit.map((ti) => terms[ti]);
    return {
      name: name2,
      text: parts.length === 0 ? "0" : parts.map((p) => p.text).join(" + "),
      latex: parts.length === 0 ? "0" : parts.map((p) => p.latex).join(" + "),
      termLabels: parts.map((p) => p.label),
      overflow: K > 0 && parts.length > K
    };
  });
  const andColumns = [];
  vars.forEach((v) => andColumns.push(v, `${v}̅`));
  const andDots = termRecs.map((r) => {
    const row = [];
    for (let i = 0; i < vars.length; i++) {
      row.push(r.mask[i] === "1");
      row.push(r.mask[i] === "0");
    }
    return row;
  });
  const orDots = termRecs.map((r) => names.map((_, oi) => r.usedBy.includes(oi)));
  const literals = termRecs.reduce((acc, r) => acc + r.literals, 0);
  const separate = chosen.reduce((acc, imps) => acc + imps.length, 0);
  const warnings = [];
  if (K > 0) {
    for (const o of outs) {
      if (o.overflow) {
        warnings.push(`输出 ${o.name} 需要 ${o.termLabels.length} 个乘积项，超过每输出固定的 ${K} 个，本 PAL 无法直接实现。`);
      }
    }
  }
  const steps = [{ kind: "minimize", text: "各输出函数分别用 Q-M 法化简，取最简与或式。" }];
  if (shared) {
    steps.push({
      kind: "share",
      text: `合并共用的乘积项：各输出分别需要 ${separate} 项，共用后只需 ${terms.length} 个乘积项。`
    });
  } else {
    steps.push({ kind: "fixed", text: `或阵列固定：每个输出最多接 ${K} 个乘积项，未用的项留空（编程为恒 0）。` });
  }
  steps.push({ kind: "and-plane", text: "与阵列：每个乘积项占一行，输入的原变量与反变量各占一列，打点表示接入。" });
  steps.push({ kind: "or-plane", text: "或阵列：乘积项占行，输出占列，打点表示该项接入该输出。" });
  return {
    result: {
      kind,
      variables: vars,
      terms,
      outputs: outs,
      andColumns,
      andDots,
      orDots,
      termsPerOutput: shared ? null : K,
      cost: { terms: termRecs.length, literals },
      separateTerms: separate
    },
    steps,
    warnings
  };
}
function lut16(on, n) {
  let v = 0;
  for (let a = 0; a < 16; a++) {
    if (on.has(a & (1 << n) - 1)) v |= 1 << a;
  }
  return v;
}
function maskString(v) {
  let s = "";
  for (let a = 15; a >= 0; a--) s += v >> a & 1;
  return s;
}
function lutPins(vars) {
  const n = vars.length;
  return [3, 2, 1, 0].map(
    (j) => j < n ? { pin: `I${j}`, signal: vars[n - 1 - j] } : { pin: `I${j}`, signal: "GND", note: "未用，接 0" }
  );
}
function lutMap(req) {
  const spec = specFromRequest(req, req.variables, true, "LUT ");
  const warnings = [];
  if (spec.dontCares.length > 0) warnings.push("LUT 掩码不利用无关项，无关项按 0 处理。");
  const vars = spec.variables;
  const n = vars.length;
  const on = new Set(spec.minterms);
  const fnText = specText2(spec);
  const fnLatex = specLatex2(spec);
  if (n <= 4) {
    const value = lut16(on, n);
    const steps2 = [
      {
        kind: "address",
        text: n > 0 ? `地址线：${vars.map((v, i) => `${v} 接 I${n - 1 - i}`).join("、")}，未用的输入接 0。` : "函数为常数，全部输入接 0。"
      },
      { kind: "mask", text: `掩码共 16 位，高位在前（最左为地址 15），十六进制为 ${hexText(value, 4)}H。` }
    ];
    if (n < 4) {
      steps2.push({ kind: "replicate", text: "变量少于 4 个时，未用输入取何值都不影响输出，掩码按周期重复填充。" });
    }
    return {
      result: {
        kind: "single",
        variables: vars,
        mask: maskString(value),
        hex: hexText(value, 4),
        pins: lutPins(vars),
        rows: range2(1 << n).map((a) => ({ address: a, addressBits: binText(a, n), value: on.has(a) ? 1 : 0 })),
        functionText: fnText,
        functionLatex: fnLatex
      },
      steps: steps2,
      warnings
    };
  }
  const k = n - 4;
  const splitVars = vars.slice(0, k);
  const lutVars = vars.slice(k);
  const cofactors = range2(1 << k).map((h) => {
    const on4 = /* @__PURE__ */ new Set();
    for (const m of spec.minterms) {
      if (m >> 4 === h) on4.add(m & 15);
    }
    const value = lut16(on4, 4);
    return {
      assignment: splitVars.map((v, j) => `${v}=${h >> k - 1 - j & 1}`).join(" "),
      variables: lutVars.slice(),
      mask: maskString(value),
      hex: hexText(value, 4)
    };
  });
  warnings.push(`函数有 ${n} 个变量，超过 LUT4 的 4 个输入，需要拆分到 ${1 << k} 个 LUT 与一个选择器。`);
  const steps = [
    {
      kind: "shannon",
      text: `香农展开：按 ${splitVars.join("、")} 展开为 ${1 << k} 个 4 变量子函数，每个子函数用一个 LUT4 的掩码实现。`
    },
    {
      kind: "combine",
      text: `再用 ${1 << k} 选 1 的数据选择器合成，选择端接 ${splitVars.join("、")}，数据端接各子函数 LUT 的输出。`
    }
  ];
  return {
    result: {
      kind: "split",
      variables: vars,
      splitVars,
      lutVars,
      pins: lutPins(lutVars),
      cofactors,
      functionText: fnText,
      functionLatex: fnLatex
    },
    steps,
    warnings
  };
}

// src/host/tools/mem.logic.ts
var MEM_OPS = ["expand", "rom_func", "pla", "pal", "lut"];
var OUTPUT_ITEM = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "输出名，省略时依次为 F1、F2 ……" },
    expr: { type: "string", description: `函数表达式，例如 "AB + A'C"；与 minterms 二选一。` },
    minterms: { type: "array", items: { type: "integer" }, description: "最小项编号（variables[0] 为最高位）。" },
    dontCares: { type: "array", items: { type: "integer" }, description: "无关项编号（ROM 与 LUT 不利用，按 0 处理）。" }
  }
};
var MEM_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...MEM_OPS],
    description: "expand 存储器位/字/字位扩展；rom_func 用 ROM 实现多输出函数；pla / pal 用可编程阵列实现多输出函数；lut 求 LUT4 的 16 位配置掩码。"
  },
  targetWords: { type: "integer", description: "expand：目标存储器字数（2 的幂）。" },
  targetBits: { type: "integer", description: "expand：目标存储器位数（每字的位数）。" },
  chipWords: { type: "integer", description: "expand：芯片字数（2 的幂，不大于目标字数）。" },
  chipBits: { type: "integer", description: "expand：芯片位数（整除目标位数）。" },
  decode: {
    type: "string",
    enum: ["single", "double"],
    description: "expand：仅当用户明确要求单译码或双译码结构时才传；纯芯片扩展题（只问用几片、地址怎么接、片选怎么译）不要传，结果中不会出现“译码结构”块。"
  },
  rowBits: { type: "integer", description: "expand 双译码：行译码位数，默认取地址位数的一半。" },
  variables: {
    type: "array",
    items: { type: "string" },
    description: "rom_func / pla / pal / lut：变量列表（variables[0] 为最高位）。使用 minterms 时必填。"
  },
  outputs: {
    type: "array",
    items: OUTPUT_ITEM,
    description: "rom_func / pla / pal：输出函数列表（至多 8 个），每个给 expr 或 minterms。"
  },
  termsPerOutput: {
    type: "integer",
    description: "pal：每个输出固定的乘积项数，1 到 8，默认 8。"
  },
  expr: { type: "string", description: "lut：4 变量以内的函数表达式。与 minterms 二选一。" },
  minterms: { type: "array", items: { type: "integer" }, description: "lut：最小项编号，与 variables 一起使用。" },
  dontCares: { type: "array", items: { type: "integer" }, description: "lut：无关项编号（按 0 处理）。" }
};
function runMem(args) {
  return envelope(String(args.op), () => {
    switch (args.op) {
      case "expand": {
        const { targetWords, targetBits, chipWords, chipBits } = args;
        if (typeof targetWords !== "number" || typeof targetBits !== "number" || typeof chipWords !== "number" || typeof chipBits !== "number") {
          throw new DlogicInputError("expand 需要提供 targetWords、targetBits、chipWords、chipBits（均为正整数）。");
        }
        const out = expandMemory({
          targetWords,
          targetBits,
          chipWords,
          chipBits,
          decode: args.decode,
          rowBits: args.rowBits
        });
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      case "rom_func": {
        const out = romFunction(args.variables, args.outputs);
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      case "pla":
      case "pal": {
        const out = plaFunction(args.variables, args.outputs, args.op, args.op === "pal" ? args.termsPerOutput ?? 8 : 0);
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      case "lut": {
        const out = lutMap({ variables: args.variables, expr: args.expr, minterms: args.minterms, dontCares: args.dontCares });
        return { result: out.result, steps: out.steps, warnings: out.warnings };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
var ROW_LIMIT2 = 64;
function renderExpand(r, lines) {
  lines.push(
    `目标 ${r.target.words}×${r.target.bits}（${r.target.capacity} 位），芯片 ${r.chip.words}×${r.chip.bits}，共 ${r.chipCount} 片（字向 ${r.wordGroups} 组，位向 ${r.bitGroups} 组）`
  );
  lines.push(`芯片地址线：${r.chipAddressLines.join("、")}`);
  if (r.selectLines.length) lines.push(`片选译码输入：${r.selectLines.join("、")}`);
  for (const c of r.chips) {
    lines.push(`第 ${c.index} 片：字组 ${c.wordGroup}，数据位 D${c.dataHigh}～D${c.dataLow}，片选 ${c.select}`);
  }
  for (const a of r.addressMap) {
    lines.push(`字组 ${a.wordGroup}（第 ${a.chips.join("、")} 片）：${a.lowHex}～${a.highHex}`);
  }
  if (r.decoder) {
    for (const w of r.decoder.wiring) lines.push(`138 ${w.pin} ← ${w.signal}`);
  }
  if (r.decode) lines.push(r.decode.note);
}
function renderRom(r, lines) {
  lines.push(`容量 ${r.size.words}×${r.size.bits}（${r.size.capacity} 位），输出 ${r.outputNames.join("、")}`);
  for (const f of r.functions) lines.push(f.text);
  lines.push(`地址（${r.variables.join(" ")}）| 数据（${r.outputNames.join(" ")}）| 十六进制`);
  for (const row of r.rows.slice(0, ROW_LIMIT2)) lines.push(`${row.addressBits} | ${row.word} | ${row.hex}H`);
  if (r.rows.length > ROW_LIMIT2) lines.push(`共 ${r.rows.length} 行，逐行略去。`);
}
function renderPla(r, lines) {
  lines.push(`变量：${r.variables.join(" ")}；乘积项 ${r.cost.terms} 个，文字 ${r.cost.literals} 个`);
  if (r.termsPerOutput !== null) lines.push(`或阵列固定：每输出 ${r.termsPerOutput} 个乘积项`);
  for (const t of r.terms) lines.push(`${t.label} = ${t.text}（接入 ${t.usedBy.join("、")}）`);
  for (const o of r.outputs) lines.push(`${o.name} = ${o.text}`);
}
function renderLut(r, lines) {
  if (r.kind === "single") {
    lines.push(`掩码（高位在前）：${r.mask}`, `十六进制：${r.hex}H`);
    for (const p of r.pins) lines.push(`${p.pin} ← ${p.signal}`);
    return;
  }
  lines.push(`拆分：按 ${r.splitVars.join("、")} 展开，子函数输入 ${r.lutVars.join("、")}`);
  for (const cf of r.cofactors) lines.push(`${cf.assignment}：${cf.mask}（${cf.hex}H）`);
}
function renderMem(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  if (value.op === "expand") renderExpand(value.result, lines);
  else if (value.op === "rom_func") renderRom(value.result, lines);
  else if (value.op === "pla" || value.op === "pal") renderPla(value.result, lines);
  else if (value.op === "lut") renderLut(value.result, lines);
  else lines.push("（无可显示的结果）");
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/mem.ts
var DESCRIPTION8 = [
  "存储器与可编程逻辑的确定性计算。op 取值：",
  "expand 位扩展、字扩展、字位扩展（给出目标 targetWords×targetBits 与芯片 chipWords×chipBits，",
  "返回芯片数、地址线分配、138 片选接线与地址映射表；仅当用户明确要求单译码或双译码结构时才传 decode）；",
  "rom_func 用 ROM 实现多输出函数，返回地址—数据表；",
  "pla 用 PLA 实现多输出函数，共用乘积项，返回与阵列、或阵列点阵；pal 同理但或阵列每输出固定项数（termsPerOutput）；",
  "lut 求 LUT4 的 16 位配置掩码（4 变量以内），5～6 变量时给出香农展开的拆分方案。",
  "函数输入：rom_func、pla、pal 用 variables（variables[0] 为最高位）加 outputs；lut 用 expr 或 variables 加 minterms。"
].join("");
var dlogicMem = defineTool9({
  name: "dlogic_mem",
  description: DESCRIPTION8,
  parameters: MEM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderMem(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_mem", value })
  },
  async execute(args) {
    return runMem(args);
  }
});

// src/host/tools/adda.ts
import { defineTool as defineTool10 } from "@deepseek-ai/dsh-tools";

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
  if (a >= 1e-6) return `${fmtNum(s * 1e6)} μs`;
  return `${fmtNum(s * 1e9)} ns`;
}

// src/solvers/adda.ts
var MAX_BITS3 = 16;
var ADDA_OPS = ["dac", "adc_sar", "adc_flash", "adc_dual", "quantize"];
var DAC_TYPES = ["weighted", "r2r_t", "r2r_inverted"];
var FLASH_LIST_LIMIT = 127;
var EPS = 1e-9;
var DAC_NAME = {
  weighted: "权电阻型 DAC",
  r2r_t: "R-2R T 型电阻网络 DAC",
  r2r_inverted: "R-2R 倒 T 型电阻网络 DAC"
};
function solved(result, warnings = []) {
  return { result, warnings };
}
function checkBits(v) {
  if (typeof v !== "number" || !Number.isInteger(v)) throw new DlogicInputError("位数 bits 必须为整数。");
  if (v < 1 || v > MAX_BITS3) throw new DlogicInputError(`位数 bits 须在 1～${MAX_BITS3} 之间，当前为 ${v}。`);
  return v;
}
function checkNumber(v, name2) {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new DlogicInputError(`${name2} 必须是有限的数字。`);
  return v;
}
function checkPositive(v, name2) {
  const x = checkNumber(v, name2);
  if (x <= 0) throw new DlogicInputError(`${name2} 必须大于 0，当前为 ${fmtNum(x)}。`);
  return x;
}
function checkRange(vin, full) {
  if (vin < 0 || vin > full) throw new DlogicInputError(`输入电压 ${fmtNum(vin)} V 超出量程 [0, ${fmtNum(full)}] V。`);
}
function checkMode(v) {
  if (v === void 0) return "truncate";
  if (v === "truncate" || v === "round") return v;
  throw new DlogicInputError(`量化方式 mode 只能是 truncate（舍尾）或 round（四舍五入），当前为 ${String(v)}。`);
}
function bitsText(v, n) {
  return v.toString(2).padStart(n, "0");
}
function gcd2(a, b) {
  return b === 0 ? a : gcd2(b, a % b);
}
function fractionText(num, den) {
  if (num === 0) return "0";
  const g = gcd2(num, den);
  const a = num / g;
  const b = den / g;
  return b === 1 ? String(a) : `${a}/${b}`;
}
function resistorText(e) {
  return e === 0 ? "R" : `${2 ** e}R`;
}
function quantDelta(n, full, mode) {
  return mode === "truncate" ? full / 2 ** n : 2 * full / (2 ** (n + 1) - 1);
}
function quantDeltaFormula(n, mode, sym) {
  return mode === "truncate" ? `${sym}/2^${n}` : `2${sym}/(2^${n + 1}-1)`;
}
function quantCode(vin, n, delta, mode) {
  const raw = mode === "truncate" ? Math.floor(vin / delta + EPS) : Math.floor(vin / delta + 0.5 + EPS);
  return Math.min(Math.max(raw, 0), 2 ** n - 1);
}
function solveDac(req) {
  const n = checkBits(req.bits);
  const vref = checkPositive(req.vref, "vref");
  const max = 2 ** n - 1;
  const dacType = req.dacType;
  if (!DAC_TYPES.includes(dacType)) {
    throw new DlogicInputError(`未知的 DAC 类型：${String(dacType)}，可选 weighted（权电阻）、r2r_t（T 型）、r2r_inverted（倒 T 型）。`);
  }
  let d;
  if (req.binary !== void 0) {
    if (typeof req.binary !== "string" || !/^[01]+$/.test(req.binary)) throw new DlogicInputError("binary 只能由 0 和 1 组成。");
    if (req.binary.length !== n) throw new DlogicInputError(`binary 的长度 ${req.binary.length} 须等于位数 ${n}。`);
    d = parseInt(req.binary, 2);
  } else if (req.code !== void 0) {
    if (!Number.isInteger(req.code) || req.code < 0 || req.code > max) {
      throw new DlogicInputError(`数字量 code 须为 0～${max} 的整数，当前为 ${String(req.code)}。`);
    }
    d = req.code;
  } else {
    throw new DlogicInputError("dac 需要提供 code（十进制整数）或 binary（二进制串）。");
  }
  const defaultRf = dacType === "weighted" ? 0.5 : 1;
  const rf = dacType === "r2r_t" ? null : checkPositive(req.rfRatio ?? defaultRf, "rfRatio");
  const factor = rf ?? 1;
  const inverting2 = dacType !== "r2r_t";
  const k = dacType === "weighted" ? n - 1 : n;
  const denom = 2 ** k;
  const vout = (inverting2 ? -1 : 1) * factor * vref * d / denom;
  const lsb = factor * vref / denom;
  const fullScale = factor * vref * max / denom;
  const bin = bitsText(d, n);
  const onePowers = [];
  for (let i = n - 1; i >= 0; i--) if (d >> i & 1) onePowers.push(i);
  const sumTerms = onePowers.length ? onePowers.map((i) => `2^${i}`).join(" + ") : "0";
  const formula = dacType === "weighted" ? "Vo = -(Rf/R)·VREF·D/2^(n-1)" : dacType === "r2r_inverted" ? "Vo = -(Rf/R)·VREF·D/2^n" : "Vo = VREF·D/2^n";
  const factorPart = rf === null ? "" : `${fmtNum(rf)} × `;
  const substituted = `Vo = ${inverting2 ? "-" : ""}${factorPart}${fmtNum(vref)} × ${d} / ${denom} = ${fmtNum(vout)} V`;
  const lsbFormula = rf === null ? `VREF/2^${k}` : `(Rf/R)·VREF/2^${k}`;
  const derivation = [`输入数字量 D = ${d}，二进制 ${bin}，D = Σ d_i·2^i = ${sumTerms} = ${d}`];
  if (dacType === "weighted") {
    derivation.push(
      `权电阻：第 i 位支路电阻 R_i = 2^(n-1-i)·R，最高位为 R，最低位为 ${resistorText(n - 1)}`,
      `各位电流 I_i = d_i·VREF/R_i，求和得 I_f = VREF·D/(R·2^(n-1))`,
      `输出 Vo = -Rf·I_f = -(Rf/R)·VREF·D/2^(n-1)`
    );
  } else if (dacType === "r2r_inverted") {
    derivation.push(
      `参考电流 I_REF = VREF/R，经 R-2R 梯形网络按位分流，输出电流 I_O = I_REF·D/2^n = VREF·D/(R·2^n)`,
      `输出 Vo = -Rf·I_O = -(Rf/R)·VREF·D/2^n`
    );
  } else {
    derivation.push("T 型网络各位支路经等效变换后，输出端电压 Vo = VREF·D/2^n");
  }
  derivation.push(
    `分辨率 1LSB = ${lsbFormula} = ${fmtNum(lsb)} V`,
    `满量程（D = ${max}，各位全为 1）= ${fmtNum(fullScale)} V`,
    inverting2 ? "符号约定：反相输出，正的数字量对应负的输出电压（接反相放大器时）" : "符号约定：同相输出，输出电压与 D 同号，无负号"
  );
  const branches = dacType === "weighted" ? Array.from({ length: n }, (_, j) => {
    const bit = n - 1 - j;
    return { bit, value: d >> bit & 1, resistor: resistorText(j) };
  }) : null;
  const result = {
    dacType,
    typeName: DAC_NAME[dacType],
    bits: n,
    vref,
    code: d,
    codeBinary: bin,
    inverting: inverting2,
    rfRatio: rf,
    formula,
    substituted,
    vout,
    fraction: fractionText(d, denom),
    lsb,
    fullScale,
    branches,
    derivation
  };
  return solved(result);
}
function solveSar(req) {
  const n = checkBits(req.bits);
  const vref = checkPositive(req.vref, "vref");
  const vin = checkNumber(req.vin, "vin");
  checkRange(vin, vref);
  const denom = 2 ** n;
  const delta = vref / denom;
  const steps = [];
  let cur = 0;
  for (let i = n - 1; i >= 0; i--) {
    const trial = cur | 1 << i;
    const dacVoltage = vref * trial / denom;
    const geq = vin + EPS >= dacVoltage;
    if (geq) cur = trial;
    steps.push({
      step: steps.length + 1,
      bit: i,
      trialCode: trial,
      trialBinary: bitsText(trial, n),
      dacVoltage,
      geq,
      kept: geq ? 1 : 0,
      partialBinary: bitsText(cur, n)
    });
  }
  const code = cur;
  const codeBinary = bitsText(code, n);
  const quantized = code * delta;
  const error = vin - quantized;
  const derivation = [
    `量化单位 Δ = VREF/2^${n} = ${fmtNum(vref)}/${denom} = ${fmtNum(delta)} V`,
    ...steps.map(
      (s) => `第 ${s.step} 次：试探 ${s.trialBinary}（第 ${s.bit} 位置 1），DAC 输出 Vo = ${fmtNum(s.dacVoltage)} V，` + (s.geq ? "Vin ≥ Vo，保留 1" : "Vin < Vo，清除为 0")
    ),
    `转换结果 ${codeBinary}（十进制 ${code}），对应模拟值 ${code}·Δ = ${fmtNum(quantized)} V`,
    `量化误差 e = Vin - ${code}·Δ = ${fmtNum(error)} V，舍尾法误差范围 0 ≤ e < Δ`
  ];
  const warnings = vin >= vref ? ["输入等于满量程，数字量取最大码，误差等于 Δ。"] : [];
  return solved(
    {
      bits: n,
      vref,
      vin,
      delta,
      steps,
      code,
      codeBinary,
      quantized,
      error,
      errorRange: [0, delta],
      derivation
    },
    warnings
  );
}
function solveFlash(req) {
  const n = checkBits(req.bits);
  const vref = checkPositive(req.vref, "vref");
  const vin = checkNumber(req.vin, "vin");
  checkRange(vin, vref);
  const mode = checkMode(req.mode);
  const denom = 2 ** n;
  const count = denom - 1;
  const delta = quantDelta(n, vref, mode);
  const refFormula = mode === "truncate" ? `V_k = k·VREF/2^${n}，k = 1～${count}` : `V_k = (2k-1)·VREF/(2^${n + 1}-1)，k = 1～${count}`;
  const code = quantCode(vin, n, delta, mode);
  const codeBinary = bitsText(code, n);
  const quantized = code * delta;
  const error = vin - quantized;
  const errorRange = mode === "truncate" ? [0, delta] : [-delta / 2, delta / 2];
  let comparators = [];
  let thermometer = null;
  if (count <= FLASH_LIST_LIMIT) {
    for (let k = 1; k <= count; k++) {
      const ref = mode === "truncate" ? k * vref / denom : (2 * k - 1) * vref / (2 ** (n + 1) - 1);
      comparators.push({ index: k, ref, output: vin + EPS >= ref ? 1 : 0 });
    }
    thermometer = [...comparators].reverse().map((c) => c.output).join("");
  }
  const errText = mode === "truncate" ? "误差范围 0 ≤ e < Δ" : "误差范围 -Δ/2 ≤ e ≤ Δ/2";
  const derivation = [
    `量化单位 Δ = ${quantDeltaFormula(n, mode, "VREF")} = ${fmtNum(delta)} V`,
    `比较器数量 2^${n} - 1 = ${count} 个，参考电压 ${refFormula}`
  ];
  if (thermometer !== null) derivation.push(`各比较器输出自高到低为 ${thermometer}（温度计码）`);
  derivation.push(
    `编码器把 1 的个数 ${code} 编为二进制 ${codeBinary}`,
    `量化值 ${code}·Δ = ${fmtNum(quantized)} V，误差 e = ${fmtNum(error)} V，${errText}`
  );
  const warnings = vin >= vref ? ["输入等于满量程，数字量取最大码。"] : [];
  return solved(
    {
      bits: n,
      vref,
      vin,
      mode,
      delta,
      comparatorCount: count,
      refFormula,
      comparators,
      thermometer,
      code,
      codeBinary,
      quantized,
      error,
      errorRange,
      derivation
    },
    warnings
  );
}
function solveDual(req) {
  const vref = checkPositive(req.vref, "vref");
  const vfs = req.vfs === void 0 ? vref : checkPositive(req.vfs, "vfs");
  const vin = checkNumber(req.vin, "vin");
  if (vin < 0 || vin > vfs) {
    throw new DlogicInputError(`双积分 ADC 只处理 0～Vfs（${fmtNum(vfs)} V）的输入，当前为 ${fmtNum(vin)} V（极性由比较器判断，取绝对值）。`);
  }
  const clockHz = checkPositive(req.clockHz, "clockHz");
  const t1Req = checkPositive(req.t1, "t1");
  const mainsHz = req.mainsHz === void 0 ? 50 : checkPositive(req.mainsHz, "mainsHz");
  const warnings = [];
  const nRaw = t1Req * clockHz;
  const n1 = Math.round(nRaw);
  if (n1 < 1) throw new DlogicInputError("T1 过短，T1 内至少需要 1 个时钟脉冲。");
  if (Math.abs(nRaw - n1) > 1e-6) {
    warnings.push(`T1 不是时钟周期的整数倍，取 N1 = ${n1}，实际 T1 = ${fmtTime(n1 / clockHz)}。`);
  }
  const t1 = n1 / clockHz;
  const t2 = vin / vref * t1;
  const n2 = Math.floor(vin * n1 / vref + EPS);
  const t2Max = vfs / vref * t1;
  const convMax = t1 + t2Max;
  const resolution = vref / n1;
  const mainsPeriods = t1 * mainsHz;
  const mainsMultiple = mainsPeriods >= 1 - 1e-9 && Math.abs(mainsPeriods - Math.round(mainsPeriods)) < 1e-6;
  if (!mainsMultiple) {
    warnings.push(`T1 不是工频周期（${fmtTime(1 / mainsHz)}）的整数倍，工频干扰不能被完全抑制。`);
  }
  const derivation = [
    `定时积分 T1：N1 = T1·f_clk = ${n1}，T1 = ${fmtTime(t1)}`,
    `反向积分：以 VREF 反向积分，T2 = (Vin/VREF)·T1 = ${fmtTime(t2)}`,
    `计数值 N2 = (Vin/VREF)·N1 = ${fmtNum(vin * n1 / vref)}，取整为 ${n2}`,
    `最大转换时间 Tmax = T1 + T2max = ${fmtTime(t1)} + ${fmtTime(t2Max)} = ${fmtTime(convMax)}（T2max 对应 Vfs = ${fmtNum(vfs)} V）`,
    `分辨率：每个计数对应 VREF/N1 = ${fmtNum(resolution)} V`,
    `抗干扰：T1 = ${fmtNum(mainsPeriods)} 个工频周期（${mainsHz} Hz），${mainsMultiple ? "是整数倍，积分后工频分量为零" : "不是整数倍，工频分量不能完全抵消"}`
  ];
  return solved(
    {
      vref,
      vin,
      vfs,
      clockHz,
      mainsHz,
      t1,
      n1,
      t2,
      n2,
      t2Max,
      convMax,
      resolution,
      mainsPeriods,
      mainsMultiple,
      derivation
    },
    warnings
  );
}
function solveQuantize(req) {
  const n = checkBits(req.bits);
  const full = checkPositive(req.fullScale, "fullScale");
  const mode = checkMode(req.mode);
  const denom = 2 ** n;
  const delta = quantDelta(n, full, mode);
  const maxAbsError = mode === "truncate" ? delta : delta / 2;
  const errorRange = mode === "truncate" ? [0, delta] : [-delta / 2, delta / 2];
  const warnings = [];
  const derivation = [
    `量化单位 Δ = ${quantDeltaFormula(n, mode, "FS")} = ${fmtNum(delta)} V`,
    `量化等级数 2^${n} = ${denom}`,
    mode === "truncate" ? `舍尾法：量化值 = code·Δ，误差范围 0 ≤ e < Δ，|e| 的上限为 Δ` : `四舍五入法：量化值 = code·Δ，误差范围 -Δ/2 ≤ e ≤ Δ/2`
  ];
  let vin = null;
  let code = null;
  let codeBinary = null;
  let quantized = null;
  let error = null;
  if (req.vin !== void 0) {
    vin = checkNumber(req.vin, "vin");
    checkRange(vin, full);
    code = quantCode(vin, n, delta, mode);
    codeBinary = bitsText(code, n);
    quantized = code * delta;
    error = vin - quantized;
    derivation.push(
      `输入 Vin = ${fmtNum(vin)} V，数字码 ${codeBinary}（十进制 ${code}），量化值 ${fmtNum(quantized)} V`,
      `量化误差 e = ${fmtNum(error)} V`
    );
    if (vin >= full) warnings.push("输入等于满量程，数字码取最大值。");
  }
  let minBits = null;
  if (req.maxError !== void 0) {
    const maxError = checkPositive(req.maxError, "maxError");
    let found = null;
    for (let m = 1; m <= MAX_BITS3; m++) {
      const d = quantDelta(m, full, mode);
      const bound = mode === "truncate" ? d : d / 2;
      if (bound <= maxError + 1e-12) {
        found = m;
        break;
      }
    }
    minBits = {
      maxError,
      bits: found,
      delta: found === null ? null : quantDelta(found, full, mode)
    };
    if (found === null) {
      warnings.push(`误差要求 ${fmtNum(maxError)} V 在 ${MAX_BITS3} 位以内无法满足。`);
      derivation.push(`误差要求 |e| ≤ ${fmtNum(maxError)} V：${MAX_BITS3} 位以内无法满足`);
    } else {
      const bound = mode === "truncate" ? "Δ ≤ 误差要求" : "Δ/2 ≤ 误差要求";
      derivation.push(`误差要求 |e| ≤ ${fmtNum(maxError)} V，${bound}，最少位数 n = ${found}`);
    }
  }
  let sampling = null;
  if (req.fmax !== void 0) {
    const fmax = checkPositive(req.fmax, "fmax");
    const minFs = 2 * fmax;
    if (req.fs === void 0) {
      sampling = {
        fmax,
        minFs,
        fs: null,
        ok: null,
        aliasFreq: null,
        verdict: `最高频率 ${fmtNum(fmax)} Hz，最小采样频率 fs ≥ 2fmax = ${fmtNum(minFs)} Hz`
      };
    } else {
      const fs5 = checkPositive(req.fs, "fs");
      if (fs5 + EPS >= minFs) {
        sampling = {
          fmax,
          minFs,
          fs: fs5,
          ok: true,
          aliasFreq: null,
          verdict: `fs = ${fmtNum(fs5)} Hz ≥ 2fmax = ${fmtNum(minFs)} Hz，满足采样定理`
        };
      } else {
        const alias = Math.abs(fmax - Math.round(fmax / fs5) * fs5);
        sampling = {
          fmax,
          minFs,
          fs: fs5,
          ok: false,
          aliasFreq: alias,
          verdict: `fs = ${fmtNum(fs5)} Hz < 2fmax = ${fmtNum(minFs)} Hz，发生混叠，${fmtNum(fmax)} Hz 的信号将被误认为 ${fmtNum(alias)} Hz`
        };
      }
    }
    derivation.push(`采样定理：fs ≥ 2fmax = ${fmtNum(minFs)} Hz`);
  }
  return solved(
    {
      bits: n,
      fullScale: full,
      mode,
      levels: denom,
      delta,
      deltaFormula: quantDeltaFormula(n, mode, "FS"),
      vin,
      code,
      codeBinary,
      quantized,
      error,
      errorRange,
      maxAbsError,
      minBits,
      sampling,
      derivation
    },
    warnings
  );
}
function checkOp(op) {
  if (typeof op === "string" && ADDA_OPS.includes(op)) return op;
  throw new DlogicInputError(`未知的 op：${String(op)}，可选 dac、adc_sar、adc_flash、adc_dual、quantize。`);
}

// src/host/tools/adda.logic.ts
var ADDA_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...ADDA_OPS],
    description: "dac 数模转换；adc_sar 逐次逼近；adc_flash 并行比较；adc_dual 双积分；quantize 量化与采样判断。"
  },
  bits: {
    type: "integer",
    description: "位数 n，1～16。dac、adc_sar、adc_flash、quantize 必填。"
  },
  vref: {
    type: "number",
    description: "参考电压 VREF（V）。dac、adc_sar、adc_flash、adc_dual 必填；quantize 可用它代替 fullScale。"
  },
  fullScale: {
    type: "number",
    description: "quantize：满量程 FS（V）。"
  },
  code: {
    type: "integer",
    description: "dac：十进制数字量 D，与 binary 二选一。"
  },
  binary: {
    type: "string",
    description: 'dac：二进制数字量，长度须等于位数，例如 "10110101"。'
  },
  dacType: {
    type: "string",
    enum: ["weighted", "r2r_t", "r2r_inverted"],
    description: "dac 必填：weighted 权电阻型；r2r_t R-2R T 型；r2r_inverted R-2R 倒 T 型。"
  },
  rfRatio: {
    type: "number",
    description: "dac：反馈电阻与 R 之比 Rf/R。权电阻型默认 1/2（标准比例），倒 T 型默认 1；T 型忽略。"
  },
  vin: {
    type: "number",
    description: "输入模拟电压（V）。adc_sar、adc_flash 必填；quantize 可选；adc_dual 为待测电压。"
  },
  mode: {
    type: "string",
    enum: ["truncate", "round"],
    description: "adc_flash、quantize 的量化方式：truncate 舍尾法（默认）；round 四舍五入法。"
  },
  t1: {
    type: "number",
    description: "adc_dual：定时积分时间 T1（秒）。"
  },
  clockHz: {
    type: "number",
    description: "adc_dual：时钟频率（Hz）。"
  },
  vfs: {
    type: "number",
    description: "adc_dual：量程上限 Vfs（V），默认等于 VREF。"
  },
  mainsHz: {
    type: "number",
    description: "adc_dual：工频频率（Hz），默认 50。"
  },
  maxError: {
    type: "number",
    description: "quantize：绝对误差要求（V），用于反求最少位数。"
  },
  fmax: {
    type: "number",
    description: "quantize：信号最高频率（Hz），用于采样定理判断。"
  },
  fs: {
    type: "number",
    description: "quantize：采样频率（Hz），与 fmax 同时给出时判断是否满足 fs ≥ 2fmax。"
  }
};
function dispatch(args) {
  switch (checkOp(args.op)) {
    case "dac": {
      if (!args.dacType) throw new DlogicInputError("dac 需要提供 dacType：weighted（权电阻）、r2r_t（T 型）或 r2r_inverted（倒 T 型）。");
      return solveDac({
        bits: args.bits,
        vref: args.vref,
        code: args.code,
        binary: args.binary,
        dacType: args.dacType,
        rfRatio: args.rfRatio
      });
    }
    case "adc_sar":
      return solveSar({ bits: args.bits, vref: args.vref, vin: args.vin });
    case "adc_flash":
      return solveFlash({ bits: args.bits, vref: args.vref, vin: args.vin, mode: args.mode });
    case "adc_dual":
      return solveDual({
        t1: args.t1,
        clockHz: args.clockHz,
        vref: args.vref,
        vin: args.vin,
        vfs: args.vfs,
        mainsHz: args.mainsHz
      });
    case "quantize":
      return solveQuantize({
        bits: args.bits,
        fullScale: args.fullScale ?? args.vref,
        vin: args.vin,
        mode: args.mode,
        maxError: args.maxError,
        fmax: args.fmax,
        fs: args.fs
      });
  }
}
function runAdda(args) {
  return envelope(String(args.op), () => {
    const out = dispatch(args);
    return {
      result: out.result,
      steps: out.result.derivation.map((text2) => ({ kind: "derive", text: text2 })),
      warnings: out.warnings
    };
  });
}
var SHOW_ROWS = 64;
function renderDac(r, lines) {
  lines.push(`类型：${r.typeName}；位数 ${r.bits}；D = ${r.code}（${r.codeBinary}）；VREF = ${fmtNum(r.vref)} V`);
  lines.push(`公式：${r.formula}`);
  lines.push(`代入：${r.substituted}`);
  lines.push(`D/2^k = ${r.fraction}；1LSB = ${fmtNum(r.lsb)} V；满量程 = ${fmtNum(r.fullScale)} V`);
  if (r.branches) {
    lines.push("支路（自高位到低位）：");
    for (const b of r.branches) lines.push(`  第 ${b.bit} 位 = ${b.value}，电阻 ${b.resistor}`);
  }
  lines.push("推导：");
  for (const d of r.derivation) lines.push(`  ${d}`);
}
function renderSar(r, lines) {
  lines.push(`位数 ${r.bits}；VREF = ${fmtNum(r.vref)} V；Vin = ${fmtNum(r.vin)} V；Δ = ${fmtNum(r.delta)} V`);
  for (const s of r.steps) {
    lines.push(
      `第 ${s.step} 次：试探 ${s.trialBinary}，Vo = ${fmtNum(s.dacVoltage)} V，${s.geq ? "Vin ≥ Vo" : "Vin < Vo"}，${s.geq ? "保留" : "清除"}第 ${s.bit} 位，部分结果 ${s.partialBinary}`
    );
  }
  lines.push(`最终数字量 ${r.codeBinary}（十进制 ${r.code}），模拟值 ${fmtNum(r.quantized)} V`);
  lines.push(`量化误差 e = ${fmtNum(r.error)} V，范围 0 ≤ e < Δ`);
}
function renderFlash(r, lines) {
  lines.push(`位数 ${r.bits}；比较器 ${r.comparatorCount} 个；${r.mode === "truncate" ? "舍尾法" : "四舍五入法"}；Δ = ${fmtNum(r.delta)} V`);
  lines.push(`参考电压：${r.refFormula}`);
  if (r.comparators.length) {
    for (const c of r.comparators.slice(0, SHOW_ROWS)) lines.push(`  比较器 ${c.index}：Vref = ${fmtNum(c.ref)} V，输出 ${c.output}`);
    if (r.comparators.length > SHOW_ROWS) lines.push(`  其余 ${r.comparators.length - SHOW_ROWS} 个比较器略去`);
  }
  if (r.thermometer !== null) lines.push(`温度计码（自高到低）：${r.thermometer}`);
  lines.push(`编码输出 ${r.codeBinary}（十进制 ${r.code}），量化值 ${fmtNum(r.quantized)} V，误差 e = ${fmtNum(r.error)} V`);
}
function renderDual(r, lines) {
  lines.push(`T1 = ${fmtTime(r.t1)}（N1 = ${r.n1}）；T2 = ${fmtTime(r.t2)}；N2 = ${r.n2}`);
  lines.push(`Vfs = ${fmtNum(r.vfs)} V 时 T2max = ${fmtTime(r.t2Max)}，最大转换时间 ${fmtTime(r.convMax)}`);
  lines.push(`分辨率 VREF/N1 = ${fmtNum(r.resolution)} V/计数`);
  lines.push(`工频 ${r.mainsHz} Hz，T1 = ${fmtNum(r.mainsPeriods)} 个工频周期，${r.mainsMultiple ? "是整数倍，可抑制工频干扰" : "不是整数倍"}`);
  lines.push("推导：");
  for (const d of r.derivation) lines.push(`  ${d}`);
}
function renderQuantize(r, lines) {
  lines.push(`位数 ${r.bits}；满量程 FS = ${fmtNum(r.fullScale)} V；${r.mode === "truncate" ? "舍尾法" : "四舍五入法"}；量化等级 ${r.levels}`);
  lines.push(`Δ = ${r.deltaFormula} = ${fmtNum(r.delta)} V；误差范围 ${r.mode === "truncate" ? "0 ≤ e < Δ" : "-Δ/2 ≤ e ≤ Δ/2"}`);
  if (r.vin !== null && r.codeBinary !== null && r.quantized !== null && r.error !== null) {
    lines.push(`Vin = ${fmtNum(r.vin)} V → 数字码 ${r.codeBinary}（十进制 ${r.code}），量化值 ${fmtNum(r.quantized)} V，误差 ${fmtNum(r.error)} V`);
  }
  if (r.minBits) {
    lines.push(
      r.minBits.bits === null ? `误差要求 ${fmtNum(r.minBits.maxError)} V：${MAX_BITS3} 位以内无法满足` : `误差要求 ${fmtNum(r.minBits.maxError)} V：至少需要 ${r.minBits.bits} 位`
    );
  }
  if (r.sampling) lines.push(`采样：${r.sampling.verdict}`);
}
function renderAdda(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  switch (value.op) {
    case "dac":
      renderDac(value.result, lines);
      break;
    case "adc_sar":
      renderSar(value.result, lines);
      break;
    case "adc_flash":
      renderFlash(value.result, lines);
      break;
    case "adc_dual":
      renderDual(value.result, lines);
      break;
    case "quantize":
      renderQuantize(value.result, lines);
      break;
    default:
      lines.push("（无可显示的结果）");
  }
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/adda.ts
var DESCRIPTION9 = [
  "数模与模数转换的确定性计算。op 取值：dac 由数字量求输出电压（权电阻、R-2R T 型、R-2R 倒 T 型，给出公式、代入式、1LSB 与满量程）；",
  "adc_sar 逐次逼近过程表（每次试探码、DAC 输出、比较结果、保留或清除）；adc_flash 并行比较器参考电压与温度计码；",
  "adc_dual 双积分的 T2、计数值、最大转换时间与工频抗干扰；quantize 量化等级、数字码、误差范围，",
  "可按误差要求反求最少位数，并按采样定理判断采样频率。舍尾法 Δ = VREF/2^n，四舍五入法 Δ = 2VREF/(2^(n+1)-1)。位数 n 不超过 16。"
].join("");
var dlogicAdda = defineTool10({
  name: "dlogic_adda",
  description: DESCRIPTION9,
  parameters: ADDA_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderAdda(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_adda", value })
  },
  async execute(args) {
    return runAdda(args);
  }
});

// src/host/tools/system.ts
import { defineTool as defineTool11 } from "@deepseek-ai/dsh-tools";

// src/solvers/system.ts
var MAX_STATES2 = 12;
var MAX_COND_VARS = 4;
var MAX_TRANSITIONS = 96;
var MAX_MINIMIZE_VARS = 6;
var IDENT = /[A-Za-z][A-Za-z0-9_]*/g;
var REGISTER_PREFIXES = ["Q", "P", "R", "T", "U"];
function isElseCond(c) {
  return c.trim().toLowerCase() === "else";
}
function bitsFor2(n) {
  let k = 1;
  while (1 << k < n) k++;
  return k;
}
function comboLabel(vars, m) {
  if (vars.length === 0) return "（无条件）";
  return vars.map((v, i) => `${v}=${m >> vars.length - 1 - i & 1}`).join(" ");
}
function condVarsOf(spec) {
  const out = [];
  const add = (v) => {
    if (!out.includes(v)) out.push(v);
  };
  for (const v of spec.conditionVars ?? []) {
    if (typeof v !== "string" || v.trim() === "") throw new DlogicInputError("conditionVars 中的变量名不能为空");
    add(v.trim());
  }
  const exprs = [];
  for (const t of spec.transitions) if (typeof t.cond === "string" && !isElseCond(t.cond)) exprs.push(t.cond);
  for (const s of spec.states) for (const c of s.conditionals ?? []) exprs.push(c.expr);
  for (const e of exprs) for (const m of e.match(IDENT) ?? []) add(m);
  if (out.length > MAX_COND_VARS) {
    throw new DlogicInputError(`条件变量最多 ${MAX_COND_VARS} 个，当前为 ${out.length} 个（${out.join("、")}）`);
  }
  return out;
}
function condSet(expr, vars, combos) {
  const set = new Array(combos).fill(false);
  for (const m of specFromExpr(expr.trim(), vars).minterms) set[m] = true;
  return set;
}
function prepareAsm(spec) {
  if (!spec || !Array.isArray(spec.states) || spec.states.length === 0) {
    throw new DlogicInputError("states 至少需要包含一个状态");
  }
  const n = spec.states.length;
  if (n > MAX_STATES2) throw new DlogicInputError(`状态数最多 ${MAX_STATES2} 个，当前为 ${n} 个`);
  if (!Array.isArray(spec.transitions)) throw new DlogicInputError("transitions 必须是数组");
  if (spec.transitions.length > MAX_TRANSITIONS) {
    throw new DlogicInputError(`转移数最多 ${MAX_TRANSITIONS} 条，当前为 ${spec.transitions.length} 条`);
  }
  const names = spec.states.map((s) => {
    if (typeof s?.name !== "string" || s.name.trim() === "") throw new DlogicInputError("状态名不能为空");
    return s.name.trim();
  });
  const index = /* @__PURE__ */ new Map();
  names.forEach((nm, i) => {
    if (index.has(nm)) throw new DlogicInputError(`状态名重复：${nm}`);
    index.set(nm, i);
  });
  const states = spec.states.map((s, i) => ({
    name: names[i],
    outputs: (s.outputs ?? []).map((o) => String(o).trim()).filter((o) => o !== ""),
    conditionals: (s.conditionals ?? []).map((c) => {
      if (typeof c?.name !== "string" || c.name.trim() === "") throw new DlogicInputError(`状态 ${names[i]} 的条件输出名不能为空`);
      if (typeof c.expr !== "string" || c.expr.trim() === "") throw new DlogicInputError(`条件输出 ${c.name} 缺少表达式`);
      return { name: c.name.trim(), expr: c.expr.trim() };
    })
  }));
  const initName = spec.initial === void 0 ? names[0] : spec.initial;
  const initial = index.get(initName);
  if (initial === void 0) throw new DlogicInputError(`初始状态 ${initName} 不存在`);
  for (const t of spec.transitions) {
    if (!index.has(t.from)) throw new DlogicInputError(`转移的现态 ${t.from} 不存在`);
    if (!index.has(t.to)) throw new DlogicInputError(`转移的次态 ${t.to} 不存在`);
    if (typeof t.cond !== "string" || t.cond.trim() === "") {
      throw new DlogicInputError(`从 ${t.from} 出发的转移缺少条件（可写 else 或 1）`);
    }
  }
  const vars = condVarsOf(spec);
  const combos = 1 << vars.length;
  const issues = [];
  const exits = names.map(() => []);
  for (let s = 0; s < n; s++) {
    const own = spec.transitions.filter((t) => index.get(t.from) === s);
    const conds = own.filter((t) => !isElseCond(t.cond));
    const elses = own.filter((t) => isElseCond(t.cond));
    const list = conds.map((t) => ({
      to: index.get(t.to),
      cond: t.cond.trim(),
      isElse: false,
      set: condSet(t.cond, vars, combos)
    }));
    for (let a = 0; a < list.length; a++) {
      for (let b = a + 1; b < list.length; b++) {
        const hit = list[a].set.findIndex((v, m) => v && list[b].set[m]);
        if (hit >= 0) {
          issues.push({
            level: "error",
            kind: "overlap",
            state: names[s],
            message: `状态 ${names[s]} 的条件“${list[a].cond}”与“${list[b].cond}”同时成立（如 ${comboLabel(vars, hit)}）`
          });
        }
      }
    }
    const covered = new Array(combos).fill(false);
    for (const e of list) e.set.forEach((v, m) => {
      if (v) covered[m] = true;
    });
    const uncovered = covered.map((v) => !v);
    if (elses.length > 1) {
      issues.push({ level: "error", kind: "multi-else", state: names[s], message: `状态 ${names[s]} 有多个 else 出口` });
    }
    if (elses.length >= 1) {
      list.push({ to: index.get(elses[0].to), cond: "else", isElse: true, set: uncovered });
      if (!uncovered.some((v) => v)) {
        issues.push({
          level: "warning",
          kind: "dead-else",
          state: names[s],
          message: `状态 ${names[s]} 的 else 分支永远不会执行（其余条件已覆盖全部取值）`
        });
      }
    } else if (uncovered.some((v) => v)) {
      const m = uncovered.indexOf(true);
      issues.push({
        level: "error",
        kind: "missing-else",
        state: names[s],
        message: `状态 ${names[s]} 缺少 else：条件未覆盖 ${comboLabel(vars, m)} 等取值`
      });
    }
    if (list.length === 0) {
      issues.push({ level: "error", kind: "dangling", state: names[s], message: `悬空状态 ${names[s]}：没有任何出口` });
    }
    exits[s] = list;
  }
  const reachable = new Array(n).fill(false);
  const queue = [initial];
  reachable[initial] = true;
  while (queue.length > 0) {
    const s = queue.shift();
    for (const e of exits[s]) {
      if (!reachable[e.to]) {
        reachable[e.to] = true;
        queue.push(e.to);
      }
    }
  }
  for (let s = 0; s < n; s++) {
    if (!reachable[s]) {
      issues.push({
        level: "error",
        kind: "unreachable",
        state: names[s],
        message: `状态 ${names[s]} 从初始状态 ${names[initial]} 不可达`
      });
    }
  }
  const condOuts = [];
  states.forEach((s, i) => {
    for (const c of s.conditionals) condOuts.push({ state: i, name: c.name, set: condSet(c.expr, vars, combos) });
  });
  return { names, states, vars, combos, initial, exits, condOuts, issues, reachable };
}
function nextIdx(p, s, m) {
  const e = p.exits[s].find((x) => x.set[m]);
  return e ? e.to : -1;
}
function nextName(p, s, m) {
  const t = nextIdx(p, s, m);
  return t < 0 ? null : p.names[t];
}
function analyzeAsm(spec) {
  const p = prepareAsm(spec);
  const rows = p.names.map((name2, s) => ({
    state: name2,
    outputs: [...p.states[s].outputs],
    cells: Array.from({ length: p.combos }, (_, m) => ({
      next: nextName(p, s, m),
      active: p.condOuts.filter((c) => c.state === s && c.set[m]).map((c) => c.name)
    }))
  }));
  const valid = !p.issues.some((i) => i.level === "error");
  return {
    states: p.names,
    initial: p.names[p.initial],
    conditionVars: p.vars,
    valid,
    issues: p.issues,
    table: {
      vars: p.vars,
      combos: Array.from({ length: p.combos }, (_, m) => comboLabel(p.vars, m)),
      rows
    }
  };
}
function dropVar(val, N, i) {
  const p = N - 1 - i;
  const bit = 1 << p;
  const out = new Array(1 << N - 1);
  for (let mm = 0; mm < 1 << N; mm++) {
    if (mm & bit) continue;
    const a = val[mm];
    const b = val[mm | bit];
    let merged;
    if (a === 2) merged = b;
    else if (b === 2) merged = a;
    else if (a === b) merged = a;
    else return null;
    const low = mm & bit - 1;
    const high = mm >> p + 1 << p;
    out[high | low] = merged;
  }
  return out;
}
function constFn(name2, role, text2) {
  return {
    name: name2,
    role,
    variables: [],
    minterms: [],
    dontCares: [],
    text: text2,
    texts: [text2],
    latex: [text2],
    cost: { terms: 0, literals: 0 },
    minimized: true
  };
}
function buildFunction(name2, role, vars0, val0) {
  let vars = vars0.slice();
  let val = val0.slice();
  let i = 0;
  while (i < vars.length) {
    const reduced = dropVar(val, vars.length, i);
    if (reduced) {
      val = reduced;
      vars = vars.filter((_, k) => k !== i);
    } else {
      i++;
    }
  }
  if (vars.length === 0) return constFn(name2, role, val[0] === 1 ? "1" : "0");
  const on = [];
  const dc = [];
  let hasZero = false;
  val.forEach((v, m) => {
    if (v === 1) on.push(m);
    else if (v === 2) dc.push(m);
    else hasZero = true;
  });
  if (on.length === 0) return constFn(name2, role, "0");
  if (!hasZero) return constFn(name2, role, "1");
  if (vars.length <= MAX_MINIMIZE_VARS) {
    const r = minimize({ variables: vars, minterms: on, dontCares: dc }, "SOP");
    return { name: name2, role, variables: vars, minterms: on, dontCares: dc, text: r.texts[0], texts: r.texts, latex: r.latex, cost: r.cost, minimized: true };
  }
  const text2 = `Σm(${on.join(", ")})`;
  return {
    name: name2,
    role,
    variables: vars,
    minterms: on,
    dontCares: dc,
    text: text2,
    texts: [text2],
    latex: [`\\sum m(${on.join(", ")})`],
    cost: { terms: on.length, literals: on.length * vars.length },
    minimized: false
  };
}
function registerPrefix(vars) {
  for (const pre of REGISTER_PREFIXES) {
    if (!vars.some((v) => new RegExp(`^${pre}\\d+$`).test(v))) return pre;
  }
  return "Q";
}
function gateDevice(fns) {
  const terms = fns.reduce((acc, f) => acc + f.cost.terms, 0);
  const literals = fns.reduce((acc, f) => acc + f.cost.literals, 0);
  return `门电路：实现上述 ${fns.length} 个函数（共 ${terms} 个乘积项，${literals} 个文字）`;
}
function muxChip(k) {
  if (k <= 2) return "74153（双 4 选 1）";
  if (k === 3) return "74151（8 选 1）";
  return "74150（16 选 1）";
}
function counterScheme(p) {
  const n = p.names.length;
  const m = p.vars.length;
  const k = bitsFor2(n);
  const pre = registerPrefix(p.vars);
  const bits = Array.from({ length: k }, (_, i) => `${pre}${k - 1 - i}`);
  const mod = 1 << k;
  const size = 1 << k + m;
  const vars = [...bits, ...p.vars];
  const ce = [];
  const ld = [];
  const dData = bits.map(() => []);
  for (let mm = 0; mm < size; mm++) {
    const code = mm >> m;
    const combo = mm & (1 << m) - 1;
    if (code >= n) {
      ce.push(2);
      ld.push(2);
      dData.forEach((a) => a.push(2));
      continue;
    }
    const nx = nextIdx(p, code, combo);
    if (nx < 0 || nx === code) {
      ce.push(0);
      ld.push(0);
      dData.forEach((a) => a.push(2));
    } else if (nx === (code + 1) % mod) {
      ce.push(1);
      ld.push(0);
      dData.forEach((a) => a.push(2));
    } else {
      ce.push(0);
      ld.push(1);
      dData.forEach((a, b) => a.push(nx >> k - 1 - b & 1));
    }
  }
  const functions = [
    buildFunction("CE", "count", vars, ce),
    buildFunction("LD", "load", vars, ld),
    ...bits.map((b, i) => buildFunction(`D_${b}`, "load-data", vars, dData[i]))
  ];
  const decoder = p.names.map((name2, i) => ({
    state: name2,
    code: i.toString(2).padStart(k, "0"),
    line: `Y${i}`
  }));
  return {
    scheme: "counter",
    bits,
    codes: decoder.map((d) => ({ state: d.state, code: d.code })),
    decoder,
    functions,
    devices: [
      "计数器：74161（4 位同步二进制计数器，置数端低电平有效）× 1",
      `译码器：74LS138 × ${n > 8 ? 2 : 1}，产生各状态的译码输出 Y0 … Y${n - 1}`,
      gateDevice(functions)
    ],
    notes: [
      `状态编码为计数序列：状态 i 的编码为 i 的 ${k} 位二进制数；未用编码作无关项。`,
      "CE = 1 表示计数：现态的出口为下一个编码（模 2^k），计数器加 1。",
      "LD = 1 表示置数：转移到非后继状态，计数器置入目标编码（置数值 D）；LD 优先于计数。",
      "自循环（出口回到本状态）时 CE = LD = 0，计数器保持。",
      "74161 的置数端为 LOAD̄（低有效），接 LOAD̄ = ¬LD；计数使能 ENP = ENT = CE。"
    ]
  };
}
function muxScheme(p) {
  const n = p.names.length;
  const m = p.vars.length;
  const k = bitsFor2(n);
  const pre = registerPrefix(p.vars);
  const bits = Array.from({ length: k }, (_, i) => `${pre}${k - 1 - i}`);
  const mod = 1 << k;
  const functions = [];
  for (let s = 0; s < n; s++) {
    for (let bi = 0; bi < k; bi++) {
      const val = [];
      for (let c = 0; c < 1 << m; c++) {
        const nx = nextIdx(p, s, c);
        val.push(nx >= 0 && nx >> k - 1 - bi & 1 ? 1 : 0);
      }
      functions.push(buildFunction(`${bits[bi]}|${p.names[s]}`, "mux-data", p.vars, val));
    }
  }
  const muxes = bits.map((bit, bi) => ({
    bit,
    select: [...bits],
    rows: Array.from({ length: mod }, (_, code) => {
      const codeText = code.toString(2).padStart(k, "0");
      if (code >= n) return { code: codeText, state: null, data: "0" };
      const f = functions.find((x) => x.name === `${bits[bi]}|${p.names[code]}`);
      return { code: codeText, state: p.names[code], data: f.texts[0] };
    })
  }));
  return {
    scheme: "mux",
    bits,
    codes: p.names.map((name2, i) => ({ state: name2, code: i.toString(2).padStart(k, "0") })),
    muxes,
    functions,
    devices: [
      `状态寄存器：D 触发器 × ${k}（存放 ${bits.join("、")}）`,
      ...muxes.map((mx) => `数据选择器：${muxChip(k)} × 1，输出次态位 ${mx.bit}（地址端接 ${bits.join("、")}）`),
      gateDevice(functions)
    ],
    notes: [
      `状态编码为 ${k} 位二进制数；未用编码的数据端取 0。`,
      "每个状态位的次态由一个 MUX 选择：地址端接现态，数据端 i 为现态为 i 时该位的次态条件表达式。",
      "数据端只与条件变量有关，化简后可直接接线；无条件转移时数据端为 1 或 0。"
    ]
  };
}
function sequenceScheme(p) {
  const n = p.names.length;
  const m = p.vars.length;
  const pre = registerPrefix(p.vars);
  const bits = Array.from({ length: n }, (_, i) => `${pre}${n - 1 - i}`);
  const size = 1 << n + m;
  const vars = [...bits, ...p.vars];
  const functions = [];
  for (let j = 0; j < n; j++) {
    const val = [];
    for (let mm = 0; mm < size; mm++) {
      const pat = mm >> m;
      const combo = mm & (1 << m) - 1;
      if (pat === 0 || (pat & pat - 1) !== 0) {
        val.push(2);
        continue;
      }
      const i = Math.log2(pat);
      val.push(nextIdx(p, i, combo) === j ? 1 : 0);
    }
    functions.push(buildFunction(`${pre}${j}⁺`, "next", vars, val));
  }
  return {
    scheme: "sequence",
    bits,
    codes: p.names.map((name2, i) => ({
      state: name2,
      code: bits.map((_, b) => n - 1 - b === i ? "1" : "0").join("")
    })),
    functions,
    devices: [
      `状态寄存器：D 触发器 × ${n}（一态一位），或移位寄存器 74194 × ${Math.ceil(n / 4)} 接成环形计数器`,
      gateDevice(functions)
    ],
    notes: [
      `一态一位：状态 i 对应第 i 位（记作 ${pre}i），该位为 1 表示处于状态 i，其余位为 0。`,
      `复位后 ${pre}${p.initial} = 1，其余位为 0，即初始状态为 ${p.names[p.initial]}。`,
      "无效码（不止一位为 1，或全为 0）作无关项，化简式只在有效码上等价，形式可能与直接写出的不同。",
      `次态 ${pre}j⁺ = 1 当且仅当某出口条件成立且转移到状态 j。`,
      "控制信号由对应状态位直接译出（条件输出为状态位与条件相与）。"
    ]
  };
}
function signalCell(state, name2) {
  if (state.outputs.includes(name2)) return "1";
  const conds = state.conditionals.filter((c) => c.name === name2);
  if (conds.length > 0) return conds.map((c) => c.expr).join(" + ");
  return "0";
}
function designController(spec) {
  const p = prepareAsm(spec);
  const errors = p.issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    throw new DlogicInputError(`ASM 图未通过校验，无法设计控制器：${errors.map((e) => e.message).join("；")}`);
  }
  const signals = [];
  for (const s of p.states) {
    for (const o of s.outputs) if (!signals.includes(o)) signals.push(o);
    for (const c of s.conditionals) if (!signals.includes(c.name)) signals.push(c.name);
  }
  const controlTable = p.states.map((s) => ({ state: s.name, values: signals.map((sig) => signalCell(s, sig)) }));
  return {
    states: p.names,
    initial: p.names[p.initial],
    conditionVars: p.vars,
    signals,
    controlTable,
    schemes: [counterScheme(p), muxScheme(p), sequenceScheme(p)]
  };
}

// src/host/tools/system.logic.ts
var SYSTEM_OPS = ["asm", "controller"];
var SYSTEM_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: [...SYSTEM_OPS],
    description: "子功能：asm 校验 ASM 图并给出状态转移表；controller 按计数器型、多路选择器型、定序型三种方案设计控制器"
  },
  states: {
    type: "array",
    required: true,
    description: "状态框列表（至多 12 个）。顺序即编码顺序；默认第一个为初始状态。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", required: true, description: '状态名，例如 "S0"' },
        outputs: {
          type: "array",
          items: { type: "string" },
          description: "Moore 型输出（寄存器操作或控制信号名），进入本状态即有效"
        },
        conditionals: {
          type: "array",
          description: "条件输出框：name 为输出名，expr 为使其有效的条件表达式",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string", required: true, description: "条件输出名" },
              expr: { type: "string", required: true, description: "条件表达式，变量须为条件变量" }
            }
          }
        }
      }
    }
  },
  transitions: {
    type: "array",
    required: true,
    description: "判断框的出口列表。同一现态的各出口条件须互斥且完备；可用 else 表示其余情况，1 表示无条件。",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        from: { type: "string", required: true, description: "现态" },
        cond: { type: "string", required: true, description: "条件表达式（变量间用 * 或 · 或 & 连接，取反用 ' 或 ! 前缀），或 else / 1" },
        to: { type: "string", required: true, description: "次态" }
      }
    }
  },
  initial: {
    type: "string",
    description: "初始状态名，省略时取 states 的第一个"
  },
  conditionVars: {
    type: "array",
    items: { type: "string" },
    description: "条件变量的排列顺序（至多 4 个），省略时按表达式中首次出现的顺序"
  }
};
function specFromSystemArgs(args) {
  if (!Array.isArray(args.states)) throw new DlogicInputError("states 必须是数组");
  if (!Array.isArray(args.transitions)) throw new DlogicInputError("transitions 必须是数组");
  return {
    states: args.states.map((s) => ({
      name: s.name,
      outputs: Array.isArray(s.outputs) ? s.outputs : [],
      conditionals: Array.isArray(s.conditionals) ? s.conditionals : []
    })),
    transitions: args.transitions,
    initial: args.initial,
    conditionVars: args.conditionVars
  };
}
var ASM_STEPS = [
  { kind: "asmCheck", text: "逐状态检查出口条件：两两互斥，并覆盖全部取值（else 补足其余取值）。" },
  { kind: "asmReach", text: "从初始状态出发检查可达性，并检查是否存在没有出口的悬空状态。" },
  { kind: "asmTable", text: "按条件变量的全部取值列出状态转移表，与 ASM 图等价。" }
];
var CONTROLLER_STEPS = [
  { kind: "controllerEncode", text: "三种方案：计数器型按计数序列编码，多路选择器型用二进制编码，定序型一态一位。" },
  { kind: "controllerMinimize", text: "次态与控制函数以最小项表示，未用编码作无关项，用 minimize 化简并列出全部等价最简解。" }
];
function runSystem(args) {
  return envelope(String(args.op), () => {
    const spec = specFromSystemArgs(args);
    switch (args.op) {
      case "asm": {
        const asm = analyzeAsm(spec);
        return { result: { spec, asm }, steps: ASM_STEPS };
      }
      case "controller": {
        const controller = designController(spec);
        return { result: { spec, controller }, steps: CONTROLLER_STEPS };
      }
      default:
        throw new DlogicInputError(`未知的 op：${String(args.op)}`);
    }
  });
}
function renderAsm(value, lines) {
  const a = value.result;
  const r = a.asm;
  lines.push(r.valid ? "ASM 图校验通过" : `ASM 图存在 ${r.issues.filter((i) => i.level === "error").length} 处错误`);
  for (const issue of r.issues) lines.push(`${issue.level === "error" ? "错误" : "提示"}：${issue.message}`);
  lines.push(`条件变量：${r.conditionVars.join("、") || "无"}；初始状态：${r.initial}`);
  const head = ["状态", ...r.table.combos];
  lines.push(head.join(" | "));
  for (const row of r.table.rows) {
    const cells = row.cells.map((c) => {
      const tail = c.active.length > 0 ? `（${c.active.join("、")}）` : "";
      return `${c.next ?? "—"}${tail}`;
    });
    lines.push([row.state, ...cells].join(" | "));
  }
}
function renderController(value, lines) {
  const x = value.result;
  const c = x.controller;
  lines.push(`状态：${c.states.join("、")}；初始状态：${c.initial}；条件变量：${c.conditionVars.join("、") || "无"}`);
  lines.push(`控制信号：${c.signals.join("、") || "无"}`);
  for (const row of c.controlTable) lines.push(`${row.state}：${row.values.map((v, i) => `${c.signals[i]}=${v}`).join("，")}`);
  for (const s of c.schemes) {
    lines.push(`【${s.scheme}】寄存器位：${s.bits.join(" ")}；编码：${s.codes.map((k) => `${k.state}=${k.code}`).join("，")}`);
    for (const f of s.functions) lines.push(`${f.name} = ${f.texts[0]}${f.texts.length > 1 ? `（另 ${f.texts.length - 1} 个等价解）` : ""}`);
    for (const d of s.devices) lines.push(`器件：${d}`);
  }
}
function renderSystem(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  if (value.op === "asm") renderAsm(value, lines);
  else if (value.op === "controller") renderController(value, lines);
  else lines.push("未知的 op");
  return lines.join("\n");
}

// src/host/tools/system.ts
var DESCRIPTION10 = [
  "数字系统的确定性计算。op 取值：asm 校验 ASM 图（状态框、判断框的出口与条件输出框），检查出口条件互斥与完备（缺少 else）、不可达状态与悬空状态，并给出等价的状态转移表；",
  "controller 按计数器型（状态编码为计数序列，计数器加 1 或置数，给出译码输出与计数、置数条件）、多路选择器型（每个状态位的次态由 MUX 选择，给出数据端表达式）、",
  "定序型（一态一位，给出次态表达式）三种方案设计控制器，给出状态编码表、控制信号真值表、次态表达式（全部等价最简解）与所需器件清单。",
  "ASM 图以 JSON 描述：states（至多 12 个，每项含 name、outputs 与 conditionals）与 transitions（每项 {from, cond, to}，cond 为条件表达式，或 else / 1）；条件变量至多 4 个。",
  "未通过校验的 ASM 图不生成控制器。"
].join("");
var dlogicSystem = defineTool11({
  name: "dlogic_system",
  description: DESCRIPTION10,
  parameters: SYSTEM_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderSystem(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_system", value })
  },
  async execute(args) {
    return runSystem(args);
  }
});

// src/host/tools/hdl.ts
import { defineTool as defineTool12 } from "@deepseek-ai/dsh-tools";

// src/host/tools/hdl.logic.ts
import fs3 from "node:fs";
import path3 from "node:path";

// src/shared/hdl.ts
var FS_PER_UNIT = { fs: 1, ps: 1e3, ns: 1e6, us: 1e9, ms: 1e12, s: 1e15 };
var UNIT_RE = /^(\d*)\s*(fs|ps|ns|us|ms|s)$/i;
function unitSpec(spec) {
  if (!spec) return null;
  const m = UNIT_RE.exec(spec.trim());
  if (!m) return null;
  const mul = m[1] === "" ? 1 : Number(m[1]);
  const name2 = m[2].toLowerCase();
  return { fs: mul * FS_PER_UNIT[name2], name: name2 };
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

// src/solvers/hdl.ts
var HDL_OPS = ["lint", "simulate"];
var HDL_LIMITS = {
  /** 源码上限（字节）。 */
  codeBytes: 64 * 1024,
  /** 仿真墙钟上限（毫秒）。 */
  wallMs: 1e4,
  /** 编译墙钟上限（毫秒）。 */
  compileMs: 1e4,
  /** testbench 输出上限（字节）。 */
  outputBytes: 20 * 1024,
  /** VCD 文件上限（字节）。 */
  vcdBytes: 1024 * 1024,
  /** 默认仿真时间上限（时间单位）。 */
  defaultMaxTime: 1e4,
  /** 仿真时间上限的最大值。 */
  maxTimeLimit: 1e6,
  /** 返回的信号数上限。 */
  signals: 16,
  /** 每个信号保留的变化次数上限。 */
  changesPerSignal: 300
};
function checkHdlOp(op) {
  if (typeof op === "string" && HDL_OPS.includes(op)) return op;
  if (op === void 0 || op === null || op === "") throw new DlogicInputError('缺少 op：必须明确给出 "lint" 或 "simulate"。');
  throw new DlogicInputError(`未知的 op：${String(op)}，可选 lint、simulate。`);
}
function checkCode(code) {
  if (typeof code !== "string" || code.trim() === "") throw new DlogicInputError("缺少 code：请提供 Verilog 源码（设计与 testbench）。");
  if (Buffer.byteLength(code, "utf8") > HDL_LIMITS.codeBytes) {
    throw new DlogicInputError(`源码超过 ${HDL_LIMITS.codeBytes / 1024} KB，请精简后再提交。`);
  }
  return code;
}
function checkMaxTime(v) {
  if (v === void 0) return HDL_LIMITS.defaultMaxTime;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > HDL_LIMITS.maxTimeLimit) {
    throw new DlogicInputError(`maxTimeUnits 须为 1～${HDL_LIMITS.maxTimeLimit} 之间的整数。`);
  }
  return v;
}
function maskSource(src, keepStrings = false) {
  let out = "";
  let i = 0;
  const n = src.length;
  const blank = (ch) => ch === "\n" || ch === "\r" ? ch : " ";
  while (i < n) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === "/" && next === "/") {
      while (i < n && src[i] !== "\n") {
        out += blank(src[i]);
        i++;
      }
    } else if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) {
        out += blank(src[i]);
        i++;
      }
      if (i < n) {
        out += "  ";
        i += 2;
      }
    } else if (ch === '"') {
      out += '"';
      i++;
      while (i < n && src[i] !== '"' && src[i] !== "\n") {
        if (src[i] === "\\" && i + 1 < n) {
          out += keepStrings ? src[i] + src[i + 1] : "  ";
          i += 2;
          continue;
        }
        out += keepStrings ? src[i] : blank(src[i]);
        i++;
      }
      if (i < n && src[i] === '"') {
        out += '"';
        i++;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}
function lineAt(src, index) {
  let line2 = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line2++;
  return line2;
}
function skipWs(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}
function matchParen(s, i) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "(") depth++;
    else if (s[j] === ")") {
      depth--;
      if (depth === 0) return j + 1;
    }
  }
  return s.length;
}
var BLOCK_TOKEN = /\b(begin|fork|case[xz]?|end|endcase|join)\b/g;
var BLOCK_OPEN = /* @__PURE__ */ new Set(["begin", "fork", "case", "casex", "casez"]);
function blockEnd(s, i) {
  const re = new RegExp(BLOCK_TOKEN.source, "g");
  re.lastIndex = i;
  let depth = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (BLOCK_OPEN.has(m[1])) depth++;
    else {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    }
  }
  return s.length;
}
function stmtEnd(s, i) {
  const j = skipWs(s, i);
  if (/^(begin|fork|case[xz]?)\b/.test(s.slice(j, j + 6))) return blockEnd(s, j);
  let depth = 0;
  for (let k = j; k < s.length; k++) {
    if (s[k] === "(") depth++;
    else if (s[k] === ")") depth--;
    else if (s[k] === ";" && depth <= 0) return k + 1;
  }
  return s.length;
}
var BANNED_TASK = /\$(system|f(open|close|write\w*|display\w*|monitor\w*|strobe\w*|flush|scanf|gets|getc|read|seek|tell|eof|error)|sscanf|readmem[bh]|writemem[bh]|rewind)\b/;
function checkSafety(code) {
  const masked = maskSource(code);
  const banned = BANNED_TASK.exec(masked);
  if (banned) {
    throw new DlogicInputError(
      `源码包含不允许的系统任务 ${banned[0]}（会访问文件或外部命令），已拒绝执行。仿真可使用 $display、$monitor、$dumpvars 等输出类任务。`
    );
  }
  if (/`\s*include\b/.test(masked)) {
    throw new DlogicInputError("源码包含 `include，会读取宿主文件，已拒绝执行。请把所有代码写在同一段源码中。");
  }
  const withStrings = maskSource(code, true);
  const literal = /\$dumpfile\s*\(\s*"([^"]*)"\s*\)/g;
  const calls = withStrings.match(/\$dumpfile\b/g)?.length ?? 0;
  let ok = 0;
  let m;
  while ((m = literal.exec(withStrings)) !== null) {
    const name2 = m[1];
    if (name2 === "" || /[\\/:]/.test(name2) || name2.includes("..")) {
      throw new DlogicInputError("$dumpfile 的文件名只能是当前目录下的简单文件名（不含路径）。");
    }
    ok++;
  }
  if (calls !== ok) throw new DlogicInputError('$dumpfile 的文件名必须是字符串字面量，例如 $dumpfile("wave.vcd")。');
}
function detectTop(masked, requested) {
  const names = [];
  for (const m of masked.matchAll(/\bmodule\s+([A-Za-z_]\w*)/g)) if (!names.includes(m[1])) names.push(m[1]);
  if (names.length === 0) throw new DlogicInputError("源码中未找到 module 定义。");
  if (requested !== void 0) {
    if (!names.includes(requested)) {
      throw new DlogicInputError(`未找到顶层模块 ${requested}，源码中的模块有：${names.join("、")}。`);
    }
    return { top: requested, warning: null };
  }
  let roots = names.filter((n) => (masked.match(new RegExp(`\\b${n}\\b`, "g"))?.length ?? 0) <= 1);
  if (roots.length === 0) roots = [names[names.length - 1]];
  const preferred = roots.filter((n) => /tb|test|bench/i.test(n));
  const top = preferred.length > 0 ? preferred[0] : roots[0];
  const warning = roots.length > 1 ? `检测到多个顶层候选模块（${roots.join("、")}），已选 ${top}；可用 top 参数指定。` : null;
  return { top, warning };
}
function timescaleOf(masked) {
  const m = /`timescale\s+(\S+?)\s*\/\s*(\S+)/.exec(masked);
  return m ? `${m[1]}/${m[2]}` : null;
}
function buildWatchdog(maxTimeUnits, timescale) {
  const lines = [];
  if (timescale) lines.push("`timescale " + timescale);
  lines.push(
    "module dlogic_watchdog;",
    "  initial begin",
    `    #${maxTimeUnits};`,
    '    $display("DLOGIC_WATCHDOG_TIMEOUT");',
    "    $finish;",
    "  end",
    "endmodule",
    ""
  );
  return lines.join("\n");
}
var AUTO_DUMP_FILE = "dlogic_wave.vcd";
function hasDumpvars(masked) {
  return /\$dumpvars\b/.test(masked);
}
function buildDumpRoot(top, timescale) {
  const lines = [];
  if (timescale) lines.push("`timescale " + timescale);
  lines.push(
    "module dlogic_dump;",
    "  initial begin",
    `    $dumpfile("${AUTO_DUMP_FILE}");`,
    `    $dumpvars(0, ${top});`,
    "  end",
    "endmodule",
    ""
  );
  return lines.join("\n");
}
function targetBefore(s, opIndex) {
  const head = s.slice(Math.max(0, opIndex - 80), opIndex);
  const m = /([A-Za-z_]\w*)\s*(\[[^[\]]*\]\s*)?$/.exec(head);
  return m ? m[1] : null;
}
function scanAssigns(body) {
  const ops = [];
  let depth = 0;
  let seen = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth <= 0) {
      seen = false;
      depth = 0;
    } else if (depth === 0) {
      if (ch === "<" && body[i + 1] === "=" && body[i - 1] !== "<") {
        if (!seen) ops.push({ kind: "nba", index: i, target: targetBefore(body, i) });
        seen = true;
        i++;
      } else if (ch === "=" && body[i + 1] !== "=" && !"=!<>+-*/%&|^".includes(body[i - 1] ?? "")) {
        if (!seen) ops.push({ kind: "blocking", index: i, target: targetBefore(body, i) });
        seen = true;
      }
    }
  }
  return ops;
}
function hasAssignment(text2) {
  return /(^|[^=!<>])=(?!=)/.test(text2) || /<=/.test(text2);
}
function targetsOf(text2) {
  const out = /* @__PURE__ */ new Set();
  for (const op of scanAssigns(text2)) if (op.target) out.add(op.target);
  return out;
}
function latchRisk(body, at, branch) {
  const assigned = targetsOf(branch);
  if (assigned.size === 0) return false;
  const before = unconditionalTargets(body.slice(0, at));
  return [...assigned].some((name2) => !before.has(name2));
}
function unconditionalTargets(text2) {
  const out = /* @__PURE__ */ new Set();
  for (const op of scanAssigns(text2)) {
    if (!op.target) continue;
    const head = text2.slice(0, op.index);
    let start = 0;
    let kind = "";
    let kindAt = -1;
    for (const m of head.matchAll(/;|\bbegin\b|\bend\b|\belse\b/g)) {
      start = (m.index ?? 0) + m[0].length;
      kind = m[0];
      kindAt = m.index ?? -1;
    }
    const seg = head.slice(start);
    let conditional = kind === "else" || /\b(if|case[xz]?)\b|:\s*$/.test(seg);
    if (kind === "begin") {
      const pre = head.slice(0, kindAt).trimEnd();
      if (/[):]$|\belse$/.test(pre)) conditional = true;
    }
    if (!conditional) out.add(op.target);
  }
  return out;
}
function ruleLint(code) {
  const src = maskSource(code);
  const hits = [];
  const drivers = /* @__PURE__ */ new Map();
  let blockId = 0;
  const addDriver = (name2, id, line2) => {
    const list = drivers.get(name2) ?? [];
    list.push({ id, line: line2 });
    drivers.set(name2, list);
  };
  for (const m of src.matchAll(/\bassign\s+([A-Za-z_]\w*)/g)) {
    blockId++;
    addDriver(m[1], blockId, lineAt(src, m.index ?? 0));
  }
  for (const m of src.matchAll(/\balways(_comb|_ff|_latch)?\b/g)) {
    if (m[1] === "_latch") continue;
    let i = skipWs(src, (m.index ?? 0) + m[0].length);
    let kind = null;
    if (src[i] === "@") {
      i = skipWs(src, i + 1);
      let content = "*";
      if (src[i] === "(") {
        const close = matchParen(src, i);
        content = src.slice(i + 1, close - 1).trim();
        i = close;
      } else if (src[i] === "*") {
        i++;
      }
      kind = /posedge|negedge/.test(content) ? "seq" : "comb";
    } else if (m[1] === "_comb") kind = "comb";
    else if (m[1] === "_ff") kind = "seq";
    if (kind === null) continue;
    i = skipWs(src, i);
    const end = stmtEnd(src, i);
    const body = src.slice(i, end);
    blockId++;
    const id = blockId;
    for (const op of scanAssigns(body)) {
      const line2 = lineAt(src, i + op.index);
      if (op.target) addDriver(op.target, id, line2);
      if (kind === "comb" && op.kind === "nba") {
        hits.push({ rule: "nba-in-comb", line: line2, severity: "warning", message: "组合逻辑块中使用了非阻塞赋值 <=，建议改用阻塞赋值 =。" });
      }
      if (kind === "seq" && op.kind === "blocking") {
        hits.push({ rule: "blocking-in-seq", line: line2, severity: "warning", message: "时序逻辑块（posedge/negedge）中使用了阻塞赋值 =，建议改用非阻塞赋值 <=。" });
      }
    }
    if (kind === "comb") {
      for (const m2 of body.matchAll(/\bif\b/g)) {
        const at = m2.index ?? 0;
        let j = skipWs(body, at + 2);
        if (body[j] !== "(") continue;
        j = skipWs(body, matchParen(body, j));
        const after = stmtEnd(body, j);
        const stmt = body.slice(j, after);
        const elseRe = /else\b/y;
        elseRe.lastIndex = skipWs(body, after);
        if (!elseRe.test(body) && hasAssignment(stmt) && latchRisk(body, at, stmt)) {
          hits.push({
            rule: "latch",
            line: lineAt(src, i + at),
            severity: "warning",
            message: "if 没有 else 分支，组合逻辑块中可能推断出锁存器；请在每个分支赋予明确的值，或在 always 开头给默认值。"
          });
        }
      }
      for (const m2 of body.matchAll(/\bcase[xz]?\b/g)) {
        const at = m2.index ?? 0;
        const endRe = /\bendcase\b/g;
        endRe.lastIndex = at;
        const e = endRe.exec(body);
        const span = body.slice(at, e ? e.index : body.length);
        if (!/\bdefault\b/.test(span) && hasAssignment(span) && latchRisk(body, at, span)) {
          hits.push({
            rule: "case-default",
            line: lineAt(src, i + at),
            severity: "warning",
            message: "case 没有 default 分支，组合逻辑块中可能推断出锁存器；建议补充 default 并给出赋值。"
          });
        }
      }
    }
  }
  for (const [name2, list] of drivers) {
    const firstId = list[0].id;
    const other = list.find((d) => d.id !== firstId);
    if (other) {
      hits.push({
        rule: "multi-driver",
        line: other.line,
        severity: "error",
        message: `信号 ${name2} 被多个 always 或 assign 驱动，综合时会产生多驱动冲突。`
      });
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return hits.sort((a, b) => a.line - b.line).filter((h) => {
    const key = `${h.rule}:${h.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function parseIverilogOutput(text2, fileName = "design.v") {
  const issues = [];
  for (const raw of text2.split(/\r?\n/)) {
    const line2 = raw.trimEnd();
    if (line2 === "") continue;
    const m = /^(?:(.+?):)?(\d+):\s*(.*)$/.exec(line2);
    if (m) {
      const file = m[1];
      if (file !== void 0 && !file.endsWith(fileName)) continue;
      const rest = m[3];
      if (rest.startsWith(":")) {
        const last = issues[issues.length - 1];
        if (last) last.message = `${last.message} ${rest.slice(1).trim()}`.trim();
        continue;
      }
      issues.push(toIssue(Number(m[2]), rest));
      continue;
    }
    const bare = /^(error|warning|sorry):\s*(.*)$/.exec(line2);
    if (bare) issues.push({ line: null, severity: bare[1] === "error" ? "error" : "warning", message: bare[2] });
  }
  return issues;
}
function toIssue(line2, rest) {
  const tagged = /^(error|warning|sorry):\s*(.*)$/.exec(rest);
  if (tagged) return { line: line2, severity: tagged[1] === "error" ? "error" : "warning", message: tagged[2] };
  return { line: line2, severity: "error", message: rest };
}
function formatCompileErrors(issues) {
  const errs = issues.filter((i) => i.severity === "error");
  const shown = errs.slice(0, 5).map((i) => i.line === null ? i.message : `第 ${i.line} 行：${i.message}`);
  const more = errs.length > 5 ? `；另有 ${errs.length - 5} 条` : "";
  return shown.length ? shown.join("；") + more : "编译未通过";
}
var BARE_KEYWORDS = /* @__PURE__ */ new Set(["$end", "$enddefinitions", "$dumpvars", "$dumpall", "$dumpon", "$dumpoff"]);
function parseVcd(text2, opts = {}) {
  const maxSignals = opts.maxSignals ?? HDL_LIMITS.signals;
  const maxChanges = opts.maxChanges ?? HDL_LIMITS.changesPerSignal;
  const tokens = text2.split(/\s+/).filter((t) => t !== "");
  const scope = [];
  const byId = /* @__PURE__ */ new Map();
  const signals = [];
  let timescale = null;
  let truncated = false;
  let time = 0;
  const pushChange = (sig, value) => {
    const last = sig.changes[sig.changes.length - 1];
    if (last && last.value === value) return;
    if (sig.changes.length >= maxChanges) {
      truncated = true;
      return;
    }
    const change = { time, value };
    sig.changes.push(change);
  };
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "$timescale") {
      const parts = [];
      i++;
      while (i < tokens.length && tokens[i] !== "$end") parts.push(tokens[i++]);
      if (timescale === null && parts.length) timescale = parts.join("");
      i++;
    } else if (tok === "$scope") {
      scope.push(tokens[i + 2] ?? "");
      while (i < tokens.length && tokens[i] !== "$end") i++;
      i++;
    } else if (tok === "$upscope") {
      scope.pop();
      while (i < tokens.length && tokens[i] !== "$end") i++;
      i++;
    } else if (tok === "$var") {
      const parts = [];
      i++;
      while (i < tokens.length && tokens[i] !== "$end") parts.push(tokens[i++]);
      i++;
      const width = Number(parts[1]);
      const id = parts[2];
      const ref = parts[3] ?? "";
      if (id !== void 0 && !byId.has(id)) {
        if (signals.length < maxSignals) {
          const sig = {
            name: [...scope, ref].filter(Boolean).join("."),
            width: Number.isFinite(width) && width > 0 ? width : 1,
            changes: []
          };
          signals.push(sig);
          byId.set(id, sig);
        } else {
          truncated = true;
          byId.set(id, null);
        }
      }
    } else if (BARE_KEYWORDS.has(tok)) {
      i++;
    } else if (tok.startsWith("$")) {
      while (i < tokens.length && tokens[i] !== "$end") i++;
      i++;
    } else if (tok.startsWith("#")) {
      const t = Number(tok.slice(1));
      if (Number.isFinite(t)) time = t;
      i++;
    } else if (/^[01xzXZ]/.test(tok) && tok.length > 1) {
      const sig = byId.get(tok.slice(1));
      if (sig) pushChange(sig, tok[0].toLowerCase());
      i++;
    } else if (/^[bBrR]/.test(tok)) {
      const sig = i + 1 < tokens.length ? byId.get(tokens[i + 1]) : void 0;
      if (sig) pushChange(sig, tok.slice(1).toLowerCase());
      i += 2;
    } else {
      i++;
    }
  }
  return { timescale, signals, truncated };
}

// src/host/tools/hdl.exec.ts
import { spawn, spawnSync } from "node:child_process";
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";
var IVERILOG_DEFAULT_DIR = "C:\\msys64\\ucrt64\\bin";
var EXE = process.platform === "win32" ? ".exe" : "";
function toolFile(dir, name2) {
  return path2.join(dir, name2 + EXE);
}
function findIverilogDir(env = process.env, exists = fs2.existsSync) {
  const candidates = [];
  if (env.DLOGIC_IVERILOG_DIR) candidates.push(env.DLOGIC_IVERILOG_DIR);
  candidates.push(IVERILOG_DEFAULT_DIR);
  const pathVar = pathValue(env);
  for (const d of pathVar.split(path2.delimiter)) if (d) candidates.push(d);
  for (const dir of candidates) {
    if (exists(toolFile(dir, "iverilog"))) return dir;
  }
  return null;
}
function pathValue(env) {
  for (const k of Object.keys(env)) if (k.toUpperCase() === "PATH") return env[k] ?? "";
  return "";
}
function childEnv(dir, base = process.env) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (v !== void 0 && k.toUpperCase() !== "PATH") env[k] = v;
  env.PATH = [dir, pathValue(base)].filter(Boolean).join(path2.delimiter);
  return env;
}
var versionCache = /* @__PURE__ */ new Map();
function iverilogVersion(dir) {
  if (versionCache.has(dir)) return versionCache.get(dir) ?? null;
  let version = null;
  try {
    const r = spawnSync(toolFile(dir, "iverilog"), ["-V"], { encoding: "utf8", timeout: 5e3, windowsHide: true, env: childEnv(dir) });
    const m = /Icarus Verilog version (\S+)/.exec(r.stdout ?? "");
    version = m ? m[1] : null;
  } catch {
    version = null;
  }
  versionCache.set(dir, version);
  return version;
}
function runProcess(file, args, opts) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(file, args, { cwd: opts.cwd, env: opts.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      resolve({ code: null, stdout: "", stderr: "", killed: null, spawnError: String(e) });
      return;
    }
    let stdout = "";
    let stderr = "";
    let killed = null;
    let done = false;
    const maxBytes = opts.maxStdoutBytes ?? Number.POSITIVE_INFINITY;
    let bytes = 0;
    const kill = (reason) => {
      if (killed === null) {
        killed = reason;
        child.kill();
      }
    };
    const timer = setTimeout(() => kill("wall_clock"), opts.timeoutMs);
    const poll = opts.watch ? setInterval(() => {
      const r = opts.watch?.();
      if (r) kill(r);
    }, 100) : null;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (bytes >= maxBytes) return;
      bytes += Buffer.byteLength(chunk, "utf8");
      stdout += chunk;
      if (bytes > maxBytes) {
        stdout = Buffer.from(stdout, "utf8").subarray(0, maxBytes).toString("utf8");
        kill("output_limit");
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 64 * 1024) stderr += chunk;
    });
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      resolve(result);
    };
    child.on("error", (err) => finish({ code: null, stdout, stderr, killed, spawnError: err.message }));
    child.on("close", (code) => finish({ code, stdout, stderr, killed, spawnError: null }));
  });
}
async function withTempDir(fn) {
  const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), "dlogic-hdl-"));
  try {
    return await fn(dir);
  } finally {
    try {
      fs2.rmSync(dir, { recursive: true, force: true });
    } catch {
    }
  }
}
function vcdBytesIn(dir) {
  let total = 0;
  try {
    for (const f of fs2.readdirSync(dir)) {
      if (!f.endsWith(".vcd")) continue;
      try {
        total += fs2.statSync(path2.join(dir, f)).size;
      } catch {
      }
    }
  } catch {
  }
  return total;
}
function firstVcd(dir) {
  try {
    const f = fs2.readdirSync(dir).find((x) => x.endsWith(".vcd"));
    if (!f) return null;
    const file = path2.join(dir, f);
    return { file, size: fs2.statSync(file).size };
  } catch {
    return null;
  }
}

// src/host/tools/hdl.logic.ts
var HDL_PARAMETERS = {
  op: {
    type: "string",
    required: true,
    enum: ["lint", "simulate"],
    description: "lint 静态检查（iverilog 诊断加规则匹配）；simulate 编译运行 testbench，返回输出与波形。"
  },
  code: {
    type: "string",
    required: true,
    description: "Verilog 源码。设计与 testbench 放在同一段代码中，不超过 64 KB。禁止 $system、文件读写类系统任务与 `include。"
  },
  top: {
    type: "string",
    description: "simulate：顶层 testbench 模块名。缺省时自动识别未被其他模块实例化的模块。"
  },
  maxTimeUnits: {
    type: "integer",
    description: `simulate：仿真时间上限（testbench 的时间单位），默认 ${HDL_LIMITS.defaultMaxTime}，最大 ${HDL_LIMITS.maxTimeLimit}；到达后强制结束。`
  }
};
var NOTICE_RULES_ONLY = "本机未找到 iverilog，只完成了规则匹配，未做编译检查，检查能力已降级。安装 Icarus Verilog 后可启用完整检查；若已安装，设置环境变量 DLOGIC_IVERILOG_DIR 指向其所在目录。";
var ERR_NO_IVERILOG = "未找到 iverilog，无法仿真。请安装 Icarus Verilog（MSYS2 下可用 pacman -S mingw-w64-ucrt-x86_64-iverilog），并设置环境变量 DLOGIC_IVERILOG_DIR 指向其所在目录。";
var END_TEXT = {
  finish: "遇到 $finish 正常结束",
  timeout: "达到时间上限，已强制结束",
  idle: "事件耗尽，自行结束（未调用 $finish）",
  wall_clock: `运行超过 ${HDL_LIMITS.wallMs / 1e3} 秒，已强制结束`,
  output_limit: `输出超过 ${HDL_LIMITS.outputBytes / 1024} KB，已截断并结束`,
  vcd_limit: `VCD 超过 ${HDL_LIMITS.vcdBytes / 1024 / 1024} MB，已结束`
};
var WATCHDOG_MARKER = "DLOGIC_WATCHDOG_TIMEOUT";
async function runHdl(args, iverilogDir = findIverilogDir()) {
  let op = String(args.op);
  try {
    op = checkHdlOp(args.op);
    const out = op === "lint" ? await lint(args, iverilogDir) : await simulate(args, iverilogDir);
    const clean = (v) => JSON.parse(JSON.stringify(v));
    return { ok: true, op, result: clean(out.result), steps: clean(out.steps), warnings: out.warnings };
  } catch (error) {
    if (error instanceof DlogicInputError) return { ok: false, op, result: null, error: error.message, steps: [], warnings: [] };
    throw error;
  }
}
async function lint(args, dir) {
  const code = checkCode(args.code);
  checkSafety(code);
  const ruleHits = ruleLint(code);
  if (dir === null) {
    const result2 = { engine: "rules", iverilogVersion: null, issues: [], ruleHits, notice: NOTICE_RULES_ONLY };
    return { result: result2, steps: [{ kind: "lint", text: `规则匹配：${ruleHits.length} 条提示（未运行 iverilog）` }], warnings: [NOTICE_RULES_ONLY] };
  }
  const issues = await withTempDir(async (tmp) => {
    fs3.writeFileSync(path3.join(tmp, "design.v"), code, "utf8");
    const r = await runProcess(toolFile(dir, "iverilog"), ["-Wall", "-g2012", "-o", "lint.vvp", "design.v"], {
      cwd: tmp,
      env: childEnv(dir),
      timeoutMs: HDL_LIMITS.compileMs
    });
    if (r.spawnError) return [{ line: null, severity: "error", message: `无法运行 iverilog：${r.spawnError}` }];
    if (r.killed) return [{ line: null, severity: "error", message: "iverilog 运行超时" }];
    return parseIverilogOutput(`${r.stdout}
${r.stderr}`);
  });
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warning").length;
  const result = { engine: "iverilog", iverilogVersion: iverilogVersion(dir), issues, ruleHits, notice: null };
  return {
    result,
    steps: [{ kind: "lint", text: `iverilog：错误 ${errors} 个，警告 ${warns} 个；规则提示 ${ruleHits.length} 条` }],
    warnings: []
  };
}
async function simulate(args, dir) {
  const code = checkCode(args.code);
  checkSafety(code);
  const maxTime = checkMaxTime(args.maxTimeUnits);
  const masked = maskSource(code);
  const requested = typeof args.top === "string" && args.top !== "" ? args.top : void 0;
  const { top, warning } = detectTop(masked, requested);
  const timescale = timescaleOf(masked);
  if (dir === null) throw new DlogicInputError(ERR_NO_IVERILOG);
  const version = iverilogVersion(dir);
  const env = childEnv(dir);
  const warnings = warning ? [warning] : [];
  const autoDump = !hasDumpvars(masked);
  return withTempDir(async (tmp) => {
    fs3.writeFileSync(path3.join(tmp, "design.v"), code, "utf8");
    fs3.writeFileSync(path3.join(tmp, "dlogic_watchdog.v"), buildWatchdog(maxTime, timescale), "utf8");
    const extraFiles = [];
    const extraRoots = [];
    if (autoDump) {
      fs3.writeFileSync(path3.join(tmp, "dlogic_dump.v"), buildDumpRoot(top, timescale), "utf8");
      extraFiles.push("dlogic_dump.v");
      extraRoots.push("-s", "dlogic_dump");
    }
    const compile = await runProcess(
      toolFile(dir, "iverilog"),
      ["-g2012", "-s", top, "-s", "dlogic_watchdog", ...extraRoots, "-o", "sim.vvp", "design.v", "dlogic_watchdog.v", ...extraFiles],
      { cwd: tmp, env, timeoutMs: HDL_LIMITS.compileMs }
    );
    if (compile.spawnError) throw new DlogicInputError(`无法运行 iverilog：${compile.spawnError}`);
    if (compile.killed) throw new DlogicInputError("编译超时，请精简源码后重试。");
    const diags = parseIverilogOutput(`${compile.stdout}
${compile.stderr}`);
    if (compile.code !== 0 || diags.some((d) => d.severity === "error")) {
      throw new DlogicInputError(`编译失败：${formatCompileErrors(diags)}`);
    }
    for (const d of diags.filter((x) => x.severity === "warning").slice(0, 3)) {
      warnings.push(`编译警告${d.line === null ? "" : `（第 ${d.line} 行）`}：${d.message}`);
    }
    const run = await runProcess(toolFile(dir, "vvp"), ["sim.vvp"], {
      cwd: tmp,
      env,
      timeoutMs: HDL_LIMITS.wallMs,
      maxStdoutBytes: HDL_LIMITS.outputBytes,
      watch: () => vcdBytesIn(tmp) > HDL_LIMITS.vcdBytes ? "vcd_limit" : null
    });
    if (run.spawnError) throw new DlogicInputError(`无法运行 vvp：${run.spawnError}`);
    const timedOut = run.stdout.includes(WATCHDOG_MARKER);
    const output = run.stdout.split(/\r?\n/).filter((l) => l !== "" && !l.startsWith("VCD info:") && l !== WATCHDOG_MARKER);
    const finish = parseFinish(run.stdout);
    const finishTime = finish ? finish.time : null;
    const end = timedOut ? "timeout" : run.killed ?? (finishTime !== null ? "finish" : "idle");
    const vcd = readVcd(tmp);
    const precision = (timescale ?? "").split("/")[1] ?? null;
    const sim = {
      engine: "iverilog",
      iverilogVersion: version,
      top,
      maxTimeUnits: maxTime,
      timescale: timescale ?? vcd.timescale,
      tickUnit: normalizeUnit(finish?.unit ?? vcd.timescale ?? precision),
      end,
      finishTime,
      output,
      outputTruncated: run.killed === "output_limit",
      signals: vcd.signals,
      vcdTruncated: vcd.truncated
    };
    const unit = timeUnitOf(sim.timescale) ?? sim.tickUnit;
    if (end === "timeout") {
      warnings.push(`已达到时间上限 ${maxTime}${unit ? " " + unit : ""}，仿真被强制结束；如需更长时间可调大 maxTimeUnits。`);
    }
    if (end === "wall_clock" || end === "output_limit" || end === "vcd_limit") warnings.push(END_TEXT[end] + "。");
    if (vcd.truncated) warnings.push("VCD 波形数据已截断，只保留前若干路信号。");
    const label = simFinishLabel(sim);
    const when = label !== null ? `，$finish 于 ${label}` : "";
    return {
      result: sim,
      steps: [{ kind: "simulate", text: `顶层 ${top}：${END_TEXT[end]}${when}` }],
      warnings
    };
  });
}
function readVcd(dir) {
  const f = firstVcd(dir);
  if (!f) return { signals: [], timescale: null, truncated: false };
  const n = Math.min(f.size, HDL_LIMITS.vcdBytes);
  const buf = Buffer.alloc(n);
  const fd = fs3.openSync(f.file, "r");
  try {
    fs3.readSync(fd, buf, 0, n, 0);
  } finally {
    fs3.closeSync(fd);
  }
  const parsed = parseVcd(buf.toString("utf8"));
  return { signals: parsed.signals, timescale: parsed.timescale, truncated: f.size > HDL_LIMITS.vcdBytes || parsed.truncated };
}
var SHOW = 30;
function renderLint(r, lines) {
  lines.push(r.engine === "iverilog" ? `检查引擎：iverilog ${r.iverilogVersion ?? ""}`.trim() : "检查引擎：仅规则匹配（能力降级）");
  if (r.notice) lines.push(r.notice);
  if (r.issues.length === 0 && r.engine === "iverilog") lines.push("iverilog 未报告错误或警告。");
  for (const i of r.issues.slice(0, SHOW)) {
    lines.push(`${i.line === null ? "" : `第 ${i.line} 行 `}${i.severity === "error" ? "错误" : i.severity === "warning" ? "警告" : "提示"}：${i.message}`);
  }
  for (const h of r.ruleHits.slice(0, SHOW)) lines.push(`规则 ${h.rule}，第 ${h.line} 行：${h.message}`);
  if (r.issues.length === 0 && r.ruleHits.length === 0) lines.push("未发现问题。");
}
function parseFinish(stdout) {
  const m = /\$finish called at (\d+)(?: \((\w+)\))?/.exec(stdout);
  return m ? { time: Number(m[1]), unit: normalizeUnit(m[2] ?? null) } : null;
}
function renderSim(r, lines) {
  const label = simFinishLabel(r);
  lines.push(`顶层 ${r.top}；${END_TEXT[r.end]}${label !== null ? `；结束于 ${label}` : ""}`);
  for (const l of r.output.slice(0, 60)) lines.push(l);
  if (r.output.length > 60) lines.push(`其余 ${r.output.length - 60} 行略去`);
  for (const s of r.signals.slice(0, SHOW)) lines.push(`信号 ${s.name}（${s.width} 位）：${s.changes.length} 次变化`);
}
function renderHdl(value) {
  if (!value.ok || value.result === null) return `输入有误：${value.error ?? "未知错误"}`;
  const lines = [];
  if (value.op === "lint") renderLint(value.result, lines);
  else if (value.op === "simulate") renderSim(value.result, lines);
  else lines.push("（无可显示的结果）");
  if (value.warnings.length) lines.push(...value.warnings.map((w) => `注意：${w}`));
  return lines.join("\n");
}

// src/host/tools/hdl.ts
var DESCRIPTION11 = [
  "Verilog 的静态检查与仿真。op 取值：lint 静态检查，先用 iverilog 的 -Wall 取错误与警告，再做规则匹配（推断锁存器、组合块用 <=、时序块用 =、多驱动）；",
  "未安装 iverilog 时只做规则匹配，结果中 engine 为 rules 并附降级说明。simulate 在临时目录编译运行 testbench（需要 iverilog），返回 $display 输出与信号变化，",
  "有上限：墙钟约 10 秒、输出约 20 KB、VCD 约 1 MB，禁止 $system、文件读写类任务与 `include。",
  "设计与 testbench 放在同一段 code 中；top 缺省时自动识别顶层。无需在 testbench 里写 $dumpfile/$dumpvars，仿真会自动记录波形。"
].join("");
var dlogicHdl = defineTool12({
  name: "dlogic_hdl",
  description: DESCRIPTION11,
  parameters: HDL_PARAMETERS,
  output: {
    schema: ENVELOPE_SCHEMA,
    render: (_args, value) => [{ type: "text", text: renderHdl(value) }],
    presentationMeta: (_args, value) => ({ v: 1, tool: "dlogic_hdl", value })
  },
  async execute(args) {
    return runHdl(args);
  }
});

// src/shared/tree.ts
var EMPTY_TREE = { nodes: [] };
function isObj2(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isFollowupLike(x) {
  return isObj2(x) && typeof x.question === "string";
}
function isCardRecord(x) {
  if (!isObj2(x)) return false;
  return typeof x.nodeId === "string" && x.nodeId !== "" && typeof x.callId === "string" && x.callId !== "" && typeof x.title === "string" && typeof x.summary === "string" && typeof x.kind === "string" && Array.isArray(x.knowledgeIds) && Array.isArray(x.followups) && x.followups.every(isFollowupLike) && (x.parentId === null || typeof x.parentId === "string");
}
function extractCard(event) {
  if (!isObj2(event) || event.type !== "tool/result") return null;
  const data = event.data;
  if (!isObj2(data)) return null;
  const meta = data.meta;
  if (!isObj2(meta) || meta.v !== 1 || meta.tool !== "dlogic_card") return null;
  const value = meta.value;
  if (!isObj2(value) || value.ok !== true) return null;
  return isCardRecord(value.result) ? value.result : null;
}
function applyTreeEvent(state, event) {
  const record = extractCard(event);
  if (!record) return state;
  if (state.nodes.some((n) => n.callId === record.callId)) return state;
  const taken = new Set(state.nodes.map((n) => n.nodeId));
  let nodeId = record.nodeId;
  if (taken.has(nodeId)) {
    let k = 2;
    while (taken.has(`${record.nodeId}-${k}`)) k++;
    nodeId = `${record.nodeId}-${k}`;
  }
  return { nodes: [...state.nodes, { ...record, nodeId }] };
}
var viewCache = /* @__PURE__ */ new WeakMap();
function treeView(state) {
  let view = viewCache.get(state);
  if (!view) {
    view = { v: 1, nodes: state.nodes };
    viewCache.set(state, view);
  }
  return view;
}

// src/host/projection.ts
import { z } from "zod";
function isTreeState(v) {
  if (typeof v !== "object" || v === null) return false;
  const nodes = v.nodes;
  return Array.isArray(nodes) && nodes.every((n) => typeof n === "object" && n !== null);
}
function isTreeView(v) {
  if (typeof v !== "object" || v === null) return false;
  const view = v;
  return view.v === 1 && Array.isArray(view.nodes);
}
var treeProjectionDefinition = {
  key: TREE_PROJECTION_KEY,
  // v2：v1 按工具名识别事件（DSH 的 tool/result 不带工具名），已缓存的 v1 状态全部作废。
  stateVersion: 2,
  stateSchema: z.custom(isTreeState),
  init: () => EMPTY_TREE,
  apply: applyTreeEvent,
  wire: {
    viewSchema: z.custom(isTreeView),
    view: treeView
  }
};
function registerTreeProjection(ctx) {
  ctx.sessionProjections.register(treeProjectionDefinition);
}

// src/shared/sidechat.ts
var FOLLOWUP_COMMAND = "dlogic-ask";
var FOLLOWUP_CHILD_LABEL = "数字逻辑追问";
var FOLLOWUP_OPENING = "你是《数字逻辑》学习树的追问助手，只负责回答学生从学习树点开的追问。先加载 digital-logic-tutor 技能并严格遵守；每条消息都包含背景与要求，按要求回答并登记卡片。";

// src/host/followup.ts
var MAX_PROMPT_LENGTH = 8e3;
function parseFollowupInput(raw) {
  const text2 = raw.trim();
  if (text2 === "") throw new Error("追问参数为空。");
  let data;
  try {
    data = JSON.parse(text2);
  } catch {
    throw new Error("追问参数不是合法的 JSON。");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("追问参数必须是一个对象。");
  }
  const { v, prompt } = data;
  if (v !== 1) throw new Error("追问参数版本不受支持（需要 v: 1）。");
  if (typeof prompt !== "string" || prompt.trim() === "") throw new Error("追问内容 prompt 不能为空。");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error(`追问内容过长（上限 ${MAX_PROMPT_LENGTH} 字符）。`);
  return { v: 1, prompt };
}
async function startFollowupChild(subagents, opts) {
  if (typeof subagents.startActivation === "function") {
    await subagents.startActivation(opts);
    return;
  }
  if (typeof subagents.startContinuable === "function") {
    await subagents.startContinuable(opts);
    return;
  }
  throw new Error("当前 DSH 版本不支持可继续的子代理");
}
function registerFollowupCommand(ctx) {
  ctx.inject(["commands", "subagents"], (ctx2) => {
    ctx2.effect(
      () => ctx2.commands.register(
        {
          name: FOLLOWUP_COMMAND,
          description: "侧边追问",
          input: { hint: "<json>" },
          handler: async ({ agent, rawInput, signal }) => {
            let input;
            try {
              input = parseFollowupInput(typeof rawInput === "string" ? rawInput : "");
            } catch (error) {
              return { kind: "error", text: error.message };
            }
            try {
              await startFollowupChild(ctx2.get("subagents"), {
                provider: "spawn",
                label: FOLLOWUP_CHILD_LABEL,
                request: {
                  parent: agent,
                  prompt: [{ type: "text", text: FOLLOWUP_OPENING + "\n\n" + input.prompt }]
                },
                signal,
                delivery: "caller"
              });
              return { kind: "success", text: "已发送到侧边追问" };
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              return { kind: "error", text: "创建追问失败：" + message };
            }
          }
        }
      ),
      FOLLOWUP_COMMAND
    );
  });
}

// src/host/ask.ts
import fs4 from "node:fs";
import os3 from "node:os";
import path4 from "node:path";

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
  原理: "principle",
  变式: "variant",
  易错: "pitfall",
  前置: "prerequisite",
  验证: "verify",
  练习: "practice",
  延伸: "free"
};
function clipChars(text2, max) {
  const chars = Array.from(text2);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text2;
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
function isFollowupMark(line2) {
  const core = line2.replace(/[*_`#>[\]【】]/g, "").trim();
  return /^追问\s*[：:]?$/.test(core);
}
var LIST_PREFIX = /^(?:[-–—·•*●]|\d+\s*[.、)）])\s*/;
var FIELD_SEP = /\s*[|｜]\s*/;
function parseFollowupLine(raw) {
  let line2 = raw.trim().replace(LIST_PREFIX, "").replace(/\*\*/g, "").trim();
  if (line2 === "" || /^[\s\-–—_=~*]+$/.test(line2)) return null;
  if (!FIELD_SEP.test(line2)) return { question: line2, angle: "free", why: "" };
  const [question, angle, ...rest] = line2.split(FIELD_SEP);
  return { question: question ?? "", angle: angleOf(angle), why: rest.join(" ") };
}
function parseAskAnswer(text2) {
  try {
    const source = String(text2 ?? "");
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
    return { answer: String(text2 ?? "").trim(), followups: [] };
  }
}

// src/host/ask.ts
var ASK_MAX_TOKENS = 4096;
var ASK_REASONING_EFFORT = "off";
var ASK_RAW_LOG_NAME = "dlogic-ask-raw.log";
var ASK_RAW_LOG_MAX_BYTES = 200 * 1024;
var MAX_QUESTION_LENGTH = 12e3;
var MAX_PATH_LENGTH = 60;
var PATH_SUMMARY_MAX = 160;
var MAX_LOCAL_FACTS_LENGTH = 4e3;
var CANCELLED_TEXT = "追问已取消。";
function buildAskSystemPrompt() {
  return [
    "你是数字逻辑课程的助教。",
    "只回答用户这一个追问，不要展开其他知识点。",
    "回答不超过 120 个字，用直接的陈述句。",
    "不要提及工具、核对、自我纠正或你的推理过程。",
    "正文最后一行单独写“结论：”加一句话的结论。",
    "用纯文本回答，不要使用 LaTeX、\\(\\)、\\[\\]、$ 等数学标记。",
    "非（取反）写作 A'，与写作 AB 或 A·B，或写作 +，异或写作 ⊕，下标写作 m_i 或 Unicode 下标（如 m₀），最小项写作 m3 等。",
    "信号名与代码用反引号包裹，例如 `Y`、`A'`。",
    "",
    "正文之后，空一行，再写一行只含“追问：”的标记行，然后列出追问，每条一行，格式为“- 问题 | 角度 | 理由”。",
    "追问条数按本问题的内容决定：问题窄、已是很细的小知识点时写 1 条；一般的概念或原理问题写 2 条；",
    "问题宽、可以向多个方向展开（原理、变式、易错、验证各有话说）时写 3 到 4 条。角度只选真正适合本回答的，不要为凑数而写。",
    "角度只能是 principle、variant、pitfall、prerequisite、verify、practice、free 之一。",
    "问题不超过 30 个字，必须是围绕本回答本身的启发式联想问题（为什么、如果…会怎样、与…有何不同、什么时候会出错），",
    "不要问“X是什么”这类定义题（定义由正文中的术语链接承担）。理由不超过 20 个字。",
    "追问块不计入上面的 120 字限制；追问块之后不要再输出任何内容。",
    "格式示例（只示范格式，内容不要照抄）：",
    "  相邻格只差一位，所以可以圈在一起。",
    "  结论：相邻圈法成立。",
    "",
    "  追问：",
    "  - 若两格不相邻，圈法还成立吗 | variant | 检验相邻性",
    "  - 圈的格数不是 2 的幂会怎样 | pitfall | 圈法失效"
  ].join("\n");
}
function llmDetail(raw) {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "" || s.length > 80) return "";
  if (/[{}\[\]"]/.test(s)) return "";
  return /[一-鿿]/.test(s) ? s : "";
}
function llmFailure(prefix, raw) {
  const detail = llmDetail(raw);
  return detail !== "" ? `${prefix}：${detail}` : `${prefix}，请稍后重试。`;
}
function clipSummary(text2, max) {
  const chars = Array.from(text2);
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : text2;
}
function buildAskMessages(path5, question, localFacts) {
  const summaryMax = PATH_SUMMARY_MAX;
  const pathLines = path5.length === 0 ? ["（无）"] : path5.map(
    (n, i) => `${i + 1}. ${n.title}：${clipSummary(n.summary, summaryMax)}（知识点 ${n.knowledgeIds.join("、") || "无"}）`
  );
  const text2 = [
    "【学习树路径】从根到当前卡片：",
    ...pathLines,
    "",
    "【本地求解结果】",
    localFacts.trim() === "" ? "无" : localFacts.trim(),
    "",
    "【追问】",
    question.trim()
  ].join("\n");
  return [{ role: "user", content: [{ type: "text", text: text2 }] }];
}
function parseAskInput(raw) {
  const text2 = raw.trim();
  if (text2 === "") throw new Error("追问参数为空。");
  let data;
  try {
    data = JSON.parse(text2);
  } catch {
    throw new Error("追问参数不是合法的 JSON。");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("追问参数必须是一个对象。");
  }
  const obj = data;
  if (obj.v !== 1) throw new Error("追问参数版本不受支持（需要 v: 1）。");
  if (typeof obj.question !== "string" || obj.question.trim() === "") throw new Error("追问内容不能为空。");
  if (obj.question.length > MAX_QUESTION_LENGTH) throw new Error(`追问内容过长（上限 ${MAX_QUESTION_LENGTH} 字符）。`);
  if (!Array.isArray(obj.path) || obj.path.length > MAX_PATH_LENGTH) throw new Error("追问路径无效。");
  const path5 = obj.path.map((n) => {
    const node = n;
    if (typeof node !== "object" || node === null) throw new Error("追问路径无效。");
    if (typeof node.nodeId !== "string" || typeof node.title !== "string" || typeof node.summary !== "string") {
      throw new Error("追问路径无效。");
    }
    if (!Array.isArray(node.knowledgeIds) || !node.knowledgeIds.every((k) => typeof k === "string")) {
      throw new Error("追问路径无效。");
    }
    return { nodeId: node.nodeId, title: node.title, summary: node.summary, knowledgeIds: node.knowledgeIds };
  });
  if (obj.localFacts !== void 0 && typeof obj.localFacts !== "string") throw new Error("localFacts 必须是字符串。");
  if (typeof obj.localFacts === "string" && obj.localFacts.length > MAX_LOCAL_FACTS_LENGTH) throw new Error("localFacts 过长。");
  return {
    v: 1,
    path: path5,
    question: obj.question,
    ...typeof obj.localFacts === "string" ? { localFacts: obj.localFacts } : {}
  };
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
var TextAssembler = class {
  texts = /* @__PURE__ */ new Map();
  closed = /* @__PURE__ */ new Map();
  order = [];
  finish = void 0;
  push(chunk) {
    const index = chunk.index;
    if (chunk.type === "text-delta" && typeof chunk.text === "string") {
      if (this.closed.has(index)) return;
      if (!this.texts.has(index)) this.order.push(index);
      this.texts.set(index, (this.texts.get(index) ?? "") + chunk.text);
    } else if (chunk.type === "block-end") {
      const block = chunk.block;
      if (block && block.type === "text" && typeof block.text === "string" && !this.closed.has(index)) {
        if (!this.texts.has(index)) this.order.push(index);
        this.closed.set(index, block.text);
      }
    } else if (chunk.type === "finish") {
      this.finish = chunk.reason;
    }
  }
  blocks() {
    return this.order.map((i) => ({ type: "text", text: this.closed.get(i) ?? this.texts.get(i) ?? "" }));
  }
};
function defaultAssembler() {
  return new TextAssembler();
}
function appendRawLogToTmp(line2) {
  try {
    const file = path4.join(os3.tmpdir(), ASK_RAW_LOG_NAME);
    let size = 0;
    try {
      size = fs4.statSync(file).size;
    } catch {
      size = 0;
    }
    if (size > ASK_RAW_LOG_MAX_BYTES) fs4.writeFileSync(file, "");
    fs4.appendFileSync(file, line2 + "\n", "utf8");
  } catch {
  }
}
async function askOnce(ctx, input, signal) {
  const fail = (error) => ({ ok: false, error });
  if (signal?.aborted) return fail(CANCELLED_TEXT);
  if (!ctx.llm || !ctx.agentDefaultModel) return fail("当前 DSH 未提供模型服务。");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const selection = ctx.agentDefaultModel.currentSelection();
    let call;
    try {
      const base = { provider: selection.provider, model: selection.model, maxTokens: ASK_MAX_TOKENS };
      try {
        call = await ctx.llm.prepareCall({ ...base, reasoningEffort: ASK_REASONING_EFFORT }, controller.signal);
      } catch (error) {
        if (controller.signal.aborted) throw error;
        call = await ctx.llm.prepareCall(base, controller.signal);
      }
    } catch (error) {
      return fail(controller.signal.aborted ? CANCELLED_TEXT : llmFailure("模型调用准备失败", errorMessage(error)));
    }
    const assembler = await (ctx.createAssembler ? ctx.createAssembler() : defaultAssembler());
    try {
      const stream = call.stream({
        ...call.config,
        system: buildAskSystemPrompt(),
        messages: buildAskMessages(input.path, input.question, input.localFacts ?? ""),
        signal: controller.signal
      });
      for await (const chunk of stream) {
        if (controller.signal.aborted) return fail(CANCELLED_TEXT);
        assembler.push(chunk);
      }
    } catch (error) {
      return fail(controller.signal.aborted ? CANCELLED_TEXT : llmFailure("模型调用失败", errorMessage(error)));
    }
    const finish = assembler.finish;
    if (finish === void 0) return fail("模型流未正常结束。");
    switch (finish.kind) {
      case "stop":
        break;
      case "error":
        return fail(llmFailure("模型调用失败", finish.failure?.message || finish.failure?.code));
      case "aborted":
        return fail(CANCELLED_TEXT);
      case "max-tokens":
        return fail("模型输出长度用尽，未能生成回答。");
      default:
        return fail("模型返回了意外的结束状态：" + finish.kind);
    }
    const text2 = assembler.blocks().filter((b) => b.type === "text" && typeof b.text === "string").map((b) => b.text).join("").trim();
    if (text2 === "") return fail("模型没有返回内容。");
    const parsed = parseAskAnswer(text2);
    try {
      const write = ctx.log ?? appendRawLogToTmp;
      write(JSON.stringify({ t: Date.now(), raw: text2, parsedFollowups: parsed.followups.length }));
    } catch {
    }
    return { ok: true, text: parsed.answer, followups: parsed.followups, raw: text2 };
  } finally {
    signal?.removeEventListener("abort", onAbort);
    controller.abort();
  }
}
function registerAskLlmCommand(ctx, createAssembler) {
  ctx.inject(["commands", "llm", "agentDefaultModel"], (child) => {
    child.effect(
      () => child.commands.register({
        name: ASK_LLM_COMMAND,
        description: "直接调用模型回答追问",
        input: { hint: "<json>" },
        handler: async ({ rawInput, signal }) => {
          let input;
          try {
            input = parseAskInput(typeof rawInput === "string" ? rawInput : "");
          } catch (error) {
            return { kind: "error", text: errorMessage(error) };
          }
          const outcome = await askOnce(
            { llm: child.get("llm"), agentDefaultModel: child.get("agentDefaultModel"), createAssembler },
            input,
            signal
          );
          return outcome.ok ? (
            // DSH 命令层只保证透传 text，额外字段会被丢弃：把含“追问：”块的原文放进 text，由前端 parseAskAnswer 拆分。
            { kind: "success", text: outcome.raw, followups: outcome.followups }
          ) : { kind: "error", text: outcome.error };
        }
      }),
      ASK_LLM_COMMAND
    );
  });
}

// src/host/skill.ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill";
var SKILL_DIR = new URL("../skills/digital-logic-tutor/", import.meta.url);
var SKILL_BODY_URL = new URL("SKILL.md", SKILL_DIR);
var PROVIDER_NAME = "dlogic-studio";
var RESOURCE_BASE = { kind: "directory", path: fileURLToPath(SKILL_DIR) };
var CANDIDATE = {
  name: "digital-logic-tutor",
  description: "《数字逻辑》课程助教：数制与编码、布尔代数与卡诺图、组合逻辑与 74 系列 MSI 芯片、触发器与时序电路、状态机设计、存储器扩展、可编程逻辑、Verilog HDL、数字系统与小型控制器、A/D 与 D/A 转换。用户问到这些内容、做相关习题或课程设计时使用。",
  invocation: { modelInvocable: true, userInvocable: true },
  provider: PROVIDER_NAME,
  source: "bundled",
  resourceBase: RESOURCE_BASE,
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_BODY_URL
};
var skillProvider = {
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
      content: await readFile(SKILL_BODY_URL, "utf8")
    };
  }
};

// src/host/index.ts
var name = "dsh-digital-logic-studio";
var inject = ["tools", "skills"];
function apply(ctx) {
  ctx.tools.register(dlogicNum);
  ctx.tools.register(dlogicBool);
  ctx.tools.register(dlogicVerify);
  ctx.tools.register(dlogicKnowledge);
  ctx.tools.register(dlogicCard);
  ctx.tools.register(dlogicComb);
  ctx.tools.register(dlogicSeq);
  ctx.tools.register(dlogicFsm);
  ctx.tools.register(dlogicMem);
  ctx.tools.register(dlogicAdda);
  ctx.tools.register(dlogicSystem);
  ctx.tools.register(dlogicHdl);
  ctx.skills.registerProvider(() => skillProvider);
  ctx.inject(["sessionProjections"], (inner) => {
    registerTreeProjection(inner);
  });
  registerFollowupCommand(ctx);
  registerAskLlmCommand(ctx);
}
export {
  apply,
  inject,
  name
};
