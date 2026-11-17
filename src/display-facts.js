import lunar from 'lunar-javascript';

const { LunarUtil } = lunar;
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const JIAZI = new Set(Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]));

/**
 * Display-only traditional annotations. They do not enter strength, events or scores.
 * Checked against the public zydx.top/images/bz.js tables and three saved website
 * responses on 2026-11-18. This is an independent lookup implementation, not the
 * website's application code. Only the named, verified subset below is supported.
 *
 * 文昌 uses the separate 甲→巳 / 乙→午 entries of the common table, rather than
 * copying the site's combined 甲乙→巳午 match. The distinction is explicit in
 * 命理探原's 文昌 discussion (scan of 命理索隐, NLC416-07jh010783-4617):
 * https://commons.wikimedia.org/wiki/File:NLC416-07jh010783-4617_命理索隐.pdf
 * 天乙 follows the site's 庚辛→寅午 recension. 阴干羊刃 uses 帝旺位.
 * Ambiguous index-based mourning stars, gender-dependent 元辰, day-only special
 * patterns and the 纳音-dependent 学堂/词馆 rules are deliberately not inferred.
 */
const SHARED_STEM_RULES = [
  ['天乙贵人', ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '寅午', '寅午', '卯巳', '卯巳']],
  ['太极贵人', ['子午', '子午', '卯酉', '卯酉', '辰戌丑未', '辰戌丑未', '寅亥', '寅亥', '巳申', '巳申']],
  ['文昌贵人', ['巳', '午', '申', '酉', '申', '酉', '亥', '子', '寅', '卯']],
  ['天厨贵人', ['巳', '午', '子', '巳', '午', '申', '寅', '午', '酉', '亥']],
  ['国印贵人', ['戌', '亥', '丑', '寅', '丑', '寅', '辰', '巳', '未', '申']],
];
const DAY_STEM_RULES = [
  ['金舆', ['辰', '巳', '未', '申', '未', '申', '戌', '亥', '丑', '寅']],
  ['禄神', ['寅', '卯', '巳', '午', '巳', '午', '申', '酉', '亥', '子']],
  ['羊刃', ['卯', '寅', '午', '巳', '午', '巳', '酉', '申', '子', '亥']],
];
const GROUPS = ['申子辰', '寅午戌', '巳酉丑', '亥卯未'];
const SHARED_BRANCH_RULES = [
  ['驿马', '寅申亥巳'], ['华盖', '辰戌丑未'], ['将星', '子午酉卯'],
  ['劫煞', '巳亥寅申'], ['桃花', '酉卯午子'], ['亡神', '亥巳申寅'],
];
const YEAR_BRANCH_RULES = [
  ['红鸾', '卯寅丑子亥戌酉申未午巳辰'],
  ['天喜', '酉申未午巳辰卯寅丑子亥戌'],
  ['孤辰', '寅寅巳巳巳申申申亥亥亥寅'],
  ['寡宿', '戌戌丑丑丑辰辰辰未未未戌'],
];
const MONTH_STARS = ['天德贵人', '月德贵人', '天医'];
export const DISPLAY_SHENSHA_NAMES = Object.freeze([
  ...SHARED_STEM_RULES, ...DAY_STEM_RULES, ...SHARED_BRANCH_RULES, ...YEAR_BRANCH_RULES,
].map(([name]) => name).concat(MONTH_STARS));

/** Natal pillar values must be valid sexagenary pairs. Missing data stays blank. */
export function displayPillarFacts(natalPillars, ganZhi, { role, gender } = {}) {
  if (!JIAZI.has(ganZhi)) return { xunKong: '', shenSha: [] };
  const natal = natalPillars || {};
  const valid = key => JIAZI.has(natal[key]) ? natal[key] : '';
  const year = valid('year'), month = valid('month'), day = valid('day');
  const result = new Set();
  const branch = ganZhi[1], stem = ganZhi[0];
  const addStemRules = (source, rules) => {
    if (!source) return;
    const index = STEMS.indexOf(source[0]);
    for (const [name, values] of rules) if (values[index].includes(branch)) result.add(name);
  };
  for (const source of [year, day]) addStemRules(source, SHARED_STEM_RULES);
  addStemRules(day, DAY_STEM_RULES);
  for (const source of [year, day]) {
    if (!source) continue;
    const group = GROUPS.findIndex(values => values.includes(source[1]));
    for (const [name, values] of SHARED_BRANCH_RULES) if (values[group] === branch) result.add(name);
  }
  if (year) {
    const index = BRANCHES.indexOf(year[1]);
    for (const [name, values] of YEAR_BRANCH_RULES) if (values[index] === branch) result.add(name);
  }
  if (month) {
    const index = BRANCHES.indexOf(month[1]);
    const heavenlyVirtue = '己庚丁申壬辛亥甲癸寅丙乙'[index];
    if (heavenlyVirtue === stem || heavenlyVirtue === branch) result.add('天德贵人');
    const group = GROUPS.findIndex(values => values.includes(month[1]));
    if ('壬丙庚甲'[group] === stem) result.add('月德贵人');
    if (BRANCHES[(index + 11) % 12] === branch) result.add('天医');
  }
  // role/gender are reserved for verified rules that depend on those facts.
  return { xunKong: LunarUtil.getXunKong(ganZhi), shenSha: DISPLAY_SHENSHA_NAMES.filter(name => result.has(name)) };
}
