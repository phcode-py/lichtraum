import test from 'node:test';
import assert from 'node:assert/strict';
import {PAPER_RICH_PREFIX,encodePaperHTML,paperTextHTML,paperTextPlain,sanitizePaperHTML} from '../lib/paper-text.ts';
import {REFERENCE_ONLY_CONTENT,referenceCaption,referenceError,validReferenceKey,noteMessages,referenceExists} from '../lib/paper-references.ts';
test('legacy notes remain literal text and keep line breaks',()=>{
 assert.equal(paperTextHTML('A <b>literal</b> note\nNext line'),'A &lt;b&gt;literal&lt;/b&gt; note<br>Next line');
});
test('formatted text retains bold, italic, underline and lists without executable markup',()=>{
 const source='<b onclick="alert(1)">Bold</b><em>italic</em><u>underlined</u><ul><li>one</li></ul><img src=x onerror=alert(1)><script>alert(2)</script><a href="javascript:alert(3)">link</a>';
 const stored=encodePaperHTML(source),html=paperTextHTML(stored);
 assert.ok(stored.startsWith(PAPER_RICH_PREFIX));assert.match(html,/<b>Bold<\/b><em>italic<\/em><u>underlined<\/u><ul>/);
 assert.doesNotMatch(html,/<(?:script|img|a)\b|onclick|onerror|javascript:/);assert.match(paperTextPlain(stored),/Bolditalicunderlinedone/);
 assert.equal(encodePaperHTML('<div><br></div>'),'');
});
test('malformed and pasted markup is reduced to formatting tags without attributes',()=>{
 const html=sanitizePaperHTML('<svg><foreignObject><p style="position:fixed">hello</p></foreignObject></svg><!-- comment --><iframe src=x>frame</iframe>');
 assert.equal(html,'<p>hello</p>frame');
});
test('paper reference videos enforce type, size and ownership, and return playable signed media',async()=>{
 const key='owner/12345678-1234-1234-1234-123456789abc.mp4';
 assert.equal(referenceError({type:'video/mp4',size:50*1024*1024}),'');assert.ok(referenceError({type:'video/mp4',size:50*1024*1024+1}));assert.equal(referenceError({type:'image/png',size:11*1024*1024}),'');assert.ok(referenceError({type:'image/png',size:50*1024*1024+1}));assert.ok(referenceError({type:'text/html',size:100}));
 assert.equal(validReferenceKey(key,'owner'),true);assert.equal(validReferenceKey(key,'other'),false);
 const db={storage:{from:()=>({info:async()=>({data:{size:100,contentType:'video/mp4'}}),createSignedUrls:async keys=>({data:keys.map(path=>({path,signedUrl:'https://preview.invalid/'+path}))})})}};
 assert.equal(await referenceExists(db,key),true);assert.equal(await referenceExists(db,key.replace('.mp4','')),false);
 const [m]=await noteMessages(db,[{id:'note',owner:'owner',author_name:'Architect',content:'Film',created_at:'2026-11-17T12:00:00Z',image_key:key}],'owner');assert.equal(m.mediaType,'video');assert.match(m.imageUrl,/\.mp4$/);
});

test('media can have no visible caption and user-written captions are retained',()=>{
 assert.equal(referenceCaption(REFERENCE_ONLY_CONTENT,true),'');assert.equal(referenceCaption('Light on water',true),'Light on water');assert.equal(referenceCaption(REFERENCE_ONLY_CONTENT,false),REFERENCE_ONLY_CONTENT);
});
