import type {SunPosition} from './sun';

export type WeatherSnapshot={
 source:'Open-Meteo'; kind:'forecast'|'archive'; sampledAt:number; retrievedAt:number;
 temperature:number|null; cloudCover:number|null; humidity:number|null;
 precipitation:number|null; windSpeed:number|null;
};
export type PhotoConditions={
 capturedAt:number; timeSource:'chosen'|'camera'; lat:number; lng:number;
 sun:SunPosition; weather:WeatherSnapshot|null; weatherStatus:'available'|'unavailable';
};

export function weatherRequest(time:number,lat:number,lng:number,now=Date.now()){
 const day=new Date(time).toISOString().slice(0,10),today=Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate());
 const age=(today-Date.parse(day))/86400000;
 if(age < -15 || time<Date.UTC(1940,0,1))return null;
 const kind=age>5?'archive':'forecast';
 const url=new URL(kind==='archive'?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast');
 const params={latitude:String(lat),longitude:String(lng),hourly:'temperature_2m,relative_humidity_2m,cloud_cover,precipitation,wind_speed_10m',start_date:day,end_date:day,timezone:'UTC',timeformat:'unixtime',wind_speed_unit:'kmh'};
 url.search=new URLSearchParams(params).toString();
 return {url:url.toString(),kind} as const;
}

export function parseWeather(data:unknown,time:number,kind:'forecast'|'archive',retrievedAt=Date.now()):WeatherSnapshot|null{
 if(!data||typeof data!=='object'||!('hourly' in data))return null;
 const hourly=data.hourly as Record<string,unknown>;
 if(!hourly||!Array.isArray(hourly.time))return null;
 // Use the containing hour, consistently across date boundaries and daylight saving.
 const index=hourly.time.findIndex(t=>typeof t==='number'&&t*1000<=time&&time<t*1000+3600000);
 if(index<0)return null;
 const number=(key:string,min:number,max:number)=>{const values=hourly[key],n=Array.isArray(values)?values[index]:null;return typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max?n:null;};
 const result:WeatherSnapshot={source:'Open-Meteo',kind,sampledAt:hourly.time[index]*1000,retrievedAt,temperature:number('temperature_2m',-100,70),cloudCover:number('cloud_cover',0,100),humidity:number('relative_humidity_2m',0,100),precipitation:number('precipitation',0,1000),windSpeed:number('wind_speed_10m',0,500)};
 return [result.temperature,result.cloudCover,result.humidity,result.precipitation,result.windSpeed].every(v=>v===null)?null:result;
}

export async function fetchWeather(time:number,lat:number,lng:number):Promise<WeatherSnapshot|null>{
 const request=weatherRequest(time,lat,lng);
 if(!request)return null;
 try{
  const response=await fetch(request.url,{signal:AbortSignal.timeout(6000)});
  if(!response.ok)return null;
  return parseWeather(await response.json(),time,request.kind);
 }catch{return null;}
}
