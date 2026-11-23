'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Cloud,CloudDrizzle,CloudFog,CloudLightning,CloudMoon,CloudRain,CloudSnow,CloudSun,Moon,Pause,Play,Sun,X,type LucideIcon} from 'lucide-react';
import type {Forecast} from '@/lib/meteoswiss';
import {forecastDays,forecastSteps,isNight,sky,type Sky} from '@/lib/forecast';
import {SUN_ZONE} from '@/lib/sun';

export type RainRadar={corners:[[number,number],[number,number],[number,number],[number,number]];frames:{time:number;url:string;kind?:'measured'|'forecast'}[]};

const icons:Record<Sky,LucideIcon>={clear:Sun,'some cloud':CloudSun,cloudy:Cloud,fog:CloudFog,drizzle:CloudDrizzle,rain:CloudRain,snow:CloudSnow,thunder:CloudLightning};
function SkyIcon({kind,night=false,size=18}:{kind:Sky;night?:boolean;size?:number}){
 const Icon=night&&kind==='clear'?Moon:night&&kind==='some cloud'?CloudMoon:icons[kind];
 return <Icon size={size} strokeWidth={1.6} aria-label={kind}/>;
}
/** "tomorrow " for times after midnight in Zürich. */
const dayWord=(time:number)=>{const key=(t:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:SUN_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(t);return key(time)===key(Date.now())?'':'tomorrow '};
const clock=(time:number)=>new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,hour:'2-digit',minute:'2-digit'}).format(time);
const weekday=(time:number,index:number)=>index===0?'today':new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,weekday:'short'}).format(time).toLowerCase();
const degrees=(value:number|null)=>value===null?'—':`${Math.round(value)}°`;
const millimetres=(value:number)=>value<.05?'—':`${value<10?value.toFixed(1):Math.round(value)} mm`;

/** MeteoSwiss rain radar (animated on the map) and the local forecast for Zürich. */
export default function RainTool({onRadar,onFrame,onClose}:{onRadar:(radar:RainRadar|null)=>void;onFrame:(index:number)=>void;onClose:()=>void}){
 const[radar,setRadar]=useState<RainRadar|null>(null),[radarError,setRadarError]=useState(''),[index,setIndex]=useState(0),[playing,setPlaying]=useState(true);
 const[forecast,setForecast]=useState<Forecast|null>(null),[forecastError,setForecastError]=useState(''),[retry,setRetry]=useState(0);
 const report=useRef({onRadar,onFrame});
 useEffect(()=>{report.current={onRadar,onFrame}},[onRadar,onFrame]);
 useEffect(()=>{
  const controller=new AbortController();
  const load=()=>fetch('/api/rain',{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);return data as RainRadar}).then(data=>{if(!data.frames.length)throw Error('No radar images right now.');setRadar(data);setRadarError('')}).catch(e=>{if(!controller.signal.aborted)setRadarError(e instanceof Error&&e.message?e.message:'The rain radar is unavailable right now.')});
  load();const timer=setInterval(load,5*60000);
  return()=>{controller.abort();clearInterval(timer);report.current.onRadar(null)};
 },[retry]);
 // The coming 24 hours: MeteoSwiss forecast maps, continuing the radar animation.
 const[ahead,setAhead]=useState<{time:number;url:string}[]>([]);
 useEffect(()=>{
  const controller=new AbortController();
  const load=()=>fetch('/api/rain/forecast',{signal:controller.signal}).then(r=>r.ok?r.json():{frames:[]}).then(data=>setAhead(data.frames??[])).catch(()=>{});
  load();const timer=setInterval(load,30*60000);
  return()=>{controller.abort();clearInterval(timer)};
 },[retry]);
 const lastMeasured=radar?.frames.at(-1)?.time??0;
 const timeline=useMemo<RainRadar|null>(()=>radar?{corners:radar.corners,frames:[...radar.frames.map(f=>({...f,kind:'measured' as const})),...ahead.filter(f=>f.time>lastMeasured).map(f=>({...f,kind:'forecast' as const}))]}:null,[radar,ahead,lastMeasured]);
 const measuredCount=radar?.frames.length??0;
 useEffect(()=>{if(timeline)report.current.onRadar(timeline)},[timeline]);
 // A new timeline starts at the latest measured image, the present moment.
 const[seen,setSeen]=useState(0),total=timeline?.frames.length??0;
 if(total!==seen){setSeen(total);if(index===0||index>=total)setIndex(Math.max(0,measuredCount-1))}
 useEffect(()=>{
  const controller=new AbortController();
  fetch('/api/forecast',{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setForecast(data.forecast);setForecastError('')}).catch(e=>{if(!controller.signal.aborted)setForecastError(e instanceof Error&&e.message?e.message:'The forecast is unavailable right now.')});
  return()=>controller.abort();
 },[retry]);
 const count=timeline?.frames.length??0;
 // Each frame shows briefly; the latest one lingers before the loop starts again.
 useEffect(()=>{if(!playing||count<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const timer=setTimeout(()=>setIndex(i=>(i+1)%count),index===measuredCount-1||index>=count-1?1600:timeline?.frames[index]?.kind==='forecast'?650:420);return()=>clearTimeout(timer)},[playing,count,index,measuredCount,timeline]);
 useEffect(()=>{report.current.onFrame(index)},[index]);
 const frame=timeline?.frames[Math.min(index,count-1)];
 const steps=forecast?forecastSteps(forecast.hours):[],days=forecast?forecastDays(forecast.hours):[];
 return <section className="sun-sheet rain-sheet" aria-label="Rain and weather forecast"><div className="sun-sheet-heading"><h2><Cloud size={19}/>weather rain</h2><button aria-label="Close rain and forecast" onClick={onClose}><X size={18}/></button></div>
  <div className="sun-time-row"><time dateTime={frame?new Date(frame.time).toISOString():undefined}>{frame?clock(frame.time):'—:—'}</time><button className="rain-play" aria-label={playing?'Pause rain animation':'Play rain animation'} aria-pressed={playing} disabled={count<2} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button></div>
  <p className="rain-caption">{radarError?<>{radarError} <button type="button" onClick={()=>{setRadarError('');setRetry(n=>n+1)}}>try again</button></>:frame?(frame.kind==='forecast'?`forecast · ${dayWord(frame.time)}${clock(frame.time)} · in ${Math.max(1,Math.round((frame.time-lastMeasured)/3600000))} h`:`radar · measured ${index===measuredCount-1?'· latest image':`· ${Math.round((lastMeasured-frame.time)/60000)} min earlier`}`):'Finding the rain radar…'}</p>
  <input className="sun-slider" type="range" aria-label="Radar time" min="0" max={Math.max(0,count-1)} step="1" value={Math.min(index,Math.max(0,count-1))} disabled={count<2} onChange={e=>{setPlaying(false);setIndex(Number(e.target.value))}}/>
  {count>measuredCount&&<div className="rain-span" aria-hidden="true"><span style={{width:`${(measuredCount-.5)/Math.max(1,count-1)*100}%`}}>measured</span><span>forecast · next 24 h</span></div>}
  <div className="rain-legend" aria-label="Rain intensity from light to heavy"><span>light</span><i aria-hidden="true"/><span>heavy</span></div>
  <h3 className="rain-subheading">Zürich forecast</h3>
  {forecastError?<p className="conditions-note" role="status">{forecastError} <button type="button" onClick={()=>{setForecastError('');setRetry(n=>n+1)}}>try again</button></p>:!forecast?<p className="conditions-note" role="status">Finding the forecast…</p>:<>
   <ol className="rain-hours">{steps.map(h=><li key={h.time}><span>{clock(h.time-3600000)}</span><SkyIcon kind={sky(h)} night={isNight(h)}/><strong>{degrees(h.temperature)}</strong><span>{millimetres(h.precipitation??0)}</span>{h.probability!==null&&<span>{Math.round(h.probability)}%</span>}</li>)}</ol>
   <ol className="rain-days">{days.map((d,i)=><li key={d.date}><span>{weekday(d.time,i)}</span><SkyIcon kind={d.sky}/><span className="rain-range"><strong>{degrees(d.high)}</strong> {degrees(d.low)}</span><span>{millimetres(d.precipitation)}</span></li>)}</ol>
  </>}
  <p className="sun-footnote">Source: <a href="https://www.meteoswiss.admin.ch/" target="_blank" rel="noreferrer">MeteoSwiss</a> open data · radar every 5 minutes{forecast?` · forecast for 8001 Zürich, issued ${clock(forecast.issued)}`:''}</p>
 </section>;
}
