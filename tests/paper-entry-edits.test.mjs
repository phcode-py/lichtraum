import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePaperEntryChanges,chatMessageSide} from '../lib/paper-entry-edits.ts';
test('batch changes distinguish keeping, replacing and removing reference files',()=>{
 assert.deepEqual(parsePaperEntryChanges([{entryId:'a',content:' A '},{entryId:'b',content:'B',imageKey:null},{entryId:'c',content:'C',imageKey:'owned/new'}]),[{entryId:'a',content:'A'},{entryId:'b',content:'B',imageKey:null},{entryId:'c',content:'C',imageKey:'owned/new'}]);
 for(const invalid of [[],null,[{entryId:'a',content:''}],[{entryId:'a',content:'A',imageKey:12}],[{entryId:'a',content:'A'},{entryId:'a',content:'B'}]])assert.equal(parsePaperEntryChanges(invalid),null);
});
test('Lena and Mona keep opposite chat sides regardless of which person is viewing',()=>{
 assert.equal(chatMessageSide({author:'Lena Heidl',authorId:'one'}),'left');assert.equal(chatMessageSide({author:'Mona',authorId:'two'}),'right');
 assert.equal(chatMessageSide({author:'Architect',authorId:'stable'}),chatMessageSide({author:'Renamed architect',authorId:'stable'}));
});

test('explicit entry removal is accepted separately from rewriting or changing a file',()=>{
 assert.deepEqual(parsePaperEntryChanges([{entryId:'note',delete:true}]),[{entryId:'note',content:'',delete:true}]);
 assert.equal(parsePaperEntryChanges([{entryId:'note',delete:true,imageKey:null}]),null);
 assert.equal(parsePaperEntryChanges([{entryId:'note',content:'Note',delete:'true'}]),null);
});
