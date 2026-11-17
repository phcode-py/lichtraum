export type PaperEntryChange={entryId:string;content:string;imageKey?:string|null;delete?:true};
export function parsePaperEntryChanges(value:unknown):PaperEntryChange[]|null{
 if(!Array.isArray(value)||!value.length||value.length>100)return null;
 const ids=new Set<string>(),changes:PaperEntryChange[]=[];
 for(const item of value){
  if(!item||typeof item!=='object'||typeof item.entryId!=='string'||!item.entryId||ids.has(item.entryId))return null;
  if(item.delete===true){if(Object.hasOwn(item,'imageKey')||item.content!==undefined&&typeof item.content!=='string')return null;ids.add(item.entryId);changes.push({entryId:item.entryId,content:typeof item.content==='string'?item.content:'',delete:true});continue;}
  if(item.delete!==undefined||typeof item.content!=='string'||!item.content.trim()||item.content.trim().length>800)return null;
  if(Object.hasOwn(item,'imageKey')&&item.imageKey!==null&&typeof item.imageKey!=='string')return null;
  ids.add(item.entryId);changes.push({entryId:item.entryId,content:item.content.trim(),...(Object.hasOwn(item,'imageKey')?{imageKey:item.imageKey}:{})});
 }
 return changes;
}
export function chatMessageSide(message:{author:string;authorId?:string}):'left'|'right'{
 if(/\blena\b/i.test(message.author))return 'left';
 if(/\bmona\b/i.test(message.author))return 'right';
 let hash=0;for(const character of message.authorId??message.author)hash=(hash*31+character.charCodeAt(0))|0;
 return (hash&1)?'right':'left';
}
