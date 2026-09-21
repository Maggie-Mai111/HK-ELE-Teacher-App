# Android / iPhone 构建与安装说明

本公开仓库继承 Package77 Phase 5B1。当前应用版本为 `0.3.0`，Android `versionCode` 为 `3`，
iOS `buildNumber` 为 `3`。本说明不表示已经生成 APK/IPA、完成云构建或通过真机验收。

## Android 本机调试 APK

1. 安装兼容的 JDK、Android Studio/Android SDK API 36 与 adb。
2. 在仓库根目录运行开发指南中的干净安装和全部验收命令。
3. 运行 `pnpm run prebuild:android`。
4. 运行 `android\gradlew.bat assembleDebug`。
5. 调试 APK 通常位于 `android\app\build\outputs\apk\debug\app-debug.apk`。
6. 在获准的目标设备安装，并记录 APK SHA-256、大小、设备型号、OS 和测试结果。

调试 APK 使用调试签名，只适合受控测试。正式签名必须使用项目所有者控制的独立 keystore；
不得把 keystore、签名密码或恢复资料提交到仓库。

## Expo EAS Android APK

`eas.json` 的 `android-apk` profile 输出 APK。EAS 构建会把 `.easignore` 未排除的源码、配置、
assets、运行依赖和内置 Candidate + Reference 数据上传到 Expo。必须先确认账号归属、上传范围、
分发权限及签名责任，再登录并执行：

```powershell
eas build --platform android --profile android-apk
```

构建完成后还要下载 APK、记录哈希与日志，并在目标 Android 设备验证启动、online full、断网
bundled、installed full、OCR/权限、数据更新与 rollback、导出分享、TalkBack 和隐私说明。

## iPhone / TestFlight

iOS 构建需要 macOS/Xcode 或经明确授权的 EAS iOS cloud build，以及相应 Apple 账号与签名。
TestFlight/App Store 会向 Apple 上传签名 build 和商店/隐私资料。最终需要在真实 iPhone 验证
OCR、照片/相机权限、离线模式、更新/rollback、VoiceOver 和分享。

## 外部构建前必须确认

- 正式 HTTPS full-data/update URL 已部署并验证；
- `org.hkele.teacher` 在 Expo、Apple 和 Google 账号中的归属；
- CPB、HK-ELE 数据及品牌的公开分发权限；
- MPL-2.0、OCR 及最终二进制 notices；
- 允许上传到哪一家服务、上传范围、预算和账号负责人。

Package76/Phase 5A 的 0.2.0、versionCode 2 和 buildNumber 2 仅为继承的历史证据，不是本仓库
当前配置。
