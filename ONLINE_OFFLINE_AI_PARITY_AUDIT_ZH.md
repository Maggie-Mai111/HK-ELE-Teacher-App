# Package83 在线/离线 AI 数据一致性审计

日期：2026-09-26  
结论：PASS。此项是产品派生字段与读取路径修正，不是研究重算。

## 固定边界

- 数据库 identities：163,784；ranked：163,570；unranked：214。
- principal Candidate：3,185；inclusive Reference：3,430；reference-only：245。
- 未重新排名、未重新选择集合、未使用 Stage 4 sensitivity ranking，也未改动 Package67 数据。

## 6 与 7 的差异证据

Package82 的在线 AI 路径由 `StaticShardRepository.aiFilterFamilies()` 扫描公开 `browse/broader/overall` 分片；该投影只带 family 级 `browse_root`。在该投影中，family `age` 的 `browse_root` 只有 `age`，所以 root `act` 的 Candidate/Reference 结果只有 6 个：`act, actual, exact, agent, react, agenda`。

Package82 的离线路径由 3,430-family bundled reference 加载 family 与权威 form 记录。`age` 的登记 form `agency` 在 `root_teacher_display_unified` 中同时带有 `age` 与 `ag / ig / act`，所以相同确定性过滤应有 7 个，并包括 `age`。

差异不是 LLM 输出、排名或成员关系不同，而是在线静态 browse 投影没有使用 form 级统一教师 root。

## 一般化修复

`src/services/aiFilterFamilyProjection.ts` 新增共享 `deriveAiFilterFamilies()`：按 `baseword_key` 汇集登记 form 的 external level、root、root meaning、prefix 与 suffix，去重后形成 AI 确定性筛选投影。规则没有硬编码 `age`、`act` 或数字 7。

`BundledReferenceRepository` 与在线 `HybridRepository.aiFilterFamilies()` 复用同一投影。Candidate/Reference AI 筛选优先读取既有 3,430-family compact bundle；只有 bundle 读取失败时才回退到静态投影。`HybridRepository.browse()` 的 full database 静态分片路径没有改变，因此 163,784-family 在线 Browse 能力保持不变。

## 自动证据

`tests/package83-ai-data-parity.test.ts` 直接读取实际 gzip 资产并证明：

- Package82 在线 browse 投影：root `act` = 6。
- 权威 form-enriched 离线投影：root `act` = 7，且包含 `age`。
- Package83 在线与离线 AI 路径：结果 key 完全相同，root `act` = 7。
- Candidate = 3,185，inclusive Reference = 3,430。
- 共享执行器仍正确处理 prefix、suffix、grade、overall rank、HK rank、HK band、AWL、MSVL、MSVL subject 与 CPB 100。

最终判定：`ONLINE_OFFLINE_AI_CANDIDATE_REFERENCE_PARITY_PASS`。
