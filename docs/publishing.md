# 发布与安装

源码仓库为 [wishprophet/dshbazi](https://github.com/wishprophet/dshbazi)。本目录是独立 Git 仓库和 npm 插件包根目录。GitHub 仓库名 `dshbazi`、插件包名 `dsh-bazi`、本地目录名 `bazi` 无须相同；不要上传外层 `dsh` 目录。

## 发布检查

需要 Node.js 22 或更高版本。一次版本更新按以下顺序操作：

1. 更新 `package.json`、`package-lock.json` 和 `src/service.js` 中的插件版本。
2. 更新 `CHANGELOG.md`、相关文档与验证记录；若改了公开字段，同步 skill。
3. 执行离线测试、生成示例并验证页面。涉及网站接口时另行验证匿名排盘。
4. 打包并在隔离目录安装，确认打包后仍有三个工具和 skill 资源。
5. 检查待提交文件，提交、打标签、推送；标签不要覆盖已发布版本。

```powershell
npm ci
npm test
npm run demo
node scripts/verify-report-ui.js
npm pack
```

页面检查脚本默认使用 Windows Edge，访问新建浏览器配置中的本地示例报告。其他系统可以手动打开报告检查四柱、运年切换、手机布局和人生折线。

`npm test` 不联网。网站检查单独运行 `npm run verify:website`，它提交三个固定虚构案例，使用 `save=0`，不需要登录。

`reports/`、`node_modules/`、`.env`、`.vscode/` 和 `.tgz` 已忽略。不要提交个人命盘、凭据、SSH 私钥或本机编辑器设置。检查实际暂存内容后再提交：

```powershell
git status --short
git diff --check
git diff --cached --stat
git commit -m "Release v0.1.6"
git tag v0.1.6
git push -u origin main
git push origin v0.1.6
```

以上提交命令只处理已经暂存的修改。后续发版把版本号改为新版本，不重复创建已有标签。远程地址应为 `git@github.com:wishprophet/dshbazi.git`；SSH 凭据单独配置在开发环境，不写进仓库。

`npm pack` 产生 `dsh-bazi-0.1.6.tgz`。源码 ZIP 可在仓库目录生成：

```powershell
git archive --format=zip --prefix=bazi/ --output=../bazi.zip v0.1.6
```

推送 Git 标签不等于创建 GitHub Releases 页面，也不等于发布到 npm。需要网页下载附件时，在 GitHub 为对应标签创建 Release，再上传 `.tgz`；源码 ZIP 也可通过 GitHub 标签页面下载。使用已登录的 GitHub CLI 发布附件时，先把发布说明写入文件：

```powershell
gh release create v0.1.6 ./dsh-bazi-0.1.6.tgz --repo wishprophet/dshbazi --verify-tag --title "v0.1.6" --notes-file reports/release-notes.md
```

发布后验证匿名下载与附件校验值。市场条目使用固定标签的 `.tgz` 地址，版本更新后同步投稿条目；图标和截图维护见 [MARKETPLACE.md](MARKETPLACE.md)。

## 安装或更新 DSH

先运行 `dsh --version`。插件声明范围为 `>=0.2.2-rc.1 <0.3.0-0`，当前原生隔离验证版本为 `0.2.2-rc.1`，详细结果见 [validation.md](validation.md)。

Web profile 使用对应版本的 CLI：

```powershell
dsh plugin --profile web add "github:wishprophet/dshbazi#v0.1.6"
```

也可以安装本地目录或将生成的安装包复制到服务器后安装：

```powershell
dsh plugin --profile web add "F:/Program/dsh/bazi"
dsh plugin --profile web add "F:/Program/dsh/bazi/dsh-bazi-0.1.6.tgz"
```

路径是安装命令所在机器上的路径，部署到其他服务器需替换。私有 GitHub 仓库要求 DSH 所在机器具备读取权限；开发机的 SSH 授权不会自动传到服务器。可改用已复制到服务器的本地安装包。

Desktop 使用应用内 Plugin Manager 或桌面自带 CLI 的 `--profile desktop`；普通 npm CLI 不能管理 Desktop profile。已安装旧版时在插件管理中替换为新版本；若提示 `restart-required`，重启对应实例。

安装后确认 `bazi_reading`、`bazi_years`、`bazi_report` 与 `bazi` skill 可发现，调用本地示例，然后再试网站模式。完整报告文件由 CLI 生成；`bazi_report` 返回文本，不承诺 DSH 自动预览 HTML。

本地打包、GitHub 推送和用户线上实例更新是三件独立的事。只有在目标实例中查到新版并完成一次调用，才能记录该实例已升级；不能用隔离 registry 测试代替线上验收。
