# Package85 Preteach 推荐方法审计

## 结论

Preteach 核心仍由 `src/services/preteachService.ts` 的确定性规则生成。Package85 没有让 DeepSeek/LLM 决定推荐词、排序、理由或 unfamiliar 状态，也没有隐藏综合分数。

教师界面继续使用标题 `Words to review for possible pre-teaching`，并明确说明它是供教师复核的系统建议，不是学生生词预测。

## 排除规则

自动系统建议排除：

- CPB 100；
- unresolved、ambiguous、blocked、display-blocked、unsupported 与 full-check-unavailable；
- 保守识别的 capitalized name-like surface。

教师仍可从其他 resolved family 中手动加入、删除与调整顺序；人工控制不受自动建议数量限制替代。

## 可见登记理由

系统建议只在至少存在一个可见登记理由时出现。理由来自：

- HK rank（Outside HK Top 1k / Top 2k）；
- AWL；
- MSVL / subject evidence；
- 文本重复次数；
- 登记 root/prefix/suffix morphology；
- `Earliest observed` 抽样教材证据；
- Candidate/Reference 状态。

`Earliest observed` 的界面说明保持为“抽样教材证据，不是规定教学年级”。

## 排序

现有稳定顺序保持：可见理由数量 → 文本 occurrence 数 → HK rank → `displayFamily` 字母顺序。没有创建或存储综合 score，也没有引入 LLM tie-break。

## 直接证据与系统建议分离

`PreteachPanel.tsx` 现在显示两个独立区块：

1. `Learner/teacher marked as Not known`：来自当前 Knowledge check 会话的直接标记，可一键加入 Teaching List；
2. `System-suggested words with registered reasons`：确定性规则建议，每项逐条显示登记理由。

两类证据不会相加、加权或合成为优先级分数。教师继续可以手动添加、删除、上移和下移。

## LLM 边界

AI 仅存在于 Find words 的 `AiFilterAssistant → strict JSON → teacher confirmation → executeAiFilter` 流程。`preteachService.ts` 不导入 AI client/schema/executor，不调用 `fetch`，也不访问 Worker。自动测试同时核查其源码不存在 DeepSeek/LLM/AI 调用路径。
