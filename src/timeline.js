import { analyzeChart, chartColumns, tenGod, godGroup, branchRelations, HIDDEN, STEMS, BRANCHES, RULE_VERSION } from './analysis.js';

export const TREND_DOMAINS = [
  { id: 'career', title: '事业工作' }, { id: 'wealth', title: '收入积累' }, { id: 'relationship', title: '感情婚姻' },
  { id: 'study', title: '学习考试' }, { id: 'mobility', title: '外出变动' }, { id: 'home', title: '住房家产' },
];
const round = n => Math.round(n * 10) / 10;
const clamp = n => Math.min(95, Math.max(5, round(n)));
const validPillar = value => typeof value === 'string' && STEMS.includes(value[0]) && BRANCHES.includes(value[1]);
export function parseCalendarDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  // These are calendar wall-clock values supplied in one declared basis. UTC here is only
  // an arithmetic coordinate; never apply the host machine's local timezone.
  let text = String(value).trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T00:00:00';
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += 'Z';
  const result = Date.parse(text);
  return Number.isFinite(result) ? result : null;
}

function activeCycle(cycles, timestamp, fallback) {
  if (timestamp === null) return fallback || null;
  return cycles.filter(c => {
    const start = parseCalendarDate(c.startDate), end = parseCalendarDate(c.endDate);
    return start !== null && timestamp >= start && (end === null || timestamp < end);
  }).sort((a, b) => (parseCalendarDate(b.startDate) || 0) - (parseCalendarDate(a.startDate) || 0))[0] || null;
}

function scorePeriod(columns, analysis, luckPillar, yearPillar, monthPillar) {
  const dm = analysis.dayMaster;
  const weak = analysis.strength.tendency === '偏弱倾向';
  const strong = analysis.strength.tendency === '偏旺倾向';
  const scores = Object.fromEntries(TREND_DOMAINS.map(d => [d.id, 50]));
  const contributions = [];
  const add = (domain, value, ruleId, text) => {
    scores[domain] += value;
    if (value !== 0) contributions.push({ domain, value: round(value), ruleId, text });
  };
  const thematic = {
    peer: { career: .4, wealth: -.4, relationship: .1, study: .2, mobility: .2, home: .1 },
    output: { career: .7, wealth: .5, relationship: .1, study: 1, mobility: .4, home: -.1 },
    wealth: { career: .4, wealth: 1, relationship: .3, study: -.1, mobility: .2, home: .7 },
    authority: { career: 1, wealth: .3, relationship: .1, study: .5, mobility: -.1, home: .2 },
    resource: { career: .5, wealth: .1, relationship: .2, study: 1, mobility: -.1, home: .6 },
  };
  for (const [layer, pillar, weight] of [['大运', luckPillar, 2.2], ['流年', yearPillar, 2.5], ['流月', monthPillar, 3]]) {
    if (!validPillar(pillar)) continue;
    for (const [stem, factor, detail] of [[pillar[0], 1, '天干'], [HIDDEN[pillar[1]][0], .65, '地支本气']]) {
      const god = tenGod(dm, stem), group = godGroup(god);
      // Balance is explicitly heuristic and is kept distinct from an asserted 用神.
      const supporting = ['peer', 'resource'].includes(group);
      const balanceFactor = weak ? (supporting ? .65 : -.55) : strong ? (supporting ? -.4 : .5) : .1;
      for (const { id } of TREND_DOMAINS) {
        const value = weight * factor * ((thematic[group]?.[id] || 0) + balanceFactor);
        add(id, value, 'T01-god-theme', `${layer}${pillar}${detail}${stem}为${god}；领域主题系数与${analysis.strength.tendency}均衡参考共同计分。`);
      }
    }
    for (const col of columns) for (const relation of branchRelations(pillar[1], col.branch)) {
      const factor = weight / 2.5;
      const text = `${layer}${pillar[1]}与原局${col.label}${col.branch}${relation}。${relation === '合' ? '协同主题加权，不等于必成。' : '变动或协调成本加权，不等于灾祸。'}`;
      if (relation === '合') {
        add(col.key === 'day' ? 'relationship' : 'career', 1.3 * factor, 'T02-branch-combination', text);
        add('home', .5 * factor, 'T02-branch-combination', text);
      } else {
        const severity = relation === '冲' ? 1.6 : relation === '刑' ? 1.1 : .8;
        add('relationship', (col.key === 'day' ? -2.8 : -.5) * severity * factor, 'T03-branch-friction', text);
        add('career', (col.key === 'month' ? -1.6 : -.4) * severity * factor, 'T03-branch-friction', text);
        add('home', (['year', 'month', 'day'].includes(col.key) ? -1.1 : -.3) * severity * factor, 'T03-branch-friction', text);
        if (relation === '冲') add('mobility', 2.5 * factor, 'T04-change-activation', text + '迁移指数表示变化主题活跃度，不代表变化一定有利。');
      }
    }
  }
  const domainScores = Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, clamp(v)]));
  return { score: clamp(Object.values(domainScores).reduce((a, b) => a + b, 0) / TREND_DOMAINS.length), domainScores, contributions };
}

function monthSegments(month, cycles, fallback) {
  const start = parseCalendarDate(month.startDate), end = parseCalendarDate(month.endDate);
  if (start === null || end === null || end <= start) return { precise: false, segments: [{ cycle: fallback, fraction: 1, startDate: month.startDate || null, endDate: month.endDate || null }] };
  const cuts = [start, end, ...cycles.flatMap(c => [parseCalendarDate(c.startDate), parseCalendarDate(c.endDate)]).filter(t => t !== null && t > start && t < end)];
  const points = [...new Set(cuts)].sort((a, b) => a - b);
  const segments = points.slice(0, -1).map((s, i) => {
    const e = points[i + 1];
    return { cycle: activeCycle(cycles, s + (e - s) / 2, fallback), fraction: (e - s) / (end - start), startDate: new Date(s).toISOString(), endDate: new Date(e).toISOString() };
  });
  return { precise: true, segments };
}

function publicEventReading({ id, high, selected, age, year, student, retired, single, partnered, occupation, plans, priorities }) {
  const friction = selected.some(m => m.contributions.some(c => c.domain === id && c.ruleId === 'T03-branch-friction'));
  const seeking = /待业|失业|求职|找工作/.test(occupation);
  const moving = priorities.mobility && /搬家|搬迁|迁居/.test(plans);
  const decorating = priorities.home && /装修/.test(plans);
  const buying = priorities.home && /买房|购房|置业/.test(plans);
  const dating = single || (priorities.relationship && /相亲|恋爱/.test(plans) && !partnered);
  const publicTitles = {
    career: seeking ? '找工作与岗位选择' : high ? '工作上争取更多发挥空间' : '工作安排需要多些协调',
    wealth: high ? '把收入落到实际到账' : '给支出和回款留出余地',
    relationship: dating ? '认识新人，慢慢看清是否合适' : high ? '把感情往共同生活上推进' : '相处中的分工要重新商量',
    study: age < 7 ? '养成稳定的学习和生活习惯' : high ? '把学习变成一份拿得出的成果' : '学习计划适合收拢重点',
    mobility: moving ? '搬家与生活衔接' : high ? '外出和换环境的安排增多' : '出行安排以稳妥为先',
    home: decorating ? '装修进度与预算' : buying ? '买房前把预算和需求谈妥' : retired ? '把家里的安排理顺' : '住处与家庭安排',
  };
  let body;
  if (id === 'career') {
    body = seeking
      ? (high ? '找工作时可以把重点放在能直接发挥经验的岗位，简历和面试尽量用已经做成的事情说话。' : '找工作适合收窄目标，先看职责和自己能否匹配，别因等待着急就接下条件不清的岗位。')
      : (high ? '如果当年在职，较值得争取的是独立负责一项任务、接手项目，或把现有成果做得更有分量。' : '如果当年在职，项目交接、任务分工或考核要求可能需要多沟通几次，先把完成标准说清楚，能减少返工。');
    if (high && friction) body += '机会来时也会带来协调工作，接下之前先谈清分工。';
  } else if (id === 'wealth') {
    body = high
      ? '有项目收入、经营回款或合同结算时，这一年适合把验收和收款盯紧，把已经做完的事情真正结到账上。'
      : '有回款和大额开销时，这一年更要错开时间安排，别让尚未到账的钱先被支出占满。';
    body += high ? '谈新合作时，付款节奏和实际能留下多少，比表面金额更值得细看。' : '合作分摊、临时加项和付款条件，提前讲清会省不少心。';
  } else if (id === 'relationship') {
    body = dating
      ? (high ? '有相亲或新交往安排时，可以多见面、多一起做些日常的事，关系更容易在实际相处中往前走。' : '有新交往安排时，先看相处是否舒服、双方投入是否一致，别急着因为一时热情就作长期承诺。')
      : (high ? `${partnered ? '和伴侣相处时' : '如果当年已有伴侣'}，适合把共同安排谈得更具体，比如住在哪里、钱怎么分配、双方各承担什么。` : `${partnered ? '和伴侣相处时' : '如果当年已有伴侣'}，时间分配、花钱或家务分工容易成为需要重新商量的地方，别把不满一直攒着。`);
    if (high && friction) body += '有不同意见时先解决眼前的事，不必马上争出谁对谁错。';
  } else if (id === 'study') {
    if (age < 7) body = '这一年更适合让家人帮着建立规律的作息和活动安排，通过游戏、阅读和动手慢慢培养兴趣，不必把日常学习排得太满。';
    else {
      const opening = student ? '在读期间' : priorities.study ? '围绕已有的学习或考试计划' : '如果当年有课程、考试或资格申请';
      body = high ? `${opening}，适合按进度把学习落实到练习、论文或作品上，做完一项就及时提交、争取反馈。` : `${opening}，需要防止任务排得太满，先保住最重要的一门考试或一份材料，再安排额外的学习。`;
      body += high ? '临近提交或考试时，留时间检查格式、材料和时间安排。' : '遇到补材料、返修或计划调整时，提前留几天余量会更从容。';
    }
  } else if (id === 'mobility') {
    body = moving
      ? (high ? '你已有搬家的打算，这一年适合把找住处、搬迁和工作衔接一步步落实，别只顾着搬完，还要考虑住下后的日常节奏。' : '你已有搬家的打算，时间安排上适合留些余地，住处、费用和工作衔接谈妥后再定最后日期。')
      : (high ? '若有出差、求学或异地项目的安排，这一年外出的事情可能比较集中，也更容易接触新的人和做事方式。' : '若有出差、求学或异地安排，适合围绕明确的事情去走，先落实手续和接应，避免临时反复改行程。');
    if (high && !moving) body += '提前留出交通、住宿和工作交接的时间，变化来了会更从容。';
  } else {
    body = decorating
      ? (high ? '已有装修计划时，适合把预算、施工顺序和验收时间一起落实，先做最影响日常使用的部分。' : '已有装修计划时，容易需要在预算、工期或具体做法上反复协调，变更项目先确认价格再开工。')
      : buying
        ? '已有买房计划时，先把长期月供、通勤和家庭成员的需要一起算清，再决定具体选择，别只被一时喜欢的房子带着走。'
        : (high ? '有租约、居住或照料家人的安排时，这一年适合把事情逐项落实，让家里的日常节奏更稳定。' : '有租约、居住或照料家人的安排时，预算和分工可能需要多商量几次，先定谁负责什么，事情会更好推进。');
    if (retired && !decorating && !buying) body += '也给自己的活动和休息留出位置，别把日常全排成替家人忙碌。';
  }
  const dateLabel = (value, includeYear = false) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    if (!match) return null;
    return `${includeYear || Number(match[1]) !== year ? match[1] + '年' : ''}${Number(match[2])}月${Number(match[3])}日`;
  };
  const ranges = selected.map(m => {
    const start = dateLabel(m.startDate), end = dateLabel(m.endDate);
    return start && end ? `${start}至${end}` : null;
  }).filter(Boolean);
  const timing = ranges.length ? `${ranges.join('、')}这两段时间，可以把相关安排多留意一下。` : '';
  return { publicTitle: publicTitles[id], reading: body + timing };
}

function annualEvents(yearData, analysis, input) {
  const months = yearData.months;
  const domainAverage = id => months.reduce((sum, m) => sum + m.domainScores[id], 0) / months.length;
  const age = yearData.age;
  const contextYear = Number(input.contextYear);
  const suppliedContext = input.context || input.background || {};
  const contextApplies = yearData.year === contextYear && typeof suppliedContext === 'object';
  const context = contextApplies ? suppliedContext : {};
  const occupation = String(context.occupation || context.stage || context.employmentStatus || '');
  const relationship = String(context.relationship || '');
  const plans = String(context.plans || '');
  const retired = /退休|retired/i.test(occupation);
  const student = /学生|在读|本科|研究生|中学|小学|student/i.test(occupation) && !/在职/.test(occupation);
  const single = /单身|未婚且无|没有伴侣|无伴侣|single/i.test(relationship) && !/非单身|不再单身/.test(relationship);
  const partnered = /已婚|有伴侣|恋爱中|已订婚|married|partnered/i.test(relationship) && !single;
  const priorities = {
    career: /工作|岗位|晋升|升职|调动|项目|创业|跳槽|求职|入职/.test(plans),
    wealth: /回款|结算|财务|收入|支出|预算|投资|创业/.test(plans),
    relationship: /结婚|恋爱|相亲|婚姻|伴侣|交往/.test(plans),
    study: /考试|考研|考公|考证|进修|学习|课程|培训|资格|职称|论文|作品|入学/.test(plans),
    mobility: /出差|搬家|搬迁|迁居|异地|留学|出国|通勤/.test(plans),
    home: /房|装修|租约|租房|置业|家人|照料|家庭/.test(plans),
  };
  let candidates = ['career', 'wealth', 'relationship', 'study', 'mobility', 'home'];
  if (Number.isFinite(age) && age < 18) candidates = ['study', 'mobility', 'home'];
  if (retired) candidates = ['home', 'study', 'mobility', 'relationship'];
  if (student) candidates = ['study', 'mobility', 'home', 'relationship'];
  if (single && !priorities.relationship) candidates = candidates.filter(id => id !== 'relationship');
  const templates = {
    career: { title: '岗位职责、项目分工或考核安排调整', condition: '若当年在职，并已有项目交接、组织调整或考核安排', positive: '关注职责扩大、项目交付和资格带来的岗位机会；先核对是否确有任命或项目安排。', negative: '优先核对任务边界、考核标准与交接责任；变化可表现为返工或协作方式调整。', outcome: '记录实际岗位、职责、项目负责人或考核要求是否发生变化。' },
    wealth: { title: '回款、合同结算或计划内大额支出', condition: '若当年有劳动收入、经营合同、回款或已确定的大额支出计划', positive: '关注明确合同的验收与结算窗口，区分账面收入和实际到账。', negative: '关注结算拖延、支出集中和合作分摊，需以真实账目判断。', outcome: '记录合同金额、应收与实际到账日期，或支出是否集中发生；不预设收益率。' },
    relationship: { title: '关系定位、共同安排与分工协商', condition: '若当年已有伴侣或正在认真交往；若单身，则仅在确有交往对象时适用', positive: '可观察关系确认、共同居住计划或双方安排能否推进。', negative: '可观察时间分配、共同财务或居住安排是否出现需要重新协商的事项。', outcome: '记录明确的关系进展或协商议题；没有交往对象时标记不适用。' },
    study: { title: '课程、考试、资格申请或作品提交', condition: '若当年在读，或已报名课程、考试、资格申请、作品评审', positive: '关注课程完成、材料提交、评审反馈与成果展示的窗口。', negative: '关注备考计划调整、补交材料和学习与其他任务的冲突。', outcome: '记录报名、提交、反馈和结果；未报名或无学习计划时不算作命中。' },
    mobility: { title: '出差、搬迁、异地项目或通勤变化', condition: '若当年因学业、工作或家庭已有出行、迁居或异地安排', positive: '变化主题较活跃，可核对是否出现新增出差、换地点或通勤调整。', negative: '变化主题较弱，优先关注已有安排是否延后或缩小范围。', outcome: '记录实际地点、出行次数或居住安排的变化；不预测具体目的地。' },
    home: { title: '租约、装修、居住分工或家庭预算调整', condition: '若当年有租约到期、装修、搬家、照料家人或置业计划', positive: '可关注手续推进、居住稳定和家庭分工落实。', negative: '可关注预算、工期、租约条款或家庭成员安排的协调成本。', outcome: '记录实际签约、开工、入住或家庭分工调整；没有相关计划时标记不适用。' },
  };
  const ranked = candidates.map(id => {
    const values = months.map(m => m.domainScores[id]);
    return { id, average: domainAverage(id), range: Math.max(...values) - Math.min(...values) };
  }).sort((a, b) => ((priorities[b.id] ? 30 : 0) + (student && b.id === 'study' ? 12 : 0) + Math.abs(b.average - 50) + b.range) - ((priorities[a.id] ? 30 : 0) + (student && a.id === 'study' ? 12 : 0) + Math.abs(a.average - 50) + a.range)).slice(0, 3);
  return ranked.map(({ id, average }) => {
    const high = average >= 50;
    const selected = [...months].sort((a, b) => high ? b.domainScores[id] - a.domainScores[id] : a.domainScores[id] - b.domainScores[id]).slice(0, 2).sort((a, b) => a.index - b.index);
    const t = templates[id];
    const facts = selected.flatMap(m => m.contributions.filter(c => c.domain === id).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 2).map(c => ({ ruleId: c.ruleId, text: `${m.ganZhi}月：${c.text}` })));
    const contextNotes = [];
    if (priorities[id]) contextNotes.push(`你提供的${contextYear}年计划中含相关事项：${plans}`);
    if (student && id === 'study') contextNotes.push(`你提供的职业阶段为“${occupation}”，因此优先列课程与考核情景`);
    if (retired) contextNotes.push(`你提供的阶段为“${occupation}”，本年不套用在职升职模板`);
    if (id === 'relationship' && partnered) contextNotes.push(`你提供的关系状态为“${relationship}”，因此讨论现有关系的分工与共同安排`);
    if (id === 'relationship' && single) contextNotes.push(`你提供的关系状态为“${relationship}”，只有实际开始交往后才适用伴侣协商情景`);
    let condition = t.condition;
    if (id === 'relationship' && partnered) condition = '若你提供的伴侣关系在当年持续，且确有共同安排或分工需要协商';
    if (id === 'relationship' && single) condition = '你目前单身；若当年实际开始相亲或认真交往，才适用本条关系进展情景';
    const publicReading = publicEventReading({ id, high, selected, age, year: yearData.year, student, retired, single, partnered, occupation, plans, priorities });
    return { domain: id, title: t.title, ...publicReading, condition, scenario: (contextNotes.length ? contextNotes.join('；') + '。' : '') + (high ? t.positive : t.negative), window: selected.map(m => ({ monthIndex: m.index, ganZhi: m.ganZhi, startDate: m.startDate || null, endDate: m.endDate || null })), evidence: facts, counterEvidence: '如果没有上述现实前提，此情景不适用；支持主题不保证事件发生。', verification: t.outcome, support: '按明示传统规则排序，非发生概率', backgroundApplied: contextNotes.length > 0, contextYear: contextNotes.length ? contextYear : null, contextScope: contextNotes.length ? { startYear: contextYear, endYear: contextYear, description: '当前背景仅用于明确的参考年，不反推其他年份的经历。' } : null };
  });
}

export function buildTimeline(chart, input = {}) {
  const common = { version: RULE_VERSION, method: '每月按原局、大运、流年与真实节气月干支计算明示启发式分数；年度开收为首末月，高低为全年月分极值。交运月按实际时间段加权。', scoreMeaning: '传统主题参考指数，不是财富、成就、健康或事件发生概率；迁移分项表示变化活跃度。', domains: TREND_DOMAINS, limitations: ['未以现实事件数据校准，不能视为经过验证的人生预测。', '图表截止年龄仅是展示范围，不是寿命判断。'] };
  if (!chart.luck?.available) return { ...common, available: false, reason: chart.luck?.reason || '缺少已确认的出生年及精确起运资料，不能生成完整人生时间线。', years: [] };
  const birthYear = Number(chart.birthYear ?? input.birthYear);
  if (!Number.isInteger(birthYear)) return { ...common, available: false, reason: '缺少出生公历年份，不能把四柱周期绑定到人生公历时间轴。', years: [] };
  const startYear = Number(input.startYear ?? birthYear), endYear = Number(input.endYear ?? birthYear + 80);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear || endYear - startYear + 1 > 120) throw new Error('流年范围须为整数年份、起年不晚于止年，且最多 120 年。');
  const analysis = analyzeChart(chart, input), columns = chartColumns(chart), cycles = chart.luck.cycles || [];
  const entries = new Map();
  for (const cycle of cycles) for (const annual of cycle.years || []) {
    const year = Number(annual.year);
    if (year < startYear || year > endYear) continue;
    const old = entries.get(year);
    if (!old || (annual.months?.length || 0) > (old.annual.months?.length || 0)) entries.set(year, { annual, cycle });
  }
  // An engine may provide a separate complete annual table, including pre-luck years.
  for (const annual of chart.luck.years || chart.years || []) {
    const year = Number(annual.year);
    if (year >= startYear && year <= endYear) entries.set(year, { annual, cycle: null });
  }
  const years = [], incompleteYears = [], warnings = new Set();
  for (let year = startYear; year <= endYear; year++) {
    const entry = entries.get(year);
    if (!entry || !validPillar(entry.annual.ganZhi) || entry.annual.months?.length !== 12 || entry.annual.months.some(m => !validPillar(m.ganZhi))) {
      incompleteYears.push({ year, reason: '缺少引擎提供的完整十二节气月，未生成蜡烛。' }); continue;
    }
    const { annual, cycle: fallback } = entry;
    const indexes = entry.annual.months.map((m, i) => m.index ?? i);
    if (new Set(indexes).size !== 12) { incompleteYears.push({ year, reason: '流月序号重复，未生成蜡烛。' }); continue; }
    const months = [...annual.months].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((month, ordinal) => {
      const split = monthSegments(month, cycles, fallback);
      if (!split.precise) warnings.add('部分流月缺少精确起止日期，采用引擎附属大运；这些年份不能声称已按交运日拆分。');
      const segments = split.segments.map(segment => ({
        ...scorePeriod(columns, analysis, segment.cycle?.ganZhi, annual.ganZhi, month.ganZhi),
        fraction: segment.fraction, startDate: segment.startDate, endDate: segment.endDate,
        daYun: validPillar(segment.cycle?.ganZhi) ? segment.cycle.ganZhi : '起运前',
      }));
      const domainScores = Object.fromEntries(TREND_DOMAINS.map(({ id }) => [id, round(segments.reduce((sum, s) => sum + s.domainScores[id] * s.fraction, 0))]));
      return { ...month, index: month.index ?? ordinal, score: round(segments.reduce((sum, s) => sum + s.score * s.fraction, 0)), domainScores, segments, daYun: [...new Set(segments.map(s => s.daYun))].join(' → '), transitionPrecision: split.precise ? 'date-segmented' : 'engine-year-assignment', contributions: segments.flatMap(s => s.contributions.map(c => ({ ...c, value: round(c.value * s.fraction), daYun: s.daYun }))) };
    });
    const values = months.map(m => m.score);
    const perDomain = Object.fromEntries(TREND_DOMAINS.map(({ id }) => {
      const d = months.map(m => m.domainScores[id]);
      return [id, { open: d[0], close: d[11], high: Math.max(...d), low: Math.min(...d), score: round(d.reduce((a, b) => a + b, 0) / 12) }];
    }));
    const row = { year, age: annual.age ?? year - birthYear + 1, ganZhi: annual.ganZhi, daYun: [...new Set(months.flatMap(m => m.segments.map(s => s.daYun)))].join(' → '), months, open: values[0], close: values[11], high: Math.max(...values), low: Math.min(...values), score: round(values.reduce((a, b) => a + b, 0) / 12), domainScores: perDomain, events: [] };
    row.events = annualEvents(row, analysis, input);
    years.push(row);
  }
  return { ...common, available: years.length > 0, reason: years.length ? undefined : '所选范围没有完整的引擎流月数据。', range: { startYear, endYear }, birthYear, ageConvention: '按引擎 age 显示；缺省为公历年差加一，不是精确周岁。', years, incompleteYears, warnings: [...warnings], coverageComplete: incompleteYears.length === 0 };
}
