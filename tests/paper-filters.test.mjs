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

test('photo preview combines atlas tags and ignores paper-only section/material choices',async()=>{
 const {filterPaperPhotos,hasPhotoPaperFilters}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const photo={id:'match',title:'Water',caption:'',place:'River',lat:47.37,lng:8.54,url:'/sample',createdAt:1,tags};
 const f=emptyPaperFilters();f.material='tracing';f.group='messages';assert.equal(hasPhotoPaperFilters(f),false);
 f.tags={...tags,imageTypes:['reflections-water','light-scattering']};assert.equal(hasPhotoPaperFilters(f),true);
 assert.deepEqual(filterPaperPhotos([photo,{...photo,id:'wrong-area',tags:{...tags,area:'industrial'}},{...photo,id:'external',source:'https://example.test'}],f).map(p=>p.id),['match']);
 f.tags.weather=['windy'];assert.equal(filterPaperPhotos([photo],f).length,0);
});
test('photo preview uses saved weather/time and keeps untagged selections honest',async()=>{
 const {filterPaperPhotos}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const photo={id:'saved',title:'Morning',caption:'',place:'River',lat:47.37,lng:8.54,url:'/sample',createdAt:1,conditions:{capturedAt:Date.parse('2026-11-19T09:00:00Z'),sun:{elevation:15,azimuth:130},weather:{cloudCover:10,humidity:85,precipitation:0,windSpeed:2}}};
 const f=emptyPaperFilters();f.tags.weather=['humid'];f.tags.timeOfDay='morning';assert.equal(filterPaperPhotos([photo],f).length,1);
 f.tags=emptyPaperFilters().tags;f.untagged=true;assert.deepEqual(filterPaperPhotos([photo,{...photo,id:'tagged',tags}],f).map(p=>p.id),['saved']);
});
