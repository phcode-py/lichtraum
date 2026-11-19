import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const tracing=moduleURL(transpile(await readFile(new URL('../lib/walk-tracing.ts',import.meta.url),'utf8')));
const server=moduleURL(`export const createClient=async()=>globalThis.tracingFixture.db;export const getSessionUser=async()=>globalThis.tracingFixture.user;export const isCrossOrigin=r=>!!r.headers.get('origin')&&r.headers.get('origin')!==new URL(r.url).origin;`);
const references=moduleURL('export const REFERENCE_BUCKET="paper-references";export const validReferenceKey=(key,owner)=>key.startsWith(owner+"/");export const referenceExists=async(db,key)=>db.validFiles.includes(key);');
const source=transpile(await readFile(new URL('../app/api/walks/[id]/tracing/route.ts',import.meta.url),'utf8')).replaceAll('@/lib/supabase/server',server).replaceAll('@/lib/walk-tracing',tracing).replaceAll('@/lib/paper-references',references);
const {GET,PUT}=await import(moduleURL(source));
const author={id:'lena',name:'Lena'};
function fixture(){
 const walks=[{id:'shared',owner:'lena',shared:true,key:'lena/original.jpg'},{id:'private',owner:'mona',shared:false,key:'mona/private.jpg'}],rows=[],writes=[],queries=[];
 const f={user:author,available:true,walks,rows,writes,queries};
 class Query{
  filters=[];mode='read';value=null;
  constructor(table){this.table=table;queries.push(table)}select(){return this}eq(k,v){this.filters.push(row=>row[k]===v);return this}order(){return this}insert(v){this.mode='insert';this.value=v;return this}update(v){this.mode='update';this.value=v;return this}
  execute(many=false){
   if(this.table==='walk_map_tracings'&&!f.available)return {data:null,error:{code:'42P01'}};
   let records=this.table==='walks'?walks.filter(p=>p.owner===f.user?.id||p.shared):rows;
   const matches=records.filter(row=>this.filters.every(filter=>filter(row)));
   if(this.mode==='insert'){
    const row=this.value;if(rows.some(r=>r.walk_id===row.walk_id&&r.owner===row.owner))return {data:null,error:{code:'23505'}};
    rows.push(structuredClone(row));writes.push(structuredClone(row));return {data:structuredClone(row),error:null};
   }
   if(this.mode==='update'){matches.forEach(row=>Object.assign(row,this.value));if(matches.length)writes.push(structuredClone(this.value));}
   return {data:many?structuredClone(matches):structuredClone(matches[0]??null),error:null};
  }
  maybeSingle(){return Promise.resolve(this.execute())}then(resolve,reject){return Promise.resolve(this.execute(true)).then(resolve,reject)}
 }
 f.db={validFiles:[],storage:{from:()=>({createSignedUrls:async keys=>({data:keys.map(path=>({path,signedUrl:'https://signed.invalid/'+path}))})})},from:table=>new Query(table)};globalThis.tracingFixture=f;return f;
}
const context=id=>({params:Promise.resolve({id})});
const request=(body,origin)=>new Request('http://localhost/api/walks/shared/tracing',{method:'PUT',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)});
const drawing={strokes:[{points:[[8.54,47.37],[8.541,47.371]]}],notes:[{id:'note',point:[8.54,47.37],text:'Reflection'}],sketches:[]},body={drawing,revision:0};
test('private walks, signed-out requests and cross-origin writes are refused',async()=>{let f=fixture();assert.equal((await GET(request({}),context('private'))).status,404);assert.equal((await PUT(request(body),context('private'))).status,404);assert.equal(f.writes.length,0);f.user=null;assert.equal((await GET(request({}),context('shared'))).status,401);assert.equal((await PUT(request(body),context('shared'))).status,401);assert.equal((await PUT(request(body,'https://other.invalid'),context('shared'))).status,403)});
test('collaborators draw separate personal layers and cannot forge another author or overwrite a stale revision',async()=>{const f=fixture(),before=structuredClone(f.walks);assert.equal((await PUT(request(body),context('shared'))).status,200);f.user={id:'mona',name:'Mona'};assert.equal((await PUT(request({...body,owner:'lena'}),context('shared'))).status,200);assert.equal(f.rows[1].owner,'mona');const layers=(await (await GET(request({}),context('shared'))).json()).layers;assert.equal(layers.length,2);assert.equal(layers.find(layer=>layer.mine).authorId,'mona');assert.equal((await PUT(request({...body,revision:1}),context('shared'))).status,200);const saved=structuredClone(f.rows);assert.equal((await PUT(request({...body,revision:1,drawing:{...drawing,notes:[]}}),context('shared'))).status,409);assert.deepEqual(f.rows,saved);assert.deepEqual(f.walks,before)});
test('missing setup and invalid geometry retain existing data',async()=>{const f=fixture();assert.equal((await PUT(request({...body,drawing:{...drawing,strokes:[{points:[[999,0]]}]}}),context('shared'))).status,400);f.available=false;assert.equal((await (await GET(request({}),context('shared'))).json()).available,false);assert.equal((await PUT(request(body),context('shared'))).status,503);assert.equal(f.writes.length,0)});
test('sketch references require the caller’s own existing still image; returned URLs are generated by storage',async()=>{
 const f=fixture(),owner='00000000-0000-4000-8000-000000000001',key=owner+'/00000000-0000-4000-8000-000000000002';f.user={id:owner,name:'Architect'};const image={id:'sketch',key,corners:[[8.54,47.38],[8.55,47.38],[8.55,47.37],[8.54,47.37]],opacity:.5,rotation:0,url:'https://forged.invalid/file'};const value={...body,drawing:{...drawing,sketches:[image]}};
 assert.equal((await PUT(request(value),context('shared'))).status,400);assert.equal(f.writes.length,0);
 f.db.validFiles.push(key);const response=await PUT(request(value),context('shared'));assert.equal(response.status,200);const layer=(await response.json()).layer;assert.equal(layer.sketches[0].url,'https://signed.invalid/'+key);assert.equal(f.rows[0].drawing.sketches[0].url,undefined);
 f.user={id:'00000000-0000-4000-8000-000000000003',name:'Partner'};assert.equal((await PUT(request(value),context('shared'))).status,400);assert.equal(f.rows.length,1);
});
