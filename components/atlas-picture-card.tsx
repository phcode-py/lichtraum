'use client';
import {useState} from 'react';
import {Pencil,PenLine,Trash2,Play} from 'lucide-react';
import AtlasMedia from './atlas-media';
import PhotoTracing from './photo-tracing';
import {AREAS,IMAGE_TYPES,TIMES,WEATHER,type GalleryPhoto} from '@/lib/gallery';
import {SUN_ZONE,sunDirection} from '@/lib/sun';

/** The atlas stays image-first; recorded information unfolds only on request. */
export default function AtlasPictureCard({photo,expanded,onToggle,onEdit,onRemove}:{photo:GalleryPhoto;expanded:boolean;onToggle:()=>void;onEdit?:()=>void;onRemove?:()=>void}){
 const[tracing,setTracing]=useState(false),[playing,setPlaying]=useState(false);
 const conditions=photo.conditions,weather=conditions?.weather;
 const date=conditions?.capturedAt??photo.createdAt;
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
 const tags=photo.tags;
 const labels=tags?[...IMAGE_TYPES.filter(t=>tags.imageTypes.includes(t.id)),...TIMES.filter(t=>t.id===tags.timeOfDay),...WEATHER.filter(t=>tags.weather.includes(t.id)),...AREAS.filter(t=>t.id===tags.area)].map(t=>t.label):[];
 const detailsId='atlas-info-'+photo.id;
 const label=photo.title.trim()||'Untitled photograph';
 return <article className={'atlas-picture-card'+(expanded?' info-open':'')+(tracing||playing?' media-active':'')}>
  <div className="atlas-picture-surface">
   {playing&&photo.mediaType==='video'?<AtlasMedia url={photo.url} title={label} mediaType="video" controls/>:tracing?<PhotoTracing photo={photo}/>:<button type="button" className="atlas-picture-toggle" aria-label={'Photograph information for '+label} aria-controls={detailsId} onClick={onToggle}><AtlasMedia url={photo.url} title={label} mediaType={photo.mediaType}/></button>}

  {!tracing&&!playing&&<section id={detailsId} className="atlas-picture-info" aria-label="Photograph information" onClick={event=>{if(!(event.target as HTMLElement).closest('button,a'))onToggle()}}>
   {photo.title.trim()&&<h2>{photo.title}</h2>}
   <div className="atlas-picture-meta"><p>{!conditions&&<span>Added </span>}<time title="Zürich time" dateTime={new Date(date).toISOString()}>{time}</time></p>{photo.place&&<p>{photo.place}</p>}{!photo.isLocalPreview&&Number.isFinite(photo.lat)&&Number.isFinite(photo.lng)&&(!photo.place||photo.place==='Dropped pin')&&<p>{photo.lat.toFixed(4)}° N, {photo.lng.toFixed(4)}° E</p>}</div>
   {conditions&&<div className="atlas-picture-meta"><p>Sun {Math.round(conditions.sun.azimuth)}° {sunDirection(conditions.sun.azimuth)} · elevation {Math.round(conditions.sun.elevation)}°</p>{weather&&<p className="atlas-weather">{weather.temperature!==null&&<span>{weather.temperature}°C</span>}{weather.cloudCover!==null&&<span>cloud {weather.cloudCover}%</span>}{weather.humidity!==null&&<span>humidity {weather.humidity}%</span>}{weather.windSpeed!==null&&<span>wind {weather.windSpeed} km/h</span>}{weather.precipitation!==null&&<span>rain / snow {weather.precipitation} mm</span>}<span>weather estimate · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a></span></p>}</div>}
   {photo.caption?.trim()&&<p className="atlas-picture-description">{photo.caption}</p>}
   {!!labels.length&&<p className="atlas-picture-tags">{labels.join(' · ')}</p>}
   <div className="atlas-picture-actions">{photo.mediaType==='video'&&<button type="button" aria-label="Play video" onClick={()=>{setPlaying(true);onToggle()}}><Play size={13}/></button>}{photo.mediaType!=='video'&&<button type="button" aria-label="Trace photograph" aria-pressed={tracing} onClick={()=>{setTracing(true);onToggle()}}><PenLine size={13}/></button>}{onEdit&&<button type="button" aria-label={'Edit '+label} onClick={onEdit}><Pencil size={12}/></button>}{onRemove&&<button type="button" aria-label={'Remove '+label} onClick={onRemove}><Trash2 size={12}/></button>}{photo.source&&<a href={photo.source} target="_blank" rel="noreferrer">Source ↗</a>}</div>
  </section>}
  </div>
 </article>;
}
