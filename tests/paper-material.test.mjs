// node --experimental-strip-types --test tests/paper-material.test.mjs
// The real create handler runs against isolated storage; no live database is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
import {toPaper} from '../lib/papers.ts';
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const server=moduleUrl(`export const createClient=async()=>globalThis.paperFixture.db; export const getSessionUser=async()=>globalThis.paperFixture.user; export const isCrossOrigin=()=>false;`);
const source=await readFile(new URL('../app/api/papers/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {POST}=await import(moduleUrl(js.replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/papers',new URL('../lib/papers.ts',import.meta.url).href)));
const row={id:'paper',title:'Notes',author_name:'Architect',owner:'owner',shared:true,x:30,y:40,created_at:'2026-11-17T10:00:00Z'};
function fixture(error=null){
 const inserts=[];
 globalThis.paperFixture={user:{id:'owner',name:'Architect'},db:{from:()=>({insert(value){inserts.push(value);return {select:()=>({single:async()=>({data:error?null:{...row,...value},error})})}}})}};
 return inserts;
}
const request=body=>new Request('http://localhost/api/papers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Notes',shared:true,x:30,y:40,...body})});
test('existing papers retain their content, position and opaque appearance',()=>{
 const p=toPaper(row,'owner');assert.equal(p.material,'opaque');assert.equal(p.title,row.title);assert.equal(p.x,row.x);assert.equal(p.y,row.y);
});
test('ordinary paper works before the new database column is installed',async()=>{
 const inserts=fixture();const r=await POST(request({material:'opaque'}));assert.equal(r.status,201);assert.equal(Object.hasOwn(inserts[0],'material'),false);assert.equal((await r.json()).paper.material,'opaque');
});
test('tracing material is stored on the new paper, with ownership taken from the session',async()=>{
 const inserts=fixture();const r=await POST(request({material:'tracing',owner:'someone-else'}));assert.equal(r.status,201);assert.equal(inserts[0].material,'tracing');assert.equal(inserts[0].owner,'owner');assert.equal((await r.json()).paper.material,'tracing');
});
test('invalid material is rejected before writing, and unavailable tracing storage is explained',async()=>{
 let inserts=fixture();assert.equal((await POST(request({material:'glass'}))).status,400);assert.equal(inserts.length,0);
 fixture({code:'PGRST204'});const r=await POST(request({material:'tracing'}));assert.equal(r.status,503);assert.match((await r.json()).error,/Tracing paper is not set up yet/);
});
