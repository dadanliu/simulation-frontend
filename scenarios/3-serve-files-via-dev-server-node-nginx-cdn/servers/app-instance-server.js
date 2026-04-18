// 角色：后端应用实例（被 origin-nginx-server 反向代理的上游节点）
//
// 在整体架构中处于最底层：
//   浏览器 -> cdn-edge-server -> origin-nginx-server -> app-instance-server
//
// 它模拟的是实际生产里跑在同一区域多台机器上的 Node/Java/Python 应用服务，
// 这里只做最精简的实现：所有请求都返回 JSON，说明"这个请求落在了哪台实例上"。
// 真实场景里这里会是业务逻辑、数据库查询等。
//
// 启动方式：node servers/app-instance-server.js <instanceId> <port> <region>
// 例：      node servers/app-instance-server.js a 5311 ap-northeast-1

const http = require('http');

// 通过命令行参数区分多个实例（a / b / c...）
const instanceId = process.argv[2] || 'a';
const port = Number(process.argv[3] || 4501);
const region = process.argv[4] || 'ap-northeast-1';

const server = http.createServer((req, res) => {
  // 响应体：告诉调用方"你打到了哪个实例"，用于验证负载均衡是否在多台机器之间轮转
  const payload = {
    instance: instanceId,
    region,
    method: req.method,
    path: req.url,
    time: new Date().toISOString(),
  };

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    // 动态接口不应被任何中间层缓存
    'Cache-Control': 'no-store',
    // 透传实例信息，origin-nginx-server 会把这些头转发出去，方便排查流量走向
    'X-App-Instance': instanceId,
    'X-App-Region': region,
  });
  res.end(JSON.stringify(payload, null, 2));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`app instance ${instanceId} listening on http://127.0.0.1:${port}`);
});
