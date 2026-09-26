# Package85 实施与验收报告

日期：2026-09-26  
最终状态：`PACKAGE85_LOCAL_SUPERVISOR_FEATURE_USABILITY_ACCEPTED_AWAITING_SINGLE_STAGING_UPDATE_AUTHORIZATION`

## 基线、数据与保护范围

Package84 是唯一代码基线。复制前按其 manifest 对 1,374 个登记文件逐项核对 path、bytes 和 SHA-256，结果为 0 missing、0 size mismatch、0 hash mismatch；源 manifest 副本为 `PACKAGE84_SOURCE_TRACKED_FILE_MANIFEST.csv`，SHA-256 为 `9B3E95E902230AAF6C6821FAE52F492506888B735306EA3AD6750BEE9CA0F2A7`。

principal 控制数保持不变：163,784 database identities、163,570 ranked、214 unranked、Candidate 3,185、inclusive Reference 3,430、reference-only 245。未重算排名、覆盖或成员资格；Package67/72/77/78/80–84、论文、principal 数据、既有本地 GitHub 仓库和 Worker 均未修改。

## 实施结果

- 在 Text summary 后提供常显的 `Check word knowledge` 入口，不再只藏于高级折叠区。
- 回答统一为 `Known / Not known`；保留 Quick sample (10)、Larger sample (20) 与 Full check。
- 共享 `knowledgeTestService` 同时计算 family 与 token 的已知/生词互补结果；UI 不重复计算。
- 回答未完成时只显示进度；sample 完成后标为 `Sample estimate`；Full check 必须回答全部 eligible families 后才显示 `Exact checked result`。
- 结果显示 known/unfamiliar family 数量与比例、known token coverage 与 unfamiliar token rate，并明确分母只含 eligible resolved families/tokens。
- unresolved、ambiguous、blocked、unsupported 与 full-check-unavailable 不进入分母，也不自动视为生词。
- `Not known` 直接证据与系统预教建议分区呈现；加入 Teaching List 时显示来源 `Learner/teacher marked as Not known`。来源只存于本次内存会话。
- 预教继续使用确定性登记规则；不调用 LLM、不设隐藏综合分数，排序和可见理由口径保持。
- 保留 Check text 摘要、highlighting、complexity、详细结果、Teaching List、词族详情和既有导航。

## 自动验收

| 检查                         | 结果                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| format                       | PASS                                                             |
| typecheck                    | PASS                                                             |
| lint                         | PASS                                                             |
| 自动测试                     | PASS，104/104；Package84 原有 93 项全部保留并通过                |
| Web build                    | PASS                                                             |
| PWA validation               | PASS；compact reference 预缓存，完整数据库与 update archive 排除 |
| public repository validation | PASS；0 绝对本机路径、0 敏感文件、0 forbidden finding            |
| Candidate / Reference        | PASS，3,185 / 3,430                                              |
| AI root `act`                | PASS，7 条且包含 `age`                                           |
| 真实 DeepSeek 请求           | 0                                                                |

Web 导出共 1,208 个文件、137,753,160 bytes；最大文件 63,125,230 bytes。Package85 使用产品版本 0.8.0、应用版本 0.5.0、Android versionCode 5 与 iOS buildNumber 5。

## 真实浏览器验收

- 桌面 1706×960：Text summary、显著 Knowledge 入口、Preteach、Knowledge 结果与 Teaching List 完整可用；页面无横向溢出。
- 手机 390×844：`scrollWidth = innerWidth = 390`，0 个横向溢出元素；所有可见按钮与 tab 触控目标均至少 44×44 CSS px。
- Quick sample 实测 3 个 eligible families：1 Known、2 Not known 时 family 为 33.3% / 66.7%，按重复 token 加权为 20.0% / 80.0%。
- Full check 未完成时只显示 `1/3 families answered`，不显示最终比例；全部完成后才显示 exact checked result 与 eligible-only 说明。
- `Not known` 一键加入 Teaching List 后，来源文字可见；直接证据和系统建议仍分开。
- 浏览器 console：0 warning、0 error。

## 外部动作与后续

未 commit、push、部署、调用真实 DeepSeek、读取/写入平台 secret、启用付费服务或进入 production。数据库、API 和 Worker 均无需更新；下一步只能在另行明确授权后，按 `STAGING_UPDATE_RUNBOOK_ZH.md` 将 Package85 Web/PWA 资产做一次 staging Pages 更新，并复用既有 staging Worker。
