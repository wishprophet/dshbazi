// Explicit network integration check: synthetic examples only, save=0.
import assert from 'node:assert/strict';
import { createReading } from '../src/service.js';
const cases=[
  {date:'2000-01-01',time:'12:34',calendar:'solar',gender:'male',expected:['己卯','丙子','戊午','戊午']},
  {date:'1988-02-15',time:'23:30',calendar:'solar',gender:'male',expected:['戊辰','甲寅','辛丑','戊子']},
  {date:'2023-02-01',time:'12:34',calendar:'lunar',leapMonth:true,gender:'female'}
];
for(const {expected,...data} of cases) {
  const report=await createReading({...data,name:'公开接口测试',location:'北京',startYear:2026,endYear:2027},{provider:'website'});
  assert.equal(report.chart.source,'zydx');assert.equal(report.provenance.website.save,false);
  assert.equal(report.chart.validation.pillarsMatch,true);
  if(expected) assert.deepEqual(Object.values(report.chart.pillars),expected);
  assert.ok(report.timeline.years.length===2);
  console.log(`${data.calendar} ${data.date} ${data.time}: ${Object.values(report.chart.pillars).join(' ')} | 网站起运 ${report.chart.luck.startDate} | 校验一致`);
}
