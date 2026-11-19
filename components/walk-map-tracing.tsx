'use client';
import {useCallback,useContext,useEffect,useRef,useState,type PointerEvent} from 'react';
import type {Map as MapLibre} from 'maplibre-gl';
import {Camera,Check,Eye,Layers,PenLine,StickyNote,Trash2,Undo2,MousePointer2} from 'lucide-react';
import {PaperReferenceUploadContext} from './paper-entries';
import {REFERENCE_IMAGE_ACCEPT,referenceError} from '@/lib/paper-references';
import {emptyMapTracing,parseMapTracing,type MapPoint,type MapTracing,type MapTracingLayer,type MapSketch} from '@/lib/walk-tracing';
type Sketch=MapSketch&{url?:string};
type Drawing=Omit<MapTracing,'sketches'>&{sketches:Sketch[]};
type Sheet={drawing:Drawing;layers:MapTracingLayer[];revision:number;loaded:boolean;available:boolean;dirty:boolean;undo:Drawing[];error:string};
const blank=():Sheet=>({drawing:emptyMapTracing(),layers:[],revision:0,loaded:false,available:true,dirty:false,undo:[],error:''});
export default function WalkMapTracing({map,walkId,visible,onHide}:{map:MapLibre;walkId:string|null;visible:boolean;onHide:()=>void}){
 const[sheets,setSheets]=useState<Record<string,Sheet>>({}),[mode,setMode]=useState<'draw'|'note'|'sketch'|'select'>('select'),[noteText,setNoteText]=useState(''),[noteId,setNoteId]=useState<string|null>(null),[sketchId,setSketchId]=useState<string|null>(null),[busy,setBusy]=useState(false),[,redraw]=useState(0);
 const[strokeIndex,setStrokeIndex]=useState<number|null>(null),[panelPosition,setPanelPosition]=useState<{x:number;y:number}|null>(null);
 const panel=useRef<HTMLElement>(null),panelDrag=useRef<{pointer:number;x:number;y:number;left:number;top:number}|null>(null);
 const upload=useContext(PaperReferenceUploadContext),files=useRef(new Map<string,{file:File;url:string;key?:string}>()),gesture=useRef<{pointer:number;start:[number,number];drawing:Drawing;kind:'draw'|'move'|'size'|'stroke'|'point'|'note';sketch?:string;stroke?:number;vertex?:number;note?:string}|null>(null);
 const sheet=walkId?sheets[walkId]??blank():blank(),sheetNow=useRef(sheet);sheetNow.current=sheet;
 const activeWalk=useRef(walkId);activeWalk.current=walkId;
 const drawing=sheet.drawing;
 const update=useCallback((id:string,change:(s:Sheet)=>Sheet)=>setSheets(old=>({...old,[id]:change(old[id]??blank())})),[]);
 function change(next:Drawing,remember=true){if(!walkId)return;update(walkId,s=>({...s,drawing:next,dirty:true,error:'',undo:remember?[...s.undo,s.drawing].slice(-20):s.undo}))}
 useEffect(()=>{let frame=0;const moved=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;redraw(n=>n+1)})};map.on('move',moved);map.on('resize',moved);return()=>{map.off('move',moved);map.off('resize',moved);cancelAnimationFrame(frame)}},[map]);
 useEffect(()=>()=>{files.current.forEach(value=>URL.revokeObjectURL(value.url))},[]);
 useEffect(()=>{setMode('select');setNoteId(null);setSketchId(null);setStrokeIndex(null);setNoteText('')},[walkId]);
 useEffect(()=>{
  if(!walkId||sheets[walkId]?.loaded)return;
  const id=walkId,controller=new AbortController();
  fetch(`/api/walks/${id}/tracing`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'The tracing paper could not be opened.');const own=data.layers.find((layer:MapTracingLayer)=>layer.mine);update(id,s=>({...s,loaded:true,available:data.available===true,layers:data.layers,revision:own?.revision??0,drawing:own?{strokes:own.strokes,notes:own.notes,sketches:own.sketches}:emptyMapTracing()}))}).catch(error=>{if(!controller.signal.aborted)update(id,s=>({...s,loaded:true,available:false,error:error instanceof Error?error.message:'The tracing paper could not be opened.'}))});
  return()=>controller.abort();
 // Each walk keeps its unsaved sheet in this component while another walk is opened.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[walkId,update]);
 function clampPanel(x:number,y:number){return {x:Math.max(8,Math.min(x,map.getContainer().clientWidth-(panel.current?.offsetWidth??260)-8)),y:Math.max(26,Math.min(y,map.getContainer().clientHeight-(panel.current?.offsetHeight??100)-8))}}
 function beginPanel(event:PointerEvent<HTMLButtonElement>){if(event.button!==0)return;event.preventDefault();event.stopPropagation();const rect=panel.current!.getBoundingClientRect(),base=map.getContainer().getBoundingClientRect();panelDrag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left-base.left,top:rect.top-base.top};event.currentTarget.setPointerCapture(event.pointerId)}
 function movePanel(event:PointerEvent<HTMLButtonElement>){const drag=panelDrag.current;if(!drag||drag.pointer!==event.pointerId)return;setPanelPosition(clampPanel(drag.left+event.clientX-drag.x,drag.top+event.clientY-drag.y))}
 useEffect(()=>{setPanelPosition(old=>old?clampPanel(old.x,old.y):old)},[mode,noteId,sketchId,visible]);
 useEffect(()=>{const clamp=()=>setPanelPosition(old=>old?clampPanel(old.x,old.y):old);map.on('resize',clamp);return()=>{map.off('resize',clamp)}},[map]);
 const project=(point:MapPoint)=>map.project(point),geo=(point:[number,number]):MapPoint=>{const value=map.unproject(point);return [Number(value.lng.toFixed(7)),Number(value.lat.toFixed(7))]};
 function position(event:PointerEvent<SVGSVGElement>):[number,number]{const rect=event.currentTarget.getBoundingClientRect();return [event.clientX-rect.left,event.clientY-rect.top]}
 function down(event:PointerEvent<SVGSVGElement>){
  if(event.button!==0||busy||!sheet.loaded)return;
  const point=position(event);
  if(mode==='note'){
   if(noteId||!noteText.trim()||noteText.length>600||drawing.notes.length>=50)return;
   change({...drawing,notes:[...drawing.notes,{id:crypto.randomUUID(),point:geo(point),text:noteText.trim()}]});setNoteText('');setMode('select');return;
  }
  if(mode!=='draw')return;
  if(drawing.strokes.length>=200||drawing.strokes.reduce((n,s)=>n+s.points.length,0)>=20000){update(walkId!,s=>({...s,error:'This sheet has reached its drawing limit. Undo a line before continuing.'}));return;}
  event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);gesture.current={pointer:event.pointerId,start:point,drawing,kind:'draw'};
  change({...drawing,strokes:[...drawing.strokes,{points:[geo(point)]}]});
 }
 function move(event:PointerEvent<SVGSVGElement>){
  const active=gesture.current;if(!active||event.pointerId!==active.pointer)return;
  const point=position(event),current=sheetNow.current.drawing;
  if(active.kind==='draw'){
   const strokes=[...current.strokes],last=strokes[strokes.length-1];if(!last||last.points.length>=2500||strokes.reduce((n,s)=>n+s.points.length,0)>=20000)return;
   const previous=project(last.points[last.points.length-1]);if(Math.hypot(previous.x-point[0],previous.y-point[1])<2)return;
   strokes[strokes.length-1]={points:[...last.points,geo(point)]};change({...current,strokes},false);
  }else if(active.kind==='stroke'||active.kind==='point'){
   const original=active.drawing.strokes[active.stroke!];if(!original)return;
   const dx=point[0]-active.start[0],dy=point[1]-active.start[1];
   const points=original.points.map((p,index)=>{if(active.kind==='point')return index===active.vertex?geo(point):p;const screen=project(p);return geo([screen.x+dx,screen.y+dy])});
   change({...current,strokes:current.strokes.map((stroke,index)=>index===active.stroke?{points}:stroke)},false);
  }else if(active.kind==='note'){
   const original=active.drawing.notes.find(note=>note.id===active.note);if(!original)return;const screen=project(original.point);
   change({...current,notes:current.notes.map(note=>note.id===original.id?{...note,point:geo([screen.x+point[0]-active.start[0],screen.y+point[1]-active.start[1]])}:note)},false);
  }else{
   const original=active.drawing.sketches.find(s=>s.id===active.sketch);if(!original)return;
   const corners=original.corners.map(project),dx=point[0]-active.start[0],dy=point[1]-active.start[1];
   let points=corners.map(p=>[p.x+dx,p.y+dy] as [number,number]);
   if(active.kind==='size'){const origin=corners[0],diagonal=corners[2],length=Math.hypot(diagonal.x-origin.x,diagonal.y-origin.y);const scale=Math.max(.1,Math.min(8,Math.hypot(point[0]-origin.x,point[1]-origin.y)/Math.max(1,length)));points=corners.map(p=>[origin.x+(p.x-origin.x)*scale,origin.y+(p.y-origin.y)*scale]);}
   change({...current,sketches:current.sketches.map(s=>s.id===original.id?{...s,corners:points.map(geo) as MapSketch['corners']}:s)},false);
  }
 }
 function beginSketch(event:PointerEvent<SVGElement>,kind:'move'|'size',sketch:Sketch){event.stopPropagation();if(busy)return;const svg=event.currentTarget.ownerSVGElement!;svg.setPointerCapture(event.pointerId);const rect=svg.getBoundingClientRect();gesture.current={pointer:event.pointerId,start:[event.clientX-rect.left,event.clientY-rect.top],drawing,kind,sketch:sketch.id};change(drawing);}
 function beginSelection(event:PointerEvent<Element>,kind:'stroke'|'point'|'note',index:number|string,vertex?:number){
  event.stopPropagation();if(busy||mode!=='select')return;event.preventDefault();const svg=event.currentTarget.closest('svg') as SVGSVGElement|null;if(!svg)return;svg.setPointerCapture(event.pointerId);const rect=svg.getBoundingClientRect();
  if(kind==='note'){setNoteId(String(index));setNoteText(drawing.notes.find(note=>note.id===index)?.text??'');setStrokeIndex(null)}else{setStrokeIndex(Number(index));setNoteId(null)}setSketchId(null);
  gesture.current={pointer:event.pointerId,start:[event.clientX-rect.left,event.clientY-rect.top],drawing,kind,...(kind==='note'?{note:String(index)}:{stroke:Number(index),vertex})};change(drawing);
 }
 function end(){gesture.current=null}
 async function choose(file?:File,replaceId?:string){
  if(!file||!walkId||busy||!sheet.loaded)return;
  const problem=!file.type.startsWith('image/')?'Choose a JPG, PNG or WebP sketch.':referenceError(file);
  if(problem||!replaceId&&drawing.sketches.length>=3){update(walkId,s=>({...s,error:problem||'Keep up to three sketch images on this sheet.'}));return;}
  const url=URL.createObjectURL(file),image=new Image();
  const chosenWalk=walkId;
  image.onload=()=>{if(activeWalk.current!==chosenWalk){URL.revokeObjectURL(url);return;}const id=replaceId??crypto.randomUUID();files.current.set(url,{file,url});if(replaceId){change({...sheetNow.current.drawing,sketches:sheetNow.current.drawing.sketches.map(sketch=>sketch.id===replaceId?{...sketch,key:'',url}:sketch)});return;}const w=map.getContainer().clientWidth,h=map.getContainer().clientHeight,left=w>720?Math.min(460,w*.45):35,cx=(left+w-70)/2,cy=h*.35,width=Math.min(300,(w-left-85)*.8),height=width*image.naturalHeight/image.naturalWidth;const limited=Math.min(height,h*.55),actualWidth=limited*image.naturalWidth/image.naturalHeight;const corners:[[number,number],[number,number],[number,number],[number,number]]=[[cx-actualWidth/2,cy-limited/2],[cx+actualWidth/2,cy-limited/2],[cx+actualWidth/2,cy+limited/2],[cx-actualWidth/2,cy+limited/2]];change({...sheetNow.current.drawing,sketches:[...sheetNow.current.drawing.sketches,{id,key:'',url,corners:corners.map(geo) as MapSketch['corners'],opacity:.65,rotation:0}]});setSketchId(id);setMode('sketch')};
  image.onerror=()=>{URL.revokeObjectURL(url);update(walkId,s=>({...s,error:'This image could not be opened.'}))};image.src=url;
 }
 async function save(){
  if(!walkId||busy)return;const id=walkId,current=sheetNow.current;setBusy(true);update(id,s=>({...s,error:''}));
  try{const sketches=[];for(const sketch of current.drawing.sketches){const pending=files.current.get(sketch.url??'');if(pending&&!pending.key)pending.key=await upload(pending.file);sketches.push({...sketch,key:pending?.key??sketch.key})}const value=parseMapTracing({...current.drawing,sketches},sketches.some(sketch=>sketch.key.startsWith('preview/')));if(!value)throw Error('Keep notes within 600 characters and use valid sketch images.');const response=await fetch(`/api/walks/${id}/tracing`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({drawing:value,revision:current.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Your tracing paper could not be saved.');const layer=result.layer as MapTracingLayer;update(id,s=>({...s,revision:layer.revision,available:true,layers:[...s.layers.filter(l=>!l.mine),layer],drawing:{strokes:layer.strokes,notes:layer.notes,sketches:layer.sketches},dirty:false,undo:[],error:''}));setMode('select')}
  catch(error){update(id,s=>({...s,error:error instanceof Error?error.message:'Your tracing paper could not be saved.'}))}finally{setBusy(false)}
 }
 const selected=drawing.sketches.find(s=>s.id===sketchId);
 function rotate(value:number){if(!selected)return;const points=selected.corners.map(project),center={x:(points[0].x+points[2].x)/2,y:(points[0].y+points[2].y)/2},angle=(value-selected.rotation)*Math.PI/180;change({...drawing,sketches:drawing.sketches.map(s=>s.id===selected.id?{...s,rotation:value,corners:points.map(p=>geo([center.x+(p.x-center.x)*Math.cos(angle)-(p.y-center.y)*Math.sin(angle),center.y+(p.x-center.x)*Math.sin(angle)+(p.y-center.y)*Math.cos(angle)])) as MapSketch['corners']}:s)})}
 if(!walkId||!visible)return null;
 const layers=[...sheet.layers.filter(layer=>!layer.mine),{...drawing,mine:true,authorId:'own'}];
 const w=map.getContainer().clientWidth,h=map.getContainer().clientHeight;
 return <>
  <svg className={'walk-tracing-surface mode-'+mode} viewBox={`0 0 ${w} ${h}`} aria-label="Map tracing paper" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
   <rect width={w} height={h} fill="#fffffc" opacity=".18"/>
   {layers.map(layer=><g key={layer.authorId}>
    {layer.sketches.map(sketch=>{const [a,b,,d]=sketch.corners.map(project);return sketch.url?<image key={sketch.id} href={sketch.url} width="1" height="1" transform={`matrix(${b.x-a.x} ${b.y-a.y} ${d.x-a.x} ${d.y-a.y} ${a.x} ${a.y})`} opacity={sketch.opacity} preserveAspectRatio="none" style={{mixBlendMode:'multiply',pointerEvents:layer.mine&&(mode==='sketch'||mode==='select')?'auto':'none'}} onPointerDown={event=>{if(layer.mine){setSketchId(sketch.id);setNoteId(null);setStrokeIndex(null);setMode('sketch');beginSketch(event,'move',sketch)}}}/>:null})}
    {layer.strokes.map((stroke,index)=>{const path=stroke.points.map((point,i)=>{const p=project(point);return `${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`}).join(' ')+(stroke.points.length===1?' l.1,0':'');return <g key={index}><path d={path} fill="none" stroke="#2446e8" strokeWidth={layer.mine&&mode==='select'&&strokeIndex===index?3.5:2.5} strokeLinecap="round" strokeLinejoin="round"/>{layer.mine&&mode==='select'&&<path className="map-stroke-hit" aria-label={'Move drawing '+(index+1)} d={path} fill="none" stroke="transparent" strokeWidth="14" style={{pointerEvents:'stroke'}} onPointerDown={event=>beginSelection(event,'stroke',index)}/>}</g>})}
    {layer.notes.map(note=>{const p=project(note.point);return <foreignObject key={note.id} x={p.x} y={p.y} width="160" height="95" style={{overflow:'visible',pointerEvents:layer.mine&&mode==='select'?'auto':'none'}}><button type="button" className="map-tracing-note" disabled={!layer.mine||busy} onPointerDown={event=>{if(mode==='select')beginSelection(event,'note',note.id);else event.stopPropagation()}} onClick={()=>{if(layer.mine&&mode==='select'){setNoteId(note.id);setNoteText(note.text)}}}>{note.text}</button></foreignObject>})}
   </g>)}
   {mode==='select'&&strokeIndex!==null&&drawing.strokes[strokeIndex]&&<g>{drawing.strokes[strokeIndex].points.map((point,index,all)=>{if(index!==all.length-1&&index%Math.max(1,Math.ceil(all.length/24))!==0)return null;const p=project(point);return <circle key={index} className="map-line-handle" aria-label={'Reshape drawing point '+(index+1)} cx={p.x} cy={p.y} r="4.5" fill="#fffffc" stroke="#2446e8" strokeWidth="1.3" style={{pointerEvents:'auto'}} onPointerDown={event=>beginSelection(event,'point',strokeIndex,index)}/>})}</g>}
   {mode==='sketch'&&selected&&<g>{selected.corners.map((point,index)=>{const p=project(point);return <circle key={index} cx={p.x} cy={p.y} r="5" fill="#fffffc" stroke="#2446e8" strokeWidth="1.5" style={{pointerEvents:index===2?'auto':'none'}} onPointerDown={event=>beginSketch(event,'size',selected)}/>})}</g>}
  </svg>
  <section ref={panel} className="map-tracing-tools" aria-label="Tracing paper tools" style={panelPosition?{left:panelPosition.x,top:panelPosition.y,right:'auto',bottom:'auto',width:panel.current?.offsetWidth,maxWidth:'calc(100% - 16px)'}:undefined}><button type="button" className="map-tracing-tape" aria-label="Move tracing paper controls" title="Move tracing paper" onPointerDown={beginPanel} onPointerMove={movePanel} onPointerUp={()=>{panelDrag.current=null}} onPointerCancel={()=>{panelDrag.current=null}} onKeyDown={event=>{const directions:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};const direction=directions[event.key];if(!direction)return;event.preventDefault();const rect=panel.current!.getBoundingClientRect(),base=map.getContainer().getBoundingClientRect();setPanelPosition(clampPanel(rect.left-base.left+direction[0],rect.top-base.top+direction[1]))}}/><div className="map-tracing-heading"><span><Layers size={14}/>tracing paper{sheet.dirty?' · unsaved':''}</span><button type="button" aria-label="Hide tracing paper" onClick={onHide}><Eye size={15}/></button></div>
   <div className="map-tracing-actions"><button type="button" aria-label="Edit map additions" title="Move the map, or select a line, note or sketch" aria-pressed={mode==='select'} disabled={!sheet.loaded||busy} onClick={()=>{setMode('select');setNoteId(null);setStrokeIndex(null);setSketchId(null)}}><MousePointer2 size={17}/></button><button type="button" aria-label="Draw on map" title="Draw a blue line" aria-pressed={mode==='draw'} disabled={!sheet.loaded||busy} onClick={()=>setMode('draw')}><PenLine size={17}/></button><button type="button" aria-label="Add map note" title="Write a note on the map" aria-pressed={mode==='note'} disabled={!sheet.loaded||busy} onClick={()=>{setMode('note');setNoteId(null);setNoteText('')}}><StickyNote size={17}/></button><label title="Upload a sketch" className="map-sketch-upload"><Camera size={17}/><input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label="Upload a sketch" disabled={!sheet.loaded||busy} onChange={e=>{choose(e.target.files?.[0]);e.currentTarget.value=''}}/></label><button type="button" aria-label="Position sketch" title="Move, resize or rotate a sketch" aria-pressed={mode==='sketch'} disabled={!drawing.sketches.length||busy} onClick={()=>{setMode('sketch');setSketchId(drawing.sketches.at(-1)?.id??null)}}><Layers size={17}/></button><button type="button" aria-label="Undo map tracing" title="Undo the last tracing change" disabled={!sheet.undo.length||busy} onClick={()=>update(walkId,s=>({...s,drawing:s.undo.at(-1)!,undo:s.undo.slice(0,-1),dirty:true}))}><Undo2 size={17}/></button><button type="button" aria-label="Save tracing paper" title="Save this tracing paper" disabled={!sheet.loaded||!sheet.dirty||busy} onClick={save}><Check size={17}/></button></div>
   {mode==='select'&&<p className="map-tracing-hint">Drag the map to move around. Select a line, note or sketch to edit it.</p>}
   {mode==='select'&&strokeIndex!==null&&drawing.strokes[strokeIndex]&&<button type="button" className="map-tracing-remove" aria-label="Remove selected drawing" disabled={busy} onClick={()=>{change({...drawing,strokes:drawing.strokes.filter((_,index)=>index!==strokeIndex)});setStrokeIndex(null)}}><Trash2 size={13}/>remove line</button>}
   {mode==='draw'&&<p className="map-tracing-hint">Draw on the map. Choose the selection arrow to move around.</p>}
   {(mode==='note'||mode==='select'&&noteId)&&<div className="map-note-compose"><textarea autoFocus aria-label="Map note" maxLength={600} placeholder="Write a note, then click its place on the map." value={noteText} disabled={busy} onChange={e=>setNoteText(e.target.value)}/>{noteId&&<div><button type="button" onClick={()=>{change({...drawing,notes:drawing.notes.map(n=>n.id===noteId?{...n,text:noteText.trim()}:n)});setMode('select');setNoteId(null)}} disabled={!noteText.trim()||busy}>apply note</button><button type="button" aria-label="Remove map note" disabled={busy} onClick={()=>{change({...drawing,notes:drawing.notes.filter(n=>n.id!==noteId)});setNoteId(null);setMode('select')}}><Trash2 size={13}/></button></div>}</div>}
   {mode==='sketch'&&selected&&<div className="map-sketch-settings"><p>Drag the sketch to move it; drag the bottom-right dot to resize.</p><label className="map-sketch-replace" title="Replace sketch image"><Camera size={13}/>replace image<input type="file" accept={REFERENCE_IMAGE_ACCEPT} aria-label="Replace sketch image" disabled={busy} onChange={e=>{choose(e.target.files?.[0],selected.id);e.currentTarget.value=''}}/></label><label>opacity<input type="range" aria-label="Sketch opacity" min=".05" max="1" step=".05" value={selected.opacity} disabled={busy} onChange={e=>change({...drawing,sketches:drawing.sketches.map(s=>s.id===selected.id?{...s,opacity:Number(e.target.value)}:s)})}/></label><label>rotation<input type="range" aria-label="Sketch rotation" min="-180" max="180" step="1" value={selected.rotation} disabled={busy} onChange={e=>rotate(Number(e.target.value))}/></label><button type="button" aria-label="Remove sketch from layer" disabled={busy} onClick={()=>{change({...drawing,sketches:drawing.sketches.filter(s=>s.id!==selected.id)});setSketchId(null)}}><Trash2 size={13}/></button></div>}
   {!sheet.loaded&&<p className="map-tracing-hint" role="status">Opening tracing paper…</p>}{!sheet.available&&!sheet.error&&<p className="map-tracing-hint">Drawing works here. Saving needs the one-time setup.</p>}{sheet.error&&<p className="paper-error" role="alert">{sheet.error}</p>}
  </section>
 </>;
}
