# AI 易用性评估

## 结论

Package82 以 mock 为主完成 17 条教师典型请求评估：14 条支持请求、1 条零结果、2 条不支持请求。测试不让 LLM 生成词项；AI 只产生受 allowlist 约束的筛选条件，实际词项始终由本地 principal 数据确定性筛选。

## 覆盖

支持请求覆盖：年级、overall rank、HK rank、HK band、prefix、suffix、root、AWL、MSVL、MSVL subject、CPB 100、中英文输入，以及精确组合条件。每个 mock 结果都断言“输出键集合恰好等于请求中明确给出的条件”，用于发现 AI 过度添加条件。

零结果用例使用未登记 root `not-registered`，确定性结果为 0。界面必须显示实际条件 `Root: not-registered`，明确说明没有添加隐藏条件，并提供 `Undo AI filter` 或允许教师修改请求。

两条不支持请求覆盖未登记语义类别/compound 推断，以及 rerank/SQL。结果必须是 `unsupported`、`filters: null`，不得猜测、执行或改变 principal 排名。

## 发现与修正

- prompt 新增硬规则：只应用教师明确请求的条件，不得额外推断年级、rank、band、形态、词表、学科、scope、limit 或 sort。
- 中文请求自动采用 `zh-HK` locale；英文采用 `en-HK`。
- Browse 在应用 AI 条件后显示“Actual conditions”，零结果说明可 Undo 或修改。
- 不支持的请求无可执行 filters；网络、Turnstile、限流或 provider 异常均回退到手动筛选。

## 结果边界

75/75 自动测试通过，其中 17 条为本文件所述的易用性用例。浏览器回归确认 AI 未配置时会明确显示手动筛选仍可用。真实 DeepSeek 调用为 0，因此尚不能把 mock 结果表述为真实模型质量验收；真实 staging 最多一次请求且不得重试。
