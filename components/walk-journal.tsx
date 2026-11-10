'use client';
import {ArrowLeft,ArrowUpRight,Footprints} from 'lucide-react';
import {formatDuration,type Walk} from '@/lib/walks';

type Impression={id:string;title:string;url:string;createdAt:number;place:string;walk?:string};

const day=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const time=(t:number)=>new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

/** Walks tab in the sidebar: all recorded walks, or one walk with its impressions. */
export default function WalkJournal({walks,impressions,selected,loading,onSelect,onStart,onContinue,onImpression}:{walks:Walk[];impressions:Impression[];selected:string|null;loading:boolean;onSelect:(id:string|null)=>void;onStart:()=>void;onContinue:(w:Walk)=>void;onImpression:(p:Impression)=>void}){
 const walk=walks.find(w=>w.id===selected);

 if(walk){
  const pins=impressions.filter(p=>p.walk===walk.id).sort((a,b)=>a.createdAt-b.createdAt);
  const n=walks.length-walks.indexOf(walk);
  return <div className="walk-journal">
   <button className="walk-back" onClick={()=>onSelect(null)}><ArrowLeft size={13}/>All walks</button>
   <div className="eyebrow"><span className="live-dot"/> WALK / {String(n).padStart(3,'0')} · {day(walk.startedAt).toUpperCase()}</div>
   <h2>{walk.title||'Untitled walk'}.</h2>
   <p className="walk-summary">{walk.mine?'Your walk':`Walked by ${walk.author}`} · started {time(walk.startedAt)}{walk.endedAt?`, ended ${time(walk.endedAt)}`:''}</p>
   <div className="walk-stats"><div><strong>{(walk.distance/1000).toFixed(1)}</strong><span>KM / ROUTE</span></div><div><strong>{Math.round(walk.duration/60)}</strong><span>MIN / WALKING</span></div><div><strong>{String(pins.length).padStart(2,'0')}</strong><span>IMPRESSIONS</span></div></div>
   {walk.mine&&walk.status!=='ended'&&<button className="primary walk-continue" onClick={()=>onContinue(walk)}>Continue this walk <ArrowUpRight size={14}/></button>}
   <section className="walk-stops">
    <div className="section-label"><span>IMPRESSIONS ALONG THE WAY</span><span>{pins.length}</span></div>
    {!pins.length&&<p className="walk-empty-note">No impressions on this walk.</p>}
    {pins.map((p,i)=><button key={p.id} className="walk-stop" onClick={()=>onImpression(p)}>
     <span className="walk-stop-index">{String(i+1).padStart(2,'0')}</span>
     <div className="walk-stop-text">
      <div><strong>{p.title}</strong><span>{time(p.createdAt)}</span></div>
      <p>{p.place}</p>
      <div className="walk-stop-image"><img src={p.url} alt={p.title} loading="lazy"/></div>
     </div>
     <ArrowUpRight size={12}/>
    </button>)}
   </section>
  </div>;
 }

 return <div className="walk-journal">
  <div className="eyebrow"><span className="live-dot"/> REFLECTIVE WALKS</div>
  <h1>Reflective walks<span className="chat-dot">.</span></h1>
  <p className="walk-summary">Record a walk on your phone. Pin impressions where the light catches you.</p>
  <button className="primary walk-start-inline" onClick={onStart}><Footprints size={15}/>Start a walk</button>
  <section className="walk-list">
   <div className="section-label"><span>ALL WALKS</span><span>{walks.length}</span></div>
   {loading&&!walks.length&&<p className="walk-empty-note">Loading walks…</p>}
   {!loading&&!walks.length&&<p className="walk-empty-note">No walks yet. Start one when you head out.</p>}
   {walks.map((w,i)=>{const count=impressions.filter(p=>p.walk===w.id).length;return <button key={w.id} className="walk-row" onClick={()=>onSelect(w.id)}>
    <span className="walk-stop-index">{String(walks.length-i).padStart(2,'0')}</span>
    <div><strong>{w.title||'Untitled walk'}</strong>
     <p>{day(w.startedAt)} · {(w.distance/1000).toFixed(1)} km · {formatDuration(w.duration)} · {count} {count===1?'impression':'impressions'}</p>
     <span>{w.status!=='ended'?(w.mine?'In progress':`${w.author} · in progress`):w.mine?'Your walk':w.author}</span>
    </div>
    <ArrowUpRight size={13}/>
   </button>;})}
  </section>
 </div>;
}
