// 角色：把"手写 mini-parser"和"主流方案 parse5"放在一起跑，对比两棵 DOM 树
//
// parse5 是 Node 生态里最常用的 HTML5 规范实现（jsdom / angular ssr / cheerio 都在用它）。
// 它做的事情和手写版同属一跳——「HTML 字节流 → DOM 树」——
// 区别只在于：parse5 按 WHATWG HTML 规范把所有边界分支都补全了。
//
// 运行：node compare-with-parse5.js [path-to-html]

'use strict';

const fs = require('fs');
const path = require('path');

const { tokenize, buildDomTree, printDomTree } = require('./mini-html-parser');

let parse5;
try {
  parse5 = require('parse5');
} catch (e) {
  console.error('[错误] 未安装 parse5，请先执行：pnpm install');
  process.exit(1);
}

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/index.html');

// ── 把 parse5 的节点格式统一成"简化 DOM"，便于和手写版并排打印 ───

function printParse5Tree(node, prefix = '', isLast = true) {
  // parse5 的根节点叫 Document，用 nodeName === '#document' 识别
  let label;

  if (node.nodeName === '#document') {
    label = '#document';
  } else if (node.nodeName === '#documentType') {
    label = `<!doctype ${node.name}>`;
  } else if (node.nodeName === '#text') {
    const txt = node.value.replace(/\s+/g, ' ').trim();
    if (!txt) return;
    label = `"${truncate(txt, 50)}"`;
  } else if (node.nodeName === '#comment') {
    label = `<!--${truncate(node.data, 40)}-->`;
  } else {
    // Element
    const attrStr = (node.attrs || [])
      .map((a) => `${a.name}="${a.value}"`)
      .join(' ');
    label = `<${node.nodeName}${attrStr ? ' ' + attrStr : ''}>`;
  }

  const branch = prefix + (isLast ? '└─ ' : '├─ ');
  console.log(prefix ? branch + label : label);

  const children = node.childNodes || [];
  const visible = children.filter(
    (c) => !(c.nodeName === '#text' && !c.value.trim()),
  );
  visible.forEach((child, idx) => {
    const nextPrefix = prefix + (isLast ? '   ' : '│  ');
    printParse5Tree(child, nextPrefix, idx === visible.length - 1);
  });
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function countParse5Nodes(node, counter = { Element: 0, Text: 0, Comment: 0, Doctype: 0 }) {
  if (node.nodeName === '#documentType') counter.Doctype++;
  else if (node.nodeName === '#comment') counter.Comment++;
  else if (node.nodeName === '#text') {
    if (node.value && node.value.trim()) counter.Text++;
  } else if (node.nodeName !== '#document') counter.Element++;

  (node.childNodes || []).forEach((c) => countParse5Nodes(c, counter));
  return counter;
}

function countMiniNodes(node, counter = { Element: 0, Text: 0, Comment: 0, Doctype: 0 }) {
  if (node.nodeType === 'Element') counter.Element++;
  else if (node.nodeType === 'Text' && node.data.trim()) counter.Text++;
  else if (node.nodeType === 'Comment') counter.Comment++;
  else if (node.nodeType === 'DocumentType') counter.Doctype++;
  (node.children || []).forEach((c) => countMiniNodes(c, counter));
  return counter;
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
  console.log('│  compare-with-parse5                                        │');
  console.log('│  手写 mini-html-parser  ⇄  主流方案 parse5                  │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入: ${path.relative(process.cwd(), INPUT_PATH)}   (${Buffer.byteLength(html, 'utf-8')} bytes)`);

  // ── 手写版 ─────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【A】手写 mini-html-parser 的 DOM 树');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const tokens = tokenize(html);
  const miniDoc = buildDomTree(tokens);
  printDomTree(miniDoc);

  // ── parse5 ────────────────────────────────────────────────
  // parse5.parse(html) 返回一棵和 WHATWG 规范一致的 Document 树
  const p5Doc = parse5.parse(html);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【B】parse5 产出的 DOM 树（主流方案）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  printParse5Tree(p5Doc);

  // ── 节点数对比 ────────────────────────────────────────────
  const miniCount = countMiniNodes(miniDoc);
  const p5Count = countParse5Nodes(p5Doc);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【C】节点数量对比');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('          mini-parser    parse5');
  console.log(`  Element   ${String(miniCount.Element).padStart(6)}        ${String(p5Count.Element).padStart(6)}`);
  console.log(`  Text      ${String(miniCount.Text).padStart(6)}        ${String(p5Count.Text).padStart(6)}`);
  console.log(`  Comment   ${String(miniCount.Comment).padStart(6)}        ${String(p5Count.Comment).padStart(6)}`);
  console.log(`  Doctype   ${String(miniCount.Doctype).padStart(6)}        ${String(p5Count.Doctype).padStart(6)}`);

  // ── 差异分析 ──────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【D】两者的核心相同点');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  · 都是按字符流→ token 流→ DOM 树三步进行');
  console.log('  · 都用一个开元素栈来维持当前插入点');
  console.log('  · void 元素（img / meta / link ...）都不会压栈，只挂成子节点');
  console.log('  · Doctype / Comment / Text 都被真实地建成节点');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【E】parse5 相对手写版多做的事');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  1. Insertion Modes：in_head / in_body / after_body ... 数十种插入模式');
  console.log('  2. 缺失标签自动补齐：即使不写 <html>/<head>/<body>，也会自动构造');
  console.log('  3. Foster Parenting：<table> 内部非法节点会被挪到 <table> 之前');
  console.log('  4. Raw Text 元素特殊处理：<script>/<style>/<textarea>/<title> 内容不 tokenize');
  console.log('  5. 实体解码：&amp; / &#x2603; / &lt; 等全部按规范解码');
  console.log('  6. 错误恢复：重叠/乱序标签按 adoption agency algorithm 修正');
  console.log('  7. Namespace：SVG/MathML 的命名空间切换');
  console.log('  8. Location info：每个节点可带源码位置，供 source map/错误提示用');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【F】一句话结论');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  手写 mini-parser 告诉你「本质上发生了什么」；');
  console.log('  parse5 告诉你「真实浏览器为了健壮还额外补了哪些分支」。');
  console.log('');
}

main();
