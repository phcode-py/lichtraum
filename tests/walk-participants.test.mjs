import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
import {parseParticipantIds,withWalkParticipants} from '../lib/walk-participants.ts';
const moduleUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const server=moduleUrl('export const createClient=async()=>globalThis.walkPeopleFixture.db;export const getSessionUser=async()=>globalThis.walkPeopleFixture.user;export const isCrossOrigin=r=>!!r.headers.get("origin")&&r.headers.get("origin")!==new URL(r.url).origin;');
const helper=new URL('../lib/walk-participants.ts',import.meta.url).href;
async function handler(path){let code=ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;const routeCode=ts.transpileModule(await readFile(new URL('../lib/walk-route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('./walks',new URL('../lib/walks.ts',import.meta.url).href);code=code.replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/walk-participants',helper).replaceAll('@/lib/walks',new URL('../lib/walks.ts',import.meta.url).href).replaceAll('@/lib/walk-details',new URL('../lib/walk-details.ts',import.meta.url).href).replaceAll('@/lib/walk-route',moduleUrl(routeCode));return import(moduleUrl(code))}
const {PUT,GET}=await handler('../app/api/walks/[id]/participants/route.ts');
const {PATCH,DELETE}=await handler('../app/api/walks/[id]/route.ts');
const owner='00000000-0000-4000-8000-000000000001',partner='00000000-0000-4000-8000-000000000002',ctx={params:Promise.resolve({id:'walk'})};
function fixture({user=owner,member=false,missing=false}={}){
 const calls=[];globalThis.walkPeopleFixture={user:user?{id:user,name:'Person'}:null,db:{from(table){return {select(){return this},eq(key,value){if(key==='owner')this.ownerFilter=value;return this},maybeSingle:async function(){return {data:this.ownerFilter&&this.ownerFilter!==owner?null:{owner,author_name:'Creator',status:'ended'},error:null}}}},rpc(name,args){calls.push({name,args});if(name==='is_walk_participant')return Promise.resolve({data:member,error:null});if(name==='edit_joined_walk')return {maybeSingle:async()=>({data:{id:'walk',owner,author_name:'Creator',title:args.walk_title,description:args.walk_description,status:'ended',started_at:'2026-11-01T09:00:00Z',ended_at:'2026-11-01T10:00:00Z',path:[],distance_m:100,duration_s:600},error:null})};return Promise.resolve({data:[],error:missing?{code:'PGRST202'}:null})}}};return calls;
}
const request=(body,method='PUT',origin)=>new Request('http://localhost/api/walks/walk/participants',{method,headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
test('participant selection is bounded, UUID-only and deduplicated',()=>{assert.deepEqual(parseParticipantIds([partner,partner]),[partner]);assert.equal(parseParticipantIds(['arbitrary name']),null);assert.equal(parseParticipantIds(Array(21).fill(partner)),null)});
test('only creator can grant people access; sign-in, origin and ownership are checked before writes',async()=>{
 let calls=fixture({user:null});assert.equal((await PUT(request({people:[partner]}),ctx)).status,401);assert.equal(calls.length,0);
 calls=fixture();assert.equal((await PUT(request({people:[partner]},'PUT','https://other.test'),ctx)).status,403);assert.equal(calls.length,0);
 calls=fixture({user:partner,member:true});assert.equal((await PUT(request({people:[]}),ctx)).status,403);assert.equal(calls.length,0);
 calls=fixture();assert.equal((await PUT(request({people:[partner],names:['forged']}),ctx)).status,200);assert.deepEqual(calls,[{name:'set_walk_participants',args:{walk_id:'walk',people:[partner]}}]);
});
test('participants can edit details but cannot share, record, change routes or remove walks',async()=>{
 let calls=fixture({user:partner,member:true});assert.equal((await PATCH(request({title:'Together'},'PATCH'),ctx)).status,200);assert.equal(calls.at(-1).name,'edit_joined_walk');
 for(const body of [{shared:true},{status:'recording'},{route:[]},{points:[]}]){calls=fixture({user:partner,member:true});assert.equal((await PATCH(request(body,'PATCH'),ctx)).status,403);assert.equal(calls.some(c=>c.name==='edit_joined_walk'),false)}
 fixture({user:partner,member:true});assert.equal((await DELETE(request({},'DELETE'),ctx)).status,404);
 fixture({user:partner,member:false});assert.equal((await PATCH(request({title:'No access'},'PATCH'),ctx)).status,404);
});
test('participant capability enrichment degrades safely before setup',async()=>{
 const walks=[{id:'walk',mine:false}];assert.deepEqual(await withWalkParticipants({rpc:async()=>({error:{code:'PGRST202'}})},walks,partner),walks);
 const result=await withWalkParticipants({rpc:async()=>({data:[{walk_id:'walk',user_id:partner,name:'Partner'}],error:null})},walks,partner);assert.equal(result[0].canEdit,true);assert.equal(result[0].participating,true);
});
