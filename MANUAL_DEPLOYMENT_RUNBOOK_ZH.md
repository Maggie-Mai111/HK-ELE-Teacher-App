# Package82 手动受控部署手册

本手册不包含任何 secret。所有 secret 只在 Cloudflare 安全界面或 Wrangler 交互提示中输入。

## 0. 推送前门槛

1. 阅读 `ACCOUNT_AND_LICENSE_PREFLIGHT_ZH.md`，确认 CPB 书面依据和代码/数据许可处理满足所属机构要求。
2. 确认 DeepSeek 只保留小额余额并关闭自动充值。
3. 确认 Cloudflare 使用 Free plan，不添加 KV、D1、Durable Objects、Queues、R2 或付费服务。
4. 运行 `pnpm install --frozen-lockfile` 和 `pnpm run validate`；再运行 `pnpm run runtime:acceptance`。
5. 先把 Package82 的 manual-only workflow 合并到远端。合并前不要 push 其他内容，因为旧远端 workflow 仍可能自动发布。

## 1. Cloudflare staging

```text
pnpm exec wrangler login
pnpm exec wrangler whoami
pnpm exec wrangler deploy --env staging
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env staging
pnpm exec wrangler secret put DEEPSEEK_API_KEY --env staging
pnpm exec wrangler deploy --env staging
```

首次无 secret 部署必须 fail closed；设置两个 secret 后再部署并记录 deployment/version、实际 Worker URL 和时间。每条 `secret put` 都会出现安全输入提示，值不应出现在终端历史。

在 Cloudflare Turnstile 创建独立 staging widget：允许 hostname 只填 `maggie-mai111.github.io`（不带 scheme、port 或 path）。前端固定 action 为 `ai_filter`；Worker 同时复核 response 的 hostname 和 action。记录公开 site key，secret 只存 Worker。

## 2. GitHub staging Pages

在 repository Settings → Secrets and variables → Actions → Variables 配置：

- `HKELE_STAGING_AI_FILTER_URL`：完整 staging endpoint，必须以 `/api/ai/interpret-filter` 结尾。
- `HKELE_STAGING_TURNSTILE_SITE_KEY`：staging widget 的公开 site key。

打开 Actions → `Deploy HK-ELE Teacher to GitHub Pages` → Run workflow，选择 `staging`。这是唯一允许的首次 Package82 Pages 发布方式。注意 GitHub Pages 只有一个公开站点；选择 staging 会令公开 Pages 暂时连接 staging Worker。

## 3. Staging 验收

逐项记录 HTTP 状态、时间、Cloudflare analytics 和浏览器 console：

1. Pages 首页、manifest、service worker、刷新子路径。
2. 正确 origin 的 OPTIONS/POST 与 CORS；错误 origin 必须 403 且无允许头。
3. Turnstile 成功；缺失、无效、过期、重复 token；错误 hostname/action 均 fail closed。
4. 同一 anonymous session 第 1–3 次允许，第 4 次 429；独立 global 第 11 次在同一分钟内 429。不要为了测试产生不必要的 DeepSeek 请求，可用无效 token 验 global 前置保护。
5. provider 429、offline、timeout、invalid JSON/未知字段时不重试，并显示手动筛选回退。
6. 真实 DeepSeek smoke 最多一次、不得重试；只使用普通筛选句，确认输出是 filters，不是生成词项。
7. 运行 17 条 mock 易用性矩阵，并人工复核至少一条中文和一条英文；检查没有额外条件。
8. 零结果显示 Actual conditions 并可 Undo/修改；不支持请求明确拒绝。
9. 回归 Browse、Check a Text、Teaching List、word detail、CSV/Markdown/Excel、Candidate/Reference、PWA、宽屏、390×844 与 console。

全部通过后才可把状态改为 `PACKAGE82_STAGING_ACCEPTED_AWAITING_PRODUCTION_DEPLOYMENT_AUTHORIZATION`。把实际 URL、真实调用次数、费用和失败证据写回 `STAGING_DEPLOYMENT_REPORT_ZH.md`。

## 4. Production

本任务已有所有者生产授权，但仍必须先完成 staging gate。然后建立独立 production Turnstile widget，并设置 GitHub production variables：

- `HKELE_PRODUCTION_AI_FILTER_URL`
- `HKELE_PRODUCTION_TURNSTILE_SITE_KEY`

交互式设置 production secrets，部署 `hkele-ai-filter`，验证 endpoint 后手动运行 Pages workflow 并选择 `production`。production 最多一次真实 DeepSeek smoke，不得重试。

完成后创建 `PRODUCTION_DEPLOYMENT_REPORT_ZH.md`，记录 Pages/Worker/Actions URL、commit SHA、Cloudflare version ID、Turnstile widget 名称、测试、真实调用次数、实际费用、Free 风险、rollback 目标和所有文件 hash；状态才可改为 `PACKAGE82_WEB_PWA_PUBLIC_DEPLOYMENT_COMPLETE_NATIVE_AI_DEFERRED`。
