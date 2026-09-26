# Package84 单次 staging Pages 更新说明（尚未授权执行）

当前状态：`PACKAGE84_LOCAL_RELEASE_CANDIDATE_ACCEPTED_AWAITING_SINGLE_STAGING_DEPLOYMENT_AUTHORIZATION`。本文件只是操作手册，不授予 commit、push、workflow、provider 或任何 production 权限。

## 复用项

- staging Worker URL：`https://hkele-ai-filter-staging.hkele-teacher-webapp.workers.dev`
- Package83 记录的 staging Worker Version ID：`922fa729-7c15-4924-ae6a-1b37c169cd48`
- Package84 没有改变 Worker request/response、CORS、Turnstile action 或严格 JSON contract。
- 数据库/API/Worker 不需重新发布；只更新 Pages Web/PWA 资产。

## 必须另行明确授权

1. 把 Package84 的 tracked files 同步到指定本地 GitHub 仓库并创建 commit。
2. push 指定 commit/branch 到 `Maggie-Mai111/HK-ELE-Teacher-App`。
3. 手动 dispatch 一次 staging Pages workflow，复用上述 Worker URL 与已有 staging Turnstile 配置。
4. 如需真实 provider smoke test，另行授权一次 DeepSeek 请求及可能费用；否则继续使用 fixture/mock。

production、Worker 部署、secret 读取/设置、付费服务、APK/IPA 和 native OCR 发布均不包含在上述授权中。

## 获授权后的唯一建议顺序

1. 核验 `TRACKED_FILE_MANIFEST.csv`、目标仓库、branch 与工作树。
2. 同步 tracked files，排除 `node_modules`、`.expo`、`.test-dist`、`dist*`、`reports`、`.dev.vars` 与 secret/token/key。
3. 在目标仓库重跑 format、typecheck、lint、93 tests、Web build、PWA validation、public repository validation。
4. 复核 diff 和 data hashes，只允许 Package84 前端、测试、PWA 与文档变更。
5. 取得 commit/push 授权后才提交与推送；取得 workflow 授权后才 dispatch staging Pages。
6. staging 验收：新用户/迁移、browse/search/manual/AI、root `act`=7 含 `age`、短文/490 occurrences、193 forms、Teaching list/exports、mobile/landscape/keyboard、online/offline/cache upgrade、console 0/0。
7. 记录 commit、workflow run、Pages artifact/hash、URL、Worker URL 与结果。失败时停止并回到更新前已知 commit；不得自动转 production。

## 明确禁止

不要部署 Package83；不要为了本次 UI/PWA 修复重新部署 Worker；不要提交 `.dev.vars` 或任何 secret；不要自动调用真实 DeepSeek；不要更新 production；不要构建 APK/IPA。
