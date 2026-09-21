# EAS 免费 Android APK 构建指南

## 当前准备状态

- `android-apk` profile 继承 `preview`，输出类型配置为 APK。
- preview、android-apk、production 均配置预计数据 URL 与 update manifest URL，状态为 `EXPECTED_NOT_YET_LIVE`。
- `.easignore` 的本地估算上下文为 87 files / 11,364,739 bytes；保留源码、app/eas 配置、assets、Candidate + Reference 离线数据、OCR 与运行依赖，排除 `public` 完整网页数据库、63 MB 归档、`dist*`、`node_modules`、测试与历史报告。完整网页数据库进入 EAS 上下文的文件数为 0。

## 下一轮最少操作

1. 先部署并实际验证 GitHub Pages 数据 URL；确认分发权限、`org.hkele.teacher` 归属及 Android 签名责任人。
2. 在受控终端登录 Expo/EAS，并把项目关联到所有者账号（首次通常需要 `eas init`；核对其写入的 project ID）。
3. 先执行一次上传上下文检查，再运行 `eas build --platform android --profile android-apk`。免费额度、排队时间和账号条款以执行时 Expo 页面为准。
4. 下载 EAS 生成的 APK，记录 SHA-256、字节数和构建日志；不要把调试签名说成正式生产签名。
5. 在目标 Android 真机验收安装、启动、在线 full、断网 bundled、安装 full、OCR/相机权限、update/rollback、中断/空间不足、导出分享、TalkBack 与隐私说明。

本轮没有登录 Expo、没有建立远端 EAS project、没有上传构建上下文、没有执行 cloud build，也没有生成 APK。
