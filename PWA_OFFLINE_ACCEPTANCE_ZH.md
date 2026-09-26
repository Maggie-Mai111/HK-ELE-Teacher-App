# Package84 PWA 与离线验收

日期：2026-09-26  
结论：PASS。

## 缓存设计

最终 service worker 的版本由当前 hashed JS 与三个 compact gzip URL 共同生成 `package84-<fingerprint>`。app shell 包含入口、manifest、图标、hashed JS 及：

- `families.json.*.gz`
- `forms.json.*.gz`
- `search-routes.json.*.gz`

`/hkele-data/` full-database shards 和 63,125,230-byte 更新 archive 不在 precache，full database 请求继续在线直通。activate 只删除同一 HK-ELE cache prefix 的旧版本，不影响其他站点 cache。

## 实际浏览器验证

1. 首次在线：入口、hashed JS、manifest、图标和三个 compact gzip 全部由本地服务器实际请求成功。
2. 安装后在线：第二次加载由 service worker 控制，online full database 正常。
3. warm offline：停止服务器后 reload 成功；状态切换为 Built-in Candidate + Reference，3,185-family browse 可用。
4. compact 离线：`agency` 离线解析为 `age`；Teaching list 和 selected form 保留。
5. full database 离线：`zyzzyva` 返回 Full database check unavailable，而不是伪造 unmatched。
6. AI 离线：显示 AI offline/not configured 与 `Use manual filters`；精确搜索和手动筛选仍可用。
7. 离线重开：在服务器停止后新开同 origin 标签页仍能加载；Teaching list 仍保留。
8. cache upgrade：在同一 local origin 先加载正式 bundle，再提供具有不同 hashed JS/cache fingerprint 的 fixture bundle；两次 reload 后新 AI fixture UI 生效。随后恢复正式 bundle并两次 reload，未长期停留在旧 JS/UI。

## 静态验证

`validate_pwa.mjs` 对 manifest id/start_url/scope、standalone、theme color、192/512 icons、subpath、404 fallback、viewport/safe-area、compact precache、hashed JS、cache fingerprint、scoped cleanup、full-data exclusion/bypass 全部返回 true。

最终站点共 1,208 个文件、137,748,400 bytes；最大文件 63,125,230 bytes；0 raw SQLite；所有文件 <100 MB，站点 <1 GB。
