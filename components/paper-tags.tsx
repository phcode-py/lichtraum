'use client';
import {useState} from 'react';
import {Tag,X} from 'lucide-react';
import {TagChoices} from './photo-tags';
import {AREAS,IMAGE_TYPES,TIMES,WEATHER,emptyTags,type PhotoTags} from '@/lib/gallery';
export default function PaperTags({id,value,available,onSaved}:{id:string;value:PhotoTags;available:boolean;onSaved:(value:PhotoTags)=>void}){
 const[open,setOpen]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const labels=[...IMAGE_TYPES.filter(t=>value.imageTypes.includes(t.id)),...TIMES.filter(t=>value.timeOfDay===t.id),...WEATHER.filter(t=>value.weather.includes(t.id)),...AREAS.filter(t=>value.area===t.id)].map(t=>t.label);
 async function save(){
  setBusy(true);setError('');try{const response=await fetch('/api/papers/tags',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({paperId:id,tags:draft})});const result=await response.json();if(!response.ok)throw Error(result.error||'Tags could not be saved.');onSaved(result.tags);setOpen(false)}catch(e){setError(e instanceof Error?e.message:'Tags could not be saved.')}finally{setBusy(false)}
 }
 return <section className="paper-tags" aria-label="Sheet tags"><button type="button" className="paper-tags-trigger" aria-expanded={open} onClick={()=>{setDraft(value??emptyTags());setError('');setOpen(v=>!v)}}><Tag size={12}/>{labels.length?labels.join(' · '):'tags'}</button>{open&&<div className="paper-tags-editor"><div className="paper-tags-heading"><span>tags</span><button type="button" aria-label="Close paper tags" disabled={busy} onClick={()=>setOpen(false)}><X size={14}/></button></div><TagChoices context="paper" value={draft} onChange={setDraft} disabled={busy}/>{!available&&<p className="paper-tag-status">Saving these tags needs the one-time database setup.</p>}{error&&<p className="paper-error" role="alert">{error}</p>}<div className="paper-tag-actions"><button type="button" disabled={busy} onClick={()=>setOpen(false)}>cancel</button><button type="button" disabled={busy||!available} onClick={save}>{busy?'saving…':'save tags'}</button></div></div>}</section>;
}
