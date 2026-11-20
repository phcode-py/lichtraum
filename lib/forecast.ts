import type {ForecastHour} from './meteoswiss';
import {SUN_ZONE} from './sun';

export type Sky='clear'|'some cloud'|'cloudy'|'fog'|'drizzle'|'rain'|'snow'|'thunder';

/** A plain description from MeteoSwiss pictogram numbers (101+ are night versions), checked against the forecast values. */
export function sky(hour:Pick<ForecastHour,'symbol'|'precipitation'|'temperature'>):Sky{
 const code=hour.symbol===null?null:hour.symbol%100,rain=hour.precipitation??0,cold=(hour.temperature??5)<=.5;
 if(code!==null&&[12,13,23,24,25].includes(code))return'thunder';
 if(code===1&&rain<.1)return'clear';
 if(code!==null&&[2,3,26].includes(code)&&rain<.1)return'some cloud';
 if(code===28&&rain<.1)return'fog';
 if(code!==null&&[4,5,27].includes(code)&&rain<.1)return'cloudy';
 if(rain>=.1||(code!==null&&code>=6))return cold?'snow':rain>=1||(code!==null&&[20,21,22].includes(code))?'rain':'drizzle';
 return'cloudy';
}
export const isNight=(hour:Pick<ForecastHour,'symbol'>)=>(hour.symbol??0)>100;

const dateKey=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:SUN_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(time);
const hourOf=(time:number)=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:SUN_ZONE,hour:'2-digit',hourCycle:'h23'}).format(time));

export type ForecastDay={date:string;time:number;low:number|null;high:number|null;precipitation:number;probability:number|null;sky:Sky};

/** Daily summaries in Zürich time. The pictogram comes from early afternoon. */
export function forecastDays(hours:ForecastHour[],now=Date.now(),count=5):ForecastDay[]{
 const today=dateKey(now),groups=new Map<string,ForecastHour[]>();
 for(const hour of hours){const key=dateKey(hour.time-3600000);if(key>=today)groups.set(key,[...(groups.get(key)??[]),hour])}
 return[...groups].filter(([,list])=>list.length>=12).slice(0,count).map(([date,list])=>{
  const temperatures=list.map(h=>h.temperature).filter((t):t is number=>t!==null),chances=list.map(h=>h.probability).filter((p):p is number=>p!==null);
  const afternoon=list.reduce((best,h)=>Math.abs(hourOf(h.time)-14)<Math.abs(hourOf(best.time)-14)?h:best,list[0]);
  return{date,time:afternoon.time,low:temperatures.length?Math.min(...temperatures):null,high:temperatures.length?Math.max(...temperatures):null,precipitation:list.reduce((sum,h)=>sum+(h.precipitation??0),0),probability:chances.length?Math.max(...chances):null,sky:sky({...afternoon,precipitation:list.filter(h=>Math.abs(hourOf(h.time)-14)<=3).reduce((s,h)=>Math.max(s,h.precipitation??0),0)})};
 });
}

/** The coming hours in three-hour steps, starting with the current hour. */
export function forecastSteps(hours:ForecastHour[],now=Date.now(),count=8){
 const upcoming=hours.filter(h=>h.time>now);
 return upcoming.filter((_,i)=>i%3===0).slice(0,count).map((h,i)=>{const block=upcoming.slice(i*3,i*3+3);return{...h,precipitation:block.reduce((s,x)=>s+(x.precipitation??0),0)}});
}
