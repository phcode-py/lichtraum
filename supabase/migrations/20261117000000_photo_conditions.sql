-- PREPARED ONLY. Creates a new, append-only companion table and an atomic
-- creation function. Does not alter/delete existing photos, files or tables.
create table public.photo_conditions (
  photo_id uuid primary key references public.photos(id) on delete cascade,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.photo_conditions enable row level security;
create policy "Read conditions of visible photos" on public.photo_conditions
  for select to authenticated using (
    exists (select 1 from public.photos p where p.id = photo_id)
  );
create policy "Attach conditions to own photos" on public.photo_conditions
  for insert to authenticated with check (
    exists (select 1 from public.photos p where p.id = photo_id and p.owner = (select auth.uid()))
  );
revoke all on public.photo_conditions from authenticated, anon;
grant select, insert on public.photo_conditions to authenticated;

-- A failure rolls back both inserts. Never delete a photo/file to compensate.
create function public.create_photo_with_conditions(p_photo jsonb, p_snapshot jsonb)
returns public.photos language plpgsql security invoker set search_path = '' as $$
declare new_photo public.photos;
begin
  insert into public.photos (owner, author_name, title, caption, place, category, walk, shared, lat, lng, key)
  values (auth.uid(), p_photo->>'author_name', p_photo->>'title', p_photo->>'caption',
    p_photo->>'place', p_photo->>'category', p_photo->>'walk', (p_photo->>'shared')::boolean,
    (p_photo->>'lat')::double precision, (p_photo->>'lng')::double precision, p_photo->>'key')
  returning * into new_photo;
  insert into public.photo_conditions (photo_id, snapshot) values (new_photo.id, p_snapshot);
  return new_photo;
end;
$$;
revoke all on function public.create_photo_with_conditions(jsonb, jsonb) from public, anon;
grant execute on function public.create_photo_with_conditions(jsonb, jsonb) to authenticated;
