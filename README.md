# Next.js 线性全链路示例代码

这个仓库按一条真实发生的前端链路组织：

`源码 -> 构建 -> 产物 -> 交付 -> 浏览器解析 -> 首屏渲染 -> hydration -> 用户交互 -> 状态更新 -> 屏幕变化`

## 仓库结构

- `plan.md`
  - 严格时间线文档，只讲先后顺序。
- `nextjs-full-chain-plan.md`
  - 总设计文档，说明为什么从术语视角切到线性链路视角。
- `full-chain/`
  - 单页主项目。用同一个页面把整条主链从源码一直串到交互更新。
- `scenarios/`
  - 单点场景。每个目录都对应链路上的一个真实节点。

- `scenario-map.md`
  - 全链路场景地图，明确“每一个 -> 都应该对应一个场景”。
- `scenarios/README.md`
  - 说明 scenarios 的目标不是几个 demo，而是逐步补齐整条箭头链。

## 当前场景目录

注意：下面这些只是第一批关键节点，**还不是完整的“每个 -> 一个场景”**。


- `scenarios/browser-receives-server-component-result/`
- `scenarios/build-emits-static-html/`
- `scenarios/build-emits-runtime-artifacts/`
- `scenarios/request-generates-html-on-server/`
- `scenarios/hydration-enables-interaction/`
- `scenarios/client-state-drives-ui-update/`
- `scenarios/fetch-roundtrip-updates-ui/`

## 运行方式

每个目录都独立安装依赖并启动：

```bash
cd full-chain
pnpm install
pnpm dev
```

独立场景同理。

## 阅读顺序建议

1. 先看 `plan.md`
2. 再看 `nextjs-full-chain-plan.md`
3. 跑 `full-chain/` 看完整单页主链
4. 再进入 `scenarios/` 拆开看节点
