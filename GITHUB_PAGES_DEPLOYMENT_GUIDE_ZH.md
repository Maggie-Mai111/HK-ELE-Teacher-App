# GitHub Pages 免费部署操作指南

目标仓库：`Maggie-Mai111/HK-ELE-Teacher-App`  
目标站点：`https://maggie-mai111.github.io/HK-ELE-Teacher-App/`

旧仓库 `Maggie-Mai111/HK-ELE` 和旧网站 `https://maggie-mai111.github.io/HK-ELE/` 必须保持
不变，不作为新 App 的部署目标。

## 本包已经准备的内容

- `app.json` 使用 Expo `experiments.baseUrl=/HK-ELE-Teacher-App`；生成的 JS、favicon、manifest、service worker 与数据路径均位于 `/HK-ELE-Teacher-App/`。
- `.github/workflows/deploy-pages.yml` 在 Ubuntu 上锁定安装依赖，执行 typecheck、lint、全部测试、Web export 和 PWA validation，再通过 Pages artifact 部署 `dist`。
- `dist/404.html` 与 `index.html` 相同，用于静态托管刷新回退；`.nojekyll` 避免 `_expo` 被 Jekyll 处理。
- clean-checkout 验收会重新记录最终站点文件数与总字节数；验证脚本会在站点达到 1 GB 或任一文件达到 100 MB 时失败。更新归档为 63,125,230 bytes，SHA-256 为 `CB767B54582C8D37716BDE18FCD88768440715B7BCA03497532A13FAF1F12951`。
- 发布目录内没有原始 SQLite，也没有数据库下载按钮。

## 下一轮最少发布步骤

1. 项目所有者先确认 CPB、HK-ELE 数据/品牌及第三方 notices 的公开分发范围。
2. 登录 GitHub，确认或创建 `Maggie-Mai111/HK-ELE-Teacher-App`，用本项目的 `public-repository` 内容作为仓库根内容提交；不要提交 `node_modules`、`dist*`、原生 prebuild 目录或本地测试产物。
3. 推送 `main`。在仓库 Settings → Pages 中选择 GitHub Actions 作为 Source；如组织策略需要，允许该 workflow 的 Pages 权限。
4. 运行/等待 `Deploy HK-ELE Teacher to GitHub Pages`，确认 build 与 deploy jobs 均通过。
5. 实际打开正式 URL，复验首页、Browse full、search/detail、Check a Text、Teaching List/下载、刷新、manifest/service worker 与 console；再把 `EXPECTED_NOT_YET_LIVE` 改为已验证状态。

本轮未执行以上登录、push、远端设置或部署。GitHub Pages 为公开静态托管；即使没有数据库下载按钮，技术访客也能读取页面请求的数据分片和更新归档。
