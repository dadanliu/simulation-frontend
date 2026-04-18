// 角色：用原始 TCP 接收 HTTP 请求，展示字节流结构，返回文件响应
//
// 刻意使用 net 模块（原始 TCP）而非 http 模块，
// 目的是把 HTTP 协议的字节结构暴露出来——
// http 模块帮你把这些细节都藏起来了。
//
// 运行：node byte-stream-server.js [port] [dist-dir]

const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 4400);
const DIST_DIR = path.resolve(process.cwd(), process.argv[3] || 'demo-dist');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

// ── 字节流注解打印 ────────────────────────────────────────────

function printByteAnnotation(label, rawText, extra = '') {
  const border = '─'.repeat(64);
  console.log(`\n${border}`);
  console.log(`  ${label}`);
  if (extra) console.log(`  ${extra}`);
  console.log(border);

  // 把 \r\n 替换成可见字符再打印，让分隔符一目了然
  const lines = rawText.split('\n');
  lines.forEach((line) => {
    const visible = line.replace(/\r/g, '\\r') + (line !== lines[lines.length - 1] ? '\\n' : '');
    console.log(`  ${visible}`);
  });

  console.log(`${border}`);
  console.log(`  字节总数: ${Buffer.byteLength(rawText, 'utf-8')} bytes`);
}

// ── HTTP 请求解析 ─────────────────────────────────────────────

function parseHttpRequest(rawBuffer) {
  const raw = rawBuffer.toString('utf-8');

  // HTTP 请求结构：头部区域 \r\n\r\n 正文区域
  // 定位 \r\n\r\n 就找到了头部的结束位置
  const headerBodySep = raw.indexOf('\r\n\r\n');
  if (headerBodySep === -1) return null;

  const headerSection = raw.slice(0, headerBodySep);
  const body = raw.slice(headerBodySep + 4);

  const lines = headerSection.split('\r\n');

  // 第一行是请求行：METHOD PATH HTTP/VERSION
  const [method, reqPath, httpVersion] = lines[0].split(' ');

  // 后续每行是头部字段：Key: Value
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const sep = lines[i].indexOf(':');
    if (sep > -1) {
      const key = lines[i].slice(0, sep).trim().toLowerCase();
      const val = lines[i].slice(sep + 1).trim();
      headers[key] = val;
    }
  }

  return { method, path: reqPath, httpVersion, headers, body, raw };
}

// ── HTTP 响应构造 ─────────────────────────────────────────────

function buildHttpResponse(statusCode, statusText, headers, bodyBuffer) {
  // 响应字节 = 状态行 + \r\n + 头部字段 + \r\n\r\n + 正文字节
  const statusLine = `HTTP/1.1 ${statusCode} ${statusText}`;
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\r\n');
  const headerBlock = `${statusLine}\r\n${headerLines}\r\n\r\n`;

  // 用 Buffer.concat 把文本头部和二进制正文拼在一起
  return Buffer.concat([Buffer.from(headerBlock, 'utf-8'), bodyBuffer]);
}

// ── 文件读取与路径安全 ────────────────────────────────────────

function resolveFilePath(urlPath) {
  const filePath = urlPath === '/' ? '/index.html' : urlPath;
  const abs = path.resolve(DIST_DIR, `.${filePath}`);
  // 防止路径穿越（../../ 攻击）
  if (!abs.startsWith(DIST_DIR)) return null;
  return abs;
}

// ── TCP 服务器 ────────────────────────────────────────────────

const server = net.createServer((socket) => {
  const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
  console.log(`\n[连接] ${clientId}`);

  const chunks = [];

  socket.on('data', (chunk) => {
    chunks.push(chunk);

    // 等收到 \r\n\r\n 才表示请求头部全部到达，可以处理
    // （简化处理：假设请求头在一次 data 事件里全部到达，对本地 demo 成立）
    const raw = Buffer.concat(chunks);
    if (!raw.includes('\r\n\r\n')) return;

    const req = parseHttpRequest(raw);
    if (!req) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }

    // ── 打印请求字节注解 ──────────────────────────
    printByteAnnotation(
      `► 收到请求字节流  [${clientId}]`,
      req.raw,
      `方法: ${req.method}  路径: ${req.path}  协议: ${req.httpVersion}`,
    );
    console.log('  [解析结果]');
    console.log(`    请求行  : ${req.method} ${req.path} ${req.httpVersion}`);
    console.log(`    头部字段:`);
    Object.entries(req.headers).forEach(([k, v]) => {
      console.log(`      ${k}: ${v}`);
    });
    console.log(`    \\r\\n\\r\\n  : 头部结束标志`);
    console.log(`    正文    : ${req.body.length === 0 ? '(空，GET 请求无正文)' : req.body}`);

    // ── 读文件，构造响应 ──────────────────────────
    const filePath = resolveFilePath(req.path);
    let statusCode = 200;
    let statusText = 'OK';
    let bodyBuffer;
    let responseHeaders;

    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      statusCode = 404;
      statusText = 'Not Found';
      bodyBuffer = Buffer.from(`Not found: ${req.path}`);
      responseHeaders = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': String(bodyBuffer.length),
        'Connection': 'close',
      };
    } else {
      bodyBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      responseHeaders = {
        'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
        // Content-Length 告诉接收方：正文有这么多字节，读完就停
        'Content-Length': String(bodyBuffer.length),
        'Connection': 'close',
      };
    }

    const responseBuffer = buildHttpResponse(statusCode, statusText, responseHeaders, bodyBuffer);

    // ── 打印响应字节注解 ──────────────────────────
    const headerOnly = responseBuffer.toString('utf-8').split('\r\n\r\n')[0] + '\r\n\r\n';
    printByteAnnotation(
      `◄ 发送响应字节流  [${clientId}]`,
      headerOnly,
      `状态: ${statusCode} ${statusText}  正文: ${bodyBuffer.length} bytes`,
    );
    console.log(`  [正文] ${bodyBuffer.length} bytes（${responseHeaders['Content-Type']}）`);
    if (bodyBuffer.length <= 200) {
      console.log(`  ${bodyBuffer.toString('utf-8').replace(/\n/g, '\n  ')}`);
    } else {
      console.log(`  ${bodyBuffer.slice(0, 120).toString('utf-8')} ...（已截断）`);
    }

    socket.write(responseBuffer);
    socket.end();
  });

  socket.on('end', () => {
    console.log(`[断开] ${clientId}`);
  });

  socket.on('error', (err) => {
    console.error(`[错误] ${clientId}: ${err.message}`);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│  byte-stream-server  (raw TCP)                  │');
  console.log(`│  监听: http://127.0.0.1:${PORT}                    │`);
  console.log(`│  静态根目录: ${DIST_DIR.split('/').slice(-2).join('/')}        │`);
  console.log('│                                                 │');
  console.log('│  每次收到请求都会打印：                          │');
  console.log('│  · 请求字节流原文 + 结构注解                    │');
  console.log('│  · 响应字节流头部 + 正文字节数                  │');
  console.log('└─────────────────────────────────────────────────┘');
});
