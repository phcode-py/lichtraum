'use client';
import AutoVideo from './auto-video';
import {useState} from 'react';
import {Play} from 'lucide-react';
import {videoThumbnailSrc} from '@/lib/media';

export default function AtlasMedia({url,title,mediaType,className='',controls=false}:{url:string;title:string;mediaType?:'photo'|'video';className?:string;controls?:boolean}) {
 const [failed,setFailed]=useState('');
 if(mediaType!=='video')return <img className={className} src={url} alt={title} loading="lazy"/>;
 return <div className={'atlas-video '+className}>
  <AutoVideo key={url} src={videoThumbnailSrc(url,controls)} aria-label={title} controls={controls} playsInline preload="metadata" onError={()=>setFailed(url)}/>
  {failed===url&&<span className="video-fallback">{controls?<>This video cannot play in this browser. <a href={url} target="_blank" rel="noreferrer">Open video</a></>:<><Play size={22} strokeWidth={1.4}/>Video · open to view</>}</span>}
 </div>;
}
