'use client';
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
 const dialog=useRef<HTMLDialogElement>(null),figure=useRef<HTMLElement>(null),notes=useRef<HTMLDivElement>(null),[editing,setEditing]=useState(initialMode==='edit'),[tracing,setTracing]=useState(false),[ratio,setRatio]=useState(1),[notesVisible,setNotesVisible]=useState(false),[notesStarted,setNotesStarted]=useState(false);
 function revealNotes(){const height=figure.current?.clientHeight||1,progress=Math.min(1,Math.max(0,(dialog.current?.scrollTop||0)/height));notes.current?.style.setProperty('--notes-offset',`${(1-progress)*100}%`);setNotesVisible(progress>=.999);setNotesStarted(progress>0);}
 function showNotes(){dialog.current?.scrollTo({top:figure.current?.clientHeight||0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
 useEffect(()=>{const node=dialog.current;if(!node)return;node.showModal();node.scrollTop=0;return()=>node.close();},[]);
 const types=IMAGE_TYPES.filter(t=>photo.tags?.imageTypes.includes(t.id)).map(t=>t.label);
 const cameraName=/^(IMG|DSC|DSCF|PXL|DCIM)[_\s-]?\d/i.test(photo.title);
 const heading=types.join(' / ')||(!cameraName?photo.title:'Photograph');
 const uploaded=photo.isLocalPreview?'Local preview only':new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',day:'numeric',month:'short',year:'numeric'}).format(photo.createdAt);
 return <dialog ref={dialog} className="gallery-lightbox" aria-label="Photograph details" onScroll={tracing?undefined:revealNotes} style={{overflow:tracing?'hidden':undefined}} onClick={e=>{if(e.target===e.currentTarget)onClose()}} onCancel={e=>{e.preventDefault();onClose()}}>
  {editing?<div className="gallery-lightbox-edit"><button className="gallery-edit-close" aria-label="Back to gallery" onClick={onClose}><X size={17}/></button><PhotoEdit photo={photo} walks={walks} people={people} onDeleted={onDeleted} onCancel={()=>setEditing(false)} onSaved={p=>{onSaved(p);setEditing(false)}}/></div>:<div className="gallery-focus-track" style={{'--photo-ratio':ratio} as CSSProperties}>
   <figure ref={figure} className="gallery-lightbox-figure"><button className="gallery-lightbox-close" aria-label="Back to gallery" onClick={onClose}><X size={17}/></button>{photo.mediaType==='video'?<video src={photo.url} controls playsInline onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setRatio(v.videoWidth/v.videoHeight)}}/>:<PhotoTracing enlargeable={false} startTracing={initialMode==='trace'} key={photo.id+photo.url} photo={photo} onRatio={setRatio} onEditingChange={setTracing}/>}{!tracing&&<button className="gallery-focus-hint" onClick={showNotes}>scroll for details ↓</button>}
   <div ref={notes} style={{display:tracing?'none':undefined}} className={'gallery-lightbox-notes '+(notesVisible?'notes-revealed':'')} inert={!notesStarted} aria-hidden={!notesStarted}><header className="gallery-lightbox-heading"><div><h2>{heading}</h2><p>{photo.author?`Photograph by ${photo.author}`:'Photographer not recorded'}</p><p>{photo.place}</p>{photo.caption&&<p className="gallery-lightbox-caption">{photo.caption}</p>}<p className="gallery-lightbox-file">{photo.title} · {photo.isLocalPreview?uploaded:`uploaded ${uploaded}`}</p></div><div className="gallery-lightbox-actions">{!photo.source&&<button onClick={()=>downloadMedia(photo.url,photo.title)}><Download size={12}/>Download</button>}{!localPreview&&canEditPhoto(photo)&&<button onClick={()=>setEditing(true)}><Pencil size={12}/>Edit photograph</button>}</div></header><PhotoTagEditor key={photo.id} photo={photo} available={tagsAvailable} localOnly={!!photo.isLocalPreview} onSaved={onTags}/><PhotoConditionsCard conditions={photo.conditions} onRevisit={onRevisit}/></div></figure><div className="gallery-focus-scroll-space" aria-hidden="true"/>
  </div>}
 </dialog>;
}
