# AWS CLI 实际部署结果（Nginx 双区域 + CloudFront CDN）

这份文档记录的是：

- 我已经实际用 **AWS CLI** 创建出来的资源
- 它们分别对应 `delivery-preview-server.js` 里的哪个场景
- 你现在怎么访问、怎么验证
- 最后怎么销毁，避免继续计费

> **状态更新（2026-04-15 16:00 CST）**：所有资源已修复并验证通过。
>
> - Nginx 配置已修复（正则 `{8}` 需要加引号才能被 Nginx 正确解析）
> - 新加坡 / 东京两台 EC2 Nginx 均正常响应
> - CloudFront CDN 正常工作，缓存命中/未命中行为符合预期

---

## 1. 这次实际创建了什么

### Nginx 场景：双区域源站

对应 `delivery-preview-server.js` 里的：

- `nginx` 模式

实际用 AWS 资源模拟为：

- **ap-southeast-1（新加坡）** 1 台 EC2 + Nginx
- **ap-northeast-1（东京）** 1 台 EC2 + Nginx

总计：**2 台 EC2**

这两台机器都部署了同一份静态文件：

- `demo-dist/index.html`
- `demo-dist/css/app.84d7a5c1.css`
- `demo-dist/js/app.12ab34cd.js`
- `demo-dist/images/logo.77aa33ff.svg`

并且已经配置成和你脚本里 `nginx` 模式语义接近的缓存策略：

- HTML：`Cache-Control: no-cache`
- 带 hash 的静态资源：`Cache-Control: public, max-age=31536000, immutable`
- 其他静态资源：`Cache-Control: public, max-age=300`

---

### CDN 场景：S3 源站 + CloudFront

对应 `delivery-preview-server.js` 里的：

- `cdn` 模式

实际用 AWS 资源模拟为：

- **1 个 S3 bucket** 作为源站
- **1 个 CloudFront distribution** 作为 CDN

这比“自己造两台边缘缓存机”更接近 AWS 真实生产方式。

---

## 2. 资源清单

## 项目标识

- **Project**: `delivery-sim-20260415111154-7vp5z8`

这个名字很重要，后面清理资源会用到。

---

## Nginx 双区域 EC2

### 新加坡

- Region: `ap-southeast-1`
- Instance ID: `i-0fbc94f2382670640`
- Public IP: `13.214.180.228`
- 访问地址: `http://13.214.180.228`
- Security Group: `sg-056d793f054de5110`

### 东京

- Region: `ap-northeast-1`
- Instance ID: `i-0ae6bb7c3b0283e61`
- Public IP: `18.181.205.38`
- 访问地址: `http://18.181.205.38`
- Security Group: `sg-0bff1d5bff8a4523e`

---

## CDN 资源

### S3 Bucket

- Bucket Name: `delivery-sim-20260415111154-7vp5z8-cdn-origin`

### CloudFront

- Distribution ID: `E1GWJHGHPG17NW`
- Domain Name: `d3lzu33az2zupu.cloudfront.net`
- 访问地址: `https://d3lzu33az2zupu.cloudfront.net`

---

## 3. 这套资源和你脚本的对应关系

## `nginx` 模式对应

你的脚本里 `nginx` 模式强调的是：

- 源站直接提供静态资源
- HTML 不强缓存
- hash 资源强缓存
- 用响应头体现“nginx-style cache policy”

AWS 上这次对应成：

- 两个 Region 的 EC2
- 每台机跑 Nginx
- Nginx 用静态文件直接响应

也就是：

```text
用户 -> EC2 + Nginx -> 静态文件
```

---

## `cdn` 模式对应

你的脚本里 `cdn` 模式强调的是：

- 边缘缓存命中 / 未命中
- `X-Cache`
- `Age`
- 静态资源更长缓存

AWS 上这次对应成：

- S3 作为源站
- CloudFront 作为边缘分发层

也就是：

```text
用户 -> CloudFront -> S3 源站
```

这个映射比“自己手写 node 内存缓存”更像真实 CDN。

---

## 4. 部署时实际使用的静态文件

使用目录：

```text
/Users/liu/Desktop/simulation-frontend/scenarios/3-serve-files-via-dev-server-node-nginx-cdn/demo-dist
```

部署进去的文件：

```text
index.html
css/app.84d7a5c1.css
js/app.12ab34cd.js
images/logo.77aa33ff.svg
```

---

## 5. 如何验证

> 注意：刚创建后，EC2 的 status checks 和 CloudFront 的部署需要几分钟时间。  
> 如果刚建完立刻访问失败，通常不是配置错，而是资源还在初始化。

---

## 验证 Nginx 双区域

### 访问首页

```bash
curl -I http://13.214.180.228/
curl -I http://18.181.205.38/
```

预期重点看：

- `X-Delivery-Mode: nginx-style-static-server`
- `X-Region: ap-southeast-1` 或 `ap-northeast-1`
- `Cache-Control: no-cache`
- `X-Serve-Reason: nginx-style cache policy`

---

### 访问 hash 静态资源

```bash
curl -I http://13.214.180.228/js/app.12ab34cd.js
curl -I http://18.181.205.38/css/app.84d7a5c1.css
```

预期重点看：

- `Cache-Control: public, max-age=31536000, immutable`
- `X-Delivery-Mode: nginx-style-static-server`
- `X-Region: ...`

---

## 验证 CDN

### 访问首页

```bash
curl -I https://d3lzu33az2zupu.cloudfront.net/
```

### 访问静态资源

```bash
curl -I https://d3lzu33az2zupu.cloudfront.net/js/app.12ab34cd.js
curl -I https://d3lzu33az2zupu.cloudfront.net/css/app.84d7a5c1.css
```

CloudFront 生效后，你可以重点观察：

- `x-cache`
- `age`
- `cache-control`
- 资源第一次请求和后续请求的差异

---

## 实际验证结果（2026-04-15 16:00 CST）

以下是修复后的实际 curl 响应：

### 新加坡 Nginx - 首页

```text
HTTP/1.1 200 OK
Server: nginx/1.28.3
Content-Type: text/html
Cache-Control: no-cache
X-Delivery-Mode: nginx-style-static-server
X-Region: ap-southeast-1
X-Serve-Reason: nginx-style cache policy
```

### 新加坡 Nginx - hash 资源 `/js/app.12ab34cd.js`

```text
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable
X-Delivery-Mode: nginx-style-static-server
X-Region: ap-southeast-1
X-Serve-Reason: nginx-style cache policy
```

### 东京 Nginx - 首页

```text
HTTP/1.1 200 OK
Server: nginx/1.28.3
Content-Type: text/html
Cache-Control: no-cache
X-Delivery-Mode: nginx-style-static-server
X-Region: ap-northeast-1
X-Serve-Reason: nginx-style cache policy
```

### 东京 Nginx - hash 资源 `/css/app.84d7a5c1.css`

```text
HTTP/1.1 200 OK
Content-Type: text/css
Cache-Control: public, max-age=31536000, immutable
X-Delivery-Mode: nginx-style-static-server
X-Region: ap-northeast-1
X-Serve-Reason: nginx-style cache policy
```

### CloudFront CDN - 首页

```text
HTTP/2 200
content-type: text/html; charset=utf-8
cache-control: no-cache
x-cache: RefreshHit from cloudfront
server: AmazonS3
x-amz-cf-pop: NRT57-P6
```

### CloudFront CDN - hash 资源（第一次请求）

```text
HTTP/2 200
content-type: application/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
x-cache: Miss from cloudfront
x-amz-cf-pop: NRT57-P6
```

### CloudFront CDN - hash 资源（第二次请求）

```text
HTTP/2 200
content-type: application/javascript; charset=utf-8
cache-control: public, max-age=31536000, immutable
x-cache: Hit from cloudfront
age: 1
x-amz-cf-pop: NRT57-P6
```

验证结论：三个端点全部正常，缓存策略和自定义头部完全符合 `delivery-preview-server.js` 的设计语义。

---

## 5.5. 首次部署遇到的问题及修复

### 问题

首次部署后，两台 EC2 的 Nginx 无法启动，`curl` 返回 `Empty reply from server`。

### 原因

Nginx 配置里用了正则 `\.[a-f0-9]{8}\.(css|js|...)$`，其中 `{8}` 的左花括号 `{` 被 Nginx 解析器当成了配置块的开始符号，导致语法错误：

```text
nginx: [emerg] unknown directive "8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$"
```

### 修复

在 `location ~*` 指令中给正则加上引号（Nginx 1.7.1+ 支持）：

```nginx
# 修复前（报错）
location ~* \.[a-f0-9]{8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$ {

# 修复后（正常）
location ~* "\.[a-f0-9]{8}\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ttf|otf)$" {
```

### 修复方式

通过 SSM（Systems Manager）远程执行：

1. 创建 IAM Role `SSMRole-DeliverySim` 并挂载 `AmazonSSMManagedInstanceCore` 策略
2. 创建 Instance Profile `SSMProfile-DeliverySim` 并附加到两台 EC2
3. 等待 SSM Agent 注册上线east
4. 通过 `aws ssm send-command` 重写 Nginx 配置、测试语法、重启服务

### 额外创建的 IAM 资源

修复过程中额外创建了以下 IAM 资源（销毁时需要一并清理）：

- **IAM Role**: `SSMRole-DeliverySim`
- **IAM Instance Profile**: `SSMProfile-DeliverySim`
- **附加策略**: `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`

---

## 6. 这次 AWS CLI 创建时的设计选择

## 为什么 Nginx 用两台 EC2

因为你问的是：

- `nginx` 这个场景怎么模拟两个区域节点、几台机器

最直接的答案就是：

- 两个 Region
- 每区一台 Nginx 源站

这样最容易理解，也最贴合“多区域源站”的教学目标。

---

## 为什么 CDN 不用“两台边缘机自己模拟”

因为在 AWS 里，最真实的 CDN 方式不是：

- 你手动维护两个区域缓存节点

而是：

- 用 CloudFront 直接做全球边缘分发

所以这次采取的是：

- S3 + CloudFront

这是更接近真实生产的 AWS 方案。

---

## 7. 成本提醒

这次创建的资源会产生费用：

- 2 台 EC2（按运行时长计费）
- 1 个 S3 bucket（存储 / 请求）
- 1 个 CloudFront distribution（流量 / 请求）

虽然演示规模很小，但**不删除就会继续计费**。

---

## 8. 销毁命令

下面给的是可直接执行的销毁步骤。

> 注意：CloudFront 删除有一个前置要求：必须先 disable，再等状态变成 Deployed，最后才能 delete。

---

## 8.0 清理 IAM Instance Profile 关联（修复时创建的）

先从 EC2 上解除 Instance Profile，再删除 IAM 资源：

```bash
# 查找并解除新加坡 EC2 的 instance profile 关联
SG_ASSOC=$(aws ec2 describe-iam-instance-profile-associations \
  --region ap-southeast-1 \
  --filters Name=instance-id,Values=i-0fbc94f2382670640 \
  --query 'IamInstanceProfileAssociations[0].AssociationId' --output text)
aws ec2 disassociate-iam-instance-profile \
  --region ap-southeast-1 \
  --association-id "$SG_ASSOC"

# 查找并解除东京 EC2 的 instance profile 关联
TK_ASSOC=$(aws ec2 describe-iam-instance-profile-associations \
  --region ap-northeast-1 \
  --filters Name=instance-id,Values=i-0ae6bb7c3b0283e61 \
  --query 'IamInstanceProfileAssociations[0].AssociationId' --output text)
aws ec2 disassociate-iam-instance-profile \
  --region ap-northeast-1 \
  --association-id "$TK_ASSOC"

# 从 instance profile 移除 role
aws iam remove-role-from-instance-profile \
  --instance-profile-name SSMProfile-DeliverySim \
  --role-name SSMRole-DeliverySim

# 删除 instance profile
aws iam delete-instance-profile \
  --instance-profile-name SSMProfile-DeliverySim

# 分离策略并删除 role
aws iam detach-role-policy \
  --role-name SSMRole-DeliverySim \
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

aws iam delete-role --role-name SSMRole-DeliverySim
```

---

## 8.1 终止两台 EC2

```bash
aws ec2 terminate-instances \
  --region ap-southeast-1 \
  --instance-ids i-0fbc94f2382670640

aws ec2 terminate-instances \
  --region ap-northeast-1 \
  --instance-ids i-0ae6bb7c3b0283e61
```

---

## 8.2 删除安全组

等实例彻底 terminated 后再删：

```bash
aws ec2 delete-security-group \
  --region ap-southeast-1 \
  --group-id sg-056d793f054de5110

aws ec2 delete-security-group \
  --region ap-northeast-1 \
  --group-id sg-0bff1d5bff8a4523e
```

---

## 8.3 清空并删除 S3 bucket

```bash
aws s3 rm s3://delivery-sim-20260415111154-7vp5z8-cdn-origin --recursive
aws s3api delete-bucket --bucket delivery-sim-20260415111154-7vp5z8-cdn-origin --region ap-southeast-1
```

---

## 8.4 删除 CloudFront distribution

### 第一步：先拿到 config 和 ETag

```bash
aws cloudfront get-distribution-config --id E1GWJHGHPG17NW
```

你会拿到：

- `ETag`
- `DistributionConfig`

### 第二步：把 `Enabled` 改成 `false`

可以把返回内容保存为文件后修改，比如：

```bash
aws cloudfront get-distribution-config --id E1GWJHGHPG17NW > cf-config.json
```

然后把里面的：

```json
"Enabled": true
```

改成：

```json
"Enabled": false
```

### 第三步：更新 distribution

```bash
aws cloudfront update-distribution \
  --id E1GWJHGHPG17NW \
  --if-match <ETAG> \
  --distribution-config file://distribution-config-disabled.json
```

### 第四步：等待状态回到 `Deployed`

```bash
aws cloudfront get-distribution --id E1GWJHGHPG17NW
```

等 `Status` 变成：

```text
Deployed
```

### 第五步：删除 distribution

```bash
aws cloudfront delete-distribution \
  --id E1GWJHGHPG17NW \
  --if-match <NEW_ETAG>
```

---

## 9. 推荐补充文档方向

如果你后面要把这个场景继续做完整，我建议再补 3 份文档：

1. **Nginx 配置解释**
  - 为什么 HTML 不缓存
  - 为什么 hash 文件长缓存
2. **CloudFront 缓存行为解释**
  - 第一次 MISS、后续 HIT
  - `x-cache` / `age` 怎么看
3. **Route53 多区域入口方案**
  - 双域名直连
  - 单域名延迟路由

---

## 10. 一句话总结

这次已经实际创建出来的 AWS 拓扑是：

- **Nginx 场景**：东京 + 新加坡，各 1 台 EC2
- **CDN 场景**：1 个 S3 源站 + 1 个 CloudFront 分发

这是一个既能跑起来、又比较贴近 AWS 真实结构的最小演示版本。