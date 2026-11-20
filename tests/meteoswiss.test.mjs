// Run: node --experimental-strip-types --test tests/meteoswiss.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {RADAR_FRAME,radarTime} from '../lib/meteoswiss.ts';

test('radar file names give the end time of their five-minute interval in UTC',()=>{
 assert.equal(new Date(radarTime('rzc263240905vl.001.h5')).toISOString(),'2026-11-20T09:05:00.000Z');
 assert.equal(new Date(radarTime('rzc260010000vl.001.h5')).toISOString(),'2026-01-01T00:00:00.000Z');
});

test('only rain rate composites are accepted as radar frames',()=>{
 assert.ok(RADAR_FRAME.test('rzc263240905vl.001.h5'));
 for(const name of ['cpc2631000009_00060.001.h5','tzc263240905vl.801.h5','../rzc263240905vl.001.h5','rzc263240905vl.001.h5?x'])assert.equal(RADAR_FRAME.test(name),false,name);
 assert.equal(radarTime('not-a-frame'),null);
});
