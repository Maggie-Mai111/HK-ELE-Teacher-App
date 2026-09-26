# Package84 实施与验收报告

日期：2026-09-26  
最终状态：`PACKAGE84_LOCAL_RELEASE_CANDIDATE_ACCEPTED_AWAITING_SINGLE_STAGING_DEPLOYMENT_AUTHORIZATION`

## 基线、数据与保护范围

Package83 是唯一代码基线。其 1,362-entry manifest 在复制前逐项通过 path、bytes、SHA-256 核验；源 manifest 副本 SHA-256 为 `19C1E0CAF4D833A77831BFE2C272EC0BB5EF0CF141E8D38D5FF945E717FA364A`。

principal 数量未变：163,784 identities；163,570 ranked；214 unranked；Candidate 3,185；inclusive Reference 3,430；reference-only 245。所有 data 文件与 Package83 source manifest 相同。Package67/72/77/78/80–83、论文、数据库及既有 Worker contract 均未修改。

## 实施结果

- App 主页面常驻挂载，独立保存 session state 与 scroll；详情 top/return 行为确定。
- Find words 使用 browse/search/AI 单一互斥状态，精确搜索、手动筛选、AI 切换行为固定。
- AI 默认紧凑折叠；全部确认条件与 matched/shown 数明确；Clear/Edit/Manual 三操作分离；批量加入可 Undo。
- Check a text 为输入/摘要/预教优先，Web OCR 隐藏；高级分析和 25-item occurrences 渐进显示。
- detail 为教师核心信息优先；三层 forms 每批 20；`act` 193 forms 不一次渲染。
- Teaching list 空状态、导出门槛与 family/form/bulk Undo 完成；旧迁移、notes、connections、order、status、forms、CSV/Markdown/Excel 无损。
- 字号、触控、对比度、heading、name、focus、live region、expanded/menu close、safe-area 与响应式收敛。
- PWA 缓存从壳层扩展至三个 compact assets 与 hashed JS，并以 fingerprint 清理旧版本；full database 保持在线-only。

## 自动验收

| 项目                            | 结果          |
| ------------------------------- | ------------- |
| Prettier format                 | PASS          |
| TypeScript                      | PASS          |
| ESLint                          | PASS          |
| 自动测试                        | 93/93 PASS    |
| Web export/finalization         | PASS          |
| PWA validation                  | PASS          |
| Public repository validation    | PASS          |
| Candidate / inclusive Reference | 3,185 / 3,430 |
| root `act`                      | 7，包含 `age` |
| 实际 DeepSeek 请求/费用         | 0 / 0         |

PWA 最终站点：1,208 files、137,748,400 bytes；compact 三个 gzip 已 precache；full database 和 update archive 未 precache。最终 tracked manifest 排除自身后为 1,374 entries；相对 Package83 是 12 added、43 changed、0 removed、1,319 unchanged，data changed 为 0。public repository validation 为 PASS，0 absolute local path、0 sensitive finding、0 combined finding；精确文件/byte 总数登记在 `PRODUCT_ENTRY.json`。

## 浏览器验收

完成新用户、Package83 storage 迁移、普通浏览、精确搜索、手动筛选、AI ready/zero/unsupported fixture、Check a text 短文/490 occurrences、`act` 193 forms、空/非空 Teaching list、三种导出、在线/AI 不可用/warm offline/离线重开/cache upgrade、宽屏/手机/平板/横屏/200% 等效 reflow 与键盘操作。最终 console 为 0 warning、0 error。

真实浏览器验收促成一项额外修正：窄屏精确搜索区域允许 flex shrink/wrap，AI 离线回退改为纵向布局，避免操作按钮与说明文字争抢宽度。

## 未执行操作与下一步

未 commit、push、部署、改 Worker、调用真实 DeepSeek、读取平台 secret、启用付费服务或构建 APK/IPA。

下一步只应在取得明确授权后，以 Package84 进行一次 staging Pages 更新，继续复用现有 staging Worker。不要部署 Package83；不要由 staging 授权推定 production。
