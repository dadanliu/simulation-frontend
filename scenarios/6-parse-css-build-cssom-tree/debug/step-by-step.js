// 角色：把 CSS 解析过程"一步一步"放慢展示，便于用 debugger / --inspect-brk 观察
//
// mini-css-parser.js 一次性打印最终的 CSSOM 树，看到的是"结果"；
// 这里把"遇到每一个有语义的 token → 当前处于哪个语法状态 → 规则栈 / 当前声明草稿"
// 都逐步打印出来，相当于把 CSS Syntax L3 的 "Parse a list of rules" 算法做成了慢放动画。
//
// 可 debug 的两种用法：
//   1. 直接运行：node debug/step-by-step.js demo-input/app.css
//      → 命令行里看到逐步演化的规则栈 / 当前 rule / 当前 declaration
//   2. 打断点：node --inspect-brk debug/step-by-step.js demo-input/app.css
//      → 在 Chrome DevTools / VSCode 里给 `debugger;` 行打断点
//      → 一步步按下「下一步」，看 sheet / stack / ctx 实时变化

'use strict';

const fs = require('fs');
const path = require('path');
const { tokenize } = require('../mini-css-parser');

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/app.css');
const PAUSE_MS = Number(process.env.STEP_MS || 0);

// 语法状态机：当前解析器"正在期望下一个 token 做什么"
//   TOP_LEVEL      ─ 顶层，等待下一个规则（at-rule 或 style rule）
//   IN_PRELUDE     ─ 正在收集 at-rule / selector 的 prelude，直到遇到 ; 或 {
//   IN_DECL_BLOCK  ─ 在 { ... } 内，等待 property / : / value / ;
//   IN_MEDIA_BODY  ─ 在 @media { ... } 内，期望的是一堆嵌套规则（不是 declaration）
const CTX = {
  TOP_LEVEL: 'TOP_LEVEL',
  IN_PRELUDE: 'IN_PRELUDE',
  IN_DECL_BLOCK: 'IN_DECL_BLOCK',
  IN_MEDIA_BODY: 'IN_MEDIA_BODY',
};

// ── 可视化工具 ─────────────────────────────────────────────────

function describe(t) {
  switch (t.type) {
    case 'ident':     return `ident       ${t.value}`;
    case 'atKeyword': return `atKeyword   @${t.value}`;
    case 'hash':      return `hash        #${t.value}`;
    case 'number':    return `number      ${t.value}${t.unit ? t.unit : ''}`;
    case 'string':    return `string      "${t.value}"`;
    case 'function':  return `function    ${t.value}(`;
    case 'delim':     return `delim       ${JSON.stringify(t.value)}`;
    default:          return `punct       ${t.type}`;
  }
}

function stackToString(stack) {
  if (stack.length === 0) return '(top-level)';
  return stack.map((s) => {
    if (s.kind === 'atRule') return `@${s.name} …`;
    if (s.kind === 'mediaBody') return `@${s.name} { …`;
    if (s.kind === 'styleRule') return `${s.selectorText || '…'} { …`;
    return s.kind;
  }).join(' > ');
}

function sleepSync(ms) {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy wait */ }
}

// ══════════════════════════════════════════════════════════════════
// 逐步构建：按 token 顺序维护一个"规则栈 + 当前 context"，
// 每步都打印 [token / 当前 context / 栈 / 做了什么]
// ══════════════════════════════════════════════════════════════════

function buildCssomStepByStep(input, tokens) {
  const sheet = { type: 'Stylesheet', rules: [] };
  const sig = tokens.filter((t) => t.type !== 'ws' && t.type !== 'comment');

  // 规则栈：栈底是 sheet；中间可能压入 MediaRule 容器；栈顶是当前正在构造的规则
  //   · styleRule 状态下还会再带一个"当前 declaration 草稿"
  //   · 只用来维护"新生成的子规则应该挂到谁下面"
  const stack = [{ kind: 'stylesheet', rules: sheet.rules }];
  const top = () => stack[stack.length - 1];

  let ctx = CTX.TOP_LEVEL;
  let currentRule = null;  // 正在构造的 at-rule 草稿 / style rule 草稿
  let preludeStart = -1;
  let currentDecl = null;  // { property, valueStart, seenColon }
  let step = 0;

  function sliceText(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= toIdx) return '';
    return input.slice(sig[fromIdx].start, sig[toIdx - 1].end).trim();
  }

  for (let i = 0; i < sig.length; i++) {
    const t = sig[i];
    step++;

    const beforeCtx = ctx;
    const beforeStack = stackToString(stack.slice(1)); // 不显示 stylesheet
    let action = '';

    // ↓↓↓ 调试断点建议打在这里，可实时观察 stack / currentRule / currentDecl / ctx ↓↓↓
    debugger;

    switch (ctx) {
      // ── 顶层 / @media 内部：期待一个新规则的开始 ─────────────
      case CTX.TOP_LEVEL:
      case CTX.IN_MEDIA_BODY: {
        if (t.type === '}' && ctx === CTX.IN_MEDIA_BODY) {
          const popped = stack.pop();
          action = `遇到 '}'，关闭 @${popped.name}，回到上层`;
          ctx = stack.length > 1 ? CTX.IN_MEDIA_BODY : CTX.TOP_LEVEL;
          break;
        }

        if (t.type === 'atKeyword') {
          currentRule = { kind: 'atRule', name: t.value.toLowerCase(), preludeStart: i + 1 };
          ctx = CTX.IN_PRELUDE;
          preludeStart = i + 1;
          action = `识别到 at-rule 开头 @${t.value}，进入 IN_PRELUDE`;
        } else {
          currentRule = { kind: 'styleRule', selectorStart: i };
          ctx = CTX.IN_PRELUDE;
          preludeStart = i;
          action = `识别到普通规则，开始收集 selector，进入 IN_PRELUDE`;
        }
        break;
      }

      // ── 正在读 prelude（selector 或 at-rule prelude） ──────
      case CTX.IN_PRELUDE: {
        if (t.type === ';' && currentRule.kind === 'atRule') {
          // statement at-rule，比如 @import "..."；
          const prelude = sliceText(preludeStart, i);
          const name = currentRule.name;
          const rule = name === 'import'
            ? { type: 'ImportRule', name, prelude, href: prelude.match(/"([^"]+)"|'([^']+)'/)?.slice(1).find(Boolean) || '' }
            : { type: 'AtRule', name, prelude };
          top().rules.push(rule);
          action = `遇到 ';'，结束 statement at-rule @${name}，挂到 ${stack.length > 1 ? '@' + top().name : 'stylesheet'}`;
          currentRule = null;
          ctx = stack.length > 1 ? CTX.IN_MEDIA_BODY : CTX.TOP_LEVEL;
          break;
        }

        if (t.type === '{') {
          if (currentRule.kind === 'atRule') {
            const prelude = sliceText(preludeStart, i);
            const name = currentRule.name;
            if (name === 'media') {
              const mediaRule = { type: 'MediaRule', name, condition: prelude, rules: [] };
              top().rules.push(mediaRule);
              stack.push({ kind: 'mediaBody', name, rules: mediaRule.rules });
              action = `遇到 '{'，@${name} 是块 at-rule，压栈，进入 IN_MEDIA_BODY`;
              ctx = CTX.IN_MEDIA_BODY;
            } else {
              // 其他块 at-rule 兜底按 rule list 处理
              const atRule = { type: 'AtRule', name, prelude, rules: [] };
              top().rules.push(atRule);
              stack.push({ kind: 'mediaBody', name, rules: atRule.rules });
              action = `遇到 '{'，@${name} 是块 at-rule（兜底），压栈`;
              ctx = CTX.IN_MEDIA_BODY;
            }
          } else {
            const selectorText = sliceText(preludeStart, i);
            const styleRule = { type: 'StyleRule', selectorText, declarations: [] };
            top().rules.push(styleRule);
            stack.push({ kind: 'styleRule', selectorText, declarations: styleRule.declarations });
            action = `遇到 '{'，开始解析 "${selectorText}" 的声明块，进入 IN_DECL_BLOCK`;
            ctx = CTX.IN_DECL_BLOCK;
          }
          currentRule = null;
          break;
        }

        action = `继续收集 prelude`;
        break;
      }

      // ── 正在读声明块：property : value ; … ─────────────────
      case CTX.IN_DECL_BLOCK: {
        if (t.type === '}') {
          const popped = stack.pop();
          action = `遇到 '}'，关闭 "${popped.selectorText}" 的声明块`;
          // 关闭后回到外层：可能是 @media 体 或 顶层
          ctx = top().kind === 'mediaBody' ? CTX.IN_MEDIA_BODY : CTX.TOP_LEVEL;
          currentDecl = null;
          break;
        }

        if (!currentDecl) {
          // 期望 property
          if (t.type === 'ident') {
            currentDecl = { property: t.value, seenColon: false, valueStart: -1 };
            action = `开始新声明：property = ${t.value}`;
          } else if (t.type === ';') {
            action = `跳过多余的 ';'`;
          } else {
            action = `⚠ 非法 token，跳过`;
          }
          break;
        }

        if (!currentDecl.seenColon) {
          if (t.type === ':') {
            currentDecl.seenColon = true;
            currentDecl.valueStart = i + 1;
            action = `遇到 ':'，开始收集 "${currentDecl.property}" 的 value`;
          } else {
            action = `⚠ 期望 ':', 跳过`;
          }
          break;
        }

        if (t.type === ';' || i === sig.length - 1) {
          const endIdx = t.type === ';' ? i : i + 1;
          let valueText = sliceText(currentDecl.valueStart, endIdx);
          let important = false;
          const impRe = /\s*!\s*important\s*$/i;
          if (impRe.test(valueText)) {
            important = true;
            valueText = valueText.replace(impRe, '').trim();
          }
          top().declarations.push({ property: currentDecl.property, value: valueText, important });
          action = `遇到 ';'，提交声明 ${currentDecl.property}: ${valueText}${important ? ' !important' : ''}`;
          currentDecl = null;
          break;
        }

        action = `继续收集 "${currentDecl.property}" 的 value`;
        break;
      }
    }

    const afterCtx = ctx;
    const afterStack = stackToString(stack.slice(1));

    console.log('\n─────────────────────────────────────────────────────────────');
    console.log(`  Step ${String(step).padStart(3)} │ Token: ${describe(t)}`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  动作       : ${action}`);
    console.log(`  context    : ${beforeCtx}${beforeCtx !== afterCtx ? '  →  ' + afterCtx : ''}`);
    console.log(`  栈 (之前)  : ${beforeStack || '(top-level)'}`);
    console.log(`  栈 (之后)  : ${afterStack || '(top-level)'}`);

    sleepSync(PAUSE_MS);
  }

  return sheet;
}

// ══════════════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════════════

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`[错误] 找不到输入文件: ${INPUT_PATH}`);
    process.exit(1);
  }

  const css = fs.readFileSync(INPUT_PATH, 'utf-8');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  step-by-step css parser                                    │');
  console.log('│  每消费 1 个有效 token，打印 [描述 / 动作 / 上下文 / 栈]       │');
  console.log('│                                                             │');
  console.log('│  调试用法：                                                  │');
  console.log('│    node --inspect-brk debug/step-by-step.js <css>           │');
  console.log('│    在 Chrome  →  chrome://inspect  连上即可单步              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入: ${path.relative(process.cwd(), INPUT_PATH)}  (${Buffer.byteLength(css, 'utf-8')} bytes)`);
  if (PAUSE_MS > 0) console.log(`模式: STEP_MS=${PAUSE_MS} (每步之间等待)`);

  const tokens = tokenize(css);
  const sigCount = tokens.filter((t) => t.type !== 'ws' && t.type !== 'comment').length;
  console.log(`\nTokenizer 共产出 ${tokens.length} 个 token（有效 ${sigCount} 个），开始逐步构建 CSSOM …`);

  const sheet = buildCssomStepByStep(css, tokens);

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('  构建完成，最终 CSSOM 概要');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(`  顶层规则数：${sheet.rules.length}`);
  sheet.rules.forEach((r, i) => {
    const label =
      r.type === 'ImportRule' ? `@import "${r.href}"` :
      r.type === 'MediaRule'  ? `@media ${r.condition}  (内含 ${r.rules.length} 条规则)` :
      r.type === 'StyleRule'  ? `${r.selectorText}  (${r.declarations.length} 条声明)` :
                                `@${r.name} ${r.prelude}`;
    console.log(`    ${String(i).padStart(2)}  ${r.type.padEnd(12)} ${label}`);
  });
}

main();
