'use client';
import {useEffect,useRef,useState} from 'react';
import {Download,Pencil,PenLine,Trash2,Play,X} from 'lucide-react';
import {downloadMedia} from '@/lib/download';
import AtlasMedia from './atlas-media';
import FavouriteStar from './favourite-star';
import PhotoTracing,{type PhotoTracingHandle} from './photo-tracing';
import type {GalleryPhoto} from '@/lib/gallery';
import PhotoInformation from './photo-information';
import {useImageViewer} from './image-viewer';

/** The atlas stays image-first; recorded information unfolds only on request. */
export default function AtlasPictureCard({photo,walkTitle,expanded,onToggle,onEdit,onRemove,favourite=false,favouriteBy='',onFavourite,onOpen}:{walkTitle?:string;onOpen?:()=>void;photo:GalleryPhoto;expanded:boolean;onToggle:()=>void;onEdit?:()=>void;onRemove?:()=>void;favourite?:boolean;favouriteBy?:string;onFavourite?:()=>void}){
 const openImage=useImageViewer();
 const[tracing,setTracing]=useState(false),[playing,setPlaying]=useState(false),tracingRef=useRef<PhotoTracingHandle>(null);
 /** Back to the picture: unsaved drawing is saved first, so leaving never loses lines. */
 async function leave(){if(tracing&&tracingRef.current?.hasPending()&&!await tracingRef.current.savePending())return;setTracing(false);setPlaying(false)}
 const leaveRef=useRef(leave);
 useEffect(()=>{leaveRef.current=leave});
 useEffect(()=>{if(!tracing&&!playing)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!(e.target as HTMLElement)?.closest?.('input,textarea')){e.preventDefault();e.stopPropagation();leaveRef.current()}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[tracing,playing]);
 const detailsId='atlas-info-'+photo.id;
 const label=photo.title.trim()||'Untitled photograph';
 function view(){if(photo.mediaType==='video')onToggle();else if(onOpen)onOpen();else openImage({url:photo.url,title:label})}
 return <article data-photo-id={photo.id} className={'atlas-picture-card'+(expanded?' info-open':'')+(tracing||playing?' media-active':'')}>
  <div className="atlas-picture-surface" onClick={event=>{if(!tracing&&!playing&&!(event.target as HTMLElement).closest('button,a'))view()}}>
   {playing&&photo.mediaType==='video'?<AtlasMedia url={photo.url} title={label} mediaType="video" controls/>:tracing?<PhotoTracing photo={photo} tracingRef={tracingRef}/>:<button type="button" className="atlas-picture-toggle" aria-label={(photo.mediaType==='video'?'Photograph information for ':'Enlarge ')+label} aria-controls={photo.mediaType==='video'?detailsId:undefined} onClick={view}><AtlasMedia url={photo.url} title={label} mediaType={photo.mediaType}/></button>}

  {!tracing&&!playing&&<section id={detailsId} className="atlas-picture-info" aria-label="Photograph information">
   <PhotoInformation photo={photo} walkTitle={walkTitle}/>
   <div className="atlas-picture-actions">{photo.mediaType==='video'&&<button type="button" aria-label="Play video" onClick={()=>{setPlaying(true);onToggle()}}><Play size={13}/></button>}{photo.mediaType!=='video'&&<button type="button" aria-label="Trace photograph" aria-pressed={tracing} onClick={()=>{setTracing(true);onToggle()}}><PenLine size={13}/></button>}{onEdit&&<button type="button" aria-label={'Edit '+label} onClick={onEdit}><Pencil size={12}/></button>}{onRemove&&<button type="button" aria-label={'Remove '+label} onClick={onRemove}><Trash2 size={12}/></button>}{!photo.source&&<button type="button" aria-label={'Download '+label} title="Download" onClick={()=>downloadMedia(photo.url,label)}><Download size={13}/></button>}{photo.source&&<a href={photo.source} target="_blank" rel="noreferrer">Source ↗</a>}</div>
  </section>}
  {(tracing||playing)&&<button type="button" className="atlas-picture-leave" aria-label={tracing?'Close tracing':'Close video'} title={tracing?'Close tracing':'Close video'} onClick={leave}><X size={16}/></button>}
  {!tracing&&!playing&&onFavourite&&<FavouriteStar active={favourite} by={favouriteBy} title={label} onToggle={onFavourite}/>}
  </div>
 </article>;
}
