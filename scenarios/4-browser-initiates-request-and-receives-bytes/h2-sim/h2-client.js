// 模拟 HTTP/2 客户端：并发请求 + 按 StreamID 分流接收
//
// 核心行为：
//   1. 建立一条 TCP 连接
//   2. 一次性发出 3 个 HEADERS 帧（stream 1 / 3 / 5）——并发请求
//   3. 从同一条连接持续收帧
//   4. 按 StreamID 路由到各自的 buffer（这就是"多路复用"）
//   5. 收到 END_STREAM 时，把该 Stream 的 buffer 整体交付
//
// 打印每一帧的到达，让你直观看到来自不同 Stream 的帧交错出现在同一字节流里。
//
// 运行：node h2-sim/h2-client.js [port] [path1] [path2] [path3]

const net = require('net');
const { FRAME_TYPES, FLAGS, encodeFrame, decodeFrames, isEndStream, typeLabel } = require('./h2-frame');

const PORT  = Number(process.argv[2] || 4401);
const PATHS = [
  process.argv[3] || '/',
  process.argv[4] || '/css/app.84d7a5c1.css',
  process.argv[5] || '/js/app.12ab34cd.js',
];

// compound 启动时 Server 和 Client 同时拉起，等 Server ready 后再连
const MAX_RETRIES = 15;
const RETRY_MS    = 300;

function log(msg)    { console.log(msg); }
function bold(msg)   { console.log(`\x1b[1m${msg}\x1b[0m`); }
function green(msg)  { console.log(`\x1b[32m${msg}\x1b[0m`); }
function dim(msg)    { console.log(`  \x1b[2m${msg}\x1b[0m`); }
function yellow(msg) { console.log(`\x1b[33m${msg}\x1b[0m`); }

// ── 主逻辑 ────────────────────────────────────────────────────

function connect(attempt = 1) {
  const socket = net.createConnection({ host: '127.0.0.1', port: PORT });

  // Server 还没 ready，静默重试
  socket.once('error', (e) => {
    if (e.code === 'ECONNREFUSED' && attempt <= MAX_RETRIES) {
      console.log(`  [等待 Server] 第 ${attempt} 次重试（${RETRY_MS}ms 后）...`);
      setTimeout(() => connect(attempt + 1), RETRY_MS);
    } else {
      console.error('[socket error]', e.message);
    }
  });

  socket.once('connect', () => {
    bold('\n[连接建立] 同时发出所有 HEADERS 帧...\n');

    // HTTP/2 客户端主动发起的 Stream ID 从 1 开始，每次递增 2（奇数）
    PATHS.forEach((p, i) => {
      const streamId = 2 * i + 1; // 1, 3, 5
      const headers = JSON.stringify({ method: 'GET', path: p });
      const frame = encodeFrame(FRAME_TYPES.HEADERS, FLAGS.END_STREAM, streamId, headers);

      log(`  ► 发送 HEADERS 帧  stream=${streamId}  GET ${p}`);
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BP-A  CLIENT → SERVER：请求帧即将写入 TCP
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 此时看：
      //   streamId          → 这条 Stream 的 ID（1 / 3 / 5）
      //   p                 → 请求的路径
      //   frame             → 展开 Buffer，[0..2]=payloadLen [3]=type [5..8]=streamId
      //   frame.length      → 整帧字节数（9B帧头 + payload）
      // 三次 BP-A 之后，3 个 HEADERS 帧全部打出，等待服务器响应
      debugger; // eslint-disable-line no-debugger  BP-A
      socket.write(frame);
    });

    log('\n──────────────────────────────────────────────────────────────');
    bold('  3 个请求已并发发出，等待服务器交错返回帧...');
    log('──────────────────────────────────────────────────────────────\n');
  });

  // ── 接收与分流 ───────────────────────────────────────────────

  // streams: Map<streamId, { path, headersParsed, bodyChunks: Buffer[], totalBytes }>
  const streams = new Map();
  PATHS.forEach((p, i) => {
    const streamId = 2 * i + 1;
    streams.set(streamId, { path: p, headersParsed: false, bodyChunks: [], totalBytes: 0 });
  });

  let recvBuf    = Buffer.alloc(0);
  let frameCount = 0;
  let doneCount  = 0;

  // SLOW_RECV=1 时把每次 data chunk 切成 7 字节一片来处理
  // 7 < 帧头 9 字节，必然触发 recvBuf 跨 data 事件拼凑的场景
  function processChunk(slice) {
    const beforeLen = recvBuf.length;
    recvBuf = Buffer.concat([recvBuf, slice]);

    const { frames, remaining } = decodeFrames(recvBuf);
    recvBuf = remaining;

    if (process.env.SLOW_RECV === '1') {
      console.log(
        `  [data片段 ${slice.length}B] recvBuf: ${beforeLen}B+${slice.length}B=${beforeLen + slice.length}B` +
        ` → 解出${frames.length}帧，剩余${remaining.length}B`
      );
    }
    return frames;
  }

  socket.on('data', (chunk) => {
    let frames = [];
    if (process.env.SLOW_RECV === '1') {
      // 模拟 TCP 把数据切成 7 字节一片交付（远小于帧头 9 字节）
      for (let i = 0; i < chunk.length; i += 7) {
        frames = frames.concat(processChunk(chunk.slice(i, i + 7)));
      }
    } else {
      frames = processChunk(chunk);
    }

    for (const frame of frames) {
      frameCount++;
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BP-D  CLIENT：收到一帧，按 StreamID 路由到对应 buffer
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 此时看：
      //   frame.streamId  → 这帧属于哪个 Stream（和 BP-C 的 streamId 对应）
      //   frame.type      → 0=DATA  1=HEADERS
      //   frame.length    → payload 字节数
      //   frameCount      → 第几帧（观察交错顺序：1→3→5→1→3→5→...）
      //   streams         → 展开 Map，对比 3 个 Stream 的 totalBytes，
      //                      同步增长 = 多路复用并发推进的直接证据
      // Debug Console：frame.payload.toString('utf-8')  看 payload 内容
      debugger; // eslint-disable-line no-debugger  BP-D
      const s = streams.get(frame.streamId);
      const endStream = isEndStream(frame);

      if (frame.type === FRAME_TYPES.HEADERS) {
        // ── 响应 HEADERS 帧 ──
        const headers = JSON.parse(frame.payload.toString('utf-8'));
        if (s) s.headersParsed = true;

        yellow(`  ← 帧 #${String(frameCount).padStart(2)} [HEADERS] stream=${frame.streamId}  status=${headers.status}  ${headers['content-type'] ?? ''}`);
        if (headers['content-length']) dim(`     Content-Length: ${headers['content-length']} bytes`);

      } else if (frame.type === FRAME_TYPES.DATA) {
        // ── DATA 帧 ──
        if (s) {
          s.bodyChunks.push(frame.payload);
          s.totalBytes += frame.payload.length;
        }

        const label = endStream ? ' \x1b[32m[END_STREAM]\x1b[0m' : '';
        log(`  ← 帧 #${String(frameCount).padStart(2)} [DATA   ] stream=${frame.streamId}  payload=${frame.length}B  累计=${s?.totalBytes ?? '?'}B${label}`);
      }

    if (endStream && s) {
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // BP-E  CLIENT：END_STREAM 到达，Stream 完整响应整体交付
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // 此时看：
      //   frame.streamId    → 哪个 Stream 率先完成（CSS/JS 比 HTML 先完成）
      //   s.bodyChunks      → 数组，展开看每段 chunk 的大小（每段 120B）
      //   s.totalBytes      → 该 Stream 完整响应体字节数
      //   doneCount+1       → 第几个完成（3 个 Stream 各自独立完成，顺序不固定）
      // Debug Console：Buffer.concat(s.bodyChunks).toString('utf-8')  完整响应内容
      debugger; // eslint-disable-line no-debugger  BP-E
      // 该 Stream 所有帧都到了，整体交付
      const body = Buffer.concat(s.bodyChunks);
        doneCount++;
        green(`\n  ✅ Stream ${frame.streamId} 完成：${s.path} → ${body.length} bytes`);
        dim(`     前 80 字节预览: ${body.slice(0, 80).toString('utf-8').replace(/\n/g, '↵')}`);

        if (doneCount === streams.size) {
          // 所有 Stream 全部完成
          log('\n══════════════════════════════════════════════════════════════');
          bold('  全部 Stream 已完成，总结：');
          for (const [sid, st] of streams) {
            log(`    Stream ${sid}  ${st.path.padEnd(32)}  ${st.totalBytes} bytes`);
          }
          log(`  共收到 ${frameCount} 帧，全部来自同一条 TCP 连接`);
          log('══════════════════════════════════════════════════════════════\n');
          socket.destroy();
        }
      }
    }
  });

  socket.on('close', () => dim('[连接已关闭]'));
}

connect();
