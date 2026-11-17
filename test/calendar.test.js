import test from 'node:test';
import assert from 'node:assert/strict';
import lunar from 'lunar-javascript';
import { normalizeInput,calculateChart,yearFacts } from '../src/calendar.js';
const base={name:'测试',gender:'male',location:'北京',calendar:'solar',date:'2000-01-01',time:'12:34',startYear:2026,endYear:2030};
const chart=(changes={})=>calculateChart(normalizeInput({...base,...changes}));

test('known calendar fixtures and late Zi follow website convention',()=>{
  const cases=[
    ['2000-01-01','12:34',['己卯','丙子','戊午','戊午']],
    ['1988-02-15','22:30',['戊辰','甲寅','庚子','丁亥']],
    ['1988-02-15','23:30',['戊辰','甲寅','辛丑','戊子']],
    ['2005-12-23','08:37',['乙酉','戊子','辛巳','壬辰']]
  ];
  for(const [date,time,expected] of cases) assert.deepEqual(Object.values(chart({date,time}).pillars),expected);
});
test('lunar leap month converts to exact solar minutes and rejects nonexistent dates',()=>{
  const n=normalizeInput({...base,calendar:'lunar',date:'2023-02-01',time:'12:34',leapMonth:true});
  assert.equal(n.solarDate,'2023-03-22'); assert.equal(n.solarTime,'12:34:00');
  for(const changes of [{date:'2001-02-29'},{date:'2000-04-31'},{time:'24:00'},{gender:'__proto__'},{calendar:'toString'},{calendar:'lunar',date:'2024-02-01',leapMonth:true},{calendar:'lunar',date:'2023-02-30',leapMonth:true},{time:undefined}]) assert.throws(()=>normalizeInput({...base,...changes}));
});
test('LiChun and each month boundary change at the computed instant',()=>{
  for(const year of [1902,1950,1988,2000,2026,2038,2099]) {
    const terms=yearFacts(year,year).months;
    for(const month of terms) {
      const [date,time]=month.startDate.split(' '), [y,m,d]=date.split('-').map(Number),[h,min,s]=time.split(':').map(Number);
      const at=lunar.Solar.fromYmdHms(y,m,d,h,min,s);
      const before=lunar.Solar.fromJulianDay(at.getJulianDay()-2/86400);
      const after=lunar.Solar.fromJulianDay(at.getJulianDay()+2/86400);
      const c1=chart({date:before.toYmd(),time:before.toYmdHms().slice(11),startYear:y,endYear:y});
      const c2=chart({date:after.toYmd(),time:after.toYmdHms().slice(11),startYear:y,endYear:y});
      assert.notEqual(c1.pillars.month,c2.pillars.month);
      assert.equal(c2.pillars.month,month.ganZhi);
      if(month.index===0) assert.notEqual(c1.pillars.year,c2.pillars.year);
    }
  }
});
test('pillars do not invent birthday or starting luck; explicit dates enable a timeline',()=>{
  const c=chart({calendar:'pillars',pillars:'己卯 丙子 戊午 戊午',birthYear:undefined});
  assert.equal(c.luck.available,false);assert.equal(c.solarDateTime,null);
  const full=chart({calendar:'pillars',pillars:c.pillars,birthYear:2000,startLuckDate:'2008-03-18 04:34'});
  assert.equal(full.luck.available,true);assert.equal(full.luck.startDate,'2008-03-18 04:34:00');
  assert.throws(()=>chart({calendar:'pillars',pillars:'甲子 丙寅 戊午 戊午 戊午'}));
  assert.throws(()=>chart({calendar:'pillars',pillars:'甲子 丁寅 戊午 戊午'}));
  assert.throws(()=>chart({calendar:'pillars',pillars:'己卯 丙子 戊午 戊午',birthYear:1988,startLuckDate:'1994-05-12'}),/年柱不一致/);
});
test('cycle intervals are contiguous, and website luck remains attributed',()=>{
  const input=normalizeInput(base), c=calculateChart(input,{pillars:chart().pillars,startLuck:{date:'2008-03-18 04:34:00',forward:false,age:{years:8,months:2,days:16,hours:16}}});
  assert.equal(c.luck.source,'zydx');assert.equal(c.luck.localStartDate,'2008-03-15 10:34:00');
  for(let i=1;i<c.luck.cycles.length;i++) assert.equal(c.luck.cycles[i-1].endDate,c.luck.cycles[i].startDate);
  assert.ok(c.luck.cycles.some(x=>x.years.some(y=>y.year===2028)));
});
test('240 dates round-trip solar and lunar consistently (not independent algorithm verification)',()=>{
  for(let i=0;i<240;i++) {
    const y=1902+(i%130),m=i%12+1,d=i%27+1;
    const s=lunar.Solar.fromYmdHms(y,m,d,i%24,(i*7)%60,0),l=s.getLunar();
    const a=chart({date:s.toYmd(),time:s.toYmdHms().slice(11),startYear:y,endYear:y});
    const b=chart({calendar:'lunar',date:`${l.getYear()}-${String(Math.abs(l.getMonth())).padStart(2,'0')}-${String(l.getDay()).padStart(2,'0')}`,leapMonth:l.getMonth()<0,time:s.toYmdHms().slice(11),startYear:y,endYear:y});
    assert.deepEqual(a.pillars,b.pillars);
    assert.equal(a.columns[2].stemGod,'日主');
    for(const col of a.columns) assert.ok(col.hiddenStems.every(h=>h.god && h.element));
  }
});
