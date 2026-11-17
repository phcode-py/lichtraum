// Run: node --experimental-strip-types --test tests/sun.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {solarPosition,daySunPath,sunEvents,sunDayBounds,zurichDate,sunGuidePoint,ZURICH} from '../lib/sun.ts';

test('Zürich solstice heights agree with latitude and axial tilt',()=>{
 for(const [date,declination] of [['2026-06-21',23.44],['2026-12-21',-23.44]]){
  const peak=Math.max(...daySunPath(date).map(p=>p.elevation));
  assert.ok(Math.abs(peak-(90-ZURICH.lat+declination))<.7);
 }
});
test('solar bearings distinguish morning east and afternoon west',()=>{
 const morning=solarPosition(Date.parse('2026-03-20T06:00:00Z'),0,0);
 const afternoon=solarPosition(Date.parse('2026-03-20T18:00:00Z'),0,0);
 assert.ok(Math.abs(morning.azimuth-90)<3);
 assert.ok(Math.abs(afternoon.azimuth-270)<3);
 assert.ok(solarPosition(Date.parse('2026-12-21T23:00:00Z')).elevation<0);
});
test('Zürich daylight is longer in summer and rise precedes set',()=>{
 const summer=sunEvents(daySunPath('2026-06-21')),winter=sunEvents(daySunPath('2026-12-21'));
 assert.ok(summer.sunrise<summer.sunset&&winter.sunrise<winter.sunset);
 assert.ok((summer.sunset-summer.sunrise)/3600000>15);
 assert.ok((winter.sunset-winter.sunrise)/3600000<9);
});
test('the timeline respects short and long Zürich daylight-saving days',()=>{
 for(const [date,hours] of [['2026-03-29',23],['2026-10-25',25],['2026-11-11',24]]){
  const {start,end}=sunDayBounds(date);
  assert.equal((end-start)/3600000,hours);
  assert.equal(zurichDate(start),date);
  assert.equal(zurichDate(end-1),date);
  assert.notEqual(zurichDate(end),date);
 }
});
test('map bearing guides point north/east/south/west without a fake distance',()=>{
 const north=sunGuidePoint(0),east=sunGuidePoint(90),south=sunGuidePoint(180),west=sunGuidePoint(270);
 assert.ok(north[1]>ZURICH.lat&&south[1]<ZURICH.lat);
 assert.ok(east[0]>ZURICH.lng&&west[0]<ZURICH.lng);
 assert.ok(Math.abs(north[0]-ZURICH.lng)<1e-8);
});

test('a moved origin changes the full day path and its map guide',()=>{
 const point={lat:47.3895,lng:8.5187};
 const guide=sunGuidePoint(0,900,point);
 assert.ok(guide[1]>point.lat);
 assert.ok(Math.abs(guide[0]-point.lng)<1e-8);
 const samples=daySunPath('2026-11-17',point.lat,point.lng);
 assert.deepEqual({azimuth:samples[50].azimuth,elevation:samples[50].elevation},solarPosition(samples[50].time,point.lat,point.lng));
 assert.notDeepEqual(samples[50],daySunPath('2026-11-17')[50]);
});
