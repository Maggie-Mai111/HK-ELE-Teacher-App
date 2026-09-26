# 公开 URL 与回滚

## 已观察的公开状态

- 仓库：<https://github.com/Maggie-Mai111/HK-ELE-Teacher-App>。2026-09-26 只读 API 显示已是 public；这不是 Package82 创建的。
- Pages：<https://maggie-mai111.github.io/HK-ELE-Teacher-App/>。2026-09-26 返回 HTTP 200；这不是 Package82 首次发布的。
- 观察到的远端 `main`：`e6ec63e3f13b13e6dda46b8ff4e6d43ebcdd55a8`。

Package82 没有 push，也没有运行 Pages workflow。远端当时仍会在 push 到 `main` 后自动发布；Package82 本地 `.github/workflows/deploy-pages.yml` 已改为只允许手动 `workflow_dispatch`，必须先把这项保护推到远端，之后再做受控发布。

## 待取得的 URL

首次真实部署后从 Wrangler 输出或 Cloudflare Dashboard 逐字记录：

- staging endpoint：`https://hkele-ai-filter-staging.<workers-subdomain>.workers.dev/api/ai/interpret-filter`
- production endpoint：`https://hkele-ai-filter.<workers-subdomain>.workers.dev/api/ai/interpret-filter`

不得猜测 `<workers-subdomain>`。完整 endpoint 分别写入 GitHub repository variables `HKELE_STAGING_AI_FILTER_URL` 与 `HKELE_PRODUCTION_AI_FILTER_URL`。Turnstile site key 分别写入相应公开 variable；secret 绝不能进入 GitHub。

## 回滚

GitHub Pages：保留每次发布对应的 commit SHA 和 Actions run URL。若 Package82 发布异常，使用一个新的 revert commit 回退导致异常的变更，再手动运行 Pages workflow；不要改写公开分支历史，也不要使用破坏性 reset。当前已知的发布前参照点为上述 `e6ec63...`，但回滚前必须确认它确为目标版本。

Cloudflare Worker：在 Dashboard 的 Workers & Pages → 对应 Worker → Deployments 选择已验证的前一版本并 Rollback，或在交互式确认后使用 `wrangler rollback --env staging` / `--env production`。Cloudflare 的 rollback 会立即创建新的 deployment 并切换流量；执行前记录目标 version ID。

Turnstile/DeepSeek：回滚代码不会自动回滚 secret 或 widget 配置。若故障涉及 key、hostname 或 action，应先禁用 AI 前端配置或恢复上一 Pages build，再单独轮换/修正平台配置。手动 Browse、Check a Text、Teaching List 与导出不依赖 DeepSeek，应继续可用。
