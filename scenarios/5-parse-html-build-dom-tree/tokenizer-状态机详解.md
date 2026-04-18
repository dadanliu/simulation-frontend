# Tokenizer 有限状态机 · 详细讲解

> 本文只讲 `mini-html-parser.js` 里的 `tokenize(input)`：
> 它如何把一段 HTML 字符串，**一个字符一个字符地**切成 5 种 token。
> 读完这份文档，你应该能拿铅笔对任意 HTML 片段画出状态轨迹。

---

## 0. 为什么要用"有限状态机"

HTML 不是一门纯文本格式，也不是一门严格的结构化格式。它混合了：

- 纯文本（`Hello world`）
- 标签（`<div>`、`</div>`、`<img />`）
- 属性（`class="x"`、`disabled`、`data-k='v'`）
- 注释（`<!-- xx -->`）
- 文档类型声明（`<!doctype html>`）

这些形态**交错**出现在同一个字符串里。如果用普通 `split / regex` 去切，每种情况都要写一堆 if-else，代码会迅速失控。

**解决办法：维护一个"当前状态"，每读一个字符只做两件事**：

1. 根据 **当前状态 + 当前字符** 决定要做什么（emit、累积、跳转状态）
2. 切换到下一个状态，读下一个字符

这就是"有限状态机 (FSM)"的字面定义：**状态集合 + 转移函数**。HTML 解析器的 Tokenizer 恰好是它最经典的应用之一。

---

## 1. 状态机的 5 个核心要素

| 要素 | 在手写版里是什么 |
|---|---|
| 输入符号 | HTML 文本里的每个字符 `input[i]` |
| 状态集合 | `STATE.*`，共 15 个状态 |
| 转移函数 | `switch (state)` 里的每个分支 |
| 初始状态 | `STATE.DATA`（一开始在"正文"状态） |
| 输出 | `tokens.push(...)`，即 `emitXxx()` |

以及几个"草稿变量"（不是状态本身，但状态转换时会读写）：

```js
let textBuf    = '';   // 累积 Text 正文
let tagName    = '';   // 当前正在拼的标签名
let isEndTag   = false;// 当前拼的是开标签还是闭标签
let attrs      = [];   // 当前标签已经拼好的属性
let attrName   = '';   // 当前正在拼的属性名
let attrValue  = '';   // 当前正在拼的属性值
let commentBuf = '';   // 当前注释内容
let doctypeBuf = '';   // 当前 Doctype 内容
```

> 把它们看成"当前正在装配的 token 草稿"，emit 的时候会被打包推入 tokens，然后清零。

---

## 2. 15 个状态一览

分四组更容易记：

### 组 A · 文本与标签入口

| 状态 | 一句话 | 典型字符 → 下一状态 |
|---|---|---|
| `DATA` | 默认的"正文累积"状态 | `<` → `TAG_OPEN`；其它 → 自己（累积到 textBuf） |
| `TAG_OPEN` | 刚看到 `<`，还不知道是哪类标签 | `/` → `END_TAG_OPEN`；`!` → `MARKUP_DECL`；字母 → `TAG_NAME`；其它 → 退回 DATA |
| `END_TAG_OPEN` | 刚看到 `</` | 下一字符 → `TAG_NAME`（`isEndTag = true`） |
| `TAG_NAME` | 正在拼标签名（`div`/`em`/...） | 空白 → `BEFORE_ATTR_NAME`；`/` → `SELF_CLOSING`；`>` → emit 并回 DATA |

### 组 B · 属性

| 状态 | 一句话 | 典型字符 → 下一状态 |
|---|---|---|
| `BEFORE_ATTR_NAME` | 标签名后，准备读属性名（吃空白） | 空白 → 自己；`/` → `SELF_CLOSING`；`>` → emit 并回 DATA；其它 → `ATTR_NAME` |
| `ATTR_NAME` | 正在拼属性名（`class` / `data-kind`） | 空白 → `AFTER_ATTR_NAME`；`=` → `BEFORE_ATTR_VALUE`；`/`/`>` → 布尔属性 flush，回 `BEFORE_ATTR_NAME` |
| `AFTER_ATTR_NAME` | 属性名已结束，等 `=` 或新属性 | 空白 → 自己；`=` → `BEFORE_ATTR_VALUE`；其它 → flush，进入下一个属性 |
| `BEFORE_ATTR_VALUE` | 读到了 `=`，准备读值 | 空白 → 自己；`"` → `ATTR_VALUE_DQ`；`'` → `ATTR_VALUE_SQ`；其它 → `ATTR_VALUE_UNQ` |
| `ATTR_VALUE_DQ` | 双引号包裹的属性值 | `"` → flush，回 `BEFORE_ATTR_NAME`；其它 → 累积 |
| `ATTR_VALUE_SQ` | 单引号包裹的属性值 | `'` → flush，回 `BEFORE_ATTR_NAME`；其它 → 累积 |
| `ATTR_VALUE_UNQ` | 无引号的属性值（`disabled=yes`） | 空白 → flush，回 `BEFORE_ATTR_NAME`；`>` → flush + emit；其它 → 累积 |

### 组 C · 自闭合

| 状态 | 一句话 | 典型字符 → 下一状态 |
|---|---|---|
| `SELF_CLOSING` | 刚看到标签里的 `/`，等下一个 `>` | `>` → emit(selfClosing=true) 并回 DATA；其它 → 降级回 `BEFORE_ATTR_NAME` |

### 组 D · `<!` 开头的特殊块

| 状态 | 一句话 | 典型字符 → 下一状态 |
|---|---|---|
| `MARKUP_DECL` | 刚看到 `<!`，看后 7 个字符判断哪种特殊块 | `--` → `COMMENT`；`doctype` → `DOCTYPE`；其它 → 退回 DATA |
| `COMMENT` | 正在读注释正文，找结束符 `-->` | `-->` → emit Comment，回 DATA；其它 → 累积 |
| `DOCTYPE` | 正在读 doctype 声明，找 `>` | `>` → emit Doctype，回 DATA；其它 → 累积 |

---

## 3. 完整转移图（ASCII）

```
                        ┌─────────┐
          ┌────────────►│  DATA   │◄──────────────────┐
          │  其它字符     └────┬────┘                   │
          │  textBuf += c      │ '<'                   │ '>'
          │                    ▼                       │
          │              ┌──────────┐                  │
          │              │ TAG_OPEN │                  │
          │              └────┬─────┘                  │
          │           '/' │   │ '!'         字母       │
          │       ┌───────┘   └───────┐    ┌───────┐   │
          │       ▼                   ▼    │       │   │
          │ ┌──────────────┐  ┌────────────┴────┐  │   │
          │ │END_TAG_OPEN  │  │  MARKUP_DECL    │  │   │
          │ └──────┬───────┘  └────┬────────────┘  ▼   │
          │        │ 字母           │ '--'│'doctype' ┌──┴────────┐
          │        ▼                ▼     ▼          │ TAG_NAME  │
          │  ┌──────────┐   ┌──────────┐┌──────────┐ └────┬──────┘
          │  │ TAG_NAME │   │ COMMENT  ││ DOCTYPE  │      │
          │  └────┬─────┘   └────┬─────┘└────┬─────┘      │
          │       │空白           │ '-->'    │ '>'        │ '>'
          │       ▼               │          │            │
          │ ┌──────────────────┐  │          │            │
          │ │BEFORE_ATTR_NAME  │◄─┼──────────┼────────────┘
          │ └──┬───────────────┘  │          │
          │    │其它字符          │          │
          │    ▼                  ▼          ▼
          │ ┌─────────────┐     回到 DATA
          │ │  ATTR_NAME  │
          │ └─┬────┬──────┘
          │   │空白 │ '='
          │   ▼    ▼
          │ ┌──────────────┐ ┌──────────────────┐
          │ │AFTER_ATTR_   │ │BEFORE_ATTR_VALUE │
          │ │    NAME      │ └─┬──────┬──────┬──┘
          │ └─┬────┬───────┘   │ '"'  │ '\'' │ 其它
          │   │'=' │ 其它       ▼      ▼      ▼
          │   │    └──►flush  ┌──────┐┌──────┐┌──────┐
          │   ▼                │DQ    ││SQ    ││UNQ   │
          │  BEFORE_ATTR_VALUE └──┬───┘└──┬───┘└──┬───┘
          │                      │ '"'   │ '\''  │空白
          │                      ▼       ▼       ▼
          └────── flush, 回到 BEFORE_ATTR_NAME ──┘

       遇 '>' 则 emit StartTag/EndTag，回到 DATA
       遇 '/' 后 '>' 则 emit(selfClosing=true)，回到 DATA
```

---

## 4. 5 种 token 对应 4 个 emit 动作

| emit 动作 | 产出的 token | 触发位置 |
|---|---|---|
| `emitText()` | `{ type: 'Text', value }` | 在 `DATA` 看到 `<` 时（把累积的 textBuf 结掉） |
| `emitTag(false)` | `{ type: 'StartTag' or 'EndTag', tagName, attrs, selfClosing: false }` | `TAG_NAME` / `BEFORE_ATTR_NAME` / `ATTR_VALUE_UNQ` 看到 `>` 时 |
| `emitTag(true)` | 同上，`selfClosing: true` | `SELF_CLOSING` 看到 `>` 时 |
| `tokens.push(Comment/Doctype)` | `{ type: 'Comment', value }` / `{ type: 'Doctype', value }` | `COMMENT` 看到 `-->`，`DOCTYPE` 看到 `>` |

`flushAttr()` 不是一种 emit——它只是把当前的 `{attrName, attrValue}` 追加到 `attrs[]`，等 `emitTag` 时一起输出。

---

## 5. 逐字符示例 ①：`<p>Hi</p>`

一个一个字符过，每一行都是一步：

| # | 字符 `c` | 进入时 state | 做了什么 | 离开时 state |
|---|---|---|---|---|
| 0 | `<` | DATA | emitText()（textBuf 为空，no-op） | TAG_OPEN |
| 1 | `p` | TAG_OPEN | 字母 → 不消费，准备进 TAG_NAME | TAG_NAME |
| 2 | `p` | TAG_NAME | tagName += 'p' | TAG_NAME |
| 3 | `>` | TAG_NAME | **emitTag(false) → `StartTag <p>`** | DATA |
| 4 | `H` | DATA | textBuf += 'H' | DATA |
| 5 | `i` | DATA | textBuf += 'i' | DATA |
| 6 | `<` | DATA | **emitText() → `Text "Hi"`** | TAG_OPEN |
| 7 | `/` | TAG_OPEN | `/` → | END_TAG_OPEN |
| 8 | `p` | END_TAG_OPEN | `isEndTag = true` | TAG_NAME |
| 9 | `p` | TAG_NAME | tagName += 'p' | TAG_NAME |
| 10 | `>` | TAG_NAME | **emitTag(false) → `EndTag </p>`** | DATA |

最终 token 流：

```
[0] StartTag <p>
[1] Text     "Hi"
[2] EndTag   </p>
```

---

## 6. 逐字符示例 ②：属性 + 引号 + 自闭合

```html
<img src="/a.png" alt='x' disabled />
```

为了节省篇幅，下表只列 **"有效动作"** 的关键步：

| 字符 | 进入 state | 动作 | 离开 state |
|---|---|---|---|
| `<` | DATA | emitText (空) | TAG_OPEN |
| `i` | TAG_OPEN | 字母 | TAG_NAME |
| `img`（3 字） | TAG_NAME | tagName = 'img' | TAG_NAME |
| `space` | TAG_NAME | 空白触发 | BEFORE_ATTR_NAME |
| `s` | BEFORE_ATTR_NAME | 非空白非 `/` 非 `>` | ATTR_NAME |
| `src` | ATTR_NAME | attrName = 'src' | ATTR_NAME |
| `=` | ATTR_NAME | `=` 触发 | BEFORE_ATTR_VALUE |
| `"` | BEFORE_ATTR_VALUE | 双引号 | ATTR_VALUE_DQ |
| `/a.png` | ATTR_VALUE_DQ | attrValue 累积 | ATTR_VALUE_DQ |
| `"` | ATTR_VALUE_DQ | 结束引号，**flushAttr()** | BEFORE_ATTR_NAME |
| `space` | BEFORE_ATTR_NAME | 空白，自环 | BEFORE_ATTR_NAME |
| `alt` | BEFORE_ATTR_NAME / ATTR_NAME | 新属性名 | ATTR_NAME |
| `=` | ATTR_NAME | `=` | BEFORE_ATTR_VALUE |
| `'` | BEFORE_ATTR_VALUE | 单引号 | ATTR_VALUE_SQ |
| `x` | ATTR_VALUE_SQ | attrValue = 'x' | ATTR_VALUE_SQ |
| `'` | ATTR_VALUE_SQ | 结束引号，**flushAttr()** | BEFORE_ATTR_NAME |
| `disabled` | ATTR_NAME | attrName = 'disabled' | ATTR_NAME |
| `space` | ATTR_NAME | 空白 | AFTER_ATTR_NAME |
| `/` | AFTER_ATTR_NAME | 非 `=`，flush (布尔属性) | BEFORE_ATTR_NAME → 再进 SELF_CLOSING |
| `>` | SELF_CLOSING | `>` → **emitTag(selfClosing=true)** | DATA |

最终 token：

```
StartTag <img src="/a.png" alt="x" disabled />   // selfClosing = true
```

**三个关键细节**：

1. **布尔属性 `disabled`**：属性名后跟空白/`>`/`/`，而不是 `=`，需要在 `ATTR_NAME` / `AFTER_ATTR_NAME` 分支里触发 `flushAttr()`，把 `attrValue` 留空。
2. **`flushAttr()` 不 emit token**：它只把 `{name, value}` 追加到 `attrs[]`，最终一起在 emitTag 里输出。
3. **`/` 在属性之间与标签结尾的行为不同**：`BEFORE_ATTR_NAME` 看到 `/` → `SELF_CLOSING`，`SELF_CLOSING` 看到非 `>` 时会降级回 `BEFORE_ATTR_NAME`（容错）。

---

## 7. 逐字符示例 ③：注释 `<!--hi-->`

`MARKUP_DECL` 的精髓是**向前看**（lookahead）两/七个字符，一次判断属于哪种特殊块。

| 字符 | 进入 state | 动作 | 离开 state |
|---|---|---|---|
| `<` | DATA | emitText | TAG_OPEN |
| `!` | TAG_OPEN | `!` 触发 | MARKUP_DECL |
| `-` | MARKUP_DECL | `input.slice(i, i+2) === '--'`，i += 2（**一次跳两格**） | COMMENT |
| `h` | COMMENT | commentBuf += 'h' | COMMENT |
| `i` | COMMENT | commentBuf += 'i' | COMMENT |
| `-` | COMMENT | `input.slice(i, i+3) === '-->'`，i += 3（**一次跳三格**），emit Comment | DATA |

产出：`{ type: 'Comment', value: 'hi' }`。

> 注意 `MARKUP_DECL` 是"不消费当前字符"的状态——它只做一次 lookahead，然后根据匹配结果手动推进 `i`。这是手写 parser 里常见的一类"查看但不消费"写法。

---

## 8. 逐字符示例 ④：`<!doctype html>`

| 字符 | 进入 state | 动作 | 离开 state |
|---|---|---|---|
| `<` | DATA | emitText | TAG_OPEN |
| `!` | TAG_OPEN | `!` 触发 | MARKUP_DECL |
| `d` | MARKUP_DECL | 向前看 7 字符小写后 === `'doctype'`，i += 7 | DOCTYPE |
| ` html` | DOCTYPE | doctypeBuf = ' html' | DOCTYPE |
| `>` | DOCTYPE | emit Doctype(value='html') | DATA |

产出：`{ type: 'Doctype', value: 'html' }`。

---

## 9. 常见的 6 个坑 & 我们的简化选择

| # | 坑 | WHATWG 真实做法 | 手写版的简化 |
|---|---|---|---|
| 1 | `<` 后面不是字母怎么办？（比如 `a < b`） | 按"伪开标签"回退，把 `<` 当普通字符 | 同样回退：`textBuf += '<'`，退回 DATA |
| 2 | 属性值里的 `&amp;` / `&#x2603;` | 按实体解码，产生 `\u2603` | **不解码**，原样保留 |
| 3 | `<script>` / `<style>` 内容里的 `<` 不是新标签 | 切换到 Raw Text 状态，只认同名 `</script>` | **不切换**，本场景 demo 里 script 是空的 |
| 4 | 大小写标签：`<DIV>` | 保留原始大小写，比较时小写 | emit 时 `tagName.toLowerCase()` |
| 5 | 属性名里出现 `"` / `'` / `<` | 规范里属于 "parse error"，但仍继续 | 忽略判断，直接累积（足够 demo 用） |
| 6 | 输入末尾状态不是 DATA | 按"EOF in …" 规则各自处理 | 循环结束时只做一次 `emitText()`（够用） |

---

## 10. 状态机实现的 4 个写法原则

1. **一次读一个字符**：外层 `while (i < input.length)`，内层 `switch (state)`。
   绝对不要在单个状态里写多字符处理，否则状态机就失去了"可推进性"。

2. **要不要消费字符由状态决定**：
   - 大多数状态末尾写 `i++`（消费）
   - 少数状态（如 `TAG_OPEN` 看到字母）**不消费**，留给下一状态处理
   这个"不消费、直接跳状态"的写法是状态机最容易写错的地方，建议每个分支明写 `i++` 或不写 `i++`。

3. **状态切换前先处理"草稿变量"**：进入 `TAG_NAME` 前把 `tagName = ''` / `attrs = []` 清零，否则上一个标签的残影会漏进来。

4. **emit 要能重复用**：`emitTag` / `flushAttr` 统一封装，多个分支（`>` / `/ >` / 属性结束）共用一套清理逻辑，避免漏清。

---

## 11. 和 WHATWG HTML Tokenization 规范的对照

规范里共 **80+ 个状态**（`https://html.spec.whatwg.org/multipage/parsing.html#tokenization`），手写版做了这些映射：

| 手写版状态 | 规范原始状态 |
|---|---|
| `DATA` | `Data state` |
| `TAG_OPEN` | `Tag open state` |
| `END_TAG_OPEN` | `End tag open state` |
| `TAG_NAME` | `Tag name state` |
| `BEFORE_ATTR_NAME` | `Before attribute name state` |
| `ATTR_NAME` | `Attribute name state` |
| `AFTER_ATTR_NAME` | `After attribute name state` |
| `BEFORE_ATTR_VALUE` | `Before attribute value state` |
| `ATTR_VALUE_DQ` | `Attribute value (double-quoted) state` |
| `ATTR_VALUE_SQ` | `Attribute value (single-quoted) state` |
| `ATTR_VALUE_UNQ` | `Attribute value (unquoted) state` |
| `SELF_CLOSING` | `Self-closing start tag state` |
| `MARKUP_DECL` | `Markup declaration open state` |
| `COMMENT` | `Comment state`（合并了 Comment start / Comment end dash 等多个子状态） |
| `DOCTYPE` | `DOCTYPE state`（合并了 `Before DOCTYPE name` / `DOCTYPE name` / `After DOCTYPE name` 等子状态） |

省掉的大类（参考 parse5 源码）：

- `RCDATA` / `RAWTEXT` / `SCRIPT_DATA` 及其 escape / double escape 系列（共约 20 个状态）——用于 `<title>` / `<textarea>` / `<style>` / `<script>` 内部不再切标签
- 所有 `CharacterReference` 相关状态（实体解码，约 10 个）
- `DOCTYPE` 的 public / system identifier 子状态（约 15 个）
- `Comment` 的 `--!` / `--` 末尾变体（约 5 个）

> 一句话：**手写版保留了正常文档 90% 场景的主干，省掉了 raw text、实体、DOCTYPE 细节三大块。**

---

## 12. 调试这份状态机的 3 个技巧

### ① 在 `tokenize()` 里加一行 trace

```js
while (i < input.length) {
  const c = input[i];
  console.log(`i=${i} c=${JSON.stringify(c)} state=${state}`);   // ← 加这一行
  switch (state) { ... }
}
```

这样每读一个字符都会打一行 `i=7 c="<" state=DATA`，直接肉眼对照上面的"字符-状态"表。

### ② 在 emit 处加断点

在 Chrome DevTools / VSCode 里给 `emitTag` / `emitText` 打断点，看堆栈里的 `state` / `tagName` / `attrs`。

### ③ 喂一段"故意有错"的 HTML

例如：

```html
<p class="x><em>y</em></p>
```

属性值的引号不闭合 → tokenizer 会一直留在 `ATTR_VALUE_DQ`，把后面的 `<em>` 都吞进属性值里。
对比 parse5 的结果，就能看到 WHATWG 规范多做的错误恢复分支在哪里出手。

---

## 13. 一张图记住全部

```
DATA  ──'<'──►  TAG_OPEN  ──字母──► TAG_NAME ──空白──►  BEFORE_ATTR_NAME
 ▲                 │                       │                   │
 │                 │'/'                    │'>'                │字母
 │                 ▼                       ▼                   ▼
 │           END_TAG_OPEN            emit Start/EndTag    ATTR_NAME
 │                 │                       │                   │
 │                 ▼                       │                   │'='
 │            TAG_NAME                     │                   ▼
 │                                          │            BEFORE_ATTR_VALUE
 │                                          │           ┌───┬───┬───────┐
 │                                          │       '"' │'\'│其它
 │                                          │           ▼   ▼    ▼
 │                                          │       ATTR_VALUE_(DQ|SQ|UNQ)
 │                                          │           │
 │                                          │           ▼（结束引号/空白）
 │                                          │      flushAttr
 │                                          │           │
 │                                          │           └──► BEFORE_ATTR_NAME
 │                                          │
 │                                          │（'/>'）
 │                                          └──► SELF_CLOSING ──'>'──► emit (selfClosing)
 │
 └──'<!'──► MARKUP_DECL ──'--'──► COMMENT ──'-->'──► emit Comment
                       └── 'doctype' ──► DOCTYPE ──'>'──► emit Doctype
```

你只需要记住：

- **"每一个箭头上都写着一个字符（或条件）"**——这就是有限状态机。
- **所有箭头最终都回到 DATA**——这保证能处理完整个输入。
- **每个 emit 只发生在固定几个箭头上**——这让输出可预测。

---

## 附：和代码的位置对应

| 章节讲的内容 | 对应代码位置 |
|---|---|
| 15 个状态常量 | `mini-html-parser.js:41-57` |
| 草稿变量 | `mini-html-parser.js:60-72` |
| 4 种 emit / flushAttr | `mini-html-parser.js:74-98` |
| `while` + `switch` 主循环 | `mini-html-parser.js:100-324` |
| `DATA` / `TAG_OPEN` / `END_TAG_OPEN` / `TAG_NAME` | `mini-html-parser.js:104-158` |
| 属性系列（`BEFORE_ATTR_NAME` ～ `ATTR_VALUE_UNQ`） | `mini-html-parser.js:160-264` |
| `SELF_CLOSING` / `MARKUP_DECL` | `mini-html-parser.js:266-294` |
| `COMMENT` / `DOCTYPE` | `mini-html-parser.js:296-320` |
| EOF 时的 `emitText()` | `mini-html-parser.js:327` |

配合 `debug/step-by-step.js`，你能看到**每个 token 产出之后**的栈 / 树变化；配合这份文档，你能看到**每个字符之后**的状态变化。两份一起看，就能完整地还原"HTML 字符串 → DOM 树"的全部细节。
