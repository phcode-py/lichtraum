import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import { toWalk, type WalkRow } from '@/lib/walks';

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

  if (body.points !== undefined) {
    if (!validPoints(body.points)) return Response.json({ error: 'Invalid points.' }, { status: 400 });
    const distance = Number(body.distance), duration = Math.round(Number(body.duration));
    if (!Number.isFinite(distance) || !Number.isFinite(duration)) return Response.json({ error: 'Invalid totals.' }, { status: 400 });
    const { error } = await supabase.rpc('append_walk_points', { walk_id: id, points: body.points, distance, duration });
    if (error) return Response.json({ error: 'Could not save the route.' }, { status: 503 });
  }

  const update: Record<string, unknown> = {};
  if (typeof body.status === 'string' && STATUSES.includes(body.status)) {
    update.status = body.status;
    if (body.status === 'ended') update.ended_at = new Date().toISOString();
  }
  if (typeof body.title === 'string') update.title = body.title.trim().slice(0, 100);
  if (Number.isFinite(Number(body.duration)) && body.points === undefined) update.duration_s = Math.max(0, Math.round(Number(body.duration)));

  let row: WalkRow | null = null;
  if (Object.keys(update).length) {
    const { data, error } = await supabase.from('walks').update(update).eq('id', id).eq('owner', user.id).select('*').maybeSingle();
    if (error) return Response.json({ error: 'Could not update the walk.' }, { status: 503 });
    if (!data) return new Response('Not found', { status: 404 });
    row = data as WalkRow;
  } else {
    const { data } = await supabase.from('walks').select('*').eq('id', id).maybeSingle();
    if (!data) return new Response('Not found', { status: 404 });
    row = data as WalkRow;
  }
  // Points can be large; the recorder keeps its own copy, so only send them back when asked.
  const walk = toWalk(row, user.id);
  return Response.json({ walk: body.withPath ? walk : { ...walk, path: [] } });
}
