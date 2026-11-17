/** Finished-walk details shared by manual entry, editing and the API. */
export type WalkDetails = {startedAt:string;endedAt:string;distance:number;duration:number};
export type WalkDetailsResult = {details:WalkDetails;error?:never}|{error:string;details?:never};

export function parseWalkDetails(value:unknown, now=Date.now()):WalkDetailsResult {
  if(!value || typeof value!=='object' || Array.isArray(value))return {error:'Enter the details of your walk.'};
  const v=value as Record<string,unknown>;
  const start=typeof v.startedAt==='string'?Date.parse(v.startedAt):NaN;
  const end=typeof v.endedAt==='string'?Date.parse(v.endedAt):NaN;
  if(!Number.isFinite(start)||!Number.isFinite(end))return {error:'Choose a valid start and end date.'};
  if(start<0||end<=start)return {error:'The end must be after the start of your walk.'};
  if(end>now)return {error:'Choose a walk that has already finished.'};
  if(typeof v.distance!=='number'||!Number.isFinite(v.distance)||v.distance<0||v.distance>1_000_000)return {error:'Enter a distance between 0 and 1,000 km.'};
  if(typeof v.duration!=='number'||!Number.isFinite(v.duration)||v.duration<0||v.duration>2_147_483_647)return {error:'Enter a valid walking duration.'};
  const duration=Math.round(v.duration);
  if(duration>Math.ceil((end-start)/1000))return {error:'Walking time cannot be longer than the time between start and finish.'};
  return {details:{startedAt:new Date(start).toISOString(),endedAt:new Date(end).toISOString(),distance:v.distance,duration}};
}

/** datetime-local fields always show Zürich time, even on a browser in another time zone. */
export function zurichInput(timestamp:number) {
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Zurich',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(timestamp);
  const part=(name:string)=>parts.find(p=>p.type===name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

/** Resolve Swiss summer/winter time; reject missing clock-change times instead of silently shifting them. */
export function fromZurichInput(value:string, preferred?:number):string|null {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))return null;
  const full=value.length===16?value+':00':value;
  // Keep the exact original instant when a recorded walk is edited during the repeated autumn hour.
  if(preferred!==undefined&&Number.isFinite(preferred)&&zurichInput(preferred)===full)return new Date(preferred).toISOString();
  const wall=Date.parse(full+'Z');
  for(const offset of [2,1]){
    const instant=wall-offset*3_600_000;
    if(Number.isFinite(instant)&&zurichInput(instant)===full)return new Date(instant).toISOString();
  }
  return null;
}
