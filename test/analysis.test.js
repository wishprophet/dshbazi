import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, calculateChart, god } from '../src/calendar.js';
import { analyzeChart, chartColumns, tenGod, DIMENSIONS, STEMS } from '../src/analysis.js';
import { buildTimeline, parseCalendarDate } from '../src/timeline.js';

function fixture(overrides = {}) {
  const input = normalizeInput({ date: '2000-01-01', time: '12:34', gender: 'male', startYear: 2025, endYear: 2028, ...overrides });
  return { input, chart: calculateChart(input) };
}

test('analysis produces all twelve grounded dimensions and keeps tentative patterns', () => {
  const { chart, input } = fixture();
  const result = analyzeChart(chart, input);
  assert.deepEqual(result.dimensions.map(d => d.id), DIMENSIONS.map(d => d.id));
  for (const d of result.dimensions) {
    assert.ok(d.summary && d.publicTitle && d.publicAdvice && d.opportunities.length && d.cautions.length);
    assert.ok(d.evidence.every(e => e.ruleId && e.text));
  }
  assert.match(result.pattern.status, /候选/);
  assert.match(result.strength.method, /月令.*根气.*透出/);
  const clone = structuredClone(chart);
  clone.elementCounts = { 木: 900, 火: 0, 土: 0, 金: 0, 水: 0 };
  assert.deepEqual(analyzeChart(clone).strength, result.strength, 'surface element counts must not decide strength');
  assert.match(result.dimensions.find(d => d.id === 'wellbeing').cautions.join(''), /不能用于医学诊断/);
  const publicCopy = [result.summary, ...result.dimensions.flatMap(d => [d.publicTitle, d.summary, d.publicAdvice, ...d.opportunities])].join('\n');
  assert.doesNotMatch(publicCopy, /免责声明|规则集|接口|不推断疾病|不等于社会阶层|候选|旺衰|日主|月令/);
  assert.ok(result.summary.split('。').filter(Boolean).length >= 2);
});

test('analysis preserves calendar-provided hidden-stem order and facts', () => {
  const { chart } = fixture({ date: '1990-05-18', time: '09:00' });
  const mapped = chartColumns(chart);
  for (const column of chart.columns) {
    const actual = mapped.find(c => c.key === column.key);
    assert.deepEqual(actual.hiddenStems.map(h => [h.stem, h.element, h.god]), column.hiddenStems.map(h => [h.stem, h.element, h.god]));
    assert.equal(actual.naYin, column.naYin);
    assert.equal(actual.diShi, column.diShi);
  }
  assert.equal(tenGod('甲', '己'), '正财');
  assert.equal(tenGod('甲', '庚'), '七杀');
  assert.equal(tenGod('癸', '戊'), '正官');
  for (const day of STEMS) for (const stem of STEMS) assert.equal(tenGod(day, stem), god(day, stem), `${day}/${stem} must match the calendar authority`);
});

test('K candles derive OHLC exactly from real monthly values, reproducibly', () => {
  const { chart, input } = fixture();
  const timeline = buildTimeline(chart, input);
  assert.equal(timeline.available, true);
  assert.equal(timeline.coverageComplete, true);
  assert.equal(timeline.years.length, 4);
  assert.deepEqual(buildTimeline(chart, input), timeline);
  assert.deepEqual(buildTimeline(chart, { ...input, name: '另一个名字' }), timeline);
  for (const y of timeline.years) {
    assert.equal(y.months.length, 12);
    const points = y.months.map(m => m.score);
    assert.equal(y.open, points[0]);
    assert.equal(y.close, points[11]);
    assert.equal(y.high, Math.max(...points));
    assert.equal(y.low, Math.min(...points));
    assert.ok(y.high >= Math.max(y.open, y.close));
    assert.ok(y.low <= Math.min(y.open, y.close));
    for (const [domain, candle] of Object.entries(y.domainScores)) {
      const values = y.months.map(m => m.domainScores[domain]);
      assert.equal(candle.open, values[0]); assert.equal(candle.close, values[11]);
      assert.equal(candle.high, Math.max(...values)); assert.equal(candle.low, Math.min(...values));
    }
    for (const event of y.events) {
      assert.ok(event.condition && event.evidence.length && event.window.length && event.verification);
      assert.ok(event.publicTitle && event.reading);
      assert.doesNotMatch(event.reading, /证据|核验|验证方式|统计概率|启发式|模型|本规则集|支持主题|标记不适用/);
      assert.ok(event.reading.split('。').filter(Boolean).length <= 3);
    }
  }
});

test('a mid-month luck transition is split on its exact date', () => {
  const { chart, input } = fixture();
  const y = buildTimeline(chart, input).years.find(y => y.year === 2028);
  const month = y.months.find(m => m.segments.length > 1);
  assert.ok(month);
  assert.equal(month.transitionPrecision, 'date-segmented');
  assert.deepEqual(month.segments.map(s => s.daYun), ['甲戌', '癸酉']);
  assert.equal(month.segments[0].endDate, month.segments[1].startDate);
  assert.equal(parseCalendarDate(month.segments[0].endDate), parseCalendarDate('2028-03-15 10:34:00'));
  assert.ok(Math.abs(month.segments.reduce((s, m) => s + m.fraction, 0) - 1) < 1e-10);
  const weighted = Math.round(month.segments.reduce((s, m) => s + m.score * m.fraction, 0) * 10) / 10;
  assert.equal(month.score, weighted);
});

test('missing luck or monthly facts never produce a fabricated life curve', () => {
  const input = normalizeInput({ calendar: 'pillars', pillars: '己卯 丙子 戊午 戊午', gender: 'male' });
  const chart = calculateChart(input);
  assert.equal(buildTimeline(chart, input).available, false);
  assert.deepEqual(buildTimeline(chart, input).years, []);
  const complete = fixture();
  for (const cycle of complete.chart.luck.cycles) for (const year of cycle.years) if (year.year === 2026) year.months = year.months.slice(0, 11);
  const timeline = buildTimeline(complete.chart, complete.input);
  assert.equal(timeline.coverageComplete, false);
  assert.ok(timeline.incompleteYears.some(y => y.year === 2026));
  assert.ok(!timeline.years.some(y => y.year === 2026));
  assert.throws(() => buildTimeline(complete.chart, { ...complete.input, startYear: 2000, endYear: 2120 }), /120/);
});

test('real background changes scenarios only in its declared year, never scores', () => {
  const { chart, input } = fixture();
  const plain = buildTimeline(chart, input);
  const contextual = buildTimeline(chart, { ...input, contextYear: 2026, context: { occupation: '在读研究生', relationship: '单身', plans: '参加资格考试并提交论文，计划搬家' } });
  const chosen = contextual.years.find(y => y.year === 2026);
  assert.ok(chosen.events.some(e => e.domain === 'study' && e.backgroundApplied && /资格考试/.test(e.scenario)));
  assert.ok(!chosen.events.some(e => e.domain === 'relationship'));
  assert.ok(chosen.events.every(e => !e.backgroundApplied || e.contextScope.startYear === 2026));
  assert.deepEqual(contextual.years.find(y => y.year === 2025), plain.years.find(y => y.year === 2025));
  for (let i = 0; i < plain.years.length; i++) assert.deepEqual(contextual.years[i].months, plain.years[i].months);
  const retired = buildTimeline(chart, { ...input, contextYear: 2026, context: { occupation: '已经退休', plans: '装修房屋' } }).years.find(y => y.year === 2026);
  assert.ok(!retired.events.some(e => e.domain === 'career'));
  assert.ok(retired.events.some(e => e.domain === 'home' && e.backgroundApplied));
  assert.ok(retired.events.some(e => e.domain === 'home' && /装修/.test(e.publicTitle + e.reading)));
});

test('plain-language readings vary with chart structure and keep advice separate', () => {
  const first = fixture(), second = fixture({ date: '1990-05-18', time: '09:00' });
  const a = analyzeChart(first.chart, first.input), b = analyzeChart(second.chart, second.input);
  assert.notEqual(a.summary, b.summary);
  assert.ok(a.dimensions.filter((d, i) => d.summary !== b.dimensions[i].summary).length >= 3);
  assert.ok(a.dimensions.every(d => d.publicAdvice !== d.summary && !d.opportunities.includes(d.publicAdvice)));
});
