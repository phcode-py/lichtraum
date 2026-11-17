// node --experimental-strip-types --test tests/walk-details.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWalkDetails,zurichInput,fromZurichInput} from '../lib/walk-details.ts';
const now=Date.parse('2026-11-17T12:00:00Z');
const details={startedAt:'2026-11-15T13:00:00Z',endedAt:'2026-11-15T14:00:00Z',distance:4200,duration:2700};
test('finished walks accept time spent walking separately from elapsed time',()=>{
 assert.deepEqual(parseWalkDetails(details,now).details,{...details,startedAt:'2026-11-15T13:00:00.000Z',endedAt:'2026-11-15T14:00:00.000Z'});
 assert.ok(parseWalkDetails({...details,distance:0,duration:0},now).details);
 assert.ok(parseWalkDetails({...details,startedAt:'2026-11-14T23:30:00Z'},now).details);
});
test('invalid dates, future walks, impossible durations and invalid totals are rejected',()=>{
 for(const change of [{startedAt:'not a date'},{startedAt:details.endedAt},{endedAt:'2026-11-18T00:00:00Z'},{duration:3601},{distance:-1},{distance:Infinity},{distance:'4200'},{duration:-1},{duration:NaN},{duration:2**31}])assert.ok(parseWalkDetails({...details,...change},now).error,JSON.stringify(change));
 for(const body of [null,[],{},'walk'])assert.ok(parseWalkDetails(body,now).error);
});
test('Zürich date fields preserve summer, winter and overnight dates',()=>{
 for(const instant of ['2026-06-15T12:30:15Z','2026-11-15T13:30:15Z','2026-06-15T22:30:00Z']){
  const ms=Date.parse(instant);assert.equal(fromZurichInput(zurichInput(ms)),new Date(ms).toISOString());
 }
 assert.equal(zurichInput(Date.parse('2026-06-15T12:00:00Z')),'2026-06-15T14:00:00');
 assert.equal(zurichInput(Date.parse('2026-11-15T12:00:00Z')),'2026-11-15T13:00:00');
 assert.equal(fromZurichInput('2026-02-30T14:00'),null);
});
test('clock changes reject nonexistent times and preserve the recorded repeated hour',()=>{
 assert.equal(fromZurichInput('2026-03-29T02:30'),null);
 const later=Date.parse('2026-10-25T01:30:00.123Z');
 assert.equal(fromZurichInput('2026-10-25T02:30:00',later),new Date(later).toISOString());
 assert.equal(fromZurichInput('2026-10-25T02:30'),'2026-10-25T00:30:00.000Z');
 const spring=parseWalkDetails({startedAt:fromZurichInput('2026-03-29T01:30'),endedAt:fromZurichInput('2026-03-29T03:30'),distance:4000,duration:3600},now);
 assert.equal(spring.details.duration,3600);
});
