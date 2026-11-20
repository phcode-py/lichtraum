'use client';
import {useState} from 'react';

const OTHER='\u0000other';

/** Who took the picture: you, someone from the project, or any name typed in. */
export default function TakenBy({value,onChange,people,allowMe=false}:{value:string;onChange:(name:string)=>void;people:string[];allowMe?:boolean}){
 const names=[...new Set(people.map(n=>n.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 const[typing,setTyping]=useState(()=>!!value&&!names.includes(value));
 const selected=typing?OTHER:value;
 return <div className="field taken-by">Taken by
  <select aria-label="Taken by" value={selected} onChange={e=>{if(e.target.value===OTHER){setTyping(true);onChange('')}else{setTyping(false);onChange(e.target.value)}}}>
   {allowMe&&<option value="">Me</option>}
   {!allowMe&&!value&&!typing&&<option value="">Choose a person</option>}
   {names.map(n=><option key={n} value={n}>{n}</option>)}
   <option value={OTHER}>Someone else…</option>
  </select>
  {typing&&<input aria-label="Name of the photographer" maxLength={80} placeholder="Name of the photographer" value={value} autoFocus onChange={e=>onChange(e.target.value)}/>}
 </div>;
}
