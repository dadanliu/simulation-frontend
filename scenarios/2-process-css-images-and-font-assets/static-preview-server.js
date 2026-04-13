const http = require('http');
const fs = require('fs');
const path = require('path');

const rootArg = process.argv[2];
const portArg = process.argv[3];

if (!rootArg) {
  console.error('Usage: node static-preview-server.js <root-dir> [port]');
  process.exit(1);
}

const rootDir = path.resolve(process.cwd(), rootArg);
const port = Number(portArg || 4173);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function send(res, statusCode, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, { 'Content-Type': type });
  res.end(body);
}

function safeResolvePath(urlPathname) {
  const cleanPath = decodeURIComponent(urlPathname.split('?')[0]);
  const requestedPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const absolutePath = path.resolve(rootDir, `.${requestedPath}`);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

if (!fs.existsSync(rootDir)) {
  console.error(`Directory does not exist: ${rootDir}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const absolutePath = safeResolvePath(req.url || '/');

  if (!absolutePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    send(res, 404, `Not found: ${req.url}`);
    return;
  }

  const ext = path.extname(absolutePath).toLowerCase();
  const type = contentTypes[ext] || 'application/octet-stream';
  const body = fs.readFileSync(absolutePath);

  // 这里故意用最小静态服务，让读者看到“构建产物必须通过 HTTP 被请求”这一步。
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
  });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Serving ${rootDir}`);
  console.log(`Open http://127.0.0.1:${port}`);
});
