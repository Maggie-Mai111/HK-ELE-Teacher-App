# Package84 最终教师可用性审计

日期：2026-09-26  
状态：`PACKAGE84_LOCAL_RELEASE_CANDIDATE_ACCEPTED_AWAITING_SINGLE_STAGING_DEPLOYMENT_AUTHORIZATION`

## 结论与固定边界

Package84 以 Package83 为唯一代码基线。复制前已按 Package83 manifest 核验 1,362 个条目，结果为 0 missing、0 size mismatch、0 SHA-256 mismatch；源 manifest 副本 SHA-256 为 `19C1E0CAF4D833A77831BFE2C272EC0BB5EF0CF141E8D38D5FF945E717FA364A`。

principal 数据边界保持不变：163,784 identities、163,570 ranked、214 unranked、Candidate 3,185、inclusive Reference 3,430、reference-only 245。未重新排名、未重选集合、未重建数据库、未改研究数据或 Worker contract。

## 已修复问题

- 主页面各自保留组件、输入、结果、筛选与会话滚动位置；详情从顶部打开，返回恢复来源页面与结果。
- 翻页、筛选、排序、精确搜索、AI 结果和文本结果变更后，焦点与滚动指向新的 live result summary。
- Find words 的普通浏览、精确搜索、AI 筛选成为互斥状态；精确搜索不再继续显示无关的 3,185-family 默认列表。
- 手机首屏先显示简短标题和精确搜索；数据库状态为紧凑条目；AI 默认折叠且保留明显入口。
- AI 确认显示 scope、sort、limit 及全部显式条件；结果分开显示总匹配数与实际显示数。
- `Clear results`、`Edit AI request`、`Adjust manual filters` 使用不同处理路径；编辑保留原输入并聚焦输入框。
- AI 批量加入显示 added、existing、total，并支持 Undo；root `act` 仍为 7 且包含 `age`。
- Web/PWA 主界面不再显示不可用相机/OCR；About 保留简短 native OCR 边界说明。
- Check a text 改为摘要与预教优先；highlighting、complexity、knowledge check、详细状态和逐次 occurrences 默认折叠。
- 重复 occurrences 先按 family/form/status 汇总；完整记录每批 25 条。490-occurrence 真实浏览器用例没有一次渲染全部卡片。
- word-family 详情先显示教师核心信息；证据与 morphology 渐进展开；三层 forms 保留数量并每批 20 条。`act` 的 193 forms 验收通过。
- Teaching list 空状态提供返回 Find words，且不渲染导出操作；删除 family、删除 selected form、AI 批量加入均可 Undo。
- 手机关键文字、输入与触控目标达到所定下限；菜单支持 expanded 状态、Escape 与外部点击关闭。
- PWA precache 现在包括三个 compact Candidate/Reference gzip 与当前 hashed JS；full database 仍绕过 precache；版本指纹驱动旧 cache 清理。

## 保留但重新组织的功能

- DeepSeek → 严格 JSON → 教师确认 → principal 数据确定性筛选的两步语义没有改变。
- Candidate/Reference、full database、身份例外、CPB、HK frequency、自定义范围、预教、知识测试及 readability 语义保持。
- 三层 forms 和登记 morphology 原样使用；没有推断、修复或重写研究证据。
- Teaching list 的 notes、connections、顺序、status、selected forms、Package72 迁移与 CSV/Markdown/Excel 导出保持。
- `hkele-phase1v-columns-v1` 与 `hkele-teaching-list-v2` storage key 保持；课堂文本仍仅存在于当前 React 会话，不写永久存储。
- full database 仍只在线；compact Candidate/Reference 支持 PWA warm offline。

## 尚需所有者决定的真正产品选择

- 何时授权唯一一次 staging Pages 更新，以及使用的本地仓库、branch 与 commit message。
- staging 验收是否另行授权一次真实 provider 请求；当前本地验收全部使用 fixture，实际 DeepSeek 请求为 0。
- 后续是否制作/发布 Android 或 iOS 原生包并启用 native OCR；本任务没有构建 APK/IPA。
- 是否以及何时转向 production。staging 授权不得推定 production、付费额度、云账号或同步功能授权。

## 未执行的外部操作

未 commit、push、部署 Pages、部署/修改 Worker、调用真实 DeepSeek、读取或设置平台 secret、启用付费服务、构建 APK/IPA，也未修改 Package67/72/77/78/80–83 或论文。

## Package83 → Package84 manifest/hash 差异

最终 `TRACKED_FILE_MANIFEST.csv` 排除自身后登记 1,374 个文件。与 `PACKAGE83_SOURCE_TRACKED_FILE_MANIFEST.csv` 逐项比较：12 added、43 changed、0 removed、1,319 unchanged。新增项只包括本任务报告、Package83 manifest 副本、manifest generator、新组件/服务和 Package84 测试；所有 `data/` 文件保持 source-manifest SHA-256，不存在研究数据变更。
