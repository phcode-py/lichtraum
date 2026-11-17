'use client';
import {useEffect,useState} from 'react';
import {parseZurichDateTime,solarPosition,sunDirection,zurichDateTime} from '@/lib/sun';
import {WeatherReadout} from './photo-conditions';
import type {WeatherSnapshot} from '@/lib/photo-conditions';

export default function CaptureConditions({time,onTime,point,localPreview=false}:{localPreview?:boolean;time:string;onTime:(v:string)=>void;point:{lat:number;lng:number}|null}){
 const [latest]=useState(()=>zurichDateTime(Date.now()));
 const instant=parseZurichDateTime(time),sun=point&&instant!==null?solarPosition(instant,point.lat,point.lng):null;
 const [result,setResult]=useState<{key:string;weather:WeatherSnapshot|null}|null>(null);
 const key=point&&instant!==null?`${instant}/${point.lat}/${point.lng}`:'';
 useEffect(()=>{
  if(localPreview||!key||!point||instant===null)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{fetch(`/api/weather?time=${instant}&lat=${point.lat}&lng=${point.lng}`,{signal:controller.signal}).then(r=>r.ok?r.json():null).then(data=>setResult({key,weather:data?.weather??null})).catch(()=>{if(!controller.signal.aborted)setResult({key,weather:null})});},350);
  return()=>{clearTimeout(timer);controller.abort()};
 },[key,instant,point,localPreview]);
 return <section className="capture-conditions"><h3>light at this moment</h3><label className="field">When was it taken?<input type="datetime-local" required min="1940-01-01T00:00" max={latest} value={time} step="60" onChange={e=>onTime(e.target.value)}/></label><p className="conditions-note">Zürich time. For an older image, choose when it was taken. This is separate from the sun study’s slider.</p>{instant===null?<p className="form-error">Choose a valid Zürich date and time.</p>:sun?<><p className="capture-sun">☀ {Math.round(sun.azimuth)}° {sunDirection(sun.azimuth)} direction · {Math.round(sun.elevation)}° elevation</p>{localPreview?<p className="conditions-note">Weather needs the project connection settings.</p>:result?.key===key?<WeatherReadout weather={result.weather}/>:<p className="conditions-note" role="status">Finding the weather for this moment…</p>}<p className="conditions-note">{localPreview?'Preview only. No photograph or weather record will be saved.':'Sun and available weather estimates will be saved with your photograph.'}</p></>:<p className="conditions-note">Place a pin to see the sun and weather at this spot.</p>}</section>;
}
