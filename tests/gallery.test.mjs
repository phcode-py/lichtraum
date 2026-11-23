import test from 'node:test';
import assert from 'node:assert/strict';
import {newestPhotoFirst,IMAGE_TYPES,emptyTags,emptyFilters,filterGallery,parseTags,timeTag,weatherTags} from '../lib/gallery.ts';
const photo=(id,extra={})=>({id,title:id,caption:'',place:'Zürich',lat:47.37,lng:8.54,url:'',createdAt:Date.parse('2026-11-17T10:00:00Z'),...extra});
const conditions=(capturedAt,elevation=20,weather=null)=>({capturedAt:Date.parse(capturedAt),lat:47.37,lng:8.54,timeSource:'chosen',sun:{azimuth:180,elevation},weather,weatherStatus:weather?'available':'unavailable'});

test('the six screenshot image categories remain distinct and invalid tags are rejected',()=>{
 assert.equal(IMAGE_TYPES.length,6);
 assert.notEqual(IMAGE_TYPES[1].id,IMAGE_TYPES[2].id);
 assert.notEqual(IMAGE_TYPES[2].id,IMAGE_TYPES[4].id);
 assert.deepEqual(parseTags({...emptyTags(),imageTypes:['reflections-water','reflections-water']}),{...emptyTags(),imageTypes:['reflections-water']});
 assert.equal(parseTags({...emptyTags(),imageTypes:['unknown']}),null);
 assert.equal(parseTags({...emptyTags(),area:'guessed'}),null);
 assert.equal(parseTags({}),null);
});
test('newest upload is default; capture sorting uses the actual capture date with a safe fallback',()=>{
 const older=photo('a',{createdAt:100}),newer=photo('b',{createdAt:200,conditions:conditions('2020-01-01T12:00:00Z')}),latestUpload=photo('c',{createdAt:300,conditions:conditions('2019-01-01T12:00:00Z')});
 const input=[older,newer,latestUpload];
 assert.deepEqual(filterGallery(input,emptyFilters(),'uploaded-newest').map(p=>p.id),['c','b','a']);
 assert.deepEqual(filterGallery(input,emptyFilters(),'taken-newest').map(p=>p.id),['b','c','a']);
 assert.deepEqual(input.map(p=>p.id),['a','b','c']);
});
test('types are OR within their group, and walk, area, time and weather narrow the set together',()=>{
 const first=photo('water',{walk:'walk1',tags:{imageTypes:['reflections-water'],area:'waterfront',timeOfDay:'morning',weather:['overcast']}});
 const other=photo('facade',{walk:'walk2',tags:{imageTypes:['reflected-light-facades'],area:'residential',timeOfDay:'evening',weather:['clear']}});
 const filters={...emptyFilters(),types:['reflections-water','reflected-light-facades']};
 assert.equal(filterGallery([first,other],filters,'uploaded-newest').length,2);
 assert.deepEqual(filterGallery([first,other],{...filters,walk:'walk1',area:'waterfront',time:'morning',weather:['overcast']},'uploaded-newest').map(p=>p.id),['water']);
 assert.equal(filterGallery([first,other],{...filters,walk:'walk1',weather:['clear']},'uploaded-newest').length,0);
});
test('capture time uses Zürich time and solar night, never the upload timestamp',()=>{
 assert.equal(timeTag(photo('old-upload')), '');
 assert.equal(timeTag(photo('morning',{conditions:conditions('2026-06-10T05:00:00Z')})), 'early-morning');
 assert.equal(timeTag(photo('night',{conditions:conditions('2026-11-17T17:30:00Z',-15)})), 'night');
 assert.equal(timeTag(photo('dusk',{conditions:conditions('2026-11-17T16:30:00Z',-2)})), 'evening');
 assert.equal(timeTag(photo('override',{conditions:conditions('2026-11-17T17:30:00Z',-15),tags:{...emptyTags(),timeOfDay:'morning'}})), 'morning');
});
test('weather supports cloud, rain, humidity and wind and respects manual choices',()=>{
 const c=conditions('2026-11-17T12:00:00Z',20,{cloudCover:90,humidity:85,precipitation:1,windSpeed:25});
 assert.deepEqual(weatherTags(photo('wet',{conditions:c})),['overcast','precipitation','humid','windy']);
 assert.deepEqual(weatherTags(photo('manual',{conditions:c,tags:{...emptyTags(),weather:['clear']}})),['clear']);
 assert.deepEqual(weatherTags(photo('unknown')),[]);
});
test('old untagged photos remain visible and can be found by unknown data and legacy categories',()=>{
 const p=photo('old',{category:'Reflection'});
 assert.equal(filterGallery([p],{...emptyFilters(),types:['untagged'],time:'unknown',weather:['unknown'],area:'unknown',walk:'none'},'uploaded-newest').length,1);
 assert.equal(filterGallery([p],{...emptyFilters(),types:['category:Reflection']},'uploaded-newest').length,1);
 assert.equal(filterGallery([p],{...emptyFilters(),types:['reflections-water']},'uploaded-newest').length,0);
});
test('search finds the German taxonomy as well as places, titles and authors',()=>{
 const p=photo('a',{tags:{...emptyTags(),imageTypes:['reflections-water']}});
 assert.equal(filterGallery([p],{...emptyFilters(),query:'Spiegelungen im Wasser'},'uploaded-newest').length,1);
});


test('newest capture order is stable and falls back only when a capture time is unknown',()=>{
 const pictures=[{id:'old',createdAt:999,conditions:{capturedAt:10}},{id:'b',createdAt:1,conditions:{capturedAt:30}},{id:'a',createdAt:2,conditions:{capturedAt:30}},{id:'unknown',createdAt:20},{id:'invalid',createdAt:5,conditions:{capturedAt:NaN}}];
 assert.deepEqual([...pictures].sort(newestPhotoFirst).map(p=>p.id),['a','b','unknown','old','invalid']);
 assert.equal(pictures[0].id,'old');
});
