// Run: node --experimental-strip-types --test tests/media.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaError,mediaKind,mediaBucket,validMediaKey,storedMediaExists,videoThumbnailSrc} from '../lib/media.ts';
const owner='11111111-1111-4111-8111-111111111111';
const key=owner+'/22222222-2222-4222-8222-222222222222';
test('photo and video limits reject unsupported, oversized and empty files',()=>{
 for(const type of ['image/jpeg','image/png','image/webp']){
  assert.equal(mediaError({type,size:50*1024*1024}),'');
  assert.ok(mediaError({type,size:50*1024*1024+1}));
 }
 for(const type of ['video/mp4','video/webm','video/quicktime']){
  assert.equal(mediaError({type,size:50*1024*1024}),'');
  assert.ok(mediaError({type,size:50*1024*1024+1}));
 }
 assert.ok(mediaError({type:'image/jpeg',size:0}));
 assert.ok(mediaError({type:'text/html',size:100}));
 assert.ok(mediaError({type:'toString',size:100}));
});
test('legacy photos keep their bucket; video extensions select the video bucket',()=>{
 assert.equal(mediaKind(key),'photo');assert.equal(mediaBucket(key),'photos');
 for(const ext of ['mp4','webm','mov']){
  assert.equal(mediaKind(key+'.'+ext),'video');assert.equal(mediaBucket(key+'.'+ext),'videos');
  assert.equal(validMediaKey(key+'.'+ext,owner),true);
 }
 assert.equal(validMediaKey(key,owner),true);
 for(const bad of [key+'.html',key+'/extra',key.replace(owner,'another-owner'),owner+'/------------------------------------',key+'.mp4/../secret'])assert.equal(validMediaKey(bad,owner),false);
});
test('posting requires an existing upload with matching type and size',async()=>{
 const fake=(data,error=null)=>({storage:{from:bucket=>{assert.equal(bucket,'videos');return {info:async()=>({data,error})};}}});
 assert.equal(await storedMediaExists(fake({size:1024,contentType:'video/mp4'}),key+'.mp4'),true);
 for(const data of [null,{size:1024,contentType:'image/jpeg'},{size:1024,contentType:'video/webm'},{size:51*1024*1024,contentType:'video/mp4'}])assert.equal(await storedMediaExists(fake(data),key+'.mp4'),false);
 assert.equal(await storedMediaExists(fake(null,{message:'missing'}),key+'.mp4'),false);
});
test('video thumbnails request the first frame without touching players or local previews',()=>{
 const signed='https://x.supabase.co/storage/v1/object/sign/videos/a/b.mov?token=abc';
 assert.equal(videoThumbnailSrc(signed),signed+'#t=0.001');
 assert.equal(videoThumbnailSrc(signed,true),signed);
 assert.equal(videoThumbnailSrc('blob:http://localhost/123'),'blob:http://localhost/123');
 assert.equal(videoThumbnailSrc(signed+'#t=2'),signed+'#t=2');
 assert.equal(new URL(videoThumbnailSrc(signed)).searchParams.get('token'),'abc');
});
