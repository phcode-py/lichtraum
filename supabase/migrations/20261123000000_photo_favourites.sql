-- Personal favourites in the Light atlas: each person stars photographs for themselves.
-- Prepared only: review and apply separately (see docs/photo-favourites-setup.md).
-- Adds one new table. No existing photograph, file, tag or permission is changed.
create table public.photo_favourites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, photo_id)
);
alter table public.photo_favourites enable row level security;
create policy "Read own favourites" on public.photo_favourites
  for select to authenticated using (user_id = (select auth.uid()));
-- A photograph can only be starred if the person can already see it.
create policy "Star visible photographs" on public.photo_favourites
  for insert to authenticated with check (
    user_id = (select auth.uid()) and exists (select 1 from public.photos p where p.id = photo_id)
  );
create policy "Unstar own favourites" on public.photo_favourites
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.photo_favourites from anon, authenticated;
grant select, insert, delete on public.photo_favourites to authenticated;
