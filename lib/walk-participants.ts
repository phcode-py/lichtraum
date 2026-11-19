import type {SupabaseClient} from '@supabase/supabase-js';
import type {Walk} from './walks';
export type WalkPerson={id:string;name:string};
export function parseParticipantIds(value:unknown):string[]|null{
 if(!Array.isArray(value)||value.length>20||value.some(id=>typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))return null;
 return [...new Set((value as string[]).map(id=>id.toLowerCase()))];
}
export async function isWalkParticipant(db:SupabaseClient,id:string){try{const {data,error}=await db.rpc('is_walk_participant',{walk_id:id});return !error&&data===true}catch{return false}}
export async function withWalkParticipants(db:SupabaseClient,walks:Walk[],userId:string){
 try{const {data,error}=await db.rpc('visible_walk_participants');if(error||!Array.isArray(data))return walks;
 return walks.map(w=>{const people=data.filter(p=>p.walk_id===w.id).map(p=>({id:p.user_id as string,name:p.name as string}));return {...w,participants:people,participating:people.some(p=>p.id===userId),canEdit:w.mine||people.some(p=>p.id===userId)}})}catch{return walks}
}
