import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput, calculateChart } from '../src/calendar.js';
import { buildTimeline, EVENT_DOMAINS } from '../src/timeline.js';

function reading(date='2000-01-01', overrides={}) {
  const input=normalizeInput({date,time:'12:34',gender:'male',startYear:2024,endYear:2040,...overrides});
  const chart=calculateChart(input);
  return {input,chart,timeline:buildTimeline(chart,input)};
}

test('annual changes can select all twelve fields instead of a fixed three-topic template',()=>{
  const a=reading(),b=reading('1990-05-18');
  const selected=new Set([...a.timeline.years,...b.timeline.years].flatMap(y=>y.events.map(e=>e.domain)));
  assert.deepEqual([...selected].sort(),EVENT_DOMAINS.map(d=>d.id).sort());
  assert.ok(a.timeline.years.find(y=>y.year===2026).events.some(e=>e.domain==='family'));
  assert.ok(a.timeline.years.find(y=>y.year===2028).events.some(e=>e.domain==='network'));
  assert.ok(b.timeline.years.find(y=>y.year===2024).events.some(e=>e.domain==='disputes'));
  assert.ok(a.timeline.years.find(y=>y.year===2032).events.length>4,'do not silently drop a supported field to fill a fixed-size template');
  assert.notDeepEqual(a.timeline.years.find(y=>y.year===2026).events.map(e=>e.domain),a.timeline.years.find(y=>y.year===2028).events.map(e=>e.domain));
});

test('a quiet year remains empty even when user plans name every topic',()=>{
  const {input,chart,timeline}=reading('2000-01-01',{startYear:2025,endYear:2025});
  const plain=timeline.years[0];
  assert.deepEqual(plain.events,[]);
  assert.deepEqual(plain.focusMonths,[]);
  const withPlans=buildTimeline(chart,{...input,contextYear:2025,context:{occupation:'在职',plans:'工作晋升、考试、装修、买房、结婚、照料父母、合作、收入、合同、搬家、调整作息和做事习惯'}}).years[0];
  assert.deepEqual(withPlans.events,[],'background must not manufacture an activation');
  assert.equal(withPlans.changeLevel,'平稳');
  assert.deepEqual(withPlans.months,plain.months);
});

test('focus months are sparse, come from actual month facts and contain no monthly scores',()=>{
  const {timeline}=reading();
  assert.ok(timeline.years.some(y=>y.focusMonths.length===0));
  assert.ok(timeline.years.some(y=>y.focusMonths.length>0));
  for(const y of timeline.years){
    assert.ok(y.focusMonths.length<=4);
    assert.equal(new Set(y.focusMonths.map(m=>m.index)).size,y.focusMonths.length);
    for(const m of y.focusMonths){
      const original=y.months.find(x=>x.index===m.index);
      assert.ok(original);
      assert.deepEqual([m.ganZhi,m.startDate,m.endDate],[original.ganZhi,original.startDate,original.endDate]);
      assert.ok(m.events.length);
      assert.ok(!Object.hasOwn(m,'score')&&!Object.hasOwn(m,'domainScores'));
      for(const e of m.events){
        assert.ok(y.events.some(annual=>annual.domain===e.domain));
        assert.ok(e.reading&&e.publicTitle&&e.evidence.length);
        assert.doesNotMatch(e.reading,/死亡|寿命|大限|必死|诊断|癌症|牢狱/);
      }
    }
  }
  const transition=timeline.years.find(y=>y.year===2028);
  const transitionMonth=transition.months.find(m=>m.segments.length>1);
  assert.ok(transition.focusMonths.some(m=>m.index===transitionMonth.index&&m.events.some(e=>e.domain==='pattern')));
});

test('same-year event and month analysis is independent of displayed range',()=>{
  const {input,chart,timeline}=reading();
  const narrow=buildTimeline(chart,{...input,startYear:2028,endYear:2028}).years[0];
  assert.deepEqual(narrow,timeline.years.find(y=>y.year===2028));
});

test('month event evidence only references luck active during that month in a transition year',()=>{
  const {timeline}=reading('2000-01-01',{startYear:2028,endYear:2028});
  const year=timeline.years[0];
  const transition=year.months.find(month=>month.segments.length>1);
  assert.ok(transition);
  let checked=0;
  for(const event of year.events)for(const support of event.monthlySupport){
    const month=year.months.find(month=>month.index===support.index);
    const active=new Set(month.segments.map(segment=>segment.daYun));
    for(const item of support.evidence){
      const match=/与大运([^，。\s]{2})/.exec(item.text);
      if(match){
        checked++;
        assert.ok(active.has(match[1]),`${month.ganZhi}: ${item.text}; active: ${[...active]}`);
      }
    }
  }
  assert.ok(checked>0,'exercise month/luck contacts');
  assert.ok(year.focusMonths.some(month=>month.index===transition.index),'keep the actual transition month');
});

test('birth-year focused months never select a period that ended before birth',()=>{
  for(const date of ['1990-05-18','2005-12-23','2000-10-01']){
    const year=Number(date.slice(0,4));
    const {timeline}=reading(date,{startYear:year,endYear:year});
    for(const month of timeline.years[0].focusMonths)assert.ok(month.endDate>`${date} 12:34:00`);
  }
});
