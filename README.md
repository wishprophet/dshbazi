# dsh-bazi

给 DeepSeek Harness 使用的四柱八字插件，内置 `bazi` skill。输入出生信息或已知四柱，生成命盘、十二维度传统规则分析、逐年主题与人生趋势图；DSH 模型根据工具证据和用户实际背景进一步细批。

排盘计算与文字解读分开：历法、四柱和起运由程序处理，模型不能自行改写；格局判断、吉凶分数和年度情景属于传统规则解释，不是经验证的事件预测。当前规则集会把格局写成候选，不宣称已经穷尽调候、合化、从格及全部成败救应。

## 功能与来源

- **网站优先**：`auto` 尝试 [周易大学堂排盘](https://zydx.top/) 的免登录、不保存命例路径；请求失败时降级本地，并在报告中记录实际来源与原因。插件不登录账号、不操作保存命例；这不意味着第三方服务器没有请求日志。
- **本地排盘**：`local` 使用锁定版本的 [`lunar-javascript`](https://github.com/6tail/lunar-javascript)，无须把出生信息发往排盘网站。`website` 用于明确要求网站来源的场景，不能将失败伪装成网站成功。
- **十二维度**：格局层次、官禄功名、财禄丰啬、六亲伦常、婚姻妻室、学业文名、疾厄寿元、迁徙驿马、家宅田宅、官非灾讼、心性品行、人际交友。
- **逐年分析**：返回年度干支、已知大运、规则证据及主题。结合职业、婚恋、近期计划，模型可进一步解释哪些具体情景更符合当事人处境。
- **报告**：JSON、Markdown、可独立打开的 HTML 命盘及趋势图。图中分数是同一规则版本下的相对趋势，不是资产价格、概率、健康值或寿命。

## 本地试用

需要 Node.js 22 或更高版本。在项目目录执行：

```powershell
npm ci
npm test
npm run demo
```

`demo` 使用虚构案例与本地计算。输出位于 `reports/example/`：

| 文件 | 内容 |
|---|---|
| `chart.json` | 规范化命盘 |
| `report.json` | 完整结构化报告与来源 |
| `report.md` | 可读文字报告 |
| `report.html` | 命盘与人生趋势图 |

使用自己的输入文件：

```powershell
node src/cli.js --input examples/solar.json --provider auto --out reports/my-reading
```

也可以直接传入参数：

```powershell
node src/cli.js --date 1990-06-15 --time 09:30 --calendar solar --gender male --name "示例甲" --location "重庆" --provider local --out reports/my-reading
```

已知四柱可以直接输入：

```powershell
node src/cli.js --pillars "甲子 丙寅 戊辰 庚申" --gender male --birth-year 1984 --provider local --out reports/pillars
```

出生年份仅用于年龄定位，不能代替起运日期。若已有核实后的起运日期，可传 `--start-luck-date YYYY-MM-DD`；**缺起运资料时不伪造完整大运及交运年龄**。

## 输入说明

下面展示工具/API 的数据形状，案例不对应实际人物：

```json
{
  "name": "示例甲",
  "gender": "male",
  "location": "重庆",
  "calendar": "solar",
  "date": "1990-06-15",
  "time": "09:30",
  "startYear": 2026,
  "endYear": 2035,
  "context": {
    "occupation": "企业项目管理",
    "relationship": "已婚",
    "plans": "考虑内部竞聘，暂无搬迁计划"
  }
}
```

- `name` 为姓名或称呼，`location` 为出生地点。地点文本不能自动证明已换算真太阳时。
- `calendar` 为 `solar`（公历）、`lunar`（农历）或 `pillars`（已知四柱）。农历闰月用 `leapMonth: true`；日期为所选历法中的年月日。
- `time` 为 `HH:mm`。当前以中国标准时间处理；海外出生、夏令时、真太阳时或换日口径需先核实，不能直接当作已经支持。
- `gender` 为 `male` 或 `female`，用于传统顺逆排运参数。
- `pillars` 模式传 `{ "year": "甲子", "month": "丙寅", "day": "戊辰", "hour": "庚申" }`，不从四柱猜造唯一出生日期。
- `context` 只写实际情况；没有提供就留空。模型不能把背景事实冒充预言命中。
- 背景默认适用于当前年份及邻近年份；复盘旧事可用 `contextYear` 指定当时年份，避免把当前职业或婚恋状态套用于整个人生。
- `startYear`、`endYear` 控制流年报告范围。首次可先细批近期十年，避免将大量年份一次送入模型上下文。

## 安装到 DeepSeek Harness

本项目是 Cordis 插件 bundle，注册 `bazi_reading`、`bazi_years`、`bazi_report` 和一个内置 `bazi` skill。无需修改 DSH 核心，也无需重复复制 skill 到用户目录。

插件声明面向 DSH `>=0.2.2-rc.3 <0.3.0` API。这个范围是开发目标，**不等于每个版本均已在真实运行环境验证**。实现参考当前官方 `ToolDefinition` 与 skill registry；安装前用实际 DSH 的 `--version` 核对，不绕过不兼容版本检查。

### Web profile 本地安装

在已经可用的 DSH CLI 中执行（路径换成实际项目绝对路径）：

```powershell
dsh --version
dsh plugin --profile web add "F:/Program/dsh/bazi"
```

如果通过 npm 启动 Web，可用同版本的 npm CLI：

```powershell
npx @deepseek-ai/dsh plugin --profile web add "F:/Program/dsh/bazi"
```

也可在 DSH 的插件管理工具中执行 `install_bundle`，将 `target` 设为项目的绝对目录。由 Plugin Manager 管理 profile 变更，不手工修改 profile 的 `package.json`。

### Desktop 安装

优先使用桌面应用内的插件管理入口，或让当前 DSH 会话调用 `plugin_manager` 的 `install_bundle` 安装本地目录。若使用命令行，必须使用**桌面安装自带的 dsh 命令运行时**：

```powershell
dsh plugin --profile desktop add "F:/Program/dsh/bazi"
```

普通 npm 安装的 DSH CLI 不支持管理 `desktop` profile。若安装结果提示 `restart-required`，重启对应 DSH 实例后再验证。来源见 [官方 CLI 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/cli/README.md) 和 [Plugin Manager 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)。

### GitHub 安装

当前源码尚未提供已发布 GitHub 地址，不要把下面占位符直接当作现成仓库。将本包作为仓库根目录发布后，用实际仓库和固定提交替换：

```powershell
dsh plugin --profile web add "github:OWNER/REPO#FULL_COMMIT_SHA"
```

Desktop 同样使用应用内插件管理或其自带 CLI。固定提交便于复现；只使用经过核验、与当前 DSH 版本匹配的发布物。

安装后向 DSH 发送：

> 使用 bazi skill，姓名示例甲，男，出生地重庆，公历 1990 年 6 月 15 日 09:30。先用本地算法排盘，再分析十二维度，细批 2026—2030 年。职业是企业项目管理，已婚，正在考虑内部竞聘。请保留排盘口径和证据，不改分数。

`bazi_reading` 返回 `reportId` 和紧凑排盘摘要、十二维度、逐年一行概览及最多五年情景预览；原始完整报告保留在进程内缓存，最多八份、有效一小时。后续使用：

```text
bazi_years({reportId, startYear: 2026, endYear: 2030})
bazi_report({reportId, format: "html"})
```

`bazi_years` 每批最多十年，返回具体情景、依据和流月简表。报告 ID 对应同一命盘，不采用“最新命盘”隐式替换；过期、淘汰或重启后需重新排盘。不会将几十年全部计分明细写入 DSH 会话上下文。

`bazi_report` 把缓存原报告渲染为 HTML/Markdown **文本**，仅在需要完整报告时调用；它不写文件，也不保证 DSH 会自动预览任意 HTML。完整文件输出使用本项目 CLI；当前不含原生 DSH Client 仪表盘。

也可仅使用本项目的 `skills/bazi` skill 加 CLI，而不加载插件：模型运行 CLI 后按需读取 JSON 和文字报告。此方式仍需完整项目及其依赖，单独一份 SKILL.md 不包含历法引擎。

## 能核验什么

排盘准确性需要以相同历法和时间口径比对，尤其关注节气交界、子时、闰月及交运日期。网站与库结果一致只说明该输入下的计算一致，不能证明命理预测有效；本包保留来源、警告与规则版本供复查。

健康栏目不输出疾病诊断和寿命数字，官非栏目不判定犯罪或诉讼结果，财运不换算投资收益。对有现实背景的流年，仍应认真给出少量具体、可观察、有成立条件的情景。

开发说明见 [docs/integration.md](docs/integration.md)，已执行的检查及边界见 [docs/validation.md](docs/validation.md)。GitHub 发布步骤见 [docs/publishing.md](docs/publishing.md)。
