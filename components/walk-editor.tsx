'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Trash2,X} from 'lucide-react';
import type {Walk} from '@/lib/walks';
import {fromZurichInput,parseWalkDetails,zurichInput} from '@/lib/walk-details';

/** One form for adding a past walk and revisiting your own existing walks. */
export default function WalkEditor({walk,onSaved,onClose,onRemove}:{onRemove?:()=>void;walk?:Walk;onSaved:(walk:Walk)=>void;onClose:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [initial]=useState(()=>{
  const end=walk?.endedAt??Math.floor((Date.now()-86_400_000)/60_000)*60_000;
  return {start:zurichInput(walk?.startedAt??end-3_600_000),end:zurichInput(end),distance:String((walk?.distance??0)/1000),minutes:String((walk?.duration??3600)/60)};
 });
 const [title,setTitle]=useState(walk?.title??''),[shared,setShared]=useState(walk?.shared??false);
 const [start,setStart]=useState(initial.start),[end,setEnd]=useState(initial.end),[distance,setDistance]=useState(initial.distance),[minutes,setMinutes]=useState(initial.minutes);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const finished=!walk||walk.status==='ended';
 const changed=!walk||start!==initial.start||end!==initial.end||distance!==initial.distance||minutes!==initial.minutes;
 useEffect(()=>{dialog.current?.showModal()},[]);
 async function save(event:React.FormEvent){
  event.preventDefault();setError('');
  let details;
  if(finished&&changed){
   const startedAt=fromZurichInput(start,walk?.startedAt),endedAt=fromZurichInput(end,walk?.endedAt??undefined);
   if(!startedAt||!endedAt){setError('Choose valid Zürich times. That time may not exist on a clock-change day.');return;}
   if(distance.trim()===''||minutes.trim()===''){setError('Enter the distance and walking time. Use 0 if unknown.');return;}
   const result=parseWalkDetails({startedAt,endedAt,distance:Number(distance)*1000,duration:Number(minutes)*60});
   if(!result.details){setError(result.error);return;}details=result.details;
  }
  setBusy(true);
  try{
   const r=await fetch(walk?'/api/walks/'+walk.id:'/api/walks',{method:walk?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.trim(),shared,...(!walk?{kind:'past'}:{}),...(details?{details}:{}),withPath:true})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Your walk could not be saved.');
   onSaved(data.walk);onClose();
  }catch(e){setError(e instanceof Error?e.message:'Your walk could not be saved.');setBusy(false)}
 }
 return <dialog ref={dialog} className="manage-dialog walk-editor" aria-label={walk?'Edit walk':'Add a past walk'} onCancel={e=>{e.preventDefault();if(!busy)onClose()}} onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation()}}>
  <form onSubmit={save}>
   <button className="manage-close" type="button" aria-label="Close walk editor" disabled={busy} onClick={onClose}><X size={18}/></button>
   <p className="eyebrow">{walk?'YOUR WALK / REVISIT':'WALK JOURNAL / FROM MEMORY'}</p>
   <h2>{walk?'Edit your walk.':'A walk worth keeping.'}</h2>
   <p className="walk-editor-intro">{walk?'Return to the details whenever you like.':'Add a walk you have already taken. Keep its moments in your atlas.'}</p>
   <fieldset disabled={busy} className="upload-fields">
    <label className="field">Walk name<input autoFocus required maxLength={100} placeholder="An afternoon along the Limmat" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    {finished?<>
     <div className="walk-editor-time"><label className="field">Started<input type="datetime-local" required step="1" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="field">Finished<input type="datetime-local" required step="1" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
     <p className="walk-editor-note">Dates and times in Zürich.</p>
     <div className="walk-editor-totals"><label className="field">Distance <span>km</span><input type="number" required min="0" max="1000" step="any" inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)}/></label><label className="field">Walking time <span>minutes</span><input type="number" required min="0" step="any" inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div>
     {!walk&&<p className="walk-editor-note">No GPS route needed. Use 0 for distance or walking time if unknown. Add photos and videos after saving.</p>}
    </>:<p className="walk-editor-note">Finish this walk to edit its dates, distance and walking time.</p>}
    <label className="share-photo"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/><span>Share in our walks<small>{shared?'Visible to everyone signed in to Lichtraum.':'Only you can see this walk.'}</small></span></label>
   </fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="manage-actions">{walk&&onRemove&&walk.status==='ended'&&<button className="walk-editor-remove" type="button" aria-label={'Remove '+(walk.title||'walk')} title="Remove walk" disabled={busy} onClick={onRemove}><Trash2 size={16}/></button>}<button type="button" disabled={busy} onClick={onClose}>cancel</button><button disabled={busy||!title.trim()}>{busy?'saving…':walk?'save changes':'add past walk'}<ArrowUpRight size={15}/></button></div>
  </form>
 </dialog>;
}
