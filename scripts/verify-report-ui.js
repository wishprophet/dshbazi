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
  const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true})).result.value;
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(report).href});
  for(let i=0;i<50;i++){if(await evaluate('document.readyState === "complete" && !!document.querySelector("#year option")'))break;await new Promise(r=>setTimeout(r,100));}
  const initial=await evaluate('({title:document.title,years:document.querySelectorAll("#year option").length,months:document.querySelectorAll("#months tr").length,candles:document.querySelectorAll("#trend [data-index]").length,selected:document.querySelector("#year").value})');
  assert.ok(initial.years>1);assert.equal(initial.months,12);assert.equal(initial.candles,initial.years);
  const shot=async name=>{const r=await call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(out,name),Buffer.from(r.data,'base64'));};
  await shot('desktop.png');
  const before=await evaluate('document.querySelector("#metrics").textContent');
  await evaluate('document.querySelector("#domain").value="wealth"; document.querySelector("#domain").dispatchEvent(new Event("change"))');
  assert.notEqual(await evaluate('document.querySelector("#metrics").textContent'),before);
  await evaluate('document.querySelector("#next").click()');
  assert.notEqual(await evaluate('document.querySelector("#year").value'),initial.selected);
  await evaluate('document.querySelector("#timeline").scrollIntoView()');await shot('timeline.png');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('window.scrollTo(0,0)');await shot('mobile.png');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth+1'),'mobile page must not overflow horizontally');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({pass:true,...initial,interaction:'domain and year switching passed',consoleErrors:errors,screenshots:out}));
} finally {ws?.close();edge.kill();}
