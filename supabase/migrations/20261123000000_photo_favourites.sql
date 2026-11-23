-- Shared favourites in the Light atlas: anyone can star a photograph, everyone sees all stars,
-- and anyone can take a star away again. Each starred photograph has one row.
-- Prepared only: review and apply separately (see docs/photo-favourites-setup.md).
-- Adds one new table. No existing photograph, file, tag or permission is changed.
create table public.photo_favourites (
  photo_id uuid primary key references public.photos(id) on delete cascade,
  starred_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  starred_by_name text not null default '' check (char_length(starred_by_name) <= 80),
  created_at timestamptz not null default now()
);
alter table public.photo_favourites enable row level security;
-- Stars follow the photograph's own visibility.
create policy "See stars on visible photographs" on public.photo_favourites
  for select to authenticated using (exists (select 1 from public.photos p where p.id = photo_id));
create policy "Star visible photographs" on public.photo_favourites
  for insert to authenticated with check (
    starred_by = (select auth.uid()) and exists (select 1 from public.photos p where p.id = photo_id)
  );
-- Favourites are shared: anyone who can see the photograph can remove its star.
create policy "Unstar visible photographs" on public.photo_favourites
  for delete to authenticated using (exists (select 1 from public.photos p where p.id = photo_id));
revoke all on public.photo_favourites from anon, authenticated;
grant select, insert, delete on public.photo_favourites to authenticated;
