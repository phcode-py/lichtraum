export const HISTORY_PAGE_SIZE=100;
/** Only validated timestamp/UUID values reach the query filter. */
export function historyPage(request:Request){
 const cursor=new URL(request.url).searchParams.get('before');if(!cursor)return {filter:null};
 try{const [time,id]=JSON.parse(cursor);if(typeof time!=='string'||!/^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)$/.test(time)||!Number.isFinite(Date.parse(time))||typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return null;return {filter:`created_at.lt.${time},and(created_at.eq.${time},id.lt.${id})`}}catch{return null}
}
export function historyCursor(rows:{created_at:string;id:string}[]){const last=rows[rows.length-1];return last?JSON.stringify([last.created_at,last.id]):null}
