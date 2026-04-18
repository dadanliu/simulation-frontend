// 角色：CDN 边缘缓存节点
//
// 在整体架构中处于最外层：
//   浏览器 -> cdn-edge-server -> origin-nginx-server -> app-instance-server
//
// 它模拟的是真实 CDN（CloudFront / Akamai / Fastly）的边缘节点行为：
//   - 收到请求时先查内存缓存（edgeCaches）
//   - 命中（HIT）：直接返回缓存内容，附上 X-Cache: HIT 和实际缓存时长 Age
//   - 未命中（MISS）：回源（fetch from origin），拿到响应后写入缓存，返回时附上 X-Cache: MISS
//
// 缓存 key 由 region + method + pathname 组成，不包含 query string，
// 这样同一路径在不同区域有各自独立的缓存条目，模拟"按区域独立的边缘节点"。
//
// 启动方式：node servers/cdn-edge-server.js [port] [originPort]
// 例：      node servers/cdn-edge-server.js 5314 5313

const http = require('http');
const { send, fetchFromOrigin } = require('./shared');

const port = Number(process.argv[2] || 5314);
const originPort = Number(process.argv[3] || 5313);

// 内存缓存：key → { statusCode, headers, body, cachedAt }
// 生产 CDN 里对应的是分布在全球各 PoP 节点上的磁盘/内存缓存
const edgeCaches = new Map();

// 从请求头或 query 里提取 region，决定用哪个"区域缓存桶"
// 真实 CDN 里 region 由客户端 IP 地理位置自动决定，这里用参数手动模拟
function pickRegion(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    return req.headers['x-region'] || url.searchParams.get('region') || 'ap-northeast-1';
  } catch {
    return req.headers['x-region'] || 'ap-northeast-1';
  }
}

// 缓存 key = region:method:pathname
// 不含 query string，是因为 CDN 通常按 path 缓存（query 可另配是否纳入 key）
// region 在 key 里保证了不同区域的边缘节点缓存完全独立，互不共享
function cacheKey(req, region) {
  const url = new URL(req.url, 'http://localhost');
  return `${region}:${req.method}:${url.pathname}`;
}

const server = http.createServer(async (req, res) => {
  try {
    const region = pickRegion(req);
    const key = cacheKey(req, region);
    const cached = edgeCaches.get(key);

    if (cached) {
      // 缓存命中：计算资源在边缘节点上已缓存了多少秒（即 Age 头）
      const ageSeconds = Math.max(0, Math.floor((Date.now() - cached.cachedAt) / 1000));
      send(res, cached.statusCode, cached.body, {
        ...cached.headers,
        'X-Cache': 'HIT',
        'X-Region': region,
        'Age': String(ageSeconds),
        'X-Delivery-Mode': 'cdn-edge-simulation',
        'X-Serve-Reason': 'edge cache hit',
      });
      return;
    }

    // 缓存未命中：向源站（origin-nginx-server）回源
    // 透传浏览器发来的条件请求头，让源站也有机会返回 304
    const result = await fetchFromOrigin({
      port: originPort,
      method: req.method,
      path: req.url,
      headers: {
        'if-none-match': req.headers['if-none-match'] || '',
        'if-modified-since': req.headers['if-modified-since'] || '',
        'x-forwarded-region': region,
      },
    });

    const headers = {
      'Content-Type': result.headers['content-type'] || 'application/octet-stream',
      // 将源站的 Cache-Control 透传，让浏览器也知道这个资源能缓存多久
      'Cache-Control': result.headers['cache-control'] || 'no-cache',
      'ETag': result.headers.etag || '',
      'Last-Modified': result.headers['last-modified'] || '',
      'Server': 'cdn-edge-simulation',
      // 记录源站的 delivery mode，方便调试时追踪整条链路
      'X-Origin-Mode': result.headers['x-delivery-mode'] || 'unknown',
      'X-Region': region,
      'X-Cache': 'MISS',
      'Age': '0',
      'X-Serve-Reason': 'edge miss then fetch from origin',
    };

    if (result.headers['x-upstream-instance']) headers['X-Upstream-Instance'] = result.headers['x-upstream-instance'];
    if (result.headers['x-upstream-port']) headers['X-Upstream-Port'] = result.headers['x-upstream-port'];

    send(res, result.statusCode, result.body, headers);

    // 只缓存 GET 200 的响应，POST / 错误 / 304 不写入缓存
    if (req.method === 'GET' && result.statusCode === 200) {
      edgeCaches.set(key, {
        statusCode: result.statusCode,
        body: result.body,
        headers,
        cachedAt: Date.now(),
      });
    }
  } catch (error) {
    send(res, 500, `CDN error: ${error.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`cdn edge simulation listening on http://127.0.0.1:${port}`);
  console.log(`Origin port: ${originPort}`);
});
