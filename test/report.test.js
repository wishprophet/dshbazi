import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createReading } from '../src/service.js';
import { renderHtml, renderMarkdown } from '../src/report.js';

const input = { date: '2000-01-01', time: '12:34', gender: 'male', name: '研读示例', startYear: 2025, endYear: 2028 };
function getPayload(html) {
  return JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
}

test('offline report renders the real reading, structured controls and valid scripts', async () => {
  const report = await createReading(input, { provider: 'local' });
  const html = renderHtml(report), markdown = renderMarkdown(report);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /id="domain"/); assert.match(html, /id="year"/); assert.match(html, /id="months"/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/);
  assert.match(html, /lunar-javascript@1\.7\.8/);
  assert.match(html, /本次采用本地历法库/);
  const data = getPayload(html);
  assert.equal(data.timeline.years.length, report.timeline.years.length);
  assert.deepEqual(data.timeline.years.map(y => [y.year, y.open, y.high, y.low, y.close]), report.timeline.years.map(y => [y.year, y.open, y.high, y.low, y.close]));
  for (const y of data.timeline.years) for (const m of y.months) {
    assert.ok(m.contributions.length <= 8);
    assert.ok(m.segments.every(s => !('contributions' in s)));
  }
  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) if (!match[1].includes('application/json')) assert.doesNotThrow(() => new vm.Script(match[2]));
  for (const d of report.analysis.dimensions) { assert.ok(html.includes(d.title)); assert.ok(markdown.includes(d.title)); }
  assert.match(markdown, /### 2028/); assert.match(markdown, /核对方式/); assert.match(markdown, /观察窗口/);
});

test('all user-controlled HTML and embedded JSON fields are escaped', async () => {
  const attack = '</script><img src=x onerror=alert(1)>';
  const report = await createReading({ ...input, name: attack, location: attack, contextYear: 2026, context: { occupation: '学生', relationship: attack, plans: '考试 ' + attack } }, { provider: 'local' });
  report.warnings.push(attack);
  report.provenance.website = { url: attack, fetchedAt: attack, save: false };
  // Ensure a dynamic-only field also cannot terminate its JSON script container.
  report.timeline.years[0].events[0].scenario = attack;
  const html = renderHtml(report), markdown = renderMarkdown(report);
  assert.equal((html.match(/<script\b/g) || []).length, 2);
  assert.equal((html.match(/<\/script>/g) || []).length, 2);
  assert.doesNotMatch(html, /<img src=x/);
  assert.ok(html.includes('&lt;/script&gt;&lt;img'));
  assert.equal(getPayload(html).timeline.years[0].events[0].scenario, attack);
  assert.doesNotMatch(markdown, /<img src=x/);
});

test('four-pillar-only report clearly omits invented timeline controls', async () => {
  const report = await createReading({ calendar: 'pillars', pillars: '己卯 丙子 戊午 戊午', gender: 'male' }, { provider: 'local' });
  const html = renderHtml(report), markdown = renderMarkdown(report);
  assert.match(html, /暂不生成完整人生曲线/);
  assert.doesNotMatch(html, /id="trend"/);
  assert.deepEqual(getPayload(html).timeline.years, []);
  assert.match(markdown, /暂不生成完整时间线/);
});
