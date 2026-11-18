import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
for(const file of ['src/plugin.js','src/service.js','src/calendar.js','src/providers/zydx.js','src/analysis.js','src/conclusions.js','src/marriage-conclusions.js','src/timeline.js','src/report.js','src/chart-layout.js','src/display-facts.js','src/relationships.js','src/chenggu.js','src/data/chenggu.js','src/cli.js','skills/bazi/SKILL.md','skills/bazi/references/interpretation.md','cordis.patch.yml','LICENSE','NOTICE','README.md']) await access(path.join(root,file));
if(pkg.dsh?.bundle?.patch!=='./cordis.patch.yml') throw new Error('Missing dsh bundle patch');
for(const file of ['CHANGELOG.md','docs/HANDOFF.md','docs/validation.md','docs/publishing.md','scripts/verify-dsh-rc1.js']) await access(path.join(root,file));
const screenshots=JSON.parse(await readFile(path.join(root,'screenshots.json'),'utf8'));
if(!Array.isArray(screenshots)||screenshots.length<1||screenshots.length>8) throw new Error('screenshots.json must list 1–8 images');
for(const file of screenshots){
  if(typeof file!=='string'||path.isAbsolute(file)||file.includes('..')||file.includes('\\')||!/^docs\/screenshots\/.+\.(png|jpe?g|webp)$/.test(file)) throw new Error('Invalid screenshot path');
  await access(path.join(root,file));
}
for(const file of ['assets/icon-180.png','assets/icon-512.png','scripts/capture-market-assets.js']) await access(path.join(root,file));
const plugin=await import('../src/plugin.js');
if(typeof plugin.apply!=='function') throw new Error('Plugin must export apply');
console.log(`Package verified: ${pkg.name}@${pkg.version}`);
