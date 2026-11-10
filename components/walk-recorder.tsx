'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map,Marker,GeoJSONSource} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {Camera,Check,LocateFixed,Pause,Play,Square} from 'lucide-react';
import {mapStyle} from './photo-map';
import {createClient} from '@/lib/supabase/client';
import {prepareImage,uploadImage} from '@/lib/image';
import {inZurich,nearestPlace} from '@/lib/places';
import {defaultWalkTitle,formatDuration,metres,segments,type Walk,type WalkPoint} from '@/lib/walks';

type Impression={id:string;title:string;lat:number;lng:number;url:string;walk?:string};
type Fix={lng:number;lat:number;acc:number;t:number};
type Status='recording'|'paused'|'saving'|'ended';

const MAX_ACCURACY=40;   // metres; weaker fixes move the dot but are not recorded
const MIN_STEP=6;        // metres between recorded points
const SAVE_EVERY=15000;  // ms
const round=(n:number)=>Math.round(n*1e6)/1e6;

/**
 * Full-screen walk recording, designed for an iPhone held in the hand:
 * the map follows you, the route draws as you go, and only time, distance and impressions are shown.
 */
export default function WalkRecorder({walk,impressions,startPaused,onImpression,onDone}:{walk:Walk;impressions:Impression[];startPaused:boolean;onImpression:(photo:Impression)=>void;onDone:(walk:Walk)=>void}){
 const[status,setStatus]=useState<Status>(startPaused?'paused':'recording');
 const statusRef=useRef<Status>(status);
 useEffect(()=>{statusRef.current=status;},[status]);
 const[stats,setStats]=useState({metres:walk.distance,seconds:walk.duration});
 const[gps,setGps]=useState<'waiting'|'ok'|'weak'|'denied'|'unavailable'>(()=>typeof navigator!=='undefined'&&!('geolocation' in navigator)?'unavailable':'waiting');
 const[following,setFollowing]=useState(true);const followRef=useRef(true);
 useEffect(()=>{followRef.current=following;},[following]);
 const[uploading,setUploading]=useState(0);
 const[message,setMessage]=useState('');
 const[endArmed,setEndArmed]=useState(false);
 const[title,setTitle]=useState(walk.title||defaultWalkTitle(new Date(walk.startedAt)));
 const[saveError,setSaveError]=useState('');

 // Track, kept in refs so GPS updates don't re-render the whole screen.
 const storeKey=`lichtraum-walk-${walk.id}`;
 const path=useRef<WalkPoint[]>([...walk.path]);
 const pending=useRef<WalkPoint[]>([]);
 const seg=useRef(walk.path.length?walk.path[walk.path.length-1][3]+1:0);
 const distance=useRef(walk.distance);
 const movedMs=useRef(walk.duration*1000);
 const recordingSince=useRef<number|null>(null);
 useEffect(()=>{if(!startPaused)recordingSince.current=Date.now();},[startPaused]);
 const lastFix=useRef<Fix|null>(null);
 const pinAt=useRef<Fix|null>(null);
 const saving=useRef(false);
 const wakeLock=useRef<WakeLockSentinel|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);

 const element=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null),lib=useRef<typeof import('maplibre-gl')|null>(null);
 const you=useRef<Marker|null>(null),pins=useRef<Marker[]>([]);
 const[ready,setReady]=useState(false);

 const seconds=()=>(movedMs.current+(recordingSince.current?Date.now()-recordingSince.current:0))/1000;

 // Points that never reached the server (closed tab, no signal) are kept on the phone and sent later.
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(storeKey)||'[]') as WalkPoint[];const last=path.current.at(-1)?.[2]??0;const fresh=saved.filter(p=>p[2]>last);if(fresh.length){path.current.push(...fresh);pending.current.push(...fresh);}}catch{}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function remember(){try{if(pending.current.length)localStorage.setItem(storeKey,JSON.stringify(pending.current));else localStorage.removeItem(storeKey);}catch{}}

 async function save(extra:Record<string,unknown>={},keepalive=false){
  if(!keepalive)for(let i=0;saving.current&&i<100;i++)await new Promise(r=>setTimeout(r,100)); // wait for a save in flight
  saving.current=true;
  const points=pending.current.splice(0);
  try{
   const r=await fetch(`/api/walks/${walk.id}`,{method:'PATCH',keepalive,headers:{'Content-Type':'application/json'},body:JSON.stringify({...(points.length?{points,distance:distance.current}:{}),duration:Math.round(seconds()),...extra})});
   if(!r.ok)throw new Error();
   return (await r.json()).walk as Walk;
  }catch{pending.current.unshift(...points);return null;}
  finally{saving.current=false;remember();}
 }

 function trackData(){return {type:'Feature' as const,properties:{},geometry:{type:'MultiLineString' as const,coordinates:segments(path.current)}};}
 function drawTrack(){(map.current?.getSource('track') as GeoJSONSource|undefined)?.setData(trackData());}
 // --- Map
 useEffect(()=>{let cancelled=false;
  import('maplibre-gl').then(M=>{if(cancelled||!element.current)return;lib.current=M;
   const start=path.current.at(-1);
   const m=new M.Map({container:element.current,style:mapStyle,center:start?[start[0],start[1]]:[8.5399,47.3709],zoom:16.5,minZoom:11,maxZoom:18.5,pitchWithRotate:false,dragRotate:false,attributionControl:{compact:true},canvasContextAttributes:{antialias:false}});
   m.touchZoomRotate.disableRotation();map.current=m;
   m.on('dragstart',()=>setFollowing(false));
   m.on('load',()=>{if(cancelled)return;
    element.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'); // keep the credit line folded
    m.addSource('track',{type:'geojson',data:trackData()});
    m.addLayer({id:'track-casing',type:'line',source:'track',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#fff','line-width':9}});
    m.addLayer({id:'track-line',type:'line',source:'track',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#2446e8','line-width':4}});
    const dot=document.createElement('span');dot.className='walk-you';you.current=new M.Marker({element:dot});
    const f=lastFix.current;if(f){you.current.setLngLat([f.lng,f.lat]).addTo(m);m.jumpTo({center:[f.lng,f.lat]});} // a fix that arrived before the map
    setReady(true);});
  });
  return()=>{cancelled=true;pins.current.forEach(p=>p.remove());map.current?.remove();map.current=null;};
 },[]);

 // Impression pins
 useEffect(()=>{const m=map.current,M=lib.current;if(!ready||!m||!M)return;
  pins.current.forEach(p=>p.remove());
  pins.current=impressions.map(p=>{const node=document.createElement('span');node.className='walk-pin';node.style.backgroundImage=`url("${p.url}")`;return new M.Marker({element:node,anchor:'bottom'}).setLngLat([p.lng,p.lat]).addTo(m);});
 },[ready,impressions]);

 // --- GPS: always watching while this screen is open; only recorded while “recording”.
 useEffect(()=>{
  if(!('geolocation' in navigator))return;
  const id=navigator.geolocation.watchPosition(pos=>{
   const fix={lng:pos.coords.longitude,lat:pos.coords.latitude,acc:pos.coords.accuracy,t:pos.timestamp/1000};
   lastFix.current=fix;setGps(fix.acc>MAX_ACCURACY?'weak':'ok');
   if(map.current&&you.current){you.current.setLngLat([fix.lng,fix.lat]);if(!you.current.getElement().isConnected)you.current.addTo(map.current);if(followRef.current)map.current.easeTo({center:[fix.lng,fix.lat],duration:700});}
   if(statusRef.current!=='recording'||fix.acc>MAX_ACCURACY)return;
   const prev=path.current.at(-1);
   if(prev&&prev[3]===seg.current){
    const d=metres([prev[0],prev[1]],[fix.lng,fix.lat]);
    if(d<Math.max(MIN_STEP,fix.acc*.5))return;           // standing still / GPS jitter
    if(d/Math.max(1,fix.t-prev[2])>12)return;             // implausible jump (> 43 km/h)
    distance.current+=d;
   }
   const point:WalkPoint=[round(fix.lng),round(fix.lat),Math.round(fix.t),seg.current];
   path.current.push(point);pending.current.push(point);drawTrack();
  },err=>{setGps(err.code===err.PERMISSION_DENIED?'denied':'weak');},{enableHighAccuracy:true,maximumAge:0,timeout:30000});
  return()=>navigator.geolocation.clearWatch(id);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{if(ready)drawTrack();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ready]);

 // Clock + periodic saving while recording
 useEffect(()=>{if(status!=='recording')return;
  const clock=setInterval(()=>setStats({metres:distance.current,seconds:seconds()}),1000);
  const saver=setInterval(()=>{if(pending.current.length)save();},SAVE_EVERY);
  return()=>{clearInterval(clock);clearInterval(saver);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[status]);

 // Keep the screen on while recording (iOS stops GPS when the screen locks).
 useEffect(()=>{
  async function hold(){if(statusRef.current!=='recording'||wakeLock.current||!('wakeLock' in navigator))return;try{wakeLock.current=await navigator.wakeLock.request('screen');wakeLock.current.addEventListener('release',()=>{wakeLock.current=null});}catch{}}
  function onVisibility(){if(document.visibilityState==='hidden'){if(pending.current.length)save({},true);}else hold();}
  if(status==='recording')hold();else{wakeLock.current?.release();wakeLock.current=null;}
  document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',onVisibility);
  return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onVisibility);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[status]);
 useEffect(()=>()=>{wakeLock.current?.release();},[]);

 useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),3500);return()=>clearTimeout(t);},[message]);
 useEffect(()=>{if(!endArmed)return;const t=setTimeout(()=>setEndArmed(false),3000);return()=>clearTimeout(t);},[endArmed]);

 // --- Controls
 function togglePause(){
  if(status==='recording'){movedMs.current+=Date.now()-(recordingSince.current??Date.now());recordingSince.current=null;setStats({metres:distance.current,seconds:seconds()});setStatus('paused');save({status:'paused'});}
  else{seg.current+=1;recordingSince.current=Date.now();setStatus('recording');save({status:'recording'});}
 }
 async function end(){
  if(!endArmed){setEndArmed(true);return;}
  setEndArmed(false);
  if(recordingSince.current){movedMs.current+=Date.now()-recordingSince.current;recordingSince.current=null;}
  setStats({metres:distance.current,seconds:seconds()});
  setStatus('saving');
  const saved=await save({status:'ended'});
  if(!saved){setStatus('paused');setMessage('Could not reach the server. Your walk is safe on this phone. Try again.');return;}
  setStatus('ended');
 }
 async function finish(){
  setSaveError('');
  const r=await fetch(`/api/walks/${walk.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.trim()||defaultWalkTitle(new Date(walk.startedAt)),withPath:true})});
  if(!r.ok){setSaveError('The name could not be saved. Try again.');return;}
  try{localStorage.removeItem(storeKey);}catch{}
  onDone((await r.json()).walk);
 }

 // Remember the exact spot at the moment of the tap, then open the camera.
 function addImpression(){
  const fix=lastFix.current;
  if(!fix){setMessage('Waiting for your position…');return;}
  if(!inZurich(fix.lat,fix.lng)){setMessage('Impressions can only be pinned in the Zürich area.');return;}
  pinAt.current=fix;
  if(fileInput.current){fileInput.current.value='';fileInput.current.click();}
 }
 async function onPhoto(file?:File){
  const at=pinAt.current;if(!file||!at)return;
  setUploading(n=>n+1);
  const supabase=createClient();let key='';
  try{
   const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Your session ended. Sign in again.');
   key=await uploadImage(supabase,user.id,await prepareImage(file));
   const number=String(impressions.length+1).padStart(2,'0');
   const r=await fetch('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,title:`Impression ${number}`,caption:'',place:nearestPlace(at.lat,at.lng),lat:at.lat,lng:at.lng,category:'Light',walk:walk.id,shared:walk.shared})});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'The impression could not be saved.');
   onImpression(data.photo);setMessage('Impression pinned.');
  }catch(e){if(key)supabase.storage.from('photos').remove([key]);setMessage(e instanceof Error?e.message:'The impression could not be saved.');}
  finally{setUploading(n=>n-1);}
 }
 function recenter(){setFollowing(true);const f=lastFix.current;if(f)map.current?.easeTo({center:[f.lng,f.lat],zoom:Math.max(map.current.getZoom(),16),duration:500});}

 const km=(stats.metres/1000).toFixed(2);
 const gpsNote=gps==='waiting'?'Finding your position…':gps==='weak'?'Weak GPS signal':gps==='denied'?'Location is off. Allow it in Settings › Safari › Location.':gps==='unavailable'?'This device has no location':'';

 return <div className="walk-rec" data-status={status} role="dialog" aria-label="Walk in progress">
  <div className="walk-rec-map" ref={element}/>
  <div className="walk-rec-top">
   <span className="walk-rec-state"><i/>{status==='recording'?'Recording':status==='saving'?'Saving':status==='ended'?'Walk saved':'Paused'}</span>
   {gpsNote&&status!=='ended'&&<span className="walk-rec-gps">{gpsNote}</span>}
  </div>
  {!following&&status!=='ended'&&<button className="walk-rec-locate" aria-label="Follow my position" onClick={recenter}><LocateFixed size={20}/></button>}

  {status==='ended'?<div className="walk-rec-sheet walk-rec-summary">
    <label className="walk-rec-name"><span>Name this walk</span><input value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} enterKeyHint="done"/></label>
    <div className="walk-rec-stats"><div><strong>{formatDuration(stats.seconds)}</strong><span>Time</span></div><div><strong>{km}</strong><span>km</span></div><div><strong>{String(impressions.length).padStart(2,'0')}</strong><span>Impressions</span></div></div>
    {saveError&&<p className="form-error" role="alert">{saveError}</p>}
    <button className="primary walk-rec-impression" onClick={finish}><Check size={18}/>Done</button>
   </div>
  :<div className="walk-rec-sheet">
    <div className="walk-rec-stats"><div><strong>{formatDuration(stats.seconds)}</strong><span>Time</span></div><div><strong>{km}</strong><span>km</span></div><div><strong>{String(impressions.length).padStart(2,'0')}</strong><span>Impressions</span></div></div>
    <button className="primary walk-rec-impression" onClick={addImpression} disabled={status==='saving'}><Camera size={19}/>{uploading?'Pinning impression…':'Add impression'}</button>
    <div className="walk-rec-actions">
     <button onClick={togglePause} disabled={status==='saving'}>{status==='recording'?<><Pause size={16}/>Pause</>:<><Play size={16}/>Resume</>}</button>
     <button className={endArmed?'armed':''} onClick={end} disabled={status==='saving'||uploading>0}>{status==='saving'?'Saving…':endArmed?'Tap again to end':<><Square size={14}/>End walk</>}</button>
    </div>
    <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden onChange={e=>onPhoto(e.target.files?.[0])}/>
   </div>}
  {message&&<div className="walk-rec-message" role="status">{message}</div>}
 </div>;
}
