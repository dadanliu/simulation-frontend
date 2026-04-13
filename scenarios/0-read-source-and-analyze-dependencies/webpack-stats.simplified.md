# webpack-stats.simplified

这个文件是基于 `webpack-stats.json` 提取出来的**简化版依赖调试视图**。

目标只有一个：

**只保留看“模块关系”和“为什么被引入”真正必要的字段。**

---

## 保留了什么

### 1. `entrypoints`
用来回答：

- 构建入口有哪些
- 入口最后对应哪些 chunk / assets

结构示例：

```json
{
  "main": {
    "chunks": ["main"],
    "assets": ["bundle.js"]
  }
}
```

### 2. `chunks`
用来回答：

- 生成了哪些 chunk
- 哪些 chunk 是入口 chunk
- 每个 chunk 对应哪些输出文件

结构示例：

```json
{
  "id": "main",
  "names": ["main"],
  "files": ["bundle.js"],
  "entry": true,
  "initial": true
}
```

### 3. `modules`
这是最关键的部分，用来回答：

- Webpack 最终识别了哪些模块
- 每个模块是谁引入进来的
- 为什么会进入模块图

每个 module 只保留：

- `name`：模块名 / 路径
- `size`：模块体积
- `chunks`：进了哪些 chunk
- `issuer`：是谁把它带进来的
- `reasons`：更细的引入原因

结构示例：

```json
{
  "name": "./demo-src/src/App.js",
  "size": 326,
  "chunks": ["main"],
  "issuer": "./demo-src/src/main.js",
  "reasons": [
    {
      "type": "harmony side effect evaluation",
      "userRequest": "./App.js",
      "moduleName": "./demo-src/src/main.js",
      "resolvedModule": "/abs/path/demo-src/src/main.js"
    }
  ]
}
```

---

## `reasons` 是干什么的

一句话：

> **`reasons` 用来解释“这个模块为什么会被 Webpack 放进模块图里”。**

如果只看 `modules[].name`，你只能知道：

- 这个模块存在

如果再看 `issuer`，你会知道：

- 大概率是谁把它带进来的

但如果要继续往下问：

- 是因为 `import` 进来的吗？
- 是因为入口指定的吗？
- 是因为 CommonJS `require` 吗？
- 是因为某种 runtime / side effect 关系吗？

那就要看 `reasons`。

也就是说：

- `issuer` 更像“上游是谁”
- `reasons` 更像“为什么形成这条连接”

---

## 为什么 `reasons` 很重要

调试依赖关系时，最常见的问题不是：

> 这个模块叫什么？

而是：

> **它为什么会进来？**

例如你会问：

- 为什么 `App.js` 在 bundle 里？
- 为什么 `react-dom/client` 会被打进来？
- 为什么某个模块明明没直接 import，最后还是出现了？

这时候 `reasons` 就是最直接的证据。

---

## `reasons` 里的关键字段

在这个简化版里，我保留了这些字段：

### 1. `type`
表示“引入原因的类型”。

常见值示例：

- `entry`
- `harmony side effect evaluation`
- `harmony import specifier`
- `cjs require`
- `cjs export require`

#### 怎么理解

- `entry`
  - 说明这个模块是构建入口，不是被别的模块 import 进来的
- `harmony ...`
  - 说明这是 ES Module（也就是 `import/export`）链路带进来的
- `cjs ...`
  - 说明这是 CommonJS（也就是 `require/module.exports`）链路带进来的

所以 `type` 首先回答的是：

> **这条依赖关系属于哪种模块系统 / 哪种引入方式？**

---

### 2. `userRequest`
表示源码里写出来的“请求字符串”。

比如：

```js
import { App } from './App.js';
```

那这里通常就是：

```json
"userRequest": "./App.js"
```

#### 怎么理解

它不是最终解析后的绝对路径，
而是**开发者在源码里手写的那段 import 路径**。

所以它回答的是：

> **源码里当时到底写了什么？**

这个字段在 debug 时很有用，因为它最接近你看到的源代码。

---

### 3. `moduleName`
表示“是谁发起了这次依赖请求”。

比如：

```json
"moduleName": "./demo-src/src/main.js"
```

说明：

> 是 `main.js` 这个模块发起了对当前模块的依赖请求。

可以把它理解成“边的起点”。

所以它回答的是：

> **是哪一个模块引用了当前模块？**

---

### 4. `resolvedModule`
表示发起依赖请求的模块，在 Webpack 内部对应到哪个更完整的模块标识。

在这个简化版里它通常是绝对路径，类似：

```json
"resolvedModule": "/Users/.../demo-src/src/main.js"
```

#### 怎么理解

- `moduleName` 更适合人读
- `resolvedModule` 更接近 Webpack 内部真正追踪到的模块身份

所以它回答的是：

> **Webpack 内部最终把“这个发起方模块”认成了谁？**

---

## 一个具体例子

看这个简化后的记录：

```json
{
  "name": "./demo-src/src/App.js",
  "issuer": "./demo-src/src/main.js",
  "reasons": [
    {
      "type": "harmony side effect evaluation",
      "userRequest": "./App.js",
      "moduleName": "./demo-src/src/main.js",
      "resolvedModule": "/abs/path/demo-src/src/main.js"
    },
    {
      "type": "harmony import specifier",
      "userRequest": "./App.js",
      "moduleName": "./demo-src/src/main.js",
      "resolvedModule": "/abs/path/demo-src/src/main.js"
    }
  ]
}
```

可以读成：

- 当前模块是 `App.js`
- 上游是 `main.js`
- `main.js` 在源码里写了 `./App.js`
- 这是 ESM import 链路 (`harmony ...`) 带进来的

也就是：

```text
main.js --import './App.js'--> App.js
```

`reasons` 就是在帮你把这条关系拆开说明。

---

## `issuer` 和 `reasons` 的关系

很多时候它们看起来有点像，但职责不一样：

### `issuer`
更适合快速看：

> 这个模块大体上是谁带进来的？

### `reasons`
更适合细看：

> 它到底为什么进来？是 entry？ESM import？CJS require？源码里写的请求字符串是什么？

所以你可以这样用：

- **第一眼看 `issuer`**
- **想深挖时看 `reasons`**

---

## 实战里怎么看 `reasons`

如果你在调某个模块为什么进入 bundle，推荐这个顺序：

1. 找到 `modules[]` 里对应模块
2. 看 `issuer`
3. 看 `reasons[].type`
4. 看 `reasons[].userRequest`
5. 看 `reasons[].moduleName`

这样通常就能回答：

- 谁引用了它
- 用什么方式引用了它
- 源码里写的是什么路径

---

## 和手写 mini-bundler 的对应关系

你可以这样类比：

- mini-bundler 的 `nodes` ≈ 这里的 `modules`
- mini-bundler 的 `edges` ≈ 这里的 `issuer + reasons`

区别在于：

- mini-bundler 直接把边写成 `from -> to`
- Webpack 更偏“模块对象 + 为什么被引入”的表达

所以：

- 想看得最直白：看 mini-bundler 的 `edges`
- 想看 Webpack 内部是怎么解释这条边的：看 `reasons`

---

## 删掉了什么

为了让它更适合看依赖关系，删掉了大量非核心字段，比如：

- hash
- warnings / errors 细节
- timing 明细
- orphan / optimization bailout 等构建优化信息
- module source
- 大量运行时元数据

这些字段对“调模块依赖图”不是第一优先级，所以先去掉。

---

## 怎么用这个简化版

如果你要看某个模块为什么进来，优先看：

1. `modules[].name`
2. `modules[].issuer`
3. `modules[].reasons`

如果你要看它最后进了哪个 bundle，补充看：

4. `modules[].chunks`
5. `chunks[]`
6. `entrypoints`
