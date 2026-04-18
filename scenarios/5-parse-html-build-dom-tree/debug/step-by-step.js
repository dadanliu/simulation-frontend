// 角色：把 HTML 解析过程"一步一步"放慢展示，便于用 debugger / --inspect-brk 观察
//
// 为什么要这个脚本？
//   mini-html-parser.js 一次性打印整棵 DOM 树，看到的是"最终结果"；
//   这里把每个 token 消费前后的栈状态、当前树、当前插入点都打印出来，
//   相当于把浏览器内部的"Tree Construction 算法"做成了慢放动画。
//
// 可 debug 的两种用法：
//   1. 直接运行：node debug/step-by-step.js demo-input/index.html
//      → 命令行里能看到逐步演化的栈 / 树
//   2. 打断点：node --inspect-brk debug/step-by-step.js demo-input/index.html
//      → 在 Chrome DevTools / VSCode 里给 `debugger;` 行打断点
//      → 一步步按下「下一步」，看变量 stack / document 实时变化

'use strict';

const fs = require('fs');
const path = require('path');
const { tokenize, VOID_ELEMENTS } = require('../mini-html-parser');

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/index.html');
const QUIET_TEXT = process.argv.includes('--quiet-text'); // 可选：跳过纯空白 token 打印
const PAUSE_MS = Number(process.env.STEP_MS || 0);         // 可选：每步之间 sleep

// ── 可视化工具 ─────────────────────────────────────────────────

function describeToken(t) {
  if (t.type === 'Doctype') return `Doctype <!doctype ${t.value}>`;
  if (t.type === 'Comment') return `Comment <!--${truncate(t.value, 30)}-->`;
  if (t.type === 'Text') {
    const s = t.value.replace(/\s+/g, ' ');
    return `Text    "${truncate(s, 40)}"`;
  }
  if (t.type === 'StartTag') {
    const attrs = t.attrs.map((a) => `${a.name}="${a.value}"`).join(' ');
    return `StartTag <${t.tagName}${attrs ? ' ' + attrs : ''}${t.selfClosing ? ' /' : ''}>`;
  }
  if (t.type === 'EndTag') return `EndTag  </${t.tagName}>`;
  return JSON.stringify(t);
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n) + '…';
}

function stackToString(stack) {
  // 只显示 tagName（document 用 "#document"）
  return stack
    .map((n) => (n.nodeType === 'Document' ? '#document' : n.tagName))
    .join(' > ');
}

function domSummary(doc) {
  const lines = [];
  const walk = (node, depth) => {
    let label;
    if (node.nodeType === 'Document') label = '#document';
    else if (node.nodeType === 'DocumentType') label = `<!doctype ${node.name}>`;
    else if (node.nodeType === 'Element') label = `<${node.tagName}>`;
    else if (node.nodeType === 'Comment') label = `<!--…-->`;
    else if (node.nodeType === 'Text') {
      const t = node.data.replace(/\s+/g, ' ').trim();
      if (!t) return;
      label = `"${truncate(t, 30)}"`;
    }
    lines.push('  '.repeat(depth) + label);
    (node.children || []).forEach((c) => walk(c, depth + 1));
  };
  walk(doc, 0);
  return lines.join('\n');
}

function sleepSync(ms) {
  if (ms <= 0) return;
  const end = Date.now() + ms;
  while (Date.now() < end) { /* busy wait（教学脚本，够用） */ }
}

// ══════════════════════════════════════════════════════════════════
// 逐步构建：每消费一个 token 都打印「之前 → 动作 → 之后」
// ══════════════════════════════════════════════════════════════════

function buildDomTreeStepByStep(tokens) {
  const document = { nodeType: 'Document', children: [] };
  const stack = [document];
  const top = () => stack[stack.length - 1];

  let step = 0;

  for (const t of tokens) {
    step++;

    if (QUIET_TEXT && t.type === 'Text' && !t.value.trim()) continue;

    const before = stackToString(stack);
    let action = '';

    // ── 真实的 Tree Construction 动作 ─────────────────────
    // ↓↓↓ 调试断点建议打在这里，可以实时看 stack / document / t 的变化 ↓↓↓
    debugger;   // 运行时如果没有 inspector 附着，这一行等价于 no-op

    if (t.type === 'Doctype') {
      document.children.push({ nodeType: 'DocumentType', name: t.value, parent: document });
      action = `append Doctype 到 #document`;
    } else if (t.type === 'Comment') {
      top().children.push({ nodeType: 'Comment', data: t.value, parent: top() });
      action = `append Comment 到 栈顶 <${top().tagName || '#document'}>`;
    } else if (t.type === 'Text') {
      top().children.push({ nodeType: 'Text', data: t.value, parent: top() });
      action = `append Text 到 栈顶 <${top().tagName || '#document'}>`;
    } else if (t.type === 'StartTag') {
      const el = {
        nodeType: 'Element',
        tagName: t.tagName,
        attrs: t.attrs,
        children: [],
        parent: top(),
      };
      top().children.push(el);
      const isVoid = VOID_ELEMENTS.has(t.tagName) || t.selfClosing;
      if (isVoid) {
        action = `append <${t.tagName}> 到 <${top().tagName || '#document'}>  （void，不压栈）`;
      } else {
        stack.push(el);
        action = `append <${t.tagName}> 并压栈`;
      }
    } else if (t.type === 'EndTag') {
      let popped = null;
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].nodeType === 'Element' && stack[k].tagName === t.tagName) {
          popped = stack[k];
          stack.length = k;
          break;
        }
      }
      action = popped
        ? `从栈顶往下找到 <${t.tagName}>，出栈`
        : `⚠ 栈里没有 <${t.tagName}>（忽略）`;
    }

    const after = stackToString(stack);

    // ── 打印本步 ─────────────────────────────────────────
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log(`  Step ${String(step).padStart(3)} │ Token: ${describeToken(t)}`);
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  动作     : ${action}`);
    console.log(`  栈 (之前): ${before}`);
    console.log(`  栈 (之后): ${after}`);

    sleepSync(PAUSE_MS);
  }

  return document;
}

// ══════════════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════════════

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`[错误] 找不到输入文件: ${INPUT_PATH}`);
    process.exit(1);
  }

  const html = fs.readFileSync(INPUT_PATH, 'utf-8');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  step-by-step html parser                                   │');
  console.log('│  每消费 1 个 token，打印 [Token 描述 / 动作 / 栈前后变化]   │');
  console.log('│                                                             │');
  console.log('│  调试用法：                                                  │');
  console.log('│    node --inspect-brk debug/step-by-step.js <html>          │');
  console.log('│    在 Chrome  →  chrome://inspect  连上即可单步              │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入: ${path.relative(process.cwd(), INPUT_PATH)}  (${Buffer.byteLength(html, 'utf-8')} bytes)`);
  if (QUIET_TEXT) console.log('模式: --quiet-text (跳过纯空白 Text token)');
  if (PAUSE_MS > 0) console.log(`模式: STEP_MS=${PAUSE_MS} (每步之间等待)`);

  // Step 0：先把整个字符流 tokenize
  const tokens = tokenize(html);
  console.log(`\nTokenizer 共产出 ${tokens.length} 个 token，开始逐步构建 DOM …`);

  // 逐步构建
  const doc = buildDomTreeStepByStep(tokens);

  console.log('\n═════════════════════════════════════════════════════════════');
  console.log('  构建完成，最终 DOM 树（缩进版）');
  console.log('═════════════════════════════════════════════════════════════');
  console.log(domSummary(doc));
}

main();
