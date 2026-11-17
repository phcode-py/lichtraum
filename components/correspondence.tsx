'use client';
import {createContext,useContext,useCallback,useEffect,useRef,useState,type CSSProperties,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowUpRight,Camera,Video,Pencil,Plus,RefreshCw,SlidersHorizontal,Trash2,X} from 'lucide-react';
import {paperCategory,type Paper,type PaperCategory,type PaperMaterial,type SheetSettings} from '@/lib/papers';
import {REFERENCE_IMAGE_ACCEPT,REFERENCE_VIDEO_ACCEPT,referenceError,uploadPaperReference} from '@/lib/paper-references';

import PaperTextEditor,{PaperText} from './paper-text-editor';
import {paperTextPlain} from '@/lib/paper-text';

export const PaperReferenceUploadContext=createContext<(file:File)=>Promise<string>>(uploadPaperReference);

type Message={id:string;author:string;content:string;createdAt:number;mine:boolean;hasImage?:boolean;imageUrl?:string;mediaType?:'image'|'video'};
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

function PaperEntry({message,index,endpoint,onSaved}:{message:Message;index:number;endpoint:string;onSaved:(m:Message)=>void}){
 const[editing,setEditing]=useState(false),[content,setContent]=useState(message.content),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();if(!paperTextPlain(content).trim()||content.length>800||busy)return;setBusy(true);setError('');try{const r=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({entryId:message.id,content})});const data=await r.json();if(!r.ok)throw Error(data.error||'Your entry could not be updated.');onSaved(data.message);setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Your entry could not be updated.')}finally{setBusy(false)}}
 const caption=paperTextPlain(message.content);
 return <article className="paper-entry"><div className="paper-entry-meta">{message.mine&&!editing&&<button className="paper-entry-edit" aria-label={`Edit entry ${index+1}`} onClick={()=>{setContent(message.content);setError('');setEditing(true)}}><Pencil size={12}/></button>}</div>
  {message.hasImage&&(message.imageUrl?(message.mediaType==='video'?<video className="paper-reference-video" src={message.imageUrl} controls playsInline preload="metadata" aria-label={caption}/>:<a className="paper-reference" href={message.imageUrl} target="_blank" rel="noreferrer" aria-label={'Open reference image: '+caption}><img src={message.imageUrl} alt={caption} loading="lazy"/></a>):<p className="paper-reference-missing">Reference unavailable. Refresh this paper to try again.</p>)}
  {editing?<form className="paper-compose paper-revise" onSubmit={save}><PaperTextEditor value={content} onChange={setContent} label="Edit entry text" autoFocus disabled={busy}/>{content.length>800&&<p className="paper-error">This entry is too long. Shorten it slightly to keep its formatting.</p>}{error&&<p role="alert" className="paper-error">{error}</p>}<div className="paper-compose-actions"><button type="button" disabled={busy} onClick={()=>setEditing(false)}>cancel</button><button disabled={busy||!paperTextPlain(content).trim()||content.length>800}>{busy?'saving…':'save changes'}</button></div></form>:<PaperText value={message.content}/>}
 </article>;
}

function Entries({endpoint,onChanged,localPreview=false}:{endpoint:string;onChanged?:()=>void;localPreview?:boolean}){
 const[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(!localPreview),[sending,setSending]=useState(false),[error,setError]=useState(''),[writing,setWriting]=useState(false);
 const[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const uploadReference=useContext(PaperReferenceUploadContext),uploaded=useRef<{file:File;key:string}|null>(null);
 const video=!!file?.type.startsWith('video/');
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url)},[file]);
 function choose(file?:File){if(!file||sending||localPreview)return;const problem=referenceError(file);if(problem){setError(problem);return;}setFile(file);uploaded.current=null;setWriting(true);setError('')}
 const revision=useRef(0);
 const load=useCallback(async()=>{if(localPreview)return;const version=revision.current;try{const r=await fetch(endpoint);const data=await r.json();if(!r.ok)throw Error(data.error||'Entries could not be loaded.');if(version===revision.current){setMessages(data.messages);setError('')}}catch(e){setError(e instanceof Error?e.message:'Entries could not be loaded.')}finally{setLoading(false)}},[endpoint,localPreview]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},15000);return()=>clearInterval(timer)},[load]);
 async function send(e:React.FormEvent){
  e.preventDefault();if(localPreview||(!paperTextPlain(text).trim()&&!file)||text.length>800||sending)return;setSending(true);setError('');
  try{
   let imageKey:string|undefined;
   if(file){if(uploaded.current?.file!==file)uploaded.current={file,key:await uploadReference(file)};imageKey=uploaded.current!.key;}
   const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text,...(file?{imageKey,imageName:file.name.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ')}:{})})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Your entry could not be saved.');revision.current+=1;setMessages(list=>list.some(m=>m.id===data.message.id)?list:[...list,data.message]);setText('');setFile(null);uploaded.current=null;setWriting(false);onChanged?.();
  }catch(e){setError(e instanceof Error?e.message:'Your entry could not be saved.')}finally{setSending(false)}
 }
 return <div className="paper-notes" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.files[0])}}>
  <div className="paper-entries" role="log" aria-label="Paper entries" aria-live="polite" aria-busy={loading}>
   {loading&&!messages.length&&<p className="paper-loading">Opening this sheet…</p>}
   {messages.map((m,i)=><PaperEntry key={m.id} message={m} index={i} endpoint={endpoint} onSaved={updated=>{revision.current+=1;setMessages(list=>list.map(item=>item.id===updated.id?updated:item));onChanged?.()}}/>)}
  </div>
  {writing&&<form className="paper-compose" onSubmit={send}><PaperTextEditor value={text} onChange={setText} label={file?'Reference caption':'New entry'} autoFocus disabled={sending}/><div className="paper-reference-draft">{preview&&<>{video?<video src={preview} controls playsInline preload="metadata" aria-label="Selected reference video"/>:<img src={preview} alt="Selected reference image"/>}<button type="button" className="paper-reference-remove" aria-label="Remove selected reference" disabled={sending} onClick={()=>{setFile(null);uploaded.current=null}}><X size={13}/></button><small>{file?.name}</small></>}</div>{text.length>800&&<p className="paper-error">This entry is too long. Shorten it slightly to keep its formatting.</p>}<div className="paper-compose-actions"><button type="button" disabled={sending} onClick={()=>{setWriting(false);setText('');setFile(null);uploaded.current=null}}>cancel</button><button disabled={sending||(!paperTextPlain(text).trim()&&!file)||text.length>800}>{sending?'saving…':file?'add reference':'leave entry'}</button></div></form>}
  <div className="paper-add-actions">{!writing&&<button className="paper-write" aria-label="Leave an entry" title="Leave an entry" disabled={localPreview} onClick={()=>setWriting(true)}><Plus size={14} aria-hidden="true"/></button>}
   <label className="paper-reference-add" title="Add reference image"><Camera size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label="Choose reference image" disabled={sending||localPreview} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label>
   <label className="paper-reference-add" title="Add a video"><Video size={14} aria-hidden="true"/><input type="file" accept={REFERENCE_VIDEO_ACCEPT} aria-label="Choose reference video" disabled={sending||localPreview} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label>
  </div>
  {writing&&file&&<p className="paper-reference-hint">{video?'MP4, MOV or WebM · up to 50 MB':'JPG, PNG or WebP · up to 10 MB'}</p>}
  {error&&<p className="paper-error" role="alert">{error} <button onClick={load}>retry</button></p>}
 </div>;
}

function Receipt({createdAt,updatedAt,id,title,subtitle,position,onMove,onSave,onFocus,layer,children,onEdit,titleEditor,editor,material='opaque'}:{createdAt?:number;updatedAt?:number;titleEditor?:ReactNode;editor?:ReactNode;onEdit:()=>void;material?:PaperMaterial;id:string;title:string;subtitle:string;position:Position;onMove:(p:Position)=>void;onSave:(p:Position)=>void;onFocus:()=>void;layer:number;children:ReactNode}){
 const drag=useRef<{pointer:number;x:number;y:number;origin:Position;latest:Position}|null>(null);
 function start(e:ReactPointerEvent<HTMLButtonElement>){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,origin:position,latest:position};onFocus()}
 function move(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p={x:Math.max(0,Math.min(10000,d.origin.x+e.clientX-d.x)),y:Math.max(0,Math.min(10000,d.origin.y+e.clientY-d.y))};d.latest=p;onMove(p)}
 function finish(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.latest.x!==d.origin.x||d.latest.y!==d.origin.y)onSave(d.latest)}
 function keyboard(e:ReactKeyboardEvent<HTMLButtonElement>){const directions:Record<string,Position>={ArrowLeft:{x:-20,y:0},ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20}};const d=directions[e.key];if(!d)return;e.preventDefault();onFocus();const p={x:Math.max(0,Math.min(10000,position.x+d.x)),y:Math.max(0,Math.min(10000,position.y+d.y))};onMove(p);onSave(p)}
 return <article id={'paper-'+id} className={'board-paper'+(material==='tracing'?' tracing-paper':'')} style={{left:position.x,top:position.y,zIndex:layer}} onPointerDown={onFocus} aria-label={title}>
  {paperTape(id).map(({clipPath,...style},index)=><button key={index} type="button" className="paper-tape" style={style} aria-label={`Move ${title} using sticker ${index+1}`} title="Drag to move · arrow keys also work" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={keyboard}><span className="paper-tape-strip" style={{clipPath}}/></button>)}
  <button className="paper-edit-button" type="button" aria-label={'Edit '+title} onClick={onEdit}><Pencil size={14}/></button>
  <header className="paper-heading"><p>{subtitle}</p><h2>{titleEditor??title}</h2><div className="paper-dates"><span><span className="paper-date-label">created</span><time>{createdAt?new Date(createdAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</time></span><span><span className="paper-date-label">last changed</span><time>{updatedAt?new Date(updatedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</time></span></div></header>{children}{editor}
 </article>;
}

export default function Correspondence({localPreview=false}:{localPreview?:boolean}={}){
 const[confirmRemoval,setConfirmRemoval]=useState(false);

 const[group,setGroup]=useState<PaperCategory|'all'>('all'),[filterOpen,setFilterOpen]=useState(false),[category,setCategory]=useState<PaperCategory>('messages');

 const[editing,setEditing]=useState<Paper|null>(null),[settings,setSettings]=useState<Record<string,SheetSettings>>({});
 const[papers,setPapers]=useState<Paper[]>([]),[loading,setLoading]=useState(!localPreview),[error,setError]=useState(''),[creating,setCreating]=useState(false),[title,setTitle]=useState(''),[shared,setShared]=useState(true),[material,setMaterial]=useState<PaperMaterial>('opaque'),[saving,setSaving]=useState(false),[positions,setPositions]=useState<Record<string,Position>>({room:{x:56,y:50},contributors:{x:478,y:144}}),[layers,setLayers]=useState<Record<string,number>>({}),[notice,setNotice]=useState('');
 const filterControl=useRef<HTMLDivElement>(null),filterButton=useRef<HTMLButtonElement>(null);
 const createDialog=useRef<HTMLDialogElement>(null),boardRevision=useRef(0);
 const layer=useRef(1),scroller=useRef<HTMLDivElement>(null),pending=useRef(new Set<string>()),positionRequests=useRef(new Map<string,Promise<void>>());
 const load=useCallback(async()=>{
  if(localPreview)return;
  const version=boardRevision.current;
  const results=await Promise.allSettled([fetch('/api/papers').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Papers could not be loaded.');return data.papers as Paper[]}),fetch('/api/papers/settings').then(async r=>{const data=await r.json();if(!r.ok)throw Error();return data.settings as SheetSettings[]})]);
  if(version!==boardRevision.current)return;
  if(results[1].status==='fulfilled')setSettings(Object.fromEntries(results[1].value.map(s=>[s.id,s])));
  if(results[0].status==='fulfilled'){const list=results[0].value;setPapers(list);setPositions(current=>{const next={...current};for(const p of list)if(!pending.current.has(p.id))next[p.id]={x:p.x,y:p.y};return next});setError('')}else setError(results[0].reason instanceof Error?results[0].reason.message:'Papers could not be loaded.');

  setLoading(false);
 },[localPreview]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},20000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{if(localPreview)return;try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');setPositions(current=>{const next={...current};for(const id of ['room','contributors'])if(saved[id]&&Number.isFinite(saved[id].x)&&Number.isFinite(saved[id].y))next[id]={x:Math.max(0,Math.min(10000,saved[id].x)),y:Math.max(0,Math.min(10000,saved[id].y))};return next})}catch{}},[]);
 useEffect(()=>{if(creating){createDialog.current?.showModal();createDialog.current?.querySelector<HTMLInputElement>('input')?.focus()}},[creating]);
 useEffect(()=>{if(!filterOpen)return;function outside(e:globalThis.PointerEvent){if(!filterControl.current?.contains(e.target as Node))setFilterOpen(false)}document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside)},[filterOpen]);
 function filterPapers(value:PaperCategory|'all'){
  if(editing){setNotice('Save or cancel the current paper first.');return;}
  setGroup(value);setFilterOpen(false);filterButton.current?.focus();
  const first=papers.find(p=>paperCategory(p)===value),position=value==='references'?(first?positions[first.id]:undefined):positions.room;
  if(position)scroller.current?.scrollTo({left:Math.max(0,position.x-50),top:Math.max(0,position.y-40),behavior:'smooth'});
 }
 function move(id:string,p:Position){pending.current.add(id);setPositions(current=>({...current,[id]:p}))}
 function savePosition(id:string,p:Position){
  if(localPreview){pending.current.delete(id);return;}
  if(id==='room'||id==='contributors'){try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');localStorage.setItem('lichtraum-correspondence-fixed-papers-v1',JSON.stringify({...saved,[id]:p}))}catch{setNotice('This browser could not remember the paper positions.')}pending.current.delete(id);return}
  const previous=positionRequests.current.get(id)||Promise.resolve();
  const next=previous.then(async()=>{try{const r=await fetch('/api/papers/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();setNotice('')}catch{setNotice('A paper’s position could not be saved. Move it again to retry.')}}).finally(()=>{if(positionRequests.current.get(id)===next){pending.current.delete(id);positionRequests.current.delete(id)}});positionRequests.current.set(id,next);
 }
 function focus(id:string){layer.current+=1;setLayers(current=>({...current,[id]:layer.current}))}
 function editPaper(p:Paper){if(editing){if(editing.id!==p.id)setNotice('Save or cancel the current paper first.');return;}setConfirmRemoval(false);setEditing(p);setCategory(paperCategory(p));setTitle(p.title);setShared(p.shared);setMaterial(p.material??'opaque');setError('');setNotice('');focus(p.id)}
 function cancelEdit(){if(saving)return;setConfirmRemoval(false);setEditing(null);setError('');setNotice('')}
 const builtin=editing?.id==='room'||editing?.id==='contributors';
 async function create(e:React.FormEvent){
  e.preventDefault();if(localPreview)return;if(!title.trim()||saving)return;setSaving(true);setError('');
  const position={x:820+(papers.length%3)*40,y:64+(papers.length%5)*60};
  try{
   const endpoint=editing?(builtin?'/api/papers/settings':'/api/papers/'+editing.id):'/api/papers';
   const r=await fetch(endpoint,{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,shared,material,...(!builtin?{category}:{}),...(editing?{id:editing.id}:position)})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Your paper could not be saved.');
   boardRevision.current+=1;
   if(builtin){const setting=data.settings as SheetSettings;setSettings(current=>({...current,[setting.id]:setting}))}
   else{
    const paper=data.paper as Paper;
    setPapers(list=>editing?list.map(p=>p.id===paper.id?paper:p):[...list,paper]);
    if(!editing){setPositions(current=>({...current,[paper.id]:position}));focus(paper.id);scroller.current?.scrollTo({left:Math.max(0,position.x-40),top:Math.max(0,position.y-40),behavior:'smooth'})}
   }
   setCreating(false);setEditing(null);setTitle('');if(!builtin&&group!=='all')setGroup(category);
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
 const canvasWidth=Math.max(1230,...Object.values(positions).map(p=>p.x+420)),canvasHeight=Math.max(950,...Object.values(positions).map(p=>p.y+900));
 const receipt=(id:string,name:string,subtitle:string,children:ReactNode,sheetMaterial:PaperMaterial='opaque')=>{
  const active=editing?.id===id;
  return <Receipt
   onEdit={()=>editPaper(papers.find(p=>p.id===id)??{id,title:name,material:sheetMaterial,shared:true,mine:true,author:'',x:positions[id]?.x??0,y:positions[id]?.y??0,createdAt:0})}
   createdAt={papers.find(p=>p.id===id)?.createdAt} updatedAt={papers.find(p=>p.id===id)?.updatedAt} material={active?material:sheetMaterial} key={id} id={id} title={name}
   subtitle={subtitle.split('/')[0].trim().padStart(3,'0')}
   titleEditor={active?<textarea className="paper-title-editor" aria-label="Paper title" autoFocus rows={1} maxLength={80} value={title} disabled={saving} ref={node=>{if(node){node.style.height='auto';node.style.height=node.scrollHeight+'px'}}} onChange={e=>setTitle(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();cancelEdit()}}}/>:undefined}
   editor={active?<form className="paper-inline-controls" onSubmit={confirmRemoval?e=>e.preventDefault():create} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();cancelEdit()}}}>
    <div className="paper-inline-options">{!builtin&&<label className="paper-category">section<select aria-label="Paper section" value={category} onChange={e=>setCategory(e.target.value as PaperCategory)} disabled={saving}><option value="messages">Messages</option><option value="references">References</option></select></label>}<PaperMaterialControl value={material} onChange={setMaterial} disabled={saving}/>{!builtin&&<label className="paper-inline-sharing"><input type="checkbox" checked={shared} disabled={saving||!editing.mine} onChange={e=>setShared(e.target.checked)}/>shared</label>}</div>
    {error&&<p className="paper-error" role="alert">{error}</p>}
    {confirmRemoval?<div className="paper-delete-confirm" role="group" aria-label="Confirm paper deletion"><p>Remove “{editing.title}” from the board for everyone? Its notes and reference images will be kept in storage.</p><div><button type="button" disabled={saving} onClick={()=>{setConfirmRemoval(false);setError('')}}>keep paper</button><button type="button" className="paper-delete-confirm-button" disabled={saving} onClick={removePaper}>{saving?'removing…':'delete paper'}</button></div></div>:<div className="paper-inline-actions">{!builtin&&editing.mine&&<button className="paper-delete" type="button" aria-label={'Delete '+editing.title} title="Delete paper" disabled={saving||localPreview} onClick={()=>{setError('');setConfirmRemoval(true)}}><Trash2 size={14}/></button>}<button type="button" disabled={saving} onClick={cancelEdit}>cancel</button><button disabled={saving||!title.trim()}>{saving?'saving…':'save changes'}</button></div>}
   </form>:undefined}
   position={positions[id]||{x:820,y:64}} onMove={p=>move(id,p)} onSave={p=>savePosition(id,p)} onFocus={()=>focus(id)} layer={layers[id]||1}>{children}</Receipt>;
 };
 return <section className="correspondence-board" aria-label="Working notes board">
  <h1 className="board-side-label">03 working notes</h1><header className="board-toolbar"><div className="board-actions"><button className="board-new" disabled={localPreview} onClick={()=>{if(editing){setNotice('Save or cancel the current paper first.');return;}setEditing(null);setCategory(group==='all'?'messages':group);setTitle('');setCreating(true);setShared(true);setMaterial('opaque');setError('')}}><Plus size={21}/>new paper</button><div className="paper-filter" ref={filterControl} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setFilterOpen(false);filterButton.current?.focus()}}}>
   <button ref={filterButton} className={'paper-filter-trigger'+(group!=='all'?' is-filtered':'')} aria-label={'Filter papers'+(group!=='all'?': '+group:'')} title="Filter papers" aria-expanded={filterOpen} aria-controls="paper-filter-options" onClick={()=>setFilterOpen(value=>!value)}><SlidersHorizontal size={15}/>{group!=='all'&&<span className="paper-filter-dot" aria-hidden="true"/>}</button>
   {filterOpen&&<fieldset id="paper-filter-options" className="paper-filter-options"><legend>show papers</legend>{(['all','references','messages'] as const).map(value=><label key={value}><input type="radio" name="paper-filter" value={value} checked={group===value} onChange={()=>filterPapers(value)}/><span>{value==='all'?'all papers':value}</span></label>)}</fieldset>}
  </div><button className="board-refresh" aria-label="Refresh board" onClick={load}><RefreshCw size={14}/></button></div></header>

  {(error||notice)&&<div className="board-notice" role="status">{error||notice}<button onClick={load}>refresh</button></div>}
  <div className="board-scroll" ref={scroller}><div className="board-canvas" style={{width:canvasWidth,height:canvasHeight}}>
   {group!=='references'&&receipt('room',settings.room?.title??'the room','01 / an ongoing conversation',<Entries endpoint="/api/community" localPreview={localPreview}/>,settings.room?.material)}

   {papers.map((p,i)=>({p,i})).filter(({p})=>group==='all'||paperCategory(p)===group).map(({p,i})=>receipt(p.id,p.title,`${String(i+3).padStart(2,'0')} / ${p.shared?'shared':'only you'} / ${p.author}`,<Entries endpoint={'/api/papers/'+p.id+'/entries'} onChanged={load} localPreview={localPreview}/>,p.material))}
  </div></div>
  {creating&&<dialog ref={createDialog} className="paper-create-backdrop" aria-label="Start a working-notes paper" onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation()}} onCancel={e=>{e.preventDefault();if(!saving)setCreating(false)}}><form className="paper-create" onSubmit={create}><button className="paper-create-close" type="button" aria-label="Close paper editor" disabled={saving} onClick={()=>setCreating(false)}><X size={18}/></button><p>AN OPEN CONVERSATION / A NEW SHEET</p><h2>A place for a thought.</h2><label>paper title<input autoFocus required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thoughts after a walk…" disabled={saving}/></label><label className="paper-category">section<select aria-label="Paper section" value={category} onChange={e=>setCategory(e.target.value as PaperCategory)}><option value="messages">Messages</option><option value="references">References</option></select></label><PaperMaterialControl value={material} onChange={setMaterial} disabled={saving}/>{builtin?<p className="paper-sharing-note">{editing?.id==='contributors'?'The contributor list updates automatically.':'The room stays shared. You can edit your own entries on the sheet.'}</p>:<><label className="paper-sharing"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)} disabled={saving||!!editing&&!editing.mine}/>shared with everyone</label><p className="paper-sharing-note">{editing&&!editing.mine?'Sharing is managed by the person who started this paper.':shared?'Everyone can read this paper and leave entries.':'Only you can see this paper and its entries.'}</p></>}{error&&<p className="paper-error" role="alert">{error}</p>}<button className="paper-create-submit" disabled={saving||!title.trim()}>{saving?'saving…':editing?'save changes':'start paper'}<ArrowUpRight size={17}/></button></form></dialog>}
 </section>;
}
