'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Printer,X} from 'lucide-react';
import type {Map as MapLibreMap} from 'maplibre-gl';
import {MAX_SHEETS,PRINT_SCALES,printSheets,renderA3Sheets,sheetPlan,type Orientation,type PrintScale} from '@/lib/map-print';

const metres=(m:number)=>m>=1000?`${+(m/1000).toFixed(2)} km`:m>=10?`${Math.round(m)} m`:`${+m.toFixed(2)} m`;

/** A printer icon among the map tools: prints the visible map at a true scale on A3 sheets. */
export default function MapPrintButton({getMap}:{getMap:()=>MapLibreMap|null}){
 const[open,setOpen]=useState(false),[scale,setScale]=useState<PrintScale>(1000),[orientation,setOrientation]=useState<Orientation>('landscape');
 const[busy,setBusy]=useState(false),[error,setError]=useState(''),[,setMoved]=useState(0);
 const panel=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),[place,setPlace]=useState<{top:number;left:number}|null>(null);
 // The panel opens to the left of the map tools and floats above everything.
 function show(){const r=toggle.current?.getBoundingClientRect();if(r)setPlace({top:Math.max(12,Math.min(r.top,window.innerHeight-560)),left:Math.max(12,r.left-342)});setOpen(o=>!o);setError('')}
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{const t=e.target as Node;if(!busy&&!panel.current?.contains(t)&&!toggle.current?.contains(t))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open,busy]);
 // Moving the map while the panel is open updates the number of sheets.
 useEffect(()=>{const map=getMap();if(!open||!map)return;const update=()=>setMoved(n=>n+1);map.on('moveend',update);return()=>{map.off('moveend',update)}},[open,getMap]);
 const map=open?getMap():null,plan=map?sheetPlan(map,scale,orientation):null,tooMany=!!plan&&plan.count>MAX_SHEETS;
 async function print(){
  const map=getMap();if(!map){setError('The map is still loading. Try again in a moment.');return;}
  if(sheetPlan(map,scale,orientation).count>MAX_SHEETS)return;
  // Opened right away, while the click still counts, so the browser does not block it.
  const win=window.open('','_blank');
  if(!win){setError('Allow pop-ups for this site to print the map.');return;}
  win.document.write('<p style="font:14px Arial,sans-serif;padding:24px;color:#555">Preparing the map sheets…</p>');
  setBusy(true);setError('');
  try{printSheets(win,await renderA3Sheets(map,scale,orientation),orientation);setOpen(false);}
  catch(e){win.close();setError(e instanceof Error?e.message:'The map could not be prepared for printing.');}
  finally{setBusy(false);}
 }
 return <>
  <button ref={toggle} type="button" aria-label="Print the map to scale on A3" title="Print the map to scale on A3" aria-expanded={open} onClick={show}><Printer aria-hidden="true"/></button>
  {open&&place&&createPortal(<div ref={panel} className="map-print-panel" role="dialog" aria-label="Print the map to scale on A3" style={place}>
   <div className="map-print-head"><span>Print the map on A3</span><button type="button" aria-label="Close" onClick={()=>setOpen(false)}><X size={14}/></button></div>
   <fieldset><legend>Scale</legend><div className="map-print-scales">{PRINT_SCALES.map(s=><label key={s}><input type="radio" name="map-print-scale" checked={scale===s} onChange={()=>setScale(s)}/><span>1:{s}</span></label>)}</div></fieldset>
   <fieldset><legend>Sheet</legend><div className="map-print-choices">{(['landscape','portrait'] as const).map(o=><label key={o}><input type="radio" name="map-print-orientation" checked={orientation===o} onChange={()=>setOrientation(o)}/><span>{o}</span></label>)}</div></fieldset>
   {plan&&!tooMany&&<div className="map-print-plan" aria-hidden="true" style={{gridTemplateColumns:`repeat(${plan.cols},1fr)`,maxWidth:Math.min(220,plan.cols*48)}}>{Array.from({length:plan.count},(_,i)=><span key={i} style={{aspectRatio:orientation==='landscape'?'420/297':'297/420'}}>{plan.count<=12?i+1:''}</span>)}</div>}
   {plan&&<p className="map-print-note">{tooMany?<>At 1:{scale} the visible map needs {plan.count} sheets, more than {MAX_SHEETS}. Zoom in on the map, or choose a higher number such as 1:5000.</>:<>The visible map at 1:{scale}: {plan.count} × A3 {orientation}. One sheet covers {metres(plan.ground.w)} × {metres(plan.ground.h)} of Zürich; all sheets {metres(plan.total.w)} × {metres(plan.total.h)}. Walk routes are included; weather and sun are left out.</>}</p>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button type="button" className="map-print-go" disabled={busy||tooMany} onClick={print}><Printer size={14} aria-hidden="true"/>{busy?'Preparing sheets…':tooMany?'Too many sheets':`Print ${plan?.count??''} ${plan?.count===1?'sheet':'sheets'}`}</button>
  </div>,document.body)}
 </>;
}
