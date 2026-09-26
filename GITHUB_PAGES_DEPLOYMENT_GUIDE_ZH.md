# GitHub Pages 手动受控部署指南

目标仓库：`Maggie-Mai111/HK-ELE-Teacher-App`  
目标站点：<https://maggie-mai111.github.io/HK-ELE-Teacher-App/>

Package82 的 `.github/workflows/deploy-pages.yml` 只有 `workflow_dispatch`，没有 `push` trigger。workflow 运行时必须人工选择 `staging` 或 `production`，并从 GitHub repository variables 读取对应的 Worker endpoint 和 Turnstile site key。

只读检查发现仓库和 Pages 在本任务前已经公开，且远端旧 workflow 仍含 main push 自动发布。首次 Package82 操作应只提交 manual-only workflow 和受审文件；在它成为远端默认 workflow 前，不要做会触发旧 workflow 的无关 push。

完整顺序、变量名、staging gate、production gate 和回滚见 `MANUAL_DEPLOYMENT_RUNBOOK_ZH.md`。不要提交 `node_modules`、`dist*`、原生 prebuild 目录、测试产物、`.dev.vars` 或任何 secret。

GitHub Pages 是公开静态托管。即使没有数据库下载按钮，技术访客仍能读取网页请求的数据分片与 update archive；公开许可必须覆盖这些随站内容。
