'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Check} from 'lucide-react';

const sections=[
 {id:'walks',label:'Walks'},
 {id:'explore',label:'Light atlas'},
 {id:'correspondence',label:'Correspondence'},
];

export default function SiteNavigation({active,onOpen,onNavigate}:{active:string;onOpen:()=>void;onNavigate:(section:string)=>void}){
 const[open,setOpen]=useState(false);
 const container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  function outside(event:PointerEvent){if(!container.current?.contains(event.target as Node))setOpen(false)}
  function escape(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}}
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[open]);
 return <div className="site-navigation" ref={container}>
  <button ref={trigger} className="navigation-trigger" aria-label="Menu" aria-expanded={open} aria-controls="site-sections" onClick={()=>{if(!open)onOpen();setOpen(value=>!value)}}><svg viewBox="0 0 36 28" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M2 5h32M2 14h32M2 23h32"/></svg></button>
  {open&&<nav id="site-sections" className="navigation-sheet" aria-label="Main navigation">
   <div className="navigation-heading">lichtraum zürich</div>
   {sections.map((section,index)=>{const current=active===section.id||(active==='mine'&&section.id==='explore');return <button key={section.id} aria-current={current?'page':undefined} onClick={()=>{onNavigate(section.id);setOpen(false);trigger.current?.focus()}}><span className="navigation-index">0{index+1}</span><span><strong>{section.label}</strong></span>{current?<Check size={15}/>:<ArrowUpRight size={15}/>}</button>})}
  </nav>}
 </div>;
}
