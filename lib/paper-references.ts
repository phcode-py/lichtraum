import type {SupabaseClient} from '@supabase/supabase-js';
export const REFERENCE_BUCKET='paper-references';
export const REFERENCE_ACCEPT='image/jpeg,image/png,image/webp';
export const MAX_REFERENCE_SIZE=10*1024*1024;
const TYPES=['image/jpeg','image/png','image/webp'];
export type NoteRow={id:string;owner:string;author_name:string;content:string;created_at:string;image_key?:string|null};
export function referenceError(file:{type:string;size:number}){
 if(!TYPES.includes(file.type))return 'Choose a JPG, PNG or WebP image.';
 if(!Number.isFinite(file.size)||file.size<=0||file.size>MAX_REFERENCE_SIZE)return 'Choose an image up to 10 MB.';
 return '';
}
export function validReferenceKey(key:unknown,owner:string):key is string{
 return typeof key==='string'&&key.startsWith(owner+'/')&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key.slice(owner.length+1));
}
export async function referenceExists(db:SupabaseClient,key:string){
 const {data,error}=await db.storage.from(REFERENCE_BUCKET).info(key);
 return !error&&!!data&&typeof data.size==='number'&&typeof data.contentType==='string'&&!referenceError({size:data.size,type:data.contentType});
}
export async function uploadPaperReference(file:File):Promise<string>{
 const problem=referenceError(file);if(problem)throw Error(problem);
 const [{createClient},{prepareImage}]=await Promise.all([import('./supabase/client'),import('./image')]);
 const db=createClient();const {data:{user}}=await db.auth.getUser();
 if(!user)throw Error('Sign in to add a reference image.');
 // Keep line drawings/transparent artwork lossless; shrink camera JPEGs.
 const image=file.type==='image/jpeg'?await prepareImage(file):file;
 const key=`${user.id}/${crypto.randomUUID()}`;
 const {error}=await db.storage.from(REFERENCE_BUCKET).upload(key,image,{contentType:image.type,upsert:false});
 if(error)throw Error('Your reference image could not be uploaded. Please try again.');
 return key;
}
export async function noteMessages(db:SupabaseClient,rows:NoteRow[],userId:string){
 const keys=[...new Set(rows.flatMap(row=>row.image_key?[row.image_key]:[]))];
 const urls=new Map<string,string>();
 if(keys.length){const {data}=await db.storage.from(REFERENCE_BUCKET).createSignedUrls(keys,6*60*60);data?.forEach(item=>{if(item.path&&item.signedUrl)urls.set(item.path,item.signedUrl)})}
 return rows.map(row=>({id:row.id,author:row.author_name,content:row.content,createdAt:Date.parse(row.created_at),mine:row.owner===userId,...(row.image_key?{hasImage:true,imageUrl:urls.get(row.image_key)??''}:{})}));
}
