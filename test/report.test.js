import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createReading } from '../src/service.js';
import { renderHtml, renderMarkdown } from '../src/report.js';

const input={date:'2000-01-01',time:'12:34',gender:'male',name:'报告示例',startYear:2025,endYear:2028};
const getPayload=html=>JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const forbiddenKeys=new Set(['evidence','counterEvidence','provenance','contributions','warnings','technicalwarnings','cautions','rules','trace','ruleId','methodology','method','limitations','verification','source','version','open','high','low','close','segments','naYin']);
function checkPublicKeys(value){
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){assert.equal(forbiddenKeys.has(key),false,`internal key leaked: ${key}`);checkPublicKeys(item);}
}
const life=report=>report.lifeTimeline??report.timeline;
const event=()=>({domain:'family',publicTitle:'家人的安排有调整',reading:'和家人重新分配照料时间。',evidence:[{text:'PRIVATE_EVIDENCE_MARKER'}]});

test('report presents vertical pillars, distinct earth/metal colors and valid offline scripts without nayin',async()=>{
  const report=await createReading(input,{provider:'local'});
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.match(html,/^<!doctype html>/);assert.match(html,/<h1>八字分析<\/h1>/);assert.match(markdown,/^# 八字分析\n/);
  for(const id of ['domain','year','months','trend','metrics','next','previous','chart-year','chart-cycle','active-pillars','chenggu'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/);
  const glyphs=[...html.matchAll(/class="gan-zhi-char" data-element="([^"]+)" style="color:([^"]+)">([^<]+)<\/span>/g)];
  assert.equal(glyphs.length,8);assert.deepEqual(glyphs.map(m=>m[3]),Object.values(report.chart.pillars).join('').split(''));
  const colors=getPayload(html).colors;assert.equal(colors.土,'#85422a');assert.equal(colors.金,'#bb8c00');
  assert.match(html,/\.gan-zhi-stack\{[^}]*flex-direction:column/);
  for(const content of [html,markdown])assert.doesNotMatch(content,/纳音|城头土|涧下水|天上火|月度分|每月评分/);
  assert.match(markdown,/\| 天干 \|/);assert.match(markdown,/\| 地支 \|/);assert.match(markdown,/大运与流年对照/);
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1].includes('application/json'))assert.doesNotThrow(()=>new vm.Script(match[2]));
});

test('public payload uses full life timeline, exact annual values and only meaningful unscored focus months',async()=>{
  const report=await createReading(input,{provider:'local'});
  const target=life(report).years[0];target.focusMonths=[{index:0,ganZhi:'戊寅',startDate:'2000-02-04',endDate:'2000-03-05',score:13,domainScores:{family:13},events:[event()]},{index:1,events:[]}];
  const original=JSON.stringify(report),data=getPayload(renderHtml(report));
  checkPublicKeys(data);
  assert.equal(data.timeline.years[0].year,2000);assert.equal(data.timeline.years.at(-1).year,2080);
  assert.deepEqual(data.timeline.years.map(y=>[y.year,y.score]),life(report).years.map(y=>[y.year,y.score]));
  data.timeline.years.forEach((year,index)=>{
    const actual=life(report).years[index];
    for(const domain of data.timeline.domains)assert.equal(year.domainScores[domain.id].score,actual.domainScores[domain.id].score);
    assert.ok(!Object.hasOwn(year,'months'));
    for(const month of year.focusMonths){assert.ok(!Object.hasOwn(month,'score'));assert.ok(!Object.hasOwn(month,'domainScores'));assert.ok(month.events.length);}
  });
  assert.equal(data.timeline.years[0].focusMonths.length,1);
  assert.ok(data.timeline.eventDomains.some(d=>d.id==='family'));
  renderMarkdown(report);assert.equal(JSON.stringify(report),original,'rendering preserves complete internal data');
});

test('explorer preserves actual annual pillars, ten gods and both cycles in transition years',async()=>{
  const report=await createReading(input,{provider:'local'}),data=getPayload(renderHtml(report));
  const y=data.explorer.years.find(row=>row.year===2028);
  assert.equal(y.ganZhi,life(report).years.find(row=>row.year===2028).ganZhi);
  assert.equal(y.cycleIds.length,2);
  const cycles=data.explorer.cycles.filter(c=>y.cycleIds.includes(c.id));
  assert.deepEqual(cycles.map(c=>c.ganZhi),['甲戌','癸酉']);
  assert.equal(cycles[0].endDate,cycles[1].startDate);
  assert.equal(cycles[0].stemGod,'七杀');assert.equal(cycles[1].stemGod,'正财');
  assert.ok(cycles.every(c=>c.hiddenStems.length>0));
  const birth=data.explorer.years.find(row=>row.year===2000);
  assert.equal(data.explorer.cycles.find(c=>c.id===birth.cycleIds[0]).ganZhi,'');
});

test('chenggu includes original verse and translation before the life trend without internal metadata',async()=>{
  const report=await createReading(input,{provider:'local'});
  report.chenggu={available:true,title:'袁天罡称骨',weight:{qian:42,totalText:'四两二钱'},verse:['原诗第一句','原诗第二句','原诗第三句','原诗第四句'],translation:'这是独立的白话释义。',provenance:{source:'PRIVATE_SOURCE_MARKER'}};
  const html=renderHtml(report),markdown=renderMarkdown(report);
  for(const content of [html,markdown]){assert.ok(content.includes('四两二钱'));assert.ok(content.includes('原诗第四句'));assert.ok(content.includes('这是独立的白话释义。'));assert.doesNotMatch(content,/PRIVATE_SOURCE_MARKER/);}
  assert.ok(html.indexOf('<section id="chenggu"')<html.indexOf('<section id="timeline"'));
  assert.ok(markdown.indexOf('## 袁天罡称骨')<markdown.indexOf('## 人生走势'));
});

test('public report excludes technical reasoning and escapes user-controlled fields including explorer and chenggu',async()=>{
  const attack='</script><img src=x onerror=alert(1)>';
  const report=await createReading({...input,name:attack,location:attack},{provider:'local'});
  report.warnings.push('PRIVATE_WARNING_MARKER');report.provenance={source:'PRIVATE_SOURCE_MARKER'};
  report.analysis.version='PRIVATE_VERSION_MARKER';report.analysis.methodology='PRIVATE_METHOD_MARKER';report.analysis.limitations=['PRIVATE_LIMIT_MARKER'];
  report.analysis.pattern={candidate:'PRIVATE_PATTERN_MARKER',status:'PRIVATE_PATTERN_MARKER',evidence:[],cautions:[]};
  for(const d of report.analysis.dimensions){d.evidence=[{text:'PRIVATE_EVIDENCE_MARKER'}];d.cautions=['PRIVATE_CAUTION_MARKER'];d.publicAdvice=attack;}
  const y=life(report).years[0];y.events=[{...event(),reading:attack}];y.age=attack;y.focusMonths=[{index:0,ganZhi:'戊寅',events:[{...event(),reading:attack}]}];
  report.chenggu={available:true,title:'袁天罡称骨',weight:{totalText:attack},verse:[attack],translation:attack};
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.equal((html.match(/<script\b/g)||[]).length,2);assert.equal((html.match(/<\/script>/g)||[]).length,2);
  for(const content of [html,markdown]){assert.doesNotMatch(content,/<img src=x|PRIVATE_\w+_MARKER/);assert.doesNotMatch(content,/口径与依据|需保留的条件|免责声明|规则指数/);}
  assert.equal(getPayload(html).timeline.years[0].events[0].reading,attack);checkPublicKeys(getPayload(html));
});

test('legacy reports render without lifeTimeline or focused months and do not fabricate monthly events',async()=>{
  const report=await createReading(input,{provider:'local'});delete report.lifeTimeline;
  report.timeline.years[0].events=[{title:'旧版事项',condition:'如果已经报名考试',scenario:'春季把复习时间安排稳定。',evidence:[{text:'PRIVATE_OLD_EVIDENCE_MARKER'}]}];
  for(const y of report.timeline.years)delete y.focusMonths;
  const html=renderHtml(report),markdown=renderMarkdown(report),data=getPayload(html);
  assert.equal(data.timeline.years[0].events[0].reading,'如果已经报名考试。春季把复习时间安排稳定。');
  assert.ok(data.timeline.years.every(y=>y.focusMonths.length===0));
  assert.doesNotMatch(html,/PRIVATE_OLD_EVIDENCE_MARKER/);assert.doesNotMatch(markdown,/值得关注的月份/);
});

test('missing years are not interpolated or backfilled in public timelines or explorer',async()=>{
  const report=await createReading(input,{provider:'local'});
  report.lifeTimeline.years=report.lifeTimeline.years.filter(y=>y.year!==2026);
  const html=renderHtml(report),markdown=renderMarkdown(report),data=getPayload(html);
  assert.ok(!data.timeline.years.some(y=>y.year===2026));assert.ok(!data.explorer.years.some(y=>y.year===2026));
  assert.doesNotMatch(markdown,/### 2026/);
  const y=report.lifeTimeline.years.find(y=>y.year===2027);
  assert.ok(markdown.includes(`| 2027 ${y.ganZhi} | ${y.age} | ${y.daYun} | ${y.score} | — |`));
});

test('four-pillar-only report gives actionable missing-input prompts without invented timeline controls',async()=>{
  const report=await createReading({calendar:'pillars',pillars:'己卯 丙子 戊午 戊午',gender:'male'},{provider:'local'});
  const html=renderHtml(report),markdown=renderMarkdown(report);
  const prompt='补充出生年月日时，或出生公历年与首次交运日期，即可查看人生走势。';
  assert.ok(html.includes(prompt));assert.ok(markdown.includes(prompt));
  assert.equal(html.split(prompt).length-1,1);assert.doesNotMatch(html,/id="trend"|id="chart-year"/);
  assert.deepEqual(getPayload(html).timeline.years,[]);
});
