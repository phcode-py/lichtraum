'use client';
import {useRef,type PointerEvent,type KeyboardEvent} from 'react';
export type PaperSize={width:number;height:number};
export const paperSize=(width:number,height:number):PaperSize=>({width:Math.round(Math.max(240,Math.min(1400,width))),height:Math.round(Math.max(320,Math.min(2000,height)))});

export default function PaperResize({title,onResize,onSave,onFocus}:{title:string;onResize:(size:PaperSize)=>void;onSave:(size:PaperSize)=>void;onFocus:()=>void}){
 const drag=useRef<{pointer:number;x:number;y:number;size:PaperSize;latest:PaperSize}|null>(null);
 function current(node:HTMLButtonElement){const rect=node.closest('article')!.getBoundingClientRect();return {width:rect.width,height:rect.height}}
 function start(e:PointerEvent<HTMLButtonElement>){if(e.button!==0)return;e.preventDefault();e.stopPropagation();onFocus();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);const size=current(e.currentTarget);drag.current={pointer:e.pointerId,x:e.clientX,y:e.clientY,size,latest:size}}
 function move(e:PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.preventDefault();e.stopPropagation();d.latest=paperSize(d.size.width+e.clientX-d.x,d.size.height+e.clientY-d.y);onResize(d.latest)}
 function finish(e:PointerEvent<HTMLButtonElement>){const d=drag.current;if(!d||d.pointer!==e.pointerId)return;e.stopPropagation();drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(d.size.width!==d.latest.width||d.size.height!==d.latest.height)onSave(d.latest)}
 function keyboard(e:KeyboardEvent<HTMLButtonElement>){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();onFocus();const size=current(e.currentTarget),step=e.shiftKey?40:20;const next=paperSize(size.width+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),size.height+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0));onResize(next);onSave(next)}
 return <button type="button" className="paper-resize" aria-label={'Resize '+title} title="Drag to resize · arrow keys also work" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onKeyDown={keyboard}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 11 11 3M8 11l3-3" fill="none" stroke="currentColor" strokeWidth="1"/></svg></button>;
}
