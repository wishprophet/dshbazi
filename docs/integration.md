# 插件与 Skill 集成说明

## 结构

`src/plugin.js` 只负责 DSH 适配，`src/service.js` 是统一业务入口：

```js
import { createReading } from './service.js';
const report = await createReading(input, { provider: 'auto', signal });
```

核心报告契约为 `{ schemaVersion, input, chart, analysis, timeline, lifeTimeline, chenggu, warnings, provenance }`。`timeline` 保留请求的细批年份；`lifeTimeline` 覆盖出生年起八十年，或用户明确指定的更远结束年。`chart.luck` 同样覆盖完整展示范围。渲染由 `src/report.js` 负责；插件不自行写文件，CLI 处理用户指定输出目录。

插件将完整报告写入进程内有界缓存（八份、一小时 TTL），用随机 UUID 标识固定快照。`bazi_reading` 的 canonical value 和模型内容均为紧凑投影，附 `reportId`；去掉大运下重复年份、网站原文及全部计分贡献，保留盘面、分析、年度摘要与最多五年情景。原始对象的可选 `undefined` 字段在缓存前经 JSON 正规化去掉，以符合 DSH 的 lossless JSON 输出契约。核心/CLI 仍返回完整报告。

`bazi_years` 每批读取一至十年，返回十二领域中筛出的事件、`focusMonths` 重点月份和不含月分的干支简表，不重复计分贡献。它可读取完整 `lifeTimeline` 中的年份。`bazi_report` 通过 ID 读取同一快照渲染，兼容直接传入完整 `report`；两种参数不可同时传。ID 过期或被淘汰时明确失败，不能退回其他命盘。缓存不落盘，重启后 ID 无效。

Host 插件导出 `name`、`inject`、`apply(ctx)`，使用 `inject: ['tools', 'skills']`。核心和 CLI 不导入 DSH；插件使用普通 `ToolDefinition` 对象注册，不依赖 `defineTool` 的运行时导入。

## 与官方 SDK 对齐

已审阅 `0.2.2-rc.3` 源码，并针对用户运行的 `0.2.2-rc.1` 使用其官方发布包做隔离兼容验证：Cordis 加载、ToolsService 与 SkillRegistry 注册、原生插件兼容检查与 bundle patch 解析均通过。插件范围调整为 `>=0.2.2-rc.1 <0.3.0-0`。这不表示已更新用户远程实例。

1. `ctx.tools.register()` 接受 `ToolDefinition`；对象必须有 `name`、`description`、原始 JSON Schema `parameters`、`execute(args, exec)`、`output: { schema, render }`。不能把 `defineTool` 的参数简写格式直接当成原始 schema。
2. 原始工具自己验证参数。`bazi_reading` 在派发业务计算前检查类型、枚举、未知字段和必要输入，领域层继续校验日期与干支。
3. `execute` 返回 canonical JSON 值，`output.render` 返回模型可见的内容块。不能返回旧式 `{ content: [...] }` 冒充 canonical 报告。
4. 取消信号通过 `exec.signal` 传给业务服务；在取消前后均保留取消结果。不声明无法保证的并发或超时属性。
5. `ctx.skills.register()` 注册 `bazi`，给出内容和真实 `resourceBase`，支持读取随包的 `references/interpretation.md`。

参考：[ToolDefinition 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/tools.md)、[工具 registry 源码](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/tools/src/index.ts)、[Skill registry 文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md)。

插件不需要把 `@deepseek-ai/dsh` 或其整套服务作为普通依赖安装一份。实际服务由 DSH profile 提供，`engines.dsh` 声明目标版本；若未来增加 SDK 类型检查或运行时导入，再为所使用的包声明与宿主匹配的 peer/dev dependency。

## 包与安装

发布包需保留：`src/`、`skills/bazi/SKILL.md`、引用文件、`cordis.patch.yml`、README、许可证以及声明的图标/本地化资源。`package.json` 的 `dsh.bundle.patch` 指向 patch；patch 加载包名 `dsh-bazi`。安装由 DSH Plugin Manager 或对应 profile 的官方 CLI 完成。

本地 npm 测试验证模拟 registry 注册、参数拒绝、provider 选择、信号转发、数值保留、报告纯渲染、资源路径、缓存容量/过期/命盘隔离、以及一百二十年报告的上下文裁剪。真实 DSH 集成验收需要另外确认：工具和 skill 出现在当前会话，能完成一次本地排盘，再测试网站与降级路径，最后卸载插件确认注册项消失。未完成这一步时不得报告“已在你的 DSH 安装成功”。

## 解读流程

Skill 负责内部核对计算事实，再生成生活化的公开批语。现实背景严格限定在 `contextYear` 本年；未指定时由输入规范化使用北京时间当年。相邻年份、幼年和远期年份都不直接套用现有职业、关系与计划。模型不能重算干支、补造起运或改写趋势分数。

### 0.1.3 的公开展示

HTML、Markdown 与模型最终回答以普通读者为对象：开头给直接总评，十二维度使用生活化标题，流年写成具体短句。维度优先采用 `publicTitle`、`summary`、`publicAdvice`、`opportunities`；事件优先采用 `publicTitle`、`reading`。这些字段负责表达，内部 ID 和证据结构继续保留。

常规正文不输出算法来源、版本、规则编号、技术口径、“格局候选”术语、`cautions`/`limitations` 等内部提示，也不机械附上适用条件、反证清单或免责声明。只有缺信息或实质冲突影响结果时，用一句话说明需要补充的资料。用户专门追问依据时，再展开对应数据。

内部检查仍需审阅证据、冲突和条件，避免把未知背景写成事实或为追求直接语气虚构疾病、寿命、犯罪等结论。这些是生成流程约束，不是公开报告末尾的提醒段落。

命盘区隐藏纳音，采用四柱为列、十神与藏干等字段为行的本命表格；运年对照表显示大运、流年、流月、流日与本命，保留交运日期。称骨重量、评语原句、直接解读作为本命盘底部三行，不设独立模块。称骨权重不参与子平评分，资料来源见 `chenggu-sources.md`。

`chart-layout.js` 将历法事实投影为独立 HTML 的对照表数据。流月取原始节气区间；流日按本地历法库核定的干支日锚逐日递推，日期选择按当日中午定位所属节气月，选中月的起止时刻仍完整展示。交运当天保留当日覆盖的前后大运。六十甲子展示事实查表避免向页面装入额外运行时依赖。

`display-facts.js` 提供空亡与已核对的 21 种常见神煞，独立于评分与事件判断。已与三份周易大学结果及用户截图中的本命、运年资料比对；不声称穷尽该站所有杂煞。文昌使用甲见巳、乙见午的分开匹配；未照抄网站的合并匹配偏差。其余具体取法和查阅来源记录在模块注释中。

人生主图优先连接 `lifeTimeline.years[].score`，从出生年起展示完整时间范围；旧报告仍可回退到 `timeline`。固定展示终点与任何寿命判断无关。年度 `events` 从十二领域筛选，`focusMonths` 只列突出月份，公开页面及模型结果不输出月度评分。内部月分、OHLC 和计分贡献继续保留用于计算与复核。

`bazi_report` 优先使用 `reportId`，不要求模型回传巨量 JSON。兼容模式中的 `report` 不证明该对象确实由计算服务产生，而且必须是核心/CLI 的完整报告，不能传 `bazi_reading` 的摘要。若将来开放多租户服务，应为缓存加入会话归属和授权，不能只靠持有 UUID。
