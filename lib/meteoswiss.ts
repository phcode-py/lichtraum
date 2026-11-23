// MeteoSwiss Open Government Data (https://opendata.swiss / data.geo.admin.ch).
// Radar: PRECIP rain rate composite (RZC), a new frame every 5 minutes.
// Forecast: localised point forecast for Zürich (postal code 8001), updated hourly.
import {deflateSync} from 'node:zlib';
import {unlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const STAC='https://data.geo.admin.ch/api/stac/v1/collections';
const RADAR='ch.meteoschweiz.ogd-radar-precip';
const LOCAL='ch.meteoschweiz.ogd-local-forecasting';
export const ZURICH_POINT='800100';
export const RADAR_FRAME=/^rzc(\d{2})(\d{3})(\d{4})vl\.001\.h5$/;

/** Corners of the Swiss radar composite (from the files' own /where attributes). */
export const RADAR_CORNERS:[[number,number],[number,number],[number,number],[number,number]]=[
 [2.689419984817505,49.3744010925293],[12.462300300598145,49.36330032348633],[11.955599784851074,43.61899948120117],[3.1687800884246826,43.62900161743164],
];

const day=(time:number)=>new Date(time).toISOString().slice(0,10).replaceAll('-','');

async function itemAssets(collection:string,date:string):Promise<string[]>{
 const response=await fetch(`${STAC}/${collection}/items/${date}-ch`,{signal:AbortSignal.timeout(8000),cache:'no-store'});
 if(response.status===404)return[];
 if(!response.ok)throw Error('MeteoSwiss data unavailable');
 const item=await response.json() as {assets:Record<string,unknown>};
 return Object.keys(item.assets);
}

/** The time a radar file describes (end of its 5-minute interval, UTC). */
export function radarTime(name:string){
 const match=RADAR_FRAME.exec(name);if(!match)return null;
 const [,year,dayOfYear,hhmm]=match;
 return Date.UTC(2000+Number(year),0,Number(dayOfYear),Number(hhmm.slice(0,2)),Number(hhmm.slice(2)));
}

/** Radar frames from the start of the current hour until now, oldest first.
 *  Just after the hour, before a new frame exists, the latest frame is shown on its own. */
export async function radarFrames(){
 const now=Date.now();
 const [today,yesterday]=await Promise.all([itemAssets(RADAR,day(now)),itemAssets(RADAR,day(now-86400000))]);
 const all=[...yesterday,...today].filter(name=>RADAR_FRAME.test(name)).sort((a,b)=>radarTime(a)!-radarTime(b)!).map(name=>({name,time:radarTime(name)!}));
 // Zürich is a whole number of hours from UTC, so the hour starts at the same instant in both.
 const hour=Math.floor(now/3600000)*3600000,thisHour=all.filter(f=>f.time>=hour);
 return thisHour.length?thisHour:all.slice(-1);
}

/** Rain rate in mm/h → colour. Light rain is a pale wash, heavy rain the project blue. */
function rainColour(rate:number):[number,number,number,number]{
 if(!(rate>=.1))return[0,0,0,0];
 const steps:[number,[number,number,number,number]][]=[[.1,[150,178,255,70]],[1,[96,132,250,130]],[3,[60,98,240,175]],[10,[36,70,232,215]],[30,[22,38,170,235]],[80,[120,40,190,245]]];
 for(let i=steps.length-1;i>=0;i--)if(rate>=steps[i][0]){
  const[from,a]=steps[i],next=steps[i+1];if(!next)return a;
  const t=Math.log(rate/from)/Math.log(next[0]/from),b=next[1];
  return a.map((v,k)=>Math.round(v+(b[k]-v)*t)) as [number,number,number,number];
 }
 return[0,0,0,0];
}

const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc(bytes:Buffer){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function chunk(type:string,data:Buffer){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const body=Buffer.concat([Buffer.from(type,'ascii'),data]);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(body));return Buffer.concat([length,body,sum])}
function png(width:number,height:number,rgba:Uint8Array){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++){rows[y*(width*4+1)]=0;Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(rows,y*(width*4+1)+1)}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

/** One radar frame as a transparent PNG, north up, matching RADAR_CORNERS. */
export async function radarImage(name:string){
 const time=radarTime(name);if(time===null)throw Error('Unknown radar frame');
 const response=await fetch(`https://data.geo.admin.ch/${RADAR}/${day(time)}-ch/${name}`,{signal:AbortSignal.timeout(10000),cache:'no-store'});
 if(!response.ok)throw Error('Radar frame unavailable');
 const bytes=new Uint8Array(await response.arrayBuffer());
 const h5wasm=(await import('h5wasm/node')).default;await h5wasm.ready;
 // The Node build of h5wasm reads real files, so the frame passes through the temp folder.
 const path=join(tmpdir(),`${crypto.randomUUID()}-${name}`);await writeFile(path,bytes);
 const file=new h5wasm.File(path,'r');
 try{
  const dataset=file.get('dataset1/data1/data') as {shape:number[];value:ArrayLike<number>};
  const[height,width]=dataset.shape,values=dataset.value,rgba=new Uint8Array(width*height*4);
  for(let i=0;i<values.length;i++)rgba.set(rainColour(values[i]),i*4);
  return png(width,height,rgba);
 }finally{file.close();await unlink(path).catch(()=>{})}
}

export type ForecastHour={time:number;temperature:number|null;precipitation:number|null;probability:number|null;symbol:number|null};
export type Forecast={issued:number;place:string;hours:ForecastHour[]};

const PARAMETERS={temperature:'tre200h0',precipitation:'rre150h0',probability:'rp0003i0',symbol:'jww003i0'} as const;
const RUN=/^vnut12\.lssw\.(\d{12})\.([a-z0-9]{8})\.csv$/;
const parseTime=(s:string)=>Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8),+s.slice(8,10),+s.slice(10,12));

/** Streams a nationwide CSV (~30 MB) and keeps only the rows for one place. */
async function pointRows(url:string,point:string){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),cache:'no-store'});
 if(!response.ok||!response.body)throw Error('Forecast unavailable');
 const rows=new Map<number,number>(),prefix=point+';',decoder=new TextDecoder();let rest='';
 const take=(line:string)=>{if(!line.startsWith(prefix))return;const[, ,date,value]=line.split(';');const number=Number(value);if(date&&value!==''&&Number.isFinite(number))rows.set(parseTime(date),number)};
 for await(const part of response.body as unknown as AsyncIterable<Uint8Array>){
  const text=rest+decoder.decode(part,{stream:true});const lines=text.split('\n');rest=lines.pop()??'';lines.forEach(take);
 }
 take(rest);
 return rows;
}

let cached:{at:number;forecast:Forecast}|null=null;

/** MeteoSwiss local forecast for Zürich, refreshed at most every 20 minutes. */
export async function zurichForecast():Promise<Forecast>{
 if(cached&&Date.now()-cached.at<20*60000)return cached.forecast;
 const now=Date.now();
 let assets=await itemAssets(LOCAL,day(now));
 if(!assets.length)assets=await itemAssets(LOCAL,day(now-86400000));
 const runs=new Map<string,Set<string>>();
 for(const name of assets){const match=RUN.exec(name);if(match)runs.set(match[1],(runs.get(match[1])??new Set()).add(match[2]))}
 const run=[...runs].filter(([,found])=>Object.values(PARAMETERS).every(p=>found.has(p))).map(([time])=>time).sort().at(-1);
 if(!run)throw Error('Forecast unavailable');
 const base=`https://data.geo.admin.ch/${LOCAL}/${run.slice(0,8)}-ch/vnut12.lssw.${run}.`;
 const[temperature,precipitation,probability,symbol]=await Promise.all(Object.values(PARAMETERS).map(p=>pointRows(`${base}${p}.csv`,ZURICH_POINT)));
 // Three-hourly values describe the preceding three hours: carry them onto each hour they cover.
 const threeHourly=(rows:Map<number,number>,time:number)=>rows.get(time)??rows.get(time+3600000)??rows.get(time+7200000)??null;
 const hours=[...temperature.keys()].sort((a,b)=>a-b).map(time=>({time,temperature:temperature.get(time)??null,precipitation:precipitation.get(time)??null,probability:threeHourly(probability,time),symbol:threeHourly(symbol,time)}));
 const forecast={issued:parseTime(run),place:'Zürich',hours};
 cached={at:Date.now(),forecast};
 return forecast;
}

// ---------------------------------------------------------------------------
// Rain forecast maps for the next 24 hours, drawn from the MeteoSwiss local forecast:
// hourly rain (rre150h0) at about 5800 places across Switzerland, spread smoothly between them.
// Drawn on the radar's own grid (every 2 km instead of 1 km), so it lines up with RADAR_CORNERS.

const FORECAST_GRID={w:355,h:320,km:2};
const NEAR=8,REACH=7;// cells: search neighbourhood and the distance a place still colours

type ForecastPoint={x:number;y:number};
let pointCache:Promise<Map<string,ForecastPoint>>|null=null;
/** Every forecast place, as a position on the forecast grid. */
function forecastPoints(){
 pointCache??=(async()=>{
  const r=await fetch(`https://data.geo.admin.ch/${LOCAL}/ogd-local-forecasting_meta_point.csv`,{signal:AbortSignal.timeout(15000),cache:'no-store'});
  if(!r.ok)throw Error('Forecast places unavailable');
  const lines=new TextDecoder('latin1').decode(await r.arrayBuffer()).split('\n'),head=lines[0].split(';');
  const id=head.indexOf('point_id'),east=head.indexOf('point_coordinates_lv95_east'),north=head.indexOf('point_coordinates_lv95_north');
  const points=new Map<string,ForecastPoint>();
  for(const line of lines.slice(1)){const c=line.split(';');const e=Number(c[east]),n=Number(c[north]);if(!c[id]||!Number.isFinite(e)||!Number.isFinite(n))continue;
   // LV95 metres → the radar grid: columns from 255.5 km east, rows from 479.5 km north downwards.
   points.set(c[id],{x:((e/1000-2000)-255.5)/FORECAST_GRID.km,y:(479.5-(n/1000-1000))/FORECAST_GRID.km});}
  return points;
 })().catch(e=>{pointCache=null;throw e});
 return pointCache;
}

/** One hour of forecast rain as a transparent PNG on the radar grid. */
function forecastPng(points:ForecastPoint[],values:Float32Array){
 const {w,h}=FORECAST_GRID,rgba=new Uint8Array(w*h*4),cell=NEAR,cols=Math.ceil(w/cell)+1,rows=Math.ceil(h/cell)+1;
 const buckets:number[][]=Array.from({length:cols*rows},()=>[]);
 points.forEach((p,i)=>{if(Number.isFinite(values[i])&&p.x>=-cell&&p.y>=-cell&&p.x<w+cell&&p.y<h+cell)buckets[Math.max(0,Math.floor(p.y/cell))*cols+Math.max(0,Math.floor(p.x/cell))]?.push(i)});
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  let sum=0,weight=0,nearest=Infinity;const bx=Math.floor(x/cell),by=Math.floor(y/cell);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const list=buckets[(by+dy)*cols+bx+dx];if(!list||by+dy<0||bx+dx<0||bx+dx>=cols)continue;
   for(const i of list){const p=points[i],d2=(p.x-x)**2+(p.y-y)**2;if(d2>REACH*REACH)continue;nearest=Math.min(nearest,d2);const k=1/(d2+.5);sum+=values[i]*k;weight+=k}}
  if(!weight)continue;
  // Fade out towards the edge of the forecast area instead of a hard border.
  const edge=Math.max(0,Math.min(1,(REACH-Math.sqrt(nearest))/2.5)),[r,g,b,a]=rainColour(sum/weight);
  rgba.set([r,g,b,Math.round(a*edge)],(y*w+x)*4);
 }
 return png(w,h,rgba);
}

let rainCache:{run:string;at:number;frames:{time:number;url:string}[]}|null=null;

/** Hourly rain forecast maps for the next 24 hours, refreshed with each new forecast run. */
export async function rainForecastFrames(hours=24){
 const now=Date.now();
 if(rainCache&&now-rainCache.at<20*60000)return rainCache.frames.filter(f=>f.time>now-3600000).slice(0,hours);
 let assets=await itemAssets(LOCAL,day(now));
 if(!assets.length)assets=await itemAssets(LOCAL,day(now-86400000));
 const run=assets.map(n=>RUN.exec(n)).filter((m):m is RegExpExecArray=>!!m&&m[2]==='rre150h0').map(m=>m[1]).sort().at(-1);
 if(!run)throw Error('Forecast unavailable');
 if(rainCache?.run===run){rainCache.at=now;return rainCache.frames.filter(f=>f.time>now-3600000).slice(0,hours)}
 const places=await forecastPoints(),ids=[...places.keys()],index=new Map(ids.map((id,i)=>[id,i])),list=ids.map(id=>places.get(id)!);
 const from=Math.floor(now/3600000)*3600000+3600000,until=from+(hours+2)*3600000,byHour=new Map<number,Float32Array>();
 const response=await fetch(`https://data.geo.admin.ch/${LOCAL}/${run.slice(0,8)}-ch/vnut12.lssw.${run}.rre150h0.csv`,{signal:AbortSignal.timeout(30000),cache:'no-store'});
 if(!response.ok||!response.body)throw Error('Forecast unavailable');
 const decoder=new TextDecoder();let rest='';
 const take=(line:string)=>{const[id,,date,value]=line.split(';');if(!date||date.length<12)return;const t=parseTime(date);if(t<from||t>until)return;const i=index.get(id);if(i===undefined)return;
  let row=byHour.get(t);if(!row){row=new Float32Array(list.length).fill(NaN);byHour.set(t,row)}row[i]=Number(value)};
 for await(const part of response.body as unknown as AsyncIterable<Uint8Array>){const text=rest+decoder.decode(part,{stream:true});const lines=text.split('\n');rest=lines.pop()??'';lines.forEach(take)}
 take(rest);
 // Each value is the rain in the hour before its time: show it at the start of that hour.
 const frames=[...byHour.keys()].sort((a,b)=>a-b).map(t=>({time:t-3600000,url:`data:image/png;base64,${forecastPng(list,byHour.get(t)!).toString('base64')}`}));
 rainCache={run,at:now,frames};
 return frames.filter(f=>f.time>now-3600000).slice(0,hours);
}
