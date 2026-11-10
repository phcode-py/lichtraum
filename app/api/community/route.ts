import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to join the correspondence.' }, { status: 401 });

  const [notes, people] = await Promise.all([
    supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.rpc('photo_contributors'),
  ]);
  if (notes.error || people.error) return Response.json({ error: 'Correspondence could not be loaded. Please try again.' }, { status: 503 });

  return Response.json({
    messages: notes.data.reverse().map(m => ({ id: m.id, content: m.content, author: m.author_name, createdAt: Date.parse(m.created_at), mine: m.owner === user.id })),
    contributors: (people.data as { name: string; count: number; latest: string }[]).map(p => ({ name: p.name, count: Number(p.count), latest: Date.parse(p.latest) })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return Response.json({ error: 'Sign in to write a message.' }, { status: 401 });
  if (isCrossOrigin(request)) return new Response('Forbidden', { status: 403 });
  if (Number(request.headers.get('content-length')) > 5000) return new Response('Message too long', { status: 413 });

  let payload: { content?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const content = typeof payload.content === 'string' ? payload.content.trim() : '';
  if (!content || content.length > 800) return Response.json({ error: 'Write a message of 1–800 characters.' }, { status: 400 });

  const { data: m, error } = await supabase.from('messages').insert({ owner: user.id, author_name: user.name, content }).select('*').single();
  if (error || !m) return Response.json({ error: 'Your message could not be sent. Please try again.' }, { status: 503 });
  return Response.json({ message: { id: m.id, author: m.author_name, content: m.content, createdAt: Date.parse(m.created_at), mine: true } }, { status: 201 });
}
