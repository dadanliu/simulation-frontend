# 打包产物全景图

> 场景 0：读取源码与依赖分析 — 从源码到 bundle 的完整映射

---

## 1. 源码 → 依赖图 → 产物 总览

```mermaid
flowchart LR
  subgraph 源码 ["demo-src/src/"]
    direction TB
    M["main.js<br/><small>369B</small>"]
    A["App.js<br/><small>326B</small>"]
    H["Header.js<br/><small>190B</small>"]
    C["Counter.js<br/><small>226B</small>"]
    F["format.js<br/><small>165B</small>"]
    T["content.js<br/><small>125B</small>"]
    B["button.js<br/><small>141B</small>"]
    G["global.css<br/><small>97B</small>"]
  end

  subgraph 外部依赖 ["node_modules/"]
    direction TB
    RDC["react-dom/client<br/><small>1.4KB 入口</small>"]
    RD_IMPL["react-dom-client<br/>.development.js<br/><small>1065KB</small>"]
    R["react<br/><small>47KB</small>"]
    S["scheduler<br/><small>12KB</small>"]
    RD_BASE["react-dom<br/>.development.js<br/><small>17KB</small>"]
  end

  subgraph 运行时 ["Webpack Runtime"]
    direction TB
    RT1["define property getters<br/><small>308B</small>"]
    RT2["hasOwnProperty shorthand<br/><small>88B</small>"]
    RT3["make namespace object<br/><small>274B</small>"]
    RT4["node module decorator<br/><small>123B</small>"]
  end

  subgraph 产物 ["webpack-dist/"]
    BUNDLE["bundle.js<br/><small>~1.17MB · 247行</small>"]
  end

  源码 --> BUNDLE
  外部依赖 --> BUNDLE
  运行时 --> BUNDLE
```

---

## 2. 依赖图：源码模块间的 import 关系

```mermaid
graph TD
  M["🟢 main.js<br/><small>入口 · 369B</small>"]

  A["App.js<br/><small>326B</small>"]
  H["Header.js<br/><small>190B</small>"]
  C["Counter.js<br/><small>226B</small>"]
  F["format.js<br/><small>165B · 叶子</small>"]
  T["content.js<br/><small>125B · 叶子</small>"]
  B["button.js<br/><small>141B · 叶子</small>"]
  G["global.css<br/><small>97B · 叶子</small>"]
  EXT["react-dom/client<br/><small>外部依赖</small>"]

  M -->|"import { App }"| A
  M -->|"import './styles/global.css'"| G
  M -->|"import { createRoot }"| EXT

  A -->|"import { Header }"| H
  A -->|"import { Counter }"| C
  A -->|"import { formatCount }"| F

  H -->|"import { titleText }"| T
  C -->|"import { buttonClassName }"| B

  style M fill:#4ade80,stroke:#166534,color:#000
  style EXT fill:#fbbf24,stroke:#92400e,color:#000
  style F fill:#e0e7ff,stroke:#6366f1
  style T fill:#e0e7ff,stroke:#6366f1
  style B fill:#e0e7ff,stroke:#6366f1
  style G fill:#e0e7ff,stroke:#6366f1
```

---

## 3. Webpack 完整模块图（含 node_modules 展开）

```mermaid
graph TD
  M["🟢 main.js<br/><small>入口</small>"]

  A["App.js"]
  H["Header.js"]
  C["Counter.js"]
  F["format.js"]
  T["content.js"]
  B["button.js"]
  G["global.css"]

  RDC["react-dom/client.js<br/><small>1.4KB</small>"]
  RD_DEV["react-dom-client<br/>.development.js<br/><small>1065KB ⚠️</small>"]
  REACT["react/index.js<br/><small>186B</small>"]
  REACT_DEV["react.development.js<br/><small>47KB</small>"]
  SCHED["scheduler/index.js<br/><small>194B</small>"]
  SCHED_DEV["scheduler.development.js<br/><small>12KB</small>"]
  RD_BASE["react-dom/index.js<br/><small>1.4KB</small>"]
  RD_BASE_DEV["react-dom.development.js<br/><small>17KB</small>"]

  M --> A
  M --> G
  M --> RDC

  A --> H
  A --> C
  A --> F

  H --> T
  C --> B

  RDC -->|"require"| RD_DEV
  RD_DEV -->|"require 'react'"| REACT
  RD_DEV -->|"require 'scheduler'"| SCHED
  RD_DEV -->|"require 'react-dom'"| RD_BASE

  REACT --> REACT_DEV
  SCHED --> SCHED_DEV
  RD_BASE --> RD_BASE_DEV

  style M fill:#4ade80,stroke:#166534,color:#000
  style RD_DEV fill:#fca5a5,stroke:#dc2626,color:#000
  style REACT_DEV fill:#fed7aa,stroke:#ea580c
  style SCHED_DEV fill:#fed7aa,stroke:#ea580c
  style RD_BASE_DEV fill:#fed7aa,stroke:#ea580c
```

---

## 4. 模块体积占比

```mermaid
pie title bundle.js 模块体积占比（~1.17MB）
  "react-dom-client.development.js" : 1065698
  "react.development.js" : 47219
  "react-dom.development.js" : 17673
  "scheduler.development.js" : 12144
  "业务代码（8 个源码文件）" : 1639
  "react-dom 入口 + react 入口 + scheduler 入口" : 3112
  "Webpack runtime（4 个）" : 793
```

> 业务代码仅占 **0.14%**，React 运行时占 **99.5%**。这是 `mode: 'development'` 下的典型分布。

---

## 5. bundle.js 内部结构

```mermaid
flowchart TB
  subgraph BUNDLE ["webpack-dist/bundle.js（247 行 · ~1.17MB）"]
    direction TB

    IIFE["(() => { // webpackBootstrap"]

    subgraph MODULES ["__webpack_modules__ 对象"]
      direction TB
      W_MAIN["'./demo-src/src/main.js'<br/>→ eval(源码)"]
      W_APP["'./demo-src/src/App.js'<br/>→ eval(源码)"]
      W_HEADER["'./demo-src/src/components/Header.js'<br/>→ eval(源码)"]
      W_COUNTER["'./demo-src/src/components/Counter.js'<br/>→ eval(源码)"]
      W_FORMAT["'./demo-src/src/utils/format.js'<br/>→ eval(源码)"]
      W_CONTENT["'./demo-src/src/constants/content.js'<br/>→ eval(源码)"]
      W_BUTTON["'./demo-src/src/styles/button.js'<br/>→ eval(源码)"]
      W_CSS["'./demo-src/src/styles/global.css'<br/>→ module.exports = CSS字符串"]
      W_RD["'react-dom/client.js'<br/>→ require 链"]
      W_ETC["... react / scheduler 等<br/>大体积模块"]
    end

    subgraph RUNTIME ["Webpack Runtime"]
      direction TB
      R_REQ["__webpack_require__<br/><small>模块加载函数</small>"]
      R_CACHE["__webpack_module_cache__<br/><small>模块缓存</small>"]
      R_DEFINE["__webpack_require__.d<br/><small>定义 getter</small>"]
      R_NS["__webpack_require__.r<br/><small>标记 ESM</small>"]
      R_HAS["__webpack_require__.o<br/><small>hasOwnProperty</small>"]
      R_DEC["module decorator<br/><small>兼容 CJS</small>"]
    end

    ENTRY_CALL["__webpack_require__('./demo-src/src/main.js')<br/><small>启动入口</small>"]

    IIFE --> MODULES
    IIFE --> RUNTIME
    RUNTIME --> ENTRY_CALL
  end
```

---

## 6. 源码文件到 bundle 模块的映射表

| 源码文件 | bundle 中的模块 key | 体积 | 引入方式 | 上游模块 |
|----------|---------------------|------|----------|----------|
| `src/main.js` | `./demo-src/src/main.js` | 369B | **entry** | — |
| `src/App.js` | `./demo-src/src/App.js` | 326B | ESM import | main.js |
| `src/components/Header.js` | `./demo-src/src/components/Header.js` | 190B | ESM import | App.js |
| `src/components/Counter.js` | `./demo-src/src/components/Counter.js` | 226B | ESM import | App.js |
| `src/utils/format.js` | `./demo-src/src/utils/format.js` | 165B | ESM import | App.js |
| `src/constants/content.js` | `./demo-src/src/constants/content.js` | 125B | ESM import | Header.js |
| `src/styles/button.js` | `./demo-src/src/styles/button.js` | 141B | ESM import | Counter.js |
| `src/styles/global.css` | `./demo-src/src/styles/global.css` | 97B | ESM import (side effect) | main.js |
| — | `react-dom/client.js` | 1.4KB | ESM import | main.js |
| — | `react-dom-client.development.js` | **1065KB** | CJS require | react-dom/client.js |
| — | `react/index.js` → `react.development.js` | 47KB | CJS require | react-dom-client |
| — | `scheduler/index.js` → `scheduler.development.js` | 12KB | CJS require | react-dom-client |
| — | `react-dom/index.js` → `react-dom.development.js` | 17KB | CJS require | react-dom-client |
| — | Webpack runtime × 4 | 793B | 内置注入 | — |

---

## 7. DFS 遍历顺序 vs 类拓扑排序

```mermaid
flowchart LR
  subgraph DFS ["DFS 首次访问顺序（mini-bundler visitedOrder）"]
    direction LR
    D1["① main.js"] --> D2["② App.js"] --> D3["③ Header.js"] --> D4["④ content.js"] --> D5["⑤ Counter.js"] --> D6["⑥ button.js"] --> D7["⑦ format.js"] --> D8["⑧ global.css"]
  end
```

```mermaid
flowchart LR
  subgraph TOPO ["类拓扑排序（叶子优先 → 入口最后）"]
    direction LR
    T1["① global.css"] --> T2["② format.js"] --> T3["③ button.js"] --> T4["④ Counter.js"] --> T5["⑤ content.js"] --> T6["⑥ Header.js"] --> T7["⑦ App.js"] --> T8["⑧ main.js"]
  end
```

> 拓扑序保证：**被依赖的模块先处理，依赖者后处理。**
> Webpack 在执行时也遵循类似顺序：`__webpack_require__` 递归到叶子才开始返回值。

---

## 8. 一句话总结

```mermaid
flowchart LR
  SRC["8 个源码文件<br/><small>1.6KB</small>"]
  DEPS["React 全家桶<br/><small>~1.14MB</small>"]
  RT["Webpack Runtime<br/><small>793B</small>"]
  OUT["bundle.js<br/><small>~1.17MB · 1 个文件</small>"]

  SRC --> OUT
  DEPS --> OUT
  RT --> OUT

  style SRC fill:#bbf7d0,stroke:#166534
  style DEPS fill:#fca5a5,stroke:#dc2626
  style OUT fill:#dbeafe,stroke:#2563eb
```

> **所有源码 + 所有 npm 依赖 + Webpack 运行时 → 合并为一个 `bundle.js`。**
> 这就是"打包"最基本的含义：把依赖图上的所有节点，拼成浏览器可以直接加载的单文件。
