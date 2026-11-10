import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';

const CATEGORIES = ['Reflection', 'Light', 'Shadow', 'Other'];
const URL_TTL = 60 * 60 * 6; // signed image links last six hours

type PhotoRow = {
  id: string; owner: string; author_name: string; title: string; caption: string; place: string;
  category: string; walk: string; shared: boolean; lat: number; lng: number; key: string; created_at: string;
};

function toPhoto(p: PhotoRow, userId: string, url: string) {
  return {
    id: p.id, title: p.title, caption: p.caption, place: p.place, lat: p.lat, lng: p.lng,
    category: p.category, walk: p.walk, shared: p.shared ? 1 : 0, createdAt: Date.parse(p.created_at),
    author: p.author_name, mine: p.owner === userId, url,
  };
}

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to see your photos.' }, { status: 401 });
  // Row-level security limits this to your own photos plus shared ones.
  const { data: rows, error } = await supabase.from('photos').select('*').order('created_at', { ascending: false });
  if (error) return Response.json({ error: 'Your collection could not be loaded. Please try again.' }, { status: 503 });
  const signed = rows.length ? (await supabase.storage.from('photos').createSignedUrls(rows.map(r => r.key), URL_TTL)).data ?? [] : [];
  const urls = new Map(signed.map(s => [s.path, s.signedUrl]));
  return Response.json(
    { photos: (rows as PhotoRow[]).map(p => toPhoto(p, user.id, urls.get(p.key) ?? '')) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// The browser uploads the image straight to Supabase Storage (Vercel caps request bodies at 4.5 MB),
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

  const validKey = new RegExp(`^${user.id}/[0-9a-f-]{36}$`).test(key);
  if (!validKey || !title || title.length > 100 || caption.length > 600 || place.length > 100 ||
      !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 47.25 || lat > 47.5 || lng < 8.35 || lng > 8.75) {
    return Response.json({ error: 'Add a title, an image under 10 MB, and a location in Zürich.' }, { status: 400 });
  }

  const { data: row, error } = await supabase.from('photos')
    .insert({ owner: user.id, author_name: user.name, title, caption, place, category, walk, shared, lat, lng, key })
    .select('*').single();
  if (error || !row) {
    await supabase.storage.from('photos').remove([key]);
    return Response.json({ error: 'Your photo could not be saved. Please try again.' }, { status: 503 });
  }
  const { data: signed } = await supabase.storage.from('photos').createSignedUrl(key, URL_TTL);
  return Response.json({ photo: toPhoto(row as PhotoRow, user.id, signed?.signedUrl ?? '') }, { status: 201 });
}
