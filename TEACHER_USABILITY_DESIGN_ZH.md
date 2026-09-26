# Package83 教师可用性设计说明

Package83 保留 Package82 的功能和视觉语言，只整理信息层级、筛选流程与窄屏交互。

## 信息架构

主导航只保留 `Find words`、`Check a text`、`Teaching list`。原 `Data` 没有删除，而是移到页面顶部 `Menu` 内的 `About & data version`。该页面继续显示数据版本、principal 数量、更新方式、许可与数据来源、隐私边界及相关文档名。

页面顶部的长技术说明改为简短 `Database status`；详细的 online full database、bundled fallback 与更新说明集中到 `About & data version`。

## AI 两步流程

标题改为 `Find words with AI`；按钮改为 `Preview`、`Show matching words`、`Edit request`。流程仍是：LLM 只解释短请求，教师查看条件后确认，随后由本地 principal 数据执行确定性筛选。AI 不决定成员关系或排名。

确认后的家庭直接进入 Browse 的同一结果区域，不再渲染重复的第二张表。结果区提供匹配 family 数与条件摘要，以及 `Clear`、`Edit filters`、`Add to teaching list`。批量加入使用原子 `addMany()`，避免连续状态更新丢失项目。

## Browse 与列视图

- 手动 scope 与 sort 保留在 `More filters` 展开区；AI 不可用时仍可使用。
- 新用户默认 `Teacher view`，显示 8 个教学核心列。
- `Detailed view` 保留全部 15 列和列选择控件。
- 继续使用既有 `hkele-phase1v-columns-v1` storage key；检测到保存设置的用户进入 Detailed view，并沿用其列可见性。
- 三层词形、具体 form 选择、family detail、Teaching List 迁移及 CSV/Markdown/Excel 导出均保留。

## 响应式行为

宽屏继续使用完整列表/表格视图。CSS 宽度低于 760 px 时，结果改为教师可读卡片，不要求教师横向操作 15 列表格。真实浏览器在 390×844 下记录 `innerWidth=390`、`innerHeight=844`、`document.scrollWidth=390`；没有页面级横向溢出。底部三个主导航项保持可见。

本轮没有新增无关功能、没有删除 full database Browse、Check a Text、Teaching List、word detail、CSV/Markdown/Excel、PWA 或在线完整数据库。
