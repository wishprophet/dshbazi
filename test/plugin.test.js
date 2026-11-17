import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { apply, inject, createReadingTool, createReportTool, createReportStore, createYearsTool } from '../src/plugin.js';

const input = { name: '测试案例', gender: 'male', calendar: 'solar', date: '1990-06-15', time: '09:30', location: '重庆' };
const report = { schemaVersion: '1', input, chart: {}, analysis: {}, timeline: { years: [] }, warnings: [], provenance: {} };

test('plugin registers raw tools and a packaged skill without executing a reading', () => {
  const tools = [], skills = [];
  apply({ tools: { register: tool => tools.push(tool) }, skills: { register: skill => skills.push(skill) } });
  assert.deepEqual(inject, ['tools', 'skills']);
  assert.deepEqual(tools.map(tool => tool.name), ['bazi_reading', 'bazi_report', 'bazi_years']);
  for (const tool of tools) {
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.output.render, 'function');
    assert.equal(typeof tool.execute, 'function');
    assert.ok(tool.output.schema.type);
    assert.doesNotThrow(() => JSON.stringify(tool.parameters));
  }
  assert.equal(skills[0].name, 'bazi');
  assert.equal(skills[0].resourceBase.kind, 'directory');
  assert.ok(existsSync(skills[0].path));
  assert.ok(existsSync(join(skills[0].resourceBase.path, 'references', 'interpretation.md')));
  assert.ok(!skills[0].content.startsWith('---'));
});

test('reading passes provider and cancellation separately and caches the original report', async () => {
  const controller = new AbortController();
  const store = createReportStore();
  let seen;
  const tool = createReadingTool({ read: async (...args) => { seen = args; return report; }, store, previewYear: () => 2026 });
  const result = await tool.execute({ ...input, provider: 'local' }, { signal: controller.signal });
  assert.ok(result.reportId);
  assert.deepEqual(store.get(result.reportId), { ...report, reportId: result.reportId, previewYear: 2026 });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
  assert.deepEqual(seen[0], input);
  assert.equal(seen[1].provider, 'local');
  assert.strictEqual(seen[1].signal, controller.signal);
  const blocks = tool.output.render(input, result);
  assert.ok(blocks.every(block => block.type === 'text'));
  assert.ok(blocks[0].text.includes(JSON.stringify(result)));
});

test('reading defaults to auto and allows direct pillars with missing luck metadata', async () => {
  const args = { gender: 'male', calendar: 'pillars', pillars: { year: '甲子', month: '丙寅', day: '戊辰', hour: '庚申' } };
  let seen;
  const tool = createReadingTool({ read: async (...values) => { seen = values; return report; } });
  await tool.execute(args);
  assert.deepEqual(seen[0], args);
  assert.equal(seen[1].provider, 'auto');
  assert.ok(!Object.hasOwn(seen[0], 'startLuckDate'));
});

test('raw tool rejects malformed or unsupported input before calculation', async () => {
  let calls = 0;
  const tool = createReadingTool({ read: async () => { calls++; return report; } });
  for (const invalid of [
    null, { ...input, gender: 'unknown' }, { ...input, time: undefined },
    { ...input, outputPath: 'C:/unrelated/report.html' },
    { ...input, context: { occupation: 42 } },
    { ...input, startYear: 2030, endYear: 2020 },
    { calendar: 'pillars', gender: 'male' },
    { ...input, provider: 'external' },
    { ...input, ...JSON.parse('{"__proto__":{"unexpected":true}}') },
  ]) await assert.rejects(tool.execute(invalid), { code: 'INVALID_ARGS' });
  assert.equal(calls, 0);
});

test('cancelled reading never invokes calculator and late cancellation is preserved', async () => {
  const before = new AbortController();
  before.abort(new Error('cancelled before calculation'));
  let calls = 0;
  const first = createReadingTool({ read: async () => { calls++; return report; } });
  await assert.rejects(first.execute(input, { signal: before.signal }), /cancelled before/);
  assert.equal(calls, 0);
  const after = new AbortController();
  const second = createReadingTool({ read: async () => { after.abort(new Error('cancelled during calculation')); return report; } });
  await assert.rejects(second.execute(input, { signal: after.signal }), /cancelled during/);
});

test('report is a pure formatter and execute works detached from its definition', async () => {
  const tool = createReportTool({ html: value => `html:${value.schemaVersion}`, markdown: value => `md:${value.schemaVersion}` });
  const execute = tool.execute;
  assert.equal(await execute({ report, format: 'html' }), 'html:1');
  assert.equal(await execute({ report, format: 'markdown' }), 'md:1');
  await assert.rejects(execute({ report: {}, format: 'html' }), { code: 'INVALID_ARGS' });
  await assert.rejects(execute({ report, format: 'pdf' }), { code: 'INVALID_ARGS' });
  await assert.rejects(execute({ report, format: 'html', outputPath: '/tmp/report.html' }), { code: 'INVALID_ARGS' });
});

test('report IDs remain isolated; cache copies cannot change another reading', async () => {
  const store = createReportStore();
  const first = store.put(report);
  const second = store.put({ ...report, input: { ...input, name: '第二命盘' } });
  assert.notEqual(first.reportId, second.reportId);
  first.input.name = '客户端改写';
  const clone = store.get(second.reportId);
  clone.input.name = '另一次改写';
  const tool = createReportTool({ store, html: value => value.input.name });
  assert.equal(await tool.execute({ reportId: first.reportId, format: 'html' }), input.name);
  assert.equal(await tool.execute({ reportId: second.reportId, format: 'html' }), '第二命盘');
  await assert.rejects(tool.execute({ reportId: 'not-an-id', format: 'html' }), { code: 'REPORT_NOT_FOUND' });
  await assert.rejects(tool.execute({ reportId: first.reportId, report, format: 'html' }), { code: 'INVALID_ARGS' });
});

test('cache retains at most eight reports and expires after one hour', () => {
  let timestamp = 0;
  const store = createReportStore({ now: () => timestamp });
  const ids = Array.from({ length: 9 }, () => store.put(report).reportId);
  assert.equal(store.size, 8);
  assert.throws(() => store.get(ids[0]), { code: 'REPORT_NOT_FOUND' });
  timestamp = 60 * 60 * 1000 - 1;
  assert.equal(store.get(ids[8]).input.name, input.name);
  timestamp++;
  assert.throws(() => store.get(ids[8]), { code: 'REPORT_NOT_FOUND' });
  assert.equal(store.size, 0);
});

function largeReport() {
  const years = Array.from({ length: 120 }, (_, index) => ({
    year: 1990 + index, age: index + 1, ganZhi: '丙午', daYun: '丁未', score: 50.1,
    events: [{ title: '职责调整', scenario: '参与项目交接', evidence: [{ ruleId: 'case', text: '有据可查' }] }],
    months: Array.from({ length: 12 }, (_, month) => ({
      index: month, ganZhi: '庚寅', score: 50.2, startDate: '2026-02-04', endDate: '2026-03-05',
      domainScores: { career: 51.3 }, contributions: [{ text: 'DETAIL_MUST_NOT_ENTER_MODEL'.repeat(50) }],
      segments: [{ contributions: [{ text: 'SEGMENT_MUST_NOT_ENTER_MODEL' }] }],
    })),
  }));
  return { ...report, timeline: { available: true, reason: undefined, years }, chart: { luck: { available: true, cycles: [{ ganZhi: '丁未', years }] } } };
}

test('reading canonical value is compact and detailed years preserve actual scores', async () => {
  const full = largeReport();
  const store = createReportStore();
  const tool = createReadingTool({ read: async () => full, store, previewYear: () => 2026 });
  const compact = await tool.execute(input);
  const serialized = JSON.stringify(compact);
  assert.ok(serialized.length < 25000);
  assert.equal(compact.timeline.annualSummaries.length, 120);
  assert.deepEqual(compact.timeline.previewYears.map(row => row.year), [2026, 2027, 2028, 2029, 2030]);
  assert.ok(!serialized.includes('MUST_NOT_ENTER_MODEL'));
  assert.ok(!serialized.includes('contributions'));
  assert.ok(!compact.chart.luck.cycles[0].years);
  assert.equal(store.get(compact.reportId).timeline.years.length, 120);
  assert.deepEqual(JSON.parse(serialized), compact);
  const yearsTool = createYearsTool({ store });
  const details = await yearsTool.execute({ reportId: compact.reportId, startYear: 2026, endYear: 2035 });
  assert.equal(details.years.length, 10);
  assert.equal(details.years[0].months.length, 12);
  assert.equal(details.years[0].months[0].score, full.timeline.years[36].months[0].score);
  assert.deepEqual(details.years[0].events, full.timeline.years[36].events);
  assert.ok(!JSON.stringify(details).includes('contributions'));
  await assert.rejects(yearsTool.execute({ reportId: compact.reportId, startYear: 2026, endYear: 2036 }), { code: 'INVALID_ARGS' });
  const absent = await yearsTool.execute({ reportId: compact.reportId, startYear: 1988, endYear: 1991 });
  assert.deepEqual(absent.missingYears, [1988, 1989]);
  assert.deepEqual(absent.years.map(row => row.year), [1990, 1991]);
});
