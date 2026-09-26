# HK-ELE Teacher 第三方资料与依赖说明

更新日期：2026-09-26

本文件由 Package77 notice 延续至 Package82，Web/PWA 包版本为 `0.5.0`。它不是法律意见。

## CPB Sight Words

- App 只使用导师要求的 CPB 前 100 项，未扩展到 1,000 项。
- 来源登记名：`CPB Sight Words (1000) Final.xlsx`。
- 来源 SHA-256：`AF89DD46383C3DF1FE7BB9EDD2462DF808081C637CA17FB568D6E27BB6DB1787`。
- App 内数据：`data/releases/2026-09-14-package67-v1/cpb/cpb-sight-words-100.json`，严格为唯一 rank 1–100。
- **权限状态：所有者于 2026-09-26 明确确认本次 Web/PWA 可公开分发 CPB 100。** 仓库中仍未登记
  独立第三方书面许可文书；本项目不声称 CPB 属于公有领域或可自由再分发。若所属机构要求书面
  证据，操作者应在 push 前补存该证据。

## App 直接运行依赖

| 组件                                                       |              版本 | 声明许可证      | 用途                              |
| ---------------------------------------------------------- | ----------------: | --------------- | --------------------------------- |
| Expo / `@expo/metro-runtime`                               | 57.0.24 / 57.0.16 | MIT             | App 运行与打包                    |
| React / React DOM                                          |            19.2.3 | MIT             | UI                                |
| React Native / React Native Web                            |   0.86.3 / 0.21.2 | MIT             | 原生与 Web UI                     |
| AsyncStorage                                               |             2.2.0 | MIT             | 本地持久化                        |
| Expo Asset / Crypto / File System / Image Picker / Sharing |              57.x | MIT             | 资源、哈希、文件、相机/照片与分享 |
| Expo Splash Screen / Status Bar / System UI                |              57.x | MIT             | 原生启动与系统界面                |
| `fflate`                                                   |             0.8.3 | MIT             | 本地 update ZIP 解包              |
| `expo-text-extractor`                                      |             2.0.0 | MIT（包元数据） | Android/iOS 本机 OCR 适配         |

MIT 类组件的版权和许可文本应随最终分发制品整理；本表不能替代完整许可文本。

## OCR / native 特别说明

- `expo-text-extractor@2.0.0` 的 npm 包元数据声明 MIT，仓库字段为
  `https://github.com/pchalupa/expo-text-extractor`。
- 既有依赖包中未提供独立 `LICENSE` 文件。公开分发前必须核对上游完整许可文本、版权归属及
  所需 notice，不能只依赖元数据字段。
- Android 端引用 Google Play Services ML Kit text recognition `19.0.1`，iOS 端使用 Apple
  Vision。最终原生二进制及平台 notices 必须在真实构建后复核。
- App 只把本地图片 URI 交给设备端 OCR adapter，没有实现云端 OCR 上传。此事实不能代替
  真机网络和图片生命周期验证。

## MPL-2.0 组件

锁定依赖树中识别出两个传递依赖：

- `lightningcss@1.33.0` — MPL-2.0
- `lightningcss-win32-x64-msvc@1.33.0` — MPL-2.0

当前项目未修改这两个包的源文件。公开分发前应保留所需版权/许可 notice，并确认最终制品是否
包含这些文件或二进制以及相应 Source Code Form 获取方式。该项仍是人工发布门槛。

## 开发依赖

- TypeScript 6.0.3 声明 Apache-2.0。
- ESLint、Prettier、typescript-eslint 及大多数构建依赖声明 MIT 或其他 permissive / notice-based
  许可证。
- 精确依赖版本以 `pnpm-lock.yaml` 为准；最终公开或原生分发前仍须从干净安装树重新生成并审阅
  完整依赖许可证清单。

## HK-ELE 数据与品牌

- HK-ELE 数据、排名、语料结果、词族归属和品牌资源的权利状态不由软件许可证授予。
- App 图标和启动图使用既有 HK-ELE 品牌标记与颜色 `#0e6550`。
- 本地技术验收不授权 GitHub Pages、应用商店或其他第三方托管。

Package76/Phase 5A 与 Package77 Phase 5B1 的 notices 是继承的历史证据；本文件已按 Package82 Web/PWA 范围更新。Native AI 与原生二进制不在本次公开范围。
