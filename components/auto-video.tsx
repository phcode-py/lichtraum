'use client';
import {useEffect,useRef,useState,type VideoHTMLAttributes} from 'react';

/** Start only visible videos, and stop decoding when they leave the page or the tab is hidden. */
export default function AutoVideo({src,...props}:VideoHTMLAttributes<HTMLVideoElement>){
 const video=useRef<HTMLVideoElement>(null),[visible,setVisible]=useState(false),[seen,setSeen]=useState(false);
 useEffect(()=>{
  const node=video.current;if(!node)return;
  const observer=new IntersectionObserver(([entry])=>{setVisible(entry.isIntersecting);if(entry.isIntersecting)setSeen(true)});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const node=video.current;if(!node)return;
  function sync(){if(visible&&!document.hidden)void node!.play().catch(()=>{});else node!.pause()}
  sync();document.addEventListener('visibilitychange',sync);return()=>{document.removeEventListener('visibilitychange',sync);node.pause()};
 },[visible,src]);
 return <video {...props} ref={video} src={seen?src:undefined} autoPlay={visible} loop muted playsInline preload="none"/>;
}
