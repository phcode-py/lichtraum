import {mediaBucket, validMediaKey, storedMediaExists} from '@/lib/media';
import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';
import { CATEGORIES, URL_TTL, toPhoto, type PhotoRow } from '@/lib/photos';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to see your photos.' }, { status: 401 });
  // Row-level security limits this to your own photos plus shared ones.
  const { data: rows, error } = await supabase.from('photos').select('*').order('created_at', { ascending: false });
  if (error) return Response.json({ error: 'Your collection could not be loaded. Please try again.' }, { status: 503 });
  const urls = new Map<string, string>();
  await Promise.all(['photos', 'videos'].map(async bucket => {
    const keys = (rows as PhotoRow[]).filter(r => mediaBucket(r.key) === bucket).map(r => r.key);
    if (!keys.length) return;
    const {data: signed} = await supabase.storage.from(bucket).createSignedUrls(keys, URL_TTL);
    signed?.forEach(s => { if(s.path && s.signedUrl) urls.set(s.path, s.signedUrl); });
  }));
  return Response.json(
    { photos: (rows as PhotoRow[]).map(p => toPhoto(p, user.id, urls.get(p.key) ?? '')) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// The browser uploads the media straight to Supabase Storage (Vercel caps request bodies at 4.5 MB),
// then posts the photo's details here.
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to add photos.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const key = str(body.key), title = str(body.title), caption = str(body.caption), place = str(body.place) || 'Dropped pin';
  const walk = str(body.walk).slice(0, 100), lat = Number(body.lat), lng = Number(body.lng);
  const category = CATEGORIES.includes(str(body.category)) ? str(body.category) : 'Reflection';
  const shared = body.shared === true;

  const validKey = validMediaKey(key, user.id);
  if (!validKey || !title || title.length > 100 || caption.length > 600 || place.length > 100 ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 47.25 || lat > 47.5 || lng < 8.35 || lng > 8.75) {
    return Response.json({ error: 'Add a title, a photo or video, and a location in Zürich.' }, { status: 400 });
  }

  if (!await storedMediaExists(supabase, key)) return Response.json({error:'Upload a photo or video before posting.'}, {status:400});

  const { data: row, error } = await supabase.from('photos')
    .insert({ owner: user.id, author_name: user.name, title, caption, place, category, walk, shared, lat, lng, key })
    .select('*').single();
  if (error || !row) {
    return Response.json({ error: 'Your photo could not be saved. Please try again.' }, { status: 503 });
  }
  const { data: signed } = await supabase.storage.from(mediaBucket(key)).createSignedUrl(key, URL_TTL);
  return Response.json({ photo: toPhoto(row as PhotoRow, user.id, signed?.signedUrl ?? '') }, { status: 201 });
}
