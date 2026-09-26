# 部署前所有者决定（Package82 登记）

所有者已于 2026-09-26 确认 GitHub 与 Cloudflare 已登录，并明确授权 Web/PWA staging、production 与公开分发。以下默认决定已经确定：

1. 仓库 `Maggie-Mai111/HK-ELE-Teacher-App`，Pages base path `/HK-ELE-Teacher-App`，不使用自定义域名。
2. staging/production Worker 分别为 `hkele-ai-filter-staging` / `hkele-ai-filter`。
3. Turnstile hostname/action 为 `maggie-mai111.github.io` / `ai_filter`，staging 与 production 使用独立 widget。
4. anonymous session 3 次/分钟、独立 global 10 次/分钟；Cloudflare Free、GitHub Pages 免费。
5. DeepSeek 只保留小额余额并关闭自动充值；staging 与 production 各最多一次真实 smoke，不重试。
6. 只发布 Web/PWA；Native AI 延期。
7. 所有者确认 HK-ELE、CPB、品牌和随站内容可公开分发；独立 CPB 书面文书及仓库许可证文件仍未在本包登记，详见 `ACCOUNT_AND_LICENSE_PREFLIGHT_ZH.md`。

外部执行仍必须遵循 staging-first gate。由于本机 Wrangler CLI 未登录且 GitHub CLI 不可用，当前停在 `STAGING_NOT_EXECUTED_WRANGLER_CLI_NOT_AUTHENTICATED`，由所有者依 `MANUAL_DEPLOYMENT_RUNBOOK_ZH.md` 手动继续。
