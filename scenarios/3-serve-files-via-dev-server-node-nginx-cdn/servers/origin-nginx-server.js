// 角色：源站（模拟 Nginx 静态服务 + 反向代理）
//
// 在整体架构中处于中间层：
//   浏览器 -> cdn-edge-server -> origin-nginx-server -> app-instance-server
//
// 它承担两类请求：
//   1. 静态资源（.html / .css / .js / .svg...）：直接从磁盘读文件，
//      按 nginx 风格设置缓存头（html → no-cache，hash 资源 → immutable，其他 → max-age=300）。
//   2. /api/* 路径：轮询转发到后端多个 app 实例，模拟 nginx upstream 负载均衡。
//
// 它还实现了 304 条件请求：对比 ETag / Last-Modified，未修改时节省带宽。
//
// 启动方式：node servers/origin-nginx-server.js <root-dir> [port] [upstream1,upstream2,...]
// 例：      node servers/origin-nginx-server.js demo-dist 5313 5311,5312

const http = require('http');
const {
  fs,
  path,
  send,
  toPublicPath,
  safeResolve,
  isHashedAsset,
  contentTypeOf,
  etagOfStat,
  isNotModified,
  fetchFromOrigin,
} = require('./shared');

const rootArg = process.argv[2];
const port = Number(process.argv[3] || 5313);
const upstreamArg = process.argv[4] || '5311,5312';

if (!rootArg) {
  console.error('Usage: node servers/origin-nginx-server.js <root-dir> [port] [upstreamPortsCommaSeparated]');
  process.exit(1);
}

const rootDir = path.resolve(process.cwd(), rootArg);

// 解析 upstream 端口列表，例如 "5311,5312" → [5311, 5312]
const upstreams = upstreamArg.split(',').map((value) => Number(value.trim())).filter(Boolean);

// 轮询计数器：每次 /api 请求递增，实现 round-robin 负载均衡
let rrIndex = 0;

// 按 nginx 风格决定静态资源的 Cache-Control：
//   - html：no-cache（每次都要向服务器确认是否有新版本）
//   - 带 hash 的 js/css：public, max-age=31536000, immutable（内容不会变，永久缓存）
//   - 其他静态资源：public, max-age=300（短期缓存）
function staticHeaders(publicPath, stat, etag) {
  const effectivePath = publicPath === '/' ? '/index.html' : publicPath;
  return {
    'Content-Type': contentTypeOf(effectivePath),
    'Content-Length': String(stat.size),
    'Cache-Control': effectivePath.endsWith('.html')
      ? 'no-cache'
      : isHashedAsset(effectivePath)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300',
    // Last-Modified + ETag 用于支持浏览器 / CDN 发起条件请求（304）
    'Last-Modified': stat.mtime.toUTCString(),
    'ETag': etag,
    // 伪造 Server 头，直观体现"这里在模拟 nginx"
    'Server': 'nginx/1.28.3',
    'X-Delivery-Mode': 'origin-nginx-simulation',
    'X-Serve-Reason': 'origin static or reverse proxy by nginx-style rules',
  };
}

// 把 /api/* 请求转发到某台 app-instance-server
// 每次调用 rrIndex++，实现轮询：第1次→5311，第2次→5312，第3次→5311...
async function proxyToUpstream(req, res, publicPath) {
  if (!upstreams.length) {
    send(res, 502, 'No upstream available', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const upstreamPort = upstreams[rrIndex % upstreams.length];
  rrIndex += 1;
  const result = await fetchFromOrigin({
    port: upstreamPort,
    method: req.method,
    path: publicPath,
    headers: {
      'x-forwarded-by': 'origin-nginx-simulation',
    },
  });

  const headers = {
    'Content-Type': result.headers['content-type'] || 'application/json; charset=utf-8',
    // 接口响应不应被任何层缓存
    'Cache-Control': 'no-store',
    'Server': 'nginx/1.28.3',
    'X-Delivery-Mode': 'origin-nginx-simulation',
    // 把上游实例信息透传，供 curl-test.sh 验证轮询结果
    'X-Upstream-Port': String(upstreamPort),
    'X-Upstream-Instance': result.headers['x-app-instance'] || 'unknown',
    'X-Upstream-Region': result.headers['x-app-region'] || 'unknown',
    'X-Serve-Reason': 'reverse proxy to upstream app instance',
  };

  send(res, result.statusCode, result.body, headers);
}

const server = http.createServer(async (req, res) => {
  try {
    const publicPath = toPublicPath(req.url);

    // /api/* 走反向代理逻辑，其余走静态文件逻辑
    if (publicPath.startsWith('/api/')) {
      await proxyToUpstream(req, res, publicPath);
      return;
    }

    const absolutePath = safeResolve(rootDir, publicPath);
    if (!absolutePath) {
      send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
      send(res, 404, `Not found: ${publicPath}`, { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    const stat = fs.statSync(absolutePath);
    const etag = etagOfStat(stat);
    const lastModified = stat.mtime.toUTCString();
    const headers = staticHeaders(publicPath, stat, etag);

    // 304 条件请求：如果文件未变更，直接返回 304，不传文件体，节省带宽
    if (isNotModified(req, etag, lastModified)) {
      send(res, 304, '', headers);
      return;
    }

    const body = fs.readFileSync(absolutePath);
    send(res, 200, body, headers);
  } catch (error) {
    send(res, 500, `Internal error: ${error.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`origin nginx simulation serving ${rootDir}`);
  console.log(`Open http://127.0.0.1:${port}`);
  console.log(`Upstreams: ${upstreams.join(', ') || '(none)'}`);
});
