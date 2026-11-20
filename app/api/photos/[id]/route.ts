import {mediaBucket, validMediaKey, storedMediaExists} from '@/lib/media';
import {emptyTags} from '@/lib/gallery';
import {readPhotoTags} from '@/lib/photo-tags-server';
import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import {fetchWeather,type PhotoConditions} from '@/lib/photo-conditions';
import {solarPosition} from '@/lib/sun';
import {inZurich} from '@/lib/places';
import {isWalkParticipant} from '@/lib/walk-participants';
import { CATEGORIES, URL_TTL, toPhoto, type PhotoRow } from '@/lib/photos';

// Edit your own photograph: everything chosen at upload (title, place and pin, time taken, category, walk,
// caption, sharing) or a new picture (already uploaded to storage). Tags have their own route.
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
    if (!validMediaKey(key, user.id)) return Response.json({ error: 'Invalid picture.' }, { status: 400 });
    if (!await storedMediaExists(supabase, key)) return Response.json({error:'Upload a photo or video before saving.'}, {status:400});
    update.key = key;
  }
  const author = str(body.author);
  if (author !== undefined) { if (!author || author.length > 80) return Response.json({ error: 'Name the photographer in up to 80 characters.' }, { status: 400 }); update.author_name = author; }
  const place = str(body.place);
  if (place !== undefined) { if (!place || place.length > 100) return Response.json({ error: 'Name the place in up to 100 characters.' }, { status: 400 }); update.place = place; }
  if (body.lat !== undefined || body.lng !== undefined) {
    const lat = Number(body.lat), lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inZurich(lat, lng)) return Response.json({ error: 'Choose a location in the Zürich area.' }, { status: 400 });
    update.lat = lat; update.lng = lng;
  }
  const walk = str(body.walk);
  if (walk !== undefined && walk !== current.walk) {
    if (walk.length > 100) return Response.json({ error: 'Choose a walk from the list.' }, { status: 400 });
    if (walk) {
      const { data: target, error: walkError } = await supabase.from('walks').select('owner').eq('id', walk).maybeSingle();
      if (walkError || !target || (target.owner !== user.id && !await isWalkParticipant(supabase, walk))) return Response.json({ error: 'Only the creator and added participants can add photos to this walk.' }, { status: 403 });
    }
    update.walk = walk;
  }
  // Time taken: sun and weather are worked out again for the (possibly moved) place.
  let snapshot: PhotoConditions | null = null;
  if (body.capturedAt !== undefined) {
    const capturedAt = body.capturedAt;
    if (typeof capturedAt !== 'number' || !Number.isFinite(capturedAt) || capturedAt < Date.UTC(1940, 0, 1) || capturedAt > Date.now() + 60000)
      return Response.json({ error: 'Choose when the photograph was taken, in Zürich time.' }, { status: 400 });
    const lat = (update.lat as number | undefined) ?? current.lat, lng = (update.lng as number | undefined) ?? current.lng;
    const weather = await fetchWeather(capturedAt, lat, lng);
    snapshot = { capturedAt, timeSource: 'chosen', lat, lng, sun: solarPosition(capturedAt, lat, lng), weather, weatherStatus: weather ? 'available' : 'unavailable' };
  }
  if (!Object.keys(update).length && !snapshot) return Response.json({ error: 'Nothing to change.' }, { status: 400 });

  const { data: row, error } = Object.keys(update).length
    ? await supabase.from('photos').update(update).eq('id', id).eq('owner', user.id).select('*').single()
    : { data: current, error: null };
  if (error || !row) {
    return Response.json({ error: 'Your changes could not be saved. Please try again.' }, { status: 503 });
  }
  // Keep the previous file: editing a post does not delete stored media.
  const { data: signed } = await supabase.storage.from(mediaBucket(row.key)).createSignedUrl(row.key, URL_TTL);
  let warning = '';
  if (snapshot) {
    const { data: existing } = await supabase.from('photo_conditions').select('photo_id').eq('photo_id', id).maybeSingle();
    const { data: written, error: conditionsError } = existing
      ? await supabase.from('photo_conditions').update({ snapshot }).eq('photo_id', id).select('photo_id')
      : await supabase.from('photo_conditions').insert({ photo_id: id, snapshot }).select('photo_id');
    // Rewriting an existing record needs the separate photo_condition_edits setup; until then it stays as it was.
    if (conditionsError || !written?.length) warning = existing
      ? 'Your other changes are saved. Changing when an existing photograph was taken needs a one-time database setup by Philipp.'
      : 'Your other changes are saved, but the time taken could not be recorded.';
  }
  const {data:conditions}=await supabase.from('photo_conditions').select('snapshot').eq('photo_id',id).maybeSingle();
  const organisation=await readPhotoTags(supabase,[id]);
  return Response.json({ photo: toPhoto(row as PhotoRow,user.id,signed?.signedUrl??'',conditions?.snapshot as PhotoConditions??null,organisation.tags.get(id)??emptyTags()), ...(warning ? { warning } : {}) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return new Response('Sign in required', { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  const { id } = await params;

  const { data: photo } = await supabase.from('photos').select('key').eq('id', id).eq('owner', user.id).maybeSingle();
  if (!photo) return new Response('Not found', { status: 404 });
  const { error: storageError } = await supabase.storage.from(mediaBucket(photo.key)).remove([photo.key]);
  const { error } = storageError ? { error: storageError } : await supabase.from('photos').delete().eq('id', id).eq('owner', user.id);
  if (error) return Response.json({ error: 'Could not delete this photo. Try again.' }, { status: 503 });
  return Response.json({ ok: true });
}
