# Scenarios 目录说明

结论先说：

**`scenarios/` 的正确目标不是放几个代表性知识点 demo。**
**正确目标是：线性全链路里的每一个 `->`，都应该对应一个独立场景。**

也就是说：

- 一条总链路负责说明全貌
- `full-chain/` 负责把整条故事串起来
- `scenarios/` 负责把每一个箭头拆成单独可运行模拟

---

## 当前状态

当前目录下已经有一些重要场景：

- `0-read-source-and-analyze-dependencies/`
- `1-compile-framework-syntax-to-browser-javascript/`
- `2-process-css-images-and-font-assets/`
- `3-serve-files-via-dev-server-node-nginx-cdn/`
- `4-browser-initiates-request-and-receives-bytes/`
- `5-parse-html-build-dom-tree/`
- `6-parse-css-build-cssom-tree/`
- `7-load-and-execute-javascript-concurrently/`
- `build-emits-static-html/`
- `build-emits-runtime-artifacts/`
- `request-generates-html-on-server/`
- `browser-receives-server-component-result/`
- `hydration-enables-interaction/`
- `client-state-drives-ui-update/`
- `fetch-roundtrip-updates-ui/`

它们是有价值的，但还不够。

问题在于：

- 这些场景还是偏“挑重点节点”
- 还没有做到“每一个箭头一个场景”
- 还缺少大量浏览器解析和渲染流水线节点
- 还缺少从源码描述到构建分析之间的更细颗粒度场景

所以后续方向不是继续随机加 demo，
而是**按全链路顺序，把缺失箭头逐个补齐。**

---

## 目标链路

完整目标链路应该是：

```text
人在 VSCode 里写前端源码
-> 源码用框架语法描述状态、结构、样式、交互
-> 构建工具读取源码，分析依赖关系
-> TypeScript / JSX / Vue 模板被编译成浏览器能执行的 JavaScript
-> CSS、图片、字体等资源被整理、转换、切分
-> 最终产出 HTML / JS / CSS / 静态资源文件
-> 这些文件通过本地 dev server、Nginx、CDN 或静态服务器被浏览器请求
-> 浏览器收到的其实只是一堆字节流
-> 浏览器先解析 HTML，生成 DOM 树
-> 再解析 CSS，生成 CSSOM
-> 同时加载并执行 JavaScript
-> JavaScript 里的框架运行时启动，创建应用实例
-> 框架读取当前状态、组件树、路由、接口数据
-> 把当前状态下页面应该长什么样计算出来
-> 生成或更新对应的 DOM 结构
-> 浏览器把 DOM + CSSOM 组合成 Render Tree
-> 浏览器做 Style 计算，得到每个节点的最终样式
-> 浏览器做 Layout，算出每个元素的位置和尺寸
-> 浏览器做 Paint，把文字、颜色、边框、阴影等画出来
-> 浏览器做 Composite，把多个图层合成
-> GPU / 显示系统把结果输出到屏幕
-> 用户看到页面
-> 用户点击、输入、滚动
-> 浏览器把这些输入转成事件
-> JavaScript 事件处理函数运行
-> 应用状态发生变化
-> 框架重新计算受影响的 UI
-> 更新 DOM / 样式 / 布局 / 绘制
-> 屏幕上的像素发生变化
-> 用户看到系统响应了
```

---

## 目录设计原则

以后 `scenarios/` 里每个目录都应该满足：

1. **只解释一个节点或一个非常短的连续片段**
2. **明确写出它在线性链路中的位置**
3. **明确写出输入和输出**
4. **能单独运行**
5. **能让读者观察到这个节点的真实职责**

如果一个场景无法回答“它是哪个箭头”，那它就还不够清楚。

---

## 推荐推进方式

优先按下面顺序补：

### 第一批：源码与构建前半段
- 源码描述结构
- 源码描述状态
- 源码描述样式
- 源码描述交互
- 构建工具读取源码
- 构建工具分析依赖
- TS / JSX 编译
- 静态资源处理
- 产物输出

### 第二批：浏览器解析与首屏渲染
- 浏览器收到字节流
- HTML -> DOM
- CSS -> CSSOM
- JS 执行
- 运行时启动
- 读取状态 / 路由 / 数据
- 计算 UI
- DOM 提交
- Render Tree
- Style
- Layout
- Paint
- Composite
- GPU 输出
- 用户首次看到页面

### 第三批：交互更新链
- 用户输入
- 浏览器事件分发
- 处理函数执行
- 状态变化
- 重新计算 UI
- DOM / 样式 / 布局 / 绘制更新
- 像素变化
- 用户感知响应

---

## 和 `full-chain/` 的分工

- `full-chain/`：讲整条故事
- `scenarios/`：拆每个箭头

不要把两者混起来：

- `full-chain/` 不是拿来塞 30 个独立小 demo 的
- `scenarios/` 不是拿来随便放几个术语样例的

两者配合起来，才是完整项目骨架。
