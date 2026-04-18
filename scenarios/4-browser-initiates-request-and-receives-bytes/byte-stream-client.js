// 角色：用原始 TCP 手动构造 HTTP 请求，展示发出和收到的字节流
//
// 刻意使用 net 模块（原始 TCP）而非 http/fetch，
// 目的是展示浏览器在底层实际发出的字节内容。
//
// 运行：node byte-stream-client.js [port]

const net = require('net');

const PORT = Number(process.argv[2] || 4400);
const HOST = '127.0.0.1';

// 要依次请求的路径
const REQUESTS = [
  { path: '/', label: 'HTML 入口' },
  { path: '/css/app.84d7a5c1.css', label: 'CSS（hash 资源）' },
  { path: '/js/app.12ab34cd.js', label: 'JS（hash 资源）' },
  { path: '/not-exist.png', label: '不存在的文件（404）' },
];

// ── 工具 ──────────────────────────────────────────────────────

function printSection(title, content) {
  const border = '─'.repeat(64);
  console.log(`\n${border}`);
  console.log(`  ${title}`);
  console.log(border);
  console.log(content);
  console.log(border);
}

// 把响应字节流拆成结构化对象
function parseHttpResponse(buffer) {
  const raw = buffer.toString('utf-8');

  // \r\n\r\n 是头部结束标志
  const sepIdx = raw.indexOf('\r\n\r\n');
  if (sepIdx === -1) return null;

  const headerText = raw.slice(0, sepIdx);
  // 正文用原始 Buffer 保留（二进制图片等不能 toString）
  const bodyBuffer = buffer.slice(Buffer.byteLength(headerText, 'utf-8') + 4);

  const lines = headerText.split('\r\n');

  // 状态行：HTTP/1.1 STATUS_CODE STATUS_TEXT
  const [httpVersion, statusCodeStr, ...statusParts] = lines[0].split(' ');
  const statusCode = Number(statusCodeStr);
  const statusText = statusParts.join(' ');

  // 头部字段
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const sep = lines[i].indexOf(':');
    if (sep > -1) {
      headers[lines[i].slice(0, sep).trim().toLowerCase()] = lines[i].slice(sep + 1).trim();
    }
  }

  const contentLength = headers['content-length'] ? Number(headers['content-length']) : null;

  return { httpVersion, statusCode, statusText, headers, bodyBuffer, contentLength, raw };
}

// ── 发起一次 TCP 请求 ─────────────────────────────────────────

function makeRequest({ path: reqPath, label }) {
  return new Promise((resolve) => {
    // 手动拼出 HTTP/1.1 请求字节串
    // 每行以 \r\n 结尾，头部结束后有一个空的 \r\n
    const requestText = [
      `GET ${reqPath} HTTP/1.1`,
      `Host: ${HOST}:${PORT}`,
      `Accept: */*`,
      `Connection: close`,
      ``,  // 空行 = \r\n\r\n 的后半段，标志头部结束
      ``,
    ].join('\r\n');

    console.log(`\n${'═'.repeat(64)}`);
    console.log(`  请求 ${REQUESTS.indexOf({ path: reqPath, label }) + 1}：${label}`);
    console.log(`${'═'.repeat(64)}`);

    // 打印发出的字节串（让 \r\n 可见）
    printSection(
      `► 发出的请求字节流`,
      requestText
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n\n  ')
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n'),
    );
    console.log(`  总字节: ${Buffer.byteLength(requestText, 'utf-8')} bytes`);

    const socket = net.createConnection({ host: HOST, port: PORT }, () => {
      socket.write(requestText);
    });

    const chunks = [];

    socket.on('data', (chunk) => {
      chunks.push(chunk);
    });

    socket.on('end', () => {
      const fullBuffer = Buffer.concat(chunks);
      const res = parseHttpResponse(fullBuffer);

      if (!res) {
        console.log('  [错误] 无法解析响应');
        resolve();
        return;
      }

      // ── 打印收到的响应字节结构 ──────────────────────
      const headerText = res.raw.split('\r\n\r\n')[0];
      printSection(
        `◄ 收到的响应字节流（头部）`,
        headerText
          .split('\r\n')
          .map((l) => `  ${l}\\r\\n`)
          .join('\n') + '\n  \\r\\n   ← 头部结束标志',
      );

      // ── 正文字节分析 ──────────────────────────────────
      console.log(`\n  [正文字节分析]`);
      console.log(`  Content-Length 声明: ${res.contentLength ?? '未声明'} bytes`);
      console.log(`  实际收到正文字节数:   ${res.bodyBuffer.length} bytes`);

      // Content-Length 是浏览器判断"正文读完了"的核心依据
      if (res.contentLength !== null) {
        const matched = res.bodyBuffer.length === res.contentLength;
        console.log(`  字节数匹配: ${matched ? '✅ 一致' : '❌ 不一致'}`);
      }

      console.log(`\n  [正文内容预览]`);
      if (res.bodyBuffer.length === 0) {
        console.log('  (空)');
      } else if (res.bodyBuffer.length <= 300) {
        console.log(`  ${res.bodyBuffer.toString('utf-8').replace(/\n/g, '\n  ')}`);
      } else {
        console.log(`  ${res.bodyBuffer.slice(0, 160).toString('utf-8').replace(/\n/g, '\n  ')} ...`);
        console.log(`  （共 ${res.bodyBuffer.length} bytes，已截断显示）`);
      }

      console.log(`\n  [响应结构总结]`);
      console.log(`  状态行    : ${res.httpVersion} ${res.statusCode} ${res.statusText}`);
      console.log(`  头部字节  : ${Buffer.byteLength(headerText, 'utf-8') + 4} bytes（含末尾 \\r\\n\\r\\n）`);
      console.log(`  正文字节  : ${res.bodyBuffer.length} bytes`);
      console.log(`  响应总字节: ${fullBuffer.length} bytes`);

      resolve();
    });

    socket.on('error', (err) => {
      console.error(`  [连接错误] ${err.message}`);
      console.error(`  请先启动服务器: node byte-stream-server.js ${PORT}`);
      resolve();
    });
  });
}

// ── 按顺序发起所有请求 ────────────────────────────────────────

async function run() {
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  byte-stream-client  (raw TCP)                  │');
  console.log(`│  目标: ${HOST}:${PORT}                            │`);
  console.log('│                                                 │');
  console.log('│  将依次发起 4 个请求，展示：                     │');
  console.log('│  · 手工构造的请求字节串                         │');
  console.log('│  · 收到的响应字节流结构                         │');
  console.log('│  · Content-Length 与实际正文字节的关系          │');
  console.log('└─────────────────────────────────────────────────┘');

  for (const req of REQUESTS) {
    await makeRequest(req);
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log('  全部请求完成');
  console.log(`${'═'.repeat(64)}\n`);
}

run();
