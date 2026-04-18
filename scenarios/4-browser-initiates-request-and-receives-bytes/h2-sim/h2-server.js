// 模拟 HTTP/2 服务器：多路复用帧交错发送
//
// 核心行为：
//   1. 收到多个 HEADERS 帧（每个对应一个 Stream 的请求）
//   2. 把每个文件切成若干 DATA 帧（每帧 CHUNK_SIZE 字节）
//   3. 用轮询（round-robin）交错发出各 Stream 的帧
//      → stream1-chunk1, stream3-chunk1, stream5-chunk1,
//        stream1-chunk2, stream3-chunk2, ...
//   4. 每个 Stream 的最后一帧带 END_STREAM 标志
//
// 运行：node h2-sim/h2-server.js [port]

const net = require('net');
const fs = require('fs');
const path = require('path');
const { FRAME_TYPES, FLAGS, encodeFrame, decodeFrames, typeLabel, isEndStream } = require('./h2-frame');

const PORT = Number(process.argv[2] || 4401);
const DIST_DIR = path.resolve(__dirname, '../demo-dist');

// 每个 DATA 帧的最大 payload 字节数（故意调小，让帧数多一些，交错更明显）
const CHUNK_SIZE = 120;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.svg':  'image/svg+xml',
};

// ── 工具 ──────────────────────────────────────────────────────

function resolveFile(urlPath) {
  const filePath = urlPath === '/' ? '/index.html' : urlPath;
  const abs = path.resolve(DIST_DIR, `.${filePath}`);
  if (!abs.startsWith(DIST_DIR)) return null;
  return fs.existsSync(abs) ? abs : null;
}

function log(msg) { console.log(msg); }
function dim(msg) { console.log(`  \x1b[2m${msg}\x1b[0m`); }
function bold(msg) { console.log(`\x1b[1m${msg}\x1b[0m`); }
function green(msg) { console.log(`  \x1b[32m${msg}\x1b[0m`); }

// ── 主逻辑 ────────────────────────────────────────────────────

const server = net.createServer((socket) => {
  bold('\n[连接建立] 开始接收请求帧...\n');

  let recvBuf = Buffer.alloc(0);

  // streams: Map<streamId, { path, filePath }>
  const streams = new Map();

  // 等待一小段时间收集所有 HEADERS 帧，再开始发响应
  // （真实 HTTP/2 服务器是收一个立刻处理一个，这里为了演示效果稍作延迟）
  let sendTimer = null;

  function scheduleRespond() {
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => respondAll(socket, streams), 50);
  }

  socket.on('data', (chunk) => {
    recvBuf = Buffer.concat([recvBuf, chunk]);

    const { frames, remaining } = decodeFrames(recvBuf);
    recvBuf = remaining;

    for (const frame of frames) {
      if (frame.type === FRAME_TYPES.HEADERS) {
        const req = JSON.parse(frame.payload.toString('utf-8'));
        const filePath = resolveFile(req.path);

        log(`  ► 收到 HEADERS 帧  stream=${frame.streamId}  ${req.method} ${req.path}`);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // BP-B  SERVER：解析出一个请求，登记 Stream
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 此时看：
        //   req             → { method, path }，客户端发来的请求内容
        //   frame.streamId  → 这条请求对应的 Stream ID（奇数：1/3/5）
        //   filePath        → 服务器找到的本地文件路径（null = 404）
        //   streams.size    → 已收到几个请求（3 个全到后触发 respondAll）
        // 三次 BP-B 之后，streams.size === 3，scheduleRespond 触发
        debugger; // eslint-disable-line no-debugger  BP-B
        streams.set(frame.streamId, { path: req.path, filePath });
        scheduleRespond();
      }
    }
  });

  socket.on('error', (e) => console.error('[socket error]', e.message));
});

// 收集完所有请求后，交错发送所有响应帧
function respondAll(socket, streams) {
  log('\n──────────────────────────────────────────────────────────────');
  bold('  收到全部请求，开始交错发送响应帧（round-robin）');
  log('──────────────────────────────────────────────────────────────');

  // 为每个 Stream 准备好所有帧（先全部生成，再统一交错）
  const streamQueues = []; // [ { streamId, frames: Buffer[] } ]

  for (const [streamId, { path: reqPath, filePath }] of streams) {
    const frames = [];

    // HEADERS 帧：响应状态行 + 头部（JSON 代替真实 HPACK）
    if (!filePath) {
      const headers = JSON.stringify({ status: 404, 'content-type': 'text/plain' });
      frames.push(encodeFrame(FRAME_TYPES.HEADERS, 0, streamId, headers));
      // 404 正文
      const body = Buffer.from(`Not found: ${reqPath}`);
      frames.push(encodeFrame(FRAME_TYPES.DATA, FLAGS.END_STREAM, streamId, body));
    } else {
      const body = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const headers = JSON.stringify({
        status: 200,
        'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
        'content-length': body.length,
      });
      frames.push(encodeFrame(FRAME_TYPES.HEADERS, 0, streamId, headers));

      // 把文件切成多个 DATA 帧
      for (let offset = 0; offset < body.length; offset += CHUNK_SIZE) {
        const chunk = body.slice(offset, offset + CHUNK_SIZE);
        const isLast = offset + CHUNK_SIZE >= body.length;
        // 最后一帧加 END_STREAM 标志
        frames.push(encodeFrame(
          FRAME_TYPES.DATA,
          isLast ? FLAGS.END_STREAM : 0,
          streamId,
          chunk,
        ));
      }
    }

    streamQueues.push({ streamId, frames, path: reqPath });
  }

  // Round-robin 交错发帧
  let frameCount = 0;
  let hasMore = true;
  let roundIndex = 0;

  while (hasMore) {
    hasMore = false;
    for (const q of streamQueues) {
      if (q.frames.length === 0) continue;
      hasMore = true;

      const frameBuf = q.frames.shift();
      // 解析回来只是为了打印日志
      const type = frameBuf.readUInt8(3);
      const flags = frameBuf.readUInt8(4);
      const streamId = frameBuf.readUInt32BE(5) & 0x7fffffff;
      const payloadLen = frameBuf.readUIntBE(0, 3);
      const endStream = (flags & FLAGS.END_STREAM) !== 0;

      frameCount++;
      const label = endStream ? ' \x1b[32mEND_STREAM\x1b[0m' : '';
      log(`  ◄ 发帧 #${String(frameCount).padStart(2)} [${typeLabel(type).padEnd(7)}] stream=${streamId}  payload=${payloadLen}B${label}`);

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BP-C  SERVER → CLIENT：round-robin 取出一帧，即将写入 TCP
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 此时看：
      //   streamId         → 这帧属于哪个 Stream（每轮在 1→3→5 之间切换）
      //   type             → 0=DATA  1=HEADERS
      //   payloadLen       → 本帧 payload 字节数
      //   endStream        → true = 这个 Stream 的最后一帧
      //   frameCount       → 全局第几帧（观察交错节奏）
      //   q.frames.length  → 该 Stream 还剩几帧（逐渐减少到 0）
      //   streamQueues     → 展开，看 3 个 Stream 各自的队列剩余量
      // 和 BP-D 对应：BP-C 发出 → 网络传输 → BP-D 收到，streamId 一致
      debugger; // eslint-disable-line no-debugger  BP-C

      // SPLIT_SEND=1 时把每帧拆成两半异步发，模拟 TCP 分片，让客户端 recvBuf 重组可见
      if (process.env.SPLIT_SEND === '1') {
        const half = Math.ceil(frameBuf.length / 2);
        socket.write(frameBuf.slice(0, half));
        // setImmediate 让两次 write 落在不同的事件循环 tick，强制成两个独立 TCP segment
        setImmediate(() => socket.write(frameBuf.slice(half)));
      } else {
        socket.write(frameBuf);
      }
    }
    roundIndex++;
  }

  log(`\n  共发出 ${frameCount} 帧，涵盖 ${streamQueues.length} 个 Stream`);
  log('──────────────────────────────────────────────────────────────\n');
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  h2-server（HTTP/2 多路复用模拟）                    │');
  console.log(`│  监听: http://127.0.0.1:${PORT}                        │`);
  console.log(`│  帧大小: ${CHUNK_SIZE} bytes/DATA帧                         │`);
  console.log('│                                                      │');
  console.log('│  收到所有 HEADERS 帧后，用 round-robin 交错发 DATA 帧 │');
  console.log('│  让你直接看到多个 Stream 的帧如何交织在一条连接里    │');
  console.log('└──────────────────────────────────────────────────────┘');
});
