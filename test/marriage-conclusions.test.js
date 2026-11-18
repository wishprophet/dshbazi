import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInput,calculateChart,yearFacts} from '../src/calendar.js';
import {analyzeChart} from '../src/analysis.js';
import {analyzeMarriage} from '../src/marriage-conclusions.js';

function fixture(date='2000-01-01',overrides={}){
  const birthYear=Number(date.slice(0,4));
  const input=normalizeInput({date,time:'12:34',gender:'male',startYear:birthYear,endYear:birthYear+80,...overrides});
  const chart=calculateChart(input),analysis=analyzeChart(chart,input);
  return {chart,analysis,input};
}

test('marriage judgments distinguish early and later windows from actual natal and luck structure',()=>{
  const late=fixture(),early=fixture('1988-09-15',{time:'09:00',gender:'female'});
  const a=analyzeMarriage(late.chart,late.analysis,late.input),b=analyzeMarriage(early.chart,early.analysis,early.input);
  assert.equal(a.stability,'strained');assert.equal(a.timing,'later');
  assert.equal(a.windows[0].startAge,32);assert.equal(a.windows[0].startYear,2031);
  assert.match(a.summary,/婚缘不算顺/);assert.match(a.summary,/约32岁（2031年）/);
  assert.equal(b.timing,'early');assert.equal(b.windows[0].startAge,21);assert.equal(b.windows[0].startYear,2008);
  assert.match(b.summary,/婚缘偏早/);
  for(const result of [a,b]){
    assert.equal(result.ageConvention,'nominal-age');
    for(const window of result.windows){assert.ok(window.startDate<window.endDate);assert.ok(window.evidence.length);assert.ok(window.startAge>=20&&window.endAge<=45);}
  }
});

test('a lone palace contact does not imply late marriage and quiet configurations do not force a year',()=>{
  const singleContact=fixture('1988-09-15',{time:'09:00',gender:'female'});
  const one=analyzeMarriage(singleContact.chart,singleContact.analysis,singleContact.input);
  assert.equal(one.structure.palaceFrictionCount,1);assert.equal(one.structure.delayStructure,false);assert.notEqual(one.timing,'later');
  const quiet=fixture('1994-06-18',{gender:'female'}),r=analyzeMarriage(quiet.chart,quiet.analysis,quiet.input);
  assert.deepEqual(r.windows,[]);assert.equal(r.timing,'unclear');assert.doesNotMatch(r.summary,/\d+岁|\d{4}年/);
});

test('mixed officer and killing requires both stars to be exposed, not a hidden counterpart',()=>{
  const duplicate=fixture('1983-11-15',{gender:'female'});
  const a=analyzeMarriage(duplicate.chart,duplicate.analysis,duplicate.input);
  assert.deepEqual(duplicate.chart.pillars,{year:'癸亥',month:'癸亥',day:'丁未',hour:'丙午'});
  assert.equal(a.structure.visibleCount,2);assert.equal(a.structure.mixedStars,false);
  assert.equal(a.stability,'steady');assert.ok(!a.evidence.some(e=>e.ruleId==='M04-mixed-authority'));
  const mixed=fixture('1991-03-15',{gender:'female'}),b=analyzeMarriage(mixed.chart,mixed.analysis,mixed.input);
  assert.equal(b.structure.mixedStars,true);assert.ok(b.evidence.some(e=>e.ruleId==='M04-mixed-authority'));
});

test('a non-spouse stem union cannot borrow the branch spouse star to create a marriage window',()=>{
  for(const [date,gender,rejectedYear] of [['1988-04-15','female',2025],['2005-11-15','male',2038]]){
    const {chart,analysis,input}=fixture(date,{gender});
    const result=analyzeMarriage(chart,analysis,input);
    assert.ok(!result.windows.some(w=>w.segments.some(s=>s.year===rejectedYear)));
    assert.doesNotMatch(result.summary,new RegExp(String(rejectedYear)));
  }
  const genuine=fixture('1981-08-15',{gender:'female'}),r=analyzeMarriage(genuine.chart,genuine.analysis,genuine.input);
  assert.ok(r.windows.some(w=>w.segments.some(s=>s.year===2010&&s.evidence.some(e=>e.text.includes('流年配偶星与日干相合')))));
});

test('timing never combines compatible pieces from separate luck segments in the same year',()=>{
  const {chart,analysis,input}=fixture();
  const facts=yearFacts(2031,2000),cut='2031-07-01 00:00:00';
  chart.luck.cycles=[
    {index:1,ganZhi:'甲戌',startDate:'2030-01-01 00:00:00',endDate:cut,years:[facts]},
    {index:2,ganZhi:'壬子',startDate:cut,endDate:'2032-12-31 00:00:00',years:[facts]},
  ];
  assert.deepEqual(analyzeMarriage(chart,analysis,input).windows,[],'the safe old cycle has no spouse star, while the new star-bearing cycle clashes with the palace');
  chart.luck.cycles[1].ganZhi='癸酉';
  const result=analyzeMarriage(chart,analysis,input);
  assert.equal(result.windows.length,1);assert.equal(result.windows[0].startDate,cut);assert.equal(result.windows[0].cycle,'癸酉');
  assert.equal(result.windows[0].endDate,facts.months.at(-1).endDate);
});

test('known relationship context prevents a second prediction of first marriage or a past single-person window',()=>{
  const {chart,analysis,input}=fixture();
  const married=analyzeMarriage(chart,analysis,{...input,contextYear:2026,context:{relationship:'已婚'}});
  assert.equal(married.timing,'known-married');assert.deepEqual(married.windows,[]);assert.match(married.summary,/夫妻/);assert.doesNotMatch(married.summary,/定亲|谈婚论嫁|成家偏晚|\d+岁/);
  const unmarried=analyzeMarriage(chart,analysis,{...input,contextYear:2035,context:{relationship:'仍然未婚，单身'}});
  assert.notEqual(unmarried.timing,'known-married');assert.ok(unmarried.windows.every(w=>w.startYear>=2035));assert.equal(unmarried.windows[0].startYear,2039);
  assert.match(unmarried.summary,/约40岁/);assert.doesNotMatch(unmarried.summary,/2031年/);
});

test('explicit current relationship status overrides historical marriage and separation details',()=>{
  const {chart,analysis,input}=fixture();
  for(const relationship of ['目前离异，过去结婚10年','当前已离婚，之前结婚10年']){
    const r=analyzeMarriage(chart,analysis,{...input,contextYear:2026,context:{relationship}});
    assert.notEqual(r.timing,'known-married');assert.ok(r.windows.length>0);
    assert.match(r.summary,/建立新的长期关系/);assert.doesNotMatch(r.summary,/夫妻相处|夫妻磨合/);
  }
  for(const relationship of ['已再婚，过去离异，之前单身多年','过去离异，当前已婚']){
    const r=analyzeMarriage(chart,analysis,{...input,contextYear:2026,context:{relationship}});
    assert.equal(r.timing,'known-married');assert.deepEqual(r.windows,[]);
    assert.match(r.summary,/夫妻/);assert.doesNotMatch(r.summary,/建立新的长期关系|约\d+岁/);
  }
});

test('missing birth or luck data keeps natal conclusions without inventing timing and never mutates inputs',()=>{
  const {chart,analysis,input}=fixture();
  const original=JSON.stringify({chart,analysis,input});analyzeMarriage(chart,analysis,input);assert.equal(JSON.stringify({chart,analysis,input}),original);
  const missing=structuredClone(chart);missing.luck={available:false,cycles:[]};missing.birthYear=null;
  const result=analyzeMarriage(missing,analysis,input);
  assert.equal(result.stability,'strained');assert.deepEqual(result.windows,[]);assert.equal(result.timing,'unclear');assert.doesNotMatch(result.summary,/\d+岁|\d{4}年/);
});
