# 安全与 secret 验证

## 已验证

- 没有显示、读取或复制密码、API key、平台 token、认证文件或 `.dev.vars` 内容。
- Package82 没有实际 `.dev.vars`；只有 `worker/.dev.vars.example` 的 mock-only 占位值。
- GitHub Pages 只接收公开的 Worker endpoint 和 Turnstile site key；它们作为 GitHub repository variables，不是 secrets。
- `TURNSTILE_SECRET_KEY` 与 `DEEPSEEK_API_KEY` 只能进入 Cloudflare Worker 的 encrypted secrets。
- Worker 强制精确 route、POST/OPTIONS、origin、Siteverify success、hostname 和 action；production/staging origin 不使用 `*`。
- 请求 schema、模型输出 schema 和长度严格 allowlist；发送给 DeepSeek 的只有短筛选请求和固定 system prompt，不含 HK-ELE 数据、课堂文本、OCR 图片、Teaching List、notes 或学生数据。
- provider 设置为 `deepseek-flash`、thinking disabled、JSON output、384 tokens、零自动重试。
- public-repository 扫描检查环境文件、私钥/证书文件名、常见 secret 模式、本地绝对路径和用户名。

## 手动 secret 输入规则

必须由所有者在 Cloudflare Dashboard 的 Worker Settings/Variables，或在本机交互式运行以下命令后输入；不要把值写在命令行参数、聊天、文档、GitHub variable、截图或日志中：

```text
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY --env staging
pnpm exec wrangler secret put DEEPSEEK_API_KEY --env staging
```

production 仅在 staging 验收后使用相同命令并把环境改为 `production`。官方说明 `wrangler secret put` 会创建并部署新版本，因此每次操作后必须检查目标 environment 和 deployment 记录。

## 轮换与异常

怀疑泄露时，先在 Turnstile/DeepSeek 平台轮换或撤销，重新设置 Worker secret，再检查 analytics；不要把旧值写入事故报告。AI 不可用时前端应显示手动筛选回退，不得绕过 Turnstile 或放宽 CORS。
