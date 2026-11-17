'use client';
import {useEffect,useRef,useState} from 'react';
import {Pencil,X} from 'lucide-react';
import type {Walk} from '@/lib/walks';
import WalkEditor from './walk-editor';
export default function WalkActions({walk,onSaved,onRemoved}:{walk:Walk;onSaved:(walk:Walk)=>void;onRemoved:(id:string)=>void}){
 const[mode,setMode]=useState<'edit'|'remove'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(mode==='remove')dialog.current?.showModal()},[mode]);
 function open(next:'edit'|'remove'){setError('');setMode(next)}
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await fetch('/api/walks/'+walk.id,{method:'DELETE'});const data=await r.json();if(!r.ok)throw Error(data.error||'Your walk could not be updated.');setMode(null);onRemoved(walk.id)}catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 if(!walk.mine)return null;
 return <><div className="owner-actions"><button aria-label={'Edit '+(walk.title||'walk')} title="Edit walk" onClick={()=>open('edit')}><Pencil size={16}/></button></div>
 {mode==='edit'&&<WalkEditor walk={walk} onSaved={onSaved} onClose={()=>setMode(null)} onRemove={()=>open('remove')}/>}
 {mode==='remove'&&<dialog className="manage-dialog" ref={dialog} aria-label="Remove walk" onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation()}} onCancel={e=>{e.preventDefault();if(!busy)setMode(null)}}><form onSubmit={submit}><button className="manage-close" aria-label="Close walk controls" type="button" disabled={busy} onClick={()=>setMode(null)}><X size={18}/></button><p className="eyebrow">YOUR WALK</p><h2>remove this walk?</h2><p className="manage-warning">“{walk.title||'Untitled walk'}” and its recorded route will be permanently removed. Its photographs will stay in the light atlas.</p>{walk.status!=='ended'&&<p className="manage-warning">Finish this walk before removing it.</p>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="manage-actions"><button type="button" disabled={busy} onClick={()=>setMode(null)}>keep walk</button><button disabled={busy||walk.status!=='ended'}>{busy?'removing…':'remove walk'}</button></div></form></dialog>}</>;
}
