'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';

/** onClose runs after the enlarged picture is closed, e.g. to show it in its list. */
type Picture={url:string;title:string;onClose?:()=>void};
const ImageViewerContext=createContext<(picture:Picture)=>void>(()=>{});
export const useImageViewer=()=>useContext(ImageViewerContext);

function EnlargedImage({picture,onClose}:{picture:Picture;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current!;const previous=document.activeElement,overflow=document.body.style.overflow;node.showModal();document.body.style.overflow='hidden';return()=>{node.close();document.body.style.overflow=overflow;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true})}},[]);
 return createPortal(<dialog ref={dialog} className="image-viewer" aria-label={picture.title||'Enlarged picture'} onCancel={e=>{e.preventDefault();onClose()}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose()}}} onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)onClose()}}>
  <button type="button" autoFocus className="image-viewer-close" aria-label="Close enlarged picture" onClick={onClose}><X size={22}/></button>
  <img src={picture.url} alt={picture.title} draggable={false}/>
 </dialog>,document.body);
}

export default function ImageViewerProvider({children}:{children:ReactNode}){
 const[picture,setPicture]=useState<Picture|null>(null);
 const open=useCallback((next:Picture)=>{if(next.url)setPicture(next)},[]);
 return <ImageViewerContext.Provider value={open}>{children}{picture&&<EnlargedImage picture={picture} onClose={()=>{setPicture(null);picture.onClose?.()}}/>}</ImageViewerContext.Provider>;
}

export function ImageViewButton({url,title,className='',children}:{url:string;title:string;className?:string;children:ReactNode}){
 const open=useImageViewer();
 return <button type="button" className={className} aria-label={'Enlarge '+(title||'picture')} onClick={e=>{e.preventDefault();e.stopPropagation();open({url,title})}}>{children}</button>;
}
