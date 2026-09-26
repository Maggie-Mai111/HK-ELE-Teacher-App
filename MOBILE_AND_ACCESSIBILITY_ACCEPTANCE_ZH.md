# Package85 移动端与可访问性验收

日期：2026-09-26  
结论：PASS。

## 真实浏览器视口

| 视口          | 页面宽度结果                                                   | 关键流程                                            |
| ------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| 1706×960 桌面 | `documentElement.scrollWidth = 1706`；无页面横向溢出           | Text summary → Knowledge → Preteach → Teaching List |
| 390×844 手机  | `documentElement.scrollWidth = innerWidth = 390`；0 个溢出元素 | 同一业务规则与同一源码路径完整可用                  |

390×844 下，所有当前可见按钮和 tab 均不小于 44×44 CSS px。Knowledge 的三个模式、Known/Not known、加入 Teaching List 与返回导航均可触控；长说明和结果数字正常换行，没有页面级横向滚动。

## 可访问性与理解负担

- `Check word knowledge` 在 Text summary 后常显，标题、说明和按钮具有明确可访问名称。
- `Known / Not known` 取代含义不明确的 Yes / No；状态不只依靠颜色表达。
- 进度使用 live region；未完成回答时不呈现可能被误读为最终结果的比例。
- 结果卡清楚区分 `Sample estimate` 与 `Exact checked result`。
- known/unfamiliar 的 family 数量、比例及 token coverage/rate 同时呈现，主要数字保持现有正文与结果字号标准。
- 说明明确指出生词依学习者而异，词汇覆盖率不等于阅读理解。
- `Learner/teacher marked as Not known` 与 `System-suggested words with registered reasons` 使用独立 heading，避免把直接证据与系统建议混合。
- “Earliest observed” 继续说明为 sampled textbook evidence，而非规定教学年级。

## PWA、离线与移动端边界

Package85 Web 与 PWA 共用 `src/` 中的知识检查、预教和 Teaching List 业务逻辑，没有另建 App 规则。PWA shell 与 compact 3,430-family reference 可离线使用；完整 163,784-family 数据库仍按既有设计在线按需加载，不被误称为完整离线数据库。

本次没有构建 APK/IPA，也没有声称实体手机安装或原生商店验收。移动验收范围是 390×844 真实浏览器响应式 PWA 界面。

## Console

完成桌面和 390×844 流程后，浏览器日志为 0 warning、0 error。
