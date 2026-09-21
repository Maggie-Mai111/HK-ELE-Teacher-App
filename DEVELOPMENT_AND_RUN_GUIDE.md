# HK-ELE Teacher 开发、验证与运行说明

本公开仓库继承已验收的 Package77 Phase 5B1 实现。当前应用版本为 `0.3.0`，Android
`versionCode` 为 `3`，iOS `buildNumber` 为 `3`。

Package76/Phase 5A 的 0.2.0 与 build number 2 记录只属于未纳入本仓库的历史验收证据，不能
代表当前产品。

## 环境

- Node.js 22.13 或以上。
- pnpm 10.15.1；GitHub Actions 使用同一主版本和冻结 lockfile。
- Android 原生编译另需兼容 JDK、Android SDK/API 36、adb 及目标设备。
- iOS 原生编译另需 macOS、Xcode 及目标设备或模拟器。

## 从干净检出开始

```powershell
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run build:web
pnpm run validate:pwa
```

`validate:pwa` 检查 `/HK-ELE-Teacher-App/` start URL/scope、manifest、品牌图标、service worker、刷新回退、
站点和单文件大小、原始 SQLite 排除及更新归档哈希。它只缓存 app shell，不把完整数据库、
全部数据分片或批量更新归档加入预缓存。

## 本地运行和 `/HK-ELE-Teacher-App/` 验收

开发服务器：

```powershell
pnpm run web
```

生产导出和子路径模拟：

```powershell
pnpm run build:web
pnpm run serve:subpath
```

浏览器访问 `http://127.0.0.1:19078/HK-ELE-Teacher-App/`。至少检查首页资源、Browse、Full database、搜索、
词项详情、Check a Text、Teaching List/导出、刷新回退、PWA manifest、service worker 和 console。

## Web 与 native 数据边界

- Web export 使用 `public/`，按需提供完整静态数据库和更新归档。
- Android/iOS bundle 使用 Metro 实际引用的 Candidate + Reference 离线资产，不应把
  `public/hkele-data` 纳入原生构建上下文。
- `bundled-reference` 表示内置 3,430 项；`remote-full` 表示在线查询 163,784 项；
  `installed-full` 表示已经下载并经哈希验证的完整离线数据库。
- 完整数据库查询失败不等于真正 unmatched；范围外词保持待重新检查。

## 构建时配置

教师界面没有技术 URL 输入框。preview、android-apk 与 production profiles 使用：

- `EXPO_PUBLIC_HKELE_DATA_URL=https://maggie-mai111.github.io/HK-ELE-Teacher-App/hkele-data`
- `EXPO_PUBLIC_HKELE_UPDATE_MANIFEST_URL=https://maggie-mai111.github.io/HK-ELE-Teacher-App/hkele-data/update-manifest.json`
- `EXPO_PUBLIC_HKELE_ENDPOINT_STATUS=EXPECTED_NOT_YET_LIVE`

上述地址在真正部署和线上验收前不能标记为已验证。

旧仓库 `Maggie-Mai111/HK-ELE` 与旧网站 `https://maggie-mai111.github.io/HK-ELE/` 保持不变，
不得作为新 App 的部署目标。

## 原生边界

Hermes/Metro export、Expo prebuild 或 EAS build success 都不能代替 OCR、权限、离线更新、
rollback、导出分享和可访问性的目标真机验收。公开仓库不包含 keystore、签名密码、账号凭据
或生成后的 `android/`、`ios/` 目录。
