# 报告截图

这些图片来自插件实际生成的独立 HTML 报告，使用 `examples/solar.json` 中的虚构示例。不是 DSH 原生面板截图，也没有加入设计稿中的虚构功能。

| 文件 | 内容 |
|---|---|
| `01-natal-chart.png` | 四柱竖排、五行配色、十神、藏干、关系、称骨三行与起运资料 |
| `02-luck-explorer.png` | 选择 2028-04-15 后的大运、流年、流月、流日与本命对照 |
| `03-overview-dimensions.png` | 整体分析和完整十二方面分析 |
| `04-life-trend.png` | 2000—2080 年连续走势、2026 年分析和重点月份 |
| `05-mobile.png` | 390 CSS 像素宽度下的本命盘，按双倍像素密度输出 |

截图由 Windows Edge 在全新独立配置中打开本地报告取得，不访问已登录浏览器，不修改报告内容。复现：

```powershell
npm run demo
node scripts/capture-market-assets.js
```

脚本也会把 `assets/icon.html` 中的原创排版图形渲染为 180 与 512 像素 PNG 图标。图标沿用报告配色；市场使用 `assets/icon-180.png`。浏览器临时文件留在被忽略的 `reports/market-capture/` 目录。
