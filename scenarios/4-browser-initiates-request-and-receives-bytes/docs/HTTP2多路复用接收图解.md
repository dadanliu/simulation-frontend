# HTTP/2 多路复用：客户端如何接收

---

## 一、先理解问题所在：HTTP/1.1 的队头阻塞

HTTP/1.1 里，一条连接同一时刻只能有一个请求/响应在传输：

```
连接 1 的字节流（时间从左到右）：

[HTML 响应的字节...............][CSS 响应的字节.....][JS 响应字节...]
▲                               ▲                   ▲
发完 HTML 才能发 CSS             发完 CSS才能发 JS

问题：HTML 很大时，CSS 和 JS 就一直在等
     这叫"队头阻塞"（Head-of-line blocking）
```

---

## 二、HTTP/2 的解法：帧（Frame）+ 流（Stream）

HTTP/2 把每个请求/响应切成很小的**帧（Frame）**，
每帧带一个 **Stream ID**，
多个 Stream 的帧可以**交错**在同一条 TCP 连接里传输。

```
HTTP/2 连接里的字节流（同一条 TCP）：

时间轴 ──────────────────────────────────────────────────────►

[HTML帧 s1][CSS帧 s3][JS帧 s5][HTML帧 s1][CSS帧 s3][JS帧 s5]...
     ↑           ↑         ↑
  Stream 1   Stream 3  Stream 5
  GET /      GET /css  GET /js

三个请求的响应帧交错发送，互不等待
```

---

## 三、帧的结构

每个 HTTP/2 帧是这样的（最小 9 字节头）：

```
┌─────────────────────────────────────────────────────────────┐
│  Length (3 bytes)   │  Type (1 byte)  │  Flags (1 byte)     │
│  帧正文有多少字节    │  帧类型          │  标志位（END_STREAM）│
├─────────────────────────────────────────────────────────────┤
│  Stream Identifier (4 bytes)                                │
│  这帧属于哪个请求/响应（Stream ID）                          │
├─────────────────────────────────────────────────────────────┤
│  Frame Payload（Length 字节）                               │
│  帧的实际内容（请求头 / 响应头 / 数据）                       │
└─────────────────────────────────────────────────────────────┘

帧类型（Type）常见值：
  0x0  DATA       → 正文数据
  0x1  HEADERS    → 请求头 / 响应头
  0x4  SETTINGS   → 连接参数协商
  0x8  WINDOW_UPDATE → 流量控制
  0x9  CONTINUATION → 头部续帧

END_STREAM flag：
  这一帧是这个 Stream 最后一帧，
  接收方看到它就知道这个请求/响应结束了
  （替代 HTTP/1.1 里的 Content-Length 或 0\r\n\r\n）
```

---

## 四、完整收发过程图解

### 场景：浏览器同时请求 HTML + CSS + JS

```
浏览器                                        服务器
──────                                        ──────

① 发出三个请求（三个 HEADERS 帧）

  [HEADERS stream=1]  GET /          ──────►
  [HEADERS stream=3]  GET /css/...   ──────►
  [HEADERS stream=5]  GET /js/...    ──────►

  注意：三帧几乎同时发出，共用一条 TCP 连接
        stream ID 是奇数（客户端发起的流）


② 服务器开始处理，交错返回（DATA 帧）

                                     ◄──────  [HEADERS stream=1] 200 OK
                                     ◄──────  [DATA    stream=1] HTML chunk 1
                                     ◄──────  [HEADERS stream=3] 200 OK
                                     ◄──────  [DATA    stream=1] HTML chunk 2
                                     ◄──────  [DATA    stream=3] CSS chunk 1
                                     ◄──────  [HEADERS stream=5] 200 OK
                                     ◄──────  [DATA    stream=1] HTML chunk 3 END
                                     ◄──────  [DATA    stream=5] JS  chunk 1
                                     ◄──────  [DATA    stream=3] CSS chunk 2 END
                                     ◄──────  [DATA    stream=5] JS  chunk 2 END

  注意：DATA 帧交错穿插，不是一个请求发完再发另一个


③ 浏览器接收：按 Stream ID 重组

  一条 TCP 字节流：
  [HEADERS s1][DATA s1 c1][HEADERS s3][DATA s1 c2][DATA s3 c1]...
        │           │            │          │           │
        ▼           ▼            ▼          ▼           ▼

  stream 1 缓冲区:  [HEADERS] + [DATA c1] + [DATA c2] + [DATA c3 END]
                     ↓ 重组完毕
                     HTTP 响应：200 OK + HTML 全文

  stream 3 缓冲区:  [HEADERS] + [DATA c1] + [DATA c2 END]
                     ↓ 重组完毕
                     HTTP 响应：200 OK + CSS 全文

  stream 5 缓冲区:  [HEADERS] + [DATA c1] + [DATA c2 END]
                     ↓ 重组完毕
                     HTTP 响应：200 OK + JS 全文
```

---

## 五、浏览器内部如何管理多个 Stream

```
浏览器收到的字节流（一条 TCP socket 上）：

raw bytes ──► TCP 收包 ──► TLS 解密 ──► HTTP/2 帧解析器
                                                │
                                                │  读帧头 9 bytes
                                                │  拿到 StreamID、Type、Length
                                                │
                                    ┌───────────┴────────────┐
                                    ▼                        ▼
                           Stream ID = 1             Stream ID = 3
                           ┌──────────────┐          ┌──────────────┐
                           │ headers: 200 │          │ headers: 200 │
                           │ body chunk1  │          │ body chunk1  │
                           │ body chunk2  │          │ body chunk2  │
                           │ END_STREAM ✅ │          │ END_STREAM ✅ │
                           └──────────────┘          └──────────────┘
                                    │                        │
                                    ▼                        ▼
                              回调 HTML 请求            回调 CSS 请求
                              的 Promise/resolve        的 Promise/resolve
```

**关键**：这一切都发生在**一条 TCP 连接**的同一个 socket 的 `.on('data')` 回调里。

浏览器的 HTTP/2 实现维护一张 `streams: Map<StreamID, Stream>` 表，
每收到一帧就按 StreamID 路由到对应的 Stream 缓冲区，
收到 `END_STREAM` 就认为这个请求/响应完成。

---

## 六、和 HTTP/1.1 的接收方式对比

```
HTTP/1.1 接收（场景 4 的方式）：

  socket.on('data', chunk => {
    chunks.push(chunk)              ← 只有一个缓冲区
  })
  socket.on('end', () => {
    const full = Buffer.concat(chunks)
    // 现在 full 就是完整的一个响应
    parseHttpResponse(full)
  })

  ┌────────────────────────────────────────────────────────┐
  │  一个 socket → 一个请求的响应                          │
  │  串行，简单                                            │
  └────────────────────────────────────────────────────────┘


HTTP/2 接收（真实浏览器内部）：

  socket.on('data', chunk => {
    frameParser.feed(chunk)         ← 送给帧解析器
  })

  frameParser.on('frame', frame => {
    const stream = streams.get(frame.streamId)  ← 按 ID 路由
    if (frame.type === HEADERS) {
      stream.headers = parseHPACK(frame.payload) ← 解压缩头部
    }
    if (frame.type === DATA) {
      stream.body.push(frame.payload)
      if (frame.flags & END_STREAM) {
        stream.resolve()            ← 这个请求完成了
      }
    }
  })

  ┌────────────────────────────────────────────────────────┐
  │  一个 socket → N 个 Stream → N 个请求的响应            │
  │  并发，但管理复杂得多                                  │
  └────────────────────────────────────────────────────────┘
```

---

## 七、HPACK：HTTP/2 的头部压缩

HTTP/1.1 的头部是明文字符串，每次都全量发：

```
请求 1：Host: example.com\r\nAccept: text/html\r\n...   （100+ bytes）
请求 2：Host: example.com\r\nAccept: text/html\r\n...   （重复！）
请求 3：Host: example.com\r\nAccept: text/html\r\n...   （还是重复！）
```

HTTP/2 用 HPACK 压缩头部：

```
浏览器和服务器各维护一张"头部表"（动态表）：

index  name              value
─────────────────────────────────────────
  1    :method           GET
  2    :path             /
  3    :scheme           https
  62   host              example.com    ← 第一次请求后加入动态表
  63   accept            text/html      ← 同上

请求 1：发完整头部，同时更新两端的动态表
请求 2：只发 "index=62, index=63"（2 字节！）
        对方查表还原出完整头部

头部从 100+ bytes → 2 bytes
```

---

## 八、HTTP/3（QUIC）：彻底解决队头阻塞

HTTP/2 解决了应用层的队头阻塞，
但 TCP 本身还是有队头阻塞：

```
HTTP/2 over TCP 的问题：

  TCP 层：如果某个包丢了，后面的包即使到了也要等这个包重传
          ↓
  所有 Stream 都被这一个丢包卡住了
  （Stream 级别的并发，被 TCP 级别的串行抹杀了）

HTTP/3 over QUIC 的解法：

  QUIC 是 UDP 之上的协议
  每个 Stream 是真正独立的
  Stream 1 的包丢了，不影响 Stream 3 和 Stream 5
  ↓
  真正的多路复用，无队头阻塞
```

---

## 九、一张图总结

```
HTTP/1.1                HTTP/2                  HTTP/3
─────────────────────────────────────────────────────────────
TCP 连接 1              TCP 连接 1               QUIC 连接 1
  [req1][res1]            stream 1: req1/res1      stream 1: req1/res1
TCP 连接 2                stream 3: req2/res2      stream 3: req2/res2
  [req2][res2]            stream 5: req3/res3      stream 5: req3/res3
TCP 连接 3              （帧交错，同一 TCP）       （独立，无阻塞）
  [req3][res3]

客户端接收：            客户端接收：             客户端接收：
单 buffer              按 StreamID 路由          同 HTTP/2 + 无 TCP 队头阻塞
简单                   到各自 Stream buffer      
                       END_STREAM = 完成信号


场景 4 实现的是 HTTP/1.1 Content-Length 方式，
是理解整个体系的基础：
  帧、StreamID、END_STREAM 都是 HTTP/2 在此基础上的扩展
```
