'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Camera,Check,MapPin,Trash2} from 'lucide-react';
import {createClient} from '@/lib/supabase/client';
import {MEDIA_ACCEPT,mediaError,uploadMedia} from '@/lib/media';
import {districts,nearestPlace,places,squares} from '@/lib/places';
import {emptyTags,type PhotoTags} from '@/lib/gallery';
import type {PhotoConditions} from '@/lib/photo-conditions';
import {parseZurichDateTime,zurichDateTime} from '@/lib/sun';
import AtlasMedia from './atlas-media';
import PhotoTracing,{type PhotoTracingHandle} from './photo-tracing';
import CaptureConditions from './capture-conditions';
import {TagChoices} from './photo-tags';
import TakenBy from './taken-by';

type Editable={mediaType?:'photo'|'video';id:string;title:string;caption:string;url:string;category?:string;shared?:number;place?:string;lat?:number;lng?:number;walk?:string;conditions?:PhotoConditions|null;tags?:PhotoTags;createdAt?:number;author?:string};
type Point={lat:number;lng:number};
export type EditWalk={id:string;title:string;mine?:boolean;canEdit?:boolean};
/** Lets the edit form borrow the big map for moving the pin. */
export type EditPin={point:Point|null;picking:boolean;onStart:()=>void;onStop:()=>void};

const sameTags=(a:PhotoTags,b:PhotoTags)=>JSON.stringify(a)===JSON.stringify(b);

/** Edit your own photograph or impression with everything chosen at upload. */
export default function PhotoEdit<T extends Editable>({photo,onSaved,onCancel,onDeleted,walks,pin,people=[]}:{photo:T;onSaved:(p:T,notice?:string)=>void;onCancel:()=>void;onDeleted?:(id:string)=>void;walks?:EditWalk[];pin?:EditPin;people?:string[]}){
 const tracing=useRef<PhotoTracingHandle>(null);
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const[title,setTitle]=useState(photo.title),[caption,setCaption]=useState(photo.caption),[shared,setShared]=useState(!!photo.shared);
 const located=typeof photo.lat==='number'&&typeof photo.lng==='number';
 const[place,setPlace]=useState(photo.place??''),[point,setPoint]=useState<Point|null>(located?{lat:photo.lat!,lng:photo.lng!}:null);
 // The date the picture already shows: when it was taken, or else when it was added. It is only saved if changed.
 const initialTime=photo.conditions?zurichDateTime(photo.conditions.capturedAt):photo.createdAt?zurichDateTime(photo.createdAt):'';
 const[time,setTime]=useState(initialTime);
 const[author,setAuthor]=useState(photo.author??'');
 const[walk,setWalk]=useState(photo.walk??''),[tags,setTags]=useState<PhotoTags>(photo.tags??emptyTags());
 const[busy,setBusy]=useState(false),[prep,setPrep]=useState<number|null>(null),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 // A pin dropped on the big map becomes this photograph's new place.
 const pinned=pin?.point;
 // The pin and the Kreis or square are separate: a dropped pin only suggests a place until one is chosen by hand.
 const[autoPlace,setAutoPlace]=useState('');
 const[seenPin,setSeenPin]=useState(pinned);
 if(pinned!==seenPin){setSeenPin(pinned);if(pinned){setPoint(pinned);if(!places.some(x=>x.name===place)||place===autoPlace){const suggested=nearestPlace(pinned.lat,pinned.lng);setAutoPlace(suggested);setPlace(suggested)}}}
 const stopPicking=useRef(pin?.onStop);
 useEffect(()=>{stopPicking.current=pin?.onStop},[pin?.onStop]);
 useEffect(()=>()=>stopPicking.current?.(),[]);
 function choose(f?:File){if(!f)return;const problem=mediaError(f);if(problem){setError(problem);return;}setError('');setFile(f);setPreview(URL.createObjectURL(f));}
 const moved=located&&point!==null&&(point.lat!==photo.lat||point.lng!==photo.lng);
 const capturedAt=time?parseZurichDateTime(time):null;

 /** Removes the picture and its file for good, after the person confirmed it here. */
 async function remove(){
  setBusy(true);setError('');
  try{const r=await fetch(`/api/photos/${photo.id}`,{method:'DELETE'});if(!r.ok)throw new Error('The picture could not be deleted. Try again.');onDeleted?.(photo.id);}
  catch(e){setError(e instanceof Error?e.message:'The picture could not be deleted. Try again.');setBusy(false);}
 }

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(time&&(capturedAt===null||capturedAt>Date.now())){setError('Choose a valid date and time in the past.');return;}
  setBusy(true);setPrep(null);setError('');
  let key='';
  try{
   if(!file&&tracing.current?.hasPending()&&!await tracing.current.savePending()){setBusy(false);return;}
   if(file){const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Your session ended. Sign in again.');key=await uploadMedia(supabase,user.id,file,setPrep);setPrep(null);}
   const timeChanged=capturedAt!==null&&(time!==initialTime||(moved&&!!photo.conditions));
   const body={title,caption,shared,...(key?{key}:{}),...(place.trim()&&place!==photo.place?{place}:{}),...(moved?{lat:point!.lat,lng:point!.lng}:{}),...(walks&&walk!==(photo.walk??'')?{walk}:{}),...(author.trim()&&author.trim()!==(photo.author??'')?{author:author.trim()}:{}),...(timeChanged?{capturedAt}:{})};
   const r=await fetch(`/api/photos/${photo.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await r.json();if(!r.ok)throw new Error(data.error||'Your changes could not be saved.');
   let saved={...photo,...data.photo} as T,notice:string|undefined=data.warning;
   if(!sameTags(tags,photo.tags??emptyTags())){
    const t=await fetch(`/api/photos/${photo.id}/tags`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(tags)});
    const tagData=await t.json().catch(()=>({}));
    if(t.ok)saved={...saved,tags:tagData.tags??tags};else notice=tagData.error||'Your other changes are saved, but the tags could not be saved.';
   }
   onSaved(saved,notice);
  }catch(e){setError(e instanceof Error?e.message:'Your changes could not be saved.');setBusy(false);}
 }

 const walkChoices=walks?.filter(w=>w.mine||w.canEdit||w.id===photo.walk)??[];
 return <form className="photo-edit" onSubmit={save}>
  <div className="photo-edit-image">
   {!preview&&photo.mediaType!=='video'?<PhotoTracing key={photo.id+photo.url} photo={photo} tracingRef={tracing}/>:<AtlasMedia key={preview||photo.url} url={preview||photo.url} title={photo.title} mediaType={file?(file.type.startsWith('video/')?'video':'photo'):photo.mediaType}/>}
   <label className="photo-edit-replace"><Camera size={16} aria-hidden="true"/>
   <input type="file" aria-label="Change photo or video" accept={MEDIA_ACCEPT} disabled={busy} onChange={e=>choose(e.target.files?.[0])}/>
  </label></div>
  <fieldset className="detail-body photo-edit-fields" disabled={busy}>
   <label className="field field-title">Title<input required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></label>
   {located&&<>
    <div className="field location-field">Exact spot<p className={'pin-status '+(point?'located':'')}>{point&&<><Check size={14}/>{point.lat.toFixed(4)}° N, {point.lng.toFixed(4)}° E</>}{pin&&<button type="button" className="pin-move" aria-pressed={pin.picking} onClick={()=>pin.picking?pin.onStop():pin.onStart()}><MapPin size={14}/>{pin.picking?'Click the map…':'Move pin on the map'}</button>}</p></div>
    <label className="field">Kreis or square<select value={places.some(x=>x.name===place)?place:''} onChange={e=>{const p=places.find(x=>x.name===e.target.value);setAutoPlace('');setPlace(p?p.name:photo.place??'')}}><option value="">{place&&!places.some(x=>x.name===place)?place:'Choose a Kreis or square'}</option><optgroup label="Squares">{squares.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</optgroup><optgroup label="Kreise">{districts.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</optgroup></select></label>
    {time?<CaptureConditions time={time} onTime={setTime} point={point}/>:<button type="button" className="add-capture-time" onClick={()=>setTime(zurichDateTime(Date.now()))}>Add when it was taken</button>}
   </>}
   <TakenBy value={author} onChange={setAuthor} people={[...people,...(photo.author?[photo.author]:[])]}/>
   {walks&&<label className="field">Walk <span>(optional)</span><select value={walk} onChange={e=>setWalk(e.target.value)}><option value="">No specific walk</option>{walkChoices.map(w=><option key={w.id} value={w.id}>{w.title||'Untitled walk'}</option>)}</select></label>}
   <label className="field">Description <span>(optional)</span><textarea maxLength={600} rows={3} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="A few words about this moment."/></label>
   <details className="upload-tag-options"><summary>Tags</summary><TagChoices value={tags} onChange={setTags} disabled={busy}/></details>
   <label className="share-photo"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/><span>Share with my walking partner</span></label>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <div className="photo-edit-actions">
    <button type="button" onClick={onCancel}>Cancel</button>
    <button className="primary" disabled={busy||!title.trim()||(!!time&&capturedAt===null)}>{busy?(prep!==null?`Preparing video… ${Math.round(prep*100)}%`:'Saving…'):'Save changes'}<ArrowUpRight size={14}/></button>
   </div>
   {onDeleted&&<div className="photo-edit-delete">{confirmDelete?<><p>Delete this picture from the Light atlas? The photo file is removed too. This cannot be undone.</p><div><button type="button" onClick={()=>setConfirmDelete(false)}>Keep it</button><button type="button" className="danger" onClick={remove}>{busy?'Deleting…':'Delete picture'}</button></div></>:<button type="button" className="delete-icon" aria-label="Delete picture" title="Delete picture" onClick={()=>setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true"/></button>}</div>}
  </fieldset>
 </form>;
}
