import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const source=await readFile(new URL('../lib/paper-filters.ts',import.meta.url),'utf8');
let js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
for(const name of ['gallery','papers'])js=js.replaceAll(`./${name}`,new URL(`../lib/${name}.ts`,import.meta.url).href);
const {paperMatchesFilters:matches,emptyPaperFilters, paperFilterCount}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const paper={title:'Light study',category:'references',material:'tracing'};
const tags={imageTypes:['reflections-water'],weather:['clear'],timeOfDay:'morning',area:'waterfront'};
test('combined filters use any tag within a group and require every selected group',()=>{
 const f=emptyPaperFilters();f.group='references';f.material='tracing';f.tags.imageTypes=['light-scattering','reflections-water'];f.tags.weather=['clear','humid'];f.tags.area='waterfront';assert.equal(matches(paper,tags,f),true);
 f.tags.timeOfDay='night';assert.equal(matches(paper,tags,f),false);
 f.tags.timeOfDay='';f.material='opaque';assert.equal(matches(paper,tags,f),false);
});
test('older untagged sheets remain visible and ordinary material defaults correctly',()=>{
 const f=emptyPaperFilters();assert.equal(matches({title:'Old note'},undefined,f),true);f.material='opaque';f.untagged=true;assert.equal(matches({title:'Old note'},undefined,f),true);assert.equal(matches(paper,tags,f),false);
 f.material='all';f.untagged=false;f.tags.imageTypes=['reflections-water'];assert.equal(matches({title:'Old note'},undefined,f),false);assert.equal(paperFilterCount(f),1);
});
