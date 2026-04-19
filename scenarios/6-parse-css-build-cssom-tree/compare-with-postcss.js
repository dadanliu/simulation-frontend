// 角色：把"手写 mini-css-parser"和"主流方案 postcss"放在一起跑，对比两棵 CSSOM 树
//
// postcss 是 Node 生态里最常用的 CSS 解析 / 变换底座（tailwind / autoprefixer /
// css-modules / cssnano / vue-sfc-compiler 都在用它）。
// 它做的事情和手写版同属一跳——「CSS 字符流 → 结构化对象树」——
// 区别只在于：postcss 按 CSS Syntax L3 + 实际浏览器行为把所有边界分支都补全了，
// 并且自带位置信息 / source map / 插件管线。
//
// 运行：node compare-with-postcss.js [path-to-css]

'use strict';

const fs = require('fs');
const path = require('path');

const { tokenize, buildCssom, printCssom, countRules } = require('./mini-css-parser');

let postcss;
try {
  postcss = require('postcss');
} catch (e) {
  console.error('[错误] 未安装 postcss，请先执行：pnpm install');
  process.exit(1);
}

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/app.css');

// ── 把 postcss 的 AST 统一打印成和 mini 版同构的树形 ──────────────

function printPostcssRoot(root) {
  console.log('Root  (postcss 等价于 CSSStyleSheet)');
  const nodes = root.nodes.filter((n) => n.type !== 'comment');
  nodes.forEach((node, idx) => printPostcssNode(node, '', idx === nodes.length - 1));
}

function printPostcssNode(node, prefix, isLast) {
  const branch = prefix + (isLast ? '└─ ' : '├─ ');
  const nextPrefix = prefix + (isLast ? '   ' : '│  ');

  if (node.type === 'atrule') {
    // @import "..."; 这类没有 nodes
    if (!node.nodes) {
      console.log(branch + `AtRule     @${node.name} ${node.params}`);
      return;
    }
    console.log(branch + `AtRule     @${node.name} ${node.params}`);
    const kids = node.nodes.filter((n) => n.type !== 'comment');
    kids.forEach((k, i) => printPostcssNode(k, nextPrefix, i === kids.length - 1));
    return;
  }

  if (node.type === 'rule') {
    console.log(branch + `Rule       ${node.selector}`);
    const decls = node.nodes.filter((n) => n.type === 'decl');
    decls.forEach((d, i) => {
      const dBranch = nextPrefix + (i === decls.length - 1 ? '└─ ' : '├─ ');
      console.log(dBranch + `${d.prop}: ${d.value}${d.important ? ' !important' : ''}`);
    });
    return;
  }

  if (node.type === 'decl') {
    console.log(branch + `${node.prop}: ${node.value}${node.important ? ' !important' : ''}`);
  }
}

function countPostcssNodes(root) {
  const c = { StyleRule: 0, Declaration: 0, ImportRule: 0, MediaRule: 0, AtRule: 0 };
  root.walk((node) => {
    if (node.type === 'rule') c.StyleRule++;
    else if (node.type === 'decl') c.Declaration++;
    else if (node.type === 'atrule') {
      if (node.name === 'import') c.ImportRule++;
      else if (node.name === 'media') c.MediaRule++;
      else c.AtRule++;
    }
  });
  return c;
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
  console.log('│  compare-with-postcss                                       │');
  console.log('│  手写 mini-css-parser  ⇄  主流方案 postcss                  │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入: ${path.relative(process.cwd(), INPUT_PATH)}   (${Buffer.byteLength(css, 'utf-8')} bytes)`);

  // ── 手写版 ─────────────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【A】手写 mini-css-parser 的 CSSOM');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const tokens = tokenize(css);
  const miniSheet = buildCssom(css, tokens);
  printCssom(miniSheet);

  // ── postcss ──────────────────────────────────────────────
  // postcss.parse(css) 返回 Root AST，结构上对应 CSSStyleSheet
  const root = postcss.parse(css);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【B】postcss 产出的 AST（主流方案）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  printPostcssRoot(root);

  // ── 规则 / 声明数量对比 ───────────────────────────────────
  const miniCount = countRules(miniSheet);
  const p5Count = countPostcssNodes(root);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【C】规则 / 声明数量对比');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                mini-parser    postcss');
  console.log(`  StyleRule       ${String(miniCount.StyleRule).padStart(6)}        ${String(p5Count.StyleRule).padStart(6)}`);
  console.log(`  Declaration     ${String(miniCount.Declaration).padStart(6)}        ${String(p5Count.Declaration).padStart(6)}`);
  console.log(`  ImportRule      ${String(miniCount.ImportRule).padStart(6)}        ${String(p5Count.ImportRule).padStart(6)}`);
  console.log(`  MediaRule       ${String(miniCount.MediaRule).padStart(6)}        ${String(p5Count.MediaRule).padStart(6)}`);
  console.log(`  Other AtRule    ${String(miniCount.AtRule).padStart(6)}        ${String(p5Count.AtRule).padStart(6)}`);

  // ── 共同点 & 差异 ─────────────────────────────────────────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【D】两者的核心相同点');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  · 都是 "字符流 → token 流 → AST" 三步走');
  console.log('  · 顶层都是 stylesheet（postcss 叫 Root），内部一层层挂 at-rule / rule / decl');
  console.log('  · 普通规则的解析模型一致：selector + declaration[] + {property, value, important}');
  console.log('  · @media 都会嵌套一个子规则列表，@import 都作为 statement at-rule 识别 href');
  console.log('  · !important 都单独提取到 declaration 上，而不是留在 value 字符串里');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【E】postcss 相对手写版多做的事');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  1. 位置信息（source map）：每个节点都带 start / end / line / column');
  console.log('  2. 保留注释 / 原始空格：支持"解析 → 变换 → 原样打印"，输出仍然可读');
  console.log('  3. 插件管线：同一棵 AST 可以被 autoprefixer / cssnano / tailwind 层层变换');
  console.log('  4. 错误恢复：残缺 / 非法 CSS 会给出带位置的警告，但仍产出可用的 AST');
  console.log('  5. 字符串转义、Unicode、BOM、CDO/CDC 等边界情况');
  console.log('  6. raws（节点间原始文本）：可以精确重建原文件，不会吞掉格式');
  console.log('  （注：选择器 / value 的内部 AST 不在 postcss 核心里，需要 postcss-selector-parser /');
  console.log('   postcss-value-parser，再下一层才拆开；真实浏览器则把这一层塞在 "样式匹配" 阶段）');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【F】一句话结论');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  手写 mini-css-parser 告诉你「本质上发生了什么」；');
  console.log('  postcss 告诉你「真实工程链路里还要补哪些东西（位置 / 保格式 / 插件）才能稳」。');
  console.log('');
}

main();
