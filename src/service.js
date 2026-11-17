import { normalizeInput, calculateChart, InputError } from './calendar.js';
import { fetchZydx } from './providers/zydx.js';
import { analyzeChart } from './analysis.js';
import { buildTimeline } from './timeline.js';

export { normalizeInput, calculateChart } from './calendar.js';
export async function createReading(raw, options = {}) {
  const input=normalizeInput(raw), provider=options.provider??raw.provider??'auto';
  if(!['auto','website','local'].includes(provider)) throw new InputError('provider须为auto、website或local');
  if(options.signal?.aborted) throw options.signal.reason ?? new Error('已取消');
  let website=null;
  const warnings=[];
  if(input.calendar!=='pillars' && provider!=='local') {
    try {
      website=await fetchZydx({...input,calendar:'solar',date:input.solarDate,time:input.solarTime,leapMonth:false},{fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs??15000,signal:options.signal});
    } catch(error) {
      if(options.signal?.aborted) throw options.signal.reason ?? error;
      if(provider==='website') throw error;
      warnings.push(`周易大学堂未能返回有效命盘，已采用本地排盘：${String(error.message).slice(0,300)}`);
    }
  }
  const chart=calculateChart(input,website);
  if(website) {
    warnings.push(...(website.notes??[]));
    if(!chart.validation.pillarsMatch) warnings.push('网站四柱与本地校验存在差异。本报告采用网站四柱，请核对交节或换日边界；校验详情保留两套结果。');
    if(chart.validation.websiteStartDate && chart.validation.websiteStartDate!==chart.validation.localStartDate) warnings.push(`交运日采用网站结果 ${chart.validation.websiteStartDate}；本地分钟算法为 ${chart.validation.localStartDate}，两种起运口径存在差异。`);
    if(!website.startLuck?.date) warnings.push('网站未返回可解析的交运日，大运暂采用本地分钟算法。');
  } else if(input.calendar!=='pillars') warnings.push('本次采用本地历法库；起运日期可能与网站口径不同。');
  if(!chart.luck.available) warnings.push(chart.luck.reason);
  if(input.calendar==='pillars' && input.birthYear && !input.solarDate) warnings.push('四柱导入仅有出生公历年，年龄按虚岁年度展示，不推定生日；起运前区间起点仅用于年份定位。');
  const analysis=analyzeChart(chart,input);
  const timeline=buildTimeline(chart,input);
  return {schemaVersion:'1.0.0',input,chart,analysis,timeline,warnings,provenance:{plugin:'dsh-bazi',version:'0.1.0',calendarLibrary:'lunar-javascript@1.7.8',requestedProvider:provider,actualProvider:chart.source,website:website?{url:website.url,fetchedAt:website.fetchedAt,save:false,cycles:website.cycles??[],rawText:website.rawText}:null,interpretation:'传统规则启发式，不是统计预测概率；姓名不参与评分。'}};
}
