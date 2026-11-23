'use client';
import {useCallback,useEffect,useState} from 'react';

const KEY='lichtraum-favourites';
const readLocal=():string[]=>{try{const v=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return[]}};
const writeLocal=(ids:Set<string>)=>{try{localStorage.setItem(KEY,JSON.stringify([...ids]))}catch{}};

/**
 * Your starred photographs. Saved to your account once the favourites table exists;
 * until then kept in this browser, and moved to the account on the first visit after setup.
 */
export function useFavourites(enabled:boolean){
 const[ids,setIds]=useState<Set<string>>(()=>new Set()),[synced,setSynced]=useState(true);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;
  fetch('/api/favourites').then(r=>r.ok?r.json():{available:false,ids:[]}).then(async(data:{available:boolean;ids:string[]})=>{
   if(cancelled)return;
   const local=readLocal();
   if(!data.available){setSynced(false);setIds(new Set(local));return;}
   const missing=local.filter(id=>!data.ids.includes(id));
   if(missing.length){const r=await fetch('/api/favourites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:missing,favourite:true})});if(r.ok)writeLocal(new Set())}
   else if(local.length)writeLocal(new Set());
   if(!cancelled){setSynced(true);setIds(new Set([...data.ids,...missing]))}
  }).catch(()=>{if(!cancelled){setSynced(false);setIds(new Set(readLocal()))}});
  return()=>{cancelled=true};
 },[enabled]);
 const toggle=useCallback((id:string)=>{
  setIds(current=>{
   const next=new Set(current),favourite=!next.has(id);
   if(favourite)next.add(id);else next.delete(id);
   if(!synced)writeLocal(next);
   else fetch('/api/favourites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[id],favourite})}).then(r=>{if(!r.ok){setSynced(false);writeLocal(next)}}).catch(()=>{setSynced(false);writeLocal(next)});
   return next;
  });
 },[synced]);
 return {ids,toggle,synced};
}
