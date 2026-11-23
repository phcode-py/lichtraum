import type {GalleryPhoto} from '@/lib/gallery';
import {AREAS,IMAGE_TYPES,TIMES,WEATHER} from '@/lib/gallery';
import {SUN_ZONE,sunDirection} from '@/lib/sun';

const captureTimeFormat=new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

/** Identical saved information in the atlas, walk photographs and gallery. */
export default function PhotoInformation({photo,walkTitle}:{photo:GalleryPhoto;walkTitle?:string}){
 const conditions=photo.conditions,weather=conditions?.weather;
 const date=conditions?.capturedAt??photo.createdAt;
 const time=captureTimeFormat.format(date);
 const tags=photo.tags;
 const labels=tags?[...IMAGE_TYPES.filter(t=>tags.imageTypes.includes(t.id)),...TIMES.filter(t=>t.id===tags.timeOfDay),...WEATHER.filter(t=>tags.weather.includes(t.id)),...AREAS.filter(t=>t.id===tags.area)].map(t=>t.label):[];
 return (
   <div className="atlas-picture-copy">
   {photo.title.trim()&&<h2>{photo.title}</h2>}
   <div className="atlas-picture-meta"><p>{!conditions&&<span>Added </span>}<time title="Zürich time" dateTime={new Date(date).toISOString()}>{time}</time></p>{photo.place&&<p>{photo.place}</p>}{walkTitle&&<p className="atlas-picture-walk">Walk · {walkTitle}</p>}{!photo.isLocalPreview&&Number.isFinite(photo.lat)&&Number.isFinite(photo.lng)&&(!photo.place||photo.place==='Dropped pin')&&<p>{photo.lat.toFixed(4)}° N, {photo.lng.toFixed(4)}° E</p>}</div>
   {conditions&&<div className="atlas-picture-meta"><p>Sun {Math.round(conditions.sun.azimuth)}° {sunDirection(conditions.sun.azimuth)} · elevation {Math.round(conditions.sun.elevation)}°</p>{weather&&<p className="atlas-weather">{weather.temperature!==null&&<span>{weather.temperature}°C</span>}{weather.cloudCover!==null&&<span>cloud {weather.cloudCover}%</span>}{weather.humidity!==null&&<span>humidity {weather.humidity}%</span>}{weather.windSpeed!==null&&<span>wind {weather.windSpeed} km/h</span>}{weather.precipitation!==null&&<span>rain / snow {weather.precipitation} mm</span>}<span>weather estimate · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a></span></p>}</div>}
   {photo.caption?.trim()&&<p className="atlas-picture-description">{photo.caption}</p>}
   {!!labels.length&&<p className="atlas-picture-tags">{labels.join(' · ')}</p>}
   </div>
 );
}
