# 场景 0：读取源码与依赖分析 — 模拟面试 Q&A

> 基于 `0-read-source-and-analyze-dependencies` 场景中的 mini-bundler、demo-src 源码和 Webpack 对比产物。

---

## 一、基础概念

### Q1：什么是"依赖图"（Dependency Graph）？构建工具为什么需要它？

**A：** 依赖图是一个有向图，节点代表模块（文件），边代表 `import`/`require` 关系——"A 依赖 B"意味着从 A 到 B 有一条有向边。

构建工具需要它的原因：

1. **确定打包范围**——只有从入口可达的模块才需要参与打包，而不是扫描整个文件系统。
2. **决定处理顺序**——被依赖的模块必须先于依赖者被编译或加载（拓扑排序）。
3. **支撑高级优化**——tree-shaking 需要知道哪些导出没有被任何模块引用；code-splitting 需要知道哪些模块被多个入口共享。
4. **增量构建**——只有图中发生变更的子树才需要重新处理。

用这个场景的例子来说：`main.js → App.js → Header.js → content.js`，如果 `content.js` 没有出现在依赖图里，构建工具根本不会碰它。

---

### Q2：从入口到依赖图的完整流程是什么？请用这个 demo 的实际文件描述。

**A：** 以 `demo-src/src/main.js` 作为入口：


| 步骤  | 动作                             | 结果                                                |
| --- | ------------------------------ | ------------------------------------------------- |
| 1   | 读取 `main.js` 的源码文本             | 得到三条 import                                       |
| 2   | 识别 `react-dom/client`（非相对路径）   | 标记为**外部依赖**，不递归                                   |
| 3   | 识别 `./App.js`（相对路径）            | 解析为 `src/App.js`，加入待访问队列                          |
| 4   | 识别 `./styles/global.css`（相对路径） | 解析为 `src/styles/global.css`，叶子节点（CSS 无 JS import） |
| 5   | 读取 `App.js`                    | 发现依赖 `Header.js`、`Counter.js`、`format.js`         |
| 6   | 读取 `Header.js`                 | 发现依赖 `content.js`（叶子）                             |
| 7   | 读取 `Counter.js`                | 发现依赖 `button.js`（叶子）                              |
| 8   | 读取 `format.js`                 | 无依赖（叶子）                                           |
| 9   | 所有文件都已访问                       | 输出完整依赖图                                           |


最终图结构：

```
main.js ──→ App.js ──→ Header.js ──→ content.js
  │            │──→ Counter.js ──→ button.js
  │            └──→ format.js
  ├──→ global.css
  └──→ react-dom/client (external)
```

---

### Q3：什么是"入口（entry）"？为什么构建工具必须有入口？

**A：** 入口是构建工具开始分析的第一个文件。在这个场景中，入口是 `demo-src/src/main.js`。

必须有入口的原因是：项目可能有成百上千个文件，构建工具不能（也不应该）无差别地读取所有文件。它需要一个起点来回答一个关键问题——**"从这个起点出发，运行时真正需要哪些模块？"** 入口就是这个起点。

在 Webpack 配置里：

```js
entry: path.resolve(__dirname, 'demo-src/src/main.js')
```

在 mini-bundler 里：

```js
const entryFile = path.resolve(process.argv[3] || path.join(rootDir, 'src/main.js'));
```

两者做的事情一样：告诉工具"从这里开始读"。

---

## 二、mini-bundler 实现细节

### Q4：mini-bundler 用正则匹配 import，这个正则能覆盖哪些情况？有什么不能覆盖的？

**A：** mini-bundler 使用的正则：

```js
/import\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g
```

**能覆盖的：**

- `import { App } from './App.js'` — 命名导入
- `import './styles/global.css'` — 副作用导入（没有 from）
- `import { createRoot } from 'react-dom/client'` — 从 npm 包导入
- `import defaultExport from './foo'` — 默认导入

**不能覆盖的：**

- `const foo = require('./foo')` — CommonJS 语法
- `import('./lazy-module')` — 动态 import（异步加载）
- 多行 import（如大量具名导入换行书写的情况）
- 模板字符串中的 import 或注释中被注释掉的 import
- `export { x } from './re-export'` — re-export 语法

真实构建工具（如 Webpack）使用完整的 JS parser（acorn / swc / babel）来解析 AST，可以覆盖所有这些情况。mini-bundler 选择正则是为了把核心逻辑控制在最少代码量。

---

### Q5：`candidatePaths` 函数在做什么？为什么需要它？

**A：** 它解决的问题是：源码里写 `import { App } from './App'` 时，并没有写 `.js` 后缀，但文件系统上的文件名是 `App.js`。

```js
function candidatePaths(seed) {
  const list = [seed];
  if (!exts.includes(path.extname(seed))) {
    for (const ext of exts) list.push(`${seed}${ext}`);
    list.push(path.join(seed, 'index.js'));
    list.push(path.join(seed, 'index.jsx'));
  }
  return [...new Set(list)];
}
```

它的尝试策略：

1. 先试原始路径本身
2. 依次补全 `.js`、`.jsx`、`.css` 后缀
3. 尝试 `目录/index.js` 和 `目录/index.jsx`（目录导入）

这对应真实构建工具里的**模块解析（Module Resolution）**。Node.js、Webpack、Vite 等工具都有类似机制，只是规则更复杂（还要处理 `package.json` 的 `exports` 字段、`alias`、`tsconfig paths` 等）。

---

### Q6：mini-bundler 是如何防止循环依赖导致死循环的？

**A：** 通过 `visited` 集合：

```js
const visited = new Set();

function visit(absoluteFilePath) {
  const moduleId = relativeId(rootDir, absoluteFilePath);
  if (visited.has(moduleId)) return;  // 已访问过就跳过
  visited.add(moduleId);
  // ... 继续分析
}
```

每次进入一个模块时，先检查它是否已经被访问过。如果是，直接 `return`，不再递归。这保证了即使 A → B → A 形成循环，也不会无限递归。

真实构建工具的做法相同：模块一旦进入"已处理"状态，就不会重复解析，只是会保留已有的引用关系。

---

### Q7：`resolveImport` 函数如何区分"本地依赖"和"外部依赖"？

**A：** 规则很简单——看 import 路径是否以 `.` 开头：

```js
if (!specifier.startsWith('.')) {
  return { resolved: specifier, external: true, found: true, absolutePath: specifier };
}
```

- `./App.js`、`../constants/content.js` → 以 `.` 开头 → **本地依赖**，继续递归读取
- `react-dom/client` → 不以 `.` 开头 → **外部依赖**，记录但不递归

在真实工具中，外部依赖的解析远比这复杂：需要查找 `node_modules`，解析 `package.json` 的 `main`/`module`/`exports` 字段，处理 pnpm 的符号链接结构等。但核心判断逻辑的起点是一样的。

---

### Q8：mini-bundler 输出的 `topologicalLikeOrder` 是什么？它和真正的拓扑排序有什么区别？

**A：** `topologicalLikeOrder` 是 `visitedOrder` 的反转：

```js
topologicalLikeOrder: [...visitedOrder].reverse()
```

`visitedOrder` 是 DFS 首次访问各节点的顺序，反转后大致能得到一个"叶子在前、入口在后"的顺序，模拟了拓扑排序的效果——被依赖的模块排在前面。

**和真正拓扑排序的区别：**

- 真正的拓扑排序（如 Kahn 算法）会严格保证"每个节点都排在它所有依赖的后面"
- DFS 反转在无环图上等价于拓扑排序，但依赖于 DFS 遍历的分支顺序，不同的分支遍历顺序可能产生不同（但同样合法）的拓扑序
- 如果存在循环依赖，真正的拓扑排序会检测并报告，而简单反转不会

对于这个 demo 的无环依赖图，DFS 反转已经足够准确。

---

## 三、Webpack 对比

### Q9：看 Webpack 的 `webpack-stats.simplified.json`，它比 mini-bundler 多发现了哪些模块？为什么？

**A：** Webpack 多发现了以下模块（mini-bundler 没有涉及的）：

1. `**react-dom/cjs/react-dom-client.development.js`**（1065KB）— react-dom 的入口 `client.js` 内部用 `require` 引入的实际实现
2. `**react/index.js` → `react/cjs/react.development.js`**（47KB）— react 核心
3. `**scheduler/index.js` → `scheduler/cjs/scheduler.development.js**`（12KB）— React 的调度器
4. `**react-dom/index.js` → `react-dom/cjs/react-dom.development.js**`（17KB）— react-dom 基础包
5. **Webpack runtime 模块**（define property getters、hasOwnProperty shorthand 等）

原因：

- mini-bundler 遇到 `react-dom/client` 就标记为"外部依赖"并停止递归
- Webpack 会**深入 node_modules**，把 `react-dom/client` 解析为真实文件路径，继续递归分析它内部的 `require`
- Webpack 还注入自己的运行时代码（runtime modules）来支持模块系统在浏览器中运行

这正是"教学工具"和"工程级工具"的核心差异之一。

---

### Q10：Webpack stats 中的 `issuer` 和 `reasons` 字段分别代表什么？

**A：**

- `**issuer`**：表示"谁导入了我"，即当前模块被哪个模块引入。例如 `Header.js` 的 issuer 是 `App.js`，说明 `App.js` 里有 `import { Header } from './components/Header.js'`。
- `**reasons`**：是 `issuer` 的详细版本，记录了每一个导致当前模块被包含的原因。每条 reason 包含：
  - `type`：依赖类型，如 `harmony side effect evaluation`（ES module 的副作用评估）、`harmony import specifier`（具名导入）、`cjs require`（CommonJS require）
  - `userRequest`：源码里写的原始路径字符串
  - `moduleName`：引用方的模块名

一个模块可以有多条 reasons，说明它被多个地方依赖。例如 `react/index.js` 有两条 reasons，分别来自 `react-dom-client.development.js` 和 `react-dom.development.js`。

这些信息让 Webpack 可以做 tree-shaking、chunk 拆分等高级优化——它不只是知道"有依赖"，还知道"为什么依赖、依赖了什么"。

---

### Q11：`harmony side effect evaluation` 和 `harmony import specifier` 的区别是什么？

**A：** 以 `import { Header } from './components/Header.js'` 为例：

- `**harmony side effect evaluation`**：Webpack 评估这条 import 语句本身——即使没有使用 `Header`，`Header.js` 模块也可能有副作用（比如全局注册、修改原型链等），所以需要被包含。
- `**harmony import specifier`**：Webpack 发现代码中实际使用了 `Header` 这个导出绑定。

两者配合工作：`side effect evaluation` 决定模块是否需要被加载（考虑副作用），`import specifier` 决定具体哪些导出被使用（支撑 tree-shaking）。

如果 `package.json` 中标注了 `"sideEffects": false`，Webpack 在发现只有 `side effect evaluation` 而没有 `import specifier` 时，可以安全地跳过该模块。

---

## 四、模块解析深入

### Q12：如果 demo 中的 `App.js` 写成 `import { Header } from './components/Header'`（不带 `.js`），mini-bundler 还能正常工作吗？为什么？

**A：** 能正常工作。因为 `candidatePaths` 函数会自动尝试补全扩展名：

1. 先尝试 `./components/Header`（不存在）
2. 尝试 `./components/Header.js`（找到！）
3. 返回解析结果

这模拟了 Node.js 和 Webpack 的默认模块解析行为。但有些构建工具（如 Vite 在某些模式下）要求必须写明扩展名，这是不同工具在"解析宽松度"上的设计取舍。

---

### Q13：CSS 文件（`global.css`）被 import 后，mini-bundler 和 Webpack 分别怎么处理？

**A：**

**mini-bundler：** 把它当普通文件读取，用正则匹配 import。由于 CSS 文件中不存在 JS 的 import 语法，所以匹配不到任何依赖，`global.css` 自然成为叶子节点。bundler 只是把它记录在依赖图中，不做任何转换。

**Webpack：** 通过 `webpack.config.js` 里配置的 rule 来处理：

```js
{ test: /\.css$/, type: 'asset/source' }
```

`asset/source` 告诉 Webpack 把 CSS 文件内容作为原始字符串导出。在真实项目中，通常会用 `css-loader` + `style-loader` 或 `MiniCssExtractPlugin` 来处理。

这体现了一个关键区别：mini-bundler 只做依赖分析，不关心"文件内容怎么转换"；Webpack 的 loader 机制让它可以把任何类型的文件都转换为有效的 JS 模块。

---

### Q14：如果有一个模块 `import` 了一个不存在的文件，mini-bundler 会怎么处理？Webpack 呢？

**A：**

**mini-bundler：** `resolveImport` 中所有 candidate 都没有命中时，返回 `{ found: false }`，记录一条边但不递归：

```js
if (!resolved.external && resolved.found) {
  visit(resolved.absolutePath);  // found 为 false 时不进入
}
```

这意味着依赖图中会保留这条"未解析"的边，但不会报错中断。这是一种宽容策略。

**Webpack：** 默认会报 `ModuleNotFoundError` 并中断构建。因为在工程场景中，引用了不存在的文件几乎一定是 bug，应该尽早暴露。

---

## 五、工程思维与延伸

### Q15：为什么说"依赖分析"是构建工具的第一步，而不是"编译"或"打包"？

**A：** 因为如果你不知道要处理哪些文件，编译和打包就无从下手。

打一个比方：你不可能在不知道食材清单的情况下开始做菜。依赖分析就是那份"食材清单"——它告诉后续步骤：

1. **有哪些文件需要处理**（节点）
2. **它们之间的关系是什么**（边）
3. **应该按什么顺序处理**（拓扑序）

在全链路中的位置：

```
源码 → [依赖分析] → 编译转换 → 代码优化 → 打包输出
        ^^^^^^^^
        必须先完成
```

Webpack、Vite、Rollup、esbuild 虽然实现细节差异巨大，但都从"读取入口 → 分析依赖 → 建立模块图"这一步开始。

---

### Q16：Tree-shaking 和依赖图有什么关系？

**A：** Tree-shaking 是在依赖图的基础上进一步细化——不仅知道"A 依赖 B"，还要知道"A 具体用了 B 的哪些导出"。

以本场景为例：

- `App.js` 导入了 `formatCount` from `format.js`
- 如果 `format.js` 还导出了 `formatDate`，但没有任何模块用到它
- tree-shaking 可以从最终 bundle 中删除 `formatDate`

这就是为什么 Webpack stats 里要区分 `harmony side effect evaluation` 和 `harmony import specifier`——它不仅记录模块级别的依赖关系，还记录了导出绑定级别的引用关系。

mini-bundler 只建立了模块级别的依赖图，无法做 tree-shaking。

---

### Q17：Vite 和 Webpack 在"依赖分析"这一步有什么关键区别？

**A：**


| 维度     | Webpack          | Vite（开发模式）             |
| ------ | ---------------- | ---------------------- |
| 分析时机   | 启动时一次性构建完整依赖图    | 按需分析，浏览器请求哪个模块才分析哪个    |
| 外部依赖处理 | 全部打包进 bundle     | 预构建（esbuild）一次，后续从缓存加载 |
| 增量策略   | 文件变更时重建受影响子图     | 基于浏览器原生 ESM，只替换变更模块    |
| 解析器    | acorn（JS parser） | esbuild（Go 实现，速度极快）    |


但两者的核心逻辑是一样的——都是从入口出发，递归读取 import，建立模块依赖关系。不同的是"什么时候做"和"做到什么程度"。

---

### Q18：如果让你在 mini-bundler 的基础上加一个功能，支持"检测循环依赖并报警"，你会怎么做？

**A：** 维护一个"当前递归路径"栈（而不只是 visited 集合）：

```js
function visit(absoluteFilePath, stack = []) {
  const moduleId = relativeId(rootDir, absoluteFilePath);

  if (stack.includes(moduleId)) {
    console.warn(`循环依赖检测: ${[...stack, moduleId].join(' → ')}`);
    return;
  }

  if (visited.has(moduleId)) return;
  visited.add(moduleId);

  const newStack = [...stack, moduleId];

  // ... 解析 imports
  for (const dep of localDeps) {
    visit(dep.absolutePath, newStack);
  }
}
```

关键区别：

- `visited` 防止重复处理（全局状态）
- `stack` 记录"从入口到当前节点的路径"（局部状态），只有在当前路径上重复出现才是循环依赖

这也是真实工具（如 `madge`、Webpack 的 `circular-dependency-plugin`）的基本实现思路。

---

### Q19：Webpack 打包后的 `bundle.js` 体积是多少？为什么比源码大这么多？

**A：** 从 Webpack stats 可以算出总模块体积：

- 业务代码：`main.js`(369B) + `App.js`(326B) + `Header.js`(190B) + `Counter.js`(226B) + `format.js`(165B) + `content.js`(125B) + `button.js`(141B) + `global.css`(97B) ≈ **1.6KB**
- react-dom-client.development.js 单个就有 **1065KB**
- 加上 react(47KB)、scheduler(12KB)、react-dom(17KB)、Webpack runtime 等

总计超过 **1MB**。

业务代码只占约 0.14%，其余都是 React 的运行时。这就是为什么生产构建中需要：

1. 使用 `mode: 'production'` 来启用压缩和 production 版本的 React（体积小得多）
2. 使用 tree-shaking 移除未使用代码
3. 使用 code-splitting 按需加载

这也解释了为什么 mini-bundler 不递归外部依赖是合理的教学简化——否则输出会被 React 源码淹没。

---

### Q20：如果面试官让你"不用任何构建工具，在浏览器里直接跑这些模块"，可行吗？需要改什么？

**A：** 可行，但需要做以下调整：

1. **import 路径必须是完整的 URL 或相对路径（带扩展名）：**

```js
// 浏览器要求
import { App } from './App.js';       // OK，已有扩展名
import { createRoot } from 'react-dom/client';  // 不行，浏览器不认识裸模块说明符
```

1. **需要用 Import Map 映射外部依赖：**

```html
<script type="importmap">
{
  "imports": {
    "react-dom/client": "https://esm.sh/react-dom@19/client"
  }
}
</script>
```

1. **CSS import 不能用 JS 的 import 语法：** 浏览器的 `<script type="module">` 不能 import CSS（除非使用 CSS Module Scripts 提案），需要改为 `<link>` 标签。
2. **HTML 入口：**

```html
<script type="module" src="./src/main.js"></script>
```

这就是构建工具存在的核心意义之一：它弥合了"开发者写代码的方式"和"浏览器能理解的方式"之间的鸿沟。

---

## 六、代码阅读考查

### Q21：看 mini-bundler.js 中的 `buildGraph` 函数，请指出它的时间复杂度。

**A：**

- 设模块总数为 `V`，依赖边总数为 `E`
- 每个模块最多被 `visit()` 一次（`visited` 集合保证）
- 每次 visit 中，对源码做正则全局匹配的复杂度是 `O(源码长度)`
- 每条 import 会做一次 `resolveImport`，其中 `candidatePaths` 最多产生约 5 个候选，每个调用 `fs.existsSync`

**整体复杂度：O(V × L + E × C)**

- `L` = 平均源码长度（正则匹配）
- `C` = 路径解析的常数成本（文件系统调用）

在真实项目中瓶颈通常是文件系统 I/O（`readFileSync`、`existsSync`），而非 CPU 计算。这就是为什么 Webpack 做缓存，esbuild 用 Go 并行 I/O，Vite 只按需分析。

---

### Q22：`relativeId` 和 `toPosix` 的作用是什么？如果去掉它们会怎样？

**A：**

- `toPosix`：把 Windows 路径的 `\` 转为 `/`，保证在不同操作系统上输出一致的模块 ID
- `relativeId`：把绝对路径转为相对于 `rootDir` 的路径，作为模块的唯一标识

如果去掉它们：

1. 模块 ID 会变成绝对路径（如 `/Users/liu/Desktop/.../src/App.js`），依赖图的输出既冗长又和机器环境耦合
2. 在 Windows 上路径分隔符不统一，同一个文件可能产生不同的模块 ID，导致 `visited` 集合失效，引发重复访问甚至死循环
3. 无法在不同开发者的机器之间比较依赖图输出

这虽然是很小的细节，但在构建工具中是普遍实践——Webpack 内部也有类似的路径标准化逻辑。

---

## 七、场景拓展

### Q23：这个场景的依赖图是一棵树（DAG），真实项目中常见的非树形依赖有哪些？

**A：** 常见情况：

1. **钻石依赖（Diamond Dependency）：**
  - A → B, A → C, B → D, C → D
  - D 被 B 和 C 同时依赖，形成菱形
  - 在 React 项目中很常见：多个组件都依赖同一个 `utils` 模块
2. **循环依赖（Circular Dependency）：**
  - A → B → A
  - 常见于状态管理和事件系统中互相引用
3. **多入口共享（Shared Modules）：**
  - 两个入口分别依赖同一批模块
  - code-splitting 需要决定共享模块放在哪个 chunk

mini-bundler 的 `visited` 集合已经能正确处理钻石依赖和循环依赖（不会重复访问），但它不记录"被多少个模块依赖"这个信息，所以无法支撑 code-splitting 的决策。

---

### Q24：如果让你给 mini-bundler 加上"增量分析"能力（文件修改后只重新分析受影响的部分），大致思路是什么？

**A：**

1. **首次构建时缓存每个模块的信息**（文件内容哈希、依赖列表、修改时间）
2. **文件变更时**（通过 `fs.watch` 或 chokidar 监听）：
  - 重新读取变更文件的源码
  - 重新提取其 import 列表
  - 如果依赖列表没变，只更新该节点的内容哈希
  - 如果依赖列表变了（新增/删除 import），需要更新依赖图的边
3. **向上传播失效**：如果 A 依赖 B，B 的导出发生变化，A 也需要重新处理（这依赖于更精细的导出分析）

Webpack 的 `persistent caching`（webpack 5 引入）和 Vite 的 HMR 机制都建立在类似思路上，只不过实现细节远比这复杂。

---

### Q25：正则方案 vs AST 方案提取 import，各有什么优劣？真实构建工具怎么选？

**A：**


| 维度    | 正则                            | AST（babel/acorn/swc）              |
| ----- | ----------------------------- | --------------------------------- |
| 实现复杂度 | 极低（一行正则）                      | 较高（需要 parser 依赖）                  |
| 准确性   | 有误判（注释中的 import、字符串中的 import） | 语法级别精确                            |
| 覆盖范围  | 只能处理简单 import 语法              | 所有 JS/TS 语法，包括动态 import、re-export |
| 性能    | 非常快                           | parser 本身有开销，但可以一次解析获取所有信息        |
| 附加能力  | 无                             | 可以同时做 tree-shaking 标记、作用域分析、代码转换  |


**真实工具的选择：**

- **Webpack**：用 acorn（JS parser）或 babel-loader，走 AST
- **Vite/Rollup**：用 acorn 做分析，用 esbuild 做转换
- **esbuild**：Go 实现的自研 parser，极快
- **SWC**：Rust 实现的 parser，极快
- **简单的 lint/check 工具**：有些场景确实用正则（如 `eslint-plugin-import` 的部分检查），但核心分析仍走 AST

mini-bundler 用正则是完全正确的教学选择——它让核心逻辑不被 parser API 淹没。