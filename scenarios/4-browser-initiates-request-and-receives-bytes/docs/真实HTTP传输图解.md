# 真实 HTTP 传输图解

---

## 一、真实浏览器请求一个页面，完整发生了什么

以访问 `https://example.com/` 为例，从你敲回车到看到页面，完整链路：

```
用户敲回车
    │
    ▼
① DNS 解析
    浏览器查 example.com 对应哪个 IP
    先查本地缓存 → 查 /etc/hosts → 查本地 DNS → 查上游 DNS
    拿到 IP，比如 93.184.216.34
    │
    ▼
② TCP 三次握手
    浏览器:  SYN  ──────────────────────►  服务器
    服务器:  SYN-ACK  ◄──────────────────  服务器
    浏览器:  ACK  ──────────────────────►  服务器
    （连接建立，通常 < 1ms 局域网，几十 ms 跨洲）
    │
    ▼
③ TLS 握手（HTTPS 时）
    浏览器发 ClientHello（支持哪些加密算法）
    服务器发 ServerHello + 证书
    双方交换密钥，协商出会话密钥
    后续所有 HTTP 数据都用这个密钥加密
    （额外 1~2 个 RTT）
    │
    ▼
④ 发送 HTTP 请求字节流
    GET / HTTP/1.1\r\n
    Host: example.com\r\n
    Accept: text/html\r\n
    Accept-Encoding: gzip, br\r\n    ← 告诉服务器"我能解压"
    Connection: keep-alive\r\n       ← 复用连接，不像场景4那样每次 close
    Cookie: session=xxx\r\n
    \r\n
    │
    ▼
⑤ 服务器处理，发送 HTTP 响应字节流
    HTTP/1.1 200 OK\r\n
    Content-Type: text/html\r\n
    Content-Encoding: gzip\r\n       ← 正文已压缩
    Transfer-Encoding: chunked\r\n   ← 增量发，不用提前知道大小
    \r\n
    [chunk 1] [chunk 2] ... [终止 chunk]
    │
    ▼
⑥ 浏览器边收字节边解析
    收到第一个 chunk → 开始解析 HTML
    发现 <link rel="stylesheet"> → 立刻发新请求拿 CSS
    发现 <script src="..."> → 发新请求拿 JS
    HTML 没收完，CSS/JS 请求已经在路上了
    │
    ▼
⑦ 渲染
    HTML 解析完 → DOM 树
    CSS 解析完 → CSSOM 树
    DOM + CSSOM → 布局 → 绘制 → 屏幕
```

---

## 二、场景 4 vs 真实浏览器：差异对照

```
                场景 4（手写最小版）              真实浏览器
────────────────────────────────────────────────────────────────────
协议层          HTTP/1.1 明文                   HTTPS（TLS 加密）
连接            每次请求建新连接（close）         Keep-Alive 复用连接
并发            串行（一个接一个）                并行（同域 6 个连接）
传输方式        Content-Length（一次性）          chunked / H2 流
压缩            无                               gzip / br（响应体缩小 60~80%）
HTTP 版本       HTTP/1.1                         HTTP/2（多路复用）/ HTTP/3（QUIC）
发现子资源      不处理                           边解析边并行请求
────────────────────────────────────────────────────────────────────
```

---

## 三、传输方式：三种"结束信号"

服务器怎么告诉浏览器"正文发完了"？有且只有三种方式：

```
方式 A：Content-Length（场景 4 用的）
─────────────────────────────────────────────────────────────
HTTP/1.1 200 OK\r\n
Content-Length: 646\r\n          ← 先算好总字节数
\r\n
[646 字节正文]                   ← 读满 646 停止

优点：简单，可验证完整性
缺点：必须先知道总大小
      → 要么全读进内存再发（浪费内存）
      → 要么先扫描文件算大小（多一次 I/O）


方式 B：Transfer-Encoding: chunked（流式）
─────────────────────────────────────────────────────────────
HTTP/1.1 200 OK\r\n
Transfer-Encoding: chunked\r\n   ← 不用提前知道大小
\r\n
1a\r\n                           ← chunk 大小（十六进制，1a = 26 字节）
<!doctype html><html lang=       ← 26 字节内容
\r\n
1e\r\n                           ← 下一个 chunk（30 字节）
"zh-CN"><head><meta charset=    
\r\n
... 继续 ...
0\r\n                            ← 终止 chunk：大小为 0
\r\n                             ← 浏览器看到这里才知道结束

适合：
  · 大文件边读边发
  · 服务端渲染边生成 HTML 边发
  · 实时数据流（日志、进度）


方式 C：Connection: close（最简单，但低效）
─────────────────────────────────────────────────────────────
HTTP/1.1 200 OK\r\n
Connection: close\r\n            ← 没有 Content-Length 也没有 chunked
\r\n
[正文，任意字节]

浏览器策略：
  服务器关闭 TCP 连接 = 正文结束

缺点：
  · 每次请求都要重新建连接（TCP 握手 + TLS 握手）
  · 现代浏览器基本不用这种方式
```

---

## 四、HTTP/2 多路复用：真实浏览器最常用的方式

HTTP/1.1 的限制：一条连接同时只能有一个请求在飞行。

```
HTTP/1.1（场景 4 的方式）：

  连接 1: [请求1] ───► [响应1] ──► [请求2] ──► [响应2] ──► [请求3] ...
           （串行，后面的请求要等前面的响应回来才能发）

  为了并发，浏览器对同一域名最多开 6 条并行连接：
  连接 1: [请求1] ──► [响应1]
  连接 2: [请求2] ──► [响应2]
  连接 3: [请求3] ──► [响应3]
  ...（6 条上限）
```

```
HTTP/2（真实浏览器）：

  一条连接上，多个请求/响应同时飞行（多路复用）：

  连接 1 的数据帧序列：
  ──────────────────────────────────────────────────────────
  [req1-frame1][req2-frame1][req3-frame1][res1-frame1][req1-frame2]...
  ──────────────────────────────────────────────────────────
  每个帧有 Stream ID，接收方按 ID 重组
  互不阻塞

  stream 1: GET /index.html  ←→  200 + HTML
  stream 3: GET /app.css     ←→  200 + CSS       同时进行
  stream 5: GET /app.js      ←→  200 + JS
  stream 7: GET /logo.svg    ←→  200 + SVG
```

---

## 五、真实场景：浏览器请求一个前端页面的完整字节序列

以请求 `index.html` 后，触发 CSS、JS、图片请求为例：

```
时间轴 ────────────────────────────────────────────────────────────►

T=0ms   TCP 握手
T=10ms  TLS 握手
T=20ms  发出请求：GET /index.html

T=25ms  开始收到响应（chunked）
         chunk 1 到达：
         <!doctype html><html><head>
           <link rel="stylesheet" href="/css/app.84d7a5c1.css">
                            ↑
                    浏览器发现了 CSS 引用！
                    立刻发出第二个请求：GET /css/app.84d7a5c1.css

T=26ms  chunk 2 到达：
         </head><body>...
           <script src="/js/app.12ab34cd.js">
                            ↑
                    浏览器发现了 JS 引用！
                    立刻发出第三个请求：GET /js/app.12ab34cd.js

T=27ms  chunk 3 到达：HTML 剩余部分
        0\r\n\r\n           ← HTML 完整结束

        此时 CSS / JS 的请求早已在路上，甚至已经有响应回来了

T=30ms  CSS 响应到达，浏览器开始解析 CSSOM
T=32ms  JS 响应到达，浏览器等 CSSOM 完成后执行 JS

T=35ms  首屏渲染
```

```
对比场景 4 的串行方式：

T=0ms   请求 HTML
T=25ms  HTML 收完
T=25ms  请求 CSS（才开始）
T=50ms  CSS 收完
T=50ms  请求 JS（才开始）
T=75ms  JS 收完
T=80ms  首屏渲染       ← 比并行慢 45ms
```

---

## 六、压缩：真实传输中字节数会少很多

```
未压缩：
  index.html  → 646 bytes（场景 4 的实际大小）

真实项目的 HTML：
  未压缩     → 通常 5KB ~ 50KB
  gzip 后   → 缩小 60~80%，比如 50KB → 12KB
  brotli 后 → 缩小更多，比如 50KB → 9KB

服务器发：
  Content-Encoding: gzip
  [gzip 压缩后的二进制字节]

浏览器收到：
  先解压，得到原始 HTML 文本，再解析


为什么场景 4 没做压缩？
  → 为了让字节内容"人类可读"，方便直接在终端里看
  → 压缩后是二进制乱码，看不懂
  → 真实场景里压缩对用户完全透明
```

---

## 七、Keep-Alive vs 场景 4 的 close

```
场景 4（Connection: close）：

  请求 1：TCP 握手 → 发请求 → 收响应 → TCP 挥手
  请求 2：TCP 握手 → 发请求 → 收响应 → TCP 挥手    ← 重新建连接！
  请求 3：TCP 握手 → 发请求 → 收响应 → TCP 挥手
  ...

  每次建连接额外花：1 RTT TCP 握手 + 1~2 RTT TLS 握手
  如果 RTT = 50ms，3 个资源就额外浪费 150~450ms


真实浏览器（Connection: keep-alive）：

  ─── 一条 TCP + TLS 连接 ──────────────────────────────────────►
  请求 1 → 响应 1 → 请求 2 → 响应 2 → 请求 3 → 响应 3 → ...

  建连接只花一次，后续请求共用
```

---

## 八、一张图总结

```
你在场景 4 里手写的              真实浏览器实际做的
────────────────────────────────────────────────────────────────
明文 TCP                         TLS 加密后的 TCP
HTTP/1.1 close                   HTTP/2 + Keep-Alive
Content-Length（一次性）          chunked（流式）+ 压缩
串行请求                         并发请求（多路复用）
手动拼 \r\n 字符串                自动处理编码/压缩/Cookie/重定向
看到每一个字节                    字节对开发者完全透明


场景 4 的价值：
  把 HTTP 最核心的结构（请求行 + 头部 + \r\n\r\n + 正文）裸露出来
  让你理解"字节是怎么流动的"
  真实浏览器把这些都封装好了，你感知不到
```
