'use client';
import {useCallback,useEffect,useState} from 'react';

const KEY='lichtraum-favourites';
const readLocal=():string[]=>{try{const v=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return[]}};
const writeLocal=(ids:Iterable<string>)=>{try{localStorage.setItem(KEY,JSON.stringify([...ids]))}catch{}};

/**
 * The shared favourites: every star is seen by everyone, with who set it.
 * Until the favourites table is set up, stars stay in this browser; afterwards they are
 * added to the shared favourites on the first visit.
 */
export function useFavourites(enabled:boolean){
 const[stars,setStars]=useState<Map<string,string>>(()=>new Map()),[synced,setSynced]=useState(true);
 useEffect(()=>{
  if(!enabled)return;
  let cancelled=false;
  fetch('/api/favourites').then(r=>r.ok?r.json():{available:false,favourites:[]}).then(async(data:{available:boolean;favourites:{photoId:string;by:string}[]})=>{
   if(cancelled)return;
   const local=readLocal();
   if(!data.available){setSynced(false);setStars(new Map(local.map(id=>[id,''])));return;}
   const shared=new Map(data.favourites.map(f=>[f.photoId,f.by])),missing=local.filter(id=>!shared.has(id));
   if(missing.length){const r=await fetch('/api/favourites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:missing,favourite:true})});if(r.ok){const {by}=await r.json();missing.forEach(id=>shared.set(id,by??''));writeLocal([])}}
   else if(local.length)writeLocal([]);
   if(!cancelled){setSynced(true);setStars(shared)}
  }).catch(()=>{if(!cancelled){setSynced(false);setStars(new Map(readLocal().map(id=>[id,''])))}});
  return()=>{cancelled=true};
 },[enabled]);
 const toggle=useCallback((id:string)=>{
  setStars(current=>{
   const next=new Map(current),favourite=!next.has(id);
   if(favourite)next.set(id,'');else next.delete(id);
   if(!synced)writeLocal(next.keys());
   else fetch('/api/favourites',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:[id],favourite})}).then(async r=>{
    if(!r.ok){setSynced(false);writeLocal(next.keys());return;}
    const {by}=await r.json();if(favourite)setStars(s=>new Map(s).set(id,by??''));
   }).catch(()=>{setSynced(false);writeLocal(next.keys())});
   return next;
  });
 },[synced]);
 return {ids:new Set(stars.keys()),starredBy:(id:string)=>stars.get(id)||'',toggle,synced};
}
