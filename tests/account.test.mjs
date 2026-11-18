import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const server=moduleURL('export const createClient=async()=>({});export const getSessionUser=async()=>globalThis.accountTestUser;');
const js=ts.transpileModule(await readFile(new URL('../app/api/account/route.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {GET}=await import(moduleURL(js.replace('@/lib/supabase/server',server)));
test('account profile requires sign-in and returns only uncached name/email, never credentials',async()=>{
 globalThis.accountTestUser=null;assert.equal((await GET()).status,401);
 globalThis.accountTestUser={id:'owner',name:'Architect',email:'architect@example.test',password:'not-a-real-password',access_token:'not-a-real-token'};
 const response=await GET();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.deepEqual(await response.json(),{username:'Architect',email:'architect@example.test'});
});
