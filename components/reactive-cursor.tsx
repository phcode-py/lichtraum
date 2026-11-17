'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';

export default function ReactiveCursor(){
 const cursor=useRef<HTMLDivElement>(null),position=useRef({x:-100,y:-100,visible:false,mode:'default'});
 const[host,setHost]=useState<HTMLElement|null>(null);
 // Render in the open dialog so the dot stays above the browser's modal top layer.
 useEffect(()=>{
  const media=matchMedia('(hover: hover) and (pointer: fine)');
  let observer:MutationObserver|undefined;
  function locateHost(){const dialogs=document.querySelectorAll<HTMLDialogElement>('dialog[open]');setHost(dialogs[dialogs.length-1]??document.body)}
  function configure(){
   observer?.disconnect();document.documentElement.classList.toggle('reactive-cursor',media.matches);
   if(!media.matches){setHost(null);return;}
   locateHost();observer=new MutationObserver(locateHost);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  }
  configure();media.addEventListener('change',configure);
  return()=>{observer?.disconnect();media.removeEventListener('change',configure);document.documentElement.classList.remove('reactive-cursor')};
 },[]);
 useLayoutEffect(()=>{const node=cursor.current;if(node){const p=position.current;node.style.left=p.x+'px';node.style.top=p.y+'px';node.style.opacity=p.visible?'1':'0';node.dataset.mode=p.mode}},[host]);
 useEffect(()=>{
  let frame=0;
  function update(e:PointerEvent){
   if(e.pointerType==='touch')return;
   const target=e.target instanceof Element?e.target:null;
   const action=target?.closest('button,a[href],[role="button"],summary,select,label,input:not([type="hidden"]),textarea,[contenteditable="true"],[role="slider"]');
   const enabled=!!action&&!action.matches(':disabled,[aria-disabled="true"]')&&!(action.matches('label')&&action.querySelector(':disabled'));
   position.current={x:e.clientX,y:e.clientY,visible:true,mode:enabled?'link':'default'};
   cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const node=cursor.current,p=position.current;if(node){node.style.left=p.x+'px';node.style.top=p.y+'px';node.style.opacity='1';node.dataset.mode=p.mode}});
  }
  function leave(){position.current.visible=false;if(cursor.current)cursor.current.style.opacity='0'}
  window.addEventListener('pointermove',update,{passive:true,capture:true});window.addEventListener('pointerdown',update,{passive:true,capture:true});document.addEventListener('pointerleave',leave);window.addEventListener('blur',leave);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('pointermove',update,true);window.removeEventListener('pointerdown',update,true);document.removeEventListener('pointerleave',leave);window.removeEventListener('blur',leave)};
 },[]);
 return host?createPortal(<div className="custom-cursor" aria-hidden="true" ref={cursor}/>,host):null;
}
