import test from 'node:test';
import assert from 'node:assert/strict';
import { createReading } from '../src/service.js';
const base={name:'测试',gender:'male',location:'北京',calendar:'solar',date:'2000-01-01',time:'12:34',startYear:2026,endYear:2028};
test('local service covers 12 dimensions and each requested year reproducibly',async()=>{
  const a=await createReading(base,{provider:'local'}),b=await createReading(base,{provider:'local'});
  assert.deepEqual(a,b); assert.equal(a.analysis.dimensions.length,12);
  assert.deepEqual(a.timeline.years.map(y=>y.year),[2026,2027,2028]);
  assert.equal(a.provenance.actualProvider,'lunar-javascript');
  assert.ok(a.timeline.coverageComplete);
  for(const y of a.timeline.years) {
    const scores=y.months.map(m=>m.score);
    assert.equal(y.months.length,12);assert.equal(y.open,scores[0]);assert.equal(y.close,scores[11]);
    assert.equal(y.high,Math.max(...scores));assert.equal(y.low,Math.min(...scores));
    assert.ok(y.events.every(e=>e.condition && e.evidence.length));
  }
});
test('auto fails over transparently while website-only propagates provider failure',async()=>{
  const fetchImpl=async()=>{throw new Error('simulated network unavailable');};
  const r=await createReading(base,{provider:'auto',fetchImpl});
  assert.equal(r.chart.source,'lunar-javascript');assert.equal(r.provenance.website,null);
  assert.ok(r.warnings.some(x=>x.includes('simulated network unavailable')));
  await assert.rejects(()=>createReading(base,{provider:'website',fetchImpl}),/simulated network unavailable/);
});
test('lunar entry is converted before website request without losing minutes',async()=>{
  let form;
  await createReading({...base,calendar:'lunar',date:'2023-02-01',leapMonth:true},{provider:'auto',fetchImpl:async(_,init)=>{form=new URLSearchParams(init.body);throw new Error('fixture');}});
  assert.equal(form.get('DateType'),'0');assert.equal(form.get('year'),'2023');assert.equal(form.get('month'),'3');assert.equal(form.get('date'),'22');assert.equal(form.get('minute'),'34');assert.equal(form.get('save'),'0');
});
test('four pillars alone generate original analysis without inventing a lifetime',async()=>{
  const r=await createReading({calendar:'pillars',gender:'male',pillars:{year:'己卯',month:'丙子',day:'戊午',hour:'戊午'}},{fetchImpl:()=>{throw new Error('must not fetch');}});
  assert.equal(r.analysis.dimensions.length,12);assert.equal(r.timeline.available,false);assert.deepEqual(r.timeline.years,[]);
  assert.equal(r.lifeTimeline.available,false);
  assert.equal(r.chenggu.available,false);
});

test('life overview starts at birth and uses a fixed display range independently of requested detail years',async()=>{
  const r=await createReading(base,{provider:'local'});
  assert.deepEqual(r.timeline.years.map(y=>y.year),[2026,2027,2028]);
  assert.equal(r.lifeTimeline.years[0].year,2000);
  assert.equal(r.lifeTimeline.years.at(-1).year,2080);
  assert.equal(r.lifeTimeline.displayRange.basis,'fixed-display-window');
  assert.ok(r.lifeTimeline.years.every(y=>y.months.length===12));
  for(const year of r.timeline.years) assert.deepEqual(year,r.lifeTimeline.years.find(y=>y.year===year.year));
  assert.ok(r.chart.luck.cycles.some(c=>c.years.some(y=>y.year===2080)));
  assert.equal(r.chenggu.available,true);
});
test('caller cancellation and invalid provider do not become fallback results',async()=>{
  const controller=new AbortController();controller.abort(new Error('cancelled by caller'));
  await assert.rejects(()=>createReading(base,{signal:controller.signal}),/cancelled by caller/);
  await assert.rejects(()=>createReading(base,{provider:'invented'}),/provider/);
});
test('year of transition splits the actual solar month by the exact date',async()=>{
  const r=await createReading(base,{provider:'local'});
  const y=r.timeline.years.find(y=>y.year===2028),m=y.months.find(m=>m.segments.length>1);
  assert.ok(m);assert.equal(m.segments.length,2);
  assert.notEqual(m.segments[0].daYun,m.segments[1].daYun);
  assert.ok(Math.abs(m.segments.reduce((a,s)=>a+s.fraction,0)-1)<1e-10);
});
test('last requested solar month includes the next civil-year luck transition',async()=>{
  const r=await createReading({...base,date:'2000-10-01',startYear:2012,endYear:2012},{provider:'local'});
  const last=r.timeline.years[0].months[11];
  assert.equal(last.ganZhi,'癸丑');
  assert.equal(last.segments.length,2);
  assert.equal(last.segments[0].daYun,'丙戌');assert.equal(last.segments[1].daYun,'丁亥');
  assert.equal(last.segments.some(s=>s.daYun==='起运前'),false);
});
