'use client';
import {useEffect,useRef,useState,type VideoHTMLAttributes} from 'react';

/** Start only visible videos, and stop decoding when they leave the page or the tab is hidden.
 *  `held` keeps a video paused that the viewer paused on purpose. */
export default function AutoVideo({src,held=false,onElement,...props}:VideoHTMLAttributes<HTMLVideoElement>&{held?:boolean;onElement?:(video:HTMLVideoElement|null)=>void}){
 const video=useRef<HTMLVideoElement>(null),[visible,setVisible]=useState(false),[seen,setSeen]=useState(false);
 useEffect(()=>{
  const node=video.current;if(!node)return;
  const observer=new IntersectionObserver(([entry])=>{setVisible(entry.isIntersecting);if(entry.isIntersecting)setSeen(true)});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{onElement?.(video.current);return()=>onElement?.(null)},[onElement]);
 useEffect(()=>{
  const node=video.current;if(!node)return;
  function sync(){if(visible&&!held&&!document.hidden)void node!.play().catch(()=>{});else node!.pause()}
  sync();document.addEventListener('visibilitychange',sync);return()=>{document.removeEventListener('visibilitychange',sync);node.pause()};
 },[visible,held,src]);
 return <video {...props} ref={video} src={seen?src:undefined} autoPlay={visible&&!held} loop muted playsInline preload="none"/>;
}
