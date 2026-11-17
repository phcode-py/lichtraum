import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import type {PhotoConditions} from '@/lib/photo-conditions';
import { CATEGORIES, URL_TTL, toPhoto, type PhotoRow } from '@/lib/photos';

// Edit your own photograph: title, caption, category, sharing, or a new picture (already uploaded to storage).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const { data: current } = await supabase.from('photos').select('*').eq('id', id).eq('owner', user.id).maybeSingle();
  if (!current) return new Response('Not found', { status: 404 });

  const update: Record<string, unknown> = {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);
  const title = str(body.title), caption = str(body.caption), category = str(body.category), key = str(body.key);
  if (title !== undefined) { if (!title || title.length > 100) return Response.json({ error: 'Give it a title of up to 100 characters.' }, { status: 400 }); update.title = title; }
  if (caption !== undefined) { if (caption.length > 600) return Response.json({ error: 'Keep the caption under 600 characters.' }, { status: 400 }); update.caption = caption; }
  if (category !== undefined && CATEGORIES.includes(category)) update.category = category;
  if (typeof body.shared === 'boolean') update.shared = body.shared;
  if (key !== undefined && key !== current.key) {
    if (!new RegExp(`^${user.id}/[0-9a-f-]{36}$`).test(key)) return Response.json({ error: 'Invalid picture.' }, { status: 400 });
    update.key = key;
  }
  if (!Object.keys(update).length) return Response.json({ error: 'Nothing to change.' }, { status: 400 });

  const { data: row, error } = await supabase.from('photos').update(update).eq('id', id).eq('owner', user.id).select('*').single();
  if (error || !row) {
    if (update.key) await supabase.storage.from('photos').remove([update.key as string]);
    return Response.json({ error: 'Your changes could not be saved. Please try again.' }, { status: 503 });
  }
  // The old picture is no longer used.
  if (update.key) await supabase.storage.from('photos').remove([current.key]);
  const { data: signed } = await supabase.storage.from('photos').createSignedUrl(row.key, URL_TTL);
  const {data:conditions}=await supabase.from('photo_conditions').select('snapshot').eq('photo_id',id).maybeSingle();
  return Response.json({ photo: toPhoto(row as PhotoRow, user.id, signed?.signedUrl ?? '',conditions?.snapshot as PhotoConditions??null) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return new Response('Sign in required', { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  const { id } = await params;

  const { data: photo } = await supabase.from('photos').select('key').eq('id', id).eq('owner', user.id).maybeSingle();
  if (!photo) return new Response('Not found', { status: 404 });
  const { error: storageError } = await supabase.storage.from('photos').remove([photo.key]);
  const { error } = storageError ? { error: storageError } : await supabase.from('photos').delete().eq('id', id).eq('owner', user.id);
  if (error) return Response.json({ error: 'Could not delete this photo. Try again.' }, { status: 503 });
  return Response.json({ ok: true });
}
