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
  return { publicTitle: publicTitles[id], reading: body };
}

// Event support is kept separate from the six trend scores. It measures a
// traditional structural change, never event probability or remaining lifetime.
export const EVENT_DOMAINS = [
  ['pattern','整体发展'],['career','事业工作'],['wealth','收入积累'],['family','父母家人'],
  ['relationship','感情婚姻'],['study','学习考试'],['wellbeing','身心状态'],['mobility','外出变动'],
  ['home','住房家产'],['disputes','合同纠纷'],['character','性格做事'],['network','人际合作'],
].map(([id,title])=>({id,title}));
const ROLE_DOMAINS = {
  peer:{network:1.8,wealth:.8,character:1.2},output:{career:1,study:.8,character:1.5},
  wealth:{wealth:1.8,home:1.1,relationship:.7},authority:{career:1.8,disputes:1.1},
  resource:{study:1.8,family:1.2,home:.7},
};
const PALACE_DOMAINS = {
  year:{family:1,home:.5},month:{career:.9,study:.6,disputes:.5},
  day:{relationship:1,home:.65},hour:{family:.7,character:.4},
};
const relationWeight = relation => ({冲:3,刑:2.2,害:1.6,合:1.6,伏吟:1.3})[relation]||0;
function structuralSignals(pillar, columns, analysis, label, luckPillars=[]) {
  const map=Object.fromEntries(EVENT_DOMAINS.map(d=>[d.id,{id:d.id,support:0,friction:0,evidence:[]}]));
  if(!validPillar(pillar)||!columns.length)return map;
  const add=(id,value,ruleId,text,friction=false)=>{
    const target=map[id];if(!target||target.evidence.some(e=>e.ruleId===ruleId&&e.text===text))return;
    target.support+=value;if(friction)target.friction+=value;target.evidence.push({ruleId,text});
  };
  const dm=analysis.dayMaster,groups=new Set(),frictionContacts=[];
  for(const [stem,factor] of [[pillar[0],1],[HIDDEN[pillar[1]][0],.65]]){
    const group=godGroup(tenGod(dm,stem));groups.add(group);
    if(!(analysis.groups?.[group]?.length))continue;
    const repeats=columns.some(c=>c.key!=='day'&&c.stem===stem);
    for(const [id,value] of Object.entries(ROLE_DOMAINS[group]||{}))
      add(id,value*factor*(repeats?1.5:1),'E01-role-activation',`${label}${pillar}的${stem}为${tenGod(dm,stem)}，原局有同类十神${repeats?'且同干透出':''}。`);
  }
  for(const col of columns){
    const relations=branchRelations(pillar[1],col.branch);
    if(pillar[1]===col.branch&&!relations.length)relations.push('伏吟');
    for(const relation of relations){
      const value=relationWeight(relation),friction=['冲','刑','害'].includes(relation);
      const text=`${label}${pillar}与原局${col.label}${col.ganZhi}地支${relation}。`;
      if(friction)frictionContacts.push({col,relation,text});
      for(const [id,factor] of Object.entries(PALACE_DOMAINS[col.key]||{}))add(id,value*factor,'E02-palace-contact',text,friction);
      if(relation==='冲')add('mobility',2.4,'E03-movement',text,true);
      if(relation==='合'&&['year','month'].includes(col.key))add('network',1.7,'E04-cooperation',text);
    }
  }
  if(pillar[0]===dm)add('character',1.8,'E12-self-direction',`${label}天干${pillar[0]}与日干相同，自主决定与个人做事方式主题较突出。`);
  const has=group=>Boolean(analysis.groups?.[group]?.length);
  if((groups.has('output')&&has('authority'))||(groups.has('authority')&&has('output')))
    add('disputes',2.4,'E05-expression-and-rules',`${label}${pillar}引出表达、执行与规章之间的协调主题，原局食伤与官杀相关。`,true);
  if(groups.has('peer')&&has('peer'))add('network',1,'E06-peer-activation',`${label}${pillar}比劫与原局同类叠见，合作、同辈分工主题增加。`);
  if(frictionContacts.length>=2){
    const distinct=new Set(frictionContacts.map(x=>x.col.key)).size;
    if(distinct>=2)add('wellbeing',2+distinct*.6,'E07-pace-pressure',`${label}同时触及${distinct}处宫位，日常安排与休息节奏可能相互挤占。`,true);
    if(frictionContacts.some(x=>x.col.key==='month'))add('disputes',1.2,'E08-multiple-frictions',`${label}多处关系变化涉及月柱，交接与分工需要重新协调。`,true);
  }
  for(const luck of luckPillars){
    if(!validPillar(luck))continue;
    const role=godGroup(tenGod(dm,luck[0]));
    if(groups.has(role)&&has(role))for(const [id,value] of Object.entries(ROLE_DOMAINS[role]||{}))add(id,value*.55,'E09-luck-year-role',`${label}${pillar}与大运${luck}有同类十神主题。`);
    for(const relation of branchRelations(pillar[1],luck[1]))add('pattern',relationWeight(relation),'E10-luck-year-contact',`${label}${pillar}与大运${luck}地支${relation}。`,relation!=='合');
  }
  return map;
}
function eventContext(yearData,input){
  const applies=yearData.year===Number(input.contextYear);
  const context=applies?(input.context||input.background||{}):{};
  const occupation=String(context.occupation||context.stage||context.employmentStatus||'');
  const relationship=String(context.relationship||''),plans=String(context.plans||'');
  const priorities=Object.fromEntries(Object.entries({
    pattern:/转型|重新规划|人生方向/,career:/工作|岗位|晋升|项目|创业|跳槽|求职|入职/,
    wealth:/回款|结算|财务|收入|支出|预算|投资/,family:/父母|长辈|孩子|子女|照料|探亲/,
    relationship:/结婚|恋爱|相亲|婚姻|伴侣|交往/,study:/考试|考研|考公|考证|进修|学习|课程|资格|职称|论文|作品|入学/,
    wellbeing:/休息|作息|压力|加班|运动/,mobility:/出差|搬家|搬迁|迁居|异地|留学|出国|通勤/,
    home:/房|装修|租约|租房|置业/,disputes:/合同|纠纷|争议|诉讼|赔偿/,
    character:/习惯|表达|做事方式/,network:/合作|合伙|朋友|团队|分工/,
  }).map(([id,re])=>[id,re.test(plans)]));
  const single=/单身|未婚且无|没有伴侣|无伴侣|single/i.test(relationship)&&!/非单身|不再单身/.test(relationship);
  return {occupation,relationship,plans,priorities,single,partnered:/已婚|有伴侣|恋爱中|已订婚|married|partnered/i.test(relationship)&&!single,
    retired:/退休|retired/i.test(occupation),student:/学生|在读|本科|研究生|中学|小学|student/i.test(occupation)&&!/在职/.test(occupation),applies};
}
const MONTH_READINGS={
  pattern:['工作、生活安排可能同时进入调整阶段，原先的优先顺序需要重排。','前面酝酿的安排较容易进入落实阶段，发展方向逐渐清楚。'],
  career:['岗位分工、任务交接或考核要求较容易变化，留意返工与职责不清。','承担新任务、项目交付或岗位争取较容易成为这个阶段的重点。'],
  wealth:['付款、回款与临时支出容易碰在一起，资金安排可能比平时紧。','已有项目的验收、回款或收入结算较值得关注。'],
  family:['家人之间可能需要重新分配照料、探望或日常事务，时间安排容易有分歧。','家中共同事务、探望或照料安排较容易推进，长辈与晚辈的往来增多。'],
  relationship:['相处中的时间、花钱和共同安排较容易出现分歧，需要把事情重新谈清。','交往关系的确认、共同计划或双方家庭的沟通较容易推进。'],
  study:['课程、考试或材料提交较容易遇到调整，重点留意补交、返修和截止时间。','学习成果、考试准备或资格材料较容易进入提交和反馈阶段。'],
  wellbeing:['事务集中时，休息与个人安排容易被挤占，忙碌后的恢复节奏值得留意。','生活节奏较容易重新稳定，原先被打断的休息和活动安排有机会恢复。'],
  mobility:['行程、通勤或异地安排较容易改动，注意交通、住处和交接的衔接。','外出、换地点或接触新环境的安排较容易集中出现。'],
  home:['住处、租约、维修或家务分工可能出现需要协调的事项，预算和时间容易反复。','居住安排、家中手续或已有改造计划较容易进入落实阶段。'],
  disputes:['口头约定、责任划分或交付标准较容易产生不同理解，变更要落实到文字。','原先悬而未决的分工、条款或交接问题较容易谈出具体办法。'],
  character:['容易因事情催得急而说话直接、临时改变主意，决定后还可能需要回头调整。','做事方式更容易出现主动调整，表达观点、独立决定的机会增多。'],
  network:['合作分工、利益分配或朋友间的承诺较容易重新商量，原有配合方式可能改变。','同事、同行或朋友之间的协作增多，较容易有共同项目或新的联系。'],
};
const EXTRA_TITLES={pattern:['发展节奏进入调整期','原有积累开始接上新安排'],family:['家中事务与照料分工有变化','家人往来与共同安排增多'],wellbeing:['忙碌与休息的安排需要重排','生活节奏逐渐稳定'],disputes:['合同、责任与分工容易有争议','把悬而未决的约定谈清楚'],character:['做事节奏和表达方式有变化','自主决定与表达的机会增加'],network:['合作关系和分工需要调整','协作与新联系增多']};
const EXTRA_YEAR_READINGS={
  pattern:['这一年的发展节奏有明显转折，工作与生活里的几项安排容易相互牵动，旧的做法需要调整。','这一年更容易把前期积累接到新的任务和生活安排上，事情从酝酿转向落实。'],
  family:['这一年家人事务占用的时间增加，照料责任、长幼之间的意见和生活安排容易重新分配。','这一年与家人的往来和共同事务增加，家庭中的支持和相互配合更容易体现出来。'],
  wellbeing:['这一年的忙碌来自多项安排同时挤在一起，工作、家庭与个人时间之间的拉扯比较明显。','这一年的生活节奏趋于稳定，精力分配更有秩序，先前被打乱的日常安排逐渐恢复。'],
  disputes:['这一年容易在责任归属、交付要求和约定变更上出现争议，事情往往卡在各方理解不一致。','这一年已有分歧更容易进入具体协商，悬而未决的条款、分工和交接开始有明确处理方向。'],
  character:['这一年自主决定的事情增多，但临时改主意和表达过急也更明显，做事方式会经历一轮调整。','这一年更愿意表达自己的判断，独立处理事情的机会增多，做事方式开始形成更清楚的个人主张。'],
  network:['这一年合作关系进入重新磨合的阶段，分工、利益和承诺比交情本身更容易成为矛盾点。','这一年人际往来和协作机会增多，新联系、共同项目和同行之间的配合成为比较突出的主题。'],
};

export function annualEvents(yearData, analysis, input={}, columns=[]) {
  const context=eventContext(yearData,input),age=yearData.age;
  const luckPillars=[...new Set(yearData.months.flatMap(m=>(m.segments||[]).map(s=>s.daYun)).filter(validPillar))];
  const signals=structuralSignals(yearData.ganZhi,columns,analysis,'流年',luckPillars);
  const changes=yearData.months.filter(m=>(m.segments||[]).length>1);
  if(changes.length){signals.pattern.support+=5;signals.pattern.evidence.push({ruleId:'E11-luck-transition',text:`本年${changes.map(m=>m.ganZhi).join('、')}月发生大运交接。`});}
  const allowed=id=>{
    if(Number.isFinite(age)&&age<18&&['career','wealth','relationship','disputes'].includes(id))return false;
    if(context.retired&&id==='career')return false;
    if(context.student&&id==='career')return false;
    if(context.single&&!context.priorities.relationship&&id==='relationship')return false;
    return true;
  };
  const birth=input.solarDate?`${input.solarDate} ${input.solarTime||'00:00:00'}`:null;
  const monthly=yearData.months.filter(month=>!birth||!month.endDate||month.endDate>birth).map(month=>{
    const monthLuckPillars=[...new Set((month.segments||[]).map(segment=>segment.daYun).filter(validPillar))];
    const signals=structuralSignals(month.ganZhi,columns,analysis,'流月',monthLuckPillars);
    if((month.segments||[]).length>1){signals.pattern.support+=5;signals.pattern.evidence.push({ruleId:'E11-luck-transition',text:`${month.ganZhi}月在${month.segments[0].endDate}发生大运交接。`});}
    return {month,signals};
  });
  const candidates=Object.values(signals).filter(s=>allowed(s.id)&&s.evidence.length&&s.support>=3.4).map(s=>{
    const selected=monthly.filter(({signals:ms})=>ms[s.id].support>=3.4&&ms[s.id].evidence.some(e=>['E02-palace-contact','E03-movement','E05-expression-and-rules','E06-peer-activation','E09-luck-year-role','E10-luck-year-contact','E11-luck-transition'].includes(e.ruleId)))
      .sort((a,b)=>b.signals[s.id].support-a.signals[s.id].support).slice(0,2);
    return {...s,selected,rank:s.support+(context.priorities[s.id]?2:0)+(context.student&&s.id==='study'?1:0)};
  }).sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id));
  // No ranked fallback: quiet or inapplicable fields simply do not become events.
  return candidates.map(s=>{
    const average=yearData.domainScores?.[s.id]?.score;
    const high=s.id==='mobility'||(s.friction<s.support*.45&&(!Number.isFinite(average)||average>=50));
    let publicReading;
    if(EXTRA_TITLES[s.id])publicReading={publicTitle:EXTRA_TITLES[s.id][high?1:0],reading:EXTRA_YEAR_READINGS[s.id][high?1:0]};
    else publicReading=publicEventReading({id:s.id,high,selected:[],age,year:yearData.year,...context});
    const backgroundApplied=context.applies&&(context.priorities[s.id]||context.student&&s.id==='study'||context.retired&&s.id==='home'||s.id==='relationship'&&(context.single||context.partnered));
    const contextNote=backgroundApplied?`你提供的${input.contextYear}年情况：${context.plans||context.occupation||context.relationship}。`:'';
    return {domain:s.id,title:publicReading.publicTitle,...publicReading,condition:'当年有对应的生活事项时，结合实际进展观察。',
      scenario:contextNote+publicReading.reading,window:s.selected.map(({month:m})=>({monthIndex:m.index,ganZhi:m.ganZhi,startDate:m.startDate,endDate:m.endDate})),
      evidence:s.evidence,support:round(s.support),friction:round(s.friction),counterEvidence:'结构变化只支持主题，不等于事件必然发生。',verification:'对照实际安排、明确变更及处理结果。',
      backgroundApplied,contextYear:backgroundApplied?input.contextYear:null,contextScope:backgroundApplied?{startYear:input.contextYear,endYear:input.contextYear}:null,
      monthlySupport:s.selected.map(({month,signals:ms})=>({index:month.index,support:round(ms[s.id].support),high:ms[s.id].friction<ms[s.id].support*.45,evidence:ms[s.id].evidence})),
    };
  });
}
function focusMonthsFor(yearData){
  const byMonth=new Map();
  for(const event of yearData.events)for(const item of event.monthlySupport||[]){
    const month=yearData.months.find(m=>m.index===item.index);if(!month)continue;
    const row=byMonth.get(item.index)||{index:month.index,ganZhi:month.ganZhi,startDate:month.startDate,endDate:month.endDate,events:[],support:0};
    row.events.push({domain:event.domain,publicTitle:event.publicTitle,reading:MONTH_READINGS[event.domain][item.high?1:0],evidence:item.evidence});
    row.support=Math.max(row.support,item.support);byMonth.set(item.index,row);
  }
  return [...byMonth.values()].sort((a,b)=>b.support-a.support).slice(0,4).sort((a,b)=>a.index-b.index).map(({support,...row})=>row);
}

export function buildTimeline(chart, input = {}) {
  const common = { version: RULE_VERSION, method: '每月按原局、大运、流年与真实节气月干支计算明示启发式分数；年度开收为首末月，高低为全年月分极值。交运月按实际时间段加权。', scoreMeaning: '传统主题参考指数，不是财富、成就、健康或事件发生概率；迁移分项表示变化活跃度。', domains: TREND_DOMAINS, eventDomains: EVENT_DOMAINS, eventRuleVersion: 'annual-change-v2', limitations: ['未以现实事件数据校准，不能视为经过验证的人生预测。', '图表截止年龄仅是展示范围，不是寿命判断。'] };
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
    row.events = annualEvents(row, analysis, input, columns);
    row.focusMonths = focusMonthsFor(row);
    row.changeLevel = row.events.some(e=>e.support>=8) || row.events.length>=4 ? '较明显' : row.events.length ? '局部变化' : '平稳';
    const labels=row.events.map(e=>EVENT_DOMAINS.find(d=>d.id===e.domain).title);
    row.summary = labels.length ? `这一年较值得关注的是${labels.join('、')}，变化主要集中在这些方面。` : '这一年没有特别集中的变化主题，以原有生活安排的延续为主。';
    years.push(row);
  }
  return { ...common, available: years.length > 0, reason: years.length ? undefined : '所选范围没有完整的引擎流月数据。', range: { startYear, endYear }, birthYear, ageConvention: '按引擎 age 显示；缺省为公历年差加一，不是精确周岁。', years, incompleteYears, warnings: [...warnings], coverageComplete: incompleteYears.length === 0 };
}
