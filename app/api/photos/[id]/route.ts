import { createClient, getSessionUser, isCrossOrigin } from '@/lib/supabase/server';

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
