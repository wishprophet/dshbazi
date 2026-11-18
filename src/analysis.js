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
const PUBLIC_TITLES = {
  pattern: '整体发展', career: '事业工作', wealth: '收入积累', family: '父母家人',
  relationship: '感情婚姻', study: '学习考试', wellbeing: '身心状态', mobility: '外出变动',
  home: '住房家产', disputes: '合同纠纷', character: '性格做事', network: '人际合作',
};

// Public wording follows visible structure and palace contacts; it does not
// change the calendar facts, strength calculation or timeline scoring.
function publicReadings({ columns, monthGroup, roots, tendency, relations }) {
  const exposed = columns.filter(c => c.key !== 'day');
  const visible = key => exposed.filter(c => godGroup(c.stemGod) === key).length;
  const prominent = key => monthGroup === key || visible(key) > 0;
  const authority = prominent('authority'), resource = prominent('resource');
  const output = prominent('output'), wealth = prominent('wealth'), peer = prominent('peer');
  const weak = tendency === '偏弱倾向', strong = tendency === '偏旺倾向';
  const touches = (keys, types) => relations.some(r => r.keys.some(k => keys.includes(k)) && types.includes(r.relation));
  const familyClash = touches(['year', 'month'], ['冲']);
  const familyFriction = touches(['year', 'month'], ['冲', '刑', '害']);
  const dayClash = touches(['day'], ['冲']);
  const dayFriction = touches(['day'], ['冲', '刑', '害']);
  const dayTogether = touches(['day'], ['合']);
  const workClash = touches(['month'], ['冲']);
  const changing = touches(['year', 'month', 'day', 'hour'], ['冲']);
  const dayGroup = godGroup(columns.find(c => c.key === 'day').hiddenStems[0].god);
  const familySupport = columns.filter(c => ['year', 'month'].includes(c.key)).some(c =>
    godGroup(c.stemGod) === 'resource' || godGroup(c.hiddenStems[0].god) === 'resource');
  const reading = (headline, summary) => ({ headline, summary });
  const career = authority && resource
    ? reading('靠专业与责任建立位置', '事业的长处在专业积累和承担责任，经验、资历与岗位发展能够相互衔接。' + (weak ? '任务和考核一集中，就容易出现责任先加、回报后到的局面。' : '越是在职责清楚、能持续交付的环境里，越容易形成稳定的位置。'))
    : authority && output
      ? reading('有能力，也容易与规章较劲', '工作上有想法，也敢指出做法中的问题，成绩往往来自改进流程或解决难题。与上级或团队的磨合点在执行方式：认同目标，却未必愿意照旧办法做。')
      : output
        ? reading('靠成果和解决问题出头', '工作表现重在实际成果，表达、技术、作品或解决难题的能力更容易成为个人招牌。重复性工作难以长期维持热情，能够自行安排做法的任务更能发挥。')
        : peer
          ? reading('自主性强，靠拿手本事站住脚', '工作中有自己的标准，不太习惯事事依赖别人安排，独立负责时更能显出执行力。' + (resource ? '专业积累能托住这种自主性，难点是与别人分工时容易把责任又揽回自己手上。' : '与同事的竞争感较强，职责重叠或功劳归属不清时，配合容易变得费力。'))
          : resource
            ? reading('专业积累型，起步稳而后劲足', '工作的发展更多来自经验、专业知识和熟练程度，接触越深，处理事情越有章法。临时起意的机会不如长期做熟的一条路容易形成成绩。')
            : reading('目标与回报导向明显', '做工作较看重结果和实际回报，资源怎么用、投入是否值得，会直接影响积极性。事情一旦只剩忙碌而看不到结果，就容易重新考虑方向。');
  const wealthReading = wealth && output
    ? reading('挣钱靠本事，收入随交付走', '收入与个人能力、项目成果和实际交付联系较紧，做成的事情越具体，变现路径越清楚。' + (peer ? '积累的难点在合作分成、人情开销和资源分摊，进账增加时支出也容易一起扩大。' : '钱财起伏更多跟着业务和项目节奏走，收入确认与实际到账之间容易有时间差。'))
    : wealth && peer
      ? reading('有挣钱动力，留住钱更费心', '对收入和资源较敏感，愿意为实际回报投入精力，挣钱的动力并不弱。钱财同时牵连合作、家庭和人情安排，常见表现是进账有去处，积累速度赶不上忙碌程度。')
      : wealth
        ? reading('重实际积累，财务与责任相连', '钱财观念偏务实，收入安排常与工作责任、长期计划一起推进。' + (weak ? '面对的机会和开销一多，容易出现想承接的事超过眼前承受范围的情况。' : '对成本和回报的在意，有助于逐步形成积累，但也容易因得失牵动情绪。'))
        : reading('靠稳定技能积累，财路不走急进', '收入更依靠持续工作和熟练技能，发展节奏偏向一份份成果换来积累。' + (peer ? '合作分账和替别人承担开销，是比扩大项目更明显的财务牵扯。' : '对机会的判断更多来自熟悉程度，陌生领域的短期热度不容易转成稳定收入。'));
  const family = familyFriction
    ? reading('亲情有牵挂，生活安排易分歧', '与家人之间有牵挂，也有各自坚持，分歧更容易落在工作选择、花钱和日常安排上。' + (familyClash ? '家庭节奏与个人发展不总在同一拍，离开熟悉环境或重新分配照料责任时，拉扯会更明显。' : '常见的相处模式是出发点在关心，表达出来却像干涉，事情做了不少，心里仍可能有委屈。'))
    : familySupport
      ? reading('家中支持与期待并存', '家人和长辈的经验、照应对个人发展有分量，遇事并非完全独自应付。支持通常也带着期待，个人选择与家中看法较容易相互影响。')
      : reading('家庭责任偏务实，表达较含蓄', '与家人的联系更多体现在实际付出、照料和日常责任上，情感表达相对含蓄。事情一多时，容易先把问题处理完，自己的感受反而留到后面。');
  const relationship = dayClash
    ? reading('感情牵动强，生活节奏要磨合', '感情在生活中占分量，但双方的时间、工作安排或生活习惯容易互相牵动。亲近时投入较深，出现分歧时也不容易轻轻带过，相处的反复往往出在具体安排。')
    : dayFriction
      ? reading('在意关系，也容易暗中较劲', '感情里在意对方的态度和回应，心中有要求，却不一定马上说透。对花钱、分工或相处方式的不同理解，容易积成小事反复争执。')
      : dayTogether
        ? reading('重陪伴，关系容易牵动决定', '感情里重陪伴与共同安排，愿意把时间和精力放进关系。个人决定容易受对方影响，亲密感较强时，也容易出现迁就多于表达的情况。')
        : reading('感情重实际相处，信任建立较慢', '感情更看重日常相处中的可靠和责任，关系的发展偏向逐渐确认。' + (dayGroup === 'peer' ? '相处中保留自主空间的要求较明显，过度干涉比意见不同更容易引起抵触。' : dayGroup === 'wealth' ? '共同生活、金钱安排和未来计划，在关系判断里分量较重。' : '单靠热情很难替代长期相处，熟悉之后的习惯与分工更能决定舒适程度。'));
  const study = resource && output
    ? reading('理解与表达能衔接，成果意识较强', '吸收知识与表达、运用能够接上，学到的内容容易转成讲解、作品或解决问题的办法。短板在兴趣和想法容易分散，准备很多与成果迟迟不定稿可能同时出现。')
    : resource
      ? reading('理解和积累见长，输出速度偏慢', '学习偏重理解原理、梳理体系，对教材、经验和完整方法的吸收较有耐心。' + (roots.length >= 2 ? '熟悉之后掌握较牢，但容易在反复确认和资料准备上花去过多时间。' : '面对新要求时准备较多，真正需要限时作答或独立表达时，表现可能慢于平时理解。'))
      : output
        ? reading('动手与表达见长，兴趣驱动明显', '学习更容易从实际问题切入，动手、表达和反复尝试能带出理解。兴趣足时进展快，对重复记忆或固定答题形式的耐心相对弱。')
        : reading('学习看目标，持续性比起步更关键', '学习投入与眼前目标联系较紧，任务具体时比泛泛了解更容易集中。' + (peer ? '独立摸索的意愿强，但自己的想法也容易打断既定学习节奏。' : '短期集中与长期积累的表现可能不同，临时任务能带来冲劲，也容易挤掉系统梳理。'));
  const wellbeing = weak
    ? reading('事务一集中，个人节奏容易被挤占', '面对多项责任时，容易先回应外界要求，把自己的休息和日常安排放到后面。状态的起伏更多表现为忙碌与恢复之间切换不顺，工作之外仍在惦记未完成的事。')
    : strong
      ? reading('推进时劲头足，停下来较慢', '认准事情后持续投入的劲头较足，忙起来不容易主动收手。身心安排的矛盾更像是行动走在前面，休息与生活节奏跟不上连续推进。')
      : reading('日常状态受安排变化牵动', '日常状态与事情是否有序联系较紧，任务清楚时较容易保持自己的节奏。' + (changing ? '工作、关系或住处安排出现变化时，个人时间更容易被打散。' : '突击完成任务之后，容易出现一段松散期，节奏呈现集中投入与缓慢恢复交替。'));
  const mobility = workClash
    ? reading('工作与环境变化相互牵动', '工作安排与环境变动的联系较强，岗位衔接、跨团队协作或地点变化容易成为发展中的节点。变化通常伴随新的责任，机会和重新适应的成本会一起出现。')
    : changing
      ? reading('人生节奏偏动，环境调整较显眼', '发展过程里，环境和生活安排的调整较显眼，外出、迁居或圈子变化容易带来新的接触。原有关系与新安排之间的衔接，会比单纯决定去哪里更费心。')
      : reading('立足熟悉环境，外出多有明确目的', '发展节奏偏向在熟悉环境中积累，外出的动力多来自具体工作、学习或家庭安排。' + (roots.length >= 2 ? '已有基础对选择的牵引较强，改变环境通常伴随一段较长的权衡。' : '新环境会带来接触面，但是否形成稳定成果更取决于后续承担的事情。'));
  const home = dayClash || familyClash
    ? reading('居住安排随工作与家事调整', '住房与家庭安排容易被工作、关系或家人需要牵动，安定生活的愿望与现实变化常同时存在。涉及搬迁、租约或装修时，不同成员的时间和需求比单一花费更容易形成拉扯。')
    : wealth && resource
      ? reading('重家业积累，住房决策牵连较多', '对稳定住处和家庭积累较上心，住房选择常与收入、家人意见和长期计划连在一起。安家并非只看一时喜好，日常方便与长期负担都会进入权衡。')
      : reading('居住重实用，家业靠逐步累积', '对住处的要求偏向实用和稳定，家庭积累通常跟着工作与生活阶段逐步推进。对外部变化的反应不算急，既有生活习惯在住房选择里占较大分量。');
  const disputes = authority && output
    ? reading('争议多出在做法与规矩不一致', '对不合理的做法有自己的判断，表达意见较直接，工作中容易碰到“事情怎么做”与“规定怎么走”的分歧。争议的重点通常在执行方式、交付标准和决定权，口头对抗容易掩盖实际问题。')
    : workClash || (peer && wealth)
      ? reading('责任与利益交界处容易起摩擦', '合作中的责任、分工和利益边界较敏感，投入不对等或约定不清时更容易发生摩擦。争议常从具体交接和结算问题开始，随后牵动双方对关系的看法。')
      : reading('分歧偏向具体事务，少在口头争胜', '处理分歧更倾向围绕具体事情和既有规则，通常不以当场压过别人为主要目标。熟悉关系里的口头承诺与实际执行出现落差时，仍容易产生反复解释的成本。');
  const leading = Object.keys(groupWords).sort((a, b) => visible(b) - visible(a) || Number(monthGroup === b) - Number(monthGroup === a))[0];
  const character = {
    peer: reading('自主、肯承担，也不易马上退让', '做事有主见，自己的判断一旦形成，不太容易因为别人一句话就改变。长处是肯承担、能坚持，短板是合作中容易把坚持带成较劲，尤其在自己熟悉的事情上。'),
    output: reading('想法与表达突出，厌烦重复约束', '对事情有自己的理解，愿意表达，也习惯通过做出成果证明判断。长处在反应和改进意识，短板是想法一多就容易跳过细节，对反复确认的耐心不足。'),
    wealth: reading('目标清楚，得失感较强', '做事重实际结果，对成本、回报和资源安排有较明显的关注。长处是目标感清楚，短板是结果不明或投入迟迟得不到回应时，情绪容易被得失牵动。'),
    authority: reading('责任感与自我要求较突出', '做事看重责任、标准和别人是否认可，遇到重要任务不容易轻易放下。长处是认真守住要求，短板是外界评价占分量，容易把一件事的成败看成对自己的评价。'),
    resource: reading('理解和整理见长，决定前想得多', '做事习惯先理解再下判断，整理资料、吸收经验和寻找完整解释是长处。短板在想得较多，选择越重要越容易反复比较，行动速度可能落在准备之后。'),
  }[leading];
  const network = visible('peer') >= 2
    ? reading('同辈联系强，合作中也有竞争', '同龄人、同行和团队关系在生活中占分量，容易既互相带动，又在决定权和贡献上比较。一起做事时自主要求较强，关系热络并不等于分工和利益容易谈拢。')
    : peer
      ? reading('重平等与自主，合作看分工', '与同伴相处较看重平等，合作中愿意出力，也希望自己的判断有位置。能长期配合的关系往往职责清楚，含糊承诺或单方面迁就容易消耗耐心。')
      : authority && resource
        ? reading('人脉偏专业与资历联系', '人际支持更容易来自共同专业、工作关系和经验交流，关系常随着一起处理事情而加深。对可信度和做事分寸较在意，交往质量比表面热闹更有分量。')
        : reading('合作重互补，关系随事情发展', '人际联系更容易围绕共同任务和互补能力形成，具体做成事情比单纯应酬更能建立信任。关系的发展偏慢热，配合是否稳定会直接影响往来深浅。');
  const opening = {
    authority: '看重责任和事业上的位置，做选择时，较在意能否做成事情、得到认可。',
    resource: '靠专业和经验逐步积累优势，理解得深、做得熟，往往比起步快更重要。',
    output: '有想法，也肯动手，善于表达并把想法做成成果，机会更容易从实际作品和解决问题中打开。',
    wealth: '看重实际成果和长期积累，对收入、资源和投入回报较为敏感。',
    peer: '自主意识和竞争心较强，认准方向后投入深，也较在意自己能否掌握做事节奏。',
  }[monthGroup];
  const overall = opening + career.summary.split('。')[0] + '。' +
    (dayClash ? '明显的牵扯在工作与亲近关系的节奏不易同步，发展机会与生活调整常一起到来。' : weak ? '主要短板是责任与任务容易先于承接能力扩张，忙得多时也更容易分散精力。' : strong ? '主要短板是坚持较强、退让较慢，合作和关系中的磨合会影响事情推进。' : '整体节奏偏向逐步积累，遇到多种选择时，会在稳妥与求快之间反复权衡。');
  const overallHeadline = { authority: '发展围绕责任、资历与位置', resource: '积累见长，专业是发展支点', output: '靠想法与成果打开局面', wealth: '看重成果与积累，现实目标清楚', peer: '自主与竞争意识推动发展' }[monthGroup];
  return { summary: overall, dimensions: { pattern: reading(overallHeadline, overall), career, wealth: wealthReading, family, relationship, study, wellbeing, mobility, home, disputes, character, network } };
}

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
  const changing = relations.some(r => r.relation === '冲');
  const readings = publicReadings({ columns, monthGroup, roots, tendency, relations });
  const common = ['现实条件、资源与个人选择会改变事情如何表现。'];
  const configs = {
    pattern: { ...readings.dimensions.pattern, evidence: [...pattern.evidence, ...strengthEvidence], opportunities: [hasGroup('resource') ? '把一项专业做到能独立解决问题，资历和口碑会更容易接上。' : '选一个自己能持续交付成果的方向，先做好，再扩大规模。'], publicAdvice: '下一阶段只定一个主要目标，再为它安排时间、资源和合作对象。', cautions: pattern.cautions },
    career: { ...readings.dimensions.career, evidence: [...groups.authority, ...groups.resource.slice(0, 2)], opportunities: [hasGroup('resource') ? '培训、考证和专业进修适合与正在承担的工作结合，学完就找机会用起来。' : '挑一项能被明确评价的任务做出结果，争取独立负责的机会。'], publicAdvice: '接新任务前，把负责范围、完成标准和可用资源说清楚。', cautions: ['官杀出现不能直接推出公务员身份、升职年份或行政级别。'] },
    wealth: { ...readings.dimensions.wealth, evidence: [...groups.wealth, ...groups.output.slice(0, 2)], opportunities: [hasGroup('output') ? '作品、技术、服务和实际交付，是把能力换成收入的着力点。' : '把固定收入、额外收入和大额开销分开，能更清楚地看到积累从哪里来。'], publicAdvice: '谈合作时同时谈清付款时间和结算条件，不只看表面金额。', cautions: ['不由命盘推断资产数额、投资收益或所谓必赚年份。'] },
    family: { ...readings.dimensions.family, evidence: [...familyEvidence, ...groups.resource.slice(0, 2), ...groups.peer.slice(0, 2)], opportunities: ['把探望、照料和经济支持安排成能长期做到的节奏，关系更容易稳定。'], publicAdvice: '有分歧时先讨论眼前这件事怎么处理，少翻旧账，也少替别人做决定。', cautions: ['不据单一十神判断亲属生死、品性或关系必然破裂。'] },
    relationship: { ...readings.dimensions.relationship, evidence: relationshipEvidence.length ? relationshipEvidence : [evidence('R01-day-palace', `日支为${columns[2].branch}，作为传统配偶宫观察点。`, ['pillars.day'])], opportunities: ['一起处理一件实际的事，比只谈感受更容易看清双方能否配合。'], publicAdvice: '认真交往时，尽早聊清时间分配、金钱习惯和未来住在哪里。', cautions: ['不把日支冲合直接写成离婚、出轨或必婚；不以命盘判定伴侣价值。'] },
    study: { ...readings.dimensions.study, evidence: [...groups.resource, ...groups.output].slice(0, 6), opportunities: ['用考试、资格申请或一份可展示的作品，把学习投入变成明确成果。'], publicAdvice: '每周安排一次不看资料的练习，看看自己究竟会了多少。', cautions: ['不将文星、印星等同于录取通知或考试分数。'] },
    wellbeing: { ...readings.dimensions.wellbeing, evidence: strengthEvidence.slice(0, 2), opportunities: ['把容易消耗精力的事情分散安排，保留一段不被工作打断的休息时间。'], publicAdvice: '先从固定起床和收工时间做起，不必一下给自己加很多要求。', cautions: ['五行对应不能用于医学诊断、用药或判断具体器官病变。'] },
    mobility: { ...readings.dimensions.mobility, evidence: clashEvidence.filter(e => e.text.includes('冲')), opportunities: [changing ? '异地项目、出差或跨团队协作，可以成为接触新机会的入口。' : '先从短期出差、合作或课程接触新环境，再决定是否长期迁移。'], publicAdvice: '动身前把工作衔接、住处、通勤和费用一起算进去。', cautions: ['六冲不能单独推出搬家、车祸或特定目的地。'] },
    home: { ...readings.dimensions.home, evidence: [...groups.wealth.slice(0, 2), ...groups.resource.slice(0, 2), ...familyEvidence.slice(0, 2)], opportunities: ['先解决最影响日常生活的一两个问题，小调整也能让家里舒服很多。'], publicAdvice: '花大钱之前先定预算上限，并留出手续、工期和临时开销的余地。', cautions: ['不凭命盘承诺置业能力、房价变化或房产套数。'] },
    disputes: { ...readings.dimensions.disputes, evidence: [...groups.authority.slice(0, 2), ...groups.output.slice(0, 2), ...clashEvidence.slice(0, 2)], opportunities: ['提前讲清责任、交付和结算，能把不少矛盾解决在正式合作之前。'], publicAdvice: '重要变更留下文字确认，情绪上来时先缓一缓再回复。', cautions: ['不预言犯罪、定罪、刑期或灾祸；法律问题依据真实材料处理。'] },
    character: { ...readings.dimensions.character, evidence: exposed.map(c => evidence('F03-character-theme', `${c.label}${c.stem}为${c.stemGod}，仅作行为主题的传统入口。`, [`pillars.${c.key}`])), opportunities: ['把自己最顺手的做事方式用在合适的任务上，再用清单补容易遗漏的环节。'], publicAdvice: '重要决定给自己留一次复查：目标是什么，代价是什么，下一步由谁来做。', cautions: ['不能由干支判定善恶、诚实程度或固定人格。'] },
    network: { ...readings.dimensions.network, evidence: [...groups.peer, ...groups.resource.slice(0, 2)], opportunities: ['从一个范围清楚的小项目开始合作，比一开始就绑定很多事情更容易看清彼此。'], publicAdvice: '一起做事前，先讲清分工、报酬和遇到分歧时怎么决定。', cautions: ['比劫不直接等于朋友夺财，印星也不保证一定有人相助。'] },
  };
  const dimensions = DIMENSIONS.map(({ id, title }) => {
    const value = configs[id];
    return { id, title, publicTitle: PUBLIC_TITLES[id], ...value, evidence: value.evidence.length ? value.evidence : [evidence('F00-insufficient', '这一维度缺少足够的直接原局证据，保留为现实背景核对项。')], cautions: [...value.cautions, ...common], confidence: '传统规则支持度，非统计概率' };
  });
  return {
    version: RULE_VERSION, summary: readings.summary,
    dayMaster: dm, pattern, strength, dimensions, relations, groups,
    methodology: '月令立候选、根气与透干辨强弱，合冲刑害只作结构证据；各项判断均是明示规则的传统解释。',
    limitations: ['本规则集为首版简化子平框架，尚未覆盖全部格局成败、调候与特殊从化条件。', '排盘可复核不等于现实事件预测有效；解释和评分未经统计预测效度验证。'],
    contextProvided: Boolean(input.context || input.background),
  };
}
