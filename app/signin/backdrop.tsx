'use client';
import {useEffect,useRef} from 'react';
import type {Map} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {mapStyle} from '@/components/photo-map';

/** The public city map only: no location permission or private photographs. */
export default function SignInBackdrop(){
 const element=useRef<HTMLDivElement>(null);
 useEffect(()=>{let cancelled=false,map:Map|undefined;
  import('maplibre-gl').then(M=>{if(cancelled||!element.current)return;map=new M.Map({container:element.current,style:mapStyle,center:[8.5399,47.3709],zoom:14.4,interactive:false,attributionControl:{compact:true},canvasContextAttributes:{antialias:false}})}).catch(()=>{});
  return()=>{cancelled=true;map?.remove()};
 },[]);
 return <div className="signin-map" ref={element} aria-label="Zürich map background"/>;
}
