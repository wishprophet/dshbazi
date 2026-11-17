# 插件与 Skill 集成说明

## 结构

`src/plugin.js` 只负责 DSH 适配，`src/service.js` 是统一业务入口：

```js
import { createReading } from './service.js';
const report = await createReading(input, { provider: 'auto', signal });
```

核心报告契约为 `{ schemaVersion, input, chart, analysis, timeline, warnings, provenance }`。渲染由 `src/report.js` 的 `renderMarkdown(report)` 和 `renderHtml(report)` 负责。插件不自行写文件，CLI 才处理用户指定输出目录。

插件将完整报告写入进程内有界缓存（八份、一小时 TTL），用随机 UUID 标识固定快照。`bazi_reading` 的 canonical value 和模型内容均为紧凑投影，附 `reportId`；去掉大运下重复年份、网站原文及全部计分贡献，保留盘面、分析、年度摘要与最多五年情景。原始对象的可选 `undefined` 字段在缓存前经 JSON 正规化去掉，以符合 DSH 的 lossless JSON 输出契约。核心/CLI 仍返回完整报告。

`bazi_years` 每批读取一至十年，返回事件证据与十二个月简表，不再重复计分贡献。`bazi_report` 通过 ID 读取同一快照渲染，兼容直接传入完整 `report`；两种参数不可同时传。ID 过期或被淘汰时明确失败，不能退回其他命盘。缓存不落盘，重启后 ID 无效。

Host 插件导出 `name`、`inject`、`apply(ctx)`，使用 `inject: ['tools', 'skills']`。核心和 CLI 不导入 DSH；插件使用普通 `ToolDefinition` 对象注册，不依赖 `defineTool` 的运行时导入。

## 与官方 SDK 对齐

审阅的官方当前源码版本标识为 `0.2.2-rc.3`。以下是对源码契约的对齐，不代表已启动实际 DSH 做端到端测试：

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

Skill 负责约束计算事实、十二维度和具体流年写作。`analysis`/`timeline` 是规则输出，DSH 模型需要结合用户自述的职业、关系和计划补充情景。模型不能重算干支、补造起运、改写趋势分数，也不能把所有生活大事堆成模糊预测。

`bazi_report` 优先使用 `reportId`，不要求模型回传巨量 JSON。兼容模式中的 `report` 不证明该对象确实由计算服务产生，而且必须是核心/CLI 的完整报告，不能传 `bazi_reading` 的摘要。若将来开放多租户服务，应为缓存加入会话归属和授权，不能只靠持有 UUID。
