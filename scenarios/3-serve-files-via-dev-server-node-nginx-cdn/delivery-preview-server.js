const http = require('http');
const fs = require('fs');
const path = require('path');

const mode = process.argv[2] || 'node';
const rootArg = process.argv[3];
const port = Number(process.argv[4] || 4302);

if (!rootArg) {
  console.error('Usage: node delivery-preview-server.js <mode> <root-dir> [port]');
  process.exit(1);
}

const rootDir = path.resolve(process.cwd(), rootArg);
const cdnState = new Map();

const modeConfig = {
  dev: {
    label: 'dev-server',
    port,
    describe: 'serve fresh local files with no-cache headers',
  },
  node: {
    label: 'node-static-server',
    port,
    describe: 'serve files directly from a simple Node server',
  },
  nginx: {
    label: 'nginx-style-static-server',
    port,
    describe: 'serve html and static assets with stronger cache policy',
  },
  cdn: {
    label: 'cdn-edge-cache',
    port,
    describe: 'simulate edge cache hits on repeated asset requests',
  },
};

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function toPublicPath(urlPathname) {
  return decodeURIComponent((urlPathname || '/').split('?')[0]);
}

function safeResolve(publicPath) {
  const filePath = publicPath === '/' ? '/index.html' : publicPath;
  const absolutePath = path.resolve(rootDir, `.${filePath}`);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

function isHashedAsset(publicPath) {
  return /\.[a-f0-9]{8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$/i.test(publicPath);
}

function buildHeaders(publicPath) {
  const ext = path.extname(publicPath).toLowerCase();
  const headers = {
    'Content-Type': contentTypes[ext] || 'application/octet-stream',
    'X-Delivery-Mode': modeConfig[mode].label,
  };

  // 这里故意把“不同交付层的差异”放在响应头里，
  // 方便用浏览器 Network 面板直接观察。
  if (mode === 'dev') {
    headers['Cache-Control'] = 'no-store';
    headers['X-Serve-Reason'] = 'development prefers fresh files';
    return headers;
  }

  if (mode === 'node') {
    headers['Cache-Control'] = 'no-cache';
    headers['X-Serve-Reason'] = 'simple node static delivery';
    return headers;
  }

  if (mode === 'nginx') {
    headers['Cache-Control'] = publicPath.endsWith('.html')
      ? 'no-cache'
      : isHashedAsset(publicPath)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300';
    headers['X-Serve-Reason'] = 'nginx-style cache policy';
    return headers;
  }

  if (mode === 'cdn') {
    const count = (cdnState.get(publicPath) || 0) + 1;
    cdnState.set(publicPath, count);
    headers['Cache-Control'] = publicPath.endsWith('.html')
      ? 'no-cache'
      : isHashedAsset(publicPath)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=600';
    headers['X-Cache'] = count === 1 ? 'MISS' : 'HIT';
    headers['Age'] = count === 1 ? '0' : String((count - 1) * 30);
    headers['X-Serve-Reason'] = 'cdn edge cache simulation';
  }

  return headers;
}

if (!fs.existsSync(rootDir)) {
  console.error(`Directory does not exist: ${rootDir}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const publicPath = toPublicPath(req.url);
  const absolutePath = safeResolve(publicPath);

  if (!absolutePath) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    send(res, 404, `Not found: ${publicPath}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const body = fs.readFileSync(absolutePath);
  const headers = buildHeaders(publicPath);
  send(res, 200, body, headers);
});

server.listen(modeConfig[mode].port, '127.0.0.1', () => {
  console.log(`Serving ${rootDir}`);
  console.log(`Mode: ${modeConfig[mode].label}`);
  console.log(`Open http://127.0.0.1:${modeConfig[mode].port}`);
  console.log(`Behavior: ${modeConfig[mode].describe}`);
});
