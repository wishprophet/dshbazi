# dsh-bazi 开发交接

本文针对 0.1.7。称骨按性别选歌，报告生成时即绘制年度折线，交互由浏览器增强。最新发布与验证状态分别见 [版本记录](../CHANGELOG.md)、[验证记录](validation.md) 和 [发布步骤](publishing.md)，市场维护见 [MARKETPLACE.md](MARKETPLACE.md)。用户阅读的命盘报告不包含本文这些实现说明。

## 先把项目跑起来

GitHub 仓库为 [wishprophet/dshbazi](https://github.com/wishprophet/dshbazi)。本机目录为 `F:\Program\dsh\bazi`，它本身是独立 Git 仓库和插件包根目录；不要上传外层 `dsh` 目录。GitHub 仓库名 `dshbazi`、包名 `dsh-bazi`、skill 名 `bazi` 可以不同。

环境要求 Node.js 22 或更高版本。项目使用原生 ESM，没有构建步骤；运行时依赖仅为锁定的 `lunar-javascript@1.7.8`。

```powershell
cd F:\Program\dsh\bazi
npm ci
npm test
npm run demo
```

打开 `reports/example/report.html`。同目录下的 `report.json` 是完整计算结果，`chart.json` 是规范化命盘，`report.md` 是文字报告。示例是虚构测试资料；实际出生资料不要写入已跟踪文件。

## 为什么交付插件和 skill

插件负责确定性计算、网站适配、结构化返回值和报告渲染，skill 负责指导 DSH 按事实组织自然语言。仅靠 skill 容易让模型自行猜干支、起运和数值；仅靠插件又缺少对话中的背景承接与解读指引。

内置 skill 随插件注册，不需要再复制一份到用户 skill 目录。独立使用 `skills/bazi` 时仍须安装完整项目和依赖，再通过 CLI 取得计算结果；`SKILL.md` 本身不是排盘引擎。

## 代码从哪里看

| 文件 | 职责 |
|---|---|
| `src/service.js` | 统一入口 `createReading`，选择来源、组合排盘、解读、趋势和称骨 |
| `src/calendar.js` | 输入校验、公农历转换、四柱、真实交运日期、节气月和年龄 |
| `src/providers/zydx.js` | 周易大学堂免登录表单请求与 HTML 解析 |
| `src/analysis.js` | 十神、藏干、强弱倾向、基础格局、十二领域基础批语 |
| `src/conclusions.js` | 0.1.5 的格局、事业顺逆、财富积累与总评整合 |
| `src/marriage-conclusions.js` | 婚缘顺逆、早晚及实际大运流年中的成年窗口 |
| `src/timeline.js` | 六项趋势分、十二方面年度事件、重点月份、交运月分段 |
| `src/relationships.js` | 本命和运年组合的刑冲破害合等关系展示 |
| `src/display-facts.js` | 空亡及已核对的 21 种常见神煞，独立于评分 |
| `src/chenggu.js`、`src/data/chenggu.js` | 称骨四表、古歌、原创直接白话 |
| `src/chart-layout.js` | 本命与运年月日对照表的数据投影 |
| `src/report.js` | HTML、Markdown、连续折线与浏览器交互 |
| `src/plugin.js` | DSH 三个工具、缓存、输出裁剪、skill 注册 |
| `src/cli.js` | 命令行输入和用户指定目录的文件输出 |
| `skills/bazi/` | 模型操作指引与解读规则参考 |
| `cordis.patch.yml`、`package.json` | 插件 bundle、包入口、安装内容与兼容范围 |

主要数据流是 `normalizeInput → 网站请求（可选）→ calculateChart → analyzeChart → addSpecificConclusions`；再分别建立请求年份的 `timeline` 和完整展示范围的 `lifeTimeline`，计算独立的 `chenggu`，最后交给插件或 CLI。

完整报告契约为 `{schemaVersion,input,chart,analysis,timeline,lifeTimeline,chenggu,warnings,provenance}`。改字段前先检查报告渲染、插件投影与测试，不要把模型收到的紧凑摘要误当完整报告。

## 排盘事实与来源

- `provider: local` 完全本地；`website` 要求网站成功，否则报错；`auto` 尝试网站，失败后降级本地并在原始 JSON 留下原因。只有出生资料模式调用网站，四柱导入不反推唯一生日。
- 网站请求固定 POST 到 `https://zydx.top/paipan.php`，`save=0`，不登录、不带账户 Cookie、不执行网页脚本。第三方自己的访问日志不受本项目控制。
- 公农历输入先规范化为公历，再提交网站，避免农历入口忽略分钟。当前网站适配器已核查公历 1902—2038 年；本地出生年份接受 1901—2100 年。超出网站范围时，`auto` 可降级，`website` 必须失败。
- 网站成功时采用其四柱和可解析交运日，同时保留本地校验。网站和本地起运算法有已知日期差异，不能宣称两者完全一致；网站缺交运日时仍须明确记录本地来源。
- 当前按北京时间钟表时间、23 点换日、节令换月处理；地点只记档，没有自动地理编码、真太阳时、时区和夏令时换算。不要因为传入了城市就声称已作这些校正。
- 仅四柱可做本命分析；要形成准确大运，需要完整出生信息，或出生公历年加已核实的首次交运日期。只有出生年份不能确定起运。
- 年龄为 `公历流年 − 出生公历年 + 1` 的年度虚岁。内部日期比较使用统一的日历坐标，避免受运行机器的时区影响；这不表示将出生时间改成 UTC。
- `name`、`location` 不参与趋势评分。实际职业、婚恋和计划只用于 `contextYear` 对应的背景；未指定时取北京时间当前年。

## 0.1.5 总评规则

`analysis.overview` 包含 `pattern/career/marriage/wealth/summary`。总评由格局、事业、婚缘、财富四段组成；对应的十二方面条目复用同一结论，避免同一报告前后矛盾。

`conclusions.js` 从月令藏干中优先选择原局有同干透出的星，否则取本气，再结合透干、同干根气、根支受冲和制化条件。区分正官与七杀、食神与伤官；不能把同属一个十神组的星全部当作相同条件。职业结论区分平稳积累、波折较多、有转折、压力中进展和项目驱动，财务结论区分守财难、技能收入、负担偏重和逐步积累。

这个层只更新公开成文结果和解释证据，保留原 `analysis.pattern/strength/groups/relations`；`timeline.js` 仍使用基础分析计算。不要为了让文字更强硬去改历法事实、分数或 OHLC。直接调用基础 `analyzeChart` 不会得到完整的 0.1.5 总评；业务端应走 `createReading`。

婚缘规则需要特别保持以下边界：

1. 顺逆和早晚分别判断；传统配偶星取男命财星、女命官杀，并结合夫妻宫、透藏根气及制约。单一冲、藏星或时柱有星不直接等于晚婚。
2. 观察实际大运与流年重叠的 20—45 虚岁区间，每个候选段至少 90 天；交运前后的条件不能拼成同一“好年份”。
3. 窗口须满足运年同见配偶星，或配偶星与流年合夫妻宫同现，或原局配偶星有根且流年天干本身为配偶星并合日干；再排除运年直接冲刑害夫妻宫、运年彼此相冲。不能将年支本气的配偶星冒充与日干相合的天干。
4. 相邻连续年份只在同一大运且日期衔接时合并，每组最多三年，按时间保留前两组。没有合格段就不输出年龄，不固定套用 30 岁。
5. 首个窗口不晚于 25 岁且有早发结构才判偏早；首个窗口不早于 30 岁且有延后结构才判偏晚。其余只给窗口，不强贴早晚标签。
6. 已知已婚者转为夫妻相处批语，不再预测首次成婚；明确当前离异或已再婚等状态优先于过去婚龄。已知未婚或离异等状态只过滤背景年份以前的窗口，不把用户自述当原局证据。官杀混透只统计透干，不把藏干当作同时透出。

这些年龄界限、90 天门槛和筛选组合是本项目的明确解释规则，不是古籍逐字公式，也没有经过现实事件统计校准。当前根气、制化与格局识别仍是有限规则集，没有完整覆盖调候、从格、化气和所有流派。修改时应加入能区分规则前后行为的案例。

## 用户已经确认的报告形态

保留浅色背景、圆角与现有五行配色，内容布局参考周易大学。天干在上、地支在下，四柱纵向对齐；土用棕色，金用金黄色。展示十神、藏干、十二长生、空亡、已核实神煞和刑冲破害合，隐藏纳音。

本命区之后是运年月日与原局并列的对照表，用户可切换大运、流年、节气月和日期。交运年保留前后两步运，但只高亮当前选择；下方“某某运期间”、神煞、关系和交运说明必须随同一选择即时更新。0.1.4 曾修复这里先展示全年第一步运、与选择框不符的问题，连续重复点击也要回归检查。

称骨只放在本命盘底部：重量、评语原句、紧接的一行直接解读。不另设板块或导航；不用“这首诗写”等介绍式开头。通行四表、歌诀异文及历法取舍见 [称骨资料](chenggu-sources.md)，不能把称骨权重混进子平评分。

总评直接给判断，不出现“这盘的发展主线是”。术语只在确有解释价值时保留，并马上落到一般人能理解的生活表现。十二方面先给基于盘面的判断，再给建议；不要只写励志或泛化提醒。

| 内部 ID | 公开标题 | 内部传统维度 |
|---|---|---|
| pattern | 整体发展 | 格局层次 |
| career | 事业工作 | 官禄功名 |
| wealth | 收入积累 | 财禄丰啬 |
| family | 父母家人 | 六亲伦常 |
| relationship | 感情婚姻 | 婚姻妻室 |
| study | 学习考试 | 学业文名 |
| wellbeing | 身心状态 | 疾厄寿元 |
| mobility | 外出变动 | 迁徙驿马 |
| home | 住房家产 | 家宅田宅 |
| disputes | 合同纠纷 | 官非灾讼 |
| character | 性格做事 | 心性品行 |
| network | 人际合作 | 人际交友 |

章节名为“十二方面分析”。年度事件可以覆盖全部十二方面，哪些有异动就写哪些，不限于工作、外出和学习。每年只列零至四个重点月份，没有明显信号就不硬填；公开页面、Markdown 和模型结果不输出月度分数。

人生主图是逐年相连的折线，优先使用 `lifeTimeline`；默认出生年到出生后第八十年，含首尾共 81 点，指定更远结束年时延展。它与请求细批范围 `timeline` 分开。展示终点不按凶煞或称骨推定，也不暗示死亡年份。

原始 JSON 保留来源、版本、证据、内部提醒、六项数值、月度数据和 OHLC；常规用户报告隐藏这些调试信息。内部核验仍须保留，不要为追求直接语气补造用户经历、确切疾病、寿命或犯罪事实。真正影响结果的资料缺失或冲突用一句话说明即可。

## DSH 接口与缓存

| 工具 | 用途 |
|---|---|
| `bazi_reading` | 输入出生信息或四柱，返回 `reportId`、紧凑命盘、总评、十二方面、年度概览与最多五年情景预览 |
| `bazi_years` | 按同一 `reportId` 读取连续 1—10 年的细批、重点月份与干支，可访问完整人生范围 |
| `bazi_report` | 按 `reportId` 返回 HTML 或 Markdown 文本，不写文件；兼容完整 `report` 参数，但二者不可同时传 |

缓存为进程内最多八份、一小时有效的固定快照，重启、过期或淘汰即失效。不能以“最新命盘”替换失效 ID。缓存前先做 JSON 正规化，去掉 `undefined`，遵守 DSH 的 canonical JSON 输出契约。

工具通过 `ctx.tools.register` 注册，包含原始 JSON Schema、参数检查、`execute`、`output.schema` 与 `output.render`。不要返回旧式 `{content:[...]}` 冒充 canonical 值。取消信号从宿主传到网站请求，skill 的 `resourceBase` 必须指向安装包内真实目录。

DSH 兼容声明为 `>=0.2.2-rc.1 <0.3.0-0`。已做官方 rc.1 注册、调用、schema 与卸载检查；完整用户实例更新是另一项部署验收。现有 HTML 是独立报告，不是原生 DSH Client 面板，也不保证宿主自动预览任意 HTML 文本。

## 修改后怎样验收

```powershell
npm test
npm run demo
node scripts/verify-report-ui.js
npm pack
git diff --check
```

- `npm test` 不联网，覆盖历法边界、网站离线 fixture、年度分段、事件筛选、报告转义与隐藏字段、插件参数与缓存、具体结论等。测试数量与最近执行结果见 [validation.md](validation.md)。
- UI 脚本需要 Windows 已安装 Edge，当前默认路径为 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`。使用隔离的无界面浏览器 profile 检查桌面与手机，截图在 `reports/ui-check/`；仍须看图确认长总评排版。
- `npm run verify:website` 是可选联网核验，只提交代码里的虚构案例，固定不保存；离线测试通过不代表网站当天可用。
- `npm pack` 的 prepack 检查关键分发文件。安装包应在隔离目录再装一次，调用已安装 CLI 和插件；源码里运行成功不能替代包内资源齐全检查。
- 改解释或展示时，比较固定案例的四柱、大运、年度分、分项分、月分及 OHLC，防止表达层意外改变计算。不要只更新快照掩盖数值差异。
- 官方 rc.1 的可复现检查见 `scripts/verify-dsh-rc1.js`。它不在默认离线测试中，依赖单独安装到隔离目录，不加入插件的运行依赖。它检查官方 registry、bundle、版本范围、真实工具调用、输出 schema、skill 资源与卸载。

可选的 rc.1 原生检查步骤（先执行 `npm pack`，后续版本替换安装包名称）：

```powershell
npm install --prefix reports/rc1-check --save-exact --ignore-scripts --no-audit --no-fund @deepseek-ai/cordis@4.1.0 @deepseek-ai/dsh-app-boot@0.2.2-rc.1 @deepseek-ai/dsh-tools@0.2.2-rc.1 @deepseek-ai/dsh-skill@0.2.2-rc.1 @deepseek-ai/dsh-system-prompt@0.2.2-rc.1
npm install --prefix reports/install-check --ignore-scripts --no-audit --no-fund ./dsh-bazi-0.1.7.tgz
node scripts/verify-dsh-rc1.js
```

脚本也接受宿主依赖目录、已安装插件目录两个可选参数。验证产物在被忽略的 `reports/` 下；检查成功仍不代表完整 DSH CLI 或用户线上 profile 已启动。

## 发布与部署

发布前同步 `package.json`、`package-lock.json`、`src/service.js` 的 provenance 版本与 `CHANGELOG.md`，补齐验证记录，再打包、提交和打标签。具体命令见 [publishing.md](publishing.md)。GitHub 推送源码、创建 GitHub Release、发布 npm 包和更新 DSH 实例是不同动作，只记录实际完成的项目。

Web profile 本地安装入口为 `dsh plugin --profile web add "F:/Program/dsh/bazi"`；GitHub 安装使用 `github:wishprophet/dshbazi#固定提交或版本标签`。Desktop 使用应用内 Plugin Manager 或其自带 CLI，普通 npm CLI 不管理 Desktop profile。更新后如提示重启，重启对应实例再检查工具、skill 和一次完整调用。

已知用户实例为 `https://192.168.66.8:3443/`，需要登录；本地发布、SSH 推送和隔离 rc.1 检查都不能当作该实例已升级的证据。接手部署时先确认目标 profile 与当前插件版本，再按实际权限更新，不在仓库保存登录凭据。

`reports/`、`node_modules/`、打包文件、`.env` 和编辑器本地设置被忽略；凭据、SSH 私钥、真实命盘和个人资料不得放进源码目录。推送前检查 `git status`、暂存区和远程地址。用户已有的本地编辑器配置无需改写。

## 后续优先事项

1. 扩充能区分格局成败、制化是否有效、夫妻宫与配偶星组合的回归案例；保留正例与反例，再逐步细化规则。年龄观察范围不能被误解为人生绝对上限。
2. 继续核对节气、晚子时、交运日及网站与本地差异。网站 HTML 改版时先更新 fixture 和解析测试，不绕过校验以凑出结果。
3. 十二方面中未使用新总评层的条目仍沿用基础规则，可逐项细化直接批语；年度十二领域事件与六项趋势分是不同结构，不要强行一一映射。
4. 神煞目前只实现已核实的常见集合，不能声称完整复制网站；新增神煞先核实取法，默认只用于展示。
5. 若开放多用户服务，先给报告缓存增加会话归属与授权。随机 UUID 和进程内缓存不是完整的多租户隔离方案。

遇到“盘不准”先检查原始输入、实际 provider、网站本地校验和时间边界；遇到“批语太泛”检查 overview 及具体维度规则；遇到“切换不一致”检查浏览器选中状态和真实时间段；遇到“模型记错盘”检查 reportId、缓存失效和是否误传摘要。先定位层次，再修改对应模块。
