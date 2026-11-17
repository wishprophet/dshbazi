# 发布到 GitHub 和安装

本目录本身就是独立 Git 仓库与 npm 插件包根目录，不要把外层 `dsh` 目录作为插件根目录发布。

## 发布前

```powershell
cd F:\Program\dsh\bazi
npm ci
npm test
npm run demo
npm pack
```

`npm test` 完全离线。需要检查网站当前可用性时单独执行 `npm run verify:website`；它只提交代码中三个虚构示例，并固定不保存命例。

`reports/`、`node_modules/`、`.env` 与打包产生的 `.tgz` 已被 Git 忽略，不会把个人命盘或依赖文件提交到 GitHub。发布前仍应检查 `git status`。

## 首次上传

在 GitHub 创建空仓库，例如 `bazi`，然后使用自己的 Git 身份完成首次提交。若未配置身份，先在本仓库设置 `git config user.name "你的显示名"` 与 `git config user.email "你的提交邮箱"`。

```powershell
git add .
git commit -m "Initial release of dsh-bazi"
git remote add origin https://github.com/YOUR_ACCOUNT/bazi.git
git push -u origin main
```

`YOUR_ACCOUNT` 是占位符，需要替换。当前交付没有创建远程仓库、推送或公开任何出生资料。发布版本时建议同时更新 `package.json`、锁文件和版本说明，并打版本标签。

## 从本地或 GitHub 安装到 dsh

Web 版使用对应版本 CLI：

```powershell
dsh plugin --profile web add "F:/Program/dsh/bazi"
```

发布之后：

```powershell
dsh plugin --profile web add "github:YOUR_ACCOUNT/bazi#FULL_COMMIT_SHA"
```

Desktop 使用应用内 Plugin Manager 安装目录或 GitHub 地址，或使用桌面自带 CLI 的 `--profile desktop`；普通 npm CLI 不能管理 Desktop profile。详细说明见仓库 README。

安装后模型应能发现 `bazi` skill 和八字工具。首次用本地示例验证，再使用网站模式。尚未在用户实际 DSH 环境启动验证时，不能把工具模拟注册测试写成真机安装成功。
