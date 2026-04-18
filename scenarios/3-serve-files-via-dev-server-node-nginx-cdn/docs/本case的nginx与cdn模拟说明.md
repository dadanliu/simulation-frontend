# 本 case 的 nginx 与 CDN 模拟说明

## 模拟目标

这个 case 不追求完整复刻 nginx / CDN，而是只模拟最核心、最容易观察的能力：

- **origin nginx**
  - 静态文件托管
  - HTML / hashed asset 不同缓存策略
  - `ETag` / `Last-Modified`
  - `304 Not Modified`
  - `/api/*` 反向代理
  - 轮询负载均衡到多台 app

- **CDN edge**
  - 按 region 维护独立边缘缓存
  - `X-Cache: MISS / HIT`
  - `Age`
  - 边缘未命中时回源到 origin nginx

---

## 新增服务

### 1. app 实例

- `app-a` -> `127.0.0.1:5311`
- `app-b` -> `127.0.0.1:5312`

作用：模拟 nginx 后面的多台业务机器。

### 2. origin nginx simulation

- 默认端口：`127.0.0.1:5313`

作用：

- 处理静态资源
- 对 `/api/*` 做反向代理
- 在 `5311 / 5312` 之间轮询分流
- 返回：
  - `ETag`
  - `Last-Modified`
  - `Cache-Control`
  - `X-Upstream-Instance`

### 3. cdn edge simulation

- 默认端口：`127.0.0.1:5314`

作用：

- 先按 `x-region` 或 `?region=` 确定边缘节点
- 每个 region 维护自己的缓存
- MISS 时回源到 `5313`
- HIT 时直接返回缓存结果

---

## 运行方法

在目录内分别启动：

```bash
node servers/app-instance-server.js a 5311 ap-northeast-1
node servers/app-instance-server.js b 5312 ap-northeast-1
node servers/origin-nginx-server.js demo-dist 5313 5311,5312
node servers/cdn-edge-server.js 5314 5313
```

---

## 测试方法

### 一键测试

```bash
bash scripts/curl-test.sh
```

### 手动看点

#### 1. 看 origin 的 304

先取头：

```bash
curl -I http://127.0.0.1:5313/
```

再带条件头请求：

```bash
curl -i http://127.0.0.1:5313/ \
  -H 'If-None-Match: <上一步的ETag>' \
  -H 'If-Modified-Since: <上一步的Last-Modified>'
```

预期：返回 `304 Not Modified`

#### 2. 看 nginx 负载均衡

```bash
curl http://127.0.0.1:5313/api/whoami
curl http://127.0.0.1:5313/api/whoami
curl http://127.0.0.1:5313/api/whoami
```

预期：实例在 `a / b` 之间轮换。

#### 3. 看 CDN 同 region MISS -> HIT

```bash
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-northeast-1'
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-northeast-1'
```

预期：

- 第一次 `X-Cache: MISS`
- 第二次 `X-Cache: HIT`

#### 4. 看 CDN 不同 region 独立缓存

```bash
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-southeast-1'
```

预期：新 region 第一次还是 `MISS`。

---

## AWS 怎么测

最简方案：

- 1 台 EC2 跑 origin + cdn + app-a + app-b
- 用公网 IP 或 `nip.io / sslip.io` 临时域名访问

如果要更像真实架构：

- 1 台 EC2 跑 origin nginx
- 2 台 EC2 分别跑 app-a / app-b
- cdn 先继续用本项目里的 Node 模拟器

这样能演示：

- 一个入口域名
- nginx 分流到不同机器
- 浏览器仍只看到一个入口

