# HK-ELE Teacher Web/PWA — Package83

Package83 是以 Package82 为唯一代码基线的本地教师可用性修订。最终状态：

`PACKAGE83_LOCAL_USABILITY_ACCEPTED_AWAITING_STAGING_UPDATE_AUTHORIZATION`

本包修正 Candidate/Reference AI 在线/离线派生字段路径，使 root `act` 两端均为 7 个 family 并包含 `age`；修复采用共享 form-enriched 规则，没有硬编码个案，也没有研究重算。full database Browse 保持原静态 shards。

教师界面主导航现为 `Find words`、`Check a text`、`Teaching list`；版本、许可、隐私与来源信息位于 `Menu > About & data version`。AI 保留 Preview → 教师确认 → principal 数据确定性筛选。新用户采用 Teacher view，Detailed view 保留 15 列；既有列设置 key 与 Teaching List 迁移保持不变。390×844 使用卡片结果。

## 固定数据边界

- identities 163,784；ranked 163,570；unranked 214。
- Candidate 3,185；inclusive Reference 3,430；reference-only 245。
- principal ranking 不变；Stage 4 sensitivity ranking 未使用。

## 本地验收

- format、TypeScript、ESLint：PASS。
- 全部测试：82/82 PASS。
- Web build、PWA validation、public repository validation：PASS。
- 1706×960 与 390×844 真实浏览器：PASS；console 0 warning、0 error。
- 真实 DeepSeek 请求：0。

先读 `PRODUCT_ENTRY.json`、`ONLINE_OFFLINE_AI_PARITY_AUDIT_ZH.md`、`TEACHER_USABILITY_DESIGN_ZH.md`、`IMPLEMENTATION_AND_ACCEPTANCE_REPORT_ZH.md` 与 `STAGING_UPDATE_RUNBOOK_ZH.md`。本轮没有 commit/push、Pages 更新、Worker 部署或 production 变更。
