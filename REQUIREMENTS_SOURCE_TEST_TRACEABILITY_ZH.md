# Package83 需求—来源—实现—测试追踪

| 需求                                            | 来源/边界                               | 主要实现                                            | 验证                                                 |
| ----------------------------------------------- | --------------------------------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Package82 为唯一代码基线                        | 用户指示、Package82 manifest            | manifest 核验后复制；保留源副本                     | 1,353/1,353，0 mismatch；源 manifest SHA-256 已登记  |
| principal 数据不变                              | 2026-09-26 handoff、Package67           | 无数据构建或 ranking 代码变更                       | 163,784 / 163,570 / 214 / 3,185 / 3,430 / 245        |
| 查明 root `act` 6 vs 7                          | 实际 online shards 与 bundled form data | `aiFilterFamilyProjection.ts`                       | parity test 直接读取 gzip：旧在线 6、权威离线 7      |
| 一般化修复，不硬编码                            | 登记 form 统一教师字段                  | 按 family 汇集 root/prefix/suffix 等                | 测试要求 `age` 出现且在线/离线 key 完全一致          |
| AI 优先 3,430 bundle                            | 性能与数据一致性要求                    | `HybridRepository.aiFilterFamilies()`               | Candidate/Reference 3,185/3,430；不扫描完整库        |
| full database Browse 不变                       | 产品保留要求                            | `HybridRepository.browse()` 未改路径                | PWA/public validation、Browse browser smoke          |
| prefix/suffix/grade/rank/HK/AWL/MSVL/CPB 不回归 | 用户验收项                              | 复用 `executeAiFilter()`                            | 新增组合回归 test PASS                               |
| 三项主导航                                      | 批准方案                                | `NavigationBar.tsx`                                 | usability test + browser AX                          |
| Data 移至 About 菜单                            | 批准方案                                | `AppMenu.tsx`、`DataVersionScreen.tsx`              | 版本、许可、来源、隐私信息 test/browser 可见         |
| AI 文案与两步流程                               | 批准方案                                | `AiFilterAssistant.tsx`                             | labels test；Preview → Show matching words 保留      |
| AI 后只更新 Browse                              | 批准方案                                | `BrowseScreen.tsx` 单一 `WebFamilyTable`            | source test 确认单一结果表面                         |
| 摘要、Clear、Edit filters、批量加入             | 批准方案                                | `BrowseScreen.tsx`、`teachingListService.addMany()` | usability test + regression                          |
| More filters                                    | 批准方案                                | `BrowseScreen.tsx` disclosure                       | browser 验证 AI 未配置时仍可用                       |
| Teacher/Detailed view                           | 批准方案                                | `WebFamilyTable.tsx`                                | 新用户 Teacher；Detailed 15 columns                  |
| 已保存列设置不丢失                              | Package72 storage contract              | 继续 `hkele-phase1v-columns-v1`                     | source test；既有 migration test                     |
| Teaching List 无损迁移                          | Package72 contract                      | 沿用 migration/service                              | family/forms/order/status/notes regression PASS      |
| CSV/Markdown/Excel + Selected forms             | 既有产品能力                            | exporter 未删除                                     | phase2 export tests PASS                             |
| 390×844 不强迫宽表                              | 批准方案                                | `<760` 使用 `FamilyCard`                            | 实测 390×844，scrollWidth 390，0 console issue       |
| AI 失败仍可手动筛选                             | 安全/可用性要求                         | 未配置时 fail closed + More filters                 | 本地未配置 build 真实浏览器 PASS                     |
| 不调用 DeepSeek/不部署                          | 本轮禁止项                              | 显式未配置 AI build；无外部操作                     | real request 0；commit/push/deploy 均 false          |
| secret 不进入仓库/manifest                      | 安全要求                                | validators 与排除规则                               | sensitiveFindings=[]；`.dev.vars` 不存在，仅 example |

测试总数 82：Package82 最新 76 项全部保留，Package83 新增 6 项（2 项数据一致性、4 项教师可用性）。最终报告以 `IMPLEMENTATION_AND_ACCEPTANCE_REPORT_ZH.md` 为准；Package82 复制而来的历史报告只作为基线证据。
