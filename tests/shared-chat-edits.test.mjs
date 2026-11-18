import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
let fixture;
const server=moduleURL('export const createClient=async()=>globalThis.chatEditTest.db;export const getSessionUser=async()=>globalThis.chatEditTest.user;export const isCrossOrigin=r=>r.headers.get("origin")&&r.headers.get("origin")!==new URL(r.url).origin;');
const refs=moduleURL('export const noteMessages=async(db,rows)=>rows;export const validReferenceKey=()=>false;export const referenceExists=async()=>false;export const REFERENCE_ONLY_CONTENT="Reference";');
let source=ts.transpileModule(await readFile(new URL('../app/api/community/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
for(const [name,url] of [['@/lib/supabase/server',server],['@/lib/paper-references',refs],['@/lib/paper-entry-edits',new URL('../lib/paper-entry-edits.ts',import.meta.url).href],['@/lib/paper-history',new URL('../lib/paper-history.ts',import.meta.url).href]])source=source.replaceAll(name,url);
const {PATCH}=await import(moduleURL(source));
const request=(entries,origin)=>new Request('http://local/api/community',{method:'PATCH',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({entries})});
test('shared chat edits and soft removals go through the authenticated atomic RPC with authorship preserved',async()=>{
 const calls=[];globalThis.chatEditTest={user:{id:'lena'},db:{rpc:async(name,args)=>{calls.push({name,args});return {data:args.changes.map(change=>({id:change.entryId,owner:'mona',content:change.content,deleted_at:change.delete?'2026-11-18T10:00:00Z':null})),error:null}}}};
 const response=await PATCH(request([{entryId:'first',content:'Revised'},{entryId:'second',delete:true}]));assert.equal(response.status,200);
 const result=await response.json();assert.deepEqual(result.deletedEntryIds,['second']);assert.equal(result.messages[0].owner,'mona');assert.equal(result.messages.length,1);assert.equal(calls[0].name,'edit_room_entries');
 assert.equal((await PATCH(request([{entryId:'x',delete:true}],'http://elsewhere'))).status,403);
 globalThis.chatEditTest.user=null;assert.equal((await PATCH(request([{entryId:'x',delete:true}]))).status,401);assert.equal(calls.length,1);
});
test('missing database setup keeps edits unsaved with an explicit setup error',async()=>{
 globalThis.chatEditTest={user:{id:'lena'},db:{rpc:async()=>({data:null,error:{code:'PGRST202'}})}};
 const response=await PATCH(request([{entryId:'first',delete:true}]));assert.equal(response.status,503);assert.match((await response.json()).error,/one-time database setup/);
});
