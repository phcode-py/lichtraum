import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const server=url('export const createClient=async()=>globalThis.paperTagsFixture.db;export const getSessionUser=async()=>globalThis.paperTagsFixture.user;export const isCrossOrigin=r=>!!r.headers.get("origin")&&r.headers.get("origin")!==new URL(r.url).origin;');
const source=await readFile(new URL('../app/api/papers/tags/route.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/gallery',new URL('../lib/gallery.ts',import.meta.url).href);
const {GET,PUT}=await import(url(js));
const id='11111111-2222-4333-8444-555555555555',tags={imageTypes:['reflections-water'],weather:[],timeOfDay:'',area:''};
function fixture({signedIn=true,visible=true,error=null,rows=[]}={}){
 const writes=[];globalThis.paperTagsFixture={user:signedIn?{id:'me'}:null,db:{from(table){assert.ok(['correspondence_papers','correspondence_paper_tags'].includes(table));return {select(){return this},eq(){return this},maybeSingle:async()=>({data:visible?{id}:null,error:null}),limit:async()=>({data:rows,error}),upsert:async value=>{writes.push({table,value});return {error}}}}}};return writes;
}
const request=(body,origin)=>new Request('http://localhost/api/papers/tags',{method:'PUT',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
test('signed-out, cross-origin and inaccessible-paper writes are rejected',async()=>{
 let writes=fixture({signedIn:false});assert.equal((await GET()).status,401);assert.equal((await PUT(request({paperId:id,tags}))).status,401);assert.equal(writes.length,0);
 writes=fixture();assert.equal((await PUT(request({paperId:id,tags},'https://elsewhere.test'))).status,403);assert.equal(writes.length,0);
 writes=fixture({visible:false});assert.equal((await PUT(request({paperId:id,tags}))).status,404);assert.equal(writes.length,0);
});
test('tags are validated and writes affect only new sheet metadata',async()=>{
 const writes=fixture();assert.equal((await PUT(request({paperId:id,tags:{...tags,imageTypes:['invented']}}))).status,400);assert.equal(writes.length,0);
 assert.equal((await PUT(request({paperId:id,tags:{...tags,owner:'other'},title:'overwrite'}))).status,200);
 assert.deepEqual(writes,[{table:'correspondence_paper_tags',value:{sheet_id:id,tags}}]);
 assert.equal((await PUT(request({paperId:'room',tags}))).status,200);
});
test('missing setup leaves existing papers readable and reports saving unavailable',async()=>{
 const writes=fixture({error:{code:'42P01'}});const result=await (await GET()).json();assert.equal(result.available,false);assert.deepEqual(result.tags,{});const response=await PUT(request({paperId:id,tags}));assert.equal(response.status,503);assert.match((await response.json()).error,/one-time database setup/);assert.equal(writes[0].table,'correspondence_paper_tags');
});
