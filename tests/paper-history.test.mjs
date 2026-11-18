import test from 'node:test';
import assert from 'node:assert/strict';
import {historyPage,historyCursor} from '../lib/paper-history.ts';
const id='00000000-0000-4000-8000-000000000001';
test('entry history uses a stable time/id cursor and rejects query injection',()=>{
 const time='2026-11-18T10:00:00.123456+00:00';
 const cursor=historyCursor([{id,created_at:time}]);
 const page=historyPage(new Request('http://local/?before='+encodeURIComponent(cursor)));
 assert.equal(page.filter,`created_at.lt.${time},and(created_at.eq.${time},id.lt.${id})`);
 for(const cursor of ['invalid','null','{}',JSON.stringify([time,'x),owner.eq.other']),JSON.stringify(['now()',id])])assert.equal(historyPage(new Request('http://local/?before='+encodeURIComponent(cursor))),null);
 assert.deepEqual(historyPage(new Request('http://local/')),{filter:null});assert.equal(historyCursor([]),null);
});
