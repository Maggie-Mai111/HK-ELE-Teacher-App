# Package82 Web/PWA 安全架构

## 边界

Package82 只部署 Web/PWA，保持：`GitHub Pages 静态 Web/PWA → Cloudflare Worker → DeepSeek`。静态端以 Package67 的 principal 数据生成 Candidate 3,185 与 inclusive Reference 3,430；数据库总身份 163,784、已排名 163,570、未排名 214、reference-only 245 均不变。Stage 4 proper-name-adjusted ranking 仍只属 sensitivity。

不引入 SQLite 服务器、在线数据库、账号系统、KV、D1、Durable Objects、R2 或 Queue。Native AI 固定延期；原有 Native 非 AI 模块保留，但 Package82 不伪造 Origin、不在 WebView 植入 Turnstile，也不声称 Native AI 已通过。

## 请求链与 fail-closed 顺序

1. Web/PWA 为每次 AI 请求取得一个新的 Turnstile token，并使用浏览器本地生成的 UUID v4 匿名 session ID。该 ID 不含个人信息，不是登录或身份认证。
2. Worker 先做严格路由、方法、Content-Type、请求字段、环境和 exact-origin 检查；未配置环境、通配 CORS、生产 HTTP、错误 hostname/action 均拒绝。
3. 独立全局 limiter 先保护 Worker；随后 Worker 调用 Turnstile Siteverify。缺失、无效、过期、重复 token，以及 hostname/action 不匹配均 fail closed。
4. Turnstile 通过后才检查匿名 session limiter；两级限额均由 Wrangler 环境配置集中声明。
5. Worker 只把短自然语言筛选条件发送给 DeepSeek，不发送 HK-ELE 数据、数据库行、词项、课堂全文、OCR 图片、学生资料、Teaching List 或 notes。
6. Provider 固定 `deepseek-flash`、`thinking: {"type":"disabled"}`、JSON Output、`max_tokens: 384`，没有自动重试。Worker 再以严格 allowlist 校验响应；非法 JSON、未知字段、越界值均拒绝。
7. 客户端只在用户确认后以本地 principal 数据确定性执行筛选。任何 AI/Turnstile/网络错误都不影响 Browse、Check a Text、detail、Teaching List、selected forms 和导出。

## Turnstile

服务端验证是强制项；客户端 widget 成功本身不构成接受。token 在每次尝试（成功或失败）后即被清除并重置，官方说明的 300 秒有效期和单次使用语义由 Siteverify 执行。Worker 另核对预期 hostname 与 action `ai_filter`。

本地验收只使用官方测试 sitekey `1x00000000000000000000AA` 与回环 mock Siteverify；不保存、不读取生产 secret。正式 widget 和 secret 必须等所有者授权后的部署任务配置。

## 隐私与日志

- 请求体只允许 `query`、`anonymousSessionId`、`turnstileToken` 三个字段；query 长度上限 300。
- Provider 只收到 query；session ID 与 Turnstile token 不转发。
- 不记录 raw prompt、token、secret、Authorization header 或 provider 原始响应；错误只返回固定类别与 request ID。
- CORS 分 local/staging/production；production 必须是一个明确 HTTPS origin，绝不使用 `*`。
- PWA service worker 不预缓存完整数据库；数据库资源仍从同源静态文件按需加载。

## 限流语义与已知边界

local/staging/production 均为每 session 每分钟 3 次、独立全局每分钟 10 次。Cloudflare Rate Limiting binding 能在本地模拟，但生产是分布式、最终一致的保护，不等同于精确全局财务账本。因此硬性日/月预算若要绝对准确会需要持久状态服务；本阶段按要求不新增该类服务，DeepSeek 只保留小额余额并关闭自动充值。

## 依据

- Cloudflare Turnstile server-side validation：<https://developers.cloudflare.com/turnstile/get-started/server-side-validation/>
- Cloudflare Turnstile testing：<https://developers.cloudflare.com/turnstile/troubleshooting/testing/>
- Cloudflare Rate Limiting binding：<https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/>
- 本地 binding 支持：<https://developers.cloudflare.com/workers/local-development/bindings-per-env/>
