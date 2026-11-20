'use client';
import {useEffect,useState} from 'react';
import {Sun} from 'lucide-react';
import {parseZurichDateTime,solarPosition,sunDirection,zurichDateTime} from '@/lib/sun';
import {WeatherReadout} from './photo-conditions';
import DateTimeWheel from './date-time-wheel';
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
 return <section className="capture-conditions"><div className="field">When was it taken?<DateTimeWheel value={time} max={latest} onChange={onTime}/></div>{instant===null?<p className="form-error">Choose a valid Zürich date and time.</p>:sun?<><p className="capture-sun"><Sun size={13} aria-hidden="true"/> {Math.round(sun.azimuth)}° {sunDirection(sun.azimuth)} direction · {Math.round(sun.elevation)}° elevation</p>{localPreview?<p className="conditions-note">Weather needs the project connection settings.</p>:result?.key===key?result.weather?<WeatherReadout weather={result.weather}/>:null:<p className="conditions-note" role="status">Finding the weather for this moment…</p>}{localPreview&&<p className="conditions-note">Preview only. No photograph or weather record will be saved.</p>}</>:null}</section>;
}
