import test from 'node:test';
import assert from 'node:assert/strict';
import {observeMapLocation} from '../lib/map-location.ts';
test('first location centers the map; later fixes only update its dot, and cleanup ignores late fixes',()=>{
 let success,failure,options,cleared;const calls=[],errors=[];
 const stop=observeMapLocation({watchPosition:(s,e,o)=>{success=s;failure=e;options=o;return 7},clearWatch:id=>cleared=id},(coords,first)=>calls.push([coords.latitude,coords.longitude,first]),e=>errors.push(e));
 success({coords:{latitude:47.37,longitude:8.54}});success({coords:{latitude:47.371,longitude:8.541}});
 success({coords:{latitude:NaN,longitude:8.54}});
 assert.deepEqual(calls,[[47.37,8.54,true],[47.371,8.541,false]]);assert.equal(options.maximumAge,0);
 failure({code:1});assert.equal(errors.length,1);stop();assert.equal(cleared,7);
 success({coords:{latitude:47.4,longitude:8.5}});failure({code:2});assert.equal(calls.length,2);assert.equal(errors.length,1);
});
