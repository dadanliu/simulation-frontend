# Frontend full-chain scenario map

这份文件不是运行代码，而是**场景地图**。

用途只有一个：

**把整条前端链路拆成“每个箭头一个场景”的清单。**

当前仓库还没把下面所有场景都做出来，但以后新增场景应优先对照这张表补齐，而不是随意长。

| # | 目标场景 | 当前状态 |
|---|---|---|
| 1 | 人在 VSCode 里写前端源码 | 待补 |
| 2 | 源码用框架语法描述状态、结构、样式、交互 | 待补 |
| 3 | 构建工具读取源码，分析依赖关系 | 已有：`scenarios/0-read-source-and-analyze-dependencies` |
| 4 | TypeScript / JSX / Vue 模板被编译成浏览器可执行 JavaScript | 已有：`scenarios/1-compile-framework-syntax-to-browser-javascript` |
| 5 | CSS / 图片 / 字体等资源被整理、转换、切分 | 已有：`scenarios/2-process-css-images-and-font-assets` |
| 6 | 最终产出 HTML / JS / CSS / 静态资源文件 | 部分已有：`build-emits-runtime-artifacts` |
| 7 | 这些文件通过 dev server / Nginx / CDN / 静态服务器被浏览器请求 | 已有：`scenarios/3-serve-files-via-dev-server-node-nginx-cdn` |
| 8 | 浏览器收到的其实是一堆字节流 | 待补 |
| 9 | 浏览器解析 HTML，生成 DOM | 待补 |
| 10 | 浏览器解析 CSS，生成 CSSOM | 待补 |
| 11 | 浏览器加载并执行 JavaScript | 待补 |
| 12 | 框架运行时启动，创建应用实例 | 部分已有：`hydration-enables-interaction` |
| 13 | 框架读取当前状态、组件树、路由、接口数据 | 部分已有：`request-generates-html-on-server` / `browser-receives-server-component-result` |
| 14 | 计算当前状态下页面应该长什么样 | 待补 |
| 15 | 生成或更新对应 DOM 结构 | 部分已有：`client-state-drives-ui-update` |
| 16 | DOM + CSSOM 组合成 Render Tree | 待补 |
| 17 | 浏览器做 Style 计算 | 待补 |
| 18 | 浏览器做 Layout | 待补 |
| 19 | 浏览器做 Paint | 待补 |
| 20 | 浏览器做 Composite | 待补 |
| 21 | GPU / 显示系统把结果输出到屏幕 | 待补 |
| 22 | 用户看到页面 | 待补 |
| 23 | 用户点击、输入、滚动 | 待补 |
| 24 | 浏览器把输入转成事件 | 待补 |
| 25 | JavaScript 事件处理函数运行 | 部分已有：`client-state-drives-ui-update` |
| 26 | 应用状态发生变化 | 部分已有：`client-state-drives-ui-update` / `fetch-roundtrip-updates-ui` |
| 27 | 框架重新计算受影响的 UI | 部分已有：`client-state-drives-ui-update` |
| 28 | 更新 DOM / 样式 / 布局 / 绘制 | 部分已有：`client-state-drives-ui-update` |
| 29 | 屏幕像素发生变化 | 待补 |
| 30 | 用户看到系统响应了 | 部分已有：`client-state-drives-ui-update` / `fetch-roundtrip-updates-ui` |

## 已有场景的重新定位

### 构建侧
- `build-emits-static-html`
  - 对应“构建期提前产出页面结果”这类构建节点
- `build-emits-runtime-artifacts`
  - 对应“源码最终变成多类运行产物”节点

### 首屏生成侧
- `request-generates-html-on-server`
  - 对应“请求到来时服务端重新生成首屏结果”
- `browser-receives-server-component-result`
  - 对应“服务端准备好首屏结果后，浏览器接收的是结果而不是服务端函数本身”

### 接管与交互侧
- `hydration-enables-interaction`
  - 对应“先能看，后能点”
- `client-state-drives-ui-update`
  - 对应“浏览器内事件 -> 状态 -> 局部 UI 更新”
- `fetch-roundtrip-updates-ui`
  - 对应“浏览器 -> 服务端 -> JSON -> UI 更新”

## 一句话结论

当前仓库已经从“术语展柜”往“线性链路”方向走了一步，
但要达到目标，还需要继续从“7 个重点节点”推进到“30 个箭头场景地图”。
