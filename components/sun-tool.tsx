'use client';
import {useEffect,useState} from 'react';
import {Sun,X} from 'lucide-react';
import {daySunPath,solarPosition,sunDayBounds,sunDirection,sunEvents,SUN_ZONE,zurichDate,ZURICH} from '@/lib/sun';
export default function SunTool({time,onTime,onClose,point=ZURICH,picking=false,onPick,initialLive=true}:{point?:{lat:number;lng:number};picking?:boolean;onPick?:()=>void;initialLive?:boolean;time:number;onTime:(time:number)=>void;onClose:()=>void}){
 const[live,setLive]=useState(initialLive);
 useEffect(()=>{if(!live)return;onTime(Date.now());const timer=setInterval(()=>onTime(Date.now()),60000);return()=>clearInterval(timer)},[live,onTime]);
 const {lat,lng}=point;
 const date=zurichDate(time),bounds=sunDayBounds(date),samples=daySunPath(date,lat,lng),events=sunEvents(samples),sun=solarPosition(time,lat,lng);
 const formatTime=(value:number|null)=>value===null?'—':new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 const peak=Math.max(...samples.map(p=>p.elevation)),height=120,width=320;
 const x=(t:number)=>(t-bounds.start)/(bounds.end-bounds.start)*width,y=(elevation:number)=>height-12-Math.max(-10,elevation)/90*(height-28);
 const path=samples.map((p,i)=>(i?'L':'M')+x(p.time).toFixed(1)+','+y(p.elevation).toFixed(1)).join(' ');
 return <section className="sun-sheet" aria-label="Sun position tool"><div className="sun-sheet-heading"><h2><Sun size={19}/>sun &amp; light</h2><button aria-label="Close sun tool" onClick={onClose}><X size={18}/></button></div><p className="sun-place">{point.lat.toFixed(4)}° N · {point.lng.toFixed(4)}° E · Zürich</p><button className="sun-location-button" aria-pressed={picking} onClick={onPick}>{picking?'Cancel choosing a place':'Choose a place on the map ↗'}</button><p className="sun-location-hint" role="status">{picking?'Click the map to place the blue point.':'Drag the blue point to explore the light anywhere in Zürich.'}</p>
 <div className="sun-time-row"><time dateTime={new Date(time).toISOString()}>{formatTime(time)}</time><button aria-pressed={live} onClick={()=>{setLive(true);onTime(Date.now())}}>now</button></div>
 <label className="sun-date">day<input aria-label="Sun study date" type="date" min="1901-01-01" max="2099-12-31" value={date} onChange={e=>{if(!e.target.value)return;const next=sunDayBounds(e.target.value);setLive(false);onTime(next.start+(next.end-next.start)/2)}}/></label>
 <svg className="sun-chart" viewBox={`0 0 ${width} ${height+12}`} role="img" aria-label="Sun elevation through the selected day"><line x1="0" x2={width} y1={y(0)} y2={y(0)} className="sun-horizon"/><path d={path} fill="none" className="sun-path"/><line x1={x(time)} x2={x(time)} y1="0" y2={height} className="sun-time-line"/><circle cx={x(time)} cy={y(sun.elevation)} r="4" className="sun-current"/><text x="0" y={height+10}>00:00</text><text x={width/2} y={height+10} textAnchor="middle">{formatTime(bounds.start+(bounds.end-bounds.start)/2)}</text><text x={width} y={height+10} textAnchor="end">24:00</text></svg>
 <input className="sun-slider" type="range" aria-label="Time of day for sun position" min="0" max={Math.round((bounds.end-bounds.start)/60000)-1} step="1" value={Math.floor((time-bounds.start)/60000)} onChange={e=>{setLive(false);onTime(bounds.start+Number(e.target.value)*60000)}}/>
 <div className="sun-angles"><div><strong>{Math.round(sun.azimuth)}° <span>{sunDirection(sun.azimuth)}</span></strong><span>direction from north</span></div><div><strong>{Math.round(sun.elevation)}°</strong><span>above the horizon</span></div></div>
 <p className="sun-state">{sun.elevation<0?'The sun is below the horizon.':sun.elevation<6?'Low sun, close to the horizon.':'The sun is above the horizon.'}</p>
 <div className="sun-events"><span>rise {formatTime(events.sunrise)}</span><span>highest {Math.round(peak)}°</span><span>set {formatTime(events.sunset)}</span></div>
 <p className="sun-footnote">Approximate solar position. The map arc shows direction, not distance. Buildings, hills and cloud cover are not included. <a href="https://gml.noaa.gov/grad/solcalc/solareqns.PDF" target="_blank" rel="noreferrer">Calculation source ↗</a></p></section>;
}
