// 角色：手写一个最小 HTML parser，把一段 HTML 字节流解析成 DOM 树
//
// 这一跳在线性链路里的位置：
//   字节流（场景 4 收到）  →  [本场景] 解析 HTML、构建 DOM 树  →  CSSOM/渲染/脚本执行
//
// 这里只实现 HTML5 解析算法的「最小主干」：
//   1. Tokenizer：按状态机把字符流切成 token（StartTag / EndTag / Text / Comment / Doctype）
//   2. Tree Constructor：用一个"开元素栈"把 token 串成一棵带父子关系的 DOM 树
//
// 刻意省略（真实浏览器会做，但和讲清原理无关）：
//   - insertion mode 切换、foster parenting、script/style 的 raw text 模式等复杂分支
//   - 实体解码（&amp; / &#x...;）
//   - 错误恢复的全部细节
//   - CSS / JS / 图片的二次获取和执行
//
// 运行：node mini-html-parser.js [path-to-html]

'use strict';

const fs = require('fs');
const path = require('path');

const INPUT_PATH = path.resolve(process.cwd(), process.argv[2] || 'demo-input/index.html');

// ══════════════════════════════════════════════════════════════════
// 一、Tokenizer —— 字符流 → token 流
// ══════════════════════════════════════════════════════════════════
//
// 用一个有限状态机读取字符：
//
//   Data ─┬─ '<' ──► TagOpen ─┬─ '/' ──► EndTagOpen ──► TagName
//         │                   └─ '!' ──► 进入 Doctype / Comment 分支
//         └─ 其他 ──► 累积到 TextToken
//
//   TagName ─┬─ 空白 ──► BeforeAttrName
//            ├─ '/'  ──► SelfClosingTag
//            └─ '>'  ──► 回到 Data
//
// 这和 WHATWG HTML 规范里的 Tokenization 章节同构，只是分支更少。

const STATE = {
  DATA: 'DATA',
  TAG_OPEN: 'TAG_OPEN',
  END_TAG_OPEN: 'END_TAG_OPEN',
  TAG_NAME: 'TAG_NAME',
  BEFORE_ATTR_NAME: 'BEFORE_ATTR_NAME',
  ATTR_NAME: 'ATTR_NAME',
  AFTER_ATTR_NAME: 'AFTER_ATTR_NAME',
  BEFORE_ATTR_VALUE: 'BEFORE_ATTR_VALUE',
  ATTR_VALUE_DQ: 'ATTR_VALUE_DQ',           // 双引号包裹
  ATTR_VALUE_SQ: 'ATTR_VALUE_SQ',           // 单引号包裹
  ATTR_VALUE_UNQ: 'ATTR_VALUE_UNQ',         // 无引号
  SELF_CLOSING: 'SELF_CLOSING',
  MARKUP_DECL: 'MARKUP_DECL',               // <!
  COMMENT: 'COMMENT',                       // <!--
  DOCTYPE: 'DOCTYPE',                       // <!doctype
};

function tokenize(input) {
  const tokens = [];
  let state = STATE.DATA;
  let i = 0;

  // 正在构造的 token 草稿
  let textBuf = '';
  let tagName = '';
  let isEndTag = false;
  let attrs = [];
  let attrName = '';
  let attrValue = '';
  let commentBuf = '';
  let doctypeBuf = '';

  function emitText() {
    if (textBuf.length === 0) return;
    tokens.push({ type: 'Text', value: textBuf });
    textBuf = '';
  }

  function emitTag(selfClosing = false) {
    tokens.push({
      type: isEndTag ? 'EndTag' : 'StartTag',
      tagName: tagName.toLowerCase(),
      attrs,
      selfClosing,
    });
    tagName = '';
    attrs = [];
    isEndTag = false;
  }

  function flushAttr() {
    if (attrName) {
      attrs.push({ name: attrName.toLowerCase(), value: attrValue });
    }
    attrName = '';
    attrValue = '';
  }

  while (i < input.length) {
    const c = input[i];

    switch (state) {
      case STATE.DATA: {
        if (c === '<') {
          emitText();
          state = STATE.TAG_OPEN;
        } else {
          textBuf += c;
        }
        i++;
        break;
      }

      case STATE.TAG_OPEN: {
        if (c === '/') {
          state = STATE.END_TAG_OPEN;
          i++;
        } else if (c === '!') {
          state = STATE.MARKUP_DECL;
          i++;
        } else if (/[a-zA-Z]/.test(c)) {
          isEndTag = false;
          tagName = '';
          state = STATE.TAG_NAME;
          // 不消费，这个字符交给 TAG_NAME
        } else {
          // 不是合法开标签，退回 Data（简化处理）
          textBuf += '<';
          state = STATE.DATA;
        }
        break;
      }

      case STATE.END_TAG_OPEN: {
        isEndTag = true;
        tagName = '';
        state = STATE.TAG_NAME;
        break;
      }

      case STATE.TAG_NAME: {
        if (/\s/.test(c)) {
          state = STATE.BEFORE_ATTR_NAME;
          i++;
        } else if (c === '/') {
          state = STATE.SELF_CLOSING;
          i++;
        } else if (c === '>') {
          emitTag(false);
          state = STATE.DATA;
          i++;
        } else {
          tagName += c;
          i++;
        }
        break;
      }

      case STATE.BEFORE_ATTR_NAME: {
        if (/\s/.test(c)) {
          i++;
        } else if (c === '/') {
          state = STATE.SELF_CLOSING;
          i++;
        } else if (c === '>') {
          emitTag(false);
          state = STATE.DATA;
          i++;
        } else {
          attrName = '';
          attrValue = '';
          state = STATE.ATTR_NAME;
        }
        break;
      }

      case STATE.ATTR_NAME: {
        if (/\s/.test(c)) {
          state = STATE.AFTER_ATTR_NAME;
          i++;
        } else if (c === '=') {
          state = STATE.BEFORE_ATTR_VALUE;
          i++;
        } else if (c === '/' || c === '>') {
          // 布尔属性（没有 =value）
          flushAttr();
          state = STATE.BEFORE_ATTR_NAME;
          // 不消费
        } else {
          attrName += c;
          i++;
        }
        break;
      }

      case STATE.AFTER_ATTR_NAME: {
        if (/\s/.test(c)) {
          i++;
        } else if (c === '=') {
          state = STATE.BEFORE_ATTR_VALUE;
          i++;
        } else {
          flushAttr();
          state = STATE.BEFORE_ATTR_NAME;
        }
        break;
      }

      case STATE.BEFORE_ATTR_VALUE: {
        if (/\s/.test(c)) {
          i++;
        } else if (c === '"') {
          state = STATE.ATTR_VALUE_DQ;
          i++;
        } else if (c === "'") {
          state = STATE.ATTR_VALUE_SQ;
          i++;
        } else {
          state = STATE.ATTR_VALUE_UNQ;
        }
        break;
      }

      case STATE.ATTR_VALUE_DQ: {
        if (c === '"') {
          flushAttr();
          state = STATE.BEFORE_ATTR_NAME;
          i++;
        } else {
          attrValue += c;
          i++;
        }
        break;
      }

      case STATE.ATTR_VALUE_SQ: {
        if (c === "'") {
          flushAttr();
          state = STATE.BEFORE_ATTR_NAME;
          i++;
        } else {
          attrValue += c;
          i++;
        }
        break;
      }

      case STATE.ATTR_VALUE_UNQ: {
        if (/\s/.test(c)) {
          flushAttr();
          state = STATE.BEFORE_ATTR_NAME;
          i++;
        } else if (c === '>') {
          flushAttr();
          emitTag(false);
          state = STATE.DATA;
          i++;
        } else {
          attrValue += c;
          i++;
        }
        break;
      }

      case STATE.SELF_CLOSING: {
        if (c === '>') {
          emitTag(true);
          state = STATE.DATA;
          i++;
        } else {
          // 不合法，降级成普通属性名开始
          state = STATE.BEFORE_ATTR_NAME;
        }
        break;
      }

      case STATE.MARKUP_DECL: {
        // 向前看 2 个字符，判断是 <!-- 注释，还是 <!doctype ...>
        if (input.slice(i, i + 2) === '--') {
          commentBuf = '';
          state = STATE.COMMENT;
          i += 2;
        } else if (input.slice(i, i + 7).toLowerCase() === 'doctype') {
          doctypeBuf = '';
          state = STATE.DOCTYPE;
          i += 7;
        } else {
          // 其他 <!... 简化丢弃
          state = STATE.DATA;
          i++;
        }
        break;
      }

      case STATE.COMMENT: {
        if (input.slice(i, i + 3) === '-->') {
          tokens.push({ type: 'Comment', value: commentBuf });
          commentBuf = '';
          state = STATE.DATA;
          i += 3;
        } else {
          commentBuf += c;
          i++;
        }
        break;
      }

      case STATE.DOCTYPE: {
        if (c === '>') {
          tokens.push({ type: 'Doctype', value: doctypeBuf.trim() });
          doctypeBuf = '';
          state = STATE.DATA;
          i++;
        } else {
          doctypeBuf += c;
          i++;
        }
        break;
      }

      default:
        i++;
    }
  }

  emitText();
  return tokens;
}

// ══════════════════════════════════════════════════════════════════
// 二、Tree Constructor —— token 流 → DOM 树
// ══════════════════════════════════════════════════════════════════
//
// 核心数据结构：「开元素栈」
//   · 遇到 StartTag         → 创建节点，追加为"栈顶节点的子节点"，然后压栈
//   · 遇到 EndTag           → 从栈顶往下找同名节点，找到就出栈
//   · 遇到 Text / Comment   → 创建节点，追加为"栈顶节点的子节点"
//   · 遇到自闭合 / void 元素 → 只挂成子节点，不压栈
//
// 这和浏览器的 HTML Tree Construction 同构，只是省掉了 insertion mode、
// foster parenting、模板元素、scripting flag 等分支。

// HTML5 规范里的 void 元素（不可有子节点，不需要闭合标签）
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

function buildDomTree(tokens) {
  // 文档根节点（相当于浏览器的 Document）
  const document = {
    nodeType: 'Document',
    children: [],
  };

  // 开元素栈：栈顶就是"当前插入点的父节点"
  const stack = [document];
  const top = () => stack[stack.length - 1];

  for (const t of tokens) {
    if (t.type === 'Doctype') {
      document.children.push({ nodeType: 'DocumentType', name: t.value, parent: document });
      continue;
    }

    if (t.type === 'Comment') {
      top().children.push({ nodeType: 'Comment', data: t.value, parent: top() });
      continue;
    }

    if (t.type === 'Text') {
      // 全是空白的纯文本也保留（浏览器也会保留，只是渲染时可能坍缩）
      top().children.push({ nodeType: 'Text', data: t.value, parent: top() });
      continue;
    }

    if (t.type === 'StartTag') {
      const el = {
        nodeType: 'Element',
        tagName: t.tagName,
        attrs: t.attrs,
        children: [],
        parent: top(),
      };
      top().children.push(el);

      const isVoid = VOID_ELEMENTS.has(t.tagName) || t.selfClosing;
      if (!isVoid) {
        // 非 void 才压栈，后续的子节点都挂在它下面
        stack.push(el);
      }
      continue;
    }

    if (t.type === 'EndTag') {
      // 从栈顶往下找同名开元素：找到就把它及其以上的全部出栈
      for (let k = stack.length - 1; k >= 1; k--) {
        if (stack[k].nodeType === 'Element' && stack[k].tagName === t.tagName) {
          stack.length = k; // 出栈到 k（不含）
          break;
        }
      }
      continue;
    }
  }

  return document;
}

// ══════════════════════════════════════════════════════════════════
// 三、可视化工具
// ══════════════════════════════════════════════════════════════════

function printTokens(tokens) {
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log(`│  Tokenizer 输出：${String(tokens.length).padStart(3)} 个 token`.padEnd(63) + '│');
  console.log('└─────────────────────────────────────────────────────────────┘');
  tokens.forEach((t, idx) => {
    const n = String(idx).padStart(3);
    switch (t.type) {
      case 'Doctype':
        console.log(`  ${n}  Doctype     <!doctype ${t.value}>`);
        break;
      case 'Comment':
        console.log(`  ${n}  Comment     <!--${truncate(t.value, 40)}-->`);
        break;
      case 'Text': {
        const s = truncate(t.value.replace(/\s+/g, ' '), 50);
        console.log(`  ${n}  Text        "${s}"`);
        break;
      }
      case 'StartTag': {
        const attrStr = t.attrs.map((a) => `${a.name}="${a.value}"`).join(' ');
        const sc = t.selfClosing ? ' /' : '';
        console.log(`  ${n}  StartTag    <${t.tagName}${attrStr ? ' ' + attrStr : ''}${sc}>`);
        break;
      }
      case 'EndTag':
        console.log(`  ${n}  EndTag      </${t.tagName}>`);
        break;
    }
  });
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function printDomTree(node, prefix = '', isLast = true) {
  let label;
  switch (node.nodeType) {
    case 'Document':
      label = '#document';
      break;
    case 'DocumentType':
      label = `<!doctype ${node.name}>`;
      break;
    case 'Element': {
      const attrStr = node.attrs
        .map((a) => `${a.name}="${a.value}"`)
        .join(' ');
      label = `<${node.tagName}${attrStr ? ' ' + attrStr : ''}>`;
      break;
    }
    case 'Text': {
      const txt = node.data.replace(/\s+/g, ' ').trim();
      if (!txt) return; // 纯空白不打印，保持树形清爽
      label = `"${truncate(txt, 50)}"`;
      break;
    }
    case 'Comment':
      label = `<!--${truncate(node.data, 40)}-->`;
      break;
    default:
      label = node.nodeType;
  }

  const branch = prefix + (isLast ? '└─ ' : '├─ ');
  console.log(prefix ? branch + label : label);

  const children = node.children || [];
  const visible = children.filter((c) => !(c.nodeType === 'Text' && !c.data.trim()));
  visible.forEach((child, idx) => {
    const nextPrefix = prefix + (isLast ? '   ' : '│  ');
    printDomTree(child, nextPrefix, idx === visible.length - 1);
  });
}

function countNodes(node, counter = { Element: 0, Text: 0, Comment: 0, Doctype: 0 }) {
  if (node.nodeType === 'Element') counter.Element++;
  else if (node.nodeType === 'Text' && node.data.trim()) counter.Text++;
  else if (node.nodeType === 'Comment') counter.Comment++;
  else if (node.nodeType === 'DocumentType') counter.Doctype++;
  (node.children || []).forEach((c) => countNodes(c, counter));
  return counter;
}

// ══════════════════════════════════════════════════════════════════
// 四、主流程
// ══════════════════════════════════════════════════════════════════

function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`[错误] 找不到输入文件: ${INPUT_PATH}`);
    process.exit(1);
  }

  const html = fs.readFileSync(INPUT_PATH, 'utf-8');

  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│  mini-html-parser                                           │');
  console.log('│  HTML 字节流 → Token 流 → DOM 树                             │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`\n输入文件: ${path.relative(process.cwd(), INPUT_PATH)}`);
  console.log(`输入大小: ${Buffer.byteLength(html, 'utf-8')} bytes`);

  // 第一步：Tokenize（状态机切词）
  const tokens = tokenize(html);
  printTokens(tokens);

  // 第二步：Tree Construction（栈构建 DOM）
  const document = buildDomTree(tokens);

  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  Tree Constructor 输出：DOM 树                               │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  printDomTree(document);

  const c = countNodes(document);
  console.log('\n┌─────────────────────────────────────────────────────────────┐');
  console.log('│  DOM 节点统计                                                │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log(`  Element : ${c.Element}`);
  console.log(`  Text    : ${c.Text}  （仅计可见文本）`);
  console.log(`  Comment : ${c.Comment}`);
  console.log(`  Doctype : ${c.Doctype}`);
}

// 同时导出供其他脚本复用（debug/step-by-step.js 会用到）
module.exports = { tokenize, buildDomTree, VOID_ELEMENTS, printDomTree, printTokens };

if (require.main === module) {
  main();
}
