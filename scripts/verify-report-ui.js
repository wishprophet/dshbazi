// Optional Windows visual/integration check. Requires installed Edge; no npm browser dependency.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const report=path.resolve(process.argv[2]||'reports/example/report.html');
const out=path.resolve('reports/ui-check');await mkdir(out,{recursive:true});
const profile=await mkdtemp(path.join(out,'edge-'));
const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;
try {
  const endpoint=await new Promise((resolve,reject)=>{let buffer='';const t=setTimeout(()=>reject(new Error('Edge startup timeout')),20000);edge.on('error',e=>{clearTimeout(t);reject(e);});edge.stderr.on('data',d=>{buffer+=d;const m=/DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);if(m){clearTimeout(t);resolve(m[1]);}});});
  const host=new URL(endpoint).host;
  const target=await fetch(`http://${host}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  let serial=0;const pending=new Map(),errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.t);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const t=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},10000);pending.set(id,{resolve,reject,t});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(report).href});
  for(let i=0;i<50;i++){if(await evaluate('document.readyState === "complete" && !!document.querySelector("#year option")'))break;await new Promise(r=>setTimeout(r,100));}
  await evaluate('document.documentElement.style.scrollBehavior="auto"');
  const initial=await evaluate('({title:document.title,years:document.querySelectorAll("#year option").length,months:document.querySelectorAll("#months tr").length,yearPoints:document.querySelectorAll("#trend [data-index]").length,lines:document.querySelectorAll("#trend .trend-line").length,selected:document.querySelector("#year").value})');
  assert.ok(initial.years>1);assert.equal(initial.months,12);assert.equal(initial.yearPoints,initial.years);assert.ok(initial.lines>0,'continuous yearly trend must be drawn');
  const vertical=await evaluate(`Array.from(document.querySelectorAll('.gan-zhi-stack')).map(stack=>{const chars=Array.from(stack.querySelectorAll('.gan-zhi-char'));return {count:chars.length,positions:chars.map(c=>{const r=c.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,element:c.dataset.element,color:getComputedStyle(c).color};})};})`);
  assert.equal(vertical.length,4);
  for(const pillar of vertical){assert.equal(pillar.count,2);assert.ok(pillar.positions[1].y>pillar.positions[0].y);assert.ok(Math.abs(pillar.positions[1].x-pillar.positions[0].x)<2);assert.ok(pillar.positions.every(p=>['木','火','土','金','水'].includes(p.element)));}
  const publicText=await evaluate('document.body.innerText');
  for(const text of ['口径与依据','需保留的条件','lunar-javascript','规则版本','真太阳时','不表示健康诊断或寿命','格局名称不等于社会阶层']) assert.equal(publicText.includes(text),false,`internal text exposed: ${text}`);
  const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(r.data,'base64'));};
  await shot('desktop.png');
  const before=await evaluate('document.querySelector("#metrics").textContent');
  await evaluate('document.querySelector("#domain").value="wealth"; document.querySelector("#domain").dispatchEvent(new Event("change"))');
  assert.notEqual(await evaluate('document.querySelector("#metrics").textContent'),before);
  await evaluate('document.querySelector("#next").click()');
  assert.notEqual(await evaluate('document.querySelector("#year").value'),initial.selected);
  await evaluate('document.querySelector("#timeline").scrollIntoView({behavior:"instant"})');await shot('timeline.png');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');await shot('mobile.png');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'mobile page must not overflow horizontally');
  await evaluate('document.querySelector("#timeline").scrollIntoView({behavior:"instant"})');await shot('mobile-timeline.png');
  assert.ok(await evaluate('document.querySelector(".chart-scroll").scrollWidth <= document.querySelector(".chart-scroll").clientWidth+1'),'mobile trend must show the complete range without horizontal scrolling');
  const firstYear=await evaluate('document.querySelectorAll("#trend [data-index]")[0].dataset.year');
  await evaluate('document.querySelectorAll("#trend [data-index]")[0].dispatchEvent(new MouseEvent("click",{bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("#year").value'),firstYear);
  await evaluate('document.querySelectorAll("#trend [data-index]")[0].dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}))');
  assert.equal(await evaluate('document.querySelector("#year").value'),await evaluate('document.querySelector("#year option:nth-child(2)").value'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,...initial,pillars:'vertical and element-colored',interaction:'domain and year switching passed',consoleErrors:errors,screenshots:out}));
} finally {ws?.close();edge.kill();}
