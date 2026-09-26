# 免费与低成本部署计划（Package82 手动交接，未部署）

## 免费层适配结论

- GitHub Pages：适合托管本项目的静态 Web/PWA。官方限制为发布站点不超过 1 GB、建议仓库不超过 1 GB、每月 100 GB soft bandwidth、每小时 10 次 build soft limit；单个 Git 对象 100 MB 为强制上限。Package82 构建为 1,208 files / 137,726,484 bytes，最大文件 63,125,230 bytes。
- Cloudflare Workers Free：当前官方 Free 限制包括每日 100,000 次请求、每次 HTTP 请求 10 ms CPU、128 MB memory、每次请求 50 次 subrequest；本 Worker 无数据库和持久状态，单次最多 Siteverify + DeepSeek 两个外部 subrequest，架构适配。CPU/实际延迟仍须 staging 观测。
- Cloudflare Turnstile Free：官方 Free 计划为 unlimited challenges、最多 20 widgets、每 widget 最多 10 hostnames；单一 Pages 域名 + workers.dev staging/prod 设计适配。
- 地址：使用免费 `github.io` 与 `workers.dev`；不购买域名，不启用任何付费 Cloudflare 服务。
- PWA：service worker 只缓存 shell/小型静态资源，不预缓存完整数据库，避免首次安装把全部数据塞进缓存。

## DeepSeek 保守成本估算

按 2026-09-26 官方 `deepseek-flash` 价格，采用最坏每次 800 个 uncached input tokens + 上限 384 output tokens：

| 请求数 | peak 保守估算 | off-peak 参考估算 |
| -----: | ------------: | ----------------: |
|  1,000 |     US$0.7008 |         US$0.3504 |
| 10,000 |      US$7.008 |          US$3.504 |

公式（peak）：`800 × $0.30/M + 384 × $1.20/M = $0.0007008/次`。这是上限配置下的估算，不是账单承诺；实际输入/输出长度、缓存命中、时段和供应商价格变更都会影响费用。来源：<https://api-docs.deepseek.com/quick_start/pricing/>。

## 成本控制

1. DeepSeek 只充小额余额，关闭自动充值；余额耗尽时 AI 明确降级，手动筛选继续可用。
2. 生产 session/global 限额由所有者批准后写入环境配置；先用保守值，再依据 staging 的匿名聚合计数调整。
3. 固定 `deepseek-flash`、禁用 thinking、384 output tokens、无 provider 自动重试。
4. Turnstile、全局 limiter、session limiter 均在 provider 调用之前，恶意或重复请求不应触发 DeepSeek。
5. 不引入 KV/D1/Durable Objects。若所有者要求严格日/月硬预算，应在未来单独决定可持久计数方案；Package82 不把近似限流虚报成财务硬上限。

## 官方限制来源（核对日：2026-09-26）

- GitHub Pages limits：<https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits>
- GitHub repository limits：<https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits>
- GitHub Pages quickstart：<https://docs.github.com/en/pages/quickstart>
- Workers limits：<https://developers.cloudflare.com/workers/platform/limits/>
- Turnstile plans：<https://developers.cloudflare.com/turnstile/plans/>

本计划没有购买、升级、部署、设置生产 secret 或调用真实 DeepSeek。目标远程仓库与 Pages 在本任务前已经存在并公开。
