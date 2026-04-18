// 工具模块：被 origin-nginx-server 和 cdn-edge-server 共同引用
//
// 收拢以下公共逻辑，避免在各 server 文件里重复：
//   - HTTP 响应发送
//   - URL 路径处理和安全校验
//   - 静态资源类型判断
//   - ETag 生成
//   - 304 条件请求判断
//   - 向上游发起 HTTP 请求（回源）

const fs = require('fs');
const path = require('path');
const http = require('http');

// 扩展名 → MIME type 映射
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// 封装 res.writeHead + res.end，统一响应出口
function send(res, statusCode, body = '', headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

// 从 req.url 里提取纯路径（去掉 query string、解码 %xx 编码）
// 例："/js/app.12ab34cd.js?v=1" → "/js/app.12ab34cd.js"
function toPublicPath(urlPathname) {
  return decodeURIComponent((urlPathname || '/').split('?')[0]);
}

// 把 URL 路径拼到 rootDir 上，并检查是否有路径穿越（../../ 攻击）
// 如果解析出的绝对路径不在 rootDir 以内，返回 null，调用方应返回 403
function safeResolve(rootDir, publicPath) {
  const filePath = publicPath === '/' ? '/index.html' : publicPath;
  const absolutePath = path.resolve(rootDir, `.${filePath}`);
  if (!absolutePath.startsWith(rootDir)) return null;
  return absolutePath;
}

// 判断是否是"带内容 hash 的静态资源"
// 例：app.84d7a5c1.css、logo.77aa33ff.svg → true
// 这类文件内容和文件名绑定，可以永久缓存（immutable）
function isHashedAsset(publicPath) {
  return /\.[a-f0-9]{8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$/i.test(publicPath);
}

// 根据文件扩展名返回 Content-Type
function contentTypeOf(publicPath) {
  return contentTypes[path.extname(publicPath).toLowerCase()] || 'application/octet-stream';
}

// 用文件的 mtime（修改时间，精确到毫秒）和 size 生成 ETag
// 格式："<mtimeHex>-<sizeHex>"，和 nginx 默认 ETag 格式一致
// 文件只要变过（内容或时间戳），ETag 就会变，浏览器下次带 If-None-Match 时能精确命中
function etagOfStat(stat) {
  return `"${Math.floor(stat.mtimeMs).toString(16)}-${stat.size.toString(16)}"`;
}

// 判断是否满足 304 Not Modified 条件（两条规则满足任一即可）：
//   1. If-None-Match 与当前 ETag 完全一致
//   2. If-Modified-Since 时间 >= 文件最后修改时间
function isNotModified(req, etag, lastModified) {
  const inm = req.headers['if-none-match'];
  if (inm && inm === etag) return true;
  const ims = req.headers['if-modified-since'];
  if (ims) {
    const since = new Date(ims).getTime();
    const modified = new Date(lastModified).getTime();
    if (!Number.isNaN(since) && !Number.isNaN(modified) && modified <= since) return true;
  }
  return false;
}

// 向指定端口的 HTTP 服务发起请求（用于 origin 回源到 app 实例，或 CDN 回源到 origin）
// 返回 Promise<{ statusCode, headers, body: Buffer }>
function fetchFromOrigin({ hostname = '127.0.0.1', port, method = 'GET', path: reqPath, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname, port, method, path: reqPath, headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 500,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = {
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
};
