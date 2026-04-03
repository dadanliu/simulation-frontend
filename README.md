# Next.js 全链路示例代码

这个目录按 `nextjs-full-chain-plan.md` 与 `plan.md` 落地为两类代码：

- `full-chain/`：完整主链路，覆盖首页首屏、Server Component、Client Component、Route Handler、SSR/SSG/CSR/Hydration 的闭环。
- `scenarios/`：单点机制场景，每个目录都是独立的 Next.js App Router 项目。

## 目录

- `full-chain/`
- `scenarios/stage0-rsc-basic/`
- `scenarios/stage1-ssg-basic/`
- `scenarios/stage2-build-artifacts/`
- `scenarios/stage3-ssr-basic/`
- `scenarios/stage4-hydration-basic/`
- `scenarios/stage5-csr-basic/`
- `scenarios/stage6-api-roundtrip/`

## 运行方式

每个目录都独立安装依赖并启动：

```bash
cd full-chain
pnpm install
pnpm dev
```

独立场景同理，只需要把目录切到对应项目。
