# hydration-enables-interaction

这个场景在线性主链中的位置：**Stage 5 hydration 与可交互阶段**。

## 它模拟的真实节点

页面先显示，再由客户端脚本接管并绑定事件。

## 输入

- 首屏 HTML
- 客户端 JS
- React 运行时

## 输出

- hydration 完成后的可交互页面

## 观察点

- `hydrationReady` 从 `false` 变成 `true`。
- 按钮在接管完成后才真正可点。
