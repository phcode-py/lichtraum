import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
async function load(path){const source=await readFile(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(moduleURL(js.replaceAll('./walks',new URL('../lib/walks.ts',import.meta.url).href).replaceAll('./gallery',new URL('../lib/gallery.ts',import.meta.url).href)))}
const {sequenceWalkPhotos}=await load('../lib/walk-filmstrip.ts');
const {parseTracing,tracingSVG}=await load('../lib/photo-tracing.ts');
test('filmstrips use newest capture time ahead of route position and upload time',()=>{
 const walk={path:[[8.5,47.37,0,0],[8.51,47.37,0,0],[8.52,47.37,0,0]]};
 const photos=[{id:'last',lat:47.37,lng:8.519,createdAt:300,conditions:{capturedAt:10}},{id:'first',lat:47.37,lng:8.501,createdAt:100,conditions:{capturedAt:20}},{id:'middle',lat:47.37,lng:8.51,createdAt:200,conditions:{capturedAt:30}}];
 const before=structuredClone(photos),sequence=sequenceWalkPhotos(walk,photos);
 assert.deepEqual(sequence.map(x=>x.photo.id),['middle','first','last']);assert.ok(sequence[0].distance>sequence[1].distance);assert.ok(sequence[0].distance<sequence[2].distance);assert.deepEqual(photos,before);
});
test('walks without routes use capture time and pauses do not invent connecting distances',()=>{
 const photos=[{id:'a',lat:47.37,lng:8.5,createdAt:1,conditions:{capturedAt:20}},{id:'b',lat:47.37,lng:8.51,createdAt:2,conditions:{capturedAt:10}}];
 assert.deepEqual(sequenceWalkPhotos({path:[]},photos).map(x=>x.photo.id),['a','b']);
 const paused={path:[[8.5,47.37,0,0],[8.51,47.37,0,0],[9,48,0,1],[9.001,48,0,1]]};
 const sequence=sequenceWalkPhotos(paused,[{id:'end',lat:48,lng:9.001,createdAt:0}]);assert.ok(sequence[0].distance<1000);
});
test('tracing geometry is copied, bounded and stripped of supplied markup',()=>{
 const input=[{points:[[0,0],[.5,.25],[1,1]],svg:'<script>bad()</script>'}],parsed=parseTracing(input);
 assert.deepEqual(parsed,[{points:[[0,0],[.5,.25],[1,1]]}]);parsed[0].points[0][0]=.2;assert.equal(input[0].points[0][0],0);
 for(const bad of [[{points:[[2,0]]}],[{points:[['<svg>',0]]}],[{points:[]}],'<svg/>',[{points:[[NaN,0]]}],Array.from({length:201},()=>({points:[[0,0]]})),[{points:Array.from({length:2501},()=>[0,0])}]])assert.equal(parseTracing(bad),null);
 assert.deepEqual(parseTracing([]),[]);const svg=tracingSVG(parseTracing(input),1.5);assert.ok(svg.includes('#2446e8'));assert.ok(!svg.includes('<script'));assert.ok(!svg.includes('<image'));assert.ok(svg.includes('preserveAspectRatio="none"'));
});
