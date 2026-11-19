'use client';
import {useEffect,useImperativeHandle,useRef,useState,type Ref,type PointerEvent} from 'react';
import {ImageViewButton} from './image-viewer';
import {Check,Download,Eye,Layers,PenLine,Undo2,X} from 'lucide-react';
import {parseTracing,tracingPath,tracingSVG,type TraceLayer,type TracePoint,type TraceStroke} from '@/lib/photo-tracing';
export type PhotoTracingHandle={hasPending:()=>boolean;savePending:()=>Promise<boolean>};
type Photo={id:string;url:string;title:string;mediaType?:'photo'|'video';isLocalPreview?:boolean;source?:string};
export default function PhotoTracing({photo,onRatio,onEditingChange,tracingRef,enlargeable=true}:{photo:Photo;enlargeable?:boolean;onRatio?:(ratio:number)=>void;onEditingChange?:(editing:boolean)=>void;tracingRef?:Ref<PhotoTracingHandle>}){
 const[ratio,setRatio]=useState(1.5),[layers,setLayers]=useState<TraceLayer[]>([]),[draft,setDraft]=useState<TraceStroke[]>([]),[editing,setEditing]=useState(false),[paper,setPaper]=useState(false),[show,setShow]=useState(true),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[available,setAvailable]=useState(false),[source,setSource]=useState(''),[error,setError]=useState('');
 const pointer=useRef<number|null>(null),draftRef=useRef<TraceStroke[]>([]),surface=useRef<SVGSVGElement>(null);
 const own=layers.find(layer=>layer.mine),others=layers.filter(layer=>!layer.mine);
 useEffect(()=>{
  const controller=new AbortController();setLoaded(false);setEditing(false);setError('');setLayers([]);setDraft([]);draftRef.current=[];
  if(photo.isLocalPreview||photo.source){setLoaded(true);setAvailable(false);return()=>controller.abort()}
  fetch(`/api/photos/${photo.id}/tracing`,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Tracings could not be loaded.');setSource(data.source??'');setLayers(data.layers??[]);setAvailable(data.available===true);setLoaded(true)}).catch(e=>{if(!controller.signal.aborted){setLoaded(true);setAvailable(false);setError(e instanceof Error?e.message:'Tracings could not be loaded.')}});
  return()=>controller.abort();
 },[photo.id,photo.url,photo.isLocalPreview,photo.source]);
 useImperativeHandle(tracingRef,()=>({hasPending:()=>editing&&JSON.stringify(draftRef.current)!==JSON.stringify(own?.strokes??[]),savePending:save}));
 function setStrokes(strokes:TraceStroke[]){draftRef.current=strokes;setDraft(strokes)}
 function begin(){if(!loaded||busy)return;setStrokes(structuredClone(own?.strokes??[]));setEditing(true);onEditingChange?.(true);setShow(true);setError('')}
 function position(event:PointerEvent<SVGSVGElement>):TracePoint{const rect=event.currentTarget.getBoundingClientRect();return [Math.max(0,Math.min(1,Math.round((event.clientX-rect.left)/rect.width*10000)/10000)),Math.max(0,Math.min(1,Math.round((event.clientY-rect.top)/rect.height*10000)/10000))]}
 function down(event:PointerEvent<SVGSVGElement>){
  if(!editing||busy||event.button!==0)return;event.preventDefault();event.stopPropagation();
  if(draftRef.current.length>=200){setError('This layer has 200 lines. Undo one to keep drawing.');return;}
  if(draftRef.current.reduce((sum,s)=>sum+s.points.length,0)>=20000){setError('This layer has reached its point limit.');return;}
  pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);setStrokes([...draftRef.current,{points:[position(event)]}]);
 }
 function move(event:PointerEvent<SVGSVGElement>){
  if(pointer.current!==event.pointerId||!editing||busy)return;event.preventDefault();event.stopPropagation();
  const strokes=draftRef.current,stroke=strokes.at(-1);if(!stroke)return;const point=position(event),last=stroke.points.at(-1)!;
  if(Math.hypot(point[0]-last[0],point[1]-last[1])<.001)return;
  if(stroke.points.length>=2500||strokes.reduce((sum,s)=>sum+s.points.length,0)>=20000)return;
  setStrokes([...strokes.slice(0,-1),{points:[...stroke.points,point]}]);
 }
 function end(event:PointerEvent<SVGSVGElement>){if(pointer.current!==event.pointerId)return;pointer.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)}
 async function save():Promise<boolean>{
  if(!available){setError('Saving tracings isn’t available yet. You can download this layer.');return false;}
  const strokes=parseTracing(draftRef.current);if(!strokes){setError('This tracing is too large to save.');return false;}setBusy(true);setError('');
  try{const r=await fetch(`/api/photos/${photo.id}/tracing`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({strokes,revision:own?.revision??0,source})});const data=await r.json();if(!r.ok)throw Error(data.error||'The tracing could not be saved.');setLayers(list=>[...list.filter(layer=>!layer.mine),data.layer]);setEditing(false);onEditingChange?.(false);return true}catch(e){setError(e instanceof Error?e.message:'The tracing could not be saved.');return false}finally{setBusy(false)}
 }
 function download(){const strokes=editing?draftRef.current:layers.flatMap(layer=>layer.strokes);const url=URL.createObjectURL(new Blob([tracingSVG(strokes,ratio)],{type:'image/svg+xml'}));const link=document.createElement('a');link.href=url;link.download='lichtraum-tracing.svg';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const visible=show?[...others.map(layer=>({key:layer.authorId,strokes:layer.strokes})),{key:'mine',strokes:editing?draft:own?.strokes??[]}]:[];
 return <div className={'photo-tracing '+(editing?'is-drawing ':'')+(paper?'tracing-paper':'')}>
  <div className="tracing-surface" style={{aspectRatio:ratio}}><img src={photo.url} alt={photo.title} draggable={false} onLoad={e=>{const image=e.currentTarget;if(image.naturalWidth&&image.naturalHeight){const next=image.naturalWidth/image.naturalHeight;setRatio(next);onRatio?.(next)}}}/><svg ref={surface} viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label={editing?'Draw blue tracing on '+photo.title:'Tracing layers for '+photo.title} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>{visible.map(layer=><g key={layer.key} opacity={layer.key==='mine'?1:.55}>{layer.strokes.map((stroke,i)=><path key={i} d={tracingPath(stroke)} fill="none" stroke="#2446e8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>)}</g>)}</svg>{enlargeable&&!editing&&<ImageViewButton className="tracing-enlarge" url={photo.url} title={photo.title}><span className="sr-only">View picture</span></ImageViewButton>}</div>
  <div className="tracing-toolbar" role="group" aria-label="Tracing controls">{!editing?<button type="button" aria-label="Draw tracing" title="Draw tracing" disabled={!loaded} onClick={begin}><PenLine size={16}/></button>:<><button type="button" aria-label="Undo tracing line" title="Undo tracing line" disabled={busy||!draft.length} onClick={()=>setStrokes(draftRef.current.slice(0,-1))}><Undo2 size={16}/></button><button type="button" aria-label="Save tracing" title="Save tracing" disabled={busy||!available||JSON.stringify(draft)===JSON.stringify(own?.strokes??[])} onClick={save}><Check size={16}/></button><button type="button" aria-label="Cancel tracing" title="Cancel tracing" disabled={busy} onClick={()=>{pointer.current=null;setEditing(false);onEditingChange?.(false);setError('')}}><X size={16}/></button></>}
   <button type="button" aria-label="Tracing paper" title="Tracing paper" aria-pressed={paper} onClick={()=>setPaper(v=>!v)}><Layers size={16}/></button><button type="button" aria-label="Show tracing layers" title="Show tracing layers" aria-pressed={show} onClick={()=>setShow(v=>!v)}><Eye size={16}/></button><button type="button" aria-label="Download tracing" title="Download tracing" disabled={!(editing?draft.length:layers.some(layer=>layer.strokes.length))} onClick={download}><Download size={16}/></button>
  </div>{editing&&!available&&<p className="tracing-status" role="status">Saving tracings isn’t available yet. You can download this layer.</p>}{error&&<p className="tracing-status" role="alert">{error}</p>}
 </div>;
}
