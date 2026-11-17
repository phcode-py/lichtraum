import {parsePaperEntryChanges} from '@/lib/paper-entry-edits';
import {createClient,getSessionUser,isCrossOrigin} from '@/lib/supabase/server';
import {noteMessages,validReferenceKey,referenceExists,REFERENCE_ONLY_CONTENT} from '@/lib/paper-references';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to read entries.'},{status:401});
 const {id}=await params;
 const {data:paper,error:paperError}=await db.from('correspondence_papers').select('id').eq('id',id).maybeSingle();
 if(paperError)return Response.json({error:'Entries could not be loaded.'},{status:503});
 if(!paper)return Response.json({error:'Paper not found.'},{status:404});
 const {data,error}=await db.from('correspondence_entries').select('*').eq('paper_id',id).order('created_at',{ascending:false}).limit(100);
 if(error)return Response.json({error:'Entries could not be loaded.'},{status:503});
 return Response.json({messages:await noteMessages(db,data.reverse(),user.id)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to write an entry.'},{status:401});
 let body;try{body=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
 const imageKey=body.imageKey;
 if(imageKey!==undefined&&(!validReferenceKey(imageKey,user.id)||!await referenceExists(db,imageKey)))return Response.json({error:'Upload a valid reference image first.'},{status:400});
 const content=(typeof body.content==='string'?body.content.trim():'')||(imageKey?REFERENCE_ONLY_CONTENT:'');
 if(!content||content.length>800)return Response.json({error:'Write an entry of 1–800 characters or add a reference image.'},{status:400});
 const {id}=await params;
 const {data,error}=await db.from('correspondence_entries').insert({paper_id:id,owner:user.id,author_name:user.name,content,...(imageKey?{image_key:imageKey}:{})}).select('*').single();
 if(error||!data)return Response.json({error:'Your entry could not be saved. Please try again.'},{status:503});
 return Response.json({message:(await noteMessages(db,[data],user.id))[0]},{status:201});
}

export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to edit an entry.'},{status:401});
 let b;try{b=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(Array.isArray(b?.entries)){
  const changes=parsePaperEntryChanges(b.entries);
  if(!changes)return Response.json({error:'Keep entries within 800 characters and choose valid references.'},{status:400});
  const valid=await Promise.all(changes.map(change=>change.imageKey==null||validReferenceKey(change.imageKey,user.id)&&referenceExists(db,change.imageKey)));
  if(valid.some(v=>!v))return Response.json({error:'Upload a valid reference file first.'},{status:400});
  const {id}=await params;
  const {data:paper,error:paperError}=await db.from('correspondence_papers').select('id').eq('id',id).maybeSingle();
  if(paperError)return Response.json({error:'The paper could not be loaded.'},{status:503});
  if(!paper)return Response.json({error:'Paper not found.'},{status:404});
  const {data,error}=await db.rpc('edit_paper_entries',{target_paper:id,changes});
  if(error)return Response.json({error:['PGRST202','42883','42703'].includes(error.code)?'Editing all entries needs the one-time database setup. Your edits are still here.':'Your entries could not be saved. Your edits are still here.'},{status:error.code==='42501'?403:503});
  if(!data||data.length!==changes.length)return Response.json({error:'Not all entries could be saved. Your edits are still here.'},{status:503});
  const removed=data.filter((row:{deleted_at?:string|null})=>row.deleted_at);
  return Response.json({messages:await noteMessages(db,data.filter((row:{deleted_at?:string|null})=>!row.deleted_at),user.id),deletedEntryIds:removed.map((row:{id:string})=>row.id)});
 }
 if(!b||typeof b.entryId!=='string'||typeof b.content!=='string'||!b.content.trim()||b.content.trim().length>800)return Response.json({error:'Write an entry of 1–800 characters.'},{status:400});
 const {id}=await params;
 const {data,error}=await db.from('correspondence_entries').update({content:b.content.trim()}).eq('id',b.entryId).eq('paper_id',id).eq('owner',user.id).select('*').maybeSingle();
 if(error)return Response.json({error:'Your entry could not be updated. Your changes are still here.'},{status:503});
 if(!data)return Response.json({error:'Entry not found, or it belongs to someone else.'},{status:404});
 return Response.json({message:(await noteMessages(db,[data],user.id))[0]});
}
