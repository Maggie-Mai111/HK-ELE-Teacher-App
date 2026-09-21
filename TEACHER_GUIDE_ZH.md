# HK-ELE Teacher 教师使用说明

## 浏览与查词

在 Browse 选择 Candidate、Candidate + Reference 或 Full database，输入词形或 family 搜索，
并按 Overall、HK frequency 或 A–Z 排序。点开卡片查看完整登记字段。HK rank 与 overall rank
是两种不同顺序；General unavailable 表示该来源分量不可用，不表示频率为零。

## Check a Text

粘贴或输入原文后选择 Check text。结果保留原始顺序、大小写、offset 与上下文，并明确区分
ordinary family match、compound match、registered grammatical relation 与 genuinely unmatched。
例如 `I'm` 会显示 `I + be`，但不会被虚构成有排名的新词族；`understand` 会分别标出 Text
form `understand` 与 HK-ELE family `stand`。真正未匹配项集中在 “Unmatched words to review”，
显示形式和次数，不猜测词族、排名或教学价值，也不进入 pre-teach list。

可开启 CPB 100、HK frequency 档位或自定义 HK rank 范围高亮。标记同时使用文字/符号，不只
依赖颜色。Estimated text complexity 是透明的 Flesch 指标，不是 Lexile；短于 30 个词时不
计算。

## 用相机或图片输入

在 Check a Text 顶部点击 Take photo 或 Choose image。图片在设备端识别，结果先出现在
“Editable OCR result”中。先校对，再选择 Use OCR text 或 Append OCR text。Discard 不会更改
现有原文。Web 版不支持 OCR，但始终可以粘贴或手动编辑。

## Word Knowledge 与全文检查

N=10/N=20 是从当前文本合资格唯一 family 抽样，sample known percentage 不能视为全文精确
coverage。Estimated token coverage 也是估计。只有 Full coverage check 的所有合资格 family
都回答后，才显示 exact checked token coverage；即使达到 100%，理解仍受读者、文本与任务
影响。

## Teaching List 与 pre-teach review

可把词族加入 Teaching List，设置 Notice、Practise 或 Master，编写 notes/connections 并重排。
列表按稳定 `baseword_key` 保存。pre-teach review 给出 5–8 个可解释建议，教师可以增删和
重排；earliest observed 只描述抽样教材证据，不是规定教学年级。

## 导出

Teaching List 可导出 CSV、Markdown 或 Excel。导出包含教师输入，请只通过符合学校隐私政策
的渠道保存或分享。

## 数据更新与恢复

Data 页不要求教师输入技术 URL；正式地址由构建配置提供。选择 Check for update，核对版本与
大小，再选择 Install verified update。App 会先验证批量归档的 SHA-256，解包后继续验证每个
文件的 byte size 和 SHA-256；全部通过后才切换版本。更新或 rollback 成功后重启 App。如果
下载、hash、解包或切换失败，旧数据保持可用。当前若未配置经验证的正式 HTTPS 地址，更新
按钮会保持安全不可用，不会编造地址。
