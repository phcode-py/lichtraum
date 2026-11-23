'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Printer,X} from 'lucide-react';
import type {LngLatBoundsLike,Map as MapLibreMap} from 'maplibre-gl';
import {SHEET_LAYOUTS,printSheets,renderA3Sheets,type SheetLayout} from '@/lib/map-print';

/** A small printer icon that prints the map across several A3 sheets. */
export default function MapPrintButton({getMap,bounds,what}:{getMap:()=>MapLibreMap|null;bounds?:LngLatBoundsLike;what:string}){
 const[open,setOpen]=useState(false),[layout,setLayout]=useState<SheetLayout>({cols:2,rows:2,orientation:'landscape'});
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 const panel=useRef<HTMLDivElement>(null),toggle=useRef<HTMLButtonElement>(null),[place,setPlace]=useState<{top:number;left:number}|null>(null);
 // The panel floats above everything, next to the icon, so the walks column cannot cut it off.
 function show(){const r=toggle.current?.getBoundingClientRect();if(r)setPlace({top:Math.max(12,Math.min(r.bottom+6,window.innerHeight-440)),left:Math.max(12,Math.min(r.right-260,window.innerWidth-272))});setOpen(o=>!o)}
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{const t=e.target as Node;if(!busy&&!panel.current?.contains(t)&&!toggle.current?.contains(t))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[open,busy]);
 async function print(){
  const map=getMap();if(!map){setError('The map is still loading. Try again in a moment.');return;}
  // Opened right away, while the click still counts, so the browser does not block it.
  const win=window.open('','_blank');
  if(!win){setError('Allow pop-ups for this site to print the map.');return;}
  win.document.write('<p style="font:14px Arial,sans-serif;padding:24px;color:#555">Preparing the map sheets…</p>');
  setBusy(true);setError('');
  try{printSheets(win,await renderA3Sheets(map,layout,bounds),layout.orientation);setOpen(false);}
  catch(e){win.close();setError(e instanceof Error?e.message:'The map could not be prepared for printing.');}
  finally{setBusy(false);}
 }
 const count=layout.cols*layout.rows,landscape=layout.orientation==='landscape';
 return <div className="map-print">
  <button ref={toggle} type="button" className="map-print-toggle" aria-label="Print the map on A3 sheets" title="Print the map on A3 sheets" aria-expanded={open} onClick={show}><Printer size={15} aria-hidden="true"/></button>
  {open&&place&&createPortal(<div ref={panel} className="map-print-panel" role="dialog" aria-label="Print the map on A3 sheets" style={place}>
   <div className="map-print-head"><span>Print {what} on A3</span><button type="button" aria-label="Close" onClick={()=>setOpen(false)}><X size={14}/></button></div>
   <fieldset><legend>Sheets</legend><div className="map-print-choices">{SHEET_LAYOUTS.map(l=><label key={l.label}><input type="radio" name="map-print-sheets" checked={l.cols===layout.cols&&l.rows===layout.rows} onChange={()=>setLayout({...layout,cols:l.cols,rows:l.rows})}/><span>{l.label}</span></label>)}</div></fieldset>
   <fieldset><legend>Sheet</legend><div className="map-print-choices">{(['landscape','portrait'] as const).map(o=><label key={o}><input type="radio" name="map-print-orientation" checked={layout.orientation===o} onChange={()=>setLayout({...layout,orientation:o})}/><span>{o}</span></label>)}</div></fieldset>
   <div className="map-print-plan" aria-hidden="true" style={{gridTemplateColumns:`repeat(${layout.cols},1fr)`}}>{Array.from({length:count},(_,i)=><span key={i} style={{aspectRatio:landscape?'420/297':'297/420'}}>{i+1}</span>)}</div>
   <p className="map-print-note">{count} × A3 {layout.orientation} · {landscape?42*layout.cols:29.7*layout.cols} × {landscape?29.7*layout.rows:42*layout.rows} cm together. The map as it is now, with walk routes; weather and sun overlays are left out.</p>
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button type="button" className="map-print-go" disabled={busy} onClick={print}><Printer size={14} aria-hidden="true"/>{busy?'Preparing sheets…':'Print'}</button>
  </div>,document.body)}
 </div>;
}
