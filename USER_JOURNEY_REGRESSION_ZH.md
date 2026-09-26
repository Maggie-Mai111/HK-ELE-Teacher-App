# Package84 用户旅程回归

日期：2026-09-26  
结果：PASS。

## 真实浏览器旅程

| 旅程                      | 结果 | 关键证据                                                                                           |
| ------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| 新用户空存储              | PASS | Teaching list 显示明确空状态和 `Go to Find words`，没有 CSV/Markdown/Excel 按钮                    |
| Package83 列设置/清单迁移 | PASS | 同一 origin 从 Package83 切换到 Package84；15-column Detailed setting 与旧条目/selected forms 保留 |
| 普通浏览                  | PASS | Candidate 3,185；Candidate + Reference 3,430；翻页后焦点在新摘要                                   |
| 精确搜索                  | PASS | `agency` 只显示统一结果区的 1 个 owner family `age`，显示 Clear，不并列默认 3,185 列表             |
| 手动 scope/sort           | PASS | 进入 browse 模式并清除冲突 search/AI 状态；结果摘要获得焦点                                        |
| AI fixture root `act`     | PASS | 确认 scope/root/sort/limit；7 matches · showing first 7；包含 `age`                                |
| AI 三操作                 | PASS | Clear 回普通浏览；Edit 保留并聚焦原请求；Adjust 打开手动筛选并清除 AI result                       |
| AI 批量加入/Undo          | PASS | 7 added · 0 existing · 7 total；Undo 恢复                                                          |
| AI 零结果                 | PASS | 0 matches · showing first 0；条件和无隐藏条件说明保留                                              |
| AI unsupported            | PASS | SQL/animal compounds fixture 被拒绝，不出现 apply 按钮                                             |
| AI 不可用/离线            | PASS | 明确 `Use manual filters`，精确搜索和手动筛选继续可用                                              |
| Check a text 短文本       | PASS | `The agency acts.` 先显示 3 occurrences/3 families 摘要和预教；高级面板默认折叠                    |
| Check a text 大文本       | PASS | 490 occurrences 分组；All occurrences 初始折叠，打开后每批 25                                      |
| 主页面状态保留            | PASS | Find words 的 `agency` 结果和 Check a text 的输入/3-occurrence 结果来回切换后仍在                  |
| `act` family detail       | PASS | 顶部显示核心教师信息；193 forms 分为 16/75/102 三层；75 层只先显示 20                              |
| family/detail 返回        | PASS | 详情顶部打开；Back 恢复 `act` 精确结果和原输入                                                     |
| Teaching list 删除/Undo   | PASS | family 删除与 selected form 删除均能恢复                                                           |
| exports                   | PASS | CSV、Markdown、Excel 均显示创建成功；Excel/界面保留 Selected forms                                 |
| 键盘                      | PASS | Tab、Enter、Space、Escape 操作通过                                                                 |

## 自动回归

93/93 测试通过。新增测试覆盖互斥结果状态、主页面挂载/滚动与焦点、AI fixture/三操作/数量、Web OCR 隐藏、空列表、Undo、193 forms、500-occurrence helper、字号/触控、可访问名称/heading、对比度、compact precache 与 cache upgrade contract；Package83 以前的全部回归测试仍保留并通过。

## 数据语义

身份例外、CPB、HK rank/band、自定义范围、pre-teach、knowledge check、morphology 与 forms 仍来自登记证据。没有把缺失解释为零，也没有以 UI 改动改变 family owner、排名或集合。
