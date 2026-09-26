# Package85 单次 staging Pages 更新说明（尚未授权执行）

当前状态：`PACKAGE85_LOCAL_SUPERVISOR_FEATURE_USABILITY_ACCEPTED_AWAITING_SINGLE_STAGING_UPDATE_AUTHORIZATION`。本文件只是待授权操作手册，不授予同步、commit、push、workflow、provider 或 production 权限。

## 更新范围

- 仅把 Package85 的 Web/PWA tracked files 同步到指定本地 GitHub 仓库，再触发一次 staging Pages 更新。
- 复用 staging Worker URL：`https://hkele-ai-filter-staging.hkele-teacher-webapp.workers.dev`。
- 复用 Package84 登记的 staging Worker Version ID：`922fa729-7c15-4924-ae6a-1b37c169cd48`。
- Package85 没有改变数据库、API、Worker request/response、CORS、Turnstile action 或严格 JSON contract，因此数据库、API 和 Worker 均不需更新。

## 授权前本地核验

在 Package85 目录使用锁定依赖完成：

1. format check；
2. typecheck；
3. lint；
4. 104 项自动测试；
5. Web build；
6. PWA validation；
7. public repository validation；
8. `TRACKED_FILE_MANIFEST.csv` 自核和 Package84 data hash 零变化确认。

任何失败都应停止 staging 更新，不得用重新生成 principal 数据、修改 Worker 或跳过校验来规避。

## 必须另行明确授权的一次性步骤

1. 依据 `TRACKED_FILE_MANIFEST.csv` 把 Package85 tracked files 同步到用户指定的本地 GitHub 仓库；不要复制 `node_modules`、`.expo`、`.test-dist`、`dist` 或本地临时文件。
2. 查看同步 diff，确认只含 Package85 登记变更、无 secret、无本机绝对路径、无 principal 数据漂移。
3. 创建一个明确指向 Package85 的 commit。
4. push 指定 commit/branch 到 `Maggie-Mai111/HK-ELE-Teacher-App`。
5. 手动 dispatch 一次 staging Pages workflow，继续使用上述 Worker URL 与已有 staging Turnstile 配置。
6. 在 staging URL 重跑桌面与 390×844 核心路径、console、PWA 和 Knowledge/Preteach 验收。

上述同步、commit、push 和 workflow 必须由项目所有者另行明确授权；本任务没有执行。

## 真实 AI 的独立授权边界

当前功能、构建和测试只使用 mock/fixture，真实 DeepSeek 请求为 0。若 staging 后确需 provider smoke test，必须再单独授权一次真实 DeepSeek 请求及其潜在费用；该授权不得从 Pages 更新授权推定。

## 明确排除

- 不部署或修改 staging/production Worker；
- 不进入 production Pages；
- 不读取、设置或轮换 secret；
- 不启用付费服务；
- 不构建 APK/IPA；
- 不创建账号、学生身份、云端知识检查存储或个人资料；
- 不修改 Package67/72/77/78/80–84、论文或 principal 数据。

回滚时使用 staging Pages 的上一成功 artifact/commit；Worker 无变更，因此无需 Worker 回滚。
