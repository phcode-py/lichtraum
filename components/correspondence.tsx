'use client';
import {useCallback,useEffect,useRef,useState,type ReactNode,type PointerEvent as ReactPointerEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowUpRight,GripHorizontal,Plus,RefreshCw,X} from 'lucide-react';
import type {Paper} from '@/lib/papers';

type Message={id:string;author:string;content:string;createdAt:number;mine:boolean};
type Contributor={name:string;count:number;latest:number};
type Position={x:number;y:number};

function Entries({endpoint}:{endpoint:string}){
 const[messages,setMessages]=useState<Message[]>([]),[text,setText]=useState(''),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState(''),[writing,setWriting]=useState(false);
 const feed=useRef<HTMLDivElement>(null),count=useRef(0),revision=useRef(0);
 const load=useCallback(async()=>{const version=revision.current;try{const r=await fetch(endpoint);const data=await r.json();if(!r.ok)throw Error(data.error||'Entries could not be loaded.');if(version===revision.current){setMessages(data.messages);setError('')}}catch(e){setError(e instanceof Error?e.message:'Entries could not be loaded.')}finally{setLoading(false)}},[endpoint]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},15000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{if(messages.length!==count.current&&feed.current){feed.current.scrollTop=feed.current.scrollHeight;count.current=messages.length}},[messages]);
 async function send(e:React.FormEvent){e.preventDefault();if(!text.trim()||sending)return;setSending(true);setError('');try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text})});const data=await r.json();if(!r.ok)throw Error(data.error||'Your entry could not be saved.');revision.current+=1;setMessages(list=>list.some(m=>m.id===data.message.id)?list:[...list,data.message]);setText('');setWriting(false)}catch(e){setError(e instanceof Error?e.message:'Your entry could not be saved.')}finally{setSending(false)}}
 return <><div className="paper-entry-count"><span>{String(messages.length).padStart(3,'0')} {messages.length===1?'entry':'entries'}</span><button aria-label="Refresh entries" onClick={load}><RefreshCw size={12}/></button></div>
  <div className="paper-entries" ref={feed} role="log" aria-label="Paper entries" aria-live="polite" aria-busy={loading}>
   {loading&&!messages.length?<p className="paper-empty">// opening paper…</p>:!messages.length&&<p className="paper-empty">// an open page<br/><br/>A thought, a place,<br/>something worth keeping.</p>}
   {messages.map((m,i)=><article className="paper-entry" key={m.id}><div className="paper-entry-meta"><span>{String(i+1).padStart(3,'0')} / {m.author}</span><time dateTime={new Date(m.createdAt).toISOString()}>{new Date(m.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})} · {new Date(m.createdAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.content}</p></article>)}
  </div>
  {writing?<form className="paper-compose" onSubmit={send}><label>new entry<textarea aria-label="New entry" autoFocus rows={3} maxLength={800} value={text} onChange={e=>setText(e.target.value)} placeholder="Write on this paper…" disabled={sending}/></label><div><span>{text.length}/800</span><button type="button" disabled={sending} onClick={()=>setWriting(false)}>cancel</button><button disabled={sending||!text.trim()}>{sending?'saving…':'leave entry'}<ArrowUpRight size={13}/></button></div></form>:<button className="paper-write" onClick={()=>setWriting(true)}><span aria-hidden="true">&gt;</span> leave an entry<ArrowUpRight size={14}/></button>}
  {error&&<p className="paper-error" role="alert">{error} <button onClick={load}>retry</button></p>}
 </>;
}

function Receipt({id,title,subtitle,position,onMove,onSave,onFocus,layer,children}:{id:string;title:string;subtitle:string;position:Position;onMove:(p:Position)=>void;onSave:(p:Position)=>void;onFocus:()=>void;layer:number;children:ReactNode}){
 const drag=useRef<{pointer:number;x:number;y:number;origin:Position;latest:Position}|null>(null);
 function start(e:ReactPointerEvent<HTMLButtonElement>){if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,origin:position,latest:position};onFocus()}
 function move(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;const p={x:Math.max(0,Math.min(10000,d.origin.x+e.clientX-d.x)),y:Math.max(0,Math.min(10000,d.origin.y+e.clientY-d.y))};d.latest=p;onMove(p)}
 function finish(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.latest.x!==d.origin.x||d.latest.y!==d.origin.y)onSave(d.latest)}
 function keyboard(e:ReactKeyboardEvent<HTMLButtonElement>){const directions:Record<string,Position>={ArrowLeft:{x:-20,y:0},ArrowRight:{x:20,y:0},ArrowUp:{x:0,y:-20},ArrowDown:{x:0,y:20}};const d=directions[e.key];if(!d)return;e.preventDefault();onFocus();const p={x:Math.max(0,Math.min(10000,position.x+d.x)),y:Math.max(0,Math.min(10000,position.y+d.y))};onMove(p);onSave(p)}
 return <article id={'paper-'+id} className="board-paper" style={{left:position.x,top:position.y,zIndex:layer}} onPointerDown={onFocus} aria-label={title}>
  <button className="paper-grip" aria-label={'Move '+title} title="Drag to move · arrow keys also work" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={keyboard}><GripHorizontal size={18}/><span>drag paper</span></button>
  <header className="paper-heading"><p>{subtitle}</p><h2>{title}</h2></header>{children}<footer className="paper-end">lichtraum zürich / correspondence</footer>
 </article>;
}

export default function Correspondence(){
 const[papers,setPapers]=useState<Paper[]>([]),[people,setPeople]=useState<Contributor[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[creating,setCreating]=useState(false),[title,setTitle]=useState(''),[shared,setShared]=useState(true),[saving,setSaving]=useState(false),[positions,setPositions]=useState<Record<string,Position>>({room:{x:44,y:66},contributors:{x:360,y:26}}),[layers,setLayers]=useState<Record<string,number>>({}),[notice,setNotice]=useState('');
 const createDialog=useRef<HTMLDialogElement>(null);
 const layer=useRef(1),scroller=useRef<HTMLDivElement>(null),pending=useRef(new Set<string>()),positionRequests=useRef(new Map<string,Promise<void>>());
 const load=useCallback(async()=>{
  const results=await Promise.allSettled([fetch('/api/papers').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Papers could not be loaded.');return data.papers as Paper[]}),fetch('/api/community').then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Contributors could not be loaded.');return data.contributors as Contributor[]})]);
  if(results[0].status==='fulfilled'){const list=results[0].value;setPapers(list);setPositions(current=>{const next={...current};for(const p of list)if(!pending.current.has(p.id))next[p.id]={x:p.x,y:p.y};return next});setError('')}else setError(results[0].reason instanceof Error?results[0].reason.message:'Papers could not be loaded.');
  if(results[1].status==='fulfilled')setPeople(results[1].value);else setNotice('Contributors could not be loaded. Use refresh to try again.');
  setLoading(false);
 },[]);
 useEffect(()=>{load();const timer=setInterval(()=>{if(!document.hidden)load()},20000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');setPositions(current=>{const next={...current};for(const id of ['room','contributors'])if(saved[id]&&Number.isFinite(saved[id].x)&&Number.isFinite(saved[id].y))next[id]={x:Math.max(0,Math.min(10000,saved[id].x)),y:Math.max(0,Math.min(10000,saved[id].y))};return next})}catch{}},[]);
 useEffect(()=>{if(creating){createDialog.current?.showModal();createDialog.current?.querySelector<HTMLInputElement>('input')?.focus()}},[creating]);
 function move(id:string,p:Position){pending.current.add(id);setPositions(current=>({...current,[id]:p}))}
 function savePosition(id:string,p:Position){
  if(id==='room'||id==='contributors'){try{const saved=JSON.parse(localStorage.getItem('lichtraum-correspondence-fixed-papers-v1')||'{}');localStorage.setItem('lichtraum-correspondence-fixed-papers-v1',JSON.stringify({...saved,[id]:p}))}catch{setNotice('This browser could not remember the paper positions.')}pending.current.delete(id);return}
  const previous=positionRequests.current.get(id)||Promise.resolve();
  const next=previous.then(async()=>{try{const r=await fetch('/api/papers/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});if(!r.ok)throw Error();setNotice('')}catch{setNotice('A paper’s position could not be saved. Move it again to retry.')}}).finally(()=>{if(positionRequests.current.get(id)===next){pending.current.delete(id);positionRequests.current.delete(id)}});positionRequests.current.set(id,next);
 }
 function focus(id:string){layer.current+=1;setLayers(current=>({...current,[id]:layer.current}))}
 async function create(e:React.FormEvent){e.preventDefault();if(!title.trim()||saving)return;setSaving(true);setError('');const position={x:674+(papers.length%3)*40,y:96+(papers.length%5)*50};try{const r=await fetch('/api/papers',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,shared,...position})});const data=await r.json();if(!r.ok)throw Error(data.error||'Your paper could not be saved.');const paper=data.paper as Paper;setPapers(list=>[...list,paper]);setPositions(current=>({...current,[paper.id]:position}));setCreating(false);setTitle('');focus(paper.id);scroller.current?.scrollTo({left:Math.max(0,position.x-40),top:Math.max(0,position.y-40),behavior:'smooth'})}catch(e){setError(e instanceof Error?e.message:'Your paper could not be saved.')}finally{setSaving(false)}}
 const canvasWidth=Math.max(1120,...Object.values(positions).map(p=>p.x+340)),canvasHeight=Math.max(950,...Object.values(positions).map(p=>p.y+900));
 const receipt=(id:string,name:string,subtitle:string,children:ReactNode)=><Receipt key={id} id={id} title={name} subtitle={subtitle} position={positions[id]||{x:674,y:96}} onMove={p=>move(id,p)} onSave={p=>savePosition(id,p)} onFocus={()=>focus(id)} layer={layers[id]||1}>{children}</Receipt>;
 return <section className="correspondence-board" aria-label="Correspondence board">
  <header className="board-toolbar"><div><p>// lichtraum zürich</p><h1>correspondence</h1></div><button className="board-new" onClick={()=>{setCreating(true);setShared(true);setError('')}}><Plus size={21}/>new paper</button></header>
  <div className="board-instructions"><span>papers on the table</span><span>drag to arrange · scroll to explore</span><button onClick={()=>scroller.current?.scrollTo({left:0,top:0,behavior:'smooth'})}>first papers</button><button aria-label="Refresh board" onClick={load}><RefreshCw size={13}/></button></div>
  {(error||notice)&&<div className="board-notice" role="status">{error||notice}<button onClick={load}>refresh</button></div>}
  <div className="board-scroll" ref={scroller}><div className="board-canvas" style={{width:canvasWidth,height:canvasHeight}}>
   {receipt('room','the room','001 / shared correspondence',<Entries endpoint="/api/community"/>)}
   {receipt('contributors','contributors','002 / everyone in the atlas',<><div className="paper-contributors">{people.length?people.map((p,i)=><div className="paper-person" key={i}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{p.name}</strong><p>{p.count} {p.count===1?'photograph':'photographs'}</p></div></div>):<p className="paper-empty">{loading?'// opening the atlas…':'// no contributors yet'}</p>}</div><div className="paper-totals"><span>{people.length} contributors</span><span>{people.reduce((n,p)=>n+p.count,0)} photographs</span></div></>)}
   {papers.map((p,i)=>receipt(p.id,p.title,`${String(i+3).padStart(3,'0')} / ${p.shared?'shared':'only you'} / ${p.author}`,<Entries endpoint={'/api/papers/'+p.id+'/entries'}/>))}
  </div></div>
  {creating&&<dialog ref={createDialog} className="paper-create-backdrop" aria-label="Start a correspondence paper" onKeyDown={e=>{if(e.key==='Escape')e.stopPropagation()}} onCancel={e=>{e.preventDefault();if(!saving)setCreating(false)}}><form className="paper-create" onSubmit={create}><button className="paper-create-close" type="button" aria-label="Close new paper" disabled={saving} onClick={()=>setCreating(false)}><X size={18}/></button><p>// a fresh sheet</p><h2>start a paper</h2><label>paper title<input autoFocus required maxLength={80} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Thoughts after a walk…" disabled={saving}/></label><label className="paper-sharing"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)} disabled={saving}/>shared with everyone</label><p className="paper-sharing-note">{shared?'Everyone can read this paper and leave entries.':'Only you can see this paper and its entries.'}</p>{error&&<p className="paper-error" role="alert">{error}</p>}<button className="paper-create-submit" disabled={saving||!title.trim()}>{saving?'starting…':'start paper'}<ArrowUpRight size={17}/></button></form></dialog>}
 </section>;
}
