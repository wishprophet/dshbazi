#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createReading } from './service.js';
import { renderHtml, renderMarkdown } from './report.js';

const help=`dsh-bazi — 四柱八字排盘与报告\n\n用法：\n  dsh-bazi --input examples/solar.json --out reports/example\n  dsh-bazi --date 2000-01-01 --time 12:34 --gender male --location 北京 --out reports/example\n  dsh-bazi --pillars "己卯 丙子 戊午 戊午" --gender male --out reports/pillars\n\n--calendar solar|lunar  公历/农历，默认solar；农历闰月加 --leap-month\n--provider auto|website|local  默认auto：网站不保存免登录，失败回退本地\n--name 姓名  --location 出生地点  --gender male|female\n--start-year 年 --end-year 年  限定流年区间\n--birth-year 年 --start-luck-date YYYY-MM-DD  已有四柱可补已确认起运\n--out 目录  保存report.html、report.md、report.json、chart.json\n不传--out时输出JSON。时间按北京时间钟表时间，地点记档。`;
try {
  const {values}=parseArgs({options:Object.fromEntries(['input','out','date','time','gender','location','name','calendar','provider','pillars','birth-year','start-luck-date','start-year','end-year'].map(k=>[k,{type:'string'}]).concat([['leap-month',{type:'boolean'}],['help',{type:'boolean',short:'h'}]]))});
  if(values.help || Object.keys(values).length===0) {console.log(help);}
  else {
    const input=values.input?JSON.parse(await readFile(path.resolve(values.input),'utf8').then(s=>s.replace(/^\uFEFF/u,''))):{};
    for(const key of ['date','time','gender','location','name','calendar','pillars']) if(values[key]!=null) input[key]=values[key];
    if(values.pillars) input.calendar='pillars';
    if(values['leap-month']) input.leapMonth=true;
    for(const [flag,key] of [['birth-year','birthYear'],['start-year','startYear'],['end-year','endYear']]) if(values[flag]!=null) input[key]=Number(values[flag]);
    if(values['start-luck-date']) input.startLuckDate=values['start-luck-date'];
    const report=await createReading(input,{provider:values.provider??input.provider??'auto'});
    if(values.out) {
      const dir=path.resolve(values.out);await mkdir(dir,{recursive:true});
      await Promise.all([['report.json',JSON.stringify(report,null,2)],['chart.json',JSON.stringify(report.chart,null,2)],['report.md',renderMarkdown(report)],['report.html',renderHtml(report)]].map(([name,body])=>writeFile(path.join(dir,name),body,'utf8')));
      console.log(`命盘来源：${report.chart.source}\n四柱：${Object.values(report.chart.pillars).join(' ')}\n报告：${path.join(dir,'report.html')}`);
      for(const warning of report.warnings) console.error(`提示：${warning}`);
    } else console.log(JSON.stringify(report,null,2));
  }
} catch(error) { console.error(`${error.code??'BAZI_ERROR'}: ${error.message}`);process.exitCode=1; }
