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
  const dayFriction = relations.some(r => r.keys.includes('day') && ['冲', '刑', '害'].includes(r.relation));
  const dayCooperation = relations.some(r => r.keys.includes('day') && r.relation === '合');
  const familyFriction = relations.some(r => (r.keys.includes('year') || r.keys.includes('month')) && ['冲', '刑', '害'].includes(r.relation));
  const changing = relations.some(r => r.relation === '冲');
  const mainRoute = {
    authority: '你比较看重责任和做事的分寸，对目标、要求和别人是否认可自己的成绩较敏感。',
    resource: '你做事有先弄明白、再下判断的一面，善于从经验和已有知识中找办法，发展往往靠长期积累见长。',
    output: '你有自己的想法，也愿意通过表达和实际成果让别人看见，做事的动力常来自“把这件事做得更好”。',
    wealth: '你比较看重实际结果，对收入、资源和投入是否值得较留意，做事容易围绕明确目标展开。',
    peer: '你有主见，比较看重自主和掌控，认准的事情愿意亲自投入，遇到问题也倾向先靠自己解决。',
  }[monthGroup];
  const secondStrength = hasGroup('authority') && hasGroup('resource')
    ? '事业上，专业积累、资历和承担责任能够相互带动，比起短期表现，更容易靠持续做成事情建立位置。'
    : hasGroup('output') && hasGroup('wealth')
      ? '能力和挣钱之间有较直接的联系，项目、作品、技术或服务是容易发挥的地方，成果越具体，机会越容易接上。'
      : hasGroup('resource') && hasGroup('peer')
        ? '既能吸收别人的经验，也有自己坚持的方向，在熟悉的领域里，耐心和独立做事的能力是长处。'
        : hasGroup('wealth')
          ? '对现实安排和资源分配较上心，钱财积累通常与工作成果、家庭责任一起推进，属于一件件落实的路子。'
          : '在目标清楚、能持续投入的事情上，更容易做出自己的积累，发展节奏偏向逐步站稳再向外展开。';
  const paceAdvice = tendency === '偏弱倾向'
    ? '短板是事情集中时容易顾此失彼，既想把责任接住，又可能被太多要求牵着走。'
    : tendency === '偏旺倾向'
      ? '短板是主意定得较快，遇到不同意见时不太容易马上退让，合作和亲近关系中尤其需要磨合。'
      : dayFriction
        ? '关系里容易出现“彼此在意、做法却不一致”的情况，工作与生活节奏一冲突，就需要多花心思协调。'
        : '同时面对几种选择时，容易在稳妥和求快之间来回权衡，发展中会有边做边调整的阶段。';
  const common = ['现实条件、资源与个人选择会改变事情如何表现。'];
  const configs = {
    pattern: { summary: `${mainRoute}${secondStrength}${paceAdvice}`, evidence: [...pattern.evidence, ...strengthEvidence], opportunities: [hasGroup('resource') ? '把一项专业做到能独立解决问题，资历和口碑会更容易接上。' : '选一个自己能持续交付成果的方向，先做好，再扩大规模。'], publicAdvice: '下一阶段只定一个主要目标，再为它安排时间、资源和合作对象。', cautions: pattern.cautions },
    career: { summary: groupSummary('authority', '工作上更适合有明确职责和上升路径的岗位，可靠、守时、能交付是可以做出来的优势。也容易把考核和别人的期待看得较重，别把所有责任都揽到自己身上。', '工作上更需要凭具体本事站住脚，专业作品、客户反馈和解决问题的能力，比空泛的头衔更有分量。方向不宜换得太勤，要给经验积累留出时间。'), evidence: [...groups.authority, ...groups.resource.slice(0, 2)], opportunities: [hasGroup('resource') ? '培训、考证和专业进修适合与正在承担的工作结合，学完就找机会用起来。' : '挑一项能被明确评价的任务做出结果，争取独立负责的机会。'], publicAdvice: '接新任务前，把负责范围、完成标准和可用资源说清楚。', cautions: ['官杀出现不能直接推出公务员身份、升职年份或行政级别。'] },
    wealth: { summary: groupSummary('wealth', '对投入产出和手里的资源较留意，收入往往与实际项目、工作成果和承担的责任绑在一起。积累的难点是进账之外还有支出和人情安排，忙得多不一定就留得多。', '收入更容易围绕本职工作和逐渐成熟的专长展开，积累偏向持续做事、慢慢留住。遇到新机会时容易被外面的节奏带动，项目铺得太多反而会分散精力。'), evidence: [...groups.wealth, ...groups.output.slice(0, 2)], opportunities: [hasGroup('output') ? '作品、技术、服务和实际交付，是把能力换成收入的着力点。' : '把固定收入、额外收入和大额开销分开，能更清楚地看到积累从哪里来。'], publicAdvice: '谈合作时同时谈清付款时间和结算条件，不只看表面金额。', cautions: ['不由命盘推断资产数额、投资收益或所谓必赚年份。'] },
    family: { summary: familyFriction ? '你和家人之间更需要把关心与做法分开看：在意彼此，却可能在工作、花钱或生活安排上各有主意。把话说清楚通常比默默承担、事后委屈更有用。' : hasGroup('resource') ? '家人和长辈的经验，可以成为你遇事时的一份支持。接受帮助时也要保留自己的判断，尤其是涉及长期工作和生活选择的时候。' : '处理家里的事，适合走务实路线：谁有空、谁出力、谁承担费用，提前讲好会轻松很多。别因不好意思开口，就把长期责任都放在自己身上。', evidence: [...familyEvidence, ...groups.resource.slice(0, 2), ...groups.peer.slice(0, 2)], opportunities: ['把探望、照料和经济支持安排成能长期做到的节奏，关系更容易稳定。'], publicAdvice: '有分歧时先讨论眼前这件事怎么处理，少翻旧账，也少替别人做决定。', cautions: ['不据单一十神判断亲属生死、品性或关系必然破裂。'] },
    relationship: { summary: dayFriction ? '感情里既有靠近的需要，也容易在节奏、花钱和相处方式上互不相让。关系能走得稳，关键是把分歧谈具体，不用冷处理代替沟通。' : dayCooperation ? '感情里比较重视陪伴和共同安排，愿意为关系投入时间。要留意过度迁就，把自己的需求说出来，双方才知道怎样相处更舒服。' : '感情更适合慢慢建立信任，用日常相处看清彼此的习惯和责任感。关系稳定之后，也别把交流省掉，重要安排仍要一起商量。', evidence: relationshipEvidence.length ? relationshipEvidence : [evidence('R01-day-palace', `日支为${columns[2].branch}，作为传统配偶宫观察点。`, ['pillars.day'])], opportunities: ['一起处理一件实际的事，比只谈感受更容易看清双方能否配合。'], publicAdvice: '认真交往时，尽早聊清时间分配、金钱习惯和未来住在哪里。', cautions: ['不把日支冲合直接写成离婚、出轨或必婚；不以命盘判定伴侣价值。'] },
    study: { summary: hasGroup('resource') && hasGroup('output') ? '学习上适合“学完再讲出来、做出来”，把知识整理成笔记、作品或解题步骤，更容易真正掌握。要留意准备很多、迟迟不交成果。' : hasGroup('resource') ? '学习更适合有系统、有老师或教材带着走，基础打牢后，后面的进步更稳。容易在资料准备上花时间，练题和实际应用也要跟上。' : hasGroup('output') ? '学习适合从实际问题入手，边做边改，表达和动手能帮助你把知识记住。遇到考试，还要单独训练答题格式和时间分配。' : '学习更需要一个明确目标和固定节奏，分阶段练习比临时猛学更合适。课程不要同时铺得太多，先把一门真正学会。', evidence: [...groups.resource, ...groups.output].slice(0, 6), opportunities: ['用考试、资格申请或一份可展示的作品，把学习投入变成明确成果。'], publicAdvice: '每周安排一次不看资料的练习，看看自己究竟会了多少。', cautions: ['不将文星、印星等同于录取通知或考试分数。'] },
    wellbeing: { summary: tendency === '偏弱倾向' ? '身心状态更需要靠稳定节奏来照顾。事情集中时，把任务分批处理、留出休息时间，比一直硬撑更容易维持状态。' : tendency === '偏旺倾向' ? '做事有劲头时，也要给自己留一个收工的时间。适量活动能帮助切换状态，别让连续加班、熬夜挤掉日常休息。' : '状态更适合靠规律来维持：工作、活动和休息都有固定位置，忙时也不至于全部打乱。尤其留意短期突击以后，能否回到正常节奏。', evidence: strengthEvidence.slice(0, 2), opportunities: ['把容易消耗精力的事情分散安排，保留一段不被工作打断的休息时间。'], publicAdvice: '先从固定起床和收工时间做起，不必一下给自己加很多要求。', cautions: ['五行对应不能用于医学诊断、用药或判断具体器官病变。'] },
    mobility: { summary: changing ? '外出、换环境和接触不同的人，更容易成为打开局面的机会。变化多时也容易打乱原有安排，搬迁或换岗位前，把接下来的生活接稳更重要。' : '发展更适合先站稳一个地方，再带着明确目的往外走。为了具体工作、求学或家庭安排而动，比单纯想换个环境更容易见到成果。', evidence: clashEvidence.filter(e => e.text.includes('冲')), opportunities: [changing ? '异地项目、出差或跨团队协作，可以成为接触新机会的入口。' : '先从短期出差、合作或课程接触新环境，再决定是否长期迁移。'], publicAdvice: '动身前把工作衔接、住处、通勤和费用一起算进去。', cautions: ['六冲不能单独推出搬家、车祸或特定目的地。'] },
    home: { summary: hasGroup('wealth') && hasGroup('resource') ? '住房和家庭积累适合放在长期安排里，既看负担能力，也看是否真正方便生活。家里意见较多时，先把预算和实际需求统一，后面会省心。' : changing ? '居住安排可能需要随着工作或家庭节奏调整，保留一定灵活性会更从容。别只看眼前方便，也要算上搬家、装修和日常通勤的成本。' : '安定、好打理的居住环境更有利于把精力放在正事上。涉及租房、装修或置业时，适合按自己的现金和生活需要逐步推进。', evidence: [...groups.wealth.slice(0, 2), ...groups.resource.slice(0, 2), ...familyEvidence.slice(0, 2)], opportunities: ['先解决最影响日常生活的一两个问题，小调整也能让家里舒服很多。'], publicAdvice: '花大钱之前先定预算上限，并留出手续、工期和临时开销的余地。', cautions: ['不凭命盘承诺置业能力、房价变化或房产套数。'] },
    disputes: { summary: hasGroup('authority') && hasGroup('output') ? '你容易有自己的判断，遇到不合理的安排也愿意指出来，这是解决问题的长处。需要留意的是表达方式，先把事实和要求讲清楚，比当场争高下更有效。' : clashEvidence.length ? '分歧往往更值得从责任不清、口头约定或沟通节奏里找原因。把该写下来的事写清楚，能减少后续来回解释和相互埋怨。' : '处理分歧更适合稳妥、按流程来，事实清楚时不必急着争辩。不要因为关系熟，就省去合同、验收或交接这些步骤。', evidence: [...groups.authority.slice(0, 2), ...groups.output.slice(0, 2), ...clashEvidence.slice(0, 2)], opportunities: ['提前讲清责任、交付和结算，能把不少矛盾解决在正式合作之前。'], publicAdvice: '重要变更留下文字确认，情绪上来时先缓一缓再回复。', cautions: ['不预言犯罪、定罪、刑期或灾祸；法律问题依据真实材料处理。'] },
    character: { summary: hasGroup('output') ? '做事容易有自己的想法，愿意表达，也适合通过实际成果说服别人。要留意想到就说、说完就做，重要事情多留一步检查会更稳。' : hasGroup('resource') ? '做事更愿意先弄明白再行动，整理信息、吸收经验是可以发挥的长处。要留意想得周全却迟迟不开始，先做一个小版本往往更有效。' : hasGroup('peer') ? '做事较看重自主和掌控，认准的事情愿意自己扛。合作时适当分工、让别人参与，能把个人的坚持变成团队的推进力。' : '做事更适合围绕具体目标，一件件安排清楚再推进。遇到同时出现的要求，先定轻重缓急，避免被眼前琐事带着走。', evidence: exposed.map(c => evidence('F03-character-theme', `${c.label}${c.stem}为${c.stemGod}，仅作行为主题的传统入口。`, [`pillars.${c.key}`])), opportunities: ['把自己最顺手的做事方式用在合适的任务上，再用清单补容易遗漏的环节。'], publicAdvice: '重要决定给自己留一次复查：目标是什么，代价是什么，下一步由谁来做。', cautions: ['不能由干支判定善恶、诚实程度或固定人格。'] },
    network: { summary: groupSummary('peer', '和同龄人、同行合作，既能互相带动，也容易在分工和利益上较劲。合得来是一回事，能否长期一起做事还要看责任和账目是否清楚。', '人际合作更适合重质量，找能互补、愿意把事情做好的人慢慢建立信任。不必为了维持关系接下所有请求，也别把客气当成明确承诺。'), evidence: [...groups.peer, ...groups.resource.slice(0, 2)], opportunities: ['从一个范围清楚的小项目开始合作，比一开始就绑定很多事情更容易看清彼此。'], publicAdvice: '一起做事前，先讲清分工、报酬和遇到分歧时怎么决定。', cautions: ['比劫不直接等于朋友夺财，印星也不保证一定有人相助。'] },
  };
  const dimensions = DIMENSIONS.map(({ id, title }) => {
    const value = configs[id];
    return { id, title, publicTitle: PUBLIC_TITLES[id], ...value, evidence: value.evidence.length ? value.evidence : [evidence('F00-insufficient', '这一维度缺少足够的直接原局证据，保留为现实背景核对项。')], cautions: [...value.cautions, ...common], confidence: '传统规则支持度，非统计概率' };
  });
  return {
    version: RULE_VERSION, summary: `${mainRoute}${secondStrength}${paceAdvice}`,
    dayMaster: dm, pattern, strength, dimensions, relations, groups,
    methodology: '月令立候选、根气与透干辨强弱，合冲刑害只作结构证据；各项判断均是明示规则的传统解释。',
    limitations: ['本规则集为首版简化子平框架，尚未覆盖全部格局成败、调候与特殊从化条件。', '排盘可复核不等于现实事件预测有效；解释和评分未经统计预测效度验证。'],
    contextProvided: Boolean(input.context || input.background),
  };
}
