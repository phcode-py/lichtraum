import {parsePaperEntryChanges} from '@/lib/paper-entry-edits';
import {noteMessages,validReferenceKey,referenceExists,REFERENCE_ONLY_CONTENT} from '@/lib/paper-references';
import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to open Working notes.' }, { status: 401 });

  const [notes,first,latestEdit]=await Promise.all([
    supabase.from('messages').select('*').order('created_at',{ascending:false}).limit(100),
    supabase.from('messages').select('created_at').order('created_at',{ascending:true}).limit(1).maybeSingle(),
    supabase.from('messages').select('updated_at').order('updated_at',{ascending:false,nullsFirst:false}).limit(1).maybeSingle(),
  ]);
  if(notes.error)return Response.json({error:'The chat could not be loaded. Please try again.'},{status:503});
  const messages=await noteMessages(supabase,notes.data.reverse(),user.id);
  return Response.json({messages,contributors:[],createdAt:first.data?.created_at?Date.parse(first.data.created_at):undefined,updatedAt:Math.max(0,...messages.map(m=>m.updatedAt),latestEdit.data?.updated_at?Date.parse(latestEdit.data.updated_at):0)||undefined},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to write a message.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('content-length')) > 5000) return new Response('Message too long', { status: 413 });

  let payload: { content?: unknown;imageKey?:unknown;imageName?:unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return Response.json({error:'Invalid request.'},{status:400});
  const imageKey=payload.imageKey;
  if(imageKey!==undefined&&(!validReferenceKey(imageKey,user.id)||!await referenceExists(supabase,imageKey)))return Response.json({error:'Upload a valid reference image first.'},{status:400});
  const content=(typeof payload.content==='string'?payload.content.trim():'')||(imageKey?REFERENCE_ONLY_CONTENT:'');
  if(!content||content.length>800)return Response.json({error:'Write a note of 1–800 characters or add a reference image.'},{status:400});

  const { data: m, error } = await supabase.from('messages').insert({ owner: user.id, author_name: user.name, content,...(imageKey?{image_key:imageKey}:{}) }).select('*').single();
  if (error || !m) return Response.json({ error: 'Your message could not be sent. Please try again.' }, { status: 503 });
  return Response.json({ message: (await noteMessages(supabase,[m],user.id))[0] }, { status: 201 });
}

export async function PATCH(request:Request){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in to edit a note.'},{status:401});
 let b;try{b=await request.json()}catch{return Response.json({error:'Invalid request.'},{status:400})}
 if(Array.isArray(b?.entries)){
  const changes=parsePaperEntryChanges(b.entries);
  if(!changes)return Response.json({error:'Keep entries within 800 characters and choose valid references.'},{status:400});
  if(changes.some(change=>change.delete))return Response.json({error:'Chat messages can be edited, but not removed here.'},{status:400});
  const valid=await Promise.all(changes.map(change=>change.imageKey==null||validReferenceKey(change.imageKey,user.id)&&referenceExists(db,change.imageKey)));
  if(valid.some(v=>!v))return Response.json({error:'Upload a valid reference file first.'},{status:400});

  const {data,error}=await db.rpc('edit_room_entries',{changes});
  if(error)return Response.json({error:['PGRST202','42883','42703'].includes(error.code)?'Editing all entries needs the one-time database setup. Your edits are still here.':'Your entries could not be saved. Your edits are still here.'},{status:error.code==='42501'?403:503});
  if(!data||data.length!==changes.length)return Response.json({error:'Not all entries could be saved. Your edits are still here.'},{status:503});
  return Response.json({messages:await noteMessages(db,data,user.id)});
 }
 if(!b||typeof b.entryId!=='string'||typeof b.content!=='string'||!b.content.trim()||b.content.trim().length>800)return Response.json({error:'Write a note of 1–800 characters.'},{status:400});
 const {data:m,error}=await db.from('messages').update({content:b.content.trim()}).eq('id',b.entryId).eq('owner',user.id).select('*').maybeSingle();
 if(error)return Response.json({error:'Your note could not be updated. Your changes are still here.'},{status:503});
 if(!m)return Response.json({error:'Note not found, or it belongs to someone else.'},{status:404});
 return Response.json({message:(await noteMessages(db,[m],user.id))[0]});
}
