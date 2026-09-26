# HK-ELE Teacher 隐私说明

版本：2026-09-26（Package82 Web/PWA 受控部署版）

## 可选 AI 筛选助手

AI 助手只把教师在该输入框内键入的短筛选请求发送至独立 Cloudflare Worker，再由 Worker
调用 DeepSeek。课堂全文、OCR 图片、学生资料、Teaching List、笔记以及 HK-ELE 数据行均不
发送。DeepSeek 只解释为受控 JSON 条件；教师确认后，本地程序才以 principal 数据确定性筛选。

Web/PWA 每次 AI 请求还会把一个新的 Turnstile token 与随机生成、无个人信息的本地 UUID
session ID 交给 Worker，用于反滥用验证和限流；它们不属于登录或用户身份。Worker 不把 token
或 session ID 转发给 DeepSeek。`DEEPSEEK_API_KEY` 和 Turnstile secret 只允许在获授权部署时
作为 Worker Secret 设置，不得进入客户端、版本库、日志或报告；Package82 的本地 runtime 只
使用 mock 值。AI/Turnstile/网络失败时只显示安全错误并保留手动筛选。

## GitHub Pages 网页数据公开边界

拟用的 GitHub Pages 是公开静态托管。网页完整数据库会按需读取公开数据分片；虽然界面不提供“下载数据库”按钮，具备技术能力的访客仍可查看或读取网页运行所需的数据分片和更新归档。公开部署前必须由项目所有者确认 HK-ELE 数据、CPB、品牌及相关第三方材料的公开分发权限。

PWA 只缓存应用壳层与使用时请求到的普通界面资源，不预缓存完整数据库、全部数据分片或 63 MB 更新归档。网页支持在线完整数据库查询，但不声称具有原生 OCR；网页端只保留粘贴和手动编辑文本。

## 核心原则

HK-ELE Teacher 默认在设备内处理教师输入。App 本身不建立用户账户，不包含广告或分析 SDK，
不会把课堂原文、拍摄图片、Teaching List 笔记或 Test Word Knowledge 答案上传给开发者或
第三方服务器。

## 相机、照片与 OCR

- 只有教师主动点击“Take photo”或“Choose image”时，App 才请求相机或照片权限。
- 所选图片只交给设备端 OCR adapter。Android 实现使用 Google ML Kit（Google Play
  Services 组件），iOS 实现使用 Apple Vision。
- App 不把原始图片上传到自建服务器或云端 OCR 服务，也不把图片复制到 HK-ELE 数据目录。
- OCR 输出只是可编辑文字，不会自动选择词族。教师必须确认“使用”或“追加”后，文字才进入
  与手动粘贴完全相同的分析流程。
- 取消、拒绝权限或丢弃 OCR 结果都不会更改已有文字。

Android OCR 依赖设备的 Google Play Services 状态；平台供应商如何维护系统组件受设备及其
系统隐私设置约束。发布前仍须在目标 Android 设备上复核此行为。

## 本地保存

- Teaching List、状态、顺序、notes 与 connections 保存在 App 的本地存储中。
- 导出的 CSV、Markdown 或 Excel 只在教师主动执行导出/分享时生成，并由系统分享界面决定
  后续去向。
- 数据更新保存在 App 私有文档目录的 `active`、`previous` 和 `staging` 目录中。

## 联网行为

- Web 版按需请求 HK-ELE 静态数据分片。
- Native 版只有在教师主动检查或安装数据更新时才请求 manifest 与一个经 SHA-256
  校验的批量归档。归档解包后仍逐项复核内部 manifest，全部通过才原子切换。
- 更新请求只包含目标 URL 与普通网络元数据，不包含课堂文字、图片、笔记或学生答案。
- 更新 manifest 必须使用 HTTPS；仅为本机开发测试允许 loopback HTTP。
- Web 的 `remote-full` 模式会按需请求与查询首字母相应的公开静态搜索分片，并按需读取词项
  详情分片。请求包含 URL 和普通网络元数据；App 不上传课堂原文、完整 Check a Text 内容、
  Teaching List 笔记或 Word Knowledge 答案。

## 删除与控制

教师可在 App 内删除 Teaching List 项目或清空列表，并可在系统设置中撤销相机/照片权限。
卸载 App 通常会删除其私有本地数据；最终行为由 Android/iOS 系统及设备备份设置决定。

## 已知验证边界

Package82 在 Windows 上完成 Web/PWA 本地加固、静态检查、单元测试、Wrangler mock runtime
与 Web 浏览器回归；没有部署或生成 APK/IPA，也没有 Android/iOS 真机验证。Native AI 仍为
`NATIVE_AI_TRANSPORT_SECURITY_DECISION_PENDING`，不得从 Web/PWA 通过推断 Native AI 已通过。
