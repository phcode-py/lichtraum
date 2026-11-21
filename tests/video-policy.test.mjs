// Run: node --experimental-strip-types --test tests/video-policy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_STORED_VIDEO_BYTES,MAX_VIDEO_INPUT_BYTES,VIDEO_STEPS,storedVideoOk,videoDurationError,videoSize} from '../lib/video-policy.ts';
import {mediaError} from '../lib/media.ts';
import {referenceError} from '../lib/paper-references.ts';
const MB=1024*1024;

test('videos are fitted into 1080p, portrait or landscape, never enlarged, always even',()=>{
 assert.deepEqual(videoSize(3840,2160),{width:1920,height:1080});
 assert.deepEqual(videoSize(2160,3840),{width:1080,height:1920});
 assert.deepEqual(videoSize(1920,1080),{width:1920,height:1080});
 assert.deepEqual(videoSize(480,360),{width:480,height:360});
 assert.deepEqual(videoSize(4032,3024),{width:1440,height:1080});
 const odd=videoSize(1001,777);assert.equal(odd.width%2,0);assert.equal(odd.height%2,0);
 assert.deepEqual(videoSize(3840,2160,VIDEO_STEPS[1]),{width:1280,height:720});
});

test('a one-minute clip at the highest step fits the 50 MB storage limit',()=>{
 const audio=256_000; // generous allowance for the copied audio track
 for(const step of VIDEO_STEPS)assert.ok((step.bitrate+audio)*60/8<MAX_STORED_VIDEO_BYTES,`${step.longEdge}p`);
 assert.equal(MAX_STORED_VIDEO_BYTES,52428800); // matches the videos bucket and the SQL attach check
});

test('clips up to one minute are accepted',()=>{
 assert.equal(videoDurationError(4.5),'');
 assert.equal(videoDurationError(60),'');
 assert.equal(videoDurationError(60.3),'');
 assert.ok(videoDurationError(61));
 assert.equal(videoDurationError(NaN),'');
});

test('large originals can be chosen everywhere; stored files must be within 50 MB',()=>{
 for(const type of ['video/mp4','video/webm','video/quicktime']){
  assert.equal(mediaError({type,size:400*MB}),'');
  assert.equal(referenceError({type,size:400*MB}),'');
  assert.ok(mediaError({type,size:MAX_VIDEO_INPUT_BYTES+1}));
  assert.ok(referenceError({type,size:MAX_VIDEO_INPUT_BYTES+1}));
 }
 assert.ok(storedVideoOk({size:MAX_STORED_VIDEO_BYTES}));
 assert.ok(!storedVideoOk({size:MAX_STORED_VIDEO_BYTES+1}));
 assert.ok(!storedVideoOk({size:0}));
});
