import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { displayPillarFacts, DISPLAY_SHENSHA_NAMES } from '../src/display-facts.js';

const keys = ['year', 'month', 'day', 'hour'];
const sorted = values => [...values].sort();

test('display stars match the supported subset of three independent saved website responses', async () => {
  for (const fixture of ['zydx-solar-20000101', 'zydx-latezi-19880215', 'zydx-lunar-leap-20230201']) {
    const html = await readFile(new URL(`./fixtures/${fixture}.html`, import.meta.url), 'utf8');
    const rows = {};
    for (const [, attrs, content] of html.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)) {
      if (!/bm_tgline|bm_dzline/.test(attrs) && !/神煞:&/.test(content)) continue;
      const cells = [...content.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(([, cell]) => cell.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim());
      rows[cells[0]] = cells.slice(1);
    }
    const natal = Object.fromEntries(keys.map((key, i) => [key, rows['天干:'][i] + rows['地支:'][i]]));
    for (let i = 0; i < 4; i++) {
      const expected = rows['神煞:'][i].split(' ').filter(name => DISPLAY_SHENSHA_NAMES.includes(name));
      assert.deepEqual(sorted(displayPillarFacts(natal, natal[keys[i]], { role: keys[i] }).shenSha), sorted(expected), `${fixture} ${keys[i]}`);
    }
  }
});

test('user reference chart and its selected luck/year retain the displayed common stars', () => {
  const natal = { year: '丙午', month: '己亥', day: '丙申', hour: '壬辰' };
  const expected = [ ['羊刃', '将星'], ['劫煞', '天乙贵人', '亡神'], ['驿马', '文昌贵人', '孤辰'], ['寡宿', '华盖'] ];
  for (let i = 0; i < keys.length; i++) assert.deepEqual(sorted(displayPillarFacts(natal, natal[keys[i]], { role: keys[i], gender: 'male' }).shenSha), sorted(expected[i]));
  assert.deepEqual(sorted(displayPillarFacts(natal, '癸卯', { role: 'luck' }).shenSha), sorted(['天喜', '太极贵人', '桃花']));
  assert.deepEqual(displayPillarFacts(natal, '癸未', { role: 'annual' }).shenSha, ['金舆']);
  assert.deepEqual(keys.map(key => displayPillarFacts(natal, natal[key]).xunKong), ['寅卯', '辰巳', '辰巳', '午未']);
});

test('all sixty pillars use their own xun, including dynamic periods and invalid input', () => {
  const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
  const voids = ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'];
  for (let i = 0; i < 60; i++) assert.equal(displayPillarFacts({}, stems[i % 10] + branches[i % 12]).xunKong, voids[Math.floor(i / 10)]);
  assert.deepEqual(displayPillarFacts({}, '甲丑'), { xunKong: '', shenSha: [] });
  assert.deepEqual(displayPillarFacts(null, '甲子'), { xunKong: '戌亥', shenSha: [] });
});

test('文昌 preserves separate 甲巳 and 乙午 matches instead of combining both branches', () => {
  assert.ok(displayPillarFacts({ day: '甲子' }, '己巳').shenSha.includes('文昌贵人'));
  assert.ok(!displayPillarFacts({ day: '甲子' }, '庚午').shenSha.includes('文昌贵人'));
  assert.ok(displayPillarFacts({ day: '乙丑' }, '庚午').shenSha.includes('文昌贵人'));
  assert.ok(!displayPillarFacts({ day: '乙丑' }, '己巳').shenSha.includes('文昌贵人'));
});
