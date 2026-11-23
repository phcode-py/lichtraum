'use client';
import WalkPeople from './walk-people';
import {ArrowLeft,ArrowUpRight,Play,Plus,Layers,Eye} from 'lucide-react';
import {type ReactNode,useState} from 'react';
import type {WalkRouteDraft} from '@/lib/walk-route';
import PhotoEdit from './photo-edit';
import WalkActions from './walk-actions';
import WalkEditor from './walk-editor';
import AtlasPictureCard from './atlas-picture-card';
import {canEditPhoto,type GalleryPhoto} from '@/lib/gallery';
import {formatDuration,type Walk} from '@/lib/walks';

export type Impression=Omit<GalleryPhoto,'caption'|'lat'|'lng'>&{caption?:string;lat?:number;lng?:number};

const day=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Zurich'});
const time=(t:number)=>new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Zurich'});

/** Walks tab in the sidebar: all recorded walks, or one walk with its impressions. */
export default function WalkJournal({onOpenPicture,tracingVisible,onTracingToggle,filmstripOpen,onFilmstrip,routeDraft,onRouteChange,momentForm,onImpressionSaved,walks,impressions,selected,loading,onSelect,onStart,onContinue,onSaved,onRemoved,onCreated,onAddMoment}:{onOpenPicture?:(id:string)=>void;tracingVisible:boolean;onTracingToggle:()=>void;filmstripOpen:boolean;onFilmstrip:()=>void;momentForm?:ReactNode;onImpressionSaved:(p:Impression)=>void;routeDraft:WalkRouteDraft|null;onRouteChange:(draft:WalkRouteDraft|null)=>void;onCreated:(walk:Walk)=>void;onAddMoment:(walk:Walk)=>void;walks:Walk[];impressions:Impression[];selected:string|null;loading:boolean;onSelect:(id:string|null)=>void;onStart:()=>void;onContinue:(w:Walk)=>void;onSaved:(walk:Walk)=>void;onRemoved:(id:string)=>void}){
 const [editingMoment,setEditingMoment]=useState<string|null>(null),[revealedMoment,setRevealedMoment]=useState<string|null>(null);
 const [addingPast,setAddingPast]=useState(false);
 const [editing,setEditing]=useState<string|null>(null);
 const walk=walks.find(w=>w.id===selected);

 if(walk){
  const pins=impressions.filter(p=>p.walk===walk.id).sort((a,b)=>a.createdAt-b.createdAt);
  const n=walks.length-walks.indexOf(walk);
  return <div className="walk-journal walk-detail">
   <button className="walk-back" aria-label="Back to all walks" title="Back to all walks" onClick={()=>{setEditing(null);onSelect(null)}}><ArrowLeft size={17}/></button>
   {editing===walk.id?<WalkEditor routeDraft={routeDraft} onRouteChange={onRouteChange} key={walk.id} walk={walk} number={String(n).padStart(3,'0')} onSaved={onSaved} onRemoved={onRemoved} onClose={()=>setEditing(null)}/>:<>
   <div className="walk-title-row"><h2><span className="walk-detail-number">{String(n).padStart(3,'0')}</span><span>{walk.title||'Untitled walk'}</span></h2><WalkActions walk={walk} onEdit={()=>setEditing(walk.id)}/></div>
   <div className="walk-detail-dates"><time dateTime={new Date(walk.startedAt).toISOString()}>{day(walk.startedAt)}</time><span className="walk-detail-time"> {time(walk.startedAt)}{walk.endedAt?`-${day(walk.startedAt)===day(walk.endedAt)?'':day(walk.endedAt)+' · '}${time(walk.endedAt)}`:''}</span></div>
   <WalkPeople key={walk.id} walk={walk} onSaved={onSaved}/>
   {walk.description&&<p className="walk-description">{walk.description}</p>}
   <div className="walk-stats"><div><strong>{(walk.distance/1000).toFixed(1)}</strong><span>KM / ROUTE</span></div><div><strong>{Math.round(walk.duration/60)}</strong><span>MIN / WALKING</span></div><div><strong>{String(pins.length).padStart(2,'0')}</strong><span>IMPRESSIONS</span></div></div>
   {walk.mine&&walk.status!=='ended'&&<button className="primary walk-continue" onClick={()=>onContinue(walk)}>Continue this walk <ArrowUpRight size={14}/></button>}
   {!walk.path.length&&walk.status==='ended'&&<p className="walk-route-note">No GPS route recorded. The moments still belong here.</p>}
   <div className="walk-moment-actions">{(walk.mine||walk.canEdit)&&<button className="walk-add-moment" onClick={()=>onAddMoment(walk)}><Plus size={14} strokeWidth={3} aria-hidden="true"/><span>Add a photo or video</span></button>}
   {!!pins.length&&<button className="walk-filmstrip-toggle" aria-expanded={filmstripOpen} onClick={onFilmstrip}><Play size={14} fill="currentColor" aria-hidden="true"/><span>Filmstrip</span></button>}<button type="button" className="walk-tracing-toggle" aria-pressed={tracingVisible} onClick={onTracingToggle}><Layers size={14}/><span>Tracing paper</span>{tracingVisible&&<Eye size={13}/>}</button></div>
   </>}
   {momentForm}
   <section className="walk-stops">
    {!pins.length&&<p className="walk-empty-note">No impressions on this walk.</p>}
    {pins.map(p=><div className="walk-stop-entry" key={p.id}>{editingMoment===p.id&&canEditPhoto(p)?<PhotoEdit photo={{...p,caption:p.caption??''}} onCancel={()=>setEditingMoment(null)} onSaved={photo=>{onImpressionSaved(photo);setEditingMoment(null)}}/>:<AtlasPictureCard walkTitle={walk.title} photo={{...p,caption:p.caption??'',lat:p.lat??NaN,lng:p.lng??NaN}} expanded={revealedMoment===p.id} onToggle={()=>setRevealedMoment(revealedMoment===p.id?null:p.id)} onEdit={canEditPhoto(p)?()=>setEditingMoment(p.id):undefined} onOpen={onOpenPicture?()=>onOpenPicture(p.id):undefined}/>}</div>)}
   </section>
  </div>;
 }

 return <div className="walk-journal">
  <h1 className="section-display">Reflective walks</h1>
  <div className="walk-entry-options"><button className="primary walk-start-inline" onClick={onStart}><span className="walk-ring" aria-hidden="true"/>Start walk</button><button className="walk-past-button" onClick={()=>setAddingPast(true)}><span className="walk-ring walk-ring-filled" aria-hidden="true"/>Add a past walk</button></div>
  {momentForm}
  {addingPast&&<WalkEditor routeDraft={routeDraft} onRouteChange={onRouteChange} onClose={()=>setAddingPast(false)} onSaved={onCreated}/>}
  <section className="walk-list">
   {loading&&!walks.length&&<p className="walk-empty-note">Loading walks…</p>}
   {!loading&&!walks.length&&<p className="walk-empty-note">Your journal is open. Start a walk or add one from memory.</p>}
   {walks.map((w,i)=>{const count=impressions.filter(p=>p.walk===w.id).length;return <div key={w.id} className="walk-row-with-actions"><button className="walk-row" onClick={()=>onSelect(w.id)}>
    <span className="walk-stop-index">{String(walks.length-i).padStart(3,'0')}</span>
    <div><strong>{w.title||'Untitled walk'}</strong>
     <p>{day(w.startedAt)} · {(w.distance/1000).toFixed(1)} km · {formatDuration(w.duration)} · {count} {count===1?'impression':'impressions'}</p>
     <span>{w.status!=='ended'?(w.mine?'In progress':`${w.author} · in progress`):w.participating?'Your shared walk':w.mine?'Your walk':w.author}</span>
    </div>
   </button><WalkActions walk={w} onEdit={()=>{onSelect(w.id);setEditing(w.id)}}/></div>;})}
  </section>
 </div>;
}
