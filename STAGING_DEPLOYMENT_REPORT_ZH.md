# Staging 部署报告

## 当前状态

`STAGING_NOT_EXECUTED_WRANGLER_CLI_NOT_AUTHENTICATED`

本机 Wrangler CLI 未认证，GitHub CLI 不可用；依据所有者“若外部操作耗时则准备材料供手动部署”的指示，本次停止在完整手动交接。没有虚报 `PACKAGE82_STAGING_ACCEPTED_AWAITING_PRODUCTION_DEPLOYMENT_AUTHORIZATION`，因为真实 staging Worker、Turnstile 与 Pages 尚未完成端到端验证。

## 已通过的本地 staging 等价检查

- Wrangler 4.141.0 回环 runtime：PASS，provider 与 Siteverify 均为本地 mock。
- CORS：允许本地指定 origin，拒绝错误 origin。
- Turnstile：成功、缺失、invalid、expired/duplicate、错误 hostname、错误 action 均按预期处理。
- 限流：anonymous session 3/60 秒；独立 global 10/60 秒。
- DeepSeek 故障：invalid JSON、未知字段、429、离线、timeout 均 fail closed；provider 自动重试 0。
- 手动筛选：在 AI 未配置、Turnstile/网络/provider 故障时保持可用。
- 75/75 tests、Web build、PWA、公开仓库静态扫描通过。
- 宽屏和 390×844 CSS viewport 回归通过；宽表只在容器内横向滚动；console warning/error 为 0。
- Browse、Check a Text、Teaching List、word-family detail、CSV/Markdown/Excel 入口、Candidate/Reference 与 PWA 均已回归。

## 尚未执行的真实 staging 项

- 部署 `hkele-ai-filter-staging` 并记录实际 `workers.dev` URL。
- 创建 staging Turnstile widget，hostname 为 `maggie-mai111.github.io`，前端 action 为 `ai_filter`。
- 通过 Cloudflare secret 管理设置 staging 的 `TURNSTILE_SECRET_KEY` 与 `DEEPSEEK_API_KEY`。
- 在真实 Pages origin 复核 Siteverify hostname/action、CORS、重复/过期 token 与分布式限流。
- 复核 Workers Free 用量、DeepSeek 小额余额和自动充值关闭状态。
- 在完成前述项目后，最多执行一次真实 DeepSeek 请求，不得重试；随后验证异常降级和手动筛选回退。

真实 DeepSeek 调用次数：0。实际费用：US$0。production Worker 和 Package82 Pages 均未部署。
