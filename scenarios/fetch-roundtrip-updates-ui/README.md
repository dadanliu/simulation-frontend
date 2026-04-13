# fetch-roundtrip-updates-ui

这个场景在线性主链中的位置：**Stage 6 请求往返更新节点**。

## 它模拟的真实节点

浏览器发起一次 `fetch`，请求进入 Route Handler，再把响应结果写回 UI。

## 输入

- 用户点击
- 浏览器 fetch 请求
- 服务端 Route Handler 逻辑

## 输出

- JSON 响应
- 更新后的 React 状态
- 更新后的页面结果

## 观察点

- 点击后能看到服务端处理时间和返回值变化。
- 这说明这次更新不是纯本地状态，而是走了浏览器到服务端的往返链。
