'use client';
import {useEffect,useState} from 'react';
import {WeatherReadout} from './photo-conditions';
import type {WeatherSnapshot} from '@/lib/photo-conditions';

/** Weather follows the study's place and hour, without requesting every slider step. */
export default function SunWeather({time,lat,lng}:{time:number;lat:number;lng:number}){
 const hour=Math.floor(time/3600000)*3600000;
 const latitude=Number(lat.toFixed(4)),longitude=Number(lng.toFixed(4));
 const key=`${hour}/${latitude}/${longitude}`;
 const[result,setResult]=useState<{key:string;weather:WeatherSnapshot|null}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>{fetch(`/api/weather?time=${hour}&lat=${latitude}&lng=${longitude}`,{signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Weather unavailable');return response.json()}).then(data=>{if(!controller.signal.aborted)setResult({key,weather:data.weather??null})}).catch(()=>{if(!controller.signal.aborted)setResult({key,weather:null})});},350);
  return()=>{clearTimeout(timer);controller.abort()};
 },[hour,latitude,longitude,key,retry]);
 return <section className="sun-weather" aria-label="Weather at the sun study location"><h3>weather</h3>{result?.key!==key?<p className="conditions-note" role="status">Finding the weather…</p>:result.weather?<WeatherReadout weather={result.weather}/>:<p className="conditions-note" role="status">Weather unavailable for this time and place. <button type="button" onClick={()=>{setResult(null);setRetry(value=>value+1)}}>try again</button></p>}</section>;
}
