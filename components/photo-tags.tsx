'use client';
import {useState} from 'react';
import {Tag,X} from 'lucide-react';
import {AREAS,IMAGE_TYPES,TIMES,WEATHER,canEditPhoto,emptyTags,type GalleryPhoto,type PhotoTags} from '@/lib/gallery';

export function TagChoices({value,onChange,disabled=false,context="photo"}:{value:PhotoTags;onChange:(t:PhotoTags)=>void;disabled?:boolean;context?:"photo"|"paper"}){
 const toggle=(key:'imageTypes'|'weather',id:string)=>onChange({...value,[key]:value[key].includes(id)?value[key].filter(t=>t!==id):[...value[key],id]});
 return <div className="photo-tag-fields"><fieldset disabled={disabled}><legend>Type of light / image</legend><div className="tag-choice-list">{IMAGE_TYPES.map(t=><label key={t.id} title={t.de}><input type="checkbox" checked={value.imageTypes.includes(t.id)} onChange={()=>toggle('imageTypes',t.id)}/><span>{t.label}<small>{t.de}</small></span></label>)}</div></fieldset><div className="tag-select-row"><label className="field">Time of day<select disabled={disabled} value={value.timeOfDay} onChange={e=>onChange({...value,timeOfDay:e.target.value})}><option value="">{context==='paper'?'Not tagged':'Use capture time, if known'}</option>{TIMES.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}</select></label><label className="field">Area <span>(optional)</span><select disabled={disabled} value={value.area} onChange={e=>onChange({...value,area:e.target.value})}><option value="">Not tagged</option>{AREAS.map(t=><option value={t.id} key={t.id}>{t.label}</option>)}</select></label></div><fieldset disabled={disabled}><legend>Weather <span>{context==='paper'?'optional':'optional override'}</span></legend><div className="tag-chip-choices">{WEATHER.map(t=><label key={t.id}><input type="checkbox" checked={value.weather.includes(t.id)} onChange={()=>toggle('weather',t.id)}/><span>{t.label}</span></label>)}</div></fieldset></div>;
}

export default function PhotoTagEditor({photo,available,localOnly=false,onSaved}:{photo:GalleryPhoto;available:boolean;localOnly?:boolean;onSaved:(tags:PhotoTags)=>void}){
 const[value,setValue]=useState<PhotoTags>(photo.tags??emptyTags()),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(){
  if(localOnly){onSaved(value);setOpen(false);return;}
  setBusy(true);setError('');try{const r=await fetch(`/api/photos/${photo.id}/tags`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});const data=await r.json();if(!r.ok)throw Error(data.error||'Tags could not be saved.');onSaved(data.tags);setOpen(false);}catch(e){setError(e instanceof Error?e.message:'Tags could not be saved.')}finally{setBusy(false);}
 }
 const tags=photo.tags??emptyTags(),labels=IMAGE_TYPES.filter(t=>tags.imageTypes.includes(t.id));
 const all=[...labels.map(t=>t.label),...(tags.timeOfDay?[TIMES.find(t=>t.id===tags.timeOfDay)?.label]:[]),...tags.weather.map(id=>WEATHER.find(t=>t.id===id)?.label),...(tags.area?[AREAS.find(t=>t.id===tags.area)?.label]:[])].filter(Boolean) as string[];
 const lines=all.length?<span className="tag-lines">{all.map(t=><span key={t}>{t}</span>)}</span>:null;
 const editable=canEditPhoto(photo);
 // Laid out like the tags on Working notes sheets: one line with a tag icon; tapping it opens the choices.
 return <section className="photo-tag-editor photo-tag-line"><h3>Tags</h3>{editable?<button type="button" className="paper-tags-trigger" aria-expanded={open} onClick={()=>{setValue(photo.tags??emptyTags());setOpen(v=>!v)}}><Tag size={12}/>{lines??'add tags'}</button>:<p className="paper-tags-trigger is-static"><Tag size={12}/>{lines??'no tags yet'}</p>}{open&&<div className="paper-tags-editor"><div className="paper-tags-heading"><span>tags</span><button type="button" aria-label="Close tags" disabled={busy} onClick={()=>setOpen(false)}><X size={14}/></button></div><TagChoices context="paper" value={value} onChange={setValue} disabled={busy||(!available&&!localOnly)}/>{!available&&!localOnly&&<p className="paper-tag-status">Saving tags needs a separate backend setup. Your existing photograph is unchanged.</p>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="paper-tag-actions"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>cancel</button><button type="button" disabled={busy||(!available&&!localOnly)} onClick={save}>{busy?'saving…':localOnly?'apply to preview':'save tags'}</button></div></div>}{localOnly&&<p className="paper-tag-status">These tags stay in this preview only.</p>}</section>;
}
