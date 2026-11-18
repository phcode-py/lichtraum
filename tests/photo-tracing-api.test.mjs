import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const tracing=moduleURL(transpile(await readFile(new URL('../lib/photo-tracing.ts',import.meta.url),'utf8')));
const server=moduleURL(`export const createClient=async()=>globalThis.tracingFixture.db;export const getSessionUser=async()=>globalThis.tracingFixture.user;export const isCrossOrigin=r=>!!r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin;`);
const source=transpile(await readFile(new URL('../app/api/photos/[id]/tracing/route.ts',import.meta.url),'utf8')).replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/photo-tracing',tracing);
const {GET,PUT}=await import(moduleURL(source));
const author={id:'lena',name:'Lena'};
function fixture(){
 const photos=[{id:'shared',owner:'lena',shared:true,key:'lena/original.jpg'},{id:'private',owner:'mona',shared:false,key:'mona/private.jpg'}],rows=[],writes=[],queries=[];
 const f={user:author,available:true,photos,rows,writes,queries};
 class Query{
  filters=[];mode='read';value=null;
  constructor(table){this.table=table;queries.push(table)}select(){return this}eq(k,v){this.filters.push(row=>row[k]===v);return this}order(){return this}insert(v){this.mode='insert';this.value=v;return this}update(v){this.mode='update';this.value=v;return this}
  execute(many=false){
   if(this.table==='photo_tracings'&&!f.available)return {data:null,error:{code:'42P01'}};
   let records=this.table==='photos'?photos.filter(p=>p.owner===f.user?.id||p.shared):rows;
   const matches=records.filter(row=>this.filters.every(filter=>filter(row)));
   if(this.mode==='insert'){
    const row=this.value;if(rows.some(r=>r.photo_id===row.photo_id&&r.owner===row.owner&&r.image_key===row.image_key))return {data:null,error:{code:'23505'}};
    rows.push(structuredClone(row));writes.push(structuredClone(row));return {data:structuredClone(row),error:null};
   }
   if(this.mode==='update'){matches.forEach(row=>Object.assign(row,this.value));if(matches.length)writes.push(structuredClone(this.value));}
   return {data:many?structuredClone(matches):structuredClone(matches[0]??null),error:null};
  }
  maybeSingle(){return Promise.resolve(this.execute())}then(resolve,reject){return Promise.resolve(this.execute(true)).then(resolve,reject)}
 }
 f.db={from:table=>new Query(table)};globalThis.tracingFixture=f;return f;
}
const context=id=>({params:Promise.resolve({id})});
const request=(body,origin)=>new Request('http://localhost/api/photos/shared/tracing',{method:'PUT',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const stroke=[{points:[[.1,.2],[.4,.6]]}],body={source:'lena/original.jpg',strokes:stroke,revision:0};
test('private photographs and signed-out requests never expose or write tracing rows',async()=>{
 let f=fixture();assert.equal((await GET(request({}),context('private'))).status,404);assert.ok(!f.queries.includes('photo_tracings'));
 assert.equal((await PUT(request(body),context('private'))).status,404);assert.equal(f.writes.length,0);
 f=fixture();f.user=null;assert.equal((await GET(request({}),context('shared'))).status,401);assert.equal((await PUT(request(body),context('shared'))).status,401);
 assert.equal((await PUT(request(body,'https://elsewhere.test'),context('shared'))).status,403);assert.equal(f.writes.length,0);
});
test('each participant gets their own layer without changing the original photograph or the other layer',async()=>{
 const f=fixture(),before=structuredClone(f.photos);let r=await PUT(request(body),context('shared'));assert.equal(r.status,200);assert.equal((await r.json()).layer.authorName,'Lena');
 f.user={id:'mona',name:'Mona'};r=await PUT(request({...body,owner:'lena'}),context('shared'));assert.equal(r.status,200);assert.equal(f.rows.length,2);assert.equal(f.rows[1].owner,'mona');
 const read=await (await GET(request({}),context('shared'))).json();assert.equal(read.layers.length,2);assert.equal(read.layers.find(l=>l.mine).authorId,'mona');assert.deepEqual(f.photos,before);
 const lena=structuredClone(f.rows[0]);assert.equal((await PUT(request({...body,revision:1,strokes:[]}),context('shared'))).status,200);assert.deepEqual(f.rows[0],lena);
});
test('stale revisions and changed images retain saved drawings rather than overwriting them',async()=>{
 const f=fixture();assert.equal((await PUT(request(body),context('shared'))).status,200);
 assert.equal((await PUT(request({...body,revision:1}),context('shared'))).status,200);const saved=structuredClone(f.rows);
 assert.equal((await PUT(request({...body,revision:1,strokes:[]}),context('shared'))).status,409);assert.deepEqual(f.rows,saved);
 f.photos[0].key='lena/replacement.jpg';assert.equal((await PUT(request({...body,revision:2}),context('shared'))).status,409);assert.deepEqual(f.rows,saved);
 assert.deepEqual((await (await GET(request({}),context('shared'))).json()).layers,[]);
 assert.equal((await PUT(request({...body,source:'lena/replacement.jpg'}),context('shared'))).status,200);assert.equal(f.rows.length,2);assert.deepEqual(f.rows[0],saved[0]);
});
test('invalid geometry and unavailable setup produce no data writes',async()=>{
 let f=fixture();for(const bad of [{...body,strokes:[{points:[[2,0]]}]},{...body,revision:-1},{...body,strokes:'<svg/>'}])assert.equal((await PUT(request(bad),context('shared'))).status,400);assert.equal(f.writes.length,0);
 f=fixture();f.available=false;assert.equal((await (await GET(request({}),context('shared'))).json()).available,false);assert.equal((await PUT(request(body),context('shared'))).status,503);assert.equal(f.writes.length,0);
});
