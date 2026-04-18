# curl-test.sh 场景图解

`curl-test.sh` 按顺序跑了 5 个验证，分属两大场景：

```
步骤 1~3  →  Origin / Nginx 场景（直接打 :5313）
步骤 4~5  →  CDN 场景（打 :5314，CDN 按需回源到 :5313）
```

---

## 步骤 1：Origin 首页响应头

**验证目标**：源站对 HTML 的缓存策略是否正确

```
curl -i http://127.0.0.1:5313/
```

```
浏览器 / curl
    │
    │  GET /
    ▼
origin-nginx-server :5313
    │
    │  读 demo-dist/index.html
    │  生成 ETag = "mtimeHex-sizeHex"
    │
    ▼
HTTP/1.1 200 OK
Cache-Control: no-cache          ← HTML 不强缓存，每次都要来验证
ETag: "19d7ccf5200-286"          ← 文件指纹，后面步骤 2 会用到
Last-Modified: ...               ← 文件修改时间，步骤 2 也会用到
X-Delivery-Mode: origin-nginx-simulation
```

**为什么 HTML 是 `no-cache` 而不是 `max-age=N`？**

```
HTML 是整个应用的入口文件，
它里面引用的 JS/CSS 文件名带 hash（app.84d7a5c1.css）。
一旦重新构建，hash 变了，HTML 必须立刻更新，
否则浏览器会用旧 HTML 去加载新的 hash 文件 → 404。

所以：
  HTML → no-cache（每次都问一下，但可能 304 不传内容）
  JS/CSS with hash → max-age=31536000, immutable（内容不变，永久缓存）
```

---

## 步骤 2：Origin 304 条件请求

**验证目标**：浏览器已有缓存时，是否能收到 304（省掉传文件）

```
# 先拿到 ETag 和 Last-Modified
ETAG=$(curl -sI http://127.0.0.1:5313/ | grep -i etag)
LAST_MODIFIED=$(curl -sI http://127.0.0.1:5313/ | grep -i last-modified)

# 再带着这两个头去请求
curl -i http://127.0.0.1:5313/
  -H "If-None-Match: <ETAG>"
  -H "If-Modified-Since: <LAST_MODIFIED>"
```

```
浏览器 / curl（本地已缓存 index.html，带着上次收到的 ETag）
    │
    │  GET /
    │  If-None-Match: "19d7ccf5200-286"
    │  If-Modified-Since: Sat, 11 Apr 2026 13:50:54 GMT
    ▼
origin-nginx-server :5313
    │
    │  读文件，重新算 ETag
    │
    │  ETag 相同？ ──→ 是
    │                   │
    ▼                   ▼
（文件变了）         HTTP/1.1 304 Not Modified
200 + 新内容         响应体为空（不传文件，节省带宽）
                     ETag / Cache-Control 等头照常返回


            ┌─────────────────────────────┐
            │   304 的实际意义             │
            │                             │
            │  服务器说：                  │
            │  "你手里那份还是最新的，      │
            │   直接用本地缓存就好"         │
            │                             │
            │  浏览器于是：                │
            │  · 0 字节下载               │
            │  · 用本地缓存渲染页面         │
            └─────────────────────────────┘
```

---

## 步骤 3：Origin /api 反向代理 + 轮询负载均衡

**验证目标**：连续 3 次请求 `/api/whoami`，`instance` 字段在 a/b 之间切换

```
curl http://127.0.0.1:5313/api/whoami   # 第 1 次
curl http://127.0.0.1:5313/api/whoami   # 第 2 次
curl http://127.0.0.1:5313/api/whoami   # 第 3 次
```

```
        第 1 次          第 2 次          第 3 次
curl       │           curl  │          curl  │
           │                 │                │
           ▼                 ▼                ▼
    origin :5313      origin :5313     origin :5313
           │                 │                │
    rrIndex=0          rrIndex=1        rrIndex=2
    0 % 2 = 0          1 % 2 = 1        2 % 2 = 0
           │                 │                │
           ▼                 ▼                ▼
      app-a :5311      app-b :5312      app-a :5311

响应：                响应：               响应：
{ "instance": "a" }  { "instance": "b" }  { "instance": "a" }
  X-Upstream-Instance: a   b                        a
```

**透传的头部**：

```
origin 会把上游信息透传给调用方，方便排查流量走向：

X-Upstream-Instance: a        ← 这次打到了哪台实例
X-Upstream-Port: 5311         ← 对应的端口
X-Upstream-Region: ap-northeast-1
```

---

## 步骤 4：CDN 同区域 MISS → HIT

**验证目标**：同一 region 下请求同一资源两次，第一次 MISS，第二次 HIT

```
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-northeast-1'
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-northeast-1'
```

```
┌─────────────────────────────────────────────────────────────────┐
│                         第 1 次请求                              │
└─────────────────────────────────────────────────────────────────┘

curl
  │  GET /js/app.12ab34cd.js?region=ap-northeast-1
  ▼
cdn-edge-server :5314
  │
  │  region = "ap-northeast-1"（从 query 取）
  │  key = "ap-northeast-1:GET:/js/app.12ab34cd.js"
  │
  │  edgeCaches.get(key)  →  undefined（没有缓存）
  │
  │  ── 回源 ──────────────────────────────────────────────────
  │  GET /js/app.12ab34cd.js
  ▼
origin-nginx-server :5313
  │  返回 200 + 文件内容
  │  Cache-Control: public, max-age=31536000, immutable
  ▼
cdn-edge-server :5314
  │
  │  edgeCaches.set(key, { body, cachedAt: now, ... })  ← 写入缓存
  │
  ▼  返回给 curl
X-Cache: MISS
Age: 0
X-Region: ap-northeast-1


┌─────────────────────────────────────────────────────────────────┐
│                         第 2 次请求                              │
└─────────────────────────────────────────────────────────────────┘

curl
  │  GET /js/app.12ab34cd.js?region=ap-northeast-1
  ▼
cdn-edge-server :5314
  │
  │  key = "ap-northeast-1:GET:/js/app.12ab34cd.js"（同上）
  │
  │  edgeCaches.get(key)  →  { body, cachedAt: T1 }  ← 命中！
  │
  │  ageSeconds = floor((now - T1) / 1000)
  │
  ▼  直接返回缓存，不回源
X-Cache: HIT          ← 命中
Age: 3                ← 已在边缘存了 3 秒
X-Region: ap-northeast-1
```

---

## 步骤 5：CDN 不同区域独立缓存

**验证目标**：换一个 region，缓存与步骤 4 的东京缓存互不干扰，再次 MISS

```
curl -i 'http://127.0.0.1:5314/js/app.12ab34cd.js?region=ap-southeast-1'
```

```
cdn-edge-server 内部的 edgeCaches（执行到步骤 5 时的状态）：

┌──────────────────────────────────────────────────────────────────┐
│  edgeCaches（内存 Map）                                          │
│                                                                  │
│  "ap-northeast-1:GET:/js/app.12ab34cd.js"  →  { ... }  ← 步骤4写的 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘


步骤 5 的 key = "ap-southeast-1:GET:/js/app.12ab34cd.js"
                 ^^^^^^^^^^^^^^
                 换了 region，key 不同！

edgeCaches.get("ap-southeast-1:GET:/js/app.12ab34cd.js")  →  undefined

→ 再次回源
→ X-Cache: MISS     ← 虽然东京已经 HIT，新加坡这边是全新的缓存桶


执行完步骤 5 后，edgeCaches 变成：

┌──────────────────────────────────────────────────────────────────┐
│  "ap-northeast-1:GET:/js/app.12ab34cd.js"  →  { ... }           │
│  "ap-southeast-1:GET:/js/app.12ab34cd.js"  →  { ... }  ← 新增   │
└──────────────────────────────────────────────────────────────────┘

两个 region 的缓存完全独立，就像 CloudFront 在东京和新加坡
各有一个 PoP 节点，互不共享缓存内容。
```

---

## 整体执行顺序总览

```
curl-test.sh 执行顺序

步骤 1  ──→  :5313/                     直接打 origin，看 HTML 缓存头
步骤 2  ──→  :5313/ （带条件头）         直接打 origin，验证 304
步骤 3  ──→  :5313/api/whoami × 3       直接打 origin，验证 a/b 轮询
步骤 4  ──→  :5314/js/... × 2           打 CDN，验证同 region MISS→HIT
步骤 5  ──→  :5314/js/...               打 CDN，换 region，验证独立缓存


涉及的服务和链路：

步骤 1~3：
  curl → :5313(origin)
                └──[步骤 3 /api]──→ :5311(app-a) 或 :5312(app-b)

步骤 4~5：
  curl → :5314(cdn) ──[MISS 时]──→ :5313(origin) ──→ 磁盘文件
          └──[HIT 时]──→ 内存缓存（不回源）
```
