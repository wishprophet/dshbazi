/** Deterministic traditional-rule annotations; these are not measured predictions. */
export const RULE_VERSION = 'ziping-explainable-0.1.0';
export const STEMS = [...'甲乙丙丁戊己庚辛壬癸'];
export const BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
export const ELEMENTS = ['木', '火', '土', '金', '水'];
export const STEM_ELEMENT = Object.fromEntries(STEMS.map((s, i) => [s, ELEMENTS[Math.floor(i / 2)]]));
export const HIDDEN = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'], 辰: ['戊', '乙', '癸'],
  巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'],
  酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};
const GOD_GROUP = { 比肩: 'peer', 劫财: 'peer', 食神: 'output', 伤官: 'output', 正财: 'wealth', 偏财: 'wealth', 正官: 'authority', 七杀: 'authority', 正印: 'resource', 偏印: 'resource', 日主: 'self' };
export const DIMENSIONS = [
  ['pattern', '格局层次'], ['career', '官禄功名'], ['wealth', '财禄丰啬'], ['family', '六亲伦常'],
  ['relationship', '婚姻妻室'], ['study', '学业文名'], ['wellbeing', '疾厄寿元'], ['mobility', '迁徙驿马'],
  ['home', '家宅田宅'], ['disputes', '官非灾讼'], ['character', '心性品行'], ['network', '人际交友'],
].map(([id, title]) => ({ id, title }));

export function tenGod(dayStem, otherStem) {
  const a = STEMS.indexOf(dayStem), b = STEMS.indexOf(otherStem);
  if (a < 0 || b < 0) return null;
  const relation = (Math.floor(b / 2) - Math.floor(a / 2) + 5) % 5;
  return [['比肩', '劫财'], ['食神', '伤官'], ['偏财', '正财'], ['七杀', '正官'], ['偏印', '正印']][relation][a % 2 === b % 2 ? 0 : 1];
}
export const godGroup = god => GOD_GROUP[god] || 'unknown';

export function chartColumns(chart) {
  const labels = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
  const supplied = chart.columns || [];
  const dm = typeof chart.dayMaster === 'string' ? chart.dayMaster[0] : chart.dayMaster?.stem;
  return Object.entries(labels).map(([key, label]) => {
    const given = supplied.find(x => x.key === key) || {};
    const raw = chart.pillars?.[key];
    const ganZhi = given.ganZhi || (typeof raw === 'string' ? raw : raw?.ganZhi || `${raw?.stem || raw?.gan || ''}${raw?.branch || raw?.zhi || ''}`);
    const stem = given.stem || ganZhi?.[0], branch = given.branch || ganZhi?.[1];
    return {
      ...given, key, label, ganZhi, stem, branch, element: given.element || STEM_ELEMENT[stem],
      stemGod: given.stemGod || (key === 'day' ? '日主' : tenGod(dm, stem)),
      hiddenStems: (given.hiddenStems?.length ? given.hiddenStems : (HIDDEN[branch] || []).map(s => ({ stem: s }))).map((h, index) => ({ ...h, element: h.element || STEM_ELEMENT[h.stem], god: h.god || tenGod(dm, h.stem), rank: h.rank || (index === 0 ? '本气' : '余藏干') })),
    };
  });
}

export function branchRelations(a, b) {
  if (!BRANCHES.includes(a) || !BRANCHES.includes(b)) return [];
  const pair = a + b, reverse = b + a;
  const has = values => values.includes(pair) || values.includes(reverse);
  const result = [];
  if (has(['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'])) result.push('冲');
  if (has(['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'])) result.push('合');
  if (has(['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'])) result.push('害');
  if (has(['子卯', '寅巳', '巳申', '寅申', '丑戌', '戌未', '丑未']) || (a === b && ['辰', '午', '酉', '亥'].includes(a))) result.push('刑');
  return result;
}

const evidence = (ruleId, text, fields = []) => ({ ruleId, text, fields });
const groupWords = { peer: '比劫', output: '食伤', wealth: '财星', authority: '官杀', resource: '印星' };

export function analyzeChart(chart, input = {}) {
  const columns = chartColumns(chart);
  const dm = columns.find(x => x.key === 'day')?.stem;
  if (!STEMS.includes(dm) || columns.some(x => !STEMS.includes(x.stem) || !BRANCHES.includes(x.branch))) throw new Error('分析需要四柱完整且合法；不可补造缺失柱。');
  const dmElement = STEM_ELEMENT[dm];
  const month = columns.find(x => x.key === 'month');
  const monthMain = month.hiddenStems[0];
  const monthGroup = godGroup(monthMain.god);
  const exposed = columns.filter(x => x.key !== 'day');
  const roots = columns.flatMap(c => c.hiddenStems.filter(h => h.element === dmElement).map(h => ({ pillar: c.key, label: c.label, stem: h.stem, rank: h.rank })));
  const supportStems = exposed.filter(c => ['peer', 'resource'].includes(godGroup(c.stemGod)));
  const drainingStems = exposed.filter(c => ['output', 'wealth', 'authority'].includes(godGroup(c.stemGod)));
  const seasonPoints = { peer: 3, resource: 2, output: -1.5, wealth: -2, authority: -2 }[monthGroup] || 0;
  const rootPoints = roots.reduce((sum, r) => sum + (r.rank === '本气' ? 1.4 : .5), 0);
  const stemPoints = supportStems.length * .8 - drainingStems.length * .6;
  const balance = Math.round((seasonPoints + rootPoints + stemPoints) * 10) / 10;
  const tendency = balance >= 4 ? '偏旺倾向' : balance <= -.8 ? '偏弱倾向' : '中和或临界';
  const strengthEvidence = [
    evidence('S01-month-command', `月令${month.branch}本气${monthMain.stem}为${monthMain.god}；月令权重与普通计数分开。`, ['pillars.month']),
    evidence('S02-root-depth', roots.length ? `日主同五行根气：${roots.map(r => `${r.label}${r.stem}（${r.rank}）`).join('、')}。根气存在不等同于已经得用。` : '四支藏干中未见日主同五行根气；仍需连同印星与季节分析，不能仅凭无根判从格。', ['columns.hiddenStems']),
    evidence('S03-exposure', `非日干透出扶助项${supportStems.length}处、泄耗制项${drainingStems.length}处；这是原局结构描述。`, ['columns.stemGod']),
  ];
  const strength = { tendency, score: balance, method: '月令本气、根气深浅与天干透出分项启发式；不以五行数量直接判旺衰。', evidence: strengthEvidence, roots, supportStems: supportStems.map(x => x.ganZhi), caution: '未穷尽合化、调候和特殊格局；此值不是人生分数，也不自动等于喜用神。' };
  const monthExposed = month.hiddenStems.find(h => exposed.some(c => c.stem === h.stem));
  const selected = monthExposed || monthMain;
  let candidate = `${selected.god}格候选`;
  if (selected.god === '比肩') candidate = '建禄或月令比肩结构候选';
  if (selected.god === '劫财') candidate = '月令劫财结构候选（阳刃须另核）';
  const pattern = {
    candidate, status: '候选，尚未完成全部成败救应审定', support: monthExposed ? '月令藏干透出' : '月令本气参考',
    evidence: [evidence('P01-month-pattern', `以月令${month.branch}为入口，${selected.stem}对日主为${selected.god}；${monthExposed ? '该藏干在其他天干透出' : '月令藏干未透，暂以本气列候选'}。`, ['pillars.month', 'columns.stemGod'])],
    cautions: ['格局名称不等于社会阶层、官职或资产规模。', '不凭极旺、极弱或五行缺失直接判从格、化气格；合化成立条件需另审。'],
  };
  const groups = Object.fromEntries(Object.keys(groupWords).map(k => [k, []]));
  for (const col of columns) {
    if (col.key !== 'day') groups[godGroup(col.stemGod)]?.push(evidence('F01-visible-god', `${col.label}${col.stem}透出${col.stemGod}。`, [`pillars.${col.key}`]));
    for (const h of col.hiddenStems) groups[godGroup(h.god)]?.push(evidence('F02-hidden-god', `${col.label}${col.branch}藏${h.stem}（${h.rank}），为${h.god}。`, [`pillars.${col.key}`]));
  }
  const relations = [];
  for (let i = 0; i < columns.length; i++) for (let j = i + 1; j < columns.length; j++) {
    for (const relation of branchRelations(columns[i].branch, columns[j].branch)) relations.push({ relation, keys: [columns[i].key, columns[j].key], text: `${columns[i].label}${columns[i].branch}与${columns[j].label}${columns[j].branch}${relation}` });
  }
  const relationshipEvidence = relations.filter(r => r.keys.includes('day')).map(r => evidence('R01-day-palace', `${r.text}；关系类型不直接等同于婚姻结果。`, r.keys.map(x => `pillars.${x}`)));
  const familyEvidence = relations.filter(r => r.keys.includes('year') || r.keys.includes('month')).map(r => evidence('R02-family-palace', `${r.text}；可作家庭互动主题参考。`, r.keys.map(x => `pillars.${x}`)));
  const clashEvidence = relations.filter(r => ['冲', '刑', '害'].includes(r.relation)).map(r => evidence('R03-friction', `${r.text}；只表传统关系标签。`, r.keys.map(x => `pillars.${x}`)));
  const hasGroup = key => groups[key].length > 0;
  const groupSummary = (key, yes, no) => hasGroup(key) ? yes : no;
  const common = ['现实条件、资源与个人选择会改变事情如何表现。'];
  const configs = {
    pattern: { summary: `${candidate}；${tendency}。先核成格条件，再谈发展空间。`, evidence: [...pattern.evidence, ...strengthEvidence], opportunities: ['把月令、透干、根气及制化逐项对照，保持解释可复核。'], cautions: pattern.cautions },
    career: { summary: groupSummary('authority', '原局见官杀，组织规则、责任与考核是可讨论的职业主题。', '原局未见官杀，不据此断定没有职位或成就；职业判断更依赖现实行业与技能。'), evidence: [...groups.authority, ...groups.resource.slice(0, 2)], opportunities: [hasGroup('resource') ? '官印同见时，可讨论培训、资格与组织内责任的配合。' : '结合已有职责，分清专业贡献与管理要求。'], cautions: ['官杀出现不能直接推出公务员身份、升职年份或行政级别。'] },
    wealth: { summary: groupSummary('wealth', '财星在原局有据，收入安排、资源管理与积累方式值得重点分析。', '财星未显并不等于贫穷；要看技能变现、财务习惯与运年引动。'), evidence: [...groups.wealth, ...groups.output.slice(0, 2)], opportunities: [hasGroup('output') ? '食伤与财星主题可联系作品、服务、交付和回款。' : '把稳定收入、临时收入与大额支出分别记录。'], cautions: ['不由命盘推断资产数额、投资收益或所谓必赚年份。'] },
    family: { summary: '以年、月柱与印比结构讨论支持、代际互动与照料责任，保留每位亲属的真实情况。', evidence: [...familyEvidence, ...groups.resource.slice(0, 2), ...groups.peer.slice(0, 2)], opportunities: ['把家庭支持与自己承担的时间、经济责任分开讨论。'], cautions: ['不据单一十神判断亲属生死、品性或关系必然破裂。'] },
    relationship: { summary: relationshipEvidence.length ? '日支参与原局合冲刑害，亲密关系中的协商、边界和共同安排是可讨论的主题。' : '日支未出现本规则集列出的原局合冲刑害；这不代表关系必然顺利或无需经营。', evidence: relationshipEvidence.length ? relationshipEvidence : [evidence('R01-day-palace', `日支为${columns[2].branch}，作为传统配偶宫观察点。`, ['pillars.day'])], opportunities: ['结合单身、恋爱或已婚状态，讨论沟通、共同财务与居住安排。'], cautions: ['不把日支冲合直接写成离婚、出轨或必婚；不以命盘判定伴侣价值。'] },
    study: { summary: hasGroup('resource') || hasGroup('output') ? '印星与食伤所对应的吸收、训练和表达主题可作为学习路径参考。' : '原局未见显著印食伤标签，不能据此否定学历、学习能力或文名。', evidence: [...groups.resource, ...groups.output].slice(0, 6), opportunities: ['以明确课程、考试或作品为目标，让学习投入与可展示成果衔接。'], cautions: ['不将文星、印星等同于录取通知或考试分数。'] },
    wellbeing: { summary: '这一栏目只整理压力、作息与恢复节律的传统意象；不推断疾病、寿命或死亡年份。', evidence: strengthEvidence.slice(0, 2), opportunities: ['如有真实身体不适，以检查和专业意见为准；记录作息与压力可帮助现实复盘。'], cautions: ['五行对应不能用于医学诊断、用药或判断具体器官病变。'] },
    mobility: { summary: clashEvidence.some(e => e.text.includes('冲')) ? '原局存在支冲，可把环境变化、搬迁或岗位切换列作背景核对主题。' : '本规则集未发现原局六冲；迁移仍可能由求学、职业或家庭需要发生。', evidence: clashEvidence.filter(e => e.text.includes('冲')), opportunities: ['先确认出差、迁居、升学或异地项目是否已有现实安排。'], cautions: ['六冲不能单独推出搬家、车祸或特定目的地。'] },
    home: { summary: '居住与家产需结合财星、印星和家庭宫位观察，实际住房条件与家庭计划优先。', evidence: [...groups.wealth.slice(0, 2), ...groups.resource.slice(0, 2), ...familyEvidence.slice(0, 2)], opportunities: ['已有买房、装修、租约计划时，可细分预算、手续与家庭协调。'], cautions: ['不凭命盘承诺置业能力、房价变化或房产套数。'] },
    disputes: { summary: hasGroup('authority') && hasGroup('output') ? '官杀与食伤同见，可讨论规则要求和个人表达之间如何协调。' : '以既有合同、流程和沟通事实判断冲突；原局标签不足以推断诉讼。', evidence: [...groups.authority.slice(0, 2), ...groups.output.slice(0, 2), ...clashEvidence.slice(0, 2)], opportunities: ['涉及合作时，把责任、验收、结算和变更记录写清楚。'], cautions: ['不预言犯罪、定罪、刑期或灾祸；法律问题依据真实材料处理。'] },
    character: { summary: '以印比、食伤、财官的组合描述吸收信息、表达、协作和承担责任的倾向，不作道德判断。', evidence: exposed.map(c => evidence('F03-character-theme', `${c.label}${c.stem}为${c.stemGod}，仅作行为主题的传统入口。`, [`pillars.${c.key}`])), opportunities: ['用具体经历核对哪些描述符合自己，并保留不符合的部分。'], cautions: ['不能由干支判定善恶、诚实程度或固定人格。'] },
    network: { summary: groupSummary('peer', '比劫出现，可讨论同伴支持、竞争与资源分配的双面性。', '比劫未显不代表缺少朋友；合作质量仍取决于共同目标和边界。'), evidence: [...groups.peer, ...groups.resource.slice(0, 2)], opportunities: ['在合伙或团队协作中分清职责、报酬、决策权和退出方式。'], cautions: ['比劫不直接等于朋友夺财，印星也不保证一定有人相助。'] },
  };
  const dimensions = DIMENSIONS.map(({ id, title }) => {
    const value = configs[id];
    return { id, title, ...value, evidence: value.evidence.length ? value.evidence : [evidence('F00-insufficient', '这一维度缺少足够的直接原局证据，保留为现实背景核对项。')], cautions: [...value.cautions, ...common], confidence: '传统规则支持度，非统计概率' };
  });
  return {
    version: RULE_VERSION, summary: `${dm}${dmElement}日主，月令${month.branch}；${candidate}，旺衰暂列${tendency}。${hasGroup('resource') ? '学习与支持资源' : '现实技能与资源配置'}可作为分析入口，具体层次须结合制化条件及现实背景。`,
    dayMaster: dm, pattern, strength, dimensions, relations, groups,
    methodology: '月令立候选、根气与透干辨强弱，合冲刑害只作结构证据；各项判断均是明示规则的传统解释。',
    limitations: ['本规则集为首版简化子平框架，尚未覆盖全部格局成败、调候与特殊从化条件。', '排盘可复核不等于现实事件预测有效；解释和评分未经统计预测效度验证。'],
    contextProvided: Boolean(input.context || input.background),
  };
}
