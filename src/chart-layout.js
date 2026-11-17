import lunar from 'lunar-javascript';
import {chartColumns,tenGod,HIDDEN} from './analysis.js';
import {displayPillarFacts} from './display-facts.js';
import {pillarRelationships,RELATION_RULES} from './relationships.js';

const TERMS=['立春','惊蛰','清明','立夏','芒种','小暑','立秋','白露','寒露','立冬','大雪','小寒'];
const JIAZI=Array.from({length:60},(_,i)=>'甲乙丙丁戊己庚辛壬癸'[i%10]+'子丑寅卯辰巳午未申酉戌亥'[i%12]);
export function buildExplorer(chart,timeline){
  const dm=chart.pillars.day[0];
  const facts=Object.fromEntries(JIAZI.map(ganZhi=>[ganZhi,{
    ganZhi,stemGod:tenGod(dm,ganZhi[0]),hiddenStems:(HIDDEN[ganZhi[1]]||[]).map(stem=>({stem,god:tenGod(dm,stem)})),
    ...displayPillarFacts(chart.pillars,ganZhi,{gender:chart.gender}),
  }]));
  const natal=chartColumns(chart).map(c=>({key:c.key,label:c.label,...facts[c.ganZhi],stemGod:c.stemGod,diShi:c.diShi,...displayPillarFacts(chart.pillars,c.ganZhi,{role:c.key,gender:chart.gender})}));
  const rawCycles=chart.luck?.cycles||[];
  const cycles=rawCycles.map((c,i)=>({id:String(c.index??i),...(facts[c.ganZhi]||{ganZhi:'',hiddenStems:[],shenSha:[]}),startDate:c.startDate,endDate:c.endDate,startAge:c.startAge,endAge:c.endAge}));
  const years=(timeline.years||[]).filter(y=>Number.isInteger(y.year)).map(y=>{
    const start=y.months?.[0]?.startDate,end=y.months?.at(-1)?.endDate;
    const cycleIds=cycles.filter(c=>start&&end?c.startDate<end&&c.endDate>start:rawCycles.find((v,i)=>String(v.index??i)===c.id)?.years?.some(a=>a.year===y.year)).map(c=>c.id);
    const months=(y.months||[]).map((m,i)=>({index:m.index,term:TERMS[i],ganZhi:m.ganZhi,startDate:m.startDate,endDate:m.endDate,cycleIds:cycles.filter(c=>c.startDate<m.endDate&&c.endDate>m.startDate).map(c=>c.id)}));
    return {year:y.year,age:y.age,...facts[y.ganZhi],cycleIds,months};
  });
  return {cycles,years,natal,facts,jiazi:JIAZI,dayAnchor:{date:'2000-01-01',ganZhi:lunar.Solar.fromYmd(2000,1,1).getLunar().getEightChar().getDay()}};
}

export function natalTable(explorer,chenggu,{esc,glyph}){
  const cols=explorer.natal;
  const row=(label,render,cls='')=>`<tr class="${cls}"><th scope="row">${label}</th>${cols.map(c=>`<td data-pillar="${c.key}">${render(c)}</td>`).join('')}</tr>`;
  const relations=pillarRelationships(cols);
  const relationLine=(label,isStem)=>`<div class="chart-note"><span class="note-label">${label}</span><span>${[...new Set(relations.filter(r=>r.type.startsWith('天干')===isStem).map(r=>esc(r.text.split('：').at(-1))))].join('；')||'—'}</span></div>`;
  const cg=chenggu?.available?`<div id="chenggu" class="chenggu-inline"><div class="chart-note"><span class="note-label">称骨重量</span><strong>${esc(chenggu.weight?.totalText)}</strong></div><div class="chart-note"><span class="note-label">称骨评语</span><span class="chenggu-verse">${(chenggu.verse||[]).map(esc).join('，')}。</span></div><div class="chart-note chenggu-translation"><span class="note-label">称骨解读</span><span>${esc(chenggu.translation)}</span></div></div>`:chenggu?`<div id="chenggu" class="chart-note"><span class="note-label">称骨</span><span>${esc(chenggu.reason||'补充出生年月日时后查看。')}</span></div>`:'';
  return `<div class="paper chart-sheet"><table class="natal-table" aria-label="本命四柱"><colgroup><col class="row-label">${cols.map(()=>'<col>').join('')}</colgroup><thead><tr><th scope="col">四柱</th>${cols.map(c=>`<th scope="col">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${row('十神',c=>esc(c.stemGod))}${row('天干',c=>glyph(c.ganZhi[0],'gan-zhi-char'),'stem-row')}${row('地支',c=>glyph(c.ganZhi[1],'gan-zhi-char'),'branch-row')}${row('藏干',c=>c.hiddenStems.map(h=>`<span class="hidden-line">${glyph(h.stem)} <span>（${esc(h.god)}）</span></span>`).join(''))}${row('十二长生',c=>esc(c.diShi))}${row('空亡',c=>esc(c.xunKong))}${row('神煞',c=>c.shenSha?.length?c.shenSha.map(s=>`<span class="fact-line">${esc(s)}</span>`).join(''):'—')}</tbody></table><div id="natal-relations">${relationLine('天干关系',true)}${relationLine('地支关系',false)}</div>${cg}</div>`;
}

export const explorerShell=`<div class="paper explorer"><div class="explorer-toolbar"><label>大运 <select id="chart-cycle"></select></label><label>流年 <select id="chart-year"></select></label><label>流日 <input type="date" id="chart-day"></label><button type="button" class="nav-button" id="clear-period">清除月日</button></div><div class="board-heading" id="active-heading"></div><div class="table-scroll"><table class="period-table" id="active-pillars" aria-label="运年与本命对照"></table></div><div class="period-strip"><span class="strip-label">大运</span><div class="cycle-buttons" id="cycle-buttons" aria-label="选择大运"></div></div><div class="period-strip"><span class="strip-label">流年</span><div class="year-chips" id="year-chips" aria-label="大运内流年"></div></div><div class="period-strip"><span class="strip-label">流月</span><div class="month-chips" id="month-chips" aria-label="节气流月"></div></div><p class="selection-explanation" id="cycle-explanation"></p><div id="active-relations"></div></div>`;

export const CHART_CSS=`
.chart-sheet{padding:0;overflow:hidden}.natal-table,.period-table{border-collapse:collapse;table-layout:fixed;width:100%;text-align:center;font-size:14px}.natal-table .row-label{width:100px}.natal-table th,.natal-table td,.period-table th,.period-table td{padding:12px 9px;border-bottom:1px solid var(--line);vertical-align:middle}.natal-table thead,.period-table thead{background:var(--soft)}.natal-table th,.period-table th{font-weight:500;color:#53656c}.natal-table tbody tr:nth-child(even),.period-table tbody tr:nth-child(even){background:#f7f9fa}.natal-table .gan-zhi-char{font-size:41px}.hidden-line,.fact-line{display:block;font-size:13px;line-height:1.8}.hidden-line>span:first-child{font-size:17px;font-weight:500}.chart-note{display:flex;align-items:baseline;gap:12px;padding:12px 20px;border-bottom:1px solid var(--line);font-size:13px;line-height:1.85}.chart-note:last-child{border-bottom:0}.note-label{flex:none;width:76px;color:#596d78;font-weight:500}.chart-note>span:last-child{min-width:0}.chenggu-inline{border-top:1px solid var(--line)}.chenggu-inline .chart-note:first-child{background:var(--soft)}.chenggu-inline strong{color:var(--accent);font-size:17px}.chenggu-verse{font-family:'KaiTi','STKaiti',serif;font-size:17px}.chenggu-translation{background:#f8faf9}.explorer{padding:0;overflow:hidden}.explorer-toolbar{padding:18px 20px;margin:0;border-bottom:1px solid var(--line);gap:12px}.explorer-toolbar input{font:inherit;color:var(--text);background:#fff;border:1px solid #bac9c6;border-radius:6px;padding:7px 8px;max-width:150px}.explorer .board-heading{padding:10px 20px;margin:0}.table-scroll{overflow:auto}.period-table{min-width:720px;font-size:12px}.period-table th:first-child{width:65px}.period-table .gan-zhi-char{font-size:32px}.period-table .period-age td{font-size:12px;line-height:1.5}.period-table .period-age small{display:block;color:var(--muted);font-size:11px}.period-table td.selected-period{background:#edf4f1}.symbol-with-gods{display:flex;justify-content:center;align-items:center;gap:5px}.compact-gods{display:flex;flex-direction:column;font-size:10px;line-height:1.35;color:var(--muted)}.period-strip{display:flex;border-bottom:1px solid var(--line);background:#fff}.strip-label{flex:none;width:65px;display:flex;align-items:center;justify-content:center;color:#596d78;font-size:13px;background:#f7f9fa}.cycle-buttons,.year-chips,.month-chips{display:flex;flex:1;min-width:0;overflow-x:auto;gap:0;padding:0;margin:0;border-radius:0}.cycle-button,.year-chip,.month-chip{flex:1;min-width:85px;display:flex;align-items:center;justify-content:center;flex-direction:column;border:0;border-right:1px solid var(--line);border-radius:0;padding:12px 5px;background:#fff;color:var(--text);line-height:1.6}.cycle-button small,.year-chip small,.month-chip small{margin:0;font-size:11px;white-space:nowrap;color:var(--muted)}.cycle-button .mini-stack,.year-chip .mini-stack,.month-chip .mini-stack{flex-direction:row;gap:1px;font-size:21px;line-height:1.5;margin:4px 0 0}.month-chip{min-width:72px}.month-chip .mini-stack{font-size:18px}.cycle-button.active,.year-chip.active,.month-chip.active{background:#e3f0eb;box-shadow:inset 0 -3px 0 var(--accent)}.explorer .selection-explanation{padding:12px 20px;margin:0;border-bottom:1px solid var(--line)}.period-relations .chart-note{padding-top:9px;padding-bottom:9px}.relation-period-title{font-size:12px;color:var(--accent);padding:9px 20px;background:var(--soft)}
@media(max-width:560px){.natal-table .row-label{width:56px}.natal-table th,.natal-table td{padding:9px 2px;font-size:11px}.natal-table .gan-zhi-char{font-size:33px}.hidden-line,.fact-line{font-size:10px}.hidden-line>span:first-child{font-size:13px}.chart-note{padding:10px 12px;gap:8px;font-size:12px}.note-label{width:57px}.chenggu-verse{font-size:15px}.explorer-toolbar{padding:12px;gap:8px}.explorer-toolbar label{font-size:11px}.explorer-toolbar select{max-width:130px}.explorer-toolbar input{max-width:128px}.period-table{min-width:660px}.strip-label{width:52px}.cycle-button,.year-chip{min-width:76px}.month-chip{min-width:65px}.explorer .selection-explanation{padding:10px 12px}.period-relations .chart-note{padding-left:12px;padding-right:12px}}
@media print{.explorer-toolbar{display:none}.table-scroll{overflow:visible}.period-table{min-width:0}.cycle-buttons,.year-chips,.month-chips{display:flex;flex-wrap:wrap}.cycle-button,.year-chip,.month-chip{min-width:55px}.chart-sheet{break-inside:avoid}.explorer{break-inside:auto}}
`;

// Inserted as inline code in the standalone report; uses the same relationship function as the server.
export const EXPLORER_JS=`
const boardRelations=${pillarRelationships.toString()};
const relationRules=${JSON.stringify(RELATION_RULES)};
let selectedCycle=null,selectedMonth=null,selectedDay='',boardYear=null;
const explorer=data.explorer,dayMs=86400000;
function mini(parent,ganZhi){const stack=make('span',null,'mini-stack');for(const ch of ganZhi||'')stack.appendChild(colored(ch));parent.appendChild(stack);}
function dayPillar(date){const delta=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(explorer.dayAnchor.date+'T00:00:00Z'))/dayMs);const index=explorer.jiazi.indexOf(explorer.dayAnchor.ganZhi);return explorer.jiazi[((index+delta)%60+60)%60];}
function boardNote(parent,label,text){const row=make('div',null,'chart-note');appendText(row,'span',label,'note-label');appendText(row,'span',text||'—');parent.appendChild(row);}
const contactText=relations=>[...new Set(relations.map(r=>r.text.split('：').at(-1)))].join('；');
function renderPeriodTable(columns){
 const table=$('active-pillars');table.replaceChildren();const head=make('thead'),hr=make('tr');appendText(hr,'th','日期');for(const col of columns)appendText(hr,'th',col.label);head.appendChild(hr);table.appendChild(head);const body=make('tbody');
 for(const kind of ['岁年','天干','地支','空亡']){const row=make('tr',null,kind==='岁年'?'period-age':'');appendText(row,'th',kind);for(const col of columns){const cell=make('td',null,col.key==='luck'?'selected-period':'');
 if(kind==='岁年'){appendText(cell,'span',col.age==null?(col.key.startsWith('natal-')?'*':''):col.age+'岁');if(col.date)appendText(cell,'small',col.date);}
 else if(kind==='空亡')cell.textContent=col.xunKong||'—';
 else if(col.ganZhi){const symbols=make('div',null,'symbol-with-gods');symbols.appendChild(colored(col.ganZhi[kind==='天干'?0:1],'gan-zhi-char'));const gods=make('div',null,'compact-gods');for(const god of kind==='天干'?[col.stemGod]:(col.hiddenStems||[]).map(h=>h.god))appendText(gods,'span',god);symbols.appendChild(gods);cell.appendChild(symbols);}
 else cell.textContent=col.key==='luck'?'起运前':'—';row.appendChild(cell);}body.appendChild(row);}table.appendChild(body);
}
function renderExplorer(y){
 if(!$('chart-year'))return;const ey=explorer.years.find(a=>a.year===y.year);if(!ey)return;
 if(boardYear!==y.year){selectedMonth=null;selectedDay='';boardYear=y.year;}
 if(selectedMonth!=null&&!ey.months.some(m=>m.index===selectedMonth))selectedMonth=null;
 const month=ey.months.find(m=>m.index===selectedMonth),allActive=explorer.cycles.filter(c=>ey.cycleIds.includes(c.id));
 if(!allActive.some(c=>c.id===selectedCycle))selectedCycle=allActive[0]?.id||null;
 let active=month?explorer.cycles.filter(c=>month.cycleIds.includes(c.id)):allActive;
 if(selectedDay){const dayStart=selectedDay+' 00:00:00',dayEnd=new Date(Date.parse(selectedDay+'T00:00:00Z')+dayMs).toISOString().slice(0,10)+' 00:00:00';const exact=active.filter(c=>c.startDate<dayEnd&&c.endDate>dayStart);if(exact.length)active=exact;}
 if(month&&active.length&&!active.some(c=>c.id===selectedCycle))selectedCycle=active[0].id;
 $('chart-year').value=String(y.year);$('chart-cycle').value=selectedCycle??'';$('active-heading').textContent=y.year+' 年 · 运年与本命对照';
 const period=[{key:'daily',label:'流日',...(selectedDay?explorer.facts[dayPillar(selectedDay)]:{}),date:selectedDay},{key:'monthly',label:'流月',...(month?explorer.facts[month.ganZhi]:{}),date:month?month.term:''},{key:'annual',label:'流年',...ey,date:String(y.year)},...active.map(c=>({key:'luck',label:'大运',...c,age:c.startAge,date:c.startDate.slice(0,4)}))];
 renderPeriodTable([...period,...explorer.natal.map(c=>({...c,key:'natal-'+c.key}))]);
 $('active-relations').replaceChildren();
 for(const cycle of active.length?active:[null]){const group=make('div',null,'period-relations');if(allActive.length>1)appendText(group,'div',(cycle?.ganZhi||'起运前')+'运期间','relation-period-title');const entries=[...explorer.natal,...period.filter(c=>c.key!=='luck'),...(cycle?.ganZhi?[{key:'luck',label:'大运',ganZhi:cycle.ganZhi}]:[])];const relations=boardRelations(entries,{touching:['luck','annual','monthly','daily'],rules:relationRules});boardNote(group,'天干关系',contactText(relations.filter(r=>r.type.startsWith('天干'))));boardNote(group,'地支关系',contactText(relations.filter(r=>!r.type.startsWith('天干'))));for(const [label,fact] of [['大运神煞',cycle],['流年神煞',ey],['流月神煞',month&&explorer.facts[month.ganZhi]],['流日神煞',selectedDay&&explorer.facts[dayPillar(selectedDay)]]])boardNote(group,label,fact?.shenSha?.join('、'));$('active-relations').appendChild(group);}
 for(const button of $('cycle-buttons').children){const on=button.dataset.cycle===selectedCycle;button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on));}
 $('year-chips').replaceChildren();for(const row of explorer.years.filter(a=>a.cycleIds.includes(selectedCycle))){const button=make('button',null,'year-chip');button.type='button';button.dataset.chartYear=row.year;button.setAttribute('aria-label',row.year+'年 '+row.ganZhi);button.classList.toggle('active',row.year===y.year);appendText(button,'small',row.year);mini(button,row.ganZhi);button.addEventListener('click',()=>chooseYear(row.year));$('year-chips').appendChild(button);}
 $('month-chips').replaceChildren();for(const m of ey.months){const button=make('button',null,'month-chip');button.type='button';button.dataset.chartMonth=m.index;button.classList.toggle('active',m.index===selectedMonth);button.setAttribute('aria-pressed',String(m.index===selectedMonth));appendText(button,'small',m.term);mini(button,m.ganZhi);button.title=m.startDate+' 至 '+m.endDate;button.addEventListener('click',()=>{selectedMonth=m.index===selectedMonth?null:m.index;selectedDay='';renderExplorer(y);});$('month-chips').appendChild(button);}
 $('chart-day').value=selectedDay;$('chart-day').min=ey.months[0]?.startDate.slice(0,10)||'';$('chart-day').max=ey.months.at(-1)?.endDate.slice(0,10)||'';
 $('cycle-explanation').textContent=allActive.map(c=>(c.ganZhi||'起运前')+'：'+c.startDate+' 至 '+c.endDate).join('；')+(month?' · '+month.term+' '+month.startDate+' 至 '+month.endDate:'');
}
function chooseYear(year){selectedMonth=null;selectedDay='';select(years.findIndex(y=>y.year===year));}
function chooseCycle(id){selectedCycle=id;const candidates=explorer.years.filter(y=>y.cycleIds.includes(id)&&years.some(t=>t.year===y.year));if(!candidates.length)return;const target=candidates.reduce((best,y)=>Math.abs(y.year-years[selected].year)<Math.abs(best.year-years[selected].year)?y:best);chooseYear(target.year);}
if($('chart-year')){
 for(const y of explorer.years){const option=make('option',y.year+' · '+y.ganZhi);option.value=y.year;$('chart-year').appendChild(option);}
 for(const c of explorer.cycles){if(!explorer.years.some(y=>y.cycleIds.includes(c.id)))continue;const label=c.ganZhi||'起运前',option=make('option',label+' · '+dateLabel(c.startDate));option.value=c.id;$('chart-cycle').appendChild(option);const button=make('button',null,'cycle-button');button.type='button';button.dataset.cycle=c.id;button.setAttribute('aria-label','查看大运 '+label);appendText(button,'small',c.startAge==null?'起运前':c.startAge+'岁');appendText(button,'small',dateLabel(c.startDate).slice(0,4));if(c.ganZhi)mini(button,c.ganZhi);else appendText(button,'span','起运前');button.addEventListener('click',()=>chooseCycle(c.id));$('cycle-buttons').appendChild(button);}
 $('chart-cycle').addEventListener('change',e=>chooseCycle(e.target.value));$('chart-year').addEventListener('change',e=>chooseYear(Number(e.target.value)));
 $('chart-day').addEventListener('change',e=>{const date=e.target.value,ey=explorer.years.find(y=>y.year===years[selected].year);if(!date){selectedDay='';renderExplorer(years[selected]);return;}const at=date+' 12:00:00',month=ey.months.find(m=>m.startDate<=at&&m.endDate>at);if(!month){selectedDay='';renderExplorer(years[selected]);return;}selectedDay=date;selectedMonth=month.index;renderExplorer(years[selected]);});
 $('clear-period').addEventListener('click',()=>{selectedMonth=null;selectedDay='';renderExplorer(years[selected]);});
}
`;
