import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherRequest,parseWeather,fetchWeather} from '../lib/photo-conditions.ts';
import {zurichDateTime,parseZurichDateTime} from '../lib/sun.ts';

const now=Date.parse('2026-11-17T12:00:00Z');
test('weather requests choose recent forecasts or historical estimates for the photo time',()=>{
 const recent=weatherRequest(now,47.373,8.5407,now);
 assert.equal(recent.kind,'forecast');
 const params=new URL(recent.url).searchParams;
 assert.equal(params.get('timezone'),'UTC');
 assert.equal(params.get('start_date'),'2026-11-17');
 assert.equal(params.get('latitude'),'47.373');
 assert.equal(weatherRequest(Date.parse('2026-11-10T14:20:00Z'),47.37,8.54,now).kind,'archive');
 assert.equal(weatherRequest(now+17*86400000,47.37,8.54,now),null);
});
test('weather belongs to the containing hour, even at midnight, and zero is a real value',()=>{
 const time=Date.parse('2026-11-10T23:59:00Z'),hour=Date.parse('2026-11-10T23:00:00Z');
 const data={hourly:{time:[hour/1000],temperature_2m:[0],relative_humidity_2m:[72],cloud_cover:[0],precipitation:[0],wind_speed_10m:[null]}};
 const result=parseWeather(data,time,'archive',now);
 assert.equal(result.sampledAt,hour);
 assert.equal(result.cloudCover,0);
 assert.equal(result.temperature,0);
 assert.equal(result.precipitation,0);
 assert.equal(result.windSpeed,null);
 assert.equal(result.retrievedAt,now);
 assert.equal(parseWeather(data,hour+3600000,'archive'),null);
});
test('missing and invalid weather is never fabricated',()=>{
 assert.equal(parseWeather(null,now,'forecast'),null);
 assert.equal(parseWeather({hourly:{time:[now/1000],cloud_cover:[101],relative_humidity_2m:['65']}},now,'forecast'),null);
 assert.equal(parseWeather({hourly:{time:[]}},now,'forecast'),null);
});
test('provider failures leave weather unavailable rather than blocking solar records',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>{throw new Error('Offline')};
  assert.equal(await fetchWeather(now,47.37,8.54),null);
  globalThis.fetch=async()=>new Response('{}',{status:503});
  assert.equal(await fetchWeather(now,47.37,8.54),null);
 }finally{globalThis.fetch=original;}
});
test('chosen capture time uses Zürich regardless of device zone, rejecting nonexistent DST times',()=>{
 assert.equal(zurichDateTime(Date.parse('2026-11-10T14:20:00Z')),'2026-11-10T15:20');
 assert.equal(parseZurichDateTime('2026-11-10T15:20'),Date.parse('2026-11-10T14:20:00Z'));
 assert.equal(parseZurichDateTime('2026-06-21T15:20'),Date.parse('2026-06-21T13:20:00Z'));
 assert.equal(parseZurichDateTime('2026-03-29T02:30'),null);
 assert.equal(parseZurichDateTime('2026-10-25T02:30'),Date.parse('2026-10-25T00:30:00Z'));
 assert.equal(parseZurichDateTime('2026-02-31T12:00'),null);
 assert.equal(parseZurichDateTime(''),null);
});
