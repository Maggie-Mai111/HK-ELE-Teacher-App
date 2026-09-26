# Package85 词汇知识与 unfamiliar-word rate 设计

## 入口与会话边界

`Check a text` 完成后，`Text summary` 下方立即显示 `Check word knowledge`，不再只藏于高级折叠。教师或学习者可选：

- `Quick sample (10)`；
- `Larger sample (20)`；
- `Full check`。

回答使用 `Known / Not known`。回答和 Not known 来源只存在当前 React 会话；没有账号、学生身份、云存储、analytics 或个人资料。加入 Teaching List 时，词族本身仍按既有本地 storage contract 保存，但“Learner/teacher marked as Not known”只以本会话来源显示，不写入教学清单持久化文档。

## 分母与计算

共享逻辑位于 `src/services/knowledgeTestService.ts`。一个 family 只有同时满足以下条件才进入 eligible 分母：

1. occurrence status 为 `RESOLVED`；
2. 恰有一个 owner；
3. owner 非 blocked，且非 display-blocked。

因此 unresolved、ambiguous、blocked、unsupported、unmatched、registered grammatical relation 与 `FULL_DATABASE_CHECK_UNAVAILABLE` 均不进入 Known/Not known 分母，也不会自动算作生词。

完成当前 check 后，共享服务一次性产生：

- `knownFamilies` 与 `unfamiliarFamilies = totalFamilies - knownFamilies`；
- `familyKnownPercent` 与 `familyUnfamiliarPercent = 100 - familyKnownPercent`；
- `knownTokens` 与 `unfamiliarTokens = totalTokens - knownTokens`；
- `tokenCoveragePercent` 与 `unfamiliarTokenRatePercent = 100 - tokenCoveragePercent`。

token 结果按每个 eligible family 在文本中的 occurrence 数加权；同一词族重复出现不会重复增加 family 分母，但会正确增加 token 权重。互补比例在共享服务中计算，UI 不重复另算。

## Sample 与 Full 的不同解释

- Sample 只有样本中全部显示的 family 都回答后才显示 `Sample estimate`。少于 10 或 20 个 eligible families 时，纳入全部可用 family，并明确数量不足。
- Full check 在全部 eligible families 回答前只显示 `answered/total` 进度，不显示最终比例。
- 全部回答后才显示 `Exact checked result`；“exact”只指本次 eligible resolved families 及其 eligible tokens 的已检查结果，不能解释为文本中所有项目的绝对生词率。

所有模式均显示提示：生词取决于具体学习者；词汇覆盖率不等于阅读理解。

## Not known 与教学行动

每个 `Not known` 项目提供一键加入 Teaching List。Knowledge UI 与 Preteach UI 均显示直接证据标签 `Learner/teacher marked as Not known`。Teaching List 在同一会话显示 `Source this session`；系统建议仍保留独立区域，不把直接回答混入隐藏分数。

## 边界测试

测试覆盖 family/token 两组互补为 100%、重复词 token weighting、未完成隐藏比例、ineligible 排除、空集合、少于 10 个 eligible families、全 Known、全 Not known、sample estimate/full exact checked 标签，以及本会话来源与一键加入。
