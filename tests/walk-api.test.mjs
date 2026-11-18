// Exercise the real route handlers against isolated in-memory storage, never the live backend.
// node --experimental-strip-types --test tests/walk-api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const dataModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const server=dataModule(`export const createClient=async()=>globalThis.walkApiFixture.db; export const getSessionUser=async()=>globalThis.walkApiFixture.user; export const isCrossOrigin=r=>!!r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin;`);
const routeSource=ts.transpileModule(await readFile(new URL('../lib/walk-route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const routeModule=dataModule(routeSource.replaceAll('./walks',new URL('../lib/walks.ts',import.meta.url).href));
async function handler(path){
 const source=await readFile(new URL(path,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return import(dataModule(js.replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/walks',new URL('../lib/walks.ts',import.meta.url).href).replaceAll('@/lib/walk-route',routeModule).replaceAll('@/lib/walk-details',new URL('../lib/walk-details.ts',import.meta.url).href)));
}
const {POST}=await handler('../app/api/walks/route.ts');
const {PATCH}=await handler('../app/api/walks/[id]/route.ts');
const user={id:'owner',name:'Architect',email:'test@example.com'};
function fixture(){
 const route=[[8.54,47.37,1000,0],[8.55,47.38,1100,0]];
 const rows=[{id:'recording',owner:user.id,author_name:user.name,title:'Current walk',status:'recording',shared:false,started_at:'2026-11-10T10:00:00Z',ended_at:null,distance_m:0,duration_s:0,path:[]},{id:'finished',owner:user.id,author_name:user.name,title:'Recorded walk',status:'ended',shared:false,started_at:'2026-11-09T10:00:00Z',ended_at:'2026-11-09T11:00:00Z',distance_m:4000,duration_s:3000,path:route}];
 const writes=[];
 class Query{
  mode='read';filters=[];value=undefined;
  select(){return this;}
  eq(key,value){this.filters.push(row=>row[key]===value);return this;}
  neq(key,value){this.filters.push(row=>row[key]!==value);return this;}
  insert(value){this.mode='insert';this.value=value;return this;}
  update(value){this.mode='update';this.value=value;return this;}
  execute(){
   if(this.mode==='insert'){const row={id:'new',...this.value};writes.push({mode:this.mode,value:this.value});rows.push(row);return {data:structuredClone(row),error:null};}
   const matches=rows.filter(row=>this.filters.every(f=>f(row)));
   if(this.mode==='update'){writes.push({mode:this.mode,value:this.value});matches.forEach(row=>Object.assign(row,this.value));}
   return {data:matches[0]?structuredClone(matches[0]):null,error:null};
  }
  single(){return Promise.resolve(this.execute());}
  maybeSingle(){return Promise.resolve(this.execute());}
  then(resolve,reject){return Promise.resolve(this.execute()).then(resolve,reject);}
 }
 const db={from(table){assert.equal(table,'walks');return new Query();},rpc(){throw Error('Finished-walk editing must not append or replace GPS points.');}};
 globalThis.walkApiFixture={db,user};return {rows,writes};
}
const details={startedAt:'2026-11-08T12:00:00Z',endedAt:'2026-11-08T13:00:00Z',distance:4200,duration:2700};
const request=body=>new Request('http://localhost/api/walks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const edit=body=>PATCH(request(body),{params:Promise.resolve({id:'finished'})});
test('adding a past walk never closes a current recording',async()=>{
 const f=fixture(),before=structuredClone(f.rows);
 const r=await POST(request({kind:'past',title:'Sunday by the river',details,shared:true}));
 assert.equal(r.status,201);const {walk}=await r.json();
 assert.equal(walk.status,'ended');assert.equal(walk.shared,true);assert.equal(walk.duration,2700);assert.deepEqual(walk.path,[]);
 assert.deepEqual(f.rows.slice(0,2),before);assert.equal(f.writes.length,1);assert.equal(f.writes[0].mode,'insert');
});
test('editing finished details preserves the route and updates the requested date and totals',async()=>{
 const f=fixture(),path=structuredClone(f.rows[1].path),recording=structuredClone(f.rows[0]);
 const r=await edit({title:'Revisited river walk',details,shared:true,withPath:true});
 assert.equal(r.status,200);const {walk}=await r.json();
 assert.equal(walk.title,'Revisited river walk');assert.equal(walk.distance,4200);assert.equal(walk.duration,2700);assert.equal(walk.startedAt,Date.parse(details.startedAt));
 assert.deepEqual(walk.path,path);assert.deepEqual(f.rows[0],recording);assert.ok(!Object.hasOwn(f.writes[0].value,'path'));
});
test('invalid and future details produce no writes',async()=>{
 for(const bad of [{...details,duration:3601},{...details,endedAt:'2999-11-08T13:00:00Z'}]){
  const f=fixture();assert.equal((await POST(request({kind:'past',title:'Past walk',details:bad}))).status,400);assert.equal((await edit({details:bad})).status,400);assert.equal(f.writes.length,0);
 }
});
test('ownership and active-walk guards run before any mutation',async()=>{
 let f=fixture();f.rows[1].owner='someone-else';assert.equal((await edit({title:'Changed',details})).status,404);assert.equal(f.writes.length,0);
 f=fixture();const r=await PATCH(request({details}),{params:Promise.resolve({id:'recording'})});assert.equal(r.status,409);assert.equal(f.writes.length,0);
 f=fixture();globalThis.walkApiFixture.user=null;assert.equal((await POST(request({kind:'past',title:'Walk',details}))).status,401);assert.equal((await edit({details})).status,401);assert.equal(f.writes.length,0);
});
test('a title-only edit keeps exact recorded timestamps, totals and geometry',async()=>{
 const f=fixture(),before=structuredClone(f.rows[1]);assert.equal((await edit({title:'New name',shared:true,withPath:true})).status,200);
 assert.deepEqual(f.rows[1],{...before,title:'New name',shared:true});
});

test('walk descriptions save, clear and preserve all route data; invalid descriptions never write',async()=>{
 const f=fixture(),before=structuredClone(f.rows[1]);
 let response=await edit({description:'  From the station to the river.\nEvening light.  ',withPath:true});
 assert.equal(response.status,200);assert.equal((await response.json()).walk.description,'From the station to the river.\nEvening light.');
 assert.deepEqual(f.rows[1],{...before,description:'From the station to the river.\nEvening light.'});
 response=await edit({description:''});assert.equal(response.status,200);assert.equal((await response.json()).walk.description,'');
 for(const description of ['x'.repeat(2001),null,22]){
  const isolated=fixture();assert.equal((await edit({description})).status,400);
  assert.equal((await POST(request({kind:'past',title:'Walk',details,description}))).status,400);assert.equal(isolated.writes.length,0);
 }
});
test('past walks accept descriptions and another owner cannot rewrite them',async()=>{
 const f=fixture();const response=await POST(request({kind:'past',title:'River walk',details,description:'Station to water'}));
 assert.equal(response.status,201);assert.equal((await response.json()).walk.description,'Station to water');
 f.rows[1].owner='someone-else';const count=f.writes.length;
 assert.equal((await edit({description:'Changed'})).status,404);assert.equal(f.writes.length,count);
});

test('manual routes store many points without inventing GPS times or changing other walks',async()=>{
 const f=fixture(),before=structuredClone(f.rows[0]);
 const route=Array.from({length:125},(_,i)=>[8.54+i*.00001,47.37+i*.00001]);
 const response=await POST(request({kind:'past',title:'Drawn river walk',details,route}));assert.equal(response.status,201);
 const created=(await response.json()).walk;assert.equal(created.path.length,125);assert.deepEqual(created.path[0],[8.54,47.37,0,0]);assert.deepEqual(f.rows[0],before);
 const edited=await edit({route,withPath:true});assert.equal(edited.status,200);assert.equal((await edited.json()).walk.path.length,125);
});
test('invalid or active manual routes never change stored walks',async()=>{
 for(const route of [[[8.54,47.37]],[[Infinity,47]],[[181,47],[8,47]],Array.from({length:2001},()=>[8,47])]){
  const f=fixture();assert.equal((await edit({route})).status,400);assert.equal((await POST(request({kind:'past',title:'Walk',details,route}))).status,400);assert.equal(f.writes.length,0);
 }
 const f=fixture();assert.equal((await PATCH(request({route:[[8,47],[8.1,47.1]]}),{params:Promise.resolve({id:'recording'})})).status,409);assert.equal(f.writes.length,0);
});
