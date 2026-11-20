'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';

const ROW=32;
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const pad=(n:number)=>String(n).padStart(2,'0');
const daysIn=(year:number,month:number)=>new Date(Date.UTC(year,month+1,0)).getUTCDate();
type Parts={year:number;month:number;day:number;hour:number;minute:number};
const parse=(value:string):Parts|null=>{const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);return m?{year:+m[1],month:+m[2]-1,day:+m[3],hour:+m[4],minute:+m[5]}:null};
const format=(p:Parts)=>`${p.year}-${pad(p.month+1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;

/** One scrolling column. The row in the middle band is the chosen one. */
function Wheel({label,items,index,onSelect,className=''}:{label:string;items:string[];index:number;onSelect:(i:number)=>void;className?:string}){
 const ref=useRef<HTMLDivElement>(null),settling=useRef<ReturnType<typeof setTimeout>|null>(null),userScrolling=useRef(false);
 useEffect(()=>{const el=ref.current;if(!el||userScrolling.current)return;if(Math.abs(el.scrollTop-index*ROW)>1)el.scrollTop=index*ROW},[index,items.length]);
 useEffect(()=>()=>{if(settling.current)clearTimeout(settling.current)},[]);
 function scrolled(){
  const el=ref.current;if(!el)return;userScrolling.current=true;
  if(settling.current)clearTimeout(settling.current);
  settling.current=setTimeout(()=>{userScrolling.current=false;const i=Math.max(0,Math.min(items.length-1,Math.round(el.scrollTop/ROW)));if(i!==index)onSelect(i);else el.scrollTo({top:i*ROW,behavior:'smooth'})},120);
 }
 function key(e:React.KeyboardEvent){const step={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[e.key];if(step===undefined)return;e.preventDefault();onSelect(Math.max(0,Math.min(items.length-1,index+step)))}
 return <div ref={ref} className={'dt-wheel '+className} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={undefined} onScroll={scrolled} onKeyDown={key}>
  <div className="dt-wheel-pad" aria-hidden="true"/>
  {items.map((item,i)=><div key={item+i} role="option" aria-selected={i===index} className={i===index?'is-chosen':undefined} onClick={()=>{onSelect(i);ref.current?.scrollTo({top:i*ROW,behavior:'smooth'})}}>{item}</div>)}
  <div className="dt-wheel-pad" aria-hidden="true"/>
 </div>;
}

/** A date and time chosen by scrolling wheels, in Zürich time ("YYYY-MM-DDTHH:mm"). */
export default function DateTimeWheel({value,onChange,min='1940-01-01T00:00',max}:{value:string;onChange:(v:string)=>void;min?:string;max:string}){
 const[open,setOpen]=useState(false),panel=useId();
 const parts=parse(value)??parse(max)!;
 const minYear=parse(min)!.year,maxYear=parse(max)!.year;
 const years=Array.from({length:maxYear-minYear+1},(_,i)=>String(minYear+i));
 const days=Array.from({length:daysIn(parts.year,parts.month)},(_,i)=>String(i+1));
 function set(change:Partial<Parts>){
  const next={...parts,...change};next.day=Math.min(next.day,daysIn(next.year,next.month));
  let text=format(next);if(text>max)text=max;if(text<min)text=min;
  onChange(text);
 }
 const label=parse(value)?`${parts.day} ${MONTHS[parts.month]} ${parts.year} · ${pad(parts.hour)}:${pad(parts.minute)}`:'Choose a date and time';
 return <div className="dt-picker">
  <button type="button" className="dt-display" aria-expanded={open} aria-controls={panel} onClick={()=>setOpen(o=>!o)}><span>{label}</span><ChevronDown size={14} aria-hidden="true"/></button>
  {open&&<div id={panel} className="dt-panel" role="group" aria-label="Choose date and time">
   <div className="dt-wheels">
    <Wheel label="Day" items={days} index={parts.day-1} onSelect={i=>set({day:i+1})}/>
    <Wheel label="Month" items={MONTHS} index={parts.month} onSelect={i=>set({month:i})} className="dt-month"/>
    <Wheel label="Year" items={years} index={parts.year-minYear} onSelect={i=>set({year:minYear+i})}/>
    <span className="dt-gap" aria-hidden="true"/>
    <Wheel label="Hour" items={Array.from({length:24},(_,i)=>pad(i))} index={parts.hour} onSelect={i=>set({hour:i})}/>
    <span className="dt-colon" aria-hidden="true">:</span>
    <Wheel label="Minute" items={Array.from({length:60},(_,i)=>pad(i))} index={parts.minute} onSelect={i=>set({minute:i})}/>
   </div>
   <div className="dt-actions"><button type="button" onClick={()=>onChange(max)}>now</button><button type="button" onClick={()=>setOpen(false)}>done</button></div>
  </div>}
 </div>;
}
