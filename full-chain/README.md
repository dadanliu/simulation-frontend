# full-chain

这个项目承载整份文档的主线故事：

`首次打开首页 -> 服务端生成首屏 -> 浏览器接收 HTML/JS/CSS -> React hydration -> 用户点击触发客户端更新或请求 Route Handler`

## 这个项目讲什么

- `Server Component` 在服务端取数并参与首屏生成。
- `Client Component` 在浏览器里管理状态与按钮点击。
- `Route Handler` 提供一个本地闭环接口，模拟浏览器到服务端的往返。
- 页面同时展示 SSR、SSG 语义与 hydration 后的交互状态。

## 如何运行

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 观察点

- 刷新页面后，`serverRenderedAt` 会变化，说明页面按请求重新生成。
- 首屏先可见，随后按钮可以点击，说明 hydration 完成后页面进入可交互状态。
- 点击“只更新客户端状态”只发生浏览器内更新。
- 点击“请求 Route Handler”会触发一次 `fetch -> Route Handler -> React 更新`。

## 在全链路中的位置

它覆盖 `Stage 01` 到 `Stage 03` 以及 `Stage 08` 到 `Stage 12` 的核心主路径。
