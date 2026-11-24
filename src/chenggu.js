import lunar from 'lunar-javascript';
import { CHENGGU_TABLES, CHENGGU_VERSES } from './data/chenggu.js';
import { FEMALE_CHENGGU_VERSES } from './data/chenggu-female.js';

export { CHENGGU_TABLES, CHENGGU_VERSES } from './data/chenggu.js';
const { Solar, LunarUtil } = lunar;
const TITLE = '袁天罡称骨';
const digits = '零一二三四五六七八九';

export function weightText(qian) {
  if (!Number.isInteger(qian) || qian < 0 || qian > 99) throw new RangeError('骨重须为0至99之间的整数钱');
  const liang = Math.floor(qian / 10), remainder = qian % 10;
  return `${liang ? `${digits[liang]}两` : ''}${remainder ? `${digits[remainder]}钱` : liang ? '' : '零钱'}`;
}

export const CHENGGU_POLICY = Object.freeze({
  id: 'chenggu-gendered-lunar-v2',
  yearBoundary: '农历正月初一',
  lunarDay: '民用农历日期；23点属于子时，但不改称骨所用的农历日期',
  leapMonth: '闰月整月使用同名月份的月重',
  verseVersion: '男女分歌，21至71钱',
  role: '独立查表与诗文释义，不参与子平评分，不用于寿命或曲线截止年份',
});

// Full JSON reports can be re-rendered after an upgrade. Only migrate the known shared-song edition.
export function chengguForDisplay(result, gender) {
  if (!result?.available || gender !== 'female' || result.provenance?.policy?.id !== 'chenggu-common-lunar-v1') return result;
  const song = FEMALE_CHENGGU_VERSES[result.weight?.qian];
  return song ? { ...result, verse: [...song.verse], translation: song.translation } : result;
}

/** Requires normalized birth input. Four pillars do not identify a unique lunar birthday. */
export function calculateChenggu(input = {}) {
  if (input.calendar === 'pillars' || !input.solarDate || !input.solarTime) return {
    available: false, title: TITLE, reason: '补充具体出生年月日时后，可以查看称骨原句和白话。',
  };
  const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(input.solarDate);
  const time = /^(\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(input.solarTime);
  if (!date || !time) throw new TypeError('称骨需要规范化的出生日期和时间');
  const parts = [...date.slice(1).map(Number), Number(time[1]), Number(time[2]), Number(time[3] || 0)];
  const solar = Solar.fromYmdHms(...parts), ln = solar.getLunar();
  const yearGanZhi = ln.getYearInGanZhi();
  const month = Math.abs(ln.getMonth()), day = ln.getDay();
  const hourIndex = Math.floor((parts[3] + 1) / 2) % 12;
  const hourBranch = '子丑寅卯辰巳午未申酉戌亥'[hourIndex];
  const yearIndex = LunarUtil.JIA_ZI.indexOf(yearGanZhi);
  const weights = {
    year: CHENGGU_TABLES.year[yearIndex], month: CHENGGU_TABLES.month[month - 1],
    day: CHENGGU_TABLES.day[day - 1], hour: CHENGGU_TABLES.hour[hourIndex],
  };
  if (!Object.values(weights).every(Number.isInteger)) throw new RangeError('出生信息不能匹配称骨表');
  const qian = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (!['male', 'female'].includes(input.gender)) throw new TypeError('请提供性别以选择称骨评语');
  const song = (input.gender === 'female' ? FEMALE_CHENGGU_VERSES : CHENGGU_VERSES)[qian];
  if (!song) throw new RangeError('称骨总重没有对应歌诀');
  const weightParts = [
    { key: 'year', label: '年', value: yearGanZhi, qian: weights.year },
    { key: 'month', label: '月', value: `${ln.getMonth() < 0 ? '闰' : ''}${ln.getMonthInChinese()}月`.replace(/^闰闰/u, '闰'), qian: weights.month },
    { key: 'day', label: '日', value: ln.getDayInChinese(), qian: weights.day },
    { key: 'hour', label: '时', value: `${hourBranch}时`, qian: weights.hour },
  ].map(part => ({ ...part, text: weightText(part.qian) }));
  return {
    available: true, title: TITLE,
    lunar: { year: ln.getYear(), yearGanZhi, month, leapMonth: ln.getMonth() < 0, day, hourBranch, dateText: ln.toString() },
    weight: { qian, totalText: weightText(qian), parts: weightParts },
    verse: [...song.verse], translation: song.translation,
    provenance: {
      policy: CHENGGU_POLICY, attribution: '民间流传称骨歌，通常托名袁天罡；不作作者考证结论。',
      tableSources: ['https://guanyitang.com/chenggu', 'https://ezfate.com/zh/bazi-weight/chart'],
      verseGender: input.gender,
      verseSources: input.gender === 'female'
        ? ['https://m.guoxuemeng.com/guoxue/623350.html']
        : ['https://commons.wikimedia.org/wiki/File:NTUL-9900007270_大雜字不求人.pdf', 'https://ezfate.com/zh/bazi-weight/chart'],
      documentation: 'docs/chenggu-sources.md', translation: '本项目原创白话释义',
    },
  };
}
