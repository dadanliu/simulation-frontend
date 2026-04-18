#!/usr/bin/env bash
set -euo pipefail

# 场景说明（对应本 case 的 4 个服务）：
# - app 实例层：5311(a)、5312(b) -> 模拟两台应用机
# - origin 层：5313 -> 模拟 Nginx 源站（静态资源 + /api 反向代理到 5311/5312）
# - cdn 层：5314 -> 模拟 CDN 边缘节点（从 5313 回源并做按 region 的缓存）
#
# 这个脚本的目标：
# 1) 先验证 origin(Nginx) 行为是否正确
# 2) 再验证 cdn(edge cache) 的 MISS/HIT 与“分区域独立缓存”行为
#
# 参数说明：
# - 第一个参数：origin 基础地址（默认 http://127.0.0.1:5313）
# - 第二个参数：cdn 基础地址（默认 http://127.0.0.1:5314）
BASE_ORIGIN="${1:-http://127.0.0.1:5313}"
BASE_CDN="${2:-http://127.0.0.1:5314}"

# 1) 【Origin / Nginx 场景】查看首页响应头：
#    重点看是否有源站语义：
#    - Cache-Control: no-cache
#    - ETag / Last-Modified
#    - X-Delivery-Mode: origin-nginx-simulation
printf '\n== 1) origin html headers ==\n'
curl -i "$BASE_ORIGIN/" | sed -n '1,20p'

# 2) 【Origin / Nginx 场景】验证条件请求 304：
#    先取 ETag 和 Last-Modified，再带 If-None-Match/If-Modified-Since 访问同一路径。
#    预期：第二次返回 304 Not Modified。
printf '\n== 2) origin 304 test ==\n'
ETAG=$(curl -sI "$BASE_ORIGIN/" | awk -F': ' 'tolower($1)=="etag"{gsub("\r", "", $2); print $2}')
LAST_MODIFIED=$(curl -sI "$BASE_ORIGIN/" | awk -F': ' 'tolower($1)=="last-modified"{gsub("\r", "", $2); print $2}')
curl -i "$BASE_ORIGIN/" -H "If-None-Match: $ETAG" -H "If-Modified-Since: $LAST_MODIFIED" | sed -n '1,20p'

# 3) 【Origin / Nginx 场景】验证 /api 反向代理负载均衡：
#    连续请求 /api/whoami，预期 instance 在 a / b 之间切换（轮转或近似轮转）。
printf '\n== 3) nginx load balance /api/whoami ==\n'
curl -s "$BASE_ORIGIN/api/whoami" && printf '\n'
curl -s "$BASE_ORIGIN/api/whoami" && printf '\n'
curl -s "$BASE_ORIGIN/api/whoami" && printf '\n'

# 4) 【CDN 场景】同一区域同一资源访问两次：
#    用 region=ap-northeast-1 连续请求，预期第一次 MISS，第二次 HIT。
#    重点看：X-Cache / Age / X-Region。
printf '\n== 4) cdn same region MISS -> HIT ==\n'
curl -i "$BASE_CDN/js/app.12ab34cd.js?region=ap-northeast-1" | sed -n '1,20p'
curl -i "$BASE_CDN/js/app.12ab34cd.js?region=ap-northeast-1" | sed -n '1,20p'

# 5) 【CDN 场景】切换到另一区域请求同一资源：
#    改成 region=ap-southeast-1，预期会独立计算缓存（常见为再次 MISS）。
#    用来证明“不同 region 的边缘缓存互不共享”。
printf '\n== 5) cdn different region independent cache ==\n'
curl -i "$BASE_CDN/js/app.12ab34cd.js?region=ap-southeast-1" | sed -n '1,20p'
