import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createReading } from '../src/service.js';
import { renderHtml, renderMarkdown } from '../src/report.js';

const input={date:'2000-01-01',time:'12:34',gender:'male',name:'报告示例',startYear:2025,endYear:2028};
const getPayload=html=>JSON.parse(html.match(/<script id="report-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const forbiddenKeys=new Set(['evidence','counterEvidence','provenance','contributions','warnings','technicalwarnings','cautions','rules','trace','ruleId','methodology','method','limitations','verification','source','version','open','high','low','close','segments']);
function checkPublicKeys(value){
  if(!value||typeof value!=='object')return;
  for(const [key,item]of Object.entries(value)){assert.equal(forbiddenKeys.has(key),false,`internal key leaked: ${key}`);checkPublicKeys(item);}
}

test('offline report uses a direct title, vertical colored pillars and valid scripts',async()=>{
  const report=await createReading(input,{provider:'local'});
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.match(html,/^<!doctype html>/);
  assert.match(html,/<title>八字分析<\/title>/);assert.match(html,/<h1>八字分析<\/h1>/);assert.match(markdown,/^# 八字分析\n/);
  for(const id of ['domain','year','months','trend','metrics','next','previous'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/Content-Security-Policy/);assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/);
  assert.equal((html.match(/class="gan-zhi-stack"/g)||[]).length,4);
  const glyphs=[...html.matchAll(/class="gan-zhi-char" data-element="([^"]+)" style="color:([^"]+)">([^<]+)<\/span>/g)];
  assert.equal(glyphs.length,8);
  assert.deepEqual(glyphs.map(m=>m[3]),Object.values(report.chart.pillars).join('').split(''));
  assert.deepEqual(glyphs.map(m=>m[1]),['土','木','火','水','土','火','土','火']);
  assert.match(html,/\.gan-zhi-stack\{[^}]*flex-direction:column/);
  assert.match(markdown,/\| 天干 \|/);assert.match(markdown,/\| 地支 \|/);
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!match[1].includes('application/json'))assert.doesNotThrow(()=>new vm.Script(match[2]));
  for(const d of report.analysis.dimensions){assert.ok(html.includes(d.publicTitle??d.title));assert.ok(markdown.includes(d.publicTitle??d.title));}
  assert.match(markdown,/### 2028/);assert.match(markdown,/年度分/);assert.match(markdown,/月度分/);
});

test('public payload preserves exact annual and monthly scores without internal calculation fields',async()=>{
  const report=await createReading(input,{provider:'local'});
  const original=JSON.stringify(report),data=getPayload(renderHtml(report));
  checkPublicKeys(data);
  assert.equal(data.timeline.years.length,report.timeline.years.length);
  assert.deepEqual(data.timeline.years.map(y=>[y.year,y.score]),report.timeline.years.map(y=>[y.year,y.score]));
  data.timeline.years.forEach((year,index)=>{
    const actual=report.timeline.years[index];
    for(const domain of data.timeline.domains)assert.equal(year.domainScores[domain.id].score,actual.domainScores[domain.id].score);
    assert.deepEqual(year.months.map(m=>[m.score,m.domainScores]),actual.months.map(m=>[m.score,m.domainScores]));
  });
  renderMarkdown(report);
  assert.equal(JSON.stringify(report),original,'rendering must not delete internal report records');
});

test('public HTML and Markdown exclude technical sections, warnings and internal reasoning',async()=>{
  const report=await createReading(input,{provider:'local'});
  report.warnings.push('PRIVATE_WARNING_MARKER');
  report.provenance={source:'PRIVATE_SOURCE_MARKER'};
  report.analysis.version='PRIVATE_VERSION_MARKER';report.analysis.methodology='PRIVATE_METHOD_MARKER';
  report.analysis.limitations=['PRIVATE_LIMIT_MARKER'];
  report.analysis.pattern={candidate:'PRIVATE_PATTERN_MARKER',status:'PRIVATE_PATTERN_MARKER',evidence:[],cautions:[]};
  for(const d of report.analysis.dimensions){d.evidence=[{text:'PRIVATE_EVIDENCE_MARKER'}];d.cautions=['PRIVATE_CAUTION_MARKER'];d.publicTitle=`公开${d.id}`;d.publicAdvice='安排好眼前的一件事。';}
  report.timeline.warnings=['PRIVATE_TIMELINE_WARNING_MARKER'];report.timeline.limitations=['PRIVATE_LIMIT_MARKER'];
  for(const y of report.timeline.years)for(const e of y.events){e.publicTitle='今年的生活安排';e.reading='春季可以集中推进已有计划。';e.condition='PRIVATE_CONDITION_MARKER';e.scenario='PRIVATE_SCENARIO_MARKER';e.evidence=[{text:'PRIVATE_EVIDENCE_MARKER'}];e.counterEvidence='PRIVATE_COUNTER_MARKER';e.verification='PRIVATE_VERIFY_MARKER';}
  const html=renderHtml(report),markdown=renderMarkdown(report);
  for(const content of [html,markdown]){
    assert.doesNotMatch(content,/PRIVATE_\w+_MARKER/);
    assert.doesNotMatch(content,/口径与依据|来源记录与版本|需保留的条件|方法与边界|免责声明|四柱研读|观时|OHLC|蜡烛|规则指数/);
    assert.ok(content.includes('安排好眼前的一件事。'));
    assert.ok(content.includes('今年的生活安排'));
    assert.ok(content.includes('春季可以集中推进已有计划。'));
  }
  checkPublicKeys(getPayload(html));
});

test('all user-controlled HTML and embedded JSON fields are escaped',async()=>{
  const attack='</script><img src=x onerror=alert(1)>';
  const report=await createReading({...input,name:attack,location:attack,contextYear:2026,context:{occupation:'学生',relationship:attack,plans:'考试 '+attack}},{provider:'local'});
  report.warnings.push(attack);report.provenance.website={url:attack,fetchedAt:attack,save:false};
  report.timeline.years[0].events[0].reading=attack;
  report.timeline.years[0].age=attack;
  report.timeline.years[0].months[0].score=attack;
  report.analysis.dimensions[0].publicTitle=attack;report.analysis.dimensions[0].publicAdvice=attack;
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.equal((html.match(/<script\b/g)||[]).length,2);assert.equal((html.match(/<\/script>/g)||[]).length,2);
  assert.doesNotMatch(html,/<img src=x/);assert.ok(html.includes('&lt;/script&gt;&lt;img'));
  assert.equal(getPayload(html).timeline.years[0].events[0].reading,attack);
  assert.doesNotMatch(markdown,/<img src=x/);
});

test('legacy event text and missing public titles remain readable without exposing evidence',async()=>{
  const report=await createReading(input,{provider:'local'});
  const event=report.timeline.years[0].events[0];delete event.reading;delete event.publicTitle;
  event.condition='如果已经报名考试';event.scenario='春季把复习时间安排稳定。';event.evidence=[{text:'PRIVATE_OLD_EVIDENCE_MARKER'}];
  delete report.analysis.dimensions[0].publicTitle;
  const html=renderHtml(report),markdown=renderMarkdown(report),data=getPayload(html);
  assert.equal(data.timeline.years[0].events[0].title,event.title);
  assert.equal(data.timeline.years[0].events[0].reading,'如果已经报名考试。春季把复习时间安排稳定。');
  assert.ok(markdown.includes('如果已经报名考试。春季把复习时间安排稳定。'));
  assert.doesNotMatch(html,/PRIVATE_OLD_EVIDENCE_MARKER/);
});

test('missing years are not interpolated or backfilled in the public timeline',async()=>{
  const report=await createReading(input,{provider:'local'});
  report.timeline.years=report.timeline.years.filter(y=>y.year!==2026);
  const html=renderHtml(report),markdown=renderMarkdown(report);
  assert.deepEqual(getPayload(html).timeline.years.map(y=>y.year),[2025,2027,2028]);
  assert.doesNotMatch(markdown,/### 2026/);
  const year2027=report.timeline.years.find(y=>y.year===2027);
  assert.ok(markdown.includes(`| 2027 ${year2027.ganZhi} | ${year2027.age} | ${year2027.daYun} | ${year2027.score} | — |`));
});

test('four-pillar-only report gives one actionable prompt and omits invented timeline controls',async()=>{
  const report=await createReading({calendar:'pillars',pillars:'己卯 丙子 戊午 戊午',gender:'male'},{provider:'local'});
  const html=renderHtml(report),markdown=renderMarkdown(report);
  const prompt='补充出生年月日时，或出生公历年与首次交运日期，即可查看人生走势。';
  assert.ok(html.includes(prompt));assert.ok(markdown.includes(prompt));
  assert.equal(html.split(prompt).length-1,1);assert.doesNotMatch(html,/id="trend"/);
  assert.deepEqual(getPayload(html).timeline.years,[]);
});
