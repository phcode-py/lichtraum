import type {SupabaseClient} from '@supabase/supabase-js';
import {emptyTags,parseTags,type PhotoTags} from './gallery';

export async function readPhotoTags(supabase:SupabaseClient,ids:string[]){
 const tags=new Map<string,PhotoTags>();
 if(!ids.length){const {error}=await supabase.from('photo_organisation').select('photo_id').limit(0);return {tags,available:!error};}
 for(let offset=0;offset<ids.length;offset+=100){
  const {data,error}=await supabase.from('photo_organisation').select('photo_id,tags').in('photo_id',ids.slice(offset,offset+100));
  if(error)return {tags,available:false};
  for(const row of data??[])tags.set(row.photo_id,parseTags(row.tags)??emptyTags());
 }
 return {tags,available:true};
}
export async function writePhotoTags(supabase:SupabaseClient,id:string,tags:PhotoTags){
 const {error}=await supabase.from('photo_organisation').upsert({photo_id:id,tags},{onConflict:'photo_id'});
 return !error;
}
