import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyMapTracing,parseMapTracing} from '../lib/walk-tracing.ts';
const owner='00000000-0000-4000-8000-000000000001',key=owner+'/00000000-0000-4000-8000-000000000002';
const shape={strokes:[{points:[[8.54,47.37],[8.541,47.371]]}],notes:[{id:'note',point:[8.54,47.37],text:' Blue reflected light '}],sketches:[{id:'sketch',key,corners:[[8.54,47.38],[8.55,47.38],[8.55,47.37],[8.54,47.37]],opacity:.65,rotation:0,url:'https://untrusted.invalid/image'}]};
test('map layers keep geographic geometry and plain notes, stripping supplied URLs and extra fields',()=>{
 const parsed=parseMapTracing({...shape,html:'<script/>'});assert.equal(parsed.notes[0].text,'Blue reflected light');assert.equal(parsed.sketches[0].url,undefined);assert.equal(parsed.html,undefined);assert.deepEqual(parsed.strokes[0].points,shape.strokes[0].points);
 for(const invalid of [{...shape,strokes:[{points:[[181,0]]}]},{...shape,notes:[{id:'x',point:[0,0],text:'x'.repeat(601)}]},{...shape,notes:[shape.notes[0],shape.notes[0]]},{...shape,sketches:[{...shape.sketches[0],key:'https://host/file'}]},{...shape,sketches:[{...shape.sketches[0],opacity:NaN}]},{...shape,strokes:Array.from({length:201},()=>({points:[[0,0]]}))}])assert.equal(parseMapTracing(invalid),null);
 assert.deepEqual(parseMapTracing(emptyMapTracing()),emptyMapTracing());
});
test('local preview file keys never pass production validation',()=>{const value={...shape,sketches:[{...shape.sketches[0],key:'preview/00000000-0000-4000-8000-000000000002'}]};assert.equal(parseMapTracing(value),null);assert.ok(parseMapTracing(value,true))});
