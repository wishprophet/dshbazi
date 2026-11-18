import {chartColumns,tenGod,godGroup,branchRelations,HIDDEN} from './analysis.js';

const STEM_PAIRS=['甲己','乙庚','丙辛','丁壬','戊癸'];
const valid=p=>typeof p==='string'&&/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(p);
const harmful=relations=>relations.some(r=>['冲','刑','害'].includes(r));
const evidence=(ruleId,text,fields=[])=>({ruleId,text,fields});
const dateStamp=value=>Date.parse(String(value).replace(' ','T')+'Z');
const dateMax=(a,b)=>a>b?a:b;
const dateMin=(a,b)=>a<b?a:b;
const unique=items=>[...new Set(items)];

/**
 * Traditional marriage-theme interpretation, independent of trend scoring.
 * 宫位、配偶星及制约合看；年龄由实际运年共同支持的区段取得。
 * Window gates are explicit interpretive heuristics, not calibrated probabilities.
 * The 20–45 nominal-age interval is an adult review range, not a limit on marriage.
 */
export function analyzeMarriage(chart,analysis,input={}){
  const columns=chartColumns(chart),day=columns.find(c=>c.key==='day');
  if(!day||!valid(day.ganZhi))throw new Error('婚缘分析需要完整日柱。');
  const dm=day.stem,gender=chart.gender||input.gender;
  const spouseGroup=gender==='female'?'authority':gender==='male'?'wealth':null;
  if(!spouseGroup)return {headline:'婚缘资料待补充',summary:'补充性别后再结合配偶星分析婚缘。',stability:'undetermined',timing:'unclear',ageConvention:'nominal-age',windows:[],evidence:[]};
  const star=stem=>godGroup(tenGod(dm,stem))===spouseGroup;
  const spouseVisible=columns.filter(c=>c.key!=='day'&&star(c.stem));
  const spouseRoots=columns.flatMap(c=>c.hiddenStems.filter(h=>star(h.stem)).map(h=>({key:c.key,stem:h.stem,main:h===c.hiddenStems[0]})));
  const mainRoots=spouseRoots.filter(r=>r.main),spousePresent=spouseVisible.length+spouseRoots.length>0;
  const palaceContacts=columns.filter(c=>c.key!=='day').map(c=>({key:c.key,pillar:c.ganZhi,relations:branchRelations(c.branch,day.branch)}));
  const troubled=palaceContacts.filter(c=>harmful(c.relations));
  const clashes=palaceContacts.filter(c=>c.relations.includes('冲'));
  const together=palaceContacts.some(c=>c.relations.includes('合'));
  const exposed=columns.filter(c=>c.key!=='day');
  const peerCount=exposed.filter(c=>godGroup(c.stemGod)==='peer').length;
  const outputCount=exposed.filter(c=>c.stemGod==='伤官').length;
  const soundRoot=col=>columns.some(root=>root.hiddenStems.some(h=>h.stem===col.stem)&&!columns.some(other=>other.key!==root.key&&branchRelations(root.branch,other.branch).includes('冲')));
  const starRescue=gender==='male'
    ?exposed.some(c=>godGroup(c.stemGod)==='output'&&soundRoot(c))
    :exposed.some(c=>godGroup(c.stemGod)==='resource'&&soundRoot(c))&&!exposed.some(c=>godGroup(c.stemGod)==='wealth'&&soundRoot(c));
  const rawCompetitive=gender==='male'?peerCount>=2&&spousePresent&&spouseVisible.length<=1:outputCount>0&&spouseVisible.some(c=>c.stemGod==='正官');
  const competitive=rawCompetitive&&!starRescue;
  const mixedStars=gender==='female'&&new Set(spouseVisible.map(c=>c.stemGod)).size>1;
  const onlyLatePosition=spousePresent&&[...spouseVisible.map(c=>c.key),...spouseRoots.map(r=>r.key)].every(key=>key==='hour');
  const starAnchored=spouseVisible.length>0&&mainRoots.length>0;
  const earlyPosition=spouseVisible.some(c=>['year','month'].includes(c.key))&&mainRoots.length>0;
  const distinctFrictions=unique(troubled.flatMap(c=>c.relations.filter(r=>['冲','刑','害'].includes(r)).map(r=>[day.branch,c.pillar[1]].sort().join('')+r)));
  const multiPressure=(distinctFrictions.length>=2&&!starRescue)||(troubled.length>=1&&(competitive||mixedStars));
  const delayStructure=multiPressure||(onlyLatePosition&&troubled.length>0)||(!spousePresent&&troubled.length>0);
  const stability=multiPressure?'strained':troubled.length||competitive||mixedStars?'mixed':starAnchored||together?'steady':'undetermined';
  const records=[evidence('M01-spouse-star',`传统配偶星取${spouseGroup==='wealth'?'财星':'官杀'}；透干${spouseVisible.length}处，藏干${spouseRoots.length}处，其中本气根${mainRoots.length}处。`,columns.map(c=>`pillars.${c.key}`))];
  for(const contact of troubled)records.push(evidence('M02-palace-contact',`${contact.key}柱${contact.pillar}与夫妻宫${day.branch}见${contact.relations.join('、')}。`,[`pillars.${contact.key}`,'pillars.day']));
  if(competitive)records.push(evidence('M03-star-constraint',gender==='male'?'比劫多透与财星同看，关系中的自主、分配和现实安排形成制约。':'伤官透出并见正官，表达方式与关系中的规则要求形成制约。'));
  if(rawCompetitive&&starRescue)records.push(evidence('M08-star-rescue',gender==='male'?'有根食伤转通比劫与财星，不将比劫竞争直接判成严重婚缘受损。':'有根印星调节伤官与正官的冲突，未见有根财星再制印，不将官伤并见直接判成严重婚缘受损。'));
  if(mixedStars)records.push(evidence('M04-mixed-authority','正官、七杀同时透出；与夫妻宫状态合看，不单据官杀混见断婚姻结果。'));
  if(onlyLatePosition)records.push(evidence('M05-position','配偶星只在时柱出现；仅作为发展较后的结构线索，不单据位置断晚婚。'));

  const context=String(input.context?.relationship||'');
  // A stated current status takes precedence over a description of past marriage.
  const statusMatches=[...context.matchAll(/(?:目前|当前|现在|如今)\s*(?:是|为)?\s*(?:已经|仍然|已|仍)?(未婚|单身|离异|离婚|丧偶|再婚|复婚|已婚)|(?:已经|已)(再婚|复婚)/g)];
  const lastStatus=statusMatches.at(-1),currentStatus=lastStatus?.[1]||lastStatus?.[2];
  const unmarried=currentStatus?['未婚','单身'].includes(currentStatus):/未婚|尚未结婚|还没结婚|没有结婚|单身/.test(context);
  const married=currentStatus?['已婚','再婚','复婚'].includes(currentStatus):!unmarried&&/已婚|婚后|有配偶|夫妻|结婚多年|结婚\s*\d/.test(context);
  const separated=currentStatus?['离异','离婚','丧偶'].includes(currentStatus):/离异|离婚|丧偶/.test(context);
  const contextYear=Number.isInteger(input.contextYear)?input.contextYear:null;
  const knownContext=unmarried||married||separated;
  const eligibleForTiming=Boolean(chart.luck?.available&&Number.isInteger(chart.birthYear)&&!married);
  const yearSegments=[];
  const strongStar=pillar=>valid(pillar)&&(star(pillar[0])||star(HIDDEN[pillar[1]]?.[0]));
  if(eligibleForTiming)for(const cycle of chart.luck.cycles||[]){
    if(!valid(cycle.ganZhi))continue;
    for(const year of cycle.years||[]){
      const age=year.age;
      if(!Number.isInteger(age)||age<20||age>45||!valid(year.ganZhi))continue;
      if(knownContext&&contextYear&&year.year<contextYear)continue;
      const begin=year.months?.[0]?.startDate,end=year.months?.at(-1)?.endDate;
      if(!begin||!end||!cycle.startDate||!cycle.endDate)continue;
      const startDate=dateMax(begin,cycle.startDate),endDate=dateMin(end,cycle.endDate);
      if(startDate>=endDate||(dateStamp(endDate)-dateStamp(startDate))<90*86400000)continue;
      const yearRelations=branchRelations(year.ganZhi[1],day.branch),luckRelations=branchRelations(cycle.ganZhi[1],day.branch);
      const luckStar=strongStar(cycle.ganZhi),yearStar=strongStar(year.ganZhi),palaceUnion=yearRelations.includes('合');
      const stemUnion=STEM_PAIRS.some(p=>p===dm+year.ganZhi[0]||p===year.ganZhi[0]+dm);
      // No qualifying window may be assembled from the old and new luck cycles.
      const jointStars=luckStar&&yearStar;
      const starAndPalace=(luckStar||yearStar)&&palaceUnion;
      const anchoredStemUnion=star(year.ganZhi[0])&&stemUnion&&starAnchored;
      if(!(jointStars||starAndPalace||anchoredStemUnion))continue;
      if(harmful(yearRelations)||harmful(luckRelations))continue;
      if(branchRelations(cycle.ganZhi[1],year.ganZhi[1]).includes('冲'))continue;
      const support=[];
      if(jointStars)support.push('大运与流年都见配偶星');
      if(starAndPalace)support.push('配偶星与流年合夫妻宫同时出现');
      if(anchoredStemUnion)support.push('原局配偶星有根，流年配偶星与日干相合');
      const itemEvidence=[evidence('M06-joint-window',`${cycle.ganZhi}运、${year.ganZhi}年：${support.join('；')}，该运年不直接冲刑害夫妻宫。`,['luck.cycles','pillars.day'])];
      yearSegments.push({year:year.year,age,cycle:cycle.ganZhi,cycleIndex:cycle.index,startDate,endDate,yearGanZhi:year.ganZhi,evidence:itemEvidence});
    }
  }
  yearSegments.sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const groups=[];
  for(const segment of yearSegments){
    const last=groups.at(-1);
    if(last&&last.cycleIndex===segment.cycleIndex&&segment.year===last.endYear+1&&last.segments.length<3&&last.endDate===segment.startDate){
      last.endYear=segment.year;last.endAge=segment.age;last.endDate=segment.endDate;last.segments.push(segment);
    }else groups.push({startYear:segment.year,endYear:segment.year,startAge:segment.age,endAge:segment.age,startDate:segment.startDate,endDate:segment.endDate,cycle:segment.cycle,cycleIndex:segment.cycleIndex,segments:[segment]});
  }
  const windows=groups.slice(0,2).map(group=>({...group,evidence:group.segments.flatMap(s=>s.evidence)}));
  const first=windows[0];
  let timing='unclear';
  if(married)timing='known-married';
  else if(first){
    if(first.startAge<=25&&earlyPosition&&!multiPressure)timing='early';
    else if(first.startAge>=30&&delayStructure)timing='later';
    else timing='window-only';
  }
  let headline,body;
  if(stability==='strained'){
    headline='婚缘波折偏多，定下来不算轻松';
    body='婚缘不算顺，感情容易经历反复，生活安排和现实分担常成为关系里的难点。';
    if(clashes.length&&competitive)body+='个人主意强，双方一谈到工作、钱或共同生活，便容易各有坚持。';
    else body+='亲近时投入不浅，发生矛盾后也不容易很快翻篇，反复磨合比缺少缘分更突出。';
  }else if(stability==='mixed'){
    headline='婚缘有牵扯，相处需要经历磨合';
    body='有感情缘分，但相处不完全省心，关系中的分工、边界和生活节奏较容易起摩擦。';
    body+=clashes.length?'恋爱与工作、居住安排容易相互牵动，推进关系时常伴随一次现实调整。':'意见不同时容易较真，关系能否走稳更多体现在长期配合上。';
  }else if(stability==='steady'){
    headline='婚缘较稳，关系容易落到共同生活';
    body='婚缘整体偏稳，较重伴侣和家庭责任，关系有持续经营、逐步安定的基础。';
    body+=starAnchored?'对方和共同生活在个人选择中占分量，感情较容易落实到日常相处与家庭安排。':'亲密关系的联系较紧，生活中的重要决定较容易一起商量、共同推进。';
  }else{
    headline='婚缘偏慢热，重实际相处';
    body='感情不以迅速定下来见长，更看重相处后的可靠和责任。关系通常要从熟悉、信任走到共同安排，热情之外仍需要现实接续。';
  }
  let timingText='';
  if(timing==='later'){headline='婚缘波折偏多，偏晚稳定';timingText='稳定成家偏晚，';}
  else if(timing==='early'){headline='婚缘来得较早，较易早定关系';timingText='婚缘偏早，';}
  if(first){
    const ages=first.startAge===first.endAge?String(first.startAge):`${first.startAge}—${first.endAge}`;
    const years=first.startYear===first.endYear?String(first.startYear):`${first.startYear}—${first.endYear}`;
    const focus=separated?'建立新的长期关系':unmarried?'确定关系、谈婚论嫁':'定亲成家';
    timingText+=`${focus}的较集中窗口在约${ages}岁（${years}年）。`;
    if(knownContext&&contextYear)records.push(evidence('M07-context-scope',`仅用${contextYear}年提供的婚恋状态过滤已经过去的窗口；背景不作为原局证据。`));
  }
  if(married){
    headline=stability==='strained'?'夫妻磨合较多，现实分担是难点':stability==='steady'?'夫妻关系偏稳，重家庭经营':'夫妻相处重磨合与配合';
    body=stability==='strained'?'夫妻磨合偏多，工作、钱和家庭分担容易成为反复争执的地方。双方都较有主意，相处中的压力更多来自现实安排和责任分配。':stability==='steady'?'夫妻关系整体偏稳，重伴侣与家庭责任，共同生活有持续经营的基础。重要决定较容易放到一起商量，感情更多落实在日常照应中。':stability==='mixed'?'夫妻相处有牵扯，分工、边界和生活节奏是较明显的磨合点。工作或居住安排变化时，双方的配合也容易跟着调整。':'夫妻相处重责任与实际照应，感情更多体现在日常配合。对可靠和分担较为看重，热情之外更在意事情有没有落到实处。';
    timingText='';
  }
  return {headline,summary:body+timingText,stability,timing,timingText,ageConvention:'nominal-age',windows,evidence:records,structure:{spouseGroup,visibleCount:spouseVisible.length,rootCount:spouseRoots.length,mainRootCount:mainRoots.length,palaceFrictionCount:troubled.length,distinctFrictionCount:distinctFrictions.length,palaceClashCount:clashes.length,competitive,starRescue,mixedStars,onlyLatePosition,earlyPosition,delayStructure},reviewRange:{startAge:20,endAge:45},coverage:eligibleForTiming?'available':married?'known-married':'missing-birth-or-luck'};
}
