'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,Trash2} from 'lucide-react';
import {parseWalkRoute,type WalkRouteDraft} from '@/lib/walk-route';
import type {Walk} from '@/lib/walks';
import {fromZurichInput,parseWalkDetails,zurichInput} from '@/lib/walk-details';

/** One form for adding a past walk and revisiting your own existing walks. */
export default function WalkEditor({walk,onSaved,onClose,onRemoved,number,routeDraft,onRouteChange}:{routeDraft:WalkRouteDraft|null;onRouteChange:(draft:WalkRouteDraft|null)=>void;number?:string;onRemoved?:(id:string)=>void;walk?:Walk;onSaved:(walk:Walk)=>void;onClose:()=>void}) {
 const [confirmRemove,setConfirmRemove]=useState(false),[description,setDescription]=useState(walk?.description??'');
 const [initial]=useState(()=>{
  const end=walk?.endedAt??Math.floor((Date.now()-86_400_000)/60_000)*60_000;
  return {start:zurichInput(walk?.startedAt??end-3_600_000).slice(0,16),end:zurichInput(end).slice(0,16),distance:String((walk?.distance??0)/1000),minutes:String((walk?.duration??3600)/60)};
 });
 const [title,setTitle]=useState(walk?.title??''),[shared,setShared]=useState(walk?.shared??false);
 const [start,setStart]=useState(initial.start),[end,setEnd]=useState(initial.end),[distance,setDistance]=useState(initial.distance),[minutes,setMinutes]=useState(initial.minutes);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const originalRoute=JSON.stringify((walk?.path??[]).map(p=>[p[0],p[1]]));
 const routeChanged=!!routeDraft&&JSON.stringify(routeDraft.points)!==originalRoute;
 useEffect(()=>()=>onRouteChange(null),[onRouteChange]);
 useEffect(()=>{if(routeDraft&&routeChanged){const route=parseWalkRoute(routeDraft.points);if(route)setDistance((route.distance/1000).toFixed(3))}},[routeDraft?.points,routeChanged]);
 const finished=!walk||walk.status==='ended';
 const changed=!walk||start!==initial.start||end!==initial.end||distance!==initial.distance||minutes!==initial.minutes;

 async function save(event:React.FormEvent){
  event.preventDefault();setError('');
  if(routeChanged&&!parseWalkRoute(routeDraft?.points)){setError('Mark at least two points on the route, up to 2,000.');return;}
  let details;
  if(finished&&changed){
   const startedAt=walk&&start===initial.start?new Date(walk.startedAt).toISOString():fromZurichInput(start,walk?.startedAt),endedAt=walk?.endedAt&&end===initial.end?new Date(walk.endedAt).toISOString():fromZurichInput(end,walk?.endedAt??undefined);
   if(!startedAt||!endedAt){setError('Choose valid Zürich times. That time may not exist on a clock-change day.');return;}
   if(distance.trim()===''||minutes.trim()===''){setError('Enter the distance and walking time. Use 0 if unknown.');return;}
   const result=parseWalkDetails({startedAt,endedAt,distance:Number(distance)*1000,duration:Number(minutes)*60});
   if(!result.details){setError(result.error);return;}details=result.details;
  }
  setBusy(true);
  try{
   const r=await fetch(walk?'/api/walks/'+walk.id:'/api/walks',{method:walk?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:title.trim(),...(!walk||walk.mine?{shared}:{}),...(routeChanged?{route:routeDraft!.points}:{}),...(description!== (walk?.description??'')?{description:description.trim()}:{}),...(!walk?{kind:'past'}:{}),...(details?{details}:{}),withPath:true})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Your walk could not be saved.');
   onSaved(data.walk);onClose();
  }catch(e){setError(e instanceof Error?e.message:'Your walk could not be saved.');setBusy(false)}
 }
 async function remove(){
  if(!walk||!onRemoved)return;
  setBusy(true);setError('');
  try{const r=await fetch('/api/walks/'+walk.id,{method:'DELETE'});const data=await r.json();if(!r.ok)throw Error(data.error||'The walk could not be removed.');onRemoved(walk.id);onClose()}catch(e){setError(e instanceof Error?e.message:'Please try again.');setBusy(false)}
 }
 return <div className="walk-editor walk-editor-inline" aria-label={walk?'Edit walk':'Add a past walk'}>
  <form onSubmit={save}>
   <fieldset disabled={busy} className="upload-fields">
    <label className="field walk-inline-title"><span className="sr-only">Walk name</span>{number&&<span className="walk-detail-number" aria-hidden="true">{number}</span>}<input autoFocus required maxLength={100} placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/></label>
    {finished?<>
     <div className="walk-editor-time"><label className="field">Started<input type="datetime-local" required step="60" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="field">Finished<input type="datetime-local" required step="60" value={end} onChange={e=>setEnd(e.target.value)}/></label></div>
     <p className="walk-editor-note">Dates and times in Zürich.</p>
     <label className="field walk-description-field"><span className="sr-only">Walk description</span><textarea aria-label="Walk description" maxLength={2000} rows={3} placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)}/></label>
     {(!walk||walk.mine)&&<div className="walk-route-editor"><button type="button" onClick={()=>onRouteChange({points:routeDraft?.points??(walk?.path??[]).map(p=>[p[0],p[1]]),picking:!routeDraft?.picking})}>{routeDraft?.picking?'Finish marking route':'Mark route on map'}</button>{routeDraft&&<span>{routeDraft.points.length} points</span>}</div>}
     <div className="walk-editor-totals"><label className="field">Distance <span>km</span><input type="number" required min="0" max="1000" step="any" inputMode="decimal" value={distance} onChange={e=>setDistance(e.target.value)}/></label><label className="field">Walking time <span>minutes</span><input type="number" required min="0" step="any" inputMode="decimal" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div>
     {!walk&&<p className="walk-editor-note">No GPS route needed. Use 0 for distance or walking time if unknown. Add photos and videos after saving.</p>}
    </>:<><p className="walk-editor-note">Finish this walk to edit its dates, distance and walking time.</p><label className="field">Description<textarea maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label></>}
    {(!walk||walk.mine)&&<label className="share-photo"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/><span>Share in our walks</span></label>}
   </fieldset>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {confirmRemove&&<div className="walk-remove-confirmation"><p>Remove this walk and its route? Photographs will stay in the light atlas.</p><button type="button" disabled={busy} onClick={()=>setConfirmRemove(false)}>keep walk</button><button type="button" disabled={busy} onClick={remove}>{busy?'removing…':'remove walk'}</button></div>}
   <div className="manage-actions">{walk?.mine&&onRemoved&&walk.status==='ended'&&<button className="walk-editor-remove" type="button" aria-label={'Remove '+(walk.title||'walk')} title="Remove walk" disabled={busy} onClick={()=>setConfirmRemove(v=>!v)}><Trash2 size={16}/></button>}<button type="button" disabled={busy} onClick={onClose}>cancel</button><button disabled={busy||!title.trim()}>{busy?'saving…':walk?'save changes':'add past walk'}<ArrowUpRight size={15}/></button></div>
  </form>
 </div>;
}
