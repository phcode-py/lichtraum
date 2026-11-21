import type {SupabaseClient} from '@supabase/supabase-js';
import {MAX_IMAGE_INPUT_BYTES,storedImageOk} from './image-policy.ts';
export const REFERENCE_ONLY_CONTENT='[paper-reference:v1]';
export const referenceCaption=(content:string,hasReference:boolean)=>hasReference&&content===REFERENCE_ONLY_CONTENT?'':content;
export const REFERENCE_BUCKET='paper-references';
export const REFERENCE_IMAGE_ACCEPT='image/jpeg,image/png,image/webp';
export const REFERENCE_VIDEO_ACCEPT='video/mp4,video/webm,video/quicktime';
export const REFERENCE_ACCEPT=REFERENCE_IMAGE_ACCEPT+','+REFERENCE_VIDEO_ACCEPT;
/** Largest original image a person can choose; it is shrunk before upload. */
export const MAX_REFERENCE_SIZE=MAX_IMAGE_INPUT_BYTES;
const TYPES=REFERENCE_ACCEPT.split(',');
const VIDEO_EXT:Record<string,string>={'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov'};
export const referenceIsVideo=(key:string)=>/\.(mp4|webm|mov)$/.test(key);
export type NoteRow={id:string;owner:string;author_name:string;content:string;created_at:string;updated_at?:string|null;image_key?:string|null};
export function referenceError(file:{type:string;size:number}){
 if(!TYPES.includes(file.type))return 'Choose a JPG, PNG, WebP image or an MP4, MOV, WebM video.';
 if(!Number.isFinite(file.size)||file.size<=0||file.size>(file.type.startsWith('video/')?50*1024*1024:MAX_REFERENCE_SIZE))return file.type.startsWith('video/')?'Choose a video up to 50 MB.':'Choose an image up to 50 MB.';
 return '';
}
export function validReferenceKey(key:unknown,owner:string):key is string{
 return typeof key==='string'&&key.startsWith(owner+'/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\.(?:mp4|webm|mov))?$/.test(key.slice(owner.length+1));
}
export async function referenceExists(db:SupabaseClient,key:string){
 const {data,error}=await db.storage.from(REFERENCE_BUCKET).info(key);
 return !error&&!!data&&typeof data.size==='number'&&typeof data.contentType==='string'&&(data.contentType.startsWith('video/')?!referenceError({size:data.size,type:data.contentType}):storedImageOk({size:data.size,type:data.contentType}))&&referenceIsVideo(key)===data.contentType.startsWith('video/');
}
export async function uploadPaperReference(file:File):Promise<string>{
 const problem=referenceError(file);if(problem)throw Error(problem);
 const [{createClient},{prepareImage}]=await Promise.all([import('./supabase/client'),import('./image')]);
 const db=createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)throw Error('Sign in to add a reference image.');
 // Same shrinking as atlas photos; PNG/WebP keep their format so line drawings stay lossless.
 const image=file.type.startsWith('video/')?file:await prepareImage(file);
 const key=`${user.id}/${crypto.randomUUID()}${VIDEO_EXT[file.type]??''}`;
 const {error}=await db.storage.from(REFERENCE_BUCKET).upload(key,image,{contentType:image.type,upsert:false});
 if(error)throw Error('Your reference file could not be uploaded. Please try again.');
 return key;
}
export async function noteMessages(db:SupabaseClient,rows:NoteRow[],userId:string){
 const keys=[...new Set(rows.flatMap(row=>row.image_key?[row.image_key]:[]))];
 const urls=new Map<string,string>();
 if(keys.length){const {data}=await db.storage.from(REFERENCE_BUCKET).createSignedUrls(keys,6*60*60);data?.forEach(item=>{if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl)})}
 return rows.map(row=>({id:row.id,author:row.author_name,authorId:row.owner,content:row.content,createdAt:Date.parse(row.created_at),updatedAt:Date.parse(row.updated_at??row.created_at),mine:row.owner===userId,...(row.image_key?{hasImage:true,mediaType:referenceIsVideo(row.image_key)?'video':'image',imageUrl:urls.get(row.image_key)??''}:{})}));
}
