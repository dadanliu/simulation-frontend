# Next.js 全链路讲解方案

## 1. 文档目标

这份文档的目标是用一条统一主线，讲清楚：

- 从 `VSCode` 中写下 `Next.js App Router + TypeScript` 源码开始
- 到 `GitHub -> CI/CD -> build -> 静态资源/CDN + Node SSR 服务`
- 再到浏览器加载、执行、渲染
- 最终让用户在屏幕上看到并操作页面

整份内容强调三件事：

- 讲 **本质**
- 用 **真实可执行代码**
- 用 **主链路 + 分段拆解** 的方式理解全系统

## 2. 技术边界

本方案固定采用以下前提，不再横向扩展：

- 框架：`Next.js App Router`
- 版本：按较新的 `Next.js` 稳定版编写
- 语言：`TypeScript`
- 包管理器：`pnpm`
- 渲染模式：`SSR / SSG / CSR / RSC`
- 运行时：`Node.js runtime`
- 部署主线：`GitHub -> CI/CD -> build -> CDN + Node SSR 服务 -> 浏览器`
- 表达形式：`总图 + 阶段图 + 可执行代码 + 极少量解释`

本方案默认不展开：

- `Pages Router`
- `Vite` 对比
- `Edge Runtime`
- `K8s / Service Mesh / 微服务基础设施` 这类更重部署专题

### 2.1 默认实现基线

为避免后续落地时反复选择，方案增加以下默认基线：

- `Next.js` 按较新的稳定版编写
- 全部项目统一使用 `pnpm`
- 独立场景采用方案 A：每个场景都是独立 `Next.js` 项目，并各自拥有 `package.json`
- 主链路使用 `Route Handler + 本地 mock` 形成闭环
- 独立场景优先本地闭环，避免引入外部依赖
- 图示采用“两者结合”：主图优先 `Mermaid`，局部补少量 `ASCII`
- 每个独立场景目录都带一个简短 `README.md`

这组默认值的目标是：

- 保证文档与代码都能直接落地
- 保证每个场景可独立安装、运行、观察
- 保证图示既清晰又易维护
- 保证讲解闭环不被外部服务干扰

## 3. 核心讲解方式

### 3.1 统一主动作

整份文档会用一个统一动作贯穿全链路：

`用户首次打开首页 -> 服务端生成首屏 -> 浏览器接收 HTML/RSC/JS -> 页面展示 -> 用户点击按钮 -> 客户端状态更新 -> 如有需要触发请求 -> 页面局部刷新`

这条主动作可以自然串起：

- `RSC`：服务端组件参与首屏生成
- `SSR`：请求到来时动态生成页面
- `SSG`：构建时提前产出页面
- `CSR`：浏览器中执行交互逻辑
- `Hydration`：静态页面变成交互页面
- `DOM/CSSOM/Layout/Paint/Composite`：最终落到像素

### 3.2 三个并行视角

每一章都同时从三个视角解释同一件事：

- 前端工程师视角：我写了什么代码，代码如何被组织与执行
- 网络与部署视角：请求发到哪里，产物被谁返回，缓存与服务如何参与
- 浏览器内核视角：字节如何被解析、执行、布局、绘制、合成

### 3.3 输出原则

输出不会以长篇概念散文为主，而是以以下结构组织：

- 一张图说明阶段边界
- 一段真实可执行的最小代码
- 一小段解释说明“这一段的本质是什么”

### 3.4 语义化命名原则

整套文档与示例代码增加一条统一约束：

- 目录名、文件名、变量名、函数名、组件名、路由名都必须语义化
- 命名要直接表达“这个东西的职责”，而不是只表达技术形式
- 优先让读者“看到名字就知道它在链路中的位置和用途”

这条规则会同时作用于：

- 文档章节命名
- 目录结构命名
- 示例代码中的 symbol 命名
- API 路径命名
- 构建与部署阶段的产物命名

命名的目标不是“短”，而是“清晰、可预测、可回溯”。

例如：

- 好的目录名：`full-chain/`、`scenarios/stage3-ssr-basic/`、`scenarios/stage6-api-roundtrip/`
- 不好的目录名：`demo1/`、`test-a/`、`sample/`
- 好的文件名：`server-time-panel.tsx`、`request-counter.tsx`
- 不好的文件名：`panel1.tsx`、`temp.tsx`
- 好的函数名：`loadHomepageData()`、`incrementCounter()`
- 不好的函数名：`getData()`、`handleIt()`
- 好的变量名：`serverRenderedAt`、`buildTimestamp`、`clickCount`
- 不好的变量名：`data`、`res`、`n`

命名时遵循三个判断标准：

- 这个名字是否说明了“它是什么”
- 这个名字是否说明了“它为什么存在”
- 这个名字是否说明了“它处于哪一段链路中”

如果三个问题都答不清，这个名字就不够语义化。

## 4. 主项目设计

为了保证“主链路完整可执行”与“拆分场景可独立运行”同时成立，文档会基于一个最小但真实的 `Next.js` 项目来展开。

### 4.0 目录隔离原则

除代码“可执行”外，项目组织还增加一个硬约束：

- 总场景使用单独目录
- 每个独立场景使用各自单独目录
- 场景内部自包含，尽量不跨目录依赖
- 用目录边界来表达场景边界，保证高内聚

这意味着后续示例不会把所有代码堆在一个 `app/` 里混讲，而是按“主链路”和“独立场景”做物理隔离。

这样设计的目的有三点：

- 阅读时，看到目录就知道该场景要解决什么问题
- 运行时，每个场景可以单独验证，不容易互相污染
- 维护时，修改某个场景不会牵连整套讲解代码

### 4.1 主项目功能

主项目首页会同时具备以下能力：

- `Server Component` 读取服务端数据
- `Client Component` 管理按钮点击和本地状态
- `SSR` 页面展示动态内容
- `SSG` 页面展示构建期生成的静态内容
- `CSR` 页面在浏览器内完成交互更新
- `Route Handler` 提供一个最小接口
- 基础样式用于观察浏览器渲染行为

主项目的数据闭环默认采用：

- 页面内部演示数据使用本地 mock
- 需要请求往返的部分通过本地 `Route Handler` 提供
- 不依赖外部数据库、第三方 API 或远程服务

### 4.2 主项目作用

这套代码将作为整份文档的“主角”。

之后每一章都会从这套主代码中抽取一部分，解释：

- 哪些逻辑运行在服务端
- 哪些逻辑运行在浏览器
- 哪些内容在构建时就确定
- 哪些内容必须在请求发生时计算
- 哪些变化最终会触发浏览器重排、重绘、合成

## 5. 独立场景代码设计

除主链路外，还会准备一组可单独讲解、可单独运行理解的最小场景代码。

这些场景不是“从主项目里摘几段文件出来”，而是会按目录独立组织。

目录层面会坚持以下原则：

- 一个场景一个目录
- 一个目录只服务一个主题
- 场景运行所需文件尽量在本目录内闭合
- 共享代码只保留真正稳定、无场景语义的公共模块
- 每个场景都是独立 `Next.js` 项目，并各自维护自己的 `package.json`
- 每个场景目录自带一个简短 `README.md`

换句话说，目录结构本身也属于讲解设计的一部分。

### 5.1 RSC 场景

目标：

- 展示服务端组件如何直接获取数据
- 展示为什么这段代码不会进入浏览器 bundle

### 5.2 SSR 场景

目标：

- 展示请求到来时服务端如何重新计算页面
- 展示动态内容为何不能在构建阶段完全确定

### 5.3 SSG 场景

目标：

- 展示构建阶段如何提前生成 HTML
- 展示为什么这类内容适合走静态资源/CDN

### 5.4 CSR 场景

目标：

- 展示浏览器中点击按钮如何触发 `setState`
- 展示 React 更新与 DOM 更新的关系

### 5.5 Hydration 场景

目标：

- 展示“先能看，后能点”的链路
- 展示静态 HTML 如何被 React 接管

### 5.6 API 请求场景

目标：

- 展示浏览器发起请求到 `Route Handler`
- 展示响应返回后如何驱动 React 状态更新

### 5.7 构建产物场景

目标：

- 展示源码如何拆成服务端产物与客户端产物
- 展示 `HTML / JS / CSS / RSC payload` 在系统中的不同职责

## 6. 文档章节结构

### 第一章：总图

内容：

- 一张总链路全景图
- 一张主动作时序图
- 一个最小项目目录图

要回答的问题：

- 整条链路有哪些阶段
- 每个阶段发生在谁的机器上
- 源码、产物、请求、浏览器执行之间是什么关系

当前代码入口：

- `README.md`：整个仓库的总入口，串起 `full-chain/` 与 `scenarios/` 的角色分工
- `full-chain/README.md`：主链路故事入口，概括首屏生成、hydration 与交互更新
- `.github/workflows/ci.yml`：把本地代码、构建、校验和交付串进同一条 CI 链路
- `full-chain/app/page.tsx`：可执行主链路首页入口，适合作为总图落到代码的第一跳

### 第二章：源码层

内容：

- 主项目的关键源码
- `Server Component` 与 `Client Component` 的分工
- `TS/JSX` 描述的是“状态到界面”的规则，而不是页面本身

要回答的问题：

- 前端源码到底在表达什么
- 哪些代码天然属于服务端
- 哪些代码必须交给浏览器执行

当前代码入口：

- `full-chain/app/page.tsx`：把服务端面板、构建面板、客户端面板组合成完整首页
- `full-chain/components/server-time-panel.tsx`：典型 `Server Component`，直接读取服务端数据
- `full-chain/components/client-counter-panel.tsx`：典型 `Client Component`，承载按钮事件与本地状态
- `full-chain/lib/homepage-data.ts`：服务端读取的数据函数，体现“源码描述规则而不是页面本身”
- `scenarios/stage0-rsc-basic/app/page.tsx`：最小化展示服务端组件直接取数
- `scenarios/stage5-csr-basic/components/client-state-panel.tsx`：最小化展示浏览器中的状态更新

### 第三章：开发链路

内容：

- `npm run dev` 下的完整链路
- 修改一个文件后为什么页面会更新
- Next.js 开发态如何重新编译、重新返回资源

要回答的问题：

- 开发服务器启动后做了什么
- 保存文件后变更如何传导到浏览器
- 开发态与生产态的本质区别是什么

当前代码入口：

- `full-chain/package.json`：主项目的 `pnpm dev`、`pnpm build`、`pnpm typecheck` 入口
- `full-chain/tsconfig.json`：开发态与构建态共用的 TypeScript 编译边界
- `full-chain/README.md`：本地安装、启动、观察点说明
- `scenarios/*/package.json`：每个场景都能单独安装与启动，便于分段验证
- `scenarios/*/README.md`：每个独立场景的本地访问入口和观察目标

### 第四章：构建链路

内容：

- `npm run build` 发生了什么
- 页面如何被拆成不同类型产物
- `SSR / SSG / RSC` 在构建阶段如何分化

要回答的问题：

- `TS/JSX` 是如何被编译的
- 为什么同一个页面会拆成多种产物
- 哪些内容会进客户端 bundle，哪些不会

当前代码入口：

- `full-chain/components/server-time-panel.tsx`：说明只在服务端执行的代码边界
- `full-chain/components/client-counter-panel.tsx`：通过 `'use client'` 标出会进入客户端 bundle 的部分
- `full-chain/lib/build-metadata.ts`：把构建与交付语义显式放进页面展示
- `scenarios/stage1-ssg-basic/app/page.tsx`：最小化展示构建期确定内容
- `scenarios/stage2-build-artifacts/app/page.tsx`：直接把 `HTML / CSS / Client JS / RSC Payload / Node SSR Output` 的职责列出来

### 第五章：CI/CD 链路

内容：

- `git push` 之后发生什么
- 一个最小 `GitHub Actions` 工作流
- CI 如何构建并发布产物

要回答的问题：

- 为什么 Git 提交之后不会直接变成线上页面
- CI 在验证和产出什么
- 产物如何交给部署系统

当前代码入口：

- `.github/workflows/ci.yml`：最小 `GitHub Actions` 工作流，覆盖 install、typecheck、build
- `full-chain/package.json`：CI 执行的脚本定义来源
- `scenarios/*/package.json`：矩阵构建时每个独立项目的统一脚本入口
- `README.md`：说明仓库当前按“主链路项目 + 独立场景项目”组织交付

### 第六章：线上分发链路

内容：

- `CDN` 返回什么
- `Node SSR` 服务返回什么
- 首次请求首页时，网络路径如何流动

要回答的问题：

- 浏览器先访问谁
- 哪些资源适合缓存
- 哪些请求必须进入应用服务

当前代码入口：

- `full-chain/lib/build-metadata.ts`：用 `deliveryPath` 把 `GitHub -> CI -> next build -> CDN / Node SSR -> Browser` 明确写进代码
- `full-chain/components/build-info-panel.tsx`：把构建产物和分发语义展示到页面上
- `scenarios/stage1-ssg-basic/app/page.tsx`：对应适合静态缓存、走 CDN 的页面
- `scenarios/stage3-ssr-basic/app/page.tsx`：对应必须进入应用服务、按请求生成的页面
- `scenarios/stage2-build-artifacts/app/page.tsx`：对应静态资源与服务端产物的职责拆分

### 第七章：浏览器加载与 React 接管

内容：

- 浏览器收到 HTML 之后做什么
- 客户端 JS 什么时候下载、执行
- React 什么时候开始 hydration

要回答的问题：

- 为什么首屏可以先显示出来
- 为什么交互要等到 JS 准备好
- RSC 与客户端组件在浏览器里的角色是什么

当前代码入口：

- `full-chain/app/page.tsx`：首屏先由服务端产出结构，再等待客户端部分接管
- `full-chain/components/client-counter-panel.tsx`：hydration 完成后开始响应点击事件
- `scenarios/stage4-hydration-basic/app/page.tsx`：最小化展示“先能看，后能点”的场景入口
- `scenarios/stage4-hydration-basic/components/hydration-ready-panel.tsx`：用 `hydrationReady` 显式表达接管前后状态
- `scenarios/stage0-rsc-basic/app/page.tsx`：帮助区分服务端组件与客户端组件在浏览器中的不同角色

### 第八章：浏览器渲染管线

内容：

- `DOM`
- `CSSOM`
- `Render Tree`
- `Layout`
- `Paint`
- `Composite`

要回答的问题：

- 页面如何从字节变成像素
- React 更新为什么不等于浏览器已经画完
- 为什么有些更新便宜，有些更新昂贵

当前代码入口：

- `full-chain/app/globals.css`：主链路页面的样式、布局、卡片与时间线结构
- `scenarios/stage2-build-artifacts/app/page.tsx`：产物层面解释浏览器接收到的 `HTML`、`CSS` 与脚本职责
- `scenarios/stage5-csr-basic/components/client-state-panel.tsx`：展示 React 状态变化如何继续落回浏览器渲染
- `scenarios/stage4-hydration-basic/components/hydration-ready-panel.tsx`：展示可见状态与可交互状态的分离

### 第九章：一次点击的完整回放

内容：

- 点击按钮后 `setState` 发生什么
- 如有请求，`fetch -> Route Handler -> 响应 -> React 更新`
- 最终浏览器如何重绘局部区域

要回答的问题：

- 一次交互从事件到像素变化的完整链路是什么
- React 内部调度与浏览器渲染如何衔接

当前代码入口：

- `full-chain/components/client-counter-panel.tsx`：同一组件内同时展示本地 `setState` 和 `fetch` 两类更新路径
- `full-chain/app/api/counter/route.ts`：服务端接住请求并返回新的计数快照
- `scenarios/stage5-csr-basic/components/client-state-panel.tsx`：最小化展示纯客户端更新
- `scenarios/stage6-api-roundtrip/components/counter-roundtrip-panel.tsx`：最小化展示 `fetch -> React state` 回写
- `scenarios/stage6-api-roundtrip/app/api/counter/route.ts`：最小化展示 Route Handler 响应

## 7. 图的组织方案

整份文档会包含两类图。

### 7.1 总图

用于建立大局观：

- 全链路总图
- 主动作时序图

默认形式：

- 主图优先使用 `Mermaid`
- 主图强调可读、可维护、可跟随章节持续演进

### 7.2 阶段图

用于拆段理解：

- 源码阶段图
- 开发态阶段图
- 构建阶段图
- CI/CD 阶段图
- 部署分发阶段图
- 浏览器加载阶段图
- React 接管阶段图
- 浏览器渲染阶段图
- 点击更新阶段图

图的目标不是装饰，而是把“谁在做什么、数据往哪走、产物怎么变化”画清楚。

默认形式：

- 能清楚表达主路径时优先使用 `Mermaid`
- 对局部结构、目录层次、产物示意可补充少量 `ASCII`
- 图示格式优先服务“直读理解”，不追求视觉花哨

## 8. 代码组织方案

为了同时满足“主链路完整”和“独立场景可运行”，代码会采用两层组织方式：

### 8.1 主链路代码

一套最小完整项目，贯穿全文，并放在单独目录中。

建议包含：

- `full-chain/`
- `full-chain/app/page.tsx`
- `full-chain/app/api/counter/route.ts`
- `full-chain/components/Counter.tsx`
- `full-chain/components/ServerTime.tsx`
- `full-chain/lib/data.ts`
- `full-chain/package.json`
- `full-chain/README.md`

说明：

- `full-chain/` 是整套主线代码唯一入口
- 它只负责承载“首次打开首页 -> 首屏生成 -> hydration -> 点击更新”这条完整故事
- 不在这个目录里混放用于单点解释的实验性场景
- 它强调“链路完整性”，不是“概念拆分”
- 它使用 `pnpm` 管理依赖
- 它通过本地 `Route Handler + mock 数据` 完成主链路闭环

### 8.2 独立场景代码

每章再给一个最小独立片段，直接服务于该章解释。

要求：

- 代码是真实的 `Next.js App Router + TypeScript`
- 不是伪代码
- 尽量最短，但能完整表达该场景

目录建议：

- `scenarios/stage0-rsc-basic/`
- `scenarios/stage1-ssg-basic/`
- `scenarios/stage2-build-artifacts/`
- `scenarios/stage3-ssr-basic/`
- `scenarios/stage4-hydration-basic/`
- `scenarios/stage5-csr-basic/`
- `scenarios/stage6-api-roundtrip/`

每个场景目录内部尽量自带：

- `app/`
- `components/`
- `lib/`
- `package.json`
- `README.md`

每个场景目录的职责必须单一，例如：

- `stage0-rsc-basic/` 只解释服务端组件取数与不进客户端 bundle
- `stage1-ssg-basic/` 只解释构建时生成
- `stage2-build-artifacts/` 只解释源码如何拆成多种产物
- `stage3-ssr-basic/` 只解释请求时生成
- `stage4-hydration-basic/` 只解释先能看、后能点
- `stage5-csr-basic/` 只解释浏览器内状态更新
- `stage6-api-roundtrip/` 只解释浏览器与 Route Handler 的请求往返

每个场景目录的运行策略默认是：

- 单独安装依赖
- 单独启动
- 单独验证
- 单独阅读 `README.md`

这样设计的目的，是让场景可以在没有主项目上下文的情况下被独立理解。

### 8.3 共享代码边界

为了保证高内聚，默认策略是“能不共享就不共享”。

只允许抽取这类真正公共、且不会削弱场景独立性的内容：

- 与业务语义无关的通用样式
- 极稳定的演示工具函数
- 文档生成所需的辅助脚本

不建议共享这类内容：

- 带具体场景语义的数据函数
- 某个场景专属的组件
- 为了省几行代码而抽出来的薄封装

判断标准很简单：

- 如果把一个文件拿走，场景是否仍然容易被单独理解
- 如果共享一个模块，会不会让读者来回跳目录
- 如果修改一个场景，是否会波及别的场景

若答案分别是“否、会、会”，就不应该共享。

### 8.4 推荐目录蓝图

文档落地时，建议整体采用如下目录蓝图：

```text
frontend/
  nextjs-full-chain-plan.md
  full-chain/
    app/
    components/
    lib/
    public/
    README.md
    package.json
    tsconfig.json
  scenarios/
    stage0-rsc-basic/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage1-ssg-basic/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage2-build-artifacts/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage3-ssr-basic/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage4-hydration-basic/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage5-csr-basic/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
    stage6-api-roundtrip/
      app/
      components/
      lib/
      README.md
      package.json
      tsconfig.json
```

这个目录蓝图表达的是：

- `full-chain/` 负责讲“完整故事”
- `scenarios/` 负责讲“单点机制”
- 目录就是边界，边界就是职责
- 高内聚优先于去重
- 每个目录都是一个可独立安装与运行的 `Next.js` 单元
- 每个目录都附带最小运行说明

### 8.5 命名规范落地

为了让目录隔离和高内聚真正生效，命名需要跟结构一起约束。

#### 目录命名

目录名应体现“场景职责”而不是“随手分类”：

- 推荐：`full-chain/`
- 推荐：`scenarios/stage0-rsc-basic/`
- 推荐：`scenarios/stage4-hydration-basic/`
- 推荐：`scenarios/browser-paint-cost/`
- 不推荐：`demo/`
- 不推荐：`case1/`
- 不推荐：`misc/`

规则：

- 目录名优先表达场景意图
- 使用小写字母与连字符
- 避免数字序号承担语义
- 不用 `temp`、`test`、`misc` 这类模糊命名充当正式结构

#### 文件命名

文件名应体现“承载内容”而不是“文件类型”：

- 推荐：`server-time-card.tsx`
- 推荐：`build-metadata.ts`
- 推荐：`counter-route.ts`
- 不推荐：`card.tsx`
- 不推荐：`utils.ts`
- 不推荐：`index2.ts`

规则：

- 组件文件名优先体现 UI/职责
- 工具文件名优先体现能力/数据来源
- 文件名与导出主体尽量一一对应
- 除框架约定文件外，不依赖 `index.ts` 隐藏语义
- `README.md` 作为场景入口说明文件，命名统一不变化

#### 变量命名

变量名应体现“业务含义 + 生命周期位置”：

- 推荐：`serverRenderedAt`
- 推荐：`staticArticleList`
- 推荐：`clientClickCount`
- 推荐：`hydrationReady`
- 不推荐：`data`
- 不推荐：`list`
- 不推荐：`value`

规则：

- 能体现来源时就体现来源
- 能体现阶段时就体现阶段
- 避免用过度泛化的容器词

#### 函数命名

函数名应体现“动作 + 作用对象”：

- 推荐：`loadServerClock()`
- 推荐：`fetchCounterSnapshot()`
- 推荐：`createBuildMetadata()`
- 推荐：`incrementClientCount()`
- 不推荐：`handleData()`
- 不推荐：`process()`
- 不推荐：`run()`

规则：

- 优先用动词开头
- 动作必须能映射到链路行为
- 避免 `handle`、`do`、`run` 这种空泛动词

#### 组件命名

组件名应体现“界面职责”：

- 推荐：`ServerTimePanel`
- 推荐：`ClientCounterButton`
- 推荐：`BuildInfoSection`
- 不推荐：`Panel`
- 不推荐：`Box`
- 不推荐：`Widget`

规则：

- 组件名使用 `PascalCase`
- 名称尽量体现渲染意图或数据角色
- 避免抽象到只剩视觉容器概念

#### 路由与接口命名

路由名应体现“资源或行为语义”：

- 推荐：`/api/counter`
- 推荐：`/ssr-time`
- 推荐：`/static-article`
- 不推荐：`/api/data`
- 不推荐：`/page1`
- 不推荐：`/demo`

规则：

- URL 应体现资源或场景含义
- 避免把演示性质写进正式路径
- 路由命名与文档章节、目录名称尽量保持一致

#### 命名与高内聚的关系

语义化命名不是单独的美学要求，而是高内聚设计的一部分。

好的命名会直接降低这些成本：

- 在目录间跳转时的理解成本
- 在主链路与独立场景之间切换时的上下文成本
- 在图、代码、文档三者之间建立映射的成本

因此后续所有示例代码都遵循这条约束：

- 名字优先服务“理解链路”
- 名字优先服务“定位职责”
- 名字优先服务“独立阅读”

## 9. 交付形式

最终交付物将包括：

- 一份完整主文档
- 一套放在 `full-chain/` 中的主链路最小可执行代码
- 一组放在 `scenarios/` 中的独立场景最小可执行代码
- 总图与阶段图
- 每个项目的 `pnpm` 依赖定义
- 每个场景目录中的最小 `README.md`

主文档中的每个章节都遵循统一结构：

1. 阶段图
2. 可执行代码
3. 少量必要解释
4. 回到主链路中的位置

独立场景目录中的 `README.md` 统一建议包含：

1. 这个场景讲什么
2. 如何安装依赖与启动
3. 打开哪个路由观察结果
4. 这个场景在全链路中的位置

## 10. 写作原则

为了保证内容既能理解本质，又能落到工程真实世界，写作会遵循这些原则：

- 先讲完整链路，再拆局部
- 每一章只解决一个核心因果
- 术语必须绑定到代码、请求或产物
- 所有示例尽量可运行
- 不把文档写成 API 手册
- 不把概念讲成空话

## 11. 下一步执行计划

接下来正式写正文时，建议按以下顺序推进：

1. 先写总图和主链路时序图
2. 给出主项目完整代码骨架
3. 从“首次打开首页”开始走一遍完整链路
4. 再分章节拆解 `RSC / SSR / SSG / CSR`
5. 补齐 `CI/CD -> build -> CDN/SSR -> 浏览器`
6. 最后补“点击按钮后到底发生了什么”

## 12. 当前结论

这份方案已经足够支撑正式写作。

后续正文将围绕一句核心判断展开：

`前端源码的本质，是用代码描述状态、结构和交互规则；线上系统的本质，是把这些规则经过构建、传输、执行和渲染，最终变成用户屏幕上的可交互像素。`
