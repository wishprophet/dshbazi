// Optional native-host check; install the validation dependencies separately (see HANDOFF.md).
// Usage: node scripts/verify-dsh-rc1.js [host-dependency-directory] [installed-plugin-directory]
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const hostDir=path.resolve(process.argv[2]||'reports/rc1-check');
const root=path.resolve(process.argv[3]||'reports/install-check/node_modules/dsh-bazi');
const resolveHost=createRequire(path.join(hostDir,'package.json'));
const hostImport=name=>import(pathToFileURL(resolveHost.resolve(name)).href);
const {Context}=await hostImport('@deepseek-ai/cordis');
const {default:Tools,assertObjectJsonSchema,validateJsonSchemaValue}=await hostImport('@deepseek-ai/dsh-tools');
const {default:Skills}=await hostImport('@deepseek-ai/dsh-skill');
const {default:Prompt}=await hostImport('@deepseek-ai/dsh-system-prompt');
const {evaluatePluginCompatibility,loadOverlayPatches,composeEntries,getDshRuntimeVersion}=await hostImport('@deepseek-ai/dsh-app-boot');
const bazi=await import(pathToFileURL(path.join(root,'src/plugin.js')).href);
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const runtime=getDshRuntimeVersion();
assert.equal(runtime,'0.2.2-rc.1');
assert.equal(pkg.engines.dsh,'>=0.2.2-rc.1 <0.3.0-0');
assert.equal(evaluatePluginCompatibility(pkg,{},runtime),undefined);
const oldManifest={...pkg,engines:{...pkg.engines,dsh:'>=0.2.2-rc.3 <0.3.0'}};
assert.equal(evaluatePluginCompatibility(oldManifest,{},runtime).requirements['engines.dsh'],oldManifest.engines.dsh);
assert.equal(evaluatePluginCompatibility(pkg,{},'0.2.2-rc.3'),undefined);
assert.ok(evaluatePluginCompatibility(pkg,{},'0.3.0-rc.1'));
const patches=loadOverlayPatches('dsh',path.join(root,'cordis.patch.yml'));
assert.deepEqual(composeEntries([patches]),[{id:'bazi',name:'dsh-bazi'}]);

const ctx=new Context(),fibers=[];
try{
  for(const plugin of [Prompt,Tools,Skills,bazi]){
    const fiber=ctx.plugin(plugin);fibers.push(fiber);await fiber.await();assert.equal(fiber.state,2);
  }
  const names=ctx.tools.definitions().map(t=>t.name);
  assert.deepEqual(names,['bazi_reading','bazi_report','bazi_years']);
  for(const definition of ctx.tools.definitions())assertObjectJsonSchema(definition.parameters);
  const skill=await ctx.skills.get('bazi');
  assert.equal(skill.resourceBase.kind,'directory');
  await access(path.join(skill.resourceBase.path,'references','interpretation.md'));
  assert.ok(skill.content.includes('analysis.overview'));
  const run=async(name,args)=>{
    const definition=ctx.tools.get(name);
    const value=await definition.execute(args,{signal:new AbortController().signal});
    assert.deepEqual(validateJsonSchemaValue(definition.output.schema,value,'value'),[]);
    assert.deepEqual(JSON.parse(JSON.stringify(value)),value);
    const content=definition.output.render(args,value);
    assert.ok(content.length&&content.every(c=>c.type==='text'));
    return value;
  };
  const reading=await run('bazi_reading',{calendar:'solar',gender:'male',date:'2000-01-01',time:'12:34',startYear:2026,endYear:2028,provider:'local'});
  assert.equal(reading.analysis.dimensions.length,12);
  assert.equal(reading.analysis.overview.marriage.windows[0].startYear,2031);
  assert.equal(reading.analysis.summary,reading.analysis.overview.summary);
  const years=await run('bazi_years',{reportId:reading.reportId,startYear:2026,endYear:2028});
  assert.equal(years.years.length,3);
  const html=await run('bazi_report',{reportId:reading.reportId,format:'html'});
  assert.ok(html.includes('八字分析')&&html.includes('gan-zhi-stack'));
  assert.ok(html.includes('约32岁（2031年）'));
  const fiber=fibers.pop();await fiber.dispose();
  assert.deepEqual(ctx.tools.definitions(),[]);
  assert.equal(await ctx.skills.get('bazi'),undefined);
  console.log(JSON.stringify({pass:true,runtime,node:process.version,package:pkg.name,packageVersion:pkg.version,actualRange:pkg.engines.dsh,oldRangeRejected:true,patchComposition:composeEntries([patches]),tools:names,skill:'bazi',concreteOverview:true,toolOutputSchemaAndJson:true,registeredToolsExecuted:true,unloadRemovedRegistrations:true,scope:'Official rc.1 Cordis, tools, skills and app-boot in isolated workspace; not user live profile or full DSH CLI.'},null,2));
}finally{
  for(const fiber of fibers.reverse())await fiber.dispose();
}
