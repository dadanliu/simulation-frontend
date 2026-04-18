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
// 只有 CDN 模式会模拟“同一个资源被再次命中”。
// 这里用内存 Map 记录某个 publicPath 已经被请求过几次，
// 再把结果反映到 X-Cache / Age 响应头里。
const cdnState = new Map();

// 同一份 demo-dist 产物，通过不同 mode 模拟不同“暴露给浏览器”的服务层。
// 差异不在于文件内容变了，而在于“以什么缓存策略、什么语义”返回给浏览器。
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
  // 浏览器请求的原始 URL 可能带 query string，这里只保留路径部分，
  // 因为静态文件映射时关注的是“请求哪个文件”，不是查询参数。
  return decodeURIComponent((urlPathname || '/').split('?')[0]);
}

function safeResolve(publicPath) {
  // 浏览器访问根路径 "/" 时，静态站点通常会回退到 index.html。
  // 这一步就是“把公共 URL 映射到磁盘文件”的关键动作。
  const filePath = publicPath === '/' ? '/index.html' : publicPath;
  const absolutePath = path.resolve(rootDir, `.${filePath}`);

  // 防止通过类似 ../../ 的路径逃出 demo-dist 根目录。
  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

function isHashedAsset(publicPath) {
  // 带 hash 的资源一般可视为“内容变了，文件名也会变”，
  // 所以 Nginx/CDN 模式里通常可以给它更长的缓存时间。
  return /\.[a-f0-9]{8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$/i.test(publicPath);
}

function buildHeaders(publicPath) {
  const ext = path.extname(publicPath).toLowerCase();
  const headers = {
    // 交付层除了“把文件读出来”，还要告诉浏览器这是什么类型的内容。
    // 浏览器是否按 HTML/CSS/JS 解析，首先取决于这里的 Content-Type。
    'Content-Type': contentTypes[ext] || 'application/octet-stream',
    'X-Delivery-Mode': modeConfig[mode].label,
  };

  // 这里故意把“不同交付层的差异”放在响应头里，
  // 方便用浏览器 Network 面板直接观察。
  if (mode === 'dev') {
    // dev server 的重点是“浏览器尽量拿到最新文件”，
    // 所以直接禁止缓存，强调开发调试时的实时性。
    headers['Cache-Control'] = 'no-store';
    headers['X-Serve-Reason'] = 'development prefers fresh files';
    return headers;
  }

  if (mode === 'node') {
    // Node 静态服务只做最基本的文件暴露：
    // 读磁盘、返回正确类型、告诉浏览器需要重新协商缓存。
    headers['Cache-Control'] = 'no-cache';
    headers['X-Serve-Reason'] = 'simple node static delivery';
    return headers;
  }

  if (mode === 'nginx') {
    // Nginx 风格托管常见做法是：
    // HTML 不做强缓存，保证入口页可及时感知新版本；
    // 带 hash 的静态资源长期缓存，提高命中率、减少重复传输。
    headers['Cache-Control'] = publicPath.endsWith('.html')
      ? 'no-cache'
      : isHashedAsset(publicPath)
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300';
    headers['X-Serve-Reason'] = 'nginx-style cache policy';
    return headers;
  }

  if (mode === 'cdn') {
    // CDN 模式是在源站响应头策略之上，再模拟一层“边缘缓存命中”。
    // 第一次请求记作 MISS，之后同一路径再请求就返回 HIT。
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
  // 1. 浏览器发来 URL
  const publicPath = toPublicPath(req.url);
  // 2. 服务层把 URL 映射成 demo-dist 里的真实文件
  const absolutePath = safeResolve(publicPath);

  if (!absolutePath) {
    send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  if (!fs.existsSync(absolutePath) || fs.statSync(absolutePath).isDirectory()) {
    send(res, 404, `Not found: ${publicPath}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  // 3. 读出文件字节
  const body = fs.readFileSync(absolutePath);
  // 4. 根路径虽然是 "/"，但实际返回的是 index.html，
  // 所以响应头也应该按 "/index.html" 来推导内容类型和缓存策略。
  const effectivePublicPath = publicPath === '/' ? '/index.html' : publicPath;
  // 5. 不同 mode 在这里体现差异：同一份文件，附带不同的交付语义。
  const headers = buildHeaders(effectivePublicPath);
  // 6. 最终通过 HTTP 把字节和响应头一起交给浏览器。
  send(res, 200, body, headers);
});

server.listen(modeConfig[mode].port, '127.0.0.1', () => {
  console.log(`Serving ${rootDir}`);
  console.log(`Mode: ${modeConfig[mode].label}`);
  console.log(`Open http://127.0.0.1:${modeConfig[mode].port}`);
  console.log(`Behavior: ${modeConfig[mode].describe}`);
});
