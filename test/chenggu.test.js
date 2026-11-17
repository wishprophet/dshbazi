import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, calculateChart } from '../src/calendar.js';
import { calculateChenggu, CHENGGU_TABLES, CHENGGU_VERSES, weightText } from '../src/chenggu.js';

const birth = values => normalizeInput({ gender: 'male', calendar: 'lunar', time: '00:00', ...values });

test('common four-table fixture totals exactly and returns four original lines', () => {
  // Published arithmetic example: 辛亥正月初一子时 = 17 + 6 + 5 + 16.
  const r = calculateChenggu(birth({ date: '1971-01-01' }));
  assert.equal(r.weight.qian, 44);
  assert.equal(r.weight.totalText, '四两四钱');
  assert.deepEqual(r.weight.parts.map(p => p.qian), [17, 6, 5, 16]);
  assert.deepEqual(r.verse, ['万事由天莫苦求', '须知福禄胜前途', '当年财帛难如意', '晚景欣然便不忧']);
  assert.ok(r.translation.includes('诗中'));
  const solarExample = calculateChenggu(birth({ calendar: 'solar', date: '2000-01-01', time: '12:34' }));
  assert.equal(solarExample.lunar.dateText, '一九九九年冬月廿五');
  assert.deepEqual(solarExample.weight.parts.map(p => p.qian), [19, 9, 15, 10]);
  assert.equal(solarExample.weight.qian, 53);
});

test('lunar year is bounded by New Year, independently of the BaZi LiChun year', () => {
  const between = birth({ calendar: 'solar', date: '2024-02-05', time: '12:00' });
  assert.equal(calculateChart(between).pillars.year, '甲辰');
  assert.equal(calculateChenggu(between).lunar.yearGanZhi, '癸卯');
  assert.equal(calculateChenggu(between).weight.parts[0].qian, 12);
  const afterNewYear = birth({ calendar: 'solar', date: '2024-02-10', time: '12:00' });
  assert.equal(calculateChenggu(afterNewYear).lunar.yearGanZhi, '甲辰');
  assert.equal(calculateChenggu(afterNewYear).weight.parts[0].qian, 8);
  const beforeLiChun = birth({ calendar: 'solar', date: '2023-01-23', time: '12:00' });
  assert.equal(calculateChart(beforeLiChun).pillars.year, '壬寅');
  assert.equal(calculateChenggu(beforeLiChun).lunar.yearGanZhi, '癸卯');
});

test('late Zi changes the hour weight but preserves the civil lunar date', () => {
  const evening = calculateChenggu(birth({ date: '2024-01-01', time: '22:59' }));
  const lateZi = calculateChenggu(birth({ date: '2024-01-01', time: '23:30' }));
  const nextDay = calculateChenggu(birth({ date: '2024-01-02', time: '00:30' }));
  assert.equal(evening.lunar.hourBranch, '亥');
  assert.equal(lateZi.lunar.hourBranch, '子');
  assert.equal(lateZi.lunar.day, 1);
  assert.equal(nextDay.lunar.day, 2);
  assert.equal(lateZi.weight.qian - evening.weight.qian, 10);
  assert.equal(nextDay.weight.qian - lateZi.weight.qian, 5);
});

test('leap month uses the same month table throughout, including after day fifteen', () => {
  const leap = calculateChenggu(birth({ date: '2023-02-16', leapMonth: true }));
  const ordinary = calculateChenggu(birth({ date: '2023-02-16' }));
  assert.equal(leap.lunar.leapMonth, true);
  assert.equal(leap.weight.parts[1].value, '闰二月');
  assert.equal(leap.weight.parts[1].qian, 7);
  assert.equal(leap.weight.qian, ordinary.weight.qian);
  assert.equal(leap.provenance.policy.leapMonth, '闰月整月使用同名月份的月重');
});

test('all reachable weights have a verse, including the exact minimum and maximum', () => {
  assert.deepEqual(Object.values(CHENGGU_TABLES).map(t => t.length), [60, 12, 30, 12]);
  assert.equal(calculateChenggu(birth({ date: '1989-05-01', time: '01:00' })).weight.qian, 21);
  assert.equal(calculateChenggu(birth({ date: '1999-03-18', time: '00:00' })).weight.qian, 71);
  const possible = new Set([0]);
  let sums = possible;
  for (const table of Object.values(CHENGGU_TABLES)) {
    const next = new Set();
    for (const a of sums) for (const b of table) next.add(a + b);
    sums = next;
  }
  assert.equal(Math.min(...sums), 21); assert.equal(Math.max(...sums), 71);
  for (const qian of sums) {
    assert.ok(CHENGGU_VERSES[qian]);
    assert.equal(CHENGGU_VERSES[qian].verse.length, 4);
    assert.ok(CHENGGU_VERSES[qian].verse.every(line => [...line].length === 7), `invalid verse at ${qian}`);
    assert.ok(CHENGGU_VERSES[qian].translation.length > 20);
  }
  assert.equal(CHENGGU_VERSES[72], undefined);
  assert.equal(weightText(30), '三两'); assert.equal(weightText(6), '六钱');
});

test('four pillars do not fabricate a birthday; name and sex do not change the common version', () => {
  const pillars = birth({ calendar: 'pillars', pillars: '己卯 丙子 戊午 戊午' });
  assert.equal(calculateChenggu(pillars).available, false);
  assert.equal(calculateChenggu(pillars).weight, undefined);
  const a = birth({ date: '1999-11-25', time: '12:34', name: '甲' });
  const b = birth({ date: '1999-11-25', time: '12:34', name: '乙', gender: 'female' });
  const before = JSON.stringify(a);
  assert.deepEqual(calculateChenggu(a), calculateChenggu(b));
  const result = calculateChenggu(a); result.verse[0] = '不能改写源表';
  assert.equal(JSON.stringify(a), before);
  assert.notEqual(calculateChenggu(a).verse[0], '不能改写源表');
  assert.equal(Object.hasOwn(result, 'endYear'), false);
});
