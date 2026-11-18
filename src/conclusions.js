import {chartColumns,godGroup} from './analysis.js';
import {analyzeMarriage} from './marriage-conclusions.js';

const ev=(ruleId,text,fields=[])=>({ruleId,text,fields});
const joining=items=>[...new Set(items)].join('、');

/** Interpretation only: leaves the original pattern, strength and trend inputs intact. */
function structure(chart,analysis){
  const columns=chartColumns(chart),month=columns.find(c=>c.key==='month');
  const exposed=columns.filter(c=>c.key!=='day');
  const relations=analysis.relations||[];
  const selected=month.hiddenStems.find(h=>exposed.some(c=>c.stem===h.stem))||month.hiddenStems[0];
  const visible=god=>exposed.filter(c=>c.stemGod===god);
  const visibleGroup=group=>exposed.filter(c=>godGroup(c.stemGod)===group);
  const rootsFor=col=>columns.filter(c=>c.hiddenStems.some(h=>h.stem===col.stem));
  const rootSound=col=>rootsFor(col).some(root=>!relations.some(r=>r.relation==='冲'&&r.keys.includes(root.key)));
  const rooted=god=>visible(god).some(rootSound);
  const effective=god=>rooted(god)||(month.hiddenStems[0].god===god&&!relations.some(r=>r.relation==='冲'&&r.keys.includes('month')));
  const monthClash=relations.some(r=>r.relation==='冲'&&r.keys.includes('month'));
  const resourceRoot=exposed.some(c=>godGroup(c.stemGod)==='resource'&&rootSound(c));
  const wealthStrong=effective('正财')||effective('偏财');
  const wealthAgainstSeal=wealthStrong&&visibleGroup('wealth').length>0&&resourceRoot;
  const sealRescue=resourceRoot&&!wealthAgainstSeal;
  const officer=effective('正官'),kill=effective('七杀');
  const injuryOfficer=visible('伤官').length>0&&(visible('正官').length>0||selected.god==='正官');
  const foodControlsKill=kill&&rooted('食神')&&!effective('偏印');
  const officerSeal=officer&&sealRescue;
  const killSeal=kill&&sealRescue;
  const outputFeedsWealth=visibleGroup('output').some(rootSound)&&wealthStrong;
  const peerWealth=visibleGroup('peer').length>=2&&(selected.god==='正财'||selected.god==='偏财'||visibleGroup('wealth').length>0)&&!outputFeedsWealth;
  return {columns,month,exposed,relations,selected,visible,visibleGroup,monthClash,rooted,effective,
    resourceRoot,sealRescue,officer,kill,injuryOfficer,foodControlsKill,officerSeal,killSeal,outputFeedsWealth,peerWealth,
    weak:analysis.strength.tendency==='偏弱倾向',strong:analysis.strength.tendency==='偏旺倾向'};
}

function patternConclusion(s){
  const god=s.selected.god;
  const name=['比肩','劫财'].includes(god)?'比劫当令':god+'格';
  const evidence=[ev('O01-month-structure',`${s.month.label}${s.month.ganZhi}以${s.selected.stem}${god}为格局入口；${s.visible(god).length?'天干有同类透出':'该星未透干'}。`,['pillars.month','columns.hiddenStems'])];
  let combination,summary;
  if(s.officerSeal){combination='官印相生';summary='官印相生，靠专业、资历和承担责任取得位置，发展偏向逐级积累。';}
  else if(s.foodControlsKill){combination='食神制杀';summary='七杀有食神制约，竞争和压力明显，但也有凭本事解决难题、争取位置的能力。';}
  else if(s.killSeal){combination='杀印相生';summary='七杀有印星承接，工作担子重，专业和资历是承受压力、取得进展的关键。';}
  else if(s.injuryOfficer&&s.sealRescue){combination='伤官见官有印调节';summary='伤官与正官并见，做事容易与规章、上级的要求发生摩擦；有根印星调节，专业能力能帮助化解这种冲突。';}
  else if(s.injuryOfficer){combination='伤官见官';summary='伤官与正官相见，能力和主见都不弱，但执行方式与规矩容易相撞，工作中的争执和反复较明显。';}
  else if(s.outputFeedsWealth){combination='食伤生财';summary='食伤生财，收入更依靠技术、作品、业务和实际交付，做成事情比单靠资历更容易换来回报。';}
  else if(s.peerWealth){combination='财星遇比劫竞争';summary=`${name}中比劫争财的牵扯明显，有挣钱和争取资源的动力，合作分账、人情往来却容易分走积累。`;}
  else {combination=name;summary={
    正官:'正官格重职责与秩序，发展靠资历、信誉和持续担责，岗位上的稳定积累比突然冒进更突出。',
    七杀:'七杀格的竞争和责任压力较强，工作往往要面对难题与硬要求，发展节奏不算轻松。',
    正财:'正财格重稳定收入和实际积累，做事看投入回报，家业多靠长期经营逐步建立。',
    偏财:'偏财格更看重机会、资源和业务往来，收入与项目节奏联系较紧，进出变化比固定积累更显眼。',
    正印:'正印格重知识、资历和经验，发展偏向先积累后见效，专业基础比短期声势更有分量。',
    偏印:'偏印格重独立理解和专门技能，长处在研究与解决特殊问题，发展路线容易有转向和重新选择。',
    食神:'食神格重技能与稳定产出，靠做熟一门本事积累口碑，成果落地后收入才容易接上。',
    伤官:'伤官格重表达和实际成果，才思与主见突出，职业发展更受作品、技术和解决问题的能力带动。',
    比肩:'比劫当令，自主与竞争意识强，发展多靠自己争取，做成事情与协调利益往往同样费力。',
    劫财:'比劫当令，敢争取也肯投入，同辈合作与竞争并存，收入积累容易受分工和利益安排牵动。',
  }[god];}
  evidence.push(ev('O02-structure-combination',`选用${combination}；判别使用透干、同干根气、根支受冲及制化条件。`,['columns','analysis.relations','analysis.strength']));
  return {name,combination,headline:combination,summary,evidence};
}

function careerConclusion(s){
  const conflicts=[];
  if(s.monthClash)conflicts.push('工作所在的月柱受冲');
  if(s.injuryOfficer&&!s.sealRescue)conflicts.push('伤官与正官相见而缺少有根印星调节');
  if(s.peerWealth)conflicts.push('财星与多处比劫相争，缺少有力食伤转通');
  if(s.weak&&s.kill&&!s.foodControlsKill&&!s.killSeal)conflicts.push('身弱承受七杀，未见明确制化');
  const rescued=s.officerSeal||s.killSeal||s.foodControlsKill||(s.injuryOfficer&&s.sealRescue);
  let status,headline,summary;
  if(conflicts.length>=2&&!rescued){status='volatile';headline='事业波折偏多，变动中求发展';summary='事业波折偏多，岗位、项目或合作关系更容易反复调整，发展中常有做出成绩后又要重新适应的阶段。'+(s.peerWealth?'主要牵扯在分工、资源和利益分配，挣钱能力与职位稳定性不完全同步。':'主要阻力在工作要求与自己的做法不一致，机会常伴随更高的协调成本。');}
  else if(s.foodControlsKill||s.killSeal){status='pressure_with_progress';headline='压力大，但能在难题中取得位置';summary='事业压力较大，但有把压力转成成绩的能力，竞争性任务、难项目和责任较重的位置更容易显出本事。'+(s.monthClash?'岗位与工作环境仍容易有明显调整，发展靠几次关键转折向前推进。':'工作发展以承担更重责任为台阶，忙碌和进展往往一起增加。');}
  else if(s.monthClash||conflicts.length){status='changing';headline=rescued?'事业有转折，专业能力能托住局面':'事业有起伏，稳定过程较慢';summary=rescued?'事业有明显转折，岗位或工作安排容易调整，但专业与资历能托住局面，变化未必是一路走低。':'事业有起伏，岗位职责、合作方式或收入渠道容易调整，稳定下来通常要经过几次取舍。';summary+=s.injuryOfficer?'与上级、流程和考核的磨合是主要关口，解决方法比单纯争对错更影响发展。':'关键在能否把已有经验接到新的位置，转折期比平常更考验独立做事的能力。';}
  else if(s.officerSeal||s.officer&&s.rooted('正官')||s.resourceRoot){status='steady';headline='事业总体平稳，以资历和成果逐步上升';summary='事业总体偏平稳，以长期积累、职责增加和资历提升为主要路径，频繁推倒重来的倾向较弱。'+(s.officerSeal?'官印相互承接，专业成果较容易转成组织内的认可和更稳定的位置。':'经验和拿手本事越扎实，岗位与收入越容易逐步稳定下来。');}
  else {status='project_based';headline='事业靠成果推进，起色跟着项目走';summary='事业以成果和业务推动为主，发展不是按资历匀速上升，能否接续项目与实际交付更关键。'+(s.outputFeedsWealth?'技术、作品和业务能相互带动，项目做成后，收入改善比职位变化更直接。':'前期要逐步形成稳定方向，熟练技能与客户或团队的认可积累起来后，发展才更连贯。');}
  const evidence=[ev('O03-career-order',`职业走势判为${status}；结构牵扯：${joining(conflicts)||'未识别上述直接冲突'}；有效制化：${rescued?'有':'未确认'}。`,['pillars.month','analysis.relations','columns'])];
  return {status,headline,summary,evidence};
}

function wealthConclusion(s){
  let status,headline,summary;
  if(s.peerWealth){status='retention_difficult';headline='有财路，守财比挣钱更费力';summary='财运的难点在留住钱，合作分账、家庭支出和人情安排容易分走进账；收入增加时，积累未必同步增加。';}
  else if(s.outputFeedsWealth&&!s.weak){status='skill_income';headline='靠本事生财，成果能带动积累';summary='财路偏向技术、业务和经营成果，有把本事换成收入的条件；积累随交付和口碑增加，主要靠持续做成事情。';}
  else if(s.weak&&(s.effective('正财')||s.effective('偏财'))&&!s.resourceRoot){status='capacity_pressure';headline='财务责任偏重，进账与负担并行';summary='财务上容易出现机会、进账和负担一起增加的情况，业务规模扩大后，回款与资金周转更容易成为压力来源。';}
  else {status='gradual';headline='财运以逐步积累为主';summary='财运偏向长期积累，主要依靠稳定技能、持续工作或经营，家业的形成通常慢于挣钱能力的建立。';}
  return {status,headline,summary,evidence:[ev('O04-wealth-retention',`财务判断采用${status}，结合财星得令与透藏、比劫竞争、食伤转通和承载条件。`,['columns','analysis.strength'])]};
}

export function addSpecificConclusions(chart,analysis,input={}){
  const s=structure(chart,analysis),pattern=patternConclusion(s),career=careerConclusion(s),wealth=wealthConclusion(s);
  const marriage=analyzeMarriage(chart,analysis,input);
  const summary=[pattern.summary,career.summary,marriage.summary,wealth.summary].filter(Boolean).join('\n');
  const overview={version:'traditional-conclusions-0.1.0',summary,pattern,career,marriage,wealth};
  const updates={pattern:{...pattern,summary:pattern.summary+' '+career.summary},career,wealth,relationship:marriage};
  return {...analysis,summary,overview,dimensions:analysis.dimensions.map(d=>{
    const update=updates[d.id];return update?{...d,headline:update.headline,summary:update.summary,evidence:[...update.evidence,...d.evidence]}:d;
  })};
}
