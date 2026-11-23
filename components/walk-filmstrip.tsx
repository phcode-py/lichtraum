'use client';
import {useEffect,useRef} from 'react';
import {ChevronLeft,ChevronRight,X} from 'lucide-react';
import type {GalleryPhoto} from '@/lib/gallery';
import type {Walk} from '@/lib/walks';
import {sequenceWalkPhotos} from '@/lib/walk-filmstrip';
import AtlasMedia from './atlas-media';
import {useImageViewer} from './image-viewer';
export default function WalkFilmstrip({walk,photos,selected,onSelect,onClose,onOpen}:{onOpen?:(id:string)=>void;walk:Walk;photos:GalleryPhoto[];selected:string|null;onSelect:(id:string)=>void;onClose:()=>void}){
 const openImage=useImageViewer();
 const items=sequenceWalkPhotos(walk,photos),index=Math.max(0,items.findIndex(item=>item.photo.id===selected)),strip=useRef<HTMLDivElement>(null);
 useEffect(()=>{strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'nearest',inline:'nearest'})},[selected]);
 return <section className="walk-filmstrip" aria-label="Walk filmstrip"><header><span>{walk.title||'Untitled walk'}</span><div><button disabled={index===0} aria-label="Previous photograph" onClick={()=>onSelect(items[index-1].photo.id)}><ChevronLeft size={17}/></button><button disabled={index>=items.length-1} aria-label="Next photograph" onClick={()=>onSelect(items[index+1].photo.id)}><ChevronRight size={17}/></button><button aria-label="Close filmstrip" onClick={onClose}><X size={17}/></button></div></header><div className="filmstrip-frames" ref={strip}>{items.map(({photo,distance})=><button className="filmstrip-frame" key={photo.id} aria-current={selected===photo.id?'true':undefined} aria-label={'View '+photo.title+' on the route'} onClick={()=>{onSelect(photo.id);if(photo.mediaType!=='video'){if(onOpen)onOpen(photo.id);else openImage({url:photo.url,title:photo.title})}}}><AtlasMedia url={photo.url} title={photo.title} mediaType={photo.mediaType}/><span>{photo.place}{distance!==null&&<small>{(distance/1000).toFixed(2)} km</small>}</span></button>)}</div></section>;
}
