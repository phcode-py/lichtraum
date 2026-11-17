// Real route handlers, isolated in-memory storage; never connects to the live backend.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const server=moduleUrl(`export const createClient=async()=>globalThis.paperEditFixture.db;export const getSessionUser=async()=>globalThis.paperEditFixture.user;export const isCrossOrigin=r=>!!r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin;`);
async function route(path){const source=await readFile(new URL(path,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;return import(moduleUrl(js.replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/papers',new URL('../lib/papers.ts',import.meta.url).href).replaceAll('@/lib/paper-entry-edits',new URL('../lib/paper-entry-edits.ts',import.meta.url).href).replaceAll('@/lib/paper-references',new URL('../lib/paper-references.ts',import.meta.url).href)));}
const paperApi=await route('../app/api/papers/[id]/route.ts');
const entryApi=await route('../app/api/papers/[id]/entries/route.ts');
const roomApi=await route('../app/api/community/route.ts');
const settingsApi=await route('../app/api/papers/settings/route.ts');
function fixture(){
 const rows={correspondence_papers:[{id:'paper',owner:'owner',title:'Published',author_name:'Architect',shared:true,material:'opaque',x:100,y:200,created_at:'2026-11-17T10:00:00Z'}],correspondence_entries:[{id:'entry',paper_id:'paper',owner:'owner',content:'Original note',author_name:'Architect',created_at:'2026-11-17T10:01:00Z'}],messages:[{id:'room-note',owner:'owner',content:'Original room note',author_name:'Architect',created_at:'2026-11-17T10:02:00Z'}],correspondence_sheet_settings:[]};
 const writes=[],rpcs=[];
 class Query{
  constructor(table){this.table=table;this.filters=[];}
  select(){return this;}
  eq(key,value){this.filters.push(row=>row[key]===value);return this;}
  update(value){this.value=value;return this;}
  upsert(value){this.newValue=value;return this;}
  insert(value){this.newValue={id:"new-entry",created_at:"2026-11-17T14:00:00Z",...value};return this;}
  async maybeSingle(){let row=rows[this.table].find(r=>this.filters.every(f=>f(r)));if(this.table==='correspondence_papers'&&row&&!row.shared&&row.owner!==globalThis.paperEditFixture.user?.id)row=undefined;if(this.newValue){row={...this.newValue};rows[this.table].push(row);writes.push(this.newValue)}else if(row&&this.value){Object.assign(row,this.value);writes.push(this.value)}return {data:row?structuredClone(row):null,error:null};}
  single(){return this.maybeSingle();}
 }
 const state={user:{id:'owner',name:'Architect'},db:{storage:{from:()=>({info:async()=>({data:{size:100,contentType:"image/png"},error:null}),createSignedUrls:async keys=>({data:keys.map(path=>({path,signedUrl:"https://preview.invalid/"+path}))})})},from:table=>new Query(table),rpc(name,args){rpcs.push(args);return {maybeSingle:async()=>{assert.ok(['edit_correspondence_paper','edit_working_note'].includes(name));const r=rows.correspondence_papers[0];Object.assign(r,{title:args.paper_title,material:args.paper_material,shared:args.paper_shared,...(args.paper_category?{category:args.paper_category}:{})});return {data:structuredClone(r),error:null}}}}}};
 globalThis.paperEditFixture=state;return {rows,writes,rpcs,state};
}
const request=(body,origin)=>new Request('http://localhost/api/papers/paper',{method:'PATCH',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const params={params:Promise.resolve({id:'paper'})};
const details={title:'Revisited',material:'tracing',shared:true};
test('published paper settings can change without moving the paper or changing its author',async()=>{
 const f=fixture();const r=await paperApi.PATCH(request(details),params);assert.equal(r.status,200);const {paper}=await r.json();assert.equal(paper.title,'Revisited');assert.equal(paper.material,'tracing');assert.equal(paper.x,100);assert.equal(paper.y,200);assert.equal(paper.author,'Architect');assert.equal(f.writes.length,0);assert.equal(f.rpcs.length,1);
});
test('shared-paper participants can edit appearance but cannot change someone else’s privacy',async()=>{
 const f=fixture();f.state.user.id='partner';assert.equal((await paperApi.PATCH(request({...details,shared:false}),params)).status,403);assert.equal(f.rpcs.length,0);assert.equal((await paperApi.PATCH(request(details),params)).status,200);
});
test('invalid metadata, mixed move/edit requests and cross-site requests never write',async()=>{
 const f=fixture();for(const body of [{...details,title:''},{...details,material:'glass'},{...details,x:20,y:30}])assert.equal((await paperApi.PATCH(request(body),params)).status,400);assert.equal((await paperApi.PATCH(request(details,'https://another.example'),params)).status,403);assert.equal(f.writes.length+f.rpcs.length,0);
});
test('sticker movement remains a separate position-only update',async()=>{
 const f=fixture();assert.equal((await paperApi.PATCH(request({x:150,y:250}),params)).status,200);assert.deepEqual(f.writes,[{x:150,y:250}]);assert.equal(f.rows.correspondence_papers[0].title,'Published');assert.equal(f.rpcs.length,0);
});
test('entry edits keep authorship, timestamps and other notes intact',async()=>{
 const f=fixture(),before=structuredClone(f.rows.correspondence_entries[0]);const r=await entryApi.PATCH(request({entryId:'entry',content:'Corrected note'}),params);assert.equal(r.status,200);assert.deepEqual(f.rows.correspondence_entries[0],{...before,content:'Corrected note'});assert.equal(f.rows.messages[0].content,'Original room note');
});
test('neither room notes nor paper entries can be rewritten by another author',async()=>{
 const f=fixture();f.state.user.id='partner';assert.equal((await entryApi.PATCH(request({entryId:'entry',content:'Changed'}),params)).status,404);assert.equal((await roomApi.PATCH(request({entryId:'room-note',content:'Changed'}))).status,404);assert.equal(f.writes.length,0);
});
test('built-in sheets accept appearance settings without replacing their content',async()=>{
 const f=fixture(),before=structuredClone(f.rows.messages);const r=await settingsApi.PATCH(request({id:'room',title:'Our room',material:'tracing'}));assert.equal(r.status,200);assert.deepEqual(f.rows.messages,before);assert.equal((await r.json()).settings.title,'Our room');assert.equal((await settingsApi.PATCH(request({id:'other',title:'Title',material:'opaque'}))).status,400);
});
test('signed-out edits are refused before touching data',async()=>{
 const f=fixture();f.state.user=null;assert.equal((await paperApi.PATCH(request(details),params)).status,401);assert.equal((await entryApi.PATCH(request({entryId:'entry',content:'Changed'}),params)).status,401);assert.equal((await settingsApi.PATCH(request({id:'room',title:'Title',material:'opaque'}))).status,401);assert.equal(f.writes.length+f.rpcs.length,0);
});

test('image-only paper references require an owned upload and return a signed image',async()=>{
 const f=fixture(),key='owner/12345678-1234-1234-1234-123456789abc';
 assert.equal((await entryApi.POST(request({imageKey:key.replace('owner/','partner/')}),params)).status,400);
 assert.equal(f.writes.length,0);
 const r=await entryApi.POST(request({imageKey:key,imageName:'IMG_1234'}),params);assert.equal(r.status,201);
 const {message}=await r.json();assert.equal(message.content,'[paper-reference:v1]');assert.equal(message.hasImage,true);assert.equal(message.imageUrl,'https://preview.invalid/'+key);
 assert.equal(f.rows.correspondence_entries.at(-1).image_key,key);
});
test('editing an image caption retains its original attachment',async()=>{
 const f=fixture(),key='owner/12345678-1234-1234-1234-123456789abc';f.rows.correspondence_entries[0].image_key=key;
 const r=await entryApi.PATCH(request({entryId:'entry',content:'New caption'}),params);assert.equal(r.status,200);
 assert.equal(f.rows.correspondence_entries[0].image_key,key);assert.equal((await r.json()).message.hasImage,true);
});

test('paper sections persist through metadata edits and invalid categories do not write',async()=>{
 const f=fixture();const r=await paperApi.PATCH(request({...details,category:'references'}),params);
 assert.equal(r.status,200);assert.equal((await r.json()).paper.category,'references');assert.equal(f.rpcs[0].paper_category,'references');
 assert.equal((await paperApi.PATCH(request({...details,category:'other'}),params)).status,400);
 assert.equal((await paperApi.PATCH(request({x:20,y:30,category:'messages'}),params)).status,400);assert.equal(f.rpcs.length,1);
});

test('paper removal requires confirmation, sign-in, ownership and a normal paper',async()=>{
 const f=fixture(),calls=[];f.state.db.rpc=async(name,args)=>{calls.push({name,args});return {data:true,error:null}};
 const send=(body,origin,routeParams=params)=>paperApi.DELETE(request(body,origin),routeParams);
 assert.equal((await send({})).status,400);
 assert.equal((await send({confirmed:true},'https://another.example')).status,403);
 assert.equal((await send({confirmed:true},undefined,{params:Promise.resolve({id:'room'})})).status,403);
 f.state.user.id='partner';assert.equal((await send({confirmed:true})).status,403);
 f.state.user=null;assert.equal((await send({confirmed:true})).status,401);assert.equal(calls.length,0);
 f.state.user={id:'owner',name:'Architect'};const before=structuredClone(f.rows);
 assert.equal((await send({confirmed:true})).status,200);
 assert.deepEqual(calls,[{name:'archive_correspondence_paper',args:{paper_id:'paper'}}]);
 assert.deepEqual(f.rows,before); // Handler never deletes notes, files or other records directly.
});
test('removal setup errors leave the paper in place and explain the missing setup',async()=>{
 const f=fixture();f.state.db.rpc=async()=>({data:null,error:{code:'PGRST202'}});
 const response=await paperApi.DELETE(request({confirmed:true}),params);
 assert.equal(response.status,503);assert.match((await response.json()).error,/database setup/);assert.equal(f.rows.correspondence_papers.length,1);
});

test('a shared-paper batch edits all authors entries and can detach a reference without deleting its file',async()=>{
 const f=fixture();f.state.user.id='partner';let call;
 f.rows.correspondence_entries[0].image_key='owner/12345678-1234-1234-1234-123456789abc';
 f.state.db.rpc=async(name,args)=>{call={name,args};const entry=f.rows.correspondence_entries[0];Object.assign(entry,{content:args.changes[0].content,image_key:null});return {data:[entry],error:null}};
 const r=await entryApi.PATCH(request({entries:[{entryId:'entry',content:'Revised together',imageKey:null}]}),params);
 assert.equal(r.status,200);assert.equal(call.name,'edit_paper_entries');assert.equal(call.args.target_paper,'paper');
 const {messages}=await r.json();assert.equal(messages[0].author,'Architect');assert.equal(f.rows.correspondence_entries[0].owner,'owner');assert.equal(f.rows.correspondence_entries[0].created_at,'2026-11-17T10:01:00Z');assert.equal(messages[0].hasImage,undefined);
});
test('batch editing rejects inaccessible papers, duplicate entries and another person’s uploaded replacement',async()=>{
 const f=fixture();let called=0;f.state.db.rpc=async()=>{called++;return {data:[],error:null}};
 assert.equal((await entryApi.PATCH(request({entries:[{entryId:'entry',content:'A'},{entryId:'entry',content:'B'}]}),params)).status,400);
 assert.equal((await entryApi.PATCH(request({entries:[{entryId:'entry',content:'A',imageKey:'other/12345678-1234-1234-1234-123456789abc'}]}),params)).status,400);
 f.rows.correspondence_papers[0].shared=false;f.state.user.id='partner';
 assert.equal((await entryApi.PATCH(request({entries:[{entryId:'entry',content:'A'}]}),params)).status,404);assert.equal(called,0);
});
test('chat batch retains original authors and missing setup leaves edits untouched',async()=>{
 const f=fixture(),before=structuredClone(f.rows.messages);f.state.db.rpc=async()=>({data:null,error:{code:'PGRST202'}});
 const response=await roomApi.PATCH(request({entries:[{entryId:'room-note',content:'New words'}]}));assert.equal(response.status,503);assert.match((await response.json()).error,/database setup/);assert.deepEqual(f.rows.messages,before);
});

test('replacement files come from the editor’s own folder while original authorship stays intact',async()=>{
 const f=fixture();f.state.user.id='partner';const key='partner/12345678-1234-1234-1234-123456789abc';let sent;
 f.state.db.rpc=async(name,args)=>{sent=args.changes[0];return {data:[{...f.rows.correspondence_entries[0],image_key:key,content:sent.content}],error:null}};
 const response=await entryApi.PATCH(request({entries:[{entryId:'entry',content:'A new reference',imageKey:key}]}),params);
 assert.equal(response.status,200);assert.equal(sent.imageKey,key);const {messages}=await response.json();assert.equal(messages[0].author,'Architect');assert.equal(messages[0].authorId,'owner');assert.equal(messages[0].hasImage,true);
});

test('removing an entry returns its ID while retaining the original note and reference in storage',async()=>{
 const f=fixture(),original=structuredClone(f.rows.correspondence_entries[0]);let payload;
 f.state.db.rpc=async(name,args)=>{payload=args.changes[0];const row=f.rows.correspondence_entries[0];row.deleted_at='2026-11-18T00:00:00Z';return {data:[row],error:null}};
 const r=await entryApi.PATCH(request({entries:[{entryId:'entry',delete:true}]}),params);
 assert.equal(r.status,200);const result=await r.json();assert.deepEqual(result.deletedEntryIds,['entry']);assert.deepEqual(result.messages,[]);assert.equal(payload.delete,true);
 assert.equal(f.rows.correspondence_entries[0].content,original.content);assert.equal(f.rows.correspondence_entries[0].owner,original.owner);assert.equal(f.rows.correspondence_entries.length,1);
});
