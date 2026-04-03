# stage0-rsc-basic

这个场景只讲一件事：`Server Component` 如何直接在服务端取数，并把结果参与首屏输出。

## 如何运行

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 观察点

- 页面里没有客户端交互代码。
- 数据函数直接定义在服务端页面中。
- 这个场景对应全链路里的首屏服务端生成部分。
