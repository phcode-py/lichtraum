import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import { toWalk, type WalkRow } from '@/lib/walks';
import {parseWalkDetails} from '@/lib/walk-details';

const STATUSES = ['recording', 'paused', 'ended'];

function validPoints(v: unknown): v is [number, number, number, number][] {
  return Array.isArray(v) && v.length <= 2000 && v.every(p =>
    Array.isArray(p) && p.length === 4 && p.every(n => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90);
}

// Saves GPS points recorded since the last save, and/or changes status or title.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});

  const {data:current,error:readError}=await supabase.from('walks').select('status').eq('id',id).eq('owner',user.id).maybeSingle();
  if(readError)return Response.json({error:'The walk could not be loaded.'},{status:503});
  if(!current)return Response.json({error:'Walk not found.'},{status:404});
  let finishedDetails;
  if(body.details!==undefined){
    if(current.status!=='ended')return Response.json({error:'Finish this walk before editing its dates or totals.'},{status:409});
    if(body.points!==undefined||body.status!==undefined||body.duration!==undefined)return Response.json({error:'Save finished-walk details separately from recording.'},{status:400});
    const parsed=parseWalkDetails(body.details);
    if(!parsed.details)return Response.json({error:parsed.error},{status:400});
    finishedDetails=parsed.details;
  }
  if(current.status==='ended'&&body.status!==undefined&&body.status!=='ended')return Response.json({error:'A finished walk cannot be restarted.'},{status:409});

  if (body.points !== undefined) {
    if (!validPoints(body.points)) return Response.json({ error: 'Invalid points.' }, { status: 400 });
    const distance = Number(body.distance), duration = Math.round(Number(body.duration));
    if (!Number.isFinite(distance) || !Number.isFinite(duration)) return Response.json({ error: 'Invalid totals.' }, { status: 400 });
    const { error } = await supabase.rpc('append_walk_points', { walk_id: id, points: body.points, distance, duration });
    if (error) return Response.json({ error: 'Could not save the route.' }, { status: 503 });
  }

  const update: Record<string, unknown> = finishedDetails?{started_at:finishedDetails.startedAt,ended_at:finishedDetails.endedAt,distance_m:finishedDetails.distance,duration_s:finishedDetails.duration}:{};
  if (typeof body.status === 'string' && STATUSES.includes(body.status)) {
    update.status = body.status;
    if (body.status === 'ended' && current.status !== 'ended') update.ended_at = new Date().toISOString();
  }
  if (typeof body.title === 'string') { if(!body.title.trim()||body.title.trim().length>100)return Response.json({error:'Give the walk a name of up to 100 characters.'},{status:400}); update.title=body.title.trim(); }
  if (typeof body.shared === 'boolean') update.shared=body.shared;
  if (Number.isFinite(Number(body.duration)) && body.points === undefined) update.duration_s = Math.max(0, Math.round(Number(body.duration)));

  let row: WalkRow | null = null;
  if (Object.keys(update).length) {
    let query=supabase.from('walks').update(update).eq('id',id).eq('owner',user.id);
    if(finishedDetails)query=query.eq('status','ended');
    const {data,error}=await query.select('*').maybeSingle();
    if (error) return Response.json({ error: 'Could not update the walk.' }, { status: 503 });
    if (!data) return new Response('Not found', { status: 404 });
    row = data as WalkRow;
  } else {
    const { data } = await supabase.from('walks').select('*').eq('id', id).eq('owner', user.id).maybeSingle();
    if (!data) return new Response('Not found', { status: 404 });
    row = data as WalkRow;
  }
  // Points can be large; the recorder keeps its own copy, so only send them back when asked.
  const walk = toWalk(row, user.id);
  return Response.json({ walk: body.withPath ? walk : { ...walk, path: [] } });
}

// Removes only the caller’s finished walk. Photographs and stored image files are kept.
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){
 if(isCrossOrigin(request))return new Response('Forbidden',{status:403});
 const db=await createClient(),user=await getSessionUser(db);
 if(!user)return Response.json({error:'Sign in required.'},{status:401});
 const {id}=await params;
 const {data:walk,error:readError}=await db.from('walks').select('id,status').eq('id',id).eq('owner',user.id).maybeSingle();
 if(readError)return Response.json({error:'The walk could not be loaded.'},{status:503});
 if(!walk)return Response.json({error:'Walk not found.'},{status:404});
 if(walk.status!=='ended')return Response.json({error:'Finish this walk before removing it.'},{status:409});
 const {data,error}=await db.from('walks').delete().eq('id',id).eq('owner',user.id).eq('status','ended').select('id').maybeSingle();
 if(error)return Response.json({error:'The walk could not be removed. Please try again.'},{status:503});
 if(!data)return Response.json({error:'The walk was not removed. Refresh and try again.'},{status:409});
 return Response.json({ok:true});
}
