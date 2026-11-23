'use client';
import {Sun,Plus} from 'lucide-react';
import type {PhotoConditions,WeatherSnapshot} from '@/lib/photo-conditions';
import {sunDirection,SUN_ZONE} from '@/lib/sun';

export function WeatherReadout({weather}:{weather:WeatherSnapshot|null}){
 const value=(v:number|null,unit:string)=>v===null?'—':`${Math.round(v*10)/10}${unit}`;
 return <>{weather?<><dl className="weather-grid"><div><dt>cloud cover</dt><dd>{value(weather.cloudCover,'%')}</dd></div><div><dt>humidity</dt><dd>{value(weather.humidity,'%')}</dd></div><div><dt>temperature</dt><dd>{value(weather.temperature,'°C')}</dd></div><div><dt>wind</dt><dd>{value(weather.windSpeed,' km/h')}</dd></div><div><dt>rain / snow</dt><dd>{value(weather.precipitation,' mm')}</dd></div></dl><p className="conditions-note">{weather.kind==='archive'?'Historical model estimate':'Weather model estimate'} · hour of {new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,hour:'2-digit',minute:'2-digit'}).format(weather.sampledAt)} · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p></>:<p className="conditions-note">Weather unavailable for this moment. Sun position is still recorded.</p>}</>;
}

export default function PhotoConditionsCard({conditions,onRevisit,onAddCapture}:{onAddCapture?:()=>void;conditions?:PhotoConditions|null;onRevisit?:(c:PhotoConditions)=>void}){
 if(!conditions)return <section className="photo-conditions"><h3>Light at this Moment</h3><p className="conditions-note">The capture time has not been recorded yet. Sun and weather need the time and place where the picture was taken.</p>{onAddCapture&&<button type="button" className="sun-location-button" onClick={onAddCapture}><Plus size={13} aria-hidden="true"/>Add capture information</button>}</section>;
 const date=new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(conditions.capturedAt);
 return <section className="photo-conditions"><div className="conditions-heading"><h3>Light at this Moment</h3></div><p className="conditions-time">{date}</p><p className="conditions-note">{conditions.lat.toFixed(4)}° N · {conditions.lng.toFixed(4)}° E</p><div className="sun-angles"><div><strong>{Math.round(conditions.sun.azimuth)}° <span>{sunDirection(conditions.sun.azimuth)}</span></strong><span>direction from north</span></div><div><strong>{Math.round(conditions.sun.elevation)}°</strong><span>{conditions.sun.elevation<0?'below horizon (negative angle)':'above the horizon'}</span></div></div><WeatherReadout weather={conditions.weather}/>{onRevisit&&<button className="sun-location-button" onClick={()=>onRevisit(conditions)}><Sun size={13} aria-hidden="true"/>Revisit this sun position</button>}</section>;
}
