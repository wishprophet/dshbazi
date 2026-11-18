// Reproducible marketplace screenshots of the actual fictional demo report.
// Windows Edge is required. This creates an isolated profile and only visits local files.
// Run npm run demo first, then node scripts/capture-market-assets.js.
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const report=path.resolve(process.argv[2]||'reports/example/report.html');
const out=path.resolve('docs/screenshots');
const temporary=path.resolve('reports/market-capture');
await mkdir(out,{recursive:true});await mkdir(temporary,{recursive:true});
const profile=await mkdtemp(path.join(temporary,'edge-'));
const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',[
  '--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank',
],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws;
try{
  const endpoint=await new Promise((resolve,reject)=>{
    let buffer='';const timer=setTimeout(()=>reject(new Error('Edge startup timeout')),20000);
    edge.on('error',error=>{clearTimeout(timer);reject(error);});
    edge.stderr.on('data',data=>{buffer+=data;const found=/DevTools listening on (ws:\/\/[^\s]+)/.exec(buffer);if(found){clearTimeout(timer);resolve(found[1]);}});
  });
  const target=await fetch(`http://${new URL(endpoint).host}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let serial=0;const pending=new Map(),errors=[];
  ws.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
    if(message.id){const p=pending.get(message.id);if(p){pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(new Error(JSON.stringify(message.error))):p.resolve(message.result);}}
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(new Error(`CDP timeout ${method}`));},10000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const navigate=async file=>{
    await call('Page.navigate',{url:pathToFileURL(file).href});
    for(let i=0;i<100;i++){if(await evaluate('document.readyState==="complete"'))break;await new Promise(resolve=>setTimeout(resolve,50));}
    await evaluate('document.fonts.ready.then(()=>true)');
  };
  const capture=async(file,clip)=>{
    const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...clip,scale:1}});
    await writeFile(file,Buffer.from(image.data,'base64'));
  };
  const rect=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,bottom:r.bottom+scrollY};})()`);
  const section=async(name,from,to=from,topPadding=24,bottomPadding=24)=>{
    const first=await rect(from),last=await rect(to);
    await capture(path.join(out,name),{x:80,y:Math.max(0,Math.floor(first.y-topPadding)),width:1280,height:Math.ceil(last.bottom-first.y+topPadding+bottomPadding)});
  };
  await call('Runtime.enable');await call('Page.enable');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await navigate(report);
  assert.ok(await evaluate('!!document.querySelector("#year option")'),'Report has not finished rendering');
  await evaluate('document.documentElement.style.scrollBehavior="auto"');
  await section('01-natal-chart.png','#chart > .section-title','#chart .facts',24,16);
  await evaluate('document.querySelector("#chart-year").value="2028";document.querySelector("#chart-year").dispatchEvent(new Event("change"))');
  await evaluate('document.querySelector("#chart-day").value="2028-04-15";document.querySelector("#chart-day").dispatchEvent(new Event("change"))');
  await section('02-luck-explorer.png','.explorer','.explorer',16,24);
  await section('03-overview-dimensions.png','#reading','#dimensions');
  await evaluate('document.querySelector("#year").value="2026";document.querySelector("#year").dispatchEvent(new Event("change"))');
  await section('04-life-trend.png','#timeline');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await evaluate('window.scrollTo({top:0,behavior:"instant"})');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Mobile overflow');
  const mobileEnd=await rect('#chenggu');
  await capture(path.join(out,'05-mobile.png'),{x:0,y:0,width:390,height:Math.ceil(mobileEnd.bottom+8)});
  assert.deepEqual(errors,[]);

  await call('Emulation.setDeviceMetricsOverride',{width:512,height:512,deviceScaleFactor:1,mobile:false});
  await navigate(path.resolve('assets/icon.html'));
  await capture(path.resolve('assets/icon-512.png'),{x:0,y:0,width:512,height:512});
  // The icon source is vector/text HTML; render at the desired pixel density, without raster resizing.
  await call('Emulation.setDeviceMetricsOverride',{width:512,height:512,deviceScaleFactor:180/512,mobile:false});
  await capture(path.resolve('assets/icon-180.png'),{x:0,y:0,width:512,height:512});
  console.log(JSON.stringify({pass:true,source:report,screenshots:out,icon:'assets/icon-180.png',consoleErrors:errors},null,2));
}finally{ws?.close();edge.kill();}
