// 角色：手写一个最小 CSS parser，把一段 CSS 字符串解析成 CSSOM 对象树
//
// 这一跳在线性链路里的位置：
//   DOM 树（场景 5 建好）  →  [本场景] 解析 CSS、构建 CSSOM  →  Style 计算 / 布局 / 绘制
//
// 解析过程和 HTML 解析同构，也拆成两步：
//   1. Tokenizer：按状态机把字符流切成 CSS token（ident / atKeyword / hash / number / string /
//      function / 标点 {}()[],;: / delim 等）—— 对应 CSS Syntax Level 3 的 Tokenization
//   2. CSSOM Builder：按 "qualified rule / at-rule" 的语法规则，把 token 流串成一棵树
//      —— 对应 CSS Syntax Level 3 的 "Parse a stylesheet" 算法
//
// 刻意省略（真实浏览器 / postcss 会做，但和讲清主干原理无关）：
//   - 完整的 CSS Syntax L3 Token 类型（如 cdo/cdc、url()/unicode-range/!括号平衡的复杂情况）
//   - 转义（\\xx）、Unicode 规范化、BOM
//   - @supports / @keyframes / @font-face 的特殊 body 解析
//   - 选择器 AST（本实现只保留 selectorText 原文）
//   - value 内部的 AST（本实现只保留 value 字符串，important 单独提取）
//
// 运行：node mini-css-parser.js [path-to-css]

'use strict';

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/app.css');

// ══════════════════════════════════════════════════════════════════
// 一、Tokenizer —— 字符流 → token 流
// ══════════════════════════════════════════════════════════════════
//
// 状态机主干（和 CSS Syntax L3 的 "Consume a token" 算法同构）：
//
//   DATA ─┬─ 空白         ──► 连续跳过，emit ws
//         ├─ /*           ──► COMMENT
//         ├─ " / '        ──► STRING_DQ / STRING_SQ
//         ├─ @            ──► 向前读 ident，emit atKeyword
//         ├─ #            ──► 向前读 ident，emit hash（#fff / #id）
//         ├─ 数字 / -数字 ──► 读数字 + 单位，emit number
//         ├─ 字母 / -字母 ──► 读 ident；若紧跟 '(' 则 emit function，否则 ident
//         ├─ { } ( ) [ ] , ; :  ──► 原样 emit 标点 token
//         └─ 其他          ──► emit delim（> + ~ * . ! = % 等）
//
// 每个 token 都记录 {type, value, start, end}，后续还原 selector / value / prelude
// 原文时只要把首尾 token 的 start / end 套到原 input 上 slice 即可。

const STATE = {
  DATA: 'DATA',
  STRING_DQ: 'STRING_DQ',
  STRING_SQ: 'STRING_SQ',
  COMMENT: 'COMMENT',
};

function isIdentStart(c) {
  return !!c && /[a-zA-Z_\-]/.test(c);
}
function isIdentCont(c) {
  return !!c && /[a-zA-Z0-9_\-]/.test(c);
}
function isDigit(c) {
  return !!c && c >= '0' && c <= '9';
}

function tokenize(input) {
  const tokens = [];
  let state = STATE.DATA;
  let i = 0;

  // 当前正在构造的 string / comment 草稿
  let buf = '';
  let bufStart = 0;

  while (i < input.length) {
    const c = input[i];

    switch (state) {
      case STATE.DATA: {
        // ── 1) 连续空白 ──
        if (/\s/.test(c)) {
          const start = i;
          while (i < input.length && /\s/.test(input[i])) i++;
          tokens.push({ type: 'ws', value: input.slice(start, i), start, end: i });
          break;
        }

        // ── 2) /* 注释 */ ──
        if (c === '/' && input[i + 1] === '*') {
          state = STATE.COMMENT;
          buf = '';
          bufStart = i;
          i += 2;
          break;
        }

        // ── 3) 字符串 ──
        if (c === '"') { state = STATE.STRING_DQ; buf = ''; bufStart = i; i++; break; }
        if (c === "'") { state = STATE.STRING_SQ; buf = ''; bufStart = i; i++; break; }

        // ── 4) @ 开头的 at-keyword（@import / @media / @supports …） ──
        if (c === '@' && isIdentStart(input[i + 1])) {
          const start = i;
          i++; // 跳过 @
          while (i < input.length && isIdentCont(input[i])) i++;
          tokens.push({ type: 'atKeyword', value: input.slice(start + 1, i), start, end: i });
          break;
        }

        // ── 5) # 开头的 hash（#fff / #root） ──
        if (c === '#' && isIdentCont(input[i + 1])) {
          const start = i;
          i++; // 跳过 #
          while (i < input.length && isIdentCont(input[i])) i++;
          tokens.push({ type: 'hash', value: input.slice(start + 1, i), start, end: i });
          break;
        }

        // ── 6) 数字（含负数、小数，以及紧跟的单位 / %） ──
        if (
          isDigit(c) ||
          ((c === '-' || c === '+') && (isDigit(input[i + 1]) || (input[i + 1] === '.' && isDigit(input[i + 2])))) ||
          (c === '.' && isDigit(input[i + 1]))
        ) {
          const start = i;
          if (c === '-' || c === '+') i++;
          while (i < input.length && /[0-9.]/.test(input[i])) i++;
          // 后面可能紧跟单位（px / em / rem / vh …）或 %
          let unit = '';
          if (input[i] === '%') { unit = '%'; i++; }
          else if (isIdentStart(input[i])) {
            const uStart = i;
            while (i < input.length && isIdentCont(input[i])) i++;
            unit = input.slice(uStart, i);
          }
          tokens.push({
            type: 'number',
            value: input.slice(start, i - unit.length),
            unit,
            start,
            end: i,
          });
          break;
        }

        // ── 7) ident / function（关键：紧跟 '(' 就是函数，比如 url( / var( ） ──
        if (isIdentStart(c) || (c === '-' && isIdentStart(input[i + 1]))) {
          const start = i;
          while (i < input.length && isIdentCont(input[i])) i++;
          const name = input.slice(start, i);
          if (input[i] === '(') {
            i++; // 吃掉 (
            tokens.push({ type: 'function', value: name, start, end: i });
          } else {
            tokens.push({ type: 'ident', value: name, start, end: i });
          }
          break;
        }

        // ── 8) 成对 / 分隔标点 ──
        if ('{}()[];,:'.includes(c)) {
          tokens.push({ type: c, value: c, start: i, end: i + 1 });
          i++;
          break;
        }

        // ── 9) 其他单字符：> + ~ * . ! = / 等 delim ──
        tokens.push({ type: 'delim', value: c, start: i, end: i + 1 });
        i++;
        break;
      }

      case STATE.STRING_DQ: {
        if (c === '"') {
          tokens.push({ type: 'string', value: buf, start: bufStart, end: i + 1 });
          buf = '';
          state = STATE.DATA;
          i++;
        } else { buf += c; i++; }
        break;
      }

      case STATE.STRING_SQ: {
        if (c === "'") {
          tokens.push({ type: 'string', value: buf, start: bufStart, end: i + 1 });
          buf = '';
          state = STATE.DATA;
          i++;
        } else { buf += c; i++; }
        break;
      }

      case STATE.COMMENT: {
        if (c === '*' && input[i + 1] === '/') {
          tokens.push({ type: 'comment', value: buf, start: bufStart, end: i + 2 });
          buf = '';
          state = STATE.DATA;
          i += 2;
        } else { buf += c; i++; }
        break;
      }

      default:
        i++;
    }
  }

  return tokens;
}

// ══════════════════════════════════════════════════════════════════
// 二、CSSOM Builder —— token 流 → CSSOM 树
// ══════════════════════════════════════════════════════════════════
//
// 核心数据结构 —— CSSOM：
//
//   Stylesheet
//    ├─ ImportRule   { href }
//    ├─ StyleRule    { selectorText, declarations: [{property, value, important}] }
//    ├─ MediaRule    { condition, rules: [...]  } ← 里面还能嵌套 StyleRule
//    └─ AtRule       { name, prelude, rules? }   ← 其他 @ 规则统一兜底
//
// 算法主干（和 CSS Syntax L3 的 "Parse a list of rules" 同构）：
//
//   - 跳过 ws / comment 后，遇到 atKeyword → 解析 at-rule
//                        遇到其他          → 解析 qualified (style) rule
//
//   - At-rule：读 prelude 直到遇到 ';'（变 statement at-rule，如 @import）
//              或 '{'（变 block at-rule，如 @media，里面再递归调用 parseRuleList）
//
//   - Style rule：读 selector 直到 '{'，然后解析 declaration list
//
//   - Declaration list：property ':' value (';' property ':' value)* '}'
//                       value 末尾若有 '!important' 就提取出来

function buildCssom(input, tokens) {
  // 把 ws / comment 过滤掉，只保留有语义的 token，语法解析器就不用到处跳空白
  const sig = tokens.filter((t) => t.type !== 'ws' && t.type !== 'comment');
  let i = 0;

  // 把一段原始 token 还原成"源码片段"：直接用首尾的 start/end 去原 input 上 slice，
  // 这样就不用手工处理空格 / 逗号 / 括号间距，忠实保留原文。
  function sliceText(fromIdx, toIdx) {
    if (fromIdx >= toIdx) return '';
    return input.slice(sig[fromIdx].start, sig[toIdx - 1].end).trim();
  }

  // ── 顶层 / 块内规则列表 ──────────────────────────────────────
  function parseRuleList(stopAtRBrace) {
    const rules = [];
    while (i < sig.length) {
      const t = sig[i];
      if (stopAtRBrace && t.type === '}') { i++; break; }
      if (t.type === 'atKeyword') rules.push(parseAtRule());
      else rules.push(parseStyleRule());
    }
    return rules;
  }

  // ── @xxx ...; 或 @xxx ... { ... } ────────────────────────────
  function parseAtRule() {
    const name = sig[i].value.toLowerCase();
    i++; // 吃掉 atKeyword

    const preludeStart = i;
    while (i < sig.length && sig[i].type !== ';' && sig[i].type !== '{') i++;
    const preludeEnd = i;
    const prelude = sliceText(preludeStart, preludeEnd);

    // 形态一：@import url("..."); / @charset "...";  —— 以 ; 结尾
    if (i < sig.length && sig[i].type === ';') {
      i++;
      if (name === 'import') {
        return { type: 'ImportRule', name, prelude, href: extractImportHref(sig, preludeStart, preludeEnd) };
      }
      return { type: 'AtRule', name, prelude };
    }

    // 形态二：@media (...) { ... } / @supports (...) { ... }  —— 以 { 开块
    if (i < sig.length && sig[i].type === '{') {
      i++; // 吃掉 {
      const body = parseRuleList(true);
      if (name === 'media') {
        return { type: 'MediaRule', name, condition: prelude, rules: body };
      }
      return { type: 'AtRule', name, prelude, rules: body };
    }

    return { type: 'AtRule', name, prelude };
  }

  // ── 普通样式规则：selector { declaration; declaration; … } ───
  function parseStyleRule() {
    const selectorStart = i;
    while (i < sig.length && sig[i].type !== '{') i++;
    const selectorText = sliceText(selectorStart, i);

    if (i >= sig.length) {
      // 没有 block 的孤立 selector，整条丢掉
      return { type: 'StyleRule', selectorText, declarations: [] };
    }
    i++; // 吃掉 {
    const declarations = parseDeclarationList();
    return { type: 'StyleRule', selectorText, declarations };
  }

  // ── declaration list：要识别 property / colon / value / !important ──
  function parseDeclarationList() {
    const declarations = [];
    while (i < sig.length && sig[i].type !== '}') {
      const propertyToken = sig[i];

      // property 必须是 ident；否则是坏声明，吃到下一个 ; 或 } 后 continue
      if (propertyToken.type !== 'ident') {
        skipToSemiOrBrace();
        continue;
      }
      const property = propertyToken.value;
      i++;

      // 下一个必须是 :；否则坏声明
      if (!(sig[i] && sig[i].type === ':')) {
        skipToSemiOrBrace();
        continue;
      }
      i++; // 吃掉 :

      // value：一直读到 ; 或 }（括号里的 ; 不会出现在 CSS 正常语法中，所以不必跟踪嵌套）
      const valueStart = i;
      while (i < sig.length && sig[i].type !== ';' && sig[i].type !== '}') i++;
      let valueText = sliceText(valueStart, i);

      // !important 位于 value 末尾：从字符串尾部正则剥一下即可
      let important = false;
      const impRe = /\s*!\s*important\s*$/i;
      if (impRe.test(valueText)) {
        important = true;
        valueText = valueText.replace(impRe, '').trim();
      }

      declarations.push({ property, value: valueText, important });

      if (sig[i] && sig[i].type === ';') i++;
    }
    if (sig[i] && sig[i].type === '}') i++;
    return declarations;
  }

  function skipToSemiOrBrace() {
    while (i < sig.length && sig[i].type !== ';' && sig[i].type !== '}') i++;
    if (sig[i] && sig[i].type === ';') i++;
  }

  return { type: 'Stylesheet', rules: parseRuleList(false) };
}

// 从 @import 的 prelude token 里挑出字面 URL：
//   @import "foo.css";            ← 第一个 string
//   @import url("foo.css");       ← function url( 之后的第一个 string
function extractImportHref(sig, from, to) {
  for (let k = from; k < to; k++) {
    if (sig[k].type === 'string') return sig[k].value;
  }
  return '';
}

// ══════════════════════════════════════════════════════════════════
// 三、可视化工具
// ══════════════════════════════════════════════════════════════════

function printTokens(tokens) {
  // 只展示"有语义"的 token，避免 ws/comment 把屏幕刷爆
  const visible = tokens.filter((t) => t.type !== 'ws' && t.type !== 'comment');
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log(`│  Tokenizer 输出：${String(visible.length).padStart(3)} 个有效 token（已跳过 ws / comment）`.padEnd(63) + '│');
  console.log('└─────────────────────────────────────────────────────────────┘');
  visible.forEach((t, idx) => {
    const n = String(idx).padStart(3);
    const label = describeToken(t);
    console.log(`  ${n}  ${label}`);
  });
}

function describeToken(t) {
  switch (t.type) {
    case 'ident':      return `ident       ${t.value}`;
    case 'atKeyword':  return `atKeyword   @${t.value}`;
    case 'hash':       return `hash        #${t.value}`;
    case 'number':     return `number      ${t.value}${t.unit ? ' (unit=' + t.unit + ')' : ''}`;
    case 'string':     return `string      "${t.value}"`;
    case 'function':   return `function    ${t.value}(`;
    case 'delim':      return `delim       ${JSON.stringify(t.value)}`;
    case '{': case '}': case '(': case ')':
    case '[': case ']': case ',': case ';': case ':':
                       return `punct       ${t.type}`;
    default:           return `${t.type}  ${JSON.stringify(t.value)}`;
  }
}

function printCssom(sheet) {
  console.log('CSSStyleSheet');
  const rules = sheet.rules;
  rules.forEach((r, idx) => printRule(r, '', idx === rules.length - 1));
}

function printRule(rule, prefix, isLast) {
  const branch = prefix + (isLast ? '└─ ' : '├─ ');
  const nextPrefix = prefix + (isLast ? '   ' : '│  ');

  if (rule.type === 'ImportRule') {
    console.log(branch + `@import "${rule.href}"`);
    return;
  }

  if (rule.type === 'StyleRule') {
    console.log(branch + `StyleRule  ${rule.selectorText}`);
    rule.declarations.forEach((d, i) => {
      const dBranch = nextPrefix + (i === rule.declarations.length - 1 ? '└─ ' : '├─ ');
      console.log(dBranch + `${d.property}: ${d.value}${d.important ? ' !important' : ''}`);
    });
    return;
  }

  if (rule.type === 'MediaRule') {
    console.log(branch + `@media ${rule.condition}`);
    rule.rules.forEach((child, i) => printRule(child, nextPrefix, i === rule.rules.length - 1));
    return;
  }

  // AtRule 兜底
  console.log(branch + `@${rule.name} ${rule.prelude}${rule.rules ? ' { … }' : ''}`);
  if (rule.rules) {
    rule.rules.forEach((child, i) => printRule(child, nextPrefix, i === rule.rules.length - 1));
  }
}

function countRules(sheet) {
  const c = { StyleRule: 0, Declaration: 0, ImportRule: 0, MediaRule: 0, AtRule: 0 };
  const walk = (rules) => {
    for (const r of rules) {
      if (r.type === 'StyleRule') { c.StyleRule++; c.Declaration += r.declarations.length; }
      else if (r.type === 'ImportRule') c.ImportRule++;
      else if (r.type === 'MediaRule') { c.MediaRule++; walk(r.rules); }
      else if (r.type === 'AtRule') { c.AtRule++; if (r.rules) walk(r.rules); }
    }
  };
  walk(sheet.rules);
  return c;
}

// ══════════════════════════════════════════════════════════════════
// 四、主流程
// ══════════════════════════════════════════════════════════════════

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`[错误] 找不到输入文件: ${INPUT_PATH}`);
    process.exit(1);
  }

  const css = fs.readFileSync(INPUT_PATH, 'utf-8');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  mini-css-parser                                            │');
  console.log('│  CSS 字符流 → Token 流 → CSSOM 树                            │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入文件: ${path.relative(process.cwd(), INPUT_PATH)}`);
  console.log(`输入大小: ${Buffer.byteLength(css, 'utf-8')} bytes`);

  // ① Tokenize（状态机切词）
  const tokens = tokenize(css);
  printTokens(tokens);

  // ② Parse（构建 CSSOM）
  const sheet = buildCssom(css, tokens);

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  CSSOM Builder 输出：CSSStyleSheet 树                        │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  printCssom(sheet);

  const c = countRules(sheet);
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  CSSOM 规则 / 声明统计                                       │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`  StyleRule    : ${c.StyleRule}`);
  console.log(`  Declaration  : ${c.Declaration}`);
  console.log(`  ImportRule   : ${c.ImportRule}`);
  console.log(`  MediaRule    : ${c.MediaRule}`);
  console.log(`  Other AtRule : ${c.AtRule}`);
}

module.exports = { tokenize, buildCssom, printTokens, printCssom, countRules };

if (require.main === module) {
  main();
}
