import lunar from 'lunar-javascript';

const { Solar, Lunar, LunarUtil: U } = lunar;
export const STEMS = '甲乙丙丁戊己庚辛壬癸';
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const KEYS = ['year', 'month', 'day', 'hour'];
const LABELS = ['年柱', '月柱', '日柱', '时柱'];
const mod = (n, d) => ((n % d) + d) % d;
const pad = n => String(n).padStart(2, '0');
export const POLICY = Object.freeze({
  id: 'zydx-clock-v1', timezone: 'Asia/Shanghai', yearBoundary: '立春交节',
  monthBoundary: '节令交接', dayBoundary: '23:00子初换日', solarTime: false,
  description: '按北京时间钟表时间排盘，23点换日；出生地点用于记档，不自动校正真太阳时。境外出生请先换算为北京时间。',
  localLuck: 'lunar-javascript 1.7.8 按分钟换算起运（流派2）；网站成功时优先采用网站交运日。'
});

export class InputError extends Error {
  constructor(message, code = 'INVALID_INPUT') { super(message); this.name = 'InputError'; this.code = code; }
}
function text(value, field, max = 200) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value)) throw new InputError(`${field}必须是至多${max}字的文本`);
  return value.trim();
}
function integer(value, field, low, high) {
  if (!Number.isInteger(value) || value < low || value > high) throw new InputError(`${field}须为${low}—${high}之间的整数`);
  return value;
}
export function parseCivil(date, time = '00:00:00') {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
  const t = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time ?? '');
  if (!d || !t) throw new InputError('日期须为YYYY-MM-DD，时间须为HH:mm或HH:mm:ss');
  const [y, m, day] = d.slice(1).map(Number);
  const [h, min, sec] = [Number(t[1]), Number(t[2]), Number(t[3] || 0)];
  if (m < 1 || m > 12 || day < 1 || day > 31 || h > 23 || min > 59 || sec > 59) throw new InputError('日期或时间超出有效范围');
  return [y, m, day, h, min, sec];
}
function checkedSolar(parts) {
  let s;
  try { s = Solar.fromYmdHms(...parts); } catch { throw new InputError('阳历日期不存在'); }
  const expected = `${parts[0]}-${pad(parts[1])}-${pad(parts[2])} ${pad(parts[3])}:${pad(parts[4])}:${pad(parts[5])}`;
  const check = new Date(Date.UTC(...[parts[0], parts[1]-1, ...parts.slice(2)]));
  if (check.getUTCMonth()+1 !== parts[1] || check.getUTCDate() !== parts[2] || s.toYmdHms() !== expected) throw new InputError('阳历日期不存在');
  return s;
}
export function normalizeInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new InputError('输入须为对象');
  const genders = new Map([['male','male'],['female','female'],['男','male'],['女','female']]);
  const gender = genders.get(raw.gender);
  if (!gender) throw new InputError('请提供性别：male/男 或 female/女');
  const calendars = new Map([['solar','solar'],['lunar','lunar'],['pillars','pillars'],['阳历','solar'],['公历','solar'],['阴历','lunar'],['农历','lunar'],['四柱','pillars']]);
  const calendar = calendars.get(raw.calendar || (raw.pillars ? 'pillars' : 'solar'));
  if (!calendar) throw new InputError('calendar须为solar、lunar或pillars');
  const input = { name: text(raw.name, '姓名', 80) || '命主', gender, location: text(raw.location, '出生地点'), calendar };
  if (raw.leapMonth != null && typeof raw.leapMonth !== 'boolean') throw new InputError('leapMonth须为布尔值');
  input.leapMonth = raw.leapMonth ?? false;
  if (raw.context != null) {
    if (typeof raw.context !== 'object' || Array.isArray(raw.context)) throw new InputError('context须为对象');
    input.context = Object.fromEntries(['occupation','relationship','plans'].map(k => [k, text(raw.context[k], k, 1000)]));
    if (Object.values(input.context).some(Boolean)) input.contextYear = raw.contextYear == null ? Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric'}).format(new Date())) : integer(raw.contextYear,'背景年份',1901,2220);
  }
  for (const key of ['startYear','endYear']) if (raw[key] != null) input[key] = integer(raw[key], key, 1901, 2220);
  if (input.startYear != null && input.endYear != null && (input.endYear < input.startYear || input.endYear-input.startYear > 119)) throw new InputError('年份范围须递增且不超过120年');
  if (calendar === 'pillars') {
    const supplied = typeof raw.pillars === 'string' ? raw.pillars.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/gu) : raw.pillars;
    if (typeof raw.pillars === 'string' && (supplied?.length!==4 || raw.pillars.replace(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/gu,'').replace(/[\s,，、;；]/gu,''))) throw new InputError('四柱须为按年月日时排列的四组干支');
    if (Array.isArray(supplied) && supplied.length!==4) throw new InputError('四柱必须恰有四组干支');
    input.pillars = Object.fromEntries(KEYS.map((k,i)=>[k,Array.isArray(supplied) ? supplied[i] : supplied?.[k]]));
    validatePillars(input.pillars);
    if (raw.birthYear != null) {
      input.birthYear = integer(raw.birthYear, '出生公历年', 1901, 2100);
      const candidates=[input.birthYear-1,input.birthYear].map(y=>U.JIA_ZI[mod(y-4,60)]);
      if(!candidates.includes(input.pillars.year)) throw new InputError('出生公历年与年柱不一致；年柱只能对应该年立春前或立春后的干支，请核对');
    }
    if (raw.startLuckDate != null) {
      const match = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?$/.exec(raw.startLuckDate);
      if (!match) throw new InputError('startLuckDate须为已确认的交运日期YYYY-MM-DD，可带时间');
      const s = checkedSolar(parseCivil(match[1], match[2] || '00:00:00'));
      input.startLuckDate = s.toYmdHms();
      if (!input.birthYear) throw new InputError('提供交运日期时也须提供出生公历年birthYear');
      if (s.getYear() < input.birthYear || s.getYear() > input.birthYear+11) throw new InputError('首个交运日期应在出生后约0—11年内，请核对');
    }
  } else {
    if (raw.date == null || raw.time == null) throw new InputError('请提供具体出生日期和时间，不能自动假定时辰');
    input.date = text(raw.date, '日期', 10); input.time = text(raw.time, '时间', 8);
    const parts = parseCivil(input.date, input.time);
    integer(parts[0], '出生年份', 1901, 2100);
    if (calendar === 'solar' && input.leapMonth) throw new InputError('闰月标志仅适用于农历');
    let s;
    if (calendar === 'solar') s = checkedSolar(parts);
    else {
      try {
        const l = Lunar.fromYmdHms(parts[0],input.leapMonth ? -parts[1] : parts[1],...parts.slice(2));
        if (l.getYear() !== parts[0] || l.getMonth() !== (input.leapMonth?-parts[1]:parts[1]) || l.getDay() !== parts[2]) throw new Error();
        s = l.getSolar();
      } catch { throw new InputError('农历日期或闰月不存在，请核对'); }
    }
    input.solarDate = s.toYmd(); input.solarTime = s.toYmdHms().slice(11); input.birthYear = s.getYear();
  }
  if (input.birthYear) {
    input.startYear ??= input.birthYear;
    input.endYear ??= Math.min(input.startYear+80, input.birthYear+119);
    if (input.startYear < input.birthYear || input.endYear < input.startYear || input.endYear > input.birthYear+119 || input.endYear-input.startYear>119) throw new InputError('分析年份须在出生年起120年范围内，且结束年不小于开始年');
  }
  return input;
}
export function validatePillars(pillars) {
  for (const k of KEYS) if (!U.JIA_ZI.includes(pillars[k])) throw new InputError(`${k}柱不是合法六十甲子`);
  const yearStem = STEMS.indexOf(pillars.year[0]);
  const monthIndex = mod(BRANCHES.indexOf(pillars.month[1])-2,12);
  if (pillars.month[0] !== STEMS[mod((yearStem%5)*2+2+monthIndex,10)]) throw new InputError('年柱与月柱不符合五虎遁，请核对四柱顺序');
  if (pillars.hour[0] !== STEMS[mod((STEMS.indexOf(pillars.day[0])%5)*2+BRANCHES.indexOf(pillars.hour[1]),10)]) throw new InputError('日柱与时柱不符合五鼠遁（本插件采用23点换日），请核对');
}
export function god(dayMaster, stem) { return U.SHI_SHEN[dayMaster+stem]; }
export function pillarFacts(pillars) {
  const dm=pillars.day[0];
  return KEYS.map((key,i)=>{
    const [stem,branch]=pillars[key];
    const offset=U.CHANG_SHENG_OFFSET[dm];
    const growth=mod(offset+(STEMS.indexOf(dm)%2===0 ? BRANCHES.indexOf(branch) : -BRANCHES.indexOf(branch)),12);
    return {key,label:LABELS[i],ganZhi:pillars[key],stem,branch,element:U.WU_XING_GAN[stem],branchElement:U.WU_XING_ZHI[branch],stemGod:key==='day'?'日主':god(dm,stem),hiddenStems:U.ZHI_HIDE_GAN[branch].map(s=>({stem:s,element:U.WU_XING_GAN[s],god:god(dm,s)})),naYin:U.NAYIN[pillars[key]],diShi:U.CHANG_SHENG[growth],xun:U.getXun(pillars[key]),xunKong:U.getXunKong(pillars[key])};
  });
}
export function findRelationships(pillars) {
  const out=[];
  const pairs=[['冲',['子午','丑未','寅申','卯酉','辰戌','巳亥']],['六合',['子丑','寅亥','卯戌','辰酉','巳申','午未']],['害',['子未','丑午','寅巳','卯辰','申亥','酉戌']],['破',['子酉','丑辰','寅亥','卯午','巳申','未戌']],['刑',['子卯','寅巳','巳申','申寅','丑戌','戌未','未丑']]];
  for(let i=0;i<4;i++) for(let j=i+1;j<4;j++) {
    const [a,b]=[pillars[KEYS[i]],pillars[KEYS[j]]];
    for(const [type,values] of pairs) if(values.includes(a[1]+b[1]) || values.includes(b[1]+a[1])) out.push({type,label:`${a[1]}${b[1]}${type}`,pillars:[KEYS[i],KEYS[j]],evidence:`${LABELS[i]}与${LABELS[j]}地支${type}（关系事实，不等同吉凶）`});
    if(a[1]===b[1] && '辰午酉亥'.includes(a[1])) out.push({type:'自刑',label:`${a[1]}${b[1]}自刑`,pillars:[KEYS[i],KEYS[j]],evidence:`${LABELS[i]}与${LABELS[j]}同支自刑`});
    if(['甲己','乙庚','丙辛','丁壬','戊癸'].some(p=>p===a[0]+b[0]||p===b[0]+a[0])) out.push({type:'天干合',label:`${a[0]}${b[0]}合`,pillars:[KEYS[i],KEYS[j]],evidence:'天干五合关系；不能据此直接判定合化'});
  }
  const branches=KEYS.map(k=>pillars[k][1]);
  for(const [set,element,type] of [['申子辰','水','三合'],['亥卯未','木','三合'],['寅午戌','火','三合'],['巳酉丑','金','三合'],['亥子丑','水','三会'],['寅卯辰','木','三会'],['巳午未','火','三会'],['申酉戌','金','三会']]) if([...set].every(b=>branches.includes(b))) out.push({type,label:`${set}${type}${element}`,pillars:KEYS.filter(k=>set.includes(pillars[k][1])),evidence:'三支齐见；是否成化仍需结合月令、透干及冲破'});
  return out;
}
const monthCache = new Map();
export function yearFacts(year, birthYear) {
  if (!monthCache.has(year)) {
    const l=Solar.fromYmd(year,7,1).getLunar(), table=l.getJieQiTable();
    const names=['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','XIAO_HAN','LI_CHUN'];
    const months=names.slice(0,12).map((name,index)=>({index,ganZhi:table[name].nextHour(1).getLunar().getMonthInGanZhiExact(),startDate:table[name].toYmdHms(),endDate:table[names[index+1]].toYmdHms(),jie:name==='XIAO_HAN'?'小寒':name}));
    monthCache.set(year,{year,ganZhi:l.getYearInGanZhiExact(),months});
    if (monthCache.size>250) monthCache.delete(monthCache.keys().next().value);
  }
  return {...monthCache.get(year),age:birthYear ? year-birthYear+1 : null};
}
function fromDateTime(value) { const [date,time]=value.split(' '); return checkedSolar(parseCivil(date,time)); }
export function makeLuck(pillars,input,{startDate,startAge,forward,source='local',localStartDate}={}) {
  if (!input.birthYear || !startDate) return {available:false,reason:'只给四柱不能确定准确起运。补充出生年月日时，或出生公历年和已确认的首次交运日期。',cycles:[]};
  const first=fromDateTime(startDate);
  forward ??= (STEMS.indexOf(pillars.year[0])%2===0)===(input.gender==='male');
  const month=U.JIA_ZI.indexOf(pillars.month), cycles=[];
  const initialStart=input.solarDate ? `${input.solarDate} ${input.solarTime}` : `${input.birthYear}-01-01 00:00:00`;
  const make=(index,ganZhi,start,end)=> {
    const startYear=Number(start.slice(0,4)),endYear=Number(end.slice(0,4));
    const years=[];
    // Include both calendar years at a transition; timeline chooses by exact dates.
    for(let y=Math.max(input.startYear ?? input.birthYear,startYear-1);y<=Math.min(input.endYear ?? input.birthYear+80,endYear);y++) {
      const facts=yearFacts(y,input.birthYear);
      if(facts.months[11].endDate>start && facts.months[0].startDate<end) years.push(facts);
    }
    return {index,ganZhi,startYear,endYear,startAge:startYear-input.birthYear+1,endAge:endYear-input.birthYear+1,startDate:start,endDate:end,years};
  };
  if(initialStart<startDate) cycles.push(make(0,'',initialStart,startDate));
  const until=yearFacts(input.endYear ?? input.birthYear+80,input.birthYear).months[11].endDate;
  for(let i=0;i<13;i++) {
    const cycle=make(i+1,U.JIA_ZI[mod(month+(forward?1:-1)*(i+1),60)],first.nextYear(i*10).toYmdHms(),first.nextYear((i+1)*10).toYmdHms());
    cycles.push(cycle);
    if(cycle.endDate>=until) break;
  }
  return {available:true,forward,startDate,startAge:startAge??null,source,localStartDate:localStartDate??null,cycles};
}
export function calculateChart(input, website = null) {
  let pillars, solar=null, ln=null, startDate, startAge, forward, localStartDate;
  if(input.calendar==='pillars') {
    pillars=input.pillars; startDate=input.startLuckDate;
  } else {
    solar=checkedSolar(parseCivil(input.solarDate,input.solarTime)); ln=solar.getLunar();
    const ec=ln.getEightChar();ec.setSect(1);
    pillars={year:ec.getYear(),month:ec.getMonth(),day:ec.getDay(),hour:ec.getTime()};
    const yun=ec.getYun(input.gender==='male'?1:0,2);
    localStartDate=yun.getStartSolar().toYmdHms();startDate=localStartDate;
    startAge={years:yun.getStartYear(),months:yun.getStartMonth(),days:yun.getStartDay(),hours:yun.getStartHour()};forward=yun.isForward();
  }
  const localPillars={...pillars};
  if(website) { pillars={...website.pillars};validatePillars(pillars);if(website.startLuck?.date) {startDate=website.startLuck.date;startAge=website.startLuck.age;forward=website.startLuck.forward??forward;} }
  const columns=pillarFacts(pillars),elementCounts={木:0,火:0,土:0,金:0,水:0};
  for(const col of columns) {elementCounts[col.element]++;elementCounts[col.branchElement]++;}
  const source=input.calendar==='pillars'?'user-pillars':website?'zydx':'lunar-javascript';
  const chart={pillars,dayMaster:pillars.day[0],columns,solarDateTime:solar?.toYmdHms()??null,lunarDate:ln?.toString()??null,gender:input.gender,birthYear:input.birthYear??null,location:input.location,elementCounts,relationships:findRelationships(pillars),calendarPolicy:POLICY,source};
  chart.luck=makeLuck(pillars,input,{startDate,startAge,forward,source:website?.startLuck?.date?'zydx':input.calendar==='pillars'?'user-confirmed':'lunar-javascript',localStartDate});
  chart.validation=website?{pillarsMatch:KEYS.every(k=>pillars[k]===localPillars[k]),localPillars,websitePillars:pillars,localStartDate,websiteStartDate:website.startLuck?.date??null}:null;
  return chart;
}
