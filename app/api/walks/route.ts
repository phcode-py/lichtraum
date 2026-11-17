import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import { toWalk, type WalkRow } from '@/lib/walks';
import {parseWalkDetails} from '@/lib/walk-details';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to see walks.' }, { status: 401 });
  // Row-level security: your own walks plus shared ones.
  const { data, error } = await supabase.from('walks').select('*').order('started_at', { ascending: false }).limit(200);
  if (error) return Response.json({ error: 'Walks could not be loaded. Please try again.' }, { status: 503 });
  return Response.json({ walks: (data as WalkRow[]).map(w => toWalk(w, user.id)) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to start a walk.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({error:'Invalid request.'},{status:400}); }
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if(title.length>100)return Response.json({error:'Keep the walk name under 100 characters.'},{status:400});
  if(body.kind!==undefined&&body.kind!=='past')return Response.json({error:'Invalid walk type.'},{status:400});

  if(body.kind==='past'){
    if(!title)return Response.json({error:'Give your walk a name.'},{status:400});
    const parsed=parseWalkDetails(body.details);
    if(!parsed.details)return Response.json({error:parsed.error},{status:400});
    const d=parsed.details;
    // A past entry is already finished. Never close or modify a walk currently being recorded.
    const {data,error}=await supabase.from('walks').insert({owner:user.id,author_name:user.name,title,status:'ended',shared:body.shared===true,started_at:d.startedAt,ended_at:d.endedAt,distance_m:d.distance,duration_s:d.duration,path:[]}).select('*').single();
    if(error||!data)return Response.json({error:'Your past walk could not be saved. Please try again.'},{status:503});
    return Response.json({walk:toWalk(data as WalkRow,user.id)},{status:201});
  }

  // Only one open walk at a time: close any you left running.
  await supabase.from('walks').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('owner', user.id).neq('status', 'ended');

  const { data, error } = await supabase.from('walks').insert({ owner: user.id, author_name: user.name, title }).select('*').single();
  if (error || !data) return Response.json({ error: 'The walk could not be started. Please try again.' }, { status: 503 });
  return Response.json({ walk: toWalk(data as WalkRow, user.id) }, { status: 201 });
}
