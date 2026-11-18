# 市场收录维护

投稿目标为 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，遵循其 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)。市场维护者合并投稿后才会更新目录；GitHub 仓库发布成功不代表已经收录。

## 本项目的市场资料

- 源码仓库：`wishprophet/dshbazi`，公开可读，主题包含 `dsh-plugin`。
- 分类：`fun`。本项目提供传统八字分析与独立报告，不声明原生 DSH 侧栏或 Client 面板。
- 条目路径：市场仓库中的 `data/plugins/wishprophet__dshbazi.yml`。
- 图标：`assets/icon-180.png`，GitHub 托管的方形 PNG；`assets/icon.html` 为原创排版源文件。
- 截图：根目录 `screenshots.json` 声明五张相对路径，实际文件在 `docs/screenshots/`。所有命盘截图来自虚构示例，不包含真实个人资料。
- 安装附件：`https://github.com/wishprophet/dshbazi/releases/download/v0.1.6/dsh-bazi-0.1.6.tgz`。条目将固定版本与固定文件名配对，避免 latest 地址与版本化文件名组合失效。

截图和图标位于插件自己的仓库，市场投稿只添加一份 YAML；不要手工编辑市场生成的中英文 README，也不要修改其他插件的条目。

## 后续更新

1. 改报告布局后重新生成虚构示例并运行 `node scripts/capture-market-assets.js`，目视检查所有截图。
2. 更新或重排 `screenshots.json`，保持 1—8 张 PNG/JPG/WEBP 等位图，不使用 `..`、绝对磁盘路径或第三方图床。
3. 按 [publishing.md](publishing.md) 发新版，上传安装包到对应 GitHub Release，并验证匿名下载。
4. 若固定安装包版本发生变化，另开市场 PR，只更新本插件 YAML 中的 `tarball`。截图内容变化只需推送本仓库，市场构建会重新读取。
5. 查看投稿检查和维护者反馈。有明确修改意见时，在同一投稿分支修复并一次说明修改点，不通过空提交反复触发检查。

仓库创建时间为 2026-11-18 05:06:23 UTC（北京时间 13:06:23）。市场要求创建满一天，因此最早在北京时间 2026-11-19 13:06:23 满足年龄门槛；规范说明过期的年龄检查会自动重跑。不得修改提交日期或伪造历史绕过要求。

开发者接手时，以市场 PR 的实际状态和目录中的条目为准；本文件保留投稿材料与维护方式，不替代审核结果。
