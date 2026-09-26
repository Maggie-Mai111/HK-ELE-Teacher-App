# Package85 导师功能完整性审计

日期：2026-09-26  
结论：导师提出的 Web/PWA 功能已按 Package77/78 登记需求与 Package84/85 实际源码逐项核查；除原生安装包/真机与完整数据库离线能力仍属既有发布边界外，本轮导师功能均已在共享 React Native Web/PWA 代码中完成或保持。

## 审计口径

- 需求来源：本轮导师指示、Package77 `PRODUCT_ENTRY.json`/`PHASE_STATUS.json`/`TEACHER_GUIDE_ZH.md`/`DATA_CONTRACT.md`、Package78 manifest 与验收报告。
- 实现证据：Package85 `src/` 实际代码；Package84 是唯一代码基线，复制前按其 1,374-entry manifest 核验为 0 mismatch。
- 测试证据：104/104 自动测试、Web build、PWA/public validation，以及 1706×960 和 390×844 真实浏览器验收。
- `完整实现` 表示本地 Web/PWA 范围内已有可操作入口、共享实现与测试；不等于 production、APK/IPA、商店或公开分发已经完成。

## 逐项结果

| 导师功能                                 | 状态                 | UI 入口                                                      | 主要源码证据                                                                                                 | 测试/运行证据                                                                                                              |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| AI 自然语言选词                          | 完整实现（受控范围） | Find words → Find words with AI                              | `AiFilterAssistant.tsx`、`aiFilterClient.ts`、`aiFilterSchema.ts`、`aiFilterExecutor.ts`                     | schema/executor、client/Worker、Package82–84 AI 测试；只用 fixture，真实请求 0                                             |
| grade、overall/HK rank、HK band          | 完整实现             | Find words AI/manual filters、Browse、word detail            | `aiFilterSchema.ts`、`aiFilterExecutor.ts`、`BrowseScreen.tsx`、`WebFamilyTable.tsx`、`WordDetailScreen.tsx` | AI 组合回归、Browser Browse/detail；Package67 principal 数据不变                                                           |
| prefix、suffix、root、AWL、MSVL、CPB 100 | 完整实现             | Find words filters；Browse/detail；Check a text highlighting | `aiFilterExecutor.ts`、`WebFamilyTable.tsx`、`WordDetailScreen.tsx`、`HighlightedText.tsx`、`cpbService.ts`  | AI 组合回归、CPB 1–100 测试、morphology exact-boundary 测试                                                                |
| Check a text                             | 完整实现             | 主导航 Check a text                                          | `CheckTextScreen.tsx`、`tokenizer.ts`、`identityService.ts`                                                  | tokenizer/identity/data-mode/500-occurrence 回归与真实浏览器短文验收                                                       |
| 预教词建议                               | 完整实现             | Text summary 后的 Words to review for possible pre-teaching  | `preteachService.ts`、`PreteachPanel.tsx`                                                                    | CPB/ambiguous/blocked 排除、可见理由、无 LLM 测试                                                                          |
| 词汇知识检查、生词率和词汇覆盖率         | 完整实现             | Text summary 紧邻的 Check word knowledge 显著入口            | `knowledgeTestService.ts`、`KnowledgeTestPanel.tsx`、`CheckTextScreen.tsx`                                   | 互补比例、token 加权、sample/full、ineligible、边界用例及真实浏览器验收                                                    |
| Teaching list                            | 完整实现             | 主导航 Teaching list；Browse/detail/Check text/Preteach 添加 | `teachingListService.ts`、`TeachingListScreen.tsx`                                                           | Package72 migration、addMany/Undo、Not known 本会话来源、持久化回归                                                        |
| word-family detail                       | 完整实现             | Browse/Check text 结果 → View/Detail                         | `WordDetailScreen.tsx`                                                                                       | `act` 193 forms 渐进显示、三层 forms、详情返回与滚动恢复                                                                   |
| CSV、Markdown、Excel、Selected forms     | 完整实现             | 非空 Teaching list → Export                                  | `teachingListExport.ts`、`shareExport.ts`、`TeachingListScreen.tsx`                                          | CSV 转义、Markdown、OOXML/frozen header/filter、Selected forms 测试                                                        |
| PWA、离线和移动端使用                    | 部分实现（边界明确） | 安装型 Web/PWA；共享响应式 App UI                            | `public/sw.js`、`finalize_web_deployment.mjs`、共享 `src/`                                                   | compact 3,430-family bundle warm offline、390×844 PASS；完整 163,784 database 仍 online-only；未构建 APK/IPA、未做真机验收 |

## 重要边界

- LLM 只把 Find words 自然语言转换为 allowlisted filters；不选 Preteach 词、不判断 Known/Not known、不排序 Preteach，也不生成数据库外词项。
- Knowledge 的 unknown/unfamiliar 是当前具体教师/学习者的会话标记，不是人群预测；词汇覆盖率不等于阅读理解。
- `Earliest observed` 是抽样教材观察，不是规定教学年级。
- Web/PWA 与 native 共享同一 `src/services` 业务逻辑；没有建立两套 Knowledge 或 Preteach 规则。
- 未发现需要修改 Package67、数据库、API 或 Worker 的证据。
