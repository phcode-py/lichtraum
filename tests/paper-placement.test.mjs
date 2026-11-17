import test from 'node:test';
import assert from 'node:assert/strict';
import {findPaperSpace} from '../lib/paper-placement.ts';
const overlaps=(p,r)=>p.x<r.x+r.width+32&&p.x+330+32>r.x&&p.y<r.y+r.height+32&&p.y+560+32>r.y;
test('new sheets prefer free visible space and retain every existing position',()=>{
 const occupied=[{x:32,y:32,width:380,height:560}],before=structuredClone(occupied);
 const p=findPaperSpace(occupied,{x:0,y:0,width:1200,height:850});assert.ok(p);assert.equal(overlaps(p,occupied[0]),false);assert.ok(p.x+330<=1200&&p.y+560<=850);assert.deepEqual(occupied,before);
});
test('crowded or scrolled walls expand nearby without covering existing sheets',()=>{
 const occupied=[{x:0,y:0,width:1000,height:900},{x:1032,y:0,width:330,height:750}];
 const p=findPaperSpace(occupied,{x:800,y:50,width:400,height:600});assert.ok(p);assert.ok(occupied.every(r=>!overlaps(p,r)));assert.ok(p.x<=10000&&p.y<=10000);
});
test('empty small viewports still allow a complete sheet on the scrollable wall',()=>{
 assert.deepEqual(findPaperSpace([],{x:0,y:0,width:300,height:450}),{x:32,y:32});
});
