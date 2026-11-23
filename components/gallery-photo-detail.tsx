'use client';
import AutoVideo from './auto-video';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Download,Pencil,X} from 'lucide-react';
import {downloadMedia} from '@/lib/download';
import PhotoConditionsCard from './photo-conditions';
import PhotoTagEditor from './photo-tags';
import PhotoEdit,{type EditWalk} from './photo-edit';
import PhotoTracing from './photo-tracing';
import {IMAGE_TYPES,canEditPhoto,type GalleryPhoto,type PhotoTags} from '@/lib/gallery';
import type {PhotoConditions} from '@/lib/photo-conditions';

export default function GalleryPhotoDetail({photo,walks,people,initialMode,onDeleted,tagsAvailable,localPreview,onClose,onTags,onSaved,onRevisit}:{photo:GalleryPhoto;walks?:EditWalk[];people?:string[];initialMode?:'edit'|'trace';onDeleted?:(id:string)=>void;tagsAvailable:boolean;localPreview:boolean;onClose:()=>void;onTags:(tags:PhotoTags)=>void;onSaved:(photo:GalleryPhoto)=>void;onRevisit:(c:PhotoConditions)=>void}){
 // Only a click that starts and ends beside the picture closes it; selecting text in the form and
 // letting go outside must not. While editing, the view never closes this way, so edits are not lost.
 const pressedOutside=useRef(false);
 const[startAtCapture,setStartAtCapture]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),figure=useRef<HTMLElement>(null),notes=useRef<HTMLDivElement>(null),[editing,setEditing]=useState(initialMode==='edit'),[tracing,setTracing]=useState(false),[ratio,setRatio]=useState(1),[notesVisible,setNotesVisible]=useState(false),[notesStarted,setNotesStarted]=useState(false);
 function revealNotes(){const height=figure.current?.clientHeight||1,progress=Math.min(1,Math.max(0,(dialog.current?.scrollTop||0)/height));notes.current?.style.setProperty('--notes-offset',`${(1-progress)*100}%`);setNotesVisible(progress>=.999);setNotesStarted(progress>0);}
 function showNotes(){dialog.current?.scrollTo({top:figure.current?.clientHeight||0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 useEffect(()=>{const node=dialog.current;if(!node)return;node.showModal();node.scrollTop=0;return()=>node.close();},[]);
 // The walk the picture belongs to, if that walk is still saved.
 const walkName=photo.walk?(walks?.find(w=>w.id===photo.walk)?.title.trim()||(walks?.some(w=>w.id===photo.walk)?'Untitled walk':'')):'';
 const types=IMAGE_TYPES.filter(t=>photo.tags?.imageTypes.includes(t.id)).map(t=>t.label);
 const cameraName=/^(IMG|DSC|DSCF|PXL|DCIM)[_\s-]?\d/i.test(photo.title);
 // The picture's own title; a bare camera file name (IMG_1234) falls back to its light type.
 const heading=(!cameraName&&photo.title.trim())||types.join(' / ')||'Photograph';
 return <dialog ref={dialog} className="gallery-lightbox" aria-label="Photograph details" onScroll={tracing?undefined:revealNotes} style={{overflow:tracing?'hidden':undefined}} onPointerDown={e=>{pressedOutside.current=e.target===e.currentTarget}} onClick={e=>{if(e.target===e.currentTarget&&pressedOutside.current&&!editing)onClose();pressedOutside.current=false}} onCancel={e=>{e.preventDefault();onClose()}}>
  {editing?<div className="gallery-lightbox-edit"><button className="gallery-edit-close" aria-label="Back to gallery" onClick={onClose}><X size={17}/></button><PhotoEdit startAtCapture={startAtCapture} photo={photo} walks={walks} people={people} onDeleted={onDeleted} onCancel={()=>setEditing(false)} onSaved={p=>{onSaved(p);setEditing(false)}}/></div>:<div className="gallery-focus-track" style={{'--photo-ratio':ratio} as CSSProperties}>
   <figure ref={figure} className="gallery-lightbox-figure"><button className="gallery-lightbox-close" aria-label="Back to gallery" onClick={onClose}><X size={17}/></button>{photo.mediaType==='video'?<AutoVideo src={photo.url} controls playsInline onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setRatio(v.videoWidth/v.videoHeight)}}/>:<PhotoTracing enlargeable={false} startTracing={initialMode==='trace'} key={photo.id+photo.url} photo={photo} onRatio={setRatio} onEditingChange={setTracing}/>}{!tracing&&<button className="gallery-focus-hint" onClick={showNotes}>scroll for details ↓</button>}
   <div ref={notes} style={{display:tracing?'none':undefined}} className={'gallery-lightbox-notes '+(notesVisible?'notes-revealed':'')} inert={!notesStarted} aria-hidden={!notesStarted}><header className="gallery-lightbox-heading"><div><h2>{heading}</h2><p>{photo.author?`Photograph by ${photo.author}`:'Photographer not recorded'}</p>{walkName&&<p>Walk · {walkName}</p>}<p>{photo.place}</p>{photo.caption&&<p className="gallery-lightbox-caption">{photo.caption}</p>}</div><div className="gallery-lightbox-actions">{!photo.source&&<button aria-label="Download" title="Download" onClick={()=>downloadMedia(photo.url,photo.title)}><Download size={16}/></button>}{!localPreview&&canEditPhoto(photo)&&<button aria-label="Edit photograph" title="Edit photograph" onClick={()=>{setStartAtCapture(false);setEditing(true)}}><Pencil size={15}/></button>}</div></header><PhotoConditionsCard conditions={photo.conditions} onRevisit={onRevisit} onAddCapture={!localPreview&&canEditPhoto(photo)&&!photo.source?()=>{setStartAtCapture(true);setEditing(true)}:undefined}/><PhotoTagEditor key={photo.id} photo={photo} available={tagsAvailable} localOnly={!!photo.isLocalPreview} onSaved={onTags}/></div></figure><div className="gallery-focus-scroll-space" aria-hidden="true"/>
  </div>}
 </dialog>;
}
