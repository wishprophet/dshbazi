// Relationship facts for the study board; separate from interpretation/scoring.
const PAIRS = {
  冲:['子午','丑未','寅申','卯酉','辰戌','巳亥'],
  六合:['子丑','寅亥','卯戌','辰酉','巳申','午未'],
  刑:['子卯','寅巳','巳申','申寅','丑戌','戌未','未丑'],
  破:['子酉','丑辰','寅亥','卯午','巳申','未戌'],
  害:['子未','丑午','寅巳','卯辰','申亥','酉戌'],
};
const stemPairs=['甲己','乙庚','丙辛','丁壬','戊癸'];
export const RELATION_RULES={pairs:PAIRS,stemPairs,stemClashes:['甲庚','乙辛','丙壬','丁癸'],groups:[['申子辰','三合'],['亥卯未','三合'],['寅午戌','三合'],['巳酉丑','三合'],['亥子丑','三会'],['寅卯辰','三会'],['巳午未','三会'],['申酉戌','三会']]};
export function pillarRelationships(columns,{touching=[],rules=RELATION_RULES}={}) {
  const short=column=>`${column.label}${column.ganZhi}`;
  const list=columns.filter(c=>/^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/.test(c.ganZhi));
  const out=[];
  const add=(type,items,detail)=>{
    if(touching.length&&!items.some(c=>touching.includes(c.key)))return;
    out.push({type,keys:items.map(c=>c.key),text:`${items.map(short).join('、')}：${detail}`});
  };
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i],b=list[j],sa=a.ganZhi[0],sb=b.ganZhi[0],ba=a.ganZhi[1],bb=b.ganZhi[1];
    const contains=pairs=>pairs.includes(ba+bb)||pairs.includes(bb+ba);
    if(rules.stemPairs.includes(sa+sb)||rules.stemPairs.includes(sb+sa))add('天干合',[a,b],`${sa}${sb}合`);
    if(rules.stemClashes.includes(sa+sb)||rules.stemClashes.includes(sb+sa))add('天干冲',[a,b],`${sa}${sb}冲`);
    for(const [type,pairs] of Object.entries(rules.pairs))if(contains(pairs))add(type,[a,b],`${ba}${bb}${type}`);
    if(ba===bb&&'辰午酉亥'.includes(ba))add('自刑',[a,b],`${ba}${bb}自刑`);
  }
  for(const [branches,type] of rules.groups){
    if([...branches].every(b=>list.some(c=>c.ganZhi[1]===b)))add(type,list.filter(c=>branches.includes(c.ganZhi[1])),`${branches}${type}`);
  }
  return out;
}
