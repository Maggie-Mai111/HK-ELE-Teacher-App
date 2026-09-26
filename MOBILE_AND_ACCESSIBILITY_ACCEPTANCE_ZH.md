# Package84 移动端与可访问性验收

日期：2026-09-26  
结论：PASS。

## 响应式与安全区域

真实浏览器通过 viewport 控制覆盖 360×800、390×844、768×1024、1706×960 与 844×390 横屏。各场景 `document.scrollWidth` 与 `clientWidth` 相等，底部 tablist 下缘不超过 viewport，下方内容没有被导航遮挡；所有可见交互目标实测最小高度为 44 CSS px。

浏览器内嵌验收器不暴露可读的 zoom level，原生 Ctrl-plus 不改变它的 viewport 数值，因此 200% 支持用两项等价证据完成：viewport meta 允许缩放至 5 倍；在 360×800 的 200% 等效窄内容宽度下重新排版，最小 320×533 client viewport 无页面级横向溢出、控件仍为至少 44 px。CSS 源码没有固定页面宽度，宽表只存在于至少 760 px 的内部水平 ScrollView。

`viewport-fit=cover` 与四个 `safe-area-inset-*` 已进入最终 `index.html`；Web manifest 使用 standalone/display override。Android/iOS standalone 不把完整数据库加入 app shell。

## 字号、触控和换行

- TextInput 与主要正文目标为 16 px；辅助文字为 15 px；badge、标签、导航及说明的下限为 14 px。
- 自动扫描 `src/` 没有 10–13 px 的 `fontSize`。
- ActionButton、主导航与展开触发器为 48 px；Menu 与 ChoiceChip 不低于 44 px。
- 窄屏精确搜索容器允许收缩/换行；AI 离线回退采用纵向布局，按钮文案不会与说明争抢一行。
- 文本与卡片使用换行、增大的行距和间距；状态同时使用文字，不只依赖颜色。

## 对比度

自动化以 WCAG 相对亮度公式验证主要前景/背景组合全部 ≥ 4.5:1。最低组合是 accent `#B75D16` 在白色上 4.574:1；primary、muted、danger、CPB、HK bands 与 custom 组合均通过。

## 语义与键盘

- 实际页面抽查 77 个可见 button/tab：0 unnamed；0 numeric-only heading；live region 存在。
- h1/h2/h3 层级取代旧 summary 与数字标题；结果摘要和 Undo 消息使用 live region。
- Tab 可聚焦 Menu；Enter 打开；Escape 关闭；Space/Enter 可打开和关闭 AI disclosure。
- menu、AI disclosure、渐进结果使用 expanded 状态；隐藏主页面从 accessibility tree 排除。
- OCR 只在 native platform 条件成立时挂载，Web accessibility tree 不含 `Take photo` 或 `Choose image`。

## 浏览器 console

新用户、迁移、正式 build、AI fixture、在线、warm offline、离线重开和 cache upgrade 标签页合计记录 0 warning、0 error。
