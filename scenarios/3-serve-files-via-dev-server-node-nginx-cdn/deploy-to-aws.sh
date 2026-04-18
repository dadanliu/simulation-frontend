#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${1:-demo-dist}"
DIST_PATH="$SCRIPT_DIR/$DIST_DIR"

if [ ! -d "$DIST_PATH" ]; then
  echo "错误: 目录不存在 $DIST_PATH"
  exit 1
fi

SG_INSTANCE="i-0fbc94f2382670640"
SG_REGION="ap-southeast-1"
TK_INSTANCE="i-0ae6bb7c3b0283e61"
TK_REGION="ap-northeast-1"
S3_BUCKET="delivery-sim-20260415111154-7vp5z8-cdn-origin"
S3_REGION="ap-southeast-1"
CF_DISTRIBUTION="E1GWJHGHPG17NW"
NGINX_ROOT="/usr/share/nginx/html"

echo "========================================="
echo "  部署 $DIST_DIR -> AWS"
echo "========================================="
echo ""

collect_files() {
  local base="$1"
  find "$base" -type f | while read -r f; do
    echo "${f#$base/}"
  done
}

FILES=$(collect_files "$DIST_PATH")
echo "待部署文件:"
echo "$FILES" | sed 's/^/  /'
echo ""

# ── 1. Nginx EC2: 通过 SSM 推送文件 ──────────────────────────

deploy_to_ec2() {
  local region="$1" instance="$2" label="$3"

  echo "[$label] 开始部署到 EC2 $instance ($region) ..."

  local commands=()
  commands+=("rm -rf $NGINX_ROOT/css $NGINX_ROOT/js $NGINX_ROOT/images")

  while IFS= read -r rel; do
    local dir
    dir=$(dirname "$rel")
    local content
    content=$(base64 < "$DIST_PATH/$rel")

    if [ "$dir" != "." ]; then
      commands+=("mkdir -p $NGINX_ROOT/$dir")
    fi
    commands+=("echo '$content' | base64 -d > $NGINX_ROOT/$rel")
  done <<< "$FILES"

  commands+=("nginx -s reload 2>&1 || systemctl restart nginx 2>&1")
  commands+=("echo 'deploy done'")

  local json_cmds
  json_cmds=$(printf '%s\n' "${commands[@]}" | jq -R . | jq -s .)

  local cmd_id
  cmd_id=$(aws ssm send-command \
    --region "$region" \
    --instance-ids "$instance" \
    --document-name "AWS-RunShellScript" \
    --parameters "{\"commands\":$json_cmds}" \
    --query 'Command.CommandId' --output text)

  echo "[$label] CommandId: $cmd_id"
  echo "[$label] 等待执行完成..."

  local status=""
  for i in $(seq 1 30); do
    sleep 2
    status=$(aws ssm get-command-invocation \
      --region "$region" \
      --command-id "$cmd_id" \
      --instance-id "$instance" \
      --query 'Status' --output text 2>/dev/null || echo "InProgress")
    if [ "$status" = "Success" ] || [ "$status" = "Failed" ]; then
      break
    fi
  done

  if [ "$status" = "Success" ]; then
    echo "[$label] ✅ 部署成功"
  else
    echo "[$label] ❌ 部署失败 (status=$status)"
    aws ssm get-command-invocation \
      --region "$region" \
      --command-id "$cmd_id" \
      --instance-id "$instance" \
      --query '{Output:StandardOutputContent,Error:StandardErrorContent}' \
      --output json
    exit 1
  fi
}

deploy_to_ec2 "$SG_REGION" "$SG_INSTANCE" "新加坡"
deploy_to_ec2 "$TK_REGION" "$TK_INSTANCE" "东京"

echo ""

# ── 2. CDN S3: 同步文件到 S3 ─────────────────────────────────

echo "[CDN] 同步到 S3 s3://$S3_BUCKET/ ..."

upload_to_s3() {
  local rel="$1"
  local ext="${rel##*.}"
  local cache_control=""
  local content_type=""

  case "$ext" in
    html) content_type="text/html; charset=utf-8";          cache_control="no-cache" ;;
    css)  content_type="text/css; charset=utf-8";            cache_control="public, max-age=31536000, immutable" ;;
    js)   content_type="application/javascript; charset=utf-8"; cache_control="public, max-age=31536000, immutable" ;;
    svg)  content_type="image/svg+xml";                      cache_control="public, max-age=31536000, immutable" ;;
    json) content_type="application/json; charset=utf-8";    cache_control="public, max-age=300" ;;
    *)    content_type="application/octet-stream";           cache_control="public, max-age=300" ;;
  esac

  aws s3 cp "$DIST_PATH/$rel" "s3://$S3_BUCKET/$rel" \
    --region "$S3_REGION" \
    --cache-control "$cache_control" \
    --content-type "$content_type" \
    --quiet
}

while IFS= read -r rel; do
  upload_to_s3 "$rel"
  echo "  已上传: $rel"
done <<< "$FILES"

echo "[CDN] ✅ S3 同步完成"
echo ""

# ── 3. CloudFront: 创建缓存失效 ──────────────────────────────

echo "[CDN] 创建 CloudFront 缓存失效 (/*) ..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION" \
  --paths "/*" \
  --query 'Invalidation.Id' --output text)

echo "[CDN] ✅ Invalidation 已创建: $INVALIDATION_ID"
echo ""

echo "========================================="
echo "  全部部署完成"
echo "========================================="
echo ""
echo "验证地址:"
echo "  Nginx 新加坡: http://13.214.180.228/"
echo "  Nginx 东京:   http://18.181.205.38/"
echo "  CloudFront:   https://d3lzu33az2zupu.cloudfront.net/"
