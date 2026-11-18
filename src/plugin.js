import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createReading } from './service.js';
import { renderHtml, renderMarkdown } from './report.js';

/** Cordis supplies these services; the calculation core has no DSH dependency. */
export const name = 'bazi';
export const inject = ['tools', 'skills'];

const text = (description) => ({ type: 'string', description });
const year = (description) => ({ type: 'integer', description });
const reportKeys = ['schemaVersion', 'input', 'chart', 'analysis', 'timeline', 'warnings', 'provenance'];
const reportSchema = {
  type: 'object', additionalProperties: true, required: reportKeys,
  properties: Object.fromEntries(reportKeys.map(key => [key, {}])),
};

/** Raw ToolDefinition uses JSON Schema, not defineTool's authoring DSL. */
export const readingParameters = {
  type: 'object',
  additionalProperties: false,
  required: ['calendar', 'gender'],
  properties: {
    name: text('姓名或称呼，仅用于报告标识。'),
    gender: { type: 'string', enum: ['male', 'female'], description: '传统顺逆排运所用性别参数。' },
    location: text('出生地点；按用户原话传入，不编造经纬度或真太阳时修正。'),
    calendar: { type: 'string', enum: ['solar', 'lunar', 'pillars'], description: '公历、农历或直接输入四柱。' },
    date: text('solar/lunar 模式出生日期 YYYY-MM-DD；农历模式为农历年月日。'),
    time: text('出生钟表时间 HH:mm，使用中国标准时间；未知时不能自行填 12:00。'),
    leapMonth: { type: 'boolean', description: '农历是否闰月；只有 lunar 模式使用。' },
    pillars: {
      type: 'object', additionalProperties: false, required: ['year', 'month', 'day', 'hour'],
      description: 'pillars 模式的年、月、日、时四个干支；不据此虚构出生日期。',
      properties: { year: text('年柱，如甲子'), month: text('月柱，如丙寅'), day: text('日柱，如戊辰'), hour: text('时柱，如壬子') },
    },
    birthYear: year('已知出生公历年份，用于直接四柱模式的年龄定位。'),
    startLuckDate: text('已经核实的起运日期 YYYY-MM-DD；不得由模型猜测。'),
    startYear: year('细批开始公历年份。'),
    endYear: year('细批结束公历年份。'),
    contextYear: year('现实背景对应的公历年份，省略时有背景则默认北京时间当年；不要把现在的情况套用于整个人生。'),
    context: {
      type: 'object', additionalProperties: false,
      description: '仅写用户提供的现实背景，用于具体情景解释。',
      properties: { occupation: text('职业/学业现状'), relationship: text('婚恋/家庭现状'), plans: text('当前打算或关注事项') },
    },
    provider: { type: 'string', enum: ['auto', 'website', 'local'], description: 'auto 默认网站免登录不保存排盘，失败本地降级；local 完全本地；website 不静默替换来源。' },
  },
};

function invalid(message) {
  const error = new TypeError(`bazi_reading: ${message}`);
  error.code = 'INVALID_ARGS';
  throw error;
}

// Raw ToolDefinition validates its own arguments; only the small JSON Schema
// vocabulary used above is needed here. Domain/date checks remain in service.js.
function check(value, schema, path = 'input') {
  if (!schema.type) return;
  if (schema.type === 'object') {
    if (value === null || Array.isArray(value) || typeof value !== 'object') invalid(`${path} 必须是对象`);
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) invalid(`${path}.${key} 缺失`);
    for (const key of Object.keys(value)) {
      const child = Object.hasOwn(schema.properties ?? {}, key) ? schema.properties[key] : undefined;
      if (child) check(value[key], child, `${path}.${key}`);
      else if (schema.additionalProperties === false) invalid(`不支持参数 ${path}.${key}`);
    }
  } else if (schema.type === 'integer') {
    if (!Number.isSafeInteger(value)) invalid(`${path} 必须是整数`);
  } else if (typeof value !== schema.type) invalid(`${path} 必须是 ${schema.type}`);
  if (schema.enum && !schema.enum.includes(value)) invalid(`${path} 的值不支持`);
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('操作已取消', 'AbortError');
}

/** A report ID always identifies one immutable snapshot, never a 'latest chart'. */
export function createReportStore({ capacity = 8, ttlMs = 60 * 60 * 1000, now = Date.now } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(ttlMs) || ttlMs <= 0) throw new TypeError('报告缓存容量和有效期必须为正数');
  const entries = new Map();
  const expire = () => {
    const timestamp = now();
    for (const [id, entry] of entries) if (entry.expiresAt <= timestamp) entries.delete(id);
  };
  return {
    put(report) {
      expire();
      const reportId = randomUUID();
      // Service objects may contain optional undefined fields. The SDK's
      // canonical value must be lossless JSON, and the cache must be detached.
      const snapshot = JSON.parse(JSON.stringify({ ...report, reportId }));
      entries.set(reportId, { report: snapshot, expiresAt: now() + ttlMs });
      while (entries.size > capacity) entries.delete(entries.keys().next().value);
      return structuredClone(snapshot);
    },
    get(reportId) {
      expire();
      const entry = entries.get(reportId);
      if (!entry) {
        const error = new Error('报告ID不存在、已过期或已被缓存淘汰；请重新调用 bazi_reading，不要改用其他人的报告。');
        error.code = 'REPORT_NOT_FOUND';
        throw error;
      }
      return structuredClone(entry.report);
    },
    clear() { entries.clear(); },
    get size() { expire(); return entries.size; },
  };
}

const defaultStore = createReportStore();
const currentChinaYear = () => Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date()));
const pick = (value, keys) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));

function yearDetail(row, includeMonths = true) {
  const result = pick(row, ['year', 'age', 'ganZhi', 'daYun', 'score', 'domainScores', 'summary', 'changeLevel', 'events', 'focusMonths']);
  result.events=(row.events??[]).map(({monthlySupport,...event})=>event);
  if (includeMonths) result.months = (row.months ?? []).map(month => pick(month, ['index', 'ganZhi', 'jie', 'startDate', 'endDate', 'daYun']));
  return result;
}

/** A bounded projection: no nested cycle-year copies, raw HTML or contributions. */
export function readingModelView(report) {
  const chart = report.chart ?? {}, analysis = report.analysis ?? {}, timeline = report.lifeTimeline ?? report.timeline ?? {};
  const years = timeline.years ?? [];
  const recent = years.filter(row => row.year >= report.previewYear).slice(0, 5);
  const details = (recent.length ? recent : years.slice(-5)).map(row => yearDetail(row, false));
  return {
    schemaVersion: report.schemaVersion,
    reportId: report.reportId,
    input: report.input,
    ...(report.chenggu ? { chenggu: pick(report.chenggu, ['available', 'title', 'weight', 'verse', 'translation', 'reason']) } : {}),
    chart: {
      ...pick(chart, ['pillars', 'dayMaster', 'columns', 'solarDateTime', 'lunarDate', 'gender', 'birthYear', 'location', 'elementCounts', 'relationships', 'calendarPolicy', 'source', 'validation']),
      luck: { ...pick(chart.luck, ['available', 'reason', 'forward', 'startDate', 'startAge', 'source', 'localStartDate']), cycles: (chart.luck?.cycles ?? []).map(cycle => pick(cycle, ['index', 'ganZhi', 'startDate', 'endDate', 'startAge', 'endAge'])) },
    },
    analysis: {
      ...pick(analysis, ['version', 'summary', 'pattern', 'strength', 'methodology', 'limitations']),
      ...(analysis.overview?{overview:analysis.overview}:{}),
      dimensions: (analysis.dimensions ?? []).map(dimension => ({ ...pick(dimension, ['id', 'title', 'publicTitle', 'headline', 'summary', 'publicAdvice', 'opportunities', 'cautions']), evidence: (dimension.evidence ?? []).slice(0, 2) })),
    },
    timeline: {
      ...pick(timeline, ['available', 'reason', 'version', 'method', 'scoreMeaning', 'range', 'displayRange', 'eventDomains', 'ageConvention', 'warnings', 'limitations', 'incompleteYears', 'coverageComplete']),
      annualSummaries: years.map(row => `${row.year}年｜${row.age ?? '?'}岁｜${row.ganZhi}｜大运${row.daYun}｜参考分${row.score}｜${(row.events ?? []).map(event => event.publicTitle ?? event.title).join('；')}`),
      previewYears: details,
    },
    warnings: report.warnings,
    provenance: { ...pick(report.provenance, ['plugin', 'version', 'calendarLibrary', 'requestedProvider', 'actualProvider', 'interpretation']), website: report.provenance?.website ? pick(report.provenance.website, ['url', 'fetchedAt', 'save']) : null },
    nextStep: '完整报告已缓存1小时（最多8份）。细批指定年份用 bazi_years({reportId,startYear,endYear})，每批最多10年；导出文本用 bazi_report({reportId,format})。缺失年份不可补造。',
  };
}

export function createReadingTool({ read = createReading, store = defaultStore, previewYear = currentChinaYear } = {}) {
  return {
    name: 'bazi_reading',
    description: '准确计算四柱、大运、流年，返回十二维度传统规则分析及可追溯人生趋势数据。先调用本工具再解读；不能修改盘面、起运、年份和分数，也不能把规则分数当事件概率。',
    parameters: readingParameters,
    output: {
      schema: reportSchema,
      render(_args, value) {
        return [{ type: 'text', text: `以下为内部排盘资料。面向用户用日常语言给出总评和具体批语，优先使用 summary、publicTitle、reading；不输出规则编号、技术口径、来源版本或成段免责声明。数值不得改写；年度细节按ID分批读取：\n${JSON.stringify(value)}` }];
      },
    },
    async execute(args, exec = {}) {
      check(args, readingParameters);
      if (args.calendar === 'pillars' && !args.pillars) invalid('pillars 模式需要完整四柱');
      if (args.calendar !== 'pillars' && (!args.date || !args.time)) invalid('公历/农历模式需要 date 和 time');
      if (args.startYear !== undefined && args.endYear !== undefined && args.startYear > args.endYear) invalid('startYear 不能晚于 endYear');
      abortIfNeeded(exec.signal);
      const { provider = 'auto', ...input } = args;
      const report = await read(input, { provider, signal: exec.signal });
      abortIfNeeded(exec.signal);
      return readingModelView(store.put({ ...report, previewYear: previewYear() }));
    },
  };
}

export function createReportTool({ html = renderHtml, markdown = renderMarkdown, store = defaultStore } = {}) {
  const parameters = {
    type: 'object', additionalProperties: false, required: ['format'],
    properties: { reportId: text('bazi_reading 返回的报告ID，优先使用；不要重抄巨量JSON。'), report: reportSchema, format: { type: 'string', enum: ['html', 'markdown'] } },
  };
  return {
    name: 'bazi_report',
    description: '用 reportId 将缓存的原始报告渲染为 HTML 或 Markdown 文本；仅在用户需要完整报告时调用。也兼容直接传 report（两者只能选一个）。不写文件。',
    parameters,
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args, exec = {}) {
      check(args, parameters);
      abortIfNeeded(exec.signal);
      if (Boolean(args.reportId) === Boolean(args.report)) invalid('bazi_report 需要且只能提供 reportId 或 report');
      const report = args.reportId ? store.get(args.reportId) : args.report;
      return args.format === 'html' ? html(report) : markdown(report);
    },
  };
}

export function createYearsTool({ store = defaultStore } = {}) {
  const parameters = {
    type: 'object', additionalProperties: false, required: ['reportId', 'startYear', 'endYear'],
    properties: { reportId: text('本人的 bazi_reading 报告ID。'), startYear: year('首个公历年份。'), endYear: year('末个公历年份（含），一次最多10年。') },
  };
  return {
    name: 'bazi_years',
    description: '按报告ID读取指定年份的十二领域异动、重点月份及干支资料，每批最多10年。只列有信号的月份，不输出月度评分。',
    parameters,
    output: { schema: { type: 'object', additionalProperties: true }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec = {}) {
      check(args, parameters);
      if (args.endYear < args.startYear || args.endYear - args.startYear >= 10) invalid('bazi_years 每批须为连续1—10年');
      abortIfNeeded(exec.signal);
      const report = store.get(args.reportId);
      const timeline = report.lifeTimeline ?? report.timeline;
      const rows = timeline?.years ?? [];
      const years = rows.filter(row => row.year >= args.startYear && row.year <= args.endYear).map(row => yearDetail(row));
      const found = new Set(years.map(row => row.year));
      const missingYears = Array.from({ length: args.endYear - args.startYear + 1 }, (_, index) => args.startYear + index).filter(y => !found.has(y));
      return {
        reportId: args.reportId, subject: pick(report.input, ['name', 'date', 'time', 'calendar', 'pillars']),
        available: timeline?.available ?? false, years, missingYears,
        eventDomains: timeline?.eventDomains ?? [],
        reason: timeline?.reason ?? null,
        scoreMeaning: timeline?.scoreMeaning ?? '传统规则参考指数，不是概率。',
        warnings: report.warnings ?? [],
      };
    },
  };
}

export function apply(ctx) {
  const skillUrl = new URL('../skills/bazi/SKILL.md', import.meta.url);
  const raw = readFileSync(skillUrl, 'utf8');
  const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const store = createReportStore();
  ctx.tools.register(createReadingTool({ store }));
  ctx.tools.register(createReportTool({ store }));
  ctx.tools.register(createYearsTool({ store }));
  ctx.skills.register({
    name: 'bazi',
    description: '八字排盘、十二方面总体分析、结合实际情况的逐年细批，以及人生趋势折线；调用排盘工具后，用日常语言给出批语。',
    source: 'runtime',
    path: fileURLToPath(skillUrl),
    resourceBase: { kind: 'directory', path: fileURLToPath(new URL('../skills/bazi/', import.meta.url)) },
    content,
  });
}
