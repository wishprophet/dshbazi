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

test('report aligns natal pillars in table rows with distinct element colors and valid offline scripts',async()=>{
  const report=await createReading(input,{provider:'local'});
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.match(html,/^<!doctype html>/);assert.match(html,/<h1>八字分析<\/h1>/);assert.match(markdown,/^# 八字分析\n/);
  for(const content of [html,markdown]){assert.match(content,/十二方面分析/);assert.doesNotMatch(content,/生活各方面|这盘的发展主线是/);}
  for(const id of ['domain','year','months','trend','metrics','next','previous','chart-year','chart-cycle','chart-day','month-chips','active-pillars','chenggu'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/);
  const glyphs=[...html.matchAll(/class="gan-zhi-char" data-element="([^"]+)" style="color:([^"]+)">([^<]+)<\/span>/g)];
  assert.equal(glyphs.length,8);assert.deepEqual(glyphs.map(m=>m[3]),[...Object.values(report.chart.pillars).map(p=>p[0]),...Object.values(report.chart.pillars).map(p=>p[1])]);
  const colors=getPayload(html).colors;assert.equal(colors.土,'#85422a');assert.equal(colors.金,'#bb8c00');
  assert.match(html,/<table class="natal-table"/);assert.match(html,/<tr class="stem-row">/);assert.match(html,/<tr class="branch-row">/);
  for(const label of ['十神','天干','地支','藏干','空亡','神煞'])assert.ok(html.includes(`<th scope="row">${label}</th>`));
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

test('explorer preserves real month boundaries and only the cycles active in each period',async()=>{
  const report=await createReading(input,{provider:'local'}),data=getPayload(renderHtml(report));
  const y=data.explorer.years.find(row=>row.year===2028);
  assert.equal(y.ganZhi,life(report).years.find(row=>row.year===2028).ganZhi);
  assert.equal(y.cycleIds.length,2);
  const cycles=data.explorer.cycles.filter(c=>y.cycleIds.includes(c.id));
  assert.deepEqual(cycles.map(c=>c.ganZhi),['甲戌','癸酉']);
  assert.equal(cycles[0].endDate,cycles[1].startDate);
  assert.equal(cycles[0].stemGod,'七杀');assert.equal(cycles[1].stemGod,'正财');
  assert.ok(cycles.every(c=>c.hiddenStems.length>0));
  const actual=life(report).years.find(row=>row.year===2028);
  assert.deepEqual(y.months.map(m=>[m.ganZhi,m.startDate,m.endDate]),actual.months.map(m=>[m.ganZhi,m.startDate,m.endDate]));
  const after=y.months.find(m=>m.startDate>cycles[1].startDate);
  assert.deepEqual(after.cycleIds,[cycles[1].id]);
  const transition=y.months.find(m=>m.startDate<cycles[1].startDate&&m.endDate>cycles[1].startDate);
  assert.deepEqual(transition.cycleIds,cycles.map(c=>c.id));
  for(const month of y.months){assert.ok(!Object.hasOwn(month,'score'));assert.ok(!Object.hasOwn(month,'domainScores'));}
  assert.equal(Object.keys(data.explorer.facts).length,60);
  const birth=data.explorer.years.find(row=>row.year===2000);
  assert.equal(data.explorer.cycles.find(c=>c.id===birth.cycleIds[0]).ganZhi,'');
});

test('chenggu is three compact lines under the natal chart with direct interpretation and no separate section',async()=>{
  const report=await createReading(input,{provider:'local'});
  report.chenggu={available:true,title:'袁天罡称骨',weight:{qian:42,totalText:'四两二钱'},verse:['原诗第一句','原诗第二句','原诗第三句','原诗第四句'],translation:'早年多靠自己，家业逐渐积累。',provenance:{source:'PRIVATE_SOURCE_MARKER'}};
  const html=renderHtml(report),markdown=renderMarkdown(report);
  for(const content of [html,markdown]){assert.ok(content.includes('四两二钱'));assert.ok(content.includes('原诗第四句'));assert.ok(content.includes('早年多靠自己，家业逐渐积累。'));assert.doesNotMatch(content,/PRIVATE_SOURCE_MARKER/);}
  const chart=html.slice(html.indexOf('<section id="chart"'),html.indexOf('<section id="reading"'));
  assert.match(chart,/<div id="chenggu"/);assert.ok(chart.indexOf('称骨解读')>chart.indexOf('称骨评语'));
  assert.doesNotMatch(html,/<section id="chenggu"|href="#chenggu"|<h[1-6][^>]*>[^<]*称骨/);
  assert.doesNotMatch(markdown,/^#{1,6} .*称骨/m);
  assert.ok(markdown.indexOf('称骨解读')<markdown.indexOf('## 整体分析'));
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
