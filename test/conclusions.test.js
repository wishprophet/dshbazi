import test from 'node:test';
import assert from 'node:assert/strict';
import {pillarFacts} from '../src/calendar.js';
import {analyzeChart} from '../src/analysis.js';
import {addSpecificConclusions} from '../src/conclusions.js';
import {createReading} from '../src/service.js';

function structure(pillars){
  const chart={pillars,dayMaster:pillars.day[0],columns:pillarFacts(pillars),gender:'male',luck:{available:false,cycles:[]}};
  const original=analyzeChart(chart);
  return {original,updated:addSpecificConclusions(chart,original)};
}

test('career judgment accounts for a rooted seal that moderates officer/output conflict',()=>{
  const supported=structure({year:'辛酉',month:'丁亥',day:'甲寅',hour:'癸丑'});
  const unmoderated=structure({year:'辛酉',month:'丁亥',day:'甲寅',hour:'乙未'});
  assert.equal(supported.updated.overview.career.status,'steady');
  assert.equal(unmoderated.updated.overview.career.status,'changing');
  assert.doesNotMatch(supported.updated.overview.career.summary,/坎坷|波折偏多/);
  for(const key of ['pattern','strength','relations','groups'])assert.deepEqual(supported.updated[key],supported.original[key]);
  assert.equal(supported.updated.overview.marriage.windows.length,0);
});

test('rooted food controls killing pressure instead of treating every killing star as career misfortune',()=>{
  const {updated}=structure({year:'庚申',month:'丙辰',day:'甲午',hour:'己巳'});
  assert.equal(updated.overview.pattern.combination,'食神制杀');
  assert.equal(updated.overview.career.status,'pressure_with_progress');
  assert.match(updated.overview.career.summary,/压力.*成绩/);
});

test('service supplies chart-specific conclusions and stable timing independent of requested detail years',async()=>{
  const base={date:'2000-01-01',time:'12:34',gender:'male',startYear:2026,endYear:2028};
  const a=await createReading(base,{provider:'local'}),b=await createReading({...base,startYear:2035,endYear:2036},{provider:'local'});
  assert.deepEqual(a.analysis.overview,b.analysis.overview);
  assert.match(a.analysis.summary,/事业波折偏多/);
  assert.match(a.analysis.summary,/婚缘不算顺/);
  assert.match(a.analysis.summary,/约32岁（2031年）/);
  assert.equal(a.analysis.dimensions.find(d=>d.id==='relationship').summary,a.analysis.overview.marriage.summary);
  assert.equal(a.analysis.dimensions.find(d=>d.id==='career').summary,a.analysis.overview.career.summary);
  const married=await createReading({...base,contextYear:2026,context:{relationship:'已婚'}},{provider:'local'});
  assert.doesNotMatch(married.analysis.summary,/定亲成家|成家偏晚|约32岁/);
  assert.deepEqual(married.lifeTimeline.years.map(y=>y.score),a.lifeTimeline.years.map(y=>y.score));
});
