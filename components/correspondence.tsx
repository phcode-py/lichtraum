'use client';
import {useContext,useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Camera,Video,Pencil,Plus,SlidersHorizontal,Trash2,X} from 'lucide-react';
import {paperCategory,type Paper,type PaperCategory,type PaperMaterial,type SheetSettings} from '@/lib/papers';
import {REFERENCE_IMAGE_ACCEPT,REFERENCE_VIDEO_ACCEPT,referenceError,uploadPaperReference} from '@/lib/paper-references';

import PaperTextEditor from './paper-text-editor';
import PaperTags from './paper-tags';
import PaperFilterOptions from './paper-filters';
import {emptyTags,type PhotoTags} from '@/lib/gallery';
import {emptyPaperFilters,paperFilterCount,paperMatchesFilters,type PaperFilters} from '@/lib/paper-filters';
import {findPaperSpace} from '@/lib/paper-placement';
import {paperTextPlain} from '@/lib/paper-text';

import Entries,{PaperReferenceUploadContext,type EntriesHandle,type ChatDates} from './paper-entries';
export {PaperReferenceUploadContext} from './paper-entries';

type Position={x:number;y:number};

// Each sheet keeps its own irregular tape arrangement while it is moved or refreshed.
function paperTape(id:string):CSSProperties[]{
 let seed=2166136261;
 for(const character of id)seed=Math.imul(seed^character.charCodeAt(0),16777619)>>>0;
 const count=2+seed%4;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const extra=['bottom-left','bottom-right','side'];
 for(let i=extra.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[extra[i],extra[j]]=[extra[j],extra[i]]}
 return ['top-left','top-right',...extra].slice(0,count).map(edge=>{
  const width=14+random()*5,height=37+random()*12;
  const style:CSSProperties={width,height,transform:`rotate(${random()*20-10}deg)`,clipPath:`polygon(0 ${random()*5}%,${96+random()*4}% 0,100% ${95+random()*5}%,${random()*5}% 100%)`};
  if(edge==='side'){style.left=random()>.5?'-8px':'calc(100% - 8px)';style.top=`${35+random()*28}%`}
  else{style.left=`${edge.endsWith('left')?12+random()*12:73+random()*12}%`;if(edge.startsWith('top'))style.top=-height*(.4+random()*.12);else style.bottom=-height*(.4+random()*.12)}
  return style;
 });
}

function PaperMaterialControl({value,onChange,disabled=false}:{value:PaperMaterial;onChange:(value:PaperMaterial)=>void;disabled?:boolean}){
 return <fieldset className="paper-material-toggle" disabled={disabled}><legend className="sr-only">Paper type</legend><button type="button" aria-pressed={value==='opaque'} onClick={()=>onChange('opaque')}>paper</button><button type="button" aria-pressed={value==='tracing'} onClick={()=>onChange('tracing')}>tracing paper</button></fieldset>;
}

function Receipt({createdAt,updatedAt,id,title,subtitle,description,position,onMove,onSave,onFocus,layer,children,onEdit,titleEditor,editor,tagControl,material='opaque'}:{tagControl?:ReactNode;description?:string;createdAt?:number;updatedAt?:number;titleEditor?:ReactNode;editor?:ReactNode;onEdit:()=>void;material?:PaperMaterial;id:string;title:string;subtitle:string;position:Position;onMove:(p:Position)=>void;onSave:(p:Position)=>void;onFocus:()=>void;layer:number;children:ReactNode}){
 const drag=useRef<{pointer:number;x:number;y:number;origin:Position;latest:Position}|null>(null);
 function start(e:ReactPointerEvent<HTMLButtonElement>){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,origin:position,latest:position};onFocus()}
 function move(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p={x:Math.max(0,Math.min(10000,d.origin.x+e.clientX-d.x)),y:Math.max(0,Math.min(10000,d.origin.y+e.clientY-d.y))};d.latest=p;onMove(p)}
 function finish(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.latest.x!==d.origin.x||d.latest.y!==d.origin.y)onSave(d.latest)}
 function keyboard(e:ReactKeyboardEvent<HTMLButtonElement>){const directions:Record<string,Position>={ArrowLeft:{x:-20,y:0},ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20}};const d=directions[e.key];if(!d)return;e.preventDefault();onFocus();const p={x:Math.max(0,Math.min(10000,position.x+d.x)),y:Math.max(0,Math.min(10000,position.y+d.y))};onMove(p);onSave(p)}
 return <article id={'paper-'+id} className={'board-paper'+(material==='tracing'?' tracing-paper':'')} style={{left:position.x,top:position.y,zIndex:layer}} onPointerDown={onFocus} aria-label={title}>
  {paperTape(id).map(({clipPath,...style},index)=><button key={index} type="button" className="paper-tape" style={style} aria-label={`Move ${title} using sticker ${index+1}`} title="Drag to move · arrow keys also work" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={keyboard}><span className="paper-tape-strip" style={{clipPath}}/></button>)}
  <button className="paper-edit-button" type="button" aria-label={'Edit '+title} onClick={onEdit}><Pencil size={14}/></button>
  <header className="paper-heading"><p>{subtitle}</p><h2>{titleEditor??title}</h2><div className="paper-dates"><span><span className="paper-date-label">created</span><time>{createdAt?new Date(createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</time></span><span><span className="paper-date-label">last changed</span><time>{updatedAt?new Date(updatedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</time></span></div>{description&&<p className="paper-chat-description">{description}</p>}{tagControl}</header>{children}{editor}
 </article>;
}

export default function Correspondence({localPreview=false}:{localPreview?:boolean}={}){
 const entryEditors=useRef(new Map<string,EntriesHandle>());
 const[roomDates,setRoomDates]=useState<ChatDates>({});
 const updateRoomDates=useCallback((next:ChatDates)=>setRoomDates(current=>current.createdAt===next.createdAt&&current.updatedAt===next.updatedAt?current:next),[]);
 const[draft,setDraft]=useState<Paper|null>(null),[draftText,setDraftText]=useState(''),[draftFile,setDraftFile]=useState<File|null>(null),[draftPreview,setDraftPreview]=useState('');
 const creation=useRef<Paper|null>(null),draftUpload=useRef<{file:File;key:string}|null>(null),draftBody=useRef<HTMLDivElement>(null);
 const uploadReference=useContext(PaperReferenceUploadContext);
 const[confirmRemoval,setConfirmRemoval]=useState(false);

 const[filters,setFilters]=useState<PaperFilters>(emptyPaperFilters),[filterOpen,setFilterOpen]=useState(false),[category,setCategory]=useState<PaperCategory>('messages');
 const group=filters.group,activeFilters=paperFilterCount(filters);
 const[paperTags,setPaperTags]=useState<Record<string,PhotoTags>>({}),[tagsAvailable,setTagsAvailable]=useState(false);

 const[editing,setEditing]=useState<Paper|null>(null),[settings,setSettings]=useState<Record<string,SheetSettings>>({});
 const[papers,setPapers]=useState<Paper[]>([]),[loading,setLoading]=useState(!localPreview),[error,setError]=useState(''),[title,setTitle]=useState(''),[shared,setShared]=useState(true),[material,setMaterial]=useState<PaperMaterial>('opaque'),[saving,setSaving]=useState(false),[positions,setPositions]=useState<Record<string,Position>>({room:{x:56,y:50},contributors:{x:478,y:144}}),[layers,setLayers]=useState<Record<string,number>>({}),[notice,setNotice]=useState('');
 const filterControl=useRef<HTMLDivElement>(null),filterButton=useRef<HTMLButtonElement>(null);
 const boardRevision=useRef(0);
 const layer=useRef(1),scroller=useRef<HTMLDivElement>(null),pending=useRef(new Set<string>()),positionRequests=useRef(new Map<string,Promise<void>>());
 const load=useCallback(async()=>{
  if(localPreview)return;
  const version=boardRevision.current;
  const results=await Promise.allSettled([fetch('/api/papers').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Papers could not be loaded.');return data.papers as Paper[]}),fetch('/api/papers/settings').then(async r=>{const data=await r.json();if(!r.ok)throw Error();return data.settings as SheetSettings[]}),fetch('/api/papers/tags').then(async r=>{const data=await r.json();if(!r.ok)throw Error();return data as {tags:Record<string,PhotoTags>;available:boolean}})]);
  if(version!==boardRevision.current)return;
  if(results[2].status==='fulfilled'){setPaperTags(results[2].value.tags);setTagsAvailable(results[2].value.available)}else setTagsAvailable(false);
  if(results[1].status==='fulfilled')setSettings(Object.fromEntries(results[1].value.map(s=>[s.id,s])));
  if(results[0].status==='fulfilled'){const list=results[0].value;setPapers(list);setPositions(current=>{const next={...current};for(const p of list)if(!pending.current.has(p.id))next[p.id]={x:p.x,y:p.y};return next});setError('')}else setError(results[0].reason instanceof Error?results[0].reason.message:'Papers could not be loaded.');

  setLoading(false);
 },[localPreview]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},20000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{if(localPreview)return;try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');setPositions(current=>{const next={...current};for(const id of ['room','contributors'])if(saved[id]&&Number.isFinite(saved[id].x)&&Number.isFinite(saved[id].y))next[id]={x:Math.max(0,Math.min(10000,saved[id].x)),y:Math.max(0,Math.min(10000,saved[id].y))};return next})}catch{}},[]);
 useEffect(()=>{if(!draftFile){setDraftPreview('');return;}const url=URL.createObjectURL(draftFile);setDraftPreview(url);return()=>URL.revokeObjectURL(url)},[draftFile]);
 useEffect(()=>{if(!filterOpen)return;function outside(e:globalThis.PointerEvent){if(!filterControl.current?.contains(e.target as Node))setFilterOpen(false)}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[filterOpen]);
 function filterPapers(value:PaperFilters){
  if(editing){setNotice('Save or cancel the current paper first.');return;}
  setFilters(value);
  const room={title:settings.room?.title??'Messages',category:'messages' as const,material:settings.room?.material};
  const first=paperMatchesFilters(room,paperTags.room,value)?'room':papers.find(p=>paperMatchesFilters(p,paperTags[p.id],value))?.id;
  const position=first?positions[first]:undefined;
  if(position)scroller.current?.scrollTo({left:Math.max(0,position.x-50),top:Math.max(0,position.y-40),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 }
 function move(id:string,p:Position){pending.current.add(id);setPositions(current=>({...current,[id]:p}))}
 function savePosition(id:string,p:Position){
  if(localPreview||id===draft?.id){pending.current.delete(id);return;}
  if(id==='room'||id==='contributors'){try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');localStorage.setItem('lichtraum-correspondence-fixed-papers-v1',JSON.stringify({...saved,[id]:p}))}catch{setNotice('This browser could not remember the paper positions.')}pending.current.delete(id);return}
  const previous=positionRequests.current.get(id)||Promise.resolve();
  const next=previous.then(async()=>{try{const r=await fetch('/api/papers/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();setNotice('')}catch{setNotice('A paper’s position could not be saved. Move it again to retry.')}}).finally(()=>{if(positionRequests.current.get(id)===next){pending.current.delete(id);positionRequests.current.delete(id)}});positionRequests.current.set(id,next);
 }
 function focus(id:string){layer.current+=1;setLayers(current=>({...current,[id]:layer.current}))}
 function editPaper(p:Paper){if(editing){if(editing.id!==p.id)setNotice('Save or cancel the current paper first.');return;}setConfirmRemoval(false);setEditing(p);setCategory(paperCategory(p));setTitle(p.title);setShared(p.shared);setMaterial(p.material??'opaque');setError('');setNotice('');focus(p.id)}
 function cancelEdit(){
  if(saving)return;
  if(draft){const created=creation.current;if(created)setPapers(list=>[...list.filter(p=>p.id!==created.id),created]);setPositions(current=>{const next={...current};if(created)next[created.id]=current[draft.id]??{x:created.x,y:created.y};delete next[draft.id];return next});setDraft(null);setDraftText('');setDraftFile(null);creation.current=null;}
  setConfirmRemoval(false);setEditing(null);setError('');setNotice('');
 }

 const builtin=editing?.id==='room'||editing?.id==='contributors';
 async function create(e:React.FormEvent){
  e.preventDefault();if(localPreview||!title.trim()||saving)return;
  if(draft&&draftText.length>800){setError('Shorten the note slightly to keep its formatting.');return;}
  setSaving(true);setError('');
  try{
   if(editing&&!draft)await entryEditors.current.get(editing.id)?.save();
   const position=draft?(positions[draft.id]??draft):null;
   let imageKey:string|undefined;
   if(draftFile&&draft){if(draftUpload.current?.file!==draftFile)draftUpload.current={file:draftFile,key:await uploadReference(draftFile)};imageKey=draftUpload.current!.key;}
   const existing=draft?creation.current:editing;
   const endpoint=existing?(builtin?'/api/papers/settings':'/api/papers/'+existing.id):'/api/papers';
   const r=await fetch(endpoint,{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,shared,material,...(!builtin?{category}:{}),...(existing?{id:existing.id}:position)})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Your paper could not be saved.');
   if(builtin){const setting=data.settings as SheetSettings;setSettings(current=>({...current,[setting.id]:setting}))}
   else{
    const paper=data.paper as Paper;
    if(draft){
     creation.current=paper;
     if(paperTextPlain(draftText).trim()||draftFile){
      const response=await fetch('/api/papers/'+paper.id+'/entries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:draftText,...(draftFile?{imageKey}:{})})});
      const entry=await response.json();if(!response.ok)throw Error(entry.error||'The paper was created; your note is still here. Save again to finish.');
     }
     setPositions(current=>{const next={...current,[paper.id]:position!};delete next[draft.id];return next});focus(paper.id);
    }
    setPapers(list=>[...list.filter(p=>p.id!==paper.id),paper].sort((a,b)=>a.createdAt-b.createdAt));
   }
   boardRevision.current+=1;setDraft(null);setDraftText('');setDraftFile(null);creation.current=null;setEditing(null);setTitle('');if(!builtin&&group!=='all')setFilters(value=>({...value,group:category}));
  }catch(e){setError(e instanceof Error?e.message:'Your paper could not be saved.')}finally{setSaving(false)}
 }
 async function removePaper(){
  if(!editing||!editing.mine||builtin||localPreview||saving||!confirmRemoval)return;
  const id=editing.id;setSaving(true);setError('');
  try{
   // Finish any pending sticker move before taking this sheet off the board.
   await positionRequests.current.get(id);
   const r=await fetch('/api/papers/'+id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmed:true})});
   const data=await r.json().catch(()=>null);if(!r.ok)throw Error(data?.error||(r.status===405?'Paper deletion is unavailable in this version. Reload the page and try again.':'The paper could not be deleted. Please try again.'));
   boardRevision.current+=1;setPapers(list=>list.filter(p=>p.id!==id));setEditing(null);setConfirmRemoval(false);setNotice('Paper removed from the board.');
  }catch(e){setError(e instanceof Error?e.message:'The paper could not be deleted.')}finally{setSaving(false)}
 }
 function startPaper(){
  if(editing){setNotice('Save or cancel the current paper first.');return;}
  setFilters(emptyPaperFilters());
  const occupied=['room',...papers.map(p=>p.id)].map(id=>{const node=document.getElementById('paper-'+id),p=positions[id]??papers.find(p=>p.id===id)??{x:56,y:50};return {x:p.x,y:p.y,width:node?.offsetWidth??(id==='room'?380:330),height:node?.offsetHeight??560}});
  const view=scroller.current;
  const position=findPaperSpace(occupied,{x:view?.scrollLeft??0,y:view?.scrollTop??0,width:view?.clientWidth??1000,height:view?.clientHeight??800});
  if(!position){setNotice('There is no room for another sheet here.');return;}
  const paper:Paper={id:'draft-'+crypto.randomUUID(),title:'',author:'',mine:true,shared:true,material:'opaque',category:group==='references'?'references':'messages',createdAt:Date.now(),...position};
  creation.current=null;draftUpload.current=null;setDraftText('');setDraftFile(null);setDraft(paper);setEditing(paper);setCategory(paper.category!);setShared(true);setMaterial('opaque');setTitle('');setError('');setNotice('');setConfirmRemoval(false);setFilterOpen(false);setPositions(current=>({...current,[paper.id]:position}));focus(paper.id);
  requestAnimationFrame(()=>view?.scrollTo({left:Math.max(0,position.x-32),top:Math.max(0,position.y-32),behavior:'smooth'}));
 }
 function chooseDraftFile(file?:File){if(!file||saving)return;const problem=referenceError(file);if(problem){setError(problem);return;}setDraftFile(file);draftUpload.current=null;setError('')}
 const canvasWidth=Math.max(1230,...Object.values(positions).map(p=>p.x+420)),canvasHeight=Math.max(950,...Object.values(positions).map(p=>p.y+900));
 const receipt=(id:string,name:string,subtitle:string,children:ReactNode,sheetMaterial:PaperMaterial='opaque')=>{
  const active=editing?.id===id;
  return <Receipt
   onEdit={()=>editPaper(papers.find(p=>p.id===id)??{id,title:name,material:sheetMaterial,shared:true,mine:true,author:'',x:positions[id]?.x??0,y:positions[id]?.y??0,createdAt:0})}
   tagControl={!active&&!id.startsWith('draft-')?<PaperTags id={id} value={paperTags[id]??emptyTags()} available={tagsAvailable} onSaved={tags=>{boardRevision.current+=1;setPaperTags(values=>({...values,[id]:tags}))}}/>:undefined}
   description={id==='room'?'chat of Lena and Mona':undefined} createdAt={id==='room'?roomDates.createdAt:(draft?.id===id?draft:papers.find(p=>p.id===id))?.createdAt} updatedAt={id==='room'?roomDates.updatedAt:papers.find(p=>p.id===id)?.updatedAt} material={active?material:sheetMaterial} key={id} id={id} title={name}
   subtitle={subtitle.split('/')[0].trim().padStart(3,'0')}
   titleEditor={active?<textarea className="paper-title-editor" aria-label="Paper title" placeholder={draft?'Paper title…':undefined} autoFocus rows={1} maxLength={80} value={title} disabled={saving} ref={node=>{if(node){node.style.height='auto';node.style.height=node.scrollHeight+'px'}}} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();cancelEdit()}}}/>:undefined}
   editor={active?<form className="paper-inline-controls" onSubmit={confirmRemoval?e=>e.preventDefault():create} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();cancelEdit()}}}>
    <div className="paper-inline-options">{!builtin&&<label className="paper-category">section<select aria-label="Paper section" value={category} onChange={e=>setCategory(e.target.value as PaperCategory)} disabled={saving}><option value="messages">Messages</option><option value="references">References</option></select></label>}<PaperMaterialControl value={material} onChange={setMaterial} disabled={saving}/>{!builtin&&<label className="paper-inline-sharing"><input type="checkbox" checked={shared} disabled={saving||!editing.mine} onChange={e=>setShared(e.target.checked)}/>shared</label>}</div>
    {error&&<p className="paper-error" role="alert">{error}</p>}
    {confirmRemoval?<div className="paper-delete-confirm" role="group" aria-label="Confirm paper deletion"><p>Remove “{editing.title}” from the board for everyone? Its notes and reference images will be kept in storage.</p><div><button type="button" disabled={saving} onClick={()=>{setConfirmRemoval(false);setError('')}}>keep paper</button><button type="button" className="paper-delete-confirm-button" disabled={saving} onClick={removePaper}>{saving?'removing…':'delete paper'}</button></div></div>:<div className="paper-inline-actions">{!draft&&!builtin&&editing.mine&&<button className="paper-delete" type="button" aria-label={'Delete '+editing.title} title="Delete paper" disabled={saving||localPreview} onClick={()=>{setError('');setConfirmRemoval(true)}}><Trash2 size={14}/></button>}<button type="button" disabled={saving} onClick={cancelEdit}>cancel</button><button disabled={saving||!title.trim()}>{saving?'saving…':draft?'publish paper':'save changes'}</button></div>}
   </form>:undefined}
   position={positions[id]||{x:820,y:64}} onMove={p=>move(id,p)} onSave={p=>savePosition(id,p)} onFocus={()=>focus(id)} layer={layers[id]||1}>{children}</Receipt>;
 };
 return <section className="correspondence-board" aria-label="Working notes board">
  <h1 className="board-side-label">03 working notes</h1><header className="board-toolbar"><div className="board-actions"><button className="board-new" aria-label="New paper" title="New paper" disabled={localPreview||loading} onClick={startPaper}><Plus size={32} strokeWidth={3} aria-hidden="true"/></button><div className="paper-filter" ref={filterControl} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setFilterOpen(false);filterButton.current?.focus()}}}>
   <button ref={filterButton} className={'paper-filter-trigger'+(activeFilters?' is-filtered':'')} aria-label={'Filter papers'+(activeFilters?': '+activeFilters+' active':'')} title="Filter papers" aria-expanded={filterOpen} aria-controls="paper-filter-options" onClick={()=>setFilterOpen(value=>!value)}><SlidersHorizontal size={32} strokeWidth={3} aria-hidden="true"/>{activeFilters>0&&<span className="paper-filter-dot" aria-hidden="true"/>}</button>
   {filterOpen&&<PaperFilterOptions value={filters} onChange={filterPapers} disabled={!!editing}/>}
  </div></div></header>

  {(error||notice)&&<div className="board-notice" role="status">{error||notice}<button onClick={load}>refresh</button></div>}
  <div className="board-scroll" ref={scroller}><div className="board-canvas" style={{width:canvasWidth,height:canvasHeight}}>
   {paperMatchesFilters({title:settings.room?.title??'Messages',category:'messages',material:settings.room?.material},paperTags.room,filters)&&receipt('room',settings.room?.title??'Messages','000',<Entries endpoint="/api/community" localPreview={localPreview} chat editing={editing?.id==='room'} disabled={saving} onDatesChange={updateRoomDates} ref={handle=>{if(handle)entryEditors.current.set('room',handle);else entryEditors.current.delete('room')}}/>,settings.room?.material)}

   {papers.filter(p=>p.id!==creation.current?.id).map((p,i)=>({p,i})).filter(({p})=>paperMatchesFilters(p,paperTags[p.id],filters)).map(({p,i})=>receipt(p.id,p.title,`${String(i+3).padStart(2,'0')} / ${p.shared?'shared':'only you'} / ${p.author}`,<Entries endpoint={'/api/papers/'+p.id+'/entries'} onChanged={load} localPreview={localPreview} editing={editing?.id===p.id} disabled={saving} ref={handle=>{if(handle)entryEditors.current.set(p.id,handle);else entryEditors.current.delete(p.id)}}/>,p.material))}
   {activeFilters>0&&!draft&&!loading&&!paperMatchesFilters({title:settings.room?.title??'Messages',category:'messages',material:settings.room?.material},paperTags.room,filters)&&!papers.some(p=>paperMatchesFilters(p,paperTags[p.id],filters))&&<div className="paper-filter-empty"><p>No sheets match these filters.</p><button type="button" onClick={()=>filterPapers(emptyPaperFilters())}>show all papers</button></div>}
   {draft&&receipt(draft.id,'New paper',String(papers.length+3).padStart(3,'0'),<div className="paper-notes paper-draft-body" ref={draftBody}>
    <PaperTextEditor value={draftText} onChange={setDraftText} label="New paper text" disabled={saving}/>
    {draftPreview&&<div className="paper-reference-draft">{draftFile?.type.startsWith('video/')?<video src={draftPreview} controls playsInline aria-label="Selected reference video"/>:<img src={draftPreview} alt="Selected reference image"/>}<button type="button" className="paper-reference-remove" aria-label="Remove selected reference" disabled={saving} onClick={()=>{setDraftFile(null);draftUpload.current=null}}><X size={13}/></button></div>}
    <div className="paper-add-actions"><button type="button" className="paper-write" title="Write a note" aria-label="Write a note" disabled={saving} onClick={()=>draftBody.current?.querySelector<HTMLElement>('[contenteditable]')?.focus()}><Plus size={14} aria-hidden="true"/></button><label className="paper-reference-add" title="Add reference image"><Camera size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label="Choose reference image" disabled={saving} onChange={e=>{chooseDraftFile(e.target.files?.[0]);e.currentTarget.value=''}}/></label><label className="paper-reference-add" title="Add a video"><Video size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_VIDEO_ACCEPT} aria-label="Choose reference video" disabled={saving} onChange={e=>{chooseDraftFile(e.target.files?.[0]);e.currentTarget.value=''}}/></label></div>
   </div>,material)}
  </div></div>

 </section>;
}
