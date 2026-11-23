import type {PhotoConditions} from './photo-conditions';

export const IMAGE_TYPES=[
 {id:'light-shadow-patterns',label:'Light & shadow patterns',de:'Licht- und Schattenmuster'},
 {id:'reflected-light-facades',label:'Reflected light on facades',de:'Reflektionen auf Fassaden'},
 {id:'light-reflected-windows-facades',label:'Light reflected by windows & facades',de:'Reflektionen von Fenstern/Fassaden'},
 {id:'reflections-water',label:'Reflections in water',de:'Spiegelungen im Wasser'},
 {id:'reflections-windows-facades',label:'Reflections in windows & facades',de:'Spiegelungen in Fenstern/Fassaden'},
 {id:'light-scattering',label:'Light scattering',de:'Streuung Licht'},
] as const;
export const TIMES=[{id:'early-morning',label:'Early morning'},{id:'morning',label:'Morning'},{id:'midday',label:'Midday'},{id:'afternoon',label:'Afternoon'},{id:'evening',label:'Evening'},{id:'night',label:'Night'}] as const;
export const WEATHER=[{id:'clear',label:'Clear skies'},{id:'partly-cloudy',label:'Partly cloudy'},{id:'overcast',label:'Overcast'},{id:'precipitation',label:'Rain / snow'},{id:'humid',label:'Humid'},{id:'windy',label:'Windy'}] as const;
export const AREAS=[{id:'industrial',label:'Industrial'},{id:'residential',label:'Residential'},{id:'city-centre',label:'City centre'},{id:'waterfront',label:'Waterfront'},{id:'park-nature',label:'Park / nature'},{id:'mixed-use',label:'Mixed use'}] as const;
export type PhotoTags={imageTypes:string[];timeOfDay:string;weather:string[];area:string};
export const emptyTags=():PhotoTags=>({imageTypes:[],timeOfDay:'',weather:[],area:''});
export type GalleryPhoto={mediaType?:'photo'|'video';id:string;title:string;caption:string;place:string;lat:number;lng:number;url:string;createdAt:number;author?:string;mine?:boolean;editable?:boolean;ownerId?:string;shared?:number;category?:string;walk?:string;source?:string;conditions?:PhotoConditions|null;tags?:PhotoTags;isLocalPreview?:boolean};
export type GalleryFilters={query:string;walk:string;types:string[];time:string;weather:string[];area:string};
export const emptyFilters=():GalleryFilters=>({query:'',walk:'',types:[],time:'',weather:[],area:''});
export type GallerySort='uploaded-newest'|'uploaded-oldest'|'taken-newest'|'taken-oldest';

/** Strictly validate the shared taxonomy; never store arbitrary labels from requests. */
export function parseTags(value:unknown):PhotoTags|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const t=value as Record<string,unknown>;
 const list=(v:unknown,options:readonly {id:string}[])=>Array.isArray(v)&&v.length<=options.length&&v.every(x=>typeof x==='string'&&options.some(o=>o.id===x))?[...new Set(v as string[])]:null;
 const single=(v:unknown,options:readonly {id:string}[])=>typeof v==='string'&&(v===''||options.some(o=>o.id===v))?v:null;
 const imageTypes=list(t.imageTypes,IMAGE_TYPES),weather=list(t.weather,WEATHER),timeOfDay=single(t.timeOfDay,TIMES),area=single(t.area,AREAS);
 return imageTypes&&weather&&timeOfDay!==null&&area!==null?{imageTypes,weather,timeOfDay,area}:null;
}

export function captureTime(photo:GalleryPhoto):number|null{
 const t=photo.conditions?.capturedAt;return typeof t==='number'&&Number.isFinite(t)?t:null;
}
/** Newest capture first; older unrecorded pictures retain an upload-time fallback. */
export function newestPhotoFirst(a:{id:string;createdAt:number;conditions?:{capturedAt:number}|null},b:{id:string;createdAt:number;conditions?:{capturedAt:number}|null}){
 const time=(p:typeof a)=>typeof p.conditions?.capturedAt==='number'&&Number.isFinite(p.conditions.capturedAt)?p.conditions.capturedAt:p.createdAt;
 return time(b)-time(a)||a.id.localeCompare(b.id);
}

export function timeTag(photo:GalleryPhoto):string{
 if(photo.tags?.timeOfDay)return photo.tags.timeOfDay;
 const t=captureTime(photo);if(t===null)return '';
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',hour:'2-digit',hourCycle:'h23'}).format(t));
 if(photo.conditions&&photo.conditions.sun.elevation < -6)return 'night';
 if(photo.conditions&&photo.conditions.sun.elevation < 0)return hour<12?'early-morning':'evening';
 return hour<5||hour>=22?'night':hour<9?'early-morning':hour<12?'morning':hour<14?'midday':hour<18?'afternoon':'evening';
}
export function weatherTags(photo:GalleryPhoto):string[]{
 if(photo.tags?.weather.length)return photo.tags.weather;
 const w=photo.conditions?.weather;if(!w)return [];
 const result:string[]=[];
 if(w.cloudCover!==null)result.push(w.cloudCover<=20?'clear':w.cloudCover<80?'partly-cloudy':'overcast');
 if(w.precipitation!==null&&w.precipitation>0)result.push('precipitation');
 if(w.humidity!==null&&w.humidity>=80)result.push('humid');
 if(w.windSpeed!==null&&w.windSpeed>=20)result.push('windy');
 return result;
}
export function filterGallery(photos:GalleryPhoto[],filters:GalleryFilters,sort:GallerySort):GalleryPhoto[]{
 const query=filters.query.trim().toLocaleLowerCase();
 return photos.filter(p=>{
  const types=p.tags?.imageTypes??[],weather=weatherTags(p),time=timeTag(p);
  if(filters.walk&&(filters.walk==='none'?!!p.walk:p.walk!==filters.walk))return false;
  if(filters.types.length&&!filters.types.some(t=>t==='untagged'?types.length===0:t.startsWith('category:')?p.category===t.slice(9):types.includes(t)))return false;
  if(filters.time&&(filters.time==='unknown'?!!time:time!==filters.time))return false;
  if(filters.weather.length&&!filters.weather.some(t=>t==='unknown'?weather.length===0:weather.includes(t)))return false;
  if(filters.area&&(filters.area==='unknown'?!!p.tags?.area:p.tags?.area!==filters.area))return false;
  const labels=IMAGE_TYPES.filter(t=>types.includes(t.id)).map(t=>t.label+' '+t.de).join(' ');
  return !query||`${p.title} ${p.caption} ${p.place} ${p.author??''} ${labels}`.toLocaleLowerCase().includes(query);
 }).sort((a,b)=>{
  // Unknown capture dates fall back to upload time; never pretend upload time is capture time.
  const time=(p:GalleryPhoto)=>sort.startsWith('taken')?(captureTime(p)??p.createdAt):p.createdAt;
  return (sort.endsWith('oldest')?1:-1)*(time(a)-time(b))||a.id.localeCompare(b.id);
 });
}

/** Owners edit their own photographs; admins edit every one they can see. */
export const canEditPhoto=(p:{mine?:boolean;editable?:boolean})=>p.editable??p.mine!==false;
