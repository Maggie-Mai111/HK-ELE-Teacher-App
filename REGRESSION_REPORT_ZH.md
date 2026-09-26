# Package82 基线回归（由 Package83 继承的历史证据）

> Package83 当前回归结果为 82/82 PASS；请以 `IMPLEMENTATION_AND_ACCEPTANCE_REPORT_ZH.md` 为准。本文件仅保留前序基线。

## 自动与构建

- format、TypeScript typecheck、ESLint：PASS。
- 自动测试：75/75 PASS；含 17 条教师 AI 易用性用例。
- Web export、PWA validator、public-repository validator：PASS。
- 构建站点：1,208 files，137,726,484 bytes；最大文件 63,125,230 bytes；每文件 <100 MB，总站点 <1 GB。
- PWA 不 precache 完整数据库或 update archive；同源按需读取保持。
- Wrangler 4.141.0 mock-only runtime：PASS；真实 DeepSeek 0、自动 provider retry 0。

## 安全矩阵

- exact route、POST/OPTIONS、CORS、错误 origin：PASS。
- Turnstile success/missing/invalid/expired-or-duplicate/wrong hostname/wrong action：PASS。
- anonymous session 3/60 秒、global 10/60 秒：本地 binding simulation PASS。
- provider invalid JSON、unknown field、429、timeout、offline：PASS，全部零重试并 fail closed。
- staging/production 配置均为 `maggie-mai111.github.io` origin/hostname、`ai_filter` action；未配置环境 fail closed。

## 功能与浏览器

浏览器覆盖 Browse、Check a Text、Teaching List、word-family detail、Candidate/Reference、CSV/Markdown/Excel 入口、PWA。宽屏 1706 CSS px 与移动 390×844 CSS px 均通过；移动宽表只有容器内滚动，页面无横向溢出。console warning/error 为 0。

## 数据与保护

控制量保持 163,784 identities、163,570 ranked、214 unranked、Candidate 3,185、inclusive Reference 3,430、reference-only 245。没有重排、重建数据库或把 Stage 4 sensitivity 用作产品 ranking。Package67/72/77/78/80/81、Revision 5.13 与 principal 研究数据未修改。

## 外部边界

没有 Package82 commit/push、Worker/Pages 部署、secret 操作、真实 DeepSeek、付费服务、APK/IPA 或 Native AI 发布。真实分布式限流和平台端到端行为仍须 staging 验收。
