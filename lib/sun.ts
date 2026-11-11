// Approximate solar geometry from NOAA's General Solar Position Calculations.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// True north = 0°, east = 90°. Geometric elevation excludes terrain/refraction.
export const ZURICH={lat:47.3709,lng:8.5399};
export const SUN_ZONE='Europe/Zurich';
const rad=Math.PI/180,deg=180/Math.PI;
export type SunPosition={azimuth:number;elevation:number};
export function solarPosition(time:number,lat=ZURICH.lat,lng=ZURICH.lng):SunPosition{
 const date=new Date(time),year=date.getUTCFullYear(),yearStart=Date.UTC(year,0,1),yearEnd=Date.UTC(year+1,0,1);
 const days=(yearEnd-yearStart)/86400000,day=Math.floor((time-yearStart)/86400000)+1;
 const hours=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600;
 const gamma=2*Math.PI/days*(day-1+(hours-12)/24);
 const equation=229.18*(.000075+.001868*Math.cos(gamma)-.032077*Math.sin(gamma)-.014615*Math.cos(2*gamma)-.040849*Math.sin(2*gamma));
 const decl=.006918-.399912*Math.cos(gamma)+.070257*Math.sin(gamma)-.006758*Math.cos(2*gamma)+.000907*Math.sin(2*gamma)-.002697*Math.cos(3*gamma)+.00148*Math.sin(3*gamma);
 const solarMinutes=((hours*60+equation+4*lng)%1440+1440)%1440,angle=(solarMinutes/4-180)*rad,phi=lat*rad;
 const elevation=Math.asin(Math.max(-1,Math.min(1,Math.sin(phi)*Math.sin(decl)+Math.cos(phi)*Math.cos(decl)*Math.cos(angle))))*deg;
 const azimuth=(Math.atan2(Math.sin(angle),Math.cos(angle)*Math.sin(phi)-Math.tan(decl)*Math.cos(phi))*deg+180+360)%360;
 return {azimuth,elevation};
}
export function zurichDate(time:number){return new Intl.DateTimeFormat('en-CA',{timeZone:SUN_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time))}
function localMidnight(utcDate:number){let candidate=utcDate;for(let i=0;i<3;i++){const parts=new Intl.DateTimeFormat('en-US',{timeZone:SUN_ZONE,timeZoneName:'longOffset'}).formatToParts(new Date(candidate));const zone=parts.find(p=>p.type==='timeZoneName')?.value||'GMT';const match=zone.match(/GMT([+-])(\d{2}):(\d{2})/);const offset=match?(Number(match[2])*60+Number(match[3]))*(match[1]==='+'?1:-1):0;candidate=utcDate-offset*60000}return candidate}
export function sunDayBounds(date:string){const [year,month,day]=date.split('-').map(Number);return {start:localMidnight(Date.UTC(year,month-1,day)),end:localMidnight(Date.UTC(year,month-1,day+1))}}
export type SunSample=SunPosition & {time:number};
export function daySunPath(date:string){const {start,end}=sunDayBounds(date);const samples:SunSample[]=[];for(let time=start;time<=end;time+=300000)samples.push({time,...solarPosition(time)});return samples}
export function sunEvents(samples:SunSample[]){let sunrise:number|null=null,sunset:number|null=null;for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if((a.elevation<-.833)!==(b.elevation<-.833)){const time=a.time+(-.833-a.elevation)/(b.elevation-a.elevation)*(b.time-a.time);if(b.elevation>a.elevation)sunrise=time;else sunset=time}}return {sunrise,sunset}}
export function sunDirection(azimuth:number){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(azimuth/45)%8]}
// A schematic bearing guide of fixed length, not the sun's distance or a shadow study.
export function sunGuidePoint(azimuth:number,distance=900):[number,number]{const earth=6371000,angle=azimuth*rad,phi=ZURICH.lat*rad,lambda=ZURICH.lng*rad,d=distance/earth;const lat=Math.asin(Math.sin(phi)*Math.cos(d)+Math.cos(phi)*Math.sin(d)*Math.cos(angle));const lng=lambda+Math.atan2(Math.sin(angle)*Math.sin(d)*Math.cos(phi),Math.cos(d)-Math.sin(phi)*Math.sin(lat));return[lng*deg,lat*deg]}
