import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
const source=await readFile(new URL('../lib/photo-capture-edit.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll('./sun',new URL('../lib/sun.ts',import.meta.url).href);
const {captureEditTime}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base={time:'2026-11-11T09:15',initialTime:'2026-11-11T09:15',confirmed:false,moved:false};
test('an upload time is never silently saved as the original capture time',()=>{
 assert.equal(captureEditTime(base),null);
 assert.equal(captureEditTime({...base,moved:true}),null);
 assert.equal(captureEditTime({...base,time:'2026-11-10T10:30'}),null);
});
test('confirming an unchanged date creates the missing capture record',()=>{
 assert.equal(captureEditTime({...base,confirmed:true}),Date.parse('2026-11-11T08:15:00Z'));
 assert.equal(captureEditTime({...base,time:'invalid',confirmed:true}),null);
});
test('existing captures stay untouched unless their time or position changes',()=>{
 const savedCaptureAt=Date.parse('2026-11-11T08:15:47Z');
 assert.equal(captureEditTime({...base,savedCaptureAt}),null);
 assert.equal(captureEditTime({...base,savedCaptureAt,moved:true}),savedCaptureAt);
 assert.equal(captureEditTime({...base,savedCaptureAt,time:'2026-11-10T10:30'}),Date.parse('2026-11-10T09:30:00Z'));
});
