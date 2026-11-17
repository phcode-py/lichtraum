import {noteMessages,validReferenceKey,referenceExists} from '@/lib/paper-references';
import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to open Working notes.' }, { status: 401 });

  const [notes, people] = await Promise.all([
    supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.rpc('photo_contributors'),
  ]);
  if (notes.error || people.error) return Response.json({ error: 'Working notes could not be loaded. Please try again.' }, { status: 503 });

  return Response.json({
    messages: await noteMessages(supabase,notes.data.reverse(),user.id),
    contributors: (people.data as { name: string; count: number; latest: string }[]).map(p => ({ name: p.name, count: Number(p.count), latest: Date.parse(p.latest) })),
  }, { headers: { 'Cache-Control': 'no-store' } });
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
  const content=(typeof payload.content==='string'?payload.content.trim():'')||(imageKey?(typeof payload.imageName==='string'?payload.imageName.trim().slice(0,100):'')||'Reference image':'');
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
 if(!b||typeof b.entryId!=='string'||typeof b.content!=='string'||!b.content.trim()||b.content.trim().length>800)return Response.json({error:'Write a note of 1–800 characters.'},{status:400});
 const {data:m,error}=await db.from('messages').update({content:b.content.trim()}).eq('id',b.entryId).eq('owner',user.id).select('*').maybeSingle();
 if(error)return Response.json({error:'Your note could not be updated. Your changes are still here.'},{status:503});
 if(!m)return Response.json({error:'Note not found, or it belongs to someone else.'},{status:404});
 return Response.json({message:(await noteMessages(db,[m],user.id))[0]});
}
