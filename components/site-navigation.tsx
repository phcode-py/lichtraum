'use client';

import {useEffect,useRef,useState} from 'react';

const sections=[
 {id:'walks',label:'Walks'},
 {id:'explore',label:'Light atlas'},
 {id:'correspondence',label:'Working notes'},
];

export default function SiteNavigation({active,onOpen,onNavigate}:{active:string;onOpen:()=>void;onNavigate:(section:string)=>void}){
 const[open,setOpen]=useState(false),[preview,setPreview]=useState<string|null>(null);
 const container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 const current=active==='mine'?'explore':active;
 const highlighted=preview??current;
 useEffect(()=>{
  if(!open)return;
  function outside(event:PointerEvent){if(!container.current?.contains(event.target as Node))setOpen(false)}
  function keyboard(event:KeyboardEvent){
   if(event.key==='Escape'){setOpen(false);trigger.current?.focus();return;}
   if(event.key==='Tab'){
    const items=[trigger.current,...(container.current?.querySelectorAll<HTMLButtonElement>('nav button')??[])].filter((item):item is HTMLButtonElement=>!!item);
    const index=items.indexOf(document.activeElement as HTMLButtonElement);
    if(event.shiftKey&&(index<=0)){event.preventDefault();items.at(-1)?.focus()}
    else if(!event.shiftKey&&(index===items.length-1||index===-1)){event.preventDefault();items[0]?.focus()}
   }
  }
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',keyboard);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard)};
 },[open]);
 return <div className="site-navigation" ref={container}>
  <button ref={trigger} className="navigation-trigger" aria-label="Menu" aria-expanded={open} aria-controls="site-sections" onClick={()=>{if(!open){onOpen();setPreview(null)}setOpen(value=>!value)}}><svg viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M2 5h32M2 14h32M2 23h32"/></svg></button>
  <nav id="site-sections" className="navigation-sheet" data-open={open} aria-hidden={!open} inert={!open} aria-label="Main navigation">
   <div className="navigation-heading" aria-label="Lichtraum Zürich"><span>LICHTRAUM</span><span>ZÜRICH</span></div>
   <div className="navigation-content">
    <div className="navigation-links">{sections.map(section=><button key={section.id} className={highlighted===section.id?'is-highlighted':''} aria-current={current===section.id?'page':undefined} onPointerEnter={()=>setPreview(section.id)} onPointerLeave={()=>setPreview(null)} onFocus={()=>setPreview(section.id)} onBlur={()=>setPreview(null)} onClick={()=>{onNavigate(section.id);setOpen(false);trigger.current?.focus()}}>{section.label}</button>)}</div>
   </div>
  </nav>
 </div>;
}
