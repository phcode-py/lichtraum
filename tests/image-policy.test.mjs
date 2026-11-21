// Run: node --experimental-strip-types --test tests/image-policy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {IMAGE_TYPES,MAX_IMAGE_INPUT_BYTES,MAX_STORED_IMAGE_BYTES,RESIZE_THRESHOLD_BYTES,keepsOriginal,outputType,scaledSize,storedImageOk} from '../lib/image-policy.ts';
import {mediaError} from '../lib/media.ts';
import {referenceError} from '../lib/paper-references.ts';
const MB=1024*1024;

test('atlas and working notes accept the same image originals',()=>{
 for(const type of IMAGE_TYPES)for(const size of [1,12*MB,MAX_IMAGE_INPUT_BYTES,MAX_IMAGE_INPUT_BYTES+1]){
  assert.equal(!mediaError({type,size}),!referenceError({type,size}),`${type} ${size}`);
 }
 assert.equal(mediaError({type:'image/jpeg',size:25*MB}),'');
 assert.equal(referenceError({type:'image/png',size:25*MB}),'');
 assert.ok(mediaError({type:'image/jpeg',size:MAX_IMAGE_INPUT_BYTES+1}));
 assert.ok(referenceError({type:'image/webp',size:MAX_IMAGE_INPUT_BYTES+1}));
});

test('the stored limit still matches the Supabase buckets (10 MB)',()=>{
 assert.equal(MAX_STORED_IMAGE_BYTES,10485760);
 assert.ok(storedImageOk({type:'image/jpeg',size:MAX_STORED_IMAGE_BYTES}));
 assert.ok(!storedImageOk({type:'image/jpeg',size:MAX_STORED_IMAGE_BYTES+1}));
 assert.ok(!storedImageOk({type:'image/jpeg',size:0}));
 assert.ok(!storedImageOk({type:'video/mp4',size:MB}));
});

test('only small supported files skip shrinking',()=>{
 assert.ok(keepsOriginal({type:'image/png',size:RESIZE_THRESHOLD_BYTES-1}));
 assert.ok(!keepsOriginal({type:'image/png',size:RESIZE_THRESHOLD_BYTES}));
 assert.ok(!keepsOriginal({type:'image/heic',size:100}));
});

test('images fit within 2400 px without being enlarged',()=>{
 assert.deepEqual(scaledSize(6000,4000),{width:2400,height:1600});
 assert.deepEqual(scaledSize(3000,4000),{width:1800,height:2400});
 assert.deepEqual(scaledSize(800,600),{width:800,height:600});
 assert.deepEqual(scaledSize(100000,1),{width:2400,height:1});
});

test('PNG and WebP keep their format; other inputs become JPEG',()=>{
 assert.equal(outputType('image/png'),'image/png');
 assert.equal(outputType('image/webp'),'image/webp');
 assert.equal(outputType('image/jpeg'),'image/jpeg');
 assert.equal(outputType('image/heic'),'image/jpeg');
});
